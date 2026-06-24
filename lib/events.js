export const STATUS_OPTIONS = ["confirmed", "developing", "review", "rejected"];
export const TYPE_OPTIONS = ["lawsuit", "legal_loss", "regulatory", "bad_press", "pr_incident"];
export const SOURCE_OPTIONS = ["court", "regulator", "news", "social", "company"];
export const SEVERITY_OPTIONS = ["major", "notable", "minor"];

export function reactionLabel(score) {
  if (score >= 80) return "cooked";
  if (score >= 60) return "grim";
  if (score >= 40) return "yikes";
  return "mild";
}

export function titleCase(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function iconForType(type) {
  return {
    lawsuit: "Suit",
    legal_loss: "Cooked",
    regulatory: "Heat",
    bad_press: "Ratio",
    pr_incident: "Mess",
  }[type] || "Event";
}

export function computeScore(type, severity, sourceType) {
  const typeWeights = {
    lawsuit: 26,
    legal_loss: 34,
    regulatory: 30,
    bad_press: 18,
    pr_incident: 14,
  };
  const severityWeights = {
    major: 38,
    notable: 24,
    minor: 12,
  };
  const sourceWeights = {
    court: 24,
    regulator: 22,
    news: 12,
    social: 4,
    company: 8,
  };

  return Math.min(99, typeWeights[type] + severityWeights[severity] + sourceWeights[sourceType]);
}

export function confidenceFor(sourceType, status) {
  const base = {
    court: 92,
    regulator: 88,
    news: 78,
    company: 70,
    social: 44,
  }[sourceType] || 60;

  if (status === "review") return Math.max(35, base - 18);
  if (status === "developing") return Math.max(45, base - 10);
  return base;
}

export function sortEvents(events) {
  return [...events].sort((a, b) => {
    const aDate = new Date(a.publishedAt || a.detectedAt).getTime();
    const bDate = new Date(b.publishedAt || b.detectedAt).getTime();
    return bDate - aDate;
  });
}

export function statsFor(events) {
  const confirmed = events.filter((item) => item.status === "confirmed").length;
  const review = events.filter((item) => item.status === "review").length;
  const major = events.filter((item) => item.severity === "major" && item.status !== "rejected").length;
  const averageConfidence = events.length
    ? Math.round(events.reduce((sum, item) => sum + item.confidence, 0) / events.length)
    : 0;

  return [
    { label: "Confirmed Ls", value: confirmed },
    { label: "Needs review", value: review },
    { label: "Major flags", value: major },
    { label: "Cope score", value: `${averageConfidence}%` },
  ];
}
