// History list page. Server component — no client-side auth state. RLS on
// campaigns filters rows server-side: admin/team see all, client sees their
// own. We do not re-check role here; we trust the policy.

import Link from "next/link";
import { createClient } from "@/app/_lib/supabase/server";

export const dynamic = "force-dynamic";

interface ClientJoinSlim {
  name: string | null;
}

interface CampaignRow {
  id: string;
  created_at: string;
  brand_name: string | null;
  offer: string | null;
  target_audience: string | null;
  channels: string[] | null;
  client_id: string | null;
  // Embedded resource via FK — Supabase returns this as an object when the
  // join hits at most one row (campaigns_client_id_fkey). When the FK is null
  // the field comes back as null.
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

function ChannelPill({ name }: { name: string }) {
  return (
    <span
      className="inline-block font-mono text-[9px] uppercase tracking-widest border border-stone-300 bg-stone-50 text-stone-700 px-1.5 py-0.5"
    >
      {name}
    </span>
  );
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, created_at, brand_name, offer, target_audience, channels, client_id, clients!campaigns_client_id_fkey(name)",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[history] supabase select failed:", error);
  }

  // `clients` is returned as an object (or null) by Supabase when joining a
  // single-row FK; type assertion shields us if drivers return it as a one-
  // element array on certain plan versions.
  const rows = ((data ?? []) as unknown as CampaignRow[]).map((r) => {
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
            Campaign History
          </h1>
          <p className="font-mono text-xs md:text-sm text-stone-500 mt-2">
            {rows.length === 0
              ? "No campaigns yet."
              : `Showing ${rows.length} most recent campaign${rows.length === 1 ? "" : "s"}.`}
          </p>
        </header>

        {error && (
          <div className="mb-6 border border-red-300 bg-red-50 px-4 py-3 font-mono text-sm text-red-700">
            Failed to load history: {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="border border-stone-300 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr className="text-left">
                  <Th>Date</Th>
                  <Th>Client</Th>
                  <Th>Brand</Th>
                  <Th>Offer</Th>
                  <Th>Audience</Th>
                  <Th>Channels Generated</Th>
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
                        {truncate(row.brand_name, 28)}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[11px] text-stone-700">
                        {truncate(row.offer, 50)}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[11px] text-stone-600">
                        {truncate(row.target_audience, 40)}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {row.channels && row.channels.length > 0 ? (
                          row.channels.map((ch) => <ChannelPill key={ch} name={ch} />)
                        ) : (
                          <span className="font-mono text-[11px] text-stone-400">—</span>
                        )}
                      </div>
                    </Td>
                    <Td align="right">
                      <Link
                        href={`/history/${row.id}`}
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

function EmptyState() {
  return (
    <div className="border border-stone-300 bg-white p-12 text-center">
      <div className="font-mono text-sm text-stone-700 mb-3">No campaigns yet.</div>
      <p className="font-mono text-xs text-stone-500 mb-6">
        Generate your first campaign from the home page — it will be saved here
        automatically.
      </p>
      <Link
        href="/"
        className="inline-block font-mono text-[11px] uppercase tracking-widest font-bold text-stone-900 border border-stone-900 px-4 py-2 hover:bg-stone-900 hover:text-white transition"
      >
        Generate your first campaign
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
