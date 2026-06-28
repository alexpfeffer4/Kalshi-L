import { buildFingerprint } from "./store.shared";

const DEFAULT_NEWS_RSS_URL = process.env.NEWS_RSS_BASE_URL || "https://news.google.com/rss/search";

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

function looksLikeNoise(lower) {
  return /podcast|sports odds|stock price|crypto price|horoscope/.test(lower);
}

function detectNewsType(lower) {
  if (/cftc|commission|regulator|regulatory|investigation|probe|enforcement/.test(lower)) {
    return "regulatory";
  }

  if (/backlash|outrage|controversy|ad campaign|ad copy|mocked|dragged/.test(lower)) {
    return "pr_incident";
  }

  return "bad_press";
}

function detectNewsSeverity(lower) {
  if (/cftc|enforcement|investigation|lawsuit|ban|illegal|election|federal/.test(lower)) {
    return "major";
  }

  if (/criticized|reckless|controversy|regulatory|under fire|backlash/.test(lower)) {
    return "notable";
  }

  return "minor";
}

function newsSummary(title, description) {
  return `${title}. ${description}`.trim();
}

function newsWhyItMatters(type, severity) {
  if (type === "regulatory") {
    return "If the reporting is solid, this can push Kalshi out of niche market chatter and into genuine oversight trouble, which is a much bigger deal than one ugly headline.";
  }

  if (severity === "major") {
    return "This is the kind of press cycle that can harden the public story around Kalshi in a way that affects trust, counterparties, and regulatory attention all at once.";
  }

  return "This is bad-press lane material, so it deserves a human pass to separate fresh receipts from recycled discourse before it gets pushed as a real hit.";
}

export async function searchNewsRss({ query, limit = 10 }) {
  const url = new URL(DEFAULT_NEWS_RSS_URL);
  url.searchParams.set("q", `${query} when:30d`);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`News RSS request failed with ${response.status}.`);
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

export function classifyNewsResult(result) {
  const title = decodeHtml(result.title);
  const description = decodeHtml(result.description);
  const lower = `${title} ${description}`.toLowerCase();

  if (!lower.includes("kalshi")) {
    return {
      title,
      outcome: "filtered",
      reason: "No clear Kalshi match in the headline or summary.",
      candidate: null,
    };
  }

  if (looksLikeNoise(lower)) {
    return {
      title,
      outcome: "filtered",
      reason: "Matched a low-signal news pattern that is likely not meaningful bad press.",
      candidate: null,
    };
  }

  const type = detectNewsType(lower);
  const severity = detectNewsSeverity(lower);
  const summary = newsSummary(title, description);

  return {
    title,
    outcome: "candidate",
    reason: "Matched Kalshi-specific news heuristics and cleared the low-signal filter.",
    candidate: {
      title,
      type,
      severity,
      status: "review",
      sourceType: "news",
      sourceUrl: result.link || "",
      sourceDetails: {
        outlet: result.source || "",
        headline: title,
        publishedAt: result.pubDate ? new Date(result.pubDate).toISOString() : "",
        sourceUrl: result.link || "",
        description,
      },
      detectedAt: new Date().toISOString(),
      publishedAt: result.pubDate ? new Date(result.pubDate).toISOString() : "",
      summary,
      whyItMatters: newsWhyItMatters(type, severity),
      fingerprint: buildFingerprint({
        title,
        type,
        sourceType: "news",
        sourceUrl: result.link || "",
      }),
    },
  };
}
