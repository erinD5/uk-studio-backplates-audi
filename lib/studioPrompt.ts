export interface StudioParams {
  gradient: {
    id: string;
    name: string;
    topHex: string;
    bottomHex: string;
  };
  lighting: {
    direction: "left" | "right" | "overhead" | "front" | "rim" | "split" | "three-point";
    style: "soft" | "hard";
  };
  floor: "reflective" | "matte" | "semi-gloss" | "infinite" | "textured";
  accent: {
    colors: string;
  };
}

export const GRADIENTS = [
  { id: "gradient-4d5766-404a59", name: "Gradient #4D5766 to #404A59", topHex: "#4D5766", bottomHex: "#404A59" },
  { id: "dark-blue-2c343f-232a34", name: "Dark Blue #2C343F to #232A34", topHex: "#2C343F", bottomHex: "#232A34" },
  {
    id: "solid-c1c2ba",
    name: "Solid #C1C2BA",
    topHex: "#C1C2BA",
    bottomHex: "#C1C2BA",
  },
  {
    id: "solid-101319",
    name: "Solid #101319",
    topHex: "#101319",
    bottomHex: "#101319",
  },
] as const;

export function assembleStudioPrompt(params: StudioParams): string {
  const { gradient, lighting, accent } = params;

  const directionDesc: Record<StudioParams["lighting"]["direction"], string> = {
    left:
      "key light from camera-left only, left-side body panels read brighter, right-side panels fall into deeper shadow, and shadow falloff trends toward camera-right",
    right:
      "key light from camera-right only, right-side body panels read brighter, left-side panels fall into deeper shadow, and shadow falloff trends toward camera-left",
    overhead:
      "key light from directly overhead, strongest highlight runs along roof/upper shoulders with underbody and wheel-arch shadow density increased",
    front:
      "key light from camera-front, frontal fascia and bonnet highlights dominate while side-to-side contrast remains lower than side-lit setups",
    rim:
      "back/rim key from behind vehicle, bright edge contours on silhouette with comparatively darker center body mass",
    split:
      "split lighting with one side clearly brighter and the opposite side clearly darker, creating a pronounced left/right contrast divide",
    "three-point":
      "three-point setup with clear key/fill/rim separation, readable edge lift, and controlled directional modeling across major body surfaces",
  };

  const styleDesc: Record<StudioParams["lighting"]["style"], string> = {
    soft:
      "soft diffused key light with gentle highlight roll-off, broader and softer shadow transitions, lower contrast, and smoother tonal separation",
    hard:
      "very low-key hard lighting where studio illumination is almost off: drastically reduced fill/ambient, near-black shadow regions, hard-edged shadows, minimal narrow specular strips only, and extreme contrast separation",
  };

  const floorDesc = "infinite seamless backdrop with no visible floor-wall transition";

  const accentText = accent.colors.trim();
  const accentDesc = accentText
    ? `Accent lighting colors: ${accentText}. Keep accents subtle and atmospheric only; do not recolor the vehicle paint.`
    : "";

  const prompt = `Empty automotive photography studio, seamless gradient background from ${gradient.topHex} at top transitioning smoothly to ${gradient.bottomHex} at bottom, infinite seamless backdrop.

${directionDesc[lighting.direction]}, ${styleDesc[lighting.style]}.

${floorDesc}, seamless floor-to-wall transition, professional automotive studio surface.

${accentDesc}

Clear ground plane on left side of frame for vehicle placement, subtle contact shadow zone, premium Audi automotive studio aesthetic. Keep backdrop perfectly seamless and matte.

Ultra-photorealistic, perfectly smooth gradient with no banding, controlled professional studio lighting on vehicle only, 8K quality. Keep background luminance close to selected hex values; no heavy darkening, no black crush, and no vignette.`.trim();

  const negative = `--no cars, vehicles, people, text, visible studio equipment, tripods, light stands, bright white studio, generic photography studio, visible ceiling, floor-wall seam, gradient banding, noise, color fringing, conference room, office, bright background, visible light source, softbox panel, overhead light panel, hotspot, top glow patch, horizon line, hard lighting patch on backdrop, black vignette, dark corners, crushed blacks, heavy falloff`;

  return `${prompt}\n\n${negative}`;
}

export function isValidStudioParams(input: unknown): input is StudioParams {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<StudioParams>;
  if (!candidate.gradient || !candidate.lighting || !candidate.accent || !candidate.floor) return false;
  const hasHex = (value: unknown) => typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
  const hasAccentText =
    typeof candidate.accent.colors === "string" && candidate.accent.colors.trim().length <= 160;

  return (
    typeof candidate.gradient.id === "string" &&
    typeof candidate.gradient.name === "string" &&
    hasHex(candidate.gradient.topHex) &&
    hasHex(candidate.gradient.bottomHex) &&
    ["left", "right", "overhead", "front", "rim", "split", "three-point"].includes(
      candidate.lighting.direction as string,
    ) &&
    ["soft", "hard"].includes(candidate.lighting.style as string) &&
    ["reflective", "matte", "semi-gloss", "infinite", "textured"].includes(candidate.floor as string) &&
    hasAccentText
  );
}
