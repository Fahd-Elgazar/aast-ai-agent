import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createJsonPersistence } from "./persistenceLayer.js";
import { DEFAULT_TITLE, generateConversationTitle } from "./titleGenerator.js";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MAX_CONTEXT_TURNS = Number(process.env.MAX_CONTEXT_TURNS || 12);
const MAX_MEMORY_SUBJECTS = 5;
const MAX_MEMORY_ENTITIES = 6;
const MAX_EVIDENCE_ENTITIES_PER_TURN = 64;
const MAX_MEMORY_TOPICS = 5;
const MAX_SELECTED_TARGETS = 3;
const MAX_VERIFIED_TURNS = 12;
const MAX_MEMORY_FIELD_CHARS = 140;
const MAX_MEMORY_SUMMARY_CHARS = 220;
const MAX_VERIFIED_ANSWER_CHARS = 1200;

const DATA_FILE = process.env.CONVERSATIONS_FILE ||
  path.resolve(__dirname, "../data/conversations.json");

const SYSTEM_PROMPT =
  "You are the AAST University Assistant. Use only verified knowledge from the Graph. If not found, say \"I don't have that information in the knowledge graph.\"";

const persistence = createJsonPersistence({
  filePath: DATA_FILE,
  defaultValue: () => ({
    version: 2,
    updatedAt: new Date().toISOString(),
    conversations: {}
  }),
  debounceMs: Number(process.env.CONVERSATION_SAVE_DEBOUNCE_MS || 500),
  logLabel: "conversation-store"
});

const conversations = new Map();
let loaded = false;

export class ConversationOwnershipError extends Error {
  constructor() {
    super("Conversation not found");
    this.name = "ConversationOwnershipError";
  }
}

export async function loadConversations() {
  const store = await persistence.load();
  conversations.clear();

  const rawConversations = normalizeConversationCollection(store);
  for (const [cid, raw] of Object.entries(rawConversations)) {
    const normalized = normalizeConversation(cid, raw);
    conversations.set(normalized.cid, normalized);
  }

  loaded = true;
  logger.info("Conversation store loaded", {
    count: conversations.size,
    filePath: DATA_FILE
  });

  return conversations.size;
}

export async function flushConversations() {
  await persistence.flush();
}

export async function saveConversations({ immediate = false } = {}) {
  persistSoon();
  if (immediate) await flushConversations();
}

export function makeConversationId() {
  return crypto.randomBytes(8).toString("hex");
}

export function normalizeConversationId(cid) {
  if (typeof cid !== "string") return null;
  const trimmed = cid.trim();
  if (!trimmed || trimmed.length > 128) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) return null;
  return trimmed;
}

export async function getConversation(cid, { ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid) || makeConversationId();
  let convo = conversations.get(normalizedCid);

  if (convo && convo.ownerId !== owner) throw new ConversationOwnershipError();

  if (!convo) {
    convo = buildFreshConversation(normalizedCid, owner);
    conversations.set(normalizedCid, convo);
    persistSoon();
  }

  convo.lastActive = Date.now();
  convo.updatedAt = new Date().toISOString();
  persistSoon();

  return convo;
}

export function createConversation({ ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const cid = makeConversationId();
  const convo = buildFreshConversation(cid, owner);
  conversations.set(cid, convo);
  persistSoon();

  return serializeConversation(convo, { includeMessages: true });
}

export async function saveConversation(cid, convo, { ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid || !convo) return null;

  const stored = conversations.get(normalizedCid);
  if (stored && stored.ownerId !== owner) throw new ConversationOwnershipError();
  if (convo.ownerId && convo.ownerId !== owner) throw new ConversationOwnershipError();

  const existing = stored || buildFreshConversation(normalizedCid, owner);
  const updated = normalizeConversation(normalizedCid, {
    ...existing,
    ...convo,
    cid: normalizedCid,
    ownerId: owner,
    updatedAt: new Date().toISOString(),
    lastActive: Date.now()
  });

  conversations.set(normalizedCid, updated);
  persistSoon();

  return updated;
}

export async function pushTurn(cid, convo, role, content, { ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid) throw new Error("Invalid conversation id");

  const stored = conversations.get(normalizedCid);
  if (stored && stored.ownerId !== owner) throw new ConversationOwnershipError();
  if (convo?.ownerId && convo.ownerId !== owner) throw new ConversationOwnershipError();

  const target = stored || normalizeConversation(normalizedCid, { ...convo, ownerId: owner });
  if (!conversations.has(normalizedCid)) conversations.set(normalizedCid, target);

  const message = normalizeMessage({ role, content }, target.updatedAt);
  target.messages.push(message);

  if (role === "user") maybeGenerateTitle(target, content);

  target.lastActive = Date.now();
  target.updatedAt = new Date().toISOString();
  persistSoon();

  return target;
}

export function getConversationMemory(cid, { ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid);
  const convo = normalizedCid ? conversations.get(normalizedCid) : null;
  if (convo && convo.ownerId !== owner) throw new ConversationOwnershipError();
  return cloneMemory(convo?.conversationMemory);
}

export async function updateConversationMemoryFromTurn(cid, convo, turn = {}, { ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid) throw new Error("Invalid conversation id");

  const stored = conversations.get(normalizedCid);
  if (stored && stored.ownerId !== owner) throw new ConversationOwnershipError();
  if (convo?.ownerId && convo.ownerId !== owner) throw new ConversationOwnershipError();

  const target = stored || normalizeConversation(normalizedCid, { ...convo, ownerId: owner });
  if (!conversations.has(normalizedCid)) conversations.set(normalizedCid, target);

  const current = normalizeConversationMemory(target.conversationMemory);
  const lastUserTurn = [...target.messages].reverse().find(message => message.role === "user");
  const update = buildLightweightMemoryUpdate(current, {
    ...turn,
    turnId: turn.turnId || turn.userTurnId || lastUserTurn?.id || null
  });
  target.conversationMemory = normalizeConversationMemory({
    ...current,
    ...update
  });

  target.updatedAt = new Date().toISOString();
  target.lastActive = Date.now();
  persistSoon();

  return cloneMemory(target.conversationMemory);
}

export async function updateSystemPrompt(cid, convo, content, { ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid) throw new Error("Invalid conversation id");

  const stored = conversations.get(normalizedCid);
  if (stored && stored.ownerId !== owner) throw new ConversationOwnershipError();
  if (convo?.ownerId && convo.ownerId !== owner) throw new ConversationOwnershipError();
  const target = stored || normalizeConversation(normalizedCid, { ...convo, ownerId: owner });
  const systemIdx = target.messages.findIndex(m => m.role === "system");
  const message = normalizeMessage({ role: "system", content }, target.updatedAt);

  if (systemIdx >= 0) target.messages[systemIdx] = { ...target.messages[systemIdx], ...message };
  else target.messages.unshift(message);

  target.updatedAt = new Date().toISOString();
  target.lastActive = Date.now();
  conversations.set(normalizedCid, target);
  persistSoon();

  return target;
}

export function getConversationContext(cid, maxTurns = MAX_CONTEXT_TURNS, { ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid);
  const convo = normalizedCid ? conversations.get(normalizedCid) : null;
  if (convo && convo.ownerId !== owner) throw new ConversationOwnershipError();
  if (!convo) return buildFreshConversation(normalizedCid || makeConversationId(), owner).messages;

  const system = convo.messages.find(m => m.role === "system") ||
    normalizeMessage({ role: "system", content: SYSTEM_PROMPT }, convo.createdAt);
  const nonSystem = convo.messages.filter(m => m.role !== "system");
  const tail = nonSystem.slice(-Math.max(maxTurns - 1, 1));

  return [system, ...tail].map(message => ({
    role: message.role,
    content: message.content
  }));
}

export function listConversations({ search = "", ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const q = search.trim().toLowerCase();
  return [...conversations.values()]
    .filter(convo => convo.ownerId === owner)
    .filter(convo => {
      if (!q) return true;
      return `${convo.title} ${getPreview(convo)}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.lastActive || 0) - (a.lastActive || 0);
    })
    .map(convo => serializeConversation(convo));
}

export function getConversationById(cid, { includeMessages = true, ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid) return null;

  const convo = conversations.get(normalizedCid);
  return convo?.ownerId === owner ? serializeConversation(convo, { includeMessages }) : null;
}

export async function renameConversation(cid, title, { ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid);
  const convo = normalizedCid ? conversations.get(normalizedCid) : null;
  if (!convo || convo.ownerId !== owner) return null;

  const cleanTitle = sanitizeTitle(title);
  if (!cleanTitle) throw new Error("Conversation title is required");

  convo.title = cleanTitle;
  convo.titleGenerated = false;
  convo.titleSource = "manual";
  convo.renamedAt = new Date().toISOString();
  convo.updatedAt = convo.renamedAt;
  convo.lastActive = Date.now();
  persistSoon();

  return serializeConversation(convo);
}

export async function pinConversation(cid, pinned = true, { ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid);
  const convo = normalizedCid ? conversations.get(normalizedCid) : null;
  if (!convo || convo.ownerId !== owner) return null;

  convo.pinned = Boolean(pinned);
  convo.updatedAt = new Date().toISOString();
  persistSoon();

  return serializeConversation(convo);
}

export async function deleteConversation(cid, { ownerId } = {}) {
  ensureLoaded();

  const owner = requireOwnerId(ownerId);
  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid) return false;

  const convo = conversations.get(normalizedCid);
  if (!convo || convo.ownerId !== owner) return false;
  const deleted = conversations.delete(normalizedCid);
  if (deleted) persistSoon();
  return deleted;
}

export function getConversationSummary(cid, { ownerId } = {}) {
  return getConversationById(cid, { includeMessages: false, ownerId });
}

export function getConversationStats() {
  return {
    conversations: "disk_persistent",
    conversationCount: conversations.size,
    maxContextTurns: MAX_CONTEXT_TURNS,
    storage: persistence.getStatus(),
    loaded
  };
}

export function serializeConversation(convo, { includeMessages = false } = {}) {
  const serialized = {
    cid: convo.cid,
    title: convo.title || DEFAULT_TITLE,
    createdAt: convo.createdAt,
    updatedAt: convo.updatedAt,
    lastActive: convo.lastActive || Date.parse(convo.updatedAt || convo.createdAt) || Date.now(),
    pinned: Boolean(convo.pinned),
    titleGenerated: Boolean(convo.titleGenerated),
    titleSource: convo.titleSource || "auto",
    messageCount: convo.messages.filter(m => m.role !== "system").length,
    preview: getPreview(convo),
    lastRoute: convo.lastRoute || null
  };

  if (includeMessages) {
    serialized.messages = convo.messages
      .filter(message => message.role !== "system")
      .map(message => ({
        id: message.id,
        role: message.role,
        content: message.content,
        text: message.content,
        createdAt: message.createdAt
      }));
  }

  return serialized;
}

function normalizeConversationCollection(store) {
  if (Array.isArray(store)) {
    return Object.fromEntries(store.map(item => [item.cid || makeConversationId(), item]));
  }

  if (store?.conversations && typeof store.conversations === "object") {
    return store.conversations;
  }

  if (store && typeof store === "object") return store;
  return {};
}

function buildFreshConversation(cid, ownerId) {
  const now = new Date().toISOString();
  return {
    cid,
    ownerId: requireOwnerId(ownerId),
    title: DEFAULT_TITLE,
    titleGenerated: false,
    titleSource: "auto",
    createdAt: now,
    updatedAt: now,
    lastActive: Date.now(),
    pinned: false,
    messages: [
      normalizeMessage({ role: "system", content: SYSTEM_PROMPT }, now)
    ],
    lastRoute: null,
    conversationMemory: buildEmptyConversationMemory()
  };
}

function normalizeConversation(cid, raw = {}) {
  const now = new Date().toISOString();
  const createdAt = normalizeDate(raw.createdAt || raw.created_at || raw.startedAt) || now;
  const updatedAt = normalizeDate(raw.updatedAt || raw.updated_at || raw.lastUpdated) || createdAt;
  const messages = Array.isArray(raw.messages)
    ? raw.messages.map(message => normalizeMessage(message, createdAt)).filter(Boolean)
    : [];

  if (!messages.some(message => message.role === "system")) {
    messages.unshift(normalizeMessage({ role: "system", content: SYSTEM_PROMPT }, createdAt));
  }

  return {
    ...raw,
    cid,
    ownerId: normalizeOwnerId(raw.ownerId),
    title: sanitizeTitle(raw.title) || DEFAULT_TITLE,
    titleGenerated: Boolean(raw.titleGenerated),
    titleSource: raw.titleSource || (raw.titleGenerated ? "auto" : "auto"),
    createdAt,
    updatedAt,
    lastActive: Number(raw.lastActive) || Date.parse(updatedAt) || Date.now(),
    pinned: Boolean(raw.pinned),
    messages,
    lastRoute: raw.lastRoute || null,
    conversationMemory: normalizeConversationMemory(raw.conversationMemory)
  };
}

function buildEmptyConversationMemory() {
  return {
    lastTopic: null,
    recentTopics: [],
    lastEntity: null,
    recentEntities: [],
    selectedTargets: [],
    lastIntent: null,
    recentSubjects: [],
    lastAssistantSummary: null,
    lastVerifiedAssistantAnswer: null,
    verifiedTurns: []
  };
}

function normalizeConversationMemory(memory = {}) {
  const raw = memory && typeof memory === "object" ? memory : {};
  const legacyLastEntity = normalizeMemoryEntity(raw.lastEntity);
  const recentEntities = normalizeRecentEntities(
    Array.isArray(raw.recentEntities)
      ? raw.recentEntities
      : Array.isArray(raw.entities)
        ? raw.entities
        : legacyLastEntity
          ? [legacyLastEntity]
          : []
  );

  return {
    lastTopic: normalizeMemoryText(raw.lastTopic),
    recentTopics: normalizeRecentTopics(raw.recentTopics, raw.lastTopic),
    lastEntity: legacyLastEntity || recentEntities[0] || null,
    recentEntities,
    selectedTargets: normalizeRecentEntities(raw.selectedTargets, MAX_SELECTED_TARGETS),
    lastIntent: normalizeMemoryText(raw.lastIntent),
    recentSubjects: normalizeRecentSubjects(raw.recentSubjects),
    lastAssistantSummary: normalizeMemoryText(raw.lastAssistantSummary, MAX_MEMORY_SUMMARY_CHARS),
    lastVerifiedAssistantAnswer: normalizeMemoryText(
      raw.lastVerifiedAssistantAnswer,
      MAX_VERIFIED_ANSWER_CHARS
    ),
    verifiedTurns: normalizeVerifiedTurns(raw.verifiedTurns)
  };
}

function normalizeMemoryText(value, limit = MAX_MEMORY_FIELD_CHARS) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, limit);
}

function normalizeMemoryEntity(entity) {
  if (!entity) return null;

  if (typeof entity === "string") {
    return makeMemoryEntity("entity", entity, "legacy");
  }

  if (typeof entity !== "object") return null;

  const displayValue = normalizeMemoryText(
    entity.displayValue ||
    entity.value ||
    entity.name ||
    entity.label ||
    entity.canonicalValue
  );
  if (!displayValue) return null;

  const evidenceSource = normalizeMemoryText(
    entity.evidenceSource || entity.source || "session",
    40
  ) || "session";
  const relatedEntity = normalizeRelatedEntity(entity.relatedEntity || entity.related);

  return {
    type: normalizeMemoryText(entity.type || "entity", 40) || "entity",
    canonicalValue: normalizeCanonicalEntityValue(entity.canonicalValue || displayValue),
    displayValue,
    value: displayValue,
    relation: normalizeMemoryRelation(entity.relation),
    relationRole: ["source", "target"].includes(normalizeMemoryText(entity.relationRole, 12))
      ? normalizeMemoryText(entity.relationRole, 12)
      : null,
    relatedEntity,
    turnId: normalizeMemoryText(entity.turnId, 128),
    evidenceSource,
    source: evidenceSource
  };
}

function normalizeRelatedEntity(entity) {
  if (!entity) return null;
  const raw = typeof entity === "string" ? { displayValue: entity } : entity;
  if (!raw || typeof raw !== "object") return null;

  const displayValue = normalizeMemoryText(
    raw.displayValue || raw.value || raw.name || raw.label || raw.canonicalValue
  );
  if (!displayValue) return null;

  return {
    type: normalizeMemoryText(raw.type || "entity", 40) || "entity",
    canonicalValue: normalizeCanonicalEntityValue(raw.canonicalValue || displayValue),
    displayValue,
    value: displayValue
  };
}

function normalizeCanonicalEntityValue(value) {
  const displayValue = normalizeMemoryText(value);
  if (!displayValue) return null;

  return displayValue
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}+#.'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMemoryRelation(value) {
  const relation = normalizeMemoryText(value, 80);
  return relation
    ? relation.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || null
    : null;
}

function normalizeRecentEntities(entities, limit = MAX_MEMORY_ENTITIES) {
  if (!Array.isArray(entities)) return [];

  const seen = new Set();
  const normalized = [];

  for (const entity of entities) {
    const record = normalizeMemoryEntity(entity);
    if (!record) continue;

    const key = [
      record.type.toLowerCase(),
      record.canonicalValue
    ].join("|");
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(record);
    if (normalized.length >= limit) break;
  }

  return normalized;
}

function deriveSelectedTargets(query, verifiedEntities, explicitEntities) {
  const text = String(query || "").toLowerCase();
  const explicit = normalizeRecentEntities(explicitEntities, MAX_SELECTED_TARGETS);
  const verified = normalizeRecentEntities(verifiedEntities, MAX_MEMORY_ENTITIES);
  const asksForPrograms =
    /\b(program|programs|major|majors|compare|those two|both of them|first one|second one|the first|the second|other one)\b/.test(text);
  const asksForCourses =
    /\b(course|courses|subject|subjects|module|modules)\b/.test(text);
  const answerChoices = verified.filter(entity => {
    const type = String(entity.type || "").toLowerCase();
    if (asksForPrograms) return type === "program";
    if (asksForCourses) return ["course", "subject", "module"].includes(type);
    return false;
  });
  const distinctAnswerChoices = [];
  const seenAnswerChoices = new Set();
  for (const entity of answerChoices) {
    const key = `${String(entity.type || "").toLowerCase()}|${entity.canonicalValue}`;
    if (seenAnswerChoices.has(key)) continue;
    seenAnswerChoices.add(key);
    distinctAnswerChoices.push(entity);
  }

  if (distinctAnswerChoices.length >= 2) {
    return normalizeRecentEntities(distinctAnswerChoices, MAX_SELECTED_TARGETS);
  }

  return normalizeRecentEntities([
    ...explicit.filter(entity => {
      const type = String(entity.type || "").toLowerCase();
      return !["entity", "career", "role", "unit", "degree", "college"].includes(type);
    }),
    ...distinctAnswerChoices
  ], MAX_SELECTED_TARGETS);
}

function normalizeRecentTopics(topics, lastTopic = null) {
  const candidates = [
    ...(Array.isArray(topics) ? topics : []),
    lastTopic
  ];
  const seen = new Set();
  const normalized = [];

  for (const topic of candidates) {
    const value = normalizeMemoryText(topic, 60);
    const key = value?.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
    if (normalized.length >= MAX_MEMORY_TOPICS) break;
  }

  return normalized;
}

function normalizeVerifiedTurns(turns) {
  if (!Array.isArray(turns)) return [];

  const normalized = [];
  const seen = new Set();
  for (const turn of turns) {
    if (!turn || typeof turn !== "object") continue;
    const answer = normalizeMemoryText(turn.answer, MAX_VERIFIED_ANSWER_CHARS);
    if (!answer) continue;
    const turnId = normalizeMemoryText(turn.turnId, 128);
    const key = turnId || answer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      turnId,
      query: normalizeMemoryText(turn.query, 320),
      answer,
      topic: normalizeMemoryText(turn.topic, 80),
      intent: normalizeMemoryText(turn.intent, 80),
      relations: Array.from(new Set(
        (Array.isArray(turn.relations) ? turn.relations : [])
          .map(normalizeMemoryRelation)
          .filter(Boolean)
      )).slice(0, 8),
      entities: normalizeRecentSubjects(turn.entities).slice(0, 8),
      evidenceCount: Math.max(1, Number.parseInt(turn.evidenceCount, 10) || 1)
    });
    if (normalized.length >= MAX_VERIFIED_TURNS) break;
  }

  return normalized;
}

function normalizeRecentSubjects(subjects) {
  if (!Array.isArray(subjects)) return [];

  const seen = new Set();
  const normalized = [];

  for (const subject of subjects) {
    const value = normalizeMemoryText(subject);
    const key = value?.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
    if (normalized.length >= MAX_MEMORY_SUBJECTS) break;
  }

  return normalized;
}

function cloneMemory(memory) {
  return normalizeConversationMemory(memory);
}

function buildLightweightMemoryUpdate(currentMemory, turn = {}) {
  const userQuery = normalizeMemoryText(turn.userQuery || turn.normalizedQuery || "", 260) || "";
  const assistantAnswer = normalizeMemoryText(turn.assistantAnswer || "", MAX_MEMORY_SUMMARY_CHARS);
  const topic = detectTopic(userQuery, turn.route);
  const intent = normalizeMemoryText(turn.intent || turn.route || null, 80);
  const turnId = normalizeMemoryText(turn.turnId, 128);
  const evidenceItems = collectVerifiedEvidenceItems(turn);
  const evidenceTexts = evidenceItems.map(item => item.text);
  const verifiedEntities = extractEntitiesFromEvidence(evidenceItems, userQuery, turnId);
  const explicitEntities = extractEntitiesFromExplicitInputs(turn.entities, userQuery, turnId);
  const newEntities = normalizeRecentEntities([
    ...verifiedEntities,
    ...explicitEntities
  ]);
  const recentEntities = normalizeRecentEntities([
    ...newEntities,
    ...currentMemory.recentEntities
  ]);
  const selectedTargets = normalizeRecentEntities([
    ...deriveSelectedTargets(userQuery, verifiedEntities, explicitEntities),
    ...currentMemory.selectedTargets
  ], MAX_SELECTED_TARGETS);
  const subjects = mergeRecentSubjects(
    [
      ...extractSubjectsFromExplicitInputs(turn.entities),
      ...extractSubjectsFromQuery(userQuery),
      ...extractSubjectsFromEvidence(evidenceTexts)
    ],
    currentMemory.recentSubjects
  );
  const verifiedTurn = assistantAnswer && evidenceItems.length > 0
    ? {
        turnId,
        query: userQuery,
        answer: normalizeMemoryText(turn.assistantAnswer, MAX_VERIFIED_ANSWER_CHARS),
        topic,
        intent,
        relations: evidenceItems
          .map(item => item.structured?.relation)
          .filter(Boolean),
        entities: verifiedEntities.map(entity => entity.displayValue),
        evidenceCount: evidenceItems.length
      }
    : null;
  const verifiedTurns = normalizeVerifiedTurns([
    ...(verifiedTurn ? [verifiedTurn] : []),
    ...currentMemory.verifiedTurns
  ]);

  return {
    lastTopic: topic || currentMemory.lastTopic,
    recentTopics: normalizeRecentTopics(
      topic ? [topic, ...currentMemory.recentTopics] : currentMemory.recentTopics,
      currentMemory.lastTopic
    ),
    lastEntity: newEntities[0] || currentMemory.lastEntity,
    recentEntities,
    selectedTargets,
    lastIntent: intent || currentMemory.lastIntent,
    recentSubjects: subjects,
    lastAssistantSummary: assistantAnswer || currentMemory.lastAssistantSummary,
    lastVerifiedAssistantAnswer: verifiedTurn?.answer || currentMemory.lastVerifiedAssistantAnswer,
    verifiedTurns
  };
}

function detectTopic(query, route) {
  const text = `${query || ""} ${route || ""}`.toLowerCase();
  if (/\b(who teaches|teaches|teacher|instructor|professor|office|office hours)\b/.test(text)) return "teaching_staff";
  if (/\b(prerequisite|prerequisites|requires|required|requirement|gpa|grade point)\b/.test(text)) return "requirements";
  if (/\b(career|careers|job|jobs|role|roles|roadmap|pathway)\b/.test(text)) return "careers";
  if (/\b(program|specialization|specialisation|major|track|curriculum|study plan|course|courses|subjects)\b/.test(text)) return "program";
  if (/\b(tuition|fee|fees|scholarship|budget|cost)\b/.test(text)) return "fees";
  if (/\b(policy|regulation|deadline|admission|transfer)\b/.test(text)) return "policy";
  return normalizeMemoryText(route, 60);
}

function collectVerifiedEvidenceItems(turn = {}) {
  const items = [];
  const seen = new Set();

  const pushText = (value, evidenceSource, structured = null) => {
    const text = normalizeMemoryText(value, 600);
    if (!text) return;
    const evidenceId = normalizeMemoryText(structured?.evidenceId, 260);
    const key = evidenceId || `${evidenceSource}|${text.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ text, evidenceSource, structured });
  };

  const pushContextItem = (item, evidenceSource) => {
    if (!item) return;
    if (typeof item === "string") return pushText(item, evidenceSource);
    if (typeof item !== "object") return;
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
    const relation = normalizeMemoryRelation(
      metadata.evidence_relation ||
      metadata.relation ||
      item.relType
    );
    const subject = normalizeRelatedEntity(
      metadata.evidence_subject ||
      (item.relSourceName ? { value: item.relSourceName, type: item.relSourceLabel } : null)
    );
    const object = normalizeRelatedEntity(
      metadata.evidence_object ||
      (item.relTargetName ? { value: item.relTargetName, type: item.relTargetLabel } : null)
    );
    const structured = relation && subject && object
      ? {
          evidenceId: metadata.evidence_id || null,
          relation,
          subject,
          object
        }
      : null;
    pushText(
      item.evidence ||
      item.text ||
      item.content ||
      item.answer ||
      item.recommendation ||
      item.career_path,
      evidenceSource,
      structured
    );
  };

  if (turn.faqContext?.answer) pushText(turn.faqContext.answer, "verified_faq");

  const kgContext = Array.isArray(turn.neo4jContext) ? turn.neo4jContext : [];
  kgContext.forEach(item => pushContextItem(item, "verified_kg"));

  // Golden-path cache hits retain the response graph even when the live
  // neo4jContext array is unavailable. Feed those exact relationships through
  // the same typed-memory path so ordinals and plural references remain stable.
  const graphNodes = Array.isArray(turn.graph?.nodes) ? turn.graph.nodes : [];
  const graphNodeById = new Map();
  graphNodes.forEach(node => {
    const id = normalizeMemoryText(node?.id || node?.label || node?.name, 260);
    if (id) graphNodeById.set(id, node);
  });
  const graphLinks = Array.isArray(turn.graph?.links) ? turn.graph.links : [];
  graphLinks.forEach(link => {
    const source = normalizeMemoryText(
      typeof link?.source === "object"
        ? link.source.label || link.source.name || link.source.id
        : link?.source,
      260
    );
    const object = normalizeMemoryText(
      typeof link?.target === "object"
        ? link.target.label || link.target.name || link.target.id
        : link?.target,
      260
    );
    const relation = normalizeMemoryRelation(link?.type || link?.relation);
    if (!source || !object || !relation) return;
    const sourceNode = graphNodeById.get(source);
    const objectNode = graphNodeById.get(object);
    pushContextItem({
      evidence: `(${source})-[:${relation}]->(${object})`,
      relSourceName: source,
      relSourceLabel: sourceNode?.type || sourceNode?.label || null,
      relTargetName: object,
      relTargetLabel: objectNode?.type || objectNode?.label || null,
      relType: relation
    }, "verified_kg");
  });

  const ragContext = Array.isArray(turn.ragContext) ? turn.ragContext : [];
  ragContext.forEach(item => pushContextItem(item, "verified_rag"));

  const decisionContext = Array.isArray(turn.decisionContext)
    ? turn.decisionContext
    : turn.decisionContext
      ? [turn.decisionContext]
      : [];
  decisionContext.forEach(item => pushContextItem(item, "decision_engine"));

  const usedFacts = Array.isArray(turn.usedFacts) ? turn.usedFacts : [];
  usedFacts.forEach(item => pushText(item, "verified_fact"));

  return items;
}

// Graph nodes without a specific label arrive typed "Entity". That generic type must
// not override the type implied by the relation (for example INCLUDES_PROGRAM -> program).
function specificMemoryType(type) {
  const value = normalizeMemoryText(type, 40);
  return value && !/^(entity|node|thing|unknown)$/i.test(value) ? value : null;
}

function extractEntitiesFromEvidence(evidenceItems, query, turnId) {
  const entities = [];
  const queryText = String(query || "").toLowerCase();

  for (const item of evidenceItems) {
    const evidence = item?.text || "";
    const evidenceSource = item?.evidenceSource || "verified_fact";
    if (item?.structured?.relation && item.structured.subject && item.structured.object) {
      const relation = normalizeMemoryRelation(item.structured.relation);
      const inferred = inferEntityTypesForRelation(relation);
      const sourceType = specificMemoryType(item.structured.subject.type) || inferred.sourceType;
      const targetType = specificMemoryType(item.structured.object.type) || inferred.targetType;
      entities.push(
        makeMemoryEntity(sourceType, item.structured.subject.displayValue, evidenceSource, {
          relation,
          relationRole: "source",
          relatedEntity: {
            type: targetType,
            displayValue: item.structured.object.displayValue
          },
          turnId
        }),
        makeMemoryEntity(targetType, item.structured.object.displayValue, evidenceSource, {
          relation,
          relationRole: "target",
          relatedEntity: {
            type: sourceType,
            displayValue: item.structured.subject.displayValue
          },
          turnId
        })
      );
      continue;
    }

    const triple = parseGraphTriple(evidence);
    if (triple) {
      const relation = triple.relation.toUpperCase();
      const { sourceType, targetType } = inferEntityTypesForRelation(relation);
      entities.push(
        makeMemoryEntity(sourceType, triple.source, evidenceSource, {
          relation,
          relationRole: "source",
          relatedEntity: {
            type: targetType,
            displayValue: triple.target
          },
          turnId
        }),
        makeMemoryEntity(targetType, triple.target, evidenceSource, {
          relation,
          relationRole: "target",
          relatedEntity: {
            type: sourceType,
            displayValue: triple.source
          },
          turnId
        })
      );
      continue;
    }

    const teaches = evidence.match(/^(.+?)\s+teaches\s+(.+?)(?:\.|$)/i);
    if (teaches) {
      const professor = cleanEvidenceEntityLabel(teaches[1]);
      for (const course of splitEvidenceEntityList(teaches[2])) {
        entities.push(
          makeMemoryEntity("professor", professor, evidenceSource, {
            relation: "TEACHES",
            relatedEntity: { type: "course", displayValue: course },
            turnId
          }),
          makeMemoryEntity("course", course, evidenceSource, {
            relation: "TEACHES",
            relatedEntity: { type: "professor", displayValue: professor },
            turnId
          })
        );
      }
      continue;
    }

    const office = evidence.match(/^(.+?)\s+(?:office|office location|room)\s*[:is-]+\s*(.+)$/i);
    if (office || /\b(his|her|their)\s+office\b/i.test(queryText)) {
      const subject = cleanEvidenceEntityLabel(office?.[1]);
      const location = cleanEvidenceEntityLabel(office?.[2]);
      if (subject) {
        entities.push(makeMemoryEntity("professor", subject, evidenceSource, {
          relation: "HAS_OFFICE",
          relatedEntity: location ? { type: "location", displayValue: location } : null,
          turnId
        }));
      }
      continue;
    }

    const recommended = evidence.match(/\bRecommended Major:\s*([^.;\n]+)/i);
    if (recommended) {
      entities.push(makeMemoryEntity("program", recommended[1], evidenceSource, {
        relation: "RECOMMENDED",
        turnId
      }));
    }
  }

  return normalizeRecentEntities(entities.filter(Boolean), MAX_EVIDENCE_ENTITIES_PER_TURN);
}

function extractEntitiesFromExplicitInputs(entities = [], query = "", turnId = null) {
  const explicitInputs = Array.isArray(entities) ? entities : [];
  const records = explicitInputs
    .map(entity => normalizeExplicitEntity(entity, turnId))
    .filter(Boolean);

  if (records.length === 0) {
    records.push(
      ...extractSubjectsFromQuery(query)
        .map(value => makeMemoryEntity(inferExplicitEntityType(value), value, "explicit_user", {
          turnId
        }))
        .filter(Boolean)
    );
  }

  return normalizeRecentEntities(records);
}

function normalizeExplicitEntity(entity, turnId) {
  if (!entity) return null;
  if (typeof entity === "object") {
    const displayValue = entity.displayValue || entity.value || entity.name || entity.label;
    if (!displayValue) return null;
    return makeMemoryEntity(
      entity.type || inferExplicitEntityType(displayValue),
      displayValue,
      "explicit_user",
      {
        relation: entity.relation,
        relatedEntity: entity.relatedEntity || entity.related,
        turnId: entity.turnId || turnId
      }
    );
  }

  return makeMemoryEntity(inferExplicitEntityType(entity), entity, "explicit_user", {
    turnId
  });
}

function inferExplicitEntityType(value) {
  const text = String(value || "");
  if (/\b(professor|prof\.?|dr\.?|doctor)\b/i.test(text)) return "professor";
  if (/\b(course|nlp|natural language processing|machine learning|blockchain|[A-Z]{2,5}\s?\d{3,4})\b/i.test(text)) {
    return "course";
  }
  if (/^(the\s+)?(college|faculty|school|university|bachelor|bsc|b\.sc)\b/i.test(text.trim())) return "entity";
  if (/\b(program|specialization|specialisation|major|track|computer science|software engineering|artificial intelligence|ai)\b/i.test(text)) {
    return "program";
  }
  return "entity";
}

function inferEntityTypesForRelation(relation) {
  const normalized = normalizeMemoryRelation(relation);
  if (normalized === "TEACHES") return { sourceType: "professor", targetType: "course" };
  if (["WORKS_IN", "HAS_DEPARTMENT", "BELONGS_TO_DEPARTMENT"].includes(normalized)) {
    return { sourceType: "professor", targetType: "department" };
  }
  if (["HAS_OFFICE", "OFFICE_IN", "LOCATED_IN"].includes(normalized)) {
    return { sourceType: "professor", targetType: "location" };
  }
  if (["SPECIALIZES_IN", "HAS_SPECIALIZATION"].includes(normalized)) {
    return { sourceType: "professor", targetType: "specialization" };
  }
  if (["HAS_PREREQUISITE", "REQUIRES", "PREREQUISITE_FOR"].includes(normalized)) {
    return { sourceType: "course", targetType: "course" };
  }
  if (normalized === "RECOMMENDED_AFTER") return { sourceType: "course", targetType: "course" };
  if (normalized === "HAS_COURSE") return { sourceType: "program", targetType: "course" };
  if (normalized === "INCLUDES_PROGRAM") return { sourceType: "degree", targetType: "program" };
  if (normalized === "OFFERS") return { sourceType: "college", targetType: "degree" };
  if (["LEADS_TO", "CAREER_ALIGNMENT"].includes(normalized)) {
    return { sourceType: "program", targetType: "career" };
  }
  if (["DEAN_OF", "HEAD_OF", "HEAD_OF_UNIT"].includes(normalized)) {
    return { sourceType: "person", targetType: normalized === "DEAN_OF" ? "college" : "unit" };
  }
  if (["HAS_ROLE", "ACTS_AS"].includes(normalized)) {
    return { sourceType: "person", targetType: "role" };
  }
  if (["BELONGS_TO", "PART_OF"].includes(normalized)) {
    return { sourceType: "course", targetType: "program" };
  }
  return { sourceType: "entity", targetType: "entity" };
}

function splitEvidenceEntityList(value) {
  return String(value || "")
    .split(/\s*(?:,|;|\band\b|&)\s*/i)
    .map(cleanEvidenceEntityLabel)
    .filter(Boolean);
}

function cleanEvidenceEntityLabel(value) {
  return normalizeMemoryText(
    String(value || "")
      .replace(/^(?:professor|prof\.?|dr\.?|doctor)\s+/i, "")
      .replace(/\s+(?:at|in)\s+AAST(?:MT)?$/i, "")
  );
}

function parseGraphTriple(text) {
  const match = String(text || "").match(/\(([^()]+)\)\s*-+\s*\[\s*:?\s*([A-Za-z0-9_]+(?::[A-Za-z0-9_]+)?)\s*\]\s*-+>\s*\(([^()]+)\)/);
  if (!match) return null;

  return {
    source: cleanGraphLabel(match[1]),
    relation: match[2].split(":").pop(),
    target: cleanGraphLabel(match[3])
  };
}

function cleanGraphLabel(value) {
  let text = String(value || "").trim();
  const quoted = text.match(/"([^"]+)"/) || text.match(/'([^']+)'/);
  if (quoted) return quoted[1].trim();
  const property = text.match(/\b(?:name|title|code|id)\s*:\s*["']?([^"',}]+)["']?/i);
  if (property) return property[1].trim();
  if (text.includes(":")) text = text.split(":").pop();
  return text.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function makeMemoryEntity(type, value, source, {
  relation = null,
  relationRole = null,
  relatedEntity = null,
  turnId = null
} = {}) {
  const displayValue = normalizeMemoryText(value);
  if (!displayValue) return null;
  const evidenceSource = normalizeMemoryText(source, 40) || "session";

  return {
    type: normalizeMemoryText(type, 40) || "entity",
    canonicalValue: normalizeCanonicalEntityValue(displayValue),
    displayValue,
    value: displayValue,
    relation: normalizeMemoryRelation(relation),
    relationRole: ["source", "target"].includes(relationRole) ? relationRole : null,
    relatedEntity: normalizeRelatedEntity(relatedEntity),
    turnId: normalizeMemoryText(turnId, 128),
    evidenceSource,
    source: evidenceSource
  };
}

function extractSubjectsFromExplicitInputs(entities = []) {
  if (!Array.isArray(entities)) return [];
  return entities
    .map(entity => {
      if (typeof entity === "string") return normalizeMemoryText(entity);
      if (!entity || typeof entity !== "object") return null;
      return normalizeMemoryText(
        entity.displayValue || entity.value || entity.name || entity.label || entity.canonicalValue
      );
    })
    .filter(Boolean);
}

function extractSubjectsFromQuery(query = "") {
  const text = String(query || "");
  const subjects = [];

  const add = (value) => {
    const subject = normalizeMemoryText(value);
    if (subject) subjects.push(subject);
  };

  const prereqMatch = text.match(/\b([A-Z]{2,5}|Computer Science|CS|Software Engineering|Artificial Intelligence|AI)\s+prerequisites?\b/i);
  if (prereqMatch) add(`${prereqMatch[1].toUpperCase() === "CS" ? "CS" : prereqMatch[1]} prerequisites`);

  const courseCodes = text.match(/\b[A-Z]{2,5}\s?\d{3,4}\b/g) || [];
  courseCodes.forEach(add);

  const knownSubjects = [
    "Machine Learning",
    "Blockchain",
    "Natural Language Processing",
    "NLP",
    "Artificial Intelligence",
    "AI specialization",
    "AI",
    "Computer Science",
    "CS",
    "Software Engineering",
    "Cybersecurity",
    "Data Science",
    "Computer Engineering"
  ];

  for (const subject of knownSubjects) {
    const pattern = new RegExp(`\\b${escapeRegex(subject)}\\b`, "i");
    if (pattern.test(text)) add(subject);
  }

  return subjects;
}

function extractSubjectsFromEvidence(evidenceTexts = []) {
  const subjects = [];

  for (const evidence of evidenceTexts) {
    const triple = parseGraphTriple(evidence);
    if (triple?.target) {
      const relation = triple.relation.toUpperCase();
      if (relation === "TEACHES") subjects.push(triple.target);
      else if (["HAS_PREREQUISITE", "REQUIRES", "PREREQUISITE_FOR"].includes(relation)) subjects.push(triple.source);
      else if (!["WORKS_IN", "HAS_OFFICE", "OFFICE_IN", "LOCATED_IN", "HAS_DEPARTMENT", "BELONGS_TO_DEPARTMENT"].includes(relation)) subjects.push(triple.target);
    }

    const teaches = evidence.match(/^(.+?)\s+teaches\s+(.+?)(?:\.|$)/i);
    if (teaches) subjects.push(teaches[2]);

    const recommended = evidence.match(/\bRecommended Major:\s*([^.;\n]+)/i);
    if (recommended) subjects.push(recommended[1]);
  }

  return subjects.map(subject => normalizeMemoryText(subject)).filter(Boolean);
}

function mergeRecentSubjects(newSubjects, existingSubjects) {
  return normalizeRecentSubjects([
    ...newSubjects,
    ...(Array.isArray(existingSubjects) ? existingSubjects : [])
  ]);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeMessage(message, fallbackDate) {
  const role = normalizeRole(message?.role);
  const content = message?.content ?? message?.text ?? "";
  const createdAt = normalizeDate(message?.createdAt || message?.timestamp || message?.time) ||
    normalizeDate(fallbackDate) ||
    new Date().toISOString();

  return {
    id: message?.id || makeMessageId(),
    role,
    content: String(content),
    createdAt
  };
}

function normalizeRole(role) {
  return ["system", "user", "assistant", "tool"].includes(role) ? role : "assistant";
}

function maybeGenerateTitle(convo, content) {
  if (convo.titleSource === "manual" || convo.titleGenerated) return;

  const generated = generateConversationTitle(content);
  if (!generated) return;

  convo.title = generated;
  convo.titleGenerated = true;
  convo.titleSource = "auto";
  convo.titleGeneratedAt = new Date().toISOString();
}

function sanitizeTitle(title) {
  if (typeof title !== "string") return "";
  return title.replace(/\s+/g, " ").trim().slice(0, 80);
}

function getPreview(convo) {
  const last = [...convo.messages].reverse().find(message => message.role !== "system");
  if (!last?.content) return "";
  return last.content.replace(/\s+/g, " ").trim().slice(0, 120);
}

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value === "number") return new Date(value).toISOString();

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function makeMessageId() {
  return `msg_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function persistSoon() {
  persistence.scheduleSave({
    version: 2,
    updatedAt: new Date().toISOString(),
    conversations: Object.fromEntries(conversations)
  });
}

function normalizeOwnerId(ownerId) {
  if (typeof ownerId !== "string") return null;
  const normalized = ownerId.trim();
  return normalized && normalized.length <= 256 ? normalized : null;
}

function requireOwnerId(ownerId) {
  const normalized = normalizeOwnerId(ownerId);
  if (!normalized) throw new Error("A valid conversation owner is required");
  return normalized;
}

function ensureLoaded() {
  if (!loaded) {
    throw new Error("Conversation store has not been loaded. Call loadConversations() during startup.");
  }
}
