import Link from "next/link";
import { notFound } from "next/navigation";
import {
  eventBreakdown,
  eventCardMeta,
  eventDeepDive,
  eventTimelineLabel,
  formatEventDate,
  sourceDetailsRows,
} from "@/lib/event-presentation";
import { titleCase } from "@/lib/events";
import { getEvent, listEvents } from "@/lib/store";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event || event.status !== "confirmed") {
    return {
      title: "Receipt Not Found | Kalshi L Notifier",
    };
  }

  return {
    title: `${event.title} | Kalshi L Notifier`,
    description: event.summary,
  };
}

export default async function EventPage({ params }) {
  const { id } = await params;
  const event = await getEvent(id);

  if (!event || event.status !== "confirmed") {
    notFound();
  }

  const events = await listEvents();
  const relatedEvents = events
    .filter((item) => item.id !== event.id && item.status === "confirmed")
    .filter((item) => item.type === event.type || item.sourceType === event.sourceType)
    .slice(0, 4);

  const breakdown = eventBreakdown(event);
  const meta = eventCardMeta(event);
  const deepDive = eventDeepDive(event);
  const sourceRows = sourceDetailsRows(event);

  return (
    <div className="app-shell">
      <div className="ticker panel">
        <span>
          !!! RECEIPT MODE !!! FULL EVENT PAGE !!! SOURCE TRAIL LOADED !!! RECEIPT MODE !!! FULL EVENT PAGE !!! SOURCE
          TRAIL LOADED !!!
        </span>
      </div>

      <section className="event-page-grid">
        <main className="panel event-page-main">
          <div className="event-page-nav">
            <Link className="tiny admin-link" href="/">
              Back to the public receipts
            </Link>
            <span className="micro-badge">{meta.sourceLabel}</span>
          </div>

          <div className="meta">
            <span>{meta.icon}</span>
            <span>{titleCase(event.type)}</span>
            <span>{formatEventDate(event.publishedAt || event.detectedAt)}</span>
          </div>

          <h1 className="event-page-title">{event.title}</h1>

          <div className="badge-wall">
            <span className={`pill sev-${event.severity}`}>{titleCase(event.severity)}</span>
            <span className={`pill status-${event.status}`}>{titleCase(event.status)}</span>
            <span className="pill">{meta.reaction}</span>
            <span className="pill">{titleCase(event.sourceType)}</span>
          </div>

          <p className="event-page-summary">{event.summary}</p>

          <div className="notice">
            <strong>Why it matters:</strong> {event.whyItMatters}
          </div>

          <section className="event-copy-section">
            <h2>What happened</h2>
            <p>{breakdown.whatHappened}</p>
          </section>

          <section className="event-copy-section">
            <h2>What it means for Kalshi</h2>
            <p>{breakdown.whatItMeans}</p>
          </section>

          <section className="event-copy-section">
            <h2>Deep dive</h2>
            <p>{deepDive}</p>
          </section>

          <div className="detail-grid event-detail-grid">
            <div className="detail-cell">
              <span>Detected</span>
              {formatEventDate(event.detectedAt)}
            </div>
            <div className="detail-cell">
              <span>Published</span>
              {formatEventDate(event.publishedAt)}
            </div>
            <div className="detail-cell">
              <span>Score</span>
              {event.score}
            </div>
            <div className="detail-cell">
              <span>Confidence</span>
              {event.confidence}%
            </div>
          </div>

          <div className="notice notice-secondary">
            <strong>Timeline read:</strong> {eventTimelineLabel(event)}
          </div>

          <section className="event-copy-section">
            <h2>Source receipt</h2>
            <p>{meta.sourceLabel}</p>
            {sourceRows.length ? (
              <div className="detail-grid event-detail-grid">
                {sourceRows.map((row) => (
                  <div className="detail-cell" key={row.label}>
                    <span>{row.label}</span>
                    {row.value}
                  </div>
                ))}
              </div>
            ) : null}
            <p className="card-link-row">
              {event.sourceUrl ? (
                <a href={event.sourceUrl} rel="noreferrer" target="_blank">
                  Open original source
                </a>
              ) : (
                "No source URL is attached yet for this item."
              )}
            </p>
          </section>

          {event.tags?.length ? (
            <section className="event-copy-section">
              <h2>Tags</h2>
              <div className="badge-wall">
                {event.tags.map((tag) => (
                  <span className="micro-badge" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </main>

        <aside className="panel event-page-side">
          <div className="section-title">
            <div>
              <h3>More receipts</h3>
              <p className="tiny section-subtitle">Other confirmed entries in the same lane.</p>
            </div>
          </div>

          <div className="stack">
            {relatedEvents.length ? (
              relatedEvents.map((relatedEvent) => {
                const relatedMeta = eventCardMeta(relatedEvent);

                return (
                  <article className="feed-card" key={relatedEvent.id}>
                    <div className="meta">
                      <span>{relatedMeta.icon}</span>
                      <span>{formatEventDate(relatedEvent.publishedAt || relatedEvent.detectedAt)}</span>
                    </div>
                    <h3 className="event-title queue-title">{relatedEvent.title}</h3>
                    <p className="tiny">{relatedEvent.summary}</p>
                    <div className="card-link-row">
                      <Link href={`/events/${relatedEvent.id}`}>Open receipt</Link>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
                <div className="empty-state-title">No adjacent chaos</div>
                <p className="tiny">This confirmed item does not have any obvious same-lane neighbors yet.</p>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
