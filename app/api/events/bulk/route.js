import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { getEvent, recordEventAuditLog, updateEvent } from "@/lib/store";

function mergeTags(currentTags, addedTags) {
  return [...new Set([...(currentTags || []), ...(addedTags || [])].filter(Boolean))];
}

function buildBulkPatch(event, action) {
  if (action === "approve") {
    return {
      status: "confirmed",
      tags: mergeTags(event.tags, ["publishable"]),
    };
  }

  if (action === "duplicate") {
    return {
      status: "rejected",
      tags: mergeTags(event.tags, ["duplicate"]),
      internalNotes: [event.internalNotes, "Bulk moderation: marked duplicate."].filter(Boolean).join("\n"),
    };
  }

  if (action === "noise") {
    return {
      status: "rejected",
      tags: mergeTags(event.tags, ["noise"]),
      internalNotes: [event.internalNotes, "Bulk moderation: rejected as noise."].filter(Boolean).join("\n"),
    };
  }

  if (action === "developing") {
    return {
      status: "developing",
    };
  }

  return null;
}

export async function POST(request) {
  await requireAdminAuth();
  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const action = body.action || "";

  if (!ids.length || !action) {
    return NextResponse.json({ error: "Missing ids or action." }, { status: 400 });
  }

  const updated = [];

  for (const id of ids) {
    const current = await getEvent(id);
    if (!current) continue;

    const patch = buildBulkPatch(current, action);
    if (!patch) continue;

    const next = await updateEvent(id, patch);
    if (!next) continue;

    await recordEventAuditLog({
      eventId: id,
      action,
      actor: "admin",
      fromStatus: current.status,
      toStatus: next.status,
      details: {
        title: current.title,
        tagsBefore: current.tags || [],
        tagsAfter: next.tags || [],
      },
    });

    updated.push(next.id);
  }

  return NextResponse.json({ ok: true, updatedCount: updated.length, updated });
}
