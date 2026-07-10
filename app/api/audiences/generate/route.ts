// POST /api/audiences/generate — D2 AL Audience Builder generate endpoint.
//
// Takes an ICP brief + offer + geography, ranks the embedded AL taxonomy
// against the ICP, sends the top-N candidates to Claude alongside the
// SYSTEM_PROMPT (extracted verbatim from the source HTML tool), receives a
// strict-JSON audience spec, persists it to al_audience_specs, and returns
// the spec + row id.
//
// Auth: getUser() first. Ownership on optional client_id / campaign_id is
// enforced by explicit maybeSingle() selects up front so the caller gets a
// clean 403 rather than a downstream FK failure.
//
// Rate limit + origin check mirror the pattern in /api/generate/route.ts so
// this endpoint is on the same soft-guard footing as its sibling AI routes.

import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, getClientIp } from "../../_lib/security";
import { getUser } from "@/app/_lib/auth";
import { createClient as createSupabaseClient } from "@/app/_lib/supabase/server";
import {
  buildUserMessage,
  CANDIDATE_LIMIT,
  getSystemPrompt,
} from "@/app/_lib/al-prompt";
import { rankTaxonomy } from "@/app/_lib/al-taxonomy/ranker";
import type {
  ALAudienceSpec,
  ALGenerateRequest,
  ALGenerateResponse,
} from "@/app/_lib/al-taxonomy/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const AL_MODEL = "claude-sonnet-4-6";
const AL_MAX_TOKENS = 8192;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FIELD_CAPS = {
  icp: 8000,
  offer: 2000,
  geography: 500,
} as const;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (rateLimitMap.size > 1000) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (v.resetAt <= now) rateLimitMap.delete(k);
      }
    }
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function validate(body: unknown): ALGenerateRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  for (const [k, cap] of Object.entries(FIELD_CAPS)) {
    const v = b[k];
    if (v != null && typeof v !== "string") {
      throw new ValidationError(`Field "${k}" must be a string`);
    }
    if (typeof v === "string" && v.length > cap) {
      throw new ValidationError(
        `Field "${k}" exceeds ${cap} character limit (got ${v.length}).`,
      );
    }
  }

  const icp = ((b.icp ?? "") as string).trim();
  if (!icp) throw new ValidationError("icp is required");

  const clientId = b.client_id;
  if (clientId != null && (typeof clientId !== "string" || !UUID_RE.test(clientId))) {
    throw new ValidationError("client_id must be a UUID");
  }
  const campaignId = b.campaign_id;
  if (campaignId != null && (typeof campaignId !== "string" || !UUID_RE.test(campaignId))) {
    throw new ValidationError("campaign_id must be a UUID");
  }

  return {
    icp,
    offer: ((b.offer ?? "") as string).trim(),
    geography: ((b.geography ?? "United States") as string).trim() || "United States",
    ...(typeof clientId === "string" ? { client_id: clientId } : {}),
    ...(typeof campaignId === "string" ? { campaign_id: campaignId } : {}),
  };
}

/**
 * Explicit ownership check on optional client_id / campaign_id. RLS on
 * al_audience_specs INSERT only validates user_id — a foreign key pointing
 * to a row the user can't SELECT would still succeed at insert time. This
 * guard makes ownership violations visible as a clean 403 up front.
 */
async function assertOptionalOwnership(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  clientId: string | undefined,
  campaignId: string | undefined,
): Promise<void> {
  if (clientId) {
    const { data, error } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();
    if (error) throw new Error(`Client ownership check failed: ${error.message}`);
    if (!data) throw new ValidationError("client_id not found or not accessible.");
  }
  if (campaignId) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .maybeSingle();
    if (error) throw new Error(`Campaign ownership check failed: ${error.message}`);
    if (!data) throw new ValidationError("campaign_id not found or not accessible.");
  }
}

export async function POST(req: NextRequest) {
  const originCheck = checkOrigin(req);
  if (!originCheck.allowed) {
    console.warn("[audiences/generate] origin rejected:", originCheck.origin ?? "<missing>");
    return NextResponse.json({ error: "Forbidden: invalid origin" }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Try again in ${rl.retryAfterSec}s. (Soft guard: ${RATE_LIMIT_MAX} generations/hour per IP.)`,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let inputs: ALGenerateRequest;
  try {
    inputs = validate(await req.json());
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const supabase = await createSupabaseClient();

  try {
    await assertOptionalOwnership(supabase, inputs.client_id, inputs.campaign_id);
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    console.error("[audiences/generate] ownership check failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ownership check failed" },
      { status: 500 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[audiences/generate] ANTHROPIC_API_KEY is not configured");
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Set it in Vercel project settings." },
      { status: 500 },
    );
  }

  // Rank the taxonomy server-side. Combining icp + offer matches the source
  // HTML's behavior; the ranker returns up to 200, we send 150 to the model.
  const candidates = rankTaxonomy(`${inputs.icp} ${inputs.offer}`.trim(), 200);
  const candidateCount = Math.min(candidates.length, CANDIDATE_LIMIT);

  const anthropic = new Anthropic({ apiKey });
  let response: Anthropic.Messages.Message;
  try {
    response = await anthropic.messages.create({
      model: AL_MODEL,
      max_tokens: AL_MAX_TOKENS,
      system: getSystemPrompt(),
      messages: [{ role: "user", content: buildUserMessage(inputs, candidates) }],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    console.error("[audiences/generate] Anthropic API error:", e);
    const isAuthErr =
      e instanceof Anthropic.AuthenticationError || /401|invalid.*api.*key/i.test(msg);
    if (isAuthErr) {
      return NextResponse.json(
        { error: "Anthropic API key rejected. Verify ANTHROPIC_API_KEY in Vercel settings." },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: `Anthropic API error: ${msg}` }, { status: 502 });
  }

  // Extract the JSON body from Claude's text blocks. Same first-brace /
  // last-brace strategy as /api/generate, with jsonrepair as a fallback.
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
    console.error(
      "[audiences/generate] No JSON object found. stop_reason=",
      response.stop_reason,
      "head=",
      text.slice(0, 500),
    );
    return NextResponse.json(
      { error: "Model did not return JSON. Try again." },
      { status: 502 },
    );
  }
  const jsonStr = text.slice(firstBrace, lastBrace + 1);
  let spec: ALAudienceSpec;
  try {
    spec = JSON.parse(jsonStr) as ALAudienceSpec;
  } catch (firstErr) {
    try {
      spec = JSON.parse(jsonrepair(jsonStr)) as ALAudienceSpec;
      console.warn("[audiences/generate] JSON.parse failed; jsonrepair recovered.");
    } catch (repairErr) {
      const parseMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      const repairMsg = repairErr instanceof Error ? repairErr.message : String(repairErr);
      console.error(
        "[audiences/generate] parse+repair failed.",
        "\n  parse_error:", parseMsg,
        "\n  repair_error:", repairMsg,
        "\n  stop_reason:", response.stop_reason,
      );
      return NextResponse.json(
        { error: `Model returned invalid JSON. (${parseMsg})` },
        { status: 502 },
      );
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("al_audience_specs")
    .insert({
      user_id: user.id,
      client_id: inputs.client_id ?? null,
      campaign_id: inputs.campaign_id ?? null,
      icp_brief: inputs.icp,
      offer: inputs.offer,
      geography: inputs.geography,
      audience_name: spec.audience_name ?? null,
      detected_type: spec.detected_type ?? null,
      generated_spec: spec,
      model_used: AL_MODEL,
      candidate_count: candidateCount,
      prompt_tokens: response.usage?.input_tokens ?? null,
      completion_tokens: response.usage?.output_tokens ?? null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[audiences/generate] insert failed:", insertError);
    return NextResponse.json(
      { error: insertError?.message || "Failed to persist audience spec" },
      { status: 500 },
    );
  }

  const payload: ALGenerateResponse = {
    id: inserted.id as string,
    spec,
    model_used: AL_MODEL,
    candidate_count: candidateCount,
    prompt_tokens: response.usage?.input_tokens ?? null,
    completion_tokens: response.usage?.output_tokens ?? null,
  };
  return NextResponse.json({ success: true, ...payload }, { status: 200 });
}
