import assert from "node:assert/strict";
import {
  assessGoldenCacheability,
  buildGoldenCacheKey
} from "../services/goldenCachePolicy.js";

const goldenHybrid = {
  id: "test_hybrid",
  route: "HYBRID_KG_RAG",
  cacheable: true,
};

const completeHybridPayload = {
  final_answer: "Verified graph facts with verified policy context.",
  route_used: "HYBRID_KG_RAG",
  missing_information: [],
  explainability: { deterministic_hybrid: true },
};

function assess(overrides = {}) {
  return assessGoldenCacheability({
    goldenMatch: goldenHybrid,
    payload: completeHybridPayload,
    executionState: {
      degradedServices: [],
      responseTier: "DETERMINISTIC_SUCCESS",
      evidence: { kgCount: 2, ragCount: 2 },
    },
    ...overrides,
  });
}

const matrix = [
  ["complete hybrid", {}, true, "complete_verified_response"],
  ["KG-only partial", { executionState: { degradedServices: [], responseTier: "DETERMINISTIC_SUCCESS", evidence: { kgCount: 2, ragCount: 0 } } }, false, "missing_hybrid_rag_evidence"],
  ["RAG-only partial", { executionState: { degradedServices: [], responseTier: "DETERMINISTIC_SUCCESS", evidence: { kgCount: 0, ragCount: 2 } } }, false, "missing_hybrid_kg_evidence"],
  ["present but unusable RAG evidence", { executionState: { degradedServices: [], responseTier: "DETERMINISTIC_SUCCESS", evidence: { kgCount: 2, ragCount: 0 } } }, false, "missing_hybrid_rag_evidence"],
  ["timeout/degraded service", { executionState: { degradedServices: ["RAG_TIMEOUT"], responseTier: "DEGRADED_SUCCESS", evidence: { kgCount: 2, ragCount: 0 } } }, false, "degraded_services"],
  ["self-marked degraded", { payload: { ...completeHybridPayload, degraded: true } }, false, "payload_degraded"],
  ["static fallback", { payload: { ...completeHybridPayload, explainability: { fallback_reason: "HYBRID_TOTAL_FAILURE" } } }, false, "fallback_payload"],
  ["missing information", { payload: { ...completeHybridPayload, missing_information: ["RAG evidence unavailable"] } }, false, "missing_information"],
  ["fallback response tier", { executionState: { degradedServices: [], responseTier: "GOLDEN_DEGRADED_SUCCESS", evidence: { kgCount: 2, ragCount: 2 } } }, false, "incomplete_response_tier"],
  ["route fallback", { payload: { ...completeHybridPayload, route_used: "RAG_DIRECT" } }, false, "route_mismatch"],
  ["missing execution state", { executionState: undefined }, false, "missing_execution_state"],
];

for (const [name, overrides, expectedCacheable, expectedReason] of matrix) {
  const result = assess(overrides);
  assert.equal(result.cacheable, expectedCacheable, `${name}: cacheability`);
  assert.equal(result.reason, expectedReason, `${name}: reason`);
}

const kgResult = assessGoldenCacheability({
  goldenMatch: { id: "kg", route: "KG_DIRECT", cacheable: true },
  payload: { final_answer: "Verified KG answer", route_used: "KG_DIRECT", missing_information: [] },
  executionState: {
    degradedServices: [],
    responseTier: "DETERMINISTIC_SUCCESS",
    evidence: { kgCount: 1 },
  },
});
assert.deepEqual(kgResult, { cacheable: true, reason: "complete_verified_response" });

const careerMatch = {
  id: "golden_dean_program_careers",
  route: "KG_DIRECT",
  cacheable: true,
};
assert.notEqual(
  buildGoldenCacheKey(careerMatch, "What careers can Intelligent Systems lead to?"),
  buildGoldenCacheKey(careerMatch, "What careers can Data Science lead to?"),
  "different named entities in one golden family must not share a payload"
);
assert.equal(
  buildGoldenCacheKey(careerMatch, "What careers can Data Science lead to?"),
  buildGoldenCacheKey(careerMatch, "  WHAT careers can Data Science lead to?!  "),
  "case, punctuation, and whitespace variants should share a scoped cache entry"
);

console.log(`Golden cache policy matrix passed (${matrix.length + 1} cases).`);
