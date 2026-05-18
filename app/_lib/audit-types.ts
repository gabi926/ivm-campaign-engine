// Types for Meta ad-account audit reports imported from Audit Engine. The
// audit_runs table physically lives in the Audit Engine feature but is read
// here over the shared Supabase project (RLS scopes rows to the requesting
// user). These types are read-only — this engine never writes the table.

// The audit payload stored in audit_runs.report_json (jsonb). Section shapes
// vary by audit run and are intentionally loose; the generate route serializes
// a curated subset verbatim into the prompt, so we only need them to be
// JSON-serializable, not strongly shaped here. Mirrors the BriefData precedent.
export interface AuditReportJson {
  claude_analysis?: unknown;
  pixel_health?: unknown;
  top_performers?: unknown;
  andromeda_lens?: unknown;
  // Tolerate extra/renamed sections without dropping them.
  [key: string]: unknown;
}

// Row shape returned by GET /api/audits/list — lean, list-display only.
// client_name comes from a left join on clients and is null for audits not
// attached to a client (or clients the user can't see).
export interface AuditListItem {
  id: string;
  client_id: string | null;
  client_name: string | null;
  account_id: string;
  date_range_label: string;
  created_at: string;
}

// Full row returned by GET /api/audits/[id] — includes the heavy report_json
// jsonb. This is what gets carried in component state and posted back to
// /api/generate as `auditData`. Unlike briefs, columns are not renamed:
// report_json already uses clean keys, so it passes through as-is.
export interface ImportedAudit {
  id: string;
  user_id: string;
  client_id: string | null;
  account_id: string;
  date_range_label: string;
  report_json: AuditReportJson;
  created_at: string;
}
