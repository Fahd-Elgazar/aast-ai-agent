import assert from "node:assert/strict";
import brainRouter from "../services/brainRouter.js";
import { normalizeAcademicQuery } from "../services/academicQueryNormalizer.js";

const HEALTHY = {
  kg: true,
  rag: true,
  decision: true,
  career: true,
  faq: true,
  llm: true,
};

const ROUTE_GROUPS = {
  KG_DIRECT: "KG",
  KG_ONLY: "KG",
  RAG_DIRECT: "RAG",
  RAG_ONLY: "RAG",
  HYBRID_KG_RAG: "HYBRID",
  DECISION_ENGINE: "DECISION",
  CAREER_ENGINE: "CAREER",
  FAQ: "FAQ",
  LLM_FALLBACK: "LLM",
};

function routeQuery(rawQuery, intent = "GENERAL") {
  const normalization = normalizeAcademicQuery(rawQuery);
  const query = normalization.normalized || rawQuery;
  const analysis = brainRouter.analyzeQuery(
    { query, intent, normalization },
    intent,
    { lastRoute: null }
  );
  const decision = brainRouter.determineBestRoute(analysis, HEALTHY);

  return {
    rawQuery,
    query,
    normalization,
    analysis,
    decision,
    group: ROUTE_GROUPS[decision.route] || decision.route,
  };
}

const cases = [
  // Faculty/person hardening
  { query: "who teaches NLP", expectedGroup: "KG" },
  { query: "who is hany hanafy", expectedGroup: "KG", alias: "hany hanafy" },
  { query: "dr hany", expectedGroup: "KG", alias: "hany hanafy" },
  { query: "vice dean ai", expectedGroup: "KG", alias: "vice dean college of artificial intelligence" },
  { query: "dean computing", expectedGroup: "KG" },

  // Academic structural and policy intersections
  { query: "ML prerequisites", expectedGroup: "KG", alias: "machine learning" },
  { query: "blockchain prerequisites", expectedGroup: "KG" },
  { query: "scholarship requirements", expectedGroup: "HYBRID" },
  { query: "mobile computing GPA", expectedGroup: "HYBRID" },
  { query: "AI department fees", expectedGroup: "HYBRID" },

  // Complex planning / multi-domain
  { query: "Compare ML vs NLP tracks", expectedGroup: "HYBRID" },
  { query: "Scholarship + GPA + fees for AI department", expectedGroup: "HYBRID" },
  { query: "Decision support cases for scholarship GPA and fees", expectedGroup: "HYBRID" },

  // True LLM fallback
  { query: "write a short poem about finals", expectedGroup: "LLM" },
];

for (const item of cases) {
  const result = routeQuery(item.query, item.intent);

  assert.equal(
    result.group,
    item.expectedGroup,
    `${item.query} routed to ${result.decision.route}; expected group ${item.expectedGroup}`
  );

  assert.ok(
    result.decision.telemetry?.thresholds_used,
    `${item.query} missing threshold telemetry`
  );

  assert.ok(
    Array.isArray(result.decision.telemetry?.fallback_chain),
    `${item.query} missing fallback chain telemetry`
  );

  if (item.alias) {
    const aliasTargets = [
      ...result.normalization.corrections.map(correction => correction.to),
      ...(result.decision.telemetry.alias_expansions || []).map(alias => alias.canonical),
    ];

    assert.ok(
      aliasTargets.includes(item.alias),
      `${item.query} did not expose alias expansion for ${item.alias}`
    );
  }
}

console.log(`routingPrecisionCalibration.test.js passed ${cases.length} route calibration cases.`);
