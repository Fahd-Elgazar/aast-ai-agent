const ACADEMIC_KEYWORDS = [
  "admission",
  "advisor",
  "course",
  "dean",
  "department",
  "fee",
  "gpa",
  "grading",
  "major",
  "office",
  "policy",
  "prerequisite",
  "professor",
  "scholarship",
  "syllabus",
  "teacher",
  "transfer",
  "tuition",
  "calendar"
];

const MULTI_INTENT_DEFINITIONS = [
  {
    key: "prerequisites",
    label: "prerequisites",
    retrieval: "KG",
    kgIntent: "PREREQUISITE",
    queryTerm: "prerequisites",
    patterns: [/\b(prerequisite|prerequisites|prereq|pre\s*requisite|required before)\b/i]
  },
  {
    key: "grading",
    label: "grading",
    retrieval: "RAG",
    queryTerm: "grading policy",
    patterns: [/\b(grading|grade|grades|marks|gpa|cgpa|assessment)\b/i]
  },
  {
    key: "fees",
    label: "fees",
    retrieval: "RAG",
    queryTerm: "fees",
    patterns: [/\b(fee|fees|tuition|payment|cost|charges)\b/i]
  },
  {
    key: "office",
    label: "office",
    retrieval: "KG",
    kgIntent: "PERSON",
    queryTerm: "office",
    patterns: [/\b(office|room|location)\b/i]
  },
  {
    key: "transfer",
    label: "transfer policy",
    retrieval: "RAG",
    queryTerm: "transfer policy",
    patterns: [/\b(transfer|credit transfer|switch major|change major|equivalency)\b/i]
  },
  {
    key: "scholarship",
    label: "scholarship",
    retrieval: "RAG",
    queryTerm: "scholarship requirements",
    patterns: [/\b(scholarship|financial aid|tuition exemption|discount|grant|eligibility)\b/i]
  },
  {
    key: "syllabus",
    label: "recorded syllabus",
    retrieval: "KG",
    kgIntent: "CURRICULUM",
    queryTerm: "syllabus",
    patterns: [/\b(syllabus|course outline|weekly topics?|week schedule|recorded syllabus)\b/i]
  },
  {
    key: "calendar",
    label: "official calendar policy",
    retrieval: "RAG",
    queryTerm: "official academic calendar",
    patterns: [/\b(academic calendar|official calendar|calendar policy)\b/i]
  }
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[?!.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value, limit = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : "";
}

function tokenCount(value) {
  return cleanText(value, 600).split(/\s+/).filter(Boolean).length;
}

function hasAcademicKeyword(text) {
  const lower = normalizeText(text);
  return ACADEMIC_KEYWORDS.some(keyword => lower.includes(keyword));
}

function formatList(items) {
  const values = [...new Set(items.map(item => cleanText(item, 90)).filter(Boolean))];
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function isPersonEntity(entity) {
  const type = normalizeText(entity?.type);
  return ["person", "professor", "instructor", "staff", "teachingstaff", "faculty"].includes(type);
}

function isCourseEntity(entity) {
  const type = normalizeText(entity?.type);
  return ["course", "subject", "module"].includes(type);
}

function isProgramEntity(entity) {
  const type = normalizeText(entity?.type);
  return ["program", "major", "specialization", "specialisation", "track"].includes(type);
}

function isCompatibleEntity(entity, preferred = "any") {
  if (!entity) return false;
  if (preferred === "person") return isPersonEntity(entity);
  if (preferred === "course") return isCourseEntity(entity);
  if (preferred === "program") return isProgramEntity(entity);
  return Boolean(cleanText(entity.displayValue || entity.value || entity.name, 120));
}

function normalizeChoiceEntity(entity, source = "memory") {
  if (!entity || typeof entity !== "object") return null;
  const value = cleanText(
    entity.displayValue || entity.value || entity.name || entity.canonicalValue,
    140
  );
  if (!value) return null;
  return {
    ...entity,
    type: entity.type || "entity",
    value,
    displayValue: value,
    source: entity.evidenceSource || entity.source || source
  };
}

function dedupeChoiceEntities(entities) {
  const seen = new Set();
  const result = [];
  for (const entity of entities) {
    const normalized = normalizeChoiceEntity(entity);
    if (!normalized) continue;
    const key = `${normalizeText(normalized.type)}|${normalizeText(normalized.value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function getTypedEntities(memory = {}, preferred = "any", collection = "recentEntities") {
  const primary = Array.isArray(memory?.[collection]) ? memory[collection] : [];
  const fallback = memory?.lastEntity ? [memory.lastEntity] : [];
  return dedupeChoiceEntities(primary.length > 0 ? primary : fallback)
    .filter(entity => isCompatibleEntity(entity, preferred));
}

function getSelectedTargets(memory = {}, preferred = "any") {
  const selected = getTypedEntities(memory, preferred, "selectedTargets");
  if (selected.length > 0) return selected;
  return getTypedEntities(memory, preferred, "recentEntities");
}

function inferExpectedEntityType(query) {
  const text = normalizeText(query);
  if (/\b(program|programs|major|majors|career|careers)\b/.test(text)) return "program";
  if (/\b(course|courses|subject|subjects|module|modules|prerequisite|taking|recommended after)\b/.test(text)) return "course";
  if (/\b(professor|instructor|teacher|person|he|him|his|she|her)\b/.test(text)) return "person";
  return "any";
}

function inferReferenceSlot(query, memory = {}) {
  const text = normalizeText(query);
  if (!text) return null;

  if (/^(how|where) (do|can) i apply\b/.test(text) && hasActiveApplicationGoal(memory)) return "active_goal";
  if (/\b(the other one|other one|the other)\b/.test(text)) return "other";
  if (/\b(the first one|first one|the first|former)\b/.test(text)) return "ordinal_first";
  if (/\b(the second one|second one|the second|latter)\b/.test(text)) return "ordinal_second";
  if (/\b(those two|both of them|those programs|these programs)\b/.test(text)) return "plural_program";
  if (/\bwhich (?:one )?of (?:the|these|those) two\b/.test(text)) return "plural_program";
  if (/\b(what|where).*\b(his|her|their)\s+(office|room|location)\b/.test(text)) return "person_office";
  if (/\b(that professor|that instructor|that teacher|that doctor)\b/.test(text)) return "person";
  if (/\b(he|him|his|she|her)\b/.test(text)) return /\b(office|room|location)\b/.test(text) ? "person_office" : "person";
  if (/^(what about|tell me more about|more about)\s+(him|her)$/i.test(text)) return "person";
  if (/\b(that program|this program)\b/.test(text)) return "program";
  if (/\b(that course|this course|that subject|this subject)\b/.test(text)) return "course";
  if (/\b(after that|before that|taking it|take it|complete before it)\b/.test(text)) return "course";
  if (/\b(it|its|that|this)\b/.test(text) && /\b(course|prerequisite|prerequisites|grading|grade|fee|policy|requirements|tell me more|more about)\b/.test(text)) return "course";
  if (/\b(they|them|those)\b/.test(text)) return "plural";

  return null;
}

function hasActiveApplicationGoal(memory = {}) {
  const topics = [memory.lastTopic, ...(Array.isArray(memory.recentTopics) ? memory.recentTopics : [])]
    .map(normalizeText);
  const entities = [
    ...(Array.isArray(memory.recentEntities) ? memory.recentEntities : []),
    ...(Array.isArray(memory.selectedTargets) ? memory.selectedTargets : [])
  ];
  return (
    topics.some(topic => ["fees", "policy", "scholarship"].includes(topic)) ||
    entities.some(entity => /\b(scholarship|grant|financial aid)\b/.test(normalizeText(entity?.displayValue || entity?.value)))
  );
}

function buildResolvedQuery(query, slot, target, memory = {}) {
  const original = cleanText(query, 300);
  const targetText = Array.isArray(target) ? formatList(target) : cleanText(target, 140);
  if (!original || !targetText) return original;

  if (slot === "active_goal") {
    const scholarship = getTypedEntities(memory, "any")
      .find(entity => /\b(scholarship|grant|financial aid)\b/.test(normalizeText(entity.value)));
    return scholarship
      ? `How do I apply for ${scholarship.value}?`
      : "How do I apply for the scholarship discussed in this conversation?";
  }

  if (["ordinal_first", "ordinal_second", "other"].includes(slot)) {
    const selectionOnly = /^(?:(?:and|what about|how about) )?(?:(?:the )?(?:first|second|other)(?: one)?|(?:the )?(?:former|latter))$/.test(normalizeText(original));
    if (selectionOnly && normalizeText(memory.lastTopic) === "careers") {
      return `What careers can ${targetText} lead to?`;
    }
    return original
      .replace(/\b(the first one|first one|the first|former)\b/ig, targetText)
      .replace(/\b(the second one|second one|the second|latter)\b/ig, targetText)
      .replace(/\b(the other one|other one|the other)\b/ig, targetText)
      .replace(/^\s*and\s+/i, "");
  }

  if (slot === "person_office") {
    return `What is the office of ${targetText}?`;
  }

  if (slot === "person") {
    if (/\b(anything else|what else)\b/i.test(original) && /\bteach|teaches|teaching|taught\b/i.test(original)) {
      const previouslyDiscussedCourse = getTypedEntities(memory, "course")
        .find(entity => entity.relation === "TEACHES" && entity.relatedEntity?.displayValue === targetText);
      return previouslyDiscussedCourse
        ? `Besides ${previouslyDiscussedCourse.value}, what else does ${targetText} teach?`
        : `What else does ${targetText} teach?`;
    }
    if (/\bteach|teaches|teaching|taught\b/i.test(original)) return `What does ${targetText} teach?`;
    if (/\b(another role|other role|hold.*role)\b/i.test(original)) {
      return `What other role does ${targetText} hold at the college?`;
    }
    if (/\boffice|room|location\b/i.test(original)) return `What is the office of ${targetText}?`;
    return `Tell me more about ${targetText}.`;
  }

  if (slot === "course") {
    if (/\bweek\s+\d+\b/i.test(original) && /\b(?:that|this) (?:course|subject)\b/i.test(original)) {
      return original.replace(/\b(?:that|this) (?:course|subject)\b/ig, () => targetText);
    }
    if (/\b(recommended after|after that|take after|comes after)\b/i.test(original)) {
      return `Which course is recommended after ${targetText}${/\blanguage technology\b/i.test(original) ? " for language technology" : ""}?`;
    }
    if (/\b(before taking|must .*complete|complete before|required before)\b/i.test(original)) {
      return `What are the prerequisites for ${targetText}?`;
    }
    if (/\bgrading|grade|grades|marks|gpa\b/i.test(original)) return `${targetText} grading policy`;
    if (/\bprerequisite|prerequisites|requirements|required\b/i.test(original)) return `${targetText} prerequisites`;
    return `Tell me more about ${targetText}.`;
  }

  if (slot === "program") {
    return original.replace(/\b(that program|this program)\b/ig, targetText);
  }

  if (slot === "plural_program" || slot === "plural") {
    return original
      .replace(/\b(?:(?:the|these|those) two|both of them|those programs|these programs|them|those)\b/ig, targetText)
      .replace(/\bthey\b/ig, targetText)
      .replace(/\s+/g, " ")
      .trim();
  }

  return original;
}

function selectCourseTarget(query, memory = {}) {
  const candidates = getTypedEntities(memory, "course");
  const normalizedQuery = normalizeText(query);
  const curriculumCourse = cleanText(memory.lastCurriculumCourse, 120);
  const isRecentCurriculumWeek = memory.lastIntent === "CURRICULUM" &&
    /\bweek\s+\d+\b/.test(normalizedQuery);

  if (curriculumCourse && (isRecentCurriculumWeek || candidates.length === 0)) {
    return { target: curriculumCourse, candidates: [curriculumCourse], source: "lastCurriculumCourse" };
  }

  if (candidates.length === 0) {
    const subjects = Array.isArray(memory.recentSubjects) ? memory.recentSubjects : [];
    const fallback = cleanText(subjects[0], 120);
    return { target: fallback || null, candidates: fallback ? [fallback] : [], source: fallback ? "recentSubjects" : null };
  }

  const newestTurnId = candidates.find(entity => entity.turnId)?.turnId || null;
  const recent = newestTurnId
    ? candidates.filter(entity => entity.turnId === newestTurnId)
    : candidates.slice(0, 3);
  const dependencyFocus = recent.find(entity =>
    entity.relationRole === "source" &&
    ["HAS_PREREQUISITE", "REQUIRES", "PREREQUISITE_FOR"].includes(entity.relation) &&
    /\b(after that|before that|taking it|take it|complete before|recommended after)\b/.test(normalizedQuery)
  );
  if (dependencyFocus) {
    return { target: dependencyFocus.value, candidates: recent.map(entity => entity.value), source: dependencyFocus.source };
  }

  if (recent.length === 1) {
    return { target: recent[0].value, candidates: [recent[0].value], source: recent[0].source };
  }

  return {
    target: null,
    candidates: recent.map(entity => entity.value),
    source: recent[0]?.source || null,
    ambiguous: recent.length > 1
  };
}

function resolveTargetForSlot(slot, query, memory = {}) {
  if (slot === "person" || slot === "person_office") {
    const entity = getTypedEntities(memory, "person")[0];
    if (entity) return { target: entity.value, targetType: entity.type || "person", source: entity.source, candidates: [entity.value] };
    return { target: null, targetType: "person", source: null };
  }

  if (slot === "course") {
    return { ...selectCourseTarget(query, memory), targetType: "course" };
  }

  if (slot === "program") {
    const programs = getTypedEntities(memory, "program");
    return programs.length === 1
      ? { target: programs[0].value, targetType: "program", source: programs[0].source, candidates: [programs[0].value] }
      : { target: null, targetType: "program", source: programs[0]?.source || null, candidates: programs.map(entity => entity.value), ambiguous: programs.length > 1 };
  }

  if (["ordinal_first", "ordinal_second", "other"].includes(slot)) {
    const preferred = inferExpectedEntityType(query);
    const choices = getSelectedTargets(memory, preferred);
    const index = slot === "ordinal_first" ? 0 : 1;
    const selected = choices[index] || null;
    return {
      target: selected?.value || null,
      targetType: selected?.type || preferred,
      source: selected?.source || null,
      candidates: choices.map(entity => entity.value)
    };
  }

  if (slot === "plural_program" || slot === "plural") {
    const preferred = slot === "plural_program" ? "program" : inferExpectedEntityType(query);
    const choices = getSelectedTargets(memory, preferred).slice(0, 3);
    return {
      target: choices.map(entity => entity.value),
      targetType: preferred === "any" ? "entities" : `${preferred}s`,
      source: choices.length ? "selectedTargets" : null,
      candidates: choices.map(entity => entity.value)
    };
  }

  if (slot === "active_goal") {
    return {
      target: "the active scholarship application goal",
      targetType: "goal",
      source: "recentTopics",
      candidates: []
    };
  }

  return { target: null, targetType: "entity", source: null };
}

export function detectLightConversationalIntent(query, { conversationMemory = {} } = {}) {
  const text = normalizeText(query);
  if (!text) return null;

  const short = tokenCount(text) <= 6;
  if (/^(thanks|thank you|thx|appreciate it|okay thanks|ok thanks)$/i.test(text)) {
    return { type: "THANKS", confidence: 1, source: "deterministic_regex" };
  }

  if (short && /^(hi|hello|hey|good morning|good afternoon|good evening|salam|السلام عليكم)$/i.test(text)) {
    return { type: "GREETING", confidence: 1, source: "deterministic_regex" };
  }

  if (/^(ok|okay|alright|got it|understood)$/i.test(text)) {
    return { type: "ACKNOWLEDGEMENT", confidence: 0.95, source: "deterministic_regex" };
  }

  if (/^(what do you mean|what did you mean|can you clarify|clarify that|explain what you mean)$/i.test(text)) {
    return {
      type: "CLARIFY_PREVIOUS",
      confidence: 0.95,
      source: "deterministic_regex",
      hasPreviousAnswer: Boolean(cleanText(conversationMemory.lastAssistantSummary, 160))
    };
  }

  if (short && !hasAcademicKeyword(text) && /^(yes|no|maybe|sure)$/i.test(text)) {
    return { type: "LIGHT_ACK", confidence: 0.75, source: "deterministic_regex" };
  }

  return null;
}

export function buildLightConversationalResponse(intent, { conversationMemory = {} } = {}) {
  const type = typeof intent === "string" ? intent : intent?.type;

  if (type === "THANKS") return "You're welcome.";
  if (type === "GREETING") return "Hello. How can I help with AAST today?";
  if (type === "ACKNOWLEDGEMENT" || type === "LIGHT_ACK") return "Got it.";

  if (type === "CLARIFY_PREVIOUS") {
    const summary = cleanText(conversationMemory.lastAssistantSummary, 180);
    return summary
      ? `I meant this part: ${summary}`
      : "I was referring to the previous answer, but I do not have enough context to clarify it yet.";
  }

  return "I'm here.";
}

export function resolveFollowUpReference(query, conversationMemory = {}) {
  const originalQuery = cleanText(query, 300);
  const slot = inferReferenceSlot(query, conversationMemory);
  if (!slot) {
    return {
      detected: false,
      resolved: false,
      slot: null,
      originalQuery,
      standaloneQuery: originalQuery
    };
  }

  const { target, targetType, source, candidates = [], ambiguous = false } =
    resolveTargetForSlot(slot, query, conversationMemory);
  const hasTarget = Array.isArray(target) ? target.length > 0 : Boolean(cleanText(target, 140));

  if (!hasTarget || ambiguous) {
    return {
      detected: true,
      resolved: false,
      slot,
      target: null,
      targetType,
      source: null,
      candidates,
      originalQuery,
      standaloneQuery: null,
      clarification: buildFollowUpClarification(slot, candidates)
    };
  }

  const standaloneQuery = buildResolvedQuery(query, slot, target, conversationMemory);
  return {
    detected: true,
    resolved: true,
    slot,
    target,
    targetType,
    source,
    candidates,
    originalQuery,
    standaloneQuery,
    resolvedQuery: standaloneQuery,
    intentHint: slot === "person" || slot === "person_office" ? "PERSON" : "GENERAL",
    confidence: source === "verified_kg" ? 0.95 : 0.82
  };
}

export function buildFollowUpClarification(slot = "entity", candidates = []) {
  const names = [...new Set(
    (Array.isArray(candidates) ? candidates : [])
      .map(candidate => cleanText(candidate, 100))
      .filter(Boolean)
  )].slice(0, 3);
  if (names.length > 1) {
    const alternatives = names.length === 2
      ? `${names[0]} or ${names[1]}`
      : `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
    return `Do you mean ${alternatives}?`;
  }
  if (slot === "person" || slot === "person_office") {
    return "Which professor or staff member do you mean?";
  }
  if (slot === "course") {
    return "Which course do you mean?";
  }
  if (slot === "program" || slot.startsWith("ordinal") || slot === "other") {
    return "Which program do you mean?";
  }
  if (slot === "plural" || slot === "plural_program") {
    return "Which items from the previous answer do you want to continue with?";
  }
  return "Could you clarify what you are referring to?";
}

function matchesAnyDefinition(query, definition) {
  return definition.patterns.some(pattern => pattern.test(query));
}

function extractSubjectForMultiIntent(query, intents) {
  const original = cleanText(query, 260);
  const known = original.match(/\b(machine learning|natural language processing|artificial intelligence|deep learning|blockchain|mobile computing|computer vision|data science|software engineering|operating systems|information retrieval|AI\s*\d{3,4}|CS\s*\d{3,4}|[A-Z]{2,5}\s*\d{3,4})\b/i);
  if (known) return known[0].replace(/\s+/g, " ").trim();

  let subject = original;
  for (const intent of intents) {
    subject = subject.replace(new RegExp(`\\b${intent.key}\\b`, "ig"), " ");
    subject = subject.replace(new RegExp(`\\b${intent.label}\\b`, "ig"), " ");
    subject = subject.replace(new RegExp(`\\b${intent.queryTerm}\\b`, "ig"), " ");
  }

  subject = subject
    .replace(/\b(and|or|plus|with|about|for|what|who|where|which|is|are|the|a|an|tell me|show me|explain)\b/gi, " ")
    .replace(/\b(policy|requirements|required|course|program)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return subject || "";
}

export function detectAcademicMultiIntents(query) {
  const text = cleanText(query, 320);
  if (!text) return { isMultiIntent: false, intents: [], subject: "" };

  const intents = MULTI_INTENT_DEFINITIONS.filter(definition => matchesAnyDefinition(text, definition));
  const uniqueIntents = [];
  const seen = new Set();

  for (const intent of intents) {
    if (seen.has(intent.key)) continue;
    seen.add(intent.key);
    uniqueIntents.push(intent);
  }

  if (uniqueIntents.length < 2) {
    return { isMultiIntent: false, intents: uniqueIntents, subject: "" };
  }

  const subject = extractSubjectForMultiIntent(text, uniqueIntents);
  return {
    isMultiIntent: true,
    intents: uniqueIntents.slice(0, 4),
    subject,
    confidence: 0.9,
    source: "deterministic_keywords"
  };
}

export function buildIntentScopedQuery(baseQuery, intent, plan = {}) {
  const subject = cleanText(plan.subject, 140);
  if (subject) return `${subject} ${intent.queryTerm}`;
  return `${cleanText(baseQuery, 240)} ${intent.queryTerm}`;
}

export default {
  buildFollowUpClarification,
  buildIntentScopedQuery,
  buildLightConversationalResponse,
  detectAcademicMultiIntents,
  detectLightConversationalIntent,
  resolveFollowUpReference
};
