/**
 * ============================================================
 * responseFormatter.js — AAST Explainable Hybrid Academic Super-Agent
 * ============================================================
 * Centralized response normalization layer for orchestrator API.
 * Guarantees envelope consistency, normalizes routes and sources,
 * deduplicates badges, and appends trace execution paths using immutable merges.
 * ============================================================
 */

'use strict';

const NORMALIZED_SOURCES = {
    KG: 'KG',
    KG_DIRECT: 'KG_DIRECT',
    RAG: 'RAG',
    RAG_DIRECT: 'RAG_DIRECT',
    HYBRID: 'HYBRID',
    DECISION: 'DECISION',
    CAREER: 'CAREER',
    FAQ: 'FAQ',
    INTERACTIVE: 'INTERACTIVE',
    LLM: 'LLM'
};

console.log("[PHASE4_1] KG_DIRECT telemetry preserved");

class ResponseFormatter {
    format(fusionPayload, cid, requestId, traceData = {}) {
        // Immutable merge for metadata
        const metadata = {
            ...(fusionPayload.metadata || {}),
            trace: {
                request_id: requestId,
                route: this._normalizeRoute(fusionPayload.route_used || fusionPayload.route),
                degraded_services: traceData.degraded_services || [],
                subsystem_health: traceData.subsystem_health || {},
                latency_ms: traceData.latency_ms || 0,
                routing_confidence: traceData.routing_confidence || 0,
                response_tier: traceData.response_tier || "FULL_SUCCESS"
            }
        };

        const answer =
            fusionPayload.final_answer ||
            fusionPayload.answer ||
            "Partial verified academic guidance is available based on current institutional knowledge.";

        if (fusionPayload.degraded === true) {
            fusionPayload.confidence = Math.max(
                this._normalizeConfidence(fusionPayload.confidence),
                0.15
            );
        }

        const sources =
            fusionPayload.contributing_sources || fusionPayload.sources
                ? this._normalizeSources(fusionPayload.contributing_sources || fusionPayload.sources)
                : [this._normalizeRoute(fusionPayload.route_used || fusionPayload.route)];

        return {
            answer: answer,
            final_answer: answer,
            route: metadata.trace.route,
            confidence: this._normalizeConfidence(fusionPayload.confidence),
            used_facts: Array.isArray(fusionPayload.used_facts)
                ? fusionPayload.used_facts
                : [],
            missing_information: Array.isArray(fusionPayload.missing_information)
                ? fusionPayload.missing_information
                : [],
            graph: {
                nodes: Array.isArray(fusionPayload.graph?.nodes)
                    ? fusionPayload.graph.nodes
                    : [],
                links: Array.isArray(fusionPayload.graph?.links)
                    ? fusionPayload.graph.links
                    : []
            },
            source: sources[0] || "LLM",
            sources: sources,
            explainability: fusionPayload.explainability || { deterministic: false },
            citations: Array.isArray(fusionPayload.citations) ? fusionPayload.citations : [],
            reasoning: fusionPayload.reasoning || "Response generated via standardized formatting layer.",
            metadata: metadata,
            cid: cid,
            conversationId: cid,
            requestId: requestId
        };
    }

    formatInteractive(promptText, cid, requestId, missingFields = [], traceData = {}) {
        const metadata = {
            interactive: true,
            missing_fields: missingFields,
            trace: {
                request_id: requestId,
                route: NORMALIZED_SOURCES.INTERACTIVE,
                degraded_services: traceData.degraded_services || [],
                subsystem_health: traceData.subsystem_health || {},
                latency_ms: traceData.latency_ms || 0,
                routing_confidence: traceData.routing_confidence || 0,
                response_tier: traceData.response_tier || "FULL_SUCCESS"
            }
        };

        return {
            answer: promptText,
            final_answer: promptText,
            route: NORMALIZED_SOURCES.INTERACTIVE,
            confidence: 1.0,
            used_facts: [],
            missing_information: [],
            graph: {
                nodes: [],
                links: []
            },
            source: NORMALIZED_SOURCES.INTERACTIVE,
            sources: [NORMALIZED_SOURCES.INTERACTIVE],
            explainability: { interactive: true },
            citations: [],
            reasoning: "Interactive data collection required to complete user profile.",
            metadata: metadata,
            cid: cid,
            conversationId: cid,
            requestId: requestId
        };
    }

    formatStatic(promptText, route, confidenceVal, cid, requestId, traceData = {}) {
        const r = this._normalizeRoute(route);
        const metadata = {
            trace: {
                request_id: requestId,
                route: r,
                degraded_services: traceData.degraded_services || [],
                subsystem_health: traceData.subsystem_health || {},
                latency_ms: traceData.latency_ms || 0,
                routing_confidence: traceData.routing_confidence || 0,
                response_tier: traceData.response_tier || "FULL_SUCCESS"
            }
        };

        return {
            answer: promptText,
            final_answer: promptText,
            route: r,
            confidence: this._normalizeConfidence(confidenceVal),
            used_facts: [],
            missing_information: [],
            graph: {
                nodes: [],
                links: []
            },
            source: r,
            sources: [r],
            explainability: { static: true },
            citations: [],
            reasoning: `Static ${r} response matched.`,
            metadata: metadata,
            cid: cid,
            conversationId: cid,
            requestId: requestId
        };
    }

    formatErrorFallback(errorMsg, route, cid, requestId, traceData = {}) {
        const r = this._normalizeRoute(route) || NORMALIZED_SOURCES.LLM;
        const metadata = {
            error: true,
            trace: {
                request_id: requestId,
                route: r,
                degraded_services: traceData.degraded_services || [],
                subsystem_health: traceData.subsystem_health || {},
                latency_ms: traceData.latency_ms || 0,
                routing_confidence: traceData.routing_confidence || 0,
                response_tier: traceData.response_tier || "DEGRADED_SUCCESS"
            }
        };

        return {
            answer: errorMsg,
            final_answer: errorMsg,
            route: r,
            confidence: traceData.response_tier === "FATAL_FALLBACK" ? 0.1 : 0.25,
            used_facts: [],
            missing_information: [],
            graph: {
                nodes: [],
                links: []
            },
            source: NORMALIZED_SOURCES.LLM,
            sources: [NORMALIZED_SOURCES.LLM],
            explainability: { error: true },
            citations: [],
            reasoning:
                traceData.response_tier === "FATAL_FALLBACK"
                    ? "System encountered a critical failure; safe advisory fallback activated."
                    : "System operating in degraded advisory mode; best available verified academic guidance preserved.",
            metadata: metadata,
            cid: cid,
            conversationId: cid,
            requestId: requestId
        };
    }

    _normalizeRoute(route) {
        if (!route) return NORMALIZED_SOURCES.LLM;
        const r = route.toUpperCase();
        if (r.includes('HYBRID')) return NORMALIZED_SOURCES.HYBRID;
        if (r.includes('KG_DIRECT')) return NORMALIZED_SOURCES.KG_DIRECT;
        if (r.includes('RAG_DIRECT')) return NORMALIZED_SOURCES.RAG_DIRECT;
        if (r.includes('KG')) return NORMALIZED_SOURCES.KG;
        if (r.includes('RAG')) return NORMALIZED_SOURCES.RAG;
        if (r.includes('DECISION')) return NORMALIZED_SOURCES.DECISION;
        if (r.includes('CAREER')) return NORMALIZED_SOURCES.CAREER;
        if (r.includes('FAQ')) return NORMALIZED_SOURCES.FAQ;
        if (r.includes('INTERACTIVE')) return NORMALIZED_SOURCES.INTERACTIVE;
        if (r.includes('GREETING')) return NORMALIZED_SOURCES.FAQ; // Map GREETING to FAQ for frontend safety
        return NORMALIZED_SOURCES.LLM;
    }

    _normalizeSources(sources) {
        if (!sources || !Array.isArray(sources)) return [NORMALIZED_SOURCES.LLM];
        const normalizedArray = sources.map(s => {
            const raw = typeof s === 'string' ? s.toUpperCase() : 'LLM';
            if (raw.includes('KG_DIRECT')) return NORMALIZED_SOURCES.KG_DIRECT;
            if (raw.includes('RAG_DIRECT')) return NORMALIZED_SOURCES.RAG_DIRECT;
            if (raw.includes('KG')) return NORMALIZED_SOURCES.KG;
            if (raw.includes('RAG')) return NORMALIZED_SOURCES.RAG;
            if (raw.includes('DECISION')) return NORMALIZED_SOURCES.DECISION;
            if (raw.includes('CAREER')) return NORMALIZED_SOURCES.CAREER;
            if (raw.includes('FAQ')) return NORMALIZED_SOURCES.FAQ;
            if (raw.includes('INTERACTIVE')) return NORMALIZED_SOURCES.INTERACTIVE;
            if (raw.includes('GREETING')) return NORMALIZED_SOURCES.FAQ; // Map GREETING to FAQ
            return NORMALIZED_SOURCES.LLM;
        });

        // Deduplicate via Set
        return [...new Set(normalizedArray)];
    }

    _normalizeConfidence(conf) {
        let c = parseFloat(conf);
        if (isNaN(c)) return 0.5;
        if (c > 1.0) c = c / 100.0;
        return Math.max(0.0, Math.min(1.0, parseFloat(c.toFixed(3))));
    }
}

export default new ResponseFormatter();
