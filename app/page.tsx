"use client";

import Image from "next/image";
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
  Download,
  ClipboardCopy,
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

import type {
  CampaignOutput,
  ComplianceNotes,
  LandingPageAudit,
  LpCategoryScore,
} from "./_lib/campaign-types";

function buildMarkdown(clientName: string, channels: string[], o: CampaignOutput): string {
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);
  const hr = () => push("\n---\n");

  push(`# ${clientName} — Campaign Brief`);
  push(`_Generated ${date} · Channels: ${channels.join(" · ") || "—"}_`);
  hr();

  if (o.big_idea) {
    push(`## Big Idea`);
    if (o.big_idea.claim) push(`**${o.big_idea.claim}**`);
    if (o.big_idea.why_it_works) {
      push();
      push(`_Why:_ ${o.big_idea.why_it_works}`);
    }
    if (o.big_idea.supporting_proof?.length) {
      push();
      push(`**Supporting proof:**`);
      o.big_idea.supporting_proof.forEach((p) => push(`- ${p}`));
    }
    hr();
  }

  if (o.audit_input_error) {
    push(`## Landing Page Audit`);
    push(`> ⚠ Audit skipped: ${o.audit_input_error}`);
    hr();
  } else if (o.landing_page_audit) {
    const a = o.landing_page_audit;
    push(`## Landing Page Audit`);
    push(`**Overall:** ${a.overall_score ?? "—"}/100`);
    if (a.url_audited) push(`**URL audited:** ${a.url_audited}`);
    if (a.big_idea_alignment) {
      push();
      push(`**Big Idea alignment:** ${a.big_idea_alignment.verdict ?? "—"} (${a.big_idea_alignment.score ?? "—"}/10)`);
      if (a.big_idea_alignment.what_lp_says) push(`- LP says: ${a.big_idea_alignment.what_lp_says}`);
      if (a.big_idea_alignment.what_campaign_promises)
        push(`- Campaign promises: ${a.big_idea_alignment.what_campaign_promises}`);
      if (a.big_idea_alignment.gap_analysis) push(`- **Gap:** ${a.big_idea_alignment.gap_analysis}`);
    }
    if (a.five_second_test) {
      push();
      push(`**5-second test:** ${a.five_second_test.verdict ?? "—"}`);
      if (a.five_second_test.what_user_understands)
        push(`> "${a.five_second_test.what_user_understands}"`);
    }
    if (a.top_3_priority_fixes?.length) {
      push();
      push(`### Top 3 priority fixes`);
      a.top_3_priority_fixes.forEach((f) => {
        push(`${f.rank ?? "•"}. **${f.fix ?? "—"}**`);
        if (f.why) push(`   - Why: ${f.why}`);
        if (f.implementation) push(`   - How: ${f.implementation}`);
      });
    }
    if (a.category_scores) {
      push();
      push(`### Category scores`);
      push(`| Category | Score | Issues | Fixes |`);
      push(`|---|---|---|---|`);
      const cats: { label: string; data?: LpCategoryScore }[] = [
        { label: "Above-fold clarity", data: a.category_scores.above_fold_clarity },
        { label: "Hero match", data: a.category_scores.hero_match },
        { label: "Social proof", data: a.category_scores.social_proof },
        { label: "Offer clarity", data: a.category_scores.offer_clarity },
        { label: "CTA strength", data: a.category_scores.cta_strength },
        { label: "Trust signals", data: a.category_scores.trust_signals },
        { label: "Friction audit", data: a.category_scores.friction_audit },
        { label: "Mobile considerations", data: a.category_scores.mobile_considerations },
      ];
      cats.forEach(({ label, data }) => {
        const escape = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
        const issues = (data?.issues || []).map(escape).join("; ") || "—";
        const fixes = (data?.fixes || []).map(escape).join("; ") || "—";
        push(`| ${label} | ${data?.score ?? "—"}/10 | ${issues} | ${fixes} |`);
      });
    }
    if (a.conversion_blockers?.length) {
      push();
      push(`### Conversion blockers`);
      a.conversion_blockers.forEach((b) => push(`- ${b}`));
    }
    if (a.what_is_working?.length) {
      push();
      push(`### What's working`);
      a.what_is_working.forEach((w) => push(`- ${w}`));
    }
    if (a.page_performance_note) {
      push();
      push(`> _${a.page_performance_note}_`);
    }
    hr();
  }

  if (o.competitor_intel?.length) {
    push(`## Competitor Intel`);
    o.competitor_intel.forEach((c, i) => {
      push();
      push(`### ${i + 1}. ${c.competitor || "—"}`);
      if (c.positioning) push(`**Positioning:** ${c.positioning}`);
      if (c.primary_hooks?.length) push(`**Hooks:** ${c.primary_hooks.join(" | ")}`);
      if (c.offer_structure) push(`**Offer:** ${c.offer_structure}`);
      if (c.creative_patterns) push(`**Creative:** ${c.creative_patterns}`);
      if (c.gaps_to_exploit) push(`**Gap to exploit:** ${c.gaps_to_exploit}`);
    });
    hr();
  }

  if (o.copy_variations?.length) {
    push(`## Copy Angles`);
    o.copy_variations.forEach((c, i) => {
      const meta = [c.angle, c.lead_type && `${c.lead_type} Lead`, c.awareness_level, c.traffic_temp]
        .filter(Boolean)
        .join(" · ");
      push();
      push(`### Copy ${String(i + 1).padStart(2, "0")} — ${meta || "—"} · V.E. ${c.value_equation_score ?? "—"}/10`);
      if (c.headline) push(`**${c.headline}**`);
      if (c.primary_text) push(c.primary_text);
      if (c.value_equation_reasoning) push(`_${c.value_equation_reasoning}_`);
      if (c.best_for) push(`Best for: ${c.best_for}`);
    });
    hr();
  }

  if (o.cta_variations?.length) {
    push(`## CTA Stack`);
    o.cta_variations.forEach((c, i) => {
      push(`${i + 1}. **${c.text || "—"}** [${c.framework || "—"}] — ${c.trigger || ""}`);
    });
    hr();
  }

  if (o.search_ads?.length) {
    push(`## Search Ads`);
    o.search_ads.forEach((s, i) => {
      push();
      push(`### Search Ad ${String(i + 1).padStart(2, "0")}`);
      push(`- ${[s.headline_1, s.headline_2, s.headline_3].filter(Boolean).join(" | ")}`);
      if (s.description) push(`- ${s.description}`);
      if (s.intent_match) push(`- Intent: ${s.intent_match}`);
      if (s.sitelinks?.length) push(`- Sitelinks: ${s.sitelinks.join(", ")}`);
    });
    hr();
  }

  if (o.programmatic_creative) {
    push(`## Programmatic Creative`);
    if (o.programmatic_creative.banner_concepts?.length) {
      push();
      push(`### Banners`);
      o.programmatic_creative.banner_concepts.forEach((b, i) => {
        push(`${i + 1}. **${b.size || "—"}** — ${b.headline || ""} / ${b.subhead || ""}`);
        if (b.cta_button) push(`   - CTA: ${b.cta_button}`);
        if (b.visual_direction) push(`   - Visual: ${b.visual_direction}`);
      });
    }
    if (o.programmatic_creative.native_ads?.length) {
      push();
      push(`### Native Ads`);
      o.programmatic_creative.native_ads.forEach((n, i) => {
        push(`${i + 1}. **${n.headline || "—"}** — ${n.description || ""}`);
        if (n.image_direction) push(`   - Image: ${n.image_direction}`);
      });
    }
    hr();
  }

  if (o.email_sequence?.length) {
    push(`## Email Sequence`);
    o.email_sequence.forEach((e) => {
      push();
      push(`### ${e.position || "Email"}`);
      if (e.subject) push(`**Subject:** ${e.subject}`);
      if (e.preview_text) push(`**Preview:** ${e.preview_text}`);
      if (e.send_timing) push(`**Send timing:** ${e.send_timing}`);
      if (e.body) {
        push();
        push("```");
        push(e.body);
        push("```");
      }
      if (e.cta) push(`**CTA:** ${e.cta}`);
    });
    hr();
  }

  if (o.newsletter_issues?.length) {
    push(`## Newsletter Issues`);
    o.newsletter_issues.forEach((n, i) => {
      push();
      push(`### Issue ${String(i + 1).padStart(2, "0")}`);
      if (n.subject) push(`**Subject:** ${n.subject}`);
      if (n.preview_text) push(`**Preview:** ${n.preview_text}`);
      if (n.hook) push(`**Hook:** _${n.hook}_`);
      if (n.body) {
        push();
        push(n.body);
      }
      if (n.soft_cta) push(`_${n.soft_cta}_`);
    });
    hr();
  }

  if (o.sms_messages?.length) {
    push(`## SMS Messages`);
    o.sms_messages.forEach((s, i) => {
      push(`${i + 1}. [${s.use_case || "—"}] ${s.message || ""}`);
      if (s.compliance_note) push(`   - Compliance: ${s.compliance_note}`);
    });
    hr();
  }

  if (o.organic_strategy) {
    const og = o.organic_strategy;
    push(`## Organic Social Strategy`);
    if (og.content_pillars?.length) {
      push();
      push(`### Pillars`);
      og.content_pillars.forEach((p, i) => {
        push(`${i + 1}. **${p.pillar || "—"}** — ${p.purpose || ""} (${(p.content_types || []).join(", ")})`);
      });
    }
    if (og.post_hooks?.length) {
      push();
      push(`### Hooks`);
      og.post_hooks.forEach((h, i) => {
        push(`${i + 1}. [${h.framework || "—"}] ${h.hook || ""} _(pillar: ${h.pillar_match || "—"})_`);
      });
    }
    if (og.caption_templates?.length) {
      push();
      push(`### Caption templates`);
      og.caption_templates.forEach((c) => {
        push();
        push(`**${c.style || "—"}:**`);
        push("```");
        push(c.template || "");
        push("```");
      });
    }
    if (og.posting_cadence) {
      push();
      push(`**Cadence:** ${og.posting_cadence}`);
    }
    if (og.link_in_bio_strategy) push(`**Link-in-bio:** ${og.link_in_bio_strategy}`);
    if (og.soft_ctas?.length) push(`**Soft CTAs:** ${og.soft_ctas.join(" | ")}`);
    hr();
  }

  if (o.image_concepts?.length) {
    push(`## Image Concepts`);
    o.image_concepts.forEach((img, i) => {
      push();
      push(`### Concept ${String(i + 1).padStart(2, "0")} — ${img.concept || "—"}`);
      if (img.scroll_stop_principle) push(`_Scroll-stop:_ ${img.scroll_stop_principle}`);
      if (img.ai_prompt) {
        push();
        push("```");
        push(img.ai_prompt);
        push("```");
      }
      if (img.placement) push(`Placement: ${img.placement}`);
    });
    hr();
  }

  if (o.video_concepts?.length) {
    push(`## Video Concepts`);
    o.video_concepts.forEach((v, i) => {
      push();
      push(`### Video ${String(i + 1).padStart(2, "0")} — ${v.style || "—"} · ${v.duration || "—"} [${v.hook_framework || "—"}]`);
      if (v.hook) push(`**Hook:** "${v.hook}"`);
      if (v.script) {
        push();
        push("**Script:**");
        push("```");
        push(v.script);
        push("```");
      }
      if (v.platform_fit) push(`Platform fit: ${v.platform_fit}`);
    });
    hr();
  }

  if (o.form_suggestions) {
    push(`## Form Build`);
    if (o.form_suggestions.fields?.length) {
      push();
      push(`### Fields`);
      o.form_suggestions.fields.forEach((f) => {
        push(`- ${f.label || "—"} (${f.type || "?"})${f.required ? " *" : ""}`);
      });
    }
    if (o.form_suggestions.qualifying_questions?.length) {
      push();
      push(`### Qualifying questions`);
      o.form_suggestions.qualifying_questions.forEach((q, i) => push(`${i + 1}. ${q}`));
    }
    hr();
  }

  if (o.landing_page_structure?.length) {
    push(`## Landing Page Structure`);
    o.landing_page_structure.forEach((s, i) => {
      push();
      push(`**${String(i + 1).padStart(2, "0")}. ${s.section || "—"}**`);
      if (s.purpose) push(`_${s.purpose}_`);
      if (s.copy_direction) push(s.copy_direction);
    });
    hr();
  }

  if (o.compliance_notes) {
    push(`## Compliance Watch`);
    if (o.compliance_notes.general_flags?.length) {
      push();
      push(`**General:**`);
      o.compliance_notes.general_flags.forEach((f) => push(`- ${f}`));
    }
    if (o.compliance_notes.platform_specific) {
      Object.entries(o.compliance_notes.platform_specific).forEach(([platform, flags]) => {
        if (flags?.length) {
          push();
          push(`**${platform}:**`);
          flags.forEach((f) => push(`- ${f}`));
        }
      });
    }
    hr();
  }

  if (o.weakness_audit?.length) {
    push(`## Weakness Audit`);
    o.weakness_audit.forEach((w, i) => {
      push();
      push(`${i + 1}. **${w.asset_reference || "—"}**`);
      if (w.weakness) push(`   - Weakness: ${w.weakness}`);
      if (w.fix) push(`   - **Fix:** ${w.fix}`);
    });
    hr();
  }

  push(`_Generated by IVM Campaign Engine · go-ivm.com_`);

  return lines.join("\n");
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
  const [generatingStage, setGeneratingStage] = useState("");
  const [output, setOutput] = useState<CampaignOutput | null>(null);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [markdownCopied, setMarkdownCopied] = useState(false);
  const [markdownCopying, setMarkdownCopying] = useState(false);

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
    setPdfError("");
  };

  const downloadPdf = async () => {
    if (!output) return;
    setPdfDownloading(true);
    setPdfError("");
    try {
      const res = await fetch("/api/download-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: inputs.clientName.trim() || "Untitled",
          channels: inputs.channels,
          output,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) ||
          `PDF generation failed (${res.status})`;
        throw new Error(msg);
      }
      const blob = await res.blob();
      const disp = res.headers.get("content-disposition") || "";
      const filenameMatch = disp.match(/filename="?([^"]+)"?/i);
      const filename = filenameMatch ? filenameMatch[1] : "campaign.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      setPdfError(`Download failed: ${msg}`);
    } finally {
      setPdfDownloading(false);
    }
  };

  const copyMarkdown = async () => {
    if (!output) return;
    setMarkdownCopying(true);
    try {
      const md = buildMarkdown(inputs.clientName.trim() || "Untitled", inputs.channels, output);
      await navigator.clipboard.writeText(md);
      setMarkdownCopied(true);
      setTimeout(() => setMarkdownCopied(false), 2500);
    } catch (e) {
      console.error("[copyMarkdown] failed:", e);
      setPdfError(`Copy failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setMarkdownCopying(false);
    }
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
  const fmtLpAudit = () => {
    const a = output?.landing_page_audit;
    if (!a) return "";
    const cats = a.category_scores
      ? (
          [
            ["Above-fold clarity", a.category_scores.above_fold_clarity],
            ["Hero match", a.category_scores.hero_match],
            ["Social proof", a.category_scores.social_proof],
            ["Offer clarity", a.category_scores.offer_clarity],
            ["CTA strength", a.category_scores.cta_strength],
            ["Trust signals", a.category_scores.trust_signals],
            ["Friction audit", a.category_scores.friction_audit],
            ["Mobile considerations", a.category_scores.mobile_considerations],
          ] as const
        )
          .filter(([, v]) => v)
          .map(
            ([label, v]) =>
              `${label}: ${v?.score ?? "?"}/10\n  Issues: ${(v?.issues || []).join("; ") || "(none)"}\n  Fixes: ${(v?.fixes || []).join("; ") || "(none)"}`,
          )
          .join("\n\n")
      : "";
    const top3 = a.top_3_priority_fixes
      ?.map(
        (f) =>
          `#${f.rank}. ${f.fix}\n  Why: ${f.why}\n  Implementation: ${f.implementation}`,
      )
      .join("\n\n");
    return [
      `LANDING PAGE AUDIT — ${a.url_audited || ""}`,
      `Overall: ${a.overall_score ?? "?"}/100`,
      a.big_idea_alignment
        ? `Big Idea Alignment: ${a.big_idea_alignment.verdict || "?"} (${a.big_idea_alignment.score ?? "?"}/10)\n  LP says: ${a.big_idea_alignment.what_lp_says || ""}\n  Campaign promises: ${a.big_idea_alignment.what_campaign_promises || ""}\n  Gap: ${a.big_idea_alignment.gap_analysis || ""}`
        : "",
      a.five_second_test
        ? `5-Second Test: ${a.five_second_test.verdict || "?"} — ${a.five_second_test.what_user_understands || ""}`
        : "",
      top3 ? `TOP 3 PRIORITY FIXES:\n${top3}` : "",
      cats ? `CATEGORY SCORES:\n${cats}` : "",
      (a.conversion_blockers?.length ?? 0) > 0
        ? `CONVERSION BLOCKERS:\n${(a.conversion_blockers || []).map((b) => `- ${b}`).join("\n")}`
        : "",
      (a.what_is_working?.length ?? 0) > 0
        ? `WHAT'S WORKING:\n${(a.what_is_working || []).map((w) => `- ${w}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  };
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

              {/* Sticky toolbar — Copy Markdown + Download PDF */}
              <div className="sticky top-0 z-30 -mx-5 md:-mx-8 px-5 md:px-8 py-3 bg-stone-100/95 backdrop-blur border-b border-stone-300 flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={copyMarkdown}
                  disabled={markdownCopying}
                  className="flex items-center gap-2 px-4 py-2.5 border border-stone-900 bg-white text-stone-900 font-mono-x text-[10px] uppercase tracking-widest font-bold hover:bg-stone-900 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {markdownCopied ? <Check size={14} /> : markdownCopying ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCopy size={14} />}
                  {markdownCopied ? "Copied" : markdownCopying ? "Copying..." : "Copy as Markdown"}
                </button>
                <button
                  onClick={downloadPdf}
                  disabled={pdfDownloading}
                  className="flex items-center gap-2 px-4 py-2.5 border border-stone-900 bg-white text-stone-900 font-mono-x text-[10px] uppercase tracking-widest font-bold hover:bg-stone-900 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pdfDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {pdfDownloading ? "Generating PDF..." : "Download PDF"}
                </button>
              </div>

              {pdfError && (
                <div className="flex items-start gap-3 px-4 py-3 border border-red-300 bg-red-50">
                  <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <span className="font-mono-x text-sm text-red-700">{pdfError}</span>
                </div>
              )}

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

              {/* 02 Landing Page Audit (or input error) */}
              {output.landing_page_audit && (
                <Section number="02" icon={<Layout size={18} />} title="Landing Page Audit" subtitle="CRO strategist · Big Idea aligned" onCopyAll={() => handleCopy(fmtLpAudit(), "lpaud-all")} copiedAll={copiedKey === "lpaud-all"}>
                  <LandingPageAuditBlock audit={output.landing_page_audit} />
                </Section>
              )}
              {!output.landing_page_audit && output.audit_input_error && (
                <Section number="02" icon={<Layout size={18} />} title="Landing Page Audit" subtitle="Skipped">
                  <div className="border border-yellow-400 bg-yellow-50 p-5 card-shadow">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={18} className="text-yellow-700 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-mono-x text-[10px] uppercase tracking-widest text-yellow-700 font-bold mb-1.5">Could not fetch the landing page URL</div>
                        <p className="text-sm text-stone-800 leading-relaxed">{output.audit_input_error}</p>
                      </div>
                    </div>
                  </div>
                </Section>
              )}

              {/* 03 Competitor Intel */}
              {output.competitor_intel && output.competitor_intel.length > 0 && (
                <Section number="03" icon={<Eye size={18} />} title="Competitor Intel" subtitle={`${output.competitor_intel.length} analyzed`} onCopyAll={() => handleCopy(fmtCompetitor() || "", "comp-all")} copiedAll={copiedKey === "comp-all"}>
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

              {/* 04 Copy Angles */}
              <Section number="04" icon={<Sparkles size={18} />} title="Copy Angles" subtitle={`${output.copy_variations?.length || 0} · framework-tagged · scored`} onCopyAll={() => handleCopy(fmtCopy() || "", "copy-all")} copiedAll={copiedKey === "copy-all"}>
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

              {/* 05 CTAs */}
              <Section number="05" icon={<Zap size={18} />} title="CTA Stack" subtitle={`${output.cta_variations?.length || 0} · psychology-tagged`} onCopyAll={() => handleCopy(fmtCTA() || "", "cta-all")} copiedAll={copiedKey === "cta-all"}>
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

              {/* 06 Search Ads (Google) */}
              {output.search_ads && output.search_ads.length > 0 && (
                <Section number="06" icon={<Search size={18} />} title="Search Ads" subtitle={`${output.search_ads.length} · Google ready`} onCopyAll={() => handleCopy(fmtSearch() || "", "search-all")} copiedAll={copiedKey === "search-all"}>
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

              {/* 07 Programmatic */}
              {output.programmatic_creative && (
                <Section number="07" icon={<Radio size={18} />} title="Programmatic Creative" subtitle="Display banners + native" onCopyAll={() => handleCopy(fmtProg(), "prog-all")} copiedAll={copiedKey === "prog-all"}>
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

              {/* 08 Email Sequence */}
              {output.email_sequence && output.email_sequence.length > 0 && (
                <Section number="08" icon={<Mail size={18} />} title="Email Sequence" subtitle={`${output.email_sequence.length}-email automation`} onCopyAll={() => handleCopy(fmtEmail() || "", "email-all")} copiedAll={copiedKey === "email-all"}>
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

              {/* 09 Newsletter */}
              {output.newsletter_issues && output.newsletter_issues.length > 0 && (
                <Section number="09" icon={<Newspaper size={18} />} title="Newsletter Issues" subtitle={`${output.newsletter_issues.length} · editorial-style`} onCopyAll={() => handleCopy(fmtNewsletter() || "", "news-all")} copiedAll={copiedKey === "news-all"}>
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

              {/* 10 SMS */}
              {output.sms_messages && output.sms_messages.length > 0 && (
                <Section number="10" icon={<MessageSquare size={18} />} title="SMS Messages" subtitle={`${output.sms_messages.length} · TCPA-aware`} onCopyAll={() => handleCopy(fmtSms() || "", "sms-all")} copiedAll={copiedKey === "sms-all"}>
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

              {/* 11 Organic */}
              {output.organic_strategy && (
                <Section number="11" icon={<Users size={18} />} title="Organic Social Strategy" subtitle="Pillars · hooks · cadence · soft CTAs" onCopyAll={() => handleCopy(fmtOrganic(), "org-all")} copiedAll={copiedKey === "org-all"}>
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

              {/* 12 Image Concepts */}
              {output.image_concepts && output.image_concepts.length > 0 && (
                <Section number="12" icon={<ImageIcon size={18} />} title="Image Concepts" subtitle={`${output.image_concepts.length} · scroll-stop tested`} onCopyAll={() => handleCopy(fmtImages() || "", "img-all")} copiedAll={copiedKey === "img-all"}>
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

              {/* 13 Video Concepts */}
              {output.video_concepts && output.video_concepts.length > 0 && (
                <Section number="13" icon={<Video size={18} />} title="Video Concepts" subtitle={`${output.video_concepts.length} · hook-framework tagged`} onCopyAll={() => handleCopy(fmtVideos() || "", "vid-all")} copiedAll={copiedKey === "vid-all"}>
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

              {/* 14 Form */}
              <Section number="14" icon={<ListChecks size={18} />} title="Form Build" subtitle="Fields + qualifying questions">
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

              {/* 15 LP */}
              <Section number="15" icon={<Layout size={18} />} title="Landing Page Structure" subtitle={`${output.landing_page_structure?.length || 0} sections · Big Idea anchored`} onCopyAll={() => handleCopy(fmtLP() || "", "lp-all")} copiedAll={copiedKey === "lp-all"}>
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

              {/* 16 Weakness Audit */}
              {output.weakness_audit && output.weakness_audit.length > 0 && (
                <Section number="16" icon={<Target size={18} />} title="Weakness Audit" subtitle="3 weakest assets · self-critique · fixes" onCopyAll={() => handleCopy(fmtAudit() || "", "aud-all")} copiedAll={copiedKey === "aud-all"}>
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

      {/* Toast: markdown copied */}
      {markdownCopied && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 border-2 border-stone-900 bg-white card-shadow" style={{ boxShadow: `0 4px 20px ${ACCENT}66, 0 0 0 1px #1c1917` }}>
          <Check size={16} className="text-stone-900" />
          <span className="font-mono-x text-xs text-stone-900 font-bold">Copied , paste into Google Docs, Notion, anywhere</span>
        </div>
      )}
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

function alignmentColor(verdict?: string): { bg: string; text: string; label: string } {
  const v = (verdict || "").toLowerCase();
  if (v === "aligned") return { bg: "#d1fae5", text: "#065f46", label: "ALIGNED" };
  if (v === "partial") return { bg: "#fef3c7", text: "#92400e", label: "PARTIAL" };
  if (v === "misaligned") return { bg: "#fee2e2", text: "#991b1b", label: "MISALIGNED" };
  return { bg: "#f5f5f4", text: "#44403c", label: (verdict || "—").toUpperCase() };
}

function LandingPageAuditBlock({ audit }: { audit: LandingPageAudit }) {
  const align = alignmentColor(audit.big_idea_alignment?.verdict);
  const fiveSec = audit.five_second_test;
  const cats = audit.category_scores;
  const categoryEntries: { key: string; label: string; data: LpCategoryScore | undefined }[] = [
    { key: "above_fold_clarity", label: "Above-fold clarity", data: cats?.above_fold_clarity },
    { key: "hero_match", label: "Hero match", data: cats?.hero_match },
    { key: "social_proof", label: "Social proof", data: cats?.social_proof },
    { key: "offer_clarity", label: "Offer clarity", data: cats?.offer_clarity },
    { key: "cta_strength", label: "CTA strength", data: cats?.cta_strength },
    { key: "trust_signals", label: "Trust signals", data: cats?.trust_signals },
    { key: "friction_audit", label: "Friction audit", data: cats?.friction_audit },
    { key: "mobile_considerations", label: "Mobile", data: cats?.mobile_considerations },
  ];
  return (
    <div className="space-y-5">
      {/* Hero score + alignment */}
      <div className="border-2 border-stone-900 bg-white card-shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
          <div className="md:col-span-1 flex flex-col items-center md:items-start border-b md:border-b-0 md:border-r border-stone-200 pb-5 md:pb-0 md:pr-5">
            <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2">Overall Score</div>
            <div className="font-display text-7xl md:text-8xl font-black leading-none">{audit.overall_score ?? "—"}<span className="font-display text-2xl text-stone-400">/100</span></div>
            {audit.url_audited && <div className="font-mono-x text-[10px] text-stone-500 mt-2 break-all">{audit.url_audited}</div>}
          </div>
          <div className="md:col-span-2 space-y-3">
            <div>
              <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2">Big Idea Alignment</div>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="font-mono-x text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: align.bg, color: align.text, padding: "4px 10px" }}>{align.label}</span>
                {audit.big_idea_alignment?.score != null && (
                  <span className="font-mono-x text-[11px] font-bold text-stone-700">{audit.big_idea_alignment.score}/10</span>
                )}
              </div>
              {audit.big_idea_alignment?.what_lp_says && (
                <div className="mb-2"><span className="meta-chip mr-2">LP says</span><span className="text-sm text-stone-700">{audit.big_idea_alignment.what_lp_says}</span></div>
              )}
              {audit.big_idea_alignment?.what_campaign_promises && (
                <div className="mb-2"><span className="meta-chip mr-2">Campaign promises</span><span className="text-sm text-stone-700">{audit.big_idea_alignment.what_campaign_promises}</span></div>
              )}
              {audit.big_idea_alignment?.gap_analysis && (
                <div className="pt-2 border-t border-stone-200 text-sm text-stone-800 leading-relaxed"><span className="font-bold">Gap:</span> {audit.big_idea_alignment.gap_analysis}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5-second test callout */}
      {fiveSec && (
        <div className="border border-stone-200 bg-white card-shadow p-5">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="accent-chip font-mono-x text-[10px] uppercase tracking-widest">5-Second Test</span>
            {fiveSec.verdict && <span className="meta-chip">{fiveSec.verdict}</span>}
          </div>
          {fiveSec.what_user_understands && (
            <p className="text-sm text-stone-700 leading-relaxed italic">&ldquo;{fiveSec.what_user_understands}&rdquo;</p>
          )}
        </div>
      )}

      {/* Top 3 priority fixes — brutal honesty treatment */}
      {audit.top_3_priority_fixes && audit.top_3_priority_fixes.length > 0 && (
        <div className="border-2 border-stone-900 bg-white card-shadow p-1">
          <div className="bg-stone-900 text-stone-100 px-4 py-2 mb-1">
            <span className="font-mono-x text-[10px] uppercase tracking-widest">⚡ Top 3 priority fixes , ranked by leverage</span>
          </div>
          <div className="space-y-3 p-4">
            {audit.top_3_priority_fixes.map((f, i) => (
              <div key={i} className="border border-stone-200 p-4 bg-stone-50">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="accent-chip font-mono-x text-[10px]">#{f.rank ?? i + 1}</span>
                  <span className="font-display font-bold text-base">{f.fix}</span>
                </div>
                {f.why && (
                  <div className="mb-2"><span className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">Why</span><p className="text-sm text-stone-800 leading-relaxed mt-1">{f.why}</p></div>
                )}
                {f.implementation && (
                  <div className="pt-2 border-t border-stone-200">
                    <span className="font-mono-x text-[10px] uppercase tracking-widest font-bold inline-block" style={{ color: "#0a0a0a", backgroundColor: ACCENT, padding: "2px 6px" }}>How</span>
                    <p className="text-sm text-stone-800 leading-relaxed mt-1.5 font-medium">{f.implementation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category scores grid */}
      <div>
        <h4 className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-3">Category Scores</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categoryEntries.map((entry) => (
            <div key={entry.key} className="border border-stone-200 bg-white card-shadow p-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="font-display font-bold text-base">{entry.label}</span>
                <span className="score-badge">{entry.data?.score ?? "—"}/10</span>
              </div>
              {entry.data?.issues && entry.data.issues.length > 0 && (
                <div className="mb-2">
                  <span className="font-mono-x text-[10px] uppercase tracking-widest text-red-700 font-bold">Issues</span>
                  <ul className="mt-1 space-y-1">
                    {entry.data.issues.map((iss, i) => (
                      <li key={i} className="text-xs text-stone-700 flex gap-1.5"><span className="text-stone-400 flex-shrink-0">▸</span><span>{iss}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {entry.data?.fixes && entry.data.fixes.length > 0 && (
                <div className="pt-2 border-t border-stone-200">
                  <span className="font-mono-x text-[10px] uppercase tracking-widest font-bold inline-block" style={{ color: "#0a0a0a", backgroundColor: ACCENT, padding: "2px 6px" }}>Fixes</span>
                  <ul className="mt-1.5 space-y-1">
                    {entry.data.fixes.map((fx, i) => (
                      <li key={i} className="text-xs text-stone-800 flex gap-1.5"><span className="text-stone-400 flex-shrink-0">▸</span><span>{fx}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conversion blockers — yellow warning */}
      {audit.conversion_blockers && audit.conversion_blockers.length > 0 && (
        <div className="border border-yellow-400 bg-yellow-50 p-5 card-shadow">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-yellow-700" />
            <span className="font-mono-x text-[10px] uppercase tracking-widest text-yellow-700 font-bold">Conversion Blockers</span>
          </div>
          <ul className="space-y-1.5">
            {audit.conversion_blockers.map((b, i) => (
              <li key={i} className="text-sm text-stone-800 flex gap-2"><span className="text-yellow-600 flex-shrink-0">▸</span><span>{b}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* What's working — green success */}
      {audit.what_is_working && audit.what_is_working.length > 0 && (
        <div className="border border-green-400 bg-green-50 p-4 card-shadow">
          <div className="font-mono-x text-[10px] uppercase tracking-widest text-green-800 font-bold mb-2">What&apos;s working , don&apos;t break this</div>
          <ul className="space-y-1">
            {audit.what_is_working.map((w, i) => (
              <li key={i} className="text-sm text-stone-800 flex gap-2"><span className="text-green-700 flex-shrink-0">▸</span><span>{w}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Page performance disclosure */}
      {audit.page_performance_note && (
        <p className="text-xs text-stone-500 italic leading-relaxed">{audit.page_performance_note}</p>
      )}
    </div>
  );
}
