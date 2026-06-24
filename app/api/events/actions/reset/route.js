import { NextResponse } from "next/server";
import { resetEvents } from "@/lib/store";

export async function POST() {
  return NextResponse.json({ events: await resetEvents() });
}
