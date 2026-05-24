// Shared campaign output types used by both the client page and the PDF renderer.
// All fields are optional — the model may omit channel-specific sections, the LP
// audit, etc. Frontend and PDF should chain optionals defensively.

export interface BigIdea {
  claim?: string;
  why_it_works?: string;
  supporting_proof?: string[];
}
export interface CompetitorIntel {
  competitor?: string;
  positioning?: string;
  primary_hooks?: string[];
  offer_structure?: string;
  creative_patterns?: string;
  gaps_to_exploit?: string;
}
export interface CopyVariation {
  angle?: string;
  lead_type?: string;
  awareness_level?: string;
  traffic_temp?: string;
  headline?: string;
  primary_text?: string;
  value_equation_score?: number;
  value_equation_reasoning?: string;
  best_for?: string;
}
export interface CTAVariation {
  text?: string;
  framework?: string;
  trigger?: string;
}
export interface ImageConcept {
  concept?: string;
  ai_prompt?: string;
  scroll_stop_principle?: string;
  placement?: string;
}
/**
 * @deprecated Replaced in v1.1 by `video_concepts_short` + `video_concepts_long`.
 * Kept in the type so old saved rows fetched from `campaigns.campaign_json`
 * still type-check; new generations no longer populate it. The renderer in
 * CampaignReportView ignores this field on purpose — old campaigns surface
 * empty video sections (intentional graceful break per Chunk B v1.1 spec).
 */
export interface VideoConcept {
  hook?: string;
  hook_framework?: string;
  script?: string;
  duration?: string;
  style?: string;
  platform_fit?: string;
}

/**
 * 15-second one-click generation concept. Used by Kling 3.0 i2v via
 * /api/assets/generate. `prompt` is Kling-tuned (camera-motion verbs,
 * lighting, single clear subject).
 */
export interface VideoConceptShort {
  title?: string;
  hook?: string;
  script_compressed?: string;
  visual_direction?: string;
  prompt?: string;
  placement?: string;
  duration_sec?: 15;
}

/**
 * 30-45 second narrative concept. Blueprint-only — no inline generation
 * (Higgsfield's video models don't ship at this length yet). UI renders a
 * "Copy Prompt" CTA + a recommended_tool badge so the operator can hand the
 * script to the right downstream tool.
 */
export type RecommendedTool =
  | "Veo 3.1"
  | "HeyGen"
  | "Sora 2"
  | "Runway Gen-4"
  | "Human creator";

export interface VideoConceptLong {
  title?: string;
  hook?: string;
  full_script?: string;
  visual_direction?: string;
  vo?: string;
  placement?: string;
  recommended_tool?: RecommendedTool;
  duration_sec?: 30 | 35 | 45;
}
export interface SearchAd {
  headline_1?: string;
  headline_2?: string;
  headline_3?: string;
  description?: string;
  intent_match?: string;
  sitelinks?: string[];
}
export interface BannerConcept {
  size?: string;
  headline?: string;
  subhead?: string;
  cta_button?: string;
  visual_direction?: string;
}
export interface NativeAd {
  headline?: string;
  description?: string;
  image_direction?: string;
}
export interface ProgrammaticCreative {
  banner_concepts?: BannerConcept[];
  native_ads?: NativeAd[];
}
export interface EmailItem {
  position?: string;
  subject?: string;
  preview_text?: string;
  body?: string;
  cta?: string;
  send_timing?: string;
}
export interface NewsletterIssue {
  subject?: string;
  preview_text?: string;
  hook?: string;
  body?: string;
  soft_cta?: string;
}
export interface SmsMessage {
  use_case?: string;
  message?: string;
  compliance_note?: string;
}
export interface ContentPillar {
  pillar?: string;
  purpose?: string;
  content_types?: string[];
}
export interface PostHook {
  hook?: string;
  framework?: string;
  pillar_match?: string;
}
export interface CaptionTemplate {
  style?: string;
  template?: string;
}
export interface OrganicStrategy {
  content_pillars?: ContentPillar[];
  post_hooks?: PostHook[];
  caption_templates?: CaptionTemplate[];
  soft_ctas?: string[];
  posting_cadence?: string;
  link_in_bio_strategy?: string;
}
export interface FormField {
  label?: string;
  type?: string;
  required?: boolean;
}
export interface FormSuggestions {
  fields?: FormField[];
  qualifying_questions?: string[];
}
export interface LandingPageSection {
  section?: string;
  purpose?: string;
  copy_direction?: string;
}
export interface ComplianceNotes {
  general_flags?: string[];
  platform_specific?: Record<string, string[]>;
}
export interface WeaknessAuditItem {
  asset_reference?: string;
  weakness?: string;
  fix?: string;
}
export interface LpFiveSecondTest {
  pass?: boolean;
  what_user_understands?: string;
  verdict?: string;
}
export interface LpBigIdeaAlignment {
  score?: number;
  verdict?: string;
  what_lp_says?: string;
  what_campaign_promises?: string;
  gap_analysis?: string;
}
export interface LpCategoryScore {
  score?: number;
  issues?: string[];
  fixes?: string[];
}
export interface LpCategoryScores {
  above_fold_clarity?: LpCategoryScore;
  hero_match?: LpCategoryScore;
  social_proof?: LpCategoryScore;
  offer_clarity?: LpCategoryScore;
  cta_strength?: LpCategoryScore;
  trust_signals?: LpCategoryScore;
  friction_audit?: LpCategoryScore;
  mobile_considerations?: LpCategoryScore;
}
export interface LpPriorityFix {
  rank?: number;
  fix?: string;
  why?: string;
  implementation?: string;
}
export interface DetectedTracker {
  name: string;
  ids: string[];
  warning?: string;
}

export type TrackingStatus =
  | "fully_instrumented"
  | "partially_instrumented"
  | "missing_tracking"
  | "deprecated";

export interface TrackingInfrastructure {
  status: TrackingStatus;
  trackers: DetectedTracker[];
  recommendations: string[];
  limitations_note: string;
}

export interface LandingPageAudit {
  url_audited?: string;
  overall_score?: number;
  five_second_test?: LpFiveSecondTest;
  big_idea_alignment?: LpBigIdeaAlignment;
  category_scores?: LpCategoryScores;
  top_3_priority_fixes?: LpPriorityFix[];
  conversion_blockers?: string[];
  what_is_working?: string[];
  page_performance_note?: string;
}

export interface CampaignOutput {
  big_idea?: BigIdea;
  landing_page_audit?: LandingPageAudit;
  audit_input_error?: string;
  tracking_infrastructure?: TrackingInfrastructure;
  competitor_intel?: CompetitorIntel[];
  copy_variations?: CopyVariation[];
  cta_variations?: CTAVariation[];
  image_concepts?: ImageConcept[];
  /** @deprecated Use `video_concepts_short` + `video_concepts_long`. */
  video_concepts?: VideoConcept[];
  video_concepts_short?: VideoConceptShort[];
  video_concepts_long?: VideoConceptLong[];
  search_ads?: SearchAd[];
  programmatic_creative?: ProgrammaticCreative;
  email_sequence?: EmailItem[];
  newsletter_issues?: NewsletterIssue[];
  sms_messages?: SmsMessage[];
  organic_strategy?: OrganicStrategy;
  form_suggestions?: FormSuggestions;
  landing_page_structure?: LandingPageSection[];
  compliance_notes?: ComplianceNotes;
  weakness_audit?: WeaknessAuditItem[];
  /**
   * Chunk B v1.2 — id of the row this campaign was auto-persisted to.
   * Plumbed back to the fresh-generation page so InlineAssetGenerate
   * can render inline buttons on first render (vs requiring a
   * save-and-reopen). Omitted when the auto-save failed or when the
   * request came from a context with no signed-in user.
   */
  campaign_id?: string;
  /**
   * Chunk B v1.2 — set when the auto-save attempt errored. The UI shows
   * a small banner explaining inline buttons are unavailable until the
   * campaign is saved (re-generate or refresh).
   */
  save_error?: string;
}
