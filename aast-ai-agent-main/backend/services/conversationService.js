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
const MAX_MEMORY_FIELD_CHARS = 140;
const MAX_MEMORY_SUMMARY_CHARS = 220;

const DATA_FILE = process.env.CONVERSATIONS_FILE ||
  path.resolve(__dirname, "../data/conversations.json");

const SYSTEM_PROMPT =
  "You are the AAST University Assistant. Use only verified knowledge from the Graph. If not found, say \"I don't have that information in the knowledge graph.\"";

const persistence = createJsonPersistence({
  filePath: DATA_FILE,
  defaultValue: () => ({
    version: 1,
    updatedAt: new Date().toISOString(),
    conversations: {}
  }),
  debounceMs: Number(process.env.CONVERSATION_SAVE_DEBOUNCE_MS || 500),
  logLabel: "conversation-store"
});

const conversations = new Map();
let loaded = false;

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

export async function getConversation(cid) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid) || makeConversationId();
  let convo = conversations.get(normalizedCid);

  if (!convo) {
    convo = buildFreshConversation(normalizedCid);
    conversations.set(normalizedCid, convo);
    persistSoon();
  }

  convo.lastActive = Date.now();
  convo.updatedAt = new Date().toISOString();
  persistSoon();

  return convo;
}

export function createConversation() {
  ensureLoaded();

  const cid = makeConversationId();
  const convo = buildFreshConversation(cid);
  conversations.set(cid, convo);
  persistSoon();

  return serializeConversation(convo, { includeMessages: true });
}

export async function saveConversation(cid, convo) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid || !convo) return null;

  const existing = conversations.get(normalizedCid) || buildFreshConversation(normalizedCid);
  const updated = normalizeConversation(normalizedCid, {
    ...existing,
    ...convo,
    cid: normalizedCid,
    updatedAt: new Date().toISOString(),
    lastActive: Date.now()
  });

  conversations.set(normalizedCid, updated);
  persistSoon();

  return updated;
}

export async function pushTurn(cid, convo, role, content) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid) throw new Error("Invalid conversation id");

  const target = conversations.get(normalizedCid) || normalizeConversation(normalizedCid, convo);
  if (!conversations.has(normalizedCid)) conversations.set(normalizedCid, target);

  const message = normalizeMessage({ role, content }, target.updatedAt);
  target.messages.push(message);

  if (role === "user") maybeGenerateTitle(target, content);

  target.lastActive = Date.now();
  target.updatedAt = new Date().toISOString();
  persistSoon();

  return target;
}

export function getConversationMemory(cid) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid);
  const convo = normalizedCid ? conversations.get(normalizedCid) : null;
  return cloneMemory(convo?.conversationMemory);
}

export async function updateConversationMemoryFromTurn(cid, convo, turn = {}) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid) throw new Error("Invalid conversation id");

  const target = conversations.get(normalizedCid) || normalizeConversation(normalizedCid, convo);
  if (!conversations.has(normalizedCid)) conversations.set(normalizedCid, target);

  const current = normalizeConversationMemory(target.conversationMemory);
  const update = buildLightweightMemoryUpdate(current, turn);
  target.conversationMemory = normalizeConversationMemory({
    ...current,
    ...update
  });

  target.updatedAt = new Date().toISOString();
  target.lastActive = Date.now();
  persistSoon();

  return cloneMemory(target.conversationMemory);
}

export async function updateSystemPrompt(cid, convo, content) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid) throw new Error("Invalid conversation id");

  const target = conversations.get(normalizedCid) || normalizeConversation(normalizedCid, convo);
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

export function getConversationContext(cid, maxTurns = MAX_CONTEXT_TURNS) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid);
  const convo = normalizedCid ? conversations.get(normalizedCid) : null;
  if (!convo) return buildFreshConversation(normalizedCid || makeConversationId()).messages;

  const system = convo.messages.find(m => m.role === "system") ||
    normalizeMessage({ role: "system", content: SYSTEM_PROMPT }, convo.createdAt);
  const nonSystem = convo.messages.filter(m => m.role !== "system");
  const tail = nonSystem.slice(-Math.max(maxTurns - 1, 1));

  return [system, ...tail].map(message => ({
    role: message.role,
    content: message.content
  }));
}

export function listConversations({ search = "" } = {}) {
  ensureLoaded();

  const q = search.trim().toLowerCase();
  return [...conversations.values()]
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

export function getConversationById(cid, { includeMessages = true } = {}) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid) return null;

  const convo = conversations.get(normalizedCid);
  return convo ? serializeConversation(convo, { includeMessages }) : null;
}

export async function renameConversation(cid, title) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid);
  const convo = normalizedCid ? conversations.get(normalizedCid) : null;
  if (!convo) return null;

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

export async function pinConversation(cid, pinned = true) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid);
  const convo = normalizedCid ? conversations.get(normalizedCid) : null;
  if (!convo) return null;

  convo.pinned = Boolean(pinned);
  convo.updatedAt = new Date().toISOString();
  persistSoon();

  return serializeConversation(convo);
}

export async function deleteConversation(cid) {
  ensureLoaded();

  const normalizedCid = normalizeConversationId(cid);
  if (!normalizedCid) return false;

  const deleted = conversations.delete(normalizedCid);
  if (deleted) persistSoon();
  return deleted;
}

export function getConversationSummary(cid) {
  return getConversationById(cid, { includeMessages: false });
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

function buildFreshConversation(cid) {
  const now = new Date().toISOString();
  return {
    cid,
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
    lastEntity: null,
    lastIntent: null,
    recentSubjects: [],
    lastAssistantSummary: null
  };
}

function normalizeConversationMemory(memory = {}) {
  const raw = memory && typeof memory === "object" ? memory : {};
  return {
    lastTopic: normalizeMemoryText(raw.lastTopic),
    lastEntity: normalizeMemoryEntity(raw.lastEntity),
    lastIntent: normalizeMemoryText(raw.lastIntent),
    recentSubjects: normalizeRecentSubjects(raw.recentSubjects),
    lastAssistantSummary: normalizeMemoryText(raw.lastAssistantSummary, MAX_MEMORY_SUMMARY_CHARS)
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
    const value = normalizeMemoryText(entity);
    return value ? { type: "entity", value, source: "legacy" } : null;
  }

  if (typeof entity !== "object") return null;

  const value = normalizeMemoryText(entity.value || entity.name || entity.label);
  if (!value) return null;

  return {
    type: normalizeMemoryText(entity.type || "entity", 40) || "entity",
    value,
    source: normalizeMemoryText(entity.source || "session", 40) || "session"
  };
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
  const evidenceTexts = collectVerifiedEvidenceTexts(turn);
  const entity = extractEntityFromEvidence(evidenceTexts, userQuery) ||
    extractEntityFromExplicitInputs(turn.entities, userQuery);
  const subjects = mergeRecentSubjects(
    [
      ...extractSubjectsFromExplicitInputs(turn.entities),
      ...extractSubjectsFromQuery(userQuery),
      ...extractSubjectsFromEvidence(evidenceTexts)
    ],
    currentMemory.recentSubjects
  );

  return {
    lastTopic: topic || currentMemory.lastTopic,
    lastEntity: entity || currentMemory.lastEntity,
    lastIntent: intent || currentMemory.lastIntent,
    recentSubjects: subjects,
    lastAssistantSummary: assistantAnswer || currentMemory.lastAssistantSummary
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

function collectVerifiedEvidenceTexts(turn = {}) {
  const texts = [];

  const pushText = (value) => {
    const text = normalizeMemoryText(value, 600);
    if (text) texts.push(text);
  };

  const pushContextItem = (item) => {
    if (!item) return;
    if (typeof item === "string") return pushText(item);
    if (typeof item !== "object") return;
    pushText(item.evidence || item.text || item.content || item.answer || item.recommendation || item.career_path);
  };

  if (turn.faqContext?.answer) pushText(turn.faqContext.answer);

  const kgContext = Array.isArray(turn.neo4jContext) ? turn.neo4jContext : [];
  kgContext.forEach(pushContextItem);

  const ragContext = Array.isArray(turn.ragContext) ? turn.ragContext : [];
  ragContext.forEach(pushContextItem);

  const decisionContext = Array.isArray(turn.decisionContext)
    ? turn.decisionContext
    : turn.decisionContext
      ? [turn.decisionContext]
      : [];
  decisionContext.forEach(pushContextItem);

  const usedFacts = Array.isArray(turn.usedFacts) ? turn.usedFacts : [];
  usedFacts.forEach(pushText);

  return texts;
}

function extractEntityFromEvidence(evidenceTexts, query) {
  const queryText = String(query || "").toLowerCase();

  for (const evidence of evidenceTexts) {
    const triple = parseGraphTriple(evidence);
    if (triple) {
      const relation = triple.relation.toUpperCase();
      if (relation === "TEACHES") {
        return makeMemoryEntity("professor", triple.source, "verified_kg");
      }
      if (["WORKS_IN", "HAS_OFFICE", "OFFICE_IN", "LOCATED_IN", "HAS_DEPARTMENT", "BELONGS_TO_DEPARTMENT", "SPECIALIZES_IN", "HAS_SPECIALIZATION"].includes(relation)) {
        return makeMemoryEntity("professor", triple.source, "verified_kg");
      }
      if (["HAS_PREREQUISITE", "REQUIRES", "PREREQUISITE_FOR"].includes(relation)) {
        return makeMemoryEntity("course", triple.source, "verified_kg");
      }
      if (["HAS_COURSE", "BELONGS_TO", "PART_OF"].includes(relation)) {
        return makeMemoryEntity("program", triple.source, "verified_kg");
      }
    }

    const teaches = evidence.match(/^(.+?)\s+teaches\s+(.+?)(?:\.|$)/i);
    if (teaches) return makeMemoryEntity("professor", teaches[1], "verified_kg");

    const office = evidence.match(/^(.+?)\s+(?:office|office location|room)\s*[:is-]+\s*(.+)$/i);
    if (office || /\b(his|her|their)\s+office\b/i.test(queryText)) {
      const subject = office?.[1];
      const entity = makeMemoryEntity("professor", subject, "verified_kg");
      if (entity) return entity;
    }

    const recommended = evidence.match(/\bRecommended Major:\s*([^.;\n]+)/i);
    if (recommended) return makeMemoryEntity("program", recommended[1], "decision_engine");
  }

  return null;
}

function extractEntityFromExplicitInputs(entities = [], query = "") {
  const explicit = extractSubjectsFromExplicitInputs(entities)[0] ||
    extractSubjectsFromQuery(query)[0];
  if (!explicit) return null;

  if (/\b(professor|dr\.?|doctor)\b/i.test(explicit)) {
    return makeMemoryEntity("professor", explicit, "explicit_user");
  }
  if (/\b(course|nlp|natural language processing|[A-Z]{2,5}\s?\d{3,4})\b/i.test(explicit)) {
    return makeMemoryEntity("course", explicit, "explicit_user");
  }
  if (/\b(program|specialization|specialisation|major|track|computer science|software engineering|artificial intelligence|ai)\b/i.test(explicit)) {
    return makeMemoryEntity("program", explicit, "explicit_user");
  }

  return makeMemoryEntity("entity", explicit, "explicit_user");
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

function makeMemoryEntity(type, value, source) {
  const cleanValue = normalizeMemoryText(value);
  if (!cleanValue) return null;
  return {
    type: normalizeMemoryText(type, 40) || "entity",
    value: cleanValue,
    source: normalizeMemoryText(source, 40) || "session"
  };
}

function extractSubjectsFromExplicitInputs(entities = []) {
  if (!Array.isArray(entities)) return [];
  return entities.map(entity => normalizeMemoryText(entity)).filter(Boolean);
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
    version: 1,
    updatedAt: new Date().toISOString(),
    conversations: Object.fromEntries(conversations)
  });
}

function ensureLoaded() {
  if (!loaded) {
    throw new Error("Conversation store has not been loaded. Call loadConversations() during startup.");
  }
}
