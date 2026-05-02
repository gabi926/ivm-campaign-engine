import { renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import { checkOrigin, getClientIp } from "../_lib/security";
import type { CampaignOutput } from "../../_lib/campaign-types";
import { CampaignPdf } from "./CampaignPdf";

export const runtime = "nodejs";
export const maxDuration = 30;

const PDF_RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const pdfRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkPdfRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = pdfRateLimitMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    pdfRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (pdfRateLimitMap.size > 1000) {
      for (const [k, v] of pdfRateLimitMap.entries()) {
        if (v.resetAt <= now) pdfRateLimitMap.delete(k);
      }
    }
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= PDF_RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "client"
  );
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface DownloadPdfBody {
  clientName: string;
  channels?: string[];
  output: CampaignOutput;
}

function validateBody(body: unknown): DownloadPdfBody {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;
  if (typeof b.clientName !== "string" || !b.clientName.trim()) {
    throw new Error("clientName is required");
  }
  if (b.clientName.length > 200) {
    throw new Error("clientName too long");
  }
  if (!b.output || typeof b.output !== "object" || Array.isArray(b.output)) {
    throw new Error("output is required and must be an object");
  }
  let channels: string[] = [];
  if (Array.isArray(b.channels)) {
    channels = b.channels.filter((c): c is string => typeof c === "string").slice(0, 20);
  }
  return {
    clientName: b.clientName.trim(),
    channels,
    output: b.output as CampaignOutput,
  };
}

export async function POST(req: NextRequest) {
  const originCheck = checkOrigin(req);
  if (!originCheck.allowed) {
    console.warn("[download-pdf] origin rejected:", originCheck.origin ?? "<missing>");
    return NextResponse.json({ error: "Forbidden: invalid origin" }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rl = checkPdfRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.retryAfterSec}s. (Soft guard: ${PDF_RATE_LIMIT_MAX} downloads/hour per IP.)` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: DownloadPdfBody;
  try {
    body = validateBody(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid request body" },
      { status: 400 },
    );
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      <CampaignPdf
        clientName={body.clientName}
        channels={body.channels ?? []}
        output={body.output}
      />,
    );
  } catch (e) {
    console.error("[download-pdf] PDF render failed:", e);
    return NextResponse.json(
      { error: `PDF generation failed: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 500 },
    );
  }

  const filename = `IVM-Campaign-${slugify(body.clientName)}-${fmtDate(new Date())}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "no-store",
    },
  });
}
