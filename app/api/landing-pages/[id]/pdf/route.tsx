// GET /api/landing-pages/[id]/pdf — branded blueprint PDF. Auth-gated; RLS
// scopes the row + joined client. Mirrors the renderToBuffer + pdf-headers
// pattern of /api/download-pdf.

import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { BlueprintRow } from "@/app/_lib/blueprint-types";
import { BlueprintPdf } from "./BlueprintPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    .select("*, clients(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("[lp/id/pdf] select failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Blueprint not found" }, { status: 404 });
  }

  const row = data as unknown as BlueprintRow & {
    clients: { name: string } | { name: string }[] | null;
  };
  const clientName = Array.isArray(row.clients)
    ? (row.clients[0]?.name ?? null)
    : (row.clients?.name ?? null);

  const pdfBuffer = await renderToBuffer(
    <BlueprintPdf blueprint={row} clientName={clientName} />,
  );

  const slug = (clientName ?? "client")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `IVM-LP-Blueprint-${slug || "client"}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
