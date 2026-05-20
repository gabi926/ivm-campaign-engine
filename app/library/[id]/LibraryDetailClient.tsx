"use client";

// Library detail — client side. Player + side panel (prompt, mode, cost,
// metadata) + actions: Download, Delete, Regenerate.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import type {
  GenerateAssetRequest,
  GeneratedAsset,
} from "@/app/_lib/asset-types";

export function LibraryDetailClient({
  asset,
  clientName,
  campaignBrand,
}: {
  asset: GeneratedAsset;
  clientName: string | null;
  campaignBrand: string | null;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (!confirm("Delete this asset? This cannot be undone.")) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.success) {
        throw new Error(data?.error ?? `Delete failed (${res.status})`);
      }
      router.push("/library");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  };

  const onRegenerate = async () => {
    if (!asset.campaign_id) {
      setError("Cannot regenerate — original campaign reference is missing.");
      return;
    }
    setRegenerating(true);
    setError(null);
    const payload: GenerateAssetRequest = {
      campaign_id: asset.campaign_id,
      client_id: asset.client_id,
      ad_block_index: asset.ad_block_index,
      asset_type: asset.asset_type,
      generation_mode: asset.generation_mode,
      prompt: asset.prompt,
      reference_image_ids: asset.reference_image_ids,
      ...(typeof asset.metadata?.aspect_ratio === "string"
        ? { aspect_ratio: asset.metadata.aspect_ratio }
        : {}),
      ...(typeof asset.metadata?.resolution === "string"
        ? { resolution: asset.metadata.resolution }
        : {}),
      ...(typeof asset.metadata?.duration_seconds === "number"
        ? { duration_seconds: asset.metadata.duration_seconds }
        : {}),
    };
    try {
      const res = await fetch("/api/assets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; asset_id?: string; error?: string }
        | null;
      if (!res.ok || !data?.success || !data.asset_id) {
        throw new Error(data?.error ?? `Regenerate failed (${res.status})`);
      }
      router.push(`/library/${data.asset_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerate failed");
      setRegenerating(false);
    }
  };

  const created = new Date(asset.created_at);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main media */}
      <div className="lg:col-span-2 border border-stone-300 bg-white">
        <div className="bg-stone-900 flex items-center justify-center min-h-[300px]">
          {asset.status === "completed" && asset.storage_url ? (
            asset.asset_type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.storage_url}
                alt=""
                className="max-h-[80vh] max-w-full object-contain"
              />
            ) : (
              <video
                src={asset.storage_url}
                controls
                className="max-h-[80vh] max-w-full"
                poster={asset.thumbnail_url ?? undefined}
              />
            )
          ) : asset.status === "failed" ? (
            <div className="p-10 text-center font-mono text-sm text-red-300">
              ⚠ {asset.error_message ?? "Generation failed"}
            </div>
          ) : (
            <div className="p-10 text-center font-mono text-sm text-stone-300 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {asset.status}…
            </div>
          )}
        </div>
      </div>

      {/* Side panel */}
      <aside className="border border-stone-300 bg-white p-5 self-start">
        <header className="mb-4 pb-3 border-b border-stone-200">
          <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500 mb-1">
            {asset.asset_type} · {asset.generation_mode}
          </div>
          <div className="font-mono text-[12px] text-stone-800">
            {clientName ?? "(unattached)"}
          </div>
          {asset.campaign_id && (
            <Link
              href={`/history/${asset.campaign_id}`}
              className="font-mono text-[11px] text-stone-600 underline hover:text-stone-900 transition"
            >
              Source campaign: {campaignBrand ?? asset.campaign_id.slice(0, 8)}
            </Link>
          )}
          <div className="font-mono text-[10px] text-stone-400 mt-1">
            {created.toLocaleString()}
          </div>
        </header>

        <KV label="Status" value={<StatusPill status={asset.status} />} />
        <KV label="Prompt" value={asset.prompt} multiline />
        {asset.metadata?.aspect_ratio && (
          <KV
            label="Aspect ratio"
            value={String(asset.metadata.aspect_ratio)}
          />
        )}
        {asset.metadata?.resolution && (
          <KV label="Resolution" value={String(asset.metadata.resolution)} />
        )}
        {typeof asset.metadata?.duration_seconds === "number" && (
          <KV
            label="Duration"
            value={`${asset.metadata.duration_seconds}s`}
          />
        )}
        {asset.cost_credits !== null && asset.cost_credits !== undefined && (
          <KV label="Cost" value={`${asset.cost_credits} credits`} />
        )}
        {asset.error_message && (
          <KV label="Error" value={asset.error_message} multiline />
        )}

        <details className="mt-4">
          <summary className="font-mono text-[10px] uppercase tracking-widest text-stone-500 cursor-pointer hover:text-stone-900">
            Raw metadata
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto text-[10px] bg-stone-50 border border-stone-200 p-2 font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(asset.metadata ?? {}, null, 2)}
          </pre>
        </details>

        {error && (
          <div className="mt-4 border border-red-300 bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {asset.storage_url && asset.status === "completed" && (
            <a
              href={asset.storage_url}
              download
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-stone-900 bg-white font-mono text-[10px] uppercase tracking-widest font-bold text-stone-900 hover:bg-stone-900 hover:text-white transition"
            >
              <Download size={12} /> Download
            </a>
          )}
          {asset.campaign_id && (
            <button
              onClick={onRegenerate}
              disabled={regenerating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-stone-900 bg-white font-mono text-[10px] uppercase tracking-widest font-bold text-stone-900 hover:bg-stone-900 hover:text-white transition disabled:opacity-50"
            >
              {regenerating ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {regenerating ? "Regenerating…" : "Regenerate with same prompt"}
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-red-300 bg-white font-mono text-[10px] uppercase tracking-widest font-bold text-red-700 hover:bg-red-700 hover:text-white transition disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            {deleting ? "Deleting…" : "Delete asset"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function KV({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="mb-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500 mb-0.5">
        {label}
      </div>
      <div
        className={`font-mono text-[12px] text-stone-800 ${multiline ? "whitespace-pre-wrap" : "truncate"}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: GeneratedAsset["status"] }) {
  const palette: Record<GeneratedAsset["status"], string> = {
    pending: "bg-stone-100 text-stone-700 border-stone-300",
    processing: "bg-amber-50 text-amber-800 border-amber-300",
    completed: "bg-lime-50 text-lime-900 border-lime-300",
    failed: "bg-red-50 text-red-700 border-red-300",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 border font-mono text-[10px] uppercase tracking-widest ${palette[status]}`}
    >
      {status}
    </span>
  );
}
