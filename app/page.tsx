"use client";

import Image from "next/image";
import { useState, useEffect, useRef, ChangeEvent } from "react";
import { AlertTriangle, Loader2, Wand2 } from "lucide-react";
import type { CampaignOutput } from "./_lib/campaign-types";
import { CampaignReportView } from "./components/CampaignReportView";
import { ClientSelector, type ClientOption } from "./components/ClientSelector";

const PAID = ["Meta", "Google", "TikTok", "YouTube", "LinkedIn", "Programmatic"] as const;
const LIFECYCLE = ["Email", "Newsletter", "SMS"] as const;
const ORGANIC = ["Organic Social"] as const;
const ACCENT = "#d4ff3d";

type ChannelName =
  | (typeof PAID)[number]
  | (typeof LIFECYCLE)[number]
  | (typeof ORGANIC)[number];

type TextField =
  | "clientName"
  | "website"
  | "offer"
  | "cta"
  | "audience"
  | "voice"
  | "competitors"
  | "existingLpUrl";

interface CampaignInputs {
  clientName: string;
  website: string;
  offer: string;
  cta: string;
  audience: string;
  voice: string;
  competitors: string;
  existingLpUrl: string;
  channels: ChannelName[];
}

export default function IVMCampaignEngine() {
  const [inputs, setInputs] = useState<CampaignInputs>({
    clientName: "",
    website: "",
    offer: "",
    cta: "",
    audience: "",
    voice: "",
    competitors: "",
    existingLpUrl: "",
    channels: ["Meta"],
  });
  const [generating, setGenerating] = useState(false);
  const [requestDone, setRequestDone] = useState(false);
  const [output, setOutput] = useState<CampaignOutput | null>(null);
  const [error, setError] = useState("");
  // null = one-off campaign (no portal client); UUID = saved client.
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  // Brief confirmation banner that auto-dismisses after a successful save.
  const [showSavedToast, setShowSavedToast] = useState(false);

  const handleClientChange = (client: ClientOption | null) => {
    setSelectedClientId(client?.id ?? null);
    // UX nicety: auto-fill Brand Name from the client, but never overwrite
    // anything the user has already typed.
    if (client && !inputs.clientName.trim()) {
      setInputs((p) => ({ ...p, clientName: client.name }));
    }
  };

  const toggleChannel = (c: ChannelName) => {
    setInputs((prev) => ({
      ...prev,
      channels: prev.channels.includes(c)
        ? prev.channels.filter((x) => x !== c)
        : [...prev.channels, c],
    }));
  };

  const update =
    (field: TextField) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setInputs((p) => ({ ...p, [field]: e.target.value }));

  const generate = async () => {
    if (!inputs.clientName.trim() || !inputs.offer.trim()) {
      setError("Client name and offer are required.");
      return;
    }
    if (inputs.channels.length === 0) {
      setError("Pick at least one channel.");
      return;
    }
    setError("");
    setShowSavedToast(false);
    setGenerating(true);
    setRequestDone(false);
    setOutput(null);

    let success = false;
    try {
      // Attach clientId for portal history. null on one-off campaigns; server
      // validates UUID shape, RLS rejects writes to clients the user can't access.
      const body: Record<string, unknown> = { ...inputs };
      if (selectedClientId) body.clientId = selectedClientId;
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) ||
          `API returned ${res.status}`;
        throw new Error(msg);
      }
      setOutput(data as CampaignOutput);
      // Surface a brief confirmation that the campaign was persisted. Self-
      // dismisses after 4s so it doesn't linger past the user reading it.
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 4000);
      success = true;
    } catch (err: unknown) {
      // Extract a human message from anything throw-able. Previously this
      // produced "[object Object]" when the catch received a plain object
      // (e.g. a rejected JSON envelope), making completed-but-slow runs
      // look like failures.
      let message = "Try again.";
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "string") {
        message = err;
      } else if (err && typeof err === "object") {
        const e = err as Record<string, unknown>;
        if (typeof e.message === "string") message = e.message;
        else if (typeof e.error === "string") message = e.error;
      }
      // Network / timeout heuristic — the audit usually completes server-side
      // anyway. Steer the user to history instead of telling them to retry.
      const lower = message.toLowerCase();
      if (
        lower.includes("fetch") ||
        lower.includes("network") ||
        lower.includes("timeout") ||
        lower.includes("failed to fetch")
      ) {
        message =
          "Connection interrupted. Your campaign may still be generating — check /history in a minute.";
      }
      setError(`Generation failed: ${message}`);
    } finally {
      if (success) {
        // Trigger the bar's finish animation, keep it mounted briefly.
        setRequestDone(true);
        setTimeout(() => {
          setGenerating(false);
          setRequestDone(false);
        }, 700);
      } else {
        // On error, drop the bar immediately so the error banner shows cleanly.
        setGenerating(false);
      }
    }
  };

  const reset = () => {
    setOutput(null);
    setError("");
    setShowSavedToast(false);
  };

  return (
    <div
      className="min-h-screen bg-stone-100 text-stone-900 campaign-surface"
      style={{ fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif" }}
    >
      <div className="grain min-h-screen">
        <div className="max-w-6xl mx-auto px-5 py-10 md:px-8 md:py-14">

          {/* Header */}
          <header className="mb-10 md:mb-14 border-b border-stone-300 pb-8">
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-2 h-2 rounded-full pulse-dot flex-shrink-0"
                style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
              />
              <Image
                src="/ivm-logo.png"
                alt="IVM"
                width={160}
                height={64}
                priority
                style={{ height: 64, width: "auto" }}
              />
              <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 leading-snug">
                <div>Powered by IVM</div>
                <div>Campaign Engine v5 · multi-channel</div>
              </div>
            </div>
            <h1 className="font-display text-4xl md:text-6xl font-black leading-none tracking-tight">
              Multi-channel campaigns
              <br />
              <span className="font-display italic accent-highlight">that actually convert.</span>
            </h1>
            <p className="font-mono-x text-xs md:text-sm text-stone-500 mt-5 max-w-2xl leading-relaxed">
              Paid · Programmatic · Email · Newsletter · SMS · Organic. Big Idea spine · Schwartz awareness · Hormozi value · Halbert specificity · self-critique pass.
            </p>
            <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mt-3">
              Powered by IVM
            </div>
          </header>

          {/* Input form */}
          <section className="mb-10">
            <div className="mb-5">
              <ClientSelector onClientChange={handleClientChange} disabled={generating} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Client Name *" value={inputs.clientName} onChange={update("clientName")} placeholder="e.g. Aurora Skincare" />
              <Field label="Website" value={inputs.website} onChange={update("website")} placeholder="https://... (will be researched)" />
              <Field label="Offer *" value={inputs.offer} onChange={update("offer")} placeholder="What they sell, price, hook, mechanism, result, proof" multiline full />
              <Field label="Primary CTA" value={inputs.cta} onChange={update("cta")} placeholder="e.g. Book a Free Consult" />
              <Field label="Target Audience" value={inputs.audience} onChange={update("audience")} placeholder="Real demographic + psychographic" />
              <Field label="Brand Voice" value={inputs.voice} onChange={update("voice")} placeholder="Tone, attitude, no-go words, reference brands" full />
              <Field label="Competitors" value={inputs.competitors} onChange={update("competitors")} placeholder="URLs or names, comma separated" multiline full />
              <Field label="Existing Landing Page URL" value={inputs.existingLpUrl} onChange={update("existingLpUrl")} placeholder="https://... (we'll audit it against the Big Idea)" full />
            </div>

            {/* Channels , grouped */}
            <div className="mt-7">
              <label className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-3 block">
                Channels (drives output modules)
              </label>
              <div className="space-y-3">
                <ChannelGroup label="Paid" channels={PAID} active={inputs.channels} onToggle={toggleChannel} />
                <ChannelGroup label="Lifecycle / Owned" channels={LIFECYCLE} active={inputs.channels} onToggle={toggleChannel} />
                <ChannelGroup label="Organic" channels={ORGANIC} active={inputs.channels} onToggle={toggleChannel} />
              </div>
            </div>

            {error && (
              <div className="mt-6 flex items-start gap-3 px-4 py-3 border border-red-300 bg-red-50">
                <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                <span className="font-mono-x text-sm text-red-700">{error}</span>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3 items-center">
              <button
                onClick={generate}
                disabled={generating}
                className="group relative px-7 py-4 text-stone-900 font-mono-x text-xs uppercase tracking-widest font-bold transition disabled:opacity-50 disabled:cursor-not-allowed accent-glow"
                style={{ backgroundColor: ACCENT }}
              >
                <span className="flex items-center gap-2">
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  {generating ? "Generating..." : "Generate Campaign"}
                </span>
              </button>
              {output && (
                <button
                  onClick={reset}
                  className="px-6 py-4 border border-stone-300 bg-white text-stone-600 font-mono-x text-xs uppercase tracking-widest hover:border-stone-500 transition"
                >
                  Reset
                </button>
              )}
            </div>
            {generating && <GenerationProgress done={requestDone} />}
          </section>

          {/* Saved-to-history confirmation — only on a fresh successful
              generation; auto-dismisses after 4s via the timeout in generate(). */}
          {output && showSavedToast && (
            <div
              className="mb-8 flex items-center gap-3 border-l-4 bg-white card-shadow px-5 py-3"
              style={{ borderLeftColor: ACCENT }}
              role="status"
              aria-live="polite"
            >
              <span
                className="w-2 h-2 rounded-full pulse-dot flex-shrink-0"
                style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
              />
              <span className="font-mono-x text-xs uppercase tracking-widest text-stone-800 font-bold">
                Campaign saved to your history
              </span>
            </div>
          )}

          {/* Output */}
          {output && <CampaignReportView output={output} clientName={inputs.clientName} channels={inputs.channels} />}

          {!output && !generating && (
            <div className="mt-16 text-center py-12 border border-dashed border-stone-300 bg-white/50">
              <p className="font-display text-2xl italic text-stone-400 mb-2">Awaiting inputs.</p>
              <p className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">Pick channels · Drop competitors · Generate · Ship</p>
            </div>
          )}

          {/* Page footer */}
          <footer className="border-t border-stone-300 mt-16 pt-8 pb-4 flex items-center justify-center gap-3">
            <Image
              src="/ivm-logo.png"
              alt="IVM"
              width={80}
              height={32}
              style={{ height: 32, width: "auto" }}
            />
            <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-400">
              Powered by IVM · go-ivm.com
            </span>
          </footer>
        </div>
      </div>

    </div>
  );
}


// Phased reassurance label — replaces the older per-section flavor STAGES
// so the user always sees a "how much longer / is this stuck" message that
// matches the actual elapsed time, including the "still going past 90s" path
// which is the spot people start to worry.
function phasedReassurance(elapsedMs: number): string {
  const sec = elapsedMs / 1000;
  if (sec < 15) return "Generating your campaign...";
  if (sec < 45) return "Working on each channel...";
  if (sec < 90) return "Almost there. Multi-channel runs take 1-2 minutes.";
  return "Still generating. Hang tight — large campaigns can take up to 3 minutes.";
}

function GenerationProgress({ done }: { done: boolean }) {
  // 0 → 90% linearly over 180s, hold at 90%, then ease-out to 100% over ~500ms when done.
  const TARGET_MS = 180_000;
  const HOLD = 0.9;
  const FINISH_MS = 500;

  const [pct, setPct] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const finishStartRef = useRef<number | null>(null);
  const finishStartPctRef = useRef<number>(0);

  useEffect(() => {
    if (startRef.current === null) startRef.current = performance.now();
    function tick() {
      const now = performance.now();
      const elapsed = now - (startRef.current ?? now);
      setElapsedMs(elapsed);

      if (done) {
        if (finishStartRef.current === null) {
          finishStartRef.current = now;
          finishStartPctRef.current =
            elapsed >= TARGET_MS ? HOLD : (elapsed / TARGET_MS) * HOLD;
        }
        const finishElapsed = now - finishStartRef.current;
        const t = Math.min(finishElapsed / FINISH_MS, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const newPct =
          finishStartPctRef.current + (1 - finishStartPctRef.current) * eased;
        setPct(newPct);
        if (t >= 1) return;
      } else {
        setPct(Math.min(elapsed / TARGET_MS, 1) * HOLD);
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [done]);

  // Past 3 min and still going: pulse the dot to signal we're in extended
  // territory but still alive. The label itself comes from phasedReassurance.
  const polishMode = elapsedMs > TARGET_MS && !done;
  const label = phasedReassurance(elapsedMs);

  const totalSec = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");

  return (
    <div className="mt-6 border border-stone-300 bg-white card-shadow p-5 max-w-2xl">
      <div
        className="font-mono-x text-[11px] uppercase tracking-widest text-stone-800 font-bold mb-3 flex items-center gap-2"
        aria-live="polite"
      >
        {polishMode && (
          <span
            className="w-2 h-2 rounded-full pulse-dot flex-shrink-0"
            style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
          />
        )}
        <span>{label}</span>
      </div>
      <div
        className="h-1.5 bg-stone-200 overflow-hidden relative"
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full"
          style={{
            width: `${pct * 100}%`,
            backgroundColor: ACCENT,
            boxShadow: `0 0 8px ${ACCENT}`,
          }}
        />
      </div>
      <div className="font-mono-x text-[10px] text-stone-500 tabular-nums mt-2 text-right">
        {mm}:{ss}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  full,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  multiline?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2 block">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3} className="w-full bg-white border border-stone-300 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 ring-accent transition resize-none" />
      ) : (
        <input type="text" value={value} onChange={onChange} placeholder={placeholder} className="w-full bg-white border border-stone-300 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 ring-accent transition" />
      )}
    </div>
  );
}

function ChannelGroup({
  label,
  channels,
  active,
  onToggle,
}: {
  label: string;
  channels: readonly ChannelName[];
  active: ChannelName[];
  onToggle: (c: ChannelName) => void;
}) {
  return (
    <div>
      <div className="channel-group-label mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-2">
        {channels.map((c) => {
          const isActive = active.includes(c);
          return (
            <button
              key={c}
              onClick={() => onToggle(c)}
              className={`px-4 py-2 font-mono-x text-[11px] uppercase tracking-wider border transition ${
                isActive ? "text-stone-900" : "bg-white text-stone-600 border-stone-300 hover:border-stone-500"
              }`}
              style={isActive ? { backgroundColor: ACCENT, borderColor: "#1c1917" } : {}}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}


