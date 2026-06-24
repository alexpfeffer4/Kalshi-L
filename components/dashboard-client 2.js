"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  iconForType,
  reactionLabel,
  SEVERITY_OPTIONS,
  SOURCE_OPTIONS,
  STATUS_OPTIONS,
  statsFor,
  titleCase,
  TYPE_OPTIONS,
} from "@/lib/events";

const tabs = [
  { id: "public", label: "Court cooked" },
  { id: "watchlist", label: "Fresh cope" },
  { id: "queue", label: "Developing mess" },
];

const initialFilters = {
  status: "all",
  type: "all",
  severity: "all",
  sourceType: "all",
};

function formatDate(value) {
  if (!value) return "Unpublished";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function FilterGroup({ label, options, active, onChange }) {
  return (
    <div className="stack" style={{ gap: 10, marginBottom: 18 }}>
      <p className="tiny" style={{ margin: 0, fontSize: "0.92rem" }}>
        {label}
      </p>
      <div className="chip-row">
        {["all", ...options].map((option) => (
          <button
            key={option}
            className={`chip ${active === option ? "active" : ""}`}
            onClick={() => onChange(option)}
            type="button"
          >
            {titleCase(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DashboardClient({ initialEvents, admin = false }) {
  const [events, setEvents] = useState(initialEvents);
  const [selectedId, setSelectedId] = useState(initialEvents[0]?.id || null);
  const [filters, setFilters] = useState(initialFilters);
  const [tab, setTab] = useState("public");
  const [form, setForm] = useState({
    title: "",
    type: "lawsuit",
    sourceType: "court",
    severity: "major",
    summary: "",
    sourceUrl: "",
  });

  useEffect(() => {
    if (!events.find((event) => event.id === selectedId)) {
      setSelectedId(events[0]?.id || null);
    }
  }, [events, selectedId]);

  const visibleEvents = events
    .filter((event) => {
      if (tab === "public" && event.status !== "confirmed") return false;
      if (tab === "queue" && event.status !== "review" && event.status !== "developing") return false;
      if (tab === "watchlist" && !admin && event.status === "rejected") return false;
      return Object.entries(filters).every(([key, value]) => value === "all" || event[key] === value);
    })
    .sort((a, b) => new Date(b.publishedAt || b.detectedAt) - new Date(a.publishedAt || a.detectedAt));

  const queueEvents = events
    .filter((event) => event.status === "review" || event.status === "developing")
    .sort((a, b) => b.score - a.score);

  const selected = events.find((event) => event.id === selectedId) || visibleEvents[0] || events[0];

  async function refresh() {
    const response = await fetch("/api/events", { cache: "no-store" });
    const payload = await response.json();
    setEvents(payload.events);
  }

  async function post(path, body) {
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await refresh();
  }

  async function patchEvent(id, status) {
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  return (
    <div className="app-shell">
      <div className="ticker panel">
        <span>
          !!! KALSHI L ALERT WEBZONE !!! VERIFIED SUIT DRAMA !!! BAD PRESS DETECTED !!! TOUCH GRASS THEN REVIEW SOURCES !!!
          !!! KALSHI L ALERT WEBZONE !!! VERIFIED SUIT DRAMA !!! BAD PRESS DETECTED !!! TOUCH GRASS THEN REVIEW SOURCES !!!
        </span>
      </div>

      <section className="junkbar">
        <article className="panel junk-card">
          <div className="eyebrow">Visitor Counter</div>
          <div className="counter">
            <b>0</b>
            <b>0</b>
            <b>6</b>
            <b>6</b>
            <b>6</b>
            <b>1</b>
          </div>
          <div className="tiny">unique doomscrollers since launch</div>
        </article>
        <article className="panel junk-card">
          <div className="blink-box blink">BREAKING L</div>
          <div className="tiny">fresh cope detected in the litigation atmosphere</div>
        </article>
        <article className="panel junk-card">
          <div className="eyebrow">Awards</div>
          <div className="badge-wall">
            <span className="micro-badge">under construction</span>
            <span className="micro-badge">many such cases</span>
            <span className="micro-badge">court cooked</span>
          </div>
        </article>
      </section>

      <section className="hero">
        <article className="panel hero-main">
          <div className="eyebrow">
            Public feed + private review queue <span className="sparkle">###</span>
          </div>
          <h1 className="headline">Kalshi L Notifier</h1>
          <p className="lede">
            Track lawsuits, legal setbacks, regulatory heat, and ugly press cycles around Kalshi. The public
            feed only shows verified items. The review queue holds raw candidates until you approve, downgrade,
            or dismiss them.
          </p>
          <p className="tiny blink">live laugh litigation</p>
          <div className="badge-wall" style={{ marginTop: 12 }}>
            <span className="micro-badge">hall of ls</span>
            <span className="micro-badge">outside counsel cope monitor</span>
            <span className="micro-badge">billable-hours panic index</span>
          </div>
          <Link className="tiny admin-link" href={admin ? "/" : "/admin"}>
            {admin ? "Back to public feed" : "Open admin review deck"}
          </Link>
        </article>

        <aside className="panel stats">
          {statsFor(events).map((item) => (
            <div className="stat-card" key={item.label}>
              <div className="label">{item.label}</div>
              <div className="stat-value">{item.value}</div>
            </div>
          ))}
        </aside>
      </section>

      <section className="dashboard">
        <aside className="panel sidebar">
          <div className="section-title">
            <h2>Filters</h2>
          </div>

          <FilterGroup
            label="Visibility"
            options={STATUS_OPTIONS}
            active={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <FilterGroup
            label="Type"
            options={TYPE_OPTIONS}
            active={filters.type}
            onChange={(value) => setFilters((current) => ({ ...current, type: value }))}
          />
          <FilterGroup
            label="Severity"
            options={SEVERITY_OPTIONS}
            active={filters.severity}
            onChange={(value) => setFilters((current) => ({ ...current, severity: value }))}
          />
          <FilterGroup
            label="Source"
            options={SOURCE_OPTIONS}
            active={filters.sourceType}
            onChange={(value) => setFilters((current) => ({ ...current, sourceType: value }))}
          />

          <div className="notice">
            Score formula: legal loss and regulator action carry the most weight; broad bad press is only
            publishable once it clears your threshold and points to a primary source or a credible outlet.
          </div>
          <div className="notice" style={{ marginTop: 12 }}>
            Counsel watch: keep named references factual. Joke about the spin, the briefing, or the damage
            control routine, not personal traits.
          </div>
        </aside>

        <main className="panel content">
          <div className="section-title">
            <h2>{admin ? "Admin deck" : "Feed"}</h2>
            <div className="toolbar">
              {tabs.map((entry) => (
                <button
                  className={`tab ${tab === entry.id ? "active" : ""}`}
                  key={entry.id}
                  onClick={() => setTab(entry.id)}
                  type="button"
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>

          <div className="toolbar">
            <button className="action primary" onClick={() => post("/api/events/actions/seed", {})} type="button">
              Inject example candidate
            </button>
            <button className="action" onClick={() => post("/api/events/actions/reset", {})} type="button">
              Reset demo data
            </button>
          </div>

          <div className="badge-wall" style={{ marginBottom: 16 }}>
            <span className="micro-badge">Top 8 worst weeks</span>
            <span className="micro-badge">Fresh cope</span>
            <span className="micro-badge">Docket drama</span>
            <span className="micro-badge">PR faceplant</span>
          </div>

          <div className="feed-list">
            {visibleEvents.map((event) => (
              <article className="feed-card" key={event.id} onClick={() => setSelectedId(event.id)}>
                <div className="feed-top">
                  <div>
                    <div className="meta">
                      <span>{iconForType(event.type)}</span>
                      <span>{formatDate(event.publishedAt || event.detectedAt)}</span>
                    </div>
                    <h3 className="event-title">{event.title}</h3>
                    <div className="meta">
                      <span className={`pill sev-${event.severity}`}>{titleCase(event.severity)}</span>
                      <span className={`pill status-${event.status}`}>{titleCase(event.status)}</span>
                      <span>{titleCase(event.sourceType)}</span>
                      <span>{reactionLabel(event.score)}</span>
                    </div>
                  </div>
                  <div className="score">
                    <span className="tiny">Cope</span>
                    <strong>{event.score}</strong>
                  </div>
                </div>
                <p className="tiny">{event.summary}</p>
              </article>
            ))}
          </div>
        </main>

        <aside className="panel detail">
          {selected ? (
            <>
              <div className="detail-top">
                <div>
                  <div className="meta">
                    <span className={`pill sev-${selected.severity}`}>{titleCase(selected.severity)}</span>
                    <span className={`pill status-${selected.status}`}>{titleCase(selected.status)}</span>
                    <span className="pill">{reactionLabel(selected.score)}</span>
                  </div>
                  <h3 className="event-title">{selected.title}</h3>
                </div>
                <div className="score">
                  <span className="tiny">Cope score</span>
                  <strong>{selected.confidence}%</strong>
                </div>
              </div>

              <p className="detail-copy">{selected.summary}</p>
              <p className="detail-copy">
                <strong>Why it matters:</strong> {selected.whyItMatters}
              </p>

              <div className="detail-grid">
                <div className="detail-cell">
                  <span>Type</span>
                  {titleCase(selected.type)}
                </div>
                <div className="detail-cell">
                  <span>Source</span>
                  {titleCase(selected.sourceType)}
                </div>
                <div className="detail-cell">
                  <span>Detected</span>
                  {formatDate(selected.detectedAt)}
                </div>
                <div className="detail-cell">
                  <span>Published</span>
                  {formatDate(selected.publishedAt)}
                </div>
              </div>

              <div className="detail-actions">
                <button className="action primary" onClick={() => patchEvent(selected.id, "confirmed")} type="button">
                  Approve
                </button>
                <button className="action" onClick={() => patchEvent(selected.id, "developing")} type="button">
                  Mark developing
                </button>
                <button className="action danger" onClick={() => patchEvent(selected.id, "rejected")} type="button">
                  Reject
                </button>
              </div>

              <div className="badge-wall" style={{ marginTop: 14 }}>
                <span className="micro-badge">click 4 docket drama</span>
                <span className="micro-badge">outside counsel cope</span>
                <span className="micro-badge">damage control cam</span>
              </div>

              <p className="tiny" style={{ marginTop: 14 }}>
                {selected.sourceUrl ? (
                  <a href={selected.sourceUrl} rel="noreferrer" target="_blank">
                    Open source
                  </a>
                ) : (
                  "No source URL attached yet."
                )}
              </p>
            </>
          ) : (
            <div className="tiny">Select an item to inspect it.</div>
          )}

          <hr style={{ border: "none", borderTop: "1px solid rgba(6, 47, 31, 0.14)", margin: "20px 0" }} />

          <div className="section-title">
            <h3>Review Queue</h3>
          </div>
          <div className="queue-list">
            {queueEvents.map((event) => (
              <article className="queue-card" key={event.id} onClick={() => setSelectedId(event.id)}>
                <div className="queue-top">
                  <div>
                    <div className="meta">
                      <span>{titleCase(event.type)}</span>
                      <span>{formatDate(event.detectedAt)}</span>
                    </div>
                    <h3 className="event-title">{event.title}</h3>
                    <div className="tiny">{reactionLabel(event.score)}</div>
                  </div>
                  <span className={`pill sev-${event.severity}`}>{event.score}</span>
                </div>
              </article>
            ))}
          </div>

          <hr style={{ border: "none", borderTop: "1px solid rgba(6, 47, 31, 0.14)", margin: "20px 0" }} />

          <div className="section-title">
            <h3>Add Candidate</h3>
          </div>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await post("/api/events", form);
              setForm({
                title: "",
                type: "lawsuit",
                sourceType: "court",
                severity: "major",
                summary: "",
                sourceUrl: "",
              });
            }}
          >
            <div className="field">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                value={form.title}
              />
            </div>
            <div className="field">
              <label htmlFor="type">Type</label>
              <select
                id="type"
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                value={form.type}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="sourceType">Source</label>
              <select
                id="sourceType"
                onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value }))}
                value={form.sourceType}
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="severity">Severity</label>
              <select
                id="severity"
                onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}
                value={form.severity}
              >
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="summary">Summary</label>
              <textarea
                id="summary"
                onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))}
                value={form.summary}
              />
            </div>
            <div className="field">
              <label htmlFor="sourceUrl">Source URL</label>
              <input
                id="sourceUrl"
                onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))}
                value={form.sourceUrl}
              />
            </div>
            <button className="action primary" type="submit">
              Queue candidate
            </button>
          </form>

          {admin ? (
            <>
              <hr style={{ border: "none", borderTop: "1px solid rgba(6, 47, 31, 0.14)", margin: "20px 0" }} />
              <div className="section-title">
                <h3>Ingestion Stubs</h3>
              </div>
              <div className="stack">
                <div className="notice">
                  CourtListener collector: poll or webhook into `/api/ingest/courtlistener`, then normalize into
                  candidate events.
                </div>
                <div className="notice">
                  News collector: search Google News or GDELT, score the outlet and negativity, then send only
                  notable items into review.
                </div>
                <div className="notice">
                  Regulator collector: watch CFTC and adjacent regulator pages, then attach primary-source URLs
                  before publication.
                </div>
              </div>
            </>
          ) : null}
        </aside>
      </section>

      <div className="footer">
        Built locally with a file-backed storage adapter for development. The route and data boundaries are set
        up so you can swap this to Supabase or Postgres for Vercel deployment.
      </div>
    </div>
  );
}
