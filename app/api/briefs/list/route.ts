// GET /api/briefs/list — recent strategic briefs for the current user, for
// the "Import strategic brief" dropdown on the campaign form.
//
// The strategic_briefs table lives in the Conversion Intel feature but is
// readable here over the shared Supabase project. RLS on strategic_briefs
// already scopes rows to the requesting user; we additionally gate on a
// verified session so an unauthenticated request gets a clean 401 instead of
// a silently-empty list.
//
// Query params:
//   ?clientId=<uuid>  → briefs for that client OR unattached (client_id NULL)
//   (omitted)         → all of the user's briefs
//
// clients(name) is a left join (no !inner) so unattached briefs — and briefs
// whose client the user can't see — still return with client_name = null.
//
// SCHEMA NOTE (2026-05-17 fix): The strategic_briefs table uses source_*
// prefixed column names (source_offer, source_audience, source_niche,
// source_competitors). We rename them to clean names (offer/niche) in the
// response so the frontend doesn't need to know about the storage schema.

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { BriefListItem } from "@/app/_lib/brief-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PostgREST infers the embed as an array; a to-one relation actually returns
// a single object (or null) at runtime. Accept both shapes and normalize.
type EmbeddedClient = { name: string | null };
interface BriefRow {
  id: string;
  client_id: string | null;
  source_offer: string | null;
  source_niche: string | null;
  created_at: string;
  clients?: EmbeddedClient | EmbeddedClient[] | null;
}

function clientName(c: BriefRow["clients"]): string | null {
  if (!c) return null;
  const row = Array.isArray(c) ? c[0] : c;
  return row?.name ?? null;
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIdParam = req.nextUrl.searchParams.get("clientId");
  // Treat "", "null" and a literal missing param as "no client filter".
  const clientId =
    clientIdParam && clientIdParam !== "null" ? clientIdParam : null;

  if (clientId && !UUID_RE.test(clientId)) {
    return NextResponse.json(
      { error: "clientId must be a UUID" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from("strategic_briefs")
    .select("id, client_id, source_offer, source_niche, created_at, clients(name)")
    .order("created_at", { ascending: false })
    .limit(25);

  if (clientId) {
    // Scoped: this client's briefs plus any unattached (shared) briefs.
    query = query.or(`client_id.eq.${clientId},client_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[briefs/list] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as BriefRow[];
  const briefs: BriefListItem[] = rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    client_name: clientName(r.clients),
    offer: r.source_offer ?? "",
    niche: r.source_niche ?? "",
    created_at: r.created_at,
  }));

  return NextResponse.json({ success: true, briefs });
}