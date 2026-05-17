// Types for strategic briefs imported from Conversion Intel. The
// strategic_briefs table physically lives in the Conversion Intel feature but
// is read here over the shared Supabase project (RLS scopes rows to the
// requesting user). These types are read-only — this engine never writes the
// table.

// The 7-section intel payload stored in strategic_briefs.brief_data (jsonb).
// Inner section shapes vary by brief generation and are intentionally loose;
// the generate route serializes each section verbatim into the prompt, so we
// only need them to be JSON-serializable, not strongly shaped here.
export interface BriefData {
  winning_hooks?: unknown;
  price_positioning?: unknown;
  audience_messaging?: unknown;
  creative_format_trends?: unknown;
  cta_strategies?: unknown;
  gap_analysis?: unknown;
  recommended_actions?: unknown;
  // Tolerate extra/renamed sections without dropping them.
  [key: string]: unknown;
}

// Row shape returned by GET /api/briefs/list — lean, list-display only.
// client_name comes from a left join on clients and is null for briefs not
// attached to a client (or clients the user can't see).
export interface BriefListItem {
  id: string;
  client_id: string | null;
  client_name: string | null;
  offer: string;
  niche: string;
  created_at: string;
}

// Full row returned by GET /api/briefs/[id] — includes the heavy brief_data
// jsonb. This is what gets carried in component state and posted back to
// /api/generate as `briefData`.
export interface ImportedBrief {
  id: string;
  user_id: string;
  client_id: string | null;
  offer: string;
  audience: string;
  niche: string;
  competitors: string;
  brief_data: BriefData;
  created_at: string;
}
