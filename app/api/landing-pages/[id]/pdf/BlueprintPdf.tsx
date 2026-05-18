// Branded LP-blueprint PDF. Self-contained @react-pdf/renderer doc mirroring
// CampaignPdf's token palette + Times typography so output is visually
// consistent across IVM tools. Colocated with its route (CampaignPdf pattern).

import fs from "node:fs";
import path from "node:path";
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { BUILDER_LABEL, type BlueprintRow } from "@/app/_lib/blueprint-types";

let LOGO: { data: Buffer; format: "png" } | null = null;
try {
  const logoPath = path.join(process.cwd(), "public", "ivm-logo.png");
  LOGO = { data: fs.readFileSync(logoPath), format: "png" };
} catch (e) {
  console.warn("[bp-pdf] logo not found at public/ivm-logo.png:", e);
}

const ACCENT = "#d4ff3d";
const INK = "#1c1917";
const SUBTLE = "#78716c";
const RULE = "#d6d3d1";
const SOFT_BG = "#f5f5f4";

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 56,
    paddingHorizontal: 50,
    fontFamily: "Times-Roman",
    fontSize: 10,
    lineHeight: 1.45,
    color: INK,
  },
  coverWrap: { paddingTop: 90, paddingHorizontal: 56 },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  logo: { width: 80, height: 26, objectFit: "contain", marginRight: 10 },
  brandTag: { fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 2, color: SUBTLE },
  accentBar: { width: 54, height: 6, backgroundColor: ACCENT, marginBottom: 22 },
  coverTitle: { fontFamily: "Times-Bold", fontSize: 30, marginBottom: 10 },
  coverSub: { fontSize: 12, color: SUBTLE, marginBottom: 26 },
  metaRow: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 1, color: SUBTLE, width: 110 },
  metaVal: { fontSize: 10 },
  h2: {
    fontFamily: "Times-Bold",
    fontSize: 16,
    marginTop: 20,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingBottom: 4,
  },
  para: { marginBottom: 6 },
  sectionBox: { borderWidth: 1, borderColor: RULE, padding: 10, marginBottom: 8 },
  sectionName: { fontFamily: "Times-Bold", fontSize: 12, marginBottom: 2 },
  sectionHead: { fontFamily: "Times-Bold", fontSize: 11, marginBottom: 3, color: "#444" },
  label: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1, color: SUBTLE, marginTop: 4 },
  bullet: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 12, fontFamily: "Helvetica-Bold" },
  bulletText: { flex: 1 },
  code: {
    fontFamily: "Courier",
    fontSize: 8,
    backgroundColor: SOFT_BG,
    padding: 8,
    color: INK,
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Helvetica",
    fontSize: 8,
    color: SUBTLE,
  },
});

function Footer() {
  return (
    <View style={styles.footer} fixed>
      <Text>IVM · Landing Page Blueprint</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export interface BlueprintPdfProps {
  blueprint: BlueprintRow;
  clientName: string | null;
}

export function BlueprintPdf({ blueprint, clientName }: BlueprintPdfProps) {
  const bd = blueprint.blueprint_data;
  const structure = bd?.page_structure ?? [];
  const sections = bd?.sections ?? [];
  const integrations = bd?.integrations ?? [];

  return (
    <Document title={`LP Blueprint — ${clientName ?? "Client"}`}>
      {/* Cover + structure */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverWrap}>
          <View style={styles.brandRow}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {LOGO ? <Image src={LOGO} style={styles.logo} /> : null}
            <Text style={styles.brandTag}>IVM · LP BLUEPRINT</Text>
          </View>
          <View style={styles.accentBar} />
          <Text style={styles.coverTitle}>Landing Page Blueprint</Text>
          <Text style={styles.coverSub}>{clientName ?? "Client campaign"}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>TARGET BUILDER</Text>
            <Text style={styles.metaVal}>{BUILDER_LABEL[blueprint.target_builder]}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>GENERATED</Text>
            <Text style={styles.metaVal}>
              {new Date(blueprint.created_at).toLocaleString("en-US")}
            </Text>
          </View>
          <Text style={[styles.h2, { marginTop: 28 }]}>Page structure</Text>
          {structure.length === 0 ? (
            <Text style={styles.para}>—</Text>
          ) : (
            structure.map((s, i) => (
              <View style={styles.bullet} key={i}>
                <Text style={styles.bulletDot}>{i + 1}.</Text>
                <Text style={styles.bulletText}>{s}</Text>
              </View>
            ))
          )}
        </View>
        <Footer />
      </Page>

      {/* Section-by-section copy */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Section-by-section copy</Text>
        {sections.map((s, i) => (
          <View style={styles.sectionBox} key={i} wrap={false}>
            <Text style={styles.sectionName}>{s.name}</Text>
            <Text style={styles.sectionHead}>{s.headline}</Text>
            <Text style={styles.para}>{s.body}</Text>
            <Text style={styles.label}>CTA</Text>
            <Text>
              {s.cta_text} — {s.cta_placement}
            </Text>
            <Text style={styles.label}>VISUAL DIRECTION</Text>
            <Text>{s.visual_direction}</Text>
            {s.form_fields && s.form_fields.length > 0 ? (
              <>
                <Text style={styles.label}>FORM FIELDS</Text>
                <Text>{s.form_fields.join(", ")}</Text>
              </>
            ) : null}
          </View>
        ))}
        <Footer />
      </Page>

      {/* Integrations + builder prompt */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Recommended integrations</Text>
        {integrations.length === 0 ? (
          <Text style={styles.para}>—</Text>
        ) : (
          integrations.map((it, i) => (
            <View style={styles.bullet} key={i}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={{ fontFamily: "Times-Bold" }}>{it.name}</Text> — {it.why}.{" "}
                {it.setup_notes}
              </Text>
            </View>
          ))
        )}
        {bd?.pixel_capi_reminder ? (
          <Text style={[styles.para, { marginTop: 8, fontStyle: "italic" }]}>
            {bd.pixel_capi_reminder}
          </Text>
        ) : null}

        <Text style={styles.h2}>Paste-ready builder prompt</Text>
        <Text style={[styles.para, { color: SUBTLE }]}>
          Paste this into {BUILDER_LABEL[blueprint.target_builder]}.
        </Text>
        <Text style={styles.code}>{blueprint.builder_prompt}</Text>
        <Footer />
      </Page>
    </Document>
  );
}
