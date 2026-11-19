const SUCCESS_RESPONSE_TIERS = new Set([
  "FULL_SUCCESS",
  "DETERMINISTIC_SUCCESS",
]);

function hasEvidence(evidence, key) {
  return evidence?.[key] === true || Number(evidence?.[`${key}Count`] || 0) > 0;
}

function normalizeRoute(value) {
  return String(value || "").trim().toUpperCase();
}

export function buildGoldenCacheKey(goldenMatch, query = "") {
  if (!goldenMatch?.id) return null;
  const normalizedQuery = String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalizedQuery) return null;
  return `${goldenMatch.id}:${normalizeRoute(goldenMatch.route)}:${normalizedQuery}`;
}

/**
 * Golden answers are long-lived, so cache admission must be based on the
 * completed execution state rather than the mere presence of an answer.
 * This function is intentionally pure so every degraded/partial combination
 * remains covered without importing the orchestrator and starting services.
 */
export function assessGoldenCacheability({
  goldenMatch,
  payload,
  executionState,
} = {}) {
  if (!goldenMatch?.cacheable) return { cacheable: false, reason: "golden_not_cacheable" };
  if (!payload || typeof payload !== "object") return { cacheable: false, reason: "missing_payload" };
  if (!executionState || typeof executionState !== "object") {
    return { cacheable: false, reason: "missing_execution_state" };
  }

  const answer = String(payload.final_answer || payload.answer || "").trim();
  if (!answer) return { cacheable: false, reason: "missing_answer" };
  if (payload.degraded === true) return { cacheable: false, reason: "payload_degraded" };
  if (payload.explainability?.fallback_reason) {
    return { cacheable: false, reason: "fallback_payload" };
  }
  if (Array.isArray(payload.missing_information) && payload.missing_information.length > 0) {
    return { cacheable: false, reason: "missing_information" };
  }

  const degradedServices = Array.isArray(executionState.degradedServices)
    ? executionState.degradedServices.filter(Boolean)
    : [];
  if (degradedServices.length > 0) {
    return { cacheable: false, reason: "degraded_services" };
  }

  const responseTier = String(executionState.responseTier || "").trim().toUpperCase();
  if (!SUCCESS_RESPONSE_TIERS.has(responseTier)) {
    return { cacheable: false, reason: "incomplete_response_tier" };
  }

  const expectedRoute = normalizeRoute(goldenMatch.route);
  const actualRoute = normalizeRoute(payload.route_used || payload.route);
  if (!expectedRoute || actualRoute !== expectedRoute) {
    return { cacheable: false, reason: "route_mismatch" };
  }

  const evidence = executionState.evidence || {};
  if (expectedRoute === "HYBRID_KG_RAG") {
    if (!hasEvidence(evidence, "kg")) {
      return { cacheable: false, reason: "missing_hybrid_kg_evidence" };
    }
    if (!hasEvidence(evidence, "rag")) {
      return { cacheable: false, reason: "missing_hybrid_rag_evidence" };
    }
  } else if (expectedRoute === "KG_DIRECT" && !hasEvidence(evidence, "kg")) {
    return { cacheable: false, reason: "missing_kg_evidence" };
  } else if (expectedRoute === "RAG_DIRECT" && !hasEvidence(evidence, "rag")) {
    return { cacheable: false, reason: "missing_rag_evidence" };
  } else if (expectedRoute === "DECISION_ENGINE" && !hasEvidence(evidence, "decision")) {
    return { cacheable: false, reason: "missing_decision_evidence" };
  } else if (expectedRoute === "CAREER_ENGINE" && !hasEvidence(evidence, "career")) {
    return { cacheable: false, reason: "missing_career_evidence" };
  }

  return { cacheable: true, reason: "complete_verified_response" };
}

export default assessGoldenCacheability;
