"use client";

import Image from "next/image";
import Link from "next/link";
import JSZip from "jszip";
import { useEffect, useMemo, useState } from "react";

import { GenerationPanel } from "@/components/GenerationPanel";
import { UploadDropzone } from "@/components/UploadDropzone";
import { UK_EV_PLATE_TEXT } from "@/lib/locks";
import StudioBackplatePage from "@/app/studio/page";
import {
  BackplateInputMode,
  CarAngleAnalysis,
  OutputMode,
  ReferenceImageInput,
  StyleMode,
  UKLocalizerAgentsResponse,
  VehicleMotionIntent,
} from "@/lib/types";

const CAR_ANGLE_FALLBACK: CarAngleAnalysis = {
  angle: { view: "front-3/4", rotation_degrees: "45" },
  camera: {
    height: "bumper-height",
    height_meters: "0.7",
    tilt: "level",
    focal_length_mm: "50",
    aperture_estimate: "f/5.6",
  },
  composition: {
    vehicle_position: "center",
    frame_coverage: "full-vehicle",
    horizon_line: "lower-third",
    ground_plane_visible: "yes",
  },
  perspective: {
    vanishing_point: "center",
    distortion: "minimal",
    depth_cue: "medium",
  },
};

type NodeStatus = "idle" | "running" | "done" | "error";
type OutputResolution = "1K" | "2K" | "4K";
type OutputAspectRatio = "1:1" | "16:9" | "4:5" | "3:2";
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

interface ArtDirectionBankImageItem {
  url: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  filename?: string;
  title?: string;
}

const SELECT_CLASS =
  "w-full h-11 border-2 border-black bg-white px-3 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-text outline-none transition focus:ring-2 focus:ring-black/15";

export function EnvironmentalGeneratorPage() {
  const [driveSide, setDriveSide] = useState<"RHD" | "LHD">("RHD");
  const [styleMode] = useState<StyleMode>("BRAND");
  const [vehicleMotionIntent, setVehicleMotionIntent] = useState<VehicleMotionIntent>("AUTO");
  const [outputMode, setOutputMode] = useState<OutputMode>("WITH_CAR");
  const [outputResolution, setOutputResolution] = useState<OutputResolution>("2K");
  const [outputAspectRatio, setOutputAspectRatio] = useState<OutputAspectRatio>("16:9");
  const [market] = useState("United Kingdom");
  const [inputMode, setInputMode] = useState<BackplateInputMode>("WRITTEN_BRIEF");

  const [inputImageBase64, setInputImageBase64] = useState<string | null>(null);
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);
  const [writtenBrief, setWrittenBrief] = useState("");

  const [moodboardImages, setMoodboardImages] = useState<
    Array<{ id: string; previewUrl: string; payload: ReferenceImageInput }>
  >([]);
  const [ownedImage, setOwnedImage] = useState<{
    previewUrl: string;
    payload: ReferenceImageInput;
  } | null>(null);

  const [carAngle, setCarAngle] = useState<CarAngleAnalysis>(CAR_ANGLE_FALLBACK);
  const [instruction, setInstruction] = useState("");

  const [nodeStatus, setNodeStatus] = useState<{
    carAngleAnalyzer: NodeStatus;
    inputInterpreter: NodeStatus;
    referenceMatcher: NodeStatus;
    promptGenerator: NodeStatus;
  }>({
    carAngleAnalyzer: "idle",
    inputInterpreter: "idle",
    referenceMatcher: "idle",
    promptGenerator: "idle",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [outputPreviewUrl, setOutputPreviewUrl] = useState<string | null>(null);
  const [outputRawBase64, setOutputRawBase64] = useState<string | null>(null);
  const [generatedVariants, setGeneratedVariants] = useState<GeneratedVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [generationHistory, setGenerationHistory] = useState<GenerationBatch[]>([]);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [lastUsedReferenceImages, setLastUsedReferenceImages] = useState<
    ReferenceImageInput[]
  >([]);
  const [cachedArtDirectionBankImages, setCachedArtDirectionBankImages] = useState<
    ArtDirectionBankImageItem[] | null
  >(null);
  const [variantFeedback, setVariantFeedback] = useState<
    Record<string, "accepted" | "rejected">
  >({});
  const [rejectionMemory, setRejectionMemory] = useState<string[]>([]);
  const [lightboxState, setLightboxState] = useState<{
    items: LightboxItem[];
    index: number;
  } | null>(null);

  const canRun = useMemo(() => Boolean(inputImageBase64), [inputImageBase64]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("backplate-rejection-memory");
      if (!stored) return;
      const parsed = JSON.parse(stored) as string[];
      if (Array.isArray(parsed)) {
        setRejectionMemory(parsed.slice(0, 30));
      }
    } catch {
      // Ignore malformed local storage.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "backplate-rejection-memory",
        JSON.stringify(rejectionMemory.slice(0, 30)),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [rejectionMemory]);

  function getEffectiveMotionIntent(): "DRIVING" | "PARKED" {
    if (vehicleMotionIntent === "DRIVING" || vehicleMotionIntent === "PARKED") {
      return vehicleMotionIntent;
    }
    const brief = writtenBrief.toLowerCase();
    if (/\b(driving|moving|in motion|rolling|on the move|at speed)\b/.test(brief)) {
      return "DRIVING";
    }
    return "PARKED";
  }

  async function handleCarFile(file: File) {
    const dataUrl = await fileToDataUrl(file);
    setInputPreviewUrl(dataUrl);
    setInputImageBase64(stripDataUrl(dataUrl));
    setInstruction("");
    setPipelineError(null);
    setGenerationError(null);
    setOutputPreviewUrl(null);
    setOutputRawBase64(null);
    setGeneratedVariants([]);
    setVariantFeedback({});
    setSelectedVariantId(null);
    setRefinePrompt("");
    setNodeStatus({
      carAngleAnalyzer: "idle",
      inputInterpreter: "idle",
      referenceMatcher: "idle",
      promptGenerator: "idle",
    });
  }

  async function handleMoodboardFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 8);
    const prepared = await Promise.all(
      selected.map(async (file) => {
        const dataUrl = await fileToDataUrl(file);
        return {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          previewUrl: dataUrl,
          payload: {
            data: stripDataUrl(dataUrl),
            mimeType: toMimeType(file.type),
          } as ReferenceImageInput,
        };
      }),
    );
    setMoodboardImages((prev) => [...prev, ...prepared].slice(0, 8));
  }

  function removeMoodboardImage(id: string) {
    setMoodboardImages((prev) => prev.filter((img) => img.id !== id));
  }

  async function handleOwnedImage(file: File) {
    const dataUrl = await fileToDataUrl(file);
    setOwnedImage({
      previewUrl: dataUrl,
      payload: { data: stripDataUrl(dataUrl), mimeType: toMimeType(file.type) },
    });
  }

  async function runPromptPipeline() {
    if (!inputImageBase64) return;

    setIsLoading(true);
    setPipelineError(null);
    setGenerationError(null);
    setOutputPreviewUrl(null);
    setOutputRawBase64(null);
    setGeneratedVariants([]);
    setSelectedVariantId(null);
    setRefinePrompt("");
    setNodeStatus({
      carAngleAnalyzer: "running",
      inputInterpreter: "running",
      referenceMatcher: "running",
      promptGenerator: "running",
    });

    const activeReferences =
      inputMode === "MOODBOARD"
        ? moodboardImages.map((img) => img.payload)
        : inputMode === "OWNED_IMAGE" && ownedImage
          ? [ownedImage.payload]
          : [];

    try {
      const response = await fetch("/api/environmental/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: inputImageBase64,
          driveSide,
          styleMode,
          motionIntent: getEffectiveMotionIntent(),
          outputMode,
          inputMode,
          writtenBrief,
          moodboardImages: inputMode === "MOODBOARD" ? activeReferences : [],
          ownedImage: inputMode === "OWNED_IMAGE" ? ownedImage?.payload ?? null : null,
        }),
      });

      const data = (await response.json()) as UKLocalizerAgentsResponse | { error?: string };
      if (!response.ok || "error" in data) {
        throw new Error((data as { error?: string }).error ?? "Pipeline failed.");
      }

      const payload = data as UKLocalizerAgentsResponse;
      setCarAngle(payload.carAngle);
      setInstruction(payload.instruction);
      setNodeStatus(payload.agentStatus);
      setLastUsedReferenceImages(payload.effectiveReferenceImages);
      if (payload.errors?.length) {
        setPipelineError(payload.errors.join(" "));
      }

      setIsGenerating(true);
      const variants = await generateBatchVariants({
        sourceImageBase64: inputImageBase64,
        instruction: payload.instruction,
        referenceImages: payload.effectiveReferenceImages,
        outputResolution,
        outputAspectRatio,
        motionIntent: getEffectiveMotionIntent(),
        outputMode,
        plateFacing: getPlateFacingFromView(payload.carAngle.angle.view),
        cameraLockHints: buildCameraLockHints(payload.carAngle),
      });
      setGeneratedVariants(variants);
      setVariantFeedback({});
      if (variants.length) {
        const first = variants[0];
        setSelectedVariantId(first.id);
        setOutputRawBase64(first.rawBase64);
        setOutputPreviewUrl(first.previewUrl);
        const batch: GenerationBatch = {
          id: `batch-${Date.now()}`,
          createdAt: Date.now(),
          variants,
        };
        setGenerationHistory((prev) => [batch, ...prev].slice(0, 12));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown pipeline error.";
      setPipelineError(message);
      setNodeStatus((prev) => ({
        carAngleAnalyzer:
          prev.carAngleAnalyzer === "running" ? "error" : prev.carAngleAnalyzer,
        inputInterpreter:
          prev.inputInterpreter === "running" ? "error" : prev.inputInterpreter,
        referenceMatcher:
          prev.referenceMatcher === "running" ? "error" : prev.referenceMatcher,
        promptGenerator:
          prev.promptGenerator === "running" ? "error" : prev.promptGenerator,
      }));
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  }

  async function regenerateFromCurrentInstruction() {
    if (!inputImageBase64 || !instruction) return;
    setGenerationError(null);
    setIsGenerating(true);
    try {
      const variants = await generateBatchVariants({
        sourceImageBase64: inputImageBase64,
        instruction,
        referenceImages: lastUsedReferenceImages,
        outputResolution,
        outputAspectRatio,
        motionIntent: getEffectiveMotionIntent(),
        outputMode,
        plateFacing: getPlateFacingFromView(carAngle.angle.view),
        cameraLockHints: buildCameraLockHints(carAngle),
      });
      setGeneratedVariants(variants);
      setVariantFeedback({});
      if (variants.length) {
        const first = variants[0];
        setSelectedVariantId(first.id);
        setOutputRawBase64(first.rawBase64);
        setOutputPreviewUrl(first.previewUrl);
        const batch: GenerationBatch = {
          id: `batch-${Date.now()}`,
          createdAt: Date.now(),
          variants,
        };
        setGenerationHistory((prev) => [batch, ...prev].slice(0, 12));
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Unknown generation error.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function refineCurrentOutput() {
    if (!outputRawBase64 || !instruction || !refinePrompt.trim()) return;
    setGenerationError(null);
    setIsGenerating(true);
    const refineInstruction = [
      instruction,
      "",
      "REFINE MODE INSTRUCTION (apply to current generated image):",
      refinePrompt.trim(),
      "",
      "CRITICAL PRESERVATION RULES:",
      "- Preserve all visual elements not explicitly requested for change.",
      "- Keep road geometry, horizon, perspective, lens feel, lighting mood, and overall color grade unless explicitly changed.",
      "- Keep composition stable; do not reframe the scene.",
      outputMode === "BACKPLATE_ONLY"
        ? "- Keep this as a background-only scene with no vehicle visible."
        : "- Keep the existing Audi vehicle untouched and unchanged.",
    ].join("\n");
    try {
      // Archive current visible batch before replacing it with refined variants.
      if (generatedVariants.length) {
        const archivedBatch: GenerationBatch = {
          id: `batch-${Date.now()}-pre-refine`,
          createdAt: Date.now(),
          variants: generatedVariants,
        };
        setGenerationHistory((prev) => [archivedBatch, ...prev].slice(0, 12));
      }

      const refinedVariants = await generateBatchVariants({
        sourceImageBase64: outputRawBase64,
        instruction: refineInstruction,
        referenceImages: lastUsedReferenceImages,
        outputResolution,
        outputAspectRatio,
        motionIntent: getEffectiveMotionIntent(),
        outputMode,
        plateFacing: getPlateFacingFromView(carAngle.angle.view),
        cameraLockHints: buildCameraLockHints(carAngle),
      });

      setGeneratedVariants(refinedVariants);
      setVariantFeedback({});
      if (refinedVariants.length) {
        const first = refinedVariants[0];
        setSelectedVariantId(first.id);
        setOutputPreviewUrl(first.previewUrl);
        setOutputRawBase64(first.rawBase64);
        const newBatch: GenerationBatch = {
          id: `batch-${Date.now()}-refine`,
          createdAt: Date.now(),
          variants: refinedVariants,
        };
        setGenerationHistory((prev) => [newBatch, ...prev].slice(0, 12));
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Unknown refine error.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function runInspireMe() {
    if (!inputImageBase64) {
      setPipelineError("Upload an AVP asset first to generate inspiration backplates.");
      return;
    }
    setIsLoading(true);
    setPipelineError(null);
    setGenerationError(null);
    setOutputPreviewUrl(null);
    setOutputRawBase64(null);
    setGeneratedVariants([]);
    setSelectedVariantId(null);
    setRefinePrompt("");
    setNodeStatus({
      carAngleAnalyzer: "running",
      inputInterpreter: "running",
      referenceMatcher: "running",
      promptGenerator: "running",
    });
    try {
      const bankImages = await getArtDirectionBankImages();
      const themeReferenceSets = await buildInspireThemeReferenceSets(bankImages);
      const curatedArtDirectionRefs = themeReferenceSets.flat().slice(0, 8);
      const themeConfigs = [
        {
          name: "CITY",
          brief:
            "City: premium UK city center road context, readable skyline rhythm, controlled architecture density, no visual clutter.",
        },
        {
          name: "COUNTRY ROAD",
          brief:
            "Country Road: open rural UK B-road character with hedgerows/stone boundaries and minimal buildings.",
        },
        {
          name: "CORNWALL",
          brief:
            "Cornwall: coastal Cornwall road atmosphere with Atlantic context, slate/stone texture language, scenic coastline cues.",
        },
        {
          name: "URBAN",
          brief:
            "Urban: contemporary UK urban district with modern architecture, clean lines, premium editorial realism.",
        },
      ] as const;
      const wantsMoody = /\b(gloomy|moody|dark|storm|overcast|rain|mist|fog|brooding|dramatic weather)\b/i.test(
        writtenBrief,
      );

      const userReferences =
        inputMode === "MOODBOARD"
          ? moodboardImages.map((img) => img.payload)
          : inputMode === "OWNED_IMAGE" && ownedImage
            ? [ownedImage.payload]
            : [];
      const agentRuns = await Promise.all(
        themeConfigs.map(async (theme, index) => {
          const themedBrief = [
            writtenBrief.trim() || "Generate premium UK backplate inspirations.",
            `INSPIRE MODE THEME LOCK: ${theme.brief}`,
            "CRITICAL: This run is one of four fixed inspire themes. Stay specific to this theme only.",
            "AUDI ART DIRECTION LOCK: clean premium composition, restrained architecture density, believable UK materials, cinematic-but-natural grading, no clutter, no gimmicks.",
            wantsMoody
              ? "Lighting preference: keep the requested moody/overcast atmosphere."
              : "Lighting preference (MANDATORY): bright premium UK look. Favor clear, inviting, high-end editorial natural light and scenic readability.",
            wantsMoody
              ? "Allow atmospheric cloud/rain/mist when requested."
              : "Do not output gloomy, dark, stormy, rainy, foggy, or heavy overcast looks in Inspire mode unless explicitly requested.",
          ].join("\n");

          const activeReferences = [
            ...themeReferenceSets[index],
            ...curatedArtDirectionRefs,
            ...userReferences,
          ].slice(0, 8);

          const response = await fetch("/api/environmental/agents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: inputImageBase64,
              driveSide,
              styleMode,
              motionIntent: getEffectiveMotionIntent(),
              outputMode,
              inputMode: "WRITTEN_BRIEF",
              writtenBrief: themedBrief,
              moodboardImages: activeReferences,
              ownedImage: inputMode === "OWNED_IMAGE" ? ownedImage?.payload ?? null : null,
            }),
          });

          const data = (await response.json()) as UKLocalizerAgentsResponse | { error?: string };
          if (!response.ok || "error" in data) {
            throw new Error(
              (data as { error?: string }).error ?? `Inspire mode failed for ${theme.name}.`,
            );
          }
          return data as UKLocalizerAgentsResponse;
        }),
      );

      const payload = agentRuns[0];
      setCarAngle(payload.carAngle);
      setInstruction(payload.instruction);
      setNodeStatus(payload.agentStatus);
      setLastUsedReferenceImages(payload.effectiveReferenceImages);

      setIsGenerating(true);
      const variants = await generateBatchVariants({
        sourceImageBase64: inputImageBase64,
        instruction: payload.instruction,
        referenceImages: [...payload.effectiveReferenceImages, ...curatedArtDirectionRefs].slice(
          0,
          8,
        ),
        outputResolution,
        outputAspectRatio,
        motionIntent: getEffectiveMotionIntent(),
        outputMode,
        plateFacing: getPlateFacingFromView(payload.carAngle.angle.view),
        cameraLockHints: buildCameraLockHints(payload.carAngle),
        lightingLockOverride: wantsMoody
          ? "Preserve requested moody atmosphere while keeping premium photorealism."
          : "Maintain bright premium UK lighting (clear-to-partly-cloudy daylight or warm golden-hour), with clean exposure and vivid but natural contrast. Avoid gloomy weather.",
        perVariantInstructions: agentRuns.map((run, index) =>
          [
            run.instruction,
            `THEME ORDER LOCK: This is Inspire variant ${index + 1}/4 => ${themeConfigs[index].name}.`,
            "Do not drift into another theme.",
          ].join("\n"),
        ),
        perVariantReferenceImages: agentRuns.map((run, index) =>
          [...run.effectiveReferenceImages, ...themeReferenceSets[index], ...curatedArtDirectionRefs].slice(
            0,
            8,
          ),
        ),
        customVariantDirectives: [
          "THEME 1 (CITY): premium UK city street.",
          "THEME 2 (COUNTRY ROAD): open rural UK road.",
          "THEME 3 (CORNWALL): Cornwall coastal road.",
          "THEME 4 (URBAN): contemporary UK urban district.",
        ],
      });
      setGeneratedVariants(variants);
      setVariantFeedback({});
      if (variants.length) {
        const first = variants[0];
        setSelectedVariantId(first.id);
        setOutputRawBase64(first.rawBase64);
        setOutputPreviewUrl(first.previewUrl);
        const batch: GenerationBatch = {
          id: `batch-${Date.now()}-inspire`,
          createdAt: Date.now(),
          variants,
        };
        setGenerationHistory((prev) => [batch, ...prev].slice(0, 12));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown inspire mode error.";
      setPipelineError(message);
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  }

  async function getArtDirectionBankImages(): Promise<ArtDirectionBankImageItem[]> {
    if (cachedArtDirectionBankImages) {
      return cachedArtDirectionBankImages;
    }
    try {
      const response = await fetch("/api/environmental/art-direction-bank");
      if (!response.ok) {
        return [];
      }
      const payload = (await response.json()) as { images?: ArtDirectionBankImageItem[] };
      const images = Array.isArray(payload.images) ? payload.images : [];
      if (!images.length) {
        setCachedArtDirectionBankImages([]);
        return [];
      }
      setCachedArtDirectionBankImages(images);
      return images;
    } catch {
      return [];
    }
  }

  async function getArtDirectionReferences(
    images: ArtDirectionBankImageItem[],
  ): Promise<ReferenceImageInput[]> {
    if (!images.length) {
      return [];
    }
    const refs = await Promise.all(
      images.map(async (image) => {
        const imageResponse = await fetch(image.url);
        if (!imageResponse.ok) return null;
        const blob = await imageResponse.blob();
        const dataUrl = await blobToDataUrl(blob);
        return {
          data: stripDataUrl(dataUrl),
          mimeType: image.mimeType,
        } as ReferenceImageInput;
      }),
    );
    return refs.filter((item): item is ReferenceImageInput => Boolean(item));
  }

  async function buildInspireThemeReferenceSets(
    allImages: ArtDirectionBankImageItem[],
  ): Promise<ReferenceImageInput[][]> {
    const themes: Array<{ name: string; keywords: string[] }> = [
      { name: "city", keywords: ["city", "london", "street", "georgian", "bankside"] },
      {
        name: "country-road",
        keywords: ["country", "rural", "lane", "b-road", "cotswolds", "highlands", "lake"],
      },
      { name: "cornwall", keywords: ["cornwall", "coast", "coastal", "cliff", "atlantic"] },
      { name: "urban", keywords: ["urban", "modern", "contemporary", "district", "brutalist"] },
    ];

    const lowered = allImages.map((img) => ({
      ...img,
      search: `${img.filename ?? ""} ${img.title ?? ""} ${img.url}`.toLowerCase(),
    }));

    const sets: ReferenceImageInput[][] = [];
    const fallback = selectArtDirectionSamples(allImages, 3);

    for (const theme of themes) {
      const matched = lowered
        .filter((image) => theme.keywords.some((keyword) => image.search.includes(keyword)))
        .slice(0, 3)
        .map((image) => ({ url: image.url, mimeType: image.mimeType }));
      const chosen = matched.length ? matched : fallback;
      const refs = await getArtDirectionReferences(chosen);
      sets.push(refs.slice(0, 3));
    }

    return sets;
  }

  async function generateBatchVariants(input: {
    sourceImageBase64: string;
    instruction: string;
    referenceImages: ReferenceImageInput[];
    outputResolution: OutputResolution;
    outputAspectRatio: OutputAspectRatio;
    motionIntent: "DRIVING" | "PARKED";
    outputMode: OutputMode;
    plateFacing?: "front" | "rear";
    cameraLockHints?: string;
    lightingLockOverride?: string;
    perVariantInstructions?: string[];
    perVariantReferenceImages?: ReferenceImageInput[][];
    customVariantDirectives?: string[];
  }): Promise<GeneratedVariant[]> {
    const lightingLock =
      input.lightingLockOverride ?? deriveLightingLockText(input.instruction, writtenBrief);
    const defaultRecipes = [
      "Variant focus: adjust framing rhythm and leading-line geometry while preserving the exact requested lighting/time-of-day.",
      "Variant focus: vary background architecture layout and depth cues while preserving the exact requested lighting/time-of-day.",
      "Variant focus: vary road texture detail and atmospheric layering while preserving the exact requested lighting/time-of-day.",
      "Variant focus: vary tonal distribution and environmental micro-details while preserving the exact requested lighting/time-of-day.",
    ];
    const recipes =
      input.customVariantDirectives?.length === 4
        ? input.customVariantDirectives
        : defaultRecipes;

    async function renderSingleVariant(
      variationIndex: number,
      retry: number,
    ): Promise<GeneratedVariant> {
      const variantReferenceImages =
        input.perVariantReferenceImages?.[variationIndex]?.length
          ? input.perVariantReferenceImages[variationIndex]
          : input.referenceImages;
      const baseInstruction =
        input.perVariantInstructions?.[variationIndex] ?? input.instruction;
      const nonce = `${Date.now()}-${variationIndex}-${retry}-${Math.random().toString(36).slice(2, 8)}`;
      const variantInstruction = [
        baseInstruction,
        "",
        "AUDI BRAND QA LOCK: keep premium, progressive, authentic look; car is clear hero; background is supportive and uncluttered.",
        rejectionMemory.length
          ? `REJECTION LEARNING MEMORY: Avoid previously rejected traits: ${rejectionMemory.slice(0, 8).join(" | ")}.`
          : "",
        "BACKGROUND SWAP LOCK: Keep the vehicle fixed and swap environment only.",
        "FRAMING LOCK: Maintain same camera distance and framing from AVP. No zoom-in, no dolly-in, no tighter crop.",
        "POSITION LOCK: Keep wheel contact points and vehicle body box anchored to source AVP location.",
        "ATMOSPHERE LOCK: No haze, smoke, mist, fog, dust bloom, or milky veil unless explicitly requested.",
        input.cameraLockHints ? `CAMERA LOCK HINTS: ${input.cameraLockHints}` : "",
        `LIGHTING PRIORITY LOCK: ${lightingLock}`,
        `BATCH DIVERSITY DIRECTIVE (option ${variationIndex + 1}/4):`,
        recipes[variationIndex] ?? recipes[0],
        "CRITICAL: Do not alter requested lighting category or time-of-day from base instruction.",
        "CRITICAL: If base instruction says golden-hour, all variants must remain golden-hour.",
        "Must be visually distinct from the other options while keeping all hard locks.",
        `Diversity nonce: ${nonce}`,
      ].join("\n");

      const response = await fetch("/api/environmental/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: input.sourceImageBase64,
          instruction: variantInstruction,
          driveSide,
          motionIntent: input.motionIntent,
          outputMode: input.outputMode === "BACKPLATE_ONLY" ? "WITH_CAR" : input.outputMode,
          plateFacing: input.plateFacing,
          resolution: input.outputResolution,
          aspectRatio: input.outputAspectRatio,
          variationIndex,
          referenceImages: variantReferenceImages,
          cameraLockHints: input.cameraLockHints,
        }),
      });
      const data = (await response.json()) as {
        imageBase64?: string;
        mimeType?: string;
        error?: string;
      };
      if (!response.ok || !data.imageBase64) {
        throw new Error(data.error ?? "Batch generation failed.");
      }

      const mimeType = data.mimeType ?? "image/png";
      const dataUrl = `data:${mimeType};base64,${data.imageBase64}`;
      const normalized = await normalizeOutputFormat(
        dataUrl,
        input.outputResolution,
        input.outputAspectRatio,
      );

      let finalDataUrl = normalized;
      if (input.outputMode === "BACKPLATE_ONLY") {
        const cleanupPass = await fetch("/api/environmental/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: stripDataUrl(normalized),
            instruction: [
              "BACKPLATE-ONLY CLEANUP PASS (CRITICAL): Remove the vehicle completely and reconstruct the covered background naturally.",
              "HARD CAMERA LOCK: keep exact camera geometry from source pass: same horizon, vanishing point, focal feel, pitch/yaw, framing, road width, curb position, and perspective lines.",
              "HARD COMPOSITION LOCK: do not reframe, rotate, zoom, crop, or shift scene.",
              "HARD CONTENT LOCK: preserve architecture, lighting/time-of-day, weather, and global color grade.",
              "ATMOSPHERE LOCK: no haze, smoke, mist, fog, dust bloom, or milky veil unless explicitly requested.",
              "NEGATIVE LOCK: no visible vehicles, no registration plates, no alphanumeric text, no painted words/symbols on road, no logos, no watermarks.",
              "Road markings allowed only as realistic non-text UK lane lines.",
            ].join("\n"),
            driveSide,
            motionIntent: input.motionIntent,
            outputMode: "BACKPLATE_ONLY",
            plateFacing: input.plateFacing,
            resolution: input.outputResolution,
            aspectRatio: input.outputAspectRatio,
            variationIndex,
            cameraLockHints: input.cameraLockHints,
          }),
        });
        const cleanupData = (await cleanupPass.json()) as {
          imageBase64?: string;
          mimeType?: string;
          error?: string;
        };
        finalDataUrl =
          cleanupPass.ok && cleanupData.imageBase64
            ? `data:${cleanupData.mimeType ?? "image/png"};base64,${cleanupData.imageBase64}`
            : normalized;
      } else if (input.outputMode === "WITH_CAR") {
        const platePass = await fetch("/api/environmental/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: stripDataUrl(normalized),
            instruction: [
              `FINAL COMPLIANCE PASS: Set the visible registration plate text to exactly "${UK_EV_PLATE_TEXT}".`,
              input.plateFacing === "rear"
                ? "Render rear plate in UK EV style: yellow reflective plate with a green flash band on the left edge; black UK registration typography, realistic spacing and kerning."
                : "Render front plate in UK EV style: white reflective plate with a green flash band on the left edge; black UK registration typography, realistic spacing and kerning.",
              `LIGHTING LOCK: ${lightingLock}`,
              "If source is dusk/golden-hour/sunset, preserve that exact time-of-day in the output.",
              "Do not alter composition, camera geometry, environment, vehicle paint, reflections, or background layout.",
              "POSITION LOCK: keep wheel contact points and vehicle body position identical to source AVP.",
              "ATMOSPHERE LOCK: no haze, smoke, mist, fog, dust bloom, or milky veil unless explicitly requested.",
              "Never place registration text or alphanumeric characters on the road surface.",
              "Only update plate fidelity and required lighting compliance while preserving everything else.",
            ].join("\n"),
            driveSide,
            motionIntent: input.motionIntent,
            outputMode: input.outputMode,
            plateFacing: input.plateFacing,
            resolution: input.outputResolution,
            aspectRatio: input.outputAspectRatio,
            variationIndex,
            cameraLockHints: input.cameraLockHints,
          }),
        });
        const plateData = (await platePass.json()) as {
          imageBase64?: string;
          mimeType?: string;
          error?: string;
        };
        finalDataUrl =
          platePass.ok && plateData.imageBase64
            ? `data:${plateData.mimeType ?? "image/png"};base64,${plateData.imageBase64}`
            : normalized;
      }

      const finalNormalized = await normalizeOutputFormat(
        finalDataUrl,
        input.outputResolution,
        input.outputAspectRatio,
      );

      return {
        id: `${Date.now()}-${variationIndex}-${retry}`,
        previewUrl: finalNormalized,
        rawBase64: stripDataUrl(finalNormalized),
      };
    }

    const firstPass = await Promise.all(
      [0, 1, 2, 3].map((variationIndex) => renderSingleVariant(variationIndex, 0)),
    );

    const unique: GeneratedVariant[] = [];
    for (let i = 0; i < firstPass.length; i += 1) {
      const variant = firstPass[i];
      const duplicate = unique.some((item) => item.rawBase64 === variant.rawBase64);
      if (!duplicate) {
        unique.push(variant);
        continue;
      }
      const rerendered = await renderSingleVariant(i, 1);
      unique.push(rerendered);
    }

    return unique;
  }

  function selectVariant(id: string) {
    setSelectedVariantId(id);
    const match = generatedVariants.find((variant) => variant.id === id);
    if (!match) return;
    setOutputPreviewUrl(match.previewUrl);
    setOutputRawBase64(match.rawBase64);
  }

  function loadBatch(batchId: string) {
    const batch = generationHistory.find((entry) => entry.id === batchId);
    if (!batch || !batch.variants.length) return;
    setGeneratedVariants(batch.variants);
    setVariantFeedback({});
    const first = batch.variants[0];
    setSelectedVariantId(first.id);
    setOutputPreviewUrl(first.previewUrl);
    setOutputRawBase64(first.rawBase64);
    document.getElementById("generation-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function markVariantAccepted(variantId: string) {
    setVariantFeedback((prev) => ({ ...prev, [variantId]: "accepted" }));
  }

  function markVariantRejected(variantId: string) {
    const note = window.prompt(
      "Why is this rejected? (e.g. wrong angle, too hazy, too many buildings)",
      "wrong angle / composition drift",
    );
    setVariantFeedback((prev) => ({ ...prev, [variantId]: "rejected" }));
    if (!note?.trim()) return;
    const normalized = note.trim().toLowerCase();
    setRejectionMemory((prev) => {
      const next = [normalized, ...prev.filter((item) => item !== normalized)];
      return next.slice(0, 30);
    });
  }

  async function handleDownloadAllZip() {
    if (!generatedVariants.length) return;
    const zip = new JSZip();
    generatedVariants.forEach((variant, index) => {
      zip.file(`backplate-variant-${index + 1}.png`, variant.rawBase64, { base64: true });
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "backplate-variants.zip";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadPng() {
    if (!outputPreviewUrl) return;
    const pngDataUrl = await toPngDataUrl(outputPreviewUrl);
    const link = document.createElement("a");
    link.href = pngDataUrl;
    link.download = "audi-uk-backplate.png";
    link.click();
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
    const pngDataUrl = await toPngDataUrl(current.url);
    const link = document.createElement("a");
    link.href = pngDataUrl;
    link.download = `${current.label.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.click();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-4 py-8 sm:px-6 md:px-8 md:py-10 lg:px-10 lg:py-12">
      <header className="mb-8">
        <div className="mb-5 flex flex-wrap gap-2">
          <Link
            href="/environmental"
            className="border border-black bg-black px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white"
          >
            Environmental
          </Link>
          <Link
            href="/studio"
            className="border border-border bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-text/75 transition hover:border-black hover:text-text"
          >
            Studio
          </Link>
        </div>
        <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-text/60">MOD BOX · Audi UK</p>
        <h1 className="text-3xl font-semibold leading-none tracking-[-0.03em] text-text sm:text-4xl md:text-6xl lg:text-7xl">
          ENVIRONMENTAL BACKPLATE GENERATOR
        </h1>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-text/70 md:text-sm">
          Car Angle Analyzer → Input Interpreter → Backplate Prompt Generator
        </p>
      </header>

      <section className="mb-6 border border-border bg-surface p-4 sm:p-5 md:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_1.35fr]">
          <div className="space-y-4">
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text">Car Input</h2>
              {inputPreviewUrl ? (
                <p className="mb-2 text-[11px] uppercase tracking-[0.08em] text-text/60">
                  Auto-detected view: <span className="text-accent">{carAngle.angle.view}</span>
                </p>
              ) : null}
              <UploadDropzone
                onFileSelected={(file) => void handleCarFile(file)}
                previewUrl={inputPreviewUrl}
              />
            </div>

            <button
              type="button"
              disabled={!canRun || isLoading || isGenerating}
              onClick={() => void runPromptPipeline()}
              className="w-full border border-border bg-black px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading || isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text">Settings</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                  <span className="block">Drive side</span>
                  <select
                    value={driveSide}
                    onChange={(event) => setDriveSide(event.target.value as "RHD" | "LHD")}
                    className={SELECT_CLASS}
                  >
                    <option value="RHD">RHD</option>
                    <option value="LHD">LHD</option>
                  </select>
                </label>
                <label className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                  <span className="block">Style</span>
                  <select
                    value={styleMode}
                    disabled
                    className={`${SELECT_CLASS} border-border bg-[#ececec] text-text/70`}
                  >
                    <option value="BRAND">Brand</option>
                  </select>
                </label>
                <label className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                  <span className="block">Market</span>
                  <select
                    value={market}
                    disabled
                    className={`${SELECT_CLASS} border-border bg-[#ececec] text-text/70`}
                  >
                    <option value="United Kingdom">United Kingdom</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                  <span className="block">Vehicle motion</span>
                  <select
                    value={vehicleMotionIntent}
                    onChange={(event) =>
                      setVehicleMotionIntent(event.target.value as VehicleMotionIntent)
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="AUTO">Auto (from brief)</option>
                    <option value="DRIVING">Driving</option>
                    <option value="PARKED">Parked</option>
                  </select>
                </label>
                <label className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                  <span className="block">Output mode</span>
                  <select
                    value={outputMode}
                    onChange={(event) => setOutputMode(event.target.value as OutputMode)}
                    className={SELECT_CLASS}
                  >
                    <option value="WITH_CAR">With Car</option>
                    <option value="BACKPLATE_ONLY">Backplate Only</option>
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                  <span className="block">Image resolution</span>
                  <select
                    value={outputResolution}
                    onChange={(event) =>
                      setOutputResolution(event.target.value as OutputResolution)
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="1K">1K</option>
                    <option value="2K">2K</option>
                    <option value="4K">4K</option>
                  </select>
                </label>
                <label className="space-y-1 text-[11px] uppercase tracking-[0.08em] text-text/70">
                  <span className="block">Aspect ratio</span>
                  <select
                    value={outputAspectRatio}
                    onChange={(event) =>
                      setOutputAspectRatio(event.target.value as OutputAspectRatio)
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="1:1">1:1</option>
                    <option value="16:9">16:9</option>
                    <option value="4:5">4:5</option>
                    <option value="3:2">3:2</option>
                  </select>
                </label>
              </div>
              <details className="mt-3 border border-border bg-white p-3 text-xs text-text/70">
                <summary className="cursor-pointer select-none font-medium uppercase tracking-[0.08em] text-text/80">
                  Compliance locks (always on)
                </summary>
                <ul className="mt-2 space-y-1">
                  {outputMode === "WITH_CAR" ? (
                    <>
                      <li>
                        English EV plate lock: <span className="text-accent">{UK_EV_PLATE_TEXT}</span>
                      </li>
                      <li>Plate styling lock: rear yellow UK / front white UK</li>
                    </>
                  ) : (
                    <li>Backplate-only lock: no vehicle visible in final image</li>
                  )}
                  <li>RHD composition lock: vehicle placement zone on right side</li>
                  <li>Road realism lock: no painted words/letters (no &quot;UK&quot; on road)</li>
                  <li>Camera geometry lock: keep original angle, yaw, scale, framing</li>
                </ul>
              </details>
            </div>

            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text">Backplate Input</h2>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode("WRITTEN_BRIEF")}
                  className={`border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] ${
                    inputMode === "WRITTEN_BRIEF"
                      ? "border-black bg-black text-white"
                      : "border-border bg-white text-text/70"
                  }`}
                >
                  Written Brief
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("MOODBOARD")}
                  className={`border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] ${
                    inputMode === "MOODBOARD"
                      ? "border-black bg-black text-white"
                      : "border-border bg-white text-text/70"
                  }`}
                >
                  Moodboard
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("OWNED_IMAGE")}
                  className={`border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.08em] ${
                    inputMode === "OWNED_IMAGE"
                      ? "border-black bg-black text-white"
                      : "border-border bg-white text-text/70"
                  }`}
                >
                  Owned Image
                </button>
                <button
                  type="button"
                  onClick={() => void runInspireMe()}
                  disabled={!inputImageBase64 || isLoading || isGenerating}
                  className="ml-auto inline-flex items-center gap-1 border-2 border-black bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-text transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:border-border disabled:text-text/40"
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center border border-current text-[10px] leading-none">
                    ✦
                  </span>
                  Inspire Me
                </button>
              </div>

              <label className="mb-2 block text-[11px] uppercase tracking-[0.08em] text-text/70">
                Prompt
              </label>
              <textarea
                value={writtenBrief}
                onChange={(event) => setWrittenBrief(event.target.value)}
                placeholder="Describe desired UK scene, mood, architecture, weather, and lighting."
                rows={3}
                className="mb-3 w-full border border-border bg-white px-3 py-2 text-sm text-text outline-none transition focus:border-black"
              />

              {inputMode === "MOODBOARD" ? (
                <div className="space-y-2 border border-border bg-white p-3">
                  <label className="inline-flex cursor-pointer border border-border px-2 py-1 text-xs font-medium uppercase tracking-[0.08em] text-text/80 transition hover:bg-black hover:text-white">
                    Add moodboard images
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        void handleMoodboardFiles(event.target.files);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {moodboardImages.length ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {moodboardImages.map((img) => (
                        <div key={img.id} className="relative overflow-hidden border border-border">
                          <Image
                            src={img.previewUrl}
                            alt="Moodboard"
                            width={480}
                            height={320}
                            unoptimized
                            className="h-20 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeMoodboardImage(img.id)}
                            className="absolute right-1 top-1 border border-border bg-white px-1.5 py-0.5 text-[10px] text-text"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text/50">Upload multiple references for combined aesthetic analysis.</p>
                  )}
                </div>
              ) : null}

              {inputMode === "OWNED_IMAGE" ? (
                <div className="space-y-2 border border-border bg-white p-3">
                  <label className="inline-flex cursor-pointer border border-border px-2 py-1 text-xs font-medium uppercase tracking-[0.08em] text-text/80 transition hover:bg-black hover:text-white">
                    Upload owned image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleOwnedImage(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {ownedImage ? (
                    <Image
                      src={ownedImage.previewUrl}
                      alt="Owned reference"
                      width={640}
                      height={360}
                      unoptimized
                      className="h-28 w-full border border-border object-cover"
                    />
                  ) : (
                    <p className="text-xs text-text/50">Upload one owned image as reference input.</p>
                  )}
                </div>
              ) : null}

              {isLoading || isGenerating ? (
                <InlineLoadingStream
                  stage={
                    isGenerating
                      ? "GENERATING BACKPLATES"
                      : nodeStatus.carAngleAnalyzer === "running"
                        ? "ANALYZING AVP ANGLE"
                        : nodeStatus.inputInterpreter === "running"
                          ? "INTERPRETING BRIEF"
                          : "PREPARING GENERATION"
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {pipelineError ? (
        <p className="mb-6 border border-red-700/40 bg-red-50 px-3 py-2 text-sm text-red-800">
          {pipelineError}
        </p>
      ) : null}

      <section id="generation-section">
        <GenerationPanel
          isGenerating={isGenerating}
          inputPreview={inputPreviewUrl}
          outputPreview={outputPreviewUrl}
          variants={generatedVariants.map((v) => ({ id: v.id, previewUrl: v.previewUrl }))}
          selectedVariantId={selectedVariantId}
          onSelectVariant={selectVariant}
          onDownload={() => void handleDownloadPng()}
          onDownloadAll={() => void handleDownloadAllZip()}
          onRegenerate={() => void regenerateFromCurrentInstruction()}
          onRefine={() => void refineCurrentOutput()}
          refinePrompt={refinePrompt}
          onRefinePromptChange={setRefinePrompt}
          canRefine={Boolean(outputRawBase64 && instruction && refinePrompt.trim())}
          canRegenerate={Boolean(instruction && inputImageBase64)}
          error={generationError}
          onOpenImage={openLightbox}
          feedbackByVariant={variantFeedback}
          onMarkVariantAccepted={markVariantAccepted}
          onMarkVariantRejected={markVariantRejected}
        />
      </section>

      {generationHistory.length ? (
        <section className="mt-6 border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-text/85">
              Generation History
            </h3>
            <span className="text-xs text-text/60">
              {generationHistory.length} recent batches
            </span>
          </div>
          <div className="space-y-3">
            {generationHistory.map((batch) => (
              <div key={batch.id} className="border border-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-text/65">
                    {new Date(batch.createdAt).toLocaleString()}
                  </span>
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
                    <div key={variant.id} className="relative overflow-hidden border border-border">
                      <button
                        type="button"
                        onClick={() => openLightbox(variant.previewUrl, "History Variant")}
                        className="w-full transition hover:opacity-90"
                      >
                        <Image
                          src={variant.previewUrl}
                          alt="Historical generated variant"
                          width={640}
                          height={360}
                          unoptimized
                          className="h-24 w-full object-cover md:h-28"
                        />
                      </button>
                    </div>
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
                {lightboxState.items[lightboxState.index]?.label} ·{" "}
                {lightboxState.index + 1}/{lightboxState.items.length}
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

export default function Home() {
  return <StudioBackplatePage />;
}

function InlineLoadingStream({ stage }: { stage: string }) {
  return (
    <section className="mt-3 border border-border bg-white p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-text">
        System Activity
      </p>
      <div className="mb-2 h-1.5 w-full overflow-hidden border border-border bg-[#f2f2f2]">
        <div className="h-full w-1/3 animate-progress bg-black" />
      </div>
      <div className="border border-border bg-[#f8f8f8] p-2 font-mono text-[11px] text-text/85">
        <p className="animate-pulse">{">"} init.pipeline()</p>
        <p className="animate-pulse">{">"} lock.camera_geometry()</p>
        <p className="animate-pulse">{">"} status: {stage}</p>
      </div>
    </section>
  );
}

function deriveLightingLockText(instruction: string, brief: string): string {
  const source = `${instruction} ${brief}`.toLowerCase();
  if (/\b(dusk|sunset|twilight|blue hour)\b/.test(source)) {
    return "Maintain dusk lighting exactly (low sun, warm horizon, soft contrast).";
  }
  if (/\b(golden hour|golden-hour)\b/.test(source)) {
    return "Maintain golden-hour lighting exactly (warm directional sun, long soft shadows).";
  }
  if (/\b(night|nighttime|after dark)\b/.test(source)) {
    return "Maintain nighttime lighting exactly (low ambient light with realistic practical highlights).";
  }
  if (/\b(overcast|cloudy)\b/.test(source)) {
    return "Maintain overcast lighting exactly (soft diffused sky light, low shadow contrast).";
  }
  return "Preserve the requested time-of-day and lighting mood from the prompt exactly.";
}

function buildCameraLockHints(angle: CarAngleAnalysis): string {
  return [
    `view=${angle.angle.view}`,
    `rotation_degrees=${angle.angle.rotation_degrees}`,
    `camera_height=${angle.camera.height}`,
    `focal_length_mm=${angle.camera.focal_length_mm}`,
    `horizon_line=${angle.composition.horizon_line}`,
    `vehicle_position=${angle.composition.vehicle_position}`,
    `frame_coverage=${angle.composition.frame_coverage}`,
    "Keep vehicle size percentage in frame identical to AVP source.",
  ].join("; ");
}

function getPlateFacingFromView(view: string): "front" | "rear" {
  const normalized = view.toLowerCase();
  if (normalized.includes("rear")) return "rear";
  return "front";
}

function selectArtDirectionSamples<T>(images: T[], count: number): T[] {
  if (images.length <= count) return images;
  const selected: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (images.length - 1)) / Math.max(1, count - 1));
    selected.push(images[index]);
  }
  return selected;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not convert blob to data URL."));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function toMimeType(input: string): "image/jpeg" | "image/png" | "image/webp" {
  if (input === "image/png") return "image/png";
  if (input === "image/webp") return "image/webp";
  return "image/jpeg";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image file."));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function stripDataUrl(dataUrl: string): string {
  return dataUrl.replace(/^data:[^;]+;base64,/, "");
}

function getTargetDimensions(
  resolution: OutputResolution,
  aspectRatio: OutputAspectRatio,
): { width: number; height: number } {
  const longEdge = resolution === "4K" ? 4096 : resolution === "2K" ? 2048 : 1024;
  const ratio = aspectRatio === "16:9" ? 16 / 9 : aspectRatio === "4:5" ? 4 / 5 : aspectRatio === "3:2" ? 3 / 2 : 1;

  if (ratio >= 1) {
    return { width: longEdge, height: Math.round(longEdge / ratio) };
  }
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

      context.drawImage(
        image,
        sx,
        sy,
        sWidth,
        sHeight,
        0,
        0,
        target.width,
        target.height,
      );
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Could not normalize output format."));
    image.src = sourceDataUrl;
  });
}

function toPngDataUrl(sourceDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not create canvas context."));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Could not convert image to PNG."));
    image.src = sourceDataUrl;
  });
}
