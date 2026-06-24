import { createSupabaseServerClient } from "./db";
import { buildEventRecord, normalizeUpdatedEvent, sortEvents } from "./store.shared";

function mapRowToEvent(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    severity: row.severity,
    status: row.status,
    tags: row.tags || [],
    internalNotes: row.internal_notes || "",
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    publishedAt: row.published_at || "",
    detectedAt: row.detected_at,
    score: row.score,
    confidence: row.confidence,
    summary: row.summary,
    whyItMatters: row.why_it_matters,
    fingerprint: row.fingerprint,
  };
}

function mapEventToRow(event) {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    severity: event.severity,
    status: event.status,
    tags: event.tags || [],
    internal_notes: event.internalNotes || "",
    source_type: event.sourceType,
    source_url: event.sourceUrl,
    published_at: event.publishedAt || null,
    detected_at: event.detectedAt,
    score: event.score,
    confidence: event.confidence,
    summary: event.summary,
    why_it_matters: event.whyItMatters,
    fingerprint: event.fingerprint,
  };
}

export async function listEventsSupabase() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("events").select("*");
  if (error) throw error;
  return sortEvents(data.map(mapRowToEvent));
}

export async function getEventSupabase(id) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapRowToEvent(data) : null;
}

export async function addCandidateSupabase(input) {
  const supabase = createSupabaseServerClient();
  const event = buildEventRecord(input);
  const { data, error } = await supabase.from("events").insert(mapEventToRow(event)).select("*").single();
  if (error) throw error;
  return mapRowToEvent(data);
}

export async function updateEventSupabase(id, patch) {
  const current = await getEventSupabase(id);
  if (!current) return null;
  const next = normalizeUpdatedEvent(current, patch);
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .update(mapEventToRow(next))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapRowToEvent(data);
}

export async function resetEventsSupabase(seedEvents) {
  const supabase = createSupabaseServerClient();
  const { error: deleteError } = await supabase.from("events").delete().neq("id", "");
  if (deleteError) throw deleteError;
  const { data, error } = await supabase.from("events").insert(seedEvents.map(mapEventToRow)).select("*");
  if (error) throw error;
  return sortEvents(data.map(mapRowToEvent));
}

export async function findByFingerprintSupabase(fingerprint) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("events").select("*").eq("fingerprint", fingerprint).maybeSingle();
  if (error) throw error;
  return data ? mapRowToEvent(data) : null;
}

export async function recordIngestionRunSupabase(run) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("ingestion_runs").insert({
    source: run.source,
    query: run.query,
    status: run.status,
    items_seen: run.itemsSeen,
    items_created: run.itemsCreated,
    duplicates_count: run.duplicatesCount || 0,
    filtered_count: run.filteredCount || 0,
    details: run.details || [],
    error_message: run.errorMessage || null,
    started_at: run.startedAt || new Date().toISOString(),
    finished_at: run.finishedAt || new Date().toISOString(),
  });
  if (error) throw error;
}

export async function listIngestionRunsSupabase() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("ingestion_runs").select("*").order("started_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    source: row.source,
    query: row.query,
    status: row.status,
    itemsSeen: row.items_seen,
    itemsCreated: row.items_created,
    duplicatesCount: row.duplicates_count || 0,
    filteredCount: row.filtered_count || 0,
    details: row.details || [],
    errorMessage: row.error_message || "",
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }));
}
