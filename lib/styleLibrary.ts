import { promises as fs } from "node:fs";
import path from "node:path";

import { InputInterpretation, ReferenceImageInput } from "@/lib/types";

const STYLE_REFERENCE_INDEX = {
  urban: {
    "london-brutalist": [
      "/references/urban/london-brutalist/coal-drops-dusk.jpg",
      "/references/urban/london-brutalist/barbican-evening.jpg",
      "/references/urban/london-brutalist/south-bank-overcast.jpg",
    ],
    "london-georgian": [
      "/references/urban/london-georgian/mayfair-golden-hour.jpg",
      "/references/urban/london-georgian/belgravia-street.jpg",
      "/references/urban/london-georgian/chelsea-soft-overcast.jpg",
    ],
    "manchester-industrial": [
      "/references/urban/manchester-industrial/canal-street-blue-hour.jpg",
      "/references/urban/manchester-industrial/salford-brick-lanes.jpg",
    ],
    "edinburgh-stone": [
      "/references/urban/edinburgh-stone/new-town-stone-frontages.jpg",
      "/references/urban/edinburgh-stone/old-town-rain-sheen.jpg",
    ],
  },
  coastal: {
    cornwall: [
      "/references/coastal/cornwall/grey-atlantic-cove.jpg",
      "/references/coastal/cornwall/slate-cliffs-broken-cloud.jpg",
    ],
    dorset: [
      "/references/coastal/dorset/jurassic-coast-overcast.jpg",
      "/references/coastal/dorset/chalk-headland-cold-light.jpg",
    ],
    scotland: [
      "/references/coastal/scotland/highlands-coast-storm-light.jpg",
      "/references/coastal/scotland/slate-bays-dramatic-cloud.jpg",
    ],
  },
  rural: {
    cotswolds: [
      "/references/rural/cotswolds/honey-limestone-lane.jpg",
      "/references/rural/cotswolds/hedgerow-road-soft-light.jpg",
    ],
    "peak-district": [
      "/references/rural/peak-district/gritstone-moorland-road.jpg",
      "/references/rural/peak-district/dry-stone-wall-lane.jpg",
    ],
    "lake-district": [
      "/references/rural/lake-district/fells-overcast-road.jpg",
      "/references/rural/lake-district/wet-tarmac-valley.jpg",
    ],
  },
  roads: {
    "a-road-rural": [
      "/references/roads/a-road-rural/a-road-damp-surface.jpg",
      "/references/roads/a-road-rural/a-road-soft-cloud.jpg",
    ],
    "single-track-highland": [
      "/references/roads/single-track-highland/passing-place-wet.jpg",
      "/references/roads/single-track-highland/heather-verge-road.jpg",
    ],
    "country-lane-cotswolds": [
      "/references/roads/country-lane-cotswolds/limestone-lane.jpg",
      "/references/roads/country-lane-cotswolds/grass-centre-strip.jpg",
    ],
  },
  studio: {
    "gradient-dark": [
      "/references/studio/gradient-dark/audi-dark-gradient-01.jpg",
      "/references/studio/gradient-dark/audi-dark-gradient-02.jpg",
    ],
    "audi-signature-red": [
      "/references/studio/audi-signature-red/audi-red-accent-01.jpg",
      "/references/studio/audi-signature-red/audi-red-accent-02.jpg",
    ],
  },
} as const;

const REGION_TO_BUCKET: Array<{ test: RegExp; bucket: string; category: keyof typeof STYLE_REFERENCE_INDEX }> = [
  { test: /london/i, bucket: "london-brutalist", category: "urban" },
  { test: /manchester/i, bucket: "manchester-industrial", category: "urban" },
  { test: /edinburgh/i, bucket: "edinburgh-stone", category: "urban" },
  {
    test: /scottish highlands|highlands|applecross|quiraing|isle of skye|skye/i,
    bucket: "single-track-highland",
    category: "roads",
  },
  { test: /cornwall/i, bucket: "cornwall", category: "coastal" },
  { test: /scotland/i, bucket: "scotland", category: "coastal" },
  { test: /wales|dorset|devon|yorkshire/i, bucket: "dorset", category: "coastal" },
  { test: /cotswolds/i, bucket: "cotswolds", category: "rural" },
  { test: /peak district/i, bucket: "peak-district", category: "rural" },
  { test: /lake district/i, bucket: "lake-district", category: "rural" },
];

export function getLibraryReferenceCandidates(
  scene: InputInterpretation,
): string[] {
  const region = `${scene.location.uk_region} ${scene.location.specific}`.toLowerCase();
  const type = scene.location.type.toLowerCase();

  const directMatch = REGION_TO_BUCKET.find((entry) => entry.test.test(region));
  if (directMatch) {
    const refs =
      STYLE_REFERENCE_INDEX[directMatch.category][
        directMatch.bucket as keyof (typeof STYLE_REFERENCE_INDEX)[typeof directMatch.category]
      ] ?? [];
    return [...refs].slice(0, 3);
  }

  if (type.includes("coast")) return [...STYLE_REFERENCE_INDEX.coastal.cornwall].slice(0, 3);
  if (type.includes("urban")) return [...STYLE_REFERENCE_INDEX.urban["london-brutalist"]].slice(0, 3);
  if (type.includes("rural")) return [...STYLE_REFERENCE_INDEX.rural.cotswolds].slice(0, 3);
  if (type.includes("road")) return [...STYLE_REFERENCE_INDEX.roads["a-road-rural"]].slice(0, 3);

  return [...STYLE_REFERENCE_INDEX.urban["london-brutalist"]].slice(0, 3);
}

export async function loadReferenceImagesFromPaths(
  refs: string[],
): Promise<ReferenceImageInput[]> {
  const results: ReferenceImageInput[] = [];
  for (const ref of refs.slice(0, 3)) {
    const absolutePath = path.join(process.cwd(), ref.replace(/^\//, ""));
    try {
      await fs.access(absolutePath);
      const content = await fs.readFile(absolutePath);
      const mimeType = guessMimeType(absolutePath);
      results.push({ data: content.toString("base64"), mimeType });
    } catch {
      // Ignore missing files so the pipeline can continue.
    }
  }
  return results;
}

function guessMimeType(filePath: string): "image/jpeg" | "image/png" | "image/webp" {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}
