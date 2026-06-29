import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { enrichCourtEventFromCourtListener } from "@/lib/courtlistener";
import { listEvents, recordEventAuditLog, updateEvent } from "@/lib/store";

export async function POST() {
  await requireAdminAuth();

  const events = await listEvents();
  const courtEvents = events.filter((event) => event.sourceType === "court");
  let updated = 0;
  let skipped = 0;
  const details = [];

  for (const event of courtEvents) {
    try {
      const patch = await enrichCourtEventFromCourtListener(event);

      if (!patch) {
        skipped += 1;
        details.push({
          id: event.id,
          title: event.title,
          outcome: "skipped",
          reason: "No confident CourtListener re-match found for this stored event.",
        });
        continue;
      }

      await updateEvent(event.id, patch);
      await recordEventAuditLog({
        eventId: event.id,
        action: "court_doc_enriched",
        actor: "admin",
        fromStatus: event.status,
        toStatus: event.status,
        details: {
          title: event.title,
          sourceUrl: patch.sourceUrl || "",
        },
      });

      updated += 1;
      details.push({
        id: event.id,
        title: event.title,
        outcome: "updated",
        reason: "CourtListener docket details pulled into the stored event.",
      });
    } catch (error) {
      skipped += 1;
      details.push({
        id: event.id,
        title: event.title,
        outcome: "error",
        reason: error.message,
      });
    }
  }

  return NextResponse.json({ ok: true, updated, skipped, details });
}
