import { NextResponse } from "next/server";
import { listIngestionRuns } from "@/lib/store";

export async function GET() {
  try {
    return NextResponse.json({ runs: await listIngestionRuns() });
  } catch (error) {
    return NextResponse.json({ runs: [], error: error?.message || "Could not load ingestion runs." }, { status: 200 });
  }
}
