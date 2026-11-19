import assert from "node:assert/strict";

import {
  MAX_KG_FACTS,
  evaluateAnswerCoverage,
  finalizeGroundedAnswer,
  recomposeAnswerFromEvidence
} from "../services/unifiedAnswerService.js";
import {
  applyGroundedConversationalExpansion,
  humanizeGroundedAnswer
} from "../services/conversationalHumanizer.js";
import responseFormatter from "../services/responseFormatter.js";

function evidence(id, subject, subjectType, relation, object, objectType, text = "") {
  return {
    evidence: text || `${subject} ${relation} ${object}`,
    confidence: 0.99,
    source_type: "KG",
    metadata: {
      evidence_id: id,
      evidence_subject: { name: subject, type: subjectType },
      evidence_relation: relation,
      evidence_object: { name: object, type: objectType },
      source: "KnowledgeGraph"
    }
  };
}

const intelligentSystemsId = "CAMPUS_EG_EL_ALAMEIN__COLLEGE_CAI_EL_ALAMEIN__PROGRAM_INTELLIGENT_SYSTEMS";
const dataScienceId = "CAMPUS_EG_EL_ALAMEIN__COLLEGE_CAI_EL_ALAMEIN__PROGRAM_DATA_SCIENCE";

const programEvidence = [
  evidence(
    "exact:college|offers|bsc",
    "College of Artificial Intelligence",
    "College",
    "OFFERS",
    "Bachelor of Science",
    "Degree"
  ),
  evidence(
    `exact:bsc|includes_program|${intelligentSystemsId}`,
    "Bachelor of Science",
    "Degree",
    "INCLUDES_PROGRAM",
    "Intelligent Systems",
    "Program",
    "Bachelor of Science includes the Intelligent Systems program (4-year, BSc, discipline: Artificial Intelligence)."
  ),
  evidence(
    `exact:bsc|includes_program|${dataScienceId}`,
    "Bachelor of Science",
    "Degree",
    "INCLUDES_PROGRAM",
    "Data Science",
    "Program",
    "Bachelor of Science includes the Data Science program (4-year, BSc, discipline: Data Science)."
  )
];

const comparisonCourses = {
  "Intelligent Systems": [
    "Machine Learning",
    "Deep Learning",
    "Natural Language Processing",
    "Computer Vision",
    "Computing Algorithms"
  ],
  "Data Science": [
    "Fundamentals of Data Science",
    "Statistics for Data Science",
    "Data Mining",
    "Big Data Analytics",
    "Database Systems Design",
    "Information Retrieval & Search Engines"
  ]
};
const comparisonEvidence = Object.entries(comparisonCourses).flatMap(([program, courses]) =>
  courses.map((course, index) =>
    evidence(
      `exact:${program}|has_course|${index + 1}`,
      program,
      "Program",
      "HAS_COURSE",
      course,
      "Course",
      `${program} includes the ${course} course.`
    )
  )
);

const intelligentCareers = [
  "AI Engineer",
  "Machine Learning Engineer",
  "Robotics Engineer",
  "Research Engineer"
].map((role, index) =>
  evidence(`exact:is|leads_to|${index + 1}`, "Intelligent Systems", "Program", "LEADS_TO", role, "CareerRole")
);
const dataCareers = [
  "Data Scientist",
  "Data Analyst",
  "Business Intelligence Engineer",
  "Big Data Engineer"
].map((role, index) =>
  evidence(`exact:ds|leads_to|${index + 1}`, "Data Science", "Program", "LEADS_TO", role, "CareerRole")
);

const mlMembership = [
  evidence(
    "exact:is|has_course|ml",
    "Intelligent Systems",
    "Program",
    "HAS_COURSE",
    "Machine Learning",
    "Course",
    "Intelligent Systems includes the Machine Learning course (course code IN221, 3 credits)."
  )
];
const prerequisites = [
  evidence(
    "exact:ml|has_prerequisite|fundamentals",
    "Machine Learning",
    "Course",
    "HAS_PREREQUISITE",
    "Fundamentals of AI",
    "Course"
  ),
  evidence(
    "exact:ml|has_prerequisite|linear",
    "Machine Learning",
    "Course",
    "HAS_PREREQUISITE",
    "Linear Algebra",
    "Course"
  )
];
const sequence = [
  evidence(
    "exact:nlp|recommended_after|ml",
    "Natural Language Processing",
    "Course",
    "RECOMMENDED_AFTER",
    "Machine Learning",
    "Course"
  ),
  evidence(
    "exact:is|has_course|nlp",
    "Intelligent Systems",
    "Program",
    "HAS_COURSE",
    "Natural Language Processing",
    "Course"
  )
];
const teachesNlp = [
  evidence(
    "exact:hany|teaches|nlp",
    "Hany Hanafy Mahmoud Said",
    "Professor",
    "TEACHES",
    "Natural Language Processing",
    "Course"
  )
];
const teachesCognitive = [
  evidence(
    "exact:hany|teaches|cognitive",
    "Hany Hanafy Mahmoud Said",
    "Professor",
    "TEACHES",
    "Cognitive Computing",
    "Course"
  )
];
const qualityRole = [
  evidence(
    "exact:hany|head_of|quality",
    "Hany Hanafy Mahmoud Said",
    "Professor",
    "HEAD_OF",
    "Quality Unit",
    "Unit"
  )
];
const dean = [
  evidence(
    "exact:ali|dean_of|college",
    "Ali Ali Mohamed Fahmy",
    "Person",
    "DEAN_OF",
    "College of Artificial Intelligence",
    "College"
  )
];

assert.equal(MAX_KG_FACTS, 16, "complete dean lists must not be truncated to three KG facts");

const turnCases = [
  {
    turn: 1,
    query: "Which bachelor's programs does the College of Artificial Intelligence offer?",
    evidence: programEvidence,
    checkpoints: ["College of Artificial Intelligence", "Bachelor of Science", "Intelligent Systems", "Data Science"]
  },
  {
    turn: 2,
    query: "Compare Intelligent Systems and Data Science.",
    evidence: comparisonEvidence,
    checkpoints: Object.values(comparisonCourses).flat()
  },
  {
    turn: 3,
    query: "What careers can Intelligent Systems lead to?",
    evidence: intelligentCareers,
    checkpoints: intelligentCareers.map(item => item.metadata.evidence_object.name)
  },
  {
    turn: 4,
    query: "What careers can Data Science lead to?",
    evidence: dataCareers,
    checkpoints: dataCareers.map(item => item.metadata.evidence_object.name)
  },
  {
    turn: 5,
    query: "Which of those programs includes Machine Learning?",
    evidence: mlMembership,
    checkpoints: ["Intelligent Systems", "Machine Learning", "IN221", "3"]
  },
  {
    turn: 6,
    query: "What are the prerequisites for Machine Learning?",
    evidence: prerequisites,
    checkpoints: ["Machine Learning", "Fundamentals of AI", "Linear Algebra"]
  },
  {
    turn: 7,
    query: "Which course is recommended after Machine Learning for language technology?",
    evidence: sequence,
    checkpoints: ["Natural Language Processing", "Machine Learning", "Intelligent Systems"]
  },
  {
    turn: 8,
    query: "Who teaches Natural Language Processing?",
    evidence: teachesNlp,
    checkpoints: ["Hany Hanafy Mahmoud Said", "Natural Language Processing"]
  },
  {
    turn: 9,
    query: "Besides Natural Language Processing, what else does Hany Hanafy Mahmoud Said teach?",
    evidence: teachesCognitive,
    checkpoints: ["Hany Hanafy Mahmoud Said", "Cognitive Computing"]
  },
  {
    turn: 10,
    query: "What other role does Hany Hanafy Mahmoud Said hold at the college?",
    evidence: qualityRole,
    checkpoints: ["Hany Hanafy Mahmoud Said", "Quality Unit"]
  },
  {
    turn: 11,
    query: "Who is the dean of the college?",
    evidence: dean,
    checkpoints: ["Ali Ali Mohamed Fahmy", "College of Artificial Intelligence"]
  }
];

for (const testCase of turnCases) {
  const answer = recomposeAnswerFromEvidence(testCase.query, testCase.evidence);
  const finalized = finalizeGroundedAnswer({
    query: testCase.query,
    answer,
    evidence: testCase.evidence
  });
  assert.equal(
    finalized.grounding.status,
    "fully_supported",
    `turn ${testCase.turn} must be fully grounded`
  );
  assert.equal(finalized.coverage.complete, true, `turn ${testCase.turn} must be complete`);
  for (const checkpoint of testCase.checkpoints) {
    assert.match(
      finalized.answer,
      new RegExp(String(checkpoint).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      `turn ${testCase.turn} must contain '${checkpoint}'`
    );
  }
  assert.ok(finalized.citations.length > 0, `turn ${testCase.turn} must preserve citations`);
}

const incompletePrerequisite = finalizeGroundedAnswer({
  query: "What are the prerequisites for Machine Learning?",
  answer: "Machine Learning requires Linear Algebra.",
  evidence: prerequisites
});
assert.equal(incompletePrerequisite.recomposed, true);
assert.match(incompletePrerequisite.answer, /Fundamentals of AI/);
assert.match(incompletePrerequisite.answer, /Linear Algebra/);

const unsupportedSentence = finalizeGroundedAnswer({
  query: "Who teaches Natural Language Processing?",
  answer: "Hany Hanafy Mahmoud Said teaches Natural Language Processing. He won an international award.",
  evidence: teachesNlp
});
assert.doesNotMatch(unsupportedSentence.answer, /international award/i);
assert.equal(unsupportedSentence.grounding.status, "fully_supported");

const coverage = evaluateAnswerCoverage(
  "What careers can Intelligent Systems lead to?",
  "Intelligent Systems can lead to AI Engineer.",
  intelligentCareers
);
assert.equal(coverage.complete, false);
assert.deepEqual(
  new Set(coverage.missing_objects),
  new Set(["Machine Learning Engineer", "Robotics Engineer", "Research Engineer"])
);

const careerRaw = intelligentCareers
  .map(item => `Intelligent Systems leads to ${item.metadata.evidence_object.name}.`)
  .join("\n");
const careerHumanized = applyGroundedConversationalExpansion({
  query: "What careers can Intelligent Systems lead to?",
  groundedAnswer: careerRaw,
  route: "KG_DIRECT"
});
assert.equal(
  careerHumanized.answer,
  "Intelligent Systems can lead to AI Engineer, Machine Learning Engineer, Robotics Engineer, and Research Engineer roles."
);

const programRaw = [
  "College of Artificial Intelligence offers Bachelor of Science.",
  ...programEvidence.slice(1).map(item => item.evidence)
].join("\n");
const programHumanized = applyGroundedConversationalExpansion({
  query: "Which bachelor's programs does the College of Artificial Intelligence offer?",
  groundedAnswer: programRaw,
  route: "KG_DIRECT"
});
assert.match(programHumanized.answer, /Intelligent Systems \(4-year, BSc, Artificial Intelligence\)/);
assert.match(programHumanized.answer, /Data Science \(4-year, BSc, Data Science\)/);
assert.match(programHumanized.answer, /includes the following programs:/);

const recomposedProgramHumanized = applyGroundedConversationalExpansion({
  query: "Which bachelor's programs does the College of Artificial Intelligence offer?",
  groundedAnswer:
    "College of Artificial Intelligence offers Bachelor of Science. " +
    "Bachelor of Science includes the Intelligent Systems and Data Science programs.",
  route: "KG_DIRECT",
  responseBody: {
    used_facts: programRaw.split("\n")
  }
});
assert.match(recomposedProgramHumanized.answer, /Intelligent Systems \(4-year, BSc, Artificial Intelligence\)/);
assert.match(recomposedProgramHumanized.answer, /Data Science \(4-year, BSc, Data Science\)/);
assert.match(recomposedProgramHumanized.answer, /includes the following programs:/);

const pluralTeachingHumanized = applyGroundedConversationalExpansion({
  query: "What courses does Hany Hanafy Mahmoud Said teach?",
  groundedAnswer: "Hany Hanafy Mahmoud Said teaches Natural Language Processing and Cognitive Computing.",
  route: "KG_DIRECT"
});
assert.equal(
  pluralTeachingHumanized.answer,
  "Hany Hanafy Mahmoud Said teaches Natural Language Processing and Cognitive Computing."
);

const qualityRoleHumanized = applyGroundedConversationalExpansion({
  query: "What other role does Hany Hanafy Mahmoud Said hold at the college?",
  groundedAnswer: "Hany Hanafy Mahmoud Said serves as Head of Unit for Quality Unit.",
  route: "KG_DIRECT"
});
assert.equal(
  qualityRoleHumanized.answer,
  "Hany Hanafy Mahmoud Said is the Head of the Quality Unit."
);

const localOnly = await humanizeGroundedAnswer({
  query: "Who teaches Natural Language Processing?",
  groundedAnswer: "Hany Hanafy Mahmoud Said teaches Natural Language Processing.",
  route: "KG_DIRECT",
  requestId: "answer-test",
  responseBody: {
    used_facts: ["Hany Hanafy Mahmoud Said teaches Natural Language Processing."]
  }
});
assert.equal(localOnly.reason, "VERIFIED_LOCAL_FORMATTING");
assert.equal(localOnly.modelCallsAdded, 0);
assert.equal(localOnly.grounding.status, "fully_supported");
assert.equal(localOnly.grounding.sentence_results[0].sentence, localOnly.answer);

const verifiedProgramFormatting = await humanizeGroundedAnswer({
  query: "Which bachelor's programs does the College of Artificial Intelligence offer?",
  groundedAnswer:
    "College of Artificial Intelligence offers Bachelor of Science. " +
    "Bachelor of Science includes the Intelligent Systems and Data Science programs.",
  route: "KG_DIRECT",
  requestId: "program-answer-test",
  responseBody: {
    used_facts: programRaw.split("\n"),
    citations: programEvidence.map(item => ({
      evidence_id: item.metadata.evidence_id,
      source: "KG",
      excerpt: item.evidence
    })),
    graph: {
      links: [
        { source: "Bachelor of Science", target: "Intelligent Systems", type: "INCLUDES_PROGRAM" },
        { source: "Bachelor of Science", target: "Data Science", type: "INCLUDES_PROGRAM" }
      ]
    }
  }
});
assert.equal(verifiedProgramFormatting.reason, "VERIFIED_LOCAL_FORMATTING");
assert.equal(verifiedProgramFormatting.grounding.status, "fully_supported");
assert.match(verifiedProgramFormatting.answer, /Intelligent Systems \(4-year, BSc, Artificial Intelligence\)/);
assert.match(verifiedProgramFormatting.answer, /Data Science \(4-year, BSc, Data Science\)/);
assert.ok(
  verifiedProgramFormatting.grounding.sentence_results.every(result =>
    verifiedProgramFormatting.answer.includes(result.sentence)
  )
);

const formatted = responseFormatter.format({
  answer: "Machine Learning requires Linear Algebra.",
  route: "KG_DIRECT",
  confidence: 0.99,
  graph: { nodes: [], links: [] },
  citations: [
    {
      evidence_id: "exact:ml|has_prerequisite|linear",
      source: "KG",
      title: "Machine Learning",
      category: "HAS_PREREQUISITE",
      excerpt: "Linear Algebra is a prerequisite for Machine Learning.",
      score: 0.99
    }
  ]
}, "cid-test", "request-test");
assert.equal(formatted.citations.length, 1);
assert.equal(formatted.citations[0].evidence_id, "exact:ml|has_prerequisite|linear");
assert.deepEqual(formatted.graph, { nodes: [], links: [] });

console.log("demoConversationAnswer.test.js passed all 11 factual dean turns, completeness repair, grounding removal, citations, local personality, and empty-graph contracts.");
process.exit(0);
