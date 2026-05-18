// GET /api/audits/list — recent Meta ad-account audits for the current user,
// for the "Import audit report" dropdown on the campaign form.
//
// The audit_runs table lives in the Audit Engine feature but is readable here
// over the shared Supabase project. RLS on audit_runs already scopes rows to
// the requesting user; we additionally gate on a verified session so an
// unauthenticated request gets a clean 401 instead of a silently-empty list.
//
// Query params:
//   ?clientId=<uuid>  → audits for that client OR unattached (client_id NULL)
//   (omitted)         → all of the user's audits
//
// clients(name) is a left join (no !inner) so unattached audits — and audits
// whose client the user can't see — still return with client_name = null.
// Only completed audits are listed; failed runs are skipped.

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { AuditListItem } from "@/app/_lib/audit-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PostgREST infers the embed as an array; a to-one relation actually returns
// a single object (or null) at runtime. Accept both shapes and normalize.
type EmbeddedClient = { name: string | null };
interface AuditRow {
  id: string;
  client_id: string | null;
  account_id: string | null;
  date_range_label: string | null;
  created_at: string;
  clients?: EmbeddedClient | EmbeddedClient[] | null;
}

function clientName(c: AuditRow["clients"]): string | null {
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
    .from("audit_runs")
    .select(
      "id, client_id, account_id, date_range_label, created_at, clients(name)",
    )
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(25);

  if (clientId) {
    // Scoped: this client's audits plus any unattached (shared) audits.
    query = query.or(`client_id.eq.${clientId},client_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[audits/list] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as AuditRow[];
  const audits: AuditListItem[] = rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    client_name: clientName(r.clients),
    account_id: r.account_id ?? "",
    date_range_label: r.date_range_label ?? "",
    created_at: r.created_at,
  }));

  return NextResponse.json({ success: true, audits });
}
