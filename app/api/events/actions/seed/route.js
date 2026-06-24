import { NextResponse } from "next/server";
import { seedCandidate } from "@/lib/store";

export async function POST() {
  return NextResponse.json({ event: await seedCandidate() });
}
