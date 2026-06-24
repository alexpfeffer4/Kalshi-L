import { NextResponse } from "next/server";
import { runRegulatorIngest } from "@/lib/ingest-runners";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const query = body.query || process.env.REGULATOR_RSS_QUERY || "Kalshi";

  try {
    return NextResponse.json(await runRegulatorIngest({ query, limit: body.limit || 10, results: body.results }));
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
