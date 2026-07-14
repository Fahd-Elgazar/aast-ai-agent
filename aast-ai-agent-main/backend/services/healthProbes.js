/**
 * ============================================================
 * healthProbes.js — AAST Explainable Hybrid Academic Super-Agent
 * ============================================================
 * Lightweight, cached subsystem health polling with circuit breaking.
 * Protects orchestrator latency loops before executing queries.
 *
 * RELIABILITY (RC-01 fix): health is "sticky last-known-good" with
 * hysteresis. A subsystem is marked UP after a single successful probe
 * but only marked DOWN after HEALTH_FAILURE_THRESHOLD consecutive
 * failed probe cycles. The previous behavior (reset everything to
 * false after 60s idle, then trust a single probe window) made the
 * first request after a demo pause route against a flapped snapshot.
 * ============================================================
 */

import { getSession } from "../db/neo4j.js";
import fetch from "node-fetch";
import ragService from "./ragService.js";
import { searchFAQ } from "../faqService.js";
import { getRecommendation, buildCareerRoadmap } from "./decisionService.js";
import { incrementMetric } from "./metrics.js";
import { getOllamaRuntimeStatus } from "./ollamaService.js";
import { logger } from "./logger.js";

const HEALTH_CACHE_TTL = Number(process.env.HEALTH_CACHE_TTL_MS || 15000); // 15 seconds
// Consecutive failed probe cycles required before a subsystem is marked DOWN.
// 1 = legacy behavior (single probe flips state). Default 2 absorbs transient blips.
const HEALTH_FAILURE_THRESHOLD = Math.max(1, Number(process.env.HEALTH_FAILURE_THRESHOLD || 2));
const DECISION_API_URL = process.env.DECISION_API_URL || "http://127.0.0.1:8005";
const DECISION_HEALTH_TIMEOUT_MS = Number(process.env.DECISION_HEALTH_TIMEOUT_MS || 1200);
const RAG_HEALTH_PROBE_TIMEOUT_MS = Number(process.env.RAG_HEALTH_PROBE_TIMEOUT_MS || process.env.RAG_HEALTH_TIMEOUT_MS || 5000);

const SUBSYSTEMS = ["kg", "rag", "decision", "career", "faq", "llm"];

let cachedHealth = {
    kg: false, rag: false, decision: false, career: false, faq: false, llm: false
};
// Consecutive failure counters per subsystem (hysteresis state).
const consecutiveFailures = {
    kg: 0, rag: 0, decision: 0, career: 0, faq: 0, llm: 0
};
let lastCheckTime = 0;
let refreshInFlight = null;

/** Age of the health snapshot in ms; Infinity before the first probe cycle. (LG-01) */
export function getHealthCacheAge() {
    return lastCheckTime > 0 ? Date.now() - lastCheckTime : Infinity;
}

export function getCachedSubsystemHealth({ optimistic = false } = {}) {
    if (lastCheckTime > 0) {
        return { ...cachedHealth };
    }

    if (optimistic) {
        return {
            kg: true,
            rag: true,
            decision: true,
            career: true,
            faq: true,
            llm: true
        };
    }

    return { ...cachedHealth };
}

/**
 * Race a promise against a timeout. Resolves to `fallback` on timeout OR error.
 * Does not cancel the underlying work.
 *
 * `label` (optional, LG-07): when provided, timeouts and swallowed errors are
 * logged so degradation is attributable to an exact pipeline stage.
 */
export const timeoutWrapper = (promise, ms, fallback, label = null) => {
    let timer;
    const timeoutPromise = new Promise(resolve => {
        timer = setTimeout(() => {
            if (label) {
                logger.warn("Stage timed out; degrading to fallback", {
                    stage: label,
                    budget_ms: ms
                });
                console.warn(`[TIMEOUT_DEGRADE] stage=${label} budgetMs=${ms} -> fallback`);
            }
            resolve(fallback);
        }, ms);
    });
    return Promise.race([
        promise
            .then(res => { clearTimeout(timer); return res; })
            .catch(err => {
                clearTimeout(timer);
                if (label) {
                    logger.warn("Stage failed; degrading to fallback", {
                        stage: label,
                        error: err?.message
                    });
                    console.warn(`[TIMEOUT_DEGRADE] stage=${label} error="${err?.message}" -> fallback`);
                }
                return fallback;
            }),
        timeoutPromise
    ]);
};

async function checkDecisionApiHealth() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DECISION_HEALTH_TIMEOUT_MS);

    try {
        const response = await fetch(`${DECISION_API_URL}/health`, {
            method: "GET",
            signal: controller.signal
        });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Apply one probe cycle's raw results with hysteresis:
 * - success -> subsystem immediately UP, failure counter reset
 * - failure/timeout -> counter++, subsystem marked DOWN only at threshold
 */
function applyProbeResults(rawResults) {
    const transitions = [];

    for (const name of SUBSYSTEMS) {
        const probeOk = rawResults[name] === true;

        if (probeOk) {
            if (!cachedHealth[name]) transitions.push(`${name}:UP`);
            cachedHealth[name] = true;
            consecutiveFailures[name] = 0;
        } else {
            consecutiveFailures[name] += 1;
            if (consecutiveFailures[name] >= HEALTH_FAILURE_THRESHOLD && cachedHealth[name]) {
                cachedHealth[name] = false;
                transitions.push(`${name}:DOWN(after ${consecutiveFailures[name]} consecutive failures)`);
            }
            incrementMetric(`health_probe_failures_${name}`);
        }
    }

    if (transitions.length > 0) {
        logger.warn("Subsystem health transitions", { transitions });
        console.warn(`[HEALTH_TRANSITION] ${transitions.join(", ")}`);
    }
}

async function runProbeCycle() {
    // Probe timeouts now count as explicit failures (fallback=false) instead of
    // "last known value". Hysteresis absorbs single blips; a genuinely hung
    // subsystem is detected within HEALTH_FAILURE_THRESHOLD cycles.
    const checks = await Promise.allSettled([
        // KG Health
        timeoutWrapper(
            (async () => {
                const session = getSession();
                try {
                    await session.run('RETURN 1 AS alive');
                    return true;
                } catch (e) {
                    return false;
                } finally {
                    await session.close();
                }
            })(),
            2000, false, "health_probe_kg"
        ),

        // RAG Health (breaker-aware: an OPEN circuit means search() will
        // reject immediately, so the router must not send traffic — RC-07)
        timeoutWrapper(
            (async () => {
                if (typeof ragService.getCircuitBreakerStatus === "function") {
                    const breaker = ragService.getCircuitBreakerStatus();
                    if (breaker.blocking) return false;
                }
                if (typeof ragService.healthCheck === 'function') {
                    const h = await ragService.healthCheck();
                    return (
                        h === true ||
                        h?.status === 'healthy' ||
                        h?.status === 'ok' ||
                        h?.system_status === 'HEALTHY' ||
                        h?.system_status === 'DEGRADED' ||
                        h?.retriever?.ok === true
                    );
                }
                return true;
            })(),
            RAG_HEALTH_PROBE_TIMEOUT_MS, false, "health_probe_rag"
        ),

        // LLM Health
        timeoutWrapper(
            (async () => {
                const llm = getOllamaRuntimeStatus();
                return llm.breaker_state !== "OPEN" && (
                    llm.server_healthy ||
                    llm.primary_health?.healthy ||
                    llm.backup_health?.healthy
                );
            })(),
            2000, false, "health_probe_llm"
        ),

        // FAQ Health (Lightweight validation + data config check)
        timeoutWrapper(
            (async () => {
                return typeof searchFAQ === 'function';
            })(),
            2000, false, "health_probe_faq"
        ),

        // DECISION Health (actual API readiness, not just local function presence)
        timeoutWrapper(
            (async () => {
                return typeof getRecommendation === 'function' && await checkDecisionApiHealth();
            })(),
            2000, false, "health_probe_decision"
        ),

        // CAREER Health (Lightweight check)
        timeoutWrapper(
            (async () => {
                return typeof buildCareerRoadmap === 'function';
            })(),
            2000, false, "health_probe_career"
        )
    ]);

    const rawResults = {
        kg: checks[0].status === 'fulfilled' ? checks[0].value : false,
        rag: checks[1].status === 'fulfilled' ? checks[1].value : false,
        llm: checks[2].status === 'fulfilled' ? checks[2].value : false,
        faq: checks[3].status === 'fulfilled' ? checks[3].value : false,
        decision: checks[4].status === 'fulfilled' ? checks[4].value : false,
        career: checks[5].status === 'fulfilled' ? checks[5].value : false
    };

    applyProbeResults(rawResults);
    lastCheckTime = Date.now();
}

export async function checkSubsystemHealth(options = {}) {
    const { fast = false, optimistic = false } = options || {};
    const now = Date.now();
    const age = now - lastCheckTime;

    if (fast) {
        return getCachedSubsystemHealth({ optimistic });
    }

    if (lastCheckTime > 0 && age < HEALTH_CACHE_TTL) {
        return { ...cachedHealth };
    }

    try {
        // Dedupe concurrent refreshes: all callers in the same window share one
        // probe cycle instead of racing independent ones.
        if (!refreshInFlight) {
            refreshInFlight = runProbeCycle().finally(() => {
                refreshInFlight = null;
            });
        }
        await refreshInFlight;
    } catch (err) {
        console.error("[HEALTH_PROBE] Global failure:", err.message);
    }

    return { ...cachedHealth };
}
