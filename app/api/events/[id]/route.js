import { NextResponse } from "next/server";
import { getEvent, updateEvent } from "@/lib/store";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const existing = await getEvent(id);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const event = await updateEvent(id, body);

  return NextResponse.json({ event });
}
