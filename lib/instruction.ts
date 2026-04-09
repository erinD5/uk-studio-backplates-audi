import { getRequiredNegatives } from "@/lib/fallbacks";
import {
  ArtDirectorOutput,
  DriveSide,
  LocationScoutOutput,
  PhotographerOutput,
  ReferenceSceneCategory,
} from "@/lib/types";

export function assembleInstruction(
  artDirector: ArtDirectorOutput,
  locationScout: LocationScoutOutput,
  photographer: PhotographerOutput,
  driveSide: DriveSide,
  hasReferenceImages: boolean,
  referenceSceneCategory: ReferenceSceneCategory,
): string {
  const negativePrompts = mergeRequiredNegatives(
    artDirector.negativePrompts,
    driveSide,
  );

  return [
    "Edit this image: replace ONLY the background environment behind the car. Keep the car exactly as-is - same angle, same perspective, same position in frame, same lighting on the car body, same reflections. Do not modify the vehicle in any way.",
    "",
    `LOCATION: ${locationScout.locationName}.`,
    `SETTING: ${locationScout.setting}`,
    `ROAD: width ${locationScout.road.width}; texture ${locationScout.road.texture}; incline ${locationScout.road.incline}; curves ${locationScout.road.curves}; condition ${locationScout.road.condition}; markings ${locationScout.road.markings}; barriers ${locationScout.road.barriers}; water proximity ${locationScout.road.waterProximity}.`,
    `VEGETATION: density ${locationScout.vegetation.density}; type ${locationScout.vegetation.type}; water features ${locationScout.vegetation.waterFeatures}.`,
    `ATMOSPHERE: overall ${locationScout.atmosphere.overall}; wind ${locationScout.atmosphere.wind}; clouds ${locationScout.atmosphere.clouds}; visibility ${locationScout.atmosphere.visibility}; sunlight ${locationScout.atmosphere.sunlight}.`,
    `GEOLOGY: ${locationScout.geology}.`,
    `SUN POSITION: ${locationScout.sunPosition}.`,
    "",
    `CAMERA MATCH: ${photographer.lens}, ${photographer.aperture}, camera height ${photographer.cameraHeight}.`,
    `COMPOSITION: ${artDirector.compositionMode} - road as leading line, ${artDirector.carPosition}, landscape dominates upper frame.`,
    "STYLE: Ultra-photorealistic, hyper-detailed textures, natural colour palette, no oversaturation, genuine HDR without CGI feel, authentic scale and perspective. Polarisation filter effect on wet surfaces and car paint.",
    ...(artDirector.qualityNotes.length
      ? [`ART DIRECTION NOTES: ${artDirector.qualityNotes.join(" | ")}.`]
      : []),
    ...(hasReferenceImages
      ? [
          `REFERENCE LOCK: Selected reference images define the final art direction. Locked scene category: ${referenceSceneCategory}. Match their environment category, road style, weather mood, color palette, and composition language. If text conflicts with references, references take priority.`,
        ]
      : []),
    `DO NOT include: ${negativePrompts.join(", ")}. Critical: do not alter the car.`,
  ].join("\n");
}

function mergeRequiredNegatives(
  negatives: string[],
  driveSide: DriveSide,
): string[] {
  const seen = new Map<string, string>();
  [...negatives, ...getRequiredNegatives(driveSide)].forEach((item) => {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.set(normalized, item.trim());
  });

  return Array.from(seen.values());
}
