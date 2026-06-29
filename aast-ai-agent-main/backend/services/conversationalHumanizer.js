import { generateGeminiSynthesis } from "./geminiService.js";
import { runtimeMode } from "../config/runtimeMode.js";

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

  const text = `${query} ${answer} ${route}`.toLowerCase();
  if (/\b(who teaches|teaches|teacher|instructor|professor|lecturer|faculty|kg_direct)\b/.test(text)) {
    return " I can also help with office information or related courses if that information is available.";
  }
  if (/\b(course|subject|prerequisite|prerequisites|required before|machine learning|deep learning|nlp)\b/.test(text)) {
    return " I can also explain prerequisites or related subjects.";
  }
  if (/\b(policy|regulation|transfer|admission|grading|grades|gpa|fee|fees|scholarship|rag_direct|hybrid)\b/.test(text)) {
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

  const rewritten = `${course} is taught by ${person}.`;
  return rewritten + buildGroundedOffer(query, rewritten, route);
}

function rewritePrerequisiteAnswer(answer, query, route) {
  const text = stripGroundingFrame(answer);
  const match = text.match(/^(.+?)\s+(?:is|are)\s+(?:a\s+)?prerequisites?\s+(?:for|to)\s+(.+?)\.?$/i);
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

  const stripped = stripGroundingFrame(answer);
  const lowerQuery = cleanText(query, 500).toLowerCase();
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
  const answer = cleanText(expansion.answer);
  if (!answer) {
    console.log(`[GEMINI_HUMANIZER][HUMANIZER_SKIPPED][${requestId}] reason=EMPTY_GROUNDED_ANSWER route=${route}`);
    return { answer, changed: false, skipped: true, reason: "EMPTY_GROUNDED_ANSWER" };
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
