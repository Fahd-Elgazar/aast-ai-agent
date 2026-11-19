import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GROUNDING_STATUS,
  verifyGroundedAnswer
} from "../services/groundingVerificationService.js";

const schema = JSON.parse(
  readFileSync(
    new URL("../../../evaluation/contracts/retrieval/grounding-result.schema.json", import.meta.url),
    "utf8"
  )
);

function graphEvidence(id, subject, subjectType, relation, object, objectType, text = "") {
  return {
    evidence: text || `${subject} ${relation} ${object}`,
    source_type: "KG",
    metadata: {
      evidence_id: id,
      evidence_subject: { id: null, name: subject, type: subjectType },
      evidence_relation: relation,
      evidence_object: { id: null, name: object, type: objectType }
    }
  };
}

function assertSchemaShape(result) {
  for (const key of schema.required) {
    assert.ok(key in result, `grounding result is missing '${key}'`);
  }
  assert.ok(schema.properties.status.enum.includes(result.status));
  for (const sentence of result.sentence_results) {
    for (const key of schema.properties.sentence_results.items.required) {
      assert.ok(key in sentence, `sentence result is missing '${key}'`);
    }
  }
}

const teachesNlp = graphEvidence(
  "exact:hany|teaches|nlp",
  "Hany Hanafy Mahmoud Said",
  "Professor",
  "TEACHES",
  "Natural Language Processing",
  "Course",
  "Hany Hanafy Mahmoud Said teaches the Natural Language Processing course."
);
const mlLinear = graphEvidence(
  "exact:ml|has_prerequisite|linear",
  "Machine Learning",
  "Course",
  "HAS_PREREQUISITE",
  "Linear Algebra",
  "Course",
  "Linear Algebra is a prerequisite for Machine Learning."
);
const mlFundamentals = graphEvidence(
  "exact:ml|has_prerequisite|fundamentals",
  "Machine Learning",
  "Course",
  "HAS_PREREQUISITE",
  "Fundamentals of AI",
  "Course",
  "Fundamentals of AI is a prerequisite for Machine Learning."
);

const exactTeaching = verifyGroundedAnswer({
  answer: "Hany Hanafy Mahmoud Said teaches Natural Language Processing.",
  evidence: [teachesNlp]
});
assert.equal(exactTeaching.status, GROUNDING_STATUS.FULLY_SUPPORTED);
assert.deepEqual(exactTeaching.evidence_ids, ["exact:hany|teaches|nlp"]);
assertSchemaShape(exactTeaching);

const prerequisiteParaphrase = verifyGroundedAnswer({
  answer: "Linear Algebra is required before taking Machine Learning.",
  evidence: [mlLinear]
});
assert.equal(prerequisiteParaphrase.status, GROUNDING_STATUS.FULLY_SUPPORTED);
assert.match(prerequisiteParaphrase.sentence_results[0].claim_types.join(","), /prerequisite/);

const completePrerequisiteList = verifyGroundedAnswer({
  answer: "Machine Learning requires Fundamentals of AI and Linear Algebra.",
  evidence: [mlLinear, mlFundamentals]
});
assert.equal(completePrerequisiteList.status, GROUNDING_STATUS.FULLY_SUPPORTED);
assert.deepEqual(
  new Set(completePrerequisiteList.evidence_ids),
  new Set([
    "exact:ml|has_prerequisite|linear",
    "exact:ml|has_prerequisite|fundamentals"
  ])
);

const wrongCourse = verifyGroundedAnswer({
  answer: "Block Chain requires Linear Algebra.",
  evidence: [mlLinear]
});
assert.equal(wrongCourse.status, GROUNDING_STATUS.UNSUPPORTED);
assert.equal(wrongCourse.grounded, false);

const unrelatedPolicy = verifyGroundedAnswer({
  answer: "Dormitory applications close in August.",
  evidence: [
    {
      evidence_id: "rag:grading",
      text: "AAST passing rules require a minimum total score of 50.",
      source: "RAG"
    }
  ]
});
assert.equal(unrelatedPolicy.status, GROUNDING_STATUS.UNSUPPORTED);

const exactNumberAndCode = verifyGroundedAnswer({
  answer: "Machine Learning, course code IN221, is a three-credit course.",
  evidence: [
    graphEvidence(
      "exact:is|has_course|ml",
      "Intelligent Systems",
      "Program",
      "HAS_COURSE",
      "Machine Learning",
      "Course",
      "Intelligent Systems includes Machine Learning (course code IN221, 3 credits)."
    )
  ]
});
assert.equal(exactNumberAndCode.status, GROUNDING_STATUS.FULLY_SUPPORTED);
assert.match(exactNumberAndCode.sentence_results[0].claim_types.join(","), /numeric/);
assert.match(exactNumberAndCode.sentence_results[0].claim_types.join(","), /course_code/);

const wrongNumber = verifyGroundedAnswer({
  answer: "Machine Learning, course code IN221, is a four-credit course.",
  evidence: [
    graphEvidence(
      "exact:is|has_course|ml",
      "Intelligent Systems",
      "Program",
      "HAS_COURSE",
      "Machine Learning",
      "Course",
      "Intelligent Systems includes Machine Learning (course code IN221, 3 credits)."
    )
  ]
});
assert.notEqual(wrongNumber.status, GROUNDING_STATUS.FULLY_SUPPORTED);
assert.equal(wrongNumber.grounded, false);

const unsupportedNegation = verifyGroundedAnswer({
  answer: "Machine Learning does not require Linear Algebra.",
  evidence: [mlLinear]
});
assert.notEqual(unsupportedNegation.status, GROUNDING_STATUS.FULLY_SUPPORTED);
assert.equal(unsupportedNegation.grounded, false);

const supportedLeadership = verifyGroundedAnswer({
  answer: "Ali Ali Mohamed Fahmy is the dean of the College of Artificial Intelligence.",
  evidence: [
    graphEvidence(
      "exact:ali|dean_of|college",
      "Ali Ali Mohamed Fahmy",
      "Person",
      "DEAN_OF",
      "College of Artificial Intelligence",
      "College",
      "Ali Ali Mohamed Fahmy serves as Dean for the College of Artificial Intelligence."
    )
  ]
});
assert.equal(supportedLeadership.status, GROUNDING_STATUS.FULLY_SUPPORTED);

const wrongLeadershipEntity = verifyGroundedAnswer({
  answer: "Ahmed Abdelkhalik Ahmed Abouelfarag is the dean of the College of Artificial Intelligence.",
  evidence: [
    graphEvidence(
      "exact:ali|dean_of|college",
      "Ali Ali Mohamed Fahmy",
      "Person",
      "DEAN_OF",
      "College of Artificial Intelligence",
      "College",
      "Ali Ali Mohamed Fahmy serves as Dean for the College of Artificial Intelligence."
    )
  ]
});
assert.equal(wrongLeadershipEntity.status, GROUNDING_STATUS.UNSUPPORTED);

const unsupportedDirectionalComparison = verifyGroundedAnswer({
  answer: "Intelligent Systems is better than Data Science.",
  evidence: [
    { evidence_id: "program:is", text: "Intelligent Systems is an Artificial Intelligence program.", source: "KG" },
    { evidence_id: "program:ds", text: "Data Science is a data and analytics program.", source: "KG" }
  ]
});
assert.notEqual(unsupportedDirectionalComparison.status, GROUNDING_STATUS.FULLY_SUPPORTED);
assert.equal(unsupportedDirectionalComparison.grounded, false);

const partialCompound = verifyGroundedAnswer({
  answer: "Hany Hanafy Mahmoud Said teaches Natural Language Processing and serves as dean of the college.",
  evidence: [teachesNlp]
});
assert.equal(partialCompound.status, GROUNDING_STATUS.PARTIALLY_SUPPORTED);
assert.equal(partialCompound.grounded, false);

const historyOnly = verifyGroundedAnswer({
  answer: "Hany Hanafy Mahmoud Said teaches Natural Language Processing.",
  evidence: [],
  conversationHistory: [
    { role: "assistant", content: "Hany Hanafy Mahmoud Said teaches Natural Language Processing." }
  ]
});
assert.equal(historyOnly.status, GROUNDING_STATUS.UNSUPPORTED);
assert.equal(historyOnly.conversation_history_used_as_evidence, false);
assert.equal(historyOnly.conversation_history_items_ignored, 1);

const nonfactual = verifyGroundedAnswer({
  answer: "Would you like me to explain the prerequisites?",
  evidence: []
});
assert.equal(nonfactual.status, GROUNDING_STATUS.NONFACTUAL);
assert.equal(nonfactual.grounded, true);

const conflicting = verifyGroundedAnswer({
  answer: "The minimum passing score is 50.",
  evidence: [
    {
      evidence_id: "policy:pass-a",
      text: "The minimum passing score is 50.",
      source: "RAG",
      conflict_group: "minimum_passing_score"
    },
    {
      evidence_id: "policy:pass-b",
      text: "The minimum passing score is 60.",
      source: "RAG",
      conflict_group: "minimum_passing_score"
    }
  ]
});
assert.equal(conflicting.status, GROUNDING_STATUS.CONFLICTING);
assert.equal(conflicting.grounded, false);

const repeatedStart = performance.now();
for (let index = 0; index < 100; index += 1) {
  verifyGroundedAnswer({
    answer: "Machine Learning requires Fundamentals of AI and Linear Algebra.",
    evidence: [mlLinear, mlFundamentals]
  });
}
const averageLatencyMs = (performance.now() - repeatedStart) / 100;
assert.ok(averageLatencyMs < 25, `average verifier latency ${averageLatencyMs.toFixed(3)}ms must stay below 25ms`);

console.log(
  `groundingVerification.test.js passed exact, paraphrase, list, wrong-entity, policy, numeric, negation, compound, history, conflict, and latency cases (${averageLatencyMs.toFixed(3)}ms average).`
);
