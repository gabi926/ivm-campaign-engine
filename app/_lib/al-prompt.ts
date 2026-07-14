// D2 — AL Audience Builder prompt assembly.
//
// SYSTEM_PROMPT is the verbatim operator-tuned prompt extracted from the
// source HTML (`c:/IVM/reference/al_audience_builder_2.html` → extracted
// into `_lib/al-taxonomy/prompt.txt` by `scripts/d2-extract.mjs`). DO NOT
// rewrite this prompt — years of accumulated craft live in it, including
// the OUTPUT FORMAT spec the spec types validate against and the panel
// activation rules.
//
// buildUserMessage assembles the per-request payload sent under
// role:"user" to Claude: ICP brief, offer, geography, and the top-N
// taxonomy candidates from the ranker (formatted as the prompt expects).

import "server-only";

import fs from "node:fs";
import path from "node:path";

import type {
  ALGenerateRequest,
  ALTaxonomyCandidate,
} from "./al-taxonomy/types";

const PROMPT_PATH = path.join(
  process.cwd(),
  "app",
  "_lib",
  "al-taxonomy",
  "prompt.txt",
);

/** Number of taxonomy candidates piped into the user message. */
export const CANDIDATE_LIMIT = 150;

let cachedPrompt: string | null = null;

export function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt;
  cachedPrompt = fs.readFileSync(PROMPT_PATH, "utf8");
  return cachedPrompt;
}

export function buildUserMessage(
  req: ALGenerateRequest,
  candidates: ALTaxonomyCandidate[],
): string {
  const list = candidates
    .slice(0, CANDIDATE_LIMIT)
    .map((c) => `${c.id} | ${c.cat} > ${c.sub} | ${c.topic}`)
    .join("\n");
  return [
    "ICP BRIEF:",
    req.icp,
    "",
    `OFFER: ${req.offer || "(not specified)"}`,
    `GEOGRAPHY: ${req.geography || "United States"}`,
    "",
    "CANDIDATE AL TAXONOMY IDS (pick best fits from these only):",
    list,
  ].join("\n");
}
