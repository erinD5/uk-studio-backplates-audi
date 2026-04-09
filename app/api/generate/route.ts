import { NextResponse } from "next/server";
import { UK_EV_PLATE_TEXT } from "@/lib/locks";

interface GenerateRequestBody {
  imageBase64?: string;
  instruction?: string;
  outputMode?: "WITH_CAR" | "BACKPLATE_ONLY";
  plateFacing?: "front" | "rear";
  driveSide?: "RHD" | "LHD";
  motionIntent?: "DRIVING" | "PARKED";
  resolution?: "1K" | "2K" | "4K";
  aspectRatio?: "1:1" | "16:9" | "4:5" | "3:2";
  variationIndex?: number;
  cameraLockHints?: string;
  referenceSceneCategory?: string;
  referenceImages?: Array<{
    data: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
  }>;
}

interface GeminiPart {
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
  text?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const imageBase64 = sanitizeBase64(body.imageBase64 ?? "");
    const instruction = body.instruction?.trim();
    const instructionLower = (instruction ?? "").toLowerCase();
    const outputMode = sanitizeOutputMode(body.outputMode);
    const plateFacing = sanitizePlateFacing(body.plateFacing, instructionLower);
    const driveSide = sanitizeDriveSide(body.driveSide);
    const motionIntent = sanitizeMotionIntent(body.motionIntent);
    const resolution = sanitizeResolution(body.resolution);
    const aspectRatio = sanitizeAspectRatio(body.aspectRatio);
    const variationIndex = sanitizeVariationIndex(body.variationIndex);
    const cameraLockHints = sanitizeCameraLockHints(body.cameraLockHints);
    const referenceSceneCategory = sanitizeSceneCategory(body.referenceSceneCategory);
    const referenceImages = sanitizeReferenceImages(body.referenceImages);
    const isCityRequest =
      /\bcity|urban|city street|city streets|town centre|town center\b/.test(instructionLower);
    const isDryRequest = /\bdry|dry weather|no rain|no wet\b/.test(instructionLower);

    if (!imageBase64 || !instruction) {
      return NextResponse.json(
        { error: "imageBase64 and instruction are required." },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing." },
        { status: 500 },
      );
    }

    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";
    const response = await fetch(
      `${endpoint}?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: detectMime(imageBase64),
                    data: imageBase64,
                  },
                },
                ...referenceImages.map((ref) => ({
                  inline_data: {
                    mime_type: ref.mimeType,
                    data: ref.data,
                  },
                })),
                ...(referenceImages.length
                  ? [
                      {
                        text: `REFERENCE LOCK: Use the selected reference images as primary art-direction anchors. Locked scene category: ${referenceSceneCategory}. Match their scene type, road typology, lighting mood, weather character, and color palette. If prompt text conflicts, reference images take priority.`,
                      },
                    ]
                  : []),
                ...(cameraLockHints
                  ? [
                      {
                        text: `CAMERA LOCK HINTS (CRITICAL): ${cameraLockHints}. Keep identical camera distance/lens compression and do not zoom in or crop tighter than source.`,
                      },
                    ]
                  : []),
                {
                  text:
                    outputMode === "BACKPLATE_ONLY"
                      ? "BACKPLATE-ONLY LOCK (CRITICAL): Generate background only with NO vehicle visible in final output. Use AVP image solely as camera-geometry reference (angle, horizon, lens feel, vanishing point, road perspective). Remove all cars from frame. Do not invent any plate text, road text, or alphanumeric markings."
                      : `VEHICLE PERSPECTIVE LOCK (CRITICAL): Keep the AVP vehicle exactly as provided: identical angle, yaw, pitch, camera elevation, scale, and frame position. Build environment perspective around the car. Never rotate, shift, re-frame, zoom, or change vehicle size in frame. Exception: registration plate text should read exactly "${UK_EV_PLATE_TEXT}" and be rendered in UK EV style (${plateFacing === "rear" ? "rear plate yellow reflective with green flash band on the left" : "front plate white reflective with green flash band on the left"}).`,
                },
                {
                  text:
                    outputMode === "BACKPLATE_ONLY"
                      ? "POSITION ANCHOR LOCK: Preserve original road perspective, horizon, and curb alignment from source. Do not reframe scene."
                      : "POSITION ANCHOR LOCK (CRITICAL): Vehicle wheel contact points and body bounding box must stay in same screen position as source AVP. Keep same amount of headroom and side margins.",
                },
                {
                  text:
                    driveSide === "RHD"
                      ? "POSITIONING LOCK (RHD): Vehicle placement zone must resolve to RIGHT side context in composition. Never center and never left-side placement language in scene logic."
                      : "POSITIONING LOCK (LHD): Vehicle placement zone must resolve to LEFT side context in composition. Never center and never right-side placement language in scene logic.",
                },
                {
                  text:
                    outputMode === "BACKPLATE_ONLY"
                      ? "MOTION LOCK: Background-only output. No vehicles should be rendered, but preserve roadway perspective and lane intent suitable for the requested motion context."
                      : motionIntent === "DRIVING"
                        ? "MOTION LOCK (DRIVING): Vehicle must read as actively driving in-lane. Never parked, never stationary pose, never center-lane dead stop. Maintain realistic forward travel cues. Vehicle heading must align naturally with lane direction (no diagonal road-blocking pose)."
                        : "MOTION LOCK (PARKED): Vehicle must read as parked/static. No driving blur or active motion cues.",
                },
                ...(isCityRequest
                  ? [
                      {
                        text: "CITY ROAD LOCK (CRITICAL): Use UK city streets only. No motorways, no dual carriageways, no freeway-style lanes, no overhead gantries, no highway barriers. Prefer local urban roads with believable UK street scale.",
                      },
                    ]
                  : []),
                {
                  text: 'ROAD MARKING LOCK: Use realistic UK lane lines only. Do not paint words/letters/numbers on the road surface. Never render "UK" markings, registration text, or any alphanumeric characters on the road.',
                },
                ...(isDryRequest
                  ? [
                      {
                        text: "DRY WEATHER LOCK: Road surface must read dry with no rain streaks, puddles, or wet reflective sheen.",
                      },
                    ]
                  : []),
                {
                  text: "LIGHTING LOCK (CRITICAL): Preserve requested time-of-day and lighting category exactly. If instruction specifies golden-hour, output must remain golden-hour in every variant.",
                },
                {
                  text: "ATMOSPHERE CLEANLINESS LOCK: No haze, smoke, fog, mist, dust bloom, or milky veil unless explicitly requested in instruction. Keep air clear and crisp.",
                },
                {
                  text: "AUDI BRAND LOCK: premium and progressive look; vehicle remains hero; background is supportive, clean, and uncluttered. Avoid distracting architecture density and visual noise.",
                },
                {
                  text: `OUTPUT FORMAT LOCK: Compose for aspect ratio ${aspectRatio}. Target delivery size is ${resolution}. Maintain composition integrity while honoring this frame format.`,
                },
                {
                  text: `VARIATION REQUEST: Generate distinct creative option ${variationIndex + 1} of 4 for this same brief and camera lock. Keep all hard constraints, but vary environment composition details, weather micro-conditions, and background structure.`,
                },
                { text: instruction },
              ],
            },
          ],
          generationConfig: { responseModalities: ["image", "text"] },
        }),
      },
    );

    const payload = (await response.json()) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: GeminiPart[] } }[];
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.error?.message ??
            "Gemini request failed with an unknown error.",
        },
        { status: response.status || 500 },
      );
    }

    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData || part.inline_data);
    const data = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
    const mimeType =
      imagePart?.inlineData?.mimeType ??
      imagePart?.inline_data?.mime_type ??
      "image/png";

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Gemini returned no image. Try adjusting the brief or rerun the pipeline.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ imageBase64: data, mimeType }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected generation error.",
      },
      { status: 500 },
    );
  }
}

function sanitizeBase64(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, "").trim();
}

function detectMime(imageBase64: string): "image/png" | "image/jpeg" {
  return imageBase64.startsWith("iVBOR") ? "image/png" : "image/jpeg";
}

function sanitizeReferenceImages(
  input: GenerateRequestBody["referenceImages"],
): Array<{ data: string; mimeType: "image/jpeg" | "image/png" | "image/webp" }> {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter(
      (img) =>
        img?.data &&
        (img.mimeType === "image/jpeg" ||
          img.mimeType === "image/png" ||
          img.mimeType === "image/webp"),
    )
    .map((img) => ({
      data: sanitizeBase64(img.data),
      mimeType: img.mimeType,
    }))
    .filter((img) => img.data.length > 64)
    .slice(0, 4);
}

function sanitizeSceneCategory(input: string | undefined): string {
  const allowed = new Set([
    "CITY_STREET",
    "COASTAL_ROAD",
    "HIGHLAND_ROAD",
    "COUNTRY_ROAD",
    "MIXED",
    "UNKNOWN",
  ]);
  return input && allowed.has(input) ? input : "UNKNOWN";
}

function sanitizeResolution(input: string | undefined): "1K" | "2K" | "4K" {
  if (input === "2K" || input === "4K") return input;
  return "1K";
}

function sanitizeAspectRatio(
  input: string | undefined,
): "1:1" | "16:9" | "4:5" | "3:2" {
  if (input === "16:9" || input === "4:5" || input === "3:2") return input;
  return "1:1";
}

function sanitizeVariationIndex(input: number | undefined): number {
  if (typeof input !== "number" || Number.isNaN(input)) return 0;
  if (input < 0) return 0;
  if (input > 3) return 3;
  return Math.floor(input);
}

function sanitizeDriveSide(input: string | undefined): "RHD" | "LHD" {
  return input === "LHD" ? "LHD" : "RHD";
}

function sanitizeMotionIntent(input: string | undefined): "DRIVING" | "PARKED" {
  return input === "DRIVING" ? "DRIVING" : "PARKED";
}

function sanitizeOutputMode(
  input: string | undefined,
): "WITH_CAR" | "BACKPLATE_ONLY" {
  return input === "BACKPLATE_ONLY" ? "BACKPLATE_ONLY" : "WITH_CAR";
}

function sanitizePlateFacing(
  input: string | undefined,
  instructionLower: string,
): "front" | "rear" {
  if (input === "front" || input === "rear") return input;
  if (/\bdirect-rear|rear-3\/4|rear straight-on|rear view|tailgate\b/.test(instructionLower)) {
    return "rear";
  }
  return "front";
}

function sanitizeCameraLockHints(input: string | undefined): string {
  if (!input) return "";
  return input.trim().slice(0, 1200);
}
