import { NextRequest, NextResponse } from "next/server";
import { UK_EV_PLATE_TEXT } from "@/lib/locks";

interface GeminiPart {
  inlineData?: { data?: string; mimeType?: string };
  inline_data?: { data?: string; mime_type?: string };
  text?: string;
}

const VARIANT_DIRECTIVES = [
  "CAMERA PRESET A (1/4): rear three-quarter view from left, slightly elevated, 35mm lens feel, vehicle fills about 62-68% of frame.",
  "CAMERA PRESET B (2/4): rear three-quarter view from right, slightly elevated, 35mm lens feel, vehicle fills about 62-68% of frame.",
  "CAMERA PRESET C (3/4): side-biased three-quarter view from left, slightly elevated, 50mm lens feel, vehicle fills about 58-64% of frame.",
  "CAMERA PRESET D (4/4): centered rear three-quarter view, slightly higher elevation, 28mm lens feel, vehicle fills about 60-66% of frame.",
] as const;

const GEMINI_IMAGE_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";
const GEMINI_TEXT_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      avpImageBase64?: string;
      gradient?: {
        topHex?: string;
        bottomHex?: string;
      };
      lighting?: {
        direction?:
          | "left"
          | "right"
          | "overhead"
          | "front"
          | "rim"
          | "split"
          | "three-point";
        style?: "soft" | "hard";
      };
    };
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required." }, { status: 400 });
    }
    const avp = sanitizeBase64(body.avpImageBase64);
    const avpMime = detectMime(avp);

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 500 });
    }

    const gradient = normalizeGradient(body.gradient);
    if (!gradient) {
      return NextResponse.json({ error: "gradient with topHex and bottomHex is required." }, { status: 400 });
    }
    const lighting = normalizeLighting(body.lighting);
    if (!lighting) {
      return NextResponse.json(
        { error: "lighting with direction and style is required." },
        { status: 400 },
      );
    }

    const first = await callGeminiStudioWithReference(
      prompt,
      process.env.GEMINI_API_KEY as string,
      avp,
      avpMime,
      0,
      gradient,
      lighting,
    );
    const generatedBatch = [first];
    if (first.imageBase64) {
      for (const variantIndex of [1, 2, 3]) {
        const variant = await callGeminiStudioWithReference(
          prompt,
          process.env.GEMINI_API_KEY as string,
          avp,
          avpMime,
          variantIndex,
          gradient,
          lighting,
        );
        generatedBatch.push(variant);
      }
    }

    const successful = generatedBatch.filter(
      (item): item is { imageBase64: string; mimeType: string; warning?: string } =>
        Boolean(item.imageBase64 && item.mimeType),
    );
    if (!successful.length) {
      return NextResponse.json(
        {
          error:
            generatedBatch.find((item) => item.error)?.error ??
            "Studio generation failed. Try different settings.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      imageUrls: successful.map((item) => `data:${item.mimeType};base64,${item.imageBase64}`),
      prompt,
      warning: successful.map((item) => item.warning).filter(Boolean).join(" ").trim() || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected studio generation error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function callGeminiStudioWithReference(
  prompt: string,
  apiKey: string,
  avpBase64: string,
  avpMime: "image/jpeg" | "image/png",
  variantIndex: number,
  gradient: { topHex: string; bottomHex: string },
  lighting: {
    direction: "left" | "right" | "overhead" | "front" | "rim" | "split" | "three-point";
    style: "soft" | "hard";
  },
): Promise<{
  imageBase64: string | null;
  mimeType: string;
  error?: string;
  warning?: string;
}> {
  let attemptPrompt = prompt;
  let lastError: string | undefined;
  let lastGenerated: { imageBase64: string; mimeType: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const generated = await callGeminiImageOnce({
      prompt: attemptPrompt,
      apiKey,
      avpBase64,
      avpMime,
      variantIndex,
      gradient,
      lighting,
    });
    if (!generated.imageBase64) {
      lastError = generated.error;
      continue;
    }
    lastGenerated = { imageBase64: generated.imageBase64, mimeType: generated.mimeType };

    const validation = await validateGradientBackground({
      apiKey,
      imageBase64: generated.imageBase64,
      mimeType: generated.mimeType,
      gradient,
    });
    if (validation.pass) {
      return generated;
    }

    lastError = `Background drift detected: ${validation.reason}`;
    attemptPrompt = [
      prompt,
      "",
      `BACKGROUND CORRECTION RETRY ${attempt + 1}:`,
      `Use EXACT seamless gradient ${gradient.topHex} (top) -> ${gradient.bottomHex} (bottom).`,
      "No white/neutral plain backdrop, no cutout-card look, no bright blank background, no gradient washout.",
      "No black vignette or dark-corner falloff. Keep tonal values close to selected hexes.",
    ].join("\n");
  }

  if (lastGenerated) {
    return {
      imageBase64: lastGenerated.imageBase64,
      mimeType: lastGenerated.mimeType,
      warning: lastError ? `Background drift detected: ${lastError}` : "Background drift detected.",
    };
  }

  return {
    imageBase64: null,
    mimeType: "image/png",
    error: lastError ?? "Studio model request failed.",
  };
}

async function callGeminiImageOnce(input: {
  prompt: string;
  apiKey: string;
  avpBase64: string;
  avpMime: "image/jpeg" | "image/png";
  variantIndex: number;
  gradient: { topHex: string; bottomHex: string };
  lighting: {
    direction: "left" | "right" | "overhead" | "front" | "rim" | "split" | "three-point";
    style: "soft" | "hard";
  };
}): Promise<{
  imageBase64: string | null;
  mimeType: string;
  error?: string;
}> {
  const response = await fetch(
    `${GEMINI_IMAGE_ENDPOINT}?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              ...(input.avpBase64
                ? [
                    {
                      inline_data: {
                        mime_type: input.avpMime,
                        data: input.avpBase64,
                      },
                    },
                  ]
                : []),
              {
                text:
                  "REFERENCE LOCK: Use AVP image as composition/camera reference only. Follow user prompt and preserve believable automotive framing.",
              },
              {
                text:
                  "COLOUR LOCK (CRITICAL): Preserve the vehicle paint exactly from AVP input. No recolor, no tint shift, no hue/saturation/value change, no brightening to silver, no darkening to black.",
              },
              {
                text:
                  "LIGHT STATE LOCK (CRITICAL): Preserve exact AVP light state. If headlights/DRLs/tail lights are OFF in AVP, keep them OFF with no glow or beam. Do not turn lights on.",
              },
              {
                text: [
                  `UK REG PLATE LOCK (CRITICAL): If a registration plate is visible, it must read exactly "${UK_EV_PLATE_TEXT}".`,
                  "Rear plate must be UK EV style: yellow reflective plate with green flash band on left; black UK registration typography and realistic spacing.",
                  "Front plate must be UK EV style: white reflective plate with green flash band on left; black UK registration typography and realistic spacing.",
                  "Never output non-UK plate formatting, US/EU plate proportions, random characters, or blank/placeholder plate text.",
                ].join(" "),
              },
              {
                text:
                  "CONSISTENCY LOCK (CRITICAL): Keep outputs highly consistent across batch in brand look, vehicle identity, paint, light-state, and gradient treatment. Camera/framing MUST follow per-variant preset.",
              },
              {
                text: `LIGHTING DIRECTION LOCK (CRITICAL): ${lightingDirectionLock(input.lighting.direction)}`,
              },
              {
                text: `LIGHTING STYLE LOCK (CRITICAL): ${lightingStyleLock(input.lighting.style)}`,
              },
              {
                text: `GRADIENT HEX LOCK (CRITICAL): exact seamless gradient ${input.gradient.topHex} (top) to ${input.gradient.bottomHex} (bottom).`,
              },
              {
                text:
                  "GRADIENT TONAL LOCK (CRITICAL): Keep background luminance close to selected hex gradient values. No heavy darkening, no black crush, no corner vignette, no dark falloff patches.",
              },
              {
                text:
                  "QUALITY LOCK: premium Audi studio style, photoreal output, clean surfaces, no watermarks or visible text.",
              },
              {
                text:
                  VARIANT_DIRECTIVES[input.variantIndex] ??
                  `VARIANT ${input.variantIndex + 1}/4: maintain consistent look with controlled framing variation.`,
              },
              {
                text:
                  "VARIATION LOCK (CRITICAL): Output must be visibly different from the other variants in camera angle/framing. Do not produce near-duplicates.",
              },
              {
                text:
                  "STYLE SEPARATION LOCK (CRITICAL): Respect selected lighting style exactly. Do not collapse to a generic neutral overhead studio look.",
              },
              { text: input.prompt },
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
    return {
      imageBase64: null,
      mimeType: "image/png",
      error: payload.error?.message ?? "Studio model request failed.",
    };
  }

  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData || part.inline_data);
  const data = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
  const mimeType =
    imagePart?.inlineData?.mimeType ??
    imagePart?.inline_data?.mime_type ??
    "image/png";

  if (!data) {
    return { imageBase64: null, mimeType: "image/png", error: "Studio model returned no image." };
  }
  return { imageBase64: data, mimeType };
}

async function validateGradientBackground(input: {
  apiKey: string;
  imageBase64: string;
  mimeType: string;
  gradient: { topHex: string; bottomHex: string };
}): Promise<{ pass: boolean; reason: string }> {
  const response = await fetch(
    `${GEMINI_TEXT_ENDPOINT}?key=${encodeURIComponent(input.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: input.mimeType,
                  data: input.imageBase64,
                },
              },
              {
                text: [
                  "Return strict JSON only: {\"pass\": boolean, \"reason\": string}.",
                  `pass=true ONLY if background is a seamless gradient close to ${input.gradient.topHex} -> ${input.gradient.bottomHex}, with no white/plain background, no harsh vignette, and no heavy black crush.`,
                  "If background is mostly white/light gray plain, pass=false.",
                ].join("\n"),
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!response.ok) {
    return { pass: true, reason: "Validation unavailable" };
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) return { pass: true, reason: "Validation empty" };

  try {
    const parsed = parseJsonPayload<{ pass?: boolean; reason?: string }>(text);
    return { pass: Boolean(parsed.pass), reason: parsed.reason ?? "Unknown" };
  } catch {
    return { pass: true, reason: "Validation parse fallback" };
  }
}

function sanitizeBase64(input: string | undefined): string {
  if (!input) return "";
  return input.replace(/^data:[^;]+;base64,/, "").trim();
}

function detectMime(base64: string): "image/jpeg" | "image/png" {
  if (!base64) return "image/jpeg";
  if (base64.startsWith("iVBOR")) return "image/png";
  return "image/jpeg";
}

function normalizeGradient(input: {
  topHex?: string;
  bottomHex?: string;
} | undefined): { topHex: string; bottomHex: string } | null {
  if (!input?.topHex || !input?.bottomHex) return null;
  const topHex = input.topHex.trim();
  const bottomHex = input.bottomHex.trim();
  const isHex = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value);
  if (!isHex(topHex) || !isHex(bottomHex)) return null;
  return { topHex, bottomHex };
}

function normalizeLighting(input: {
  direction?:
    | "left"
    | "right"
    | "overhead"
    | "front"
    | "rim"
    | "split"
    | "three-point";
  style?: "soft" | "hard";
} | undefined):
  | {
      direction: "left" | "right" | "overhead" | "front" | "rim" | "split" | "three-point";
      style: "soft" | "hard";
    }
  | null {
  if (!input?.direction || !input.style) return null;
  const validDirection = ["left", "right", "overhead", "front", "rim", "split", "three-point"];
  const validStyle = ["soft", "hard"];
  if (!validDirection.includes(input.direction) || !validStyle.includes(input.style)) return null;
  return { direction: input.direction, style: input.style };
}

function lightingStyleLock(style: "soft" | "hard"): string {
  const map = {
    soft:
      "SOFT STYLE (MANDATORY): Use diffused key light with soft highlight roll-off and feathered shadows. Keep transitions smooth and contrast moderate-to-low.",
    hard:
      "HARD STYLE (MANDATORY): Studio lighting should read as practically OFF (very low-key). Cut ambient/fill drastically, keep illumination minimal, drive shadows very deep with hard edges, allow only tight specular accents, and enforce high contrast. Avoid broad bright highlights or soft lifted shadows.",
  } as const;
  return map[style];
}

function lightingDirectionLock(
  direction: "left" | "right" | "overhead" | "front" | "rim" | "split" | "three-point",
): string {
  const map = {
    left:
      "LEFT DIRECTION (MANDATORY): Key light from camera-left. Left-facing body panels brighter, right side darker, and shadow falloff trends to camera-right.",
    right:
      "RIGHT DIRECTION (MANDATORY): Key light from camera-right. Right-facing body panels brighter, left side darker, and shadow falloff trends to camera-left.",
    overhead:
      "OVERHEAD DIRECTION (MANDATORY): Key from overhead. Roof/shoulder highlights strongest; lower body and wheel-arch regions darker.",
    front:
      "FRONT DIRECTION (MANDATORY): Key from camera-front. Front fascia/bonnet highlights dominate; side-to-side contrast reduced compared with side light.",
    rim:
      "RIM/BACKLIT DIRECTION (MANDATORY): Back/rim light. Silhouette edge highlights are pronounced while central body mass remains darker.",
    split:
      "SPLIT DIRECTION (MANDATORY): One side of vehicle clearly bright and the opposite side clearly dark with strong bilateral contrast split.",
    "three-point":
      "THREE-POINT DIRECTION (MANDATORY): Distinct key, fill, and rim behavior with readable edge separation and controlled modeling.",
  } as const;
  return map[direction];
}

function parseJsonPayload<T>(text: string): T {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? text.trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  const jsonText =
    firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace
      ? candidate.slice(firstBrace, lastBrace + 1)
      : candidate;
  return JSON.parse(jsonText) as T;
}
