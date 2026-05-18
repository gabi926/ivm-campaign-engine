"use client";

// "Import audit report" block at the top of the campaign form. Mirrors the
// BriefImporter pattern: presentation-only, owns its own fetch/loading/error
// state, and emits the chosen audit (or null) up to the parent, which carries
// report_json into /api/generate. No field pre-fill — audit data is too rich
// to map cleanly to the form, so it only rides along as auditData.
//
// The dropdown is intentionally inline here rather than a separate component —
// it's tightly coupled to this block's selection + pill state and isn't reused
// anywhere else.
//
// Fetch failures degrade silently: the form keeps working from scratch even
// when /api/audits/list is unreachable.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AuditListItem, ImportedAudit } from "@/app/_lib/audit-types";

interface Props {
  // Scopes which audits are offered (this client's + unattached). null = no
  // client selected → all of the user's audits.
  clientId: string | null;
  // Called with the full audit on select, or null when detached.
  onAuditSelected: (audit: ImportedAudit | null) => void;
  // Disable while a generation is in flight.
  disabled: boolean;
}

const FROM_SCRATCH = "";

function formatAuditLabel(a: AuditListItem): string {
  const date = new Date(a.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const who = a.client_name?.trim() || "Unattached";
  const account = a.account_id?.trim() || "—";
  const range = a.date_range_label?.trim() || "—";
  return `${date} — ${who} — ${account} (${range})`;
}

export function AuditImporter({ clientId, onAuditSelected, disabled }: Props) {
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>(FROM_SCRATCH);
  const [loadedAudit, setLoadedAudit] = useState<ImportedAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // (Re)fetch the list on mount and whenever the client scope changes. The
  // current selection is reset on scope change since an audit that was valid
  // for one client may not be in the new list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
        const res = await fetch(`/api/audits/list${qs}`, { method: "GET" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as { audits?: AuditListItem[] };
        if (cancelled) return;
        setAudits(Array.isArray(json.audits) ? json.audits : []);
      } catch (e) {
        if (cancelled) return;
        console.warn("[AuditImporter] /api/audits/list fetch failed:", e);
        setError("Couldn't load audits — generate from scratch or refresh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleSelectChange = async (id: string) => {
    if (id === FROM_SCRATCH) {
      setSelectedId(FROM_SCRATCH);
      setLoadedAudit(null);
      onAuditSelected(null);
      return;
    }
    setSelectedId(id);
    setError("");
    try {
      const res = await fetch(`/api/audits/${id}`, { method: "GET" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { audit?: ImportedAudit };
      if (!json.audit) throw new Error("missing audit in response");
      setLoadedAudit(json.audit);
      onAuditSelected(json.audit);
    } catch (e) {
      console.warn("[AuditImporter] /api/audits/:id fetch failed:", e);
      setSelectedId(FROM_SCRATCH);
      setLoadedAudit(null);
      onAuditSelected(null);
      setError("Couldn't load that audit. Try another or generate from scratch.");
    }
  };

  const detach = () => {
    setSelectedId(FROM_SCRATCH);
    setLoadedAudit(null);
    onAuditSelected(null);
  };

  const pillLabel = loadedAudit
    ? `${loadedAudit.account_id || "—"} — ${loadedAudit.date_range_label || "—"}`
    : "";

  return (
    <div className="border border-stone-300 bg-white card-shadow rounded-2xl p-5">
      <label className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-1 block">
        Import audit report (optional)
      </label>
      <p className="font-mono-x text-[10px] text-stone-500 mb-3 leading-relaxed">
        Load Meta ad account diagnostics from Audit Engine to inform creative direction.
      </p>
      <select
        value={selectedId}
        onChange={(e) => handleSelectChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full bg-white border border-stone-300 px-4 py-3 text-sm text-stone-900 ring-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <option value={FROM_SCRATCH}>Loading audits…</option>
        ) : (
          <>
            <option value={FROM_SCRATCH}>Start from scratch</option>
            {audits.map((a) => (
              <option key={a.id} value={a.id}>
                {formatAuditLabel(a)}
              </option>
            ))}
          </>
        )}
      </select>

      {error && (
        <div className="font-mono-x text-[10px] text-stone-500 mt-1.5">
          {error}
        </div>
      )}

      {loadedAudit && (
        <div className="mt-3 inline-flex items-center gap-2 accent-chip rounded-full text-[11px]">
          <span className="font-mono-x font-bold">✓ Audit loaded: {pillLabel}</span>
          <button
            type="button"
            onClick={detach}
            disabled={disabled}
            aria-label="Detach imported audit"
            className="flex items-center justify-center hover:opacity-60 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
