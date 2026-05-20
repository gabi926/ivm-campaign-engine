import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetStatus,
  HiggsfieldStatusResponse,
  HiggsfieldSubmitResponse,
  NormalizedStatus,
  NormalizedSubmit,
} from "@/app/_lib/asset-types";

// ============================================================================
// Higgsfield REST client.
//
// Endpoint:    https://platform.higgsfield.ai
// Auth:        Authorization: Key {HIGGSFIELD_API_KEY}:{HIGGSFIELD_SECRET}
//              Fallback (if secret env empty): Key {HIGGSFIELD_API_KEY}
//              — emits a warning since most accounts require both halves.
// Async:       Submit returns { request_id, status_url } (202). Poll
//              GET /requests/{request_id}/status until terminal.
// Status pool: queued | in_progress | completed | failed | nsfw
//              nsfw → mapped to AssetStatus 'failed' with moderation message.
// Defensive:   submit/poll bodies vary across model endpoints — every field is
//              treated as optional and we fall back through multiple shapes.
//
// Model defaults (no user-facing picker, per spec):
//   image / text-to-image      → higgsfield-ai/soul/standard
//   image / soul               → higgsfield-ai/soul/standard (+ image_url)
//   video / image-to-video     → higgsfield-ai/dop/standard (needs image_url)
//   video / text-to-video      → INTERNAL two-stage chain in /status route:
//                                stage 1: soul/standard (image)
//                                stage 2: dop/standard (i2v on that image)
//                                Single asset row; stage tracked in metadata.
// ============================================================================

export const HIGGSFIELD_API_BASE = "https://platform.higgsfield.ai";

export const HIGGSFIELD_MODELS = Object.freeze({
  image: "higgsfield-ai/soul/standard",
  soul: "higgsfield-ai/soul/standard",
  "image-to-video": "higgsfield-ai/dop/standard",
  // text-to-video is a stage-chain; the status route swaps from soul→dop.
  "text-to-video-stage-1": "higgsfield-ai/soul/standard",
  "text-to-video-stage-2": "higgsfield-ai/dop/standard",
} as const);

const TIMEOUT_SUBMIT_MS = 60_000;
const TIMEOUT_POLL_MS = 30_000;
const TIMEOUT_DOWNLOAD_MS = 120_000;

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SIGNED_URL_REFRESH_THRESHOLD_DAYS = 6;

// ============================================================================
// Auth + low-level fetch helpers
// ============================================================================
function authHeader(): string {
  const key = process.env.HIGGSFIELD_API_KEY;
  if (!key) {
    throw new HiggsfieldError(
      "HIGGSFIELD_API_KEY is not configured.",
      "config_missing",
    );
  }
  const secret = process.env.HIGGSFIELD_SECRET;
  if (!secret) {
    console.warn(
      "[higgsfield] HIGGSFIELD_SECRET is empty; sending Key {key} only. " +
        "Higgsfield documents `Key {key}:{secret}` — expect 401 if your " +
        "account requires both halves.",
    );
    return `Key ${key}`;
  }
  return `Key ${key}:${secret}`;
}

export class HiggsfieldError extends Error {
  code: string;
  status?: number;
  retryAfter?: number;
  constructor(
    message: string,
    code: string,
    status?: number,
    retryAfter?: number,
  ) {
    super(message);
    this.name = "HiggsfieldError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function higgsfieldFetch(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : `${HIGGSFIELD_API_BASE}${path.startsWith("/") ? path : "/" + path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new HiggsfieldError(
        "Higgsfield auth failed — check HIGGSFIELD_API_KEY and HIGGSFIELD_SECRET.",
        "auth_failed",
        res.status,
      );
    }
    if (res.status === 404) {
      throw new HiggsfieldError(
        `Higgsfield resource not found: ${path}`,
        "not_found",
        404,
      );
    }
    if (res.status === 429) {
      const retryAfterRaw = res.headers.get("retry-after");
      const retryAfter = retryAfterRaw ? Number(retryAfterRaw) : undefined;
      throw new HiggsfieldError(
        "Higgsfield rate-limited (429).",
        "rate_limited",
        429,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }
    if (res.status >= 500) {
      throw new HiggsfieldError(
        `Higgsfield server error (${res.status}).`,
        "server_error",
        res.status,
      );
    }
    return res;
  } catch (err) {
    if (err instanceof HiggsfieldError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new HiggsfieldError(
        `Higgsfield request timed out after ${timeoutMs}ms`,
        "timeout",
      );
    }
    throw new HiggsfieldError(
      err instanceof Error ? err.message : "Unknown Higgsfield error",
      "unknown",
    );
  } finally {
    clearTimeout(timer);
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HiggsfieldError(
      `Higgsfield returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`,
      "bad_response",
      res.status,
    );
  }
}

// ============================================================================
// Submit helpers (defensive shape normalization)
// ============================================================================
export interface ImageSubmitParams {
  prompt: string;
  aspect_ratio?: string;
  resolution?: string;
  image_url?: string; // soul mode reference
}

export interface VideoSubmitParams {
  image_url: string; // required for dop/standard image-to-video
  prompt: string;
  duration?: number;
}

export async function submitImageGeneration(
  params: ImageSubmitParams,
): Promise<NormalizedSubmit> {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
  };
  if (params.aspect_ratio) body.aspect_ratio = params.aspect_ratio;
  if (params.resolution) body.resolution = params.resolution;
  if (params.image_url) body.image_url = params.image_url;

  const res = await higgsfieldFetch(
    `/${HIGGSFIELD_MODELS.image}`,
    { method: "POST", body: JSON.stringify(body) },
    TIMEOUT_SUBMIT_MS,
  );
  const json = await parseJson<HiggsfieldSubmitResponse>(res);
  return normalizeSubmit(json);
}

export async function submitVideoGeneration(
  params: VideoSubmitParams,
): Promise<NormalizedSubmit> {
  const body: Record<string, unknown> = {
    image_url: params.image_url,
    prompt: params.prompt,
  };
  if (typeof params.duration === "number") body.duration = params.duration;

  const res = await higgsfieldFetch(
    `/${HIGGSFIELD_MODELS["image-to-video"]}`,
    { method: "POST", body: JSON.stringify(body) },
    TIMEOUT_SUBMIT_MS,
  );
  const json = await parseJson<HiggsfieldSubmitResponse>(res);
  return normalizeSubmit(json);
}

function normalizeSubmit(json: HiggsfieldSubmitResponse): NormalizedSubmit {
  const request_id =
    typeof json.request_id === "string" && json.request_id.length > 0
      ? json.request_id
      : "";
  if (!request_id) {
    throw new HiggsfieldError(
      `Higgsfield submit response missing request_id: ${JSON.stringify(json).slice(0, 300)}`,
      "bad_response",
    );
  }
  return {
    request_id,
    status: mapHiggsfieldStatus(json.status),
    raw: json,
  };
}

// ============================================================================
// Status poll
// ============================================================================
export async function pollGenerationStatus(
  requestId: string,
): Promise<NormalizedStatus> {
  const res = await higgsfieldFetch(
    `/requests/${encodeURIComponent(requestId)}/status`,
    { method: "GET" },
    TIMEOUT_POLL_MS,
  );
  const json = await parseJson<HiggsfieldStatusResponse>(res);
  return normalizeStatus(json);
}

function normalizeStatus(json: HiggsfieldStatusResponse): NormalizedStatus {
  const status = mapHiggsfieldStatus(json.status);

  // Defensive result extraction — handle both async ({images:[{url}],video:{url}})
  // and sync ({image_url, video_url}) shapes.
  let result_url: string | null = null;
  let thumbnail_url: string | null = null;

  if (status === "completed") {
    if (Array.isArray(json.images) && json.images[0]?.url) {
      result_url = json.images[0].url ?? null;
    } else if (typeof json.image_url === "string") {
      result_url = json.image_url;
    } else if (json.video?.url) {
      result_url = json.video.url ?? null;
      thumbnail_url = json.video?.poster_url ?? json.thumbnail_url ?? null;
    } else if (typeof json.video_url === "string") {
      result_url = json.video_url;
      thumbnail_url = json.thumbnail_url ?? null;
    }
  }

  let error_message: string | null = null;
  if (status === "failed") {
    if (json.status === "nsfw") {
      error_message =
        json.message ??
        json.error ??
        "Content failed moderation (credits refunded).";
    } else {
      error_message =
        json.error ?? json.message ?? "Higgsfield generation failed.";
    }
  }

  return {
    status,
    result_url,
    thumbnail_url,
    error_message,
    cost_credits:
      typeof json.cost_credits === "number" ? json.cost_credits : null,
    raw: json,
  };
}

function mapHiggsfieldStatus(s: string | undefined): AssetStatus {
  switch (s) {
    case "completed":
      return "completed";
    case "failed":
    case "nsfw":
    case "cancelled":
    case "canceled":
      return "failed";
    case "queued":
    case "in_progress":
    case "processing":
      return "processing";
    default:
      // If Higgsfield omits status (some sync responses do), treat as processing
      // and let the poll loop re-check.
      return "processing";
  }
}

// ============================================================================
// Download + upload to Supabase Storage
// ============================================================================
const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

function extFromContentType(ct: string | null, fallback: string): string {
  if (!ct) return fallback;
  const norm = ct.split(";")[0].trim().toLowerCase();
  return EXT_BY_CONTENT_TYPE[norm] ?? fallback;
}

function extFromUrl(url: string, fallback: string): string {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.([a-z0-9]+)$/i);
    if (m && m[1]) return m[1].toLowerCase();
  } catch {
    // ignore
  }
  return fallback;
}

export interface DownloadStoreResult {
  storage_path: string;
  storage_url: string;
  content_type: string;
}

/**
 * Download the Higgsfield CDN URL, upload to the private `generated-assets`
 * bucket at the given path, and return a 7-day signed URL.
 *
 * `pathPrefix` is everything before the extension (we append the ext detected
 * from response Content-Type, falling back to the URL extension).
 */
export async function downloadAndStore(
  sourceUrl: string,
  pathPrefix: string,
  fallbackExt: string,
  supabase: SupabaseClient,
): Promise<DownloadStoreResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_DOWNLOAD_MS);

  let buffer: ArrayBuffer;
  let contentType: string;
  try {
    const res = await fetch(sourceUrl, { signal: controller.signal });
    if (!res.ok) {
      throw new HiggsfieldError(
        `Failed to download generated asset (${res.status}) from ${sourceUrl}`,
        "download_failed",
        res.status,
      );
    }
    buffer = await res.arrayBuffer();
    contentType =
      res.headers.get("content-type") ??
      (fallbackExt === "mp4" ? "video/mp4" : "image/png");
  } catch (err) {
    if (err instanceof HiggsfieldError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new HiggsfieldError(
        "Download from Higgsfield CDN timed out",
        "download_timeout",
      );
    }
    throw new HiggsfieldError(
      err instanceof Error ? err.message : "Download failed",
      "download_failed",
    );
  } finally {
    clearTimeout(timer);
  }

  const ext = extFromContentType(contentType, extFromUrl(sourceUrl, fallbackExt));
  const storage_path = `${pathPrefix}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("generated-assets")
    .upload(storage_path, new Uint8Array(buffer), {
      contentType,
      upsert: false,
    });
  if (uploadErr) {
    throw new HiggsfieldError(
      `Supabase Storage upload failed: ${uploadErr.message}`,
      "storage_upload_failed",
    );
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from("generated-assets")
    .createSignedUrl(storage_path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) {
    throw new HiggsfieldError(
      `Supabase Storage signed URL failed: ${signErr?.message ?? "unknown"}`,
      "storage_sign_failed",
    );
  }

  return {
    storage_path,
    storage_url: signed.signedUrl,
    content_type: contentType,
  };
}

/**
 * Generate a fresh 7-day signed URL for an existing storage_path.
 * Returns null on failure rather than throwing — caller can fall back to the
 * stale URL.
 */
export async function refreshSignedUrl(
  storagePath: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("generated-assets")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.warn("[higgsfield] refreshSignedUrl failed:", error?.message);
    return null;
  }
  return data.signedUrl;
}

/**
 * True if a row's storage_url is older than ~6 days (i.e. about to expire).
 */
export function shouldRefreshSignedUrl(
  completedAt: string | null,
  storagePath: string | null,
  storageUrl: string | null,
): boolean {
  if (!storagePath || !storageUrl) return false;
  if (!completedAt) return false;
  const ageMs = Date.now() - new Date(completedAt).getTime();
  const thresholdMs = SIGNED_URL_REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  return ageMs > thresholdMs;
}

/**
 * Build the canonical storage path prefix for a generated asset.
 * Convention: {user_id}/{client_id||'unattached'}/{campaign_id||'no-campaign'}/{request_id}
 */
export function buildStoragePathPrefix(args: {
  userId: string;
  clientId: string | null;
  campaignId: string | null;
  requestId: string;
}): string {
  return [
    args.userId,
    args.clientId ?? "unattached",
    args.campaignId ?? "no-campaign",
    args.requestId,
  ].join("/");
}
