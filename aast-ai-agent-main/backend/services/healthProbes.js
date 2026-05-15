/**
 * ============================================================
 * healthProbes.js — AAST Explainable Hybrid Academic Super-Agent
 * ============================================================
 * Lightweight, cached subsystem health polling with circuit breaking.
 * Protects orchestrator latency loops before executing queries.
 * ============================================================
 */

import { getSession } from "../db/neo4j.js";
import ragService from "./ragService.js";
import { searchFAQ } from "../faqService.js";
import { getRecommendation, buildCareerRoadmap } from "./decisionService.js";
import { incrementMetric } from "./metrics.js";
import { getOllamaRuntimeStatus } from "./ollamaService.js";

const HEALTH_CACHE_TTL = 15000; // 15 seconds
const MAX_STALE_HEALTH_MS = 60000; // 60 seconds

let cachedHealth = {
    kg: false, rag: false, decision: false, career: false, faq: false, llm: false
};
let lastCheckTime = 0;

export const timeoutWrapper = (promise, ms, fallback) => {
    let timer;
    const timeoutPromise = new Promise(resolve => {
        timer = setTimeout(() => resolve(fallback), ms);
    });
    return Promise.race([
        promise.then(res => { clearTimeout(timer); return res; }).catch(() => { clearTimeout(timer); return fallback; }),
        timeoutPromise
    ]);
};

export async function checkSubsystemHealth() {
    const now = Date.now();
    const age = now - lastCheckTime;
    
    if (age < HEALTH_CACHE_TTL) {
        return cachedHealth;
    }

    // Force full refresh if cache exceeds stale threshold
    if (age > MAX_STALE_HEALTH_MS) {
        cachedHealth = {
            kg: false, rag: false, decision: false, career: false, faq: false, llm: false
        };
    }

    try {
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
                2000, cachedHealth.kg // Fallback to last known good state
            ),
            
            // RAG Health
            timeoutWrapper(
                (async () => {
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
                2000, cachedHealth.rag
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
                2000, cachedHealth.llm
            ),

            // FAQ Health (Lightweight validation + data config check)
            timeoutWrapper(
                (async () => {
                    return typeof searchFAQ === 'function' && process.env.FAQ_DATA_PATH !== undefined;
                })(),
                2000, cachedHealth.faq
            ),

            // DECISION Health (Lightweight check)
            timeoutWrapper(
                (async () => {
                    return typeof getRecommendation === 'function';
                })(),
                2000, cachedHealth.decision
            ),

            // CAREER Health (Lightweight check)
            timeoutWrapper(
                (async () => {
                    return typeof buildCareerRoadmap === 'function';
                })(),
                2000, cachedHealth.career
            )
        ]);

        cachedHealth.kg = checks[0].status === 'fulfilled' ? checks[0].value : cachedHealth.kg;
        cachedHealth.rag = checks[1].status === 'fulfilled' ? checks[1].value : cachedHealth.rag;
        cachedHealth.llm = checks[2].status === 'fulfilled' ? checks[2].value : cachedHealth.llm;
        cachedHealth.faq = checks[3].status === 'fulfilled' ? checks[3].value : cachedHealth.faq;
        cachedHealth.decision = checks[4].status === 'fulfilled' ? checks[4].value : cachedHealth.decision;
        cachedHealth.career = checks[5].status === 'fulfilled' ? checks[5].value : cachedHealth.career;

        // Metrics Logging
        if (!cachedHealth.kg) incrementMetric("health_probe_failures_kg");
        if (!cachedHealth.rag) incrementMetric("health_probe_failures_rag");
        if (!cachedHealth.llm) incrementMetric("health_probe_failures_llm");
        if (!cachedHealth.faq) incrementMetric("health_probe_failures_faq");
        if (!cachedHealth.decision) incrementMetric("health_probe_failures_decision");
        if (!cachedHealth.career) incrementMetric("health_probe_failures_career");

        lastCheckTime = now;

    } catch (err) {
        console.error("[HEALTH_PROBE] Global failure:", err.message);
    }

    return cachedHealth;
}
