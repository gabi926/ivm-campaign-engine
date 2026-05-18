"use client";

// Interactive blueprint detail. Sections: page structure, section-by-section
// copy (collapsible cards), integrations, paste-ready builder prompt (big
// copy button). Footer: Download PDF + Regenerate for a different builder.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Copy, Download, Loader2 } from "lucide-react";
import {
  BUILDER_LABEL,
  TARGET_BUILDERS,
  type BlueprintRow,
  type TargetBuilder,
} from "@/app/_lib/blueprint-types";

function CopyButton({
  text,
  label,
  big,
}: {
  text: string;
  label?: string;
  big?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className={
        big
          ? "inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-stone-900 bg-[#d4ff3d] px-4 py-2.5 font-bold hover:opacity-90 transition"
          : "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-stone-700 border border-stone-300 px-2.5 py-1 hover:border-stone-700 hover:text-stone-900 transition"
      }
    >
      {done ? <Check size={big ? 14 : 12} /> : <Copy size={big ? 14 : 12} />}
      {done ? "Copied" : (label ?? "Copy")}
    </button>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="font-mono text-sm uppercase tracking-widest text-stone-900 font-bold border-b border-stone-300 pb-2 mb-4">
        <span className="text-stone-400 mr-2">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function BlueprintDetailClient({
  blueprint,
  clientName,
}: {
  blueprint: BlueprintRow;
  clientName: string | null;
}) {
  const router = useRouter();
  const bd = blueprint.blueprint_data;
  const structure = bd?.page_structure ?? [];
  const sections = bd?.sections ?? [];
  const integrations = bd?.integrations ?? [];

  const [openSection, setOpenSection] = useState<number | null>(0);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const regenerate = async (target: TargetBuilder) => {
    setRegenOpen(false);
    setRegenBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/landing-pages/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: blueprint.campaign_id,
          target_builder: target,
          client_id: blueprint.client_id,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; blueprint_id?: string; error?: string }
        | null;
      if (!res.ok || !data?.success || !data.blueprint_id) {
        throw new Error(data?.error || `Regeneration failed (${res.status})`);
      }
      router.push(`/blueprints/${data.blueprint_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "unknown error");
      setRegenBusy(false);
    }
  };

  return (
    <div>
      <header className="mb-8 border-b border-stone-300 pb-5">
        <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-1">
          LP Blueprint
        </div>
        <h1 className="font-mono text-2xl md:text-3xl font-bold tracking-tight">
          {clientName ?? "Untitled campaign"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs text-stone-600">
          <span className="inline-block bg-stone-900 text-white uppercase tracking-widest px-2 py-0.5 text-[10px]">
            {BUILDER_LABEL[blueprint.target_builder]}
          </span>
          <span>·</span>
          <span>{new Date(blueprint.created_at).toLocaleString("en-US")}</span>
        </div>
      </header>

      {err && (
        <div className="mb-6 border border-red-300 bg-red-50 px-4 py-3 font-mono text-sm text-red-700">
          {err}
        </div>
      )}

      <Section n={1} title="Page structure">
        {structure.length === 0 ? (
          <p className="text-sm text-stone-600">—</p>
        ) : (
          <ol className="space-y-1">
            {structure.map((s, i) => (
              <li key={i} className="font-mono text-sm text-stone-800">
                <span className="text-stone-400 mr-2">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section n={2} title="Section-by-section copy">
        <div className="space-y-2">
          {sections.map((s, i) => {
            const open = openSection === i;
            return (
              <div key={i} className="border border-stone-300 bg-white">
                <button
                  onClick={() => setOpenSection(open ? null : i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 transition"
                >
                  <span className="font-mono text-sm font-bold text-stone-900">
                    {s.name}
                  </span>
                  {open ? (
                    <ChevronDown size={16} className="text-stone-500" />
                  ) : (
                    <ChevronRight size={16} className="text-stone-500" />
                  )}
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-3">
                    <div>
                      <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-1">
                        Headline
                      </div>
                      <p className="text-base font-bold text-stone-900">
                        {s.headline}
                      </p>
                    </div>
                    <div>
                      <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-1">
                        Body
                      </div>
                      <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                        {s.body}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <div>
                        <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mr-2">
                          CTA
                        </span>
                        <span className="text-stone-800">
                          {s.cta_text} — {s.cta_placement}
                        </span>
                      </div>
                      <div>
                        <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mr-2">
                          Visual
                        </span>
                        <span className="text-stone-800">{s.visual_direction}</span>
                      </div>
                      {s.form_fields && s.form_fields.length > 0 && (
                        <div>
                          <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mr-2">
                            Form
                          </span>
                          <span className="text-stone-800">
                            {s.form_fields.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                    <CopyButton
                      text={`${s.headline}\n\n${s.body}\n\nCTA: ${s.cta_text} (${s.cta_placement})`}
                      label="Copy section"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section n={3} title="Integrations">
        {integrations.length === 0 ? (
          <p className="text-sm text-stone-600">No integrations recommended.</p>
        ) : (
          <ul className="space-y-3">
            {integrations.map((it, i) => (
              <li key={i} className="border border-stone-300 bg-white p-4">
                <div className="font-mono text-sm font-bold text-stone-900">
                  {it.name}
                </div>
                <p className="text-sm text-stone-700 mt-1">{it.why}</p>
                <p className="text-sm text-stone-600 mt-1 italic">
                  {it.setup_notes}
                </p>
              </li>
            ))}
          </ul>
        )}
        {bd?.pixel_capi_reminder && (
          <p className="mt-3 font-mono text-[11px] text-stone-500 italic">
            {bd.pixel_capi_reminder}
          </p>
        )}
      </Section>

      <Section n={4} title="Builder prompt">
        <p className="font-mono text-[11px] text-stone-500 mb-3">
          Paste this into {BUILDER_LABEL[blueprint.target_builder]} / your chosen
          builder.
        </p>
        <div className="mb-3">
          <CopyButton text={blueprint.builder_prompt} label="Copy to clipboard" big />
        </div>
        <pre className="bg-stone-900 text-stone-100 text-[12px] leading-relaxed p-4 overflow-x-auto whitespace-pre-wrap max-h-[480px]">
          {blueprint.builder_prompt}
        </pre>
      </Section>

      <div className="border-t border-stone-300 pt-5 flex flex-wrap items-center gap-3">
        <a
          href={`/api/landing-pages/${blueprint.id}/pdf`}
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-stone-900 border border-stone-900 px-3 py-2 font-bold hover:bg-stone-900 hover:text-white transition"
        >
          <Download size={12} /> Download PDF
        </a>
        <div className="relative">
          <button
            onClick={() => setRegenOpen((o) => !o)}
            disabled={regenBusy || !blueprint.campaign_id}
            title={
              !blueprint.campaign_id
                ? "Source campaign no longer linked"
                : undefined
            }
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-stone-700 border border-stone-300 px-3 py-2 hover:border-stone-700 hover:text-stone-900 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {regenBusy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ChevronDown size={12} />
            )}
            Regenerate for different builder
          </button>
          {regenOpen && !regenBusy && (
            <div className="absolute left-0 mt-1 z-40 border border-stone-900 bg-white min-w-[200px]">
              {TARGET_BUILDERS.map((t) => (
                <button
                  key={t}
                  onClick={() => regenerate(t)}
                  className="block w-full text-left px-4 py-2.5 font-mono-x text-[10px] uppercase tracking-widest text-stone-800 hover:bg-stone-900 hover:text-white transition border-b border-stone-200 last:border-b-0"
                >
                  For {BUILDER_LABEL[t]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
