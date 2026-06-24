import { NextResponse } from "next/server";
import { addCandidate, listEvents } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ events: await listEvents() });
}

export async function POST(request) {
  const body = await request.json();
  const event = await addCandidate(body);
  return NextResponse.json({ event }, { status: 201 });
}
