// GET /api/audiences/list — paged history of AL audience specs for the
// current user (RLS scopes results).
//
// Query params:
//   ?client_id=<uuid>  → this client's specs plus unattached (client_id NULL)
//   (omitted)          → all specs the caller can SELECT
//
// Mirrors the shape of /api/briefs/list for consistency with the rest of
// the Revenue Engine's list endpoints. Returns hoisted columns only —
// generated_spec is intentionally omitted here because it's ~2-8 KB per
// row and the history view doesn't need it.

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { ALSpecListItem } from "@/app/_lib/al-taxonomy/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface SpecRow {
  id: string;
  audience_name: string | null;
  detected_type: string | null;
  client_id: string | null;
  campaign_id: string | null;
  geography: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIdParam = req.nextUrl.searchParams.get("client_id");
  const clientId =
    clientIdParam && clientIdParam !== "null" ? clientIdParam : null;
  if (clientId && !UUID_RE.test(clientId)) {
    return NextResponse.json(
      { error: "client_id must be a UUID" },
      { status: 400 },
    );
  }

  const limitParam = req.nextUrl.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return NextResponse.json(
        { error: `limit must be an integer between 1 and ${MAX_LIMIT}` },
        { status: 400 },
      );
    }
    limit = parsed;
  }

  const supabase = await createClient();
  let query = supabase
    .from("al_audience_specs")
    .select("id, audience_name, detected_type, client_id, campaign_id, geography, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (clientId) {
    query = query.or(`client_id.eq.${clientId},client_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[audiences/list] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as SpecRow[];
  const specs: ALSpecListItem[] = rows.map((r) => ({
    id: r.id,
    audience_name: r.audience_name,
    detected_type: r.detected_type,
    client_id: r.client_id,
    campaign_id: r.campaign_id,
    geography: r.geography,
    created_at: r.created_at,
  }));

  return NextResponse.json({ success: true, specs });
}
