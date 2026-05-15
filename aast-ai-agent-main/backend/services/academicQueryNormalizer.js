import {
  ACADEMIC_ALIAS_GROUPS,
  DOMAIN_VOCABULARY,
} from "./academicAliases.js";

const MAX_QUERY_CHARS = Number(process.env.QUERY_NORMALIZER_MAX_CHARS || 600);
const FUZZY_ENABLED = process.env.QUERY_NORMALIZER_FUZZY !== "false";

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function boundaryPattern(alias) {
  const trimmedAlias = alias.trim();
  const parts = trimmedAlias.split(/[\s-]+/).filter(Boolean);
  const escaped = parts.length > 1
    ? parts.map(escapeRegExp).join("[\\s-]+")
    : escapeRegExp(trimmedAlias);

  return new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, "gi");
}

function buildAliasRules() {
  return ACADEMIC_ALIAS_GROUPS
    .flatMap((group) =>
      group.aliases.map((alias) => ({
        alias,
        canonical: group.canonical,
        category: group.category,
        pattern: boundaryPattern(alias),
      }))
    )
    .sort((a, b) => b.alias.length - a.alias.length);
}

const ALIAS_RULES = buildAliasRules();
const VOCABULARY = [...new Set(DOMAIN_VOCABULARY.map((term) => term.toLowerCase()))];
const VOCABULARY_SET = new Set(VOCABULARY);

function maxDistanceForToken(token) {
  if (token.length >= 10) return 2;
  if (token.length >= 7) return 1;
  return 0;
}

function levenshteinWithin(a, b, maxDistance) {
  if (Math.abs(a.length - b.length) > maxDistance) {
    return maxDistance + 1;
  }

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
      rowMin = Math.min(rowMin, current[j]);
    }

    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function findFuzzyCorrection(token) {
  const lower = token.toLowerCase();
  const maxDistance = maxDistanceForToken(lower);

  if (maxDistance === 0 || VOCABULARY_SET.has(lower) || /^\d+$/.test(lower)) {
    return null;
  }

  let best = null;
  let bestDistance = maxDistance + 1;
  let ties = 0;

  for (const candidate of VOCABULARY) {
    if (candidate[0] !== lower[0]) continue;

    const distance = levenshteinWithin(lower, candidate, maxDistance);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      ties = 0;
    } else if (distance === bestDistance) {
      ties += 1;
    }
  }

  if (!best || bestDistance > maxDistance || ties > 0) {
    return null;
  }

  return best;
}

function normalizeCourseCodes(text, corrections) {
  return text.replace(/\b([a-z]{2,5})[\s-]?(\d{3,4})\b/gi, (match, prefix, number) => {
    const replacement = `${prefix.toUpperCase()} ${number}`;
    if (replacement !== match) {
      corrections.push({
        type: "course_code_format",
        from: match,
        to: replacement,
      });
    }
    return replacement;
  });
}

function applyAliasRules(text, corrections) {
  let normalized = text;

  for (const rule of ALIAS_RULES) {
    normalized = normalized.replace(rule.pattern, (match, prefix, matchedAlias) => {
      if (matchedAlias.toLowerCase() === rule.canonical.toLowerCase()) {
        return match;
      }

      corrections.push({
        type: "alias",
        category: rule.category,
        from: matchedAlias,
        to: rule.canonical,
      });

      return `${prefix}${rule.canonical}`;
    });
  }

  return normalized;
}

function applyFuzzyCorrections(text, corrections) {
  if (!FUZZY_ENABLED) return text;

  return text.replace(/\b[A-Za-z][A-Za-z]+\b/g, (token) => {
    const correction = findFuzzyCorrection(token);
    if (!correction || correction === token.toLowerCase()) {
      return token;
    }

    corrections.push({
      type: "fuzzy",
      from: token,
      to: correction,
    });

    return correction;
  });
}

function compactDuplicateTerms(text) {
  return text
    .replace(/\b(requirements)\s+\1\b/gi, "$1")
    .replace(/\b(prerequisites)\s+\1\b/gi, "$1")
    .replace(/\b(scholarship)\s+\1\b/gi, "$1")
    .replace(/\b(registration)\s+\1\b/gi, "$1")
    .replace(/\b(transfer)\s+\1\b/gi, "$1");
}

export function normalizeAcademicQuery(query) {
  const original = typeof query === "string" ? query : "";
  const corrections = [];

  if (!original.trim()) {
    return {
      original,
      normalized: "",
      changed: false,
      corrections,
      correction_count: 0,
    };
  }

  const boundedOriginal = original.slice(0, MAX_QUERY_CHARS);
  let normalized = normalizeWhitespace(boundedOriginal)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");

  normalized = normalizeCourseCodes(normalized, corrections);
  normalized = applyAliasRules(normalized, corrections);
  normalized = applyFuzzyCorrections(normalized, corrections);
  normalized = compactDuplicateTerms(normalized);
  normalized = normalizeWhitespace(normalized);

  return {
    original,
    normalized,
    changed: normalized !== normalizeWhitespace(boundedOriginal),
    corrections,
    correction_count: corrections.length,
  };
}

export function normalizeAcademicQueryText(query) {
  return normalizeAcademicQuery(query).normalized;
}

export default {
  normalizeAcademicQuery,
  normalizeAcademicQueryText,
};
