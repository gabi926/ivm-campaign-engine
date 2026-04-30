"use client";

import { useState, ChangeEvent } from "react";
import {
  Copy,
  Check,
  Sparkles,
  AlertTriangle,
  Image as ImageIcon,
  Video,
  ListChecks,
  Layout,
  Shield,
  Loader2,
  Wand2,
  Zap,
  Eye,
  Lightbulb,
  Target,
  Mail,
  Newspaper,
  MessageSquare,
  Radio,
  Users,
  Search,
} from "lucide-react";

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
  | "competitors";

interface CampaignInputs {
  clientName: string;
  website: string;
  offer: string;
  cta: string;
  audience: string;
  voice: string;
  competitors: string;
  channels: ChannelName[];
}

interface BigIdea {
  claim?: string;
  why_it_works?: string;
  supporting_proof?: string[];
}
interface CompetitorIntel {
  competitor?: string;
  positioning?: string;
  primary_hooks?: string[];
  offer_structure?: string;
  creative_patterns?: string;
  gaps_to_exploit?: string;
}
interface CopyVariation {
  angle?: string;
  lead_type?: string;
  awareness_level?: string;
  traffic_temp?: string;
  headline?: string;
  primary_text?: string;
  value_equation_score?: number;
  value_equation_reasoning?: string;
  best_for?: string;
}
interface CTAVariation {
  text?: string;
  framework?: string;
  trigger?: string;
}
interface ImageConcept {
  concept?: string;
  ai_prompt?: string;
  scroll_stop_principle?: string;
  placement?: string;
}
interface VideoConcept {
  hook?: string;
  hook_framework?: string;
  script?: string;
  duration?: string;
  style?: string;
  platform_fit?: string;
}
interface SearchAd {
  headline_1?: string;
  headline_2?: string;
  headline_3?: string;
  description?: string;
  intent_match?: string;
  sitelinks?: string[];
}
interface BannerConcept {
  size?: string;
  headline?: string;
  subhead?: string;
  cta_button?: string;
  visual_direction?: string;
}
interface NativeAd {
  headline?: string;
  description?: string;
  image_direction?: string;
}
interface ProgrammaticCreative {
  banner_concepts?: BannerConcept[];
  native_ads?: NativeAd[];
}
interface EmailItem {
  position?: string;
  subject?: string;
  preview_text?: string;
  body?: string;
  cta?: string;
  send_timing?: string;
}
interface NewsletterIssue {
  subject?: string;
  preview_text?: string;
  hook?: string;
  body?: string;
  soft_cta?: string;
}
interface SmsMessage {
  use_case?: string;
  message?: string;
  compliance_note?: string;
}
interface ContentPillar {
  pillar?: string;
  purpose?: string;
  content_types?: string[];
}
interface PostHook {
  hook?: string;
  framework?: string;
  pillar_match?: string;
}
interface CaptionTemplate {
  style?: string;
  template?: string;
}
interface OrganicStrategy {
  content_pillars?: ContentPillar[];
  post_hooks?: PostHook[];
  caption_templates?: CaptionTemplate[];
  soft_ctas?: string[];
  posting_cadence?: string;
  link_in_bio_strategy?: string;
}
interface FormField {
  label?: string;
  type?: string;
  required?: boolean;
}
interface FormSuggestions {
  fields?: FormField[];
  qualifying_questions?: string[];
}
interface LandingPageSection {
  section?: string;
  purpose?: string;
  copy_direction?: string;
}
interface ComplianceNotes {
  general_flags?: string[];
  platform_specific?: Record<string, string[]>;
}
interface WeaknessAuditItem {
  asset_reference?: string;
  weakness?: string;
  fix?: string;
}

interface CampaignOutput {
  big_idea?: BigIdea;
  competitor_intel?: CompetitorIntel[];
  copy_variations?: CopyVariation[];
  cta_variations?: CTAVariation[];
  image_concepts?: ImageConcept[];
  video_concepts?: VideoConcept[];
  search_ads?: SearchAd[];
  programmatic_creative?: ProgrammaticCreative;
  email_sequence?: EmailItem[];
  newsletter_issues?: NewsletterIssue[];
  sms_messages?: SmsMessage[];
  organic_strategy?: OrganicStrategy;
  form_suggestions?: FormSuggestions;
  landing_page_structure?: LandingPageSection[];
  compliance_notes?: ComplianceNotes;
  weakness_audit?: WeaknessAuditItem[];
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
    channels: ["Meta"],
  });
  const [generating, setGenerating] = useState(false);
  const [generatingStage, setGeneratingStage] = useState("");
  const [output, setOutput] = useState<CampaignOutput | null>(null);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const toggleChannel = (c: ChannelName) => {
    setInputs((prev) => ({
      ...prev,
      channels: prev.channels.includes(c)
        ? prev.channels.filter((x) => x !== c)
        : [...prev.channels, c],
    }));
  };

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1500);
    } catch {}
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
    setGenerating(true);
    setOutput(null);
    setGeneratingStage(
      inputs.competitors.trim() || inputs.website.trim()
        ? "Researching client + competitors..."
        : "Building multi-channel campaign...",
    );

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      setGeneratingStage("Synthesizing campaign...");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) ||
          `API returned ${res.status}`;
        throw new Error(msg);
      }
      setOutput(data as CampaignOutput);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      setError(`Generation failed: ${msg}. Try again.`);
    } finally {
      setGenerating(false);
      setGeneratingStage("");
    }
  };

  const reset = () => {
    setOutput(null);
    setError("");
  };

  const fmtBigIdea = () =>
    output?.big_idea
      ? `BIG IDEA: ${output.big_idea.claim}\n\nWHY: ${output.big_idea.why_it_works}\n\nPROOF:\n${output.big_idea.supporting_proof?.map((p, i) => `${i + 1}. ${p}`).join("\n")}`
      : "";
  const fmtCompetitor = () =>
    output?.competitor_intel
      ?.map(
        (c, i) =>
          `${i + 1}. ${c.competitor}\nPositioning: ${c.positioning}\nHooks: ${(c.primary_hooks || []).join(" | ")}\nOffer: ${c.offer_structure}\nCreative: ${c.creative_patterns}\nGap: ${c.gaps_to_exploit}`,
      )
      .join("\n\n---\n\n");
  const fmtCopy = () =>
    output?.copy_variations
      ?.map(
        (c, i) =>
          `${i + 1}. [${c.angle} · ${c.lead_type} · ${c.awareness_level} · ${c.traffic_temp}] (V.E. ${c.value_equation_score}/10)\n${c.headline}\n${c.primary_text}\n${c.value_equation_reasoning}`,
      )
      .join("\n\n");
  const fmtCTA = () =>
    output?.cta_variations
      ?.map((c, i) => `${i + 1}. ${c.text}  [${c.framework}] , ${c.trigger}`)
      .join("\n");
  const fmtImages = () =>
    output?.image_concepts
      ?.map(
        (img, i) =>
          `${i + 1}. ${img.concept}\nScroll-stop: ${img.scroll_stop_principle}\nPROMPT: ${img.ai_prompt}\nPlacement: ${img.placement}`,
      )
      .join("\n\n");
  const fmtVideos = () =>
    output?.video_concepts
      ?.map(
        (v, i) =>
          `${i + 1}. ${v.style} , ${v.duration} [${v.hook_framework}]\nHOOK: ${v.hook}\nSCRIPT:\n${v.script}\nFit: ${v.platform_fit}`,
      )
      .join("\n\n---\n\n");
  const fmtLP = () =>
    output?.landing_page_structure
      ?.map(
        (s, i) =>
          `${String(i + 1).padStart(2, "0")}. ${s.section}\n   ${s.purpose}\n   ${s.copy_direction}`,
      )
      .join("\n\n");
  const fmtAudit = () =>
    output?.weakness_audit
      ?.map((w, i) => `${i + 1}. ${w.asset_reference}\nWeakness: ${w.weakness}\nFix: ${w.fix}`)
      .join("\n\n");
  const fmtSearch = () =>
    output?.search_ads
      ?.map(
        (s, i) =>
          `${i + 1}. ${s.headline_1} | ${s.headline_2} | ${s.headline_3}\n${s.description}\nIntent: ${s.intent_match}\nSitelinks: ${(s.sitelinks || []).join(", ")}`,
      )
      .join("\n\n");
  const fmtProg = () => {
    if (!output?.programmatic_creative) return "";
    const banners = output.programmatic_creative.banner_concepts
      ?.map(
        (b, i) =>
          `${i + 1}. ${b.size}\n${b.headline} / ${b.subhead}\nCTA: ${b.cta_button}\nVisual: ${b.visual_direction}`,
      )
      .join("\n\n");
    const native = output.programmatic_creative.native_ads
      ?.map((n, i) => `Native ${i + 1}: ${n.headline}\n${n.description}\nImage: ${n.image_direction}`)
      .join("\n\n");
    return `BANNERS:\n${banners}\n\nNATIVE:\n${native}`;
  };
  const fmtEmail = () =>
    output?.email_sequence
      ?.map(
        (e) =>
          `${e.position}\nSubject: ${e.subject}\nPreview: ${e.preview_text}\nTiming: ${e.send_timing}\n\n${e.body}\n\nCTA: ${e.cta}`,
      )
      .join("\n\n===\n\n");
  const fmtNewsletter = () =>
    output?.newsletter_issues
      ?.map(
        (n, i) =>
          `Issue ${i + 1}\nSubject: ${n.subject}\nPreview: ${n.preview_text}\n\nHook: ${n.hook}\n\n${n.body}\n\nCTA: ${n.soft_cta}`,
      )
      .join("\n\n===\n\n");
  const fmtSms = () =>
    output?.sms_messages
      ?.map((s, i) => `${i + 1}. [${s.use_case}]\n${s.message}\nCompliance: ${s.compliance_note}`)
      .join("\n\n");
  const fmtOrganic = () => {
    if (!output?.organic_strategy) return "";
    const o = output.organic_strategy;
    const pillars = o.content_pillars
      ?.map(
        (p, i) => `${i + 1}. ${p.pillar}: ${p.purpose} (${(p.content_types || []).join(", ")})`,
      )
      .join("\n");
    const hooks = o.post_hooks
      ?.map((h, i) => `${i + 1}. [${h.framework}] ${h.hook} (pillar: ${h.pillar_match})`)
      .join("\n");
    const caps = o.caption_templates?.map((c) => `${c.style}:\n${c.template}`).join("\n\n");
    return `PILLARS:\n${pillars}\n\nHOOKS:\n${hooks}\n\nCAPTION TEMPLATES:\n${caps}\n\nCADENCE: ${o.posting_cadence}\n\nLINK-IN-BIO: ${o.link_in_bio_strategy}\n\nSOFT CTAs: ${(o.soft_ctas || []).join(" | ")}`;
  };

  return (
    <div
      className="min-h-screen bg-stone-100 text-stone-900"
      style={{ fontFamily: "'Fraunces', Georgia, 'Times New Roman', serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .font-display { font-family: 'Fraunces', Georgia, serif; }
        .font-mono-x { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .ring-accent:focus { outline: none; border-color: ${ACCENT}; box-shadow: 0 0 0 3px ${ACCENT}40; }
        .hover-dark:hover { color: #1c1917; }
        .accent-glow { box-shadow: 0 4px 20px ${ACCENT}66, 0 0 0 1px #1c1917; }
        .accent-chip { background-color: ${ACCENT}; color: #0a0a0a; padding: 2px 8px; display: inline-block; font-weight: 600; }
        .accent-icon-box { background-color: ${ACCENT}; color: #0a0a0a; padding: 6px; display: inline-flex; align-items: center; justify-content: center; }
        .accent-highlight { background-color: ${ACCENT}; color: #0a0a0a; padding: 0 12px; display: inline-block; }
        .meta-chip { font-family: 'JetBrains Mono', monospace; font-size: 9px; padding: 2px 6px; border: 1px solid #d6d3d1; background: #fafaf9; text-transform: uppercase; letter-spacing: 0.05em; color: #57534e; font-weight: 600; }
        .score-badge { font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 3px 7px; background: ${ACCENT}; color: #0a0a0a; font-weight: 700; }
        .grain { background-image: radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0); background-size: 28px 28px; }
        .pulse-dot { animation: pulse-dot 2s infinite; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        textarea, input { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        .card-shadow { box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03); }
        .big-idea-card { background: linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT}cc 100%); color: #0a0a0a; border: 2px solid #0a0a0a; }
        .channel-group-label { font-size: 9px; letter-spacing: 0.15em; color: #78716c; text-transform: uppercase; font-weight: 700; }
      `}</style>

      <div className="grain min-h-screen">
        <div className="max-w-6xl mx-auto px-5 py-10 md:px-8 md:py-14">

          {/* Header */}
          <header className="mb-10 md:mb-14 border-b border-stone-300 pb-8">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-2 h-2 rounded-full pulse-dot"
                style={{ backgroundColor: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
              />
              <span className="font-mono-x text-xs uppercase tracking-widest text-stone-500">
                IVM // Campaign Engine v5 · multi-channel
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-6xl font-black leading-none tracking-tight">
              Multi-channel campaigns
              <br />
              <span className="font-display italic accent-highlight">that actually convert.</span>
            </h1>
            <p className="font-mono-x text-xs md:text-sm text-stone-500 mt-5 max-w-2xl leading-relaxed">
              Paid · Programmatic · Email · Newsletter · SMS · Organic. Big Idea spine · Schwartz awareness · Hormozi value · Halbert specificity · self-critique pass.
            </p>
          </header>

          {/* Input form */}
          <section className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Client Name *" value={inputs.clientName} onChange={update("clientName")} placeholder="e.g. Aurora Skincare" />
              <Field label="Website" value={inputs.website} onChange={update("website")} placeholder="https://... (will be researched)" />
              <Field label="Offer *" value={inputs.offer} onChange={update("offer")} placeholder="What they sell, price, hook, mechanism, result, proof" multiline full />
              <Field label="Primary CTA" value={inputs.cta} onChange={update("cta")} placeholder="e.g. Book a Free Consult" />
              <Field label="Target Audience" value={inputs.audience} onChange={update("audience")} placeholder="Real demographic + psychographic" />
              <Field label="Brand Voice" value={inputs.voice} onChange={update("voice")} placeholder="Tone, attitude, no-go words, reference brands" full />
              <Field label="Competitors" value={inputs.competitors} onChange={update("competitors")} placeholder="URLs or names, comma separated" multiline full />
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
                {generating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    {generatingStage || "Working..."}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Wand2 size={14} />
                    Generate Campaign
                  </span>
                )}
              </button>
              {output && (
                <button
                  onClick={reset}
                  className="px-6 py-4 border border-stone-300 bg-white text-stone-600 font-mono-x text-xs uppercase tracking-widest hover:border-stone-500 transition"
                >
                  Reset
                </button>
              )}
              {generating && (
                <span className="font-mono-x text-[10px] text-stone-500 uppercase tracking-widest">
                  ~45-60s · scales with channels
                </span>
              )}
            </div>
          </section>

          {/* Output */}
          {output && (
            <div className="space-y-12">

              {/* 00 Compliance */}
              <Section number="00" icon={<Shield size={18} />} title="Compliance Watch" subtitle="Read before launch">
                <ComplianceBlock data={output.compliance_notes} />
              </Section>

              {/* 01 Big Idea */}
              {output.big_idea && (
                <Section number="01" icon={<Lightbulb size={18} />} title="The Big Idea" subtitle="The spine · everything orbits this" onCopyAll={() => handleCopy(fmtBigIdea(), "bi-all")} copiedAll={copiedKey === "bi-all"}>
                  <div className="big-idea-card p-7 card-shadow">
                    <div className="font-mono-x text-[10px] uppercase tracking-widest mb-3 opacity-70">Central Claim</div>
                    <h3 className="font-display text-2xl md:text-3xl font-black leading-tight mb-5">{output.big_idea.claim}</h3>
                    <div className="border-t border-stone-900/30 pt-4 mb-4">
                      <div className="font-mono-x text-[10px] uppercase tracking-widest mb-2 opacity-70">Why It Works</div>
                      <p className="text-sm md:text-base leading-relaxed">{output.big_idea.why_it_works}</p>
                    </div>
                    <div className="border-t border-stone-900/30 pt-4">
                      <div className="font-mono-x text-[10px] uppercase tracking-widest mb-2 opacity-70">Supporting Proof</div>
                      <ol className="space-y-1.5">
                        {output.big_idea.supporting_proof?.map((p, i) => (
                          <li key={i} className="text-sm flex gap-2">
                            <span className="font-mono-x font-bold flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </Section>
              )}

              {/* 02 Competitor Intel */}
              {output.competitor_intel && output.competitor_intel.length > 0 && (
                <Section number="02" icon={<Eye size={18} />} title="Competitor Intel" subtitle={`${output.competitor_intel.length} analyzed`} onCopyAll={() => handleCopy(fmtCompetitor() || "", "comp-all")} copiedAll={copiedKey === "comp-all"}>
                  <div className="space-y-4">
                    {output.competitor_intel.map((comp, i) => (
                      <div key={i} className="border border-stone-200 bg-white card-shadow p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">Competitor {String(i + 1).padStart(2, "0")}</span>
                          <button onClick={() => handleCopy(`${comp.competitor}\nPositioning: ${comp.positioning}\nHooks: ${(comp.primary_hooks || []).join(" | ")}\nOffer: ${comp.offer_structure}\nCreative: ${comp.creative_patterns}\nGap: ${comp.gaps_to_exploit}`, `comp-${i}`)} className="text-stone-400 hover-dark">
                            {copiedKey === `comp-${i}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <h4 className="font-display text-xl font-bold mb-4">{comp.competitor}</h4>
                        <div className="space-y-4 text-sm">
                          <IntelRow label="Positioning" value={comp.positioning} />
                          <div>
                            <span className="accent-chip font-mono-x text-[10px] uppercase tracking-widest">Hooks They Use</span>
                            <ul className="mt-2 space-y-1">{comp.primary_hooks?.map((h, j) => (<li key={j} className="text-stone-700 flex gap-2"><span className="text-stone-400 flex-shrink-0">▸</span><span>{h}</span></li>))}</ul>
                          </div>
                          <IntelRow label="Offer Structure" value={comp.offer_structure} />
                          <IntelRow label="Creative Patterns" value={comp.creative_patterns} />
                          <div className="pt-3 border-t border-stone-200">
                            <span className="font-mono-x text-[10px] uppercase tracking-widest text-yellow-700 font-bold">⚠ Gap to Exploit</span>
                            <p className="text-stone-900 mt-1.5 font-medium leading-relaxed">{comp.gaps_to_exploit}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* 03 Copy Angles */}
              <Section number="03" icon={<Sparkles size={18} />} title="Copy Angles" subtitle={`${output.copy_variations?.length || 0} · framework-tagged · scored`} onCopyAll={() => handleCopy(fmtCopy() || "", "copy-all")} copiedAll={copiedKey === "copy-all"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {output.copy_variations?.map((c, i) => (
                    <div key={i} className="border border-stone-200 bg-white card-shadow p-5 group hover:border-stone-400 transition">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">Copy {String(i + 1).padStart(2, "0")}</span>
                        <div className="flex items-center gap-2">
                          {c.value_equation_score && <span className="score-badge">V.E. {c.value_equation_score}/10</span>}
                          <button onClick={() => handleCopy(`${c.headline}\n\n${c.primary_text}`, `copy-${i}`)} className="text-stone-400 hover-dark">
                            {copiedKey === `copy-${i}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {c.angle && <span className="accent-chip font-mono-x text-[10px]">{c.angle}</span>}
                        {c.lead_type && <span className="meta-chip">{c.lead_type} Lead</span>}
                        {c.awareness_level && <span className="meta-chip">{c.awareness_level}</span>}
                        {c.traffic_temp && <span className="meta-chip">{c.traffic_temp}</span>}
                      </div>
                      <h3 className="font-display text-xl font-bold leading-tight mb-2">{c.headline}</h3>
                      <p className="text-sm text-stone-700 leading-relaxed mb-3">{c.primary_text}</p>
                      {c.value_equation_reasoning && <div className="text-xs text-stone-500 italic leading-relaxed border-t border-stone-200 pt-2 mb-2">{c.value_equation_reasoning}</div>}
                      <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-400">Best for: <span className="text-stone-600 normal-case tracking-normal">{c.best_for}</span></div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* 04 CTAs */}
              <Section number="04" icon={<Zap size={18} />} title="CTA Stack" subtitle={`${output.cta_variations?.length || 0} · psychology-tagged`} onCopyAll={() => handleCopy(fmtCTA() || "", "cta-all")} copiedAll={copiedKey === "cta-all"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {output.cta_variations?.map((c, i) => (
                    <div key={i} className="border border-stone-200 bg-white card-shadow px-4 py-3 group hover:border-stone-400 transition">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="font-display font-bold text-base flex-1">{c.text}</div>
                        <button onClick={() => handleCopy(c.text || "", `cta-${i}`)} className="text-stone-400 hover-dark flex-shrink-0">
                          {copiedKey === `cta-${i}` ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                      {c.framework && <div className="mb-1.5"><span className="meta-chip">{c.framework}</span></div>}
                      <div className="font-mono-x text-[10px] text-stone-500 leading-relaxed">{c.trigger}</div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* 05 Search Ads (Google) */}
              {output.search_ads && output.search_ads.length > 0 && (
                <Section number="05" icon={<Search size={18} />} title="Search Ads" subtitle={`${output.search_ads.length} · Google ready`} onCopyAll={() => handleCopy(fmtSearch() || "", "search-all")} copiedAll={copiedKey === "search-all"}>
                  <div className="space-y-3">
                    {output.search_ads.map((s, i) => (
                      <div key={i} className="border border-stone-200 bg-white card-shadow p-5">
                        <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2">Search Ad {String(i + 1).padStart(2, "0")}</div>
                        <div className="font-display text-base font-bold leading-tight text-blue-700 mb-1">{s.headline_1} | {s.headline_2} | {s.headline_3}</div>
                        <p className="text-sm text-stone-700 mb-3">{s.description}</p>
                        <div className="text-xs text-stone-500 italic mb-2">Intent: {s.intent_match}</div>
                        {s.sitelinks && s.sitelinks.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-200">
                            {s.sitelinks.map((sl, j) => (<span key={j} className="meta-chip">{sl}</span>))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* 06 Programmatic */}
              {output.programmatic_creative && (
                <Section number="06" icon={<Radio size={18} />} title="Programmatic Creative" subtitle="Display banners + native" onCopyAll={() => handleCopy(fmtProg(), "prog-all")} copiedAll={copiedKey === "prog-all"}>
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-3">Banner Concepts</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {output.programmatic_creative.banner_concepts?.map((b, i) => (
                          <div key={i} className="border border-stone-200 bg-white card-shadow p-4">
                            <div className="flex justify-between items-start mb-3">
                              <span className="accent-chip font-mono-x text-[10px]">{b.size}</span>
                              <button onClick={() => handleCopy(`${b.size}\n${b.headline} / ${b.subhead}\nCTA: ${b.cta_button}\nVisual: ${b.visual_direction}`, `prog-${i}`)} className="text-stone-400 hover-dark">
                                {copiedKey === `prog-${i}` ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                            <div className="font-display font-bold text-base leading-tight mb-1">{b.headline}</div>
                            <div className="text-sm text-stone-600 mb-2">{b.subhead}</div>
                            <div className="text-xs mb-2"><span className="meta-chip">CTA: {b.cta_button}</span></div>
                            <div className="text-xs text-stone-500 italic leading-relaxed pt-2 border-t border-stone-200">{b.visual_direction}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-3">Native Ads</h4>
                      <div className="space-y-2">
                        {output.programmatic_creative.native_ads?.map((n, i) => (
                          <div key={i} className="border border-stone-200 bg-white card-shadow p-4">
                            <div className="font-display font-bold text-base mb-1">{n.headline}</div>
                            <p className="text-sm text-stone-700 mb-2">{n.description}</p>
                            <div className="text-xs text-stone-500 italic pt-2 border-t border-stone-200">Image: {n.image_direction}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {/* 07 Email Sequence */}
              {output.email_sequence && output.email_sequence.length > 0 && (
                <Section number="07" icon={<Mail size={18} />} title="Email Sequence" subtitle={`${output.email_sequence.length}-email automation`} onCopyAll={() => handleCopy(fmtEmail() || "", "email-all")} copiedAll={copiedKey === "email-all"}>
                  <div className="space-y-4">
                    {output.email_sequence.map((e, i) => (
                      <div key={i} className="border border-stone-200 bg-white card-shadow p-5">
                        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="accent-chip font-mono-x text-[10px]">{e.position}</span>
                            <span className="meta-chip">⏰ {e.send_timing}</span>
                          </div>
                          <button onClick={() => handleCopy(`Subject: ${e.subject}\nPreview: ${e.preview_text}\n\n${e.body}\n\nCTA: ${e.cta}`, `email-${i}`)} className="text-stone-400 hover-dark">
                            {copiedKey === `email-${i}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <div className="border-l-2 border-stone-300 pl-3 mb-3">
                          <div className="font-display text-lg font-bold leading-tight">{e.subject}</div>
                          <div className="text-xs text-stone-500 italic mt-1">{e.preview_text}</div>
                        </div>
                        <pre className="font-mono-x text-xs text-stone-700 leading-relaxed whitespace-pre-wrap break-words mb-3">{e.body}</pre>
                        <div className="pt-3 border-t border-stone-200">
                          <span className="meta-chip">CTA</span>
                          <span className="text-sm font-bold ml-2">{e.cta}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* 08 Newsletter */}
              {output.newsletter_issues && output.newsletter_issues.length > 0 && (
                <Section number="08" icon={<Newspaper size={18} />} title="Newsletter Issues" subtitle={`${output.newsletter_issues.length} · editorial-style`} onCopyAll={() => handleCopy(fmtNewsletter() || "", "news-all")} copiedAll={copiedKey === "news-all"}>
                  <div className="space-y-4">
                    {output.newsletter_issues.map((n, i) => (
                      <div key={i} className="border border-stone-200 bg-white card-shadow p-5">
                        <div className="flex justify-between items-start mb-3">
                          <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">Issue {String(i + 1).padStart(2, "0")}</span>
                          <button onClick={() => handleCopy(`${n.subject}\n${n.preview_text}\n\n${n.hook}\n\n${n.body}\n\n${n.soft_cta}`, `news-${i}`)} className="text-stone-400 hover-dark">
                            {copiedKey === `news-${i}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <div className="border-l-2 border-stone-300 pl-3 mb-3">
                          <div className="font-display text-lg font-bold leading-tight">{n.subject}</div>
                          <div className="text-xs text-stone-500 italic mt-1">{n.preview_text}</div>
                        </div>
                        <div className="mb-3">
                          <span className="meta-chip">Hook</span>
                          <p className="font-display text-base italic mt-1.5 leading-relaxed">{n.hook}</p>
                        </div>
                        <p className="text-sm text-stone-700 leading-relaxed mb-3 whitespace-pre-wrap">{n.body}</p>
                        <div className="pt-3 border-t border-stone-200 text-sm italic text-stone-600">{n.soft_cta}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* 09 SMS */}
              {output.sms_messages && output.sms_messages.length > 0 && (
                <Section number="09" icon={<MessageSquare size={18} />} title="SMS Messages" subtitle={`${output.sms_messages.length} · TCPA-aware`} onCopyAll={() => handleCopy(fmtSms() || "", "sms-all")} copiedAll={copiedKey === "sms-all"}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {output.sms_messages.map((s, i) => (
                      <div key={i} className="border border-stone-200 bg-white card-shadow p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="accent-chip font-mono-x text-[10px]">{s.use_case}</span>
                          <button onClick={() => handleCopy(s.message || "", `sms-${i}`)} className="text-stone-400 hover-dark">
                            {copiedKey === `sms-${i}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <div className="bg-stone-100 border border-stone-200 p-3 my-2 font-mono-x text-sm leading-relaxed">{s.message}</div>
                        <div className="text-xs text-stone-500 italic leading-relaxed pt-2 border-t border-stone-200">
                          <span className="font-bold text-stone-700">⚠ Compliance: </span>{s.compliance_note}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* 10 Organic */}
              {output.organic_strategy && (
                <Section number="10" icon={<Users size={18} />} title="Organic Social Strategy" subtitle="Pillars · hooks · cadence · soft CTAs" onCopyAll={() => handleCopy(fmtOrganic(), "org-all")} copiedAll={copiedKey === "org-all"}>
                  <div className="space-y-5">
                    {/* Pillars */}
                    <div className="border border-stone-200 bg-white card-shadow p-5">
                      <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-3">Content Pillars</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {output.organic_strategy.content_pillars?.map((p, i) => (
                          <div key={i} className="border border-stone-200 bg-stone-50 p-3">
                            <div className="font-display font-bold text-base mb-1">{p.pillar}</div>
                            <p className="text-xs text-stone-600 italic mb-2">{p.purpose}</p>
                            <div className="flex flex-wrap gap-1">
                              {p.content_types?.map((t, j) => (<span key={j} className="meta-chip">{t}</span>))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Hooks */}
                    <div className="border border-stone-200 bg-white card-shadow p-5">
                      <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-3">Post Hooks</h4>
                      <ol className="space-y-2">
                        {output.organic_strategy.post_hooks?.map((h, i) => (
                          <li key={i} className="flex gap-3 items-start border-l-2 border-stone-200 pl-3 py-1">
                            <span className="font-mono-x text-[10px] text-stone-400 mt-1 flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                            <div className="flex-1">
                              <div className="font-display text-sm font-bold leading-snug">{h.hook}</div>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                <span className="meta-chip">{h.framework}</span>
                                <span className="meta-chip">{h.pillar_match}</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                    {/* Caption Templates */}
                    <div className="border border-stone-200 bg-white card-shadow p-5">
                      <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-3">Caption Templates</h4>
                      <div className="space-y-3">
                        {output.organic_strategy.caption_templates?.map((c, i) => (
                          <div key={i}>
                            <span className="accent-chip font-mono-x text-[10px]">{c.style}</span>
                            <pre className="font-mono-x text-xs text-stone-700 leading-relaxed whitespace-pre-wrap break-words mt-2 bg-stone-50 p-3 border border-stone-200">{c.template}</pre>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Cadence + Bio + Soft CTAs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="border border-stone-200 bg-white card-shadow p-4">
                        <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2">Cadence</h4>
                        <p className="text-sm text-stone-700 leading-relaxed">{output.organic_strategy.posting_cadence}</p>
                      </div>
                      <div className="border border-stone-200 bg-white card-shadow p-4">
                        <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2">Link-in-Bio</h4>
                        <p className="text-sm text-stone-700 leading-relaxed">{output.organic_strategy.link_in_bio_strategy}</p>
                      </div>
                      <div className="border border-stone-200 bg-white card-shadow p-4">
                        <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2">Soft CTAs</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {output.organic_strategy.soft_ctas?.map((cta, i) => (<span key={i} className="meta-chip">{cta}</span>))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {/* 11 Image Concepts */}
              {output.image_concepts && output.image_concepts.length > 0 && (
                <Section number="11" icon={<ImageIcon size={18} />} title="Image Concepts" subtitle={`${output.image_concepts.length} · scroll-stop tested`} onCopyAll={() => handleCopy(fmtImages() || "", "img-all")} copiedAll={copiedKey === "img-all"}>
                  <div className="space-y-4">
                    {output.image_concepts.map((img, i) => (
                      <div key={i} className="border border-stone-200 bg-white card-shadow p-5">
                        <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2">Concept {String(i + 1).padStart(2, "0")}</div>
                        <h4 className="font-display text-lg font-bold mb-2">{img.concept}</h4>
                        {img.scroll_stop_principle && (
                          <div className="mb-3 text-xs text-stone-600 italic leading-relaxed">
                            <span className="meta-chip mr-2">Scroll-Stop</span>{img.scroll_stop_principle}
                          </div>
                        )}
                        <div className="bg-stone-100 border border-stone-200 p-3 mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="accent-chip font-mono-x text-[10px] uppercase tracking-widest">AI Prompt</span>
                            <button onClick={() => handleCopy(img.ai_prompt || "", `img-${i}`)} className="text-stone-400 hover-dark">
                              {copiedKey === `img-${i}` ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                          <p className="font-mono-x text-xs text-stone-700 leading-relaxed">{img.ai_prompt}</p>
                        </div>
                        <div className="font-mono-x text-[10px] text-stone-400 uppercase tracking-wider">Placement: <span className="text-stone-700 normal-case tracking-normal">{img.placement}</span></div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* 12 Video Concepts */}
              {output.video_concepts && output.video_concepts.length > 0 && (
                <Section number="12" icon={<Video size={18} />} title="Video Concepts" subtitle={`${output.video_concepts.length} · hook-framework tagged`} onCopyAll={() => handleCopy(fmtVideos() || "", "vid-all")} copiedAll={copiedKey === "vid-all"}>
                  <div className="space-y-4">
                    {output.video_concepts.map((v, i) => (
                      <div key={i} className="border border-stone-200 bg-white card-shadow p-5">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">Video {String(i + 1).padStart(2, "0")}</span>
                            <span className="accent-chip font-mono-x text-[10px] uppercase tracking-widest">{v.style}</span>
                            <span className="meta-chip">{v.duration}</span>
                            {v.hook_framework && <span className="meta-chip">{v.hook_framework}</span>}
                          </div>
                          <button onClick={() => handleCopy(`HOOK: ${v.hook}\n\nSCRIPT:\n${v.script}\n\nDuration: ${v.duration} | Style: ${v.style}`, `vid-${i}`)} className="text-stone-400 hover-dark">
                            {copiedKey === `vid-${i}` ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                        <div className="mb-4 pb-4 border-b border-stone-200">
                          <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2">Hook · 0-3s</div>
                          <p className="font-display text-lg font-bold italic leading-snug">&ldquo;{v.hook}&rdquo;</p>
                        </div>
                        <div className="mb-3">
                          <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2">Script</div>
                          <pre className="font-mono-x text-xs text-stone-700 leading-relaxed whitespace-pre-wrap break-words">{v.script}</pre>
                        </div>
                        {v.platform_fit && <div className="font-mono-x text-[10px] text-stone-400 uppercase tracking-wider pt-3 border-t border-stone-200">Platform fit: <span className="text-stone-700 normal-case tracking-normal">{v.platform_fit}</span></div>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* 13 Form */}
              <Section number="13" icon={<ListChecks size={18} />} title="Form Build" subtitle="Fields + qualifying questions">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-3">Fields</h4>
                    <div className="space-y-2">
                      {output.form_suggestions?.fields?.map((f, i) => (
                        <div key={i} className="flex items-center justify-between border border-stone-200 bg-white card-shadow px-4 py-2.5">
                          <span className="font-display font-medium">{f.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-x text-[10px] text-stone-500 uppercase">{f.type}</span>
                            {f.required && <span className="text-xs font-bold text-stone-900">*</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-3">Qualifying Questions</h4>
                    <ol className="space-y-3">
                      {output.form_suggestions?.qualifying_questions?.map((q, i) => (
                        <li key={i} className="flex gap-3 border border-stone-200 bg-white card-shadow px-4 py-3">
                          <span className="accent-chip font-mono-x text-[10px] mt-0.5 flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
                          <span className="text-sm text-stone-700 leading-relaxed">{q}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </Section>

              {/* 14 LP */}
              <Section number="14" icon={<Layout size={18} />} title="Landing Page Structure" subtitle={`${output.landing_page_structure?.length || 0} sections · Big Idea anchored`} onCopyAll={() => handleCopy(fmtLP() || "", "lp-all")} copiedAll={copiedKey === "lp-all"}>
                <div className="space-y-3">
                  {output.landing_page_structure?.map((s, i) => (
                    <div key={i} className="border-l-4 pl-5 py-2" style={{ borderColor: ACCENT }}>
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="font-mono-x text-[10px] text-stone-500">{String(i + 1).padStart(2, "0")}</span>
                        <h4 className="font-display text-lg font-bold">{s.section}</h4>
                      </div>
                      <p className="text-xs text-stone-500 italic mb-2">{s.purpose}</p>
                      <p className="text-sm text-stone-700 leading-relaxed">{s.copy_direction}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* 15 Weakness Audit */}
              {output.weakness_audit && output.weakness_audit.length > 0 && (
                <Section number="15" icon={<Target size={18} />} title="Weakness Audit" subtitle="3 weakest assets · self-critique · fixes" onCopyAll={() => handleCopy(fmtAudit() || "", "aud-all")} copiedAll={copiedKey === "aud-all"}>
                  <div className="border-2 border-stone-900 bg-white card-shadow p-1">
                    <div className="bg-stone-900 text-stone-100 px-4 py-2 mb-1">
                      <span className="font-mono-x text-[10px] uppercase tracking-widest">⚡ Brutal honesty , patch before launch</span>
                    </div>
                    <div className="space-y-3 p-4">
                      {output.weakness_audit.map((w, i) => (
                        <div key={i} className="border border-stone-200 p-4 bg-stone-50">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="accent-chip font-mono-x text-[10px]">{w.asset_reference}</span>
                            <span className="font-mono-x text-[10px] uppercase tracking-widest text-red-700 font-bold">Weak</span>
                          </div>
                          <div className="mb-2">
                            <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 block mb-1">Why it&apos;s weak</span>
                            <p className="text-sm text-stone-800 leading-relaxed">{w.weakness}</p>
                          </div>
                          <div className="pt-2 border-t border-stone-200">
                            <span className="font-mono-x text-[10px] uppercase tracking-widest font-bold mb-1 inline-block" style={{ color: "#0a0a0a", backgroundColor: ACCENT, padding: "2px 6px" }}>Fix</span>
                            <p className="text-sm text-stone-800 leading-relaxed mt-1.5 font-medium">{w.fix}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Section>
              )}

              <div className="pt-8 border-t border-stone-300 text-center">
                <p className="font-mono-x text-[10px] uppercase tracking-widest text-stone-400">Patch the weak ones · Ship it</p>
              </div>
            </div>
          )}

          {!output && !generating && (
            <div className="mt-16 text-center py-12 border border-dashed border-stone-300 bg-white/50">
              <p className="font-display text-2xl italic text-stone-400 mb-2">Awaiting inputs.</p>
              <p className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">Pick channels · Drop competitors · Generate · Ship</p>
            </div>
          )}
        </div>
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

function Section({
  number,
  icon,
  title,
  subtitle,
  children,
  onCopyAll,
  copiedAll,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onCopyAll?: () => void;
  copiedAll?: boolean;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-300 flex-wrap gap-3">
        <div className="flex items-center gap-3 md:gap-4 flex-wrap">
          <span className="font-mono-x text-xs text-stone-500">/{number}</span>
          <span className="accent-icon-box">{icon}</span>
          <h2 className="font-display text-xl md:text-2xl font-bold">{title}</h2>
          <span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">{subtitle}</span>
        </div>
        {onCopyAll && (
          <button onClick={onCopyAll} className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 hover-dark flex items-center gap-2">
            {copiedAll ? <Check size={12} /> : <Copy size={12} />}
            {copiedAll ? "Copied" : "Copy All"}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function IntelRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="accent-chip font-mono-x text-[10px] uppercase tracking-widest">{label}</span>
      <p className="text-stone-700 mt-2 leading-relaxed">{value}</p>
    </div>
  );
}

function ComplianceBlock({ data }: { data?: ComplianceNotes }) {
  const general = data?.general_flags || [];
  const platformSpecific = data?.platform_specific || {};
  const hasFlags =
    general.some((f) => f && !/no flags/i.test(f)) ||
    Object.values(platformSpecific).some((arr) => arr && arr.length > 0);
  return (
    <div className={`border p-5 card-shadow ${hasFlags ? "border-yellow-400 bg-yellow-50" : "border-stone-200 bg-white"}`}>
      {general.length > 0 && (
        <div className="mb-4 last:mb-0">
          <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-yellow-700 font-bold mb-2">General</h4>
          <ul className="space-y-1.5">{general.map((f, i) => (<li key={i} className="text-sm text-stone-800 flex gap-2"><span className="text-yellow-600 flex-shrink-0">▸</span><span>{f}</span></li>))}</ul>
        </div>
      )}
      {Object.entries(platformSpecific).map(([platform, flags]) =>
        flags && flags.length > 0 ? (
          <div key={platform} className="mb-3 last:mb-0">
            <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-700 font-bold mb-2">{platform}</h4>
            <ul className="space-y-1.5">{flags.map((f, i) => (<li key={i} className="text-sm text-stone-800 flex gap-2"><span className="text-stone-400 flex-shrink-0">▸</span><span>{f}</span></li>))}</ul>
          </div>
        ) : null,
      )}
    </div>
  );
}
