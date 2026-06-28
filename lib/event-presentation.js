import { iconForType, reactionLabel, titleCase } from "./events";

export function formatEventDate(value) {
  if (!value) return "Unpublished";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function splitCaseTitle(title) {
  const match = title.match(/^\s*(.+?)\s+v[.\s]\s+(.+?)\s*$/i);
  if (!match) return null;

  return {
    plaintiff: match[1].trim(),
    defendant: match[2].trim(),
  };
}

export function eventBreakdown(event) {
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

export function courtSpecificLead(event) {
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
    return `${sides.plaintiff} appears to be the one suing Kalshi here, so the useful read is not just "there is a lawsuit" but "${sides.plaintiff} is specifically hauling Kalshi into court over this dispute."`;
  }

  if (sides && kalshiIsPlaintiff) {
    return `Kalshi appears to be the one suing ${sides.defendant} here, which matters because this is not the usual "someone hit Kalshi with a complaint" setup. It is Kalshi choosing to litigate, and the question becomes whether the case still creates blowback, scrutiny, or a visible courtroom setback.`;
  }

  if (lowerTitle.includes("in re ")) {
    return `${event.title} reads like a named court matter tied to Kalshi, even if the caption is not in the clean plaintiff-versus-defendant format. The key thing is that there is a real legal proceeding here, not just rumor paste.`;
  }

  return `${event.title} is a real court-linked matter involving Kalshi, but the caption does not spell out the sides in a simple way. So the useful specifics have to come from the docket snippet and source record rather than the case name alone.`;
}

export function eventDeepDive(event) {
  const timing = event.publishedAt
    ? `This became public on ${formatEventDate(event.publishedAt)}, so there is an actual timestamp on when the mess fully surfaced.`
    : `As of ${formatEventDate(event.detectedAt)}, this is still sitting in the "receipts are here but the full public shape is still forming" phase.`;

  const typeSpecific = {
    lawsuit:
      event.sourceType === "court"
        ? courtSpecificLead(event)
        : `${event.title} is an actual lawsuit-type situation, meaning this is not just people subtweeting Kalshi. There is real court-paper energy here, with named parties, a venue, and some kind of legal fight that had enough substance to produce a traceable record.`,
    legal_loss:
      event.sourceType === "court"
        ? courtSpecificLead(event)
        : `${event.title} reads like an actual courtroom setback, not just a complaint existing. The important part is that Kalshi may have gotten clipped on a motion, argument, or ruling that makes its position look weaker than before.`,
    regulatory: `${event.title} is regulator-lane heat, which usually means an agency, commission, or official oversight structure is somewhere in the frame. That is the kind of thing that can go from "inside baseball" to "oh wait this could actually constrain them" pretty fast.`,
    bad_press: `${event.title} is a bad-press story with enough shape to matter beyond one weird corner of the internet. The practical issue is not just embarrassment. It is that the article can harden a broader public narrative that Kalshi is reckless, sketchy, or pushing past normal limits.`,
    pr_incident: `${event.title} is more of an optics implosion than a courtroom moment. The specifics usually live in screenshots, backlash, or a public reaction cycle where Kalshi now has to explain why people are clowning the move this hard.`,
  };

  const sourceSpecific = {
    court: "The sourcing here is court-side, so there is usually a docket, filing, order, or other hard-paper breadcrumb behind the story instead of just somebody freelancing on the timeline.",
    regulator: "The sourcing here is regulator-side, which gives it more weight than normal repost chatter because there is some real institution in the loop.",
    news: "The sourcing here is media/reporting-side, so the key question is whether the piece brings fresh facts, named sourcing, or real documents instead of just reheating old discourse.",
    social: "The sourcing here is social-first, which means the story might still be real, but the specifics need a harder fact check because social platforms are where unsupported spice travels fastest.",
    company: "The sourcing here comes through the company lane, so the facts may be partially real while the framing is still doing PR cardio.",
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

export function sourceLabel(event) {
  if (event.sourceType === "court") return "Court docket / filing trail";
  if (event.sourceType === "regulator") return "Regulator or oversight source";
  if (event.sourceType === "news") return "News or reporting source";
  if (event.sourceType === "social") return "Social or public reaction source";
  return "Company-side source";
}

export function eventTimelineLabel(event) {
  if (event.publishedAt) {
    return `Detected ${formatEventDate(event.detectedAt)} and pushed public ${formatEventDate(event.publishedAt)}.`;
  }

  return `Detected ${formatEventDate(event.detectedAt)} and still not public-feed official yet.`;
}

export function eventCardMeta(event) {
  return {
    icon: iconForType(event.type),
    reaction: reactionLabel(event.score),
    sourceLabel: sourceLabel(event),
    titleType: titleCase(event.type),
  };
}

export function sourceDetailsRows(event) {
  const details = event.sourceDetails || {};
  const rows = [];

  if (event.sourceType === "court") {
    if (event.plaintiff || event.defendant || details.plaintiff || details.defendant) {
      rows.push({
        label: "Parties",
        value: [event.plaintiff || details.plaintiff, event.defendant || details.defendant].filter(Boolean).join(" v. "),
      });
    }
    if (event.docketNumber || details.docketNumber) rows.push({ label: "Docket", value: event.docketNumber || details.docketNumber });
    if (event.court || details.court) rows.push({ label: "Court", value: event.court || details.court });
    if (details.courtCitationString) rows.push({ label: "Citation", value: details.courtCitationString });
    if (event.legalPosture || details.legalPosture) rows.push({ label: "Legal posture", value: event.legalPosture || details.legalPosture });
    if (event.sourcePublishedAt || details.sourcePublishedAt) {
      rows.push({ label: "Source published", value: formatEventDate(event.sourcePublishedAt || details.sourcePublishedAt) });
    }
    if (details.snippet) rows.push({ label: "Docket snippet", value: details.snippet });
  }

  if (event.sourceType === "regulator") {
    if (event.agency || details.agency) rows.push({ label: "Agency", value: event.agency || details.agency });
    if (details.source) rows.push({ label: "Source lane", value: details.source });
    if (event.sourcePublishedAt || details.sourcePublishedAt || details.publishedAt) {
      rows.push({
        label: "Source published",
        value: formatEventDate(event.sourcePublishedAt || details.sourcePublishedAt || details.publishedAt),
      });
    }
    if (details.description) rows.push({ label: "Excerpt", value: details.description });
  }

  if (event.sourceType === "news") {
    if (details.outlet) rows.push({ label: "Outlet", value: details.outlet });
    if (event.sourcePublishedAt || details.sourcePublishedAt || details.publishedAt) {
      rows.push({
        label: "Source published",
        value: formatEventDate(event.sourcePublishedAt || details.sourcePublishedAt || details.publishedAt),
      });
    }
    if (details.description) rows.push({ label: "Excerpt", value: details.description });
  }

  if (details.sourceUrl && details.sourceUrl !== event.sourceUrl) {
    rows.push({ label: "Source URL", value: details.sourceUrl });
  }

  return rows;
}

export function summarizeSourceDetails(event) {
  const rows = sourceDetailsRows(event);
  if (!rows.length) return "No structured source details were extracted yet.";
  return rows.map((row) => `${row.label}: ${row.value}`).join(" | ");
}
