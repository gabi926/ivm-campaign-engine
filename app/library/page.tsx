// Content Library — server entry. Auth-gated via root layout. Reads URL
// search params and hands initial filters to LibraryGrid (client component).
// All filter interactivity + asset fetching lives in LibraryGrid.

import { LibraryGrid } from "./LibraryGrid";
import type { AssetStatus, AssetType } from "@/app/_lib/asset-types";

export const dynamic = "force-dynamic";

const ASSET_TYPES: AssetType[] = ["image", "video"];
const STATUSES: AssetStatus[] = ["pending", "processing", "completed", "failed"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const clientId =
    typeof sp.clientId === "string" && UUID_RE.test(sp.clientId)
      ? sp.clientId
      : null;
  const campaignId =
    typeof sp.campaignId === "string" && UUID_RE.test(sp.campaignId)
      ? sp.campaignId
      : null;
  const type =
    typeof sp.type === "string" && ASSET_TYPES.includes(sp.type as AssetType)
      ? (sp.type as AssetType)
      : null;
  const status =
    typeof sp.status === "string" && STATUSES.includes(sp.status as AssetStatus)
      ? (sp.status as AssetStatus)
      : null;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="max-w-7xl mx-auto px-5 py-10 md:px-8 md:py-14">
        <header className="mb-8 md:mb-10 border-b border-stone-300 pb-6">
          <h1 className="font-mono text-2xl md:text-3xl font-bold tracking-tight">
            Content Library
          </h1>
          <p className="font-mono text-xs md:text-sm text-stone-500 mt-2">
            All assets generated across your campaigns.
          </p>
        </header>

        <LibraryGrid
          initialClientId={clientId}
          initialCampaignId={campaignId}
          initialType={type}
          initialStatus={status}
        />
      </div>
    </div>
  );
}
