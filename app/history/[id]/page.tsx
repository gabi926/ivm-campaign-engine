// History detail page. Server component — fetches one campaigns row by id;
// RLS rejects rows the user doesn't have access to, which surfaces as null
// from .maybeSingle() and we render the framework 404 page.
//
// Renders the saved campaign_json through the same CampaignReportView the
// home page uses post-generation. Zero duplicate rendering logic.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/app/_lib/supabase/server";
import type { CampaignOutput } from "@/app/_lib/campaign-types";
import { CampaignReportView } from "@/app/components/CampaignReportView";

export const dynamic = "force-dynamic";

interface CampaignDetailRow {
  id: string;
  created_at: string;
  brand_name: string | null;
  channels: string[] | null;
  campaign_json: CampaignOutput | null;
  status: string | null;
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, created_at, brand_name, channels, campaign_json, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[history/detail] select failed:", error);
  }
  if (!data) notFound();
  const row = data as CampaignDetailRow;
  if (!row.campaign_json) {
    // Row exists but no campaign payload — likely a failed run that was
    // logged without one. Show a small placeholder.
    return <FailedRunPlaceholder row={row} />;
  }

  return (
    <div
      className="min-h-screen bg-stone-100 text-stone-900 campaign-surface"
      style={{ fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif" }}
    >
      <div className="grain min-h-screen">
        <div className="max-w-6xl mx-auto px-5 py-8 md:px-8 md:py-10">
          <BackLink />
          <CampaignReportView
            output={row.campaign_json}
            clientName={row.brand_name ?? "Untitled"}
            channels={row.channels ?? []}
          />
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <div className="mb-6">
      <Link
        href="/history"
        className="font-mono-x text-[11px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition"
      >
        ← Back to History
      </Link>
    </div>
  );
}

function FailedRunPlaceholder({ row }: { row: CampaignDetailRow }) {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="max-w-6xl mx-auto px-5 py-10 md:px-8 md:py-14">
        <BackLink />
        <div className="border border-stone-300 bg-white p-8 text-center">
          <div className="font-mono text-sm text-stone-800 mb-2">
            This campaign generation did not produce a payload.
          </div>
          <div className="font-mono text-xs text-stone-500">
            id={row.id} · status={row.status ?? "—"} · {new Date(row.created_at).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
