"use client";

// D2 — AL Audience Builder client shell.
//
// Owns the form state, the file-upload → text extraction flow, the
// generate call to /api/audiences/generate, and rendering the returned
// spec via AudienceSpecView.
//
// The generate route accepts optional client_id (the operator can attach
// this spec to a portal client). Campaign attach is deferred to Phase 4's
// detail page — this v1 form only surfaces client attach.

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, FileText, Loader2, Wand2, X } from "lucide-react";
import { ClientSelector, type ClientOption } from "@/app/components/ClientSelector";
import { extractFileText, type FileExtractionResult } from "./file-parser";
import { AudienceSpecView } from "./AudienceSpecView";
import type {
  ALAudienceSpec,
  ALGenerateResponse,
} from "@/app/_lib/al-taxonomy/types";

const ACCENT = "#d4ff3d";

interface UploadedFileChip {
  filename: string;
  chars: number;
  text: string;
}

interface Result {
  id: string;
  spec: ALAudienceSpec;
  model_used: string;
  candidate_count: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  generatedAt: string;
}

export function AudienceBuilderClient() {
  const [icp, setIcp] = useState("");
  const [offer, setOffer] = useState("");
  const [geography, setGeography] = useState("United States");
  const [clientId, setClientId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadedFileChip[]>([]);
  const [uploadError, setUploadError] = useState<string>("");
  const [uploadingCount, setUploadingCount] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const totalUploadedChars = useMemo(
    () => uploads.reduce((n, u) => n + u.chars, 0),
    [uploads],
  );

  const disabled = generating || uploadingCount > 0;

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const handleClientChange = (client: ClientOption | null) => {
    setClientId(client?.id ?? null);
  };

  const handleFiles = async (files: FileList | File[]) => {
    setUploadError("");
    const arr = Array.from(files);
    setUploadingCount((c) => c + arr.length);
    try {
      for (const file of arr) {
        try {
          const out: FileExtractionResult = await extractFileText(file);
          if (out.chars === 0) {
            setUploadError(`No text extracted from ${out.filename}.`);
            continue;
          }
          setUploads((prev) => [
            ...prev,
            { filename: out.filename, chars: out.chars, text: out.text },
          ]);
        } catch (e) {
          setUploadError(
            e instanceof Error ? e.message : `Failed to read ${file.name}`,
          );
        }
      }
    } finally {
      setUploadingCount((c) => Math.max(0, c - arr.length));
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const removeUpload = (i: number) => {
    setUploads((prev) => prev.filter((_, idx) => idx !== i));
  };

  const generate = async () => {
    setError("");
    setResult(null);
    if (!icp.trim()) {
      setError("Paste an ICP first. Even a messy brain dump works.");
      return;
    }
    setGenerating(true);
    // Compose ICP + uploaded doc text — matches the source HTML's behavior of
    // concatenating extracted document text into the ICP payload.
    const composedIcp = uploads.length
      ? `${icp}\n\n---\nATTACHED DOCUMENTS:\n${uploads
          .map((u) => `[${u.filename}]\n${u.text}`)
          .join("\n\n")}`
      : icp;

    try {
      const res = await fetch("/api/audiences/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          icp: composedIcp,
          offer,
          geography,
          ...(clientId ? { client_id: clientId } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | (ALGenerateResponse & { success?: boolean; error?: string })
        | null;
      if (!res.ok || !data || !data.success || !data.spec) {
        setError(data?.error || `Generation failed (${res.status})`);
        setGenerating(false);
        return;
      }
      setResult({
        id: data.id,
        spec: data.spec,
        model_used: data.model_used,
        candidate_count: data.candidate_count,
        prompt_tokens: data.prompt_tokens,
        completion_tokens: data.completion_tokens,
        generatedAt: new Date().toLocaleString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const clearAll = () => {
    setIcp("");
    setOffer("");
    setGeography("United States");
    setUploads([]);
    setUploadError("");
    setResult(null);
    setError("");
    setClientId(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <header className="space-y-3">
        <div className="font-mono-x text-[11px] uppercase tracking-widest text-stone-500 font-bold">
          Revenue Engine · Audience Builder
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-black leading-tight text-stone-900">
          Build an AL Audience{" "}
          <span
            className="inline-block"
            style={{ backgroundColor: ACCENT, padding: "0 12px" }}
          >
            Spec
          </span>
        </h1>
        <p className="text-stone-700 leading-relaxed max-w-2xl">
          Paste an ICP brief. Attach PDF or Word docs for extra context. The
          tool ranks the 45,133-row AL taxonomy against your ICP, asks Claude
          to pick 3–8 IDs per audience build laddered by buying stage, and
          returns a copy-pasteable per-panel spec you plug into the real
          Audience Labs UI.
        </p>
      </header>

      {/* Form card */}
      <section className="border border-stone-200 bg-white card-shadow p-6 md:p-8 space-y-6">
        {/* Client attach */}
        <div className="space-y-2">
          <label className="block font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold">
            Client
            <span className="ml-2 font-normal text-stone-500 normal-case tracking-normal">
              (optional — attach this spec to a portal client)
            </span>
          </label>
          <ClientSelector onClientChange={handleClientChange} disabled={disabled} />
        </div>

        {/* ICP brief */}
        <div className="space-y-2">
          <label htmlFor="al-icp" className="block font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold">
            ICP Brief <span className="text-red-700">*</span>
          </label>
          <textarea
            id="al-icp"
            value={icp}
            onChange={(e) => setIcp(e.target.value)}
            disabled={disabled}
            placeholder="Paste the ICP. Free-text brain dump is fine. The more specific (industry, revenue, buying triggers, current stack), the better the taxonomy matches."
            className="w-full min-h-[180px] font-mono-x text-sm leading-relaxed p-4 border border-stone-300 bg-stone-50 ring-accent disabled:opacity-60"
          />
          <div className="font-mono-x text-[10px] text-stone-500">
            {icp.length.toLocaleString()} chars
            {totalUploadedChars > 0 && (
              <> · +{totalUploadedChars.toLocaleString()} chars from attachments</>
            )}
          </div>
        </div>

        {/* Offer + Geography */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="al-offer" className="block font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold">
              Offer
            </label>
            <textarea
              id="al-offer"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              disabled={disabled}
              placeholder="What are you offering these people?"
              className="w-full min-h-[80px] font-mono-x text-sm leading-relaxed p-3 border border-stone-300 bg-stone-50 ring-accent disabled:opacity-60"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="al-geo" className="block font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold">
              Geography
            </label>
            <input
              id="al-geo"
              type="text"
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
              disabled={disabled}
              placeholder="United States"
              className="w-full font-mono-x text-sm p-3 border border-stone-300 bg-stone-50 ring-accent disabled:opacity-60"
            />
          </div>
        </div>

        {/* File attachments */}
        <div className="space-y-2">
          <label className="block font-mono-x text-[10px] uppercase tracking-widest text-stone-500 font-bold">
            Attachments
            <span className="ml-2 font-normal text-stone-500 normal-case tracking-normal">
              (optional — PDF / DOCX / TXT / MD append to the ICP)
            </span>
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!disabled) setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
            }}
            onDrop={handleDrop}
            onClick={() => !disabled && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !disabled) {
                fileInputRef.current?.click();
              }
            }}
            className={`border-2 border-dashed p-4 text-center cursor-pointer transition ${
              disabled
                ? "border-stone-200 bg-stone-50 opacity-60 cursor-not-allowed"
                : dragOver
                  ? "border-[color:var(--ivm-accent)] bg-[color:var(--ivm-accent)]/10"
                  : "border-stone-300 bg-stone-50 hover:border-stone-500"
            }`}
          >
            <div className="font-mono-x text-[11px] uppercase tracking-widest text-stone-600 font-bold mb-1">
              {uploadingCount > 0 ? "Extracting…" : "Drop a file here"}
            </div>
            <div className="font-mono-x text-[10px] text-stone-500">
              or click to browse
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.md"
              onChange={handleFileInputChange}
              className="hidden"
              disabled={disabled}
            />
          </div>
          {uploads.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {uploads.map((u, i) => (
                <span
                  key={`${u.filename}-${i}`}
                  className="inline-flex items-center gap-2 border border-stone-300 bg-white px-2.5 py-1 font-mono-x text-[11px]"
                >
                  <FileText size={12} className="text-stone-500" />
                  <span className="text-stone-800">{u.filename}</span>
                  <span className="text-stone-500">
                    · {u.chars.toLocaleString()} chars
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeUpload(i);
                    }}
                    disabled={disabled}
                    className="text-stone-500 hover:text-red-700 transition"
                    aria-label={`Remove ${u.filename}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {uploadError && (
            <div className="flex items-start gap-2 text-sm text-red-800 pt-1">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-stone-200">
          <button
            onClick={generate}
            disabled={disabled || !icp.trim()}
            className="inline-flex items-center gap-2 font-mono-x text-[11px] uppercase tracking-widest text-stone-900 px-5 py-3 font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
            style={{ backgroundColor: ACCENT }}
          >
            {generating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Wand2 size={14} />
                Generate AL Spec
              </>
            )}
          </button>
          <button
            onClick={clearAll}
            disabled={disabled}
            className="font-mono-x text-[11px] uppercase tracking-widest text-stone-600 border border-stone-300 bg-white px-4 py-3 hover:border-stone-500 hover-dark disabled:opacity-40 transition"
          >
            Clear
          </button>
          {generating && (
            <div className="flex items-center gap-2 font-mono-x text-[10px] uppercase tracking-widest text-stone-500">
              <span
                className="w-2 h-2 rounded-full pulse-dot"
                style={{ backgroundColor: ACCENT }}
              />
              Ranking 45,133-row taxonomy · sending to Claude · usually 20–40s
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-800 border border-red-300 bg-red-50 p-3">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Result */}
      {result && (
        <div ref={resultRef} className="space-y-2">
          <div className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500">
            Generated {result.generatedAt} · model {result.model_used} ·{" "}
            {result.candidate_count} candidates
            {result.prompt_tokens != null && (
              <>
                {" "}
                · {result.prompt_tokens.toLocaleString()} prompt tokens
              </>
            )}
            {result.completion_tokens != null && (
              <>
                {" "}/ {result.completion_tokens.toLocaleString()} completion
              </>
            )}
          </div>
          <AudienceSpecView spec={result.spec} timestamp={`Spec ${result.id.slice(0, 8)}`} />
        </div>
      )}
    </div>
  );
}
