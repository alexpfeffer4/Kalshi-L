import { buildFingerprint } from "./store.shared";
import { asSlangBlurb, prefixWhyItMatters } from "./copy-rules";

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
  const lower = `${title} ${description}`.toLowerCase();

  if (/investigation|probe|enforcement|regulator|cftc|sec/.test(lower)) {
    return asSlangBlurb(`${title}. Kalshi is catching official-looking smoke, not just bad vibes.`);
  }

  if (/backlash|controversy|dragged|mocked|criticized|reckless/.test(lower)) {
    return asSlangBlurb(`${title}. Kalshi is getting flamed in public and the optics are not beating the allegations.`);
  }

  return asSlangBlurb(`${title}. The headline cycle is not exactly saying "all good over there."`);
}

function newsWhyItMatters(type, severity) {
  if (type === "regulatory") {
    return prefixWhyItMatters(
      "if the reporting is real, Kalshi is no longer just getting dunked on in articles. It means actual oversight people may be in the mix."
    );
  }

  if (severity === "major") {
    return prefixWhyItMatters(
      "this is not harmless press slop. A story like this can harden the public narrative that Kalshi is sketchy, reckless, or one headline away from more heat."
    );
  }

  return prefixWhyItMatters(
    "this is enough bad-press smoke to watch closely, but somebody still needs to check whether it is fresh receipts or reheated discourse."
  );
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
      sourcePublishedAt: result.pubDate ? new Date(result.pubDate).toISOString() : "",
      sourceDetails: {
        outlet: result.source || "",
        headline: title,
        sourcePublishedAt: result.pubDate ? new Date(result.pubDate).toISOString() : "",
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
