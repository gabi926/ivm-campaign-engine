// D2 — AL taxonomy ranker.
//
// Server-side port of the AL Audience Builder's in-browser
// scoreTaxonomyAgainstICP. The HTML version ran client-side, embedded the
// taxonomy in the page, and shipped the algorithm verbatim. We move both
// to the server: taxonomy.json is server-only (never ships to client
// bundle), and the ranker is the canonical source of truth for candidate
// selection feeding the Claude prompt.
//
// Algorithm (preserved verbatim from the HTML):
//   1. Tokenize the ICP text: lowercase, replace non-alphanumerics with
//      spaces, split on whitespace, drop tokens <= 2 chars.
//   2. For each taxonomy row, compute a haystack from "topic + sub + cat",
//      tokenize it the same way.
//   3. Score = (count of haystack tokens that appear in the ICP token
//      set) * 1 + (count of ICP tokens >3 chars that appear as substring
//      inside the topic, lowercased) * 2.
//   4. Keep rows with score > 0; sort desc; return top N (default 200).
//
// The top-N output is what gets passed into the Claude prompt as
// "CANDIDATE AL TAXONOMY IDS". The SYSTEM_PROMPT tells Claude to pick 3-8
// per audience build from those candidates only.

import "server-only";

import fs from "node:fs";
import path from "node:path";

import type {
  ALTaxonomyCandidate,
  ALTaxonomyData,
} from "./types";

const TAXONOMY_PATH = path.join(
  process.cwd(),
  "app",
  "_lib",
  "al-taxonomy",
  "taxonomy.json",
);

let cachedTaxonomy: ALTaxonomyData | null = null;

function loadTaxonomy(): ALTaxonomyData {
  if (cachedTaxonomy) return cachedTaxonomy;
  const raw = fs.readFileSync(TAXONOMY_PATH, "utf8");
  const parsed = JSON.parse(raw) as ALTaxonomyData;
  if (
    !parsed ||
    !Array.isArray(parsed.cats) ||
    !Array.isArray(parsed.subs) ||
    !Array.isArray(parsed.rows)
  ) {
    throw new Error("taxonomy.json shape mismatch — expected { cats, subs, rows }");
  }
  cachedTaxonomy = parsed;
  return parsed;
}

function tokenize(s: string): string[] {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Pure scoring function — exposed for testing. Most callers should use
 * `rankTaxonomy()` below which lazy-loads the embedded data.
 */
export function scoreTaxonomyAgainstICP(
  icpText: string,
  taxonomy: ALTaxonomyData,
  topN = 200,
): ALTaxonomyCandidate[] {
  const tokens = new Set(tokenize(icpText));
  const scored: ALTaxonomyCandidate[] = [];
  for (const row of taxonomy.rows) {
    const cat = taxonomy.cats[row.c];
    const sub = taxonomy.subs[row.s];
    const haystackTokens = tokenize(`${row.t} ${sub} ${cat}`);
    let score = 0;
    for (const tok of haystackTokens) {
      if (tokens.has(tok)) score += 1;
    }
    const topicLower = row.t.toLowerCase();
    for (const tok of tokens) {
      if (tok.length > 3 && topicLower.includes(tok)) score += 2;
    }
    if (score > 0) {
      scored.push({ id: row.i, cat, sub, topic: row.t, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

/**
 * Lazy-loads the embedded taxonomy (memoized) and scores against the given
 * ICP text. Default top-N matches the HTML tool (200) — the SYSTEM_PROMPT
 * then receives the first 150 of those as candidate IDs.
 */
export function rankTaxonomy(
  icpText: string,
  topN = 200,
): ALTaxonomyCandidate[] {
  return scoreTaxonomyAgainstICP(icpText, loadTaxonomy(), topN);
}

/** Exposed so the generate route can include the row count in logs. */
export function getTaxonomyRowCount(): number {
  return loadTaxonomy().rows.length;
}
