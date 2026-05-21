"use client";

// Inline asset-generation control. Lives INSIDE each image-concept and
// short-video-concept card in CampaignReportView. Replaces the old bottom-of-
// page GenerateAssetsButton panel from Chunk B Lite.
//
// One instance per slot. Owns its own state — collapsed CTA → expanded form
// → pending pill → completed thumbnail (with fullscreen + download) → optional
// failure state with retry.
//
// Renders nothing when campaignId is undefined (the fresh-generation home page
// surface has no persisted campaign id; the user gets generate buttons once
// they re-open the campaign from /history).

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Film,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Sparkles,
  X,
} from "lucide-react";
import type {
  AssetType,
  GenerateAssetRequest,
  GeneratedAsset,
  GenerationMode,
} from "@/app/_lib/asset-types";

const ACCENT = "#d4ff3d";
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 60; // ≈5 minutes; covers Kling 3.0 typical run time

const IMAGE_ASPECTS = ["1:1", "16:9", "9:16", "4:5"] as const;
const VIDEO_ASPECTS = ["9:16", "16:9", "1:1"] as const;
const VIDEO_DURATIONS = [15] as const; // Kling 3.0 fixed at 15s for v1.1

interface InlineAssetGenerateProps {
  campaignId: string | undefined;
  clientId: string | null;
  adBlockIndex: number;
  assetType: AssetType;
  /** Generation mode used on submit. */
  initialMode: GenerationMode;
  /** Pre-filled (editable) prompt. */
  initialPrompt: string;
  /** Default aspect ratio for the form. */
  defaultAspectRatio?: string;
  /** Default duration in seconds (video only). */
  defaultDuration?: number;
}

type Phase = "idle" | "editing" | "pending" | "completed" | "failed";

interface CompletedState {
  assetId: string;
  storage_url: string;
  thumbnail_url: string | null;
}

export function InlineAssetGenerate({
  campaignId,
  clientId,
  adBlockIndex,
  assetType,
  initialMode,
  initialPrompt,
  defaultAspectRatio,
  defaultDuration,
}: InlineAssetGenerateProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspect, setAspect] = useState<string>(
    defaultAspectRatio ?? (assetType === "video" ? "9:16" : "1:1"),
  );
  const [duration, setDuration] = useState<number>(
    defaultDuration ?? 15,
  );
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<CompletedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const t = timerRef;
    return () => {
      if (t.current) clearInterval(t.current);
    };
  }, []);

  // Renders nothing on surfaces without a saved campaign id.
  if (!campaignId) return null;

  const startPolling = (assetId: string) => {
    stopPolling();
    let attempts = 0;
    timerRef.current = setInterval(async () => {
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
          stopPolling();
          setCompleted({
            assetId: asset.id,
            storage_url: asset.storage_url,
            thumbnail_url: asset.thumbnail_url,
          });
          setPhase("completed");
          return;
        }
        if (asset.status === "failed") {
          stopPolling();
          setError(asset.error_message ?? "Generation failed");
          setPhase("failed");
          return;
        }
        if (attempts >= POLL_MAX_ATTEMPTS) {
          stopPolling();
          setError(
            "Still processing after 5 minutes — open Library for status.",
          );
          setPhase("failed");
        }
      } catch (e) {
        stopPolling();
        setError(e instanceof Error ? e.message : "Status poll failed");
        setPhase("failed");
      }
    }, POLL_INTERVAL_MS);
  };

  const submit = async () => {
    const trimmed = prompt.trim();
    if (trimmed.length === 0) return;

    setSubmitting(true);
    setError(null);

    const payload: GenerateAssetRequest = {
      campaign_id: campaignId,
      client_id: clientId,
      ad_block_index: adBlockIndex,
      asset_type: assetType,
      generation_mode: initialMode,
      prompt: trimmed,
      aspect_ratio: aspect,
      ...(assetType === "video" ? { duration_seconds: duration } : {}),
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
      setPhase("pending");
      startPolling(data.asset_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
      setPhase("failed");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------- render --------------------
  const Icon = assetType === "image" ? ImageIcon : Film;
  const label = assetType === "image" ? "Image" : "Video";

  if (phase === "completed" && completed) {
    return (
      <>
        <CompletedCard
          assetType={assetType}
          storage_url={completed.storage_url}
          thumbnail_url={completed.thumbnail_url}
          onPreview={() => setFullscreen(true)}
        />
        {fullscreen && (
          <FullscreenViewer
            type={assetType}
            url={completed.storage_url}
            onClose={() => setFullscreen(false)}
          />
        )}
      </>
    );
  }

  if (phase === "pending") {
    return (
      <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 border border-stone-300 bg-stone-50 font-mono-x text-[10px] uppercase tracking-widest text-stone-600">
        <Loader2 size={12} className="animate-spin" />
        Generating {label.toLowerCase()}…
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <div className="mt-4 flex items-start gap-2 flex-wrap">
        <span
          className="px-3 py-2 border border-red-300 bg-red-50 font-mono-x text-[10px] uppercase tracking-widest text-red-700 max-w-[320px]"
          title={error ?? undefined}
        >
          ⚠ {error}
        </span>
        <button
          onClick={() => {
            setError(null);
            setPhase("editing");
          }}
          className="px-3 py-2 border border-stone-900 bg-white font-mono-x text-[10px] uppercase tracking-widest font-bold text-stone-900 hover:bg-stone-900 hover:text-white transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (phase === "editing") {
    return (
      <div className="mt-4 border border-stone-300 bg-stone-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">
            Tweak the prompt, then generate
          </span>
          <button
            onClick={() => setPhase("idle")}
            disabled={submitting}
            className="text-stone-400 hover:text-stone-900 transition disabled:opacity-50"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={submitting}
          rows={5}
          className="w-full border border-stone-300 bg-white px-3 py-2 font-mono-x text-[11px] text-stone-900 focus:outline-none focus:border-stone-900 disabled:opacity-50"
          placeholder={`Describe the ${label.toLowerCase()}…`}
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-1">
              Aspect ratio
            </label>
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value)}
              disabled={submitting}
              className="w-full border border-stone-300 bg-white px-3 py-2 font-mono-x text-[11px] text-stone-900 focus:outline-none focus:border-stone-900 disabled:opacity-50"
            >
              {(assetType === "video" ? VIDEO_ASPECTS : IMAGE_ASPECTS).map(
                (a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ),
              )}
            </select>
          </div>
          {assetType === "video" && (
            <div>
              <label className="block font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-1">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                disabled={submitting}
                className="w-full border border-stone-300 bg-white px-3 py-2 font-mono-x text-[11px] text-stone-900 focus:outline-none focus:border-stone-900 disabled:opacity-50"
              >
                {VIDEO_DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => setPhase("idle")}
            disabled={submitting}
            className="px-3 py-2 font-mono-x text-[10px] uppercase tracking-widest text-stone-600 hover:text-stone-900 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || prompt.trim().length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 border border-stone-900 font-mono-x text-[10px] uppercase tracking-widest font-bold text-stone-900 hover:bg-stone-900 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={
              !submitting && prompt.trim().length > 0
                ? { backgroundColor: ACCENT, borderColor: "#a3cc1f" }
                : { backgroundColor: "white" }
            }
          >
            {submitting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {submitting ? "Submitting…" : "Generate"}
          </button>
        </div>
      </div>
    );
  }

  // phase === "idle"
  return (
    <button
      onClick={() => setPhase("editing")}
      className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 border border-stone-900 bg-white font-mono-x text-[10px] uppercase tracking-widest font-bold text-stone-900 hover:bg-stone-900 hover:text-white transition"
      style={{ borderLeft: `4px solid ${ACCENT}` }}
    >
      <Icon size={14} />
      Generate {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
function CompletedCard({
  assetType,
  storage_url,
  thumbnail_url,
  onPreview,
}: {
  assetType: AssetType;
  storage_url: string;
  thumbnail_url: string | null;
  onPreview: () => void;
}) {
  const thumb = thumbnail_url ?? storage_url;
  return (
    <div className="mt-4 flex items-center gap-3 border border-stone-300 bg-white p-3">
      <button
        onClick={onPreview}
        className="relative w-20 h-20 border border-stone-300 bg-stone-100 overflow-hidden hover:border-stone-700 transition"
        aria-label="View fullscreen"
      >
        {assetType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : thumbnail_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnail_url}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-0 h-0 border-l-[10px] border-l-white border-y-[7px] border-y-transparent" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={20} className="text-stone-500" />
          </div>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-1">
          Generated · saved to Library
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-stone-300 font-mono-x text-[10px] uppercase tracking-widest text-stone-700 hover:border-stone-900 hover:text-stone-900 transition"
          >
            <Maximize2 size={11} />
            View
          </button>
          <a
            href={storage_url}
            download
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-stone-300 font-mono-x text-[10px] uppercase tracking-widest text-stone-700 hover:border-stone-900 hover:text-stone-900 transition"
          >
            <Download size={11} />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

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
