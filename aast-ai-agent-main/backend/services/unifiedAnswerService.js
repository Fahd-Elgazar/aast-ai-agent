/**
 * ============================================================
 * AAST Explainable Hybrid GraphRAG Academic Advisor
 * Unified Answer Generation Service
 * ============================================================
 *
 * PURPOSE:
 *   This module serves as the SINGLE FINAL ANSWER LAYER for the
 *   entire advisory pipeline. It receives pre-verified, structured
 *   context from four upstream sources:
 *     1. Neo4j Knowledge Graph   → neo4jContext
 *     2. RAG Retriever Documents → ragContext
 *     3. FAQ System              → faqContext
 *     4. Decision System         → decisionContext
 *
 *   It synthesizes all available context through a locally-hosted
 *   Ollama LLM (Gemma) into a single, natural, student-friendly,
 *   professionally-toned advisory response — without hallucination
 *   or reliance on outside knowledge.
 *
 * AUTHOR:  AAST Academic Advisor Engineering Team
 * VERSION: 4.0.0  — Enterprise optimization patch
 *
 * CHANGELOG (v4.0.0):
 *   - TASK 1: Route-adaptive Ollama inference parameters (per-route temperature map).
 *   - TASK 2: Structured UnifiedAnswerResult response object with toString() backward compat.
 *   - TASK 3: Anti-truncation guard — detects, repairs, or falls back on incomplete responses.
 *   - TASK 4: Retry logic — 1 auto-retry on timeout with exponential backoff + observability.
 *   - TASK 5: Decision block depth-limited safe serialization with value truncation.
 *   - TASK 6: Source attribution metadata (faq/kg/rag/decision booleans) in result + logs.
 *   - TASK 7: Policy response formatting directive for RAG_ONLY and HYBRID routes.
 *   - TASK 8: Tiered prompt token alerts — 3500 WARNING, 5000 CRITICAL.
 *
 * CHANGELOG (v3.0.0):
 *   - Route-aware prompt specialization (routeType parameter).
 *   - Confidence gating at 0.40 threshold (retrievalConfidence).
 *   - Prompt size optimization (KG ≤3, RAG ≤5, 1 FAQ, decision summary).
 *   - AbortController timeout protection (25s) on Ollama calls.
 *   - Enterprise-grade structured observability logging throughout.
 *   - Response sanitization pipeline (meta-phrases, garbage, repetition).
 *   - Priority source ordering enforced: FAQ > Decision > KG > RAG.
 *   - Preserved full modularity, exports, orchestrator compatibility.
 * ============================================================
 */

import fetch from "node-fetch";

// ─────────────────────────────────────────────────────────────
// SECTION 0 — CONFIGURATION CONSTANTS
// ─────────────────────────────────────────────────────────────

/**
 * Base URL for the Ollama inference server.
 * Resolved from OLLAMA_BASE_URL env var; falls back to localhost for dev.
 */
const OLLAMA_BASE_URL =
    (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").replace(/\/$/, "");

/** Full generate endpoint — constructed from the resolved base URL. */
const OLLAMA_URL = `${OLLAMA_BASE_URL}/api/generate`;

/** Model used for final answer synthesis. DO NOT CHANGE. */
const MODEL = "gemma4:e2b";

/**
 * Timeout in milliseconds for a single Ollama inference call.
 * AbortController cancels the request after this duration.
 */
const OLLAMA_TIMEOUT_MS = 25_000;

/**
 * Maximum number of automatic retries on Ollama timeout.
 * Only AbortError (timeout) triggers retry — not HTTP or parse errors.
 * Kept at 1 to avoid compounding latency; exponential backoff is applied.
 */
const OLLAMA_MAX_RETRIES = 1;

/**
 * Base delay in milliseconds for the first retry backoff interval.
 * Actual delay for attempt N = OLLAMA_RETRY_BASE_DELAY_MS * 2^(N-1).
 * With MAX_RETRIES=1: single retry waits 1 000 ms before re-attempting.
 */
const OLLAMA_RETRY_BASE_DELAY_MS = 1_000;

/**
 * Minimum retrieval confidence score (0–1).
 * Below this threshold the LLM call is bypassed → INSUFFICIENT_DATA_PHRASE.
 */
const CONFIDENCE_GATE_THRESHOLD = 0.40;

/** Maximum KG facts to inject into the prompt. */
const MAX_KG_FACTS = 3;

/** Maximum RAG passages to inject into the prompt. */
const MAX_RAG_PASSAGES = 5;

/**
 * Maximum character length for any string value inside the decision
 * factors block. Values exceeding this are truncated with an ellipsis.
 */
const DECISION_MAX_VALUE_CHARS = 200;

/**
 * Maximum serialization depth for nested objects in the decision factors block.
 * Objects deeper than this are replaced with a compact placeholder.
 */
const DECISION_MAX_DEPTH = 3;

/**
 * Prompt token count at which a WARNING-level alert is emitted.
 * Signals the prompt is approaching the model's comfortable context budget.
 */
const PROMPT_TOKEN_WARN_THRESHOLD = 3_500;

/**
 * Prompt token count at which a CRITICAL-level alert is emitted.
 * At this size, context truncation by the model is likely, degrading quality.
 */
const PROMPT_TOKEN_CRITICAL_THRESHOLD = 5_000;

/**
 * Fallback message returned when the generation system is unavailable.
 */
const FALLBACK_ANSWER =
    "I'm sorry, the answer generation system is currently unavailable. " +
    "Please try again in a moment or contact your academic advisor directly.";

/**
 * Returned when context is below confidence threshold or insufficient
 * to answer without hallucination risk.
 */
const INSUFFICIENT_DATA_PHRASE =
    "I don't have enough verified information to answer that fully. " +
    "Please consult your academic advisor or the university's official portal for accurate details.";


// ─────────────────────────────────────────────────────────────
// SECTION 1 — ROUTE TYPE REGISTRY
// ─────────────────────────────────────────────────────────────

/**
 * Enumeration of supported route types.
 * @readonly
 * @enum {string}
 */
const ROUTE_TYPES = Object.freeze({
    KG_ONLY: "KG_ONLY",
    RAG_ONLY: "RAG_ONLY",
    FAQ_ONLY: "FAQ_ONLY",
    DECISION: "DECISION",
    HYBRID: "HYBRID",
    LLM_FALLBACK: "LLM_FALLBACK",
});

/**
 * TASK 1 — Per-route Ollama inference parameter sets.
 *
 * Temperature controls factual precision per route:
 *   FAQ_ONLY    (0.10) — Near-verbatim reproduction of verified policy wording.
 *   KG_ONLY     (0.15) — Precise entity/code quoting from structured graph data.
 *   DECISION    (0.20) — Controlled advisory language from rule engine verdicts.
 *   RAG_ONLY    (0.25) — Moderate paraphrase latitude for policy summarization.
 *   HYBRID      (0.30) — Synthesis flexibility needed across heterogeneous sources.
 *   LLM_FALLBACK(0.05) — Maximum conservatism when evidence is sparse.
 *
 * top_p is tightened at lower temperatures to prevent degenerate low-probability
 * token selection from countering the precision intent of the low temperature.
 *
 * repeat_penalty is slightly elevated on LLM_FALLBACK to suppress the
 * self-referential loops Gemma exhibits when context is thin.
 *
 * @type {Record<string, { temperature: number, top_p: number, repeat_penalty: number }>}
 */
const ROUTE_INFERENCE_OPTIONS = Object.freeze({
    [ROUTE_TYPES.KG_ONLY]: { temperature: 0.15, top_p: 0.80, repeat_penalty: 1.15 },
    [ROUTE_TYPES.FAQ_ONLY]: { temperature: 0.10, top_p: 0.75, repeat_penalty: 1.10 },
    [ROUTE_TYPES.RAG_ONLY]: { temperature: 0.25, top_p: 0.85, repeat_penalty: 1.15 },
    [ROUTE_TYPES.DECISION]: { temperature: 0.20, top_p: 0.82, repeat_penalty: 1.12 },
    [ROUTE_TYPES.HYBRID]: { temperature: 0.30, top_p: 0.88, repeat_penalty: 1.15 },
    [ROUTE_TYPES.LLM_FALLBACK]: { temperature: 0.05, top_p: 0.70, repeat_penalty: 1.20 },
});

/**
 * Returns the Ollama inference options for a given resolved route type.
 * Falls back to LLM_FALLBACK options if the route is unrecognised.
 *
 * @param {string} resolvedRouteType - A valid ROUTE_TYPES value.
 * @returns {{ temperature: number, top_p: number, repeat_penalty: number }}
 */
function buildInferenceOptions(resolvedRouteType) {
    return (
        ROUTE_INFERENCE_OPTIONS[resolvedRouteType] ??
        ROUTE_INFERENCE_OPTIONS[ROUTE_TYPES.LLM_FALLBACK]
    );
}

/**
 * Per-route behavioral instruction blocks injected into the system prompt.
 *
 * TASK 7: RAG_ONLY and HYBRID now include a policy formatting directive
 * that encourages "According to AAST academic regulations..." framing.
 * This grounds policy answers to the institution's own regulatory voice,
 * reducing generic-AI phrasing and increasing perceived authority/trust.
 *
 * @type {Record<string, string>}
 */
const ROUTE_INSTRUCTIONS = {
    [ROUTE_TYPES.KG_ONLY]: `
ROUTE: Knowledge Graph Only
You are answering from verified, structured factual data extracted from the university knowledge graph.
- Prioritize precision. Quote entity names, course codes, and numeric values exactly as they appear.
- Do not infer or extend beyond the explicit graph facts provided.
- If a fact seems contradictory, surface the ambiguity rather than resolving it silently.
- Omit information that is not directly stated in the Knowledge Graph block.
`.trim(),

    [ROUTE_TYPES.RAG_ONLY]: `
ROUTE: Document Retrieval Only
You are answering from semantically retrieved policy or regulation documents.
- When the retrieved content contains a policy rule or regulation, begin your answer with:
  "According to AAST academic regulations, ..." and continue directly from there.
- Summarize the relevant policy clearly and accurately.
- Preserve key regulatory language where critical to meaning.
- If the passage is partial or appears cut off, acknowledge the limitation and recommend
  the student verify via the official university portal.
- Do not supplement retrieved passages with any invented policy detail.
`.trim(),

    [ROUTE_TYPES.FAQ_ONLY]: `
ROUTE: FAQ Match
You are answering from a verified frequently-asked-question entry — the highest confidence source available.
- Reflect the official answer as precisely as possible while adapting tone to be student-friendly.
- Do not alter the substance, requirements, or conditions stated in the FAQ answer.
- If the student's question is slightly different from the matched FAQ, note the exact scope of what is confirmed.
`.trim(),

    [ROUTE_TYPES.DECISION]: `
ROUTE: Decision Engine
You are presenting the outcome and reasoning of a rule-based decision engine evaluation.
- Lead with the decision outcome clearly (eligible / not eligible / conditional / etc.).
- Walk through each factor the engine evaluated in plain language.
- Be advisory and constructive — if the outcome is negative, suggest next steps where
  inferable from the factors.
- Do not soften or contradict the engine's verdict; present it professionally.
`.trim(),

    [ROUTE_TYPES.HYBRID]: `
ROUTE: Hybrid (Multi-Source)
You are synthesizing from multiple verified sources of different types.
- Prioritize in order: FAQ answer → Decision factors → Knowledge Graph facts → Retrieved documents.
- Use each source for what it does best: FAQ for confirmed policy wording, Decision for eligibility
  verdict, KG for specific entities and relationships, RAG for regulatory depth.
- Where the answer draws on policy or regulatory documents, use the framing:
  "According to AAST academic regulations, ..." to anchor the answer to the institution's rules.
- Where sources overlap and agree, synthesize them seamlessly.
- Where sources differ, surface the most authoritative source and note any discrepancy.
- Do not blend uncertain and certain facts without clearly distinguishing confidence levels.
`.trim(),

    [ROUTE_TYPES.LLM_FALLBACK]: `
ROUTE: LLM Fallback (Low Confidence)
You are operating in maximum-caution mode because retrieval confidence is low or no structured context was returned.
- Be extremely conservative. Only state what is directly and explicitly in the provided context.
- If the context does not contain a clear answer, respond with the insufficient-data phrase — do not attempt to infer.
- Do not attempt to recall or apply any university-specific knowledge not present in the context.
- Encourage the student to verify with their official academic advisor or university portal.
`.trim(),
};


// ─────────────────────────────────────────────────────────────
// SECTION 2 — OBSERVABILITY LAYER
// ─────────────────────────────────────────────────────────────

/**
 * Emits a structured INFO-level log to stdout.
 * @param {string} event
 * @param {object} [payload]
 */
function logInfo(event, payload = {}) {
    console.log(JSON.stringify({
        level: "INFO",
        service: "UnifiedAnswerService",
        event,
        timestamp: new Date().toISOString(),
        ...payload,
    }));
}

/**
 * Emits a structured WARN-level log to stdout.
 * @param {string} event
 * @param {object} [payload]
 */
function logWarn(event, payload = {}) {
    console.warn(JSON.stringify({
        level: "WARN",
        service: "UnifiedAnswerService",
        event,
        timestamp: new Date().toISOString(),
        ...payload,
    }));
}

/**
 * Emits a structured ERROR-level log to stderr.
 * @param {string} event
 * @param {object} [payload]
 */
function logError(event, payload = {}) {
    console.error(JSON.stringify({
        level: "ERROR",
        service: "UnifiedAnswerService",
        event,
        timestamp: new Date().toISOString(),
        ...payload,
    }));
}

/**
 * Estimates prompt token count via chars/4 heuristic.
 * Sufficient for budget alerting without a tokenizer dependency.
 *
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
    return Math.ceil((text ?? "").length / 4);
}


// ─────────────────────────────────────────────────────────────
// SECTION 3 — CONTEXT BUILDERS
// All builders now return { block, count, used } instead of bare
// strings. The `used` boolean feeds TASK 6 source attribution.
// ─────────────────────────────────────────────────────────────

/**
 * Builds a readable text block from Neo4j Knowledge Graph results.
 * Sorts by confidence descending, caps at MAX_KG_FACTS.
 *
 * @param {Array<{ evidence?: string, confidence?: number, metadata?: object }>} neo4jContext
 * @returns {{ block: string, count: number, used: boolean }}
 */
function buildNeo4jBlock(neo4jContext) {
    if (!Array.isArray(neo4jContext) || neo4jContext.length === 0) {
        return { block: "", count: 0, used: false };
    }

    const sorted = [...neo4jContext].sort((a, b) =>
        (b.confidence ?? 0) - (a.confidence ?? 0)
    );
    const capped = sorted.slice(0, MAX_KG_FACTS);

    const lines = capped
        .map((item, idx) => {
            if (!item || typeof item !== "object") return null;
            const evidence = (item.evidence ?? item.text ?? item.content ?? "").trim();
            if (!evidence) return null;

            const confidenceLabel =
                typeof item.confidence === "number"
                    ? ` [confidence: ${Math.round(item.confidence * 100)}%]`
                    : "";

            const meta = item.metadata ?? {};
            const metaParts = [];
            if (meta.source) metaParts.push(`source: ${meta.source}`);
            if (typeof meta.node_count === "number") metaParts.push(`nodes: ${meta.node_count}`);
            if (typeof meta.rel_count === "number") metaParts.push(`rels: ${meta.rel_count}`);
            const metaLabel = metaParts.length > 0 ? ` (${metaParts.join(", ")})` : "";

            return `  [KG-${idx + 1}]${confidenceLabel} ${evidence}${metaLabel}`;
        })
        .filter(Boolean);

    if (lines.length === 0) return { block: "", count: 0, used: false };

    const block =
        "### Knowledge Graph Facts (Neo4j — Verified Structured Data)\n" +
        lines.join("\n");

    return { block, count: lines.length, used: true };
}

/**
 * Builds a readable text block from RAG-retrieved document chunks.
 * Accepts { results } envelope, raw array, or pre-joined string.
 * Caps at MAX_RAG_PASSAGES.
 *
 * @param {{ results?: Array<object> } | Array<object> | string | null} ragContext
 * @returns {{ block: string, count: number, used: boolean }}
 */
function buildRagBlock(ragContext) {
    if (!ragContext) return { block: "", count: 0, used: false };

    let unwrapped = ragContext;
    if (
        typeof ragContext === "object" &&
        !Array.isArray(ragContext) &&
        Array.isArray(ragContext.results)
    ) {
        unwrapped = ragContext.results;
    }

    let passages = [];

    if (typeof unwrapped === "string") {
        passages = unwrapped.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    } else if (Array.isArray(unwrapped)) {
        passages = unwrapped
            .map(item => {
                if (typeof item === "string") return item.trim();
                if (item && typeof item === "object") {
                    return (item.text ?? item.content ?? item.pageContent ?? "").trim();
                }
                return "";
            })
            .filter(Boolean);
    }

    if (passages.length === 0) return { block: "", count: 0, used: false };

    const capped = passages.slice(0, MAX_RAG_PASSAGES);

    const block =
        "### Retrieved Document Context (RAG — Verified Passages)\n" +
        capped.join("\n\n");

    return { block, count: capped.length, used: true };
}

/**
 * Builds a readable text block from an FAQ system result.
 * FAQ is the highest-confidence source; placed first in context.
 *
 * @param {{ question?: string; answer?: string; source?: string } | null} faqContext
 * @returns {{ block: string, count: number, used: boolean }}
 */
function buildFaqBlock(faqContext) {
    if (!faqContext || typeof faqContext !== "object") return { block: "", count: 0, used: false };

    const question = faqContext.question?.trim() ?? "";
    const answer = faqContext.answer?.trim() ?? "";
    const source = faqContext.source?.trim() ?? "";

    if (!answer) return { block: "", count: 0, used: false };

    let block = "### FAQ Match (Highest-Confidence — Official Policy Wording)\n";
    if (question) block += `  Question : ${question}\n`;
    block += `  Answer   : ${answer}`;
    if (source) block += `\n  Source   : ${source}`;

    return { block, count: 1, used: true };
}


// ─────────────────────────────────────────────────────────────
// SECTION 3a — DECISION BLOCK SAFE SERIALIZATION
// TASK 5: Depth-limited, value-truncated serialization prevents
// deeply nested rule engine results from bloating the prompt.
// ─────────────────────────────────────────────────────────────

/**
 * Recursively serializes an arbitrary value to a prompt-safe representation
 * with configurable depth and string-value length limits.
 *
 * Depth-limiting strategy:
 *   - Primitives are always serialized.
 *   - Arrays at depth >= maxDepth are summarized as "[N items]".
 *   - Objects at depth >= maxDepth are replaced with "[object]".
 *   - String values longer than maxStringChars are truncated with "…[truncated]".
 *
 * This prevents the common failure mode where nested prerequisite trees or
 * rule engine payloads flood the prompt with hundreds of irrelevant tokens
 * that crowd out base instructions and route directives.
 *
 * @param {unknown}  value
 * @param {number}   maxDepth       - Max nesting depth.
 * @param {number}   maxStringChars - Max chars for any single string value.
 * @param {number}   [_depth=0]     - Current recursion depth (internal use only).
 * @returns {unknown}                 Prompt-safe representation of value.
 */
function depthLimitedSerialize(
    value,
    maxDepth = DECISION_MAX_DEPTH,
    maxStringChars = DECISION_MAX_VALUE_CHARS,
    _depth = 0
) {
    if (value === null || value === undefined) return value;

    if (typeof value === "string") {
        return value.length > maxStringChars
            ? `${value.slice(0, maxStringChars)}\u2026[truncated]`
            : value;
    }

    if (typeof value === "number" || typeof value === "boolean") return value;

    if (_depth >= maxDepth) {
        if (Array.isArray(value)) return `[${value.length} items]`;
        if (typeof value === "object") return "[object]";
        return String(value);
    }

    if (Array.isArray(value)) {
        return value.map(item =>
            depthLimitedSerialize(item, maxDepth, maxStringChars, _depth + 1)
        );
    }

    if (typeof value === "object") {
        const result = {};
        for (const [k, v] of Object.entries(value)) {
            result[k] = depthLimitedSerialize(v, maxDepth, maxStringChars, _depth + 1);
        }
        return result;
    }

    return String(value);
}

/**
 * Builds a readable text block from the decision engine's `factors` object.
 * Uses depth-limited serialization to prevent prompt token overflow.
 *
 * @param {Record<string, unknown> | null} decisionContext
 * @returns {{ block: string, count: number, used: boolean }}
 */
function buildDecisionBlock(decisionContext) {
    if (
        !decisionContext ||
        typeof decisionContext !== "object" ||
        Array.isArray(decisionContext) ||
        Object.keys(decisionContext).length === 0
    ) {
        return { block: "", count: 0, used: false };
    }

    let summary;
    try {
        const safe = depthLimitedSerialize(decisionContext);

        const factorLines = Object.entries(safe).map(([k, v]) => {
            const displayValue =
                typeof v === "object" && v !== null
                    ? JSON.stringify(v)
                    : String(v);
            return `  \u2022 ${k}: ${displayValue}`;
        });
        summary = factorLines.join("\n");
    } catch {
        logWarn("decision_block_serialize_failed", {
            reason: "factors object could not be serialized safely — block skipped",
        });
        return { block: "", count: 0, used: false };
    }

    const block =
        "### Decision Engine Factors (Rule-Based Engine — Verified Logic)\n" +
        summary;

    return { block, count: Object.keys(decisionContext).length, used: true };
}

/**
 * Aggregates all context blocks into a single composite payload.
 * Priority ordering: FAQ (1st) → Decision (2nd) → KG (3rd) → RAG (4th).
 *
 * TASK 6: Computes sources_used attribution booleans from builder results.
 *
 * @param {object} params
 * @returns {{ payload: string, metrics: object, sources_used: SourcesUsed }}
 */
function buildContextPayload({ neo4jContext, ragContext, faqContext, decisionContext }) {
    const faqResult = buildFaqBlock(faqContext);
    const decisionResult = buildDecisionBlock(decisionContext);
    const kgResult = buildNeo4jBlock(neo4jContext);
    const ragResult = buildRagBlock(ragContext);

    // Priority order strictly enforced: FAQ > Decision > KG > RAG
    const orderedBlocks = [
        faqResult.block,
        decisionResult.block,
        kgResult.block,
        ragResult.block,
    ].filter(Boolean);

    const payload = orderedBlocks.join("\n\n");

    /**
     * TASK 6 — Source attribution: which builders produced non-empty content.
     * @type {SourcesUsed}
     */
    const sources_used = {
        faq: faqResult.used,
        decision: decisionResult.used,
        kg: kgResult.used,
        rag: ragResult.used,
    };

    const metrics = {
        faq_entries: faqResult.count,
        decision_factors: decisionResult.count,
        kg_facts: kgResult.count,
        rag_passages: ragResult.count,
        total_blocks: orderedBlocks.length,
        payload_chars: payload.length,
        payload_tokens_est: estimateTokens(payload),
        sources_used,
    };

    return { payload, metrics, sources_used };
}


// ─────────────────────────────────────────────────────────────
// SECTION 4 — PROMPT BUILDER (Route-Aware)
// ─────────────────────────────────────────────────────────────

/**
 * Core system prompt establishing the advisor persona and hard rules.
 * Route-specific instructions are appended dynamically at build time.
 *
 * TASK 2 note: "ALWAYS write complete sentences." instruction added
 * to reinforce the truncation-guard objective at the model level.
 */
const BASE_SYSTEM_PROMPT = `
You are an expert academic advisor at AAST (Arab Academy for Science, Technology & Maritime Transport).
Your role is to assist students with accurate, trustworthy, and professional academic guidance.

STRICT RULES YOU MUST FOLLOW AT ALL TIMES:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
1. ONLY use the verified context provided below. Do NOT use any outside knowledge.
2. NEVER hallucinate, invent, speculate, or assume any university policy, rule, or data.
3. NEVER reference facts, names, deadlines, requirements, or regulations not explicitly in the provided context.
4. If the provided context does not contain enough information to answer the question confidently, respond with exactly:
   "${INSUFFICIENT_DATA_PHRASE}"
5. Do NOT mention that you are an AI model, that you consulted a database, or describe your internal workings.
6. NEVER say "according to my training data" or "based on my knowledge" — speak purely from the verified context given.

TONE AND STYLE:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
- Warm, professional, and student-friendly.
- Clear and direct. Plain English. No invented jargon.
- Empathetic and encouraging where appropriate.
- Concise but complete — no padding, no omission of critical detail.
- Natural paragraphs. Bullet lists acceptable when listing steps or options.
- Do NOT start with "Based on the context provided" or similar meta-phrases.
- Do NOT repeat the student's question back verbatim as an opener.
- Do NOT begin with greetings like "Hello!" or "Great question!".
- ALWAYS write complete sentences. Never end mid-sentence or with a dangling clause.

RESPONSE QUALITY STANDARDS:
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
- Accuracy over creativity. When uncertain, err toward caution.
- Every factual claim must be traceable to the provided context.
- Prioritise: FAQ answer \u2192 Decision factors \u2192 Knowledge Graph facts \u2192 Document passages.
`.trim();

/**
 * Resolves and validates the route type.
 * Unknown or missing route types fall back to LLM_FALLBACK.
 *
 * @param {string|undefined} routeType
 * @returns {string} A valid ROUTE_TYPES value.
 */
function resolveRouteType(routeType) {
    if (routeType && Object.values(ROUTE_TYPES).includes(routeType)) {
        return routeType;
    }
    return ROUTE_TYPES.LLM_FALLBACK;
}

/**
 * Assembles the full inference prompt from base system prompt,
 * route-specific behavioral instructions, context payload, and query.
 *
 * @param {string} query
 * @param {string} contextPayload
 * @param {string} routeType
 * @returns {string}
 */
function buildPrompt(query, contextPayload, routeType) {
    const routeInstruction =
        ROUTE_INSTRUCTIONS[routeType] ??
        ROUTE_INSTRUCTIONS[ROUTE_TYPES.LLM_FALLBACK];

    const divider = "\u2500".repeat(60);

    const contextSection = contextPayload
        ? `VERIFIED CONTEXT:\n${divider}\n${contextPayload}\n${divider}`
        : `VERIFIED CONTEXT:\n${divider}\n[No structured context was retrieved for this query.]\n${divider}`;

    return (
        `${BASE_SYSTEM_PROMPT}\n\n` +
        `${routeInstruction}\n\n` +
        `${contextSection}\n\n` +
        `STUDENT QUERY:\n${query.trim()}\n\n` +
        `ADVISOR RESPONSE:`
    );
}


// ─────────────────────────────────────────────────────────────
// SECTION 5 — RESPONSE SANITIZATION + ANTI-TRUNCATION GUARD
// TASK 3 + existing sanitization pipeline.
// ─────────────────────────────────────────────────────────────

/**
 * Regex patterns indicating model self-reference or generic AI filler.
 * @type {RegExp[]}
 */
const META_PHRASE_PATTERNS = [
    /based on the (context|information) provided/gi,
    /according to my training data/gi,
    /as an? (ai|language model|llm|chatbot)/gi,
    /i (don't|do not) have access to real.?time/gi,
    /my knowledge (cut.?off|cutoff)/gi,
    /i cannot (browse|access|search) the (internet|web|database)/gi,
    /let me (look that up|check|search)/gi,
    /^(hello!?|hi!?|hey!?|great question!?|sure!?|of course!?)[,\s]/i,
    /\[no structured context was retrieved[^\]]*\]/gi,
];

/**
 * Characters that unambiguously terminate a complete sentence.
 * Used by repairTruncation to determine response completeness.
 * @type {RegExp}
 */
const TERMINAL_PUNCTUATION_RE = /[.!?\u2026"')\]]/;

/**
 * TASK 3 — Anti-truncation guard.
 *
 * Detects incomplete LLM responses using the absence of terminal punctuation
 * at the end of the text. This catches the failure mode where Gemma's output
 * is cut off by context-window overflow mid-generation.
 *
 * Repair strategy:
 *   1. Locate the last sentence-boundary punctuation in the text.
 *   2. Trim to that boundary, discarding the dangling incomplete fragment.
 *   3. If the repaired remainder is under 20 characters, the response is
 *      too damaged to be useful — return INSUFFICIENT_DATA_PHRASE instead.
 *
 * The model-level instruction "ALWAYS write complete sentences" in BASE_SYSTEM_PROMPT
 * reduces truncation frequency; this guard handles the cases that slip through.
 *
 * @param {string} text - Post-sanitization response text.
 * @returns {{ text: string, repaired: boolean, truncated: boolean }}
 */
function repairTruncation(text) {
    if (!text) return { text, repaired: false, truncated: false };

    const trimmed = text.trimEnd();
    const lastChar = trimmed.at(-1) ?? "";

    // Terminal punctuation present — response is complete
    if (TERMINAL_PUNCTUATION_RE.test(lastChar)) {
        return { text: trimmed, repaired: false, truncated: false };
    }

    // Appears truncated — find the last sentence boundary
    const lastBoundaryMatch = trimmed.match(/[.!?\u2026][^.!?\u2026]*$/);

    if (lastBoundaryMatch) {
        const lastBoundaryIdx = trimmed.lastIndexOf(lastBoundaryMatch[0]);
        if (lastBoundaryIdx > 0) {
            const repaired = trimmed.slice(0, lastBoundaryIdx + 1).trim();

            if (repaired.length >= 20) {
                return { text: repaired, repaired: true, truncated: true };
            }
        }
    }

    // Repair produced insufficient text — return safe fallback
    return {
        text: INSUFFICIENT_DATA_PHRASE,
        repaired: false,
        truncated: true,
    };
}

/**
 * Sanitizes raw LLM output through a multi-stage cleaning pipeline.
 *
 * Stages:
 *   1. Null/empty guard            → FALLBACK_ANSWER
 *   2. Meta-phrase strip           → remove model self-references (inline + full-line)
 *   3. Consecutive deduplication   → collapse repeated adjacent sentences
 *   4. Whitespace normalization    → collapse excess blank lines
 *   5. Minimum length guard        → ultra-short → INSUFFICIENT_DATA_PHRASE
 *   6. Truncation repair (TASK 3)  → detect and fix incomplete sentence endings
 *
 * @param {string|null|undefined} rawResponse
 * @returns {{ text: string, sanitized: boolean, truncated: boolean, rejection_reason?: string }}
 */
function sanitizeResponse(rawResponse) {
    // Stage 1: Null/empty guard
    if (!rawResponse || typeof rawResponse !== "string" || rawResponse.trim().length === 0) {
        return { text: FALLBACK_ANSWER, sanitized: true, truncated: false, rejection_reason: "empty_response" };
    }

    let text = rawResponse.trim();

    // Stage 2: Strip meta-model phrases
    const lines = text.split("\n");
    const cleanedLines = lines
        .map(line => {
            const stripped = line.trim();
            for (const pattern of META_PHRASE_PATTERNS) {
                pattern.lastIndex = 0;
                if (pattern.test(stripped)) {
                    if (stripped.replace(pattern, "").trim().length < 10) return null;
                }
            }
            let cleaned = line;
            for (const pattern of META_PHRASE_PATTERNS) {
                pattern.lastIndex = 0;
                cleaned = cleaned.replace(pattern, "");
            }
            return cleaned.trim() || null;
        })
        .filter(line => line !== null);

    text = cleanedLines.join("\n").trim();

    // Stage 3: Consecutive sentence deduplication
    const sentences = text.split(/(?<=[.!?])\s+/);
    const deduplicated = sentences.filter((sentence, idx) => {
        if (idx === 0) return true;
        const normalize = s =>
            s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
        return normalize(sentence) !== normalize(sentences[idx - 1]);
    });
    text = deduplicated.join(" ").trim();

    // Stage 4: Whitespace normalization
    text = text.replace(/\n{3,}/g, "\n\n").trim();

    // Stage 5: Minimum length guard
    if (text.split(/\s+/).length < 5) {
        return {
            text: INSUFFICIENT_DATA_PHRASE,
            sanitized: true,
            truncated: false,
            rejection_reason: "response_too_short",
        };
    }

    // Stage 6: Truncation repair (TASK 3)
    const { text: repairedText, repaired, truncated } = repairTruncation(text);

    const wasSanitized = repairedText !== rawResponse.trim() || repaired;

    return {
        text: repairedText,
        sanitized: wasSanitized,
        truncated,
        rejection_reason: repaired ? "truncation_repaired" : undefined,
    };
}


// ─────────────────────────────────────────────────────────────
// SECTION 6 — STRUCTURED RESPONSE TYPE (TASK 2)
// UnifiedAnswerResult replaces the bare string return.
// toString() provides soft backward compatibility.
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} SourcesUsed
 * @property {boolean} faq      - Whether a FAQ entry contributed to the answer.
 * @property {boolean} kg       - Whether KG facts contributed to the answer.
 * @property {boolean} rag      - Whether RAG passages contributed to the answer.
 * @property {boolean} decision - Whether decision engine factors contributed.
 */

/**
 * @typedef {object} UnifiedAnswerResult
 * @property {string}      answer       - The synthesized advisory answer string.
 * @property {string}      route        - The resolved ROUTE_TYPES value used.
 * @property {number}      confidence   - The retrievalConfidence value passed in.
 * @property {SourcesUsed} sources_used - Which upstream sources contributed.
 * @property {number}      latency_ms   - Total pipeline wall-clock time in ms.
 * @property {boolean}     sanitized    - Whether the response was modified by sanitization.
 * @property {boolean}     truncated    - Whether a truncated response was detected.
 */

/**
 * Constructs a UnifiedAnswerResult object.
 *
 * BACKWARD COMPATIBILITY NOTE:
 *   The returned object implements toString() returning `answer`, enabling
 *   orchestrators that use the result in string contexts (template literals,
 *   implicit coercion, responseFormatter.format(result)) to continue working
 *   without modification.
 *
 *   Recommended v4 migration:
 *     const result  = await generateUnifiedAnswer({ ... });
 *     const answer  = result.answer;
 *     const sources = result.sources_used;   // new transparency capability
 *
 * @param {object} params
 * @returns {UnifiedAnswerResult}
 */
function createResult({
    answer,
    route,
    confidence,
    sources_used,
    latency_ms,
    sanitized,
    truncated = false,
}) {
    const result = { answer, route, confidence, sources_used, latency_ms, sanitized, truncated };
    // Soft backward compat: string coercion (template literals, implicit) returns answer
    result.toString = () => answer;
    return result;
}

/**
 * Creates a UnifiedAnswerResult for fallback/error scenarios.
 * Ensures consistent shape on all exit paths.
 *
 * @param {string} answerText
 * @param {string} route
 * @param {number} confidence
 * @param {number} latency_ms
 * @returns {UnifiedAnswerResult}
 */
function createFallbackResult(answerText, route, confidence, latency_ms) {
    return createResult({
        answer: answerText,
        route,
        confidence,
        sources_used: { faq: false, kg: false, rag: false, decision: false },
        latency_ms,
        sanitized: false,
        truncated: false,
    });
}


// ─────────────────────────────────────────────────────────────
// SECTION 7 — LLM INTERFACE (Timeout + Retry Protected)
// TASK 1: inferenceOptions injected per route.
// TASK 4: callOllamaWithRetry wraps callOllama with 1-retry
//         exponential backoff on timeout only.
// ─────────────────────────────────────────────────────────────

/**
 * Sends the assembled prompt to the Ollama inference endpoint.
 *
 * @param {string}  prompt
 * @param {{ temperature: number, top_p: number, repeat_penalty: number }} inferenceOptions
 * @param {number}  [timeoutMs=OLLAMA_TIMEOUT_MS]
 * @returns {Promise<string>} Raw model output.
 * @throws {Error} On timeout, network failure, or empty/malformed response.
 */
async function callOllama(
    prompt,
    inferenceOptions = ROUTE_INFERENCE_OPTIONS[ROUTE_TYPES.LLM_FALLBACK],
    timeoutMs = OLLAMA_TIMEOUT_MS
) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    const requestBody = {
        model: MODEL,
        prompt,
        stream: false,
        options: {
            temperature: inferenceOptions.temperature,
            top_p: inferenceOptions.top_p,
            repeat_penalty: inferenceOptions.repeat_penalty,
        },
    };

    let response;
    try {
        response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
    } finally {
        // Always clear timeout — prevents memory leak on long-running processes
        clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
        throw new Error(
            `Ollama inference failed: HTTP ${response.status} ${response.statusText}`
        );
    }

    const data = await response.json();

    const answer =
        data?.response?.trim() ??
        data?.message?.content?.trim() ??
        null;

    if (!answer) {
        throw new Error("Ollama returned an empty or unrecognised response payload.");
    }

    return answer;
}

/**
 * TASK 4 — Retry wrapper for callOllama with exponential backoff.
 *
 * Retry policy:
 *   - ONLY AbortError (timeout) triggers retry. Rationale: timeouts are
 *     transient load conditions; HTTP/parse errors signal structural problems
 *     that an immediate retry is unlikely to resolve.
 *   - Maximum retries: OLLAMA_MAX_RETRIES (1).
 *   - Backoff: OLLAMA_RETRY_BASE_DELAY_MS * 2^(attempt-1) ms.
 *     Attempt 0 → immediate; attempt 1 → 1 000 ms wait.
 *   - Every attempt and retry is individually logged for full traceability.
 *   - If all retries are exhausted, the final error is re-thrown to the caller.
 *
 * @param {string}  prompt
 * @param {{ temperature: number, top_p: number, repeat_penalty: number }} inferenceOptions
 * @param {string}  route            - Resolved route type (log context only).
 * @returns {Promise<string>}          Raw model output.
 * @throws {Error}                     If all attempts exhaust without success.
 */
async function callOllamaWithRetry(prompt, inferenceOptions, route) {
    let lastError;

    for (let attempt = 0; attempt <= OLLAMA_MAX_RETRIES; attempt++) {
        const isRetry = attempt > 0;

        if (isRetry) {
            const backoffMs = OLLAMA_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
            logWarn("ollama_retry_scheduled", {
                route,
                attempt,
                max_retries: OLLAMA_MAX_RETRIES,
                backoff_ms: backoffMs,
                error_reason: lastError?.message ?? "unknown",
            });
            await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        const attemptStart = Date.now();

        try {
            const result = await callOllama(prompt, inferenceOptions);
            const attemptMs = Date.now() - attemptStart;

            if (isRetry) {
                logInfo("ollama_retry_succeeded", {
                    route,
                    attempt,
                    attempt_latency_ms: attemptMs,
                });
            }

            return result;

        } catch (error) {
            lastError = error;
            const attemptMs = Date.now() - attemptStart;
            const isTimeout = error?.name === "AbortError";

            logWarn("ollama_attempt_failed", {
                route,
                attempt,
                is_timeout: isTimeout,
                error_message: error?.message ?? String(error),
                attempt_latency_ms: attemptMs,
            });

            // Non-timeout errors are not retried — propagate immediately
            if (!isTimeout) throw error;

            // Last allowed attempt exhausted — propagate the timeout error
            if (attempt >= OLLAMA_MAX_RETRIES) throw error;
        }
    }

    // Unreachable — satisfies linters
    throw lastError;
}


// ─────────────────────────────────────────────────────────────
// SECTION 8 — PRIMARY EXPORT
// ─────────────────────────────────────────────────────────────

/**
 * generateUnifiedAnswer
 * ─────────────────────
 * Synthesises a final, grounded, student-friendly advisory answer
 * from the outputs of the KG, RAG, FAQ, and Decision subsystems.
 *
 * v4 RETURN TYPE: UnifiedAnswerResult — structured object exposing
 * answer text, route used, source attribution, latency, and sanitization
 * flags. The object's toString() returns the answer string directly for
 * soft backward compatibility with v3 orchestrators.
 *
 * ── ORCHESTRATOR USAGE (v4 — Recommended) ─────────────────────────────
 * ```js
 * const result = await generateUnifiedAnswer({
 *   query,
 *   routeType:           "HYBRID",
 *   retrievalConfidence: 0.78,
 *   neo4jContext:        kgResults,
 *   ragContext:          await ragService.retrieve(query),
 *   faqContext:          searchFAQ(query),
 *   decisionContext:     decisionResult.factors,
 * });
 *
 * // Native v4 access
 * return responseFormatter.format(result.answer, {
 *   sources:   result.sources_used,
 *   route:     result.route,
 *   latency:   result.latency_ms,
 * });
 * ```
 *
 * ── ORCHESTRATOR USAGE (v3 backward compat — no changes needed) ───────
 * ```js
 * const answer = await generateUnifiedAnswer({ query, ... });
 * return responseFormatter.format(answer);  // toString() → result.answer
 * ```
 *
 * @param {object} params
 * @param {string}  params.query
 * @param {string}  [params.routeType="LLM_FALLBACK"]
 * @param {number}  [params.retrievalConfidence=1.0]
 * @param {Array}   [params.neo4jContext=[]]
 * @param {*}       [params.ragContext=[]]
 * @param {object|null} [params.faqContext=null]
 * @param {object|null} [params.decisionContext=null]
 * @returns {Promise<UnifiedAnswerResult>}
 */
export async function generateUnifiedAnswer({
    query,
    routeType = ROUTE_TYPES.LLM_FALLBACK,
    retrievalConfidence = 1.0,
    neo4jContext = [],
    ragContext = [],
    faqContext = null,
    decisionContext = null,
} = {}) {

    // ── Guard: query is mandatory ─────────────────────────────────────
    if (!query || typeof query !== "string" || query.trim() === "") {
        logError("invalid_query", { reason: "empty_or_non_string_query" });
        return createFallbackResult(FALLBACK_ANSWER, ROUTE_TYPES.LLM_FALLBACK, retrievalConfidence, 0);
    }

    const resolvedRoute = resolveRouteType(routeType);
    const truncatedQuery = query.trim().slice(0, 120);

    // ── Confidence Gate ───────────────────────────────────────────────
    if (
        typeof retrievalConfidence === "number" &&
        retrievalConfidence < CONFIDENCE_GATE_THRESHOLD
    ) {
        logWarn("confidence_gate_triggered", {
            route: resolvedRoute,
            retrieval_confidence: retrievalConfidence,
            threshold: CONFIDENCE_GATE_THRESHOLD,
            query_preview: truncatedQuery,
            fallback_reason: "below_confidence_threshold",
        });
        return createFallbackResult(INSUFFICIENT_DATA_PHRASE, resolvedRoute, retrievalConfidence, 0);
    }

    const pipelineStart = Date.now();

    logInfo("pipeline_start", {
        route: resolvedRoute,
        retrieval_confidence: retrievalConfidence,
        query_preview: truncatedQuery,
        model: MODEL,
        ollama_url: OLLAMA_URL,
        max_retries: OLLAMA_MAX_RETRIES,
    });

    try {
        // ── Step 1: Assemble context payload ─────────────────────────────
        const { payload: contextPayload, metrics: contextMetrics, sources_used } =
            buildContextPayload({ neo4jContext, ragContext, faqContext, decisionContext });

        logInfo("context_built", {
            route: resolvedRoute,
            ...contextMetrics,
        });

        // ── Step 2: Build inference prompt ───────────────────────────────
        const prompt = buildPrompt(query.trim(), contextPayload, resolvedRoute);
        const promptTokenEst = estimateTokens(prompt);

        logInfo("prompt_built", {
            route: resolvedRoute,
            prompt_chars: prompt.length,
            prompt_tokens_est: promptTokenEst,
        });

        // TASK 8 — Tiered token budget alerts
        if (promptTokenEst >= PROMPT_TOKEN_CRITICAL_THRESHOLD) {
            logError("prompt_token_critical", {
                route: resolvedRoute,
                prompt_tokens_est: promptTokenEst,
                threshold: PROMPT_TOKEN_CRITICAL_THRESHOLD,
                impact: "CRITICAL: context truncation by model is probable — answer quality at serious risk",
                action: "reduce neo4jContext, ragContext, or decisionContext payload before calling",
            });
        } else if (promptTokenEst >= PROMPT_TOKEN_WARN_THRESHOLD) {
            logWarn("prompt_token_warning", {
                route: resolvedRoute,
                prompt_tokens_est: promptTokenEst,
                threshold: PROMPT_TOKEN_WARN_THRESHOLD,
                impact: "WARNING: prompt approaching context limit — monitor for quality degradation",
                action: "consider reducing context sources if answer quality decreases",
            });
        }

        // ── Step 3: Resolve route-adaptive inference options (TASK 1) ────
        const inferenceOptions = buildInferenceOptions(resolvedRoute);

        logInfo("inference_options_resolved", {
            route: resolvedRoute,
            temperature: inferenceOptions.temperature,
            top_p: inferenceOptions.top_p,
            repeat_penalty: inferenceOptions.repeat_penalty,
        });

        // ── Step 4: Inference with retry (TASK 4) ────────────────────────
        const ollamaStart = Date.now();
        const rawAnswer = await callOllamaWithRetry(prompt, inferenceOptions, resolvedRoute);
        const ollamaLatencyMs = Date.now() - ollamaStart;

        logInfo("ollama_response_received", {
            route: resolvedRoute,
            ollama_latency_ms: ollamaLatencyMs,
            raw_response_chars: rawAnswer.length,
        });

        // ── Step 5: Sanitize + truncation repair ─────────────────────────
        const { text: finalAnswer, sanitized, truncated, rejection_reason } =
            sanitizeResponse(rawAnswer);

        if (sanitized || truncated) {
            logWarn("response_post_processed", {
                route: resolvedRoute,
                sanitized,
                truncated,
                rejection_reason: rejection_reason ?? "meta_phrase_stripped",
                raw_chars: rawAnswer.length,
                clean_chars: finalAnswer.length,
            });
        }

        const totalLatencyMs = Date.now() - pipelineStart;

        logInfo("pipeline_complete", {
            route: resolvedRoute,
            total_latency_ms: totalLatencyMs,
            ollama_latency_ms: ollamaLatencyMs,
            answer_chars: finalAnswer.length,
            answer_tokens_est: estimateTokens(finalAnswer),
            sanitized,
            truncated,
            sources_used,
        });

        // ── Step 6: Return structured result (TASK 2) ────────────────────
        return createResult({
            answer: finalAnswer,
            route: resolvedRoute,
            confidence: retrievalConfidence,
            sources_used,
            latency_ms: totalLatencyMs,
            sanitized,
            truncated,
        });

    } catch (error) {
        const isTimeout = error?.name === "AbortError";
        const totalLatencyMs = Date.now() - pipelineStart;

        logError("pipeline_failed", {
            route: resolvedRoute,
            query_preview: truncatedQuery,
            model: MODEL,
            ollama_url: OLLAMA_URL,
            error_type: isTimeout ? "timeout_exhausted" : "inference_error",
            error_message: error?.message ?? String(error),
            total_latency_ms: totalLatencyMs,
            fallback_triggered: true,
        });

        return createFallbackResult(FALLBACK_ANSWER, resolvedRoute, retrievalConfidence, totalLatencyMs);
    }
}


// ─────────────────────────────────────────────────────────────
// NAMED INTERNAL EXPORTS
// Fully backward-compatible with v2 and v3 orchestrator imports.
// All v3 exports preserved; v4 additions clearly annotated.
// ─────────────────────────────────────────────────────────────

export {
    // ── Configuration ─────────────────────────────────────────────────
    OLLAMA_BASE_URL,
    OLLAMA_URL,
    MODEL,
    OLLAMA_TIMEOUT_MS,
    OLLAMA_MAX_RETRIES,                  // NEW v4
    OLLAMA_RETRY_BASE_DELAY_MS,          // NEW v4
    CONFIDENCE_GATE_THRESHOLD,
    MAX_KG_FACTS,
    MAX_RAG_PASSAGES,
    DECISION_MAX_DEPTH,                  // NEW v4
    DECISION_MAX_VALUE_CHARS,            // NEW v4
    PROMPT_TOKEN_WARN_THRESHOLD,         // NEW v4 (replaces inline literal)
    PROMPT_TOKEN_CRITICAL_THRESHOLD,     // NEW v4
    FALLBACK_ANSWER,
    INSUFFICIENT_DATA_PHRASE,

    // ── Route system ──────────────────────────────────────────────────
    ROUTE_TYPES,
    ROUTE_INSTRUCTIONS,
    ROUTE_INFERENCE_OPTIONS,             // NEW v4
    resolveRouteType,
    buildInferenceOptions,               // NEW v4

    // ── Context builders ──────────────────────────────────────────────
    buildNeo4jBlock,
    buildRagBlock,
    buildFaqBlock,
    buildDecisionBlock,
    buildContextPayload,
    depthLimitedSerialize,               // NEW v4

    // ── Prompt assembly ───────────────────────────────────────────────
    BASE_SYSTEM_PROMPT,
    buildPrompt,

    // ── Response pipeline ─────────────────────────────────────────────
    sanitizeResponse,
    repairTruncation,                    // NEW v4

    // ── Result factories ──────────────────────────────────────────────
    createResult,                        // NEW v4
    createFallbackResult,                // NEW v4

    // ── LLM interface ─────────────────────────────────────────────────
    callOllama,
    callOllamaWithRetry,                 // NEW v4

    // ── Observability utilities ───────────────────────────────────────
    logInfo,
    logWarn,
    logError,
    estimateTokens,
};