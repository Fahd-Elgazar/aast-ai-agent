import {
  ACADEMIC_ALIAS_GROUPS,
  DOMAIN_VOCABULARY,
  ONTOLOGY_EXACT_ENTITY_ALIASES,
  ONTOLOGY_QUERY_EXPANSION_RULES,
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
        semanticOnly: String(group.category || "").startsWith("ontology_"),
        pattern: boundaryPattern(alias),
      }))
    )
    .sort((a, b) => (b.alias.length - a.alias.length) || (b.canonical.length - a.canonical.length));
}

const ALIAS_RULES = buildAliasRules();
const VOCABULARY = [...new Set(DOMAIN_VOCABULARY.map((term) => term.toLowerCase()))];
const VOCABULARY_SET = new Set(VOCABULARY);

const EXPANSION_RULES = ONTOLOGY_QUERY_EXPANSION_RULES
  .map((rule) => ({
    ...rule,
    triggers: [rule.canonical, ...rule.expansions]
      .filter(Boolean)
      .map((term) => ({
        term,
        pattern: boundaryPattern(term),
      })),
  }));

const EXACT_ENTITY_RULES = ONTOLOGY_EXACT_ENTITY_ALIASES
  .flatMap((entity) =>
    [entity.canonical, entity.searchText, ...entity.aliases]
      .filter(Boolean)
      .map((surface) => ({
        intent: entity.intent,
        canonical: entity.canonical,
        searchText: entity.searchText || entity.canonical,
        surface,
        pattern: boundaryPattern(surface),
      }))
  )
  .sort((a, b) => b.surface.length - a.surface.length);

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
  const semanticAliasKeys = new Set();

  for (const rule of ALIAS_RULES) {
    normalized = normalized.replace(rule.pattern, (match, prefix, matchedAlias, offset, fullText) => {
      const aliasStart = offset + prefix.length;
      const existingCanonical = fullText.slice(aliasStart, aliasStart + rule.canonical.length);
      const charAfterCanonical = fullText.charAt(aliasStart + rule.canonical.length);
      if (
        rule.canonical.length > matchedAlias.length &&
        existingCanonical.toLowerCase() === rule.canonical.toLowerCase() &&
        !/[A-Za-z0-9]/.test(charAfterCanonical)
      ) {
        return match;
      }

      if (matchedAlias.toLowerCase() === rule.canonical.toLowerCase()) {
        return match;
      }

      if (rule.semanticOnly) {
        const semanticKey = `${rule.category}:${matchedAlias.toLowerCase()}:${rule.canonical.toLowerCase()}`;
        if (!semanticAliasKeys.has(semanticKey)) {
          semanticAliasKeys.add(semanticKey);
          corrections.push({
            type: "semantic_alias",
            category: rule.category,
            from: matchedAlias,
            to: rule.canonical,
          });
        }

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

function normalizeExpansionKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#\s-]/g, " ")
    .replace(/[\s-]+/g, " ")
    .trim();
}

function matchesExpansionRule(text, rule) {
  return rule.triggers.some((trigger) => {
    trigger.pattern.lastIndex = 0;
    return trigger.pattern.test(text);
  });
}

export function detectExactOntologyEntity(query) {
  const text = normalizeWhitespace(query);
  if (!text) return null;

  for (const rule of EXACT_ENTITY_RULES) {
    rule.pattern.lastIndex = 0;
    if (!rule.pattern.test(text)) continue;

    return {
      intent: rule.intent,
      canonical: rule.canonical,
      search_text: rule.searchText,
      matched_surface: rule.surface,
    };
  }

  return null;
}

function buildExpansionTerms(baseText) {
  const baseKey = normalizeExpansionKey(baseText);
  const expansionTerms = [];
  const matchedRules = [];
  const baseTokens = baseKey.split(" ").filter(Boolean);
  const seen = new Set(baseTokens);
  const baseHasExactTerm = (key) => {
    if (!key.includes(" ")) return baseTokens.includes(key);
    return baseKey.includes(key);
  };

  for (const rule of EXPANSION_RULES) {
    if (!matchesExpansionRule(baseText, rule)) continue;

    const added = [];
    for (const term of [rule.canonical, ...rule.expansions]) {
      const key = normalizeExpansionKey(term);
      if (!key || baseHasExactTerm(key) || seen.has(key)) continue;

      seen.add(key);
      expansionTerms.push(term);
      added.push(term);
    }

    matchedRules.push({
      category: rule.category,
      canonical: rule.canonical,
      added_terms: added,
    });
  }

  return {
    expansionTerms,
    matchedRules,
  };
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

export function expandAcademicQuery(query) {
  const normalization = normalizeAcademicQuery(query);
  const baseText = normalization.normalized || normalizeWhitespace(query);
  const exactEntity =
    detectExactOntologyEntity(baseText) ||
    detectExactOntologyEntity(normalization.original);

  if (exactEntity) {
    return {
      original: normalization.original,
      normalized: baseText,
      expanded: exactEntity.search_text,
      changed: exactEntity.search_text !== baseText,
      expansions: [],
      expansion_count: 0,
      normalization,
      exact_entity: exactEntity,
    };
  }

  const { expansionTerms, matchedRules } = buildExpansionTerms(baseText);
  const expanded = normalizeWhitespace([baseText, ...expansionTerms].filter(Boolean).join(" "));

  return {
    original: normalization.original,
    normalized: baseText,
    expanded,
    changed: expanded !== baseText,
    expansions: matchedRules,
    expansion_count: expansionTerms.length,
    normalization,
  };
}

export default {
  detectExactOntologyEntity,
  expandAcademicQuery,
  normalizeAcademicQuery,
  normalizeAcademicQueryText,
};
