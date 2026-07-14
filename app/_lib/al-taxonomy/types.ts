// D2 — AL Audience Builder types.
//
// Two type families:
//   1. Taxonomy — the embedded AL_TAXONOMY data shape (cats[]/subs[]/rows[]).
//      Rows reference cats/subs by index for compactness (the source HTML
//      was minimizing bytes, not legibility).
//   2. Spec — the JSON shape Claude returns per generation request, per the
//      SYSTEM_PROMPT's "OUTPUT FORMAT" section. Mirrors the 8-panel
//      structure (Intent · Business · Financial · Personal · Family ·
//      Housing · Location · Contact).
//
// Keep these as the single source of truth for both server (generate
// route, persistence) and client (form, spec view) sides.

// ============================================================================
// Taxonomy
// ============================================================================

export interface ALTaxonomyRow {
  /** Index into ALTaxonomyData.cats */
  c: number;
  /** Index into ALTaxonomyData.subs */
  s: number;
  /** AL taxonomy id (e.g. "b2b_7623", "b2c_1042") */
  i: string;
  /** Topic label */
  t: string;
}

export interface ALTaxonomyData {
  cats: string[];
  subs: string[];
  rows: ALTaxonomyRow[];
}

export interface ALTaxonomyCandidate {
  id: string;
  cat: string;
  sub: string;
  topic: string;
  score: number;
}

// ============================================================================
// Spec — what Claude returns, per SYSTEM_PROMPT's OUTPUT FORMAT block
// ============================================================================

export type ALDetectedType = "B2B" | "B2C" | "Hybrid";

export type ALBuildTier = "pain" | "solution_shopping" | "decision_stage";

export type ALBuildMethod = "Premade" | "Keyword" | "Custom";

export type ALMinScore = "Low" | "Medium" | "High";

export interface ALTaxonomyMatch {
  id: string;
  topic: string;
  /** "Cat > Sub" path string */
  path: string;
}

export interface ALAudienceBuild {
  name: string;
  tier: ALBuildTier;
  priority: number;
  /** Free-text confidence band, e.g. "70-85%" */
  match_probability: string;
  method: ALBuildMethod;
  min_score: ALMinScore;
  taxonomy_matches: ALTaxonomyMatch[];
  /** 6-12 word phrase when method === "Keyword", else "" */
  intent_keywords: string;
  notes: string;
}

export interface ALIntentPanel {
  active: boolean;
  audience_builds: ALAudienceBuild[];
  skip_reason?: string;
}

export interface ALBusinessPanel {
  active: boolean;
  skip_reason: string;
  b2b_keywords: string;
  job_titles: string[];
  seniority: string[];
  industries: string[];
  naics_include: string[];
  naics_exclude: string[];
  employee_count: string[];
  revenue: string[];
}

/**
 * Financial / Personal / Family / Housing all share the same flexible shape:
 * an `active` flag, a `skip_reason` when inactive, and a `fields` map keyed
 * by the AL UI field name with either a single string or an array of values.
 * The SYSTEM_PROMPT instructs Claude to use whatever AL field names match
 * — we don't enumerate them in code.
 */
export interface ALGenericPanel {
  active: boolean;
  skip_reason: string;
  fields: Record<string, string | string[]>;
}

export interface ALLocationPanel {
  active: boolean;
  cities: string[];
  states: string[];
  zips: string[];
}

export interface ALContactPanel {
  verified_personal_emails: boolean;
  verified_business_emails: boolean;
  valid_phones: boolean;
  skip_traced_wireless: boolean;
  note: string;
}

export interface ALPanels {
  intent: ALIntentPanel;
  business: ALBusinessPanel;
  financial: ALGenericPanel;
  personal: ALGenericPanel;
  family: ALGenericPanel;
  housing: ALGenericPanel;
  location: ALLocationPanel;
  contact: ALContactPanel;
}

export interface ALSummary {
  total_audiences_to_build: number;
  estimated_total_records: string;
  primary_buying_signal: string;
}

export interface ALAudienceSpec {
  audience_name: string;
  detected_type: ALDetectedType;
  summary: ALSummary;
  panels: ALPanels;
}

// ============================================================================
// API request / response shapes
// ============================================================================

export interface ALGenerateRequest {
  icp: string;
  offer: string;
  geography: string;
  /** Optional — operator may attach this spec to a portal client. */
  client_id?: string;
  /** Optional — operator may attach this spec to a Revenue Engine campaign. */
  campaign_id?: string;
}

export interface ALGenerateResponse {
  /** UUID of the persisted al_audience_specs row. */
  id: string;
  spec: ALAudienceSpec;
  model_used: string;
  candidate_count: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

export interface ALSpecListItem {
  id: string;
  audience_name: string | null;
  detected_type: string | null;
  client_id: string | null;
  campaign_id: string | null;
  geography: string;
  created_at: string;
}
