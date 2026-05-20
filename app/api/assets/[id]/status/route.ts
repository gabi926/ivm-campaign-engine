// GET /api/assets/[id]/status — poll Higgsfield, hydrate Supabase Storage on
// completion, and (for text-to-video) advance the internal stage chain.
//
// Behavior:
//   - Terminal rows (completed | failed) are returned as-is, with a signed
//     URL refresh if storage_url is approaching expiry.
//   - Pending/processing rows are polled against Higgsfield via the row's
//     higgsfield_generation_id.
//   - On Higgsfield 'completed':
//       text-to-video stage 1 (metadata.stage === 'image'):
//         download intermediate image, store under {prefix}/{image_request_id}.{ext},
//         submit dop/standard with the signed URL, swap higgsfield_generation_id
//         to the new video request_id, keep row status='processing'.
//       all other completions (and t2v stage 2):
//         download final result, store under {prefix}/{request_id}.{ext},
//         create 7-day signed URL, set status='completed', completed_at=now.
//   - On Higgsfield 'failed': set status='failed', store error_message.

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { AssetMetadata, GeneratedAsset } from "@/app/_lib/asset-types";
import {
  HiggsfieldError,
  buildStoragePathPrefix,
  downloadAndStore,
  pollGenerationStatus,
  refreshSignedUrl,
  shouldRefreshSignedUrl,
  submitVideoGeneration,
} from "@/app/_lib/higgsfield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Asset id must be a UUID" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: row, error: selErr } = await supabase
    .from("generated_assets")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (selErr) {
    console.warn("[assets/status] select failed:", selErr);
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
  let asset = row as GeneratedAsset;

  // -------------------- terminal: refresh signed URL if stale --------------------
  if (asset.status === "completed" || asset.status === "failed") {
    if (
      asset.status === "completed" &&
      shouldRefreshSignedUrl(
        asset.completed_at,
        asset.storage_path,
        asset.storage_url,
      )
    ) {
      const fresh = await refreshSignedUrl(asset.storage_path!, supabase);
      if (fresh) {
        const { data: updated } = await supabase
          .from("generated_assets")
          .update({ storage_url: fresh, updated_at: new Date().toISOString() })
          .eq("id", asset.id)
          .select("*")
          .single();
        if (updated) asset = updated as GeneratedAsset;
      }
    }
    return NextResponse.json({ success: true, asset });
  }

  // -------------------- need a generation id to poll --------------------
  if (!asset.higgsfield_generation_id) {
    // Stuck in 'pending' without a generation id — should be rare (submit must
    // have set it). Return current state; client can retry.
    return NextResponse.json({ success: true, asset });
  }

  // -------------------- poll Higgsfield --------------------
  let normalized;
  try {
    normalized = await pollGenerationStatus(asset.higgsfield_generation_id);
  } catch (e) {
    const msg =
      e instanceof HiggsfieldError
        ? `Higgsfield: ${e.message}`
        : e instanceof Error
          ? e.message
          : "Higgsfield poll failed";
    console.error("[assets/status] poll failed:", msg);
    // Don't fail the row — transient errors should let the client retry.
    return NextResponse.json({ success: true, asset, poll_error: msg });
  }

  const metadata: AssetMetadata = {
    ...(asset.metadata ?? {}),
    raw_status: normalized.raw,
  };

  // -------------------- still processing --------------------
  if (normalized.status === "processing") {
    const { data: updated } = await supabase
      .from("generated_assets")
      .update({
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asset.id)
      .select("*")
      .single();
    return NextResponse.json({
      success: true,
      asset: (updated as GeneratedAsset) ?? asset,
    });
  }

  // -------------------- failed --------------------
  if (normalized.status === "failed") {
    const { data: updated } = await supabase
      .from("generated_assets")
      .update({
        status: "failed",
        error_message:
          normalized.error_message ?? "Higgsfield generation failed",
        cost_credits: normalized.cost_credits,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asset.id)
      .select("*")
      .single();
    return NextResponse.json({
      success: true,
      asset: (updated as GeneratedAsset) ?? asset,
    });
  }

  // -------------------- completed --------------------
  if (!normalized.result_url) {
    // Higgsfield said completed but we got no URL — treat as failed so the UI
    // doesn't poll forever.
    const { data: updated } = await supabase
      .from("generated_assets")
      .update({
        status: "failed",
        error_message:
          "Higgsfield returned completed status without a result URL.",
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asset.id)
      .select("*")
      .single();
    return NextResponse.json({
      success: true,
      asset: (updated as GeneratedAsset) ?? asset,
    });
  }

  // -------------------- TEXT-TO-VIDEO STAGE-1 transition --------------------
  if (
    asset.generation_mode === "text-to-video" &&
    metadata.stage === "image"
  ) {
    // The intermediate image just completed. Store it, then kick off dop/standard.
    const imageRequestId =
      metadata.image_request_id ?? asset.higgsfield_generation_id!;
    const prefix = buildStoragePathPrefix({
      userId: asset.user_id,
      clientId: asset.client_id,
      campaignId: asset.campaign_id,
      requestId: imageRequestId,
    });

    let intermediate;
    try {
      intermediate = await downloadAndStore(
        normalized.result_url,
        prefix,
        "png",
        supabase,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Intermediate store failed";
      console.error("[assets/status] t2v stage-1 store failed:", msg);
      await supabase
        .from("generated_assets")
        .update({
          status: "failed",
          error_message: msg,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset.id);
      return NextResponse.json(
        { success: false, error: msg, asset_id: asset.id },
        { status: 502 },
      );
    }

    // Submit dop/standard with the just-stored image's signed URL.
    let videoSubmit;
    try {
      videoSubmit = await submitVideoGeneration({
        image_url: intermediate.storage_url,
        prompt: asset.prompt,
        duration:
          typeof metadata.duration_seconds === "number"
            ? metadata.duration_seconds
            : 5,
      });
    } catch (e) {
      const msg =
        e instanceof HiggsfieldError
          ? `Higgsfield: ${e.message}`
          : e instanceof Error
            ? e.message
            : "Higgsfield stage-2 submit failed";
      console.error("[assets/status] t2v stage-2 submit failed:", msg);
      await supabase
        .from("generated_assets")
        .update({
          status: "failed",
          error_message: msg,
          metadata: {
            ...metadata,
            stage: "video",
            intermediate_image_url: intermediate.storage_url,
            intermediate_storage_path: intermediate.storage_path,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", asset.id);
      return NextResponse.json(
        { success: false, error: msg, asset_id: asset.id },
        { status: 502 },
      );
    }

    const advancedMetadata: AssetMetadata = {
      ...metadata,
      stage: "video",
      image_request_id: imageRequestId,
      video_request_id: videoSubmit.request_id,
      intermediate_image_url: intermediate.storage_url,
      intermediate_storage_path: intermediate.storage_path,
      raw_submit: videoSubmit.raw,
    };

    const { data: updated } = await supabase
      .from("generated_assets")
      .update({
        status: "processing",
        higgsfield_generation_id: videoSubmit.request_id,
        metadata: advancedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asset.id)
      .select("*")
      .single();

    return NextResponse.json({
      success: true,
      asset: (updated as GeneratedAsset) ?? asset,
    });
  }

  // -------------------- terminal completion (image, soul, i2v, t2v stage 2) --------------------
  const prefix = buildStoragePathPrefix({
    userId: asset.user_id,
    clientId: asset.client_id,
    campaignId: asset.campaign_id,
    requestId: asset.higgsfield_generation_id,
  });
  const fallbackExt = asset.asset_type === "video" ? "mp4" : "png";

  let stored;
  try {
    stored = await downloadAndStore(
      normalized.result_url,
      prefix,
      fallbackExt,
      supabase,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Final store failed";
    console.error("[assets/status] final store failed:", msg);
    await supabase
      .from("generated_assets")
      .update({
        status: "failed",
        error_message: msg,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", asset.id);
    return NextResponse.json(
      { success: false, error: msg, asset_id: asset.id },
      { status: 502 },
    );
  }

  // Optional thumbnail (video poster URL was already pulled by normalizeStatus).
  let storedThumbUrl: string | null = null;
  if (asset.asset_type === "video" && normalized.thumbnail_url) {
    try {
      const thumbStored = await downloadAndStore(
        normalized.thumbnail_url,
        `${prefix}_thumb`,
        "jpg",
        supabase,
      );
      storedThumbUrl = thumbStored.storage_url;
    } catch (e) {
      // Non-fatal: log and continue without a thumbnail.
      console.warn(
        "[assets/status] thumbnail store failed (non-fatal):",
        e instanceof Error ? e.message : e,
      );
    }
  }

  const completedAt = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("generated_assets")
    .update({
      status: "completed",
      storage_path: stored.storage_path,
      storage_url: stored.storage_url,
      thumbnail_url: storedThumbUrl,
      cost_credits: normalized.cost_credits,
      metadata,
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", asset.id)
    .select("*")
    .single();
  if (updErr) {
    console.error("[assets/status] final update failed:", updErr);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    asset: (updated as GeneratedAsset) ?? asset,
  });
}
