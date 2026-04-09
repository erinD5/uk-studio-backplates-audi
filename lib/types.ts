export type CompositionMode =
  | "Supportive Harmony"
  | "Contrasting Dynamics"
  | "Natural Framing"
  | "Echoing Shapes"
  | "Breaking Tension"
  | "Dynamic Leading Lines";

export type CarSize = "Dominant" | "Prominent" | "Balanced" | "Distant";

export type VehicleState =
  | "standing still"
  | "driving slowly"
  | "driving at moderate speed"
  | "driving at speed";

export type CameraTracking = "static" | "tracking";

export type AgentRunStatus = "idle" | "running" | "done" | "error";
export type MarketProfile = "UK" | "EU" | "AG";
export type DriveSide = "RHD" | "LHD";
export type ArtDirectionPreset =
  | "VEITH_SIGNATURE"
  | "CINEMATIC_MOODY"
  | "GOLDEN_HOUR_NATURAL"
  | "STORM_CONTRAST"
  | "MINIMAL_PRODUCT";
export type ReferenceSceneCategory =
  | "CITY_STREET"
  | "COASTAL_ROAD"
  | "HIGHLAND_ROAD"
  | "COUNTRY_ROAD"
  | "MIXED"
  | "UNKNOWN";

export interface PipelineOptions {
  marketProfile: MarketProfile;
  driveSide: DriveSide;
  artDirectionPreset: ArtDirectionPreset;
}

export interface ReferenceImageInput {
  data: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface ArtDirectorOutput {
  compositionMode: CompositionMode;
  carPosition: string;
  carSize: CarSize;
  qualityNotes: string[];
  negativePrompts: string[];
}

export interface LocationRoadOutput {
  width: string;
  texture: string;
  incline: string;
  curves: string;
  condition: string;
  markings: string;
  barriers: string;
  waterProximity: string;
}

export interface LocationVegetationOutput {
  density: string;
  type: string;
  waterFeatures: string;
}

export interface LocationAtmosphereOutput {
  overall: string;
  wind: string;
  clouds: string;
  visibility: string;
  sunlight: string;
}

export interface LocationScoutOutput {
  locationName: string;
  setting: string;
  road: LocationRoadOutput;
  vegetation: LocationVegetationOutput;
  atmosphere: LocationAtmosphereOutput;
  geology: string;
  sunPosition: string;
}

export interface PhotographerFramingOutput {
  size: string;
  horizontal: string;
  vertical: string;
}

export interface PhotographerWindowStatesOutput {
  driverFront: string;
  passengerFront: string;
  driverRear: string;
  passengerRear: string;
}

export interface PhotographerOutput {
  vehicleAngle: string;
  lens: string;
  aperture: string;
  iso: string;
  shutterSpeed: string;
  cameraHeight: string;
  vehicleState: VehicleState;
  cameraTracking: CameraTracking;
  framing: PhotographerFramingOutput;
  windowStates: PhotographerWindowStatesOutput;
  wheelAngle: string;
}

export interface AgentsApiResponse {
  artDirector: Record<string, unknown>;
  locationScout: Record<string, unknown>;
  photographer: Record<string, unknown>;
  instruction: string;
  agentStatus: {
    artDirector: AgentRunStatus;
    locationScout: AgentRunStatus;
    photographer: AgentRunStatus;
  };
  errors?: string[];
}

export interface UKLocalizerAgentsResponse {
  carAngle: CarAngleAnalysis;
  inputInterpretation: InputInterpretation;
  effectiveReferenceImages: ReferenceImageInput[];
  referenceSource: "user-moodboard" | "hidden-library" | "none";
  instruction: string;
  agentStatus: {
    carAngleAnalyzer: AgentRunStatus;
    inputInterpreter: AgentRunStatus;
    referenceMatcher: AgentRunStatus;
    promptGenerator: AgentRunStatus;
  };
  errors?: string[];
}

export type BackplateInputMode = "MOODBOARD" | "WRITTEN_BRIEF" | "OWNED_IMAGE";
export type StyleMode = "EDITORIAL" | "BRAND";
export type VehicleMotionIntent = "AUTO" | "DRIVING" | "PARKED";
export type OutputMode = "WITH_CAR" | "BACKPLATE_ONLY";

export interface CarAngleAnalysis {
  angle: {
    view: string;
    rotation_degrees: string;
  };
  camera: {
    height: string;
    height_meters: string;
    tilt: string;
    focal_length_mm: string;
    aperture_estimate: string;
  };
  composition: {
    vehicle_position: string;
    frame_coverage: string;
    horizon_line: string;
    ground_plane_visible: string;
  };
  perspective: {
    vanishing_point: string;
    distortion: string;
    depth_cue: string;
  };
}

export interface InputInterpretation {
  location: {
    type: string;
    specific: string;
    uk_region: string;
    architecture: string;
    uk_elements: string;
  };
  lighting: {
    time: string;
    quality: string;
    direction: string;
    temperature: string;
  };
  weather: {
    condition: string;
    ground: string;
  };
  atmosphere: {
    mood: string;
    season: string;
  };
  ground_plane: {
    surface: string;
    condition: string;
  };
}
