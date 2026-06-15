import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReplicatePrediction {
  id: string;
  status: string;
  output?: Array<string> | string | null;
  error?: string;
}

const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")!;
const REPLICATE_API_URL = "https://api.replicate.com/v1";

async function createPrediction(input: {
  prompt: string;
  size?: string;
  aspect_ratio?: string;
  width?: number;
  height?: number;
  max_images?: number;
  image_input?: string[];
  sequential_image_generation?: string;
}): Promise<ReplicatePrediction> {
  const response = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      "Prefer": "wait",
    },
    body: JSON.stringify({
      version: "bytedance/seedream-3",
      input: {
        prompt: input.prompt.trim(),
        size: input.size || "2K",
        aspect_ratio: input.aspect_ratio || "1:1",
        width: input.width || 2048,
        height: input.height || 2048,
        max_images: input.max_images || 1,
        image_input: input.image_input || [],
        sequential_image_generation: input.sequential_image_generation || "disabled",
      },
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
      size,
      aspect_ratio,
      width,
      height,
      max_images,
      image_input,
      sequential_image_generation,
    } = body;

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validSizes = ["2K", "4K"];
    const validAspectRatios = ["16:9", "9:16", "1:1", "4:3", "3:4", "match_input_image"];
    const validSequentialModes = ["disabled", "auto"];

    const finalSize = validSizes.includes(size) ? size : "2K";
    const finalAspectRatio = validAspectRatios.includes(aspect_ratio) ? aspect_ratio : "1:1";
    const finalWidth = typeof width === "number" && width >= 1024 && width <= 4096 ? width : 2048;
    const finalHeight = typeof height === "number" && height >= 1024 && height <= 4096 ? height : 2048;
    const finalMaxImages = typeof max_images === "number" && max_images >= 1 && max_images <= 15 ? max_images : 1;
    const finalSequentialMode = validSequentialModes.includes(sequential_image_generation) ? sequential_image_generation : "disabled";

    // Handle image_input - can be URLs or base64 data
    const finalImageInput: string[] = [];
    if (Array.isArray(image_input) && image_input.length > 0) {
      for (const img of image_input) {
        if (typeof img === "string" && (img.startsWith("http") || img.startsWith("data:"))) {
          finalImageInput.push(img);
        }
      }
    }

    const prediction = await createPrediction({
      prompt: prompt.trim(),
      size: finalSize,
      aspect_ratio: finalAspectRatio,
      width: finalWidth,
      height: finalHeight,
      max_images: finalMaxImages,
      image_input: finalImageInput,
      sequential_image_generation: finalSequentialMode,
    });

    // Parse output
    let images: string[] = [];
    if (prediction.output) {
      if (Array.isArray(prediction.output)) {
        images = prediction.output.filter((o): o is string => typeof o === "string");
      } else if (typeof prediction.output === "string") {
        images = [prediction.output];
      }
    }

    if (prediction.status === "succeeded" && images.length > 0) {
      return new Response(JSON.stringify({
        success: true,
        images,
        prediction_id: prediction.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      prediction_id: prediction.id,
      status: prediction.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-image:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
