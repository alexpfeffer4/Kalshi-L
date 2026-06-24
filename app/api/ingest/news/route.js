import { NextResponse } from "next/server";
import { runNewsIngest } from "@/lib/ingest-runners";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const query = body.query || process.env.NEWS_RSS_QUERY || "Kalshi";

  try {
    return NextResponse.json(await runNewsIngest({ query, limit: body.limit || 10, results: body.results }));
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
