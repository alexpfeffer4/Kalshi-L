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

function describeCourtRole(result) {
  const court = normalizeText(result.court_citation_string || result.court || "");
  if (!court) return "a court docket";
  return `${court} docket`;
}

function summarizeCourtListenerMatter({ title, snippet, type, severity, result }) {
  const docketLabel = describeCourtRole(result);

  if (type === "legal_loss") {
    return `CourtListener surfaced ${docketLabel} suggesting Kalshi took a procedural hit. ${snippet}`;
  }

  if (severity === "major") {
    return `CourtListener surfaced ${docketLabel} involving Kalshi with enough weight to merit immediate review. ${snippet}`;
  }

  return `CourtListener surfaced ${docketLabel} tied to ${title}. ${snippet}`;
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
    detectedAt: new Date().toISOString(),
    summary: summarizeCourtListenerMatter({ title, snippet, type, severity, result }),
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
