import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  EXACT_ENTITY_REGISTRY,
  extractGoldenEntities,
  resolveExactEntities,
  resolveExactEntity,
} from "../config/goldenPathRegistry.js";
import {
  evaluateEmbeddingDiversity,
  shouldQuarantineSemanticRetrieval,
  vectorSignature,
} from "../services/kgEmbeddingReadiness.js";
import {
  alignEvidenceToTarget,
  buildEntityEvidence,
  expectedRelationsForIntent,
  expectedRelationsForQuery,
  normalizeEvidenceText,
  runExactEntitiesRetrieval,
  runExactEntityRetrieval,
  selectExactFactsForQuery,
  shouldStopAfterExactRelationMiss,
} from "../services/neo4jcontext.js";

const EVIDENCE_SCHEMA = JSON.parse(
  readFileSync(
    new URL("../../../evaluation/contracts/retrieval/entity-evidence.schema.json", import.meta.url),
    "utf8"
  )
);

// Minimal structural conformance check against the required keys declared by the
// entity-evidence JSON schema (avoids pulling in a full validator dependency).
function assertMatchesEvidenceSchema(evidence, label) {
  for (const key of EVIDENCE_SCHEMA.required) {
    assert.ok(key in evidence, `${label}: evidence missing required key '${key}'`);
  }
  for (const key of EVIDENCE_SCHEMA.definitions.entityRef.required) {
    assert.ok(key in evidence.subject, `${label}: subject missing '${key}'`);
    assert.ok(key in evidence.object, `${label}: object missing '${key}'`);
  }
  for (const key of EVIDENCE_SCHEMA.properties.normalized.required) {
    assert.ok(key in evidence.normalized, `${label}: normalized missing '${key}'`);
  }
  assert.ok(
    EVIDENCE_SCHEMA.properties.source.enum.includes(evidence.source),
    `${label}: source '${evidence.source}' not in schema enum`
  );
}

// Fake Neo4j record honouring the returnProjection() column contract.
function makeRecord(columns) {
  return { get: (key) => (key in columns ? columns[key] : null) };
}

function relationRecord({ subjectName, subjectLabel, subjectId, relType, objectName, objectLabel, objectId }) {
  return makeRecord({
    label: subjectLabel,
    name: subjectName,
    props: { id: subjectId, name: subjectName },
    relatedLabel: objectLabel,
    relatedName: objectName,
    relatedProps: { id: objectId, name: objectName },
    relType,
    relSourceName: subjectName,
    relSourceLabel: subjectLabel,
    relTargetName: objectName,
    relTargetLabel: objectLabel,
    score: 1.0,
    baseScore: 1.0,
    boostedScore: 1.0,
    relationRank: 0,
  });
}

function fakeSession(records) {
  return {
    run: async () => ({ records }),
  };
}

const ML_TARGET = resolveExactEntity("machine learning");
const NLP_TARGET = resolveExactEntity("nlp");

async function testExactResolutionByName() {
  const target = resolveExactEntity("what are the machine learning prerequisites");
  assert.ok(target, "machine learning must resolve to an exact entity");
  assert.equal(target.canonical_id, "COURSE_IN221");
  assert.equal(target.entity_type, "course");
}

async function testExactResolutionByCode() {
  const target = resolveExactEntity("prerequisites for IN221");
  assert.ok(target, "course code IN221 must resolve");
  assert.equal(target.canonical_id, "COURSE_IN221");
  assert.equal(target.matched_surface, "IN221");
}

async function testExactResolutionByAlias() {
  const target = resolveExactEntity("who teaches nlp");
  assert.ok(target, "alias 'nlp' must resolve");
  assert.equal(target.canonical_id, "COURSE_NATURAL_LANGUAGE_PROCESSING");

  const person = resolveExactEntity("what does dr hany teach");
  assert.ok(person, "alias 'dr hany' must resolve");
  assert.equal(person.canonical_id, "PROF_HANY_HANAFY_MAHMOUD_SAID");
}

async function testCalculusExactResolutionAndSafeRelationMiss() {
  const calculusOne = resolveExactEntity("What should I take after Calculus I?");
  const calculusTwo = resolveExactEntity("Is Calculus 2 available?");

  assert.equal(calculusOne?.canonical_id, "COURSE_CALCULUS_I");
  assert.equal(calculusTwo?.canonical_id, "COURSE_CALCULUS_II");
  assert.deepEqual(
    expectedRelationsForQuery("Which course follows Calculus I?", "GENERAL"),
    ["RECOMMENDED_AFTER"]
  );
  assert.deepEqual(
    expectedRelationsForQuery("What should I study after Calculus I?", "GENERAL"),
    ["RECOMMENDED_AFTER"]
  );
  assert.equal(shouldStopAfterExactRelationMiss({
    exactTargetCount: 1,
    expectedRelations: ["RECOMMENDED_AFTER"],
    alignedFactCount: 0
  }), true);
  assert.equal(shouldStopAfterExactRelationMiss({
    exactTargetCount: 1,
    expectedRelations: [],
    alignedFactCount: 0
  }), false, "identity-only questions may still use semantic fallback");
}

async function testMultiEntityResolutionPreservesQuestionOrder() {
  const targets = resolveExactEntities(
    "Compare Intelligent Systems and Data Science, then relate them to Machine Learning."
  );
  assert.deepEqual(
    targets.map(target => target.canonical_id),
    [
      "CAMPUS_EG_EL_ALAMEIN__COLLEGE_CAI_EL_ALAMEIN__PROGRAM_INTELLIGENT_SYSTEMS",
      "CAMPUS_EG_EL_ALAMEIN__COLLEGE_CAI_EL_ALAMEIN__PROGRAM_DATA_SCIENCE",
      "COURSE_IN221",
    ]
  );
}

async function testNormalizedBachelorProgramStillResolvesDegree() {
  const targets = resolveExactEntities(
    "Which bachelor's program does the College of Artificial Intelligence offer at El Alamein?"
  );
  assert.deepEqual(
    targets.map(target => target.canonical_id),
    [
      "DEGREE_EG_EL_ALAMEIN_CAI_BSC_UNDERGRAD",
      "COLLEGE_CAI_EL_ALAMEIN",
      "CAMPUS_EG_EL_ALAMEIN",
    ]
  );
}

async function testGoldenCareerEntityExtractionRejectsDescriptorPlaceholders() {
  const match = {
    id: "golden_dean_program_careers",
    category: "program_modules",
    entities: ["program career roles"]
  };
  assert.deepEqual(
    extractGoldenEntities(match, "What careers can the Intelligent Systems program lead to?"),
    ["Intelligent Systems"]
  );
}

async function testDeanConversationRelationInference() {
  assert.deepEqual(
    expectedRelationsForQuery("What careers can Intelligent Systems lead to?", "PROGRAM"),
    ["LEADS_TO", "CAREER_ALIGNMENT"]
  );
  assert.deepEqual(
    expectedRelationsForQuery("Which course is recommended after Machine Learning?", "GENERAL"),
    ["RECOMMENDED_AFTER"]
  );
  assert.deepEqual(
    expectedRelationsForQuery("Who is the dean of the college?", "ADMIN"),
    ["DEAN_OF"]
  );
  assert.deepEqual(
    expectedRelationsForQuery("Compare Intelligent Systems and Data Science.", "COMPARE"),
    ["HAS_COURSE"]
  );
  assert.deepEqual(
    expectedRelationsForQuery("Which bachelor's programs does the college offer?", "PROGRAM"),
    ["OFFERS", "INCLUDES_PROGRAM"]
  );
  assert.deepEqual(
    expectedRelationsForQuery(
      "Which of Intelligent Systems and Data Science includes Machine Learning?",
      "PROGRAM"
    ),
    ["HAS_COURSE"]
  );
}

async function testMissingExactTargetReturnsNull() {
  assert.equal(resolveExactEntity("what is quantum tunneling"), null);
  assert.equal(resolveExactEntity(""), null);
  assert.equal(resolveExactEntity(null), null);
  // 'ml' must match only as a whole token, never inside another word.
  assert.equal(resolveExactEntity("please compile this html file"), null);
}

async function testMachineLearningAndBlockchainDoNotCollide() {
  const ml = resolveExactEntity("machine learning");
  const blockchain = resolveExactEntity("blockchain");
  assert.equal(ml.canonical_id, "COURSE_IN221");
  assert.equal(blockchain.canonical_id, "COURSE_BLOCK_CHAIN");
  assert.notEqual(ml.canonical_id, blockchain.canonical_id);
  assert.equal(resolveExactEntity("machine learning").canonical_id !== blockchain.canonical_id, true);
}

async function testEvidenceCarriesNormalizedIdentityAndId() {
  const evidence = buildEntityEvidence({
    subject: "Hany Hanafy Mahmoud Said",
    subjectType: "Professor",
    subjectId: "PROF_HANY_HANAFY_MAHMOUD_SAID",
    relation: "TEACHES",
    object: "Natural Language Processing",
    objectType: "Course",
    objectId: "COURSE_NATURAL_LANGUAGE_PROCESSING",
    source: "exact",
  });

  assertMatchesEvidenceSchema(evidence, "exact-teaches");
  assert.equal(evidence.normalized.subject, "hanyhanafymahmoudsaid");
  assert.equal(evidence.normalized.relation, "TEACHES");
  assert.equal(evidence.normalized.object, "naturallanguageprocessing");
  assert.equal(evidence.entity_types.subject, "Professor");
  assert.equal(evidence.entity_types.object, "Course");
  assert.equal(evidence.subject.id, "PROF_HANY_HANAFY_MAHMOUD_SAID");
  // Evidence id is deterministic.
  const again = buildEntityEvidence({
    subject: "Hany Hanafy Mahmoud Said",
    relation: "TEACHES",
    object: "Natural Language Processing",
    source: "exact",
  });
  assert.equal(evidence.evidence_id, again.evidence_id);
}

async function testAlignmentRejectsWrongEntity() {
  // Evidence about Blockchain must never align to a Machine Learning target.
  const blockchainEvidence = buildEntityEvidence({
    subject: "Amira Elsaid",
    subjectType: "Professor",
    relation: "TEACHES",
    object: "Block Chain",
    objectType: "Course",
    source: "exact",
  });
  const verdict = alignEvidenceToTarget(blockchainEvidence, ML_TARGET, {
    expectedRelations: expectedRelationsForIntent("PREREQUISITE"),
  });
  assert.equal(verdict.aligned, false);
  assert.equal(verdict.reason, "TARGET_ABSENT");
}

async function testAlignmentRejectsWrongRelation() {
  // NLP is the requested target, but a teaching intent expects TEACHES.
  const prereqEvidence = buildEntityEvidence({
    subject: "Natural Language Processing",
    subjectType: "Course",
    relation: "HAS_PREREQUISITE",
    object: "Machine Learning",
    objectType: "Course",
    source: "exact",
  });
  const verdict = alignEvidenceToTarget(prereqEvidence, NLP_TARGET, {
    expectedRelations: expectedRelationsForIntent("TEACHING"),
  });
  assert.equal(verdict.aligned, false);
  assert.equal(verdict.reason, "RELATION_MISMATCH");
  assert.equal(verdict.matched_role, "subject");
}

async function testAlignmentAcceptsCorrectTargetAndRelation() {
  const evidence = buildEntityEvidence({
    subject: "Hany Hanafy Mahmoud Said",
    relation: "TEACHES",
    object: "Natural Language Processing",
    source: "exact",
  });
  const verdict = alignEvidenceToTarget(evidence, NLP_TARGET, {
    expectedRelations: expectedRelationsForIntent("TEACHING"),
  });
  assert.equal(verdict.aligned, true);
  assert.equal(verdict.matched_role, "object");

  // Identity by canonical id also aligns.
  const byId = buildEntityEvidence({
    subject: "Machine Learning",
    subjectId: "COURSE_IN221",
    relation: "HAS_PREREQUISITE",
    object: "Linear Algebra",
    source: "exact",
  });
  assert.equal(alignEvidenceToTarget(byId, ML_TARGET).aligned, true);
}

async function testExactRetrievalReturnsAlignedFactsOnly() {
  // Simulated exact lookup for Machine Learning prerequisites: two real prereqs
  // plus a stray Block Chain record that must be rejected by alignment.
  const records = [
    relationRecord({
      subjectName: "Machine Learning", subjectLabel: "Course", subjectId: "COURSE_IN221",
      relType: "HAS_PREREQUISITE",
      objectName: "Fundamentals of AI", objectLabel: "Course", objectId: "COURSE_FUNDAMENTALS_OF_AI",
    }),
    relationRecord({
      subjectName: "Machine Learning", subjectLabel: "Course", subjectId: "COURSE_IN221",
      relType: "HAS_PREREQUISITE",
      objectName: "Linear Algebra", objectLabel: "Course", objectId: "COURSE_LINEAR_ALGEBRA",
    }),
    relationRecord({
      subjectName: "Amira Elsaid", subjectLabel: "Professor", subjectId: "PROF_AMIRA_ELSAID",
      relType: "TEACHES",
      objectName: "Block Chain", objectLabel: "Course", objectId: "COURSE_BLOCK_CHAIN",
    }),
  ];

  const result = await runExactEntityRetrieval(fakeSession(records), ML_TARGET, {
    resultLimit: 10,
    expectedRelations: expectedRelationsForIntent("PREREQUISITE"),
  });

  assert.equal(result.recordCount, 3);
  assert.equal(result.rejected, 1, "the Block Chain record must be rejected");
  assert.equal(result.facts.length, 2);

  for (const fact of result.facts) {
    // Backward-compatible fact fields are preserved (AC7)...
    assert.equal(typeof fact.text, "string");
    assert.equal(fact.kind, "relation");
    assert.equal(fact.relType, "HAS_PREREQUISITE");
    assert.ok(fact.graph && fact.graph.source && fact.graph.target);
    // ...and additive evidence/alignment is attached (AC2/AC3).
    assertMatchesEvidenceSchema(fact.evidence, "ml-prereq");
    assert.equal(fact.evidence_alignment.aligned, true);
    // No Block Chain fact may survive (AC6).
    const normObject = normalizeEvidenceText(fact.relTargetName);
    const normSubject = normalizeEvidenceText(fact.relSourceName);
    assert.notEqual(normObject, "blockchain");
    assert.notEqual(normSubject, "blockchain");
    assert.ok(normSubject === "machinelearning" || normObject === "machinelearning");
  }
}

async function testMultiTargetRetrievalKeepsBothPrograms() {
  const intelligentSystems = resolveExactEntity("Intelligent Systems");
  const dataScience = resolveExactEntity("Data Science");
  const records = [
    relationRecord({
      subjectName: "Intelligent Systems", subjectLabel: "Program",
      subjectId: intelligentSystems.canonical_id, relType: "HAS_COURSE",
      objectName: "Machine Learning", objectLabel: "Course", objectId: "COURSE_IN221",
    }),
    relationRecord({
      subjectName: "Data Science", subjectLabel: "Program",
      subjectId: dataScience.canonical_id, relType: "HAS_COURSE",
      objectName: "Data Mining", objectLabel: "Course", objectId: "COURSE_DATA_MINING",
    }),
  ];

  const result = await runExactEntitiesRetrieval(
    fakeSession(records),
    [intelligentSystems, dataScience],
    { resultLimit: 50, expectedRelations: ["HAS_COURSE"] }
  );

  assert.equal(result.targetCount, 2);
  assert.equal(result.facts.length, 2);
  assert.deepEqual(
    new Set(result.facts.map(fact => fact.relSourceName)),
    new Set(["Intelligent Systems", "Data Science"])
  );
  for (const fact of result.facts) {
    assert.ok(fact.metadata.evidence_id);
    assert.equal(fact.metadata.evidence_relation, "HAS_COURSE");
  }
}

async function testRecommendedAfterUsesLanguageClueAndKeepsProgramEvidence() {
  const facts = [
    { text: "Computer Vision is recommended after Machine Learning.", relType: "RECOMMENDED_AFTER", relSourceName: "Computer Vision", relTargetName: "Machine Learning" },
    { text: "Natural Language Processing is recommended after Machine Learning.", relType: "RECOMMENDED_AFTER", relSourceName: "Natural Language Processing", relTargetName: "Machine Learning" },
    { text: "Intelligent Systems includes Natural Language Processing.", relType: "HAS_COURSE", relSourceName: "Intelligent Systems", relTargetName: "Natural Language Processing" },
  ];
  const selected = selectExactFactsForQuery(
    facts,
    "For language technology, what is recommended after Machine Learning?",
    "GENERAL",
    10
  );
  assert.deepEqual(
    selected.map(fact => `${fact.relType}:${fact.relSourceName}->${fact.relTargetName}`),
    [
      "RECOMMENDED_AFTER:Natural Language Processing->Machine Learning",
      "HAS_COURSE:Intelligent Systems->Natural Language Processing",
    ]
  );
}

async function testPrerequisiteSelectionRejectsReverseDependency() {
  const facts = [
    { text: "Machine Learning has prerequisite Fundamentals of AI.", relType: "HAS_PREREQUISITE", relSourceName: "Machine Learning", relTargetName: "Fundamentals of AI" },
    { text: "Machine Learning has prerequisite Linear Algebra.", relType: "HAS_PREREQUISITE", relSourceName: "Machine Learning", relTargetName: "Linear Algebra" },
    { text: "Deep Learning has prerequisite Machine Learning.", relType: "HAS_PREREQUISITE", relSourceName: "Deep Learning", relTargetName: "Machine Learning" },
  ];
  const selected = selectExactFactsForQuery(
    facts,
    "What are the prerequisites for Machine Learning?",
    "PREREQUISITE",
    10
  );
  assert.deepEqual(
    selected.map(fact => `${fact.relSourceName}->${fact.relTargetName}`),
    [
      "Machine Learning->Fundamentals of AI",
      "Machine Learning->Linear Algebra",
    ]
  );
}

async function testComparisonHighlightsAreBalancedAndGrounded() {
  const facts = [
    { text: "Intelligent Systems includes Machine Learning.", relType: "HAS_COURSE", relSourceName: "Intelligent Systems", relTargetName: "Machine Learning" },
    { text: "Intelligent Systems includes Computer Vision.", relType: "HAS_COURSE", relSourceName: "Intelligent Systems", relTargetName: "Computer Vision" },
    { text: "Data Science includes Fundamentals of Data Science.", relType: "HAS_COURSE", relSourceName: "Data Science", relTargetName: "Fundamentals of Data Science" },
    { text: "Data Science includes Big Data Analytics.", relType: "HAS_COURSE", relSourceName: "Data Science", relTargetName: "Big Data Analytics" },
  ];
  const selected = selectExactFactsForQuery(
    facts,
    "Compare Intelligent Systems and Data Science.",
    "COMPARE",
    10
  );
  assert.equal(selected.length, 4);
  assert.deepEqual(
    new Set(selected.map(fact => fact.relSourceName)),
    new Set(["Intelligent Systems", "Data Science"])
  );
}

async function testBesidesTeachingExcludesPreviouslyDiscussedCourse() {
  const facts = [
    { text: "Hany Hanafy Mahmoud Said teaches Natural Language Processing.", relType: "TEACHES", relSourceName: "Hany Hanafy Mahmoud Said", relTargetName: "Natural Language Processing" },
    { text: "Hany Hanafy Mahmoud Said teaches Cognitive Computing.", relType: "TEACHES", relSourceName: "Hany Hanafy Mahmoud Said", relTargetName: "Cognitive Computing" },
  ];
  const selected = selectExactFactsForQuery(
    facts,
    "Besides Natural Language Processing, what else does Hany Hanafy Mahmoud Said teach?",
    "TEACHING",
    10
  );
  assert.deepEqual(selected.map(fact => fact.relTargetName), ["Cognitive Computing"]);
}

async function testNamedCourseMembershipOutranksUnrequestedProgramCourses() {
  const facts = [
    { text: "Intelligent Systems includes Cognitive Computing.", relType: "HAS_COURSE", relSourceName: "Intelligent Systems", relTargetName: "Cognitive Computing" },
    { text: "Data Science includes Data Mining.", relType: "HAS_COURSE", relSourceName: "Data Science", relTargetName: "Data Mining" },
    { text: "Intelligent Systems includes Machine Learning.", relType: "HAS_COURSE", relSourceName: "Intelligent Systems", relTargetName: "Machine Learning" },
  ];
  const selected = selectExactFactsForQuery(
    facts,
    "Which of Intelligent Systems and Data Science includes Machine Learning?",
    "PROGRAM",
    10
  );
  assert.deepEqual(
    selected.map(fact => `${fact.relSourceName}:${fact.relTargetName}`),
    ["Intelligent Systems:Machine Learning"]
  );
}

async function testOtherRoleSelectsExactQualityUnitRelationship() {
  const facts = [
    { text: "Hany Hanafy Mahmoud Said heads Quality Unit.", relType: "HEAD_OF", relSourceName: "Hany Hanafy Mahmoud Said", relTargetName: "Quality Unit" },
    { text: "Hany Hanafy Mahmoud Said heads CAI Governance.", relType: "HEAD_OF", relSourceName: "Hany Hanafy Mahmoud Said", relTargetName: "CAI Governance" },
    { text: "Hany Hanafy Mahmoud Said serves as Head of Unit.", relType: "HAS_ROLE", relSourceName: "Hany Hanafy Mahmoud Said", relTargetName: "Head of Unit" },
  ];
  const selected = selectExactFactsForQuery(
    facts,
    "What other role does Hany Hanafy Mahmoud Said hold at the college?",
    "ADMIN",
    10
  );
  assert.deepEqual(
    selected.map(fact => `${fact.relType}:${fact.relTargetName}`),
    ["HEAD_OF:Quality Unit"]
  );
}

async function testEmbeddingDiversityInvalidForDegeneratePool() {
  // 91 embedded nodes collapsing to 4 vector signatures — the live-KG failure mode.
  const base = [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
    [0.7, 0.8, 0.9],
    [0.11, 0.22, 0.33],
  ];
  const degenerate = Array.from({ length: 91 }, (_, i) => base[i % base.length].slice());
  const diagnosis = evaluateEmbeddingDiversity(degenerate);
  assert.equal(diagnosis.nodeCount, 91);
  assert.equal(diagnosis.distinctSignatures, 4);
  assert.equal(diagnosis.valid, false);
  assert.equal(diagnosis.reason, "LOW_DIVERSITY");
}

async function testEmbeddingDiversityDuplicateAndEmptyAndHealthy() {
  const duplicates = Array.from({ length: 20 }, () => [0.5, 0.5, 0.5]);
  assert.equal(evaluateEmbeddingDiversity(duplicates).valid, false);

  const empty = evaluateEmbeddingDiversity([]);
  assert.equal(empty.valid, false);
  assert.equal(empty.reason, "NO_VECTORS");

  const healthy = Array.from({ length: 40 }, (_, i) => [i, i + 1, i + 2]);
  const healthyDiagnosis = evaluateEmbeddingDiversity(healthy);
  assert.equal(healthyDiagnosis.valid, true);
  assert.equal(healthyDiagnosis.distinctSignatures, 40);

  assert.notEqual(vectorSignature([0.1, 0.2]), vectorSignature([0.1, 0.3]));
}

async function testSemanticFallbackQuarantinePolicy() {
  const invalid = evaluateEmbeddingDiversity([]);
  const valid = evaluateEmbeddingDiversity(Array.from({ length: 30 }, (_, i) => [i, i * 2, i * 3]));

  // Exact intent + degenerate embeddings => semantic retrieval quarantined.
  assert.equal(shouldQuarantineSemanticRetrieval({ isExactIntent: true, diversity: invalid }), true);
  // Exact intent + healthy embeddings => bounded fallback still allowed.
  assert.equal(shouldQuarantineSemanticRetrieval({ isExactIntent: true, diversity: valid }), false);
  // Non-exact target => vector retrieval always remains available.
  assert.equal(shouldQuarantineSemanticRetrieval({ isExactIntent: false, diversity: invalid }), false);
  // No diversity signal => backward-compatible (never quarantines).
  assert.equal(shouldQuarantineSemanticRetrieval({ isExactIntent: true, diversity: null }), false);
}

async function testRegistryIntegrity() {
  const ids = new Set();
  for (const entity of EXACT_ENTITY_REGISTRY) {
    assert.ok(entity.canonical_id, "each entity needs a canonical_id");
    assert.ok(!ids.has(entity.canonical_id), `duplicate canonical_id ${entity.canonical_id}`);
    ids.add(entity.canonical_id);
    assert.ok(Array.isArray(entity.aliases));
  }
}

const tests = [
  testExactResolutionByName,
  testExactResolutionByCode,
  testExactResolutionByAlias,
  testCalculusExactResolutionAndSafeRelationMiss,
  testMultiEntityResolutionPreservesQuestionOrder,
  testNormalizedBachelorProgramStillResolvesDegree,
  testGoldenCareerEntityExtractionRejectsDescriptorPlaceholders,
  testDeanConversationRelationInference,
  testMissingExactTargetReturnsNull,
  testMachineLearningAndBlockchainDoNotCollide,
  testEvidenceCarriesNormalizedIdentityAndId,
  testAlignmentRejectsWrongEntity,
  testAlignmentRejectsWrongRelation,
  testAlignmentAcceptsCorrectTargetAndRelation,
  testExactRetrievalReturnsAlignedFactsOnly,
  testMultiTargetRetrievalKeepsBothPrograms,
  testRecommendedAfterUsesLanguageClueAndKeepsProgramEvidence,
  testPrerequisiteSelectionRejectsReverseDependency,
  testComparisonHighlightsAreBalancedAndGrounded,
  testBesidesTeachingExcludesPreviouslyDiscussedCourse,
  testNamedCourseMembershipOutranksUnrequestedProgramCourses,
  testOtherRoleSelectsExactQualityUnitRelationship,
  testEmbeddingDiversityInvalidForDegeneratePool,
  testEmbeddingDiversityDuplicateAndEmptyAndHealthy,
  testSemanticFallbackQuarantinePolicy,
  testRegistryIntegrity,
];

export { tests as retrievalEntityAlignmentTests };

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  // Importing neo4jcontext.js transitively starts ollamaService's background model
  // failover manager. These are pure, synchronous assertions that do not need it, so
  // exit explicitly once they pass to avoid a lingering (Ollama-dependent) event loop.
  try {
    for (const test of tests) {
      await test();
    }
    console.log(`Retrieval entity-alignment tests passed (${tests.length}/${tests.length}).`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
