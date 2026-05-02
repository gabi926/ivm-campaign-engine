import fs from "node:fs";
import path from "node:path";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type {
  CampaignOutput,
  CopyVariation,
  EmailItem,
  ImageConcept,
  LandingPageAudit,
  LpCategoryScore,
  NewsletterIssue,
  SmsMessage,
  VideoConcept,
} from "../../_lib/campaign-types";

// Read logo at module load. If missing, PDF still renders without it.
let LOGO: { data: Buffer; format: "png" } | null = null;
try {
  const logoPath = path.join(process.cwd(), "public", "ivm-logo.png");
  LOGO = { data: fs.readFileSync(logoPath), format: "png" };
} catch (e) {
  console.warn("[pdf] logo not found at public/ivm-logo.png; rendering without:", e);
}

const ACCENT = "#d4ff3d";
const INK = "#1c1917";
const SUBTLE = "#78716c";
const RULE = "#d6d3d1";
const SOFT_BG = "#f5f5f4";

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: "Times-Roman",
    fontSize: 10,
    lineHeight: 1.45,
    color: INK,
  },
  cover: {
    paddingTop: 100,
    paddingBottom: 60,
    paddingHorizontal: 60,
    fontFamily: "Times-Roman",
    color: INK,
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100%",
  },
  coverEyebrow: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 2,
    color: SUBTLE,
    marginBottom: 18,
  },
  coverClient: {
    fontFamily: "Times-Bold",
    fontSize: 44,
    lineHeight: 1.05,
    marginBottom: 6,
  },
  coverTagline: {
    fontFamily: "Times-Italic",
    fontSize: 16,
    color: SUBTLE,
    marginBottom: 28,
  },
  coverMetaRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  coverMetaLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.5,
    color: SUBTLE,
    width: 70,
  },
  coverMetaValue: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    color: INK,
    flex: 1,
  },
  coverFooter: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: SUBTLE,
    letterSpacing: 1,
  },
  accentBar: {
    backgroundColor: ACCENT,
    height: 5,
    width: 80,
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 8,
    marginBottom: 16,
  },
  sectionNumber: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.5,
    color: SUBTLE,
  },
  sectionTitle: {
    fontFamily: "Times-Bold",
    fontSize: 22,
  },
  sectionSubtitle: {
    fontFamily: "Helvetica",
    fontSize: 8,
    letterSpacing: 1,
    color: SUBTLE,
    marginTop: 2,
  },
  bigIdeaCard: {
    backgroundColor: ACCENT,
    padding: 24,
    marginBottom: 18,
  },
  bigIdeaLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  bigIdeaClaim: {
    fontFamily: "Times-Bold",
    fontSize: 22,
    lineHeight: 1.2,
  },
  card: {
    borderWidth: 1,
    borderColor: RULE,
    padding: 12,
    marginBottom: 10,
  },
  cardLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1.5,
    color: SUBTLE,
    marginBottom: 4,
  },
  metaChip: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1,
    color: "#57534e",
    backgroundColor: "#fafaf9",
    borderWidth: 1,
    borderColor: RULE,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  accentChip: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    letterSpacing: 1,
    color: "#0a0a0a",
    backgroundColor: ACCENT,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: 4,
    marginBottom: 4,
  },
  rowChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  headline: {
    fontFamily: "Times-Bold",
    fontSize: 13,
    lineHeight: 1.25,
    marginBottom: 4,
  },
  body: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    lineHeight: 1.45,
    marginBottom: 4,
  },
  smallSubtle: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: SUBTLE,
    fontStyle: "italic",
  },
  scoreBadge: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: "#0a0a0a",
    backgroundColor: ACCENT,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  paragraph: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    marginBottom: 8,
    lineHeight: 1.45,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bulletDot: {
    width: 8,
    color: SUBTLE,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica",
    fontSize: 7,
    letterSpacing: 1,
    color: SUBTLE,
  },
  prebox: {
    backgroundColor: SOFT_BG,
    borderWidth: 1,
    borderColor: RULE,
    padding: 8,
    marginBottom: 6,
  },
  preboxText: {
    fontFamily: "Courier",
    fontSize: 8.5,
    lineHeight: 1.4,
    color: INK,
  },
  hr: {
    borderTopWidth: 1,
    borderTopColor: RULE,
    marginVertical: 8,
  },
  twoCol: {
    flexDirection: "row",
    gap: 10,
  },
  scoreHeroBox: {
    borderWidth: 2,
    borderColor: INK,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    gap: 16,
  },
  scoreHeroNumber: {
    fontFamily: "Times-Bold",
    fontSize: 56,
    lineHeight: 1,
  },
});

const FOOTER_BRAND = "Powered by IVM · go-ivm.com";

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image, no alt prop */}
        {LOGO ? <Image src={LOGO} style={{ height: 14, width: 35 }} /> : null}
        <Text>{FOOTER_BRAND}</Text>
      </View>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function SectionHeader({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionNumber}>/{number}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle.toUpperCase()}</Text> : null}
    </View>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>▸</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

interface PdfProps {
  clientName: string;
  channels: string[];
  output: CampaignOutput;
}

export function CampaignPdf({ clientName, channels, output }: PdfProps) {
  const today = fmtDate(new Date());
  const channelsLabel = channels.length > 0 ? channels.join(" · ") : "—";

  return (
    <Document
      title={`IVM Campaign Brief — ${clientName}`}
      author="IVM Campaign Engine"
      subject="Multi-channel campaign brief"
    >
      {/* Cover */}
      <Page size="A4" style={styles.cover}>
        <View>
          {LOGO ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image, no alt prop
            <Image src={LOGO} style={{ height: 60, width: 150, marginBottom: 14 }} />
          ) : null}
          <Text style={styles.coverEyebrow}>POWERED BY IVM · CAMPAIGN ENGINE V5</Text>
          <View style={styles.accentBar} />
          <Text style={styles.coverClient}>{clientName}</Text>
          <Text style={styles.coverTagline}>Multi-channel campaign · operator-grade</Text>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>GENERATED</Text>
            <Text style={styles.coverMetaValue}>{today}</Text>
          </View>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>CHANNELS</Text>
            <Text style={styles.coverMetaValue}>{channelsLabel}</Text>
          </View>
          {output.landing_page_audit?.url_audited ? (
            <View style={styles.coverMetaRow}>
              <Text style={styles.coverMetaLabel}>LP AUDITED</Text>
              <Text style={styles.coverMetaValue}>{output.landing_page_audit.url_audited}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.coverFooter}>{FOOTER_BRAND}</Text>
      </Page>

      {/* Big Idea */}
      {output.big_idea ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="01" title="The Big Idea" subtitle="Spine · everything orbits this" />
          <View style={styles.bigIdeaCard}>
            <Text style={styles.bigIdeaLabel}>CENTRAL CLAIM</Text>
            <Text style={styles.bigIdeaClaim}>{output.big_idea.claim || "—"}</Text>
          </View>
          {output.big_idea.why_it_works ? (
            <>
              <Text style={styles.cardLabel}>WHY IT WORKS</Text>
              <Text style={styles.paragraph}>{output.big_idea.why_it_works}</Text>
            </>
          ) : null}
          {output.big_idea.supporting_proof?.length ? (
            <>
              <Text style={styles.cardLabel}>SUPPORTING PROOF</Text>
              {output.big_idea.supporting_proof.map((p, i) => (
                <Bullet key={i}>{p}</Bullet>
              ))}
            </>
          ) : null}
          <PageFooter />
        </Page>
      ) : null}

      {/* LP Audit */}
      {output.landing_page_audit ? (
        <LpAuditPage audit={output.landing_page_audit} />
      ) : null}

      {/* Competitor Intel */}
      {output.competitor_intel?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="03" title="Competitor Intel" subtitle={`${output.competitor_intel.length} analyzed`} />
          {output.competitor_intel.map((c, i) => (
            <View key={i} style={styles.card} wrap={false}>
              <Text style={styles.cardLabel}>COMPETITOR {String(i + 1).padStart(2, "0")}</Text>
              <Text style={styles.headline}>{c.competitor || "—"}</Text>
              {c.positioning ? <Text style={styles.paragraph}>{c.positioning}</Text> : null}
              {c.primary_hooks?.length ? (
                <>
                  <Text style={styles.cardLabel}>HOOKS</Text>
                  {c.primary_hooks.map((h, j) => (
                    <Bullet key={j}>{h}</Bullet>
                  ))}
                </>
              ) : null}
              {c.offer_structure ? (
                <>
                  <Text style={styles.cardLabel}>OFFER</Text>
                  <Text style={styles.body}>{c.offer_structure}</Text>
                </>
              ) : null}
              {c.creative_patterns ? (
                <>
                  <Text style={styles.cardLabel}>CREATIVE</Text>
                  <Text style={styles.body}>{c.creative_patterns}</Text>
                </>
              ) : null}
              {c.gaps_to_exploit ? (
                <>
                  <Text style={styles.cardLabel}>GAP TO EXPLOIT</Text>
                  <Text style={styles.body}>{c.gaps_to_exploit}</Text>
                </>
              ) : null}
            </View>
          ))}
          <PageFooter />
        </Page>
      ) : null}

      {/* Copy Angles */}
      {output.copy_variations?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="04" title="Copy Angles" subtitle={`${output.copy_variations.length} variations · scored`} />
          {output.copy_variations.map((c, i) => (
            <CopyCard key={i} idx={i} c={c} />
          ))}
          <PageFooter />
        </Page>
      ) : null}

      {/* CTA Stack */}
      {output.cta_variations?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="05" title="CTA Stack" subtitle={`${output.cta_variations.length} · psychology-tagged`} />
          {output.cta_variations.map((c, i) => (
            <View key={i} style={styles.card} wrap={false}>
              <Text style={styles.headline}>{c.text || "—"}</Text>
              <View style={styles.rowChips}>
                {c.framework ? <Text style={styles.metaChip}>{c.framework}</Text> : null}
              </View>
              {c.trigger ? <Text style={styles.smallSubtle}>{c.trigger}</Text> : null}
            </View>
          ))}
          <PageFooter />
        </Page>
      ) : null}

      {/* Search Ads */}
      {output.search_ads?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="06" title="Search Ads" subtitle="Google ready" />
          {output.search_ads.map((s, i) => (
            <View key={i} style={styles.card} wrap={false}>
              <Text style={styles.cardLabel}>SEARCH AD {String(i + 1).padStart(2, "0")}</Text>
              <Text style={styles.headline}>
                {[s.headline_1, s.headline_2, s.headline_3].filter(Boolean).join(" | ")}
              </Text>
              {s.description ? <Text style={styles.body}>{s.description}</Text> : null}
              {s.intent_match ? <Text style={styles.smallSubtle}>Intent: {s.intent_match}</Text> : null}
              {s.sitelinks?.length ? (
                <View style={[styles.rowChips, { marginTop: 4 }]}>
                  {s.sitelinks.map((sl, j) => (
                    <Text key={j} style={styles.metaChip}>{sl}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
          <PageFooter />
        </Page>
      ) : null}

      {/* Programmatic */}
      {output.programmatic_creative ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="07" title="Programmatic Creative" subtitle="Display + native" />
          {output.programmatic_creative.banner_concepts?.length ? (
            <>
              <Text style={styles.cardLabel}>BANNER CONCEPTS</Text>
              {output.programmatic_creative.banner_concepts.map((b, i) => (
                <View key={i} style={styles.card} wrap={false}>
                  <Text style={styles.accentChip}>{b.size || "—"}</Text>
                  <Text style={styles.headline}>{b.headline || "—"}</Text>
                  {b.subhead ? <Text style={styles.body}>{b.subhead}</Text> : null}
                  {b.cta_button ? <Text style={styles.smallSubtle}>CTA: {b.cta_button}</Text> : null}
                  {b.visual_direction ? <Text style={styles.smallSubtle}>Visual: {b.visual_direction}</Text> : null}
                </View>
              ))}
            </>
          ) : null}
          {output.programmatic_creative.native_ads?.length ? (
            <>
              <Text style={[styles.cardLabel, { marginTop: 8 }]}>NATIVE ADS</Text>
              {output.programmatic_creative.native_ads.map((n, i) => (
                <View key={i} style={styles.card} wrap={false}>
                  <Text style={styles.headline}>{n.headline || "—"}</Text>
                  {n.description ? <Text style={styles.body}>{n.description}</Text> : null}
                  {n.image_direction ? <Text style={styles.smallSubtle}>Image: {n.image_direction}</Text> : null}
                </View>
              ))}
            </>
          ) : null}
          <PageFooter />
        </Page>
      ) : null}

      {/* Email Sequence */}
      {output.email_sequence?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="08" title="Email Sequence" subtitle={`${output.email_sequence.length}-email automation`} />
          {output.email_sequence.map((e, i) => (
            <EmailCard key={i} e={e} />
          ))}
          <PageFooter />
        </Page>
      ) : null}

      {/* Newsletter */}
      {output.newsletter_issues?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="09" title="Newsletter Issues" subtitle="Editorial-style" />
          {output.newsletter_issues.map((n, i) => (
            <NewsletterCard key={i} idx={i} n={n} />
          ))}
          <PageFooter />
        </Page>
      ) : null}

      {/* SMS */}
      {output.sms_messages?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="10" title="SMS Messages" subtitle="TCPA-aware" />
          {output.sms_messages.map((s, i) => (
            <SmsCard key={i} s={s} />
          ))}
          <PageFooter />
        </Page>
      ) : null}

      {/* Organic */}
      {output.organic_strategy ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="11" title="Organic Social Strategy" subtitle="Pillars · hooks · cadence · soft CTAs" />
          {output.organic_strategy.content_pillars?.length ? (
            <>
              <Text style={styles.cardLabel}>CONTENT PILLARS</Text>
              {output.organic_strategy.content_pillars.map((p, i) => (
                <View key={i} style={styles.card} wrap={false}>
                  <Text style={styles.headline}>{p.pillar || "—"}</Text>
                  {p.purpose ? <Text style={styles.smallSubtle}>{p.purpose}</Text> : null}
                  {p.content_types?.length ? (
                    <View style={[styles.rowChips, { marginTop: 4 }]}>
                      {p.content_types.map((t, j) => (
                        <Text key={j} style={styles.metaChip}>{t}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
          {output.organic_strategy.post_hooks?.length ? (
            <>
              <Text style={[styles.cardLabel, { marginTop: 6 }]}>POST HOOKS</Text>
              {output.organic_strategy.post_hooks.map((h, i) => (
                <View key={i} style={[styles.card, { paddingVertical: 6 }]} wrap={false}>
                  <Text style={styles.body}>{h.hook || "—"}</Text>
                  <View style={styles.rowChips}>
                    {h.framework ? <Text style={styles.metaChip}>{h.framework}</Text> : null}
                    {h.pillar_match ? <Text style={styles.metaChip}>{h.pillar_match}</Text> : null}
                  </View>
                </View>
              ))}
            </>
          ) : null}
          {output.organic_strategy.caption_templates?.length ? (
            <>
              <Text style={[styles.cardLabel, { marginTop: 6 }]}>CAPTION TEMPLATES</Text>
              {output.organic_strategy.caption_templates.map((c, i) => (
                <View key={i} wrap={false} style={{ marginBottom: 8 }}>
                  <Text style={styles.accentChip}>{(c.style || "TEMPLATE").toUpperCase()}</Text>
                  <View style={styles.prebox}>
                    <Text style={styles.preboxText}>{c.template || ""}</Text>
                  </View>
                </View>
              ))}
            </>
          ) : null}
          <View style={styles.hr} />
          {output.organic_strategy.posting_cadence ? (
            <>
              <Text style={styles.cardLabel}>CADENCE</Text>
              <Text style={styles.paragraph}>{output.organic_strategy.posting_cadence}</Text>
            </>
          ) : null}
          {output.organic_strategy.link_in_bio_strategy ? (
            <>
              <Text style={styles.cardLabel}>LINK-IN-BIO</Text>
              <Text style={styles.paragraph}>{output.organic_strategy.link_in_bio_strategy}</Text>
            </>
          ) : null}
          {output.organic_strategy.soft_ctas?.length ? (
            <>
              <Text style={styles.cardLabel}>SOFT CTAs</Text>
              <View style={styles.rowChips}>
                {output.organic_strategy.soft_ctas.map((c, i) => (
                  <Text key={i} style={styles.metaChip}>{c}</Text>
                ))}
              </View>
            </>
          ) : null}
          <PageFooter />
        </Page>
      ) : null}

      {/* Image Concepts */}
      {output.image_concepts?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="12" title="Image Concepts" subtitle={`${output.image_concepts.length} · scroll-stop tested`} />
          {output.image_concepts.map((img, i) => (
            <ImageCard key={i} idx={i} img={img} />
          ))}
          <PageFooter />
        </Page>
      ) : null}

      {/* Video Concepts */}
      {output.video_concepts?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="13" title="Video Concepts" subtitle="Hook-framework tagged" />
          {output.video_concepts.map((v, i) => (
            <VideoCard key={i} idx={i} v={v} />
          ))}
          <PageFooter />
        </Page>
      ) : null}

      {/* Form Build */}
      <Page size="A4" style={styles.page} wrap>
        <SectionHeader number="14" title="Form Build" subtitle="Fields + qualifying questions" />
        {output.form_suggestions?.fields?.length ? (
          <>
            <Text style={styles.cardLabel}>FIELDS</Text>
            {output.form_suggestions.fields.map((f, i) => (
              <View key={i} style={[styles.card, { paddingVertical: 6, flexDirection: "row", justifyContent: "space-between" }]} wrap={false}>
                <Text style={styles.body}>
                  {f.label || "—"}{f.required ? " *" : ""}
                </Text>
                <Text style={styles.smallSubtle}>{(f.type || "").toUpperCase()}</Text>
              </View>
            ))}
          </>
        ) : null}
        {output.form_suggestions?.qualifying_questions?.length ? (
          <>
            <Text style={[styles.cardLabel, { marginTop: 8 }]}>QUALIFYING QUESTIONS</Text>
            {output.form_suggestions.qualifying_questions.map((q, i) => (
              <View key={i} style={styles.bullet}>
                <Text style={[styles.bulletDot, { width: 14 }]}>{String(i + 1).padStart(2, "0")}.</Text>
                <Text style={styles.bulletText}>{q}</Text>
              </View>
            ))}
          </>
        ) : null}
        <PageFooter />
      </Page>

      {/* Landing Page Structure */}
      {output.landing_page_structure?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="15" title="Landing Page Structure" subtitle={`${output.landing_page_structure.length} sections · Big Idea anchored`} />
          {output.landing_page_structure.map((s, i) => (
            <View key={i} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: ACCENT }]} wrap={false}>
              <Text style={styles.cardLabel}>{String(i + 1).padStart(2, "0")} · {(s.section || "—").toUpperCase()}</Text>
              {s.purpose ? <Text style={styles.smallSubtle}>{s.purpose}</Text> : null}
              {s.copy_direction ? <Text style={styles.body}>{s.copy_direction}</Text> : null}
            </View>
          ))}
          <PageFooter />
        </Page>
      ) : null}

      {/* Compliance */}
      {output.compliance_notes ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="16" title="Compliance Watch" subtitle="Read before launch" />
          {output.compliance_notes.general_flags?.length ? (
            <>
              <Text style={styles.cardLabel}>GENERAL</Text>
              {output.compliance_notes.general_flags.map((f, i) => (
                <Bullet key={i}>{f}</Bullet>
              ))}
            </>
          ) : null}
          {output.compliance_notes.platform_specific
            ? Object.entries(output.compliance_notes.platform_specific)
                .filter(([, flags]) => Array.isArray(flags) && flags.length > 0)
                .map(([platform, flags]) => (
                  <View key={platform} style={{ marginTop: 8 }}>
                    <Text style={styles.cardLabel}>{platform.toUpperCase()}</Text>
                    {flags.map((f, i) => (
                      <Bullet key={i}>{f}</Bullet>
                    ))}
                  </View>
                ))
            : null}
          <PageFooter />
        </Page>
      ) : null}

      {/* Weakness Audit */}
      {output.weakness_audit?.length ? (
        <Page size="A4" style={styles.page} wrap>
          <SectionHeader number="17" title="Weakness Audit" subtitle="3 weakest assets · self-critique · fixes" />
          {output.weakness_audit.map((w, i) => (
            <View key={i} style={[styles.card, { borderColor: INK, borderWidth: 2 }]} wrap={false}>
              <Text style={styles.accentChip}>{w.asset_reference || "—"}</Text>
              {w.weakness ? (
                <>
                  <Text style={styles.cardLabel}>WHY IT&apos;S WEAK</Text>
                  <Text style={styles.body}>{w.weakness}</Text>
                </>
              ) : null}
              {w.fix ? (
                <>
                  <Text style={[styles.cardLabel, { color: "#0a0a0a", backgroundColor: ACCENT, paddingHorizontal: 4, paddingVertical: 2, alignSelf: "flex-start" }]}>FIX</Text>
                  <Text style={[styles.body, { fontFamily: "Times-Bold" }]}>{w.fix}</Text>
                </>
              ) : null}
            </View>
          ))}
          <PageFooter />
        </Page>
      ) : null}
    </Document>
  );
}

function CopyCard({ idx, c }: { idx: number; c: CopyVariation }) {
  return (
    <View style={styles.card} wrap={false}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={styles.cardLabel}>COPY {String(idx + 1).padStart(2, "0")}</Text>
        {c.value_equation_score != null ? (
          <Text style={styles.scoreBadge}>V.E. {c.value_equation_score}/10</Text>
        ) : null}
      </View>
      <View style={styles.rowChips}>
        {c.angle ? <Text style={styles.accentChip}>{c.angle}</Text> : null}
        {c.lead_type ? <Text style={styles.metaChip}>{c.lead_type} LEAD</Text> : null}
        {c.awareness_level ? <Text style={styles.metaChip}>{c.awareness_level}</Text> : null}
        {c.traffic_temp ? <Text style={styles.metaChip}>{c.traffic_temp}</Text> : null}
      </View>
      {c.headline ? <Text style={styles.headline}>{c.headline}</Text> : null}
      {c.primary_text ? <Text style={styles.body}>{c.primary_text}</Text> : null}
      {c.value_equation_reasoning ? (
        <Text style={styles.smallSubtle}>{c.value_equation_reasoning}</Text>
      ) : null}
      {c.best_for ? <Text style={styles.smallSubtle}>Best for: {c.best_for}</Text> : null}
    </View>
  );
}

function EmailCard({ e }: { e: EmailItem }) {
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.rowChips}>
        {e.position ? <Text style={styles.accentChip}>{e.position}</Text> : null}
        {e.send_timing ? <Text style={styles.metaChip}>⏰ {e.send_timing}</Text> : null}
      </View>
      {e.subject ? <Text style={styles.headline}>{e.subject}</Text> : null}
      {e.preview_text ? <Text style={styles.smallSubtle}>{e.preview_text}</Text> : null}
      {e.body ? (
        <View style={styles.prebox}>
          <Text style={styles.preboxText}>{e.body}</Text>
        </View>
      ) : null}
      {e.cta ? <Text style={[styles.body, { fontFamily: "Times-Bold" }]}>CTA: {e.cta}</Text> : null}
    </View>
  );
}

function NewsletterCard({ idx, n }: { idx: number; n: NewsletterIssue }) {
  return (
    <View style={styles.card} wrap={false}>
      <Text style={styles.cardLabel}>ISSUE {String(idx + 1).padStart(2, "0")}</Text>
      {n.subject ? <Text style={styles.headline}>{n.subject}</Text> : null}
      {n.preview_text ? <Text style={styles.smallSubtle}>{n.preview_text}</Text> : null}
      {n.hook ? (
        <>
          <Text style={styles.cardLabel}>HOOK</Text>
          <Text style={[styles.body, { fontFamily: "Times-Italic" }]}>{n.hook}</Text>
        </>
      ) : null}
      {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
      {n.soft_cta ? (
        <Text style={[styles.smallSubtle, { fontFamily: "Times-Italic" }]}>{n.soft_cta}</Text>
      ) : null}
    </View>
  );
}

function SmsCard({ s }: { s: SmsMessage }) {
  return (
    <View style={styles.card} wrap={false}>
      {s.use_case ? <Text style={styles.accentChip}>{s.use_case.toUpperCase()}</Text> : null}
      {s.message ? (
        <View style={styles.prebox}>
          <Text style={styles.preboxText}>{s.message}</Text>
        </View>
      ) : null}
      {s.compliance_note ? (
        <Text style={styles.smallSubtle}>⚠ Compliance: {s.compliance_note}</Text>
      ) : null}
    </View>
  );
}

function ImageCard({ idx, img }: { idx: number; img: ImageConcept }) {
  return (
    <View style={styles.card} wrap={false}>
      <Text style={styles.cardLabel}>CONCEPT {String(idx + 1).padStart(2, "0")}</Text>
      {img.concept ? <Text style={styles.headline}>{img.concept}</Text> : null}
      {img.scroll_stop_principle ? (
        <Text style={styles.smallSubtle}>Scroll-stop: {img.scroll_stop_principle}</Text>
      ) : null}
      {img.ai_prompt ? (
        <View style={styles.prebox}>
          <Text style={styles.preboxText}>{img.ai_prompt}</Text>
        </View>
      ) : null}
      {img.placement ? <Text style={styles.smallSubtle}>Placement: {img.placement}</Text> : null}
    </View>
  );
}

function VideoCard({ idx, v }: { idx: number; v: VideoConcept }) {
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.rowChips}>
        <Text style={styles.cardLabel}>VIDEO {String(idx + 1).padStart(2, "0")}</Text>
      </View>
      <View style={styles.rowChips}>
        {v.style ? <Text style={styles.accentChip}>{v.style.toUpperCase()}</Text> : null}
        {v.duration ? <Text style={styles.metaChip}>{v.duration}</Text> : null}
        {v.hook_framework ? <Text style={styles.metaChip}>{v.hook_framework}</Text> : null}
      </View>
      {v.hook ? (
        <>
          <Text style={styles.cardLabel}>HOOK · 0-3s</Text>
          <Text style={[styles.headline, { fontFamily: "Times-Italic" }]}>&ldquo;{v.hook}&rdquo;</Text>
        </>
      ) : null}
      {v.script ? (
        <>
          <Text style={styles.cardLabel}>SCRIPT</Text>
          <View style={styles.prebox}>
            <Text style={styles.preboxText}>{v.script}</Text>
          </View>
        </>
      ) : null}
      {v.platform_fit ? (
        <Text style={styles.smallSubtle}>Platform fit: {v.platform_fit}</Text>
      ) : null}
    </View>
  );
}

function alignmentColor(verdict?: string): { bg: string; text: string; label: string } {
  const v = (verdict || "").toLowerCase();
  if (v === "aligned") return { bg: "#d1fae5", text: "#065f46", label: "ALIGNED" };
  if (v === "partial") return { bg: "#fef3c7", text: "#92400e", label: "PARTIAL" };
  if (v === "misaligned") return { bg: "#fee2e2", text: "#991b1b", label: "MISALIGNED" };
  return { bg: "#f5f5f4", text: "#44403c", label: (verdict || "—").toUpperCase() };
}

function LpAuditPage({ audit }: { audit: LandingPageAudit }) {
  const align = alignmentColor(audit.big_idea_alignment?.verdict);
  const cats = audit.category_scores;
  const categoryEntries: { label: string; data?: LpCategoryScore }[] = [
    { label: "Above-fold clarity", data: cats?.above_fold_clarity },
    { label: "Hero match", data: cats?.hero_match },
    { label: "Social proof", data: cats?.social_proof },
    { label: "Offer clarity", data: cats?.offer_clarity },
    { label: "CTA strength", data: cats?.cta_strength },
    { label: "Trust signals", data: cats?.trust_signals },
    { label: "Friction audit", data: cats?.friction_audit },
    { label: "Mobile", data: cats?.mobile_considerations },
  ];

  return (
    <Page size="A4" style={styles.page} wrap>
      <SectionHeader number="02" title="Landing Page Audit" subtitle="CRO strategist · Big Idea aligned" />
      <View style={styles.scoreHeroBox} wrap={false}>
        <View style={{ width: 110 }}>
          <Text style={styles.cardLabel}>OVERALL</Text>
          <Text style={styles.scoreHeroNumber}>{audit.overall_score ?? "—"}</Text>
          <Text style={styles.smallSubtle}>/100</Text>
          {audit.url_audited ? (
            <Text style={[styles.smallSubtle, { marginTop: 4 }]}>{audit.url_audited}</Text>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardLabel}>BIG IDEA ALIGNMENT</Text>
          <View style={[styles.rowChips, { marginBottom: 6 }]}>
            <Text style={[styles.accentChip, { backgroundColor: align.bg, color: align.text }]}>
              {align.label}
            </Text>
            {audit.big_idea_alignment?.score != null ? (
              <Text style={styles.metaChip}>{audit.big_idea_alignment.score}/10</Text>
            ) : null}
          </View>
          {audit.big_idea_alignment?.what_lp_says ? (
            <Text style={styles.body}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>LP SAYS: </Text>
              {audit.big_idea_alignment.what_lp_says}
            </Text>
          ) : null}
          {audit.big_idea_alignment?.what_campaign_promises ? (
            <Text style={styles.body}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>CAMPAIGN PROMISES: </Text>
              {audit.big_idea_alignment.what_campaign_promises}
            </Text>
          ) : null}
          {audit.big_idea_alignment?.gap_analysis ? (
            <Text style={[styles.body, { fontFamily: "Times-Bold" }]}>
              Gap: {audit.big_idea_alignment.gap_analysis}
            </Text>
          ) : null}
        </View>
      </View>

      {audit.five_second_test ? (
        <View style={styles.card} wrap={false}>
          <View style={styles.rowChips}>
            <Text style={styles.accentChip}>5-SECOND TEST</Text>
            {audit.five_second_test.verdict ? (
              <Text style={styles.metaChip}>{audit.five_second_test.verdict}</Text>
            ) : null}
          </View>
          {audit.five_second_test.what_user_understands ? (
            <Text style={[styles.body, { fontFamily: "Times-Italic" }]}>
              &ldquo;{audit.five_second_test.what_user_understands}&rdquo;
            </Text>
          ) : null}
        </View>
      ) : null}

      {audit.top_3_priority_fixes?.length ? (
        <View style={[styles.card, { borderColor: INK, borderWidth: 2 }]} wrap={false}>
          <Text style={styles.cardLabel}>⚡ TOP 3 PRIORITY FIXES</Text>
          {audit.top_3_priority_fixes.map((f, i) => (
            <View key={i} style={[styles.card, { backgroundColor: SOFT_BG, marginBottom: 6 }]} wrap={false}>
              <View style={styles.rowChips}>
                <Text style={styles.accentChip}>#{f.rank ?? i + 1}</Text>
                <Text style={[styles.headline, { fontSize: 11 }]}>{f.fix || "—"}</Text>
              </View>
              {f.why ? (
                <>
                  <Text style={styles.cardLabel}>WHY</Text>
                  <Text style={styles.body}>{f.why}</Text>
                </>
              ) : null}
              {f.implementation ? (
                <>
                  <Text style={[styles.cardLabel, { color: "#0a0a0a", backgroundColor: ACCENT, paddingHorizontal: 4, paddingVertical: 2, alignSelf: "flex-start" }]}>HOW</Text>
                  <Text style={[styles.body, { fontFamily: "Times-Bold" }]}>{f.implementation}</Text>
                </>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <Text style={[styles.cardLabel, { marginTop: 6 }]}>CATEGORY SCORES</Text>
      {categoryEntries.map((entry, i) => (
        <View key={i} style={styles.card} wrap={false}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={[styles.headline, { fontSize: 11 }]}>{entry.label}</Text>
            <Text style={styles.scoreBadge}>{entry.data?.score ?? "—"}/10</Text>
          </View>
          {entry.data?.issues?.length ? (
            <>
              <Text style={[styles.cardLabel, { color: "#991b1b" }]}>ISSUES</Text>
              {entry.data.issues.map((iss, j) => (
                <Bullet key={j}>{iss}</Bullet>
              ))}
            </>
          ) : null}
          {entry.data?.fixes?.length ? (
            <>
              <Text style={[styles.cardLabel, { color: "#0a0a0a", backgroundColor: ACCENT, paddingHorizontal: 4, paddingVertical: 2, alignSelf: "flex-start" }]}>FIXES</Text>
              {entry.data.fixes.map((fx, j) => (
                <Bullet key={j}>{fx}</Bullet>
              ))}
            </>
          ) : null}
        </View>
      ))}

      {audit.conversion_blockers?.length ? (
        <View style={[styles.card, { backgroundColor: "#fef3c7", borderColor: "#fbbf24" }]} wrap={false}>
          <Text style={[styles.cardLabel, { color: "#92400e" }]}>⚠ CONVERSION BLOCKERS</Text>
          {audit.conversion_blockers.map((b, i) => (
            <Bullet key={i}>{b}</Bullet>
          ))}
        </View>
      ) : null}

      {audit.what_is_working?.length ? (
        <View style={[styles.card, { backgroundColor: "#d1fae5", borderColor: "#10b981" }]} wrap={false}>
          <Text style={[styles.cardLabel, { color: "#065f46" }]}>WHAT&apos;S WORKING</Text>
          {audit.what_is_working.map((w, i) => (
            <Bullet key={i}>{w}</Bullet>
          ))}
        </View>
      ) : null}

      {audit.page_performance_note ? (
        <Text style={[styles.smallSubtle, { marginTop: 8 }]}>{audit.page_performance_note}</Text>
      ) : null}

      <PageFooter />
    </Page>
  );
}
