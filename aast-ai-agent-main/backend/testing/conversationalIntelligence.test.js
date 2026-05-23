import assert from "node:assert/strict";
import {
  detectMetaConversationIntent,
  META_INTENTS
} from "../services/conversationMetaIntent.js";
import {
  applyGroundedConversationalExpansion,
  shouldHumanizeResponseBody
} from "../services/conversationalHumanizer.js";

const metaCases = [
  ["what was my last question", META_INTENTS.LAST_QUESTION],
  ["what was last question", META_INTENTS.LAST_QUESTION],
  ["what did i ask before", META_INTENTS.LAST_QUESTION],
  ["what did i ask you", META_INTENTS.LAST_QUESTION],
  ["what were we discussing", META_INTENTS.PREVIOUS_TOPIC],
  ["continue previous topic", META_INTENTS.CONTINUE_TOPIC],
  ["continue", META_INTENTS.CONTINUE_TOPIC],
  ["what did you say earlier", META_INTENTS.LAST_ASSISTANT_RESPONSE],
  ["summarize conversation", META_INTENTS.CONVERSATION_SUMMARY],
  ["recap our discussion", META_INTENTS.CONVERSATION_SUMMARY]
];

for (const [query, expectedType] of metaCases) {
  const result = detectMetaConversationIntent(query);
  assert.equal(result?.type, expectedType, `${query} should map to ${expectedType}`);
  assert.ok(
    ["deterministic_regex", "semantic_token_family", "lightweight_fuzzy_phrase"].includes(result.source),
    `${query} should be handled locally, not by retrieval or LLM fallback`
  );
}

assert.equal(
  shouldHumanizeResponseBody({
    answer: "Your last question was: \"Who teaches NLP?\"",
    final_answer: "Your last question was: \"Who teaches NLP?\"",
    route: "CONVERSATION_META"
  }),
  false,
  "conversation meta responses must bypass Gemini humanization"
);

const teachingExpansion = applyGroundedConversationalExpansion({
  query: "Who teaches Cloud Computing?",
  groundedAnswer: "Yasser Yousry Hanfy teaches Cloud Computing.",
  route: "KG_DIRECT"
});
assert.equal(
  teachingExpansion.answer,
  "Cloud Computing is taught by Yasser Yousry Hanfy. I can also help with office information or related courses if that information is available."
);

const followUpExpansion = applyGroundedConversationalExpansion({
  query: "What is his office?",
  groundedAnswer: "I don't have enough verified information to answer that fully.",
  route: "KG_DIRECT",
  responseBody: {
    metadata: {
      trace: {
        route_diagnostics: {
          conversation_priority: {
            follow_up: {
              resolved: true,
              target: "Hany Hanafy Mahmoud Said"
            }
          }
        }
      }
    }
  }
});
assert.equal(
  followUpExpansion.answer,
  "I resolved that as Hany Hanafy Mahmoud Said, but I couldn't find verified office information."
);

const multiIntentExpansion = applyGroundedConversationalExpansion({
  query: "What are machine learning prerequisites and grading system?",
  groundedAnswer: "Machine Learning: Prerequisites: Fundamentals of AI is prerequisite for Machine Learning.\nGrading: Grades are evaluated by coursework and exams.",
  route: "HYBRID_KG_RAG"
});
assert.match(multiIntentExpansion.answer, /^For Machine Learning, I found verified information for prerequisites and grading\./);

console.log(`conversationalIntelligence.test.js passed ${metaCases.length} meta cases and grounded expansion checks.`);
