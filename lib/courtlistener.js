import { buildFingerprint } from "./store.shared";

const DEFAULT_BASE_URL = process.env.COURTLISTENER_BASE_URL || "https://www.courtlistener.com/api/rest/v4";
const REQUIRED_MATCHES = ["kalshi", "kalshiex"];

function normalizeText(value) {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeSnippet(text) {
  const cleaned = normalizeText(text);
  return cleaned || "CourtListener result detected for manual review.";
}

function splitCaseSides(title) {
  const match = title.match(/^\s*(.+?)\s+v[.\s]\s+(.+?)\s*$/i);
  if (!match) return null;

  return {
    plaintiff: normalizeText(match[1]),
    defendant: normalizeText(match[2]),
  };
}

function normalizeCaseCaption(value) {
  return normalizeText(value)
    .replace(/^in re\s+/i, "")
    .replace(/^in the matter of\s+/i, "")
    .replace(/^matter of\s+/i, "")
    .replace(/^ex rel\.\s+/i, "")
    .trim();
}

function extractCourtName(result) {
  return normalizeText(result.court_citation_string || result.court || result.court_name || result.courtName || "");
}

function cleanDocumentDescription(value) {
  return normalizeText(value)
    .replace(/\(Entered:\s*[^)]+\)/gi, "")
    .replace(/\[Transferred[^\]]+\]/gi, "")
    .replace(/\(filing fee [^)]+\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickLeadDocuments(result) {
  const docs = Array.isArray(result.recap_documents) ? result.recap_documents : [];
  const complaintDoc =
    docs.find((doc) => /complaint|petition/i.test(`${doc.short_description || ""} ${doc.description || ""}`)) || null;
  const motionOrOrderDoc =
    [...docs]
      .reverse()
      .find((doc) => /motion|order|opinion|judgment|injunction|transfer/i.test(`${doc.short_description || ""} ${doc.description || ""}`)) ||
    null;

  return { complaintDoc, motionOrOrderDoc };
}

function inferMatterTopic(result, leadComplaintText) {
  const lower = `${result.suitNature || ""} ${result.cause || ""} ${leadComplaintText || ""}`.toLowerCase();

  if (/fraud/.test(lower)) return "fraud-related claims";
  if (/election/.test(lower)) return "election-market related claims";
  if (/consumer|class action/.test(lower)) return "consumer or class-action claims";
  if (/statutory/.test(lower)) return "statutory claims";
  if (/contract/.test(lower)) return "contract claims";

  return result.suitNature ? `${result.suitNature.toLowerCase()} claims` : "claims tied to Kalshi's operations";
}

function buildCaseOverview(result, structured) {
  const { complaintDoc, motionOrOrderDoc } = pickLeadDocuments(result);
  const complaintText = cleanDocumentDescription(complaintDoc?.description || complaintDoc?.short_description || "");
  const laterText = cleanDocumentDescription(motionOrOrderDoc?.description || motionOrOrderDoc?.short_description || "");
  const topic = inferMatterTopic(result, complaintText);
  const plaintiff = structured.plaintiff || "A plaintiff";
  const defendant = structured.defendant || "Kalshi";
  const court = structured.court || "court";
  const filedDate = structured.sourcePublishedAt ? new Date(structured.sourcePublishedAt).toLocaleDateString("en-US") : "";

  const lines = [];
  lines.push(`${plaintiff} sued ${defendant} in ${court}${filedDate ? ` on ${filedDate}` : ""}.`);

  if (complaintText) {
    lines.push(`The opening filing appears to be ${complaintText.toLowerCase()}.`);
  } else {
    lines.push(`The case is tagged in CourtListener as ${topic}.`);
  }

  if (laterText && laterText !== complaintText) {
    lines.push(`A later docket event says: ${laterText}.`);
  }

  if (result.jurisdictionType || result.cause || result.suitNature) {
    lines.push(
      [
        result.jurisdictionType ? `Jurisdiction: ${result.jurisdictionType}.` : "",
        result.cause ? `Cause: ${result.cause}.` : "",
        result.suitNature ? `Nature of suit: ${result.suitNature}.` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  return lines.join(" ").trim();
}

function inferLegalPosture(lower, title) {
  if (/preliminary injunction|temporary restraining order|tro/.test(lower)) return "injunction fight";
  if (/motion to dismiss|motion dismissed|dismissed with prejudice|dismissed without prejudice/.test(lower))
    return "motion to dismiss";
  if (/summary judgment/.test(lower)) return "summary judgment";
  if (/appeal|appellate/.test(lower)) return "appeal";
  if (/complaint|petition|lawsuit|filed/.test(lower)) return "complaint filed";
  if (/order|ruling|opinion|judgment/.test(lower)) return "court order or ruling";

  return title.toLowerCase().includes("v.") ? "active lawsuit" : "court docket";
}

function buildStructuredCourtFields(result, title, snippet) {
  const caseCaption = normalizeCaseCaption(result.caseName || result.caseNameShort || title);
  const sides = splitCaseSides(caseCaption);
  const court = extractCourtName(result);
  const sourcePublishedAt =
    result.date_filed || result.filed || result.dateFiled || result.date_filed_at || result.opinion_date || "";
  const lower = `${title} ${snippet} ${normalizeText(result.caseNameShort)} ${normalizeText(result.docketNumber)} ${court}`.toLowerCase();
  const legalPosture = inferLegalPosture(lower, title);
  const { complaintDoc, motionOrOrderDoc } = pickLeadDocuments(result);
  const leadDocumentDescription = cleanDocumentDescription(
    complaintDoc?.description || motionOrOrderDoc?.description || complaintDoc?.short_description || motionOrOrderDoc?.short_description || ""
  );

  const structured = {
    caseName: result.caseName || "",
    caseNameShort: result.caseNameShort || "",
    docketNumber: normalizeText(result.docketNumber || result.docket_number || ""),
    court,
    courtCitationString: extractCourtName(result),
    absoluteUrl: result.absolute_url || "",
    docketAbsoluteUrl: result.docket_absolute_url || "",
    sourceUrl: pickSourceUrl(result),
    plaintiff: sides?.plaintiff || "",
    defendant: sides?.defendant || "",
    sourcePublishedAt: sourcePublishedAt ? new Date(sourcePublishedAt).toISOString() : "",
    legalPosture,
    leadDocumentDescription,
    snippet,
  };

  structured.caseOverview = buildCaseOverview(result, structured);
  return structured;
}

function summarizeCourtListenerMatter({ title, snippet, type, severity, structured }) {
  const courtLabel = structured.court ? `${structured.court}` : "a court docket";
  const partyLabel = structured.plaintiff && structured.defendant ? `${structured.plaintiff} v. ${structured.defendant}` : title;
  const postureLabel = structured.legalPosture ? ` (${structured.legalPosture})` : "";
  const leadDoc = structured.leadDocumentDescription ? ` ${structured.leadDocumentDescription}.` : "";

  if (type === "legal_loss") {
    return `CourtListener surfaced ${partyLabel}${postureLabel} in ${courtLabel}, suggesting Kalshi took a procedural hit.${leadDoc} ${snippet}`;
  }

  if (severity === "major") {
    return `CourtListener surfaced ${partyLabel}${postureLabel} in ${courtLabel} with enough weight to merit immediate review.${leadDoc} ${snippet}`;
  }

  return `CourtListener surfaced ${partyLabel}${postureLabel} in ${courtLabel}.${leadDoc} ${snippet}`;
}

function whyItMattersForCourtListener({ type, severity }) {
  if (type === "legal_loss") {
    return "If this really is an adverse ruling, Kalshi is not just catching discourse smoke. It means a court may have weakened one of its positions in a way the public feed should track.";
  }

  if (severity === "major") {
    return "This looks like the kind of court matter that can move from niche docket drama into actual business or regulatory risk for Kalshi, so it deserves a fast human check.";
  }

  return "This is a real court-linked receipt, but the posture still needs a human read before you call it a full-on Kalshi L in public.";
}

export async function searchCourtListener({ query, limit = 10 }) {
  const token = process.env.COURTLISTENER_API_TOKEN;
  const url = new URL(`${DEFAULT_BASE_URL}/search/`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "r");
  url.searchParams.set("order_by", "score desc");
  url.searchParams.set("page_size", String(limit));
  url.searchParams.set("filed_after", new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10));

  const response = await fetch(url, {
    headers: token
      ? {
          Authorization: `Token ${token}`,
        }
      : {},
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CourtListener request failed with ${response.status}.`);
  }

  const payload = await response.json();
  return (payload.results || []).slice(0, limit);
}

function classifyKalshiMatter(lower) {
  if (!isLikelyKalshiMatter(lower)) {
    return { ok: false, reason: "No clear Kalshi/KalshiEx match in the result text." };
  }

  if (isLikelyNoise(lower)) {
    return { ok: false, reason: "Matched a known noisy docket pattern that has been filtered out." };
  }

  return { ok: true };
}

function detectEventType(lower) {
  if (/motion denied|preliminary injunction denied|appeal lost|summary judgment against|complaint dismissed in part|rejected/.test(lower)) {
    return "legal_loss";
  }

  return "lawsuit";
}

function detectSeverity(lower) {
  if (/supreme court|federal|appeal|injunction|election|cftc|enforcement|commission/.test(lower)) {
    return "major";
  }

  if (/district court|complaint|motion|contract/.test(lower)) {
    return "notable";
  }

  return "minor";
}

function isLikelyKalshiMatter(lower) {
  return REQUIRED_MATCHES.some((term) => lower.includes(term));
}

function isLikelyNoise(lower) {
  return /mark furcolo|smith v\. kalshi|james v\. kalshi|qcx llc/.test(lower);
}

function pickSourceUrl(result) {
  if (result.absolute_url) {
    return `https://www.courtlistener.com${result.absolute_url}`;
  }

  if (result.docket_absolute_url) {
    return `https://www.courtlistener.com${result.docket_absolute_url}`;
  }

  return result.download_url || "";
}

export function mapCourtListenerResult(result) {
  const title = result.caseName || result.caseNameShort || result.docketNumber || "CourtListener result";
  const sourceUrl = pickSourceUrl(result);
  const snippet = summarizeSnippet(result.snippet || result.text || result.caseName);
  const structured = buildStructuredCourtFields(result, title, snippet);
  const lower = `${title} ${snippet} ${normalizeText(result.caseNameShort)} ${normalizeText(result.docketNumber)} ${normalizeText(result.court)}`.toLowerCase();

  const classification = classifyKalshiMatter(lower);

  if (!classification.ok) {
    return null;
  }

  const type = detectEventType(lower);
  const severity = detectSeverity(lower);

  return {
    title,
    type,
    severity,
    status: "review",
    sourceType: "court",
    sourceUrl,
    sourceDetails: {
      ...structured,
      sourceUrl,
    },
    plaintiff: structured.plaintiff,
    defendant: structured.defendant,
    court: structured.court,
    docketNumber: structured.docketNumber,
    sourcePublishedAt: structured.sourcePublishedAt,
    legalPosture: structured.legalPosture,
    detectedAt: new Date().toISOString(),
    summary: summarizeCourtListenerMatter({ title, snippet, type, severity, structured }),
    whyItMatters: whyItMattersForCourtListener({ type, severity }),
    fingerprint: buildFingerprint({
      title,
      type,
      sourceType: "court",
      sourceUrl,
    }),
  };
}

export function classifyCourtListenerResult(result) {
  const title = result.caseName || result.caseNameShort || result.docketNumber || "CourtListener result";
  const snippet = summarizeSnippet(result.snippet || result.text || result.caseName);
  const lower = `${title} ${snippet} ${normalizeText(result.caseNameShort)} ${normalizeText(result.docketNumber)} ${normalizeText(result.court)}`.toLowerCase();
  const classification = classifyKalshiMatter(lower);

  if (!classification.ok) {
    return {
      title,
      outcome: "filtered",
      reason: classification.reason,
      candidate: null,
    };
  }

  const candidate = mapCourtListenerResult(result);

  return {
    title,
    outcome: "candidate",
    reason: "Matched Kalshi matter heuristics and passed the noise filter.",
    candidate,
  };
}
