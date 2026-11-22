import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

import {
  buildConversationMetaResponse,
  detectMetaConversationIntent,
  META_INTENTS
} from "../services/conversationMetaIntent.js";
import { resolveFollowUpReference } from "../services/conversationPriority.js";

const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "aast-followup-memory-"));
process.env.CONVERSATIONS_FILE = path.join(tempDirectory, "conversations.json");
process.env.CONVERSATION_SAVE_DEBOUNCE_MS = "1";

const serviceUrl = new URL("../services/conversationService.js", import.meta.url);
serviceUrl.searchParams.set("followup-test", String(Date.now()));
const {
  createConversation,
  flushConversations,
  getConversation,
  loadConversations,
  pushTurn,
  updateConversationMemoryFromTurn
} = await import(serviceUrl.href);

function exactEvidence(subject, subjectType, relation, object, objectType) {
  return {
    evidence: `${subject} ${relation} ${object}`,
    metadata: {
      evidence_id: `test:${subject}|${relation}|${object}`,
      evidence_subject: { name: subject, type: subjectType },
      evidence_relation: relation,
      evidence_object: { name: object, type: objectType }
    }
  };
}

function entity(type, value, extra = {}) {
  return {
    type,
    value,
    displayValue: value,
    source: "verified_kg",
    evidenceSource: "verified_kg",
    ...extra
  };
}

try {
  await loadConversations();
  const created = createConversation({ ownerId: "dean-test" });
  const conversation = await getConversation(created.cid, { ownerId: "dean-test" });
  await pushTurn(
    created.cid,
    conversation,
    "user",
    "Which bachelor's programs does the college offer?",
    { ownerId: "dean-test" }
  );

  const programMemory = await updateConversationMemoryFromTurn(created.cid, conversation, {
    userQuery: "Which bachelor's programs does the college offer?",
    assistantAnswer: "The degree includes Intelligent Systems and Data Science.",
    route: "KG_DIRECT",
    intent: "PROGRAM",
    neo4jContext: [
      exactEvidence("Bachelor of Science", "Degree", "INCLUDES_PROGRAM", "Intelligent Systems", "Program"),
      exactEvidence("Bachelor of Science", "Degree", "INCLUDES_PROGRAM", "Data Science", "Program")
    ]
  }, { ownerId: "dean-test" });

  assert.deepEqual(
    programMemory.selectedTargets.map(target => target.displayValue),
    ["Intelligent Systems", "Data Science"]
  );
  assert.equal(programMemory.verifiedTurns.length, 1);
  assert.equal(programMemory.lastVerifiedAssistantAnswer, "The degree includes Intelligent Systems and Data Science.");

  const cachedCreated = createConversation({ ownerId: "dean-cache-test" });
  const cachedConversation = await getConversation(cachedCreated.cid, { ownerId: "dean-cache-test" });
  await pushTurn(
    cachedCreated.cid,
    cachedConversation,
    "user",
    "Which bachelor's programs does the college offer?",
    { ownerId: "dean-cache-test" }
  );
  const cachedProgramMemory = await updateConversationMemoryFromTurn(cachedCreated.cid, cachedConversation, {
    userQuery: "Which bachelor's programs does the college offer?",
    assistantAnswer: "The degree includes Intelligent Systems and Data Science.",
    route: "KG_DIRECT",
    intent: "PROGRAM",
    usedFacts: [
      "Bachelor of Science includes the Intelligent Systems program.",
      "Bachelor of Science includes the Data Science program."
    ],
    graph: {
      nodes: [
        { id: "Bachelor of Science", label: "Bachelor of Science", type: "Degree" },
        { id: "Intelligent Systems", label: "Intelligent Systems", type: "Program" },
        { id: "Data Science", label: "Data Science", type: "Program" }
      ],
      links: [
        { source: "Bachelor of Science", target: "Intelligent Systems", type: "INCLUDES_PROGRAM" },
        { source: "Bachelor of Science", target: "Data Science", type: "INCLUDES_PROGRAM" }
      ]
    }
  }, { ownerId: "dean-cache-test" });
  assert.deepEqual(
    cachedProgramMemory.selectedTargets.map(target => target.displayValue),
    ["Intelligent Systems", "Data Science"]
  );

  const compare = resolveFollowUpReference(
    "Compare those two for a student choosing between AI systems and data.",
    programMemory
  );
  assert.equal(compare.originalQuery, "Compare those two for a student choosing between AI systems and data.");
  assert.equal(
    compare.standaloneQuery,
    "Compare Intelligent Systems and Data Science for a student choosing between AI systems and data."
  );

  const first = resolveFollowUpReference("What careers can the first one lead to?", {
    ...programMemory,
    lastTopic: "careers"
  });
  assert.equal(first.target, "Intelligent Systems");
  assert.equal(first.standaloneQuery, "What careers can Intelligent Systems lead to?");

  const second = resolveFollowUpReference("And the second?", {
    ...programMemory,
    lastTopic: "careers"
  });
  assert.equal(second.target, "Data Science");
  assert.equal(second.standaloneQuery, "What careers can Data Science lead to?");

  const explicitCourse = resolveFollowUpReference("Does the other one include Machine Learning?", {
    ...programMemory,
    lastTopic: "careers"
  });
  assert.equal(explicitCourse.target, "Data Science");
  assert.equal(explicitCourse.standaloneQuery, "Does Data Science include Machine Learning?");

  const explicitWeek = resolveFollowUpReference("What about week 3 of that course?", {
    recentEntities: [entity("course", "Mobile Computing")]
  });
  assert.equal(explicitWeek.target, "Mobile Computing");
  assert.equal(explicitWeek.standaloneQuery, "What about week 3 of Mobile Computing?");

  assert.equal(detectMetaConversationIntent("Can you tell me tomorrow’s weather?"), null);
  assert.equal(detectMetaConversationIntent("What did you say earlier?")?.type, META_INTENTS.LAST_ASSISTANT_RESPONSE);

  const they = resolveFollowUpReference("Do they include Machine Learning?", programMemory);
  assert.deepEqual(they.target, ["Intelligent Systems", "Data Science"]);
  assert.equal(
    they.standaloneQuery,
    "Do Intelligent Systems and Data Science include Machine Learning?"
  );

  const other = resolveFollowUpReference("What about the other one?", {
    selectedTargets: [
      entity("program", "Intelligent Systems"),
      entity("program", "Data Science")
    ],
    recentEntities: []
  });
  assert.equal(other.target, "Data Science");

  const ambiguousCourse = resolveFollowUpReference("Tell me more about that course.", {
    recentEntities: [
      entity("course", "Machine Learning", { turnId: "turn-1", relation: "TEACHES", relationRole: "target" }),
      entity("course", "Natural Language Processing", { turnId: "turn-1", relation: "TEACHES", relationRole: "target" })
    ]
  });
  assert.equal(ambiguousCourse.resolved, false);
  assert.equal(
    ambiguousCourse.clarification,
    "Do you mean Machine Learning or Natural Language Processing?"
  );

  const dependencyMemory = {
    recentEntities: [
      entity("course", "Machine Learning", {
        turnId: "turn-2",
        relation: "HAS_PREREQUISITE",
        relationRole: "source"
      }),
      entity("course", "Fundamentals of AI", {
        turnId: "turn-2",
        relation: "HAS_PREREQUISITE",
        relationRole: "target"
      }),
      entity("course", "Linear Algebra", {
        turnId: "turn-2",
        relation: "HAS_PREREQUISITE",
        relationRole: "target"
      })
    ]
  };
  const afterThat = resolveFollowUpReference(
    "For language technology, what is recommended after that?",
    dependencyMemory
  );
  assert.equal(afterThat.target, "Machine Learning");
  assert.equal(
    afterThat.standaloneQuery,
    "Which course is recommended after Machine Learning for language technology?"
  );

  const pronoun = resolveFollowUpReference("Does he teach anything else?", {
    recentEntities: [
      entity("professor", "Hany Hanafy Mahmoud Said", {
        turnId: "turn-3",
        relation: "TEACHES",
        relationRole: "source",
        relatedEntity: { displayValue: "Natural Language Processing", type: "course" }
      }),
      entity("course", "Natural Language Processing", {
        turnId: "turn-3",
        relation: "TEACHES",
        relationRole: "target",
        relatedEntity: { displayValue: "Hany Hanafy Mahmoud Said", type: "professor" }
      })
    ]
  });
  assert.equal(
    pronoun.standaloneQuery,
    "Besides Natural Language Processing, what else does Hany Hanafy Mahmoud Said teach?"
  );

  const incompatible = resolveFollowUpReference("Does he teach anything else?", {
    recentEntities: [entity("course", "Machine Learning")]
  });
  assert.equal(incompatible.resolved, false);
  assert.equal(incompatible.clarification, "Which professor or staff member do you mean?");

  const standalone = resolveFollowUpReference("Who teaches Natural Language Processing?", {
    recentEntities: [entity("professor", "Hany Hanafy Mahmoud Said")]
  });
  assert.equal(standalone.detected, false);
  assert.equal(standalone.originalQuery, standalone.standaloneQuery);

  const newestCourseOnly = resolveFollowUpReference("What are its prerequisites?", {
    recentEntities: [
      entity("course", "Machine Learning", { turnId: "new-turn" }),
      entity("course", "Natural Language Processing", { turnId: "old-turn" })
    ]
  });
  assert.equal(newestCourseOnly.target, "Machine Learning");

  const application = resolveFollowUpReference("How do I apply?", {
    lastTopic: "fees",
    recentTopics: ["fees"],
    recentEntities: [entity("policy", "Excellence Scholarship")]
  });
  assert.equal(application.resolved, true);
  assert.equal(application.standaloneQuery, "How do I apply for Excellence Scholarship?");

  let deanMemory = programMemory;
  const recordDeanTurn = async (userQuery, assistantAnswer, neo4jContext, intent = "PROGRAM") => {
    await pushTurn(created.cid, conversation, "user", userQuery, { ownerId: "dean-test" });
    deanMemory = await updateConversationMemoryFromTurn(created.cid, conversation, {
      userQuery,
      assistantAnswer,
      route: "KG_DIRECT",
      intent,
      neo4jContext
    }, { ownerId: "dean-test" });
    return deanMemory;
  };

  await recordDeanTurn(
    "Compare those two for a student choosing between AI systems and data.",
    "Intelligent Systems emphasizes AI systems. Data Science emphasizes data and analytics.",
    [
      exactEvidence("Intelligent Systems", "Program", "HAS_COURSE", "Machine Learning", "Course"),
      exactEvidence("Intelligent Systems", "Program", "HAS_COURSE", "Natural Language Processing", "Course"),
      exactEvidence("Data Science", "Program", "HAS_COURSE", "Data Mining", "Course"),
      exactEvidence("Data Science", "Program", "HAS_COURSE", "Big Data Analytics", "Course")
    ],
    "COMPARE"
  );
  assert.deepEqual(
    deanMemory.selectedTargets.map(target => target.displayValue),
    ["Intelligent Systems", "Data Science"]
  );

  const deanFirst = resolveFollowUpReference("What careers can the first one lead to?", deanMemory);
  assert.equal(deanFirst.target, "Intelligent Systems");
  await recordDeanTurn(
    "What careers can the first one lead to?",
    "Intelligent Systems leads to AI Engineer and Machine Learning Engineer roles.",
    [
      exactEvidence("Intelligent Systems", "Program", "LEADS_TO", "AI Engineer", "CareerRole"),
      exactEvidence("Intelligent Systems", "Program", "LEADS_TO", "Machine Learning Engineer", "CareerRole")
    ],
    "PROGRAM"
  );

  const deanSecond = resolveFollowUpReference("And the second?", deanMemory);
  assert.equal(deanSecond.target, "Data Science");
  await recordDeanTurn(
    "And the second?",
    "Data Science leads to Data Scientist and Data Analyst roles.",
    [
      exactEvidence("Data Science", "Program", "LEADS_TO", "Data Scientist", "CareerRole"),
      exactEvidence("Data Science", "Program", "LEADS_TO", "Data Analyst", "CareerRole")
    ],
    "PROGRAM"
  );

  const whichProgram = resolveFollowUpReference(
    "Which of those programs includes Machine Learning?",
    deanMemory
  );
  assert.equal(whichProgram.resolved, true);
  assert.match(whichProgram.standaloneQuery, /Intelligent Systems/);
  assert.match(whichProgram.standaloneQuery, /Data Science/);
  await recordDeanTurn(
    "Which of those programs includes Machine Learning?",
    "Intelligent Systems includes Machine Learning, course IN221, a three-credit course.",
    [
      exactEvidence("Intelligent Systems", "Program", "HAS_COURSE", "Machine Learning", "Course")
    ],
    "PROGRAM"
  );

  const prerequisites = resolveFollowUpReference(
    "What must a student complete before taking it?",
    deanMemory
  );
  assert.equal(prerequisites.target, "Machine Learning");
  await recordDeanTurn(
    "What must a student complete before taking it?",
    "Machine Learning requires Fundamentals of AI and Linear Algebra.",
    [
      exactEvidence("Machine Learning", "Course", "HAS_PREREQUISITE", "Fundamentals of AI", "Course"),
      exactEvidence("Machine Learning", "Course", "HAS_PREREQUISITE", "Linear Algebra", "Course")
    ],
    "PREREQUISITE"
  );

  const languagePath = resolveFollowUpReference(
    "If the student likes language technology, what is recommended after that?",
    deanMemory
  );
  assert.equal(languagePath.target, "Machine Learning");
  await recordDeanTurn(
    "If the student likes language technology, what is recommended after that?",
    "Natural Language Processing is recommended after Machine Learning and is in Intelligent Systems.",
    [
      exactEvidence("Natural Language Processing", "Course", "RECOMMENDED_AFTER", "Machine Learning", "Course"),
      exactEvidence("Intelligent Systems", "Program", "HAS_COURSE", "Natural Language Processing", "Course")
    ],
    "PROGRAM"
  );

  await recordDeanTurn(
    "Who teaches Natural Language Processing?",
    "Hany Hanafy Mahmoud Said teaches Natural Language Processing.",
    [
      exactEvidence("Hany Hanafy Mahmoud Said", "Professor", "TEACHES", "Natural Language Processing", "Course")
    ],
    "TEACHING"
  );
  const teachesElse = resolveFollowUpReference("Does he teach anything else?", deanMemory);
  assert.equal(teachesElse.target, "Hany Hanafy Mahmoud Said");
  assert.match(teachesElse.standaloneQuery, /Besides Natural Language Processing/);
  await recordDeanTurn(
    "Does he teach anything else?",
    "Hany Hanafy Mahmoud Said also teaches Cognitive Computing.",
    [
      exactEvidence("Hany Hanafy Mahmoud Said", "Professor", "TEACHES", "Cognitive Computing", "Course")
    ],
    "TEACHING"
  );

  const otherRole = resolveFollowUpReference("Does he hold another role at the college?", deanMemory);
  assert.equal(otherRole.target, "Hany Hanafy Mahmoud Said");
  await recordDeanTurn(
    "Does he hold another role at the college?",
    "Hany Hanafy Mahmoud Said heads the Quality Unit.",
    [
      exactEvidence("Hany Hanafy Mahmoud Said", "Professor", "HEAD_OF", "Quality Unit", "Unit")
    ],
    "ADMIN"
  );
  await recordDeanTurn(
    "Who is the dean of the college?",
    "Ali Ali Mohamed Fahmy is the Dean of the College of Artificial Intelligence.",
    [
      exactEvidence("Ali Ali Mohamed Fahmy", "Person", "DEAN_OF", "College of Artificial Intelligence", "College")
    ],
    "ADMIN"
  );
  assert.equal(deanMemory.verifiedTurns.length, 11);
  const deanSummaryIntent = detectMetaConversationIntent(
    "Summarize the advice you gave me in three concise bullets."
  );
  const deanSummary = buildConversationMetaResponse(deanSummaryIntent, {
    conversationMemory: deanMemory
  });
  assert.equal(deanSummary.split("\n").length, 3);
  assert.match(deanSummary, /Intelligent Systems/);
  assert.match(deanSummary, /Machine Learning/);
  assert.match(deanSummary, /Hany Hanafy Mahmoud Said/);
  assert.match(deanSummary, /Ali Ali Mohamed Fahmy/);

  const previousSummaryIntent = detectMetaConversationIntent("Summarize that in three bullets.");
  assert.equal(previousSummaryIntent.type, META_INTENTS.PREVIOUS_ANSWER_SUMMARY);
  assert.equal(previousSummaryIntent.bulletCount, 3);
  const previousSummary = buildConversationMetaResponse(previousSummaryIntent, {
    conversationMemory: {
      lastVerifiedAssistantAnswer:
        "Machine Learning requires Linear Algebra. It also requires Fundamentals of AI. It has three credits."
    }
  });
  assert.equal(previousSummary.split("\n").length, 3);
  assert.doesNotMatch(previousSummary, /not found|according to|probably/i);

  const wholeSummaryIntent = detectMetaConversationIntent(
    "Summarize the advice you gave me in three concise bullets."
  );
  assert.equal(wholeSummaryIntent.type, META_INTENTS.CONVERSATION_SUMMARY);
  const wholeSummary = buildConversationMetaResponse(wholeSummaryIntent, {
    conversationMemory: {
      verifiedTurns: [
        {
          query: "Who teaches NLP?",
          answer: "Hany Hanafy Mahmoud Said teaches Natural Language Processing.",
          relations: ["TEACHES"]
        },
        {
          query: "What are the prerequisites?",
          answer: "Machine Learning requires Fundamentals of AI and Linear Algebra.",
          relations: ["HAS_PREREQUISITE"]
        },
        {
          query: "Compare the programs.",
          answer: "Intelligent Systems emphasizes AI; Data Science emphasizes analytics.",
          relations: ["HAS_COURSE"]
        }
      ]
    }
  });
  assert.equal(wholeSummary.split("\n").length, 3);
  assert.match(wholeSummary, /Programs and careers/);
  assert.match(wholeSummary, /Course path/);
  assert.match(wholeSummary, /Faculty and leadership/);

  const simplifyIntent = detectMetaConversationIntent("Explain that more simply.");
  assert.equal(simplifyIntent.type, META_INTENTS.SIMPLIFY_PREVIOUS);
  assert.equal(
    buildConversationMetaResponse(simplifyIntent, {
      conversationMemory: { lastVerifiedAssistantAnswer: "The verified rule is that Linear Algebra is required." }
    }),
    "Simply put: The verified rule is that Linear Algebra is required."
  );
  assert.equal(
    buildConversationMetaResponse(previousSummaryIntent, {
      conversationMemory: {
        lastAssistantSummary: "An unsupported answer must not be reused.",
        verifiedTurns: []
      }
    }),
    "I do not have a verified earlier answer to summarize yet."
  );

  console.log("demoConversationFollowup.test.js passed standalone rewriting, ambiguity, ordinals, pronouns, goals, and grounded summaries.");
} finally {
  await flushConversations();
  await rm(tempDirectory, { recursive: true, force: true });
}
