"use client";

// D2 — AL Audience Builder spec renderer.
//
// Takes an ALAudienceSpec (from the generate route or a saved row) and
// renders the 8 AL panels in order: Intent, Business, Financial, Personal,
// Family, Housing, Location, Contact. Matches the visual grammar of the
// source HTML tool but restyled to IVM (Fraunces + JetBrains Mono, stone
// palette, #d4ff3d accent).
//
// Reusable — Phase 4 detail page will import this component directly.

import { useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import type {
  ALAudienceBuild,
  ALAudienceSpec,
  ALBusinessPanel,
  ALContactPanel,
  ALGenericPanel,
  ALIntentPanel,
  ALLocationPanel,
} from "@/app/_lib/al-taxonomy/types";

const ACCENT = "#d4ff3d";

interface Props {
  spec: ALAudienceSpec;
  /** Optional label above the header — e.g. "Generated just now" or a timestamp. */
  timestamp?: string;
}

export function AudienceSpecView({ spec, timestamp }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — silent fail, chip stays neutral.
    }
  };

  const s = spec.summary ?? {
    total_audiences_to_build: spec.panels?.intent?.audience_builds?.length ?? 0,
    estimated_total_records: "—",
    primary_buying_signal: "",
  };

  return (
    <section className="border border-stone-200 bg-white card-shadow p-6 md:p-8 space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap border-b border-stone-200 pb-4">
        <div>
          {timestamp && (
            <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-1">
              {timestamp}
            </div>
          )}
          <h2 className="font-display text-2xl md:text-3xl font-black leading-tight text-stone-900">
            {spec.audience_name || "Audience Spec"}
          </h2>
        </div>
        <button
          onClick={handleCopyJson}
          className="inline-flex items-center gap-2 border border-stone-300 bg-white px-3 py-2 font-mono-x text-[10px] uppercase tracking-widest text-stone-600 hover:border-stone-500 hover-dark transition"
          aria-label={copied ? "Copied JSON" : "Copy spec JSON"}
        >
          {copied ? <Check size={12} /> : <ClipboardCopy size={12} />}
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </header>

      {/* Summary bar — 3 metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryMetric
          label="Detected Type"
          value={spec.detected_type ?? "—"}
          accent
        />
        <SummaryMetric
          label="Audiences to Build"
          value={String(s.total_audiences_to_build ?? "—")}
        />
        <SummaryMetric
          label="Est. Records"
          value={s.estimated_total_records || "—"}
        />
      </div>

      {s.primary_buying_signal && (
        <div className="text-sm text-stone-700 leading-relaxed">
          <span className="meta-chip mr-2">Buying Signal</span>
          {s.primary_buying_signal}
        </div>
      )}

      {/* 8 panels in AL UI order */}
      <IntentPanelBlock panel={spec.panels?.intent} num={1} />
      <BusinessPanelBlock panel={spec.panels?.business} num={2} />
      <GenericPanelBlock panel={spec.panels?.financial} num={3} name="Financial" />
      <GenericPanelBlock panel={spec.panels?.personal} num={4} name="Personal" />
      <GenericPanelBlock panel={spec.panels?.family} num={5} name="Family" />
      <GenericPanelBlock panel={spec.panels?.housing} num={6} name="Housing" />
      <LocationPanelBlock panel={spec.panels?.location} num={7} />
      <ContactPanelBlock panel={spec.panels?.contact} num={8} />
    </section>
  );
}

// ============================================================================
// Primitives
// ============================================================================

function SummaryMetric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-stone-200 bg-white card-shadow p-4">
      <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-1">
        {label}
      </div>
      <div
        className="font-display text-xl md:text-2xl font-bold text-stone-900"
        style={accent ? { display: "inline-block", backgroundColor: ACCENT, padding: "0 6px" } : {}}
      >
        {value}
      </div>
    </div>
  );
}

function PanelTitle({
  num,
  name,
  skipped,
  skipReason,
}: {
  num: number;
  name: string;
  skipped?: boolean;
  skipReason?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center justify-center w-6 h-6 font-mono-x text-[11px] font-bold ${
            skipped ? "bg-stone-200 text-stone-500" : "bg-stone-900 text-white"
          }`}
        >
          {num}
        </span>
        <h3 className="font-display text-lg font-bold text-stone-900">
          {name}
          {skipped && (
            <span className="ml-2 font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-normal">
              · skipped
            </span>
          )}
        </h3>
      </div>
      {skipped && skipReason && (
        <p className="text-sm text-stone-600 leading-relaxed pl-9 italic">
          {skipReason}
        </p>
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 py-1.5 border-b border-stone-100 last:border-b-0">
      <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold">
        {k}
      </div>
      <div className="text-sm text-stone-800 leading-relaxed">{v}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center font-mono-x text-[9px] uppercase tracking-widest text-stone-700 border border-stone-300 bg-stone-50 px-2 py-0.5 font-bold">
      {children}
    </span>
  );
}

// ============================================================================
// Panel blocks
// ============================================================================

function IntentPanelBlock({ panel, num }: { panel: ALIntentPanel | undefined; num: number }) {
  if (!panel || !panel.active) {
    return (
      <PanelTitle
        num={num}
        name="Intent"
        skipped
        skipReason={panel?.skip_reason || "No intent layer."}
      />
    );
  }
  return (
    <div className="space-y-3">
      <PanelTitle num={num} name="Intent" />
      <div className="space-y-3 pl-9">
        {panel.audience_builds.map((b, i) => (
          <BuildCard key={i} build={b} />
        ))}
      </div>
    </div>
  );
}

function BuildCard({ build }: { build: ALAudienceBuild }) {
  return (
    <div className="border border-stone-200 border-l-2 border-l-[color:var(--ivm-accent)] bg-white card-shadow p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
        <div className="font-display text-base font-bold text-stone-900">
          {build.name}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {build.tier && <Tag>{build.tier}</Tag>}
          {build.method && <Tag>{build.method}</Tag>}
          {build.min_score && <Tag>Min: {build.min_score}</Tag>}
          {build.match_probability && (
            <span className="font-mono-x text-[9px] uppercase tracking-widest font-bold px-2 py-0.5" style={{ backgroundColor: ACCENT, color: "#0a0a0a" }}>
              {build.match_probability}
            </span>
          )}
        </div>
      </div>
      {build.taxonomy_matches?.length > 0 && (
        <div className="mt-2">
          <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-1.5">
            Premade IDs
          </div>
          <div className="flex flex-wrap gap-1.5">
            {build.taxonomy_matches.map((t, i) => (
              <span
                key={i}
                title={t.path}
                className="inline-flex items-center gap-1.5 font-mono-x text-[10px] border border-stone-300 bg-stone-50 px-2 py-1"
              >
                <span className="font-bold text-stone-900">{t.id}</span>
                <span className="text-stone-600">· {t.topic}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {build.intent_keywords && (
        <div className="mt-2">
          <KV k="Keyword phrase" v={build.intent_keywords} />
        </div>
      )}
      {build.notes && (
        <p className="text-sm text-stone-700 leading-relaxed mt-2 italic">
          {build.notes}
        </p>
      )}
    </div>
  );
}

function BusinessPanelBlock({ panel, num }: { panel: ALBusinessPanel | undefined; num: number }) {
  if (!panel || !panel.active) {
    return (
      <PanelTitle
        num={num}
        name="Business"
        skipped
        skipReason={panel?.skip_reason || "Skipped."}
      />
    );
  }
  return (
    <div className="space-y-3">
      <PanelTitle num={num} name="Business" />
      <div className="border border-stone-200 bg-white card-shadow p-4 pl-9 space-y-0">
        {panel.b2b_keywords && <KV k="B2B Keywords" v={panel.b2b_keywords} />}
        {panel.job_titles?.length > 0 && (
          <KV k="Job Titles" v={`${panel.job_titles.join(", ")}  (exact match)`} />
        )}
        {panel.seniority?.length > 0 && (
          <KV k="Seniority" v={panel.seniority.join(", ")} />
        )}
        {panel.industries?.length > 0 && (
          <KV k="Industries" v={panel.industries.join(", ")} />
        )}
        {panel.naics_include?.length > 0 && (
          <KV k="NAICS — include" v={panel.naics_include.join(", ")} />
        )}
        {panel.naics_exclude?.length > 0 && (
          <KV k="NAICS — exclude" v={panel.naics_exclude.join(", ")} />
        )}
        {panel.employee_count?.length > 0 && (
          <KV k="Employee Count" v={panel.employee_count.join(", ")} />
        )}
        {panel.revenue?.length > 0 && (
          <KV k="Revenue" v={panel.revenue.join(", ")} />
        )}
      </div>
    </div>
  );
}

function GenericPanelBlock({
  panel,
  num,
  name,
}: {
  panel: ALGenericPanel | undefined;
  num: number;
  name: string;
}) {
  if (!panel || !panel.active) {
    return (
      <PanelTitle
        num={num}
        name={name}
        skipped
        skipReason={panel?.skip_reason || "Not relevant to this ICP."}
      />
    );
  }
  const entries = Object.entries(panel.fields ?? {}).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0;
    return typeof v === "string" && v.length > 0;
  });
  return (
    <div className="space-y-3">
      <PanelTitle num={num} name={name} />
      <div className="border border-stone-200 bg-white card-shadow p-4 pl-9 space-y-0">
        {entries.length > 0 ? (
          entries.map(([k, v]) => (
            <KV key={k} k={k} v={Array.isArray(v) ? v.join(", ") : v} />
          ))
        ) : (
          <p className="text-sm text-stone-600 italic">Active — set values in AL.</p>
        )}
      </div>
    </div>
  );
}

function LocationPanelBlock({ panel, num }: { panel: ALLocationPanel | undefined; num: number }) {
  if (!panel) {
    return (
      <PanelTitle num={num} name="Location" skipped skipReason="Default US." />
    );
  }
  const anyFilters =
    panel.cities?.length > 0 || panel.states?.length > 0 || panel.zips?.length > 0;
  return (
    <div className="space-y-3">
      <PanelTitle num={num} name="Location" />
      <div className="border border-stone-200 bg-white card-shadow p-4 pl-9 space-y-0">
        {panel.cities?.length > 0 && <KV k="Cities" v={panel.cities.join(", ")} />}
        {panel.states?.length > 0 && <KV k="States" v={panel.states.join(", ")} />}
        {panel.zips?.length > 0 && <KV k="Zip Codes" v={panel.zips.join(", ")} />}
        {!anyFilters && (
          <p className="text-sm text-stone-600 italic">
            United States (nationwide).
          </p>
        )}
      </div>
    </div>
  );
}

function ContactPanelBlock({ panel, num }: { panel: ALContactPanel | undefined; num: number }) {
  if (!panel) return null;
  const toggle = (on: boolean, label: string) => (
    <span
      className={`inline-flex items-center gap-1.5 font-mono-x text-[11px] px-2.5 py-1 border ${
        on
          ? "border-stone-900 bg-stone-900 text-white font-bold"
          : "border-stone-300 bg-white text-stone-500"
      }`}
    >
      <span>{on ? "●" : "○"}</span>
      {label}
    </span>
  );
  return (
    <div className="space-y-3">
      <PanelTitle num={num} name="Contact" />
      <div className="border border-stone-200 bg-white card-shadow p-4 pl-9 space-y-3">
        <div className="flex flex-wrap gap-2">
          {toggle(panel.verified_personal_emails, "Verified Personal Emails")}
          {toggle(panel.verified_business_emails, "Verified Business Emails")}
          {toggle(panel.valid_phones, "Valid Phones")}
          {toggle(panel.skip_traced_wireless, "Skip-Traced Wireless")}
        </div>
        {panel.note && (
          <p className="text-sm text-stone-700 leading-relaxed italic">
            {panel.note}
          </p>
        )}
      </div>
    </div>
  );
}
