import { NextRequest, NextResponse } from "next/server";
import { assembleStudioPrompt, isValidStudioParams, StudioParams } from "@/lib/studioPrompt";
import { UK_EV_PLATE_TEXT } from "@/lib/locks";

interface BuildPromptRequest {
  params: StudioParams;
  userPrompt?: string;
  systemPrompt?: string;
  avpImageBase64?: string;
}

const GEMINI_TEXT_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const DEFAULT_SYSTEM_PROMPT = `You write prompts for Nano Banana Pro image generation. You receive two images: a car render and a studio backdrop.
Your task: Write a prompt describing the car placed on the EXACT backdrop provided. Do not invent or interpret an environment - describe the backdrop literally as a gradient or studio surface.
CRITICAL - COLOUR ACCURACY:

Preserve the EXACT paint colour from input image
Car is Manhattan grey metallic - must read as GREY, not black, not silver
Match the input colour precisely - no colour shifts from lighting
Midtones remain visible across all body panels
Treat vehicle paint as immutable: keep hue, saturation, value, brightness, and contrast aligned to input.
Do NOT recolor, regrade, tint, bleach, darken, or shift the car paint in any way.

LIGHTING STYLE:

Single dominant overhead softbox creating horizontal reflections
Reflections appear as subtle white strips on curved panels - NOT overpowering
Sharp highlights along body creases and character lines
Deep shadows in grille, wheel wells, undercuts - but not crushing detail
Paint reads as metallic with clear coat depth
Dramatic studio lighting with controlled reflections
IMPORTANT: This is a baseline reference only. Always prioritize the selected UI lighting direction/style profile over this baseline.

VEHICLE LIGHT STATE LOCK:
Preserve exact headlight/DRL/tail-light ON/OFF state from AVP input.
If lights are OFF in AVP, they must remain OFF with no glow, no beam, and no added spill.
If lights are ON in AVP, preserve their intensity/state without exaggeration.
Do not invent new lighting effects not present in the input.

CRITICAL - MATCH INPUT FRAMING EXACTLY:

If the input shows a PARTIAL/CROPPED view, describe ONLY that exact framing
Maintain the EXACT crop, angle, scale, and framing from the input image
NO zoom in, NO zoom out - same proportion as input

BACKGROUND - ABSOLUTE REQUIREMENTS (NO VARIATION):

Use EXACT gradient values provided in the input.
NO horizon line, NO floor plane, NO visible edge or seam
Matte, textureless, perfectly smooth colour field
No visible light source, no softbox panel, no hotspot, no top glow patch
No black vignette, no dark-corner falloff, no crushed blacks
Keep tonal range close to selected gradient hex values (top/mid/bottom)
Soft contact shadow under tyres only
This background must be IDENTICAL across all generated images

NEVER include:

Real-world locations, weather, or time of day
Car make/model names
Overly bright or blown-out reflections
Non-UK registration plates or random plate text

UK REGISTRATION PLATE LOCK:
If a plate is visible, render exact text "${UK_EV_PLATE_TEXT}".
Rear plate: UK EV yellow reflective with green flash band on left.
Front plate: UK EV white reflective with green flash band on left.
Use black UK registration typography with realistic spacing.

Output ONLY the prompt. Under 100 words.`;

const FIXED_USER_PROMPT = "Place the car in the studio environment";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BuildPromptRequest;
    if (!isValidStudioParams(body?.params)) {
      return NextResponse.json({ error: "Invalid studio params." }, { status: 400 });
    }

    const userPrompt = FIXED_USER_PROMPT;
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is missing." }, { status: 500 });
    }

    const basePrompt = assembleStudioPrompt(body.params);
    const systemPrompt = body.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
    const avp = sanitizeBase64(body.avpImageBase64);
    const avpMime = detectMime(avp);

    const parts: Array<
      | { text: string }
      | { inline_data: { mime_type: "image/jpeg" | "image/png"; data: string } }
    > = [];

    if (avp) {
      parts.push({
        inline_data: {
          mime_type: avpMime,
          data: avp,
        },
      });
    }
    parts.push({
      text: [
        `SELECTED GRADIENT NAME: ${body.params.gradient.name}`,
        `SELECTED GRADIENT HEX (EXACT): ${body.params.gradient.topHex} at top -> ${body.params.gradient.bottomHex} at bottom`,
        `SELECTED LIGHTING: ${body.params.lighting.direction} / ${body.params.lighting.style}`,
        `LIGHTING PROFILE LOCK (CRITICAL): ${lightingProfileLock(body.params)}`,
        `UK REG PLATE LOCK (CRITICAL): if plate is visible, exact text "${UK_EV_PLATE_TEXT}" in UK EV format (rear yellow/green flash, front white/green flash).`,
        "SELECTED FLOOR: infinite (fixed, always seamless)",
        `SELECTED ACCENT COLORS: ${body.params.accent.colors.trim() || "none"}`,
        "",
        "NON-NEGOTIABLE: Vehicle colour must remain exactly the same as AVP input. If any instruction conflicts, preserve input vehicle colour.",
        "",
        "BASE STUDIO PROMPT:",
        basePrompt,
        "",
        "USER CREATIVE PROMPT:",
        userPrompt,
        "",
        "Return the final combined prompt only.",
      ].join("\n"),
    });

    const response = await fetch(
      `${GEMINI_TEXT_ENDPOINT}?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts }],
        }),
      },
    );

    const payload = (await response.json()) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error?.message ?? "Prompt generation failed." },
        { status: response.status || 500 },
      );
    }

    const refinedPrompt = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!refinedPrompt) {
      return NextResponse.json({ error: "No prompt returned by model." }, { status: 502 });
    }
    const constrainedPrompt = enforceWordLimit(refinedPrompt, 100);

    console.log("=== ASSEMBLED PROMPT ===");
    console.log(constrainedPrompt);
    console.log("=== END PROMPT ===");

    return NextResponse.json(
      {
        success: true,
        prompt: constrainedPrompt,
        basePrompt,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected prompt route error.";
    return NextResponse.json({ error: message }, { status: 500 });
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

function enforceWordLimit(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}...`;
}

function lightingProfileLock(params: StudioParams): string {
  const byDirection: Record<StudioParams["lighting"]["direction"], string> = {
    left:
      "Direction lock: camera-left key only. Left panels brighter, right panels notably darker, and shadow trend to camera-right.",
    right:
      "Direction lock: camera-right key only. Right panels brighter, left panels notably darker, and shadow trend to camera-left.",
    overhead:
      "Direction lock: overhead key only. Roof and shoulder line receive strongest highlights while lower body remains darker.",
    front:
      "Direction lock: front key only. Front fascia/bonnet highlights dominate with reduced lateral contrast.",
    rim:
      "Direction lock: rim/back key. Silhouette edges glow while center body mass remains comparatively dark.",
    split:
      "Direction lock: split light. One side must read bright and the opposite side must read dark with clear bilateral divide.",
    "three-point":
      "Direction lock: three-point key/fill/rim arrangement with readable edge separation and controlled modeling.",
  };
  const byStyle: Record<StudioParams["lighting"]["style"], string> = {
    soft:
      "Soft profile: broad, gentle highlights with smoother roll-off and softer shadow transitions at moderate-to-lower contrast.",
    hard:
      "Hard profile: studio lighting is practically off (very low-key). Slash ambient/fill aggressively, push shadows very deep and hard-edged, keep only tight specular strips, and maintain strong high-contrast separation.",
  };
  return `${byDirection[params.lighting.direction]} ${byStyle[params.lighting.style]}`;
}
