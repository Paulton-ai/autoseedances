import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ToolNavbar } from "@/components/tools/ToolNavbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Video, Loader as Loader2, Download, Heart, Trash2, Sparkles, X, Image as ImageIcon, Music, CircleAlert as AlertCircle, ArrowLeft, Clock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/tools/video")({
  component: VideoToolPage,
  head: () => ({
    meta: [
      { title: "Video Generation — Auto Seedance AI" },
      { name: "description", content: "Generate AI videos with text prompts. 30 credits per video." },
    ],
  }),
});

const RESOLUTIONS = [
  { value: "720p", label: "720p (HD)" },
  { value: "1080p", label: "1080p (Full HD)" },
];
const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait/Shorts)" },
  { value: "1:1", label: "1:1 (Square)" },
];
const CREDITS_PER_VIDEO = 30;
const MAX_PROMPT_LENGTH = 4000;
type Generation = Tables<"generations">;

function VideoToolPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("text");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState("720p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [pollProgress, setPollProgress] = useState(0);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [referenceVideoUrls, setReferenceVideoUrls] = useState<string[]>([]);
  const [referenceAudioUrls, setReferenceAudioUrls] = useState<string[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear stale generation state on mount - never auto-resume
    setIsGenerating(false);
    setVideoUrl(null);
    setPollProgress(0);
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate({ to: "/login", search: { redirect: "/tools/video" } as any, replace: true }); return; }
      setUserId(user.id);
    });
  }, [navigate]);

  async function fetchGenerations(uid: string) {
    const { data } = await supabase.from("generations").select("*").eq("user_id", uid).eq("tool_type", "video").order("created_at", { ascending: false }).limit(30);
    setGenerations((data as Generation[]) ?? []);
  }

  useEffect(() => {
    if (!userId) return;
    fetchGenerations(userId);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [userId]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string[]>>, max: number, current: number) => {
    const files = e.target.files; if (!files) return;
    Array.from(files).forEach((file) => {
      if (current >= max) { toast.error(`Maximum ${max} files`); return; }
      if (file.size > 50 * 1024 * 1024) { toast.error("File too large (max 50MB)"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => { const b = ev.target?.result as string; if (b) setter((prev) => [...prev, b]); };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleGenerate = async () => {
    if (isGenerating) return;
    if (!prompt.trim()) { toast.error("Please enter a prompt"); return; }
    if (!userId) { navigate({ to: "/login", replace: true }); return; }

    const { data: wallet } = await supabase.from("credit_wallets").select("balance").eq("user_id", userId).maybeSingle();
    if (wallet && wallet.balance < CREDITS_PER_VIDEO) {
      toast.error("Insufficient credits", { action: { label: "Upgrade", onClick: () => window.location.href = "/pricing" } });
      return;
    }

    setIsGenerating(true);
    setVideoUrl(null);
    setPollProgress(0);

    try {
      const { data: creditResult, error: creditError } = await supabase.rpc("consume_credits", { _tool: "video", _amount: CREDITS_PER_VIDEO });
      if (creditError || !creditResult?.success) throw new Error(creditResult?.error || creditError?.message || "Failed to deduct credits");

      const hasRef = activeTab === "reference";
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt: prompt.trim(),
          resolution: resolution || "720p",
          duration: duration || "10",
          aspect_ratio: aspectRatio || "auto",
          generate_audio: generateAudio ?? true,
          image_urls: hasRef ? referenceImageUrls : [],
          video_urls: hasRef ? referenceVideoUrls : [],
          audio_urls: hasRef ? referenceAudioUrls : [],
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // Use the status_url and response_url returned by fal.ai
      const { status_url, response_url } = data;
      console.log("[video] Got status_url:", status_url, "response_url:", response_url);
      let pollCount = 0;

      pollingRef.current = setInterval(async () => {
        pollCount++;
        setPollProgress(Math.min(pollCount * 2.5, 95));
        if (pollCount > 40) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setIsGenerating(false);
          toast.error("Timed out — please try again");
          return;
        }
        try {
          const { data: pollData, error: pollError } = await supabase.functions.invoke("poll-generation", {
            body: { status_url, response_url },
          });
          if (pollError) { console.error("[video] Poll error:", pollError); return; }
          console.log("[video] Poll:", pollCount, pollData?.status);
          if (pollData?.status === "completed" && pollData?.video_url) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setPollProgress(100);
            setVideoUrl(pollData.video_url);
            setIsGenerating(false);

            await supabase.from("generations").insert({
              user_id: userId, tool_type: "video", prompt: prompt.trim(),
              settings: { duration, resolution, aspect_ratio: aspectRatio, generate_audio: generateAudio },
              status: "done", result_url: pollData.video_url, thumbnail_url: pollData.video_url, credits_used: CREDITS_PER_VIDEO,
            });
            fetchGenerations(userId);
            toast.success("Your video is ready!");
          }
          if (pollData?.status === "failed") {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            setIsGenerating(false);
            toast.error(pollData?.error || "Video generation failed");
          }
        } catch (e) {
          console.error("[video] Poll error:", e);
        }
      }, 5000);
    } catch (e: unknown) {
      setIsGenerating(false);
      toast.error(e instanceof Error ? e.message : "Generation failed");
    }
  };

  async function toggleFavorite(id: string, current: boolean) {
    await supabase.from("generations").update({ is_favorite: !current }).eq("id", id);
    if (userId) fetchGenerations(userId);
  }
  async function deleteGeneration(id: string) {
    await supabase.from("generations").delete().eq("id", id);
    if (userId) fetchGenerations(userId);
  }

  if (!userId) return null;

  return (
    <div className="min-h-screen bg-background pt-14">
      <ToolNavbar title="Video Generation" />
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition"><ArrowLeft className="size-5" /></Link>
          <div className="size-10 rounded-xl btn-gradient grid place-items-center"><Video className="size-5 text-white" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold">Video Generation</h1>
            <p className="text-muted-foreground text-sm">Create cinematic AI videos from text prompts</p>
          </div>
          <Badge variant="outline" className="ml-auto">{CREDITS_PER_VIDEO} credits</Badge>
        </div>

        <Card className="glass border-0 p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="text">Text to Video</TabsTrigger>
              <TabsTrigger value="reference">Reference to Video</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <div>
                <div className="flex justify-between items-center">
                  <Label>Prompt</Label>
                  <span className="text-xs text-muted-foreground">{prompt.length}/{MAX_PROMPT_LENGTH}</span>
                </div>
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your video scene..." rows={4} className="mt-1 bg-muted/50 border-border resize-none" disabled={isGenerating} maxLength={MAX_PROMPT_LENGTH} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2"><Label>Duration: {duration}s</Label></div>
                <Slider value={[duration]} onValueChange={([v]) => setDuration(v)} min={1} max={10} step={1} disabled={isGenerating} className="w-full" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>1s</span><span>10s</span></div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Resolution</Label>
                  <Select value={resolution} onValueChange={setResolution} disabled={isGenerating}>
                    <SelectTrigger className="mt-1 bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{RESOLUTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Aspect Ratio</Label>
                  <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isGenerating}>
                    <SelectTrigger className="mt-1 bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{ASPECT_RATIOS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <Label className="text-sm font-medium">Generate Audio</Label>
                  <p className="text-xs text-muted-foreground mt-1">AI generates matching background audio</p>
                </div>
                <Switch checked={generateAudio} onCheckedChange={setGenerateAudio} disabled={isGenerating} />
              </div>
            </TabsContent>

            <TabsContent value="reference" className="space-y-4">
              <div>
                <div className="flex justify-between items-center">
                  <Label>Prompt</Label>
                  <span className="text-xs text-muted-foreground">{prompt.length}/{MAX_PROMPT_LENGTH}</span>
                </div>
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your video. Use [image1], [video1], [audio1] in prompt to reference uploads." rows={4} className="mt-1 bg-muted/50 border-border resize-none" disabled={isGenerating} maxLength={MAX_PROMPT_LENGTH} />
              </div>
              <div>
                <Label>Reference Images (up to 9)</Label>
                <div className="p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {referenceImageUrls.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} alt={`Ref ${idx + 1}`} className="w-16 h-16 object-cover rounded" />
                        <button onClick={() => setReferenceImageUrls((p) => p.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 size-4 bg-destructive text-white rounded-full flex items-center justify-center"><X className="size-2" /></button>
                      </div>
                    ))}
                  </div>
                  {referenceImageUrls.length < 9 && (
                    <label className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded cursor-pointer transition">
                      <ImageIcon className="size-4" /><span className="text-sm">Add Image</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, setReferenceImageUrls, 9, referenceImageUrls.length)} disabled={isGenerating} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <Label>Reference Videos (up to 3)</Label>
                <div className="p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {referenceVideoUrls.map((vid, idx) => (
                      <div key={idx} className="relative">
                        <video src={vid} className="w-20 h-14 object-cover rounded bg-black" />
                        <button onClick={() => setReferenceVideoUrls((p) => p.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 size-4 bg-destructive text-white rounded-full flex items-center justify-center"><X className="size-2" /></button>
                      </div>
                    ))}
                  </div>
                  {referenceVideoUrls.length < 3 && (
                    <label className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded cursor-pointer transition">
                      <Video className="size-4" /><span className="text-sm">Add Video</span>
                      <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, setReferenceVideoUrls, 3, referenceVideoUrls.length)} disabled={isGenerating} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <Label>Reference Audios (up to 3)</Label>
                <div className="p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {referenceAudioUrls.map((aud, idx) => (
                      <div key={idx} className="relative flex items-center gap-2 px-2 py-1 bg-muted rounded">
                        <Music className="size-4" /><span className="text-xs">audio{idx + 1}</span>
                        <button onClick={() => setReferenceAudioUrls((p) => p.filter((_, i) => i !== idx))} className="size-4 bg-destructive text-white rounded-full flex items-center justify-center"><X className="size-2" /></button>
                      </div>
                    ))}
                  </div>
                  {referenceAudioUrls.length < 3 && (
                    <label className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded cursor-pointer transition">
                      <Music className="size-4" /><span className="text-sm">Add Audio</span>
                      <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, setReferenceAudioUrls, 3, referenceAudioUrls.length)} disabled={isGenerating} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2"><Label>Duration: {duration}s</Label></div>
                <Slider value={[duration]} onValueChange={([v]) => setDuration(v)} min={1} max={10} step={1} disabled={isGenerating} className="w-full" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Resolution</Label>
                  <Select value={resolution} onValueChange={setResolution} disabled={isGenerating}>
                    <SelectTrigger className="mt-1 bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{RESOLUTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Aspect Ratio</Label>
                  <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isGenerating}>
                    <SelectTrigger className="mt-1 bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{ASPECT_RATIOS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <Label className="text-sm font-medium">Generate Audio</Label>
                  <p className="text-xs text-muted-foreground mt-1">AI generates matching background audio</p>
                </div>
                <Switch checked={generateAudio} onCheckedChange={setGenerateAudio} disabled={isGenerating} />
              </div>
            </TabsContent>
          </Tabs>

          {isGenerating && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Generating video... (~2-3 minutes)</span>
              </div>
              <Progress value={pollProgress} className="h-2" />
            </div>
          )}

          {videoUrl && !isGenerating && (
            <div className="mt-6 rounded-xl overflow-hidden border border-border">
              <video src={videoUrl} controls className="w-full" />
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground mt-4">
            <Clock className="size-4 text-amber-500" />
            <span>Video generation takes ~2-3 minutes. You can browse history while waiting.</span>
          </div>
          <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()} className="mt-6 btn-gradient text-white border-0">
            {isGenerating ? <><Loader2 className="size-4 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="size-4 mr-2" /> Generate Video ({CREDITS_PER_VIDEO} credits)</>}
          </Button>
        </Card>

        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold">Your Videos</h2>
          {generations.length === 0 ? (
            <Card className="glass border-0 p-12 text-center mt-4">
              <Video className="size-12 mx-auto text-muted-foreground opacity-50" />
              <p className="mt-4 text-muted-foreground">No videos yet. Create your first one above!</p>
            </Card>
          ) : (
            <div className="space-y-4 mt-4">
              {generations.map((gen) => (
                <Card key={gen.id} className="glass border-0 overflow-hidden">
                  <div className="flex flex-col md:flex-row gap-4 p-4">
                    <div className="w-full md:w-48 shrink-0 aspect-video bg-black rounded-lg overflow-hidden grid place-items-center relative">
                      {gen.result_url ? (
                        <video src={gen.result_url} controls className="size-full object-contain" />
                      ) : gen.status === "processing" ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="size-8 animate-spin text-primary" />
                          <span className="text-xs text-white">Processing...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-destructive">
                          <AlertCircle className="size-6" />
                          <span className="text-xs">{gen.error || "Failed"}</span>
                        </div>
                      )}
                      {gen.is_favorite && gen.result_url && <div className="absolute top-2 right-2"><Heart className="size-4 fill-red-500 text-red-500" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{gen.prompt}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{gen.settings?.duration || 5}s</Badge>
                        <Badge variant="outline">{gen.settings?.resolution || "720p"}</Badge>
                        <Badge variant="outline">{gen.settings?.aspect_ratio || "16:9"}</Badge>
                        <span>{gen.credits_used} credits</span>
                        <span className="ml-auto">{new Date(gen.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex md:flex-col gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => toggleFavorite(gen.id, gen.is_favorite)}>
                        <Heart className={`size-4 ${gen.is_favorite ? "fill-red-500 text-red-500" : ""}`} />
                      </Button>
                      {gen.result_url && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={gen.result_url} download target="_blank" rel="noopener noreferrer"><Download className="size-4" /></a>
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteGeneration(gen.id)}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
