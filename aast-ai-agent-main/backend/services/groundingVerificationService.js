const STATUS = Object.freeze({
  FULLY_SUPPORTED: "fully_supported",
  PARTIALLY_SUPPORTED: "partially_supported",
  UNSUPPORTED: "unsupported",
  CONFLICTING: "conflicting",
  NONFACTUAL: "nonfactual"
});

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "both", "by", "can", "for",
  "from", "has", "have", "in", "is", "it", "of", "on", "or", "that", "the",
  "their", "this", "to", "was", "were", "while", "with", "you", "your"
]);

const TOKEN_EQUIVALENTS = Object.freeze({
  taught: "teach",
  teaches: "teach",
  teaching: "teach",
  prerequisite: "require",
  prerequisites: "require",
  required: "require",
  requires: "require",
  requiring: "require",
  includes: "include",
  included: "include",
  including: "include",
  offers: "offer",
  offered: "offer",
  leads: "lead",
  careers: "career",
  roles: "role",
  recommended: "recommend",
  recommends: "recommend",
  heads: "head",
  headed: "head",
  dean: "dean",
  credits: "credit",
  years: "year",
  programmes: "program",
  programme: "program",
  programs: "program",
  courses: "course"
});

const RELATION_FAMILIES = Object.freeze([
  {
    type: "teaching",
    relations: ["TEACHES"],
    pattern: /\b(teach|teaches|taught|teaching|instructs?)\b/i
  },
  {
    type: "prerequisite",
    relations: ["HAS_PREREQUISITE", "REQUIRES", "PREREQUISITE_FOR"],
    pattern: /\b(prerequisite|prerequisites|required|requires|must complete|before taking)\b/i
  },
  {
    type: "course_sequence",
    relations: ["RECOMMENDED_AFTER"],
    pattern: /\b(recommended after|take after|follow(?:s|ed)?|comes after)\b/i
  },
  {
    type: "career",
    relations: ["LEADS_TO", "CAREER_ALIGNMENT"],
    pattern: /\b(lead to|leads to|career|careers|career role|job|jobs)\b/i
  },
  {
    type: "leadership",
    relations: ["DEAN_OF"],
    pattern: /\b(dean of|college dean|serves as dean)\b/i
  },
  {
    type: "role",
    relations: ["HEAD_OF", "HEAD_OF_UNIT", "HAS_ROLE", "ACTS_AS", "MANAGES"],
    pattern: /\b(head of|heads|role|serves as|manages)\b/i
  },
  {
    type: "program_course",
    relations: ["HAS_COURSE"],
    pattern: /\b(program|curriculum)\b.*\b(include|includes|course|courses)\b|\bincludes the .+ course\b/i
  },
  {
    type: "degree_program",
    relations: ["INCLUDES_PROGRAM", "OFFERS"],
    pattern: /\b(degree|bachelor|bsc|college)\b.*\b(include|includes|offer|offers|program|programs)\b/i
  }
]);

function cleanText(value, limit = 6000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function normalizeRelation(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function canonicalToken(token) {
  const normalized = String(token || "").toLowerCase().replace(/[^a-z0-9+#]/g, "");
  return TOKEN_EQUIVALENTS[normalized] || normalized;
}

function meaningfulTokens(value) {
  return cleanText(value)
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .map(canonicalToken)
    .filter(token => token.length > 1 && !STOPWORDS.has(token));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractNumbers(value) {
  const text = cleanText(value).toLowerCase();
  const wordNumbers = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10"
  };
  const numeric = text.match(/\b\d+(?:\.\d+)?%?\b/g) || [];
  const written = (text.match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g) || [])
    .map(number => wordNumbers[number]);
  return unique([...numeric, ...written]);
}

function extractCourseCodes(value) {
  return unique(
    (cleanText(value).match(/\b[A-Z]{2,6}\s*-?\s*\d{3,4}\b/g) || [])
      .map(code => code.replace(/\s*-\s*|\s+/g, "").toUpperCase())
  );
}

function splitSentences(answer) {
  return String(answer || "")
    .split(/\n+|(?<=[.!?])\s+/)
    .map(sentence => sentence.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);
}

function isNonfactualSentence(sentence) {
  const text = cleanText(sentence).toLowerCase();
  return (
    /^(thanks|thank you|you re welcome|hello|hi|got it|okay)\b/.test(text) ||
    /^(would you like|do you want|feel free|i can also help|let me know)\b/.test(text) ||
    /^(i do not have enough verified information|i don t have enough verified information)\b/.test(text) ||
    text.endsWith("?")
  );
}

function normalizeEntityRef(value, fallbackType = null) {
  if (!value) return null;
  const raw = typeof value === "string" ? { name: value } : value;
  const name = cleanText(raw.name || raw.displayValue || raw.value || raw.label, 240);
  if (!name) return null;
  return {
    id: cleanText(raw.id, 260) || null,
    name,
    type: cleanText(raw.type || fallbackType, 80) || null
  };
}

function extractStructuredEvidence(item) {
  const metadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const direct = item?.evidence && typeof item.evidence === "object" ? item.evidence : null;
  const subject = normalizeEntityRef(
    direct?.subject || metadata.evidence_subject ||
    (item?.relSourceName ? { name: item.relSourceName, type: item.relSourceLabel } : null)
  );
  const object = normalizeEntityRef(
    direct?.object || metadata.evidence_object ||
    (item?.relTargetName ? { name: item.relTargetName, type: item.relTargetLabel } : null)
  );
  const relation = normalizeRelation(
    direct?.relation || metadata.evidence_relation || item?.relType
  );
  if (!subject || !object || !relation) return null;
  return { subject, relation, object };
}

export function normalizeGroundingEvidence(evidence = []) {
  const items = Array.isArray(evidence) ? evidence : [evidence];
  return items
    .map((item, index) => {
      if (!item) return null;
      const raw = typeof item === "string" ? { text: item } : item;
      const metadata = raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
      const structured = extractStructuredEvidence(raw);
      const text = cleanText(
        typeof item === "string"
          ? item
          : typeof raw.evidence === "string"
            ? raw.evidence
            : raw.text || raw.content || raw.answer || raw.passage || raw.recommendation
      );
      if (!text && !structured) return null;
      const evidenceId = cleanText(
        raw.evidence_id ||
        metadata.evidence_id ||
        (typeof raw.evidence === "object" ? raw.evidence.evidence_id : null) ||
        `${raw.source || metadata.source || "evidence"}:${index + 1}`,
        320
      );
      const source = cleanText(
        raw.source_type || raw.source || metadata.source || metadata.provenance || "unknown",
        120
      );
      const combinedText = [
        text,
        structured?.subject.name,
        structured?.relation,
        structured?.object.name
      ].filter(Boolean).join(" ");
      return {
        evidence_id: evidenceId,
        text,
        source,
        structured,
        tokens: new Set(meaningfulTokens(combinedText)),
        numbers: new Set(extractNumbers(combinedText)),
        course_codes: new Set(extractCourseCodes(combinedText)),
        conflicting: raw.conflicting === true || raw.conflict === true || metadata.conflicting === true,
        conflict_group: cleanText(raw.conflict_group || metadata.conflict_group, 160) || null
      };
    })
    .filter(Boolean);
}

function inferClaimProfile(sentence) {
  const families = RELATION_FAMILIES.filter(candidate => candidate.pattern.test(sentence));
  const family = families[0] || null;
  const numbers = extractNumbers(sentence);
  const courseCodes = extractCourseCodes(sentence);
  const negated = /\b(no|not|never|doesn t|doesn't|isn t|isn't|without|none)\b/i.test(sentence);
  const comparison = /\b(more|less|stronger|weaker|better|different|difference|while|whereas|compared|both)\b/i.test(sentence);
  const directionalComparison = /\b(more|less|stronger|weaker|better|worse|highest|lowest)\b/i.test(sentence);
  const requirement = /\b(must|required|requires|requirement|prerequisite|before taking|eligible|eligibility)\b/i.test(sentence);
  const claimTypes = unique([
    ...families.map(item => item.type),
    numbers.length ? "numeric" : null,
    courseCodes.length ? "course_code" : null,
    negated ? "negation" : null,
    comparison ? "comparison" : null,
    requirement ? "requirement" : null
  ]);
  return {
    family,
    families,
    numbers,
    courseCodes,
    negated,
    comparison,
    directionalComparison,
    requirement,
    claimTypes
  };
}

function relationCandidates(profile, evidence) {
  if (!profile.family) return evidence;
  const allowed = new Set(profile.families.flatMap(family => family.relations));
  const structured = evidence.filter(item => allowed.has(item.structured?.relation));
  const textual = evidence.filter(item => {
    if (item.structured) return false;
    return profile.families.some(family => family.pattern.test(item.text));
  });
  return [...structured, ...textual];
}

function entityMentionScore(sentenceTokens, entityName) {
  const entityTokens = unique(meaningfulTokens(entityName));
  if (entityTokens.length === 0) return 0;
  const matches = entityTokens.filter(token => sentenceTokens.has(token)).length;
  return matches / entityTokens.length;
}

function candidateMatchesNamedEndpoints(sentence, item) {
  if (!item.structured) return true;
  const sentenceTokens = new Set(meaningfulTokens(sentence));
  const subjectScore = entityMentionScore(sentenceTokens, item.structured.subject.name);
  const objectScore = entityMentionScore(sentenceTokens, item.structured.object.name);
  return subjectScore >= 0.5 && objectScore >= 0.5;
}

function hasAllCriticalValues(profile, candidates) {
  const evidenceNumbers = new Set(candidates.flatMap(item => [...item.numbers]));
  const evidenceCodes = new Set(candidates.flatMap(item => [...item.course_codes]));
  if (profile.numbers.some(number => !evidenceNumbers.has(number))) return false;
  if (profile.courseCodes.some(code => !evidenceCodes.has(code))) return false;

  if (profile.negated) {
    return candidates.some(item =>
      /\b(no|not|never|doesn t|doesn't|isn t|isn't|without|none)\b/i.test(item.text)
    );
  }
  if (profile.directionalComparison) {
    return candidates.some(item =>
      item.structured?.relation === "COMPARES_WITH" ||
      /\b(more|less|stronger|weaker|better|worse|highest|lowest)\b/i.test(item.text)
    );
  }
  return true;
}

function tokenCoverage(sentence, candidates) {
  const claimTokens = unique(meaningfulTokens(sentence));
  if (claimTokens.length === 0) return 1;
  const evidenceTokens = new Set(candidates.flatMap(item => [...item.tokens]));
  const covered = claimTokens.filter(token => evidenceTokens.has(token)).length;
  return covered / claimTokens.length;
}

function detectCandidateConflict(candidates, profile) {
  if (candidates.some(item => item.conflicting)) return true;
  const explicitGroups = new Map();
  for (const item of candidates.filter(candidate => candidate.conflict_group)) {
    const values = explicitGroups.get(item.conflict_group) || new Set();
    for (const number of item.numbers) values.add(number);
    explicitGroups.set(item.conflict_group, values);
  }
  if ([...explicitGroups.values()].some(values => values.size > 1)) return true;

  if (profile.numbers.length > 0 && candidates.length > 1) {
    const structuredKeys = new Map();
    for (const item of candidates.filter(candidate => candidate.structured)) {
      const key = `${item.structured.subject.name}|${item.structured.relation}`;
      const values = structuredKeys.get(key) || new Set();
      values.add(item.structured.object.name);
      structuredKeys.set(key, values);
    }
    if ([...structuredKeys.values()].some(values => values.size > 1)) return true;
  }
  return false;
}

export function verifyGroundedSentence(sentence, evidence = []) {
  const text = cleanText(sentence);
  if (!text || isNonfactualSentence(text)) {
    return {
      sentence: text,
      factual: false,
      status: STATUS.NONFACTUAL,
      evidence_ids: [],
      claim_types: [],
      coverage: 1,
      reasons: []
    };
  }

  const normalizedEvidence = evidence.length > 0 && evidence[0]?.tokens instanceof Set
    ? evidence
    : normalizeGroundingEvidence(evidence);
  const profile = inferClaimProfile(text);
  const relationScoped = relationCandidates(profile, normalizedEvidence);
  const endpointScoped = profile.family
    ? relationScoped.filter(item => candidateMatchesNamedEndpoints(text, item))
    : relationScoped;
  const candidates = endpointScoped.length > 0
    ? endpointScoped
    : relationScoped.filter(item => !item.structured);
  const coverage = tokenCoverage(text, candidates);
  const criticalValuesSupported = hasAllCriticalValues(profile, candidates);
  const relationSupported =
    !profile.family ||
    profile.families.every(family =>
      candidates.some(item =>
        family.relations.includes(item.structured?.relation) ||
        (!item.structured && family.pattern.test(item.text))
      )
    );
  const conflict = detectCandidateConflict(candidates, profile);

  let status = STATUS.UNSUPPORTED;
  const reasons = [];
  if (conflict) {
    status = STATUS.CONFLICTING;
    reasons.push("CONFLICTING_EVIDENCE");
  } else if (relationSupported && criticalValuesSupported && coverage >= 0.68) {
    status = STATUS.FULLY_SUPPORTED;
  } else if (candidates.length > 0 && coverage >= 0.35) {
    status = STATUS.PARTIALLY_SUPPORTED;
    if (!relationSupported) reasons.push("RELATION_NOT_SUPPORTED");
    if (!criticalValuesSupported) reasons.push("CRITICAL_VALUE_NOT_SUPPORTED");
    if (coverage < 0.68) reasons.push("INSUFFICIENT_LEXICAL_COVERAGE");
  } else {
    if (!relationSupported) reasons.push("RELATION_NOT_SUPPORTED");
    if (!criticalValuesSupported) reasons.push("CRITICAL_VALUE_NOT_SUPPORTED");
    if (candidates.length === 0) reasons.push("NO_ALIGNED_EVIDENCE");
    if (coverage < 0.68) reasons.push("INSUFFICIENT_LEXICAL_COVERAGE");
  }

  return {
    sentence: text,
    factual: true,
    status,
    evidence_ids: unique(candidates.map(item => item.evidence_id)),
    contributing_sources: unique(candidates.map(item => item.source)),
    claim_types: profile.claimTypes,
    coverage: Number(coverage.toFixed(3)),
    reasons: unique(reasons)
  };
}

export function verifyGroundedAnswer({
  answer,
  evidence = [],
  conversationHistory = []
} = {}) {
  const startedAt = performance.now();
  const normalizedEvidence = normalizeGroundingEvidence(evidence);
  const sentenceResults = splitSentences(answer)
    .map(sentence => verifyGroundedSentence(sentence, normalizedEvidence));
  const factual = sentenceResults.filter(result => result.factual);
  const conflicting = factual.filter(result => result.status === STATUS.CONFLICTING);
  const unsupported = factual.filter(result => result.status === STATUS.UNSUPPORTED);
  const partial = factual.filter(result => result.status === STATUS.PARTIALLY_SUPPORTED);
  const supported = factual.filter(result => result.status === STATUS.FULLY_SUPPORTED);

  let status = STATUS.FULLY_SUPPORTED;
  if (conflicting.length > 0) status = STATUS.CONFLICTING;
  else if (unsupported.length > 0 && supported.length === 0 && partial.length === 0) status = STATUS.UNSUPPORTED;
  else if (unsupported.length > 0 || partial.length > 0) status = STATUS.PARTIALLY_SUPPORTED;
  else if (factual.length === 0) status = STATUS.NONFACTUAL;

  return {
    status,
    grounded: status === STATUS.FULLY_SUPPORTED || status === STATUS.NONFACTUAL,
    sentence_results: sentenceResults,
    evidence_ids: unique(sentenceResults.flatMap(result => result.evidence_ids || [])),
    contributing_sources: unique(sentenceResults.flatMap(result => result.contributing_sources || [])),
    unsupported_sentences: unsupported.map(result => result.sentence),
    partially_supported_sentences: partial.map(result => result.sentence),
    conflicting_sentences: conflicting.map(result => result.sentence),
    nonfactual_sentences: sentenceResults
      .filter(result => result.status === STATUS.NONFACTUAL)
      .map(result => result.sentence),
    factual_sentence_count: factual.length,
    supported_sentence_count: supported.length,
    conversation_history_used_as_evidence: false,
    conversation_history_items_ignored: Array.isArray(conversationHistory) ? conversationHistory.length : 0,
    latency_ms: Number((performance.now() - startedAt).toFixed(3))
  };
}

export { STATUS as GROUNDING_STATUS };

export default {
  normalizeGroundingEvidence,
  verifyGroundedAnswer,
  verifyGroundedSentence
};
