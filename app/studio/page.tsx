"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import JSZip from "jszip";
import {
  GRADIENTS,
  StudioParams,
} from "@/lib/studioPrompt";
import { UK_EV_PLATE_TEXT } from "@/lib/locks";

interface StudioGenerateResponse {
  success?: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  prompt?: string;
  basePrompt?: string;
  warning?: string;
  error?: string;
}

interface GeneratedVariant {
  id: string;
  previewUrl: string;
  rawBase64: string;
}

interface GenerationBatch {
  id: string;
  createdAt: number;
  variants: GeneratedVariant[];
}

interface LightboxItem {
  url: string;
  label: string;
}

const SELECT_CLASS =
  "w-full h-11 border-2 border-black bg-white px-3 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-text outline-none transition focus:ring-2 focus:ring-black/15";
const FIXED_USER_PROMPT = "Place the car in the studio environment";
type OutputResolution = "1K" | "2K" | "4K";
type OutputAspectRatio = "1:1" | "16:9" | "4:5" | "3:2";

export default function StudioBackplatePage() {
  const [params, setParams] = useState<StudioParams>({
    gradient: GRADIENTS[0],
    lighting: { direction: "overhead", style: "soft" },
    floor: "infinite",
    accent: { colors: "" },
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuildingPrompt, setIsBuildingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [systemPrompt] = useState(
    `You write prompts for Nano Banana Pro image generation. You receive two images: a car render and a studio backdrop.
Your task: Write a prompt describing the car placed on the EXACT backdrop provided. Do not invent or interpret an environment — describe the backdrop literally as a gradient or studio surface.
CRITICAL — COLOUR ACCURACY:

Preserve the EXACT paint colour from input image
Car is Manhattan grey metallic — must read as GREY, not black, not silver
Match the input colour precisely — no colour shifts from lighting
Midtones remain visible across all body panels
Treat vehicle paint as immutable: keep hue, saturation, value, brightness, and contrast aligned to input.
Do NOT recolor, regrade, tint, bleach, darken, or shift the car paint in any way.

LIGHTING STYLE:

Single dominant overhead softbox creating horizontal reflections
Reflections appear as subtle white strips on curved panels — NOT overpowering
Sharp highlights along body creases and character lines
Deep shadows in grille, wheel wells, undercuts — but not crushing detail
Paint reads as metallic with clear coat depth
Dramatic studio lighting with controlled reflections

VEHICLE LIGHT STATE LOCK:
Preserve exact headlight/DRL/tail-light ON/OFF state from AVP input.
If lights are OFF in AVP, they must remain OFF with no glow, no beam, and no added spill.
If lights are ON in AVP, preserve their intensity/state without exaggeration.
Do not invent new lighting effects not present in the input.

CRITICAL — MATCH INPUT FRAMING EXACTLY:
If the input shows a PARTIAL/CROPPED view, describe ONLY that exact framing
Maintain the EXACT crop, angle, scale, and framing from the input image
NO zoom in, NO zoom out — same proportion as input

BACKGROUND — ABSOLUTE REQUIREMENTS (NO VARIATION):
Seamless infinite gradient from selected hex values
NO horizon line, NO floor plane, NO visible edge or seam
Matte, textureless, perfectly smooth colour field
NO visible light source, NO softbox panel, NO hotspot, NO top glow patch
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

Output ONLY the prompt. Under 100 words.`,
  );
  const [avpPreviewUrl, setAvpPreviewUrl] = useState<string | null>(null);
  const [avpImageBase64, setAvpImageBase64] = useState<string>("");
  const [basePrompt, setBasePrompt] = useState<string>("");
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>([]);
  const [generationHistory, setGenerationHistory] = useState<GenerationBatch[]>([]);
  const [lightboxState, setLightboxState] = useState<{ items: LightboxItem[]; index: number } | null>(
    null,
  );
  const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState<string>("");
  const [outputResolution, setOutputResolution] = useState<OutputResolution>("2K");
  const [outputAspectRatio, setOutputAspectRatio] = useState<OutputAspectRatio>("1:1");
  const userPrompt = FIXED_USER_PROMPT;

  async function buildPrompt(): Promise<string | null> {
    setIsBuildingPrompt(true);
    setError(null);
    try {
      const response = await fetch("/api/studio/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          params,
          userPrompt,
          systemPrompt,
          avpImageBase64,
        }),
      });
      const payload = await parseStudioApiResponse(response);
      if (!response.ok || !payload.success || !payload.prompt) {
        throw new Error(payload.error ?? "Failed to assemble studio prompt.");
      }
      setBasePrompt(payload.basePrompt ?? "");
      console.log("=== ASSEMBLED PROMPT ===");
      console.log(payload.prompt);
      console.log("=== END PROMPT ===");
      return payload.prompt;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected studio error.");
      return null;
    } finally {
      setIsBuildingPrompt(false);
    }
  }

  async function runStudioGeneration() {
    const built = await buildPrompt();
    if (!built) return;
    const promptToUse = built.trim();
    setIsGenerating(true);
    setError(null);
    setWarning(null);
    try {
      const generateResponse = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptToUse,
          avpImageBase64,
          gradient: params.gradient,
          lighting: params.lighting,
        }),
      });
      const generatePayload = await parseStudioApiResponse(generateResponse);
      const returnedImages = generatePayload.imageUrls ?? (generatePayload.imageUrl ? [generatePayload.imageUrl] : []);
      if (!generateResponse.ok || !generatePayload.success || !returnedImages.length) {
        throw new Error(generatePayload.error ?? "Studio generation failed. Try different settings.");
      }
      if (generatePayload.warning) {
        setWarning(generatePayload.warning);
      }
      const normalizedImages = await Promise.all(
        returnedImages.map((imageUrl) =>
          normalizeOutputFormat(imageUrl, outputResolution, outputAspectRatio),
        ),
      );
      const variants = normalizedImages.map((previewUrl, index) => ({
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        previewUrl,
        rawBase64: stripDataUrl(previewUrl),
      }));
      setGeneratedVariants(variants);
      setLastGeneratedPrompt(promptToUse);
      const batch: GenerationBatch = {
        id: `studio-batch-${Date.now()}`,
        createdAt: Date.now(),
        variants,
      };
      setGenerationHistory((prev) => [batch, ...prev].slice(0, 12));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected studio error.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleAvpUpload(file: File) {
    const dataUrl = await optimizeImageForUpload(file, {
      maxDimension: 1536,
      quality: 0.86,
    });
    setAvpPreviewUrl(dataUrl);
    setAvpImageBase64(dataUrl);
    setGeneratedVariants([]);
    setGenerationHistory([]);
    setLightboxState(null);
    setLastGeneratedPrompt("");
    setError(null);
    setWarning(null);
  }

  function downloadOutput() {
    if (!generatedVariants.length) return;
    const link = document.createElement("a");
    link.href = generatedVariants[0].previewUrl;
    link.download = "audi-studio-backplate-1.png";
    link.click();
  }

  async function downloadAllZip() {
    if (!generatedVariants.length) return;
    const zip = new JSZip();
    generatedVariants.forEach((variant, index) => {
      zip.file(`studio-variant-${index + 1}.png`, variant.rawBase64, { base64: true });
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "studio-variants.zip";
    link.click();
    URL.revokeObjectURL(url);
  }

  const allGeneratedLightboxItems = useMemo(() => {
    const items: LightboxItem[] = [];
    for (const variant of generatedVariants) {
      items.push({ url: variant.previewUrl, label: "Generated Variant" });
    }
    for (const batch of generationHistory) {
      for (const variant of batch.variants) {
        items.push({ url: variant.previewUrl, label: "History Variant" });
      }
    }
    return items.filter(
      (item, index, list) => list.findIndex((entry) => entry.url === item.url) === index,
    );
  }, [generatedVariants, generationHistory]);

  function openLightbox(url: string, label: string) {
    const pool = allGeneratedLightboxItems;
    const matchIndex = pool.findIndex((item) => item.url === url);
    if (matchIndex >= 0) {
      setLightboxState({ items: pool, index: matchIndex });
      return;
    }
    setLightboxState({ items: [{ url, label }], index: 0 });
  }

  function closeLightbox() {
    setLightboxState(null);
  }

  function showPrevLightboxImage() {
    setLightboxState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        index: prev.index === 0 ? prev.items.length - 1 : prev.index - 1,
      };
    });
  }

  function showNextLightboxImage() {
    setLightboxState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        index: prev.index === prev.items.length - 1 ? 0 : prev.index + 1,
      };
    });
  }

  async function downloadLightboxImage() {
    if (!lightboxState) return;
    const current = lightboxState.items[lightboxState.index];
    const link = document.createElement("a");
    link.href = current.url;
    link.download = `${current.label.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.click();
  }

  function loadBatch(batchId: string) {
    const batch = generationHistory.find((entry) => entry.id === batchId);
    if (!batch?.variants.length) return;
    setGeneratedVariants(batch.variants);
    document.getElementById("generation-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 py-8 sm:px-6 md:px-8 md:py-10 lg:px-10 lg:py-12">
      <header className="mb-8">
        <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-text/60">MOD BOX · Audi UK</p>
        <h1 className="text-3xl font-semibold leading-none tracking-[-0.03em] text-text sm:text-4xl md:text-6xl">
          STUDIO BACKPLATE GENERATOR
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-text/70 md:text-sm">
          System Prompt + User Prompt + Gradient + AVP Input
        </p>
      </header>

      <section className="border border-border bg-surface p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_1.35fr]">
          <div className="space-y-5">
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text">AVP Input</h2>
              <label className="inline-flex cursor-pointer border border-border bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-text/80 transition hover:bg-black hover:text-white">
                Upload AVP Asset
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleAvpUpload(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <div className="mt-3 overflow-hidden border border-border bg-black">
                {avpPreviewUrl ? (
                  <Image
                    src={avpPreviewUrl}
                    alt="AVP reference"
                    width={960}
                    height={540}
                    unoptimized
                    className="h-44 w-full object-contain md:h-56"
                  />
                ) : (
                  <div className="flex h-44 items-center justify-center text-xs uppercase tracking-[0.08em] text-white/45 md:h-56">
                    Upload AVP to continue
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] uppercase tracking-[0.08em] text-text/65">
                Prompt (Fixed)
              </label>
              <div className="border border-border bg-white px-3 py-2 text-sm text-text/85">
                {FIXED_USER_PROMPT}
              </div>
            </div>

            <details className="border border-border bg-white p-3">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.08em] text-text/70">
                Advanced (System Prompt)
              </summary>
              <pre className="mt-2 whitespace-pre-wrap text-[11px] text-text/75">{systemPrompt}</pre>
            </details>

            <button
              type="button"
              onClick={() => void runStudioGeneration()}
              disabled={isGenerating || isBuildingPrompt}
              className="w-full border border-border bg-black px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isGenerating || isBuildingPrompt ? "Generating..." : "Generate"}
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                <span className="block">Floor Type</span>
                <div className={`${SELECT_CLASS} flex items-center border-border bg-[#ececec] text-text/80`}>
                  Infinite/Seamless (Fixed)
                </div>
              </div>
              <label className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                <span className="block">Lighting Style</span>
                <select
                  value={params.lighting.style}
                  onChange={(event) =>
                    setParams({
                      ...params,
                      lighting: {
                        ...params.lighting,
                        style: event.target.value as StudioParams["lighting"]["style"],
                      },
                    })
                  }
                  className={SELECT_CLASS}
                >
                  {(["soft", "hard"] as StudioParams["lighting"]["style"][]).map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                <span className="block">Image Resolution</span>
                <div className="flex flex-wrap gap-2">
                  {(["1K", "2K", "4K"] as OutputResolution[]).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setOutputResolution(res)}
                      className={`border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] ${
                        outputResolution === res
                          ? "border-black bg-black text-white"
                          : "border-border bg-white text-text/70"
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </label>

              <label className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                <span className="block">Image Size</span>
                <div className="flex flex-wrap gap-2">
                  {(["1:1", "16:9", "4:5", "3:2"] as OutputAspectRatio[]).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setOutputAspectRatio(ratio)}
                      className={`border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] ${
                        outputAspectRatio === ratio
                          ? "border-black bg-black text-white"
                          : "border-border bg-white text-text/70"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-text/70">Gradient Color</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {GRADIENTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setParams({ ...params, gradient: item })}
                    className={`border p-2 text-left ${params.gradient.id === item.id ? "border-black bg-white" : "border-border bg-white"}`}
                  >
                    <div
                      className="mb-2 h-8 w-full border border-black/10"
                      style={{
                        background: `linear-gradient(to bottom, ${item.topHex}, ${item.bottomHex})`,
                      }}
                    />
                    <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-text/80">
                      {item.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-text/70">
                Lighting Direction
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "left", name: "Left", icon: "←" },
                  { id: "right", name: "Right", icon: "→" },
                  { id: "overhead", name: "Overhead", icon: "↓" },
                  { id: "front", name: "Front", icon: "•" },
                  { id: "rim", name: "Rim/Backlit", icon: "○" },
                  { id: "split", name: "Split", icon: "↔" },
                  { id: "three-point", name: "Three-Point", icon: "△" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setParams({
                        ...params,
                        lighting: {
                          ...params.lighting,
                          direction: item.id as StudioParams["lighting"]["direction"],
                        },
                      })
                    }
                    className={`inline-flex items-center gap-1 border px-3 py-1.5 text-xs uppercase tracking-[0.08em] ${
                      params.lighting.direction === item.id
                        ? "border-black bg-black text-white"
                        : "border-border bg-white text-text/70"
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-text/70">Accent Color</p>
              <input
                type="text"
                value={params.accent.colors}
                onChange={(event) =>
                  setParams({
                    ...params,
                    accent: { colors: event.target.value },
                  })
                }
                placeholder="Add accent colour(s), e.g. #BB0A30, warm amber, cool blue"
                className="w-full border border-border bg-white px-3 py-2 text-sm text-text outline-none transition focus:border-black"
              />
              <p className="mt-1 text-[11px] text-text/55">
                Optional. Add one or multiple colours separated by commas.
              </p>
            </div>

            <div className="border border-border bg-white p-3">
              <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-text/70">Live Gradient Preview</p>
              <div
                className="h-24 w-full border border-border"
                style={{
                  background: `linear-gradient(to bottom, ${params.gradient.topHex}, ${params.gradient.bottomHex})`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <p className="mt-5 border border-red-700/40 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {warning ? (
        <p className="mt-5 border border-amber-700/40 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warning}
        </p>
      ) : null}

      {generatedVariants.length ? (
        <section id="generation-section" className="mt-6 border border-border bg-surface p-4 sm:p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-text/85">
              Generated Studio Backplate
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadOutput}
                className="border border-border bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-text transition hover:bg-black hover:text-white"
              >
                Download First PNG
              </button>
              <button
                type="button"
                onClick={() => void downloadAllZip()}
                className="border border-border bg-black px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:opacity-90"
              >
                Download All ZIP
              </button>
            </div>
          </div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.08em] text-text/60">
            Click any image for fullscreen and arrows.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {generatedVariants.map((variant, index) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => openLightbox(variant.previewUrl, "Generated Variant")}
                className="overflow-hidden border border-border bg-white text-left transition hover:opacity-90"
              >
                <Image
                  src={variant.previewUrl}
                  alt={`Generated studio variant ${index + 1}`}
                  width={1600}
                  height={900}
                  unoptimized
                  className="h-auto w-full object-cover"
                />
              </button>
            ))}
          </div>
          {lastGeneratedPrompt || basePrompt ? (
            <details className="mt-4 border border-border bg-white p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-text/80">
                Prompt Details
              </summary>
              {lastGeneratedPrompt ? (
                <>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-text/55">Final Prompt</p>
                  <pre className="mb-3 whitespace-pre-wrap text-xs text-text/75">{lastGeneratedPrompt}</pre>
                </>
              ) : null}
              {basePrompt ? (
                <>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-text/55">Base Prompt</p>
                  <pre className="whitespace-pre-wrap text-xs text-text/75">{basePrompt}</pre>
                </>
              ) : null}
            </details>
          ) : null}
        </section>
      ) : null}

      {generationHistory.length ? (
        <section className="mt-6 border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-text/85">
              Generation History
            </h3>
            <span className="text-xs text-text/60">{generationHistory.length} recent batches</span>
          </div>
          <div className="space-y-3">
            {generationHistory.map((batch) => (
              <div key={batch.id} className="border border-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-text/65">{new Date(batch.createdAt).toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => loadBatch(batch.id)}
                    className="border border-border bg-white px-2 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text/80 transition hover:bg-black hover:text-white"
                  >
                    Load batch
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {batch.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => openLightbox(variant.previewUrl, "History Variant")}
                      className="overflow-hidden border border-border text-left transition hover:opacity-90"
                    >
                      <Image
                        src={variant.previewUrl}
                        alt="Historical studio variant"
                        width={640}
                        height={360}
                        unoptimized
                        className="h-24 w-full object-cover md:h-28"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {lightboxState ? (
        <section className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-6">
          <div className="w-full max-w-6xl border border-border bg-white p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text">
                {lightboxState.items[lightboxState.index]?.label} · {lightboxState.index + 1}/
                {lightboxState.items.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void downloadLightboxImage()}
                  className="border border-border bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-text transition hover:bg-black hover:text-white"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={closeLightbox}
                  className="border border-border bg-black px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:opacity-85"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="relative flex max-h-[78vh] items-center justify-center overflow-hidden border border-border bg-[#f5f5f5]">
              {lightboxState.items.length > 1 ? (
                <button
                  type="button"
                  onClick={showPrevLightboxImage}
                  className="absolute left-2 top-1/2 z-10 -translate-y-1/2 border border-border bg-white px-3 py-2 text-sm font-semibold text-text hover:bg-black hover:text-white"
                >
                  ←
                </button>
              ) : null}
              <Image
                src={lightboxState.items[lightboxState.index]?.url}
                alt={lightboxState.items[lightboxState.index]?.label}
                width={2200}
                height={1300}
                unoptimized
                className="max-h-[78vh] w-auto max-w-full object-contain"
              />
              {lightboxState.items.length > 1 ? (
                <button
                  type="button"
                  onClick={showNextLightboxImage}
                  className="absolute right-2 top-1/2 z-10 -translate-y-1/2 border border-border bg-white px-3 py-2 text-sm font-semibold text-text hover:bg-black hover:text-white"
                >
                  →
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file."));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function parseStudioApiResponse(response: Response): Promise<StudioGenerateResponse> {
  const raw = await response.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as StudioGenerateResponse;
  } catch {
    return { error: raw.slice(0, 400) };
  }
}

function optimizeImageForUpload(
  file: File,
  options: { maxDimension: number; quality: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read image file."));
        return;
      }
      const image = new window.Image();
      image.onload = () => {
        const scale = Math.min(
          1,
          options.maxDimension / Math.max(image.width, image.height),
        );
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not create canvas context."));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", options.quality));
      };
      image.onerror = () => reject(new Error("Could not process uploaded image."));
      image.src = reader.result;
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed."));
    reader.readAsDataURL(file);
  });
}

function getTargetDimensions(
  resolution: OutputResolution,
  aspectRatio: OutputAspectRatio,
): { width: number; height: number } {
  const longEdge = resolution === "4K" ? 4096 : resolution === "2K" ? 2048 : 1024;
  const ratio =
    aspectRatio === "16:9" ? 16 / 9 : aspectRatio === "4:5" ? 4 / 5 : aspectRatio === "3:2" ? 3 / 2 : 1;

  if (ratio >= 1) return { width: longEdge, height: Math.round(longEdge / ratio) };
  return { width: Math.round(longEdge * ratio), height: longEdge };
}

function normalizeOutputFormat(
  sourceDataUrl: string,
  resolution: OutputResolution,
  aspectRatio: OutputAspectRatio,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const target = getTargetDimensions(resolution, aspectRatio);
      const targetRatio = target.width / target.height;
      const sourceRatio = image.width / image.height;

      let sx = 0;
      let sy = 0;
      let sWidth = image.width;
      let sHeight = image.height;

      if (sourceRatio > targetRatio) {
        sWidth = Math.round(image.height * targetRatio);
        sx = Math.round((image.width - sWidth) / 2);
      } else if (sourceRatio < targetRatio) {
        sHeight = Math.round(image.width / targetRatio);
        sy = Math.round((image.height - sHeight) / 2);
      }

      const canvas = document.createElement("canvas");
      canvas.width = target.width;
      canvas.height = target.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not create canvas context."));
        return;
      }
      context.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, target.width, target.height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Could not normalize output format."));
    image.src = sourceDataUrl;
  });
}

function stripDataUrl(dataUrl: string): string {
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}
