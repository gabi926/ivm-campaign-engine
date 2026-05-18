// GET /api/landing-pages/[id] — full blueprint row. RLS scopes access; we
// also gate on a verified session. Mirrors /api/briefs/[id].

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { BlueprintRow } from "@/app/_lib/blueprint-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    return NextResponse.json({ error: "Blueprint id must be a UUID" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_page_blueprints")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[lp/id] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Blueprint not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, blueprint: data as BlueprintRow });
}
