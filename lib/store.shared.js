import crypto from "node:crypto";
import { confidenceFor, computeScore, sortEvents, titleCase } from "./events";

export { sortEvents };

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];

  return [...new Set(tags.map((tag) => tag?.trim()).filter(Boolean))];
}

export function buildFingerprint(input) {
  return crypto
    .createHash("sha1")
    .update(
      [
        input.type,
        input.sourceType,
        input.title.trim().toLowerCase(),
        (input.sourceUrl || "").trim().toLowerCase(),
      ].join("|")
    )
    .digest("hex");
}

export function buildEventRecord(input) {
  const now = new Date().toISOString();
  const status = input.status || "review";
  return {
    id: input.id || `evt-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    title: input.title.trim(),
    type: input.type,
    severity: input.severity,
    status,
    tags: normalizeTags(input.tags),
    internalNotes: input.internalNotes?.trim() || "",
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl?.trim() || "",
    publishedAt: status === "confirmed" ? input.publishedAt || now : input.publishedAt || "",
    detectedAt: input.detectedAt || now,
    score: input.score ?? computeScore(input.type, input.severity, input.sourceType),
    confidence: input.confidence ?? confidenceFor(input.sourceType, status),
    summary: input.summary.trim(),
    whyItMatters:
      input.whyItMatters?.trim() ||
      `Detected from ${titleCase(input.sourceType)} sourcing and queued for review before public publication.`,
    fingerprint: input.fingerprint || buildFingerprint(input),
  };
}

export function normalizeUpdatedEvent(event, patch) {
  const next = { ...event, ...patch };
  next.tags = normalizeTags(next.tags);
  next.internalNotes = next.internalNotes?.trim() || "";
  next.confidence = confidenceFor(next.sourceType, next.status);
  if (next.status === "confirmed" && !next.publishedAt) {
    next.publishedAt = new Date().toISOString();
  }
  if (next.status !== "confirmed") {
    next.publishedAt = patch.publishedAt ?? "";
  }
  return next;
}
