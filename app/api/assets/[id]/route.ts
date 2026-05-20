// GET  /api/assets/[id] — single asset row (RLS-scoped). Refreshes signed URL
//                          when storage_url is approaching the 7-day expiry.
// DELETE /api/assets/[id] — remove the storage object (best-effort) and the
//                          row (primary). Returns 200 with success=true on
//                          row deletion even if storage delete logs a warning.

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { GeneratedAsset } from "@/app/_lib/asset-types";
import {
  refreshSignedUrl,
  shouldRefreshSignedUrl,
} from "@/app/_lib/higgsfield";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const { data, error } = await supabase
    .from("generated_assets")
    .select("*, clients(name), campaigns(brand_name)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("[assets/id] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  let asset = data as GeneratedAsset & {
    clients?: { name: string | null } | { name: string | null }[] | null;
    campaigns?:
      | { brand_name: string | null }
      | { brand_name: string | null }[]
      | null;
  };

  // Refresh signed URL if approaching expiry.
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
        .select("*, clients(name), campaigns(brand_name)")
        .single();
      if (updated) {
        asset = updated as typeof asset;
      }
    }
  }

  return NextResponse.json({ success: true, asset });
}

export async function DELETE(
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

  // Look up row first (RLS-scoped) so we can also remove storage object.
  const { data: row, error: selErr } = await supabase
    .from("generated_assets")
    .select("id, storage_path, metadata")
    .eq("id", id)
    .maybeSingle();
  if (selErr) {
    console.warn("[assets/id] delete select failed:", selErr);
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  // Collect storage paths to clean up — main + any intermediate from t2v chain.
  const paths: string[] = [];
  if (row.storage_path) paths.push(row.storage_path);
  const intermediate =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as { intermediate_storage_path?: string })
          .intermediate_storage_path
      : undefined;
  if (intermediate) paths.push(intermediate);

  if (paths.length > 0) {
    const { error: storageErr } = await supabase.storage
      .from("generated-assets")
      .remove(paths);
    if (storageErr) {
      console.warn(
        "[assets/id] storage remove logged a non-fatal error:",
        storageErr.message,
      );
      // Don't fail the request — row deletion is the primary action.
    }
  }

  const { error: delErr } = await supabase
    .from("generated_assets")
    .delete()
    .eq("id", id);
  if (delErr) {
    console.error("[assets/id] row delete failed:", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
