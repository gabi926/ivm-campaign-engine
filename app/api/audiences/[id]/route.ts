// GET /api/audiences/[id] — single audience spec by row id.
//
// Returns the full row including generated_spec JSON. RLS on
// al_audience_specs scopes what the caller can see; a UUID the caller
// isn't authorized to read collapses to 404 rather than 403 (same
// affordance as briefs / campaigns detail routes — don't leak existence).

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { ALAudienceSpec } from "@/app/_lib/al-taxonomy/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FullSpecRow {
  id: string;
  user_id: string;
  client_id: string | null;
  campaign_id: string | null;
  icp_brief: string;
  offer: string | null;
  geography: string;
  audience_name: string | null;
  detected_type: string | null;
  generated_spec: ALAudienceSpec;
  model_used: string;
  candidate_count: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
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
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "id must be a UUID" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("al_audience_specs")
    .select(
      "id, user_id, client_id, campaign_id, icp_brief, offer, geography, audience_name, detected_type, generated_spec, model_used, candidate_count, prompt_tokens, completion_tokens, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[audiences/[id]] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    // RLS hid the row OR it doesn't exist. Collapse to 404.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = data as FullSpecRow;
  return NextResponse.json({ success: true, spec: row });
}
