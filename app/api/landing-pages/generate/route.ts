// POST /api/landing-pages/generate — turn a saved campaign into a structured
// LP blueprint + a paste-ready builder prompt. ONE Claude call produces both
// parts (token budget is fine — no web search, structured JSON out). Mirrors
// the Claude + JSON-extract + jsonrepair pattern in /api/generate.
//
// This is a blueprint generator, NOT a hosting product. We never deploy a
// page; the operator pastes builder_prompt into GHL Studio / Lovable / etc.

import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/app/_lib/auth";
import { createClient } from "@/app/_lib/supabase/server";
import type { CampaignOutput } from "@/app/_lib/campaign-types";
import {
  TARGET_BUILDERS,
  type BlueprintGenerated,
  type TargetBuilder,
} from "@/app/_lib/blueprint-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Spec pins claude-sonnet-4-6 for Chunk A; the repo's /api/generate uses
// claude-sonnet-4-5. Intentional per-feature divergence (approved).
const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_MAX_TOKENS = 16000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYSTEM_PROMPT = `You are a senior direct-response landing page strategist at IVM. You convert a finished multi-channel campaign brief into a structured landing page BLUEPRINT plus a paste-ready prompt for an AI page builder.

You output ONLY one valid JSON object — no markdown fences, no prose around it — matching exactly:

{
  "blueprint_data": {
    "page_structure": ["Hero", "Problem Agitation", ...],   // ordered section names; CHOOSE the structure (Tier 3) based on offer type, audience awareness level, and DR best practice. Typical pool: Hero, Problem Agitation, Solution, Offer Stack, Social Proof, Bonuses, Guarantee, FAQ, Final CTA. Include only what this offer needs, in the right order.
    "sections": [
      {
        "name": "Hero",
        "headline": "...",
        "body": "50-200 words of real copy derived from the campaign's big idea + copy variations",
        "cta_text": "...",
        "cta_placement": "where on the page / when it appears",
        "visual_direction": "what the section should look like / imagery",
        "form_fields": ["Email", "Name"]   // ONLY on lead-capture sections, else omit
      }
    ],
    "integrations": [
      { "name": "Stripe | Calendly | Generic Form", "why": "tie to the offer + CTA in the campaign", "setup_notes": "what the operator wires up" }
    ],
    "pixel_capi_reminder": "1-2 sentences reminding the operator to install the Meta Pixel + Conversions API on the published page (the client may already have a CAPI setup from the Audit Engine). Do NOT claim to do it for them."
  },
  "builder_prompt": "the paste-ready prompt for the target builder — format depends on target_builder (see user message)"
}

Rules:
- Copy must be specific and derived from the supplied campaign — reuse the big idea, the strongest copy variation angles, the real offer + CTA. No lorem, no placeholders.
- Choose the integrations from the offer type + CTA (purchase → Stripe; call/booking → Calendly; lead → Generic Form).
- IVM does NOT host the page. The builder_prompt is for the operator to paste into THEIR chosen builder.`;

function builderInstruction(b: TargetBuilder): string {
  if (b === "ghl") {
    return `TARGET BUILDER: GHL Studio. Format builder_prompt for GHL Studio's AI page builder. Describe each page section in GHL's expected vocabulary (sections, rows, columns, elements; funnel/page step language). Be directive and structured so GHL's builder can lay it out.`;
  }
  if (b === "lovable") {
    return `TARGET BUILDER: Lovable. Lovable is a chat-based AI website builder. Format builder_prompt as a single natural-language site description — conversational, describing the page top to bottom as you would to a designer, including copy, layout, and the integrations to wire.`;
  }
  return `TARGET BUILDER: Generic. Format builder_prompt as a clean Markdown blueprint usable in any tool (Framer AI, Webflow AI, manual build): section-by-section headings with copy, CTA, visual direction, and an integrations checklist.`;
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    campaign_id?: string;
    target_builder?: string;
    client_id?: string | null;
  } | null;

  if (!body || typeof body.campaign_id !== "string" || !UUID_RE.test(body.campaign_id)) {
    return NextResponse.json({ error: "campaign_id (uuid) is required" }, { status: 400 });
  }
  if (
    typeof body.target_builder !== "string" ||
    !TARGET_BUILDERS.includes(body.target_builder as TargetBuilder)
  ) {
    return NextResponse.json(
      { error: `target_builder must be one of: ${TARGET_BUILDERS.join(", ")}` },
      { status: 400 },
    );
  }
  const targetBuilder = body.target_builder as TargetBuilder;
  const clientId =
    typeof body.client_id === "string" && UUID_RE.test(body.client_id)
      ? body.client_id
      : null;

  const supabase = await createClient();

  // RLS enforces the user can only read campaigns they're entitled to.
  const { data: campaignRow, error: campErr } = await supabase
    .from("campaigns")
    .select("id, campaign_json, brand_name")
    .eq("id", body.campaign_id)
    .maybeSingle();

  if (campErr) {
    console.warn("[lp/generate] campaigns select failed:", campErr);
    return NextResponse.json({ error: campErr.message }, { status: 500 });
  }
  if (!campaignRow || !campaignRow.campaign_json) {
    return NextResponse.json(
      { error: "Source campaign not found or has no output" },
      { status: 404 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 500 },
    );
  }

  let generated: BlueprintGenerated;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${builderInstruction(targetBuilder)}

SOURCE CAMPAIGN (Revenue Engine output) for "${campaignRow.brand_name ?? "the brand"}":
${JSON.stringify(campaignRow.campaign_json as CampaignOutput).slice(0, 60000)}

Produce the blueprint JSON now. Choose the section structure for THIS offer. Make builder_prompt paste-ready for the target builder above.`,
        },
      ],
    });

    const text = response.content
      .filter(
        (b): b is Anthropic.Messages.TextBlock =>
          b.type === "text" && typeof (b as { text?: unknown }).text === "string",
      )
      .map((b) => b.text)
      .join("\n")
      .trim();

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      const truncated = response.stop_reason === "max_tokens";
      return NextResponse.json(
        {
          error: truncated
            ? "Model output was truncated before completing JSON. Try again."
            : "Model did not return JSON. Try again.",
        },
        { status: 502 },
      );
    }

    const jsonStr = text.slice(firstBrace, lastBrace + 1);
    try {
      generated = JSON.parse(jsonStr) as BlueprintGenerated;
    } catch (firstErr) {
      generated = JSON.parse(jsonrepair(jsonStr)) as BlueprintGenerated;
      console.warn(
        "[lp/generate] JSON.parse failed; jsonrepair recovered. original_error:",
        firstErr instanceof Error ? firstErr.message : String(firstErr),
      );
    }
  } catch (e) {
    console.error("[lp/generate] Claude generation failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Blueprint generation failed." },
      { status: 502 },
    );
  }

  if (!generated?.blueprint_data || typeof generated.builder_prompt !== "string") {
    return NextResponse.json(
      { error: "Model returned an incomplete blueprint. Try again." },
      { status: 502 },
    );
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("landing_page_blueprints")
    .insert({
      user_id: user.id,
      client_id: clientId,
      campaign_id: body.campaign_id,
      target_builder: targetBuilder,
      blueprint_data: generated.blueprint_data,
      builder_prompt: generated.builder_prompt,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("[lp/generate] insert failed:", insertErr);
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to save blueprint." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    blueprint_id: inserted.id,
    blueprint_data: generated.blueprint_data,
    builder_prompt: generated.builder_prompt,
  });
}
