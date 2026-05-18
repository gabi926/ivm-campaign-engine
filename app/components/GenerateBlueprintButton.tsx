"use client";

// "Generate LP Blueprint" dropdown for the campaign report toolbar. Three
// targets (GHL / Lovable / Generic) → POST /api/landing-pages/generate →
// redirect to /blueprints/[id]. Phased loader (~30-45s). Only renders when
// a persisted campaignId is available (saved-campaign detail view).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Layout, Loader2 } from "lucide-react";
import { TARGET_BUILDERS, BUILDER_LABEL, type TargetBuilder } from "@/app/_lib/blueprint-types";

const PHASES = [
  "Reading the campaign…",
  "Choosing the page structure…",
  "Writing section copy…",
  "Selecting integrations…",
  "Formatting the builder prompt…",
];

export function GenerateBlueprintButton({
  campaignId,
  clientId,
  disabled,
}: {
  campaignId: string;
  clientId: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!busy) {
      if (timer.current) clearInterval(timer.current);
      setPhase(0);
      return;
    }
    timer.current = setInterval(
      () => setPhase((p) => (p + 1) % PHASES.length),
      7000,
    );
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [busy]);

  const generate = async (target: TargetBuilder) => {
    setOpen(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/landing-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          target_builder: target,
          client_id: clientId,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; blueprint_id?: string; error?: string }
        | null;
      if (!res.ok || !data?.success || !data.blueprint_id) {
        throw new Error(data?.error || `Generation failed (${res.status})`);
      }
      router.push(`/blueprints/${data.blueprint_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy || disabled}
        className="flex items-center gap-2 px-4 py-2.5 border border-stone-900 bg-white text-stone-900 font-mono-x text-[10px] uppercase tracking-widest font-bold hover:bg-stone-900 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Layout size={14} />
        )}
        {busy ? PHASES[phase] : "Generate LP Blueprint"}
        {!busy && <ChevronDown size={12} />}
      </button>

      {open && !busy && (
        <div className="absolute right-0 mt-1 z-40 border border-stone-900 bg-white min-w-[220px]">
          {TARGET_BUILDERS.map((t) => (
            <button
              key={t}
              onClick={() => generate(t)}
              className="block w-full text-left px-4 py-2.5 font-mono-x text-[10px] uppercase tracking-widest text-stone-800 hover:bg-stone-900 hover:text-white transition border-b border-stone-200 last:border-b-0"
            >
              For {BUILDER_LABEL[t]}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="absolute right-0 mt-1 z-40 border border-red-300 bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700 min-w-[220px]">
          {error}
        </div>
      )}
    </div>
  );
}
