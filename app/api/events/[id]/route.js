import { NextResponse } from "next/server";
import { getEvent, recordEventAuditLog, updateEvent } from "@/lib/store";
import { requireAdminAuth } from "@/lib/admin-auth";

export async function PATCH(request, { params }) {
  await requireAdminAuth();
  const { id } = await params;
  const existing = await getEvent(id);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const event = await updateEvent(id, body);

  if (event) {
    await recordEventAuditLog({
      eventId: id,
      action: body.status ? `status:${body.status}` : "edit",
      actor: "admin",
      fromStatus: existing.status,
      toStatus: event.status,
      details: {
        title: event.title,
        fields: Object.keys(body),
      },
    });
  }

  return NextResponse.json({ event });
}
