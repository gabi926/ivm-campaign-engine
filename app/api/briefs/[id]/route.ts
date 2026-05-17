// GET /api/briefs/[id] — the full strategic brief row, including the heavy
// brief_data jsonb, used when the user picks a brief from the import dropdown.
//
// RLS on strategic_briefs enforces that the user can only read their own
// briefs; a brief belonging to someone else simply returns no row, which we
// surface as a 404 (same response as a genuinely missing id — we don't
// distinguish, to avoid leaking existence).

import { NextResponse } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { ImportedBrief } from "@/app/_lib/brief-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Brief id must be a UUID" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("strategic_briefs")
    .select(
      "id, user_id, client_id, offer, audience, niche, competitors, brief_data, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[briefs/:id] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  const row = data as Record<string, unknown>;
  const brief: ImportedBrief = {
    id: row.id as string,
    user_id: row.user_id as string,
    client_id: (row.client_id as string | null) ?? null,
    offer: (row.offer as string | null) ?? "",
    audience: (row.audience as string | null) ?? "",
    niche: (row.niche as string | null) ?? "",
    competitors: (row.competitors as string | null) ?? "",
    brief_data: (row.brief_data ?? {}) as ImportedBrief["brief_data"],
    created_at: row.created_at as string,
  };

  return NextResponse.json({ success: true, brief });
}
