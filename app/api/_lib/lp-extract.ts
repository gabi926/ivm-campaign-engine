import { lookup } from "node:dns/promises";
import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 30_000;
const MIN_BODY_TEXT_FOR_AUDIT = 500;
const USER_AGENT =
  "Mozilla/5.0 (compatible; IVMCampaignEngine/1.0; +https://go-ivm.com)";

export interface LpExtraction {
  url: string;
  title: string;
  metaDescription: string;
  h1: string[];
  h2: string[];
  h3: string[];
  ctas: string[];
  altTexts: string[];
  bodyText: string;
}

export type ExtractResult =
  | { ok: true; extraction: LpExtraction }
  | { ok: false; reason: string };

// Reject anything that resolves to a private, loopback, or link-local address.
// Caller must resolve hostname via DNS first; this just classifies the address.
function isPrivateAddress(ip: string): boolean {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [, aStr, bStr] = v4;
    const a = Number(aStr);
    const b = Number(bStr);
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fe80::")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateAddress(v4Mapped[1]);
  return false;
}

async function validateUrlForFetch(rawUrl: string): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL syntax" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `Unsupported protocol: ${url.protocol} (only http/https allowed)` };
  }
  // SSRF: resolve hostname and reject private/loopback/link-local addresses
  try {
    const addrs = await lookup(url.hostname, { all: true });
    for (const a of addrs) {
      if (isPrivateAddress(a.address)) {
        return { ok: false, reason: "URL resolves to a private/internal IP address" };
      }
    }
  } catch (e) {
    return { ok: false, reason: `DNS resolution failed: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true, url };
}

async function readWithLimit(res: Response, limit: number): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > limit) {
      try {
        await reader.cancel();
      } catch {}
      throw new Error(`Response exceeds ${Math.floor(limit / 1024 / 1024)}MB limit`);
    }
    chunks.push(value);
  }
  // Concatenate and decode as UTF-8 (cheerio is tolerant of encoding mismatches for our use)
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function extractFromHtml(html: string): Omit<LpExtraction, "url"> {
  const $ = cheerio.load(html);
  // Strip non-content nodes before pulling text
  $("script, style, noscript, svg, iframe, link[rel=stylesheet], meta:not([name]):not([property])").remove();

  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  const collectText = (selector: string) =>
    $(selector)
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((t) => t.length > 0);

  const h1 = collectText("h1");
  const h2 = collectText("h2");
  const h3 = collectText("h3");

  const ctas = $("button, a")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t.length > 0 && t.length <= 100);

  const altTexts = $("img[alt]")
    .map((_, el) => ($(el).attr("alt") ?? "").trim())
    .get()
    .filter((t) => t.length > 0 && t.length <= 200);

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  return { title, metaDescription, h1, h2, h3, ctas, altTexts, bodyText };
}

function looksThin(extraction: Omit<LpExtraction, "url">): boolean {
  if (extraction.bodyText.length < MIN_BODY_TEXT_FOR_AUDIT) return true;
  if (extraction.h1.length === 0 && extraction.h2.length === 0) return true;
  return false;
}

export async function fetchAndExtractLp(rawUrl: string): Promise<ExtractResult> {
  const validation = await validateUrlForFetch(rawUrl);
  if (!validation.ok) return { ok: false, reason: validation.reason };
  const { url } = validation;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let html: string;
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status} from ${url.host}` };
    }
    const ct = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(ct) && ct.length > 0) {
      return { ok: false, reason: `Unexpected content-type "${ct}" (expected text/html)` };
    }
    html = await readWithLimit(res, MAX_RESPONSE_BYTES);
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") {
      return { ok: false, reason: `Fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s` };
    }
    return { ok: false, reason: `Fetch failed: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    clearTimeout(timer);
  }

  const extracted = extractFromHtml(html);
  if (looksThin(extracted)) {
    return {
      ok: false,
      reason:
        "Page appears JS-rendered, extracted minimal content. Audit may be unreliable. If your LP is JS-rendered (Webflow, Framer, Shopify), paste the LP copy directly into the Offer field for now. SPA support coming in v2.",
    };
  }

  return { ok: true, extraction: { url: url.toString(), ...extracted } };
}

export function buildLpContentBlock(e: LpExtraction): string {
  const sections: { label: string; value: string }[] = [
    { label: "URL", value: e.url },
    { label: "TITLE", value: e.title || "(empty)" },
    { label: "META DESCRIPTION", value: e.metaDescription || "(empty)" },
    { label: "H1 TAGS", value: e.h1.join(" | ") || "(none)" },
    { label: "H2 TAGS", value: e.h2.join(" | ") || "(none)" },
    { label: "H3 TAGS", value: e.h3.join(" | ") || "(none)" },
    { label: "BUTTON / LINK TEXT", value: e.ctas.join(" | ") || "(none)" },
    { label: "IMAGE ALT TEXT", value: e.altTexts.join(" | ") || "(none)" },
    { label: "BODY TEXT", value: e.bodyText },
  ];
  // Build the full block, then truncate body text last so structured fields are preserved
  const headerLines = sections.slice(0, -1).map((s) => `${s.label}: ${s.value}`);
  const headerBlock = headerLines.join("\n");
  const bodyHeader = "BODY TEXT: ";
  const remainingBudget = Math.max(0, MAX_EXTRACTED_CHARS - headerBlock.length - bodyHeader.length - 100);
  const body = e.bodyText.length > remainingBudget ? e.bodyText.slice(0, remainingBudget) + "...[truncated]" : e.bodyText;
  return `${headerBlock}\n${bodyHeader}${body}`;
}
