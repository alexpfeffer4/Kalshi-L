import { buildFingerprint } from "./store.shared";
import { asPlainExplanation, asSlangBlurb, prefixWhyItMatters } from "./copy-rules";

const DEFAULT_BASE_URL = process.env.COURTLISTENER_BASE_URL || "https://www.courtlistener.com/api/rest/v4";
const REQUIRED_MATCHES = ["kalshi", "kalshiex"];

function normalizeText(value) {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedLookupKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[.,]/g, "")
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
    .replace(/\(Attachments:[^)]+\)/gi, "")
    .replace(/\([A-Z][A-Za-z.' -]+,\s*[A-Z][A-Za-z.' -]+\)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function collectCaseText(result) {
  const docs = Array.isArray(result.recap_documents) ? result.recap_documents : [];
  const docText = docs
    .map((doc) => `${doc.short_description || ""} ${doc.description || ""} ${doc.snippet || ""}`)
    .join(" ");

  return normalizeText(
    [
      result.caseName,
      result.caseNameShort,
      result.docketNumber,
      result.snippet,
      result.text,
      result.cause,
      result.suitNature,
      result.jurisdictionType,
      result.court,
      result.court_citation_string,
      docText,
    ].join(" ")
  );
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
  if (/commodit|futures|trading|market/.test(lower)) return "market or trading-related claims";
  if (/securit|investment/.test(lower)) return "investment-related claims";
  if (/statutory/.test(lower)) return "statutory claims";
  if (/contract/.test(lower)) return "contract claims";

  return result.suitNature ? `${result.suitNature.toLowerCase()} claims` : "claims tied to Kalshi's operations";
}

function plainTopicLabel(topic) {
  return topic
    .replace(/-related claims/gi, " issues")
    .replace(/claims tied to Kalshi's operations/gi, "how Kalshi operates")
    .replace(/claims/gi, "issues");
}

function explainLaterDocketAction(text) {
  const lower = (text || "").toLowerCase();
  if (!lower) return "";
  if (/transfer/.test(lower)) return "Later in the case, someone asked the judge to move the case to a different court.";
  if (/motion to dismiss|dismiss/.test(lower))
    return "Later in the case, one side asked the judge to throw out some or all of the lawsuit early.";
  if (/injunction|temporary restraining order|tro/.test(lower))
    return "Later in the case, someone asked the judge for fast emergency help before the full case ends.";
  if (/summary judgment/.test(lower))
    return "Later in the case, one side asked the judge to decide things without a full trial.";
  if (/order|opinion|judgment/.test(lower))
    return "Later in the case, the judge appears to have issued a meaningful written decision.";
  if (/motion/.test(lower)) return "Later in the case, someone filed an important request with the judge.";
  return "";
}

function summarizeLeadFiling(result, structured, complaintDoc, motionOrOrderDoc) {
  const plaintiff = structured.plaintiff || "A party";
  const defendant = structured.defendant || "the defendant";
  const complaintText = cleanDocumentDescription(complaintDoc?.short_description || complaintDoc?.description || "");
  const motionShort = cleanDocumentDescription(motionOrOrderDoc?.short_description || "");
  const motionText = cleanDocumentDescription(motionOrOrderDoc?.description || "");
  const kalshiAsPlaintiff = /kalshi/.test((structured.plaintiff || "").toLowerCase());

  if (complaintText) {
    return `${plaintiff} opened the case by filing ${complaintText.toLowerCase()}.`;
  }

  if (/preliminary injunction/i.test(motionShort) && /temporary restraining order/i.test(motionShort)) {
    return `${plaintiff} sued ${defendant} and quickly asked the judge for emergency relief and a temporary court order while the case plays out.`;
  }

  if (/preliminary injunction/i.test(motionShort)) {
    return `${plaintiff} sued ${defendant} and asked the judge to temporarily block something while the case is pending.`;
  }

  if (/temporary restraining order|tro/i.test(motionShort)) {
    return `${plaintiff} sued ${defendant} and asked the judge for an emergency short-term order right away.`;
  }

  if (/motion to dismiss/i.test(motionShort) || /motion to dismiss/i.test(motionText)) {
    return `${plaintiff} sued ${defendant}, and one side is already trying to get the case thrown out early.`;
  }

  if (motionShort) {
    return `${plaintiff} sued ${defendant}, and an early filing in the case is ${motionShort.toLowerCase()}.`;
  }

  if (kalshiAsPlaintiff) {
    return `${plaintiff} is the one who brought this case against ${defendant}.`;
  }

  return `${plaintiff} sued ${defendant}.`;
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
  lines.push(summarizeLeadFiling(result, structured, complaintDoc, motionOrOrderDoc));
  lines.push(`In plain English, the case appears to be about ${plainTopicLabel(topic)}.`);

  if (laterText && laterText !== complaintText) {
    lines.push(explainLaterDocketAction(laterText) || `A later court entry mentions: ${laterText}.`);
  }

  if (result.jurisdictionType || result.cause || result.suitNature) {
    lines.push(
      [
        result.suitNature ? `CourtListener tags it as ${result.suitNature}.` : "",
        result.cause ? `The listed legal claim is ${result.cause}.` : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  return asPlainExplanation(lines.join(" ").trim());
}

function summarizeCaseTopic(result, complaintText) {
  const topic = plainTopicLabel(inferMatterTopic(result, complaintText));
  if (!topic) return "";
  return `The dispute appears to center on ${topic}.`;
}

function detectLegalLossSignal(text, structured) {
  const lower = (text || "").toLowerCase();
  const kalshiAsParty = /kalshi/.test(`${structured.plaintiff || ""} ${structured.defendant || ""}`.toLowerCase());
  if (!kalshiAsParty) {
    return { isLoss: false, confidence: "low", reason: "Kalshi was not clearly identified as a party in the caption." };
  }

  const strongPatterns = [
    /denied[^.]{0,80}kalshi/,
    /kalshi[^.]{0,80}denied/,
    /against kalshi/,
    /summary judgment[^.]{0,80}against kalshi/,
    /injunction denied[^.]{0,80}kalshi/,
    /motion denied[^.]{0,80}kalshi/,
    /kalshi[^.]{0,80}lost/,
    /dismiss(?:ed|al)[^.]{0,80}kalshi/,
  ];

  if (strongPatterns.some((pattern) => pattern.test(lower))) {
    return { isLoss: true, confidence: "high", reason: "The docket text directly links an adverse action to Kalshi." };
  }

  const weakPatterns = [
    /motion denied/,
    /preliminary injunction denied/,
    /appeal lost/,
    /summary judgment against/,
    /rejected/,
    /adverse ruling/,
  ];

  if (weakPatterns.some((pattern) => pattern.test(lower))) {
    return { isLoss: false, confidence: "medium", reason: "The wording sounds adverse, but it is not specific enough to call it a Kalshi loss automatically." };
  }

  return { isLoss: false, confidence: "low", reason: "No strong adverse signal tied specifically to Kalshi was found." };
}

function classifyCourtCase(result, structured, text) {
  const lower = (text || "").toLowerCase();
  const lossSignal = detectLegalLossSignal(lower, structured);
  const type = lossSignal.isLoss ? "legal_loss" : "lawsuit";

  let severity = "minor";
  if (/supreme court|appeal|appellate|injunction|election|cftc|commission|federal|state attorney general|attorney general/.test(lower)) {
    severity = "major";
  } else if (/district court|class action|complaint|motion|contract|fraud|consumer/.test(lower)) {
    severity = "notable";
  }

  return { type, severity, lossSignal };
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
  const laterDocumentDescription = cleanDocumentDescription(
    motionOrOrderDoc?.description || motionOrOrderDoc?.short_description || ""
  );
  const caseTopic = summarizeCaseTopic(result, leadDocumentDescription);
  const leadActionSummary = summarizeLeadFiling(
    result,
    {
      plaintiff: sides?.plaintiff || "",
      defendant: sides?.defendant || "",
      court,
      sourcePublishedAt: sourcePublishedAt ? new Date(sourcePublishedAt).toISOString() : "",
    },
    complaintDoc,
    motionOrOrderDoc
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
    laterDocumentDescription,
    caseTopic,
    leadActionSummary,
    snippet,
  };

  structured.caseOverview = buildCaseOverview(result, structured);
  return structured;
}

function summarizeCourtListenerMatter({ title, snippet, type, severity, structured }) {
  const partyLabel = structured.plaintiff && structured.defendant ? `${structured.plaintiff} v. ${structured.defendant}` : title;
  const courtLabel = structured.court ? `${structured.court}` : "court";

  if (type === "legal_loss") {
    return asSlangBlurb(
      `${partyLabel} just put Kalshi in courtroom stress mode in ${courtLabel}. This one reads like an actual legal L, not just timeline yapping.`
    );
  }

  if (severity === "major") {
    return asSlangBlurb(
      `${partyLabel} is real court smoke for Kalshi in ${courtLabel}. This is the kind of court drama that can turn into a serious mess fast.`
    );
  }

  return asSlangBlurb(
    `${partyLabel} has Kalshi doing paperwork instead of posting through it in ${courtLabel}. Real lawsuit energy, not fake internet outrage.`
  );
}

function whyItMattersForCourtListener({ type, severity }) {
  if (type === "legal_loss") {
    return prefixWhyItMatters(
      "if the judge actually clipped Kalshi here, that is not vibes-based slander. That is real legal damage that can make the next round worse."
    );
  }

  if (severity === "major") {
    return prefixWhyItMatters(
      "this is the kind of lawsuit that can escape niche law-nerd land and become real business pain, regulator heat, or trust erosion."
    );
  }

  return prefixWhyItMatters(
    "even if this is not instant doom, it is still a legit court receipt. If more bad filings stack up, the whole thing starts looking cooked."
  );
}

export async function searchCourtListener({ query, limit = 10, filedAfterDays = 30 }) {
  const token = process.env.COURTLISTENER_API_TOKEN;
  const url = new URL(`${DEFAULT_BASE_URL}/search/`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "r");
  url.searchParams.set("order_by", "score desc");
  url.searchParams.set("page_size", String(limit));
  if (filedAfterDays > 0) {
    url.searchParams.set("filed_after", new Date(Date.now() - 1000 * 60 * 60 * 24 * filedAfterDays).toISOString().slice(0, 10));
  }

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

function scoreCourtMatch(event, result) {
  const eventTitle = normalizedLookupKey(event.title);
  const resultTitle = normalizedLookupKey(result.caseName || result.caseNameShort || result.docketNumber || "");
  const eventDocket = normalizedLookupKey(event.docketNumber || event.sourceDetails?.docketNumber || "");
  const resultDocket = normalizedLookupKey(result.docketNumber || result.docket_number || "");
  const eventCourt = normalizedLookupKey(event.court || event.sourceDetails?.court || event.sourceDetails?.courtCitationString || "");
  const resultCourt = normalizedLookupKey(extractCourtName(result));

  let score = 0;
  if (eventDocket && resultDocket && eventDocket === resultDocket) score += 10;
  if (eventTitle && resultTitle && eventTitle === resultTitle) score += 8;
  if (eventTitle && resultTitle && (resultTitle.includes(eventTitle) || eventTitle.includes(resultTitle))) score += 5;
  if (eventCourt && resultCourt && eventCourt === resultCourt) score += 3;

  const combined = normalizedLookupKey(
    `${result.caseName || ""} ${result.caseNameShort || ""} ${result.snippet || ""} ${result.text || ""}`
  );
  if (combined.includes("kalshi")) score += 2;

  return score;
}

function pickBestCourtMatch(event, results) {
  return [...results]
    .map((result) => ({ result, score: scoreCourtMatch(event, result) }))
    .sort((a, b) => b.score - a.score)[0];
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
  const fullText = collectCaseText(result);
  const lower = fullText.toLowerCase();

  const classification = classifyKalshiMatter(lower);

  if (!classification.ok) {
    return null;
  }

  const { type, severity, lossSignal } = classifyCourtCase(result, structured, fullText);

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
      extractionConfidence: lossSignal.confidence,
      extractionReason: lossSignal.reason,
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
  const lower = collectCaseText(result).toLowerCase();
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

export async function previewCourtEventEnrichment(event) {
  if (!event || event.sourceType !== "court") return null;

  const queries = [
    event.docketNumber,
    event.sourceDetails?.docketNumber,
    event.title,
    `${event.title} Kalshi`,
  ].filter(Boolean);

  let bestMatch = null;
  const attempts = [];

  for (const query of queries) {
    const results = await searchCourtListener({ query, limit: 5, filedAfterDays: 3650 });
    const ranked = pickBestCourtMatch(event, results);
    attempts.push({
      query,
      resultsSeen: results.length,
      bestScore: ranked?.score || 0,
      bestTitle: ranked?.result?.caseName || ranked?.result?.caseNameShort || ranked?.result?.docketNumber || "",
    });
    if (ranked?.result && (!bestMatch || ranked.score > bestMatch.score)) {
      bestMatch = ranked;
    }
    if (bestMatch?.score >= 8) break;
  }

  if (!bestMatch?.result || bestMatch.score < 5) {
    return {
      preview: null,
      confidence: "none",
      reason:
        attempts.length
          ? `No confident CourtListener re-match was found. Best score was ${bestMatch?.score || 0}.`
          : "No usable lookup query was available for this court row.",
      attempts,
    };
  }

  const mapped = mapCourtListenerResult(bestMatch.result);
  if (!mapped) {
    return {
      preview: null,
      confidence: "none",
      reason: "A possible case match was found, but it did not pass the Kalshi-specific classifier.",
      attempts,
    };
  }

  return {
    preview: {
      title: mapped.title || event.title,
      summary: mapped.summary,
      whyItMatters: mapped.whyItMatters,
      sourceUrl: mapped.sourceUrl || event.sourceUrl,
      plaintiff: mapped.plaintiff,
      defendant: mapped.defendant,
      court: mapped.court,
      docketNumber: mapped.docketNumber,
      sourcePublishedAt: mapped.sourcePublishedAt,
      legalPosture: mapped.legalPosture,
      sourceDetails: {
        ...(event.sourceDetails || {}),
        ...(mapped.sourceDetails || {}),
        enrichedFromCourtListenerAt: new Date().toISOString(),
        enrichmentQuery: queries[0] || event.title,
        bestRematchScore: bestMatch.score,
        rematchAttempts: attempts,
      },
    },
    confidence: mapped.sourceDetails?.extractionConfidence || "unknown",
    reason: mapped.sourceDetails?.extractionReason || `Re-matched with score ${bestMatch.score}.`,
    attempts,
  };
}

export async function enrichCourtEventFromCourtListener(event) {
  const result = await previewCourtEventEnrichment(event);
  return result?.preview || null;
}
