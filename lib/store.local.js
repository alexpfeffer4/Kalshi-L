import { promises as fs } from "node:fs";
import path from "node:path";
import { buildEventRecord, normalizeUpdatedEvent, sortEvents } from "./store.shared";

const dataDir = path.join(process.cwd(), "data");
const eventsPath = path.join(dataDir, "events.json");
const seedPath = path.join(dataDir, "events.seed.json");
const runsPath = path.join(dataDir, "ingestion-runs.json");

async function ensureFile(targetPath, fallback = "[]") {
  try {
    await fs.access(targetPath);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(targetPath, fallback);
  }
}

async function ensureDataFiles() {
  try {
    await fs.access(eventsPath);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    const seed = await fs.readFile(seedPath, "utf8");
    await fs.writeFile(eventsPath, seed);
  }

  await ensureFile(runsPath);
}

async function readJson(targetPath) {
  await ensureDataFiles();
  const raw = await fs.readFile(targetPath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(targetPath, data) {
  await fs.writeFile(targetPath, JSON.stringify(data, null, 2));
}

export async function listEventsLocal() {
  return sortEvents(await readJson(eventsPath));
}

export async function getEventLocal(id) {
  return (await readJson(eventsPath)).find((event) => event.id === id) || null;
}

export async function addCandidateLocal(input) {
  const events = await readJson(eventsPath);
  const event = buildEventRecord(input);
  events.unshift(event);
  await writeJson(eventsPath, events);
  return event;
}

export async function updateEventLocal(id, patch) {
  const events = await readJson(eventsPath);
  const nextEvents = events.map((event) => (event.id === id ? normalizeUpdatedEvent(event, patch) : event));
  await writeJson(eventsPath, nextEvents);
  return nextEvents.find((event) => event.id === id) || null;
}

export async function resetEventsLocal() {
  const seed = await fs.readFile(seedPath, "utf8");
  await fs.writeFile(eventsPath, seed);
  return listEventsLocal();
}

export async function findByFingerprintLocal(fingerprint) {
  return (await readJson(eventsPath)).find((event) => event.fingerprint === fingerprint) || null;
}

export async function recordIngestionRunLocal(run) {
  const runs = await readJson(runsPath);
  runs.unshift({
    id: Date.now(),
    ...run,
    duplicatesCount: run.duplicatesCount || 0,
    filteredCount: run.filteredCount || 0,
    details: run.details || [],
    startedAt: run.startedAt || new Date().toISOString(),
    finishedAt: run.finishedAt || new Date().toISOString(),
  });
  await writeJson(runsPath, runs);
}

export async function listIngestionRunsLocal() {
  const runs = await readJson(runsPath);
  return runs.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}
