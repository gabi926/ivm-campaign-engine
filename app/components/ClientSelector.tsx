"use client";

// Client dropdown for the Revenue Engine campaign form. Mirrors the Audit
// Engine's pattern but doesn't wrap an account-ID input (Revenue Engine has
// no account-ID field). The component is presentation-only — it owns its
// own clients fetch + loading + error states and emits onClientChange to
// the parent, which decides what to do with the selection (e.g. auto-fill
// the Brand Name field, populate clientId in the request body).
//
// "+ One-off campaign (no client)" is always available as the escape hatch.
// Loading and fetch-failure states degrade silently — the audit form keeps
// working even when the clients table is unreachable.

import { useEffect, useMemo, useState } from "react";

export interface ClientOption {
  id: string;
  name: string;
  meta_ad_account_id: string;
}

interface Props {
  // Called whenever the selection changes. `null` = one-off (or no selection).
  // Parent uses this to track which client_id (if any) to send with the campaign.
  onClientChange: (client: ClientOption | null) => void;
  // Disable the dropdown (e.g. while a generation is in flight).
  disabled?: boolean;
}

const ONE_OFF_VALUE = "__one_off__";

export function ClientSelector({ onClientChange, disabled = false }: Props) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);

  // "" = "Select a client..." (neutral / no selection)
  // ONE_OFF_VALUE = explicit one-off campaign
  // any UUID = matching row in `clients`
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/clients", { method: "GET" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as { clients?: ClientOption[] };
        if (cancelled) return;
        setClients(Array.isArray(json.clients) ? json.clients : []);
      } catch (e) {
        if (cancelled) return;
        console.warn("[ClientSelector] /api/clients fetch failed:", e);
        setFetchFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const handleSelectChange = (newValue: string) => {
    if (newValue === "" || newValue === ONE_OFF_VALUE) {
      setSelectedClientId(newValue);
      onClientChange(null);
      return;
    }
    const client = clients.find((c) => c.id === newValue);
    if (!client) return;
    setSelectedClientId(client.id);
    onClientChange(client);
  };

  return (
    <div>
      <label className="font-mono-x text-[10px] uppercase tracking-widest text-stone-500 mb-2 block">
        Client
      </label>
      <select
        value={selectedClientId}
        onChange={(e) => handleSelectChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full bg-white border border-stone-300 px-4 py-3 text-sm text-stone-900 ring-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <option value="">Loading clients…</option>
        ) : (
          <>
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.meta_ad_account_id})
              </option>
            ))}
            {clients.length > 0 && (
              <option value="" disabled>
                ──────────
              </option>
            )}
            <option value={ONE_OFF_VALUE}>+ One-off campaign (no client)</option>
          </>
        )}
      </select>
      {fetchFailed && (
        <div className="font-mono-x text-[10px] text-stone-500 mt-1.5">
          Couldn&apos;t load saved clients — run a one-off campaign or refresh to retry.
        </div>
      )}
      {selectedClient && (
        <div className="font-mono-x text-[10px] text-stone-500 mt-1.5">
          Generating for <span className="text-stone-700 font-bold">{selectedClient.name}</span>. Switch from the dropdown above.
        </div>
      )}
    </div>
  );
}
