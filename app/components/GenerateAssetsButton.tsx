"use client";

// Saved-campaign asset generation panel. Renders below CampaignReportView on
// /history/[id]. For each ad block in copy_variations, exposes two CTAs —
// 🖼 Generate Image and 🎬 Generate Video — that open an inline modal,
// submit to /api/assets/generate, then poll /api/assets/[id]/status every 5s
// until completion. Completed assets render as a thumbnail with click-to-
// fullscreen + download.

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Film, Image as ImageIcon, Loader2, X } from "lucide-react";
import type {
  AdBlockLike,
  AssetType,
  GenerateAssetRequest,
  GeneratedAsset,
  GenerationMode,
} from "@/app/_lib/asset-types";

const ACCENT = "#d4ff3d";
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 60; // 5 minutes

interface PendingState {
  assetId: string;
  polls: number;
}

interface CompletedState {
  assetId: string;
  storage_url: string;
  thumbnail_url: string | null;
}

interface FailedState {
  error: string;
}

type SlotKey = `${number}:${AssetType}`;

interface SlotState {
  pending?: PendingState;
  completed?: CompletedState;
  failed?: FailedState;
}

interface ModalState {
  blockIdx: number;
  assetType: AssetType;
  prompt: string;
  duration: number;
  aspectRatio: string;
}

const DEFAULT_VIDEO_ASPECT = "16:9";
const VIDEO_ASPECTS = ["16:9", "9:16", "1:1"] as const;
const VIDEO_DURATIONS = [5, 10] as const;

function slotKey(blockIdx: number, assetType: AssetType): SlotKey {
  return `${blockIdx}:${assetType}`;
}

function defaultPrompt(b: AdBlockLike): string {
  // Try the most "visual" field first, fall through to copy fields.
  const candidates = [
    b.visual_direction,
    b.primary_text,
    b.body,
    b.headline,
    b.angle,
  ];
  return (
    candidates
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find((v) => v.length > 0) ?? ""
  );
}

function defaultMode(assetType: AssetType): GenerationMode {
  return assetType === "image" ? "text-to-image" : "text-to-video";
}

export function GenerateAssetsButton({
  campaignId,
  clientId,
  copyVariations,
}: {
  campaignId: string;
  clientId: string | null;
  copyVariations: AdBlockLike[];
}) {
  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>({});
  const [modal, setModal] = useState<ModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fullscreen, setFullscreen] = useState<{
    type: AssetType;
    url: string;
  } | null>(null);

  // One timer per slot. We use a ref keyed by SlotKey so React state updates
  // don't tear down the polling loop.
  const timers = useRef<Record<SlotKey, ReturnType<typeof setInterval> | null>>(
    {},
  );

  useEffect(() => {
    // Snapshot the ref so the cleanup function references the same record we
    // mounted with (react-hooks/exhaustive-deps guidance).
    const timersRef = timers.current;
    return () => {
      for (const k of Object.keys(timersRef) as SlotKey[]) {
        const t = timersRef[k];
        if (t) clearInterval(t);
      }
    };
  }, []);

  const updateSlot = useCallback(
    (key: SlotKey, patch: Partial<SlotState>) => {
      setSlots((prev) => ({
        ...prev,
        [key]: { ...(prev[key] ?? {}), ...patch },
      }));
    },
    [],
  );

  const stopPolling = useCallback((key: SlotKey) => {
    const t = timers.current[key];
    if (t) {
      clearInterval(t);
      timers.current[key] = null;
    }
  }, []);

  const startPolling = useCallback(
    (key: SlotKey, assetId: string) => {
      stopPolling(key);
      updateSlot(key, {
        pending: { assetId, polls: 0 },
        completed: undefined,
        failed: undefined,
      });

      let attempts = 0;
      timers.current[key] = setInterval(async () => {
        attempts += 1;
        try {
          const res = await fetch(`/api/assets/${assetId}/status`);
          const data = (await res.json().catch(() => null)) as
            | { success?: boolean; asset?: GeneratedAsset; error?: string }
            | null;
          const asset = data?.asset;
          if (!res.ok || !asset) {
            throw new Error(data?.error ?? `Status ${res.status}`);
          }
          if (asset.status === "completed" && asset.storage_url) {
            stopPolling(key);
            updateSlot(key, {
              pending: undefined,
              completed: {
                assetId: asset.id,
                storage_url: asset.storage_url,
                thumbnail_url: asset.thumbnail_url,
              },
            });
            return;
          }
          if (asset.status === "failed") {
            stopPolling(key);
            updateSlot(key, {
              pending: undefined,
              failed: {
                error:
                  asset.error_message ?? "Generation failed (unknown error)",
              },
            });
            return;
          }
          // still processing — bump count
          updateSlot(key, {
            pending: { assetId, polls: attempts },
          });
          if (attempts >= POLL_MAX_ATTEMPTS) {
            stopPolling(key);
            updateSlot(key, {
              pending: undefined,
              failed: {
                error:
                  "Still processing after 5 minutes — open the Library tab to check status.",
              },
            });
          }
        } catch (e) {
          stopPolling(key);
          updateSlot(key, {
            pending: undefined,
            failed: {
              error: e instanceof Error ? e.message : "Status poll failed",
            },
          });
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, updateSlot],
  );

  const openModal = (blockIdx: number, assetType: AssetType) => {
    const block = copyVariations[blockIdx] ?? {};
    setModal({
      blockIdx,
      assetType,
      prompt: defaultPrompt(block),
      duration: 5,
      aspectRatio: assetType === "video" ? DEFAULT_VIDEO_ASPECT : "1:1",
    });
  };

  const closeModal = () => {
    if (submitting) return;
    setModal(null);
  };

  const submitGenerate = async () => {
    if (!modal) return;
    const trimmed = modal.prompt.trim();
    if (trimmed.length === 0) return;

    setSubmitting(true);
    const key = slotKey(modal.blockIdx, modal.assetType);
    const payload: GenerateAssetRequest = {
      campaign_id: campaignId,
      client_id: clientId,
      ad_block_index: modal.blockIdx,
      asset_type: modal.assetType,
      generation_mode: defaultMode(modal.assetType),
      prompt: trimmed,
      aspect_ratio: modal.aspectRatio,
      ...(modal.assetType === "video"
        ? { duration_seconds: modal.duration }
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
        throw new Error(data?.error ?? `Generate failed (${res.status})`);
      }
      startPolling(key, data.asset_id);
      setModal(null);
    } catch (e) {
      updateSlot(key, {
        failed: { error: e instanceof Error ? e.message : "Generate failed" },
        pending: undefined,
      });
      setModal(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (!copyVariations || copyVariations.length === 0) return null;

  return (
    <>
      <section className="mt-10 border border-stone-300 bg-white">
        <header className="border-b border-stone-300 px-5 py-4 flex items-center gap-3">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: ACCENT }}
          />
          <h2 className="font-mono text-[12px] uppercase tracking-widest font-bold text-stone-900">
            Generate Assets
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
            Higgsfield AI · per ad block
          </span>
        </header>

        <ul className="divide-y divide-stone-200">
          {copyVariations.map((block, idx) => {
            const imgKey = slotKey(idx, "image");
            const vidKey = slotKey(idx, "video");
            const headline =
              (typeof block.headline === "string" && block.headline.trim()) ||
              `Ad block ${idx + 1}`;
            return (
              <li
                key={idx}
                className="px-5 py-4 flex items-center gap-4 flex-wrap"
              >
                <div className="flex-1 min-w-[180px]">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-stone-500 mb-1">
                    Block {idx + 1}
                  </div>
                  <div
                    className="font-mono text-[13px] text-stone-800 truncate max-w-md"
                    title={headline}
                  >
                    {headline}
                  </div>
                </div>

                <SlotControls
                  state={slots[imgKey]}
                  assetType="image"
                  onGenerate={() => openModal(idx, "image")}
                  onPreview={(url) => setFullscreen({ type: "image", url })}
                  onRetry={() => openModal(idx, "image")}
                />

                <SlotControls
                  state={slots[vidKey]}
                  assetType="video"
                  onGenerate={() => openModal(idx, "video")}
                  onPreview={(url) => setFullscreen({ type: "video", url })}
                  onRetry={() => openModal(idx, "video")}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {modal && (
        <GenerateModal
          modal={modal}
          submitting={submitting}
          onChange={(patch) =>
            setModal((m) => (m ? { ...m, ...patch } : m))
          }
          onSubmit={submitGenerate}
          onCancel={closeModal}
        />
      )}

      {fullscreen && (
        <FullscreenViewer
          type={fullscreen.type}
          url={fullscreen.url}
          onClose={() => setFullscreen(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Slot — one of (image | video) controls for a single ad block.
// ---------------------------------------------------------------------------
function SlotControls({
  state,
  assetType,
  onGenerate,
  onPreview,
  onRetry,
}: {
  state: SlotState | undefined;
  assetType: AssetType;
  onGenerate: () => void;
  onPreview: (url: string) => void;
  onRetry: () => void;
}) {
  const Icon = assetType === "image" ? ImageIcon : Film;
  const label = assetType === "image" ? "Image" : "Video";

  if (state?.completed) {
    const url = state.completed.storage_url;
    const thumb = state.completed.thumbnail_url ?? url;
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() =>
            onPreview(state.completed!.storage_url)
          }
          className="relative w-16 h-16 border border-stone-300 bg-stone-100 overflow-hidden hover:border-stone-700 transition"
          title="Click to view"
        >
          {assetType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt={label}
              className="w-full h-full object-cover"
            />
          ) : state.completed.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.completed.thumbnail_url}
              alt="Video poster"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-stone-200">
              <Film size={20} className="text-stone-500" />
            </div>
          )}
          {assetType === "video" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-0 h-0 border-l-[10px] border-l-white border-y-[7px] border-y-transparent" />
            </div>
          )}
        </button>
        <a
          href={url}
          download
          className="inline-flex items-center justify-center w-7 h-7 border border-stone-300 hover:border-stone-700 transition"
          title="Download"
        >
          <Download size={12} className="text-stone-700" />
        </a>
      </div>
    );
  }

  if (state?.pending) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 border border-stone-300 bg-stone-50 font-mono text-[10px] uppercase tracking-widest text-stone-600">
        <Loader2 size={12} className="animate-spin" />
        Generating {label.toLowerCase()}…
      </div>
    );
  }

  if (state?.failed) {
    return (
      <div className="inline-flex items-center gap-2">
        <span
          className="px-3 py-2 border border-red-300 bg-red-50 font-mono text-[10px] uppercase tracking-widest text-red-700 max-w-[260px] truncate"
          title={state.failed.error}
        >
          ⚠ {state.failed.error}
        </span>
        <button
          onClick={onRetry}
          className="px-3 py-2 border border-stone-900 bg-white font-mono text-[10px] uppercase tracking-widest font-bold text-stone-900 hover:bg-stone-900 hover:text-white transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onGenerate}
      className="inline-flex items-center gap-2 px-4 py-2.5 border border-stone-900 bg-white font-mono text-[10px] uppercase tracking-widest font-bold text-stone-900 hover:bg-stone-900 hover:text-white transition"
    >
      <Icon size={14} />
      Generate {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// GenerateModal — inline prompt editor + video params
// ---------------------------------------------------------------------------
function GenerateModal({
  modal,
  submitting,
  onChange,
  onSubmit,
  onCancel,
}: {
  modal: ModalState;
  submitting: boolean;
  onChange: (patch: Partial<ModalState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white border border-stone-900 max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-[12px] uppercase tracking-widest font-bold text-stone-900">
            Generate {modal.assetType === "image" ? "Image" : "Video"} · Block{" "}
            {modal.blockIdx + 1}
          </h3>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="text-stone-500 hover:text-stone-900 transition disabled:opacity-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <label className="block font-mono text-[10px] uppercase tracking-widest text-stone-500 mb-1">
          Prompt
        </label>
        <textarea
          value={modal.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          disabled={submitting}
          rows={4}
          className="w-full border border-stone-300 bg-white px-3 py-2 font-mono text-[12px] text-stone-900 focus:outline-none focus:border-stone-900 disabled:opacity-50"
          placeholder="Describe the asset…"
        />

        {modal.assetType === "video" && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-stone-500 mb-1">
                Duration
              </label>
              <select
                value={modal.duration}
                onChange={(e) =>
                  onChange({ duration: Number(e.target.value) })
                }
                disabled={submitting}
                className="w-full border border-stone-300 bg-white px-3 py-2 font-mono text-[12px] text-stone-900 focus:outline-none focus:border-stone-900 disabled:opacity-50"
              >
                {VIDEO_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-stone-500 mb-1">
                Aspect ratio
              </label>
              <select
                value={modal.aspectRatio}
                onChange={(e) => onChange({ aspectRatio: e.target.value })}
                disabled={submitting}
                className="w-full border border-stone-300 bg-white px-3 py-2 font-mono text-[12px] text-stone-900 focus:outline-none focus:border-stone-900 disabled:opacity-50"
              >
                {VIDEO_ASPECTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || modal.prompt.trim().length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 border border-stone-900 bg-white font-mono text-[10px] uppercase tracking-widest font-bold text-stone-900 hover:bg-stone-900 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={
              !submitting && modal.prompt.trim().length > 0
                ? { backgroundColor: ACCENT, borderColor: "#a3cc1f" }
                : undefined
            }
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            {submitting ? "Submitting…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FullscreenViewer — image or video lightbox
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
            alt="Generated"
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
