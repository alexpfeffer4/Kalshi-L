import { buildFingerprint } from "./store.shared";

const DEFAULT_REGULATOR_RSS_URL = process.env.REGULATOR_RSS_BASE_URL || "https://news.google.com/rss/search";
const DEFAULT_REGULATOR_DOMAINS = ["cftc.gov", "sec.gov", "ftc.gov", "justice.gov"];

function decodeHtml(value) {
  return (value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return decodeHtml(match?.[1] || "");
}

function extractItems(xml) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
}

function regulatorSummary(title, description, source) {
  return [title, description, source ? `Source lane: ${source}.` : ""].filter(Boolean).join(" ").trim();
}

function regulatorWhyItMatters(lower) {
  if (/investigation|probe|enforcement|charges|sues|order|settlement/.test(lower)) {
    return "This is official regulator-lane heat, not just media framing. If the underlying record is real, it can change how much legal and compliance pressure Kalshi is actually under.";
  }

  return "This is official regulator or government-adjacent sourcing, which makes it materially stronger than ordinary commentary and worth a fast human review.";
}

function domainFilterQuery() {
  return DEFAULT_REGULATOR_DOMAINS.map((domain) => `site:${domain}`).join(" OR ");
}

function detectSeverity(lower) {
  if (/investigation|probe|enforcement|lawsuit|charges|subpoena|ban|cease-and-desist|order/.test(lower)) {
    return "major";
  }

  if (/commission|agency|oversight|review|regulatory/.test(lower)) {
    return "notable";
  }

  return "minor";
}

function pickUrl(link) {
  return decodeHtml(link || "");
}

export async function searchRegulatorRss({ query, limit = 10 }) {
  const url = new URL(DEFAULT_REGULATOR_RSS_URL);
  url.searchParams.set("q", `${query} (${domainFilterQuery()}) when:60d`);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Regulator RSS request failed with ${response.status}.`);
  }

  const xml = await response.text();
  return extractItems(xml).slice(0, limit).map((item) => ({
    title: extractTag(item, "title"),
    link: extractTag(item, "link"),
    pubDate: extractTag(item, "pubDate"),
    description: extractTag(item, "description"),
    source: extractTag(item, "source"),
  }));
}

export function classifyRegulatorResult(result) {
  const title = decodeHtml(result.title);
  const description = decodeHtml(result.description);
  const source = decodeHtml(result.source);
  const lower = `${title} ${description} ${source}`.toLowerCase();

  if (!/kalshi|kalshiex/.test(lower)) {
    return {
      title,
      outcome: "filtered",
      reason: "No clear Kalshi match in the regulator source text.",
      candidate: null,
    };
  }

  if (!/cftc|sec|ftc|justice|commission|regulator|agency/.test(lower)) {
    return {
      title,
      outcome: "filtered",
      reason: "Matched Kalshi but did not look like a regulator or government source.",
      candidate: null,
    };
  }

  const severity = detectSeverity(lower);
  const summary = regulatorSummary(title, description, source);
  const sourceUrl = pickUrl(result.link);

  return {
    title,
    outcome: "candidate",
    reason: "Matched Kalshi-specific regulator-source heuristics.",
    candidate: {
      title,
      type: "regulatory",
      severity,
      status: "review",
      sourceType: "regulator",
      sourceUrl,
      detectedAt: new Date().toISOString(),
      publishedAt: result.pubDate ? new Date(result.pubDate).toISOString() : "",
      summary,
      whyItMatters: regulatorWhyItMatters(lower),
      fingerprint: buildFingerprint({
        title,
        type: "regulatory",
        sourceType: "regulator",
        sourceUrl,
      }),
    },
  };
}
