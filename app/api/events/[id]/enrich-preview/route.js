import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { enrichCourtEventFromCourtListener } from "@/lib/courtlistener";
import { getEvent, recordEventAuditLog, updateEvent } from "@/lib/store";

function buildDiff(current, patch) {
  const keys = [
    "title",
    "summary",
    "whyItMatters",
    "sourceUrl",
    "plaintiff",
    "defendant",
    "court",
    "docketNumber",
    "sourcePublishedAt",
    "legalPosture",
  ];

  return keys
    .map((key) => ({
      key,
      before: current?.[key] || "",
      after: patch?.[key] || "",
    }))
    .filter((row) => row.before !== row.after);
}

export async function GET(_request, context) {
  await requireAdminAuth();

  const { id } = await context.params;
  const event = await getEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (event.sourceType !== "court") {
    return NextResponse.json({ ok: true, event, preview: null, diff: [], reason: "Only court events support this preview." });
  }

  const preview = await enrichCourtEventFromCourtListener(event);
  const diff = preview ? buildDiff(event, preview) : [];

  return NextResponse.json({
    ok: true,
    event,
    preview,
    diff,
    confidence: preview?.sourceDetails?.extractionConfidence || "",
    reason: preview?.sourceDetails?.extractionReason || "",
  });
}

export async function POST(_request, context) {
  await requireAdminAuth();

  const { id } = await context.params;
  const event = await getEvent(id);
  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (event.sourceType !== "court") {
    return NextResponse.json({ error: "Only court events support enrichment." }, { status: 400 });
  }

  const preview = await enrichCourtEventFromCourtListener(event);
  if (!preview) {
    return NextResponse.json({ ok: false, error: "No confident CourtListener match was found." }, { status: 422 });
  }

  const updated = await updateEvent(id, preview);
  await recordEventAuditLog({
    eventId: id,
    action: "court_doc_enriched",
    actor: "admin",
    fromStatus: event.status,
    toStatus: event.status,
    details: {
      confidence: preview?.sourceDetails?.extractionConfidence || "",
      reason: preview?.sourceDetails?.extractionReason || "",
      sourceUrl: preview.sourceUrl || "",
    },
  });

  return NextResponse.json({
    ok: true,
    event: updated,
    confidence: preview?.sourceDetails?.extractionConfidence || "",
    reason: preview?.sourceDetails?.extractionReason || "",
  });
}
