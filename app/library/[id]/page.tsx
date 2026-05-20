// Library detail — server. RLS-scoped fetch + joined client name + source
// campaign brand_name. Hands the row to the client component for player +
// actions.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/app/_lib/supabase/server";
import { refreshSignedUrl, shouldRefreshSignedUrl } from "@/app/_lib/higgsfield";
import type { GeneratedAsset } from "@/app/_lib/asset-types";
import { LibraryDetailClient } from "./LibraryDetailClient";

export const dynamic = "force-dynamic";

export default async function LibraryAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_assets")
    .select("*, clients(name), campaigns(brand_name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[library/detail] select failed:", error);
  }
  if (!data) notFound();

  let asset = data as GeneratedAsset & {
    clients: { name: string | null } | { name: string | null }[] | null;
    campaigns:
      | { brand_name: string | null }
      | { brand_name: string | null }[]
      | null;
  };

  // Server-side signed URL refresh if approaching the 7-day expiry.
  if (
    asset.status === "completed" &&
    shouldRefreshSignedUrl(
      asset.completed_at,
      asset.storage_path,
      asset.storage_url,
    )
  ) {
    const fresh = await refreshSignedUrl(asset.storage_path!, supabase);
    if (fresh) {
      const { data: updated } = await supabase
        .from("generated_assets")
        .update({ storage_url: fresh, updated_at: new Date().toISOString() })
        .eq("id", asset.id)
        .select("*, clients(name), campaigns(brand_name)")
        .single();
      if (updated) asset = updated as typeof asset;
    }
  }

  const clientName = Array.isArray(asset.clients)
    ? (asset.clients[0]?.name ?? null)
    : (asset.clients?.name ?? null);
  const campaignBrand = Array.isArray(asset.campaigns)
    ? (asset.campaigns[0]?.brand_name ?? null)
    : (asset.campaigns?.brand_name ?? null);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <div className="max-w-6xl mx-auto px-5 py-8 md:px-8 md:py-10">
        <div className="mb-6">
          <Link
            href="/library"
            className="font-mono text-[11px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition"
          >
            ← Back to Library
          </Link>
        </div>
        <LibraryDetailClient
          asset={asset}
          clientName={clientName}
          campaignBrand={campaignBrand}
        />
      </div>
    </div>
  );
}
