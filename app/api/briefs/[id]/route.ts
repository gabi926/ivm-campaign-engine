// GET /api/briefs/[id] — full strategic brief row for the campaign form's
// brief importer. RLS on strategic_briefs scopes access; we additionally gate
// on a verified session.
//
// SCHEMA NOTE (2026-05-17 fix): The strategic_briefs table uses source_*
// prefixed columns and brief_json (not brief_data). source_competitors is
// stored as text[] and we join it to a comma-separated string for the form
// field. Mapping happens at this API boundary so downstream code (page.tsx,
// /api/generate) sees the clean shape defined in brief-types.ts.

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { ImportedBrief, BriefData } from "@/app/_lib/brief-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BriefRow {
  id: string;
  user_id: string;
  client_id: string | null;
  source_offer: string | null;
  source_audience: string | null;
  source_niche: string | null;
  source_competitors: string[] | null;
  brief_json: BriefData | null;
  created_at: string;
}

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
    return NextResponse.json({ error: "Brief id must be a UUID" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("strategic_briefs")
    .select(
      "id, user_id, client_id, source_offer, source_audience, source_niche, source_competitors, brief_json, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[briefs/id] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    // Either truly missing or RLS-blocked. Either way the user can't see it,
    // so 404 is the right semantic response.
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  const row = data as unknown as BriefRow;

  const brief: ImportedBrief = {
    id: row.id,
    user_id: row.user_id,
    client_id: row.client_id,
    offer: row.source_offer ?? "",
    audience: row.source_audience ?? "",
    niche: row.source_niche ?? "",
    // source_competitors is text[]; join to comma-separated for the form
    // field. Filter out empty strings defensively.
    competitors: Array.isArray(row.source_competitors)
      ? row.source_competitors.filter((c) => c && c.trim()).join(", ")
      : "",
    brief_data: row.brief_json ?? {},
    created_at: row.created_at,
  };

  return NextResponse.json({ success: true, brief });
}