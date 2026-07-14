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

import {
    generateStableResponse,
    getLastGenerationMetadata,
    getOllamaRuntimeStatus
} from "./ollamaService.js";
import {
    generateGeminiSynthesis,
    isGeminiTimeoutError
} from "./geminiService.js";
import { convertToGraphData } from "./neo4jcontext.js";
import { LLM_CONFIG } from "../config/llmConfig.js";
import { getGemmaTelemetrySnapshot } from "./gemmaTelemetryService.js";
import { incrementMetric } from "./metrics.js";
import { runtimeMode } from "../config/runtimeMode.js";

// ─────────────────────────────────────────────────────────────
// SECTION 0 — CONFIGURATION CONSTANTS
// ─────────────────────────────────────────────────────────────

/** Local Gemma model used as the primary synthesis provider. */
const MODEL = process.env.PRIMARY_MODEL || process.env.OLLAMA_MODEL || "gemma4:e2b";

function timeoutFromEnv(names, fallback) {
    for (const name of names) {
        const parsed = Number.parseInt(process.env[name], 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }

    return fallback;
}

const SYNTHESIS_TIMEOUT_MS = timeoutFromEnv(
    ["SYNTHESIS_TIMEOUT_MS", "OLLAMA_SYNTHESIS_TIMEOUT_MS"],
    LLM_CONFIG.timeouts.synthesisMs || LLM_CONFIG.timeouts.primaryMs
);

const SYNTHESIS_DEADLINE_MS = timeoutFromEnv(
    ["SYNTHESIS_DEADLINE_MS", "LLM_SYNTHESIS_DEADLINE_MS"],
    LLM_CONFIG.timeouts.synthesisDeadlineMs || LLM_CONFIG.timeouts.generationDeadlineMs
);

const GEMINI_SYNTHESIS_TIMEOUT_MS = timeoutFromEnv(
    ["GEMINI_SYNTHESIS_TIMEOUT_MS", "GEMINI_TIMEOUT_MS"],
    10000
);

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
const MAX_RAG_PASSAGES = 3;

/** Maximum recent non-system conversation messages to expose to synthesis. */
const MAX_HISTORY_MESSAGES = 4;

/** Maximum characters per conversation-history message. */
const MAX_HISTORY_MESSAGE_CHARS = 320;

/** Maximum total characters for the conversation-history prompt block. */
const MAX_HISTORY_TOTAL_CHARS = 1000;

/** Maximum total characters for lightweight session-memory injection. */
const MAX_MEMORY_BLOCK_CHARS = 500;

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
const PROMPT_TOKEN_WARN_THRESHOLD = Math.floor(LLM_CONFIG.gemma.maxContextTokens * 0.80);

/**
 * Prompt token count at which a CRITICAL-level alert is emitted.
 * At this size, context truncation by the model is likely, degrading quality.
 */
const PROMPT_TOKEN_CRITICAL_THRESHOLD = LLM_CONFIG.gemma.maxContextTokens;

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
    CAREER: "CAREER",
    GENERAL: "GENERAL",
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
    [ROUTE_TYPES.KG_ONLY]: { temperature: 0.12, top_p: 0.78, repeat_penalty: 1.16 },
    [ROUTE_TYPES.FAQ_ONLY]: { temperature: 0.10, top_p: 0.75, repeat_penalty: 1.10 },
    [ROUTE_TYPES.RAG_ONLY]: { temperature: 0.16, top_p: 0.82, repeat_penalty: 1.16 },
    [ROUTE_TYPES.DECISION]: { temperature: 0.14, top_p: 0.80, repeat_penalty: 1.15 },
    [ROUTE_TYPES.CAREER]: { temperature: 0.14, top_p: 0.80, repeat_penalty: 1.15 },
    [ROUTE_TYPES.GENERAL]: { temperature: 0.16, top_p: 0.82, repeat_penalty: 1.15 },
    [ROUTE_TYPES.HYBRID]: { temperature: 0.18, top_p: 0.84, repeat_penalty: 1.16 },
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
    const profile =
        ROUTE_INFERENCE_OPTIONS[resolvedRouteType] ??
        ROUTE_INFERENCE_OPTIONS[ROUTE_TYPES.LLM_FALLBACK];

    // RC-12 (F3.4): route-adaptive temperatures (0.10-0.18) made the wording of
    // synthesized answers drift between identical asks. Under deterministic
    // synthesis (default), sample greedily so the same prompt yields the same
    // output. top_p is irrelevant at temperature 0 but pinned low for clarity.
    if (runtimeMode.deterministicSynthesis) {
        return { ...profile, temperature: 0, top_p: 0.1 };
    }

    return profile;
}

/**
 * Per-route behavioral instruction blocks injected into the system prompt.
 *
 * TASK 7: RAG_ONLY and HYBRID now include a policy formatting directive
 * that encourages natural AAST policy anchoring.
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
- When the retrieved content contains a policy rule or regulation, anchor it naturally with wording like:
  "AAST academic regulations state that ..." before explaining the rule.
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

    [ROUTE_TYPES.CAREER]: `
ROUTE: Career Engine
You are presenting a verified academic-to-career roadmap.
- Lead with the target role or pathway clearly.
- Explain the top skills, progression logic, and academic preparation steps from the provided evidence.
- Keep the response practical and student-friendly.
- Do not invent market claims, certifications, or university rules not present in the context.
`.trim(),

    [ROUTE_TYPES.GENERAL]: `
ROUTE: General Academic Guidance
You are answering with the best verified academic context available.
- Prefer grounded academic guidance over broad motivational language.
- If the context is partial, state the limitation clearly.
- Do not imply policy certainty unless verified policy evidence is present.
- Keep the response useful, cautious, and professionally phrased.
`.trim(),

    [ROUTE_TYPES.HYBRID]: `
ROUTE: Hybrid (Multi-Source)
You are synthesizing from multiple verified sources of different types.
- Prioritize in order: FAQ answer → Knowledge Graph facts → Decision factors → Retrieved documents.
- Use each source for what it does best: FAQ for confirmed policy wording, Decision for eligibility
  verdict, KG for specific entities and relationships, RAG for regulatory depth.
- Where the answer draws on policy or regulatory documents, anchor it naturally with wording like:
  "AAST academic regulations state that ..." before explaining the rule.
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

const EMPTY_GRAPH = Object.freeze({ nodes: [], links: [] });


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

function hardTruncateToTokenBudget(text, maxTokens) {
    const value = String(text ?? "");
    const maxChars = Math.max(0, maxTokens * 4);

    if (estimateTokens(value) <= maxTokens) {
        return { text: value, truncated: false };
    }

    return {
        text:
            value.slice(0, Math.max(0, maxChars)).trimEnd() +
            "\n\n[Lower-priority context truncated to protect Gemma context budget.]",
        truncated: true,
    };
}

function routeNumPredict(routeType, promptTokenEst = 0) {
    const route = String(routeType || "").toUpperCase();
    const pressure = getGemmaTelemetrySnapshot().gemma_memory_pressure;
    let value = LLM_CONFIG.gemma.numPredict.synthesis;

    if (route.includes("HYBRID") || route.includes("RAG")) {
        value = LLM_CONFIG.gemma.numPredict.heavy;
    } else if (route.includes("KG") || route.includes("FAQ")) {
        value = LLM_CONFIG.gemma.numPredict.light;
    } else if (route.includes("FALLBACK")) {
        value = LLM_CONFIG.gemma.numPredict.fallback;
    }

    if (promptTokenEst >= PROMPT_TOKEN_WARN_THRESHOLD || pressure.high) {
        value = Math.min(value, LLM_CONFIG.gemma.numPredict.heavy);
    }

    if (pressure.critical) {
        value = Math.min(value, LLM_CONFIG.gemma.numPredict.light);
    }

    return value;
}


// ─────────────────────────────────────────────────────────────
// SECTION 3 — CONTEXT BUILDERS
// All builders now return { block, count, used } instead of bare
// strings. The `used` boolean feeds TASK 6 source attribution.
// ─────────────────────────────────────────────────────────────

async function runOllamaSynthesis({
    prompt,
    resolvedRoute,
    inferenceOptions,
    requestId,
    promptTokenEst,
    fallbackFromGemini = false,
    allowBackup = false,
}) {
    const ollamaStart = Date.now();
    const ollamaRequestId = `${fallbackFromGemini ? "unified_ollama_fallback" : "unified_gemma_primary"}_${Date.now()}`;
    const ollamaModel = MODEL;

    logInfo("synthesis_timeout_budget_resolved", {
        route: resolvedRoute,
        requestId: ollamaRequestId,
        synthesis_timeout_ms: SYNTHESIS_TIMEOUT_MS,
        synthesis_deadline_ms: SYNTHESIS_DEADLINE_MS,
        primary_timeout_ms: LLM_CONFIG.timeouts.primaryMs,
        generation_deadline_ms: LLM_CONFIG.timeouts.generationDeadlineMs,
        fallback_from_gemini: fallbackFromGemini,
    });

    const rawAnswer = await generateStableResponse({
        prompt,
        model: ollamaModel,
        requestId: ollamaRequestId,
        timeoutMs: SYNTHESIS_TIMEOUT_MS,
        deadlineMs: SYNTHESIS_DEADLINE_MS,
        options: inferenceOptions,
        routeType: resolvedRoute,
        trafficType: fallbackFromGemini ? "synthesis_fallback" : "synthesis",
        allowBackup,
    });

    const ollamaLatencyMs = Date.now() - ollamaStart;
    const ollamaRuntime = getOllamaRuntimeStatus();
    const ollamaGenerationMeta = getLastGenerationMetadata(ollamaRequestId);

    logInfo("ollama_response_received", {
        route: resolvedRoute,
        requestId,
        ollama_request_id: ollamaRequestId,
        ollama_latency_ms: ollamaLatencyMs,
        raw_response_chars: rawAnswer.length,
        model_used: ollamaGenerationMeta?.model || ollamaRuntime.active_model,
        breaker_state: ollamaRuntime.breaker_state,
        failover_active: ollamaRuntime.failover_active,
        prompt_tokens: ollamaGenerationMeta?.promptTokens || promptTokenEst,
        output_tokens: ollamaGenerationMeta?.outputTokens || estimateTokens(rawAnswer),
        fallback_from_gemini: fallbackFromGemini,
    });

    return {
        rawAnswer,
        synthesisProvider: fallbackFromGemini ? "gemma_after_gemini" : "gemma_primary",
        synthesisLatencyMs: ollamaLatencyMs,
        ollamaLatencyMs,
        ollamaRuntime,
        ollamaGenerationMeta,
        geminiResult: null,
        geminiFallbackReason: null,
    };
}

async function runGeminiProvider({
    prompt,
    resolvedRoute,
    inferenceOptions,
    requestId,
    promptTokenEst,
    role = "backup",
    gemmaPrimaryFailureReason = null,
}) {
    const primary = role === "primary";
    const label = primary ? "PRIMARY" : "BACKUP";
    const geminiRequestId = `gemini_${role}_${Date.now()}`;

    console.log(`[GEMINI_${label}_ACTIVE][${requestId}] route=${resolvedRoute}`);
    const geminiResult = await generateGeminiSynthesis({
        prompt,
        requestId: geminiRequestId,
        timeoutMs: GEMINI_SYNTHESIS_TIMEOUT_MS,
        options: {
            ...inferenceOptions,
            disableThinking: true,
        },
    });

    console.log(
        `[GEMINI_${label}_SUCCESS][${requestId}] route=${resolvedRoute} latency_ms=${geminiResult.latencyMs}`
    );
    incrementMetric(primary ? "gemini_primary_total" : "gemini_fallback_total");
    logInfo("gemini_response_received", {
        route: resolvedRoute,
        requestId,
        gemini_request_id: geminiRequestId,
        provider_role: role,
        gemini_latency_ms: geminiResult.latencyMs,
        model_used: geminiResult.model,
        raw_response_chars: geminiResult.text.length,
        prompt_tokens: geminiResult.promptTokens || promptTokenEst,
        output_tokens: geminiResult.outputTokens || estimateTokens(geminiResult.text),
        finish_reason: geminiResult.finishReason,
    });

    return {
        rawAnswer: geminiResult.text,
        synthesisProvider: primary ? "gemini_primary" : "gemini_backup",
        synthesisLatencyMs: geminiResult.latencyMs,
        ollamaLatencyMs: null,
        ollamaRuntime: getOllamaRuntimeStatus(),
        ollamaGenerationMeta: null,
        geminiResult,
        geminiFallbackReason: null,
        gemmaPrimaryFailureReason,
        deterministicFallbackUsed: false,
    };
}

async function runFinalSynthesis({
    prompt,
    resolvedRoute,
    inferenceOptions,
    requestId,
    promptTokenEst,
    deterministicFallbackAnswer = "",
}) {
    if (runtimeMode.primaryLlmProvider === "gemini") {
        let geminiPrimaryFailureReason = null;

        try {
            return await runGeminiProvider({
                prompt,
                resolvedRoute,
                inferenceOptions,
                requestId,
                promptTokenEst,
                role: "primary",
            });
        } catch (geminiError) {
            const timeout = isGeminiTimeoutError(geminiError);
            const reason = geminiError?.code || geminiError?.message || "GEMINI_ERROR";
            geminiPrimaryFailureReason = {
                reason,
                status: geminiError?.status,
                timeout,
            };

            console.warn(`[GEMINI_PRIMARY_FAILED][${requestId}] route=${resolvedRoute} reason=${reason}`);
            logWarn("gemini_primary_failed", {
                route: resolvedRoute,
                requestId,
                reason,
                status: geminiError?.status,
                timeout,
            });
        }

        try {
            console.log(`[GEMMA_FALLBACK_ACTIVE][${requestId}] route=${resolvedRoute}`);
            const gemmaFallback = await runOllamaSynthesis({
                prompt,
                resolvedRoute,
                inferenceOptions,
                requestId,
                promptTokenEst,
                fallbackFromGemini: true,
                allowBackup: false,
            });

            return {
                ...gemmaFallback,
                geminiPrimaryFailureReason,
                deterministicFallbackUsed: false,
            };
        } catch (gemmaError) {
            const gemmaReason = gemmaError?.code || gemmaError?.message || "GEMMA_ERROR";
            const gemmaPrimaryFailureReason = {
                reason: gemmaReason,
                status: gemmaError?.status,
            };

            console.warn(`[GEMMA_FALLBACK_FAILED][${requestId}] route=${resolvedRoute} reason=${gemmaReason}`);
            logWarn("gemma_fallback_failed", {
                route: resolvedRoute,
                requestId,
                reason: gemmaReason,
                status: gemmaError?.status,
            });

            if (deterministicFallbackAnswer) {
                incrementMetric("deterministic_fallback_total");
                return {
                    rawAnswer: deterministicFallbackAnswer,
                    synthesisProvider: "deterministic_context_fallback",
                    synthesisLatencyMs: 0,
                    ollamaLatencyMs: null,
                    ollamaRuntime: getOllamaRuntimeStatus(),
                    ollamaGenerationMeta: null,
                    geminiResult: null,
                    geminiFallbackReason: null,
                    geminiPrimaryFailureReason,
                    gemmaPrimaryFailureReason,
                    deterministicFallbackUsed: true,
                };
            }

            throw gemmaError;
        }
    }

    let gemmaPrimaryFailureReason = null;

    try {
        console.log(`[GEMMA_SYNTHESIS_ACTIVE][${requestId}] route=${resolvedRoute}`);
        const gemmaResult = await runOllamaSynthesis({
            prompt,
            resolvedRoute,
            inferenceOptions,
            requestId,
            promptTokenEst,
            allowBackup: false,
        });

        return {
            ...gemmaResult,
            geminiFallbackReason: null,
            deterministicFallbackUsed: false,
        };
    } catch (gemmaError) {
        const gemmaReason = gemmaError?.code || gemmaError?.message || "GEMMA_ERROR";
        gemmaPrimaryFailureReason = {
            reason: gemmaReason,
            status: gemmaError?.status,
        };
        console.warn(`[GEMMA_PRIMARY_FAILED][${requestId}] route=${resolvedRoute} reason=${gemmaReason}`);
        logWarn("gemma_primary_failed", {
            route: resolvedRoute,
            requestId,
            reason: gemmaReason,
            status: gemmaError?.status,
        });
    }

    if (runtimeMode.geminiBackupEnabled === false) {
        if (deterministicFallbackAnswer) {
            incrementMetric("deterministic_fallback_total");
            return {
                rawAnswer: deterministicFallbackAnswer,
                synthesisProvider: "deterministic_context_fallback",
                synthesisLatencyMs: 0,
                ollamaLatencyMs: null,
                ollamaRuntime: getOllamaRuntimeStatus(),
                ollamaGenerationMeta: null,
                geminiResult: null,
                geminiFallbackReason: {
                    reason: "GEMINI_BACKUP_DISABLED",
                    timeout: false,
                },
                gemmaPrimaryFailureReason,
                deterministicFallbackUsed: true,
            };
        }

        throw new Error("Gemma primary failed and Gemini backup is disabled.");
    }

    try {
        return await runGeminiProvider({
            prompt,
            requestId,
            resolvedRoute,
            inferenceOptions,
            promptTokenEst,
            role: "backup",
            gemmaPrimaryFailureReason,
        });
    } catch (geminiError) {
        const geminiRequestId = `gemini_backup_failed_${Date.now()}`;
        const timeout = isGeminiTimeoutError(geminiError);
        const reason = geminiError?.code || geminiError?.message || "GEMINI_ERROR";

        if (timeout) {
            console.warn(`[GEMINI_TIMEOUT][${requestId}] route=${resolvedRoute}`);
        }

        console.warn(`[GEMINI_BACKUP_FAILED][${requestId}] route=${resolvedRoute} reason=${reason}`);
        logWarn("gemini_backup_failed", {
            route: resolvedRoute,
            requestId,
            gemini_request_id: geminiRequestId,
            reason,
            status: geminiError?.status,
            timeout,
        });

        if (deterministicFallbackAnswer) {
            incrementMetric("deterministic_fallback_total");
            logWarn("gemini_backup_to_deterministic_context", {
                route: resolvedRoute,
                requestId,
                gemini_request_id: geminiRequestId,
                reason,
            });

            return {
                rawAnswer: deterministicFallbackAnswer,
                synthesisProvider: "deterministic_context_fallback",
                synthesisLatencyMs: 0,
                ollamaLatencyMs: null,
                ollamaRuntime: getOllamaRuntimeStatus(),
                ollamaGenerationMeta: null,
                geminiResult: null,
                geminiFallbackReason: {
                    reason,
                    status: geminiError?.status,
                    timeout,
                },
                gemmaPrimaryFailureReason,
                deterministicFallbackUsed: true,
            };
        }

        throw geminiError;
    }
}

function cleanGraphNodeLabel(value) {
    let text = String(value || "").trim();
    if (!text) return "";

    const quoted = text.match(/"([^"]+)"/) || text.match(/'([^']+)'/);
    if (quoted) return quoted[1].trim();

    const propertyName = text.match(/\b(?:name|title|code|id)\s*:\s*["']?([^"',}]+)["']?/i);
    if (propertyName) return propertyName[1].trim();

    if (text.includes(":")) {
        const parts = text.split(":");
        text = parts[parts.length - 1].trim();
    }

    return text
        .replace(/[{}]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function cleanGraphRelationLabel(value) {
    let text = String(value || "").trim();
    if (!text) return "";
    if (text.includes(":")) text = text.split(":").pop();
    return text
        .replace(/[`"']/g, "")
        .replace(/\s+/g, "_")
        .toUpperCase();
}

function relationToSentence(source, relation, target) {
    if (!source || !relation || !target) return null;

    const relationText = relation.toLowerCase().replace(/_/g, " ");

    switch (relation) {
        case "TEACHES":
            return `${source} teaches ${target}.`;
        case "HAS_PREREQUISITE":
        case "REQUIRES":
            return `${source} requires ${target}.`;
        case "PREREQUISITE_FOR":
            return `${source} is a prerequisite for ${target}.`;
        case "HAS_COURSE":
            return `${source} includes ${target}.`;
        case "HEAD_OF":
        case "HEAD_OF_UNIT":
            return `${source} is head of ${target}.`;
        case "DEAN_OF":
            return `${source} is dean of ${target}.`;
        case "HAS_ROLE":
        case "ACTS_AS":
            return `${source} serves as ${target}.`;
        case "WORKS_IN":
            return `${source} works in ${target}.`;
        case "MEMBER_OF":
            return `${source} is a member of ${target}.`;
        case "BELONGS_TO":
            return `${source} belongs to ${target}.`;
        case "ADMINISTERS":
        case "CHAIRS":
        case "DIRECTS":
        case "MANAGES":
            return `${source} ${relationText} ${target}.`;
        default:
            return `${source} has ${relationText} relationship with ${target}.`;
    }
}

function graphTripleToSentence(sourceRaw, relationRaw, targetRaw) {
    const source = cleanGraphNodeLabel(sourceRaw);
    const relation = cleanGraphRelationLabel(relationRaw);
    const target = cleanGraphNodeLabel(targetRaw);
    return relationToSentence(source, relation, target);
}

function normalizeGraphEvidence(text) {
    let normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return "";

    const graphTriplePattern =
        /\(([^()]+)\)\s*-+\s*\[\s*:?\s*([A-Za-z0-9_]+(?::[A-Za-z0-9_]+)?)\s*\]\s*-+>\s*\(([^()]+)\)/g;

    normalized = normalized.replace(graphTriplePattern, (match, source, relation, target) =>
        graphTripleToSentence(source, relation, target) || match
    );

    const propertyPattern = /^\(([^:()]+):\s*["']?([^"')]+)["']?\)\s+([A-Za-z0-9_ ]+):\s*(.+)$/;
    const propertyMatch = normalized.match(propertyPattern);
    if (propertyMatch) {
        const entityName = propertyMatch[2].trim();
        const propertyName = propertyMatch[3].trim().toLowerCase().replace(/_/g, " ");
        const propertyValue = propertyMatch[4].trim();
        return `${entityName} ${propertyName}: ${propertyValue}`;
    }

    return normalized;
}

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
            const rawEvidence = normalizeGraphEvidence(item.evidence ?? item.text ?? item.content ?? "");
            const evidence = rawEvidence.length > 520
                ? `${rawEvidence.slice(0, 520).trimEnd()}\u2026[truncated]`
                : rawEvidence;
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

    const capped = passages.slice(0, limit).map((passage) =>
        passage.length > 600
            ? `${passage.slice(0, 600).trimEnd()}\u2026[truncated]`
            : passage
    );

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
    const normalizedDecisionContext =
        Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;

    if (
        !normalizedDecisionContext ||
        typeof normalizedDecisionContext !== "object" ||
        Array.isArray(normalizedDecisionContext) ||
        Object.keys(normalizedDecisionContext).length === 0
    ) {
        return { block: "", count: 0, used: false };
    }

    let summary;
    try {
        const safe = depthLimitedSerialize(normalizedDecisionContext);

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

    return { block, count: Object.keys(normalizedDecisionContext).length, used: true };
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
        // Drop low-priority context first while preserving KG and decision facts.
        config.includeRag = false;
        config.kgFacts = Math.max(1, MAX_KG_FACTS);
        config.includeKg = true;
        config.includeDecision = true;
    } else if (currentTokens >= PROMPT_TOKEN_WARN_THRESHOLD) {
        logWarn("context_trimming_warning", { tokens: currentTokens });
        config.kgFacts = MAX_KG_FACTS;
        config.ragPassages = Math.max(1, Math.floor(MAX_RAG_PASSAGES / 2));
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

    // Priority order: FAQ direct answer, then KG facts > Decision > RAG.
    const orderedBlocks = [
        faqResult.block,
        kgResult.block,
        decisionResult.block,
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
 * PHASE 8.5 — DETERMINISTIC HYBRID FUSION SYNTHESIS
 * Merges top KG facts and top RAG passages into a coherent advisory response
 * without LLM inference. Ensures recruiter-grade coverage of both domains.
 *
 * @param {Array} neo4jContext
 * @param {Array} ragContext
 * @returns {string} Fused hybrid answer
 */
function buildDeterministicHybridAnswer(neo4jContext, ragContext) {
    const kgFacts = extractKgFacts(neo4jContext, 2);
    const ragFacts = extractRagFacts(ragContext, 2);

    if (kgFacts.length === 0 && ragFacts.length === 0) return "";

    const parts = [];

    if (kgFacts.length > 0) {
        parts.push(kgFacts.join(" "));
    }

    if (ragFacts.length > 0) {
        const ragIntro = "AAST academic regulations: ";
        parts.push(ragIntro + ragFacts.join(" "));
    }

    return parts.join("\n\n").trim();
}

/**
 * DETERMINISTIC FALLBACK BUILDER (Phase 3 Stabilization)
 * ──────────────────────────────────────────────────
 * Synthesizes a verified answer from structured context without LLM inference.
 * Used as a primary safety net for LLM failures or timeouts.
 */
function buildDeterministicFallbackAnswer({ faqContext, decisionContext, neo4jContext, ragContext }) {
    const normalizedDecisionContext =
        Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;

    // 1. FAQ answer (Highest precision)
    if (faqContext?.answer) {
        return `According to verified university policy: ${faqContext.answer}`;
    }

    // 2. Decision summary
    if (normalizedDecisionContext) {
        const outcome =
            normalizedDecisionContext.outcome ||
            normalizedDecisionContext.verdict ||
            normalizedDecisionContext.recommendation ||
            normalizedDecisionContext.career_path;
        if (outcome) {
            return `Based on verified academic evaluation: The advisory system has determined the outcome is: ${outcome}. Please contact your advisor for full details.`;
        }
    }

    // 3. KG top fact
    if (Array.isArray(neo4jContext) && neo4jContext.length > 0) {
        const sorted = [...neo4jContext].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
        const topFact = sorted[0];
        const evidence = normalizeGraphEvidence(topFact?.evidence || topFact?.text || topFact?.content);
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
- If the user starts conversationally, respond briefly and professionally before answering.
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
    const normalizedRoute = String(routeType || "").trim().toUpperCase();

    if (normalizedRoute && Object.values(ROUTE_TYPES).includes(normalizedRoute)) {
        return normalizedRoute;
    }

    if (normalizedRoute === "HYBRID_KG_RAG") return ROUTE_TYPES.HYBRID;
    if (["DECISION_ENGINE", "DECISION", "RECOMMEND", "RECOMMENDATION", "COMPARISON"].includes(normalizedRoute)) {
        return ROUTE_TYPES.DECISION;
    }
    if (["CAREER_ENGINE", "CAREER", "CAREER_PATH_DETAIL"].includes(normalizedRoute)) {
        return ROUTE_TYPES.CAREER;
    }
    if (normalizedRoute === "GENERAL") return ROUTE_TYPES.GENERAL;
    if (normalizedRoute === "KG") return ROUTE_TYPES.KG_ONLY;
    if (normalizedRoute === "RAG") return ROUTE_TYPES.RAG_ONLY;
    if (normalizedRoute === "FAQ") return ROUTE_TYPES.FAQ_ONLY;

    return ROUTE_TYPES.LLM_FALLBACK;
}

function normalizeExplainabilityRoute(routeType, query = "", decisionContext = null) {
    const normalizedRoute = String(routeType || "").trim().toUpperCase();
    const normalizedQuery = String(query || "").toLowerCase();
    const normalizedDecisionContext =
        Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;
    const recommendationText = String(
        normalizedDecisionContext?.recommendation ||
        normalizedDecisionContext?.career_path ||
        normalizedDecisionContext?.outcome ||
        ""
    ).toLowerCase();

    if (normalizedRoute === "HYBRID_KG_RAG" || normalizedRoute === "HYBRID") return "HYBRID_KG_RAG";
    if (["CAREER_ENGINE", "CAREER", "CAREER_PATH_DETAIL"].includes(normalizedRoute)) return "CAREER";
    if (normalizedRoute === "LLM_FALLBACK") return "LLM_FALLBACK";
    if (normalizedRoute === "GENERAL") return "GENERAL";
    if (normalizedRoute === "FAQ_ONLY") return "GENERAL";
    if (normalizedRoute === "KG_ONLY") return "GENERAL";
    if (normalizedRoute === "RAG_ONLY") return "GENERAL";

    if (
        normalizedRoute === "COMPARISON" ||
        recommendationText.startsWith("comparison:") ||
        /\b(compare|comparison|versus|vs)\b/.test(normalizedQuery)
    ) {
        return "COMPARISON";
    }

    if (
        normalizedRoute === "RECOMMEND" ||
        normalizedRoute === "RECOMMENDATION" ||
        /\b(best major|recommend|recommended major|which major)\b/.test(normalizedQuery)
    ) {
        return "RECOMMENDATION";
    }

    if (normalizedRoute === "DECISION_ENGINE" || normalizedRoute === "DECISION") {
        return "DECISION";
    }

    return "LLM_FALLBACK";
}

function normalizeHistoryContent(content) {
    const text = String(content || "")
        .replace(/\s+/g, " ")
        .trim();

    if (!text) return "";

    return text.length > MAX_HISTORY_MESSAGE_CHARS
        ? `${text.slice(0, MAX_HISTORY_MESSAGE_CHARS).trim()}...`
        : text;
}

function buildConversationHistoryBlock(history = [], currentQuery = "") {
    if (!Array.isArray(history) || history.length === 0) return "";

    const currentQueryKey = normalizeHistoryContent(currentQuery).toLowerCase();
    const messages = history
        .filter(message => message && typeof message === "object")
        .filter(message => String(message.role || "").toLowerCase() !== "system")
        .map(message => ({
            role: String(message.role || "").toLowerCase(),
            content: normalizeHistoryContent(message.content),
        }))
        .filter(message => ["user", "assistant"].includes(message.role) && message.content)
        .slice(-MAX_HISTORY_MESSAGES);

    if (
        messages.length > 0 &&
        messages[messages.length - 1].role === "user" &&
        messages[messages.length - 1].content.toLowerCase() === currentQueryKey
    ) {
        messages.pop();
    }

    if (messages.length === 0) return "";

    let totalChars = 0;
    const lines = [];

    for (const message of messages) {
        const line = `${message.role.toUpperCase()}: ${message.content}`;
        if (totalChars + line.length > MAX_HISTORY_TOTAL_CHARS) break;
        lines.push(line);
        totalChars += line.length;
    }

    if (lines.length === 0) return "";

    return [
        "RECENT CONVERSATION HISTORY:",
        "Use this only for continuity, pronoun resolution, and conversational flow. Do not treat it as verified academic evidence.",
        ...lines,
    ].join("\n");
}

function normalizeMemoryValue(value, limit = 140) {
    if (typeof value !== "string") return "";
    return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function formatMemoryEntity(entity) {
    if (!entity) return "";

    if (typeof entity === "string") {
        return normalizeMemoryValue(entity);
    }

    if (typeof entity !== "object") return "";

    const value = normalizeMemoryValue(entity.value || entity.name || entity.label);
    const type = normalizeMemoryValue(entity.type || "entity", 40);
    return value ? `${type}: ${value}` : "";
}

function buildConversationMemoryBlock(conversationMemory = null) {
    if (!conversationMemory || typeof conversationMemory !== "object") return "";

    const lines = [];
    const topic = normalizeMemoryValue(conversationMemory.lastTopic, 80);
    const entity = formatMemoryEntity(conversationMemory.lastEntity);
    const intent = normalizeMemoryValue(conversationMemory.lastIntent, 80);
    const recentSubjects = Array.isArray(conversationMemory.recentSubjects)
        ? conversationMemory.recentSubjects.map(subject => normalizeMemoryValue(subject, 80)).filter(Boolean).slice(0, 3)
        : [];
    const summary = normalizeMemoryValue(conversationMemory.lastAssistantSummary, 180);

    if (topic) lines.push(`- Current topic: ${topic}`);
    if (entity) lines.push(`- Last discussed entity: ${entity}`);
    if (recentSubjects.length > 0) lines.push(`- Recent subject: ${recentSubjects.join("; ")}`);
    if (intent) lines.push(`- Recent intent: ${intent}`);
    if (summary) lines.push(`- Last assistant answer summary: ${summary}`);

    if (lines.length === 0) return "";

    const block = [
        "CONVERSATION MEMORY:",
        "Use only for continuity and pronoun resolution. It is not verified evidence; verified context always wins.",
        ...lines
    ].join("\n");

    return block.length > MAX_MEMORY_BLOCK_CHARS
        ? `${block.slice(0, MAX_MEMORY_BLOCK_CHARS).trimEnd()}...`
        : block;
}

/**
 * Assembles the full inference prompt from base system prompt,
 * route-specific behavioral instructions, context payload, and query.
 *
 * @param {string} query
 * @param {string} contextPayload
 * @param {string} routeType
 * @param {Array} [history=[]]
 * @param {object|null} [conversationMemory=null]
 * @returns {string}
 */
function buildPrompt(query, contextPayload, routeType, history = [], conversationMemory = null) {
    const routeInstruction =
        ROUTE_INSTRUCTIONS[routeType] ??
        ROUTE_INSTRUCTIONS[ROUTE_TYPES.LLM_FALLBACK];

    const divider = "─".repeat(60);

    const contextSection = contextPayload
        ? `VERIFIED CONTEXT:\n${divider}\n${contextPayload}\n${divider}`
        : `VERIFIED CONTEXT:\n${divider}\n[No structured context was retrieved for this query.]\n${divider}`;
    const historySection = buildConversationHistoryBlock(history, query);
    const memorySection = buildConversationMemoryBlock(conversationMemory);

    return (
        `${BASE_SYSTEM_PROMPT}\n\n` +
        `${routeInstruction}\n\n` +
        `${memorySection ? `${memorySection}\n\n` : ""}` +
        `${historySection ? `${historySection}\n\n` : ""}` +
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
    /^(great question!?)[,\s]/i,
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

function buildScholarshipApplicationPartialAnswer(query, ragContext) {
    const scholarshipApplicationQuery =
        /\b(apply|application|submit)\b.*\b(scholarship|financial aid|tuition exemption)\b/i.test(query) ||
        /\b(scholarship|financial aid|tuition exemption)\b.*\b(apply|application|submit)\b/i.test(query);

    if (!scholarshipApplicationQuery || !Array.isArray(ragContext)) {
        return null;
    }

    const evidence = ragContext
        .map(item => String(item?.content ?? item?.text ?? item?.evidence ?? "").trim())
        .filter(Boolean)
        .join(" ");

    if (!/\b(scholarship|tuition fee exemption)\b/i.test(evidence)) {
        return null;
    }

    const criteria = [];
    const semesterMatch = evidence.match(/at least\s+([a-z0-9.]+)\s+full semesters?/i);
    const gpaMatch = evidence.match(/GPA of at least\s+([0-9.]+)/i);
    const majorSizeMatch = evidence.match(/major with at least\s+([0-9]+)\s+students?/i);

    if (semesterMatch && /\bsame major\b/i.test(evidence)) {
        criteria.push(`complete at least ${semesterMatch[1]} full semesters within the same major at CAI`);
    }
    if (gpaMatch) {
        criteria.push(`maintain a GPA of at least ${gpaMatch[1]}`);
    }
    if (/completed all previous study hours without interruption/i.test(evidence)) {
        criteria.push("complete all previous study hours without interruption");
    }
    if (majorSizeMatch) {
        criteria.push(`belong to a major with at least ${majorSizeMatch[1]} students`);
    }

    if (criteria.length === 0) {
        return null;
    }

    return (
        `The verified records confirm these scholarship eligibility criteria: ${criteria.join("; ")}. ` +
        "They do not specify the application submission steps; please confirm those steps through " +
        "the official university portal or your academic advisor."
    );
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
function normalizeProbability(value, fallback = 0) {
    const n = Number.parseFloat(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
}

function unwrapDecisionContext(decisionContext) {
    return Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;
}

function dedupeTextList(values) {
    const seen = new Set();
    const deduped = [];

    for (const value of values) {
        const text = String(value || "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(text);
    }

    return deduped;
}

function truncateEvidence(text, maxChars = 320) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    return normalized.length > maxChars ? `${normalized.slice(0, maxChars).trim()}...` : normalized;
}

function extractKgFacts(neo4jContext, limit = MAX_KG_FACTS) {
    if (!Array.isArray(neo4jContext) || neo4jContext.length === 0) return [];

    return dedupeTextList(
        neo4jContext
            .slice()
            .sort((a, b) => (b?.confidence ?? 0) - (a?.confidence ?? 0))
            .map(item => item?.evidence ?? item?.text ?? item?.content ?? "")
            .map(text => normalizeGraphEvidence(text))
            .map(text => truncateEvidence(text, 260))
    ).slice(0, limit);
}

function extractRagFacts(ragContext, limit = MAX_RAG_PASSAGES) {
    if (!ragContext) return [];

    const normalizedContext =
        typeof ragContext === "object" &&
        !Array.isArray(ragContext) &&
        Array.isArray(ragContext.results)
            ? ragContext.results
            : ragContext;

    if (typeof normalizedContext === "string") {
        return dedupeTextList(
            normalizedContext
                .split(/\n{2,}/)
                .map(text => truncateEvidence(text, 320))
        ).slice(0, limit);
    }

    if (!Array.isArray(normalizedContext)) return [];

    return dedupeTextList(
        normalizedContext.map(item => {
            if (typeof item === "string") return truncateEvidence(item, 320);
            return truncateEvidence(
                item?.excerpt ??
                item?.text ??
                item?.content ??
                item?.pageContent ??
                item?.page_content ??
                item?.summary ??
                item?.answer ??
                item?.metadata?.text ??
                item?.metadata?.content ??
                "",
                320
            );
        })
    ).slice(0, limit);
}

function extractFaqFacts(faqContext) {
    if (!faqContext || typeof faqContext !== "object") return [];
    return dedupeTextList([truncateEvidence(faqContext.answer, 260)]);
}

function extractDecisionFacts(decisionContext, limit = 4) {
    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
    if (!normalizedDecisionContext || typeof normalizedDecisionContext !== "object") return [];

    const factors = normalizedDecisionContext.factors || normalizedDecisionContext.market_data || normalizedDecisionContext;
    const evidence = [
        normalizedDecisionContext.recommendation,
        normalizedDecisionContext.career_path,
        normalizedDecisionContext.outcome,
        normalizedDecisionContext.verdict,
        normalizedDecisionContext.reason,
        factors?.reason,
        factors?.recommended_major ? `Recommended major: ${factors.recommended_major}` : "",
        Array.isArray(factors?.top_skills) && factors.top_skills.length > 0
            ? `Top skills: ${factors.top_skills.join(", ")}`
            : "",
        Array.isArray(factors?.career_roadmap?.target_roles) && factors.career_roadmap.target_roles.length > 0
            ? `Target roles: ${factors.career_roadmap.target_roles.join(", ")}`
            : "",
        Array.isArray(factors?.career_roadmap?.top_skills) && factors.career_roadmap.top_skills.length > 0
            ? `Career roadmap skills: ${factors.career_roadmap.top_skills.join(", ")}`
            : "",
        factors?.career_roadmap?.industry_demand ? `Industry demand: ${factors.career_roadmap.industry_demand}` : "",
        Array.isArray(factors?.next_steps) && factors.next_steps.length > 0
            ? `Next steps: ${factors.next_steps.join(", ")}`
            : "",
        factors?.salary_outlook ? `Salary outlook: ${factors.salary_outlook}` : "",
        factors?.skills_overlap ? `Skills overlap: ${factors.skills_overlap}` : "",
    ];

    return dedupeTextList(evidence.map(text => truncateEvidence(text, 320))).slice(0, limit);
}

function buildExplainabilityGraph(neo4jContext) {
    if (!Array.isArray(neo4jContext) || neo4jContext.length === 0) {
        return { nodes: [], links: [] };
    }

    try {
        const graph = convertToGraphData(neo4jContext);
        return {
            nodes: Array.isArray(graph?.nodes) ? graph.nodes : [],
            links: Array.isArray(graph?.links) ? graph.links : []
        };
    } catch {
        return { nodes: [], links: [] };
    }
}

function normalizeContractConfidence(confidence, responseRoute, { failure = false, weak = false } = {}) {
    const numericConfidence = normalizeProbability(confidence, weak ? 0.35 : 0.55);

    if (failure) return 0.2;
    if (responseRoute === "HYBRID_KG_RAG") return parseFloat(Math.max(0.70, Math.min(0.89, numericConfidence)).toFixed(3));
    if (["DECISION", "RECOMMENDATION", "CAREER", "COMPARISON"].includes(responseRoute)) {
        return parseFloat(Math.max(0.70, Math.min(0.89, numericConfidence)).toFixed(3));
    }
    if (responseRoute === "GENERAL" || responseRoute === "LLM_FALLBACK") {
        if (numericConfidence < 0.50) {
            return parseFloat(Math.max(0.20, Math.min(0.49, numericConfidence)).toFixed(3));
        }
        return parseFloat(Math.max(0.50, Math.min(0.69, numericConfidence)).toFixed(3));
    }

    return parseFloat(Math.max(0.50, Math.min(0.69, numericConfidence)).toFixed(3));
}

function buildExplainabilitySources(responseRoute, sources_used, { faqContext, decisionContext } = {}) {
    const sources = [];
    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);

    if (responseRoute === "HYBRID_KG_RAG") {
        if (sources_used?.kg) sources.push("KG_DIRECT");
        if (sources_used?.rag) sources.push("RAG_DIRECT");
        if (normalizedDecisionContext) sources.push("DECISION");
    }

    if (["GENERAL", "LLM_FALLBACK"].includes(responseRoute)) {
        if (sources_used?.kg) sources.push("KG_DIRECT");
        if (sources_used?.rag) sources.push("RAG_DIRECT");
    }

    if (["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)) {
        if (normalizedDecisionContext) sources.push("DECISION");
    }

    if (responseRoute === "CAREER") {
        if (normalizedDecisionContext) sources.push("CAREER");
    }

    if (faqContext?.answer || sources_used?.faq) {
        sources.push("FAQ");
    }

    if (["DECISION", "RECOMMENDATION", "COMPARISON", "CAREER", "HYBRID_KG_RAG"].includes(responseRoute)) {
        if (sources_used?.kg) sources.push("KG_DIRECT");
        if (sources_used?.rag) sources.push("RAG_DIRECT");
    }

    return [...new Set(sources)];
}

function buildMissingInformation({
    responseRoute,
    normalizedConfidence,
    usedFacts,
    sources_used,
    decisionContext,
    failure = false,
    limitedEvidenceMessage = "Response generated with limited institutional evidence."
}) {
    if (failure) return ["Insufficient evidence available."];

    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
    const factors = normalizedDecisionContext?.factors || normalizedDecisionContext?.market_data || normalizedDecisionContext || {};
    const missing = [];

    if (responseRoute === "HYBRID_KG_RAG") {
        if (usedFacts.length === 0 || !sources_used?.kg || !sources_used?.rag) {
            missing.push("Partial institutional evidence available.");
        }
    }

    if (responseRoute === "GENERAL" || responseRoute === "LLM_FALLBACK") {
        if (normalizedConfidence < 0.7) {
            missing.push(limitedEvidenceMessage);
        }
    }

    if (["DECISION", "RECOMMENDATION", "COMPARISON", "CAREER"].includes(responseRoute)) {
        const missingFields = [
            ...(Array.isArray(normalizedDecisionContext?.missing_fields) ? normalizedDecisionContext.missing_fields : []),
            ...(Array.isArray(factors?.missing_fields) ? factors.missing_fields : [])
        ];

        missingFields.forEach(field => {
            const normalizedField = String(field).toLowerCase();
            if (normalizedField.includes("gpa") || normalizedField.includes("percentage")) {
                missing.push("Missing GPA information.");
            } else if (normalizedField.includes("goal") || normalizedField.includes("interest")) {
                missing.push("Missing goals information.");
            } else if (normalizedField.includes("special")) {
                missing.push("Missing specialization information.");
            } else {
                missing.push(`Missing ${String(field).trim()} information.`);
            }
        });

        if (responseRoute === "CAREER" && !Array.isArray(factors?.target_roles) && !Array.isArray(factors?.career_roadmap?.target_roles)) {
            missing.push("Missing specialization information.");
        }
    }

    if (usedFacts.length === 0 && missing.length === 0) {
        missing.push("Insufficient evidence available.");
    }

    return dedupeTextList(missing);
}

function buildReasoning({
    responseRoute,
    sources_used,
    normalizedConfidence,
    missingInformation,
    failure = false
}) {
    if (failure) {
        return "System fallback triggered due to insufficient evidence.";
    }

    if (responseRoute === "HYBRID_KG_RAG") {
        return `Deterministic hybrid fusion combined ${sources_used?.kg ? "knowledge graph facts" : "available structured records"} with ${sources_used?.rag ? "retrieved policy passages" : "available document evidence"} to produce a grounded academic answer${missingInformation.length > 0 ? " with partial coverage safeguards." : "."}`;
    }

    if (["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)) {
        return "Recommendation logic was derived from verified decision-engine factors and any available supporting academic evidence.";
    }

    if (responseRoute === "CAREER") {
        return "Career guidance was synthesized from the verified roadmap output and any available institutional support evidence.";
    }

    if (responseRoute === "GENERAL") {
        return `General advisory synthesis used the best available verified context${normalizedConfidence < 0.7 ? " with explicit evidence limitations." : "."}`;
    }

    return `Fallback path used limited verified institutional context${normalizedConfidence < 0.5 ? " with weak evidence safeguards." : "."}`;
}

function buildExplainabilityMetadata({
    requestedRoute,
    resolvedRoute,
    responseRoute,
    normalizedConfidence,
    sources_used,
    latency_ms,
    sanitized,
    truncated,
    contextMetrics,
    providedMetadata,
    graph,
    usedFacts,
    failure = false,
    decisionContext
}) {
    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
    const factors = normalizedDecisionContext?.factors || normalizedDecisionContext?.market_data || normalizedDecisionContext || {};
    const decisionConfidence = normalizeProbability(
        normalizedDecisionContext?.confidence ??
        factors?.confidence ??
        factors?.confidence_breakdown?.overall,
        normalizedConfidence
    );

    const baseMetadata = {
        route_requested: requestedRoute,
        inference_route: resolvedRoute,
        route_safety: failure ? "SAFE_FAILURE" : normalizedConfidence >= 0.7 ? "SAFE_VERIFIED" : "SAFE_LIMITED",
        latency_ms,
        sanitized,
        truncated,
        source_count: Array.isArray(usedFacts) ? usedFacts.length : 0,
        graph_node_count: Array.isArray(graph?.nodes) ? graph.nodes.length : 0,
        graph_link_count: Array.isArray(graph?.links) ? graph.links.length : 0,
        evidence_coverage: {
            faq: !!sources_used?.faq,
            kg: !!sources_used?.kg,
            rag: !!sources_used?.rag,
            decision: !!sources_used?.decision
        },
        ...(contextMetrics || {})
    };

    if (responseRoute === "HYBRID_KG_RAG") {
        baseMetadata.fusion_strategy = "KG_RAG_EVIDENCE_BLEND";
        baseMetadata.confidence_blend = parseFloat(((normalizedConfidence + normalizeProbability(decisionConfidence, normalizedConfidence)) / 2).toFixed(3));
        baseMetadata.coverage_quality = usedFacts.length >= 4 ? "HIGH" : usedFacts.length >= 2 ? "MEDIUM" : "LOW";
    }

    if (["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)) {
        baseMetadata.decision_factors = Object.keys(factors || {});
        baseMetadata.decision_confidence = decisionConfidence;
    }

    if (responseRoute === "CAREER") {
        baseMetadata.career_confidence = decisionConfidence;
        baseMetadata.roadmap_confidence = normalizeProbability(
            factors?.career_roadmap?.confidence ??
            factors?.confidence_breakdown?.overall ??
            decisionConfidence,
            decisionConfidence
        );
    }

    if (responseRoute === "GENERAL" || responseRoute === "LLM_FALLBACK") {
        baseMetadata.fallback_path = responseRoute;
        baseMetadata.evidence_limitations = normalizedConfidence < 0.7;
    }

    return {
        ...baseMetadata,
        ...(providedMetadata || {})
    };
}

function createResult({
    answer,
    route,
    confidence,
    sources_used,
    latency_ms,
    sanitized,
    truncated = false,
    query = "",
    requestedRoute = route,
    neo4jContext = [],
    ragContext = [],
    faqContext = null,
    decisionContext = null,
    contextMetrics = {},
    metadata = {},
    reasoning = "",
    failure = false,
    missing_information = null,
    used_facts = null,
    graph = null,
    sources = null,
}) {
    const responseRoute = normalizeExplainabilityRoute(route, query, decisionContext);
    const normalizedConfidence = normalizeContractConfidence(confidence, responseRoute, {
        failure,
        weak: normalizeProbability(confidence, 0) < 0.5
    });
    const explainabilityGraph = graph || (responseRoute === "HYBRID_KG_RAG"
        ? buildExplainabilityGraph(neo4jContext)
        : { nodes: [], links: [] });
    const kgFacts = extractKgFacts(neo4jContext, responseRoute === "HYBRID_KG_RAG" ? 2 : MAX_KG_FACTS);
    const ragFacts = extractRagFacts(ragContext, responseRoute === "HYBRID_KG_RAG" ? 3 : MAX_RAG_PASSAGES);
    const faqFacts = extractFaqFacts(faqContext);
    const decisionFacts = extractDecisionFacts(decisionContext, 4);
    const compiledFacts = used_facts || (
        responseRoute === "HYBRID_KG_RAG"
            ? [...kgFacts.slice(0, 2), ...ragFacts.slice(0, 3), ...decisionFacts.slice(0, 2)]
            : ["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)
                ? [...decisionFacts, ...ragFacts.slice(0, 2), ...kgFacts.slice(0, 1)]
                : responseRoute === "CAREER"
                    ? [...decisionFacts, ...ragFacts.slice(0, 2)]
                    : responseRoute === "GENERAL"
                        ? [...kgFacts.slice(0, 2), ...ragFacts.slice(0, 2), ...faqFacts.slice(0, 1)]
                        : [...faqFacts.slice(0, 1), ...kgFacts.slice(0, 1), ...ragFacts.slice(0, 1)]
    );
    const finalUsedFacts = dedupeTextList(compiledFacts).slice(0, 6);
    const finalMissingInformation = Array.isArray(missing_information)
        ? missing_information
        : buildMissingInformation({
            responseRoute,
            normalizedConfidence,
            usedFacts: finalUsedFacts,
            sources_used,
            decisionContext,
            failure,
            limitedEvidenceMessage: "Response generated with limited institutional evidence."
        });
    const finalSources = Array.isArray(sources)
        ? [...new Set(sources)]
        : buildExplainabilitySources(responseRoute, sources_used, { faqContext, decisionContext });
    const finalReasoning = reasoning || buildReasoning({
        responseRoute,
        sources_used,
        normalizedConfidence,
        missingInformation: finalMissingInformation,
        failure
    });
    const finalMetadata = buildExplainabilityMetadata({
        requestedRoute,
        resolvedRoute: route,
        responseRoute,
        normalizedConfidence,
        sources_used,
        latency_ms,
        sanitized,
        truncated,
        contextMetrics,
        providedMetadata: metadata,
        graph: explainabilityGraph,
        usedFacts: finalUsedFacts,
        failure,
        decisionContext
    });
    finalMetadata.source_count = Array.isArray(finalSources) ? finalSources.length : 0;
    finalMetadata.used_fact_count = Array.isArray(finalUsedFacts) ? finalUsedFacts.length : 0;

    const result = {
        answer,
        confidence: normalizedConfidence,
        used_facts: finalUsedFacts,
        missing_information: finalMissingInformation,
        graph: explainabilityGraph || EMPTY_GRAPH,
        route: responseRoute,
        sources: finalSources,
        reasoning: finalReasoning,
        metadata: finalMetadata,
        sources_used,
        latency_ms,
        sanitized,
        truncated
    };

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
function createFallbackResult(answerText, route, confidence, latency_ms, sources_used = null, options = {}) {
    return createResult({
        answer: answerText,
        route: options.route || "LLM_FALLBACK",
        requestedRoute: route,
        confidence: options.confidence ?? confidence,
        sources_used: sources_used || { faq: false, kg: false, rag: false, decision: false },
        latency_ms,
        sanitized: false,
        truncated: false,
        query: options.query || "",
        neo4jContext: options.neo4jContext || [],
        ragContext: options.ragContext || [],
        faqContext: options.faqContext || null,
        decisionContext: options.decisionContext || null,
        contextMetrics: options.contextMetrics || {},
        metadata: options.metadata || { route_safety: "SAFE_FAILURE" },
        reasoning: options.reasoning || "System fallback triggered due to insufficient evidence.",
        missing_information: options.missing_information || ["Insufficient evidence available."],
        graph: { nodes: [], links: [] },
        sources: options.sources || [],
        failure: options.failure ?? true,
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
 * @param {Array}   [params.history=[]]
 * @param {object|null} [params.conversationMemory=null]
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
    history = [],
    conversationMemory = null,
} = {}) {
    const requestedRoute = routeType;

    // ── Guard: query is mandatory ─────────────────────────────────────
    if (!query || typeof query !== "string" || query.trim() === "") {
        logError("invalid_query", { reason: "empty_or_non_string_query" });
        return createFallbackResult(FALLBACK_ANSWER, requestedRoute, retrievalConfidence, 0, null, {
            route: "LLM_FALLBACK",
            metadata: { route_safety: "SAFE_FAILURE" },
            reasoning: "System fallback triggered due to insufficient evidence.",
            missing_information: ["Insufficient evidence available."],
            failure: true
        });
    }

    const resolvedRoute = resolveRouteType(routeType);
    const truncatedQuery = query.trim().slice(0, 120);
    const pipelineStart = Date.now();

    // PHASE 8: DETERMINISTIC EMPTY-CONTEXT GUARD
    // Pre-calculate block metadata to check for total evidence absence
    const faqMeta = buildFaqBlock(faqContext);
    const decisionMeta = buildDecisionBlock(decisionContext);
    const kgMeta = buildNeo4jBlock(neo4jContext);
    const ragMeta = buildRagBlock(ragContext);

    if (!faqMeta.used && !decisionMeta.used && !kgMeta.used && !ragMeta.used) {
        logWarn("total_evidence_absence_early_exit", { route: routeType, query: truncatedQuery });
        incrementMetric("deterministic_fallback_total");
        return createFallbackResult(
            "Insufficient verified academic evidence was found for this query.",
            requestedRoute,
            0.2,
            Date.now() - pipelineStart,
            null,
            {
                route: "LLM_FALLBACK",
                reasoning: "All retrieval systems returned insufficient evidence. Bypassing LLM synthesis for safety.",
                missing_information: ["Insufficient evidence available."],
                metadata: { route_safety: "SAFE_FAILURE" }
            }
        );
    }

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
        incrementMetric("deterministic_fallback_total");
        return createFallbackResult(INSUFFICIENT_DATA_PHRASE, requestedRoute, retrievalConfidence, 0, null, {
            query,
            route: "LLM_FALLBACK",
            neo4jContext,
            ragContext,
            faqContext,
            decisionContext,
            metadata: { route_safety: "SAFE_FAILURE" },
            reasoning: "System fallback triggered due to insufficient evidence.",
            missing_information: ["Insufficient evidence available."],
            failure: true
        });
    }

    logInfo("pipeline_start", {
        route: resolvedRoute,
        retrieval_confidence: retrievalConfidence,
        is_degraded: isDegraded,
        query_preview: truncatedQuery,
        model: MODEL,
        backup_model: getOllamaRuntimeStatus().backup_model
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

            prompt = buildPrompt(query.trim(), contextPayload, resolvedRoute, history, conversationMemory);
            promptTokenEst = estimateTokens(prompt);

            if (promptTokenEst < PROMPT_TOKEN_WARN_THRESHOLD) break;
            if (pass === 3) break; // Exceeded max passes

            logWarn("budget_exceeded_recalculating_trim", { pass, tokens: promptTokenEst });
            currentTrimConfig = trimContextToBudget(promptTokenEst);
        }

        const safePromptLimit = Math.max(
            512,
            LLM_CONFIG.gemma.maxContextTokens - LLM_CONFIG.gemma.contextHeadroomTokens
        );

        if (promptTokenEst > safePromptLimit) {
            const emptyPromptTokens = estimateTokens(buildPrompt(query.trim(), "", resolvedRoute, history, conversationMemory));
            const contextBudget = Math.max(128, safePromptLimit - emptyPromptTokens);
            const truncation = hardTruncateToTokenBudget(contextPayload, contextBudget);

            if (truncation.truncated) {
                contextPayload = truncation.text;
                prompt = buildPrompt(query.trim(), contextPayload, resolvedRoute, history, conversationMemory);
                promptTokenEst = estimateTokens(prompt);
                contextMetrics = {
                    ...contextMetrics,
                    payload_chars: contextPayload.length,
                    payload_tokens_est: estimateTokens(contextPayload),
                    hard_truncated: true,
                    safe_prompt_limit: safePromptLimit,
                };
                logWarn("context_hard_truncated", {
                    route: resolvedRoute,
                    final_prompt_tokens: promptTokenEst,
                    safe_prompt_limit: safePromptLimit,
                    context_budget_tokens: contextBudget,
                });
            }
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
        inferenceOptions.num_predict = routeNumPredict(resolvedRoute, promptTokenEst);

        const telemetryBeforeInference = getGemmaTelemetrySnapshot();
        if (
            telemetryBeforeInference.gemma_memory_pressure?.critical === true &&
            promptTokenEst >= LLM_CONFIG.gemma.deferSynthesisTokens
        ) {
            const deterministicAnswer = buildDeterministicFallbackAnswer({
                faqContext,
                decisionContext,
                neo4jContext,
                ragContext
            });

            if (deterministicAnswer) {
                const totalLatencyMs = Date.now() - pipelineStart;
                incrementMetric("deterministic_fallback_total");
                logWarn("memory_pressure_deferred_heavy_synthesis", {
                    route: resolvedRoute,
                    prompt_tokens: promptTokenEst,
                    memory_pressure: telemetryBeforeInference.gemma_memory_pressure,
                });

                return createResult({
                    answer: deterministicAnswer,
                    route: resolvedRoute,
                    confidence: retrievalConfidence,
                    sources_used,
                    latency_ms: totalLatencyMs,
                    sanitized: false,
                    truncated: false,
                    query,
                    requestedRoute,
                    neo4jContext,
                    ragContext,
                    faqContext,
                    decisionContext,
                    contextMetrics,
                    metadata: {
                        memory_deferred: true,
                        route_safety: "MEMORY_PRESSURE_DEFERRED",
                        prompt_tokens: promptTokenEst,
                        gemma_memory_pressure: telemetryBeforeInference.gemma_memory_pressure,
                    }
                });
            }
        }

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
            num_predict: inferenceOptions.num_predict,
        });

        const deterministicContextAnswer = buildDeterministicFallbackAnswer({
            faqContext,
            decisionContext,
            neo4jContext,
            ragContext
        });
        const deterministicScholarshipAnswer =
            buildScholarshipApplicationPartialAnswer(query, ragContext);

        // Step 4: Gemma primary, Gemini backup, deterministic fallback.
        const synthesisResult = deterministicScholarshipAnswer
            ? {
                rawAnswer: deterministicScholarshipAnswer,
                synthesisProvider: "deterministic_scholarship_evidence",
                synthesisLatencyMs: 0,
                ollamaLatencyMs: null,
                ollamaRuntime: getOllamaRuntimeStatus(),
                ollamaGenerationMeta: null,
                geminiResult: null,
                geminiFallbackReason: null,
                gemmaPrimaryFailureReason: null,
                deterministicFallbackUsed: true,
            }
            : await runFinalSynthesis({
                prompt,
                resolvedRoute,
                inferenceOptions,
                requestId: `unified_${Date.now()}`,
                promptTokenEst,
                deterministicFallbackAnswer: deterministicContextAnswer,
            });

        const {
            rawAnswer,
            synthesisProvider,
            synthesisLatencyMs,
            ollamaLatencyMs,
            ollamaRuntime,
            ollamaGenerationMeta,
            geminiResult,
            geminiFallbackReason,
            gemmaPrimaryFailureReason,
            deterministicFallbackUsed,
        } = synthesisResult;

        // ── Step 5: Sanitize + truncation repair ─────────────────────────
        let { text: finalAnswer, sanitized, truncated, rejection_reason } =
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
            synthesis_provider: synthesisProvider,
            synthesis_latency_ms: synthesisLatencyMs,
            ollama_latency_ms: ollamaLatencyMs,
            answer_chars: finalAnswer.length,
            answer_tokens_est: estimateTokens(finalAnswer),
            sanitized,
            truncated,
            sources_used,
            // LG-09: sampling + gate state so answer variance is attributable.
            temperature: inferenceOptions.temperature,
            top_p: inferenceOptions.top_p,
            deterministic_synthesis: runtimeMode.deterministicSynthesis,
            retrieval_confidence: retrievalConfidence,
            is_degraded: isDegraded,
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
            query,
            requestedRoute,
            neo4jContext,
            ragContext,
            faqContext,
            decisionContext,
            contextMetrics,
            metadata: {
                model: geminiResult?.model || ollamaGenerationMeta?.model || MODEL,
                synthesis_provider: synthesisProvider,
                synthesis_latency_ms: synthesisLatencyMs,
                gemini_model: geminiResult?.model || null,
                gemini_latency_ms: geminiResult?.latencyMs || null,
                gemini_finish_reason: geminiResult?.finishReason || null,
                gemma_primary_used: synthesisProvider === "gemma_primary",
                gemma_primary_failure_reason: gemmaPrimaryFailureReason,
                gemini_backup_used: synthesisProvider === "gemini_backup",
                gemini_backup_reason: geminiFallbackReason,
                deterministic_context_fallback: deterministicFallbackUsed,
                primary_model: ollamaRuntime.primary_model,
                backup_model: ollamaRuntime.backup_model,
                is_degraded: isDegraded,
                llm_failover_active: ollamaRuntime.failover_active,
                breaker_state: ollamaRuntime.breaker_state,
                primary_failures: ollamaRuntime.primary_failures,
                backup_activations: ollamaRuntime.backup_activations,
                failover_count: ollamaRuntime.failover_count,
                recovery_success: ollamaRuntime.recovery_success,
                failover_used: !!ollamaGenerationMeta?.failover_used,
                prompt_tokens: promptTokenEst,
                prompt_truncated: !!ollamaGenerationMeta?.prompt_truncated || !!contextMetrics?.hard_truncated,
                num_predict: inferenceOptions.num_predict,
                output_tokens: geminiResult?.outputTokens || ollamaGenerationMeta?.outputTokens || estimateTokens(finalAnswer),
                gemma_memory_pressure: ollamaRuntime.gemma_memory_pressure,
                gemma_queue_depth: ollamaRuntime.gemma_queue_depth,
                overload_retries: ollamaRuntime.overload_retries,
                ollama_latency_ms: ollamaLatencyMs
            }
        });

    } catch (error) {
        const totalLatencyMs = Date.now() - pipelineStart;
        const ollamaRuntimeOnFailure = getOllamaRuntimeStatus();

        logError("pipeline_failed", {
            route: resolvedRoute,
            query_preview: truncatedQuery,
            error_message: error?.message ?? String(error),
            total_latency_ms: totalLatencyMs,
            breaker_state: ollamaRuntimeOnFailure.breaker_state,
            failover_active: ollamaRuntimeOnFailure.failover_active,
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

        // PHASE 8.5 — DETERMINISTIC HYBRID FUSION FALLBACK
        if (resolvedRoute === ROUTE_TYPES.HYBRID && fallbackSources.kg && fallbackSources.rag) {
            const hybridAnswer = buildDeterministicHybridAnswer(neo4jContext, ragContext);
            if (hybridAnswer) {
                logInfo("deterministic_hybrid_fallback_successful", { route: resolvedRoute });
                incrementMetric("deterministic_fallback_total");
                return createResult({
                    answer: hybridAnswer,
                    route: "HYBRID_KG_RAG",
                    confidence: 0.89,
                    sources_used: fallbackSources,
                    latency_ms: totalLatencyMs,
                    sanitized: false,
                    truncated: false,
                    query,
                    requestedRoute,
                    neo4jContext,
                    ragContext,
                    faqContext,
                    decisionContext,
                    metadata: {
                        route_safety: "SAFE_HYBRID_FALLBACK",
                        fallback_type: "DETERMINISTIC_HYBRID",
                        primary_model: ollamaRuntimeOnFailure.primary_model,
                        backup_model: ollamaRuntimeOnFailure.backup_model,
                        breaker_state: ollamaRuntimeOnFailure.breaker_state,
                        llm_failover_active: ollamaRuntimeOnFailure.failover_active,
                        kg_fact_count: (kgMeta || buildNeo4jBlock(neo4jContext)).count,
                        rag_fact_count: (ragMeta || buildRagBlock(ragContext)).count
                    }
                });
            }
        }

        if (deterministicAnswer) {
            logInfo("deterministic_fallback_successful", { route: resolvedRoute });
            incrementMetric("deterministic_fallback_total");
            return createResult({
                answer: deterministicAnswer,
                route: resolvedRoute,
                confidence: retrievalConfidence,
                sources_used: fallbackSources,
                latency_ms: totalLatencyMs,
                sanitized: false,
                truncated: false,
                query,
                requestedRoute,
                neo4jContext,
                ragContext,
                faqContext,
                decisionContext,
                metadata: {
                    deterministic_fallback: true,
                    route_safety: "SAFE_FALLBACK",
                    primary_model: ollamaRuntimeOnFailure.primary_model,
                    backup_model: ollamaRuntimeOnFailure.backup_model,
                    breaker_state: ollamaRuntimeOnFailure.breaker_state,
                    llm_failover_active: ollamaRuntimeOnFailure.failover_active,
                    primary_failures: ollamaRuntimeOnFailure.primary_failures,
                    backup_activations: ollamaRuntimeOnFailure.backup_activations,
                    failover_count: ollamaRuntimeOnFailure.failover_count,
                    recovery_success: ollamaRuntimeOnFailure.recovery_success
                }
            });
        }

        return createFallbackResult(FALLBACK_ANSWER, requestedRoute, retrievalConfidence, totalLatencyMs, fallbackSources, {
            query,
            route: "LLM_FALLBACK",
            neo4jContext,
            ragContext,
            faqContext,
            decisionContext,
            metadata: {
                route_safety: "SAFE_FAILURE",
                primary_model: ollamaRuntimeOnFailure.primary_model,
                backup_model: ollamaRuntimeOnFailure.backup_model,
                breaker_state: ollamaRuntimeOnFailure.breaker_state,
                llm_failover_active: ollamaRuntimeOnFailure.failover_active,
                primary_failures: ollamaRuntimeOnFailure.primary_failures,
                backup_activations: ollamaRuntimeOnFailure.backup_activations,
                failover_count: ollamaRuntimeOnFailure.failover_count,
                recovery_success: ollamaRuntimeOnFailure.recovery_success
            },
            reasoning: "System fallback triggered due to insufficient evidence.",
            missing_information: ["Insufficient evidence available."],
            failure: true
        });
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
    MAX_HISTORY_MESSAGES,
    MAX_HISTORY_MESSAGE_CHARS,
    MAX_HISTORY_TOTAL_CHARS,
    MAX_MEMORY_BLOCK_CHARS,
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
    normalizeGraphEvidence,
    depthLimitedSerialize,
    trimContextToBudget,                  // NEW Phase 3
    buildDeterministicFallbackAnswer,     // NEW Phase 3

    // ── Prompt assembly ───────────────────────────────────────────────
    BASE_SYSTEM_PROMPT,
    buildConversationHistoryBlock,
    buildConversationMemoryBlock,
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
