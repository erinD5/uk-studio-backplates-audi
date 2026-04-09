import {
  BACKPLATE_PROMPT_GENERATOR_SYSTEM_PROMPT,
  CAR_ANGLE_ANALYZER_SYSTEM_PROMPT,
  CAR_VIEW_VERIFIER_SYSTEM_PROMPT,
  INPUT_INTERPRETER_SYSTEM_PROMPT,
  REFERENCE_MATCHER_SYSTEM_PROMPT,
} from "@/lib/prompts";
import {
  BackplateInputMode,
  CarAngleAnalysis,
  InputInterpretation,
  OutputMode,
  ReferenceImageInput,
  StyleMode,
  VehicleMotionIntent,
} from "@/lib/types";

const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }
  return apiKey;
}

export async function runCarAngleAnalyzer(
  apiKey: string,
  input: { imageBase64: string; mediaType: "image/jpeg" | "image/png" },
): Promise<CarAngleAnalysis> {
  const text = await callGeminiForJson(apiKey, {
    systemPrompt: CAR_ANGLE_ANALYZER_SYSTEM_PROMPT,
    prompt:
      "Analyze this AVP image and return strict JSON only with camera geometry and perspective fields.",
    imageBase64: input.imageBase64,
    mediaType: input.mediaType,
  });
  return parseJsonPayload<CarAngleAnalysis>(text);
}

export async function runCarViewVerifier(
  apiKey: string,
  input: { imageBase64: string; mediaType: "image/jpeg" | "image/png" },
): Promise<{ view: CarAngleAnalysis["angle"]["view"]; confidence: "high" | "medium" | "low" }> {
  const text = await callGeminiForJson(apiKey, {
    systemPrompt: CAR_VIEW_VERIFIER_SYSTEM_PROMPT,
    prompt: "Classify the vehicle view. Return JSON only.",
    imageBase64: input.imageBase64,
    mediaType: input.mediaType,
  });
  return parseJsonPayload<{
    view: CarAngleAnalysis["angle"]["view"];
    confidence: "high" | "medium" | "low";
  }>(text);
}

export async function runInputInterpreter(
  apiKey: string,
  input: {
    inputMode: BackplateInputMode;
    writtenBrief: string;
    moodboardImages: ReferenceImageInput[];
    ownedImage?: ReferenceImageInput | null;
  },
): Promise<InputInterpretation> {
  const text = await callGeminiForJson(apiKey, {
    systemPrompt: INPUT_INTERPRETER_SYSTEM_PROMPT,
    prompt: [
      `Input mode: ${input.inputMode}`,
      `Written brief: ${input.writtenBrief || "None provided."}`,
      "Market: United Kingdom",
      "Return strict JSON only.",
    ].join("\n"),
    referenceImages: [
      ...input.moodboardImages,
      ...(input.ownedImage ? [input.ownedImage] : []),
    ],
  });
  return parseJsonPayload<InputInterpretation>(text);
}

export async function runBackplatePromptGenerator(
  apiKey: string,
  input: {
    cameraParams: CarAngleAnalysis;
    sceneParams: InputInterpretation;
    driveSide: "RHD" | "LHD";
    styleMode: StyleMode;
    motionIntent: Exclude<VehicleMotionIntent, "AUTO">;
    outputMode: OutputMode;
  },
): Promise<string> {
  const styleDirectives = getStyleModeDirectives(input.styleMode);
  return callGeminiForText(apiKey, {
    systemPrompt: BACKPLATE_PROMPT_GENERATOR_SYSTEM_PROMPT,
    prompt: [
      "market: UK",
      `drive_side: ${input.driveSide}`,
      `style_mode: ${input.styleMode}`,
      `vehicle_motion: ${input.motionIntent}`,
      `output_mode: ${input.outputMode}`,
      "camera_params:",
      JSON.stringify(input.cameraParams),
      "scene_params:",
      JSON.stringify(input.sceneParams),
      "",
      `STYLE DIRECTIVE (${input.styleMode}):`,
      ...styleDirectives,
      "",
      "CRITICAL: Keep AVP camera match exact and output one final generation prompt.",
      "CRITICAL POSITIONING: RHD must output RIGHT-side vehicle placement zone; LHD must output LEFT-side vehicle placement zone; never center.",
      "CRITICAL COMPOSITION: environment lines and key light must lead toward the vehicle zone and avoid competing focal points.",
      `CRITICAL MOTION: honor vehicle_motion=${input.motionIntent} exactly.`,
      `CRITICAL OUTPUT MODE: honor output_mode=${input.outputMode} exactly.`,
      "Return plain text only.",
    ].join("\n"),
  });
}

function getStyleModeDirectives(styleMode: StyleMode): string[] {
  if (styleMode === "EDITORIAL") {
    return [
      "- Visual intent: cinematic editorial image with stronger mood and narrative atmosphere.",
      "- Composition: permit asymmetry and negative space; hero car remains dominant but not hyper-clinical.",
      "- Lighting: allow richer contrast shaping and nuanced shadow falloff while staying photoreal.",
      "- Color: tasteful grade with subtle filmic depth; avoid flat commercial neutrality.",
      "- Texture: preserve natural imperfections (wetness, grain, weather texture) without looking dirty.",
    ];
  }
  return [
    "- Visual intent: clean Audi-commercial output with high polish and brand consistency.",
    "- Composition: balanced, disciplined framing with clear hero readability and minimal clutter.",
    "- Lighting: even premium illumination on the vehicle zone with controlled contrast.",
    "- Color: neutral, accurate, premium colorimetry; avoid heavy grading or dramatic tints.",
    "- Texture: crisp and refined surfaces; avoid gritty or distressed environmental emphasis.",
  ];
}

export async function runReferenceMatcher(
  apiKey: string,
  input: { sceneParams: InputInterpretation; candidatePaths: string[] },
): Promise<string[]> {
  const text = await callGeminiForJson(apiKey, {
    systemPrompt: REFERENCE_MATCHER_SYSTEM_PROMPT,
    prompt: [
      "Scene JSON:",
      JSON.stringify(input.sceneParams),
      "",
      "Candidate reference paths (choose 2-3):",
      JSON.stringify(input.candidatePaths),
      "",
      "Return JSON only.",
    ].join("\n"),
  });

  const parsed = parseJsonPayload<{ referencePaths?: string[] }>(text);
  const selected = Array.isArray(parsed.referencePaths) ? parsed.referencePaths : [];
  const deduped = Array.from(new Set(selected.map((item) => item.trim())));
  const allowed = deduped.filter((item) => input.candidatePaths.includes(item));

  if (allowed.length >= 2) {
    return allowed.slice(0, 3);
  }
  return input.candidatePaths.slice(0, 3);
}

async function callGeminiForJson(
  apiKey: string,
  options: {
    systemPrompt: string;
    prompt: string;
    imageBase64?: string;
    mediaType?: "image/jpeg" | "image/png";
    referenceImages?: ReferenceImageInput[];
  },
): Promise<string> {
  const parts: Array<
    | { text: string }
    | { inline_data: { mime_type: "image/jpeg" | "image/png" | "image/webp"; data: string } }
  > = [];

  if (options.imageBase64 && options.mediaType) {
    parts.push({
      inline_data: { mime_type: options.mediaType, data: options.imageBase64 },
    });
  }
  if (options.referenceImages?.length) {
    for (const image of options.referenceImages) {
      parts.push({
        inline_data: { mime_type: image.mimeType, data: image.data },
      });
    }
  }
  parts.push({ text: options.prompt });

  const response = await fetch(
    `${GEMINI_ENDPOINT}/${GEMINI_TEXT_MODEL}:generateContent?key=${encodeURIComponent(
      apiKey,
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  const payload = (await response.json()) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Gemini JSON call failed.");
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Gemini JSON call returned no text.");
  }
  return text;
}

async function callGeminiForText(
  apiKey: string,
  options: { systemPrompt: string; prompt: string },
): Promise<string> {
  const response = await fetch(
    `${GEMINI_ENDPOINT}/${GEMINI_TEXT_MODEL}:generateContent?key=${encodeURIComponent(
      apiKey,
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents: [{ parts: [{ text: options.prompt }] }],
      }),
    },
  );

  const payload = (await response.json()) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Gemini text call failed.");
  }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Gemini text call returned no text.");
  }
  return text;
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

export function detectImageMediaType(
  imageBase64: string,
): "image/jpeg" | "image/png" {
  const stripped = imageBase64.replace(/^data:[^;]+;base64,/, "");
  if (stripped.startsWith("iVBOR")) return "image/png";
  return "image/jpeg";
}
