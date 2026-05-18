// Shared types for the LP Blueprint Generator. Mirrors the columns in
// 004_landing_page_blueprints.sql.

export type TargetBuilder = "ghl" | "lovable" | "generic";

export const TARGET_BUILDERS: readonly TargetBuilder[] = [
  "ghl",
  "lovable",
  "generic",
] as const;

export const BUILDER_LABEL: Record<TargetBuilder, string> = {
  ghl: "GHL Studio",
  lovable: "Lovable",
  generic: "Generic / other tool",
};

export interface BlueprintSection {
  name: string; // Hero, Problem Agitation, Solution, Offer Stack, etc.
  headline: string;
  body: string; // 50-200 words
  cta_text: string;
  cta_placement: string;
  visual_direction: string;
  form_fields?: string[]; // present only on sections that capture a lead
}

export interface BlueprintIntegration {
  name: string; // Stripe | Calendly | Generic Form | ...
  why: string;
  setup_notes: string;
}

export interface BlueprintData {
  // Ordered list of section names = the page outline.
  page_structure: string[];
  sections: BlueprintSection[];
  integrations: BlueprintIntegration[];
  // Operator reminder string (Meta Pixel + CAPI install). NOT a cross-query
  // into the Audit Engine — just a textual nudge per spec.
  pixel_capi_reminder: string;
}

export interface BlueprintRow {
  id: string;
  user_id: string;
  client_id: string | null;
  campaign_id: string | null;
  target_builder: TargetBuilder;
  blueprint_data: BlueprintData;
  builder_prompt: string;
  created_at: string;
}

// Row shape for the /blueprints list (left-joined to clients.name).
export interface BlueprintListItem {
  id: string;
  client_id: string | null;
  client_name: string | null;
  target_builder: TargetBuilder;
  campaign_id: string | null;
  created_at: string;
}

// What Claude returns from /api/landing-pages/generate (one call, two parts).
export interface BlueprintGenerated {
  blueprint_data: BlueprintData;
  builder_prompt: string;
}
