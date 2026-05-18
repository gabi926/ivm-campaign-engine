// GET /api/landing-pages/list?clientId=<uuid|null> — recent blueprints for
// the current user. RLS scopes to own rows; clientId narrows further.
// Left join clients(name). Mirrors /api/briefs/list.

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { BlueprintListItem, TargetBuilder } from "@/app/_lib/blueprint-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EmbeddedClient = { name: string | null };
interface Row {
  id: string;
  client_id: string | null;
  target_builder: TargetBuilder;
  campaign_id: string | null;
  created_at: string;
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

  const clientIdParam = req.nextUrl.searchParams.get("clientId");
  const clientId =
    clientIdParam && clientIdParam !== "null" ? clientIdParam : null;
  if (clientId && !UUID_RE.test(clientId)) {
    return NextResponse.json({ error: "clientId must be a UUID" }, { status: 400 });
  }

  const supabase = await createClient();
  let query = supabase
    .from("landing_page_blueprints")
    .select("id, client_id, target_builder, campaign_id, created_at, clients(name)")
    .order("created_at", { ascending: false })
    .limit(25);

  if (clientId) {
    query = query.or(`client_id.eq.${clientId},client_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[lp/list] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Row[];
  const blueprints: BlueprintListItem[] = rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    client_name: clientName(r.clients),
    target_builder: r.target_builder,
    campaign_id: r.campaign_id,
    created_at: r.created_at,
  }));

  return NextResponse.json({ success: true, blueprints });
}
