// GET /api/audits/[id] — full Meta ad-account audit row for the campaign
// form's audit importer. RLS on audit_runs scopes access; we additionally gate
// on a verified session.
//
// Unlike /api/briefs/[id], columns are NOT renamed here: report_json already
// uses clean top-level keys, so the full row passes through as-is. Downstream
// code (page.tsx, /api/generate) sees the shape defined in audit-types.ts.

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { ImportedAudit, AuditReportJson } from "@/app/_lib/audit-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AuditRow {
  id: string;
  user_id: string;
  client_id: string | null;
  account_id: string | null;
  date_range_label: string | null;
  report_json: AuditReportJson | null;
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
    return NextResponse.json({ error: "Audit id must be a UUID" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_runs")
    .select(
      "id, user_id, client_id, account_id, date_range_label, report_json, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[audits/id] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    // Either truly missing or RLS-blocked. Either way the user can't see it,
    // so 404 is the right semantic response.
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });
  }

  const row = data as unknown as AuditRow;

  const audit: ImportedAudit = {
    id: row.id,
    user_id: row.user_id,
    client_id: row.client_id,
    account_id: row.account_id ?? "",
    date_range_label: row.date_range_label ?? "",
    report_json: row.report_json ?? {},
    created_at: row.created_at,
  };

  return NextResponse.json({ success: true, audit });
}
