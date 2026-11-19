import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "aast-conversation-memory-"));
const conversationFile = path.join(tempDirectory, "conversations.json");

process.env.CONVERSATIONS_FILE = conversationFile;
process.env.CONVERSATION_SAVE_DEBOUNCE_MS = "1";

await writeFile(conversationFile, JSON.stringify({
  version: 1,
  conversations: {
    legacy: {
      cid: "legacy",
      ownerId: "owner-a",
      title: "Legacy conversation",
      createdAt: "2026-07-25T10:00:00.000Z",
      updatedAt: "2026-07-25T10:01:00.000Z",
      messages: [
        { role: "user", content: "What does Professor Legacy teach?" }
      ],
      conversationMemory: {
        lastTopic: "teaching_staff",
        lastEntity: "Professor Legacy",
        recentSubjects: ["Legacy Course"],
        lastAssistantSummary: "Professor Legacy teaches Legacy Course."
      }
    }
  }
}, null, 2), "utf8");

const serviceUrl = new URL("../services/conversationService.js", import.meta.url);
serviceUrl.searchParams.set("memory-test", String(Date.now()));
const conversationService = await import(serviceUrl.href);

const {
  createConversation,
  flushConversations,
  getConversation,
  getConversationMemory,
  loadConversations,
  pushTurn,
  updateConversationMemoryFromTurn
} = conversationService;

try {
  await loadConversations();

  const legacyMemory = getConversationMemory("legacy", { ownerId: "owner-a" });
  assert.equal(legacyMemory.lastEntity.displayValue, "Professor Legacy");
  assert.equal(legacyMemory.lastEntity.canonicalValue, "professor legacy");
  assert.equal(legacyMemory.lastEntity.evidenceSource, "legacy");
  assert.equal(legacyMemory.recentEntities.length, 1);
  assert.deepEqual(legacyMemory.recentTopics, ["teaching_staff"]);

  assert.throws(
    () => getConversationMemory("legacy", { ownerId: "owner-b" }),
    error => error?.name === "ConversationOwnershipError"
  );

  const created = createConversation({ ownerId: "owner-a" });
  const conversation = await getConversation(created.cid, { ownerId: "owner-a" });
  await pushTurn(
    created.cid,
    conversation,
    "user",
    "What courses does Professor Hany teach?",
    { ownerId: "owner-a" }
  );
  const userTurnId = [...conversation.messages].reverse().find(message => message.role === "user").id;

  const memory = await updateConversationMemoryFromTurn(created.cid, conversation, {
    userQuery: "What courses does Professor Hany teach?",
    assistantAnswer: "Professor Hany teaches Machine Learning and Natural Language Processing.",
    route: "KNOWLEDGE_GRAPH",
    intent: "TEACHING",
    entities: ["Professor Hany"],
    neo4jContext: [
      {
        evidence: '(Professor {name: "Hany"})-[:TEACHES]->(Course {name: "Machine Learning"})'
      },
      {
        evidence: '(Professor {name: "Hany"})-[:TEACHES]->(Course {name: "Natural Language Processing"})'
      }
    ]
  }, { ownerId: "owner-a" });

  assert.ok(memory.recentEntities.length <= 6);
  const courseRecords = memory.recentEntities.filter(entity => entity.type === "course");
  assert.deepEqual(
    [...new Set(courseRecords.map(entity => entity.displayValue))].sort(),
    ["Machine Learning", "Natural Language Processing"]
  );
  for (const course of courseRecords) {
    assert.equal(course.relation, "TEACHES");
    assert.equal(course.relatedEntity.type, "professor");
    assert.equal(course.relatedEntity.displayValue, "Hany");
    assert.equal(course.turnId, userTurnId);
    assert.equal(course.evidenceSource, "verified_kg");
    assert.equal(course.value, course.displayValue);
    assert.equal(course.source, course.evidenceSource);
  }
  assert.equal(memory.lastEntity.type, "professor");
  assert.equal(memory.lastEntity.displayValue, "Hany");
  assert.ok(memory.recentTopics.includes("teaching_staff"));
  assert.ok(memory.recentSubjects.includes("Machine Learning"));
  assert.ok(memory.recentSubjects.includes("Natural Language Processing"));

  const textualCreated = createConversation({ ownerId: "owner-a" });
  const textualConversation = await getConversation(textualCreated.cid, { ownerId: "owner-a" });
  await pushTurn(
    textualCreated.cid,
    textualConversation,
    "user",
    "Which courses are taught by Professor Hany?",
    { ownerId: "owner-a" }
  );
  const textualMemory = await updateConversationMemoryFromTurn(textualCreated.cid, textualConversation, {
    userQuery: "Which courses are taught by Professor Hany?",
    ragContext: [
      { text: "Professor Hany teaches Machine Learning and Natural Language Processing." }
    ]
  }, { ownerId: "owner-a" });
  assert.deepEqual(
    textualMemory.recentEntities
      .filter(entity => entity.type === "course")
      .map(entity => entity.displayValue),
    ["Machine Learning", "Natural Language Processing"]
  );
  assert.ok(textualMemory.recentEntities.every(entity => entity.evidenceSource === "verified_rag"));

  const explicitCreated = createConversation({ ownerId: "owner-a" });
  const explicitConversation = await getConversation(explicitCreated.cid, { ownerId: "owner-a" });
  await pushTurn(
    explicitCreated.cid,
    explicitConversation,
    "user",
    "Compare Machine Learning and Blockchain",
    { ownerId: "owner-a" }
  );
  const explicitMemory = await updateConversationMemoryFromTurn(explicitCreated.cid, explicitConversation, {
    userQuery: "Compare Machine Learning and Blockchain",
    assistantAnswer: "I need verified course evidence before comparing them."
  }, { ownerId: "owner-a" });

  assert.deepEqual(
    explicitMemory.selectedTargets.map(entity => entity.displayValue),
    ["Machine Learning", "Blockchain"]
  );
  assert.ok(explicitMemory.selectedTargets.every(entity => entity.evidenceSource === "explicit_user"));

  const unsupportedCreated = createConversation({ ownerId: "owner-a" });
  const unsupportedConversation = await getConversation(unsupportedCreated.cid, { ownerId: "owner-a" });
  await pushTurn(
    unsupportedCreated.cid,
    unsupportedConversation,
    "user",
    "Tell me something else",
    { ownerId: "owner-a" }
  );
  const unsupportedMemory = await updateConversationMemoryFromTurn(
    unsupportedCreated.cid,
    unsupportedConversation,
    {
      userQuery: "Tell me something else",
      assistantAnswer: "Professor Fabricated teaches Imaginary Systems."
    },
    { ownerId: "owner-a" }
  );
  assert.deepEqual(unsupportedMemory.recentEntities, []);

  const boundedCreated = createConversation({ ownerId: "owner-a" });
  const boundedConversation = await getConversation(boundedCreated.cid, { ownerId: "owner-a" });
  await pushTurn(
    boundedCreated.cid,
    boundedConversation,
    "user",
    "List Professor Hany's courses",
    { ownerId: "owner-a" }
  );
  const boundedMemory = await updateConversationMemoryFromTurn(boundedCreated.cid, boundedConversation, {
    userQuery: "List Professor Hany's courses",
    neo4jContext: Array.from({ length: 7 }, (_, index) => ({
      evidence: `(Professor {name: "Hany"})-[:TEACHES]->(Course {name: "Course ${index + 1}"})`
    }))
  }, { ownerId: "owner-a" });
  assert.equal(boundedMemory.recentEntities.length, 6);
  assert.equal(boundedMemory.recentEntities[0].relatedEntity.displayValue, "Course 1");

  await flushConversations();
  const persisted = JSON.parse(await readFile(conversationFile, "utf8"));
  assert.equal(
    persisted.conversations[created.cid].conversationMemory.recentEntities.length,
    memory.recentEntities.length
  );
  assert.equal(
    persisted.conversations[created.cid].conversationMemory.recentEntities[0].turnId,
    userTurnId
  );

  console.log("demoConversationMemory.test.js passed typed memory, legacy, isolation, grounding, and bounds checks.");
} finally {
  await flushConversations();
  await rm(tempDirectory, { recursive: true, force: true });
}
