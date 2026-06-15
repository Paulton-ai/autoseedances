import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReplicatePrediction {
  id: string;
  status: string;
  output?: string | null;
  error?: string;
}

const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")!;
const REPLICATE_API_URL = "https://api.replicate.com/v1";

async function createVideoPrediction(input: {
  prompt: string;
  duration?: number;
  resolution?: string;
  aspect_ratio?: string;
  generate_audio?: boolean;
  image?: string;
  last_frame_image?: string;
  reference_images?: string[];
  reference_videos?: string[];
  reference_audios?: string[];
}): Promise<ReplicatePrediction> {
  const body: Record<string, unknown> = {
    prompt: input.prompt.trim(),
    duration: input.duration || 7,
    resolution: input.resolution || "720p",
    aspect_ratio: input.aspect_ratio || "16:9",
    generate_audio: input.generate_audio !== false,
  };

  // Add optional reference inputs
  if (input.image) body.image = input.image;
  if (input.last_frame_image) body.last_frame_image = input.last_frame_image;
  if (input.reference_images && input.reference_images.length > 0) {
    body.reference_images = input.reference_images;
  }
  if (input.reference_videos && input.reference_videos.length > 0) {
    body.reference_videos = input.reference_videos;
  }
  if (input.reference_audios && input.reference_audios.length > 0) {
    body.reference_audios = input.reference_audios;
  }

  const response = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "minimax/video-01",
      input: body,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Replicate API error: ${response.status} ${error}`);
  }

  return response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      prompt,
      duration,
      resolution,
      aspect_ratio,
      generate_audio,
      image,
      last_frame_image,
      reference_images,
      reference_videos,
      reference_audios,
    } = body;

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validResolutions = ["720p", "1080p"];
    const validAspectRatios = ["16:9", "9:16", "1:1"];

    const finalResolution = validResolutions.includes(resolution) ? resolution : "720p";
    const finalAspectRatio = validAspectRatios.includes(aspect_ratio) ? aspect_ratio : "16:9";
    const finalDuration = typeof duration === "number" && duration >= 1 && duration <= 15 ? duration : 7;
    const finalGenerateAudio = typeof generate_audio === "boolean" ? generate_audio : true;

    // Validate and filter reference inputs
    const finalImage = typeof image === "string" && (image.startsWith("http") || image.startsWith("data:")) ? image : undefined;
    const finalLastFrame = typeof last_frame_image === "string" && (last_frame_image.startsWith("http") || last_frame_image.startsWith("data:")) ? last_frame_image : undefined;

    const finalRefImages: string[] = [];
    if (Array.isArray(reference_images)) {
      for (const img of reference_images.slice(0, 9)) {
        if (typeof img === "string" && (img.startsWith("http") || img.startsWith("data:"))) {
          finalRefImages.push(img);
        }
      }
    }

    const finalRefVideos: string[] = [];
    if (Array.isArray(reference_videos)) {
      for (const vid of reference_videos.slice(0, 3)) {
        if (typeof vid === "string" && (vid.startsWith("http") || vid.startsWith("data:"))) {
          finalRefVideos.push(vid);
        }
      }
    }

    const finalRefAudios: string[] = [];
    if (Array.isArray(reference_audios)) {
      for (const aud of reference_audios.slice(0, 3)) {
        if (typeof aud === "string" && (aud.startsWith("http") || aud.startsWith("data:"))) {
          finalRefAudios.push(aud);
        }
      }
    }

    const prediction = await createVideoPrediction({
      prompt: prompt.trim(),
      duration: finalDuration,
      resolution: finalResolution,
      aspect_ratio: finalAspectRatio,
      generate_audio: finalGenerateAudio,
      image: finalImage,
      last_frame_image: finalLastFrame,
      reference_images: finalRefImages,
      reference_videos: finalRefVideos,
      reference_audios: finalRefAudios,
    });

    return new Response(JSON.stringify({
      success: true,
      prediction_id: prediction.id,
      status: prediction.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-video:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
