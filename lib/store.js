import { promises as fs } from "node:fs";
import path from "node:path";
import { hasSupabaseConfig } from "./db";
import { buildEventRecord } from "./store.shared";
import {
  addCandidateLocal,
  findByFingerprintLocal,
  getEventLocal,
  listIngestionRunsLocal,
  listEventsLocal,
  recordIngestionRunLocal,
  resetEventsLocal,
  updateEventLocal,
} from "./store.local";
import {
  addCandidateSupabase,
  findByFingerprintSupabase,
  getEventSupabase,
  listIngestionRunsSupabase,
  listEventsSupabase,
  recordIngestionRunSupabase,
  resetEventsSupabase,
  updateEventSupabase,
} from "./store.supabase";

const seedPath = path.join(process.cwd(), "data", "events.seed.json");

async function readSeedEvents() {
  const raw = await fs.readFile(seedPath, "utf8");
  return JSON.parse(raw).map((event) =>
    buildEventRecord({
      ...event,
      id: event.id,
      publishedAt: event.publishedAt,
      detectedAt: event.detectedAt,
      score: event.score,
      confidence: event.confidence,
    })
  );
}

function useSupabase() {
  return hasSupabaseConfig();
}

export async function listEvents() {
  return useSupabase() ? listEventsSupabase() : listEventsLocal();
}

export async function getEvent(id) {
  return useSupabase() ? getEventSupabase(id) : getEventLocal(id);
}

export async function addCandidate(input) {
  return useSupabase() ? addCandidateSupabase(input) : addCandidateLocal(input);
}

export async function updateEvent(id, patch) {
  return useSupabase() ? updateEventSupabase(id, patch) : updateEventLocal(id, patch);
}

export async function resetEvents() {
  if (useSupabase()) {
    return resetEventsSupabase(await readSeedEvents());
  }
  return resetEventsLocal();
}

export async function findByFingerprint(fingerprint) {
  return useSupabase() ? findByFingerprintSupabase(fingerprint) : findByFingerprintLocal(fingerprint);
}

export async function recordIngestionRun(run) {
  return useSupabase() ? recordIngestionRunSupabase(run) : recordIngestionRunLocal(run);
}

export async function listIngestionRuns() {
  return useSupabase() ? listIngestionRunsSupabase() : listIngestionRunsLocal();
}

export async function seedCandidate() {
  return addCandidate({
    title: "Fresh headline accuses Kalshi of regulatory brinkmanship",
    type: "bad_press",
    severity: "notable",
    sourceType: "news",
    sourceUrl: "",
    summary:
      "A new article frames Kalshi as pushing past regulatory norms. Review whether the reporting adds real facts or just repeats prior criticism.",
    whyItMatters:
      "This is a reasonable queue candidate because it is news-based and reputational, but it still needs editorial judgment before public placement.",
  });
}
