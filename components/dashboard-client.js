"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState, useTransition } from "react";
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
import { summarizeIngestionRuns } from "@/lib/ingestion";

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
  tag: "all",
};

const initialForm = {
  title: "",
  type: "lawsuit",
  sourceType: "court",
  severity: "major",
  summary: "",
  sourceUrl: "",
};

const MODERATION_TAGS = [
  "real lawsuit",
  "legal loss",
  "regulator heat",
  "bad optics",
  "bad press",
  "watch only",
  "duplicate",
  "noise",
  "needs source",
  "publishable",
];

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

function eventBreakdown(event) {
  const typeCopy = {
    lawsuit:
      "This is basically somebody dragging Kalshi into court, which means the issue escaped normal internet yapping and entered real paperwork mode.",
    legal_loss:
      "This is the part where Kalshi may have actually taken a courtroom L instead of just farming discourse online.",
    regulatory:
      "This is regulator smoke, which usually means grown-ups with actual power are now side-eyeing the operation.",
    bad_press:
      "This is a media hit piece or ugly headline cycle, so the brand is getting cooked in public even if no judge swung yet.",
    pr_incident:
      "This is more of a chaos-and-backlash moment, where the timeline is clowning them and the optics are doing zero favors.",
  };

  const severityCopy = {
    major:
      "For Kalshi this is not tiny cringe. It can affect trust, legal risk, regulator attention, or whether people start saying the whole thing looks shaky.",
    notable:
      "For Kalshi this is mid-to-high turbulence. Not instant doom, but definitely the kind of thing that can snowball if more receipts show up.",
    minor:
      "For Kalshi this is more of a contained bruise than an extinction event, but it still belongs on the board if the pattern keeps stacking.",
  };

  return {
    whatHappened: typeCopy[event.type],
    whatItMeans: severityCopy[event.severity],
  };
}

function splitCaseTitle(title) {
  const match = title.match(/^\s*(.+?)\s+v[.\s]\s+(.+?)\s*$/i);
  if (!match) return null;

  return {
    plaintiff: match[1].trim(),
    defendant: match[2].trim(),
  };
}

function courtSpecificLead(event) {
  const sides = splitCaseTitle(event.title);
  const lowerTitle = event.title.toLowerCase();
  const kalshiIsDefendant = sides && /kalshi/.test(sides.defendant.toLowerCase());
  const kalshiIsPlaintiff = sides && /kalshi/.test(sides.plaintiff.toLowerCase());

  if (event.type === "legal_loss") {
    if (sides && kalshiIsDefendant) {
      return `${sides.plaintiff} is the party taking Kalshi into court here, and the important wrinkle is that this does not just look like a complaint sitting on a shelf. It reads like some part of the legal fight may already have gone against Kalshi.`;
    }

    if (sides && kalshiIsPlaintiff) {
      return `Kalshi is the party that brought this case against ${sides.defendant}, but the ugly part is that the docket language suggests Kalshi may have taken a hit anyway. So this is not just them pressing the attack. It may also be them getting clipped while doing it.`;
    }

    return `${event.title} looks like more than a mere lawsuit filing. It reads like the docket may reflect some actual courtroom damage for Kalshi, whether that is a denied motion, a bad ruling, or some other procedural L.`;
  }

  if (sides && kalshiIsDefendant) {
    return `${sides.plaintiff} appears to be the one suing Kalshi here, so the useful read is not just \"there is a lawsuit\" but \"${sides.plaintiff} is specifically hauling Kalshi into court over this dispute.\"`;
  }

  if (sides && kalshiIsPlaintiff) {
    return `Kalshi appears to be the one suing ${sides.defendant} here, which matters because this is not the usual \"someone hit Kalshi with a complaint\" setup. It is Kalshi choosing to litigate, and the question becomes whether the case still creates blowback, scrutiny, or a visible courtroom setback.`;
  }

  if (lowerTitle.includes("in re ")) {
    return `${event.title} reads like a named court matter tied to Kalshi, even if the caption is not in the clean plaintiff-versus-defendant format. The key thing is that there is a real legal proceeding here, not just rumor paste.`;
  }

  return `${event.title} is a real court-linked matter involving Kalshi, but the caption does not spell out the sides in a simple way. So the useful specifics have to come from the docket snippet and source record rather than the case name alone.`;
}

function eventDeepDive(event) {
  const timing = event.publishedAt
    ? `This became public on ${formatDate(event.publishedAt)}, so there is an actual timestamp on when the mess fully surfaced.`
    : `As of ${formatDate(event.detectedAt)}, this is still sitting in the \"receipts are here but the full public shape is still forming\" phase.`;

  const typeSpecific = {
    lawsuit:
      event.sourceType === "court"
        ? courtSpecificLead(event)
        : `${event.title} is an actual lawsuit-type situation, meaning this is not just people subtweeting Kalshi. There is real court-paper energy here, with named parties, a venue, and some kind of legal fight that had enough substance to produce a traceable record.`,
    legal_loss:
      event.sourceType === "court"
        ? courtSpecificLead(event)
        : `${event.title} reads like an actual courtroom setback, not just a complaint existing. The important part is that Kalshi may have gotten clipped on a motion, argument, or ruling that makes its position look weaker than before.`,
    regulatory: `${event.title} is regulator-lane heat, which usually means an agency, commission, or official oversight structure is somewhere in the frame. That is the kind of thing that can go from \"inside baseball\" to \"oh wait this could actually constrain them\" pretty fast.`,
    bad_press: `${event.title} is a bad-press story with enough shape to matter beyond one weird corner of the internet. The practical issue is not just embarrassment. It is that the article can harden a broader public narrative that Kalshi is reckless, sketchy, or pushing past normal limits.`,
    pr_incident: `${event.title} is more of an optics implosion than a courtroom moment. The specifics usually live in screenshots, backlash, or a public reaction cycle where Kalshi now has to explain why people are clowning the move this hard.`,
  };

  const sourceSpecific = {
    court: `The sourcing here is court-side, so there is usually a docket, filing, order, or other hard-paper breadcrumb behind the story instead of just somebody freelancing on the timeline.`,
    regulator: `The sourcing here is regulator-side, which gives it more weight than normal repost chatter because there is some real institution in the loop.`,
    news: `The sourcing here is media/reporting-side, so the key question is whether the piece brings fresh facts, named sourcing, or real documents instead of just reheating old discourse.`,
    social: `The sourcing here is social-first, which means the story might still be real, but the specifics need a harder fact check because social platforms are where unsupported spice travels fastest.`,
    company: `The sourcing here comes through the company lane, so the facts may be partially real while the framing is still doing PR cardio.`,
  };

  const severitySpecific = {
    major:
      "Severity read: this is high-tier turbulence. If the underlying facts hold up, it can affect trust, legal exposure, regulator posture, or the broader narrative that Kalshi is playing too close to the edge.",
    notable:
      "Severity read: this is not apocalypse, but it is also not tiny. It is the kind of thing that can stack with other receipts and make the whole company look shakier over time.",
    minor:
      "Severity read: this is a smaller bruise for now. On its own it may not nuke anything, but it still matters if it joins a larger pattern of repeated mess.",
  };

  return [typeSpecific[event.type], event.summary, sourceSpecific[event.sourceType], timing, severitySpecific[event.severity]]
    .filter(Boolean)
    .join(" ");
}

function runQualityLabel(run) {
  if (run.status === "error") return "broken";
  if (run.itemsCreated >= 3) return "signal";
  if (run.filteredCount >= run.itemsSeen / 2 || run.duplicatesCount >= run.itemsSeen / 2) return "mostly noise";
  return "mixed";
}

function runHitRate(run) {
  if (!run.itemsSeen) return "0%";
  return `${Math.round((run.itemsCreated / run.itemsSeen) * 100)}%`;
}

function runNoiseRate(run) {
  if (!run.itemsSeen) return "0%";
  return `${Math.round((((run.filteredCount || 0) + (run.duplicatesCount || 0)) / run.itemsSeen) * 100)}%`;
}

function detailOutcomeClass(outcome) {
  if (outcome === "created") return "status-confirmed";
  if (outcome === "duplicate") return "status-developing";
  if (outcome === "filtered") return "status-rejected";
  return "status-review";
}

function parseTags(value) {
  return [...new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function FilterGroup({ label, options, active, onChange }) {
  return (
    <div className="stack filter-block">
      <p className="tiny filter-label">{label}</p>
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

function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <div className="empty-state-title">{title}</div>
      <p className="tiny">{body}</p>
    </div>
  );
}

export default function DashboardClient({ initialEvents, initialRuns = [], runtimeStatus, admin = false }) {
  const [events, setEvents] = useState(initialEvents);
  const [runs, setRuns] = useState(initialRuns);
  const [selectedId, setSelectedId] = useState(initialEvents[0]?.id || null);
  const [filters, setFilters] = useState(initialFilters);
  const [tab, setTab] = useState("public");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [ingestQuery, setIngestQuery] = useState(runtimeStatus.defaultCourtListenerQuery || "Kalshi");
  const [newsQuery, setNewsQuery] = useState(runtimeStatus.defaultNewsQuery || "Kalshi");
  const [selectedRunId, setSelectedRunId] = useState(initialRuns[0]?.id || null);
  const [runOutcomeFilter, setRunOutcomeFilter] = useState("all");
  const [editForm, setEditForm] = useState({
    title: "",
    summary: "",
    whyItMatters: "",
    sourceUrl: "",
    tagsText: "",
    internalNotes: "",
  });
  const [isPending, startUiTransition] = useTransition();

  useEffect(() => {
    if (!events.find((event) => event.id === selectedId)) {
      setSelectedId(events[0]?.id || null);
    }
  }, [events, selectedId]);

  useEffect(() => {
    if (!runs.find((run) => run.id === selectedRunId)) {
      setSelectedRunId(runs[0]?.id || null);
    }
  }, [runs, selectedRunId]);

  const availableTags = useMemo(
    () => [...new Set(events.flatMap((event) => event.tags || []))].sort((a, b) => a.localeCompare(b)),
    [events]
  );

  const visibleEvents = useMemo(
    () =>
      events
        .filter((event) => {
          if (tab === "public" && event.status !== "confirmed") return false;
          if (tab === "queue" && event.status !== "review" && event.status !== "developing") return false;
          if (tab === "watchlist" && !admin && event.status === "rejected") return false;
          return Object.entries(filters).every(([key, value]) => {
            if (value === "all") return true;
            if (key === "tag") return (event.tags || []).includes(value);
            return event[key] === value;
          });
        })
        .sort((a, b) => new Date(b.publishedAt || b.detectedAt) - new Date(a.publishedAt || a.detectedAt)),
    [admin, events, filters, tab]
  );

  const queueEvents = useMemo(
    () =>
      events
        .filter((event) => event.status === "review" || event.status === "developing")
        .sort((a, b) => b.score - a.score),
    [events]
  );

  const selected = events.find((event) => event.id === selectedId) || visibleEvents[0] || events[0] || null;
  const confirmedCount = events.filter((event) => event.status === "confirmed").length;
  const selectedBreakdown = selected ? eventBreakdown(selected) : null;
  const selectedDeepDive = selected ? eventDeepDive(selected) : null;
  const selectedRun = runs.find((run) => run.id === selectedRunId) || runs[0] || null;
  const selectedRunDetails = useMemo(() => {
    if (!selectedRun?.details?.length) return [];
    return selectedRun.details.filter((detail) => runOutcomeFilter === "all" || detail.outcome === runOutcomeFilter);
  }, [runOutcomeFilter, selectedRun]);

  useEffect(() => {
    if (!selected) return;
    setEditForm({
      title: selected.title || "",
      summary: selected.summary || "",
      whyItMatters: selected.whyItMatters || "",
      sourceUrl: selected.sourceUrl || "",
      tagsText: (selected.tags || []).join(", "),
      internalNotes: selected.internalNotes || "",
    });
  }, [selected]);

  async function refresh() {
    const [eventsResponse, runsResponse] = await Promise.all([
      fetch("/api/events", { cache: "no-store" }),
      admin ? fetch("/api/ingestion-runs", { cache: "no-store" }) : Promise.resolve(null),
    ]);

    if (!eventsResponse.ok) {
      throw new Error("Could not refresh events.");
    }

    const payload = await eventsResponse.json();
    const runsPayload = runsResponse && runsResponse.ok ? await runsResponse.json() : { runs };

    startTransition(() => {
      setEvents(payload.events);
      if (admin) setRuns(runsPayload.runs);
    });
  }

  async function send(path, init) {
    setError("");

    startUiTransition(async () => {
      try {
        const response = await fetch(path, init);
        if (!response.ok) {
          throw new Error("Request failed.");
        }
        await refresh();
      } catch (requestError) {
        setError(requestError.message || "Something broke.");
      }
    });
  }

  function post(path, body) {
    return send(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function patchEvent(id, status) {
    return send(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  function saveSelectedEdits(event) {
    event.preventDefault();
    if (!selected) return;
    return send(`/api/events/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        summary: editForm.summary,
        whyItMatters: editForm.whyItMatters,
        sourceUrl: editForm.sourceUrl,
        tags: parseTags(editForm.tagsText),
        internalNotes: editForm.internalNotes,
      }),
    });
  }

  async function logoutAdmin() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const ingestionSummary = summarizeIngestionRuns(runs);

  return (
    <div className="app-shell">
      <div className="ticker panel">
        <span>
          !!! KALSHI L ALERT WEBZONE !!! VERIFIED SUIT DRAMA !!! BAD PRESS DETECTED !!! TOUCH GRASS THEN REVIEW
          SOURCES !!! !!! KALSHI L ALERT WEBZONE !!! VERIFIED SUIT DRAMA !!! BAD PRESS DETECTED !!! TOUCH GRASS
          THEN REVIEW SOURCES !!!
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
          <div className="tiny">certified doomscrollers who pulled up to witness the mess</div>
        </article>
        <article className="panel junk-card">
          <div className="blink-box blink">BREAKING L</div>
          <div className="tiny">brand new legal yapping just dropped into the timeline</div>
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
            This is the live scoreboard for lawsuits, regulator side-eyes, and media faceplants around Kalshi.
            Public view is only the certified hits. The queue is where raw chaos waits for a vibe check.
          </p>
          <p className="tiny blink">live laugh litigation</p>
          <div className="badge-wall badge-wall-spaced">
            <span className="micro-badge">hall of ls</span>
            <span className="micro-badge">outside counsel cope monitor</span>
            <span className="micro-badge">billable-hours panic index</span>
          </div>
          <div className="hero-footer">
            <Link className="tiny admin-link" href={admin ? "/" : "/admin"}>
              {admin ? "Back to the public receipts" : "Open the backstage cope lab"}
            </Link>
            <div className="hero-meta">
              <span>{confirmedCount} fully clocked</span>
              <span>{queueEvents.length} pending the cringe scan</span>
            </div>
          </div>
          {admin ? (
            <div className="badge-wall badge-wall-spaced">
              <button className="chip" onClick={logoutAdmin} type="button">
                Log out
              </button>
            </div>
          ) : null}
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
            <button className="chip" onClick={() => setFilters(initialFilters)} type="button">
              Clear
            </button>
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
          {availableTags.length ? (
            <FilterGroup
              label="Tags"
              options={availableTags}
              active={filters.tag}
              onChange={(value) => setFilters((current) => ({ ...current, tag: value }))}
            />
          ) : null}

          <div className="notice">
            Cope math: actual legal pain and regulator smoke hit hardest. Random bad press only makes the cut if
            it has real receipts and is not just recycled yap.
          </div>
          <div className="notice notice-secondary">
            Counsel rule: roast the spin cycle, the briefing gymnastics, and the damage-control theater. Keep the
            personal stuff out of it.
          </div>
          <div className="notice notice-status">
            storage: <strong>{runtimeStatus.storageMode}</strong>
            <br />
            courtlistener token: <strong>{runtimeStatus.hasCourtListenerToken ? "present" : "missing"}</strong>
            {runtimeStatus.hasSupabase ? null : (
              <>
                <br />
                supabase missing: {runtimeStatus.missingSupabase.join(", ")}
              </>
            )}
          </div>
        </aside>

        <main className="panel content">
          <div className="section-title">
            <div>
              <h2>{admin ? "Admin deck" : "Feed"}</h2>
              <p className="tiny section-subtitle">
                {tab === "public"
                  ? "Only the fully clocked Ls make it out here."
                  : tab === "queue"
                    ? "Just the pending and kinda-cooked situations."
                    : "The whole messy board except stuff that got nuked."}
              </p>
            </div>
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

          <div className="control-strip">
            <div className="toolbar">
              <button className="action primary" onClick={() => post("/api/events/actions/seed", {})} type="button">
                Inject example candidate
              </button>
              <button className="action" onClick={() => post("/api/events/actions/reset", {})} type="button">
                Reset demo data
              </button>
            </div>

            <div className="status-rail">
              <div className="badge-wall">
                <span className="micro-badge">Top 8 worst weeks</span>
                <span className="micro-badge">Fresh cope</span>
                <span className="micro-badge">Docket drama</span>
                <span className="micro-badge">PR faceplant</span>
              </div>
              {isPending ? <span className="tiny sync-pill">syncing...</span> : null}
            </div>
          </div>

          {error ? <div className="notice notice-error">{error}</div> : null}

          <div className="feed-list">
            {visibleEvents.length ? (
              visibleEvents.map((event) => (
                <article
                  className={`feed-card selectable-card ${event.id === selected?.id ? "selected" : ""}`}
                  key={event.id}
                  onClick={() => setSelectedId(event.id)}
                >
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
              ))
            ) : (
              <EmptyState
                body="Switch tabs or tweak filters. The machine currently has zero fresh clownery matching this lane."
                title="No fresh mess here"
              />
            )}
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
              <div className="notice notice-secondary">
                <strong>What happened:</strong> {selectedBreakdown.whatHappened}
                <br />
                <br />
                <strong>What it means for Kalshi:</strong> {selectedBreakdown.whatItMeans}
              </div>
              <div className="notice">
                <strong>Deep dive:</strong> {selectedDeepDive}
              </div>

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

              {admin && selected.tags?.length ? (
                <div className="stack">
                  <p className="tiny section-subtitle">Moderation tags</p>
                  <div className="badge-wall">
                    {selected.tags.map((tag) => (
                      <span className="micro-badge" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {admin && selected.internalNotes ? (
                <div className="notice admin-note">
                  <strong>Internal notes:</strong>
                  <br />
                  {selected.internalNotes}
                </div>
              ) : null}

              <div className="notice">
                <strong>Timeline read:</strong> detected {formatDate(selected.detectedAt)} and{" "}
                {selected.publishedAt ? `pushed public ${formatDate(selected.publishedAt)}.` : "still not public-feed official yet."}
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

              <div className="badge-wall badge-wall-spaced">
                <span className="micro-badge">click 4 docket drama</span>
                <span className="micro-badge">outside counsel cope</span>
                <span className="micro-badge">damage control cam</span>
              </div>

              <p className="tiny card-link-row">
                {selected.sourceUrl ? (
                  <a href={selected.sourceUrl} rel="noreferrer" target="_blank">
                    Open source
                  </a>
                ) : (
                  "No source URL attached yet."
                )}
              </p>

              {admin ? (
                <>
                  <hr className="divider" />
                  <div className="section-title">
                    <div>
                      <h3>Edit Writeup</h3>
                      <p className="tiny section-subtitle">
                        Tighten the title, fix the summary, and sharpen what the hit means for Kalshi.
                      </p>
                    </div>
                  </div>
                  <form onSubmit={saveSelectedEdits}>
                    <div className="field">
                      <label htmlFor="editTitle">Title</label>
                      <input
                        id="editTitle"
                        onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                        value={editForm.title}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="editSummary">Summary</label>
                      <textarea
                        id="editSummary"
                        onChange={(event) => setEditForm((current) => ({ ...current, summary: event.target.value }))}
                        value={editForm.summary}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="editWhyItMatters">Why it matters</label>
                      <textarea
                        id="editWhyItMatters"
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, whyItMatters: event.target.value }))
                        }
                        value={editForm.whyItMatters}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="editSourceUrl">Source URL</label>
                      <input
                        id="editSourceUrl"
                        onChange={(event) => setEditForm((current) => ({ ...current, sourceUrl: event.target.value }))}
                        value={editForm.sourceUrl}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="editTags">Tags</label>
                      <input
                        id="editTags"
                        onChange={(event) => setEditForm((current) => ({ ...current, tagsText: event.target.value }))}
                        value={editForm.tagsText}
                      />
                    </div>
                    <div className="badge-wall badge-wall-spaced">
                      {MODERATION_TAGS.map((tag) => {
                        const activeTags = parseTags(editForm.tagsText);
                        const active = activeTags.includes(tag);
                        return (
                          <button
                            className={`chip ${active ? "active" : ""}`}
                            key={tag}
                            onClick={() =>
                              setEditForm((current) => {
                                const tags = parseTags(current.tagsText);
                                const nextTags = tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag];
                                return { ...current, tagsText: nextTags.join(", ") };
                              })
                            }
                            type="button"
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                    <div className="field">
                      <label htmlFor="editInternalNotes">Internal notes</label>
                      <textarea
                        id="editInternalNotes"
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, internalNotes: event.target.value }))
                        }
                        value={editForm.internalNotes}
                      />
                    </div>
                    <button className="action primary" disabled={isPending} type="submit">
                      Save writeup edits
                    </button>
                  </form>
                </>
              ) : null}
            </>
          ) : (
            <EmptyState
              body="Click a card and we will unpack the receipts, source trail, and how cooked the situation is."
              title="Pick a mess to inspect"
            />
          )}

          <hr className="divider" />

          <div className="section-title">
            <div>
              <h3>Review Queue</h3>
              <p className="tiny section-subtitle">{queueEvents.length} items need judgement</p>
            </div>
          </div>
          <div className="queue-list">
              {queueEvents.length ? (
              queueEvents.map((event) => (
                <article
                  className={`queue-card selectable-card ${event.id === selected?.id ? "selected" : ""}`}
                  key={event.id}
                  onClick={() => setSelectedId(event.id)}
                >
                  <div className="queue-top">
                    <div>
                      <div className="meta">
                        <span>{titleCase(event.type)}</span>
                        <span>{formatDate(event.detectedAt)}</span>
                      </div>
                      <h3 className="event-title queue-title">{event.title}</h3>
                      <div className="tiny">{reactionLabel(event.score)}</div>
                    </div>
                    <span className={`pill sev-${event.severity}`}>{event.score}</span>
                  </div>
                </article>
              ))
              ) : (
              <EmptyState title="Queue is weirdly calm" body="No candidates are waiting for the vibe jury right now." />
              )}
          </div>

          <hr className="divider" />

            <div className="section-title">
              <div>
                <h3>Add Candidate</h3>
                <p className="tiny section-subtitle">Manual dropbox for edge-case nonsense and cursed headlines.</p>
              </div>
            </div>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await post("/api/events", form);
              setForm(initialForm);
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
            <button className="action primary" disabled={isPending} type="submit">
              Queue candidate
            </button>
          </form>

          {admin ? (
            <>
              <hr className="divider" />
              <div className="section-title">
                <div>
                  <h3>Ingestion Stubs</h3>
                  <p className="tiny section-subtitle">CourtListener is locked in. Supabase is the grown-up storage brain.</p>
                </div>
              </div>
              <div className="stack">
                <div className="detail-grid ingestion-summary-grid">
                  {ingestionSummary.map((item) => (
                    <div className="detail-cell" key={item.label}>
                      <span>{item.label}</span>
                      {item.value}
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await post("/api/ingest/courtlistener", { query: ingestQuery });
                  }}
                >
                  <div className="field">
                    <label htmlFor="ingestQuery">CourtListener query</label>
                    <input
                      id="ingestQuery"
                      onChange={(event) => setIngestQuery(event.target.value)}
                      value={ingestQuery}
                    />
                  </div>
                <button className="action primary" disabled={isPending} type="submit">
                  Run CourtListener now
                </button>
              </form>
              <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await post("/api/ingest/news", { query: newsQuery });
                  }}
                >
                  <div className="field">
                    <label htmlFor="newsQuery">News / bad press query</label>
                    <input id="newsQuery" onChange={(event) => setNewsQuery(event.target.value)} value={newsQuery} />
                  </div>
                  <button className="action primary" disabled={isPending} type="submit">
                    Run News now
                  </button>
                </form>
                <button
                  className="action primary"
                  disabled={isPending}
                  onClick={async () => {
                    await post("/api/ingest/all", {
                      courtQuery: ingestQuery,
                      newsQuery,
                    });
                  }}
                  type="button"
                >
                  Run all sources now
                </button>
                <div className="stack">
                  {runs.length ? (
                    runs.slice(0, 6).map((run) => (
                      <article
                        className={`notice run-card selectable-card ${run.id === selectedRun?.id ? "selected" : ""}`}
                        key={run.id}
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <div className="run-card-top">
                          <strong>{run.source}</strong>
                          <span className={`pill ${run.status === "error" ? "status-rejected" : "status-confirmed"}`}>
                            {run.status}
                          </span>
                        </div>
                        <div className="tiny run-query">{run.query}</div>
                        <div className="detail-grid run-metrics-grid">
                          <div className="detail-cell">
                            <span>Seen</span>
                            {run.itemsSeen}
                          </div>
                          <div className="detail-cell">
                            <span>Created</span>
                            {run.itemsCreated}
                          </div>
                          <div className="detail-cell">
                            <span>Duplicates</span>
                            {run.duplicatesCount}
                          </div>
                          <div className="detail-cell">
                            <span>Filtered</span>
                            {run.filteredCount}
                          </div>
                        </div>
                        <div className="badge-wall">
                          <span className="micro-badge">hit rate {runHitRate(run)}</span>
                          <span className="micro-badge">noise rate {runNoiseRate(run)}</span>
                          <span className="micro-badge">{runQualityLabel(run)}</span>
                        </div>
                        <div className="tiny">
                          started: {formatDate(run.startedAt)}
                          {run.finishedAt ? ` | finished: ${formatDate(run.finishedAt)}` : ""}
                        </div>
                        {run.errorMessage ? <div className="tiny">error: {run.errorMessage}</div> : null}
                        {run.details?.length ? (
                          <div className="stack run-detail-list">
                            {run.details.slice(0, 3).map((detail, index) => (
                              <div className="detail-cell run-detail-item" key={`${run.id}-${detail.title}-${index}`}>
                                <span>{detail.title}</span>
                                <div className="badge-wall">
                                  <span className={`pill ${detailOutcomeClass(detail.outcome)}`}>{detail.outcome}</span>
                                </div>
                                <div className="tiny">{detail.reason}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <EmptyState
                      title="No ingestion runs yet"
                      body="Once you run CourtListener or hit the ingest route from a scheduler, recent runs show up here."
                    />
                  )}
                </div>
                {selectedRun ? (
                  <div className="stack">
                    <div className="section-title">
                      <div>
                        <h3>Run Diagnostics</h3>
                        <p className="tiny section-subtitle">
                          {selectedRun.query} | {formatDate(selectedRun.startedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="badge-wall">
                      {["all", "created", "duplicate", "filtered"].map((outcome) => (
                        <button
                          className={`chip ${runOutcomeFilter === outcome ? "active" : ""}`}
                          key={outcome}
                          onClick={() => setRunOutcomeFilter(outcome)}
                          type="button"
                        >
                          {titleCase(outcome)}
                        </button>
                      ))}
                    </div>
                    {selectedRunDetails.length ? (
                      <div className="stack run-detail-list run-detail-list-expanded">
                        {selectedRunDetails.map((detail, index) => (
                          <div className="detail-cell run-detail-item" key={`${selectedRun.id}-${detail.title}-${index}`}>
                            <span>{detail.title}</span>
                            <div className="badge-wall">
                              <span className={`pill ${detailOutcomeClass(detail.outcome)}`}>{detail.outcome}</span>
                            </div>
                            <div className="tiny">{detail.reason}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No matching run items"
                        body="This run does not have any detail rows in the outcome lane you picked."
                      />
                    )}
                  </div>
                ) : null}
                <div className="notice">
                  Next unlocks: tighter source enrichment, better dedupe, and cleaner review signals. Keeping the
                  court lane separate from the news lane stops the board from turning into pure slop.
                </div>
                <div className="notice">
                  Live source mode is currently sniffing with this CourtListener query: <strong>{runtimeStatus.defaultCourtListenerQuery}</strong>
                </div>
              </div>
            </>
          ) : null}
        </aside>
      </section>

      <div className="footer">
        Built to graduate from local chaos into real deployment. The routes and data layer are already shaped for
        Supabase and Vercel when you want the full live setup.
      </div>
    </div>
  );
}
