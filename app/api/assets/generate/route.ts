// POST /api/assets/generate — submit a Higgsfield image or video generation.
// Mirrors /api/landing-pages/generate auth + validation pattern.
//
// Flow:
//   1. Validate body (uuid, enums, prompt, mode/type combination)
//   2. RLS-scoped campaign ownership check
//   3. If reference_image_ids: fetch storage_path of first ref, sign URL
//   4. Insert row status='pending'
//   5. Call Higgsfield submit (or stage-1 of t2v chain)
//   6. Update row to status='processing' + higgsfield_generation_id + metadata
//   7. Return { success, asset_id, status, generation_id }
//
// On Higgsfield failure: update row to 'failed' with error_message, return 502.

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import {
  ASSET_TYPES,
  GENERATION_MODES,
  type AssetMetadata,
  type AssetType,
  type GenerateAssetRequest,
  type GenerationMode,
} from "@/app/_lib/asset-types";
import {
  HiggsfieldError,
  refreshSignedUrl,
  submitImageGeneration,
  submitVideoGeneration,
} from "@/app/_lib/higgsfield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mode/type compatibility matrix.
const VALID_COMBOS: Record<AssetType, GenerationMode[]> = {
  image: ["text-to-image", "soul"],
  video: ["text-to-video", "image-to-video"],
};

const DEFAULT_ASPECT_RATIO: Record<AssetType, string> = {
  image: "1:1",
  video: "16:9",
};

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | Partial<GenerateAssetRequest>
    | null;

  // -------------------- validation --------------------
  if (!body) {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  if (typeof body.campaign_id !== "string" || !UUID_RE.test(body.campaign_id)) {
    return NextResponse.json(
      { error: "campaign_id (uuid) is required" },
      { status: 400 },
    );
  }
  if (
    typeof body.asset_type !== "string" ||
    !ASSET_TYPES.includes(body.asset_type as AssetType)
  ) {
    return NextResponse.json(
      { error: `asset_type must be one of: ${ASSET_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  if (
    typeof body.generation_mode !== "string" ||
    !GENERATION_MODES.includes(body.generation_mode as GenerationMode)
  ) {
    return NextResponse.json(
      {
        error: `generation_mode must be one of: ${GENERATION_MODES.join(", ")}`,
      },
      { status: 400 },
    );
  }
  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "prompt must be a non-empty string" },
      { status: 400 },
    );
  }

  const assetType = body.asset_type as AssetType;
  const mode = body.generation_mode as GenerationMode;
  if (!VALID_COMBOS[assetType].includes(mode)) {
    return NextResponse.json(
      {
        error: `generation_mode '${mode}' is not valid for asset_type '${assetType}'. Allowed: ${VALID_COMBOS[assetType].join(", ")}`,
      },
      { status: 400 },
    );
  }

  const refIds = Array.isArray(body.reference_image_ids)
    ? body.reference_image_ids.filter(
        (v): v is string => typeof v === "string" && UUID_RE.test(v),
      )
    : [];

  // image-to-video requires a reference image.
  if (mode === "image-to-video" && refIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "image-to-video requires at least one reference_image_ids entry",
      },
      { status: 400 },
    );
  }

  const clientId =
    typeof body.client_id === "string" && UUID_RE.test(body.client_id)
      ? body.client_id
      : null;

  const adBlockIndex =
    typeof body.ad_block_index === "number" &&
    Number.isFinite(body.ad_block_index)
      ? Math.floor(body.ad_block_index)
      : null;

  const aspectRatio =
    typeof body.aspect_ratio === "string" && body.aspect_ratio.length > 0
      ? body.aspect_ratio
      : DEFAULT_ASPECT_RATIO[assetType];

  const resolution =
    typeof body.resolution === "string" && body.resolution.length > 0
      ? body.resolution
      : "720p";

  const duration =
    typeof body.duration_seconds === "number" &&
    Number.isFinite(body.duration_seconds) &&
    body.duration_seconds > 0
      ? Math.min(Math.floor(body.duration_seconds), 30)
      : 5;

  const supabase = await createClient();

  // -------------------- ownership check (RLS) --------------------
  const { data: campaignRow, error: campErr } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", body.campaign_id)
    .maybeSingle();
  if (campErr) {
    console.warn("[assets/generate] campaigns select failed:", campErr);
    return NextResponse.json({ error: campErr.message }, { status: 500 });
  }
  if (!campaignRow) {
    return NextResponse.json(
      { error: "Source campaign not found" },
      { status: 404 },
    );
  }

  // -------------------- resolve reference image (first only) --------------------
  let referenceImageUrl: string | null = null;
  if (refIds.length > 0) {
    const firstRefId = refIds[0];
    const { data: refRow, error: refErr } = await supabase
      .from("generated_assets")
      .select("id, storage_path, storage_url")
      .eq("id", firstRefId)
      .maybeSingle();
    if (refErr) {
      console.warn("[assets/generate] reference select failed:", refErr);
      return NextResponse.json({ error: refErr.message }, { status: 500 });
    }
    if (!refRow || !refRow.storage_path) {
      return NextResponse.json(
        { error: "Reference image not found or not yet stored" },
        { status: 404 },
      );
    }
    // Always re-sign — cheaper than checking age and we have the path anyway.
    const fresh = await refreshSignedUrl(refRow.storage_path, supabase);
    referenceImageUrl = fresh ?? refRow.storage_url;
    if (!referenceImageUrl) {
      return NextResponse.json(
        { error: "Failed to sign reference image URL" },
        { status: 500 },
      );
    }
  }

  if ((mode === "soul" || mode === "image-to-video") && !referenceImageUrl) {
    return NextResponse.json(
      { error: `${mode} requires a usable reference image` },
      { status: 400 },
    );
  }

  // -------------------- insert pending row --------------------
  const initialMetadata: AssetMetadata = {
    aspect_ratio: aspectRatio,
    resolution,
    ...(assetType === "video" ? { duration_seconds: duration } : {}),
    // text-to-video starts in stage 1 (image); status route will advance to stage 2.
    ...(mode === "text-to-video" ? { stage: "image" } : {}),
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("generated_assets")
    .insert({
      user_id: user.id,
      client_id: clientId,
      campaign_id: body.campaign_id,
      ad_block_index: adBlockIndex,
      asset_type: assetType,
      generation_mode: mode,
      prompt: body.prompt,
      reference_image_ids: refIds,
      status: "pending",
      metadata: initialMetadata,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("[assets/generate] insert failed:", insertErr);
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to record asset" },
      { status: 500 },
    );
  }

  // -------------------- submit to Higgsfield --------------------
  try {
    let requestId: string;
    let stage1Meta: Partial<AssetMetadata> = {};

    if (
      mode === "text-to-image" ||
      mode === "soul" ||
      mode === "text-to-video"
    ) {
      // image submit (also stage 1 of text-to-video chain)
      const submit = await submitImageGeneration({
        prompt: body.prompt,
        aspect_ratio: aspectRatio,
        resolution,
        image_url: mode === "soul" ? referenceImageUrl! : undefined,
      });
      requestId = submit.request_id;
      stage1Meta = {
        raw_submit: submit.raw,
        ...(mode === "text-to-video"
          ? { stage: "image", image_request_id: submit.request_id }
          : {}),
      };
    } else {
      // image-to-video
      const submit = await submitVideoGeneration({
        image_url: referenceImageUrl!,
        prompt: body.prompt,
        duration,
      });
      requestId = submit.request_id;
      stage1Meta = { raw_submit: submit.raw };
    }

    const { error: updErr } = await supabase
      .from("generated_assets")
      .update({
        status: "processing",
        higgsfield_generation_id: requestId,
        metadata: { ...initialMetadata, ...stage1Meta },
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id);
    if (updErr) {
      console.warn("[assets/generate] update-to-processing failed:", updErr);
    }

    return NextResponse.json({
      success: true,
      asset_id: inserted.id,
      status: "processing",
      generation_id: requestId,
    });
  } catch (e) {
    const msg =
      e instanceof HiggsfieldError
        ? `Higgsfield: ${e.message}`
        : e instanceof Error
          ? e.message
          : "Higgsfield submit failed";
    console.error("[assets/generate] Higgsfield submit failed:", msg);

    await supabase
      .from("generated_assets")
      .update({
        status: "failed",
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inserted.id);

    return NextResponse.json(
      { error: msg, asset_id: inserted.id },
      { status: 502 },
    );
  }
}
