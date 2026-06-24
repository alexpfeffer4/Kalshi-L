import { addCandidate, findByFingerprint, recordIngestionRun } from "./store";
import { classifyCourtListenerResult, searchCourtListener } from "./courtlistener";
import { classifyNewsResult, searchNewsRss } from "./news";

async function persistCandidateBatch({ source, query, results, classifyResult, createdReason }) {
  let created = 0;
  let duplicates = 0;
  let filtered = 0;
  const details = [];

  for (const result of results) {
    const classified = classifyResult(result);

    if (!classified.candidate) {
      filtered += 1;
      details.push({
        title: classified.title,
        outcome: "filtered",
        reason: classified.reason,
      });
      continue;
    }

    const candidate = classified.candidate;
    const existing = await findByFingerprint(candidate.fingerprint);

    if (existing) {
      duplicates += 1;
      details.push({
        title: candidate.title,
        outcome: "duplicate",
        reason: "Fingerprint already exists in the event store.",
      });
      continue;
    }

    await addCandidate(candidate);
    created += 1;
    details.push({
      title: candidate.title,
      outcome: "created",
      reason: createdReason(candidate),
    });
  }

  return {
    source,
    query,
    itemsSeen: results.length,
    itemsCreated: created,
    duplicatesCount: duplicates,
    filteredCount: filtered,
    details,
  };
}

export async function runCourtListenerIngest({ query, limit = 10, results }) {
  const startedAt = new Date().toISOString();

  try {
    const incoming = results || (await searchCourtListener({ query, limit }));
    const summary = await persistCandidateBatch({
      source: "courtlistener",
      query,
      results: incoming,
      classifyResult: classifyCourtListenerResult,
      createdReason: (candidate) => `${candidate.type} candidate added for admin review.`,
    });

    await recordIngestionRun({
      ...summary,
      status: "success",
      startedAt,
      finishedAt: new Date().toISOString(),
    });

    return { ok: true, ...summary };
  } catch (error) {
    await recordIngestionRun({
      source: "courtlistener",
      query,
      status: "error",
      itemsSeen: 0,
      itemsCreated: 0,
      duplicatesCount: 0,
      filteredCount: 0,
      details: [],
      errorMessage: error.message,
      startedAt,
      finishedAt: new Date().toISOString(),
    });

    throw error;
  }
}

export async function runNewsIngest({ query, limit = 10, results }) {
  const startedAt = new Date().toISOString();

  try {
    const incoming = results || (await searchNewsRss({ query, limit }));
    const summary = await persistCandidateBatch({
      source: "news_rss",
      query,
      results: incoming,
      classifyResult: classifyNewsResult,
      createdReason: (candidate) => `${candidate.type} news candidate added for admin review.`,
    });

    await recordIngestionRun({
      ...summary,
      status: "success",
      startedAt,
      finishedAt: new Date().toISOString(),
    });

    return { ok: true, ...summary };
  } catch (error) {
    await recordIngestionRun({
      source: "news_rss",
      query,
      status: "error",
      itemsSeen: 0,
      itemsCreated: 0,
      duplicatesCount: 0,
      filteredCount: 0,
      details: [],
      errorMessage: error.message,
      startedAt,
      finishedAt: new Date().toISOString(),
    });

    throw error;
  }
}
