"use client";

// "Import strategic brief" block at the top of the campaign form. Mirrors the
// ClientSelector pattern: presentation-only, owns its own fetch/loading/error
// state, and emits the chosen brief (or null) up to the parent, which decides
// what to do with it (pre-fill fields, carry brief_data into /api/generate).
//
// The dropdown is intentionally inline here rather than a separate component —
// it's tightly coupled to this block's selection + pill state and isn't reused
// anywhere else.
//
// Fetch failures degrade silently: the form keeps working from scratch even
// when /api/briefs/list is unreachable.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { BriefListItem, ImportedBrief } from "@/app/_lib/brief-types";

interface Props {
  // Scopes which briefs are offered (this client's + unattached). null = no
  // client selected → all of the user's briefs.
  clientId: string | null;
  // Called with the full brief on select, or null when detached.
  onBriefSelected: (brief: ImportedBrief | null) => void;
  // Disable while a generation is in flight.
  disabled: boolean;
}

const FROM_SCRATCH = "";

function formatBriefLabel(b: BriefListItem): string {
  const date = new Date(b.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const who = b.client_name?.trim() || "Unattached";
  const niche = b.niche?.trim() || "—";
  return `${date} — ${who} — ${niche}`;
}

export function BriefImporter({ clientId, onBriefSelected, disabled }: Props) {
  const [briefs, setBriefs] = useState<BriefListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>(FROM_SCRATCH);
  const [loadedBrief, setLoadedBrief] = useState<ImportedBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // (Re)fetch the list on mount and whenever the client scope changes. The
  // current selection is reset on scope change since a brief that was valid
  // for one client may not be in the new list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";
        const res = await fetch(`/api/briefs/list${qs}`, { method: "GET" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as { briefs?: BriefListItem[] };
        if (cancelled) return;
        setBriefs(Array.isArray(json.briefs) ? json.briefs : []);
      } catch (e) {
        if (cancelled) return;
        console.warn("[BriefImporter] /api/briefs/list fetch failed:", e);
        setError("Couldn't load briefs — generate from scratch or refresh.");
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
      setLoadedBrief(null);
      onBriefSelected(null);
      return;
    }
    setSelectedId(id);
    setError("");
    try {
      const res = await fetch(`/api/briefs/${id}`, { method: "GET" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { brief?: ImportedBrief };
      if (!json.brief) throw new Error("missing brief in response");
      setLoadedBrief(json.brief);
      onBriefSelected(json.brief);
    } catch (e) {
      console.warn("[BriefImporter] /api/briefs/:id fetch failed:", e);
      setSelectedId(FROM_SCRATCH);
      setLoadedBrief(null);
      onBriefSelected(null);
      setError("Couldn't load that brief. Try another or generate from scratch.");
    }
  };

  const detach = () => {
    setSelectedId(FROM_SCRATCH);
    setLoadedBrief(null);
    onBriefSelected(null);
  };

  // client_name lives on the list row, not on the full brief — look it back up.
  const loadedClientName =
    briefs.find((b) => b.id === loadedBrief?.id)?.client_name?.trim() ||
    "Unattached";
  const pillLabel = loadedBrief
    ? `${loadedClientName} — ${loadedBrief.niche || "—"}`
    : "";

  return (
    <div className="border border-stone-300 bg-white card-shadow rounded-2xl p-5">
      <label className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-1 block">
        Import strategic brief (optional)
      </label>
      <p className="font-mono-x text-[10px] text-stone-500 mb-3 leading-relaxed">
        Load competitive intel from Conversion Intel to inform creative direction.
      </p>
      <select
        value={selectedId}
        onChange={(e) => handleSelectChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full bg-white border border-stone-300 px-4 py-3 text-sm text-stone-900 ring-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <option value={FROM_SCRATCH}>Loading briefs…</option>
        ) : (
          <>
            <option value={FROM_SCRATCH}>Start from scratch</option>
            {briefs.map((b) => (
              <option key={b.id} value={b.id}>
                {formatBriefLabel(b)}
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

      {loadedBrief && (
        <div className="mt-3 inline-flex items-center gap-2 accent-chip rounded-full text-[11px]">
          <span className="font-mono-x font-bold">✓ Brief loaded: {pillLabel}</span>
          <button
            type="button"
            onClick={detach}
            disabled={disabled}
            aria-label="Detach imported brief"
            className="flex items-center justify-center hover:opacity-60 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
