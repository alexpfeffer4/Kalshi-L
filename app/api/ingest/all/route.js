import { NextResponse } from "next/server";
import { runCourtListenerIngest, runNewsIngest, runRegulatorIngest } from "@/lib/ingest-runners";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const courtQuery = body.courtQuery || process.env.COURTLISTENER_QUERY || "Kalshi";
  const newsQuery = body.newsQuery || process.env.NEWS_RSS_QUERY || "Kalshi";
  const regulatorQuery = body.regulatorQuery || process.env.REGULATOR_RSS_QUERY || "Kalshi";

  const [courtResult, newsResult, regulatorResult] = await Promise.allSettled([
    runCourtListenerIngest({ query: courtQuery, limit: body.courtLimit || 10, results: body.courtResults }),
    runNewsIngest({ query: newsQuery, limit: body.newsLimit || 10, results: body.newsResults }),
    runRegulatorIngest({
      query: regulatorQuery,
      limit: body.regulatorLimit || 10,
      results: body.regulatorResults,
    }),
  ]);

  const response = {
    ok:
      courtResult.status === "fulfilled" ||
      newsResult.status === "fulfilled" ||
      regulatorResult.status === "fulfilled",
    court:
      courtResult.status === "fulfilled"
        ? courtResult.value
        : {
            ok: false,
            source: "courtlistener",
            error: courtResult.reason?.message || "Court ingest failed.",
          },
    news:
      newsResult.status === "fulfilled"
        ? newsResult.value
        : {
            ok: false,
            source: "news_rss",
            error: newsResult.reason?.message || "News ingest failed.",
          },
    regulator:
      regulatorResult.status === "fulfilled"
        ? regulatorResult.value
        : {
            ok: false,
            source: "regulator_rss",
            error: regulatorResult.reason?.message || "Regulator ingest failed.",
          },
  };

  return NextResponse.json(response, { status: response.ok ? 200 : 500 });
}
