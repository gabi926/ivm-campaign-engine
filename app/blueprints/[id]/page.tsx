// Blueprint detail. Server component — RLS-scoped fetch + joined client.
// All interactivity (copy buttons, collapsible sections, regenerate) lives
// in BlueprintDetailClient. Mirrors app/history/[id]/page.tsx.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/app/_lib/supabase/server";
import type { BlueprintRow } from "@/app/_lib/blueprint-types";
import { BlueprintDetailClient } from "./BlueprintDetailClient";

export const dynamic = "force-dynamic";

export default async function BlueprintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_page_blueprints")
    .select("*, clients(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("[blueprints/detail] select failed:", error);
  if (!data) notFound();

  const row = data as unknown as BlueprintRow & {
    clients: { name: string } | { name: string }[] | null;
  };
  const clientName = Array.isArray(row.clients)
    ? (row.clients[0]?.name ?? null)
    : (row.clients?.name ?? null);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="max-w-5xl mx-auto px-5 py-8 md:px-8 md:py-10">
        <div className="mb-6">
          <Link
            href="/blueprints"
            className="font-mono-x text-[11px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition"
          >
            ← Back to blueprints
          </Link>
        </div>
        <BlueprintDetailClient blueprint={row} clientName={clientName} />
      </div>
    </div>
  );
}
