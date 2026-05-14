// GET /api/clients — returns the list of clients accessible to the current
// user, scoped to revenue-engine. RLS on `clients` and `client_tool_access`
// does role/access filtering; we just inner-join on the tool flag.
//
// Mirrors the Audit Engine's /api/clients route exactly except for the
// tool_name filter value.

import { NextResponse } from "next/server";
import { createClient } from "@/app/_lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClientRow {
  id: string;
  name: string;
  meta_ad_account_id: string;
}

export async function GET() {
  const supabase = await createClient();

  // !inner makes it an INNER JOIN so the row is dropped when there's no
  // matching client_tool_access record. The eq() filters apply to the joined
  // columns via dotted access. The embedded `client_tool_access` field is
  // stripped before returning to the client.
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, meta_ad_account_id, client_tool_access!inner(tool_name, enabled)")
    .eq("client_tool_access.tool_name", "revenue-engine")
    .eq("client_tool_access.enabled", true)
    .order("name", { ascending: true });

  if (error) {
    console.warn("[clients] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Array<ClientRow & { client_tool_access?: unknown }>;
  const clients: ClientRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    meta_ad_account_id: r.meta_ad_account_id,
  }));

  return NextResponse.json({ clients });
}
