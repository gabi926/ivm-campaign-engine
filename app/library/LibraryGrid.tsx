"use client";

// LibraryGrid — filterable grid of generated_assets. All client-side: fetches
// /api/assets/list with the current filter state, derives client/campaign
// dropdowns from the result set, supports fullscreen preview + delete confirm.
// URL state is synced via router.replace so filters persist on reload.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import type {
  AssetListItem,
  AssetStatus,
  AssetType,
} from "@/app/_lib/asset-types";

const ASSET_TYPES: readonly AssetType[] = ["image", "video"] as const;
const STATUSES: readonly AssetStatus[] = [
  "completed",
  "processing",
  "pending",
  "failed",
] as const;

type ClientOption = { id: string; name: string };
type CampaignOption = { id: string };

export function LibraryGrid({
  initialClientId,
  initialCampaignId,
  initialType,
  initialStatus,
}: {
  initialClientId: string | null;
  initialCampaignId: string | null;
  initialType: AssetType | null;
  initialStatus: AssetStatus | null;
}) {
  const router = useRouter();
  const search = useSearchParams();

  const [clientId, setClientId] = useState<string | null>(initialClientId);
  const [campaignId, setCampaignId] = useState<string | null>(
    initialCampaignId,
  );
  const [type, setType] = useState<AssetType | null>(initialType);
  const [status, setStatus] = useState<AssetStatus | null>(initialStatus);

  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<{
    type: AssetType;
    url: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<AssetListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Sync URL when filters change.
  useEffect(() => {
    const params = new URLSearchParams();
    if (clientId) params.set("clientId", clientId);
    if (campaignId) params.set("campaignId", campaignId);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    const next = params.toString();
    const current = search?.toString() ?? "";
    if (next !== current) {
      router.replace(`/library${next ? `?${next}` : ""}`, { scroll: false });
    }
  }, [clientId, campaignId, type, status, router, search]);

  // Fetch on filter change.
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (clientId) params.set("clientId", clientId);
      if (campaignId) params.set("campaignId", campaignId);
      if (type) params.set("assetType", type);
      if (status) params.set("status", status);
      const res = await fetch(`/api/assets/list?${params.toString()}`);
      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; assets?: AssetListItem[]; error?: string }
        | null;
      if (!res.ok || !data?.success || !Array.isArray(data.assets)) {
        throw new Error(data?.error ?? `List failed (${res.status})`);
      }
      setAssets(data.assets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assets");
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, campaignId, type, status]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  // Derive dropdown options from the (unfiltered-by-this-axis) result set.
  // For simplicity we derive from the current result list — the user sees only
  // clients/campaigns that have at least one asset, which is what they want.
  const clientOptions: ClientOption[] = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assets) {
      if (a.client_id) {
        map.set(a.client_id, a.client_name ?? "(unnamed client)");
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assets]);

  const campaignOptions: CampaignOption[] = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) {
      if (a.campaign_id && (!clientId || a.client_id === clientId)) {
        set.add(a.campaign_id);
      }
    }
    return Array.from(set).map((id) => ({ id }));
  }, [assets, clientId]);

  const onDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/assets/${deleting.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? `Delete failed (${res.status})`);
      }
      setAssets((prev) => prev.filter((a) => a.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      {/* Filter bar */}
      <div className="sticky top-[57px] z-30 -mx-5 md:-mx-8 px-5 md:px-8 py-3 mb-6 bg-stone-100/95 backdrop-blur border-b border-stone-200 flex flex-wrap items-center gap-3">
        <FilterSelect
          label="Client"
          value={clientId ?? ""}
          options={[
            { value: "", label: "All clients" },
            ...clientOptions.map((c) => ({ value: c.id, label: c.name })),
          ]}
          onChange={(v) => {
            setClientId(v || null);
            setCampaignId(null);
          }}
        />
        <FilterSelect
          label="Campaign"
          value={campaignId ?? ""}
          options={[
            { value: "", label: "All campaigns" },
            ...campaignOptions.map((c) => ({
              value: c.id,
              label: `${c.id.slice(0, 8)}…`,
            })),
          ]}
          onChange={(v) => setCampaignId(v || null)}
        />
        <ChipGroup<AssetType | null>
          label="Type"
          value={type}
          options={[
            { value: null, label: "All" },
            ...ASSET_TYPES.map((t) => ({ value: t, label: t })),
          ]}
          onChange={setType}
        />
        <ChipGroup<AssetStatus | null>
          label="Status"
          value={status}
          options={[
            { value: null, label: "All" },
            ...STATUSES.map((s) => ({ value: s, label: s })),
          ]}
          onChange={setStatus}
        />
      </div>

      {error && (
        <div className="mb-6 border border-red-300 bg-red-50 px-4 py-3 font-mono text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="border border-stone-300 bg-white p-12 text-center font-mono text-sm text-stone-500 flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Loading assets…
        </div>
      ) : assets.length === 0 ? (
        <div className="border border-stone-300 bg-white p-12 text-center">
          <div className="font-mono text-sm text-stone-700 mb-3">
            No assets yet.
          </div>
          <p className="font-mono text-xs text-stone-500 mb-6">
            Generate your first one from a saved campaign.
          </p>
          <Link
            href="/history"
            className="inline-block font-mono text-[11px] uppercase tracking-widest font-bold text-stone-900 border border-stone-900 px-4 py-2 hover:bg-stone-900 hover:text-white transition"
          >
            Go to campaign history
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((a) => (
            <AssetCard
              key={a.id}
              asset={a}
              onPreview={(url) =>
                setPreview({ type: a.asset_type, url })
              }
              onDelete={() => setDeleting(a)}
            />
          ))}
        </div>
      )}

      {preview && (
        <FullscreenViewer
          type={preview.type}
          url={preview.url}
          onClose={() => setPreview(null)}
        />
      )}

      {deleting && (
        <DeleteConfirm
          asset={deleting}
          busy={deleteBusy}
          onConfirm={onDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-stone-300 bg-white px-3 py-1.5 font-mono text-[11px] text-stone-900 focus:outline-none focus:border-stone-900"
      >
        {options.map((o) => (
          <option key={o.value || "_all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChipGroup<T extends string | null>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
        {label}
      </span>
      <div className="inline-flex border border-stone-300">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.label}
              onClick={() => onChange(o.value)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition border-r border-stone-200 last:border-r-0 ${
                active
                  ? "bg-stone-900 text-white"
                  : "bg-white text-stone-600 hover:text-stone-900"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function AssetCard({
  asset,
  onPreview,
  onDelete,
}: {
  asset: AssetListItem;
  onPreview: (url: string) => void;
  onDelete: () => void;
}) {
  const Icon = asset.asset_type === "image" ? ImageIcon : Film;
  const previewUrl = asset.storage_url;
  const thumb = asset.thumbnail_url ?? asset.storage_url;
  const created = new Date(asset.created_at);

  return (
    <div className="group relative border border-stone-300 bg-white overflow-hidden hover:border-stone-700 transition">
      <Link
        href={`/library/${asset.id}`}
        className="block aspect-square bg-stone-100 relative"
        prefetch={false}
      >
        {asset.status === "completed" && thumb ? (
          asset.asset_type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt={asset.prompt.slice(0, 80)}
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb}
                alt="Video poster"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <div className="w-0 h-0 border-l-[14px] border-l-white border-y-[10px] border-y-transparent" />
              </div>
            </>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon size={28} className="text-stone-400" />
          </div>
        )}
        {asset.status !== "completed" && (
          <span className="absolute top-2 left-2 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest bg-white/90 border border-stone-300 text-stone-700">
            {asset.status}
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition">
          <div className="font-mono text-[10px] text-white truncate">
            {asset.prompt}
          </div>
        </div>
      </Link>

      {previewUrl && asset.status === "completed" && (
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={(e) => {
              e.preventDefault();
              onPreview(previewUrl);
            }}
            className="inline-flex items-center justify-center w-7 h-7 bg-white/95 border border-stone-300 hover:border-stone-900 transition"
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            <Icon size={12} className="text-stone-800" />
          </button>
          <a
            href={previewUrl}
            download
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center w-7 h-7 bg-white/95 border border-stone-300 hover:border-stone-900 transition"
            title="Download"
          >
            <Download size={12} className="text-stone-800" />
          </a>
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="inline-flex items-center justify-center w-7 h-7 bg-white/95 border border-stone-300 hover:border-red-700 transition"
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 size={12} className="text-stone-800" />
          </button>
        </div>
      )}

      <div className="px-3 py-2 border-t border-stone-200 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-stone-500">
          <Icon size={11} />
          {asset.asset_type}
        </span>
        <span className="font-mono text-[10px] text-stone-400">
          {created.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function FullscreenViewer({
  type,
  url,
  onClose,
}: {
  type: AssetType;
  url: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white transition"
        aria-label="Close"
      >
        <X size={28} />
      </button>
      <div
        className="max-w-5xl max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            className="max-h-[85vh] max-w-full object-contain"
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            className="max-h-[85vh] max-w-full"
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function DeleteConfirm({
  asset,
  busy,
  onConfirm,
  onCancel,
}: {
  asset: AssetListItem;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-white border border-stone-900 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-mono text-[12px] uppercase tracking-widest font-bold text-stone-900 mb-3">
          Delete asset
        </h3>
        <p className="font-mono text-[12px] text-stone-700 mb-2">
          This removes the {asset.asset_type} and its storage file. This action
          cannot be undone.
        </p>
        <p className="font-mono text-[10px] text-stone-500 mb-6 truncate">
          {asset.prompt}
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-700 bg-red-700 font-mono text-[10px] uppercase tracking-widest font-bold text-white hover:bg-red-800 transition disabled:opacity-50"
          >
            {busy && <Loader2 size={12} className="animate-spin" />}
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
