#!/usr/bin/env node
// scripts/d2-ranker-smoke.mjs
//
// Phase-1 smoke test for the AL taxonomy ranker.
//
// Re-implements the ranker algorithm verbatim from the source HTML and runs
// it against a golden ICP, then prints the top-10 candidates with their
// scores. The point is to verify (1) taxonomy.json parses correctly,
// (2) the algorithm returns the expected shape, (3) the top hits look
// semantically right for the input.
//
// This script intentionally re-implements the algorithm rather than
// importing ranker.ts — that way the smoke test catches port-level drift
// between the source JS and the TS port.
//
// Usage:  node scripts/d2-ranker-smoke.mjs

import fs from "node:fs";

const TAX_PATH = "app/_lib/al-taxonomy/taxonomy.json";

const tax = JSON.parse(fs.readFileSync(TAX_PATH, "utf8"));
console.log(`Loaded ${TAX_PATH}: ${tax.rows.length.toLocaleString()} rows`);

function tokenize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function rank(icpText, taxonomy, topN = 200) {
  const tokens = new Set(tokenize(icpText));
  const scored = [];
  for (const row of taxonomy.rows) {
    const cat = taxonomy.cats[row.c];
    const sub = taxonomy.subs[row.s];
    const haystackTokens = tokenize(row.t + " " + sub + " " + cat);
    let score = 0;
    for (const tok of haystackTokens) if (tokens.has(tok)) score += 1;
    const topicLower = row.t.toLowerCase();
    for (const tok of tokens) {
      if (tok.length > 3 && topicLower.includes(tok)) score += 2;
    }
    if (score > 0) scored.push({ id: row.i, cat, sub, topic: row.t, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

const GOLDEN_ICPS = [
  {
    label: "B2B SaaS founder / PLG",
    text: "B2B SaaS founders ($1M-$10M ARR) building product-led growth. Struggling with free-trial to paid conversion. Currently using HubSpot CRM and ChargeBee for billing.",
  },
  {
    label: "B2C home services (cleaning)",
    text: "Homeowners 35-65 with household income $75k+, married with children, looking for recurring residential cleaning services. Prefer eco-friendly products. Suburban metros.",
  },
  {
    label: "B2B financial advisors targeting HNW",
    text: "Independent RIA financial advisors targeting high-net-worth business owners ($2M+ investable assets). Focus on tax-efficient retirement planning and estate strategies.",
  },
];

for (const { label, text } of GOLDEN_ICPS) {
  console.log(`\n=== ${label} ===`);
  console.log(`ICP: ${text.slice(0, 100)}...`);
  const t0 = Date.now();
  const out = rank(text, tax);
  const ms = Date.now() - t0;
  console.log(`Ranked ${out.length} candidates in ${ms}ms`);
  console.log(`Top 10:`);
  for (const c of out.slice(0, 10)) {
    console.log(`  [${c.score}] ${c.id} · ${c.cat} > ${c.sub} · ${c.topic}`);
  }
}
