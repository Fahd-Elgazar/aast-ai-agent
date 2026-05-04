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
    RAG: 'RAG',
    HYBRID: 'HYBRID',
    DECISION: 'DECISION',
    CAREER: 'CAREER',
    FAQ: 'FAQ',
    INTERACTIVE: 'INTERACTIVE',
    LLM: 'LLM'
};

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
                routing_confidence: traceData.routing_confidence || 0
            }
        };

        return {
            answer: fusionPayload.final_answer || fusionPayload.answer || "I am unable to provide a response at this time.",
            route: metadata.trace.route,
            confidence: this._normalizeConfidence(fusionPayload.confidence),
            sources: this._normalizeSources(fusionPayload.contributing_sources || fusionPayload.sources),
            citations: Array.isArray(fusionPayload.citations) ? fusionPayload.citations : [],
            reasoning: fusionPayload.reasoning || "Response generated via standardized formatting layer.",
            metadata: metadata,
            cid: cid,
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
                routing_confidence: traceData.routing_confidence || 0
            }
        };

        return {
            answer: promptText,
            route: NORMALIZED_SOURCES.INTERACTIVE,
            confidence: 1.0,
            sources: [NORMALIZED_SOURCES.INTERACTIVE],
            citations: [],
            reasoning: "Interactive data collection required to complete user profile.",
            metadata: metadata,
            cid: cid,
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
                routing_confidence: traceData.routing_confidence || 0
            }
        };

        return {
            answer: promptText,
            route: r,
            confidence: this._normalizeConfidence(confidenceVal),
            sources: [r],
            citations: [],
            reasoning: `Static ${r} response matched.`,
            metadata: metadata,
            cid: cid,
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
                routing_confidence: traceData.routing_confidence || 0
            }
        };

        return {
            answer: errorMsg,
            route: r,
            confidence: 0.1,
            sources: [NORMALIZED_SOURCES.LLM],
            citations: [],
            reasoning: "System encountered an error, falling back to safe advisory message.",
            metadata: metadata,
            cid: cid,
            requestId: requestId
        };
    }

    _normalizeRoute(route) {
        if (!route) return NORMALIZED_SOURCES.LLM;
        const r = route.toUpperCase();
        if (r.includes('HYBRID')) return NORMALIZED_SOURCES.HYBRID;
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
