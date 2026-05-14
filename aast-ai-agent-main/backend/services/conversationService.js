import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createJsonPersistence } from "./persistenceLayer.js";
import { DEFAULT_TITLE, generateConversationTitle } from "./titleGenerator.js";
import { logger } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MAX_CONTEXT_TURNS = Number(process.env.MAX_CONTEXT_TURNS || 12);

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
    lastRoute: null
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
    lastRoute: raw.lastRoute || null
  };
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
