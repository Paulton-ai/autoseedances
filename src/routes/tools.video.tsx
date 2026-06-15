import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Video, Loader as Loader2, Download, Heart, Trash2, Sparkles,
  X, Plus, Upload, Play, Clock, Image as ImageIcon, Music
} from "lucide-react";
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

type Generation = Tables<"generations">;

function VideoToolPage() {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState("text");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(7);
  const [resolution, setResolution] = useState("720p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const pollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Reference inputs
  const [firstFrameImage, setFirstFrameImage] = useState<string | null>(null);
  const [lastFrameImage, setLastFrameImage] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceVideos, setReferenceVideos] = useState<string[]>([]);
  const [referenceAudios, setReferenceAudios] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [urlType, setUrlType] = useState<"image" | "video" | "audio">("image");

  const CREDITS_PER_VIDEO = 30;
  const MAX_PROMPT_LENGTH = 4000;

  async function fetchGenerations() {
    if (!user) return;
    const { data } = await supabase
      .from("generations")
      .select("*")
      .eq("user_id", user.id)
      .eq("tool_type", "video")
      .order("created_at", { ascending: false })
      .limit(30);
    setGenerations((data as Generation[]) ?? []);
  }

  async function fetchBalance() {
    if (!user) return;
    const { data } = await supabase
      .from("credit_wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    setBalance(data?.balance ?? 0);
  }

  useEffect(() => {
    fetchGenerations();
    fetchBalance();

    if (user) {
      const channel = supabase
        .channel("video-generations")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "generations",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchGenerations()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        pollingRef.current.forEach((timer) => clearInterval(timer));
      };
    }
  }, [user]);

  const handleFileUpload = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    maxCount: number,
    fileType: "image" | "video" | "audio"
  ) => {
    const files = e.target.files;
    if (!files) return;

    const currentLength = fileType === "image" ? referenceImages.length :
                          fileType === "video" ? referenceVideos.length :
                          referenceAudios.length;

    Array.from(files).forEach((file) => {
      if (currentLength >= maxCount) {
        toast.error(`Maximum ${maxCount} ${fileType}s allowed`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setter((prev) => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [referenceImages.length, referenceVideos.length, referenceAudios.length]);

  const handleSingleFileUpload = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string | null>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) setter(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const addUrlByType = useCallback(() => {
    if (!urlInput.trim()) return;

    switch (urlType) {
      case "image":
        if (referenceImages.length < 9) {
          setReferenceImages((prev) => [...prev, urlInput.trim()]);
        } else {
          toast.error("Maximum 9 reference images allowed");
          return;
        }
        break;
      case "video":
        if (referenceVideos.length < 3) {
          setReferenceVideos((prev) => [...prev, urlInput.trim()]);
        } else {
          toast.error("Maximum 3 reference videos allowed");
          return;
        }
        break;
      case "audio":
        if (referenceAudios.length < 3) {
          setReferenceAudios((prev) => [...prev, urlInput.trim()]);
        } else {
          toast.error("Maximum 3 reference audios allowed");
          return;
        }
        break;
    }
    setUrlInput("");
  }, [urlInput, urlType, referenceImages.length, referenceVideos.length, referenceAudios.length]);

  async function pollForResult(predictionId: string, generationId: string) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const maxAttempts = 200;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/poll-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prediction_id: predictionId }),
        });
        const data = await res.json();

        if (data.status === "succeeded" && data.output) {
          await supabase
            .from("generations")
            .update({
              result_url: data.output,
              status: "done",
              updated_at: new Date().toISOString(),
            })
            .eq("id", generationId);

          pollingRef.current.delete(predictionId);
          fetchGenerations();
          fetchBalance();
          toast.success("Video generated!");
          return true;
        }

        if (data.status === "failed") {
          await supabase
            .from("generations")
            .update({ status: "failed", error: data.error || "Generation failed" })
            .eq("id", generationId);
          pollingRef.current.delete(predictionId);
          fetchGenerations();
          toast.error("Video generation failed");
          return true;
        }

        const progress = Math.min(95, (attempts / maxAttempts) * 100);
        await supabase
          .from("generations")
          .update({
            settings: { duration, resolution, aspectRatio, generateAudio, progress }
          })
          .eq("id", generationId);
        fetchGenerations();

        return false;
      } catch (e) {
        console.error("Poll error:", e);
        return false;
      }
    };

    const interval = setInterval(async () => {
      const done = await poll();
      if (done || attempts >= maxAttempts) {
        clearInterval(interval);
        pollingRef.current.delete(predictionId);
        if (attempts >= maxAttempts) {
          await supabase
            .from("generations")
            .update({ status: "failed", error: "Generation timed out" })
            .eq("id", generationId);
          fetchGenerations();
          toast.error("Video generation timed out");
        }
      }
    }, 3000);

    pollingRef.current.set(predictionId, interval as unknown as NodeJS.Timeout);
  }

  async function handleGenerate() {
    if (!user || !prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      toast.error(`Prompt too long (max ${MAX_PROMPT_LENGTH} characters)`);
      return;
    }

    if (balance !== null && balance < CREDITS_PER_VIDEO) {
      toast.error("Not enough credits", { description: `You need ${CREDITS_PER_VIDEO} credits. You have ${balance}.` });
      return;
    }

    setGenerating(true);

    try {
      const { data: creditResult, error: creditError } = await supabase.rpc("consume_credits", {
        _tool: "video",
        _amount: CREDITS_PER_VIDEO,
      });

      if (creditError || !creditResult?.success) {
        throw new Error(creditResult?.error || creditError?.message || "Failed to deduct credits");
      }

      setBalance(creditResult.new_balance);

      const { data: genData, error: genError } = await supabase
        .from("generations")
        .insert({
          user_id: user.id,
          tool_type: "video",
          prompt: prompt.trim(),
          settings: {
            duration,
            resolution,
            aspectRatio,
            generateAudio,
            progress: 0,
            has_reference: activeTab === "reference",
          },
          status: "processing",
          credits_used: CREDITS_PER_VIDEO,
        })
        .select("id")
        .single();

      if (genError || !genData) {
        throw new Error("Failed to create generation record");
      }

      const generationId = genData.id;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const requestBody: Record<string, unknown> = {
        prompt: prompt.trim(),
        duration,
        resolution,
        aspect_ratio: aspectRatio,
        generate_audio: generateAudio,
      };

      if (activeTab === "reference") {
        if (firstFrameImage) requestBody.image = firstFrameImage;
        if (lastFrameImage && firstFrameImage) requestBody.last_frame_image = lastFrameImage;
        if (referenceImages.length > 0) requestBody.reference_images = referenceImages;
        if (referenceVideos.length > 0) requestBody.reference_videos = referenceVideos;
        if (referenceAudios.length > 0) requestBody.reference_audios = referenceAudios;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || "Generation failed");
      }

      if (result.prediction_id) {
        await supabase
          .from("generations")
          .update({ external_id: result.prediction_id })
          .eq("id", generationId);

        pollForResult(result.prediction_id, generationId);
        fetchGenerations();
        toast.success("Video generation started!", { description: "This typically takes 2-3 minutes." });
      }

      setPrompt("");
      setFirstFrameImage(null);
      setLastFrameImage(null);
      setReferenceImages([]);
      setReferenceVideos([]);
      setReferenceAudios([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  async function toggleFavorite(id: string, current: boolean) {
    await supabase.from("generations").update({ is_favorite: !current }).eq("id", id);
    fetchGenerations();
  }

  async function deleteGeneration(id: string) {
    await supabase.from("generations").delete().eq("id", id);
    fetchGenerations();
  }

  const getStatusMessage = (status: string, progress: number) => {
    if (status === "processing") {
      if (progress < 10) return "Queued...";
      if (progress < 95) return "Processing...";
      return "Almost done...";
    }
    return "";
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl btn-gradient grid place-items-center">
          <Video className="size-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Video Generation</h1>
          <p className="text-muted-foreground text-sm">Create stunning AI videos from text prompts</p>
        </div>
        <Badge variant="outline" className="ml-auto">{CREDITS_PER_VIDEO} credits</Badge>
      </div>

      {balance !== null && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-primary" />
          Balance: <span className="font-semibold text-foreground">{balance}</span> credits
        </div>
      )}

      <Card className="glass border-0 p-6 mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="text">Text to Video</TabsTrigger>
            <TabsTrigger value="reference">Reference / Ingredients to Video</TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="prompt-text">Prompt</Label>
                <span className="text-xs text-muted-foreground">{prompt.length}/{MAX_PROMPT_LENGTH}</span>
              </div>
              <Textarea
                id="prompt-text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your video scene... e.g., 'A cinematic drone shot of a futuristic city at night, neon lights reflecting on wet streets, slow motion'"
                rows={4}
                className="mt-1 bg-muted/50 border-border resize-none"
                disabled={generating}
                maxLength={MAX_PROMPT_LENGTH}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Duration</Label>
                <span className="text-sm text-muted-foreground">{duration === -1 ? "Auto" : `${duration}s`}</span>
              </div>
              <Slider
                value={[duration]}
                onValueChange={([v]) => setDuration(v)}
                min={1}
                max={15}
                step={1}
                disabled={generating}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1s</span>
                <span>Auto</span>
                <span>15s</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Resolution</Label>
                <Select value={resolution} onValueChange={setResolution} disabled={generating}>
                  <SelectTrigger className="mt-1 bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLUTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={generating}>
                  <SelectTrigger className="mt-1 bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
              <div>
                <Label className="text-sm font-medium">Generate audio</Label>
                <p className="text-xs text-muted-foreground mt-1">Add AI-generated sound effects and ambiance</p>
              </div>
              <Switch checked={generateAudio} onCheckedChange={setGenerateAudio} disabled={generating} />
            </div>
          </TabsContent>

          <TabsContent value="reference" className="space-y-4">
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="prompt-ref">Prompt</Label>
                <span className="text-xs text-muted-foreground">{prompt.length}/{MAX_PROMPT_LENGTH}</span>
              </div>
              <Textarea
                id="prompt-ref"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your video. Use [image1], [video1], [audio1] to reference your uploaded media."
                rows={4}
                className="mt-1 bg-muted/50 border-border resize-none"
                disabled={generating}
                maxLength={MAX_PROMPT_LENGTH}
              />
            </div>

            {/* First/Last Frame */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>First Frame Image (Optional)</Label>
                <div className="mt-2 p-3 border border-border rounded-lg bg-muted/30">
                  {firstFrameImage ? (
                    <div className="relative group">
                      <img src={firstFrameImage} alt="First frame" className="w-full h-32 object-cover rounded" />
                      <button
                        onClick={() => setFirstFrameImage(null)}
                        className="absolute -top-2 -right-2 size-5 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-32 cursor-pointer hover:bg-muted/50 transition rounded">
                      <Upload className="size-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Upload or drag</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleSingleFileUpload(e, setFirstFrameImage)}
                        disabled={generating}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <Label>Last Frame Image (Requires first frame)</Label>
                <div className="mt-2 p-3 border border-border rounded-lg bg-muted/30">
                  {lastFrameImage ? (
                    <div className="relative group">
                      <img src={lastFrameImage} alt="Last frame" className="w-full h-32 object-cover rounded" />
                      <button
                        onClick={() => setLastFrameImage(null)}
                        className="absolute -top-2 -right-2 size-5 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center h-32 cursor-pointer hover:bg-muted/50 transition rounded ${!firstFrameImage ? "opacity-50 cursor-not-allowed" : ""}`}>
                      <Upload className="size-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">Upload or drag</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleSingleFileUpload(e, setLastFrameImage)}
                        disabled={generating || !firstFrameImage}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Reference Images */}
            <div>
              <Label>Reference Images (up to 9)</Label>
              <div className="mt-2 p-3 border border-border rounded-lg bg-muted/30">
                <div className="flex flex-wrap gap-2 mb-3">
                  {referenceImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img} alt={`Ref ${idx + 1}`} className="w-16 h-16 object-cover rounded" />
                      <button
                        onClick={() => setReferenceImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 size-4 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="size-2" />
                      </button>
                      <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/70 text-white px-1 rounded">[{idx + 1}]</span>
                    </div>
                  ))}
                </div>
                {referenceImages.length < 9 && (
                  <label className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded cursor-pointer transition">
                    <ImageIcon className="size-4" />
                    <span className="text-sm">Add Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, setReferenceImages, 9, "image")}
                      disabled={generating}
                    />
                  </label>
                )}
                <p className="text-xs text-muted-foreground mt-2">Use [image1], [image2] in prompt</p>
              </div>
            </div>

            {/* Reference Videos */}
            <div>
              <Label>Reference Videos (up to 3, max 15s each)</Label>
              <div className="mt-2 p-3 border border-border rounded-lg bg-muted/30">
                <div className="flex flex-wrap gap-2 mb-3">
                  {referenceVideos.map((vid, idx) => (
                    <div key={idx} className="relative group">
                      <video src={vid} className="w-20 h-14 object-cover rounded bg-black" />
                      <button
                        onClick={() => setReferenceVideos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 size-4 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="size-2" />
                      </button>
                      <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/70 text-white px-1 rounded">[v{idx + 1}]</span>
                    </div>
                  ))}
                </div>
                {referenceVideos.length < 3 && (
                  <label className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded cursor-pointer transition">
                    <Video className="size-4" />
                    <span className="text-sm">Add Video</span>
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, setReferenceVideos, 3, "video")}
                      disabled={generating}
                    />
                  </label>
                )}
                <p className="text-xs text-muted-foreground mt-2">Use [video1], [video2] in prompt</p>
              </div>
            </div>

            {/* Reference Audios */}
            <div>
              <Label>Reference Audios (up to 3, max 15s each)</Label>
              <div className="mt-2 p-3 border border-border rounded-lg bg-muted/30">
                <div className="flex flex-wrap gap-2 mb-3">
                  {referenceAudios.map((aud, idx) => (
                    <div key={idx} className="relative flex items-center gap-2 px-2 py-1 bg-muted rounded">
                      <Music className="size-4" />
                      <span className="text-xs">audio{idx + 1}</span>
                      <button
                        onClick={() => setReferenceAudios((prev) => prev.filter((_, i) => i !== idx))}
                        className="size-4 bg-destructive text-white rounded-full flex items-center justify-center"
                      >
                        <X className="size-2" />
                      </button>
                    </div>
                  ))}
                </div>
                {referenceAudios.length < 3 && (
                  <label className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded cursor-pointer transition">
                    <Music className="size-4" />
                    <span className="text-sm">Add Audio</span>
                    <input
                      type="file"
                      accept="audio/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, setReferenceAudios, 3, "audio")}
                      disabled={generating}
                    />
                  </label>
                )}
                <p className="text-xs text-muted-foreground mt-2">Use [audio1], [audio2] in prompt</p>
              </div>
            </div>

            {/* Duration, Resolution, Aspect Ratio for reference tab */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Duration</Label>
                <span className="text-sm text-muted-foreground">{duration}s</span>
              </div>
              <Slider
                value={[duration]}
                onValueChange={([v]) => setDuration(v)}
                min={1}
                max={15}
                step={1}
                disabled={generating}
                className="w-full"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Resolution</Label>
                <Select value={resolution} onValueChange={setResolution} disabled={generating}>
                  <SelectTrigger className="mt-1 bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLUTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={generating}>
                  <SelectTrigger className="mt-1 bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
              <div>
                <Label className="text-sm font-medium">Generate audio</Label>
                <p className="text-xs text-muted-foreground mt-1">Add AI-generated sound effects</p>
              </div>
              <Switch checked={generateAudio} onCheckedChange={setGenerateAudio} disabled={generating} />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground mt-4">
          <Clock className="size-4 text-amber-500" />
          <span>Video generation takes 2-3 minutes. You can leave this page and check your <strong>History</strong> later.</span>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="mt-6 btn-gradient text-white border-0"
        >
          {generating ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" /> Starting...
            </>
          ) : (
            <>
              <Sparkles className="size-4 mr-2" /> Generate Video ({CREDITS_PER_VIDEO} credits)
            </>
          )}
        </Button>
      </Card>

      {/* History */}
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
                      <video
                        src={gen.result_url}
                        controls
                        className="size-full object-contain"
                      />
                    ) : gen.status === "processing" ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-8 animate-spin text-primary" />
                        <span className="text-xs text-white">{getStatusMessage(gen.status, gen.settings?.progress || 0)}</span>
                        <Progress value={gen.settings?.progress || 0} className="w-20" />
                      </div>
                    ) : (
                      <div className="text-destructive text-xs">{gen.error || "Failed"}</div>
                    )}
                    {gen.is_favorite && gen.result_url && (
                      <div className="absolute top-2 right-2">
                        <Heart className="size-4 fill-red-500 text-red-500" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{gen.prompt}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{gen.settings?.duration || 7}s</Badge>
                      <Badge variant="outline">{gen.settings?.resolution || "720p"}</Badge>
                      <Badge variant="outline">{gen.settings?.aspectRatio || "16:9"}</Badge>
                      <span>{gen.credits_used} credits</span>
                      <span className="ml-auto">{new Date(gen.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex md:flex-col gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFavorite(gen.id, gen.is_favorite)}
                    >
                      <Heart className={`size-4 ${gen.is_favorite ? "fill-red-500 text-red-500" : ""}`} />
                    </Button>
                    {gen.result_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={gen.result_url} download target="_blank" rel="noopener noreferrer">
                          <Download className="size-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => deleteGeneration(gen.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
