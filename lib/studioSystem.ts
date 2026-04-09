export type StudioGradientId =
  | "dark-neutral"
  | "charcoal"
  | "warm-grey"
  | "cool-grey"
  | "midnight"
  | "concrete"
  | "pure-black"
  | "light-grey";

export type StudioLightingDirectionId =
  | "left"
  | "right"
  | "overhead"
  | "front"
  | "back-rim"
  | "split"
  | "three-point";

export type StudioLightingStyleId = "soft" | "hard" | "natural" | "cinematic" | "flat";
export type StudioFloorTypeId = "reflective" | "matte" | "semi-gloss" | "infinite" | "textured";
export type StudioAccentId = "none" | "audi-red" | "warm-amber" | "cool-blue" | "subtle-gold";

export interface StudioGradientPreset {
  id: StudioGradientId;
  name: string;
  topHex: string;
  bottomHex: string;
}

export interface StudioParameterSelection {
  gradient: StudioGradientId;
  lightingDirection: StudioLightingDirectionId;
  lightingStyle: StudioLightingStyleId;
  floorType: StudioFloorTypeId;
  accent: StudioAccentId;
}

export interface StudioParameterCollectorOutput {
  gradient: {
    id: StudioGradientId;
    name: string;
    top_hex: string;
    bottom_hex: string;
  };
  lighting: {
    direction: StudioLightingDirectionId;
    style: StudioLightingStyleId;
  };
  floor: {
    type: StudioFloorTypeId;
  };
  accent: {
    id: StudioAccentId;
    hex: string | null;
  };
}

export const STUDIO_DEFAULTS: StudioParameterSelection = {
  gradient: "dark-neutral",
  lightingDirection: "overhead",
  lightingStyle: "soft",
  floorType: "reflective",
  accent: "none",
};

export const STUDIO_GRADIENTS: StudioGradientPreset[] = [
  { id: "dark-neutral", name: "Audi Dark", topHex: "#232A34", bottomHex: "#191D26" },
  { id: "charcoal", name: "Deep Charcoal", topHex: "#1A1A1A", bottomHex: "#0D0D0D" },
  { id: "warm-grey", name: "Warm Studio", topHex: "#2D2A28", bottomHex: "#1C1916" },
  { id: "cool-grey", name: "Cool Studio", topHex: "#252A2E", bottomHex: "#161A1E" },
  { id: "midnight", name: "Midnight Blue", topHex: "#1A1E2E", bottomHex: "#0E1118" },
  { id: "concrete", name: "Concrete Grey", topHex: "#3A3A3A", bottomHex: "#252525" },
  { id: "pure-black", name: "Infinite Black", topHex: "#0A0A0A", bottomHex: "#000000" },
  { id: "light-grey", name: "Light Studio", topHex: "#E8E8E8", bottomHex: "#C0C0C0" },
];

export const STUDIO_LIGHTING_DIRECTIONS: Array<{
  id: StudioLightingDirectionId;
  name: string;
  icon: string;
}> = [
  { id: "left", name: "Left", icon: "←" },
  { id: "right", name: "Right", icon: "→" },
  { id: "overhead", name: "Overhead", icon: "↓" },
  { id: "front", name: "Front", icon: "•" },
  { id: "back-rim", name: "Rim/Backlit", icon: "○" },
  { id: "split", name: "Split", icon: "↔" },
  { id: "three-point", name: "Three-Point", icon: "△" },
];

export const STUDIO_LIGHTING_STYLES: Array<{ id: StudioLightingStyleId; name: string }> = [
  { id: "soft", name: "Soft" },
  { id: "hard", name: "Hard" },
  { id: "natural", name: "Natural" },
  { id: "cinematic", name: "Cinematic" },
  { id: "flat", name: "Flat" },
];

export const STUDIO_FLOOR_TYPES: Array<{ id: StudioFloorTypeId; name: string }> = [
  { id: "reflective", name: "Reflective" },
  { id: "matte", name: "Matte" },
  { id: "semi-gloss", name: "Semi-Gloss" },
  { id: "infinite", name: "Infinite/Seamless" },
  { id: "textured", name: "Textured Concrete" },
];

export const STUDIO_ACCENTS: Array<{ id: StudioAccentId; name: string; hex: string | null }> = [
  { id: "none", name: "None", hex: null },
  { id: "audi-red", name: "Audi RS Red", hex: "#BB0A30" },
  { id: "warm-amber", name: "Warm Amber", hex: "#D4A574" },
  { id: "cool-blue", name: "Cool Blue", hex: "#4A90A4" },
  { id: "subtle-gold", name: "Subtle Gold", hex: "#C9A962" },
];

interface StudioReferenceDefinition {
  path: string;
  gradient: "dark-neutral" | "charcoal" | "warm-grey" | "cool-grey";
  direction: StudioLightingDirectionId;
  style?: StudioLightingStyleId;
  floor?: StudioFloorTypeId;
  accent?: Exclude<StudioAccentId, "none">;
}

const STUDIO_REFERENCE_LIBRARY: StudioReferenceDefinition[] = [
  {
    path: "/references/studio/dark-neutral/overhead-soft-reflective.jpg",
    gradient: "dark-neutral",
    direction: "overhead",
    style: "soft",
    floor: "reflective",
  },
  {
    path: "/references/studio/dark-neutral/left-cinematic-semi-gloss.jpg",
    gradient: "dark-neutral",
    direction: "left",
    style: "cinematic",
    floor: "semi-gloss",
  },
  {
    path: "/references/studio/dark-neutral/three-point-natural-reflective.jpg",
    gradient: "dark-neutral",
    direction: "three-point",
    style: "natural",
    floor: "reflective",
  },
  {
    path: "/references/studio/dark-neutral/right-soft-matte.jpg",
    gradient: "dark-neutral",
    direction: "right",
    style: "soft",
    floor: "matte",
  },
  {
    path: "/references/studio/charcoal/split-hard-reflective.jpg",
    gradient: "charcoal",
    direction: "split",
    style: "hard",
    floor: "reflective",
  },
  {
    path: "/references/studio/charcoal/back-rim-cinematic-matte.jpg",
    gradient: "charcoal",
    direction: "back-rim",
    style: "cinematic",
    floor: "matte",
  },
  {
    path: "/references/studio/charcoal/left-hard-semi-gloss.jpg",
    gradient: "charcoal",
    direction: "left",
    style: "hard",
    floor: "semi-gloss",
  },
  {
    path: "/references/studio/warm-grey/front-soft-matte.jpg",
    gradient: "warm-grey",
    direction: "front",
    style: "soft",
    floor: "matte",
  },
  {
    path: "/references/studio/warm-grey/right-natural-semi-gloss.jpg",
    gradient: "warm-grey",
    direction: "right",
    style: "natural",
    floor: "semi-gloss",
  },
  {
    path: "/references/studio/warm-grey/overhead-soft-reflective.jpg",
    gradient: "warm-grey",
    direction: "overhead",
    style: "soft",
    floor: "reflective",
  },
  {
    path: "/references/studio/cool-grey/left-cinematic-reflective.jpg",
    gradient: "cool-grey",
    direction: "left",
    style: "cinematic",
    floor: "reflective",
  },
  {
    path: "/references/studio/cool-grey/overhead-soft-semi-gloss.jpg",
    gradient: "cool-grey",
    direction: "overhead",
    style: "soft",
    floor: "semi-gloss",
  },
  {
    path: "/references/studio/cool-grey/three-point-natural-matte.jpg",
    gradient: "cool-grey",
    direction: "three-point",
    style: "natural",
    floor: "matte",
  },
  {
    path: "/references/studio/accents/charcoal-audi-red-right.jpg",
    gradient: "charcoal",
    direction: "right",
    accent: "audi-red",
  },
  {
    path: "/references/studio/accents/dark-neutral-audi-red-left.jpg",
    gradient: "dark-neutral",
    direction: "left",
    accent: "audi-red",
  },
  {
    path: "/references/studio/accents/cool-grey-cool-blue-overhead.jpg",
    gradient: "cool-grey",
    direction: "overhead",
    accent: "cool-blue",
  },
  {
    path: "/references/studio/accents/warm-grey-warm-amber-right.jpg",
    gradient: "warm-grey",
    direction: "right",
    accent: "warm-amber",
  },
];

const GRADIENT_FAMILY_FALLBACK: Record<StudioGradientId, StudioReferenceDefinition["gradient"]> = {
  "dark-neutral": "dark-neutral",
  charcoal: "charcoal",
  "warm-grey": "warm-grey",
  "cool-grey": "cool-grey",
  midnight: "dark-neutral",
  concrete: "charcoal",
  "pure-black": "charcoal",
  "light-grey": "warm-grey",
};

const LIGHTING_DIRECTION_DESC: Record<StudioLightingDirectionId, string> = {
  left: "Key light from camera-left, shadows falling right",
  right: "Key light from camera-right, shadows falling left",
  overhead: "Overhead softbox, horizontal reflection strips",
  front: "Frontal fill, minimal shadows",
  "back-rim": "Backlit rim light, edge definition",
  split: "Split lighting, dramatic center shadow",
  "three-point": "Three-point: key left, fill right, rim behind",
};

const LIGHTING_STYLE_DESC: Record<StudioLightingStyleId, string> = {
  soft: "soft diffused quality, gentle transitions",
  hard: "hard directional, defined shadow edges",
  natural: "natural window-style, soft falloff",
  cinematic: "shaped cinematic light, controlled spill",
  flat: "flat even illumination",
};

const FLOOR_DESC: Record<StudioFloorTypeId, string> = {
  reflective: "highly reflective polished floor, mirror-like vehicle reflection",
  matte: "matte non-reflective floor",
  "semi-gloss": "semi-gloss subtle reflection, premium finish",
  infinite: "infinite seamless backdrop, no floor-wall edge",
  textured: "textured concrete floor, industrial",
};

const REFLECTION_DESC: Record<StudioFloorTypeId, string> = {
  reflective: "strong floor reflections",
  "semi-gloss": "subtle floor reflections",
  matte: "minimal reflections",
  infinite: "minimal reflections",
  textured: "minimal reflections",
};

const ACCENT_DESC: Record<Exclude<StudioAccentId, "none">, string> = {
  "audi-red": "Subtle #BB0A30 red accent wash from right, Audi RS signature",
  "warm-amber": "Warm #D4A574 amber accent glow, premium",
  "cool-blue": "Cool #4A90A4 blue-teal accent, tech atmosphere",
  "subtle-gold": "Subtle #C9A962 gold accent, luxury",
};

export function collectStudioParameters(
  selection: StudioParameterSelection,
): StudioParameterCollectorOutput {
  const gradient = STUDIO_GRADIENTS.find((item) => item.id === selection.gradient) ?? STUDIO_GRADIENTS[0];
  const accent = STUDIO_ACCENTS.find((item) => item.id === selection.accent) ?? STUDIO_ACCENTS[0];

  return {
    gradient: {
      id: gradient.id,
      name: gradient.name,
      top_hex: gradient.topHex,
      bottom_hex: gradient.bottomHex,
    },
    lighting: {
      direction: selection.lightingDirection,
      style: selection.lightingStyle,
    },
    floor: {
      type: selection.floorType,
    },
    accent: {
      id: accent.id,
      hex: accent.hex,
    },
  };
}

export function validateStudioSelection(input: Partial<StudioParameterSelection>): {
  isValid: boolean;
  errors: string[];
  normalized: StudioParameterSelection;
} {
  const normalized: StudioParameterSelection = {
    gradient: asGradient(input.gradient) ?? STUDIO_DEFAULTS.gradient,
    lightingDirection: asDirection(input.lightingDirection) ?? STUDIO_DEFAULTS.lightingDirection,
    lightingStyle: asStyle(input.lightingStyle) ?? STUDIO_DEFAULTS.lightingStyle,
    floorType: asFloor(input.floorType) ?? STUDIO_DEFAULTS.floorType,
    accent: asAccent(input.accent) ?? STUDIO_DEFAULTS.accent,
  };

  const errors: string[] = [];
  if (!asGradient(input.gradient)) errors.push("Gradient is not a valid option.");
  if (!asDirection(input.lightingDirection)) errors.push("Lighting direction is not a valid option.");
  if (!asStyle(input.lightingStyle)) errors.push("Lighting style is not a valid option.");
  if (!asFloor(input.floorType)) errors.push("Floor type is not a valid option.");
  if (!asAccent(input.accent)) errors.push("Accent color is not a valid option.");

  if (normalized.accent !== "none") {
    const accentHex = STUDIO_ACCENTS.find((item) => item.id === normalized.accent)?.hex;
    if (!accentHex) errors.push("Accent hex is required when accent is selected.");
  }

  const gradientPreset = STUDIO_GRADIENTS.find((item) => item.id === normalized.gradient);
  if (!gradientPreset || !isValidHex(gradientPreset.topHex) || !isValidHex(gradientPreset.bottomHex)) {
    errors.push("Gradient hex values are invalid.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalized,
  };
}

export function buildStudioPrompt(params: StudioParameterCollectorOutput): string {
  const accentLine =
    params.accent.id === "none"
      ? ""
      : `${ACCENT_DESC[params.accent.id as Exclude<StudioAccentId, "none">]}.`;
  const shadowZone =
    params.lighting.style === "hard" || params.lighting.direction === "split"
      ? "defined shadow zone"
      : "subtle contact shadow zone";

  return [
    `Empty automotive studio, seamless gradient from ${params.gradient.top_hex} at top to ${params.gradient.bottom_hex} at bottom.`,
    `Empty automotive photography studio, seamless ${params.gradient.name} gradient background, no visible floor-wall edge, infinite seamless backdrop.`,
    `${LIGHTING_DIRECTION_DESC[params.lighting.direction]}, ${LIGHTING_STYLE_DESC[params.lighting.style]}, horizontal reflection zone for vehicle.`,
    `${FLOOR_DESC[params.floor.type]}.`,
    accentLine,
    `Professional automotive studio, clear ground plane on left side for vehicle placement, ${shadowZone}, premium Audi aesthetic.`,
    `Ultra-photorealistic, perfectly smooth gradient, controlled studio lighting, ${REFLECTION_DESC[params.floor.type]}, no banding, no seams.`,
    "--no cars, vehicles, people, text, studio equipment visible, hard edges, gradient banding, noise, color shifts, uneven transitions, no bright studio, no white background, no light grey, no visible seams, no conference room, no generic photography studio, no white walls, no visible ceiling, no floor-wall seam",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildStudioSimplifiedPromptWithoutAccent(
  params: StudioParameterCollectorOutput,
): string {
  return buildStudioPrompt({
    ...params,
    accent: { id: "none", hex: null },
  });
}

export async function matchStudioReferences(
  params: StudioParameterCollectorOutput,
): Promise<{
  paths: string[];
  usedFallback: boolean;
  mismatchLog: string | null;
}> {
  const targetGradient = params.gradient.id;
  const targetDirection = params.lighting.direction;
  const targetStyle = params.lighting.style;
  const targetFloor = params.floor.type;
  const targetAccent = params.accent.id;

  const exactPool = STUDIO_REFERENCE_LIBRARY.filter(
    (entry) => entry.gradient === targetGradient || entry.gradient === GRADIENT_FAMILY_FALLBACK[targetGradient],
  );
  const usingFamilyFallback = !STUDIO_REFERENCE_LIBRARY.some((entry) => entry.gradient === targetGradient);
  const pool = exactPool.length ? exactPool : STUDIO_REFERENCE_LIBRARY;

  const scored = pool
    .map((entry) => {
      let score = 0;
      if (entry.gradient === targetGradient) score += 100;
      if (entry.gradient === GRADIENT_FAMILY_FALLBACK[targetGradient]) score += 40;
      if (entry.direction === targetDirection) score += 30;
      if (entry.style && entry.style === targetStyle) score += 20;
      if (entry.floor && entry.floor === targetFloor) score += 15;
      if (targetAccent !== "none" && entry.accent === targetAccent) score += 20;
      if (targetAccent === "none" && !entry.accent) score += 10;
      if (targetAccent !== "none" && !entry.accent) score -= 10;
      return { entry, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected = scored.slice(0, 2).map((item) => item.entry.path);

  return {
    paths: selected,
    usedFallback: usingFamilyFallback,
    mismatchLog: usingFamilyFallback
      ? `No exact gradient library for "${targetGradient}". Used "${GRADIENT_FAMILY_FALLBACK[targetGradient]}" family.`
      : null,
  };
}

function isValidHex(value: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(value);
}

function asGradient(input: unknown): StudioGradientId | null {
  if (typeof input !== "string") return null;
  return STUDIO_GRADIENTS.some((item) => item.id === input) ? (input as StudioGradientId) : null;
}

function asDirection(input: unknown): StudioLightingDirectionId | null {
  if (typeof input !== "string") return null;
  return STUDIO_LIGHTING_DIRECTIONS.some((item) => item.id === input)
    ? (input as StudioLightingDirectionId)
    : null;
}

function asStyle(input: unknown): StudioLightingStyleId | null {
  if (typeof input !== "string") return null;
  return STUDIO_LIGHTING_STYLES.some((item) => item.id === input)
    ? (input as StudioLightingStyleId)
    : null;
}

function asFloor(input: unknown): StudioFloorTypeId | null {
  if (typeof input !== "string") return null;
  return STUDIO_FLOOR_TYPES.some((item) => item.id === input) ? (input as StudioFloorTypeId) : null;
}

function asAccent(input: unknown): StudioAccentId | null {
  if (typeof input !== "string") return null;
  return STUDIO_ACCENTS.some((item) => item.id === input) ? (input as StudioAccentId) : null;
}
