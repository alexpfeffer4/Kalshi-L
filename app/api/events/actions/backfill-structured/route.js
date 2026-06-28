import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { inferStructuredFieldsFromEvent } from "@/lib/store.shared";
import { listEvents, updateEvent } from "@/lib/store";

export async function POST() {
  await requireAdminAuth();

  const events = await listEvents();
  let updated = 0;

  for (const event of events) {
    const structured = inferStructuredFieldsFromEvent(event);
    const patch = {
      plaintiff: structured.plaintiff,
      defendant: structured.defendant,
      court: structured.court,
      agency: structured.agency,
      docketNumber: structured.docketNumber,
      sourcePublishedAt: structured.sourcePublishedAt,
      legalPosture: structured.legalPosture,
      sourceDetails: {
        ...(event.sourceDetails || {}),
        ...structured,
      },
    };

    const needsUpdate =
      !event.plaintiff ||
      !event.defendant ||
      !event.court ||
      !event.agency ||
      !event.docketNumber ||
      !event.sourcePublishedAt ||
      !event.legalPosture ||
      JSON.stringify(event.sourceDetails || {}) !== JSON.stringify(patch.sourceDetails);

    if (needsUpdate) {
      await updateEvent(event.id, patch);
      updated += 1;
    }
  }

  return NextResponse.json({ ok: true, updated });
}
