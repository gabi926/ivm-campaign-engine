import * as cheerio from "cheerio";
import type {
  DetectedTracker,
  TrackingInfrastructure,
} from "../../_lib/campaign-types";

const LIMITATIONS_NOTE =
  "This is an HTML-only check. We can confirm pixel installation, not whether events are firing correctly. To verify firing, CAPI status, Match Quality, and domain verification, check the platform account directly.";

export function detectTrackers(html: string): TrackingInfrastructure {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return {
      status: "missing_tracking",
      trackers: [],
      recommendations: ["Page HTML could not be parsed; tracking detection skipped."],
      limitations_note: LIMITATIONS_NOTE,
    };
  }

  const scriptSrcs: string[] = [];
  const inlineScripts: string[] = [];
  $("script").each((_, el) => {
    const src = $(el).attr("src");
    if (src) scriptSrcs.push(src);
    else inlineScripts.push($(el).html() ?? "");
  });
  const inlineCode = inlineScripts.join("\n");
  const noscriptHtml = $("noscript")
    .map((_, el) => $.html(el))
    .get()
    .join("\n");

  // Meta Pixel
  const metaIds = new Set<string>();
  for (const m of noscriptHtml.matchAll(/facebook\.com\/tr[^"'\s>]*[?&]id=(\d+)/g)) {
    metaIds.add(m[1]);
  }
  for (const m of inlineCode.matchAll(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d+)['"]/g)) {
    metaIds.add(m[1]);
  }
  const hasFbEvents = scriptSrcs.some((s) =>
    /connect\.facebook\.net\/[^/]+\/fbevents\.js/i.test(s),
  );

  // gtag-family IDs (G- / UA- / AW-)
  const ga4Ids = new Set<string>();
  const uaIds = new Set<string>();
  const awIds = new Set<string>();
  const collectGtag = (text: string) => {
    const re =
      /(?:gtag\/js\?id=|gtag\s*\(\s*['"](?:config|set)['"]\s*,\s*['"])((?:G|UA|AW)-[\w-]+)/g;
    for (const m of text.matchAll(re)) {
      const id = m[1];
      if (id.startsWith("G-")) ga4Ids.add(id);
      else if (id.startsWith("UA-")) uaIds.add(id);
      else if (id.startsWith("AW-")) awIds.add(id);
    }
  };
  scriptSrcs.forEach(collectGtag);
  collectGtag(inlineCode);

  // GTM
  const gtmIds = new Set<string>();
  for (const m of html.matchAll(/GTM-[A-Z0-9]+/g)) gtmIds.add(m[0]);

  // Other trackers (presence-only)
  const hasTikTok = /(?:analytics\.tiktok\.com|tiktok\.com\/i18n\/pixel)/i.test(html);
  const hasLinkedIn = /snap\.licdn\.com/i.test(html);
  const hasGoogleAds =
    /googleadservices\.com\/pagead/i.test(html) || awIds.size > 0;
  const hasHotjar = /static\.hotjar\.com/i.test(html);
  const hasClarity = /clarity\.ms/i.test(html);
  const hasSegment = /(?:cdn\.segment\.com|analytics\.segment\.com)/i.test(html);
  const hasMixpanel =
    /(?:cdn\.mxpnl\.com|cdn\.mixpanel\.com|mixpanel\.init\b)/i.test(html);

  const trackers: DetectedTracker[] = [];
  if (metaIds.size > 0 || hasFbEvents) {
    trackers.push({
      name: "Meta Pixel",
      ids: Array.from(metaIds),
      warning:
        metaIds.size > 1
          ? "Multiple pixel IDs detected on the same page — common error from layered installations."
          : undefined,
    });
  }
  if (ga4Ids.size > 0) trackers.push({ name: "GA4", ids: Array.from(ga4Ids) });
  if (uaIds.size > 0) {
    trackers.push({
      name: "Universal Analytics",
      ids: Array.from(uaIds),
      warning: "Deprecated — sunset 2023.",
    });
  }
  if (gtmIds.size > 0)
    trackers.push({ name: "Google Tag Manager", ids: Array.from(gtmIds) });
  if (hasGoogleAds)
    trackers.push({ name: "Google Ads Conversion", ids: Array.from(awIds) });
  if (hasTikTok) trackers.push({ name: "TikTok Pixel", ids: [] });
  if (hasLinkedIn) trackers.push({ name: "LinkedIn Insight Tag", ids: [] });
  if (hasHotjar) trackers.push({ name: "Hotjar", ids: [] });
  if (hasClarity) trackers.push({ name: "Microsoft Clarity", ids: [] });
  if (hasSegment) trackers.push({ name: "Segment", ids: [] });
  if (hasMixpanel) trackers.push({ name: "Mixpanel", ids: [] });

  const hasMeta = metaIds.size > 0 || hasFbEvents;
  const hasGa4OrGtm = ga4Ids.size > 0 || gtmIds.size > 0;
  const hasUa = uaIds.size > 0;

  let status: TrackingInfrastructure["status"];
  if (hasUa) status = "deprecated";
  else if (hasMeta && hasGa4OrGtm) status = "fully_instrumented";
  else if (hasMeta || hasGa4OrGtm) status = "partially_instrumented";
  else status = "missing_tracking";

  const recommendations: string[] = [];
  if (!hasMeta) {
    recommendations.push(
      "Install Meta Pixel before running paid ads. Without it: no audience building, no retargeting, no conversion optimization.",
    );
  }
  if (metaIds.size > 1) {
    recommendations.push(
      "Multiple Meta pixel IDs detected on the same page — common error from layered installations. Audit and consolidate.",
    );
  }
  if (ga4Ids.size === 0 && !hasUa) {
    recommendations.push(
      "Add GA4 for behavioral analytics independent of ad platforms.",
    );
  }
  if (gtmIds.size > 0 && ga4Ids.size === 0) {
    recommendations.push(
      "GTM present but no GA4 detected — ensure GA4 is configured inside GTM.",
    );
  }
  if (hasUa && ga4Ids.size === 0) {
    recommendations.push(
      "Universal Analytics is deprecated — migrate to GA4 immediately.",
    );
  } else if (hasUa && ga4Ids.size > 0) {
    recommendations.push(
      "Universal Analytics is loading alongside GA4 — UA was sunset 2023, remove the legacy tags.",
    );
  }

  return {
    status,
    trackers,
    recommendations,
    limitations_note: LIMITATIONS_NOTE,
  };
}
