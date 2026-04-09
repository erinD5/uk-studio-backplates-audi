import { NextResponse } from "next/server";

import {
  detectImageMediaType,
  getGeminiApiKey,
  runBackplatePromptGenerator,
  runCarAngleAnalyzer,
  runCarViewVerifier,
  runInputInterpreter,
  runReferenceMatcher,
} from "@/lib/agents";
import {
  getLibraryReferenceCandidates,
  loadReferenceImagesFromPaths,
} from "@/lib/styleLibrary";
import {
  BackplateInputMode,
  CarAngleAnalysis,
  InputInterpretation,
  OutputMode,
  ReferenceImageInput,
  StyleMode,
  UKLocalizerAgentsResponse,
  VehicleMotionIntent,
} from "@/lib/types";

interface AgentsRequestBody {
  imageBase64?: string;
  driveSide?: "RHD" | "LHD";
  styleMode?: StyleMode;
  motionIntent?: VehicleMotionIntent;
  outputMode?: OutputMode;
  inputMode?: BackplateInputMode;
  writtenBrief?: string;
  moodboardImages?: ReferenceImageInput[];
  ownedImage?: ReferenceImageInput | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentsRequestBody;
    const imageBase64 = sanitizeBase64(body?.imageBase64 ?? "");
    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 is required." }, { status: 400 });
    }

    const driveSide = body?.driveSide === "LHD" ? "LHD" : "RHD";
    const styleMode: StyleMode = "BRAND";
    const motionIntent = normalizeMotionIntent(body?.motionIntent, body?.writtenBrief);
    const outputMode = normalizeOutputMode(body?.outputMode);
    const inputMode = normalizeInputMode(body?.inputMode);
    const writtenBrief = body?.writtenBrief?.trim() ?? "";
    const moodboardImages = sanitizeReferenceImages(body?.moodboardImages, 8);
    const ownedImage = sanitizeSingleReference(body?.ownedImage);

    const geminiApiKey = getGeminiApiKey();
    const mediaType = detectImageMediaType(imageBase64);
    const errors: string[] = [];

    let carAngle: CarAngleAnalysis;
    try {
      carAngle = await runCarAngleAnalyzer(geminiApiKey, { imageBase64, mediaType });
      const verifiedView = await runCarViewVerifier(geminiApiKey, { imageBase64, mediaType });
      carAngle = normalizeVerifiedView(carAngle, verifiedView.view, verifiedView.confidence);
    } catch (error) {
      errors.push("Car Angle Analyzer failed.");
      if (error instanceof Error) errors.push(error.message);
      carAngle = getFallbackCarAngle();
    }

    let inputInterpretation: InputInterpretation;
    try {
      inputInterpretation = await runInputInterpreter(geminiApiKey, {
        inputMode,
        writtenBrief,
        moodboardImages,
        ownedImage,
      });
    } catch (error) {
      errors.push("Input Interpreter failed.");
      if (error instanceof Error) errors.push(error.message);
      inputInterpretation = getFallbackInputInterpretation();
    }
    inputInterpretation = applyExplicitSceneOverrides(inputInterpretation, writtenBrief);

    let effectiveReferenceImages: ReferenceImageInput[] = [];
    let referenceSource: "user-moodboard" | "hidden-library" | "none" = "none";
    if (moodboardImages.length > 0) {
      effectiveReferenceImages = moodboardImages.slice(0, 3);
      referenceSource = "user-moodboard";
    } else {
      const candidates = getLibraryReferenceCandidates(inputInterpretation);
      let selectedPaths: string[] = [];
      try {
        selectedPaths = await runReferenceMatcher(geminiApiKey, {
          sceneParams: inputInterpretation,
          candidatePaths: candidates,
        });
      } catch (error) {
        errors.push("Reference Matcher failed.");
        if (error instanceof Error) errors.push(error.message);
        selectedPaths = candidates.slice(0, 3);
      }

      const loaded = await loadReferenceImagesFromPaths(selectedPaths);
      if (loaded.length > 0) {
        effectiveReferenceImages = loaded;
        referenceSource = "hidden-library";
      }
    }

    let instruction = "";
    try {
      instruction = await runBackplatePromptGenerator(geminiApiKey, {
        cameraParams: carAngle,
        sceneParams: inputInterpretation,
        driveSide,
        styleMode,
        motionIntent,
        outputMode,
      });
    } catch (error) {
      errors.push("Backplate Prompt Generator failed.");
      if (error instanceof Error) errors.push(error.message);
      instruction = getFallbackPrompt(carAngle, inputInterpretation);
    }

    const payload: UKLocalizerAgentsResponse = {
      carAngle,
      inputInterpretation,
      effectiveReferenceImages,
      referenceSource,
      instruction,
      agentStatus: {
        carAngleAnalyzer: errors.some((e) => e.includes("Car Angle")) ? "error" : "done",
        inputInterpreter: errors.some((e) => e.includes("Input Interpreter")) ? "error" : "done",
        referenceMatcher: errors.some((e) => e.includes("Reference Matcher")) ? "error" : "done",
        promptGenerator: errors.some((e) => e.includes("Backplate Prompt")) ? "error" : "done",
      },
      ...(errors.length ? { errors } : {}),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error in agents route.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function sanitizeBase64(value: string): string {
  const stripped = value.replace(/^data:[^;]+;base64,/, "").trim();
  return stripped.length >= 128 ? stripped : "";
}

function normalizeInputMode(input: string | undefined): BackplateInputMode {
  return input === "MOODBOARD" || input === "OWNED_IMAGE" ? input : "WRITTEN_BRIEF";
}

function normalizeOutputMode(input: string | undefined): OutputMode {
  return input === "BACKPLATE_ONLY" ? "BACKPLATE_ONLY" : "WITH_CAR";
}

function normalizeMotionIntent(
  input: string | undefined,
  writtenBrief: string | undefined,
): Exclude<VehicleMotionIntent, "AUTO"> {
  if (input === "DRIVING" || input === "PARKED") {
    return input;
  }
  const brief = (writtenBrief ?? "").toLowerCase();
  const drivingHints = /\b(driving|moving|in motion|rolling|on the move|at speed)\b/;
  if (drivingHints.test(brief)) {
    return "DRIVING";
  }
  return "PARKED";
}

function sanitizeReferenceImages(
  input: ReferenceImageInput[] | undefined,
  maxCount: number,
): ReferenceImageInput[] {
  if (!Array.isArray(input)) return [];
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
    .slice(0, maxCount);
}

function sanitizeSingleReference(
  input: ReferenceImageInput | null | undefined,
): ReferenceImageInput | null {
  if (!input?.data) return null;
  if (
    input.mimeType !== "image/jpeg" &&
    input.mimeType !== "image/png" &&
    input.mimeType !== "image/webp"
  ) {
    return null;
  }
  const cleaned = sanitizeBase64(input.data);
  if (cleaned.length <= 64) return null;
  return { data: cleaned, mimeType: input.mimeType };
}

function getFallbackCarAngle(): CarAngleAnalysis {
  return {
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
}

function getFallbackInputInterpretation(): InputInterpretation {
  return {
    location: {
      type: "road",
      specific: "Quiet UK road with contemporary architecture",
      uk_region: "Cornwall",
      architecture: "contemporary",
      uk_elements: "British tarmac, slate textures, native hedgerows",
    },
    lighting: {
      time: "overcast",
      quality: "soft-diffused",
      direction: "diffused",
      temperature: "neutral-5000K",
    },
    weather: { condition: "overcast", ground: "damp" },
    atmosphere: { mood: "premium", season: "autumn" },
    ground_plane: { surface: "tarmac", condition: "weathered" },
  };
}

function getFallbackPrompt(
  car: CarAngleAnalysis,
  scene: InputInterpretation,
): string {
  return [
    `[CAMERA]: ${car.camera.focal_length_mm}mm lens, ${car.camera.aperture_estimate}, camera at ${car.camera.height}, ${car.camera.tilt} angle, horizon at ${car.composition.horizon_line}`,
    `[LOCATION]: Empty ${scene.location.uk_region}, ${scene.location.architecture}, ${scene.location.uk_elements}`,
    `[LIGHTING]: ${scene.lighting.time}, ${scene.lighting.quality} ${scene.lighting.direction}, ${scene.lighting.temperature}`,
    `[ATMOSPHERE]: ${scene.weather.condition}, ${scene.atmosphere.mood}, ${scene.atmosphere.season}`,
    `[GROUND]: ${scene.ground_plane.surface}, ${scene.ground_plane.condition}, clear ground plane for vehicle placement, realistic UK reflections`,
    "[QUALITY]: ultra-photorealistic, hyper-detailed textures, natural colors with muted tones, no oversaturation, genuine HDR, photographic realism",
    "[NEGATIVE]: --no cars, vehicles, people, text, watermarks, logos, Mediterranean architecture, palm trees, American signage, EU signage, power lines in foreground, cartoon, CGI look, overprocessed HDR, unnatural colors, extreme saturation",
  ].join("\n");
}

function normalizeVerifiedView(
  carAngle: CarAngleAnalysis,
  verifiedView: CarAngleAnalysis["angle"]["view"],
  confidence: "high" | "medium" | "low",
): CarAngleAnalysis {
  if (confidence === "low") {
    return carAngle;
  }

  const next = {
    ...carAngle,
    angle: {
      ...carAngle.angle,
      view: verifiedView,
    },
  };

  if (verifiedView === "direct-rear" && carAngle.angle.rotation_degrees === "45") {
    next.angle.rotation_degrees = "180";
  }
  if (verifiedView === "direct-front" && carAngle.angle.rotation_degrees === "180") {
    next.angle.rotation_degrees = "0";
  }
  return next;
}

function applyExplicitSceneOverrides(
  scene: InputInterpretation,
  writtenBrief: string,
): InputInterpretation {
  const brief = writtenBrief.toLowerCase();
  let next = scene;

  const requestsCity = /\b(city|city streets?|urban streets?|town center|city centre)\b/.test(
    brief,
  );
  if (requestsCity) {
    next = {
      ...next,
      location: {
        ...next.location,
        type: "urban",
        specific: "UK city streets (not motorway)",
        architecture: "Georgian",
        uk_elements:
          "UK city lane geometry, kerbside parking bays, black bollards, UK street furniture, no motorway infrastructure",
      },
      ground_plane: {
        surface: "tarmac",
        condition: "dry",
      },
    };
  }

  const requestsGoldenHour = /\b(golden hour|sunset|dusk)\b/.test(brief);
  if (requestsGoldenHour) {
    next = {
      ...next,
      lighting: {
        ...next.lighting,
        time: "golden-hour",
        quality: "soft-diffused",
        temperature: "warm-3200K",
      },
    };
  }

  const requestsDry = /\b(dry|dry weather|no rain|no wet road)\b/.test(brief);
  if (requestsDry) {
    next = {
      ...next,
      weather: {
        ...next.weather,
        condition: "clear",
        ground: "dry",
      },
      ground_plane: {
        ...next.ground_plane,
        condition: "dry",
      },
    };
  }

  const isScottishHighlands = /\b(scottish highlands|highlands|applecross|quiraing|isle of skye|skye)\b/.test(
    brief,
  );

  if (!isScottishHighlands) {
    return next;
  }

  return {
    ...next,
    location: {
      ...next.location,
      type: "road",
      specific: "Scottish Highlands iconic route (Glencoe / Rest and Be Thankful / Loch Lomond-Trossachs)",
      uk_region: "Scottish Highlands",
      architecture: "granite",
      uk_elements:
        "single-track roads with passing places, dry-stone edges, heather moorland, dark granite outcrops, dramatic Highland valley silhouettes",
    },
    ground_plane: {
      surface: "country-lane",
      condition: next.ground_plane.condition || "weathered",
    },
  };
}
