import { generateGeminiSynthesis } from "./geminiService.js";
import { runtimeMode } from "../config/runtimeMode.js";
import { verifyGroundedAnswer } from "./groundingVerificationService.js";

const DEFAULT_HUMANIZER_TIMEOUT_MS = 7000;
const DEFAULT_MAX_OUTPUT_TOKENS = 180;
const MAX_ANSWER_CHARS = 3000;
const CONVERSATION_ROUTE_RE = /(^|_)(CONVERSATION|INTERACTIVE)(_|$)/i;
const INSUFFICIENT_INFO_RE = /\b(i do not have|i don't have|couldn'?t find|could not find|not enough verified|no specific knowledge graph|insufficient|not available)\b/i;

function integerFromEnv(names, fallback, { min = 1000, max = 8000 } = {}) {
  for (const name of names) {
    const parsed = Number.parseInt(process.env[name], 10);
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, min), max);
    }
  }

  return fallback;
}

function cleanText(value, limit = MAX_ANSWER_CHARS) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function cleanMultilineText(value, limit = MAX_ANSWER_CHARS) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(line => cleanText(line, limit))
    .filter(Boolean)
    .join("\n")
    .slice(0, limit);
}

function sentenceText(value, limit = MAX_ANSWER_CHARS) {
  const text = cleanText(value, limit);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function wordCount(value) {
  return cleanText(value).split(/\s+/).filter(Boolean).length;
}

function normalizeComparable(value) {
  return cleanText(value, 300)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatNaturalList(values) {
  const unique = [...new Set(values.map(value => cleanText(value, 180)).filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

function stripGroundingFrame(answer) {
  return cleanText(answer)
    .replace(/^(according to verified university policy[:,]?\s*)/i, "")
    .replace(/^(according to official university documentation[:,]?\s*)/i, "")
    .replace(/^(according to verified university records[:,]?\s*)/i, "")
    .trim();
}

function hasOptionalOffer(answer) {
  return /\bi can also\b|\bif you'd like\b/i.test(answer);
}

function getTraceDiagnostics(responseBody = {}) {
  return responseBody?.metadata?.trace?.route_diagnostics ||
    responseBody?.explainability?.route_diagnostics ||
    {};
}

function getResolvedFollowUpTarget(responseBody = {}) {
  const followUp = getTraceDiagnostics(responseBody)?.conversation_priority?.follow_up;
  const target = followUp?.resolved ? followUp.target : null;
  if (Array.isArray(target)) return cleanText(target[0], 120);
  return cleanText(target, 120);
}

function hasVerifiedOfficeAnswer(answer) {
  return /\b(office|room|location)\b.{0,24}\b(is|in|at|:)\b/i.test(answer) &&
    !INSUFFICIENT_INFO_RE.test(answer);
}

function buildGroundedOffer(query, answer, route) {
  if (hasOptionalOffer(answer) || wordCount(answer) > 70 || INSUFFICIENT_INFO_RE.test(answer)) return "";

  const text = `${query} ${answer}`.toLowerCase();
  if (/\b(who teaches|teaches|teacher|instructor|professor|lecturer|faculty)\b/.test(text)) {
    return " I can also help with office information or related courses if that information is available.";
  }
  if (/\b(course|subject|prerequisite|prerequisites|required before|machine learning|deep learning|nlp)\b/.test(text)) {
    return " I can also explain prerequisites or related subjects.";
  }
  if (/\b(policy|regulation|transfer|admission|grading|grades|gpa|fee|fees|scholarship)\b/.test(text)) {
    return " I can also help explain related academic regulations.";
  }

  return "";
}

function rewriteTeachingAnswer(answer, query, route) {
  const text = stripGroundingFrame(answer);
  const match = text.match(/^(.+?)\s+teaches\s+(?:the\s+)?(.+?)(?:\s+course)?\.?$/i);
  if (!match) return "";

  const person = cleanText(match[1], 120);
  const course = cleanText(match[2], 120).replace(/\s+course$/i, "");
  if (!person || !course) return "";

  return `${person} teaches ${course}.`;
}

function rewriteRoleAnswer(answer) {
  const text = stripGroundingFrame(answer);
  const match = text.match(/^(.+?)\s+serves as Head of Unit for\s+(.+?)\.?$/i);
  if (!match) return "";
  const person = cleanText(match[1], 120);
  const unit = cleanText(match[2], 160);
  if (!person || !unit) return "";
  return `${person} is the Head of the ${unit}.`;
}

function rewritePrerequisiteAnswer(answer, query, route) {
  const text = stripGroundingFrame(answer);
  const relationPattern = /(?:^|\.\s+)([^.]+?)\s+(?:is|are)\s+(?:a\s+)?prerequisites?\s+(?:for|to)\s+([^.]+?)\.?\s*(?=$|\.)/gi;
  const relations = [];
  let relationMatch;
  while ((relationMatch = relationPattern.exec(text)) !== null) {
    relations.push({
      prerequisite: cleanText(relationMatch[1], 180),
      course: cleanText(relationMatch[2], 120)
    });
  }

  if (relations.length > 1) {
    const comparableQuery = normalizeComparable(query);
    const directRelations = relations.filter(({ course }) => {
      const comparableCourse = normalizeComparable(course);
      return comparableCourse && comparableQuery.includes(comparableCourse);
    });

    if (directRelations.length > 0) {
      const course = directRelations[0].course;
      const prerequisites = formatNaturalList(
        directRelations
          .filter(relation => normalizeComparable(relation.course) === normalizeComparable(course))
          .map(relation => relation.prerequisite)
      );
      if (course && prerequisites) {
        const rewritten = `To take ${course}, you'll first need ${prerequisites}.`;
        return rewritten + buildGroundedOffer(query, rewritten, route);
      }
    }

    // Preserve multi-relation evidence when the user's requested course cannot
    // be identified safely instead of collapsing unrelated facts together.
    return "";
  }

  const match = text.match(/^([^.]+?)\s+(?:is|are)\s+(?:a\s+)?prerequisites?\s+(?:for|to)\s+([^.]+?)\.?$/i);
  if (!match) return "";

  const prerequisites = cleanText(match[1], 180);
  const course = cleanText(match[2], 120);
  if (!prerequisites || !course) return "";

  const rewritten = `To take ${course}, you'll first need ${prerequisites}.`;
  return rewritten + buildGroundedOffer(query, rewritten, route);
}

function rewriteMultiIntentAnswer(answer) {
  const text = cleanText(answer);
  if (!/^.+?:\s+[A-Z][a-z]+:/.test(text) && !/\n[A-Z][a-z]+:\s+/.test(answer)) return "";

  const normalized = String(answer || "").replace(/\r\n/g, "\n").trim();
  const firstColon = normalized.indexOf(":");
  const subject = firstColon > 0 && firstColon < 80 ? normalized.slice(0, firstColon).trim() : "";
  const rest = subject ? normalized.slice(firstColon + 1).trim() : normalized;
  const parts = rest
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^([A-Za-z ]+):\s*(.+)$/);
      if (!match) return null;
      return {
        label: match[1].trim().toLowerCase(),
        answer: sentenceText(match[2], 900)
      };
    })
    .filter(Boolean);

  if (parts.length < 2) return "";

  const labels = parts.map(part => part.label).join(" and ");
  const intro = subject
    ? `For ${subject}, I found verified information for ${labels}.`
    : `I found verified information for ${labels}.`;
  const body = parts
    .map(part => `${part.label.charAt(0).toUpperCase()}${part.label.slice(1)}: ${part.answer}`)
    .join("\n");

  return `${intro}\n${body}`;
}

function splitFactSentences(answer) {
  return String(answer || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+|(?<=\.)\s+/)
    .map(line => cleanText(line, 700))
    .filter(Boolean);
}

function rewriteCompleteRelationList(answer, query) {
  const facts = splitFactSentences(stripGroundingFrame(answer));
  const lowerQuery = cleanText(query, 500).toLowerCase();
  if (facts.length < 2) return "";

  if (/\b(career|careers|jobs?|lead to)\b/.test(lowerQuery)) {
    const grouped = new Map();
    for (const fact of facts) {
      const match = fact.match(/^(.+?)\s+(?:can\s+)?leads?\s+to\s+(.+?)\.?$/i);
      if (!match) continue;
      const roles = grouped.get(match[1]) || [];
      roles.push(match[2].replace(/\s+career role$/i, ""));
      grouped.set(match[1], roles);
    }
    if (grouped.size > 0) {
      return [...grouped.entries()]
        .map(([program, roles]) => `${program} can lead to ${formatNaturalList(roles)} roles.`)
        .join(" ");
    }
  }

  if (/\b(compare|comparison)\b/.test(lowerQuery)) {
    const grouped = new Map();
    for (const fact of facts) {
      const match = fact.match(/^(.+?)\s+includes\s+(?:the\s+)?(.+?)(?:\s+course)?(?:\s+\([^)]*\))?\.?$/i);
      if (!match) continue;
      const courses = grouped.get(match[1]) || [];
      courses.push(match[2]);
      grouped.set(match[1], courses);
    }
    if (grouped.size >= 2) {
      return [...grouped.entries()]
        .map(([program, courses]) => `**${program}:** ${formatNaturalList(courses)}.`)
        .join("\n");
    }
  }

  if (/\b(teach|teaches|teaching|taught|anything else|what else)\b/.test(lowerQuery)) {
    const grouped = new Map();
    for (const fact of facts) {
      const match = fact.match(/^(.+?)\s+teaches\s+(?:the\s+)?(.+?)(?:\s+course)?\.?$/i);
      if (!match) continue;
      const courses = grouped.get(match[1]) || [];
      courses.push(match[2].replace(/\s+course$/i, ""));
      grouped.set(match[1], courses);
    }
    if (grouped.size > 0) {
      return [...grouped.entries()]
        .map(([person, courses]) => `${person} teaches ${formatNaturalList(courses)}.`)
        .join(" ");
    }
  }

  if (/\b(bachelor|bachelors|bsc|degree|which programs|programs.*offer)\b/.test(lowerQuery)) {
    const offers = [];
    const programs = new Map();
    for (const fact of facts) {
      const offer = fact.match(/^(.+?)\s+offers\s+(.+?)\.?$/i);
      if (offer) offers.push(`${offer[1]} offers ${offer[2]}.`);
      const program = fact.match(/^(.+?)\s+includes\s+(?:the\s+)?(.+?)\s+program(?:\s+\(([^)]*)\))?\.?$/i);
      if (program) {
        const values = programs.get(program[1]) || [];
        const details = String(program[3] || "")
          .split(",")
          .map(value => value.trim())
          .filter(Boolean)
          .map(value => value.replace(/^discipline:\s*/i, ""));
        values.push(details.length > 0 ? `${program[2]} (${details.join(", ")})` : program[2]);
        programs.set(program[1], values);
      }
    }
    const programLines = [...programs.entries()].map(
      ([degree, values]) =>
        `${degree} includes the following ${values.length === 1 ? "program" : "programs"}: ${formatNaturalList(values)}.`
    );
    if (offers.length > 0 || programLines.length > 0) {
      return [...offers, ...programLines].join(" ");
    }
  }

  if (/\b(recommended after|language technology|take after)\b/.test(lowerQuery)) {
    const sequence = facts.find(fact => /\brecommended after\b/i.test(fact));
    const membership = facts.find(fact => /\bincludes\b/i.test(fact));
    if (sequence) return [sequence, membership].filter(Boolean).join(" ");
  }

  return "";
}

function hasVerifiedResponseEvidence(responseBody = {}) {
  return (
    (Array.isArray(responseBody.used_facts) && responseBody.used_facts.length > 0) ||
    (Array.isArray(responseBody.citations) && responseBody.citations.length > 0) ||
    (Array.isArray(responseBody.graph?.links) && responseBody.graph.links.length > 0) ||
    responseBody?.metadata?.grounding?.grounded === true
  );
}

function buildResponseGroundingEvidence(responseBody = {}) {
  const citations = Array.isArray(responseBody.citations) ? responseBody.citations : [];
  const citedExcerpts = new Set();
  const evidence = citations
    .map((citation, index) => {
      const excerpt = cleanText(citation?.excerpt, 700);
      if (!excerpt) return null;
      citedExcerpts.add(normalizeComparable(excerpt));
      return {
        evidence: excerpt,
        evidence_id: citation.evidence_id || citation.id || `citation:${index + 1}`,
        source_type: citation.source || "KG"
      };
    })
    .filter(Boolean);

  const usedFacts = Array.isArray(responseBody.used_facts) ? responseBody.used_facts : [];
  usedFacts.forEach((fact, index) => {
    const text = cleanText(fact, 700);
    if (!text || citedExcerpts.has(normalizeComparable(text))) return;
    evidence.push({
      evidence: text,
      evidence_id: `response-fact:${index + 1}`,
      source_type: "KG"
    });
  });

  // Graph links are a last-resort grounding source. Mixing them with complete
  // cited list evidence can incorrectly look like a numeric conflict merely
  // because one degree legitimately has multiple program relationships.
  if (evidence.length === 0) {
    const links = Array.isArray(responseBody.graph?.links) ? responseBody.graph.links : [];
    links.forEach((link, index) => {
      const subject = cleanText(link?.source?.label || link?.source?.name || link?.source, 180);
      const object = cleanText(link?.target?.label || link?.target?.name || link?.target, 180);
      const relation = cleanText(link?.type || link?.relation, 100);
      if (!subject || !object || !relation) return;
      evidence.push({
        evidence_id: `response-graph:${index + 1}`,
        source_type: "KG",
        relSourceName: subject,
        relTargetName: object,
        relType: relation
      });
    });
  }

  return evidence;
}

export function applyGroundedConversationalExpansion({
  query,
  groundedAnswer,
  route = "UNKNOWN",
  responseBody = {}
} = {}) {
  const rawAnswer = String(groundedAnswer || "");
  const hasMultilineGrounding = /\n/.test(rawAnswer);
  const answer = cleanText(groundedAnswer);
  if (!answer) return { answer, changed: false, reason: "EMPTY" };
  if (CONVERSATION_ROUTE_RE.test(route)) return { answer, changed: false, reason: "CONVERSATION_ROUTE" };

  const multiIntentAnswer = rewriteMultiIntentAnswer(groundedAnswer);
  if (multiIntentAnswer) {
    return { answer: multiIntentAnswer, changed: multiIntentAnswer !== answer, reason: "MULTI_INTENT_FLOW" };
  }

  const lowerQuery = cleanText(query, 500).toLowerCase();
  const verifiedFacts = Array.isArray(responseBody.used_facts)
    ? responseBody.used_facts.map(fact => cleanText(fact, 700)).filter(Boolean)
    : [];
  const relationListSource =
    /\b(bachelor|bachelors|bsc|degree|which programs|programs?.*offer)\b/.test(lowerQuery) &&
    verifiedFacts.length > 0
      ? verifiedFacts.join("\n")
      : groundedAnswer;
  const relationListAnswer = rewriteCompleteRelationList(relationListSource, query);
  if (relationListAnswer) {
    return {
      answer: relationListAnswer,
      changed: relationListAnswer !== answer,
      reason: "COMPLETE_RELATION_LIST"
    };
  }

  const stripped = stripGroundingFrame(answer);
  const resolvedTarget = getResolvedFollowUpTarget(responseBody);

  if (
    resolvedTarget &&
    /\b(his|her|their)\b/.test(lowerQuery) &&
    /\b(office|room|location)\b/.test(lowerQuery) &&
    !hasVerifiedOfficeAnswer(answer) &&
    INSUFFICIENT_INFO_RE.test(answer)
  ) {
    const continuityAnswer = `I resolved that as ${resolvedTarget}, but I couldn't find verified office information.`;
    return { answer: continuityAnswer, changed: continuityAnswer !== answer, reason: "FOLLOWUP_MISSING_OFFICE" };
  }

  const roleAnswer = rewriteRoleAnswer(stripped);
  if (!hasMultilineGrounding && roleAnswer) {
    return { answer: roleAnswer, changed: roleAnswer !== answer, reason: "ROLE_FLOW" };
  }

  const teachingAnswer = rewriteTeachingAnswer(stripped, query, route);
  if (!hasMultilineGrounding && teachingAnswer) {
    return { answer: teachingAnswer, changed: teachingAnswer !== answer, reason: "TEACHING_FLOW" };
  }

  const prerequisiteAnswer = rewritePrerequisiteAnswer(stripped, query, route);
  if (!hasMultilineGrounding && prerequisiteAnswer) {
    return { answer: prerequisiteAnswer, changed: prerequisiteAnswer !== answer, reason: "PREREQUISITE_FLOW" };
  }

  const framedAnswer = stripped || answer;
  const preservedAnswer = hasMultilineGrounding ? cleanMultilineText(rawAnswer) : framedAnswer;
  const offer = buildGroundedOffer(query, framedAnswer, route);
  const isListAnswer = hasMultilineGrounding || /\b(show|list|all|courses|program courses)\b/.test(lowerQuery);
  const expanded = offer ? `${isListAnswer ? preservedAnswer : sentenceText(framedAnswer)}${offer}` : preservedAnswer;
  return {
    answer: expanded,
    changed: expanded !== answer,
    reason: offer ? "GROUNDED_FOLLOWUP_OFFER" : stripped !== answer ? "GROUNDING_FRAME_REMOVED" : "UNCHANGED"
  };
}

function buildHumanizerPrompt({ query, groundedAnswer }) {
  return `## SYSTEM PROMPT

You are a conversational formatting layer for an AI university assistant.

Your ONLY task is:

* improve conversational tone
* improve readability
* improve natural flow
* merge repetitive phrasing
* sound professional and human

STRICT RULES:

* DO NOT add facts
* DO NOT invent information
* DO NOT infer missing details
* DO NOT answer from external knowledge
* DO NOT modify academic meaning
* DO NOT introduce new entities
* DO NOT change names
* DO NOT change policies
* DO NOT expand beyond provided grounded response

You MUST preserve:

* exact factual meaning
* exact grounding
* exact entities
* exact academic content

If the grounded response is already natural,
return it with minimal changes.

## INPUT

User Question:
${cleanText(query, 500)}

Grounded Response:
${groundedAnswer}`;
}

function containsDisallowedFraming(text) {
  return /\b(as an ai|according to verified|according to the provided|based on the provided|i do not have access to external)\b/i.test(text);
}

function hasUnsafeSensitiveExpansion(original, candidate) {
  const originalLower = original.toLowerCase();
  const candidateLower = candidate.toLowerCase();
  const guardedTerms = [
    "office",
    "room",
    "role",
    "dean",
    "director",
    "policy",
    "requirement",
    "prerequisite",
    "course",
    "admission",
    "semester",
    "fee",
    "scholarship"
  ];

  return guardedTerms.some((term) => {
    const pattern = new RegExp(`\\b${term}s?\\b`, "i");
    return pattern.test(candidateLower) && !pattern.test(originalLower);
  });
}

function hasLengthExpansion(original, candidate) {
  const originalWords = original.split(/\s+/).filter(Boolean).length;
  const candidateWords = candidate.split(/\s+/).filter(Boolean).length;
  if (originalWords <= 8) return candidateWords > originalWords + 8;
  return candidateWords > Math.ceil(originalWords * 1.45) + 8;
}

export function validateHumanizedAnswer(originalAnswer, candidateAnswer) {
  const original = cleanText(originalAnswer);
  const candidate = cleanText(candidateAnswer);

  if (!candidate) return { ok: false, reason: "EMPTY_OUTPUT" };
  if (candidate.length < 2) return { ok: false, reason: "TOO_SHORT" };
  if (containsDisallowedFraming(candidate)) return { ok: false, reason: "DISALLOWED_FRAMING" };
  if (hasUnsafeSensitiveExpansion(original, candidate)) return { ok: false, reason: "SENSITIVE_EXPANSION" };
  if (hasLengthExpansion(original, candidate)) return { ok: false, reason: "LENGTH_EXPANSION" };

  return { ok: true, answer: candidate };
}

export function shouldHumanizeResponseBody(body, { statusCode = 200 } = {}) {
  if (!body || typeof body !== "object") return false;
  if (statusCode >= 400) return false;
  if (body?.metadata?.error === true) return false;
  if (body?.error) return false;

  const answer = cleanText(body.final_answer || body.answer);
  if (!answer) return false;

  const route = String(body.route || body.source || body?.metadata?.trace?.route || "").toUpperCase();
  if (route.includes("ERROR") || route.includes("FATAL")) return false;
  if (route === "DEMO_GRAPH") return false;
  if (CONVERSATION_ROUTE_RE.test(route)) return false;

  return true;
}

export async function humanizeGroundedAnswer({
  query,
  groundedAnswer,
  requestId = "none",
  route = "UNKNOWN",
  responseBody = {}
} = {}) {
  const originalAnswer = cleanText(groundedAnswer);
  const expansion = applyGroundedConversationalExpansion({
    query,
    groundedAnswer: originalAnswer,
    route,
    responseBody
  });
  const answer = String(expansion.answer || "").includes("\n")
    ? cleanMultilineText(expansion.answer)
    : cleanText(expansion.answer);
  if (!answer) {
    console.log(`[GEMINI_HUMANIZER][HUMANIZER_SKIPPED][${requestId}] reason=EMPTY_GROUNDED_ANSWER route=${route}`);
    return { answer, changed: false, skipped: true, reason: "EMPTY_GROUNDED_ANSWER" };
  }

  if (hasVerifiedResponseEvidence(responseBody)) {
    const groundingEvidence = buildResponseGroundingEvidence(responseBody);
    const formattedGrounding = groundingEvidence.length > 0
      ? verifyGroundedAnswer({ answer, evidence: groundingEvidence })
      : responseBody?.metadata?.grounding || null;
    if (expansion.changed && formattedGrounding?.status !== "fully_supported") {
      console.log(`[GEMINI_HUMANIZER][HUMANIZER_FALLBACK][${requestId}] reason=FORMATTED_GROUNDING_REJECTED route=${route}`);
      return {
        answer: originalAnswer,
        changed: false,
        skipped: true,
        fallback: true,
        reason: "FORMATTED_GROUNDING_REJECTED",
        expansionReason: expansion.reason,
        grounding: responseBody?.metadata?.grounding || null,
        modelCallsAdded: 0
      };
    }
    console.log(`[GEMINI_HUMANIZER][HUMANIZER_SKIPPED][${requestId}] reason=VERIFIED_LOCAL_FORMATTING route=${route}`);
    return {
      answer,
      changed: expansion.changed,
      skipped: true,
      reason: "VERIFIED_LOCAL_FORMATTING",
      expansionReason: expansion.reason,
      grounding: formattedGrounding,
      modelCallsAdded: 0
    };
  }

  if (!runtimeMode.humanizerEnabled) {
    console.log(`[GEMINI_HUMANIZER][HUMANIZER_SKIPPED][${requestId}] reason=DISABLED route=${route}`);
    return { answer, changed: expansion.changed, skipped: true, reason: "DISABLED", expansionReason: expansion.reason };
  }

  if (process.env.GEMINI_HUMANIZER_FORCE_TIMEOUT === "true") {
    console.log(`[GEMINI_HUMANIZER][HUMANIZER_FALLBACK][${requestId}] reason=FORCED_TIMEOUT route=${route}`);
    return { answer, changed: expansion.changed, fallback: true, reason: "FORCED_TIMEOUT", expansionReason: expansion.reason };
  }

  const timeoutMs = integerFromEnv(
    ["GEMINI_HUMANIZER_TIMEOUT_MS", "GEMINI_FORMATTER_TIMEOUT_MS"],
    DEFAULT_HUMANIZER_TIMEOUT_MS
  );

  console.log(`[GEMINI_HUMANIZER][HUMANIZER_ACTIVE][${requestId}] route=${route} timeout=${timeoutMs}ms`);

  try {
    const result = await generateGeminiSynthesis({
      prompt: buildHumanizerPrompt({ query, groundedAnswer: answer }),
      requestId: `humanizer_${requestId}`,
      timeoutMs,
      options: {
        temperature: 0.2,
        top_p: 0.8,
        num_predict: DEFAULT_MAX_OUTPUT_TOKENS,
        disableThinking: true
      }
    });

    const validation = validateHumanizedAnswer(answer, result.text);
    if (!validation.ok) {
      console.log(`[GEMINI_HUMANIZER][HUMANIZER_FALLBACK][${requestId}] reason=${validation.reason} route=${route}`);
      return { answer, changed: expansion.changed, fallback: true, reason: validation.reason, expansionReason: expansion.reason };
    }

    console.log(`[GEMINI_HUMANIZER][HUMANIZER_SUCCESS][${requestId}] route=${route} latency=${result.latencyMs}ms`);
    return {
      answer: validation.answer,
      changed: validation.answer !== originalAnswer,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      expansionReason: expansion.reason
    };
  } catch (error) {
    console.log(`[GEMINI_HUMANIZER][HUMANIZER_FALLBACK][${requestId}] reason=${error?.code || error?.message || "ERROR"} route=${route}`);
    return {
      answer,
      changed: expansion.changed,
      fallback: true,
      reason: error?.code || "ERROR",
      expansionReason: expansion.reason
    };
  }
}

export default {
  applyGroundedConversationalExpansion,
  humanizeGroundedAnswer,
  shouldHumanizeResponseBody
};
