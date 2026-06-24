import { NextResponse } from "next/server";
import { listIngestionRuns } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ runs: await listIngestionRuns() });
}
