// Audience spec detail. Server component — fetches one al_audience_specs
// row by id; RLS rejects rows the user can't see, which surfaces as null
// from .maybeSingle() and we render the framework 404 page.
//
// Renders the saved generated_spec through the same AudienceSpecView the
// generate page uses post-generation. Zero duplicate rendering logic.
// Above the spec: original inputs (ICP, offer, geography) and provenance
// (model, candidate count, token counts).

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/app/_lib/supabase/server";
import { AudienceSpecView } from "../AudienceSpecView";
import type { ALAudienceSpec } from "@/app/_lib/al-taxonomy/types";

export const dynamic = "force-dynamic";

interface ClientJoinSlim {
  name: string | null;
}

interface CampaignJoinSlim {
  brand_name: string | null;
}

interface SpecDetailRow {
  id: string;
  created_at: string;
  audience_name: string | null;
  detected_type: string | null;
  geography: string;
  icp_brief: string;
  offer: string | null;
  generated_spec: ALAudienceSpec | null;
  model_used: string;
  candidate_count: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  client_id: string | null;
  campaign_id: string | null;
  clients: ClientJoinSlim | null;
  campaigns: CampaignJoinSlim | null;
}

function joinName<T extends { name?: string | null; brand_name?: string | null }>(
  join: T | T[] | null,
  key: "name" | "brand_name",
): string | null {
  if (!join) return null;
  const row = Array.isArray(join) ? join[0] : join;
  const val = row?.[key];
  return typeof val === "string" ? val : null;
}

export default async function AudienceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("al_audience_specs")
    .select(
      [
        "id",
        "created_at",
        "audience_name",
        "detected_type",
        "geography",
        "icp_brief",
        "offer",
        "generated_spec",
        "model_used",
        "candidate_count",
        "prompt_tokens",
        "completion_tokens",
        "client_id",
        "campaign_id",
        "clients!al_audience_specs_client_id_fkey(name)",
        "campaigns!al_audience_specs_campaign_id_fkey(brand_name)",
      ].join(", "),
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[audiences/detail] select failed:", error);
  }
  if (!data) notFound();
  const row = data as unknown as SpecDetailRow;
  if (!row.generated_spec) {
    return <MissingSpecPlaceholder row={row} />;
  }

  const clientName = joinName(row.clients, "name");
  const campaignName = joinName(row.campaigns, "brand_name");
  const createdAt = new Date(row.created_at).toLocaleString();

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="grain min-h-screen">
        <div className="max-w-4xl mx-auto px-5 py-8 md:px-8 md:py-10">
          <BackLink />

          {/* Provenance strip */}
          <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-6 flex items-center flex-wrap gap-x-3 gap-y-1">
            <span>Saved {createdAt}</span>
            <span className="text-stone-400">·</span>
            <span>{row.model_used}</span>
            {row.candidate_count != null && (
              <>
                <span className="text-stone-400">·</span>
                <span>{row.candidate_count} candidates</span>
              </>
            )}
            {row.prompt_tokens != null && (
              <>
                <span className="text-stone-400">·</span>
                <span>
                  {row.prompt_tokens.toLocaleString()} prompt
                  {row.completion_tokens != null && (
                    <> / {row.completion_tokens.toLocaleString()} completion</>
                  )}{" "}
                  tokens
                </span>
              </>
            )}
          </div>

          {/* Attach chips */}
          {(clientName || campaignName) && (
            <div className="flex items-center flex-wrap gap-2 mb-6">
              {clientName && (
                <span className="inline-flex items-center gap-2 font-mono-x text-[10px] uppercase tracking-widest text-stone-700 border border-stone-300 bg-white px-2.5 py-1">
                  <span className="text-stone-500 font-normal">Client</span>
                  <span className="font-bold">{clientName}</span>
                </span>
              )}
              {campaignName && (
                <span className="inline-flex items-center gap-2 font-mono-x text-[10px] uppercase tracking-widest text-stone-700 border border-stone-300 bg-white px-2.5 py-1">
                  <span className="text-stone-500 font-normal">Campaign</span>
                  <span className="font-bold">{campaignName}</span>
                </span>
              )}
            </div>
          )}

          {/* Original inputs card */}
          <details className="border border-stone-200 bg-white card-shadow p-5 mb-6 open:pb-6">
            <summary className="cursor-pointer flex items-center justify-between gap-2 font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold hover-dark">
              <span>Original inputs</span>
              <span className="font-normal">click to expand</span>
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-1">
                  ICP Brief
                </div>
                <p className="font-mono-x text-xs text-stone-800 leading-relaxed whitespace-pre-wrap">
                  {row.icp_brief}
                </p>
              </div>
              {row.offer && (
                <div>
                  <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-1">
                    Offer
                  </div>
                  <p className="font-mono-x text-xs text-stone-800 leading-relaxed whitespace-pre-wrap">
                    {row.offer}
                  </p>
                </div>
              )}
              <div>
                <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-1">
                  Geography
                </div>
                <p className="font-mono-x text-xs text-stone-800">
                  {row.geography}
                </p>
              </div>
            </div>
          </details>

          <AudienceSpecView
            spec={row.generated_spec}
            timestamp={`Spec ${row.id.slice(0, 8)}`}
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
        href="/audiences/history"
        className="font-mono-x text-[11px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition"
      >
        ← Back to Audience History
      </Link>
    </div>
  );
}

function MissingSpecPlaceholder({ row }: { row: SpecDetailRow }) {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="max-w-4xl mx-auto px-5 py-10 md:px-8 md:py-14">
        <BackLink />
        <div className="border border-stone-300 bg-white p-8 text-center card-shadow">
          <div className="font-display text-lg font-bold text-stone-900 mb-2">
            This spec row is missing its generated payload.
          </div>
          <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">
            id {row.id} · saved{" "}
            {new Date(row.created_at).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
