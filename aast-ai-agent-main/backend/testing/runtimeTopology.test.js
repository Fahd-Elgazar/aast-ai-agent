import assert from "node:assert/strict";
import fs from "node:fs";

import { normalizeAcademicQuery } from "../services/academicQueryNormalizer.js";
import brainRouter from "../services/brainRouter.js";
import {
  constrainSubsystemHealthForTopology,
  isRouteAllowedByTopology,
  resolveRuntimeTopology,
  runtimeTopologyContract,
} from "../config/runtimeTopology.js";


const HEALTHY = {
  kg: true,
  rag: true,
  decision: true,
  career: true,
  faq: true,
  llm: true,
};

function testContractShapeAndDefault() {
  assert.equal(runtimeTopologyContract.schema, 1);
  assert.equal(runtimeTopologyContract.defaultMode, "full");
  assert.equal(resolveRuntimeTopology({}).mode, "full");
  assert.equal(resolveRuntimeTopology({ AAST_LAUNCHER_MODE: "unknown" }).mode, "full");
}

function testQuickExplicitlyDisablesRagTopology() {
  const quick = resolveRuntimeTopology({ AAST_LAUNCHER_MODE: "quick" });
  assert.equal(quick.ragRoutesEnabled, false);
  assert.equal(quick.services.qdrant, "disabled");
  assert.equal(quick.services.ragRetriever, "disabled");
  assert.equal(quick.services.ragAnswer, "disabled");

  const health = constrainSubsystemHealthForTopology(HEALTHY, quick);
  assert.equal(health.kg, false);
  assert.equal(health.rag, false, "quick mode must mask even a stale healthy RAG listener");
  assert.equal(health.decision, false);
  assert.equal(health.llm, false);
  assert.equal(isRouteAllowedByTopology("RAG_ONLY", quick), false);
  assert.equal(isRouteAllowedByTopology("HYBRID_KG_RAG", quick), false);
  assert.equal(isRouteAllowedByTopology("KG_ONLY", quick), false);
  assert.equal(isRouteAllowedByTopology("DECISION_ENGINE", quick), false);
  assert.equal(isRouteAllowedByTopology("FAQ", quick), true);
}

function testDemoRequiresSearchCapableRagWithoutAnswerGenerator() {
  const demo = resolveRuntimeTopology({ AAST_LAUNCHER_MODE: "demo" });
  assert.equal(demo.ragRoutesEnabled, true);
  assert.equal(demo.services.qdrant, "required");
  assert.equal(demo.services.ragRetriever, "required");
  assert.equal(demo.services.ragAnswer, "disabled");
  assert.equal(constrainSubsystemHealthForTopology(HEALTHY, demo).rag, true);
}

function testFullRequiresRetrieverAndKeepsAnswerServiceOptional() {
  const full = resolveRuntimeTopology({ AAST_LAUNCHER_MODE: "full" });
  assert.equal(full.ragRoutesEnabled, true);
  assert.equal(full.services.qdrant, "required");
  assert.equal(full.services.ragRetriever, "required");
  assert.equal(full.services.ragAnswer, "optional");
}

function testRepresentativePolicyRouteMatchesModeAvailability() {
  const normalization = normalizeAcademicQuery("scholarship requirements");
  const analysis = brainRouter.analyzeQuery(
    { query: normalization.normalized, intent: "GENERAL", normalization },
    "GENERAL",
    { lastRoute: null }
  );

  const demo = resolveRuntimeTopology({ AAST_LAUNCHER_MODE: "demo" });
  const demoDecision = brainRouter.determineBestRoute(
    analysis,
    constrainSubsystemHealthForTopology(HEALTHY, demo)
  );
  assert.equal(demoDecision.route, "HYBRID_KG_RAG");
  assert.equal(isRouteAllowedByTopology(demoDecision.route, demo), true);

  const full = resolveRuntimeTopology({ AAST_LAUNCHER_MODE: "full" });
  const fullDecision = brainRouter.determineBestRoute(
    analysis,
    constrainSubsystemHealthForTopology(HEALTHY, full)
  );
  assert.equal(fullDecision.route, "HYBRID_KG_RAG");
  assert.equal(isRouteAllowedByTopology(fullDecision.route, full), true);

  const quick = resolveRuntimeTopology({ AAST_LAUNCHER_MODE: "quick" });
  const quickDecision = brainRouter.determineBestRoute(
    analysis,
    constrainSubsystemHealthForTopology(HEALTHY, quick)
  );
  assert.equal(isRouteAllowedByTopology(quickDecision.route, quick), true);
  assert.notEqual(quickDecision.route, "RAG_ONLY");
  assert.notEqual(quickDecision.route, "RAG_DIRECT");
  assert.notEqual(quickDecision.route, "HYBRID_KG_RAG");
}

function testRepresentativeQuickRouteMatrixNeverUsesDisabledRag() {
  const quick = resolveRuntimeTopology({ AAST_LAUNCHER_MODE: "quick" });
  const quickHealth = constrainSubsystemHealthForTopology(HEALTHY, quick);
  const queries = [
    "scholarship requirements",
    "Which major should I choose between AI and computer science?",
    "Who teaches machine learning?",
    "What are the admission rules?",
    "hello",
  ];

  for (const query of queries) {
    const normalization = normalizeAcademicQuery(query);
    const analysis = brainRouter.analyzeQuery(
      { query: normalization.normalized, intent: "GENERAL", normalization },
      "GENERAL",
      { lastRoute: null }
    );
    const decision = brainRouter.determineBestRoute(analysis, quickHealth);
    assert.equal(
      isRouteAllowedByTopology(decision.route, quick),
      true,
      `quick route '${decision.route}' is disabled for query '${query}'`
    );
    for (const fallback of decision.fallback_chain) {
      assert.equal(
        isRouteAllowedByTopology(fallback, quick),
        true,
        `quick fallback '${fallback}' is disabled for query '${query}'`
      );
    }
  }
}

function testLauncherConsumesSharedTopologyContract() {
  const launcherUrl = new URL("../../../launcher/start_platform.ps1", import.meta.url);
  const launcher = fs.readFileSync(launcherUrl, "utf8");
  assert.match(launcher, /runtimeTopology\.json/);
  assert.match(launcher, /ServiceContract\.qdrant/);
  assert.match(launcher, /ServiceContract\.ragRetriever/);
  assert.doesNotMatch(launcher, /if \(\$Mode -eq "full"\) \{\s*\$qdrantReady/);
}

const tests = [
  testContractShapeAndDefault,
  testQuickExplicitlyDisablesRagTopology,
  testDemoRequiresSearchCapableRagWithoutAnswerGenerator,
  testFullRequiresRetrieverAndKeepsAnswerServiceOptional,
  testRepresentativePolicyRouteMatchesModeAvailability,
  testRepresentativeQuickRouteMatrixNeverUsesDisabledRag,
  testLauncherConsumesSharedTopologyContract,
];

for (const test of tests) test();

console.log(`Runtime topology tests passed (${tests.length}/${tests.length}).`);
