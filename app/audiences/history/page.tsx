// Audiences history list. Server component — RLS on al_audience_specs
// filters rows server-side: owner sees own, admin/team see all, mapped
// clients see rows via user_clients. No role re-check in code; we trust
// the policy set in migration 006.

import Link from "next/link";
import { createClient } from "@/app/_lib/supabase/server";

export const dynamic = "force-dynamic";

interface ClientJoinSlim {
  name: string | null;
}

interface SpecRow {
  id: string;
  created_at: string;
  audience_name: string | null;
  detected_type: string | null;
  geography: string;
  client_id: string | null;
  // Embedded resource via FK — Supabase returns this as an object when
  // the join hits at most one row (al_audience_specs_client_id_fkey).
  // When the FK is null the field comes back as null.
  clients: ClientJoinSlim | null;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "—";
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function TypePill({ type }: { type: string | null }) {
  if (!type) return <span className="font-mono text-[11px] text-stone-400">—</span>;
  const isB2B = type.toUpperCase() === "B2B";
  const isB2C = type.toUpperCase() === "B2C";
  return (
    <span
      className={`inline-block font-mono-x text-[9px] uppercase tracking-widest px-1.5 py-0.5 font-bold ${
        isB2B
          ? "bg-stone-900 text-white"
          : isB2C
            ? "bg-[color:var(--ivm-accent)] text-stone-900"
            : "bg-stone-100 text-stone-700 border border-stone-300"
      }`}
    >
      {type}
    </span>
  );
}

export default async function AudienceHistoryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("al_audience_specs")
    .select(
      "id, created_at, audience_name, detected_type, geography, client_id, clients!al_audience_specs_client_id_fkey(name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[audiences/history] supabase select failed:", error);
  }

  const rows = ((data ?? []) as unknown as SpecRow[]).map((r) => {
    const join = r.clients;
    const clientName = Array.isArray(join)
      ? (join[0]?.name ?? null)
      : (join?.name ?? null);
    return { ...r, _clientName: clientName };
  });

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="max-w-6xl mx-auto px-5 py-10 md:px-8 md:py-14">
        <header className="mb-8 md:mb-10 border-b border-stone-300 pb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-2">
              Revenue Engine · Audience Builder
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-black leading-tight">
              Audience History
            </h1>
            <p className="font-mono-x text-[11px] text-stone-500 mt-3">
              {rows.length === 0
                ? "No audience specs yet."
                : `Showing ${rows.length} most recent spec${rows.length === 1 ? "" : "s"}.`}
            </p>
          </div>
          <Link
            href="/audiences"
            className="inline-block font-mono-x text-[11px] uppercase tracking-widest font-bold text-stone-900 px-4 py-2.5 hover:opacity-90 transition"
            style={{ backgroundColor: "var(--ivm-accent)" }}
          >
            + New Spec
          </Link>
        </header>

        {error && (
          <div className="mb-6 border border-red-300 bg-red-50 px-4 py-3 font-mono text-sm text-red-800">
            Failed to load history: {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="border border-stone-300 bg-white overflow-x-auto card-shadow">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr className="text-left">
                  <Th>Date</Th>
                  <Th>Client</Th>
                  <Th>Audience</Th>
                  <Th>Type</Th>
                  <Th>Geography</Th>
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
                      <div className="font-mono text-[12px] text-stone-800 whitespace-nowrap">
                        {formatTimestamp(row.created_at)}
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px] text-stone-700">
                        {row._clientName ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px] text-stone-900 font-semibold">
                        {truncate(row.audience_name, 40)}
                      </span>
                    </Td>
                    <Td>
                      <TypePill type={row.detected_type} />
                    </Td>
                    <Td>
                      <span className="font-mono text-[11px] text-stone-600">
                        {truncate(row.geography, 24)}
                      </span>
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/audiences/${row.id}`}
                        className="font-mono-x text-[10px] uppercase tracking-widest text-stone-700 border border-stone-300 px-2.5 py-1 hover:border-stone-700 hover-dark transition whitespace-nowrap"
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

function EmptyState() {
  return (
    <div className="border border-stone-300 bg-white p-12 text-center card-shadow">
      <div className="font-display text-lg font-bold text-stone-900 mb-2">
        No audience specs yet.
      </div>
      <p className="font-mono-x text-[11px] text-stone-500 mb-6 max-w-md mx-auto leading-relaxed normal-case tracking-normal">
        Generate your first AL spec from the builder — it will be saved here
        automatically.
      </p>
      <Link
        href="/audiences"
        className="inline-block font-mono-x text-[11px] uppercase tracking-widest font-bold text-stone-900 px-5 py-2.5 hover:opacity-90 transition"
        style={{ backgroundColor: "var(--ivm-accent)" }}
      >
        Generate your first audience
      </Link>
    </div>
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
      className={`font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-semibold px-3 py-2.5 ${align === "right" ? "text-right" : ""}`}
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
