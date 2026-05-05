// orchestrator.js

import dotenv from "dotenv";
dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { createClient } from "redis";

import chatbotRouter from "./routes/chatbot.js";
import decisionRouter from "./routes/decision.js";
import createHealthRouter from "./routes/health.js";
import { searchFAQ } from "./faqService.js";
import { checkGreeting } from "./greetings.js";
import { fetchNeo4jContext, convertToGraphData } from "./services/neo4jcontext.js";
import { connectNeo4j, getSession } from "./db/neo4j.js";
import { getRecommendation, getUserMemory, buildCareerRoadmap, compareMajors, updateUserMemory } from "./services/decisionService.js";
import { incrementMetric, recordDuration } from "./services/metrics.js";
import { logger } from "./services/logger.js";
import { generateUnifiedAnswer } from "./services/unifiedAnswerService.js";
// PHASE 4: AGENTIC CORE IMPORTS
import brainRouter from "./services/brainRouter.js";
import fusionService from "./services/fusionService.js";
import ragService from "./services/ragService.js";
import { checkSubsystemHealth, timeoutWrapper } from "./services/healthProbes.js";
import responseFormatter from "./services/responseFormatter.js";

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 8004;

// Security check for Internal Secret
const INTERNAL_SECRET = process.env.INTERNAL_SECRET_KEY;
if (!INTERNAL_SECRET) {
  throw new Error("CRITICAL: INTERNAL_SECRET_KEY is missing from environment variables.");
}

/* ============================================================
   📁 LOGGING SYSTEM
=========================================================== */

const LOG_DIR = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const QUERY_LOG = path.join(LOG_DIR, "chat.log");

function logToFile(text) {
  const timestamp = new Date().toLocaleString();
  const entry = `[${timestamp}] ${text}\n`;
  logger.info("Chat audit event", { event: text });

  fs.promises.stat(QUERY_LOG)
    .then(stats => {
      if (stats.size < Number(process.env.CHAT_LOG_MAX_BYTES || 5 * 1024 * 1024)) return;
      return fs.promises.rename(QUERY_LOG, QUERY_LOG.replace(/\.log$/, `-${Date.now()}.log`));
    })
    .catch(err => {
      if (err.code !== "ENOENT") {
        logger.warn("Chat log rotation check failed", { error: err.message });
      }
    })
    .then(() => fs.promises.appendFile(QUERY_LOG, entry, "utf8"))
    .catch(err => {
      logger.error("Chat log write failed", { error: err.message });
    });
}

function makeId() {
  return Math.random().toString(16).slice(2, 10);
}

app.use(cors());
app.use(bodyParser.json());

// TASK 1 — SAFE NEO4J SINGLETON INITIALIZATION (prevents duplicate connections on hot reload)
if (!global.neo4jInitialized) {
  try {
    await connectNeo4j();
    global.neo4jInitialized = true;
    console.log("✅ Neo4j connected successfully");
  } catch (neo4jErr) {
    console.error("❌ Neo4j connection failed on startup:", neo4jErr.message);
    logger.error("Neo4j startup connection failed", { error: neo4jErr.message });
    // Allow server to start; individual queries will degrade gracefully
  }
} else {
  console.log("♻️ Neo4j already initialized — skipping duplicate connect");
}

// Routes
app.use("/api/chatbot/legacy", chatbotRouter);
app.use("/api/decision", decisionRouter);

/* ============================================================
   🧠 CONVERSATION MEMORY & CACHE (REDIS PRODUCTION VERSION)
=========================================================== */

// TASK 2 & 9 — REDIS DEGRADED MODE: in-memory fallback when Redis is unavailable
const inMemoryStore = new Map(); // fallback store
let redisAvailable = false;

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisClient.on("error", err => {
  logger.error("Redis Client Error", { error: err.message });
});

try {
  await redisClient.connect();
  redisAvailable = true;
  console.log("✅ Redis connected successfully");
} catch (redisErr) {
  redisAvailable = false;
  console.warn("⚠️ Redis unavailable — operating in degraded in-memory mode:", redisErr.message);
  logger.warn("Redis connection failed; using in-memory fallback", { error: redisErr.message });
}

const CACHE_TTL = 5 * 60 * 1000; // 5 min
const MAX_TURNS = 12;
const SESSION_TTL_SECONDS = 60 * 60 * 3; // 3 hours

// TASK 10 — DEAD CODE REVIEW
// embedQuery and cosineSimilarity are retained for potential future semantic cache use
// but are NOT called in the active pipeline. Marked clearly to avoid confusion.
/* [UNUSED — reserved for semantic cache phase]
async function embedQuery(text) { ... }
function cosineSimilarity(a, b) { ... }
*/

function buildFreshConversation() {
  return {
    messages: [
      {
        role: "system",
        content:
          `You are the AAST University Assistant. Use only verified knowledge from the Graph. If not found, say "I don't have that information in the knowledge graph."`
      }
    ],
    lastActive: Date.now()
  };
}

// TASK 9 — REDIS-AWARE HELPERS: seamless Redis / in-memory dual-mode operation
async function saveConversation(cid, convo) {
  convo.lastActive = Date.now();
  if (redisAvailable) {
    try {
      await redisClient.set(
        `conversation:${cid}`,
        JSON.stringify(convo),
        { EX: SESSION_TTL_SECONDS }
      );
      return;
    } catch (err) {
      logger.warn("saveConversation Redis write failed, falling back to memory", { cid, error: err.message });
    }
  }
  // In-memory fallback with TTL eviction
  inMemoryStore.set(cid, { data: convo, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
}

async function getConversation(cid) {
  try {
    if (redisAvailable) {
      const existing = await redisClient.get(`conversation:${cid}`);
      if (existing) {
        const convo = JSON.parse(existing);
        convo.lastActive = Date.now();
        await saveConversation(cid, convo);
        return convo;
      }
    } else {
      // In-memory fallback read with TTL check
      const entry = inMemoryStore.get(cid);
      if (entry && entry.expiresAt > Date.now()) {
        entry.data.lastActive = Date.now();
        return entry.data;
      } else if (entry) {
        inMemoryStore.delete(cid); // evict expired
      }
    }
    const fresh = buildFreshConversation();
    await saveConversation(cid, fresh);
    return fresh;
  } catch (err) {
    logger.error("Conversation retrieval failed", { cid, error: err.message });
    return buildFreshConversation();
  }
}

async function pushTurn(cid, convo, role, content) {
  convo.messages.push({ role, content });
  if (convo.messages.length > MAX_TURNS) {
    const system = convo.messages[0];
    const tail = convo.messages.slice(-(MAX_TURNS - 1));
    convo.messages = [system, ...tail];
  }
  await saveConversation(cid, convo);
}

// TASK 10 — updateSystemPrompt is retained but currently unused in active pipeline
// Kept for future system-prompt injection features
async function updateSystemPrompt(cid, convo, content) {
  const systemIdx = convo.messages.findIndex(m => m.role === "system");
  if (systemIdx !== -1) {
    convo.messages[systemIdx].content = content;
  } else {
    convo.messages.unshift({ role: "system", content });
  }
  await saveConversation(cid, convo);
}

/* ============================================================
   🧠 OLLAMA INTENT CLASSIFIER (HARDENED)
=========================================================== */

// TASK 3 — INTENT CACHE: strict size cap + TTL + LRU-style eviction
const INTENT_CACHE_MAX = 200;
const INTENT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const intentCache = new Map();
const neo4jCache = new Map();

/** Prune expired AND excess entries from intentCache (LRU-style: oldest first) */
function pruneIntentCache() {
  const now = Date.now();
  for (const [key, val] of intentCache) {
    if (now - val.time > INTENT_CACHE_TTL_MS) intentCache.delete(key);
  }
  // If still over cap after TTL purge, evict oldest entries
  while (intentCache.size > INTENT_CACHE_MAX) {
    intentCache.delete(intentCache.keys().next().value);
  }
}

function getRuntimeCacheStatus() {
  return {
    conversations: "redis_managed",
    maxConversations: null,
    intentCacheEntries: intentCache.size,
    neo4jCacheEntries: neo4jCache.size,
    semanticCacheEntries: 0,
    cacheTtlMs: CACHE_TTL
  };
}

const healthRouter = createHealthRouter({ getCacheStatus: getRuntimeCacheStatus });
app.use("/health", healthRouter);
app.use("/api/health", healthRouter);

function extractBalancedJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  text = text.slice(start, end + 1);

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") depth--;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

function sanitizePromptInput(input) {
  if (typeof input !== 'string') return '';
  let sanitized = input;
  let previous = '';
  while (sanitized !== previous) {
    previous = sanitized;
    sanitized = sanitized
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // unicode whitespace
      .replace(/<system>|<\/system>|<assistant>|<\/assistant>|<developer>|<model>|<tool>|<function>|<.*?>/gi, "") // XML wrappers
      .replace(/```/g, "") // markdown fences
      .replace(/(System|User|Assistant|Role|Developer|Model|Function|Tool):/gi, "") // role overrides
      .replace(/(ignore previous instructions|you are now|forget previous|disregard previous|bypass restrictions|ignore all)/gi, ""); // jailbreaks
  }
  return sanitized.trim();
}

// TASK 7 — LIGHTWEIGHT CONCURRENCY SEMAPHORE for LLM / Neo4j / RAG
const MAX_CONCURRENT_LLM = parseInt(process.env.MAX_CONCURRENT_LLM || "5", 10);
const MAX_CONCURRENT_NEO4J = parseInt(process.env.MAX_CONCURRENT_NEO4J || "10", 10);
const MAX_CONCURRENT_RAG = parseInt(process.env.MAX_CONCURRENT_RAG || "8", 10);

function makeSemaphore(max) {
  let active = 0;
  const queue = [];
  return {
    async acquire() {
      if (active < max) { active++; return; }
      await new Promise(resolve => queue.push(resolve));
      active++;
    },
    release() {
      active--;
      if (queue.length > 0) queue.shift()();
    },
    get active() { return active; },
    get pending() { return queue.length; }
  };
}

const llmSemaphore = makeSemaphore(MAX_CONCURRENT_LLM);
const neo4jSemaphore = makeSemaphore(MAX_CONCURRENT_NEO4J);
const ragSemaphore = makeSemaphore(MAX_CONCURRENT_RAG);

async function extractDynamicIntent(query, requestId, isRetry = false) {
  const qKey = query.toLowerCase().trim();
  const cached = intentCache.get(qKey);
  if (cached && Date.now() - cached.time < INTENT_CACHE_TTL_MS) {
    incrementMetric("cache_hit");
    return cached.data;
  }
  incrementMetric("cache_miss");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20s

  try {
    const safeQuery = sanitizePromptInput(query);
    console.time(`[LLM][${requestId}]`);
    let res;
    try {
      res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_INTENT_MODEL || process.env.OLLAMA_MODEL || "gemma4:e2b",
          prompt: `Analyze the user's intent.
Rules:
- Output ONLY valid JSON, starting with { and ending with }.
- No markdown, no code blocks, no explanations, no conversational text.
- If asking a factual question (e.g. "What are the modules in AI?"), intent is GENERAL.
- If seeking advice, a choice, or a recommendation (e.g. "What should I study?"), intent is RECOMMEND.
- If asking specifically about a career path or how to become a role, intent is CAREER_PATH_DETAIL.
- If asking to compare two majors or options, intent is COMPARISON.

Query: "${safeQuery}"

Exact format:
{
  "intent": "GENERAL | RECOMMEND | CAREER_PATH_DETAIL | COMPARISON | REJECT",
  "entities": ["..."],
  "confidence": 0.0
}`,
          stream: false
        }),
        signal: controller.signal
      });
    } finally {
      console.timeEnd(`[LLM][${requestId}]`);
    }

    clearTimeout(timeout);
    const data = await res.json();
    const rawToken = data?.response || "";

    // Log raw LLM response
    console.log(`[LLM RAW][${requestId}]`, rawToken.trim());
    logToFile(`[Intent][${requestId}] Raw LLM Response: ${rawToken.trim()}`);

    let parsed;
    try {
      const jsonString = extractBalancedJSON(rawToken);
      if (!jsonString) throw new Error("Invalid JSON");
      parsed = JSON.parse(jsonString);
    } catch {
      console.error(`[Intent][${requestId}] Parse Failure: Invalid JSON.`);
      logToFile(`[Intent][${requestId}] PARSE FAILURE`);
      return { intent: "UNKNOWN_PARSE", entities: [], confidence: 0 };
    }

    if (!parsed.intent || !Array.isArray(parsed.entities) || typeof parsed.confidence !== "number") {
      console.error(`[Intent][${requestId}] Parse Failure: Invalid structure.`);
      logToFile(`[Intent][${requestId}] PARSE FAILURE STRUCTURE`);
      return { intent: "UNKNOWN_PARSE", entities: [], confidence: 0 };
    };

    const intent = String(parsed.intent).trim().toUpperCase().replace(/[^A-Z_]/g, "");
    const entities = parsed.entities.map(e => String(e).trim()).filter(e => e.length > 0);
    const confidence = parseFloat(parsed.confidence) || 1.0;

    const result = { intent, entities, confidence };
    intentCache.set(qKey, { time: Date.now(), data: result });
    // TASK 3 — trigger LRU/TTL prune on every write
    pruneIntentCache();
    return result;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      if (!isRetry) {
        console.warn(`[Intent][${requestId}] Timeout, retrying...`);
        return extractDynamicIntent(query, requestId, true);
      }
      console.error(`[Intent][${requestId}] Ollama Timeout`);
      logToFile(`OLLAMA TIMEOUT [${requestId}] (Intent)`);
      return { intent: "UNKNOWN_TIMEOUT", entities: [] };
    }
    console.error(`[Intent][${requestId}] ❌ Intent extraction failed:`, err.message);
    logToFile(`OLLAMA ERROR [${requestId}] (Intent): ${err.message}`);
    return { intent: "UNKNOWN_PARSE", entities: [] };
  }
}

/* ============================================================
   🤖 PHASE 4: MAIN CHAT ORCHESTRATOR
=========================================================== */

app.post("/api/chatbot/query", async (req, res) => {
  const requestId = Date.now();
  const requestStartTime = Date.now();
  incrementMetric("http_chatbot_query_total");
  const originalJson = res.json;

  res.json = function (body) {
    const duration = Date.now() - requestStartTime;
    const size = Buffer.byteLength(JSON.stringify(body));
    recordDuration("http_chatbot_latency_ms", duration);
    logger.info("Chatbot response completed", {
      requestId,
      source: body.route || body.source || "unknown",
      durationMs: duration,
      responseBytes: size
    });
    console.log(`[RESPONSE][${requestId}] route=${body.route || body.source || "unknown"} time=${duration}ms size=${size}b`);
    return originalJson.call(this, body);
  };

  try {
    console.log(`[Chatbot][${requestId}] Request Started`);

    const { query, cid } = req.body ?? {};
    if (!query) {
      return res.status(400).json(responseFormatter.formatErrorFallback("Query is required.", "ERROR", "UNKNOWN", requestId, {}));
    }

    const conversationId = cid || makeId();
    console.log(`[REQUEST][${requestId}] ${query} CID: ${conversationId}`);

    const convo = await getConversation(conversationId);

    logToFile(`USER [${conversationId}]: ${query}`);
    await pushTurn(conversationId, convo, "user", query);

    // ---------- 1. PRE-ROUTING (GREETING/FAQ) ----------
    let answer = checkGreeting(query);
    if (answer) {
      await pushTurn(conversationId, convo, "assistant", answer);
      incrementMetric("route_greeting_hits");
      const earlyTrace = { degraded_services: [], subsystem_health: {}, latency_ms: Date.now() - requestStartTime, routing_confidence: 1.0 };
      return res.json(responseFormatter.formatStatic(answer, "FAQ", 1.0, conversationId, requestId, earlyTrace));
    }

    const faqHit = searchFAQ(query);
    if (faqHit) {
      await pushTurn(conversationId, convo, "assistant", faqHit.answer);
      incrementMetric("route_faq_hits");
      const earlyTrace = { degraded_services: [], subsystem_health: {}, latency_ms: Date.now() - requestStartTime, routing_confidence: 0.9 };
      const faqPayload = {
        answer: faqHit.answer,
        confidence: 0.9,
        route: "FAQ",
        sources: ["FAQ"],
        used_facts: [faqHit.answer],
        missing_information: [],
        graph: { nodes: [], links: [] }
      };
      return res.json(responseFormatter.format(faqPayload, conversationId, requestId, earlyTrace));
    }

    // ---------- 2. INTENT CLASSIFICATION ----------
    let intentData;
    const pMatchQuery = query.match(/\b\d{2,3}\b/);
    const bMatchQuery = query.match(/-?\b\d{4,6}\b/) || query.match(/budget[\s\w]*?(-?\d+)/i);
    const kMatchQuery = query.match(/(-?\d+)\s*[kK]\b/);
    const memForRouting = getUserMemory(conversationId);
    const isProfileIncomplete = !memForRouting?.studentProfile?.high_school_percentage || !memForRouting?.studentProfile?.budget;

    const factualRegex = /^(who|what|where|which|how|when)\b/i;
    const isFactual = factualRegex.test(query.trim());

    const programKeywords = ["courses", "curriculum", "subjects", "study plan", "major", "track", "tracks", "program", "roadmap"];
    const isProgramQuery = programKeywords.some(kw => query.toLowerCase().includes(kw));

    if (isProgramQuery) {
      intentData = { intent: "PROGRAM", confidence: 1.0, entities: [] };
    } else if (isFactual) {
      intentData = { intent: "GENERAL", confidence: 1.0, entities: [] };
    } else if ((pMatchQuery || bMatchQuery || kMatchQuery) && isProfileIncomplete) {
      intentData = { intent: "RECOMMEND", confidence: 1.0, entities: [] };
    } else {
      intentData = await extractDynamicIntent(query, requestId);
    }

    let intentKeyword = intentData.intent;
    const entities = intentData.entities || [];
    const confidence = intentData.confidence || 0;

    console.log(`[INTENT][${requestId}] intent: ${intentKeyword}, confidence: ${confidence}, entities: ${JSON.stringify(entities)}`);

    if (intentKeyword === "UNKNOWN_TIMEOUT") {
      incrementMetric("route_timeout_errors");
      const earlyTrace = { degraded_services: ["INTENT_TIMEOUT"], subsystem_health: {}, latency_ms: Date.now() - requestStartTime, routing_confidence: 0.1 };
      return res.status(503).json(responseFormatter.formatErrorFallback("System is busy, please try again.", "ERROR", conversationId, requestId, earlyTrace));
    }

    const KNOWN_INTENTS = ["GENERAL", "RECOMMEND", "RECOMMENDATION", "DECISION", "CAREER_PATH_DETAIL", "COMPARISON", "REJECT", "PREREQUISITE", "DEAN", "ADMIN", "PERSON", "PROGRAM", "UNKNOWN_PARSE"];
    if (!KNOWN_INTENTS.includes(intentKeyword)) {
      intentKeyword = "GENERAL";
    }

    // ---------- 3. BRAIN ROUTER (PHASE 4) ----------

    // Live Health Probing
    const healthStatus = await checkSubsystemHealth();

    const analysisPayload = brainRouter.analyzeQuery(
      { query, intent: intentKeyword },
      intentKeyword,
      { lastRoute: convo.lastRoute || null }
    );

    const routingDecision = brainRouter.determineBestRoute(
      analysisPayload,
      healthStatus,
    );

    let route = routingDecision.route;

    const ROUTES = brainRouter.ROUTES || {
      KG_DIRECT: 'KG_DIRECT',
      KG_ONLY: 'KG_ONLY',
      RAG_DIRECT: 'RAG_DIRECT',
      RAG_ONLY: 'RAG_ONLY',
      HYBRID_KG_RAG: 'HYBRID_KG_RAG',
      DECISION_ENGINE: 'DECISION_ENGINE',
      CAREER_ENGINE: 'CAREER_ENGINE',
      FAQ: 'FAQ',
      LLM_FALLBACK: 'LLM_FALLBACK'
    };

    // PHASE 8: DETERMINISTIC ROUTE LOCKING
    if (
        routingDecision?.deterministic_kg === true ||
        routingDecision?.hard_route === "KG_DIRECT" ||
        routingDecision?.route === ROUTES.KG_DIRECT
    ) {
        route = ROUTES.KG_DIRECT;
    }

    // SECTION B — QUERY-SAFETY LOCK
    // PHASE 8: Prevent single-domain KG locks from collapsing multi-domain hybrid intent.
    if (
        route !== ROUTES.HYBRID_KG_RAG &&
        /who teaches|dean|prerequisite|prerequisites|requirements|head of department|program director/i.test(query)
    ) {
        route = ROUTES.KG_DIRECT;
    }

    console.log(`[ROUTE_LOCK][${requestId}] Final locked route: ${route}`);

    // ISSUE 4: ROUTE MEMORY PERSISTENCE
    convo.lastRoute = route;
    await saveConversation(conversationId, convo);

    console.log(`[ORCHESTRATOR][${requestId}] Central Route Assigned: ${route}`);

    // TASK 6 — WHITELISTED ROUTE METRICS (prevents unbounded label cardinality)
    const ALLOWED_ROUTE_METRICS = new Set(["kg", "kg_direct", "rag", "rag_direct", "hybrid", "decision", "career", "faq", "llm_fallback"]);
    const routeMetricStr = route.toLowerCase().replace(/_only/g, "").replace(/_engine/g, "");
    const safeRouteMetric = ALLOWED_ROUTE_METRICS.has(routeMetricStr) ? routeMetricStr : "unknown";
    incrementMetric(`route_${safeRouteMetric}_hits`);

    let rawResults = {};
    let interactivePrompt = null;
    let degraded_services = [];
    let kgRawData = null; // Hoisted for universal explainability injection

    // TASK 4 — ENHANCED KG CONFIDENCE SCORING
    const buildKgResponse = (kgRes) => {
        if (!kgRes || !Array.isArray(kgRes) || kgRes.length === 0) return [];

        // Pre-compute query tokens for entity overlap scoring
        const queryTokens = new Set(
          query.toLowerCase().split(/\W+/).filter(t => t.length > 3)
        );

        const mapped = kgRes.map(item => {
          const text = String(item.text || item);
          const relCount = (text.match(/--\[.*?\]-->/g) || []).length;
          const nodeCount = (text.match(/\(.*?\)/g) || []).length;

          // Entity overlap: how many query tokens appear in the evidence
          const textTokens = new Set(text.toLowerCase().split(/\W+/).filter(t => t.length > 3));
          const overlapCount = [...queryTokens].filter(t => textTokens.has(t)).length;
          const overlapScore = queryTokens.size > 0 ? overlapCount / queryTokens.size : 0;

          // Evidence quality: penalise very short evidence
          const lengthPenalty = text.length < 40 ? -0.1 : 0;

          // Composite score — capped to prevent overestimation
          let conf = 0.30
            + (relCount * 0.12)   // graph richness
            + (nodeCount * 0.04)   // graph breadth
            + (overlapScore * 0.25) // semantic relevance
            + lengthPenalty;

          conf = Math.min(0.98, Math.max(0.20, conf)); // Adjusted cap for Phase 4

          // PHASE 4: Deterministic Confidence Hardening
          if (route === ROUTES.KG_DIRECT || kgRes.deterministic) {
              conf = Math.max(conf, 0.95);
          }

          return {
            evidence: text,
            confidence: parseFloat(conf.toFixed(3)),
            metadata: {
              source: "KnowledgeGraph",
              node_count: nodeCount,
              rel_count: relCount,
              overlap_score: parseFloat(overlapScore.toFixed(3))
            },
            source_type: "KG"
          };
        });

        // PHASE 4.2: Preserve deterministic metadata flags from raw KG response
        if (kgRes.deterministic) {
            Object.defineProperty(mapped, 'deterministic', { value: true, enumerable: false });
            Object.defineProperty(mapped, 'llm_bypassed', { value: true, enumerable: false });
            Object.defineProperty(mapped, 'answer', { value: kgRes.answer, enumerable: false });
        }

        return mapped;
      };

    const normalizeNumericConfidence = (value) => {
      if (typeof value === "string") {
        const mapped = { HIGH: 0.85, MEDIUM: 0.55, LOW: 0.2 };
        if (mapped[value.toUpperCase()] !== undefined) return mapped[value.toUpperCase()];
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
      }
      const n = Number.parseFloat(value);
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
    };

    const extractRagSourceText = (source) => {
      if (!source) return "";
      const candidates = [
        source.answer,
        source.text,
        source.content,
        source.page_content,
        source.chunk,
        source.excerpt,
        source.summary,
        source.body,
        source.document,
        source.metadata?.text,
        source.metadata?.content,
        source.payload?.text,
        source.payload?.content
      ];

      const text = candidates.find(v => typeof v === "string" && v.trim().length > 0);
      return String(text || "").replace(/\s+/g, " ").trim();
    };

    const extractRagSourceTitle = (source) => (
      source?.title ||
      source?.source_title ||
      source?.source ||
      source?.doc_title ||
      source?.doc_id ||
      source?.metadata?.title ||
      source?.metadata?.source ||
      "AAST Academic Policy Source"
    );

    const buildDeterministicRagPayload = (ragRes, ragDecisionRoute) => {
      const sources = Array.isArray(ragRes?.sources) ? ragRes.sources : [];
      const queryTokens = new Set(
        query.toLowerCase()
          .split(/\W+/)
          .filter(t => t.length > 3 && !["what", "when", "where", "which", "does", "with", "from", "this", "that"].includes(t))
      );

      const evidence = sources
        .map((source, index) => {
          const text = extractRagSourceText(source);
          const sentences = text
            .split(/(?:[.!?]\s+|\n+)/)
            .map(s => s.trim())
            .filter(s => s.length >= 30);

          const bestSentence = sentences
            .map(sentence => {
              const lower = sentence.toLowerCase();
              const overlap = [...queryTokens].filter(t => lower.includes(t)).length;
              const policyBoost = /\b(gpa|probation|transfer|scholarship|admission|tuition|fee|policy|regulation|requirement|eligible)\b/i.test(sentence) ? 2 : 0;
              return { sentence, score: overlap + policyBoost };
            })
            .sort((a, b) => b.score - a.score)[0]?.sentence || text;

          return {
            index,
            title: extractRagSourceTitle(source),
            excerpt: bestSentence.slice(0, 420),
            score: normalizeNumericConfidence(source?.rerank_score ?? source?.score ?? source?.confidence ?? ragRes?.raw_confidence)
          };
        })
        .filter(item => item.excerpt.length >= 30)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const directAnswer = typeof ragRes?.answer === "string" && ragRes.answer.trim().length >= 30
        ? ragRes.answer.trim()
        : [
            "According to verified AAST academic policy sources:",
            ...evidence.map(item => `- ${item.excerpt}`)
          ].join("\n");

      return {
        final_answer: directAnswer,
        answer: directAnswer,
        confidence: Math.max(routingDecision.confidence || 0, normalizeNumericConfidence(ragRes?.raw_confidence), 0.86),
        route_used: ragDecisionRoute,
        contributing_sources: [ragDecisionRoute, "RAG"],
        used_facts: evidence.map(item => item.excerpt),
        missing_information: [],
        graph: {
            nodes: [],
            links: []
        },
        citations: evidence.map(item => ({
          title: item.title,
          source: item.title,
          excerpt: item.excerpt,
          confidence: item.score
        })),
        explainability: {
          deterministic: true,
          direct_rag: true,
          llm_bypassed: true,
          unified_answer_bypassed: true,
          fusion_bypassed: true,
          matched_policy_categories: routingDecision.deterministic_policy?.matched_categories || []
        },
        reasoning: "High-confidence deterministic policy query answered directly from retrieved institutional policy sources.",
        metadata: {
          retrieval_pass: ragRes?.pass_used,
          query_category: ragRes?.query_category || ragRes?.category,
          source_count: sources.length,
          direct_bypass: true
        }
      };
    };

    const hasStrongRagEvidence = (ragRes) => {
      const sources = Array.isArray(ragRes?.sources) ? ragRes.sources : [];
      const sourceCount = sources.length;
      const hasReadableEvidence = sources.some(source => extractRagSourceText(source).length >= 30);
      const topRerank = Math.max(...sources.map(source => normalizeNumericConfidence(source?.rerank_score ?? source?.score ?? source?.confidence)), 0);
      const retrievalConfidence = normalizeNumericConfidence(ragRes?.raw_confidence ?? ragRes?.confidence);

      return hasReadableEvidence && (
        retrievalConfidence >= 0.25 ||
        topRerank >= 0.25 ||
        sourceCount >= 2 ||
        typeof ragRes?.answer === "string"
      );
    };

    // ---------- 4. PARALLEL EXECUTION PIPELINES ----------
    // TASK 8 — PROMPT TOKEN BUDGET LOGGING
    const estimatedTokens = Math.ceil(query.length / 4);
    if (estimatedTokens > 800) {
      console.warn(`[TOKEN_BUDGET][${requestId}] Oversized query: ~${estimatedTokens} tokens (${query.length} chars)`);
      logger.warn("Oversized prompt detected", { requestId, estimatedTokens, queryLength: query.length });
      incrementMetric("oversized_prompt_warnings");
    } else {
      console.log(`[TOKEN_BUDGET][${requestId}] Estimated prompt tokens: ~${estimatedTokens}`);
    }

    // TASK 7 — Acquire Neo4j semaphore slot before any KG retrieval
    try {
      if (route === ROUTES.KG_ONLY || route === ROUTES.KG_DIRECT) {
        await neo4jSemaphore.acquire();
        try {
          kgRawData = await timeoutWrapper(
            fetchNeo4jContext(query, intentKeyword, 5, requestId, convo.messages),
            5000,
            null
          );
        } finally {
          neo4jSemaphore.release();
        }
        
        if (!kgRawData) {
          incrementMetric("kg_timeout_failures");
          degraded_services.push("KG_TIMEOUT");
        }
        rawResults.kg = buildKgResponse(kgRawData);

        // PHASE 8: DETERMINISTIC KG EMPTY-RESULT GUARD
        if (route === ROUTES.KG_ONLY && (!rawResults.kg || rawResults.kg.length === 0)) {
          console.log(`[ORCHESTRATOR][${requestId}] KG_ONLY empty-result exit triggered.`);
          return res.json(
            responseFormatter.format({
              answer: "I couldn't find verified knowledge graph evidence for this query.",
              confidence: 0.25,
              used_facts: [],
              missing_information: ["No verified institutional graph evidence found."],
              graph: { nodes: [], links: [] },
              route: "KG_ONLY",
              sources: [],
              reasoning: "Knowledge graph search completed but returned no verified matches."
            }, conversationId, requestId)
          );
        }

        // PHASE 4.2: Expanded Deterministic KG Shortcut
        const isDeterministicBypass = 
            route === ROUTES.KG_DIRECT || 
            (route === ROUTES.KG_ONLY && rawResults.kg.deterministic && rawResults.kg[0]?.confidence > 0.6);

        if (
            isDeterministicBypass &&
            rawResults.kg &&
            rawResults.kg.length > 0
        ) {
            const bestKG = rawResults.kg[0];
            const answer = rawResults.kg.answer || bestKG.evidence;
            const latencyMs = Date.now() - requestStartTime;

            console.log(`[PHASE4_VALIDATION][${requestId}]
Route: ${route}
Latency: ${latencyMs}ms
LLM Calls: ${intentKeyword === "GENERAL" || intentKeyword === "PROGRAM" ? 0 : 1} (Intent detection)
Fusion Calls: 0
Fallback Calls: 0`);

            const deterministicPayload = {
                final_answer: answer,
                answer: answer,
                confidence: Math.max(bestKG.confidence || 0.98, 0.98),
                route_used: ROUTES.KG_DIRECT,
                sources: ["KG_DIRECT"],
                used_facts: rawResults.kg.map(f => f.evidence),
                missing_information: [],
                graph: convertToGraphData(kgRawData),
                source: "KG_DIRECT",
                explainability: {
                    deterministic: true,
                    direct_kg: true
                }
            };

            await pushTurn(conversationId, convo, "assistant", deterministicPayload.final_answer);

            return res.json(
                responseFormatter.format(
                    deterministicPayload,
                    conversationId,
                    requestId,
                    {
                        degraded_services,
                        subsystem_health: healthStatus,
                        latency_ms: Date.now() - requestStartTime,
                        routing_confidence: 0.98
                    }
                )
            );
        }
      }
      else if (route === ROUTES.RAG_ONLY || route === ROUTES.RAG_DIRECT) {
        await ragSemaphore.acquire();
        const ragRes = await timeoutWrapper(ragService.search(query, { topK: 5 }), 5000, null).finally(() => ragSemaphore.release());
        
        if (!ragRes) {
          degraded_services.push("RAG_TIMEOUT");
          rawResults.rag = { results: [], confidence: 0, metadata: {}, fallback_used: false };
        } else {
          // SECTION B — RESPONSE NORMALIZATION ADAPTER
          rawResults.rag = {
            results: ragRes.sources || [],
            confidence: ragRes.raw_confidence || 0,
            metadata: ragRes.metadata || {},
            fallback_used: ragRes.fallback_used || false,
            answer: ragRes.answer || null,
            pass_used: ragRes.pass_used || null,
            query_category: ragRes.query_category || ragRes.category || null
          };
          
          logger.info("RAG_ONLY success", { 
            requestId, 
            confidence: rawResults.rag.confidence, 
            source_count: rawResults.rag.results.length 
          });
          
          if (rawResults.rag.results.length > 0) incrementMetric("rag_metadata_preserved");

          // PHASE 8: DETERMINISTIC RAG EMPTY-RESULT GUARD
          if (route === ROUTES.RAG_ONLY && (!rawResults.rag || !rawResults.rag.results || rawResults.rag.results.length === 0)) {
            console.log(`[ORCHESTRATOR][${requestId}] RAG_ONLY empty-result exit triggered.`);
            return res.json(
              responseFormatter.format({
                answer: "I couldn't find verified institutional policy evidence for this query.",
                confidence: 0.25,
                used_facts: [],
                missing_information: ["No verified institutional policy evidence found."],
                graph: { nodes: [], links: [] },
                route: "RAG_ONLY",
                sources: [],
                reasoning: "Policy retrieval completed but returned no verified sources."
              }, conversationId, requestId)
            );
          }

          const shouldDirectPolicyBypass =
            (route === ROUTES.RAG_DIRECT ||
              (
                route === ROUTES.RAG_ONLY &&
                routingDecision.confidence >= 0.70 &&
                routingDecision.deterministic_policy?.strong_policy_evidence
              )) &&
            hasStrongRagEvidence(ragRes);

          if (shouldDirectPolicyBypass) {
            const deterministicPayload = buildDeterministicRagPayload(ragRes, ROUTES.RAG_DIRECT);
            const latencyMs = Date.now() - requestStartTime;

            incrementMetric("rag_deterministic_bypass");
            console.log(`[RAG_DIRECT_VALIDATION][${requestId}]
Route: ${route}
Latency: ${latencyMs}ms
UnifiedAnswer Calls: 0
Ollama Calls: 0
Fusion Calls: 0
Sources: ${rawResults.rag.results.length}`);

            await pushTurn(conversationId, convo, "assistant", deterministicPayload.final_answer);

            return res.json(
              responseFormatter.format(
                deterministicPayload,
                conversationId,
                requestId,
                {
                  degraded_services,
                  subsystem_health: healthStatus,
                  latency_ms: Date.now() - requestStartTime,
                  routing_confidence: deterministicPayload.confidence,
                  response_tier: "DETERMINISTIC_SUCCESS"
                }
              )
            );
          }
        }
      }
      else if (route === ROUTES.HYBRID_KG_RAG) {
        const [kgOutcome, ragOutcome] = await Promise.allSettled([
          neo4jSemaphore.acquire().then(() => timeoutWrapper(fetchNeo4jContext(query, intentKeyword, 5, requestId, convo.messages), 5000, null).finally(() => neo4jSemaphore.release())),
          ragSemaphore.acquire().then(() => timeoutWrapper(ragService.search(query, { topK: 5 }), 5000, null).finally(() => ragSemaphore.release()))
        ]);

        if (kgOutcome.status === 'fulfilled' && kgOutcome.value) {
          kgRawData = kgOutcome.value;
          rawResults.kg = buildKgResponse(kgRawData);
        } else {
          console.error(`[HYBRID][${requestId}] KG failed:`, kgOutcome.reason);
          incrementMetric("subsystem_kg_failure");
          incrementMetric("kg_timeout_failures");
          degraded_services.push("KG_TIMEOUT");
        }

        if (ragOutcome.status === 'fulfilled' && ragOutcome.value) {
          const ragData = ragOutcome.value;
          // SECTION B — RESPONSE NORMALIZATION ADAPTER
          rawResults.rag = {
            results: ragData.sources || [],
            confidence: ragData.raw_confidence || 0,
            metadata: ragData.metadata || {},
            fallback_used: ragData.fallback_used || false
          };
          
          logger.info("HYBRID RAG success", { 
            requestId, 
            confidence: rawResults.rag.confidence, 
            source_count: rawResults.rag.results.length 
          });
          
          incrementMetric("rag_metadata_preserved");
        } else {
          console.error(`[HYBRID][${requestId}] RAG failed:`, ragOutcome.reason);
          incrementMetric("subsystem_rag_failure");
          degraded_services.push("RAG_TIMEOUT");
          rawResults.rag = { results: [], confidence: 0, metadata: {}, fallback_used: false };
        }

        if (!rawResults.kg && !rawResults.rag) {
          console.warn(`[HYBRID][${requestId}] Total failure. Degrading to LLM.`);
          route = ROUTES.LLM_FALLBACK;
          degraded_services.push("HYBRID_TOTAL_FAILURE");
        }
      }
      else if (route === ROUTES.DECISION_ENGINE) {
        let memory = getUserMemory(conversationId);

        let updated = false;
        const updates = { studentProfile: {} };

        if (pMatchQuery) { updates.studentProfile.high_school_percentage = parseInt(pMatchQuery[0], 10); updated = true; }
        let budgetVal = null;
        if (bMatchQuery) budgetVal = parseInt(bMatchQuery[0], 10);
        else if (kMatchQuery) budgetVal = parseInt(kMatchQuery[1], 10) * 1000;
        if (budgetVal !== null) { updates.studentProfile.budget = budgetVal; updated = true; }

        if (updated) {
          await updateUserMemory(conversationId, updates);
          memory = getUserMemory(conversationId);
        }

        const hasPercentage = memory?.studentProfile?.high_school_percentage != null;
        const hasBudget = memory?.studentProfile?.budget != null;

        if (!hasPercentage || !hasBudget) {
          let missingMsg = "To recommend the best major, please tell me your ";
          let missingFieldsArray = [];
          if (!hasPercentage && !hasBudget) { missingMsg += "high school percentage and budget."; missingFieldsArray = ["high_school_percentage", "budget"]; }
          else if (!hasPercentage) { missingMsg += "high school percentage."; missingFieldsArray = ["high_school_percentage"]; }
          else { missingMsg += "budget."; missingFieldsArray = ["budget"]; }
          interactivePrompt = { msg: missingMsg, missingFields: missingFieldsArray };
        } else {
          if (intentKeyword === "COMPARISON") {
            const majorA = entities[0];
            const majorB = entities[1];
            if (!majorA || !majorB) {
              interactivePrompt = { msg: `Which other major would you like to compare with?`, missingFields: [] };
            } else {
              const comparison = compareMajors(majorA, majorB, memory.studentProfile, requestId);
              rawResults.decision = [{
                recommendation: `Comparison: ${majorA} vs ${majorB}\nSalary Outlook: ${comparison.salary_outlook}\nSkills Overlap: ${comparison.skills_overlap}`,
                factors: comparison,
                confidence: 0.85
              }];
            }
          } else {
            const decisionResult = await timeoutWrapper(
              getRecommendation({
                studentProfile: memory?.studentProfile || {},
                preferences: memory?.preferences || {},
                text: query,
                memory: memory,
                cid: conversationId,
                requestId
              }),
              8000, null
            );

            if (decisionResult && decisionResult.success) {
              rawResults.decision = [{
                recommendation: `Recommended Major: ${decisionResult.recommended_major}. Reason: ${decisionResult.reason}`,
                confidence: decisionResult.confidence / 100 || 0.85,
                factors: decisionResult
              }];
            } else if (decisionResult && decisionResult.is_missing_data) {
              interactivePrompt = { msg: `I'd love to help, but I need your ${decisionResult.missing_fields.join(" and ")}!`, missingFields: decisionResult.missing_fields };
            }
          }
        }
      }
      else if (route === ROUTES.CAREER_ENGINE) {
        const memory = getUserMemory(conversationId);
        if (!memory || Object.keys(memory).length === 0) {
          interactivePrompt = { msg: "We need to find the right major for you first! Should we start with a recommendation?", missingFields: [] };
        } else {
          const roadmap = await timeoutWrapper(Promise.resolve(buildCareerRoadmap(null, null, memory)), 5000, null);
          if (roadmap) {
            rawResults.career = [{
              career_path: `To become a ${roadmap.target_roles?.[0]}, focus on ${roadmap.top_skills?.join(', ')}. Demand: ${roadmap.industry_demand}`,
              market_data: roadmap,
              confidence: 0.8
            }];
          }
        }
      }

      if (route === ROUTES.LLM_FALLBACK) {
        incrementMetric("route_llm_fallback_hits");
        incrementMetric("llm_fallback_rate");
        const history = convo.messages.slice(-3).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

        const prompt = `You are the AAST Academic Super-Agent, a professional, grounded, and helpful university advisor.
Your primary role is to assist students with major selection, career advice, and academic policies.
If you are unsure of specific university regulations, state clearly that the student should consult an official advisor.
Do NOT hallucinate fake policies or rules.

Recent Conversation Context:
${history}

Student Query: "${sanitizePromptInput(query)}"
Respond briefly, professionally, and conversationally as the AAST Advisor.`;

        // TASK 7 — LLM semaphore for concurrency protection
        await llmSemaphore.acquire();
        const llmRes = await timeoutWrapper(
          fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: process.env.OLLAMA_FALLBACK_MODEL || process.env.OLLAMA_MODEL || "gemma4:e2b",
              prompt: prompt,
              stream: false
            })
          }).then(r => r.json()),
          10000, null
        ).finally(() => llmSemaphore.release());
        rawResults.llm = [{ response: llmRes?.response?.trim() || "Some systems are limited right now, but based on available academic guidance, here is the best support I can provide.", confidence: 0.3 }];
      }

      const traceData = {
        degraded_services,
        subsystem_health: healthStatus,
        latency_ms: Date.now() - requestStartTime,
        routing_confidence: routingDecision.confidence || 0,
        response_tier: degraded_services.length > 0 ? "DEGRADED_SUCCESS" : "FULL_SUCCESS"
      };

      // ---------- 5. FUSION LAYER (Unified Primary + Fusion Fallback) ----------
      if (interactivePrompt) {
        await pushTurn(conversationId, convo, "assistant", interactivePrompt.msg);
        incrementMetric("route_interactive_hits");
        return res.json(responseFormatter.formatInteractive(interactivePrompt.msg, conversationId, requestId, interactivePrompt.missingFields, traceData));
      }

      let fusionPayload;

      try {
        fusionPayload = await timeoutWrapper(
          generateUnifiedAnswer({
            query,
            routeType: route,
            retrievalConfidence: routingDecision.confidence || 0,
            neo4jContext: rawResults.kg || [],
            ragContext: Array.isArray(rawResults.rag?.results) ? rawResults.rag.results : [],
            faqContext: faqHit || null,
            decisionContext: rawResults.decision || rawResults.career || null
          }),
          65000,
          null
        );

        // ISSUE 1: STRONGER PRIMARY VALIDATION
        if (
          !fusionPayload ||
          !fusionPayload.answer ||
          typeof fusionPayload.answer !== "string" ||
          fusionPayload.answer.trim().length < 8 ||
          fusionPayload.confidence < 0.15
        ) {
          if (
              (rawResults.kg && rawResults.kg.length > 0) ||
              (rawResults.rag && rawResults.rag.results && rawResults.rag.results.length > 0) ||
              rawResults.decision ||
              rawResults.career
          ) {
              logger.warn("UnifiedAnswer degraded but partial evidence exists — preserving degraded response", {
                  requestId,
                  route
              });

              fusionPayload = {
                  final_answer:
                      fusionPayload.answer ||
                      "Partial verified academic information is available based on current institutional data.",
                  answer:
                      fusionPayload.answer ||
                      "Partial verified academic information is available based on current institutional data.",
                  confidence: Math.max(fusionPayload.confidence || 0.15, 0.15),
                  route_used: route,
                  degraded: true
              };
          } else {
              throw new Error("UnifiedAnswer low confidence or invalid");
          }
        }

        fusionPayload.final_answer = fusionPayload.answer;
        fusionPayload.route_used = fusionPayload.route || route;
        fusionPayload.confidence =
          fusionPayload.confidence || routingDecision.confidence;

        // ISSUE 3 & 6: METRICS & LOGGING (Success)
        incrementMetric("unified_primary_success");
        console.log(`[UNIFIED][${requestId}] Primary success route=${route} confidence=${fusionPayload.confidence}`);

      } catch (unifiedErr) {
        // ISSUE 3 & 6: METRICS & LOGGING (Fallback)
        incrementMetric("unified_primary_fallback");
        console.warn(
          `[ORCHESTRATOR][${requestId}] UnifiedAnswer failed, falling back to FusionService:`,
          unifiedErr.message
        );

        fusionPayload = await timeoutWrapper(
          fusionService.fuse(query, routingDecision, rawResults),
          8000,
          null
        );

        // ISSUE 2: FALLBACK PAYLOAD VALIDATION
        if (
          !fusionPayload ||
          !fusionPayload.final_answer ||
          typeof fusionPayload.final_answer !== "string"
        ) {
          throw new Error("Fallback fusion failed");
        }
      }

      if (!fusionPayload) throw new Error("Fusion Engine Timeout");

      const isSuccess = fusionPayload.confidence >= 0.4;
      incrementMetric(isSuccess ? "fusion_success" : "fusion_low_confidence");

      if (route === ROUTES.HYBRID_KG_RAG && degraded_services.length > 0) {
        incrementMetric("hybrid_partial_failures");
      }

      // ISSUE 5: RESPONSE SANITY GUARD
      if (!fusionPayload.final_answer || fusionPayload.final_answer.trim().length < 10) {
        throw new Error("Malformed final answer");
      }

      // PHASE 8: UNIVERSAL EXPLAINABILITY RESPONSE CONTRACT INJECTION
      fusionPayload.used_facts = Array.isArray(fusionPayload.used_facts) ? fusionPayload.used_facts : [];
      fusionPayload.missing_information = Array.isArray(fusionPayload.missing_information) ? fusionPayload.missing_information : [];
      fusionPayload.graph = (fusionPayload.graph && typeof fusionPayload.graph === 'object') ? fusionPayload.graph : { nodes: [], links: [] };

      // Enrich with Knowledge Graph evidence
      if (route.includes("KG") || route.includes("HYBRID")) {
        if (rawResults.kg && rawResults.kg.length > 0) {
          fusionPayload.used_facts = [...new Set([...fusionPayload.used_facts, ...rawResults.kg.map(f => f.evidence)])];
          if (kgRawData) {
            fusionPayload.graph = convertToGraphData(kgRawData);
          }
        } else {
          fusionPayload.missing_information.push("No specific Knowledge Graph records were found for this query.");
        }
      }

      // Enrich with RAG/Policy evidence
      if (route.includes("RAG") || route.includes("HYBRID")) {
        if (rawResults.rag?.results && rawResults.rag.results.length > 0) {
          const ragFacts = rawResults.rag.results.map(f => extractRagSourceText(f)).filter(t => t.length > 20);
          fusionPayload.used_facts = [...new Set([...fusionPayload.used_facts, ...ragFacts])];
        }
      }

      // Enrich with Decision/Career engine outcomes
      if (route === ROUTES.DECISION_ENGINE || route === ROUTES.CAREER_ENGINE || intentKeyword === "RECOMMEND" || intentKeyword === "COMPARISON") {
          if (rawResults.decision && rawResults.decision[0]) {
              fusionPayload.used_facts.push(rawResults.decision[0].recommendation);
          }
          if (rawResults.career && rawResults.career[0]) {
              fusionPayload.used_facts.push(rawResults.career[0].career_path);
          }
      }

      await pushTurn(conversationId, convo, "assistant", fusionPayload.final_answer);

      incrementMetric("response_formatter_success");

      // Structured API Envelope via Formatting Layer
      return res.json(responseFormatter.format(fusionPayload, conversationId, requestId, traceData));

    } catch (err) {
      console.error(`[ORCHESTRATOR][${requestId}] Execution Error:`, err.message);
      incrementMetric("route_failure_fallback");

      const traceData = { 
          degraded_services: ["FATAL_ERROR"], 
          latency_ms: Date.now() - requestStartTime, 
          routing_confidence: 0,
          response_tier: "FATAL_FALLBACK"
      };

      // TASK 5 — STRONGER FATAL FALLBACK: fusionService attempt with static backstop
      let fallbackAnswer = "Some advanced systems are temporarily unavailable, but official academic advisors can confirm final university policy details.";
      let fallbackRoute = "FATAL_FALLBACK";
      try {
        const fallbackEnvelope = await fusionService.fuse(query, { route: ROUTES.LLM_FALLBACK, confidence: 0.1 }, {
          llm: [{ response: "I encountered a technical issue retrieving your documentation, but I am still here to assist you.", confidence: 0.1 }]
        });
        if (fallbackEnvelope?.final_answer && typeof fallbackEnvelope.final_answer === "string") {
          fallbackAnswer = fallbackEnvelope.final_answer;
          fallbackRoute = fallbackEnvelope.route_used || "FUSION_FALLBACK";
        }
      } catch (fallbackErr) {
        console.error(`[ORCHESTRATOR][${requestId}] FusionService also failed in fatal fallback:`, fallbackErr.message);
        incrementMetric("fatal_static_fallback_used");
      }

      await pushTurn(conversationId, convo, "assistant", fallbackAnswer);

      return res.status(200).json(responseFormatter.formatErrorFallback(fallbackAnswer, fallbackRoute, conversationId, requestId, traceData));
    }
  } catch (globalErr) {
    console.error(`[ORCHESTRATOR][${requestId}] Fatal Global Error:`, globalErr.message);
    return res.status(500).json(responseFormatter.formatErrorFallback("Fatal Internal Orchestrator Error", "ERROR", "UNKNOWN", requestId, {}));
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`🔗 Decision API: ${process.env.DECISION_API_URL || "http://127.0.0.1:8005"}`);
});
