"use client";

// D2 client-side PDF / Word text extraction.
//
// Loads pdf.js and mammoth.js from CDN on first use — same pattern as the
// source HTML tool. Keeps them out of the Next.js server bundle (they're
// browser-only), avoids adding 6+ MB of npm deps to the campaign-engine,
// and defers all download cost until the operator actually drops a file.
//
// The loaded globals are cached on window so a second file upload in the
// same session is instant.
//
// Both libraries need to be script-tag injected (not import()-ed) because
// they self-register onto window; the source HTML did the same thing.

const PDFJS_VERSION = "3.11.174";
const MAMMOTH_VERSION = "1.6.0";
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
const MAMMOTH_URL = `https://cdnjs.cloudflare.com/ajax/libs/mammoth/${MAMMOTH_VERSION}/mammoth.browser.min.js`;

interface PdfJsPage {
  getTextContent(): Promise<{ items: Array<{ str: string }> }>;
}
interface PdfJsDocument {
  numPages: number;
  getPage(n: number): Promise<PdfJsPage>;
}
interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: ArrayBuffer } | ArrayBuffer): { promise: Promise<PdfJsDocument> };
}
interface MammothLib {
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

// Runtime globals injected by the CDN scripts. Accessed via an inline
// cast on `window` rather than a `declare global { Window }` merge to
// avoid Next.js 16's stricter type check treating the merged property
// as `never` after narrowing.
interface CdnGlobals {
  pdfjsLib?: PdfJsLib;
  mammoth?: MammothLib;
}
const cdnGlobals = (): CdnGlobals =>
  typeof window === "undefined" ? {} : (window as unknown as CdnGlobals);

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load ${src}`)),
        { once: true },
      );
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.addEventListener(
      "load",
      () => {
        s.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    s.addEventListener(
      "error",
      () => reject(new Error(`Failed to load ${src}`)),
      { once: true },
    );
    document.head.appendChild(s);
  });
}

async function ensurePdfJs(): Promise<PdfJsLib> {
  if (typeof window === "undefined") throw new Error("PDF parsing requires browser");
  const existing = cdnGlobals().pdfjsLib;
  if (existing) return existing;
  await loadScript(PDFJS_URL);
  const lib = cdnGlobals().pdfjsLib;
  if (!lib) throw new Error("pdf.js loaded but pdfjsLib global not set");
  lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return lib;
}

async function ensureMammoth(): Promise<MammothLib> {
  if (typeof window === "undefined") throw new Error("DOCX parsing requires browser");
  const existing = cdnGlobals().mammoth;
  if (existing) return existing;
  await loadScript(MAMMOTH_URL);
  const lib = cdnGlobals().mammoth;
  if (!lib) throw new Error("mammoth loaded but global not set");
  return lib;
}

async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await ensurePdfJs();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((it) => it.str).join(" "));
  }
  return parts.join("\n").trim();
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await ensureMammoth();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return (result.value ?? "").trim();
}

export interface FileExtractionResult {
  filename: string;
  text: string;
  chars: number;
}

/**
 * Extract text from a single file. Supports PDF and Word (.docx). Plain
 * .txt / .md are read directly. Anything else throws. The returned text
 * is stripped of leading/trailing whitespace.
 */
export async function extractFileText(file: File): Promise<FileExtractionResult> {
  const name = file.name;
  const lower = name.toLowerCase();
  const buffer = await file.arrayBuffer();
  let text: string;
  if (lower.endsWith(".pdf")) {
    text = await extractPdf(buffer);
  } else if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
    text = await extractDocx(buffer);
  } else if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    text = new TextDecoder().decode(buffer).trim();
  } else {
    throw new Error(
      `Unsupported file type: ${name}. Upload PDF, DOCX, TXT, or MD.`,
    );
  }
  return { filename: name, text, chars: text.length };
}
