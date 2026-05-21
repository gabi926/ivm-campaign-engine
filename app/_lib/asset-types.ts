// Shared types for the Asset Generation + Content Library feature.
// Mirrors blueprint-types.ts. All Higgsfield response shapes are defensive —
// every field is optional because their API may evolve and our null-handling
// must not break the build chain.

export const ASSET_TYPES = ["image", "video"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const GENERATION_MODES = [
  "text-to-image",
  "text-to-video",
  "image-to-video",
  "soul",
] as const;
export type GenerationMode = (typeof GENERATION_MODES)[number];

export const ASSET_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

// Full row shape matching generated_assets.
export interface GeneratedAsset {
  id: string;
  user_id: string;
  client_id: string | null;
  campaign_id: string | null;
  ad_block_index: number | null;
  asset_type: AssetType;
  generation_mode: GenerationMode;
  prompt: string;
  reference_image_ids: string[];
  higgsfield_generation_id: string | null;
  status: AssetStatus;
  storage_path: string | null;
  storage_url: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  cost_credits: number | null;
  metadata: AssetMetadata;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// Internal metadata shape we own. Higgsfield raw payloads live under `raw`;
// the text-to-video chain state lives in `stage` + the intermediate keys.
export interface AssetMetadata {
  stage?: "image" | "video"; // present only on text-to-video chained rows
  image_request_id?: string;
  video_request_id?: string;
  intermediate_image_url?: string; // signed URL of stage-1 image (debug only)
  intermediate_storage_path?: string;
  aspect_ratio?: string;
  resolution?: string;
  duration_seconds?: number;
  /** Which Higgsfield video model actually fired (after fallback walk). */
  video_model?: string;
  raw_submit?: unknown;
  raw_status?: unknown;
  [k: string]: unknown;
}

// List-view projection.
export interface AssetListItem {
  id: string;
  client_id: string | null;
  client_name: string | null;
  campaign_id: string | null;
  ad_block_index: number | null;
  asset_type: AssetType;
  generation_mode: GenerationMode;
  status: AssetStatus;
  storage_url: string | null;
  thumbnail_url: string | null;
  prompt: string;
  created_at: string;
  completed_at: string | null;
}

// POST /api/assets/generate body.
export interface GenerateAssetRequest {
  campaign_id: string;
  client_id?: string | null;
  ad_block_index?: number | null;
  asset_type: AssetType;
  generation_mode: GenerationMode;
  prompt: string;
  reference_image_ids?: string[];
  duration_seconds?: number;
  aspect_ratio?: string;
  resolution?: string;
}

// Higgsfield submit response. Defensive — both async (202 + status_url) and
// sync (200 with inlined url) shapes documented.
export interface HiggsfieldSubmitResponse {
  status?: string;
  request_id?: string;
  status_url?: string;
  cancel_url?: string;
  // sync-completed shapes some endpoints emit:
  image_url?: string;
  video_url?: string;
  images?: Array<{ url?: string }>;
  video?: { url?: string; poster_url?: string };
  error?: string;
  message?: string;
}

// Higgsfield status poll response.
export interface HiggsfieldStatusResponse {
  status?: string;
  request_id?: string;
  images?: Array<{ url?: string }>;
  video?: { url?: string; poster_url?: string };
  image_url?: string;
  video_url?: string;
  thumbnail_url?: string;
  error?: string;
  message?: string;
  cost_credits?: number;
}

// Normalized status returned by our helper (what API routes consume).
export interface NormalizedStatus {
  status: AssetStatus;
  result_url: string | null;
  thumbnail_url: string | null;
  error_message: string | null;
  cost_credits: number | null;
  raw: HiggsfieldStatusResponse;
}

// What pollGenerationStatus returns on submit-shape responses too.
export interface NormalizedSubmit {
  request_id: string;
  status: AssetStatus;
  raw: HiggsfieldSubmitResponse;
}

// Ad block shape — legacy interface from Chunk B Lite's GenerateAssetsButton
// (now deleted). Kept exported so external callers don't break, but the
// inline-generate flow in v1.1 sources prompts directly from
// image_concepts[].ai_prompt / video_concepts_short[].prompt.
export interface AdBlockLike {
  headline?: string | null;
  primary_text?: string | null;
  body?: string | null;
  angle?: string | null;
  visual_direction?: string | null;
  cta?: string | null;
}
