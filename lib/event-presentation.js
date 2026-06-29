import { iconForType, reactionLabel, titleCase } from "./events";
import { asPlainExplanation, joinSentences } from "./copy-rules";

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

function humanListParties(event) {
  const details = event.sourceDetails || {};
  const plaintiff = event.plaintiff || details.plaintiff || "";
  const defendant = event.defendant || details.defendant || "";
  if (plaintiff && defendant) return `${plaintiff} sued ${defendant}`;
  if (plaintiff) return plaintiff;
  if (defendant) return defendant;
  return "";
}

function simplifyLeadDocumentDescription(value) {
  const text = (value || "")
    .replace(/\s+/g, " ")
    .replace(/\bSTATEWIDE\b/gi, "statewide")
    .replace(/\bCLASS ACTION COMPLAINT\b/gi, "class action complaint")
    .replace(/\bMOTION\b/gi, "request")
    .replace(/\bJOINT MOTION\b/gi, "joint request")
    .replace(/\bORDER\b/gi, "court order")
    .replace(/\bOPINION\b/gi, "judge opinion")
    .replace(/\bJUDGMENT\b/gi, "final court decision")
    .replace(/\bTEMPORARY RESTRAINING ORDER\b/gi, "emergency order")
    .replace(/\bPRELIMINARY INJUNCTION\b/gi, "request to temporarily block something")
    .replace(/\bto Transfer Case\b/gi, "to move the case")
    .trim();

  if (!text) return "";
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function plainLanguagePosture(posture) {
  const lower = (posture || "").toLowerCase();
  if (!lower) return "the case is active";
  if (lower.includes("complaint filed")) return "the lawsuit has been filed and is now officially on the court record";
  if (lower.includes("injunction")) return "someone is asking the judge to quickly block or force something before the full case is over";
  if (lower.includes("motion to dismiss")) return "one side is trying to get all or part of the case thrown out early";
  if (lower.includes("summary judgment")) return "one side is asking the judge to decide the case without a full trial";
  if (lower.includes("appeal")) return "the fight has moved up to an appeals court";
  if (lower.includes("court order or ruling")) return "the judge has already made at least one meaningful decision in the case";
  if (lower.includes("active lawsuit")) return "the lawsuit is live in court";
  return `the case is currently at the "${posture}" stage`;
}

function buildPlainCourtWhatHappened(event) {
  const details = event.sourceDetails || {};
  const parties = humanListParties(event);
  const court = event.court || details.court || details.courtCitationString || "court";
  const leadDoc = simplifyLeadDocumentDescription(details.leadDocumentDescription);

  if (event.type === "legal_loss") {
    if (parties) {
      return asPlainExplanation(
        `${parties}, and the court record suggests Kalshi just got hit by a setback in ${court}. This does not always mean Kalshi lost the whole case, but it does mean something important likely went against them.`
      );
    }

    return asPlainExplanation(
      `A court record tied to Kalshi suggests the judge went against Kalshi on an important point. This looks like a real setback, not just people arguing online.`
    );
  }

  if (leadDoc && parties) {
    return asPlainExplanation(
      `${parties} in ${court}. The first court papers describe it as ${leadDoc}, which is the clearest plain-English clue for what the case is about.`
    );
  }

  if (parties) {
    return asPlainExplanation(`${parties} in ${court}. This is a real lawsuit on the court record, not just a rumor or social-media complaint.`);
  }

  return asPlainExplanation(`This is a real court case involving Kalshi. The key point is that there is an actual lawsuit or court fight on the record.`);
}

function buildPlainCourtMeaning(event) {
  const details = event.sourceDetails || {};
  const sourcePublished = event.sourcePublishedAt || details.sourcePublishedAt || details.publishedAt || "";
  const publishedLine = sourcePublished ? ` The court record surfaced on ${formatEventDate(sourcePublished)}.` : "";

  if (event.severity === "major") {
    return asPlainExplanation(`For Kalshi, this could become a serious business or legal problem if the case keeps moving the wrong way.${publishedLine}`);
  }

  if (event.severity === "minor") {
    return asPlainExplanation(
      `For Kalshi, this looks more like a smaller bruise than a company-breaking event, but it still matters if more problems pile up.${publishedLine}`
    );
  }

  return asPlainExplanation(
    `For Kalshi, this is a real legal problem worth watching. It is not necessarily fatal on its own, but it can get worse if later rulings also go against them.${publishedLine}`
  );
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

  if (event.sourceType === "court") {
    return {
      whatHappened: buildPlainCourtWhatHappened(event),
      whatItMeans: buildPlainCourtMeaning(event),
    };
  }

  return {
    whatHappened: typeCopy[event.type],
    whatItMeans: severityCopy[event.severity],
  };
}

export function courtSpecificLead(event) {
  const details = event.sourceDetails || {};
  const sides =
    splitCaseTitle(details.caseName || details.caseNameShort || event.title) ||
    (event.plaintiff || event.defendant
      ? {
          plaintiff: event.plaintiff || details.plaintiff || "",
          defendant: event.defendant || details.defendant || "",
        }
      : null);
  const lowerTitle = `${event.title} ${details.snippet || ""} ${details.court || ""} ${details.courtCitationString || ""}`.toLowerCase();
  const kalshiIsDefendant = sides && /kalshi/.test((sides.defendant || "").toLowerCase());
  const kalshiIsPlaintiff = sides && /kalshi/.test((sides.plaintiff || "").toLowerCase());
  const court = event.court || details.court || details.courtCitationString || "the court docket";
  const posture = event.legalPosture || details.legalPosture || "active litigation";
  const sourcePublished = event.sourcePublishedAt || details.sourcePublishedAt || details.publishedAt || "";
  const publishedLine = sourcePublished ? ` The source record surfaced on ${formatEventDate(sourcePublished)}.` : "";
  const leadDoc = simplifyLeadDocumentDescription(details.leadDocumentDescription);
  const stage = plainLanguagePosture(posture);

  if (event.type === "legal_loss") {
    if (sides && kalshiIsDefendant) {
      return asPlainExplanation(
        `${sides.plaintiff} is suing Kalshi in ${court}. The important part for a normal reader is simple: the court record suggests Kalshi just got a setback in that case, even if the full lawsuit is still ongoing. Right now, ${stage}.${publishedLine}`
      );
    }

    if (sides && kalshiIsPlaintiff) {
      return asPlainExplanation(
        `Kalshi is the one that sued ${sides.defendant} in ${court}, but the court record suggests Kalshi may have lost an important point anyway. Right now, ${stage}.${publishedLine}`
      );
    }

    return asPlainExplanation(
      `${event.title} looks like more than just a lawsuit being filed. The court record suggests Kalshi took a real setback, and ${stage}.${publishedLine}`
    );
  }

  if (sides && kalshiIsDefendant) {
    return asPlainExplanation(
      `${sides.plaintiff} is suing Kalshi in ${court}. ${leadDoc ? `The first filing reads like ${leadDoc}. ` : ""}In plain English, this means there is a real court case on the record and ${stage}.${publishedLine}`
    );
  }

  if (sides && kalshiIsPlaintiff) {
    return asPlainExplanation(
      `Kalshi is the one suing ${sides.defendant} in ${court}. ${leadDoc ? `The first filing reads like ${leadDoc}. ` : ""}So this is Kalshi choosing to be in court, and ${stage}.${publishedLine}`
    );
  }

  if (lowerTitle.includes("in re ")) {
    return asPlainExplanation(
      `${event.title} is a named court matter tied to Kalshi, even if the case title is not in the normal "A v. B" format. The key point is that there is a real legal proceeding in ${court}, and ${stage}.${publishedLine}`
    );
  }

  return asPlainExplanation(
    `${event.title} is a real court matter involving Kalshi. ${leadDoc ? `The filings describe it as ${leadDoc}. ` : ""}The useful plain-English read is that ${stage}.${publishedLine}`
  );
}

export function eventDeepDive(event) {
  const details = event.sourceDetails || {};
  const sourcePublished = event.sourcePublishedAt || details.sourcePublishedAt || details.publishedAt || "";
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
    court: "This is based on an actual court record, which is stronger than a rumor, tweet, or vague article because there is real paperwork behind it.",
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

  const receiptFacts = [];
  if (event.plaintiff || event.defendant) receiptFacts.push(`Who is involved: ${[event.plaintiff, event.defendant].filter(Boolean).join(" vs. ")}`);
  if (event.court) receiptFacts.push(`Court: ${event.court}`);
  if (event.docketNumber) receiptFacts.push(`Docket: ${event.docketNumber}`);
  if (event.agency) receiptFacts.push(`Agency: ${event.agency}`);
  if (event.legalPosture) receiptFacts.push(`Case stage: ${plainLanguagePosture(event.legalPosture)}`);
  if (sourcePublished) receiptFacts.push(`Source date: ${formatEventDate(sourcePublished)}`);

  const summaryLine =
    event.sourceType === "court"
      ? ""
      : event.summary;

  return asPlainExplanation(
    joinSentences(typeSpecific[event.type], summaryLine, sourceSpecific[event.sourceType], receiptFacts.join(" | "), timing, severitySpecific[event.severity])
  );
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
