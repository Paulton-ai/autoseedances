import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ToolNavbar } from "@/components/tools/ToolNavbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Image as ImageIcon, Loader as Loader2, Download, Heart, Trash2, Sparkles,
  X, Plus, Upload, ZoomIn, Copy, ArrowLeft
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/tools/image")({
  component: ImageToolPage,
  head: () => ({
    meta: [
      { title: "AI Image Generator - Create 4K Art Free | Auto Seedance" },
      { name: "description", content: "Free AI image generator powered by Seedream 4.5. Create stunning 4K images from text prompts. Multiple styles: realistic, anime, illustration, oil painting. 5 credits per image." },
      { name: "keywords", content: "AI image generator, free AI art, text to image, 4K AI images, Seedream AI, AI image maker, photorealistic AI art" },
    ],
  }),
});

const IMAGE_SIZES = [
  { value: "auto_2K", label: "Auto 2K" },
  { value: "auto_4K", label: "Auto 4K" },
  { value: "square_hd", label: "Square HD" },
  { value: "landscape_4_3", label: "Landscape (4:3)" },
  { value: "portrait_4_3", label: "Portrait (4:3)" },
];

const STYLES = [
  { value: "realistic", label: "Realistic Photo" },
  { value: "illustration", label: "Digital Illustration" },
  { value: "vector", label: "Vector Art" },
  { value: "3d", label: "3D Render" },
  { value: "anime", label: "Anime/Manga" },
  { value: "oil", label: "Oil Painting" },
  { value: "watercolor", label: "Watercolor" },
];

const CREDITS_PER_IMAGE = 5;
const MAX_PROMPT_LENGTH = 4000;
type Generation = Tables<"generations">;

function GeneratingStatus({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);
  if (elapsed < 30) return <span>Generating your image… ({elapsed}s)</span>;
  if (elapsed < 60) return <span>Almost ready… ({elapsed}s)</span>;
  return <span>Taking longer than usual, please wait… ({elapsed}s)</span>;
}

function ImageToolPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("text");
  const [prompt, setPrompt] = useState("");
  const [selectedSize, setSelectedSize] = useState("auto_2K");
  const [selectedStyle, setSelectedStyle] = useState("realistic");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generateStartRef = useRef<number>(0);
  // Store the request_id so we can update the pending generation record later
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Clear stale generation state on mount - never auto-resume
    setIsGenerating(false);
    setGeneratedImages([]);
    requestIdRef.current = null;
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate({ to: "/login", search: { redirect: "/tools/image" } as any, replace: true }); return; }
      setUserId(user.id);
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));
    });
  }, [navigate]);

  async function fetchGenerations(uid: string) {
    const { data } = await supabase.from("generations").select("*").eq("user_id", uid).eq("tool_type", "image").order("created_at", { ascending: false }).limit(30);
    setGenerations((data as Generation[]) ?? []);
  }

  useEffect(() => {
    if (!userId) return;
    fetchGenerations(userId);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [userId]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (referenceImages.length >= 10) { toast.error("Maximum 10 reference images"); return; }
      if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
      const reader = new FileReader();
      reader.onload = (ev) => { const b = ev.target?.result as string; if (b) setReferenceImages((prev) => [...prev, b]); };
      reader.readAsDataURL(file);
    });
  }, [referenceImages.length]);

  const addUrl = useCallback(() => {
    if (!urlInput.trim()) return;
    if (referenceImages.length >= 10) { toast.error("Maximum 10 reference images"); return; }
    setReferenceImages((prev) => [...prev, urlInput.trim()]);
    setUrlInput("");
  }, [urlInput, referenceImages.length]);

  const removeImage = useCallback((index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGenerate = async () => {
    if (isGenerating) return;
    if (!prompt.trim()) { toast.error("Please enter a prompt"); return; }
    if (!userId) { navigate({ to: "/login", replace: true }); return; }

    // Admin check: skip credit checks
    if (!isAdmin) {
      const { data: wallet } = await supabase.from("credit_wallets").select("balance").eq("user_id", userId).maybeSingle();
      if (wallet && wallet.balance < CREDITS_PER_IMAGE) {
        toast.error("Insufficient credits", { action: { label: "Upgrade", onClick: () => window.location.href = "/pricing" } });
        return;
      }
    }

    setIsGenerating(true);
    generateStartRef.current = Date.now();
    setGeneratedImages([]);
    try {
      const { data: genData, error: genError } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt: prompt.trim(),
          image_size: selectedSize,
          style: selectedStyle,
          num_images: 1,
          reference_images: referenceImages.length > 0 ? referenceImages : undefined,
        },
      });
      if (genError || !genData?.success) throw new Error(genData?.error || genError?.message || "Generation failed");
      const { request_id, status_url } = genData;
      requestIdRef.current = request_id;
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        try {
          const { data: pollData } = await supabase.functions.invoke("poll-generation", { body: { request_id, status_url } });
          // NOTE: poll-generation returns "completed" (lowercase), not "COMPLETED"
          if (pollData?.status === "completed") {
            const imgs = pollData.image_urls || pollData.result?.images || pollData.result?.data?.images || pollData.result?.output?.images || pollData.result?.video || [];
            const flatImgs = (Array.isArray(imgs) ? imgs : []).filter(Boolean);
            if (flatImgs.length > 0) {
              setGeneratedImages(flatImgs);
              setIsGenerating(false);
              if (pollingRef.current) clearInterval(pollingRef.current);
              // Update the pending generation record to done with the result URL
              if (requestIdRef.current && userId) {
                await supabase.from("generations")
                  .update({ status: "done", result_url: flatImgs[0], thumbnail_url: flatImgs[0] })
                  .eq("external_id", requestIdRef.current)
                  .eq("user_id", userId);
              }
              fetchGenerations(userId);
            }
          } else if (pollData?.status === "failed") {
            setIsGenerating(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
            // Update the pending generation record to failed
            if (requestIdRef.current && userId) {
              await supabase.from("generations")
                .update({ status: "failed", error: pollData.error || "Generation failed" })
                .eq("external_id", requestIdRef.current)
                .eq("user_id", userId);
            }
            fetchGenerations(userId);
            toast.error(pollData.error || "Generation failed");
          }
        } catch { /* continue polling */ }
      }, 5000);
      setTimeout(() => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setIsGenerating(false);
        toast.error("Generation timed out. Check history for results.");
      }, 600000);
    } catch (err: any) {
      setIsGenerating(false);
      toast.error(err.message || "Generation failed");
    }
  };

  const saveFavorite = async (id: string) => {
    const { data } = await supabase.from("generations").select("is_favorite").eq("id", id).maybeSingle();
    const next = !((data as any)?.is_favorite ?? false);
    await supabase.from("generations").update({ is_favorite: next }).eq("id", id);
    setGenerations((prev) => prev.map((g) => g.id === id ? { ...g, is_favorite: next } : g));
  };
  const deleteGen = async (id: string) => {
    await supabase.from("generations").delete().eq("id", id);
    setGenerations((prev) => prev.filter((g) => g.id !== id));
    toast.success("Deleted");
  };
  const downloadGen = async (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.download = "generated-image.png";
    a.click();
  };
  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Prompt copied");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <ToolNavbar title="Image Generator" />
      <main className="flex-1 py-6 px-4 md:px-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/dashboard" })}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-2xl font-display font-bold">AI Image Generator</h1>
          <Badge variant="outline" className="ml-auto">Seedream 4.5</Badge>
        </div>
        <div className="grid lg:grid-cols-[1fr,320px] gap-6">
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="glass border-0">
                <TabsTrigger value="text">Text to Image</TabsTrigger>
                <TabsTrigger value="reference">Reference</TabsTrigger>
              </TabsList>
              <TabsContent value="text">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Prompt</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => { if (e.target.value.length <= MAX_PROMPT_LENGTH) setPrompt(e.target.value); }}
                      placeholder="Describe the image you want to create..."
                      className="min-h-[120px] glass border-0 mt-2 resize-none"
                    />
                    <div className="text-xs text-muted-foreground mt-1 text-right">{prompt.length}/{MAX_PROMPT_LENGTH}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Style</Label>
                      <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                        <SelectTrigger className="glass border-0 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STYLES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Size</Label>
                      <Select value={selectedSize} onValueChange={setSelectedSize}>
                        <SelectTrigger className="glass border-0 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {IMAGE_SIZES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="reference">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Prompt</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => { if (e.target.value.length <= MAX_PROMPT_LENGTH) setPrompt(e.target.value); }}
                      placeholder="Describe the image you want to create..."
                      className="min-h-[80px] glass border-0 mt-2 resize-none"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Reference Images</Label>
                    <div className="mt-2 grid grid-cols-5 gap-2">
                      {referenceImages.map((img, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden glass border-0">
                          <img src={img} alt="Ref" className="w-full h-full object-cover" />
                          <Button size="icon" variant="ghost" className="absolute top-1 right-1 size-6 bg-black/50 hover:bg-black/70" onClick={() => removeImage(i)}>
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))}
                      {referenceImages.length < 10 && (
                        <>
                          <label className="aspect-square rounded-lg border-2 border-dashed border-muted flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition">
                            <Upload className="size-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground mt-1">Upload</span>
                            <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
                          </label>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Or paste image URL..." className="glass border-0" />
                      <Button size="icon" variant="ghost" onClick={addUrl}><Plus className="size-4" /></Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-primary" />
              <span>{CREDITS_PER_IMAGE} credits per image</span>
              {isAdmin && <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs">Admin</Badge>}
            </div>
            <Button
              className="w-full btn-gradient text-white border-0 h-12"
              disabled={isGenerating || !prompt.trim()}
              onClick={handleGenerate}
            >
              {isGenerating ? <Loader2 className="animate-spin size-5" /> : <><Sparkles className="size-4 mr-2" /> Generate Image</>}
            </Button>
            {isGenerating && (
              <div className="space-y-2">
                <Progress value={45} className="h-2" />
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="animate-spin size-4" />
                  <GeneratingStatus startTime={generateStartRef.current} />
                </div>
              </div>
            )}
            {generatedImages.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {generatedImages.map((img, i) => (
                  <div key={i} className="group relative rounded-lg overflow-hidden glass border-0 cursor-pointer" onClick={() => setLightboxImage(img)}>
                    <img src={img} alt="Generated" className="w-full aspect-square object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <Button size="icon" variant="ghost" className="text-white" onClick={(e) => { e.stopPropagation(); downloadGen(img); }}>
                        <Download className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-sm text-muted-foreground">Recent Generations</h3>
            {generations.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <ImageIcon className="size-8 mx-auto mb-2 opacity-50" />
                No images generated yet.
              </div>
            )}
            <div className="space-y-3">
              {generations.map((g) => (
                <Card key={g.id} className="glass border-0 p-3 overflow-hidden">
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                    {g.result_url ? (
                      <img src={g.result_url} alt="Generated" className="w-full h-full object-cover" loading="lazy" />
                    ) : g.status === "processing" || g.status === "pending" ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin size-5 text-primary" />
                        <span className="text-xs text-muted-foreground">Processing...</span>
                      </div>
                    ) : (
                      <ImageIcon className="size-6 text-muted-foreground" />
                    )}
                    {g.status === "done" && g.result_url && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition flex items-center justify-center gap-2">
                        <Button size="icon" variant="ghost" className="text-white" onClick={() => downloadGen(g.result_url!)}><Download className="size-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-white" onClick={() => copyPrompt(g.prompt)}><Copy className="size-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-white" onClick={() => setLightboxImage(g.result_url!)}><ZoomIn className="size-4" /></Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground line-clamp-1">{g.prompt}</p>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="size-6" onClick={() => saveFavorite(g.id)}>
                        <Heart className={`size-3 ${g.is_favorite ? "fill-red-500 text-red-500" : ""}`} />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-6 text-destructive" onClick={() => deleteGen(g.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
      {lightboxImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="Lightbox" className="max-w-full max-h-[90vh] rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
