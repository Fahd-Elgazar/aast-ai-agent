import assert from "node:assert/strict";

import {
  buildCareerRoadmap,
  decisionFailureResponse,
  generateNextSteps,
  normalizeDecisionResponse,
  requestDecisionApi,
  toOrchestratorDecisionEvidence,
} from "../services/decisionService.js";
import {
  httpStatusForDecisionResult,
  validatePayload,
} from "../routes/decision.js";

const firstRecommendation = {
  program_id: "AI-1",
  program_name: "Artificial Intelligence",
  college_name: "College of Computing",
  score: 88.25,
  match_type: "Exact",
  confidence_level: "High",
  estimated_semester_fee: null,
  currency: null,
  fee_mode: null,
  affordability_label: "unknown",
  score_breakdown: {
    interest_alignment: 95,
    interest_alignment_contribution: 60,
    affordability: 55,
    affordability_contribution: 20,
    employment_outlook: 80,
    employment_outlook_contribution: 5,
    location_preference: 100,
    location_preference_contribution: 3,
    career_flexibility: 75,
    career_flexibility_contribution: 2.25,
    certificate_compatibility: 100,
    certificate_compatibility_contribution: 2,
    decision_data_completeness: 80,
    weighted_subtotal: 92.25,
    missing_data_penalty: 4,
    total: 88.25,
  },
  explanation_summary: "Matched the submitted AI interest.",
  warnings: ["Tuition is unavailable."],
};

const secondRecommendation = {
  ...firstRecommendation,
  program_id: "DS-1",
  program_name: "Data Science",
  score: 84.5,
  score_breakdown: {
    ...firstRecommendation.score_breakdown,
    interest_alignment_contribution: 56.25,
    weighted_subtotal: 88.5,
    total: 84.5,
  },
  explanation_summary: "Matched the submitted data interest.",
};

const normalized = normalizeDecisionResponse({
  success: true,
  result_status: "ok",
  recommended_major: firstRecommendation.program_name,
  confidence: firstRecommendation.score,
  reason: firstRecommendation.explanation_summary,
  score_breakdown: firstRecommendation.score_breakdown,
  warnings: firstRecommendation.warnings,
  total_candidates_considered: 2,
  recommendations: [firstRecommendation, secondRecommendation],
});

assert.equal(normalized.success, true);
assert.equal(normalized.result_status, "ok");
assert.equal(normalized.recommended_major, firstRecommendation.program_name);
assert.equal(normalized.confidence, firstRecommendation.score);
assert.deepEqual(normalized.score_breakdown, firstRecommendation.score_breakdown);
assert.deepEqual(normalized.recommendations, [firstRecommendation, secondRecommendation]);
for (const fabricatedField of [
  "alternatives",
  "pros",
  "cons_and_risks",
  "career_roadmap",
  "next_steps",
  "confidence_breakdown",
  "top_recommendations",
]) {
  assert.equal(fabricatedField in normalized, false, `${fabricatedField} must not be synthesized`);
}

const selectedAlternative = normalizeDecisionResponse(
  {
    success: true,
    result_status: "ok",
    recommended_major: firstRecommendation.program_name,
    recommendations: [firstRecommendation, secondRecommendation],
  },
  { rejectedMajors: [firstRecommendation.program_name] },
);
assert.equal(selectedAlternative.recommended_major, secondRecommendation.program_name);
assert.equal(selectedAlternative.confidence, secondRecommendation.score);
assert.deepEqual(selectedAlternative.score_breakdown, secondRecommendation.score_breakdown);

const noResults = normalizeDecisionResponse({
  success: true,
  result_status: "no_results",
  recommended_major: null,
  confidence: null,
  score_breakdown: null,
  warnings: [],
  total_candidates_considered: 0,
  recommendations: [],
});
assert.deepEqual(noResults, {
  success: true,
  result_status: "no_results",
  recommended_major: null,
  confidence: null,
  score_breakdown: null,
  warnings: [],
  recommendations: [],
  total_candidates_considered: 0,
});

assert.throws(
  () => normalizeDecisionResponse({ success: true, result_status: "no_results", recommended_major: "Fake", confidence: null, score_breakdown: null, recommendations: [] }),
  /contradictory empty result/,
);
assert.throws(() => normalizeDecisionResponse({}), /unsuccessful result/);
assert.throws(
  () => normalizeDecisionResponse({ success: false, result_status: "no_results", recommended_major: null, confidence: null, score_breakdown: null, recommendations: [] }),
  /unsuccessful result/,
);
assert.throws(
  () => normalizeDecisionResponse({ success: true, result_status: "mystery", recommended_major: "Fake", recommendations: [] }),
  /unknown result status/,
);
assert.throws(
  () => normalizeDecisionResponse({ success: true, result_status: "ok", recommended_major: "Fake", recommendations: [] }),
  /omitted the recommended program/,
);
assert.throws(
  () => normalizeDecisionResponse({ success: true, result_status: "ok", recommended_major: "Fake", recommendations: [{ program_name: "Fake", score: "999" }] }),
  /malformed recommendation/,
);

assert.deepEqual(
  decisionFailureResponse(Object.assign(new Error("bad profile"), { code: "INVALID_REQUEST" })),
  {
    success: false,
    result_status: "invalid_request",
    error_code: "INVALID_REQUEST",
    message: "bad profile",
  },
);
assert.deepEqual(
  decisionFailureResponse(Object.assign(new Error("raw upstream body"), { code: "UPSTREAM_VALIDATION" })),
  {
    success: false,
    result_status: "invalid_request",
    error_code: "INVALID_REQUEST",
    message: "The decision request was rejected as invalid.",
  },
);
assert.deepEqual(decisionFailureResponse({ name: "AbortError" }), {
  success: false,
  result_status: "unavailable",
  error_code: "DECISION_TIMEOUT",
  message: "The decision service timed out.",
});
assert.deepEqual(decisionFailureResponse(new Error("contains upstream details")), {
  success: false,
  result_status: "unavailable",
  error_code: "DECISION_UNAVAILABLE",
  message: "The decision service is unavailable.",
});
assert.equal(buildCareerRoadmap({}, {}, {}), null);
assert.deepEqual(
  buildCareerRoadmap({}, {}, {
    career_roadmap: {
      target_roles: ["Verified role"],
      top_skills: ["Verified skill"],
      industry_demand: "Verified market statement",
    },
  }),
  {
    target_roles: ["Verified role"],
    top_skills: ["Verified skill"],
    industry_demand: "Verified market statement",
  },
);
assert.deepEqual(generateNextSteps("Artificial Intelligence"), []);
assert.deepEqual(generateNextSteps(["Verified next step"]), ["Verified next step"]);

assert.deepEqual(validatePayload(null, {}), {
  valid: false,
  error: "studentProfile and preferences must be non-null objects.",
});
assert.equal(validatePayload({ high_school_percentage: 101 }, { interests: [] }).valid, false);
assert.equal(validatePayload({ high_school_percentage: 85, budget: -1 }, { interests: [] }).valid, false);
assert.equal(validatePayload({ high_school_percentage: 85 }, { interests: [7] }).valid, false);
assert.deepEqual(validatePayload({ high_school_percentage: 85, budget: 0 }, { interests: ["AI"] }), { valid: true });

assert.equal(httpStatusForDecisionResult({ success: true, result_status: "no_results" }), 200);
assert.equal(httpStatusForDecisionResult({ success: false, result_status: "invalid_request" }), 400);
assert.equal(httpStatusForDecisionResult({ success: false, result_status: "unavailable", error_code: "DECISION_TIMEOUT" }), 504);
assert.equal(httpStatusForDecisionResult({ success: false, result_status: "unavailable" }), 503);
assert.equal(httpStatusForDecisionResult({ success: false }), 500);
assert.equal(httpStatusForDecisionResult({ success: true, result_status: "unavailable", error_code: "DECISION_TIMEOUT" }), 500);

const slowBodyFetch = async (_url, init) => ({
  ok: true,
  status: 200,
  json: () => new Promise((_resolve, reject) => {
    const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    if (init.signal.aborted) abort();
    else init.signal.addEventListener("abort", abort, { once: true });
  }),
});
await assert.rejects(
  requestDecisionApi({
    studentProfile: { high_school_percentage: 85 },
    preferences: { interests: ["AI"] },
    timeoutMs: 5,
    maxAttempts: 1,
    fetchImpl: slowBodyFetch,
    apiUrl: "http://decision.test",
    secretKey: "test-secret",
  }),
  error => error?.name === "AbortError",
);

let observedSecret = null;
await requestDecisionApi({
  studentProfile: { high_school_percentage: 85 },
  preferences: { interests: ["AI"] },
  timeoutMs: 100,
  maxAttempts: 1,
  fetchImpl: async (_url, init) => {
    observedSecret = init.headers["X-Internal-Secret"];
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  },
  apiUrl: "http://decision.test",
  secretKey: "contract-secret",
});
assert.equal(observedSecret, "contract-secret");

assert.deepEqual(
  toOrchestratorDecisionEvidence({
    success: true,
    result_status: "ok",
    recommended_major: "Artificial Intelligence",
    reason: "Verified upstream reason.",
    confidence: 88.25,
  }),
  {
    recommendation: "Recommended Major: Artificial Intelligence. Reason: Verified upstream reason.",
    confidence: 0.8825,
    factors: {
      success: true,
      result_status: "ok",
      recommended_major: "Artificial Intelligence",
      reason: "Verified upstream reason.",
      confidence: 88.25,
    },
  },
);
assert.equal(toOrchestratorDecisionEvidence({ success: true, result_status: "no_results" }), null);
assert.equal(
  toOrchestratorDecisionEvidence({
    success: true,
    result_status: "ok",
    recommended_major: null,
    confidence: null,
  }),
  null,
);

console.log("Decision truth contract tests passed.");
