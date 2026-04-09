import {
  ArtDirectorOutput,
  DriveSide,
  LocationScoutOutput,
  MarketProfile,
  PhotographerOutput,
} from "@/lib/types";

const BASE_NEGATIVES = [
  "people",
  "cities",
  "buildings",
  "power lines",
  "text",
  "logos",
  "CGI look",
  "overprocessed HDR",
  "cartoon",
  "illustration",
  "palm trees",
  "tropical plants",
];

export function getRequiredNegatives(driveSide: DriveSide): string[] {
  const oppositeDrive =
    driveSide === "RHD" ? "left-hand drive vehicles" : "right-hand drive vehicles";
  return [...BASE_NEGATIVES, oppositeDrive];
}

export function getFallbackArtDirector(driveSide: DriveSide): ArtDirectorOutput {
  return {
    compositionMode: "Dynamic Leading Lines",
    carPosition: "lower third, rule of thirds left",
    carSize: "Prominent",
    qualityNotes: [
      "Road leads the eye into frame.",
      "Landscape dominates upper frame with natural depth.",
      "Maintain authentic tonal contrast and realistic dynamic range.",
    ],
    negativePrompts: [...getRequiredNegatives(driveSide)],
  };
}

export function getFallbackLocationScout(
  marketProfile: MarketProfile,
): LocationScoutOutput {
  if (marketProfile === "EU") {
    return {
      locationName: "Dolomites Pass Road, Northern Italy",
      setting:
        "A dramatic alpine pass road with layered limestone peaks and distant ridgelines under open sky. The terrain feels premium, remote, and cinematic while remaining plausible for a European automotive shoot.",
      road: {
        width: "two-lane mountain pass",
        texture: "weathered dark tarmac with subtle aggregate detail",
        incline: "moderate climbing gradient",
        curves: "flowing S-curves with one tightening bend",
        condition: "dry-to-damp patches, realistic wear",
        markings: "clean European center and edge markings",
        barriers: "selective metal barriers on exposed edges",
        waterProximity: "distant alpine lake in valley",
      },
      vegetation: {
        density: "medium sparse",
        type: "alpine grasses, low shrubs, scattered conifers",
        waterFeatures: "small runoff channels near roadside",
      },
      atmosphere: {
        overall: "crisp and moody golden-hour transition",
        wind: "light crosswind moving grasses",
        clouds: "broken high cloud with clear sun gaps",
        visibility: "long-distance visibility with mild atmospheric haze",
        sunlight: "low-angle warm sidelight",
      },
      geology: "exposed limestone faces, fractured rock shelves, and scree",
      sunPosition:
        "sun slightly rear-side, creating controlled highlights on bodywork and long road shadows",
    };
  }

  if (marketProfile === "AG") {
    return {
      locationName: "Rugged Coastal Pass, Europe",
      setting:
        "A dramatic coastal highland road with layered ridges and open horizon under a textured sky. The terrain feels premium and global-brand cinematic while staying physically plausible.",
      road: {
        width: "single to two-lane scenic route",
        texture: "weathered dark tarmac with subtle aggregate detail",
        incline: "rolling elevation changes",
        curves: "long sweeping curves with one tighter apex",
        condition: "dry-to-damp patches, realistic wear",
        markings: "minimal, premium-looking road markings",
        barriers: "sparse barriers with clean visual rhythm",
        waterProximity: "coastal water body visible in middle distance",
      },
      vegetation: {
        density: "medium sparse",
        type: "windswept grassland, low shrubs, hardy ground cover",
        waterFeatures: "runoff channels and small reflective pools",
      },
      atmosphere: {
        overall: "dramatic and cinematic, post-rain clarity",
        wind: "light to moderate wind through roadside vegetation",
        clouds: "broken cloud with directional openings",
        visibility: "clear foreground with atmospheric depth in distance",
        sunlight: "controlled warm side-back light",
      },
      geology: "angular rocky outcrops, weathered cliff bands, natural erosion lines",
      sunPosition:
        "sun offset to rear-side, creating crisp contour highlights and believable long shadows",
    };
  }

  return {
    locationName: "Applecross Pass, Scottish Highlands",
    setting:
      "A dramatic Highland pass with layered ridgelines, glacial valleys, and open sky. The terrain feels remote, rugged, and naturally cinematic without urban intrusion.",
    road: {
      width: "single carriageway with passing places",
      texture: "weathered dark tarmac with subtle aggregate detail",
      incline: "moderate climbing gradient",
      curves: "flowing S-curves with one tight bend in distance",
      condition: "dry-to-damp patches, realistic wear",
      markings: "minimal UK edge and center markings",
      barriers: "sparse stone edges, no modern guardrail clutter",
      waterProximity: "distant loch visible in valley",
    },
    vegetation: {
      density: "medium sparse",
      type: "heather, coarse grass, low shrubs",
      waterFeatures: "small runoff channels near roadside",
    },
    atmosphere: {
      overall: "crisp and moody golden-hour transition",
      wind: "light crosswind moving grasses",
      clouds: "broken high cloud with clear sun gaps",
      visibility: "long-distance visibility with mild atmospheric haze",
      sunlight: "low-angle warm sidelight",
    },
    geology: "exposed rock faces and weathered granite outcrops",
    sunPosition:
      "sun slightly rear-side, creating controlled highlights on bodywork and long road shadows",
  };
}

export const FALLBACK_PHOTOGRAPHER: PhotographerOutput = {
  vehicleAngle: "rear three-quarter, low elevation, slight upward tilt",
  lens: "50mm standard lens",
  aperture: "f/5.6, moderate depth of field",
  iso: "ISO 100",
  shutterSpeed: "1/250s",
  cameraHeight: "ultra low, just above road surface",
  vehicleState: "driving slowly",
  cameraTracking: "static",
  framing: {
    size: "prominent in lower third",
    horizontal: "rule of thirds left",
    vertical: "lower third anchor",
  },
  windowStates: {
    driverFront: "closed",
    passengerFront: "closed",
    driverRear: "closed",
    passengerRear: "closed",
  },
  wheelAngle: "neutral to slight turn into road curve",
};
