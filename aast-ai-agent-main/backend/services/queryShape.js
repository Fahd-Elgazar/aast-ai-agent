export function isCourseByTopicLookup(input) {
  const normalized = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return /\b(?:which|what)\s+courses?\s+(?:teaches?|covers?|includes?|contains?)\b/.test(normalized);
}
