const DEFAULT_TITLE = "New Chat";
const MAX_TITLE_LENGTH = 56;

const ACRONYMS = new Map([
  ["aaast", "AAST"],
  ["aast", "AAST"],
  ["ai", "AI"],
  ["ml", "ML"],
  ["gpa", "GPA"],
  ["it", "IT"],
  ["cs", "CS"],
  ["ucla", "UCLA"],
  ["uclan", "UCLan"],
  ["faq", "FAQ"]
]);

const TRIVIAL_PATTERNS = [
  /^(hi|hello|hey|yo|thanks|thank you|ok|okay|yes|no)$/i,
  /^(good morning|good afternoon|good evening)$/i
];

const PREFIX_PATTERNS = [
  /^please\s+/i,
  /^can you\s+/i,
  /^could you\s+/i,
  /^would you\s+/i,
  /^i want to know\s+/i,
  /^i need to know\s+/i,
  /^tell me about\s+/i,
  /^explain\s+/i,
  /^what\s+(are|is|was|were|do|does|did)\s+/i,
  /^how\s+(do|does|can|could|would|should|to)\s+/i,
  /^which\s+(are|is)\s+/i,
  /^where\s+(are|is)\s+/i,
  /^when\s+(are|is|do|does)\s+/i,
  /^why\s+(are|is|do|does)\s+/i
];

export { DEFAULT_TITLE };

export function generateConversationTitle(input) {
  if (!isMeaningfulTitleSeed(input)) return null;

  let title = String(input)
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  title = title.split(/[.!?\n\r]/)[0]?.trim() || title;

  for (const pattern of PREFIX_PATTERNS) {
    title = title.replace(pattern, "").trim();
  }

  title = title
    .replace(/^the\s+/i, "")
    .replace(/[^\p{L}\p{N}\s&/'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!title) return null;

  title = titleCase(title);
  return truncateTitle(title);
}

export function isMeaningfulTitleSeed(input) {
  if (typeof input !== "string") return false;
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (TRIVIAL_PATTERNS.some(pattern => pattern.test(normalized))) return false;

  const alphaNumeric = normalized.replace(/[^\p{L}\p{N}]/gu, "");
  return alphaNumeric.length >= 2;
}

function titleCase(value) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map(word => {
      const clean = word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "").toLowerCase();
      if (ACRONYMS.has(clean)) return ACRONYMS.get(clean);
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function truncateTitle(value) {
  if (value.length <= MAX_TITLE_LENGTH) return value;

  const candidate = value.slice(0, MAX_TITLE_LENGTH).replace(/\s+\S*$/, "").trim();
  return candidate.length >= 12 ? candidate : value.slice(0, MAX_TITLE_LENGTH).trim();
}
