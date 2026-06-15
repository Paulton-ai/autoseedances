import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
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
import { toast } from "sonner";
import {
  Image as ImageIcon, Loader as Loader2, Download, Heart, Trash2, Sparkles,
  X, Plus, Upload, Link as LinkIcon, ZoomIn
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/tools/image")({
  component: ImageToolPage,
  head: () => ({
    meta: [
      { title: "Image Generation — Auto Seedance AI" },
      { name: "description", content: "Generate AI images with text prompts. 5 credits per image." },
    ],
  }),
});

const SIZES = [
  { value: "2K", label: "2K (2048px)" },
  { value: "4K", label: "4K (4096px)" },
];

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
  { value: "1:1", label: "1:1 (Square)" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "match_input_image", label: "Match Input Image" },
];

type Generation = Tables<"generations">;

function ImageToolPage() {
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState("text");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("2K");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [width, setWidth] = useState(2048);
  const [height, setHeight] = useState(2048);
  const [maxImages, setMaxImages] = useState(1);
  const [sequentialMode, setSequentialMode] = useState<"disabled" | "auto">("disabled");
  const [imageInputs, setImageInputs] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const CREDITS_PER_IMAGE = 5;
  const MAX_PROMPT_LENGTH = 4000;

  async function fetchGenerations() {
    if (!user) return;
    const { data } = await supabase
      .from("generations")
      .select("*")
      .eq("user_id", user.id)
      .eq("tool_type", "image")
      .order("created_at", { ascending: false })
      .limit(50);
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
  }, [user]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (imageInputs.length >= 14) {
        toast.error("Maximum 14 images allowed");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setImageInputs((prev) => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, [imageInputs.length]);

  const addUrl = useCallback(() => {
    if (!urlInput.trim()) return;
    if (imageInputs.length >= 14) {
      toast.error("Maximum 14 images allowed");
      return;
    }
    setImageInputs((prev) => [...prev, urlInput.trim()]);
    setUrlInput("");
  }, [urlInput, imageInputs.length]);

  const removeImage = useCallback((index: number) => {
    setImageInputs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  async function pollForResult(predictionId: string, generationId: string) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const maxAttempts = 120;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/poll-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prediction_id: predictionId }),
        });
        const data = await res.json();

        if (data.status === "succeeded" && data.output?.length > 0) {
          await supabase
            .from("generations")
            .update({
              result_url: data.output[0],
              thumbnail_url: data.output[0],
              status: "done",
              updated_at: new Date().toISOString(),
            })
            .eq("id", generationId);
          return data.output;
        }

        if (data.status === "failed") {
          throw new Error(data.error || "Generation failed");
        }
      } catch (e) {
        console.error("Poll error:", e);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error("Generation timed out");
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

    if (balance !== null && balance < CREDITS_PER_IMAGE) {
      toast.error("Not enough credits", { description: `You need ${CREDITS_PER_IMAGE} credits. You have ${balance}.` });
      return;
    }

    if (activeTab === "reference" && imageInputs.length === 0) {
      toast.error("Please upload at least one reference image");
      return;
    }

    setGenerating(true);

    try {
      const { data: creditResult, error: creditError } = await supabase.rpc("consume_credits", {
        _tool: "image",
        _amount: CREDITS_PER_IMAGE,
      });

      if (creditError || !creditResult?.success) {
        throw new Error(creditResult?.error || creditError?.message || "Failed to deduct credits");
      }

      setBalance(creditResult.new_balance);

      const { data: genData, error: genError } = await supabase
        .from("generations")
        .insert({
          user_id: user.id,
          tool_type: "image",
          prompt: prompt.trim(),
          settings: {
            size,
            aspect_ratio: aspectRatio,
            width: size === "2K" ? 2048 : 4096,
            height: size === "2K" ? 2048 : 4096,
            max_images: maxImages,
            sequential_image_generation: sequentialMode,
            has_reference_images: activeTab === "reference",
          },
          status: "processing",
          credits_used: CREDITS_PER_IMAGE,
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
        size,
        aspect_ratio: aspectRatio,
        width: size === "2K" ? 2048 : 4096,
        height: size === "2K" ? 2048 : 4096,
        max_images: maxImages,
        sequential_image_generation: sequentialMode,
      };

      if (activeTab === "reference" && imageInputs.length > 0) {
        requestBody.image_input = imageInputs;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || "Generation failed");
      }

      if (result.images && result.images.length > 0) {
        await supabase
          .from("generations")
          .update({
            result_url: result.images[0],
            thumbnail_url: result.images[0],
            status: "done",
            external_id: result.prediction_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", generationId);

        toast.success("Image generated!");
        fetchGenerations();
      } else if (result.prediction_id) {
        await supabase
          .from("generations")
          .update({ external_id: result.prediction_id })
          .eq("id", generationId);

        pollForResult(result.prediction_id, generationId)
          .then(() => {
            toast.success("Image generated!");
            fetchGenerations();
          })
          .catch((e) => {
            supabase.from("generations").update({ status: "failed", error: e.message }).eq("id", generationId);
            toast.error("Generation failed", { description: e.message });
            fetchGenerations();
          });
      }

      setPrompt("");
      setImageInputs([]);
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

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-xl btn-gradient grid place-items-center">
          <ImageIcon className="size-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Image Generation</h1>
          <p className="text-muted-foreground text-sm">Create stunning AI images from text prompts</p>
        </div>
        <Badge variant="outline" className="ml-auto">{CREDITS_PER_IMAGE} credits</Badge>
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
            <TabsTrigger value="text">Text to Image</TabsTrigger>
            <TabsTrigger value="reference">Reference / Ingredients to Image</TabsTrigger>
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
                placeholder="Describe your image... e.g., 'A serene mountain lake at sunset, photorealistic, golden hour lighting'"
                rows={4}
                className="mt-1 bg-muted/50 border-border resize-none"
                disabled={generating}
                maxLength={MAX_PROMPT_LENGTH}
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Size</Label>
                <Select value={size} onValueChange={setSize} disabled={generating}>
                  <SelectTrigger className="mt-1 bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
                    {ASPECT_RATIOS.map((ar) => (
                      <SelectItem key={ar.value} value={ar.value}>{ar.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Max Images (1-15)</Label>
                <Input
                  type="number"
                  min={1}
                  max={15}
                  value={maxImages}
                  onChange={(e) => setMaxImages(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="mt-1 bg-muted/50 border-border"
                  disabled={generating}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="sequential-text">Sequential Image Generation</Label>
              <Switch
                id="sequential-text"
                checked={sequentialMode === "auto"}
                onCheckedChange={(checked) => setSequentialMode(checked ? "auto" : "disabled")}
                disabled={generating}
              />
              <span className="text-sm text-muted-foreground">{sequentialMode}</span>
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
                placeholder="Describe your image. Reference your uploaded images in the prompt."
                rows={4}
                className="mt-1 bg-muted/50 border-border resize-none"
                disabled={generating}
                maxLength={MAX_PROMPT_LENGTH}
              />
            </div>

            <div>
              <Label>Image Input (1-14 images)</Label>
              <div className="mt-2 p-4 border-2 border-dashed border-border rounded-lg bg-muted/30">
                <div className="flex flex-wrap gap-3 mb-4">
                  {imageInputs.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={img}
                        alt={`Reference ${idx + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-border"
                      />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute -top-2 -right-2 size-5 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                      >
                        <X className="size-3" />
                      </button>
                      <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1 rounded">
                        [{idx + 1}]
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg cursor-pointer transition">
                    <Upload className="size-4" />
                    <span className="text-sm">Upload Files</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={generating || imageInputs.length >= 14}
                    />
                  </label>

                  <div className="flex items-center gap-2">
                    <Input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Paste image URL..."
                      className="bg-muted/50 border-border w-48"
                      disabled={generating || imageInputs.length >= 14}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addUrl}
                      disabled={generating || !urlInput.trim() || imageInputs.length >= 14}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  {imageInputs.length}/14 images. Reference them in your prompt as [image1], [image2], etc.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Size</Label>
                <Select value={size} onValueChange={setSize} disabled={generating}>
                  <SelectTrigger className="mt-1 bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
                    {ASPECT_RATIOS.map((ar) => (
                      <SelectItem key={ar.value} value={ar.value}>{ar.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Max Images (1-15)</Label>
                <Input
                  type="number"
                  min={1}
                  max={15}
                  value={maxImages}
                  onChange={(e) => setMaxImages(Math.min(15, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="mt-1 bg-muted/50 border-border"
                  disabled={generating}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="sequential-ref">Sequential Image Generation</Label>
              <Switch
                id="sequential-ref"
                checked={sequentialMode === "auto"}
                onCheckedChange={(checked) => setSequentialMode(checked ? "auto" : "disabled")}
                disabled={generating}
              />
              <span className="text-sm text-muted-foreground">{sequentialMode}</span>
            </div>
          </TabsContent>
        </Tabs>

        <Button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="mt-6 btn-gradient text-white border-0"
        >
          {generating ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Sparkles className="size-4 mr-2" /> Generate Image ({CREDITS_PER_IMAGE} credits)
            </>
          )}
        </Button>
      </Card>

      {/* History */}
      <div className="mt-10">
        <h2 className="font-display text-xl font-semibold">Your Images</h2>

        {generations.length === 0 ? (
          <Card className="glass border-0 p-12 text-center mt-4">
            <ImageIcon className="size-12 mx-auto text-muted-foreground opacity-50" />
            <p className="mt-4 text-muted-foreground">No images yet. Create your first one above!</p>
          </Card>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 mt-4 space-y-4">
            {generations.map((gen) => (
              <Card key={gen.id} className="glass border-0 overflow-hidden break-inside-avoid group">
                <div className="relative bg-muted">
                  {gen.result_url ? (
                    <img
                      src={gen.result_url}
                      alt={gen.prompt}
                      className="w-full cursor-zoom-in"
                      loading="lazy"
                      onClick={() => setLightboxImage(gen.result_url)}
                    />
                  ) : gen.status === "processing" ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2">
                      <Loader2 className="size-8 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Generating...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <ImageIcon className="size-12 text-muted-foreground opacity-50" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    {gen.result_url && (
                      <Button size="sm" variant="secondary" onClick={() => setLightboxImage(gen.result_url)}>
                        <ZoomIn className="size-4" />
                      </Button>
                    )}
                    {gen.result_url && (
                      <Button size="sm" variant="secondary" asChild>
                        <a href={gen.result_url} download target="_blank" rel="noopener noreferrer">
                          <Download className="size-4" />
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => toggleFavorite(gen.id, gen.is_favorite)}>
                      <Heart className={`size-4 ${gen.is_favorite ? "fill-red-500 text-red-500" : ""}`} />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteGeneration(gen.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {gen.is_favorite && (
                    <div className="absolute top-2 right-2">
                      <Heart className="size-5 fill-red-500 text-red-500 drop-shadow" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm line-clamp-2">{gen.prompt}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{gen.settings?.size || "2K"}</Badge>
                    <span>{gen.credits_used} cr</span>
                    <span className="ml-auto">{new Date(gen.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightboxImage(null)}
          >
            <X className="size-8" />
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
          />
          <a
            href={lightboxImage}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Button className="btn-gradient text-white border-0">
              <Download className="size-4 mr-2" /> Download
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}
