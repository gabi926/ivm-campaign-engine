#!/usr/bin/env node
// scripts/d2-extract.mjs
//
// One-shot extractor for the D2 port: pulls the AL_TAXONOMY object and the
// SYSTEM_PROMPT string out of c:/IVM/reference/al_audience_builder_2.html
// and writes them into source-controlled files the new Next.js code can
// consume.
//
// Outputs:
//   app/_lib/al-taxonomy/taxonomy.json   — full taxonomy as JSON
//   app/_lib/al-taxonomy/prompt.txt      — raw SYSTEM_PROMPT text
//   (this script also prints row counts + B2B/B2C split to stdout)
//
// Usage:  node scripts/d2-extract.mjs

import fs from "node:fs";
import path from "node:path";

const SRC = "c:/IVM/reference/al_audience_builder_2.html";
const OUT_TAX = "app/_lib/al-taxonomy/taxonomy.json";
const OUT_PROMPT = "app/_lib/al-taxonomy/prompt.txt";

function extractObjectLiteral(src, startPattern) {
  const i = src.indexOf(startPattern);
  if (i === -1) throw new Error(`pattern not found: ${startPattern}`);
  const objStart = src.indexOf("{", i);
  if (objStart === -1) throw new Error("no { after pattern");
  let depth = 0;
  let inStr = null;
  let escape = false;
  for (let p = objStart; p < src.length; p++) {
    const ch = src[p];
    if (escape) {
      escape = false;
      continue;
    }
    if (inStr) {
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(objStart, p + 1);
    }
  }
  throw new Error("unbalanced braces");
}

function extractTemplateLiteral(src, startPattern) {
  const i = src.indexOf(startPattern);
  if (i === -1) throw new Error(`pattern not found: ${startPattern}`);
  const tickStart = src.indexOf("`", i);
  if (tickStart === -1) throw new Error("no opening backtick");
  let escape = false;
  for (let p = tickStart + 1; p < src.length; p++) {
    const ch = src[p];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === "`") return src.slice(tickStart + 1, p);
  }
  throw new Error("unterminated template literal");
}

const html = fs.readFileSync(SRC, "utf8");
console.log(`Read ${html.length.toLocaleString()} bytes from ${SRC}`);

// AL_TAXONOMY — eval the object literal in a sandboxed Function so we get a
// real JS object regardless of unquoted keys / single-quoted strings.
const taxLit = extractObjectLiteral(html, "const AL_TAXONOMY");
console.log(`AL_TAXONOMY literal: ${taxLit.length.toLocaleString()} bytes`);
let taxonomy;
try {
  taxonomy = new Function(`return (${taxLit});`)();
} catch (e) {
  console.error("Failed to eval AL_TAXONOMY literal:", e.message);
  process.exit(1);
}
if (!taxonomy || !Array.isArray(taxonomy.rows) || !Array.isArray(taxonomy.cats) || !Array.isArray(taxonomy.subs)) {
  console.error("AL_TAXONOMY shape mismatch — expected { cats, subs, rows }");
  process.exit(1);
}
const b2b = taxonomy.rows.filter((r) => String(r.i ?? "").startsWith("b2b")).length;
const b2c = taxonomy.rows.filter((r) => String(r.i ?? "").startsWith("b2c")).length;
const other = taxonomy.rows.length - b2b - b2c;

const taxOut = path.resolve(OUT_TAX);
fs.mkdirSync(path.dirname(taxOut), { recursive: true });
fs.writeFileSync(taxOut, JSON.stringify(taxonomy));
console.log(`Wrote ${OUT_TAX} (${fs.statSync(taxOut).size.toLocaleString()} bytes)`);
console.log(`  cats: ${taxonomy.cats.length}`);
console.log(`  subs: ${taxonomy.subs.length}`);
console.log(`  rows: ${taxonomy.rows.length.toLocaleString()}`);
console.log(`  split: ${b2b.toLocaleString()} B2B / ${b2c.toLocaleString()} B2C / ${other.toLocaleString()} other`);

// Sample a few rows so the operator can sanity-check the structure.
console.log(`  sample rows:`);
for (const r of taxonomy.rows.slice(0, 3)) {
  console.log(`    ${JSON.stringify({ i: r.i, c: taxonomy.cats[r.c], s: taxonomy.subs[r.s], t: r.t })}`);
}

// SYSTEM_PROMPT — preserve verbatim. Years of operator-tuned craft live in
// this string; do NOT rewrite it.
const prompt = extractTemplateLiteral(html, "const SYSTEM_PROMPT");
console.log(`\nSYSTEM_PROMPT: ${prompt.length.toLocaleString()} chars`);
const promptOut = path.resolve(OUT_PROMPT);
fs.writeFileSync(promptOut, prompt);
console.log(`Wrote ${OUT_PROMPT}`);
console.log(`  first line: ${prompt.split("\n")[0].slice(0, 100)}...`);
