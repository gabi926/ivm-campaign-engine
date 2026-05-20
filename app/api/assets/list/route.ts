// GET /api/assets/list — filterable list of generated_assets for the current
// user. Mirrors /api/landing-pages/list — RLS scopes to own rows, query params
// narrow further. Left join clients(name) for the Library grid.

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import {
  ASSET_STATUSES,
  ASSET_TYPES,
  type AssetListItem,
  type AssetStatus,
  type AssetType,
  type GenerationMode,
} from "@/app/_lib/asset-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EmbeddedClient = { name: string | null };
interface Row {
  id: string;
  client_id: string | null;
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
  clients?: EmbeddedClient | EmbeddedClient[] | null;
}

function clientName(c: Row["clients"]): string | null {
  if (!c) return null;
  const row = Array.isArray(c) ? c[0] : c;
  return row?.name ?? null;
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const clientIdParam = sp.get("clientId");
  const campaignIdParam = sp.get("campaignId");
  const assetTypeParam = sp.get("assetType");
  const statusParam = sp.get("status");

  const clientId =
    clientIdParam && clientIdParam !== "null" ? clientIdParam : null;
  if (clientId && !UUID_RE.test(clientId)) {
    return NextResponse.json(
      { error: "clientId must be a UUID" },
      { status: 400 },
    );
  }

  const campaignId =
    campaignIdParam && campaignIdParam !== "null" ? campaignIdParam : null;
  if (campaignId && !UUID_RE.test(campaignId)) {
    return NextResponse.json(
      { error: "campaignId must be a UUID" },
      { status: 400 },
    );
  }

  const assetType =
    assetTypeParam && ASSET_TYPES.includes(assetTypeParam as AssetType)
      ? (assetTypeParam as AssetType)
      : null;

  const status =
    statusParam && ASSET_STATUSES.includes(statusParam as AssetStatus)
      ? (statusParam as AssetStatus)
      : null;

  const supabase = await createClient();
  let query = supabase
    .from("generated_assets")
    .select(
      "id, client_id, campaign_id, ad_block_index, asset_type, generation_mode, status, storage_url, thumbnail_url, prompt, created_at, completed_at, clients(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (clientId) query = query.eq("client_id", clientId);
  if (campaignId) query = query.eq("campaign_id", campaignId);
  if (assetType) query = query.eq("asset_type", assetType);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.warn("[assets/list] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Row[];
  const assets: AssetListItem[] = rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    client_name: clientName(r.clients),
    campaign_id: r.campaign_id,
    ad_block_index: r.ad_block_index,
    asset_type: r.asset_type,
    generation_mode: r.generation_mode,
    status: r.status,
    storage_url: r.storage_url,
    thumbnail_url: r.thumbnail_url,
    prompt: r.prompt,
    created_at: r.created_at,
    completed_at: r.completed_at,
  }));

  return NextResponse.json({ success: true, assets });
}
