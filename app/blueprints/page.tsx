// LP Blueprints list. Server component — RLS on landing_page_blueprints
// scopes rows to the user (strict own-rows). Mirrors app/history/page.tsx.

import Link from "next/link";
import { createClient } from "@/app/_lib/supabase/server";
import { BUILDER_LABEL, type TargetBuilder } from "@/app/_lib/blueprint-types";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  created_at: string;
  target_builder: TargetBuilder;
  campaign_id: string | null;
  client_id: string | null;
  clients: { name: string | null } | { name: string | null }[] | null;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function BuilderPill({ b }: { b: TargetBuilder }) {
  return (
    <span className="inline-block font-mono text-[9px] uppercase tracking-widest border border-stone-300 bg-stone-50 text-stone-700 px-1.5 py-0.5">
      {BUILDER_LABEL[b]}
    </span>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`font-mono text-[10px] uppercase tracking-widest text-stone-500 font-semibold px-3 py-2.5 ${align === "right" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td className={`px-3 py-2.5 align-middle ${align === "right" ? "text-right" : ""}`}>
      {children}
    </td>
  );
}

export default async function BlueprintsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("landing_page_blueprints")
    .select("id, created_at, target_builder, campaign_id, client_id, clients(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) console.error("[blueprints] select failed:", error);

  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const join = r.clients;
    const clientName = Array.isArray(join)
      ? (join[0]?.name ?? null)
      : (join?.name ?? null);
    return { ...r, _clientName: clientName };
  });

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="max-w-6xl mx-auto px-5 py-10 md:px-8 md:py-14">
        <header className="mb-8 md:mb-10 border-b border-stone-300 pb-6">
          <h1 className="font-mono text-2xl md:text-3xl font-bold tracking-tight">
            LP Blueprints
          </h1>
          <p className="font-mono text-xs md:text-sm text-stone-500 mt-2">
            {rows.length === 0
              ? "No blueprints yet."
              : `Showing ${rows.length} most recent blueprint${rows.length === 1 ? "" : "s"}.`}
          </p>
        </header>

        {error && (
          <div className="mb-6 border border-red-300 bg-red-50 px-4 py-3 font-mono text-sm text-red-700">
            Failed to load blueprints: {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="border border-stone-300 bg-white p-12 text-center">
            <div className="font-mono text-sm text-stone-700 mb-3">
              No blueprints yet.
            </div>
            <p className="font-mono text-xs text-stone-500 mb-6">
              Open a saved campaign and click &ldquo;Generate LP Blueprint&rdquo;.
            </p>
            <Link
              href="/history"
              className="inline-block font-mono text-[11px] uppercase tracking-widest font-bold text-stone-900 border border-stone-900 px-4 py-2 hover:bg-stone-900 hover:text-white transition"
            >
              Go to campaign history
            </Link>
          </div>
        ) : (
          <div className="border border-stone-300 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr className="text-left">
                  <Th>Date</Th>
                  <Th>Client</Th>
                  <Th>Source campaign</Th>
                  <Th>Target builder</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-stone-100 last:border-b-0 hover:bg-lime-50/60 transition"
                  >
                    <Td>
                      <span className="font-mono text-[12px] text-stone-800 whitespace-nowrap">
                        {formatTimestamp(row.created_at)}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px] text-stone-700">
                        {row._clientName ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      {row.campaign_id ? (
                        <Link
                          href={`/history/${row.campaign_id}`}
                          className="font-mono text-[11px] text-stone-700 underline hover:text-stone-900"
                        >
                          {row.campaign_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="font-mono text-[11px] text-stone-400">—</span>
                      )}
                    </Td>
                    <Td>
                      <BuilderPill b={row.target_builder} />
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/blueprints/${row.id}`}
                        className="font-mono text-[10px] uppercase tracking-widest text-stone-700 border border-stone-300 px-2.5 py-1 hover:border-stone-700 hover:text-stone-900 transition whitespace-nowrap"
                      >
                        View
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
