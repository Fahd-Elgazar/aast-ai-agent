import assert from "node:assert/strict";
import brainRouter from "../services/brainRouter.js";
import { normalizeAcademicQuery } from "../services/academicQueryNormalizer.js";
import { classifyGoldenQuery, normalizeGraphSequenceQuestion } from "../config/goldenPathRegistry.js";

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

const explicitGraphSequence = "Does the graph recommend Computer Vision after Machine Learning?";
assert.equal(normalizeGraphSequenceQuestion(explicitGraphSequence), "Is Computer Vision recommended after Machine Learning?");
assert.equal(classifyGoldenQuery(explicitGraphSequence)?.id, "golden_dean_course_sequence");
assert.equal(classifyGoldenQuery("Which major should I choose?")?.id, "golden_best_major");

const cases = [
  // Dean WOW deterministic conversation and standalone bank
  { query: "Which bachelor's programs does the College of Artificial Intelligence offer at El Alamein?", intent: "PROGRAM", expectedGroup: "KG", goldenId: "golden_dean_program_offerings", forbiddenOntologyIntent: "CAMPUS", minGoldenTimeoutMs: 8000 },
  { query: "What two programs are included in the Bachelor of Science offered by the College of Artificial Intelligence at El Alamein?", expectedGroup: "KG", goldenId: "golden_dean_program_offerings", minGoldenTimeoutMs: 8000 },
  { query: "Compare Intelligent Systems with Data Science for a student choosing between building AI systems and working deeply with data.", expectedGroup: "KG", goldenId: "golden_dean_program_comparison", minGoldenTimeoutMs: 8000 },
  { query: "What career roles can the Intelligent Systems program lead to?", expectedGroup: "KG", goldenId: "golden_dean_program_careers" },
  { query: "List all career roles shown for Data Science.", expectedGroup: "KG", goldenId: "golden_dean_program_careers" },
  { query: "Which program includes Machine Learning, and what are its course code and credits?", expectedGroup: "KG", goldenId: "golden_dean_machine_learning_membership" },
  { query: "Which of Intelligent Systems and Data Science includes Machine Learning?", expectedGroup: "KG", goldenId: "golden_dean_machine_learning_membership" },
  { query: "Which course is recommended after Machine Learning for language technology?", expectedGroup: "KG", goldenId: "golden_dean_course_sequence" },
  { query: "Which career role is Cognitive Computing aligned with?", expectedGroup: "KG", goldenId: "golden_dean_course_career_alignment" },
  { query: "What other role does Hany Hanafy Mahmoud Said hold at the college?", expectedGroup: "KG", goldenId: "golden_dean_hany_role" },
  { query: "Is Ali Ali Mohamed Fahmy the dean of the College of Artificial Intelligence?", expectedGroup: "KG", goldenId: "golden_dean_ali_role" },

  // Faculty/person hardening
  { query: "who teaches NLP", expectedGroup: "KG", goldenId: "golden_hany_teaches" },
  { query: "who is hany hanafy", expectedGroup: "KG", alias: "hany hanafy", goldenId: "golden_hany_profile" },
  { query: "What does Hany Hanafy teach?", expectedGroup: "KG", goldenId: "golden_hany_teaches" },
  { query: "dr hany", expectedGroup: "KG", alias: "hany hanafy", goldenId: "golden_hany_profile" },
  { query: "vice dean ai", expectedGroup: "KG", alias: "vice dean college of artificial intelligence", goldenId: "golden_vice_dean_ai" },
  { query: "dean computing", expectedGroup: "KG" },
  { query: "Who is head of quality unit?", expectedGroup: "KG", goldenId: "golden_head_quality_unit" },
  { query: "Who is the dean of artificial intelligence?", expectedGroup: "KG", goldenId: "golden_dean_department" },

  // Academic structural and policy intersections
  { query: "ML prerequisites", expectedGroup: "KG", alias: "machine learning" },
  { query: "blockchain prerequisites", expectedGroup: "KG" },
  { query: "What are AI prerequisites?", expectedGroup: "KG", goldenId: "golden_ai_prerequisites" },
  { query: "What should I take after Calculus I?", expectedGroup: "KG" },
  { query: "What comes after Calculus I?", expectedGroup: "KG" },
  { query: "Which course follows Calculus I?", expectedGroup: "KG" },
  { query: "What should I study after Calculus I?", expectedGroup: "KG" },
  { query: "Modules in AI major", expectedGroup: "KG", goldenId: "golden_modules_major" },
  { query: "What specializations exist in AI?", intent: "PROGRAM", expectedGroup: "KG", ontologyIntent: "TRACK" },
  { query: "scholarship requirements", expectedGroup: "HYBRID" },
  { query: "mobile computing GPA", expectedGroup: "HYBRID" },
  { query: "AI department fees", expectedGroup: "HYBRID" },

  // Complex planning / multi-domain
  { query: "Compare ML vs NLP tracks", expectedGroup: "HYBRID" },
  { query: "Compare AI vs Cybersecurity", expectedGroup: "DECISION", goldenId: "golden_ai_vs_cybersecurity" },
  { query: "Recommend best major", expectedGroup: "DECISION", goldenId: "golden_best_major" },
  { query: "Career roadmap for AI", expectedGroup: "CAREER", goldenId: "golden_ai_career_roadmap" },
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

  if (item.ontologyIntent) {
    assert.equal(
      result.analysis.routing_features?.ontology_intent,
      item.ontologyIntent,
      `${item.query} did not preserve ontology intent ${item.ontologyIntent}`
    );
  }

  if (item.forbiddenOntologyIntent) {
    assert.notEqual(
      result.analysis.routing_features?.ontology_intent,
      item.forbiddenOntologyIntent,
      `${item.query} incorrectly replaced ${item.intent} intent with ${item.forbiddenOntologyIntent}`
    );
  }

  if (item.goldenId) {
    const golden = classifyGoldenQuery(result.query);
    assert.equal(
      golden?.id,
      item.goldenId,
      `${item.query} did not match expected golden registry id ${item.goldenId}`
    );

    assert.equal(
      result.decision.golden_path?.id,
      item.goldenId,
      `${item.query} did not expose golden path decision metadata`
    );

    if (item.minGoldenTimeoutMs) {
      assert.ok(
        golden.timeoutMs >= item.minGoldenTimeoutMs,
        `${item.query} golden timeout ${golden.timeoutMs}ms is below ${item.minGoldenTimeoutMs}ms`
      );
    }
  }
}

console.log(`routingPrecisionCalibration.test.js passed ${cases.length} route calibration cases.`);
