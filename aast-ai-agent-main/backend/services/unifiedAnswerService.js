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
 * VERSION: 4.1.1  — Final Phase 3 stability micro-patches
 *
 * CHANGELOG (v4.1.1):
 *   - Fixed immutability violation: cloning inference options before mutation in degraded mode.
 *   - Improved prompt trimming accuracy: implemented iterative build-measure-trim-rebuild loop.
 *   - Polished deterministic fallback tone: replaced mechanical prefixes with professional academic language.
 *   - Enhanced source attribution: deterministic fallback now uses robust builder-level usage detection.
 *   - Added recursive critical trimming safety loop to prevent token budget overflows.
 *
 * CHANGELOG (v4.1.0):
 *   - Removed direct fetch and localized Ollama infra in favor of centralized ollamaService.
 *   - Implemented tiered confidence gating (0.25 degraded threshold).
 *   - Added deterministic fallback mechanism to preserve verified context on LLM failure.
 *   - Implemented proactive prompt auto-trimming to prevent context window overflow.
 *   - Integrated generateStableResponse for improved inference reliability.
 * ============================================================
 */

import { generateStableResponse } from "./ollamaService.js";

// ─────────────────────────────────────────────────────────────
// SECTION 0 — CONFIGURATION CONSTANTS
// ─────────────────────────────────────────────────────────────

/** Model used for final answer synthesis. DO NOT CHANGE. */
const MODEL = "gemma4:e2b";

/**
 * Minimum retrieval confidence score (0–1).
 * Below this threshold the LLM call is bypassed.
 */
const CONFIDENCE_GATE_THRESHOLD = 0.40;

/**
 * Threshold for degraded operation (0–1).
 * Between this and the full threshold, we operate in high-caution mode.
 */
const DEGRADED_CONFIDENCE_THRESHOLD = 0.25;

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
 * @param {number} [limit=MAX_KG_FACTS]
 * @returns {{ block: string, count: number, used: boolean }}
 */
function buildNeo4jBlock(neo4jContext, limit = MAX_KG_FACTS) {
    if (!Array.isArray(neo4jContext) || neo4jContext.length === 0) {
        return { block: "", count: 0, used: false };
    }

    const sorted = [...neo4jContext].sort((a, b) =>
        (b.confidence ?? 0) - (a.confidence ?? 0)
    );
    const capped = sorted.slice(0, limit);

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
 * Caps at limit (default MAX_RAG_PASSAGES).
 *
 * @param {{ results?: Array<object> } | Array<object> | string | null} ragContext
 * @param {number} [limit=MAX_RAG_PASSAGES]
 * @returns {{ block: string, count: number, used: boolean }}
 */
function buildRagBlock(ragContext, limit = MAX_RAG_PASSAGES) {
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

    const capped = passages.slice(0, limit);

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
 * PROMPT AUTO-TRIMMING (Phase 3 Stabilization)
 * ───────────────────────────────────────────
 * Proactively reduces context sizes based on prompt budget thresholds.
 *
 * @param {number} currentTokens
 * @returns {object} Trimmed limits for builders
 */
function trimContextToBudget(currentTokens) {
    const config = {
        kgFacts: MAX_KG_FACTS,
        ragPassages: MAX_RAG_PASSAGES,
        includeRag: true,
        includeKg: true,
        includeDecision: true,
        includeFaq: true,
    };

    if (currentTokens >= PROMPT_TOKEN_CRITICAL_THRESHOLD) {
        logWarn("context_trimming_critical", { tokens: currentTokens });
        // Drop low-priority context first: RAG > KG
        config.includeRag = false;
        config.includeKg = false;
        // Decision and FAQ preserved as highest priority
    } else if (currentTokens >= PROMPT_TOKEN_WARN_THRESHOLD) {
        logWarn("context_trimming_warning", { tokens: currentTokens });
        // Reduce counts progressively
        config.kgFacts = Math.max(1, Math.floor(MAX_KG_FACTS / 2));
        config.ragPassages = Math.max(2, Math.floor(MAX_RAG_PASSAGES / 2));
    }

    return config;
}

/**
 * Aggregates all context blocks into a single composite payload.
 * Priority ordering: FAQ (1st) → Decision (2nd) → KG (3rd) → RAG (4th).
 *
 * TASK 6: Computes sources_used attribution booleans from builder results.
 *
 * @param {object} params
 * @param {object} [trimConfig]
 * @returns {{ payload: string, metrics: object, sources_used: SourcesUsed }}
 */
function buildContextPayload({ neo4jContext, ragContext, faqContext, decisionContext }, trimConfig = null) {
    const config = trimConfig || {
        kgFacts: MAX_KG_FACTS,
        ragPassages: MAX_RAG_PASSAGES,
        includeRag: true,
        includeKg: true,
        includeDecision: true,
        includeFaq: true
    };

    const faqResult = config.includeFaq ? buildFaqBlock(faqContext) : { block: "", count: 0, used: false };
    const decisionResult = config.includeDecision ? buildDecisionBlock(decisionContext) : { block: "", count: 0, used: false };
    const kgResult = config.includeKg ? buildNeo4jBlock(neo4jContext, config.kgFacts) : { block: "", count: 0, used: false };
    const ragResult = config.includeRag ? buildRagBlock(ragContext, config.ragPassages) : { block: "", count: 0, used: false };

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

/**
 * DETERMINISTIC FALLBACK BUILDER (Phase 3 Stabilization)
 * ──────────────────────────────────────────────────
 * Synthesizes a verified answer from structured context without LLM inference.
 * Used as a primary safety net for LLM failures or timeouts.
 */
function buildDeterministicFallbackAnswer({ faqContext, decisionContext, neo4jContext, ragContext }) {
    // 1. FAQ answer (Highest precision)
    if (faqContext?.answer) {
        return `According to verified university policy: ${faqContext.answer}`;
    }

    // 2. Decision summary
    if (decisionContext) {
        const outcome = decisionContext.outcome || decisionContext.verdict;
        if (outcome) {
            return `Based on verified academic evaluation: The advisory system has determined the outcome is: ${outcome}. Please contact your advisor for full details.`;
        }
    }

    // 3. KG top fact
    if (Array.isArray(neo4jContext) && neo4jContext.length > 0) {
        const sorted = [...neo4jContext].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
        const topFact = sorted[0];
        const evidence = topFact?.evidence || topFact?.text || topFact?.content;
        if (evidence) {
            return `According to verified university records: ${evidence}`;
        }
    }

    // 4. RAG summary (First passage)
    if (ragContext) {
        let firstPassage = "";
        if (Array.isArray(ragContext) && ragContext[0]) {
            firstPassage = typeof ragContext[0] === 'string' ? ragContext[0] : (ragContext[0].text || ragContext[0].content);
        } else if (ragContext.results && ragContext.results[0]) {
            firstPassage = ragContext.results[0].text || ragContext.results[0].content;
        }

        if (firstPassage && firstPassage.length > 20) {
            return `According to official university documentation: ${firstPassage.slice(0, 300).trim()}...`;
        }
    }

    return null;
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
───
1. ONLY use the verified context provided below. Do NOT use any outside knowledge.
2. NEVER hallucinate, invent, speculate, or assume any university policy, rule, or data.
3. NEVER reference facts, names, deadlines, requirements, or regulations not explicitly in the provided context.
4. If the provided context does not contain enough information to answer the question confidently, respond with exactly:
   "${INSUFFICIENT_DATA_PHRASE}"
5. Do NOT mention that you are an AI model, that you consulted a database, or describe your internal workings.
6. NEVER say "according to my training data" or "based on my knowledge" — speak purely from the verified context given.

TONE AND STYLE:
───
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
───
- Accuracy over creativity. When uncertain, err toward caution.
- Every factual claim must be traceable to the provided context.
- Prioritise: FAQ answer → Decision factors → Knowledge Graph facts → Document passages.
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

    const divider = "─".repeat(60);

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
 * @param {SourcesUsed} [sources_used]
 * @returns {UnifiedAnswerResult}
 */
function createFallbackResult(answerText, route, confidence, latency_ms, sources_used = null) {
    return createResult({
        answer: answerText,
        route,
        confidence,
        sources_used: sources_used || { faq: false, kg: false, rag: false, decision: false },
        latency_ms,
        sanitized: false,
        truncated: false,
    });
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
    const pipelineStart = Date.now();

    // ── Tiered Confidence Gating (Phase 3 Stabilization) ────────────────
    const isDegraded = retrievalConfidence >= DEGRADED_CONFIDENCE_THRESHOLD && retrievalConfidence < CONFIDENCE_GATE_THRESHOLD;

    if (retrievalConfidence < DEGRADED_CONFIDENCE_THRESHOLD) {
        logWarn("confidence_gate_triggered", {
            route: resolvedRoute,
            retrieval_confidence: retrievalConfidence,
            threshold: DEGRADED_CONFIDENCE_THRESHOLD,
            query_preview: truncatedQuery,
            fallback_reason: "below_minimum_confidence",
        });
        return createFallbackResult(INSUFFICIENT_DATA_PHRASE, resolvedRoute, retrievalConfidence, 0);
    }

    logInfo("pipeline_start", {
        route: resolvedRoute,
        retrieval_confidence: retrievalConfidence,
        is_degraded: isDegraded,
        query_preview: truncatedQuery,
        model: MODEL
    });

    try {
        // ── Step 1: Assemble context with auto-trimming budget checks ─────
        let currentTrimConfig = null;
        let contextPayload, contextMetrics, sources_used;
        let prompt, promptTokenEst;

        // FINAL MICRO-PATCH 2: Iterative build-measure-trim-rebuild loop
        for (let pass = 1; pass <= 3; pass++) {
            ({ payload: contextPayload, metrics: contextMetrics, sources_used } =
                buildContextPayload({ neo4jContext, ragContext, faqContext, decisionContext }, currentTrimConfig));

            prompt = buildPrompt(query.trim(), contextPayload, resolvedRoute);
            promptTokenEst = estimateTokens(prompt);

            if (promptTokenEst < PROMPT_TOKEN_WARN_THRESHOLD) break;
            if (pass === 3) break; // Exceeded max passes

            logWarn("budget_exceeded_recalculating_trim", { pass, tokens: promptTokenEst });
            currentTrimConfig = trimContextToBudget(promptTokenEst);
        }

        logInfo("context_finalized", {
            route: resolvedRoute,
            ...contextMetrics,
            final_prompt_tokens: promptTokenEst
        });

        // ── Step 2: Build inference prompt ───────────────────────────────
        // (Handled by iterative loop above)

        // ── Step 3: Resolve route-adaptive inference options ────────────
        // FINAL MICRO-PATCH 1: FIX IMMUTABILITY VIOLATION
        const inferenceOptions = { ...buildInferenceOptions(resolvedRoute) };

        // Implement Degraded Mode: Lower temperature for caution
        if (isDegraded) {
            logInfo("degraded_mode_active", { original_temp: inferenceOptions.temperature });
            inferenceOptions.temperature = Math.min(inferenceOptions.temperature, 0.10);
        }

        logInfo("inference_options_resolved", {
            route: resolvedRoute,
            temperature: inferenceOptions.temperature,
            top_p: inferenceOptions.top_p,
            repeat_penalty: inferenceOptions.repeat_penalty,
        });

        // ── Step 4: Inference with centralized ollamaService ────────────
        const ollamaStart = Date.now();
        const rawAnswer = await generateStableResponse({
            prompt,
            model: MODEL,
            requestId: `unified_${Date.now()}`,
            options: inferenceOptions,
        });
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

        // ── Step 6: Return structured result ────────────────────
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
        const totalLatencyMs = Date.now() - pipelineStart;

        logError("pipeline_failed", {
            route: resolvedRoute,
            query_preview: truncatedQuery,
            error_message: error?.message ?? String(error),
            total_latency_ms: totalLatencyMs,
        });

        // ── Phase 3: Deterministic Fallback ──────────────────────────────
        const deterministicAnswer = buildDeterministicFallbackAnswer({
            faqContext,
            decisionContext,
            neo4jContext,
            ragContext
        });

        // FINAL MICRO-PATCH 4: Robust source attribution for deterministic fallback
        const fallbackSources = {
            faq: !!buildFaqBlock(faqContext).used,
            decision: !!buildDecisionBlock(decisionContext).used,
            kg: !!buildNeo4jBlock(neo4jContext).used,
            rag: !!buildRagBlock(ragContext).used,
        };

        if (deterministicAnswer) {
            logInfo("deterministic_fallback_successful", { route: resolvedRoute });
            return createResult({
                answer: deterministicAnswer,
                route: resolvedRoute,
                confidence: retrievalConfidence,
                sources_used: fallbackSources,
                latency_ms: totalLatencyMs,
                sanitized: false,
                truncated: false
            });
        }

        return createFallbackResult(FALLBACK_ANSWER, resolvedRoute, retrievalConfidence, totalLatencyMs);
    }
}


// ─────────────────────────────────────────────────────────────
// NAMED INTERNAL EXPORTS
// ─────────────────────────────────────────────────────────────

export {
    // ── Configuration ─────────────────────────────────────────────────
    MODEL,
    CONFIDENCE_GATE_THRESHOLD,
    DEGRADED_CONFIDENCE_THRESHOLD,       // NEW Phase 3
    MAX_KG_FACTS,
    MAX_RAG_PASSAGES,
    DECISION_MAX_DEPTH,
    DECISION_MAX_VALUE_CHARS,
    PROMPT_TOKEN_WARN_THRESHOLD,
    PROMPT_TOKEN_CRITICAL_THRESHOLD,
    FALLBACK_ANSWER,
    INSUFFICIENT_DATA_PHRASE,

    // ── Route system ──────────────────────────────────────────────────
    ROUTE_TYPES,
    ROUTE_INSTRUCTIONS,
    ROUTE_INFERENCE_OPTIONS,
    resolveRouteType,
    buildInferenceOptions,

    // ── Context builders ──────────────────────────────────────────────
    buildNeo4jBlock,
    buildRagBlock,
    buildFaqBlock,
    buildDecisionBlock,
    buildContextPayload,
    depthLimitedSerialize,
    trimContextToBudget,                  // NEW Phase 3
    buildDeterministicFallbackAnswer,     // NEW Phase 3

    // ── Prompt assembly ───────────────────────────────────────────────
    BASE_SYSTEM_PROMPT,
    buildPrompt,

    // ── Response pipeline ─────────────────────────────────────────────
    sanitizeResponse,
    repairTruncation,

    // ── Result factories ──────────────────────────────────────────────
    createResult,
    createFallbackResult,

    // ── Observability utilities ───────────────────────────────────────
    logInfo,
    logWarn,
    logError,
    estimateTokens,
};
