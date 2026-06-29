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
  "teacher",
  "transfer",
  "tuition"
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
  return ["person", "professor", "instructor", "staff", "teachingstaff", "entity"].includes(type);
}

function isCourseEntity(entity) {
  const type = normalizeText(entity?.type);
  return ["course", "subject", "program"].includes(type);
}

function getMemoryEntity(memory = {}, preferred = "any") {
  const entity = memory?.lastEntity;
  if (!entity?.value) return null;

  if (preferred === "person" && !isPersonEntity(entity)) return null;
  if (preferred === "course" && !isCourseEntity(entity)) return null;

  return {
    type: entity.type || "entity",
    value: cleanText(entity.value, 120),
    source: entity.source || "memory"
  };
}

function getRecentSubject(memory = {}) {
  const subjects = Array.isArray(memory.recentSubjects) ? memory.recentSubjects : [];
  return cleanText(subjects[0], 120);
}

function getPluralSubjects(memory = {}) {
  const subjects = Array.isArray(memory.recentSubjects) ? memory.recentSubjects : [];
  return subjects.map(subject => cleanText(subject, 90)).filter(Boolean).slice(0, 3);
}

function inferReferenceSlot(query) {
  const text = normalizeText(query);
  if (!text) return null;

  if (/\b(what|where).*\b(his|her|their)\s+(office|room|location)\b/.test(text)) return "person_office";
  if (/\b(that professor|that instructor|that teacher|that doctor)\b/.test(text)) return "person";
  if (/\b(he|him|his|she|her)\b/.test(text)) return /\b(office|room|location)\b/.test(text) ? "person_office" : "person";
  if (/^(what about|tell me more about|more about)\s+(him|her)$/i.test(text)) return "person";
  if (/\b(that course|this course|that subject|this subject|that program|this program)\b/.test(text)) return "course";
  if (/\b(it|its|that|this)\b/.test(text) && /\b(course|prerequisite|grading|grade|fee|policy|requirements|tell me more|more about)\b/.test(text)) return "course";
  if (/\b(them|those)\b/.test(text)) return "plural";

  return null;
}

function buildResolvedQuery(query, slot, target) {
  const original = cleanText(query, 300);
  const targetText = Array.isArray(target) ? formatList(target) : cleanText(target, 140);
  if (!original || !targetText) return original;

  if (slot === "person_office") {
    return `What is the office of ${targetText}?`;
  }

  if (slot === "person") {
    if (/\bteach|teaches|teaching|taught\b/i.test(original)) return `What does ${targetText} teach?`;
    if (/\boffice|room|location\b/i.test(original)) return `What is the office of ${targetText}?`;
    return `Tell me more about ${targetText}.`;
  }

  if (slot === "course") {
    if (/\bgrading|grade|grades|marks|gpa\b/i.test(original)) return `${targetText} grading policy`;
    if (/\bprerequisite|prerequisites|requirements|required\b/i.test(original)) return `${targetText} prerequisites`;
    return `Tell me more about ${targetText}.`;
  }

  if (slot === "plural") {
    return `Tell me more about ${targetText}.`;
  }

  return original;
}

function resolveTargetForSlot(slot, memory = {}) {
  if (slot === "person" || slot === "person_office") {
    const entity = getMemoryEntity(memory, "person");
    if (entity) return { target: entity.value, targetType: entity.type || "person", source: entity.source };
    return { target: null, targetType: "person", source: null };
  }

  if (slot === "course") {
    const entity = getMemoryEntity(memory, "course");
    if (entity) return { target: entity.value, targetType: entity.type || "course", source: entity.source };

    const subject = getRecentSubject(memory);
    if (subject) return { target: subject, targetType: "course", source: "recentSubjects" };

    const topic = cleanText(memory.lastTopic, 120);
    return { target: topic, targetType: "topic", source: topic ? "lastTopic" : null };
  }

  if (slot === "plural") {
    const subjects = getPluralSubjects(memory);
    return { target: subjects, targetType: "subjects", source: subjects.length ? "recentSubjects" : null };
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
  const slot = inferReferenceSlot(query);
  if (!slot) {
    return {
      detected: false,
      resolved: false,
      slot: null
    };
  }

  const { target, targetType, source } = resolveTargetForSlot(slot, conversationMemory);
  const hasTarget = Array.isArray(target) ? target.length > 0 : Boolean(cleanText(target, 140));

  if (!hasTarget) {
    return {
      detected: true,
      resolved: false,
      slot,
      target: null,
      targetType,
      source: null,
      clarification: buildFollowUpClarification(slot)
    };
  }

  return {
    detected: true,
    resolved: true,
    slot,
    target,
    targetType,
    source,
    resolvedQuery: buildResolvedQuery(query, slot, target),
    intentHint: slot === "person" || slot === "person_office" ? "PERSON" : "GENERAL",
    confidence: source === "verified_kg" ? 0.95 : 0.82
  };
}

export function buildFollowUpClarification(slot = "entity") {
  if (slot === "person" || slot === "person_office") {
    return "Which professor or staff member do you mean?";
  }
  if (slot === "course") {
    return "Which course or program do you mean?";
  }
  if (slot === "plural") {
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
