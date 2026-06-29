function collapseWhitespace(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

const JARGON_REPLACEMENTS = [
  [/procedural posture/gi, "current stage of the case"],
  [/posture/gi, "stage"],
  [/adverse ruling/gi, "ruling that went against them"],
  [/merit immediate review/gi, "deserve a closer look"],
  [/jurisdiction/gi, "legal basis for being in this court"],
  [/cause of action/gi, "legal claim"],
  [/nature of suit/gi, "type of case"],
  [/docket/gi, "case number"],
  [/recap documents/gi, "court papers"],
];

export function cleanLegalJargon(value) {
  let next = collapseWhitespace(value);
  for (const [pattern, replacement] of JARGON_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

export function asSlangBlurb(value) {
  return collapseWhitespace(value)
    .replace(/\s*\.\s*/g, ". ")
    .trim();
}

export function asPlainExplanation(value) {
  return cleanLegalJargon(value)
    .replace(/\s*\.\s*/g, ". ")
    .trim();
}

export function prefixWhyItMatters(value) {
  const cleaned = collapseWhitespace(value);
  if (!cleaned) return "";
  return /^why it matters:/i.test(cleaned) ? cleaned : `Why it matters: ${cleaned}`;
}

export function joinSentences(...parts) {
  return parts
    .map((part) => collapseWhitespace(part))
    .filter(Boolean)
    .join(" ");
}
