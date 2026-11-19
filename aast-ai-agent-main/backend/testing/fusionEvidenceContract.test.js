import assert from "node:assert/strict";
import test from "node:test";

import fusionService from "../services/fusionService.js";
import {
  ROUTE_TYPES,
  buildExplainabilitySources,
  buildReasoning,
  createResult,
  normalizeExplainabilityRoute,
  resolveRouteType,
} from "../services/unifiedAnswerService.js";

test("direct route aliases retain the correct Unified Answer evidence policy", () => {
  assert.equal(resolveRouteType("KG_DIRECT"), ROUTE_TYPES.KG_ONLY);
  assert.equal(resolveRouteType("RAG_DIRECT"), ROUTE_TYPES.RAG_ONLY);
  assert.equal(normalizeExplainabilityRoute("KG_DIRECT"), "KG_DIRECT");
  assert.equal(normalizeExplainabilityRoute("RAG_DIRECT"), "RAG_DIRECT");
  assert.equal(normalizeExplainabilityRoute(ROUTE_TYPES.KG_ONLY), "KG");
  assert.equal(normalizeExplainabilityRoute(ROUTE_TYPES.RAG_ONLY), "RAG");
  assert.equal(normalizeExplainabilityRoute(ROUTE_TYPES.FAQ_ONLY), "FAQ");
  assert.deepEqual(
    buildExplainabilitySources("KG_DIRECT", { kg: true }),
    ["KG_DIRECT"],
  );
  assert.deepEqual(
    buildExplainabilitySources("RAG_DIRECT", { rag: true }),
    ["RAG_DIRECT"],
  );
  assert.match(buildReasoning({
    responseRoute: "KG_DIRECT",
    sources_used: { kg: true },
    normalizedConfidence: 0.8,
    missingInformation: [],
  }), /knowledge-graph evidence/i);
});

test("Unified Answer preserves a requested direct route and evidence confidence", () => {
  const result = createResult({
    answer: "Calculus I has course code BA103.",
    route: ROUTE_TYPES.KG_ONLY,
    requestedRoute: "KG_DIRECT",
    confidence: 0.82,
    sources_used: { faq: false, kg: true, rag: false, decision: false },
    latency_ms: 5,
    sanitized: false,
    query: "What is the code for Calculus I?",
    neo4jContext: [{
      evidence_id: "course-ba103",
      evidence: "Calculus I has course code BA103.",
      confidence: 0.82,
      source: "CURRICULUM_KG",
    }],
  });

  assert.equal(result.route, "KG_DIRECT");
  assert.equal(result.confidence, 0.82);
  assert.deepEqual(result.sources, ["KG_DIRECT"]);
  assert.match(result.reasoning, /knowledge-graph evidence/i);
});

test("Fusion reads orchestrator KG evidence without serializing the envelope", () => {
  const evidence = fusionService.processKGResults([{
    evidence: "Calculus I has course code BA103.",
    confidence: 0.82,
    metadata: { source: "CURRICULUM_KG", evidence_id: "course-ba103" },
  }]);

  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].evidence, "Calculus I has course code BA103.");
  assert.equal(evidence[0].confidence, 0.82);
  assert.equal(evidence[0].citations[0].evidence_id, "course-ba103");
  assert.equal(evidence[0].citations[0].excerpt, evidence[0].evidence);
});

test("Fusion flattens the orchestrator RAG result envelope and preserves sources", () => {
  const evidence = fusionService.processRAGResults({
    confidence: 0.73,
    results: [{
      content: "Registration closes on the date published by the academy.",
      score: 0.81,
      metadata: {
        doc_id: "registration-policy",
        source_file: "registration.pdf",
        category: "registration",
      },
    }],
  });

  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].confidence, 0.81);
  assert.match(evidence[0].evidence, /Registration closes/);
  assert.equal(evidence[0].citations[0].source, "registration.pdf");
  assert.equal(evidence[0].citations[0].category, "registration");
  assert.equal(evidence[0].citations[0].excerpt, evidence[0].evidence);
});

test("Fusion preserves top-level RAG provenance from the live adapter shape", () => {
  const evidence = fusionService.processRAGResults({
    results: [{
      id: "registration-policy-1",
      content: "Students must follow the published registration deadline.",
      score: 0.84,
      source: "registration.pdf",
      title: "Registration Policy",
      category: "registration",
    }],
  });

  assert.equal(evidence[0].citations[0].evidence_id, "registration-policy-1");
  assert.equal(evidence[0].citations[0].source, "registration.pdf");
  assert.equal(evidence[0].citations[0].title, "Registration Policy");
  assert.equal(evidence[0].citations[0].category, "registration");
});

test("Fusion fallback citation IDs differ for unrelated positional evidence", () => {
  const first = fusionService.processKGResults([{ evidence: "Course A has code A101." }]);
  const second = fusionService.processKGResults([{ evidence: "Course B has code B202." }]);
  assert.notEqual(first[0].citations[0].evidence_id, second[0].citations[0].evidence_id);
});

test("Fusion rejects empty KG and RAG envelopes instead of counting fake evidence", () => {
  assert.deepEqual(fusionService.processKGResults([{ confidence: 0.9 }]), []);
  assert.deepEqual(fusionService.processRAGResults({ results: [], confidence: 0.9 }), []);
});

test("Fusion reports empty evidence as a truthful failure rather than success", async () => {
  const before = fusionService.getMetrics().successful_fusions;
  const result = await fusionService.fuse(
    "What is the registration deadline?",
    { route: "RAG_ONLY", confidence: 0.8 },
    { rag: { results: [] } },
  );

  assert.equal(result.route_used, "LLM_FALLBACK");
  assert.equal(result.confidence, 0.1);
  assert.equal(result.metadata.evidence_absent, true);
  assert.deepEqual(result.citations, []);
  assert.equal(fusionService.getMetrics().successful_fusions, before);
});

test("Decision fallback evidence emits formatter-compatible provenance", async () => {
  const result = await fusionService.fuse(
    "Which program fits?",
    { route: "DECISION_ENGINE", confidence: 0.8 },
    { decision: [{ recommendation: "Verified upstream recommendation.", confidence: 0.8 }] },
  );

  assert.equal(result.citations.length, 1);
  assert.match(result.citations[0].source, /Decision Engine/);
  assert.equal(result.citations[0].excerpt, "Verified upstream recommendation.");
});
