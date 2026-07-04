// orchestrator.js

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";

import chatbotRouter from "./routes/chatbot.js";
import decisionRouter from "./routes/decision.js";
import createConversationsRouter from "./routes/conversations.js";
import createHealthRouter from "./routes/health.js";
import { searchFAQ } from "./faqService.js";
import { checkGreeting } from "./greetings.js";
import { fetchNeo4jContext, convertToGraphData } from "./services/neo4jcontext.js";
import { connectNeo4j, getSession } from "./db/neo4j.js";
import { getRecommendation, getUserMemory, buildCareerRoadmap, compareMajors, updateUserMemory, deleteUserMemory } from "./services/decisionService.js";
import { incrementMetric, recordDuration } from "./services/metrics.js";
import { logger } from "./services/logger.js";
import { generateUnifiedAnswer } from "./services/unifiedAnswerService.js";
import { validateGeminiEnvironment } from "./services/geminiService.js";
import { modelFailoverManager } from "./services/modelFailoverManager.js";
import { generateStableResponse } from "./services/ollamaService.js";
import { gemmaWarmService } from "./services/gemmaWarmService.js";
import { normalizeAcademicQuery } from "./services/academicQueryNormalizer.js";
import {
  MAX_CONTEXT_TURNS,
  deleteConversation,
  flushConversations,
  getConversation,
  getConversationContext,
  getConversationMemory,
  getConversationById,
  getConversationStats,
  getConversationSummary,
  loadConversations,
  listConversations,
  makeConversationId,
  normalizeConversationId,
  createConversation,
  pinConversation,
  pushTurn,
  renameConversation,
  saveConversation,
  updateConversationMemoryFromTurn
} from "./services/conversationService.js";
// PHASE 4: AGENTIC CORE IMPORTS
import brainRouter from "./services/brainRouter.js";
import fusionService from "./services/fusionService.js";
import ragService from "./services/ragService.js";
import { checkSubsystemHealth, timeoutWrapper } from "./services/healthProbes.js";
import responseFormatter from "./services/responseFormatter.js";
import { buildDemoGraphResponse, isDemoGraphQuery } from "./services/demoGraphService.js";
import { isCourseByTopicLookup } from "./services/queryShape.js";
import {
  humanizeGroundedAnswer,
  shouldHumanizeResponseBody
} from "./services/conversationalHumanizer.js";
import {
  buildConversationMetaResponse,
  detectMetaConversationIntent
} from "./services/conversationMetaIntent.js";
import {
  buildIntentScopedQuery,
  buildLightConversationalResponse,
  detectAcademicMultiIntents,
  detectLightConversationalIntent,
  resolveFollowUpReference
} from "./services/conversationPriority.js";
import {
  buildGoldenFallbackPayload,
  classifyGoldenQuery,
  extractGoldenEntities,
  parseComparisonEntities
} from "./config/goldenPathRegistry.js";
import { runtimeMode } from "./config/runtimeMode.js";

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 8004;

function timeoutFromEnv(names, fallback) {
  for (const name of names) {
    const parsed = Number.parseInt(process.env[name], 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

// Security check for Internal Secret
const INTERNAL_SECRET = process.env.INTERNAL_SECRET_KEY;
if (!INTERNAL_SECRET) {
  throw new Error("CRITICAL: INTERNAL_SECRET_KEY is missing from environment variables.");
}

validateGeminiEnvironment({ warn: true });

/* ============================================================
   📁 LOGGING SYSTEM
=========================================================== */

const LOG_DIR = path.resolve(process.cwd(), "logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const QUERY_LOG = path.join(LOG_DIR, "chat.log");
const ROUTING_AUDIT_LOG = path.join(LOG_DIR, "routing-audit.jsonl");

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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

const GOLDEN_CACHE_MAX = Number(process.env.GOLDEN_CACHE_MAX || 64);
const GOLDEN_CACHE_TTL_MS = Number(process.env.GOLDEN_CACHE_TTL_MS || 10 * 60 * 1000);
const goldenResponseCache = new Map();

function getGoldenCacheKey(goldenMatch) {
  if (!goldenMatch?.id) return null;
  return `${goldenMatch.id}:${goldenMatch.route}`;
}

function getGoldenCachedPayload(goldenMatch) {
  if (process.env.GOLDEN_CACHE_ENABLED === "false") return null;
  if (!goldenMatch?.cacheable) return null;

  const key = getGoldenCacheKey(goldenMatch);
  const entry = key ? goldenResponseCache.get(key) : null;
  if (!entry) return null;

  if (Date.now() - entry.time > GOLDEN_CACHE_TTL_MS) {
    goldenResponseCache.delete(key);
    return null;
  }

  return cloneJson(entry.payload);
}

function setGoldenCachedPayload(goldenMatch, payload) {
  if (process.env.GOLDEN_CACHE_ENABLED === "false") return;
  if (!goldenMatch?.cacheable || !payload) return;

  const key = getGoldenCacheKey(goldenMatch);
  if (!key) return;

  goldenResponseCache.set(key, {
    time: Date.now(),
    payload: cloneJson(payload)
  });

  while (goldenResponseCache.size > GOLDEN_CACHE_MAX) {
    goldenResponseCache.delete(goldenResponseCache.keys().next().value);
  }
}

function writeRoutingAudit(event) {
  if (process.env.ROUTING_AUDIT_ENABLED === "false") return;

  const baseEvent = {
    timestamp: new Date().toISOString(),
    ...event
  };

  fs.promises.appendFile(ROUTING_AUDIT_LOG, `${JSON.stringify(baseEvent)}\n`, "utf8")
    .catch(err => logger.warn("Routing audit write failed", { error: err.message }));
}

app.use(cors());
app.use(bodyParser.json());

// TASK 1 — SAFE NEO4J SINGLETON INITIALIZATION (prevents duplicate connections on hot reload)
if (!global.neo4jInitialized) {
  try {
    const neo4jDriver = await connectNeo4j();
    global.neo4jInitialized = Boolean(neo4jDriver);
    if (neo4jDriver) {
      console.log("Neo4j connected successfully");
    } else {
      console.warn("Neo4j unavailable on startup; lazy reconnect will retry during health checks and KG queries");
    }
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
   CONVERSATION MEMORY & CACHE (PERSISTENT CHAT HISTORY)
=========================================================== */

await loadConversations();

const conversationServiceApi = {
  listConversations,
  createConversation,
  getConversationById,
  renameConversation,
  pinConversation,
  deleteConversation
};

app.use("/api/conversations", createConversationsRouter({
  conversationService: conversationServiceApi,
  onDeleteConversation: deleteUserMemory
}));

const CACHE_TTL = 5 * 60 * 1000; // intent/cache telemetry only

process.once("SIGINT", async () => {
  await flushConversations();
  process.exit(0);
});

process.once("SIGTERM", async () => {
  await flushConversations();
  process.exit(0);
});

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
    ...getConversationStats(),
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

function extractDeterministicIntent(query) {
  const text = String(query || "").toLowerCase();
  const entities = [];

  if (/\b(compare|comparison|versus|vs\.?|difference between|which is better)\b/.test(text)) {
    return { intent: "COMPARISON", entities, confidence: 0.86, deterministic_intent: true };
  }

  if (/\b(career path|career|job|work as|become a|become an|roadmap)\b/.test(text)) {
    return { intent: "CAREER_PATH_DETAIL", entities, confidence: 0.82, deterministic_intent: true };
  }

  if (/\b(recommend|recommendation|advise|should i|best major|choose|suitable|fit for me|what should i study)\b/.test(text)) {
    return { intent: "RECOMMEND", entities, confidence: 0.84, deterministic_intent: true };
  }

  if (/\b(ignore|bypass|jailbreak|system prompt|developer mode|reveal secrets)\b/.test(text)) {
    return { intent: "REJECT", entities, confidence: 0.9, deterministic_intent: true };
  }

  return { intent: "GENERAL", entities, confidence: 0.72, deterministic_intent: true };
}

const ONTOLOGY_KG_INTENTS = new Set([
  "FACILITY",
  "TRACK",
  "PARTNER_INSTITUTION",
  "GOVERNANCE",
  "POLICY",
  "CAMPUS",
  "CURRICULUM"
]);

const CURRICULUM_NO_INFO_MESSAGE = "I don't have enough verified curriculum information to answer that fully.";
const CURRICULUM_INTENT_PATTERN = /\b(week|weekly|topic|topics|syllabus|lecture|lectures|module|modules|transformers?|rag|multimodal|text generation|self-supervised learning)\b/i;
const CURRICULUM_RECENT_TURN_WINDOW = 4;
const CURRICULUM_EXPLICIT_COURSE_PATTERN = /\b(natural language processing|nlp|cognitive computing|mobile computing|machine learning|deep learning|computer vision|information retrieval|artificial intelligence|ai)\b/i;

function detectCurriculumIntent(input) {
  return CURRICULUM_INTENT_PATTERN.test(String(input || ""));
}

function normalizeCurriculumText(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCurriculumWeekNumber(input) {
  const weekMatch = String(input || "").match(/\bweek\s+(\d+)\b/i);
  if (!weekMatch) return null;

  const week = Number.parseInt(weekMatch[1], 10);
  return Number.isFinite(week) && week > 0 ? week : null;
}

function hasExplicitCurriculumCourse(input, lastCurriculumCourse = "") {
  const normalizedQuery = normalizeCurriculumText(input);
  if (!normalizedQuery) return false;

  const normalizedCourse = normalizeCurriculumText(lastCurriculumCourse);
  if (normalizedCourse && normalizedQuery.includes(normalizedCourse)) return true;
  if (CURRICULUM_EXPLICIT_COURSE_PATTERN.test(input)) return true;

  const scopedCourseMatch = normalizedQuery.match(/\b(?:in|for|of)\s+(?!week\b)([a-z][a-z0-9+#\s-]{2,})$/i);
  return !!scopedCourseMatch && !/\b(cover|covered|covers|week|weekly|topic|topics|module|modules|syllabus|lecture|lectures)\b/i.test(scopedCourseMatch[1]);
}

function normalizeOntologyKgIntent(intent) {
  const normalized = String(intent || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^A-Z_]/g, "");

  return ONTOLOGY_KG_INTENTS.has(normalized) ? normalized : null;
}

function detectOntologyPrerouteIntent(input) {
  const queryText = String(input || "").toLowerCase();

  if (detectCurriculumIntent(queryText)) {
    return "CURRICULUM";
  }

  if (/\b(partner institution|partner institutions|partner university|partner universities|academic partner|academic partners|international partner|international partners|international collaboration|uclan|barcelona)\b/.test(queryText)) {
    return "PARTNER_INSTITUTION";
  }

  if (/\b(facility|facilities|lab|labs|laboratory|laboratories|robotics|robotics lab|iot lab|internet of things lab)\b/.test(queryText)) {
    return "FACILITY";
  }

  if (/\b(governance|governance unit|governance units|program governance|quality unit|quality assurance unit)\b/.test(queryText)) {
    return "GOVERNANCE";
  }

  if (/\b(policy|policies|grading|grading policy|grading policies|grading system|passing criteria)\b/.test(queryText)) {
    return "POLICY";
  }

  if (/\b(track|tracks|specialization|specializations|pathway|pathways)\b/.test(queryText)) {
    return "TRACK";
  }

  if (/\b(campus|campuses|branch|branches|el alamein|new el alamein)\b/.test(queryText)) {
    return "CAMPUS";
  }

  return null;
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

  if (!runtimeMode.llmIntentEnabled) {
    const deterministicIntent = extractDeterministicIntent(query);
    intentCache.set(qKey, { time: Date.now(), data: deterministicIntent });
    pruneIntentCache();
    incrementMetric("intent_deterministic_total");
    console.log(`[Intent][${requestId}] deterministic intent: ${deterministicIntent.intent}`);
    return deterministicIntent;
  }

  try {
    const safeQuery = sanitizePromptInput(query);
    console.time(`[LLM][${requestId}]`);
    const intentPrompt = `Analyze the user's intent.
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
}`;
    const intentTimeoutMs = timeoutFromEnv(["INTENT_TIMEOUT_MS"], 20000);
    const intentDeadlineMs = timeoutFromEnv(["INTENT_DEADLINE_MS"], 20000);
    console.log(`[Intent][${requestId}] Effective timeout budget timeout=${intentTimeoutMs}ms deadline=${intentDeadlineMs}ms`);
    let rawToken = "";
    try {
      rawToken = await generateStableResponse({
        prompt: intentPrompt,
        model: process.env.OLLAMA_INTENT_MODEL || process.env.PRIMARY_MODEL || process.env.OLLAMA_MODEL || "gemma4:e2b",
        requestId: `intent_${requestId}`,
        timeoutMs: intentTimeoutMs,
        deadlineMs: intentDeadlineMs,
        routeType: "INTENT",
        trafficType: "intent",
        options: {
          temperature: 0,
          top_p: 0.1,
          repeat_penalty: 1.08,
          num_predict: 96,
        },
      });
    } finally {
      console.timeEnd(`[LLM][${requestId}]`);
    }

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
    if (
      err.name === "AbortError" ||
      err.code === "GEMMA_QUEUE_TIMEOUT" ||
      err.code === "GEMMA_QUEUE_OVERFLOW" ||
      /timeout|timed out|queue/i.test(err.message || "")
    ) {
      const intentRetryLimit = Number(process.env.INTENT_RETRY_LIMIT || 0);
      if (!isRetry && intentRetryLimit > 0) {
        console.warn(`[Intent][${requestId}] Timeout, retrying...`);
        return extractDynamicIntent(query, requestId, true);
      }
      console.error(`[Intent][${requestId}] Ollama Timeout; falling back to deterministic GENERAL routing`);
      logToFile(`OLLAMA TIMEOUT [${requestId}] (Intent)`);
      return { intent: "GENERAL", entities: [], confidence: 0.2, degraded_reason: "INTENT_TIMEOUT" };
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
  let conversationId = "UNKNOWN";
  let convo = null;
  let activeUserQuery = "";
  let responseKgCompletionGuard = null;

  res.json = function (body) {
    const sendBody = (finalBody) => {
      const duration = Date.now() - requestStartTime;
      const size = Buffer.byteLength(JSON.stringify(finalBody));
      recordDuration("http_chatbot_latency_ms", duration);
      incrementMetric(res.statusCode >= 400 ? "http_chatbot_failure_total" : "http_chatbot_success_total");
      logger.info("Chatbot response completed", {
        requestId,
        source: finalBody?.route || finalBody?.source || "unknown",
        durationMs: duration,
        responseBytes: size
      });
      console.log(`[RESPONSE][${requestId}] route=${finalBody?.route || finalBody?.source || "unknown"} time=${duration}ms size=${size}b`);
      if (finalBody?.cid && !finalBody.conversation) {
        const conversation = getConversationSummary(finalBody.cid);
        if (conversation) finalBody.conversation = conversation;
      }
      return originalJson.call(this, finalBody);
    };

    if (!shouldHumanizeResponseBody(body, { statusCode: res.statusCode })) {
      console.log(`[GEMINI_HUMANIZER][HUMANIZER_SKIPPED][${requestId}] reason=INELIGIBLE_RESPONSE route=${body?.route || body?.source || "unknown"}`);
      return sendBody(body);
    }

    const runHumanizerAfterKgCompletion = async () => {
      if (typeof responseKgCompletionGuard === "function") {
        await responseKgCompletionGuard("HUMANIZER_KG_COMPLETION_GUARD");
      }

      const route = body?.metadata?.trace?.route || body?.route || body?.source || "unknown";
      const groundedAnswer = body?.final_answer || body?.answer;

      return humanizeGroundedAnswer({
        query: activeUserQuery,
        groundedAnswer,
        requestId,
        route,
        responseBody: body
      });
    };

    runHumanizerAfterKgCompletion()
      .then((humanized) => {
        const finalBody = { ...body };
        if (humanized?.answer) {
          finalBody.answer = humanized.answer;
          finalBody.final_answer = humanized.answer;
          finalBody.metadata = {
            ...(finalBody.metadata || {}),
            humanizer: {
              provider: humanized.provider || "gemini",
              changed: Boolean(humanized.changed),
              fallback: Boolean(humanized.fallback),
              skipped: Boolean(humanized.skipped),
              reason: humanized.reason || null,
              expansion_reason: humanized.expansionReason || null,
              latency_ms: humanized.latencyMs || null
            }
          };
        }
        sendBody(finalBody);
      })
      .catch((error) => {
        const route = body?.metadata?.trace?.route || body?.route || body?.source || "unknown";
        console.log(`[GEMINI_HUMANIZER][HUMANIZER_FALLBACK][${requestId}] reason=${error?.message || "UNHANDLED_ERROR"} route=${route}`);
        sendBody(body);
      });

    return this;
  };

  try {
    console.log(`[Chatbot][${requestId}] Request Started`);

    const { query: rawQuery, cid } = req.body ?? {};
    if (!rawQuery || typeof rawQuery !== "string" || rawQuery.trim() === "") {
      return res.status(400).json(responseFormatter.formatErrorFallback("Query is required.", "ERROR", "UNKNOWN", requestId, {}));
    }

    const originalQuery = rawQuery.trim();
    activeUserQuery = originalQuery;
    const normalization = normalizeAcademicQuery(originalQuery);
    let query = normalization.normalized || originalQuery;
    let goldenMatch = null;
    const normalizationTrace = {
      enabled: true,
      changed: normalization.changed,
      original_query: originalQuery,
      normalized_query: query,
      correction_count: normalization.correction_count,
      corrections: normalization.corrections
    };

    conversationId = normalizeConversationId(cid) || makeConversationId();
    console.log(`[REQUEST][${requestId}] ${originalQuery} CID: ${conversationId}`);

    if (normalization.changed) {
      incrementMetric("query_normalization_applied");
      incrementMetric(`query_normalization_corrections_${Math.min(normalization.correction_count, 5)}`);
      logger.info("Academic query normalized", {
        requestId,
        originalQuery,
        normalizedQuery: query,
        corrections: normalization.corrections
      });
      console.log(`[NORMALIZE][${requestId}] "${originalQuery}" -> "${query}"`);
    }

    convo = await getConversation(conversationId);
    const priorConversationMessages = Array.isArray(convo.messages)
      ? convo.messages.map(message => ({ ...message }))
      : [];
    const priorConversationMemory = getConversationMemory(conversationId);

    console.log(`[CONVERSATION_PRIORITY][${requestId}] pre-router conversation gate active`);
    const metaIntent = detectMetaConversationIntent(originalQuery) || detectMetaConversationIntent(query);
    if (metaIntent) {
      console.log(`[META_INTENT_DETECTED][${requestId}] type=${metaIntent.type} source=${metaIntent.source || "unknown"}`);

      const metaAnswer = buildConversationMetaResponse(metaIntent, {
        messages: priorConversationMessages,
        conversationMemory: priorConversationMemory
      });

      logToFile(`USER [${conversationId}]: ${originalQuery}`);
      await pushTurn(conversationId, convo, "user", originalQuery);
      await pushTurn(conversationId, convo, "assistant", metaAnswer);

      incrementMetric("conversation_meta_intent_hits");
      incrementMetric(`conversation_meta_${String(metaIntent.type || "unknown").toLowerCase()}_hits`);

      const metaRouteDiagnostics = {
        final_route: "CONVERSATION_META",
        route_chosen: "CONVERSATION_META",
        route_reasoning: "Deterministic local conversation meta intent handled before all routing and retrieval.",
        meta_intent: metaIntent.type,
        heavy_routing_bypassed: true,
        brain_router_bypassed: true,
        neo4j_bypassed: true,
        rag_bypassed: true,
        gemini_bypassed: true,
        ollama_bypassed: true,
        unified_synthesis_bypassed: true,
        query_normalization: normalizationTrace
      };

      writeRoutingAudit({
        requestId,
        cid: conversationId,
        query,
        originalQuery,
        final_route: "CONVERSATION_META",
        confidence: 1,
        response_tier: "CONVERSATION_META",
        latency_ms: Date.now() - requestStartTime,
        degraded_services: [],
        fallback_triggers: [],
        failure_diagnostics: [],
        meta_intent: metaIntent.type,
        bypassed: ["BrainRouter", "Neo4j", "RAG", "Gemini", "Ollama", "UnifiedSynthesis"]
      });

      console.log(`[CONVERSATIONAL_BYPASS][${requestId}] BrainRouter KG RAG Gemini Ollama UnifiedSynthesis bypassed`);
      console.log(`[META_RESPONSE_RETURNED][${requestId}] route=CONVERSATION_META`);
      return res.json(responseFormatter.format({
        answer: metaAnswer,
        final_answer: metaAnswer,
        confidence: 1,
        route: "CONVERSATION_META",
        sources: ["CONVERSATION_META"],
        used_facts: [],
        missing_information: [],
        graph: { nodes: [], links: [] },
        explainability: {
          deterministic: true,
          conversation_meta: true,
          brain_router_bypassed: true,
          llm_bypassed: true,
          neo4j_bypassed: true,
          rag_bypassed: true,
          gemini_bypassed: true,
          ollama_bypassed: true,
          unified_synthesis_bypassed: true
        },
        reasoning: "Local conversation meta query answered from existing conversation history and lightweight memory."
      }, conversationId, requestId, {
        degraded_services: [],
        subsystem_health: {},
        latency_ms: Date.now() - requestStartTime,
        routing_confidence: 1,
        response_tier: "CONVERSATION_META",
        query_normalization: normalizationTrace,
        route_diagnostics: metaRouteDiagnostics
      }));
    }

    logToFile(`USER [${conversationId}]: ${originalQuery}`);
    await pushTurn(conversationId, convo, "user", originalQuery);

    const recordAssistantTurn = async (assistantAnswer, memoryContext = {}) => {
      await pushTurn(conversationId, convo, "assistant", assistantAnswer);

      try {
        await updateConversationMemoryFromTurn(conversationId, convo, {
          userQuery: originalQuery,
          normalizedQuery: query,
          assistantAnswer,
          ...memoryContext
        });
      } catch (memoryErr) {
        logger.warn("Lightweight conversation memory update failed", {
          requestId,
          cid: conversationId,
          error: memoryErr.message
        });
      }
    };

    const returnLocalConversation = async ({
      answer,
      route,
      type,
      confidence = 1,
      reasoning = "Local deterministic conversation priority response.",
      memoryContext = {},
      updateMemory = false
    }) => {
      if (updateMemory) {
        await recordAssistantTurn(answer, {
          route,
          intent: type,
          ...memoryContext
        });
      } else {
        await pushTurn(conversationId, convo, "assistant", answer);
      }

      const routeDiagnostics = {
        final_route: route,
        route_chosen: route,
        route_reasoning: reasoning,
        conversation_priority_type: type,
        heavy_routing_bypassed: true,
        brain_router_bypassed: true,
        neo4j_bypassed: true,
        rag_bypassed: true,
        gemini_bypassed: true,
        ollama_bypassed: true,
        unified_synthesis_bypassed: true,
        query_normalization: normalizationTrace
      };

      writeRoutingAudit({
        requestId,
        cid: conversationId,
        query,
        originalQuery,
        final_route: route,
        confidence,
        response_tier: "CONVERSATION_PRIORITY",
        latency_ms: Date.now() - requestStartTime,
        degraded_services: [],
        fallback_triggers: [],
        failure_diagnostics: [],
        conversation_priority_type: type,
        bypassed: ["BrainRouter", "Neo4j", "RAG", "Gemini", "Ollama", "UnifiedSynthesis"]
      });

      console.log(`[CONVERSATIONAL_BYPASS][${requestId}] BrainRouter KG RAG Gemini Ollama UnifiedSynthesis bypassed`);
      return res.json(responseFormatter.format({
        answer,
        final_answer: answer,
        confidence,
        route,
        sources: ["CONVERSATION"],
        used_facts: [],
        missing_information: [],
        graph: { nodes: [], links: [] },
        explainability: {
          deterministic: true,
          conversation_priority: true,
          type,
          brain_router_bypassed: true,
          llm_bypassed: true,
          neo4j_bypassed: true,
          rag_bypassed: true,
          gemini_bypassed: true,
          ollama_bypassed: true,
          unified_synthesis_bypassed: true
        },
        reasoning
      }, conversationId, requestId, {
        degraded_services: [],
        subsystem_health: {},
        latency_ms: Date.now() - requestStartTime,
        routing_confidence: confidence,
        response_tier: "CONVERSATION_PRIORITY",
        query_normalization: normalizationTrace,
        route_diagnostics: routeDiagnostics
      }));
    };

    const lightConversationalIntent = detectLightConversationalIntent(originalQuery, {
      conversationMemory: priorConversationMemory
    });

    if (lightConversationalIntent) {
      const localAnswer = buildLightConversationalResponse(lightConversationalIntent, {
        conversationMemory: priorConversationMemory
      });

      incrementMetric("conversation_light_intent_hits");
      incrementMetric(`conversation_light_${String(lightConversationalIntent.type || "unknown").toLowerCase()}_hits`);

      return await returnLocalConversation({
        answer: localAnswer,
        route: "CONVERSATION_LIGHT",
        type: lightConversationalIntent.type,
        confidence: lightConversationalIntent.confidence || 0.95,
        reasoning: "Short conversational query answered locally before retrieval routing."
      });
    }

    const followUpResolution = resolveFollowUpReference(originalQuery, priorConversationMemory);

    if (followUpResolution.detected && !followUpResolution.resolved) {
      incrementMetric("conversation_followup_clarification");
      return await returnLocalConversation({
        answer: followUpResolution.clarification,
        route: "CONVERSATION_FOLLOWUP_CLARIFY",
        type: "FOLLOW_UP_REFERENCE",
        confidence: 0.9,
        reasoning: "Follow-up reference was detected but could not be resolved from lightweight memory."
      });
    }

    if (followUpResolution.detected && followUpResolution.resolved) {
      const resolvedNormalization = normalizeAcademicQuery(followUpResolution.resolvedQuery);
      query = resolvedNormalization.normalized || followUpResolution.resolvedQuery;
      normalizationTrace.conversation_priority = {
        type: "FOLLOW_UP_REFERENCE",
        resolved: true,
        target: followUpResolution.target,
        target_type: followUpResolution.targetType,
        source: followUpResolution.source,
        original_followup_query: originalQuery,
        resolved_query: query,
        correction_count: resolvedNormalization.correction_count,
        corrections: resolvedNormalization.corrections
      };

      incrementMetric("conversation_followup_resolved");
      logger.info("Follow-up reference resolved before routing", {
        requestId,
        cid: conversationId,
        originalQuery,
        resolvedQuery: query,
        target: followUpResolution.target,
        source: followUpResolution.source
      });
      console.log(`[FOLLOWUP_RESOLVED][${requestId}] target=${JSON.stringify(followUpResolution.target)} resolved_query="${query}"`);
    }

    goldenMatch = classifyGoldenQuery(query);
    if (goldenMatch) {
      incrementMetric("golden_path_detected");
      logger.info("Golden path query detected", {
        requestId,
        goldenId: goldenMatch.id,
        category: goldenMatch.category,
        route: goldenMatch.route,
        priority: goldenMatch.priority
      });
    }

    const multiIntentPlan = detectAcademicMultiIntents(query);
    if (multiIntentPlan.isMultiIntent && goldenMatch) {
      normalizationTrace.multi_intent_overrode_single_golden_path = {
        golden_id: goldenMatch.id,
        intents: multiIntentPlan.intents.map(intent => intent.key),
        subject: multiIntentPlan.subject
      };
      goldenMatch = null;
      incrementMetric("conversation_multi_intent_overrode_golden");
    }

    if (isDemoGraphQuery(query) || isDemoGraphQuery(originalQuery)) {
      incrementMetric("route_demo_graph_hits");
      const demoPayload = await buildDemoGraphResponse({
        conversationId,
        requestId,
        normalizationTrace,
        latencyMs: Date.now() - requestStartTime
      });

      await recordAssistantTurn(demoPayload.answer, {
        route: "DEMO_GRAPH",
        usedFacts: demoPayload.used_facts || []
      });
      writeRoutingAudit({
        requestId,
        cid: conversationId,
        query,
        originalQuery,
        final_route: "DEMO_GRAPH",
        confidence: 1,
        response_tier: "DEMO_SHOWCASE",
        latency_ms: Date.now() - requestStartTime,
        degraded_services: []
      });

      return res.json(demoPayload);
    }

    // ---------- 1. PRE-ROUTING (GREETING/FAQ) ----------
    let answer = checkGreeting(query);
    if (answer) {
      await recordAssistantTurn(answer, { route: "GREETING", intent: "GREETING" });
      incrementMetric("route_greeting_hits");
      const earlyTrace = { degraded_services: [], subsystem_health: {}, latency_ms: Date.now() - requestStartTime, routing_confidence: 1.0, query_normalization: normalizationTrace };
      return res.json(responseFormatter.formatStatic(answer, "FAQ", 1.0, conversationId, requestId, earlyTrace));
    }

    const faqHit = searchFAQ(query);
    if (faqHit) {
      await recordAssistantTurn(faqHit.answer, {
        route: "FAQ",
        intent: "FAQ",
        faqContext: faqHit
      });
      incrementMetric("route_faq_hits");
      const earlyTrace = { degraded_services: [], subsystem_health: {}, latency_ms: Date.now() - requestStartTime, routing_confidence: 0.9, query_normalization: normalizationTrace };
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
    const prerouteDegradedServices = [];
    const pMatchQuery = query.match(/\b\d{2,3}\b/);
    const bMatchQuery = query.match(/-?\b\d{4,6}\b/) || query.match(/budget[\s\w]*?(-?\d+)/i);
    const kMatchQuery = query.match(/(-?\d+)\s*[kK]\b/);
    const memForRouting = getUserMemory(conversationId);
    const isProfileIncomplete = !memForRouting?.studentProfile?.high_school_percentage || !memForRouting?.studentProfile?.budget;

    const factualRegex = /^(who|what|where|which|how|when)\b/i;
    const isFactual = factualRegex.test(query.trim());

    const programKeywords = ["courses", "curriculum", "subjects", "study plan", "major", "track", "tracks", "program", "roadmap"];
    const isProgramQuery = programKeywords.some(kw => query.toLowerCase().includes(kw));
    const ontologyPrerouteIntent = detectOntologyPrerouteIntent(query);

    if (goldenMatch) {
      intentData = {
        intent: goldenMatch.intent || "GENERAL",
        confidence: 1.0,
        entities: extractGoldenEntities(goldenMatch, query),
        golden_path: goldenMatch.id
      };
    } else if (followUpResolution?.resolved && followUpResolution.intentHint) {
      intentData = {
        intent: followUpResolution.intentHint,
        confidence: followUpResolution.confidence || 0.82,
        entities: [followUpResolution.target].flat().filter(Boolean),
        conversation_followup: true
      };
    } else if (multiIntentPlan?.isMultiIntent) {
      intentData = {
        intent: "GENERAL",
        confidence: multiIntentPlan.confidence || 0.9,
        entities: multiIntentPlan.subject ? [multiIntentPlan.subject] : [],
        multi_intent: multiIntentPlan.intents.map(intent => intent.key)
      };
    } else if (ontologyPrerouteIntent) {
      intentData = {
        intent: ontologyPrerouteIntent,
        confidence: 1.0,
        entities: [],
        ontology_preroute: true
      };
    } else if (isProgramQuery) {
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

    if (intentData.degraded_reason) {
      prerouteDegradedServices.push(intentData.degraded_reason);
      incrementMetric("intent_degraded_fallback");
    }

    console.log(`[INTENT][${requestId}] intent: ${intentKeyword}, confidence: ${confidence}, entities: ${JSON.stringify(entities)}`);

    if (intentKeyword === "UNKNOWN_TIMEOUT") {
      incrementMetric("route_timeout_errors");
      prerouteDegradedServices.push("INTENT_TIMEOUT");
      intentKeyword = "GENERAL";
    }

    const KNOWN_INTENTS = ["GENERAL", "RECOMMEND", "RECOMMENDATION", "DECISION", "CAREER_PATH_DETAIL", "COMPARISON", "REJECT", "PREREQUISITE", "TEACHING", "DEAN", "ADMIN", "PERSON", "PROGRAM", "FACILITY", "TRACK", "PARTNER_INSTITUTION", "GOVERNANCE", "POLICY", "CAMPUS", "CURRICULUM", "UNKNOWN_PARSE"];
    if (!KNOWN_INTENTS.includes(intentKeyword)) {
      intentKeyword = "GENERAL";
    }
    const PROTECTED_KG_INTENTS = new Set(["TEACHING", "PREREQUISITE", "ADMIN", "PERSON"]);
    const normalizeIntentKeyword = (candidate) => String(candidate || "").trim().toUpperCase();
    const isProtectedKgIntent = (candidate) => PROTECTED_KG_INTENTS.has(normalizeIntentKeyword(candidate));
    const inferProtectedKgIntentFromQuery = (text) => {
      const normalized = String(text || "").toLowerCase().replace(/[^a-z0-9+#\s]/g, " ").replace(/\s+/g, " ").trim();
      if (
        /\b(teach|teaches|teacher|teachers|teaching|taught|instructs)\b/.test(normalized) &&
        !isCourseByTopicLookup(normalized)
      ) return "TEACHING";
      if (/\b(dean|admin|administrator|chairman|director|leadership)\b|\bhead of\b/.test(normalized)) return "ADMIN";
      if (
        /\b(prerequisite|prerequisites|prequisite|prequsties|prereq)\b|\brequired before\b|\bbefore taking\b/.test(normalized) ||
        (/\b(require|requires|required|need|needs)\b/.test(normalized) && /\b(course|courses|subject|subjects|module|modules|linear algebra|machine learning|deep learning|fundamentals of ai)\b/.test(normalized))
      ) {
        return "PREREQUISITE";
      }
      if (/\bwho is\b|\b(professor|dr|doctor|instructor|staff)\b/.test(normalized)) return "PERSON";
      return null;
    };
    const protectedIntentFromQuery = inferProtectedKgIntentFromQuery(query);
    if (isCourseByTopicLookup(query)) {
      intentKeyword = "CURRICULUM";
    } else if (isProtectedKgIntent(goldenMatch?.intent)) {
      intentKeyword = normalizeIntentKeyword(goldenMatch.intent);
    } else if (isProtectedKgIntent(protectedIntentFromQuery)) {
      intentKeyword = protectedIntentFromQuery;
    }
    let lockedOntologyIntent = isProtectedKgIntent(intentKeyword) ? null : normalizeOntologyKgIntent(intentKeyword);

    // ---------- 3. BRAIN ROUTER (PHASE 4) ----------

    // Live Health Probing
    const healthStatus = await checkSubsystemHealth(
      goldenMatch ? { fast: true, optimistic: true } : {}
    );

    const analysisPayload = brainRouter.analyzeQuery(
      { query, intent: intentKeyword, normalization: normalizationTrace },
      intentKeyword,
      { lastRoute: convo.lastRoute || null }
    );

    const routingDecision = brainRouter.determineBestRoute(
      analysisPayload,
      healthStatus,
    );

    let route = routingDecision.route;
    const initialRoute = route;
    const routeOverrideReasons = [];

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

    if (intentKeyword === "CURRICULUM") {
      lockedOntologyIntent = "CURRICULUM";
      routingDecision.routing_features = {
        ...(routingDecision.routing_features || {}),
        ontology_intent: "CURRICULUM",
        intent_hint: "CURRICULUM",
        locked_intent: "CURRICULUM"
      };
      route = ROUTES.KG_DIRECT;
      routingDecision.fallback_chain = [ROUTES.KG_ONLY];
      routeOverrideReasons.push("deterministic_curriculum_kg_lock");
    }

    // PHASE 8: DETERMINISTIC ROUTE LOCKING
    if (
        routingDecision?.deterministic_kg === true ||
        routingDecision?.hard_route === "KG_DIRECT" ||
        routingDecision?.route === ROUTES.KG_DIRECT
    ) {
        route = ROUTES.KG_DIRECT;
        routeOverrideReasons.push("deterministic_kg_lock");
    }

    // SECTION B — QUERY-SAFETY LOCK
    // PHASE 8: Direct entity lock only; hybrid triggers are protected above.
    if (
        route !== ROUTES.HYBRID_KG_RAG &&
        !routingDecision?.routing_features?.force_hybrid &&
        /who teaches|who is teaching|who is|dean|vice dean|head of department|program director|department head/i.test(query)
    ) {
        route = ROUTES.KG_DIRECT;
        routeOverrideReasons.push("direct_academic_entity_lock");
    }

    if (
        followUpResolution?.resolved &&
        followUpResolution.intentHint === "PERSON" &&
        route !== ROUTES.HYBRID_KG_RAG
    ) {
        route = ROUTES.KG_DIRECT;
        routeOverrideReasons.push("resolved_followup_person_lock");
    }

    const ontologyRouteIntent = isProtectedKgIntent(goldenMatch?.intent) || isProtectedKgIntent(intentKeyword)
      ? null
      : (
          lockedOntologyIntent ||
          normalizeOntologyKgIntent(routingDecision?.routing_features?.ontology_intent) ||
          normalizeOntologyKgIntent(routingDecision?.routing_features?.intent_hint) ||
          normalizeOntologyKgIntent(intentKeyword)
        );

    if (
      ontologyRouteIntent &&
      route !== ROUTES.HYBRID_KG_RAG &&
      !routingDecision?.routing_features?.force_hybrid
    ) {
      lockedOntologyIntent = ontologyRouteIntent;
      intentKeyword = lockedOntologyIntent;
      routingDecision.routing_features = {
        ...(routingDecision.routing_features || {}),
        ontology_intent: lockedOntologyIntent,
        intent_hint: lockedOntologyIntent,
        locked_intent: lockedOntologyIntent
      };
      route = ROUTES.KG_DIRECT;
      routeOverrideReasons.push("deterministic_ontology_kg_lock");
      routingDecision.fallback_chain = lockedOntologyIntent === "CURRICULUM"
        ? [ROUTES.KG_ONLY]
        : (routingDecision.fallback_chain || [])
          .filter(candidate => candidate !== ROUTES.RAG_ONLY && candidate !== ROUTES.RAG_DIRECT);
    }

    if (multiIntentPlan?.isMultiIntent) {
        route = ROUTES.HYBRID_KG_RAG;
        routeOverrideReasons.push("deterministic_multi_intent_merge");
    }

    if (route !== routingDecision.route) {
      routingDecision.route = route;
      routingDecision.telemetry = {
        ...(routingDecision.telemetry || {}),
        route_chosen: route,
        initial_route: initialRoute,
        override_reasons: routeOverrideReasons
      };
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
    let degraded_services = [...new Set(prerouteDegradedServices)];
    let kgRawData = null; // Hoisted for universal explainability injection
    const routeDiagnostics = {
      ...(routingDecision.telemetry || {}),
      initial_route: initialRoute,
      final_route: route,
      route_reasoning: routingDecision.reasoning,
      thresholds_used: routingDecision.thresholds || routingDecision.telemetry?.thresholds_used || {},
      fallback_chain: routingDecision.fallback_chain || [],
      fallback_triggers: [],
      failure_diagnostics: [],
      conversation_priority: {
        follow_up: followUpResolution?.detected ? {
          resolved: followUpResolution.resolved,
          target: followUpResolution.target,
          target_type: followUpResolution.targetType,
          source: followUpResolution.source,
          resolved_query: followUpResolution.resolvedQuery || null
        } : null,
        multi_intent: multiIntentPlan?.isMultiIntent ? {
          intents: multiIntentPlan.intents.map(intent => intent.key),
          subject: multiIntentPlan.subject
        } : null
      },
      golden_path: goldenMatch ? {
        id: goldenMatch.id,
        category: goldenMatch.category,
        execution: goldenMatch.execution,
        priority: goldenMatch.priority,
        route: goldenMatch.route,
        cacheable: goldenMatch.cacheable
      } : null,
      query_normalization: normalizationTrace,
      locked_intent: lockedOntologyIntent
    };

    const hasRecentCurriculumContext = () => {
      const lastIntent = String(priorConversationMemory?.lastIntent || "").toUpperCase();
      if (lastIntent !== "CURRICULUM") return false;
      if (!convo.lastCurriculumCourse) return false;

      const recentTurns = priorConversationMessages
        .filter(message => message?.role && message.role !== "system")
        .slice(-CURRICULUM_RECENT_TURN_WINDOW);

      const normalizedCourse = normalizeCurriculumText(convo.lastCurriculumCourse);
      return recentTurns.some(message => {
        const content = String(message?.content || "");
        const normalizedContent = normalizeCurriculumText(content);
        return (
          (normalizedCourse && normalizedContent.includes(normalizedCourse)) ||
          /\b(syllabus|week|weekly|topic|topics|module|modules|curriculum)\b/i.test(content)
        );
      });
    };

    const resolveCurriculumCarryoverQuery = (retrievalQuery, resolvedIntent) => {
      if (resolvedIntent !== "CURRICULUM") {
        return { retrievalQuery, reused: false };
      }

      const weekNumber = extractCurriculumWeekNumber(retrievalQuery);
      const lastCurriculumCourse = String(convo.lastCurriculumCourse || "").trim();

      if (!weekNumber || !lastCurriculumCourse) {
        return { retrievalQuery, reused: false };
      }

      if (hasExplicitCurriculumCourse(retrievalQuery, lastCurriculumCourse)) {
        return { retrievalQuery, reused: false };
      }

      if (!hasRecentCurriculumContext()) {
        return { retrievalQuery, reused: false };
      }

      const carriedQuery = `week ${weekNumber} in ${lastCurriculumCourse}`;
      routeDiagnostics.curriculum_context_reuse = {
        matchedCourse: lastCurriculumCourse,
        matchedWeek: weekNumber,
        reason: "FOLLOW_UP_WEEK_QUERY",
        effectiveQuery: carriedQuery
      };
      console.log(`[CURRICULUM_CONTEXT_REUSE] matchedCourse=${lastCurriculumCourse} reason=FOLLOW_UP_WEEK_QUERY effectiveQuery="${carriedQuery}" keywords=["${normalizeCurriculumText(carriedQuery)}"]`);

      return {
        retrievalQuery: carriedQuery,
        reused: true,
        matchedCourse: lastCurriculumCourse,
        matchedWeek: weekNumber
      };
    };

    const resolveSafeMatchedCurriculumCourse = (kgRes, mappedKg = []) => {
      const metadata = kgRes?.metadata || mappedKg?.metadata || {};
      const detectedIntent = String(metadata.detected_intent || "").toUpperCase();
      const sourceType = String(metadata.source_type || "").toUpperCase();

      if (detectedIntent !== "CURRICULUM" && sourceType !== "CURRICULUM_KG") {
        return null;
      }

      const metadataCourse = String(metadata.matched_course || "").trim();
      if (metadataCourse) return metadataCourse;

      const mappedCourses = Array.isArray(mappedKg)
        ? mappedKg
          .map(item => String(item?.metadata?.matched_course || "").trim())
          .filter(Boolean)
        : [];
      const uniqueCourses = [...new Set(mappedCourses)];
      const matchedCourseCount = Number.parseInt(metadata.matched_course_count, 10);

      if (uniqueCourses.length === 1 && (!Number.isFinite(matchedCourseCount) || matchedCourseCount === 1)) {
        return uniqueCourses[0];
      }

      return null;
    };

    const updateLastCurriculumCourse = async (kgRes, mappedKg = []) => {
      const metadata = kgRes?.metadata || mappedKg?.metadata || {};
      const detectedIntent = String(metadata.detected_intent || "").toUpperCase();
      const sourceType = String(metadata.source_type || "").toUpperCase();

      if (detectedIntent !== "CURRICULUM" && sourceType !== "CURRICULUM_KG") return;

      const matchedCourse = resolveSafeMatchedCurriculumCourse(kgRes, mappedKg);
      if (matchedCourse) {
        convo.lastCurriculumCourse = matchedCourse;
      } else {
        delete convo.lastCurriculumCourse;
      }

      await saveConversation(conversationId, convo);
    };

    // TASK 4 — ENHANCED KG CONFIDENCE SCORING
    const shouldSkipGraphRefinementForUnifiedSynthesis = (candidateRoute) => {
      if (
        runtimeMode.defenseMode ||
        runtimeMode.singleGemmaGenerationMode ||
        !runtimeMode.graphRefineEnabled
      ) {
        return true;
      }

      if (
        candidateRoute === ROUTES.HYBRID_KG_RAG &&
        goldenMatch?.execution === "DETERMINISTIC_HYBRID"
      ) {
        return false;
      }

      return candidateRoute === ROUTES.KG_ONLY || candidateRoute === ROUTES.HYBRID_KG_RAG;
    };

    const buildGraphRetrievalOptions = (candidateRoute) => {
      const skipGraphRefinementForUnifiedSynthesis = shouldSkipGraphRefinementForUnifiedSynthesis(candidateRoute);

      return {
        skipGraphRefinementForUnifiedSynthesis
      };
    };

    const kgRetrievalState = {
      launched: false,
      finished: false,
      pending: null,
      intent: null
    };

    const resolveKgRetrievalIntent = (candidateIntent = intentKeyword) => {
      if (isProtectedKgIntent(goldenMatch?.intent)) return normalizeIntentKeyword(goldenMatch.intent);
      if (isProtectedKgIntent(candidateIntent)) return normalizeIntentKeyword(candidateIntent);
      return (
        lockedOntologyIntent ||
        normalizeOntologyKgIntent(candidateIntent) ||
        normalizeOntologyKgIntent(routingDecision?.routing_features?.ontology_intent) ||
        candidateIntent ||
        "GENERAL"
      );
    };

    const runNeo4jRetrieval = async ({
      retrievalQuery = query,
      retrievalIntent = intentKeyword,
      limit = 5,
      routeForOptions = route
    } = {}) => {
      const resolvedIntent = resolveKgRetrievalIntent(retrievalIntent);
      const curriculumCarryover = resolveCurriculumCarryoverQuery(retrievalQuery, resolvedIntent);
      const effectiveRetrievalQuery = curriculumCarryover.retrievalQuery;
      kgRetrievalState.launched = true;
      kgRetrievalState.finished = false;
      kgRetrievalState.intent = resolvedIntent;

      await neo4jSemaphore.acquire();
      const retrievalPromise = fetchNeo4jContext(
        effectiveRetrievalQuery,
        resolvedIntent,
        limit,
        requestId,
        getConversationContext(conversationId, MAX_CONTEXT_TURNS),
        buildGraphRetrievalOptions(routeForOptions)
      );
      kgRetrievalState.pending = retrievalPromise;

      try {
        return await retrievalPromise;
      } finally {
        kgRetrievalState.finished = true;
        kgRetrievalState.pending = null;
        neo4jSemaphore.release();
      }
    };

    const buildKgResponse = (kgRes) => {
        if (!kgRes || !Array.isArray(kgRes)) return [];
        const kgMetadata = kgRes.metadata || {};
        if (kgRes.length === 0) {
          const empty = [];
          if (kgRes.deterministic) {
            Object.defineProperty(empty, 'deterministic', { value: true, enumerable: false });
            Object.defineProperty(empty, 'llm_bypassed', { value: true, enumerable: false });
            Object.defineProperty(empty, 'answer', { value: kgRes.answer, enumerable: false });
          }
          Object.defineProperty(empty, 'metadata', { value: kgMetadata, enumerable: false });
          Object.defineProperty(empty, 'confidence', { value: kgRes.confidence || 0, enumerable: false });
          return empty;
        }
        const routeFeatures = routingDecision.routing_features || {};
        const parseConfidence = (value) => {
          const n = Number.parseFloat(value);
          return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
        };

        // Pre-compute query tokens for entity overlap scoring
        const queryTokens = new Set(
          query.toLowerCase().split(/\W+/).filter(t => t.length > 3)
        );

        const mapped = kgRes.map(item => {
          const text = String(item.text || item);
          const itemMetadata = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
          const itemSourceType = item?.source_type || itemMetadata.source_type || kgMetadata.source_type || "KG";
          const relCount = (text.match(/--\[.*?\]-->/g) || []).length;
          const nodeCount = (text.match(/\(.*?\)/g) || []).length;
          const sourceScore = parseConfidence(item.score ?? item.baseScore ?? kgRes.confidence);

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
            + (sourceScore * 0.18)
            + ((routeFeatures.entity_confidence || 0) * 0.08)
            + ((routeFeatures.alias_confidence || 0) * 0.05)
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
              source: itemSourceType === "CURRICULUM_KG" ? "CURRICULUM_KG" : "KnowledgeGraph",
              node_count: nodeCount,
              rel_count: relCount,
              overlap_score: parseFloat(overlapScore.toFixed(3)),
              source_score: parseFloat(sourceScore.toFixed(3)),
              entity_score: routeFeatures.entity_confidence || 0,
              alias_score: routeFeatures.alias_confidence || 0,
              ...itemMetadata,
              kg_retrieval: kgMetadata
            },
            source_type: itemSourceType
          };
        });

        // PHASE 4.2: Preserve deterministic metadata flags from raw KG response
        if (kgRes.deterministic) {
            Object.defineProperty(mapped, 'deterministic', { value: true, enumerable: false });
            Object.defineProperty(mapped, 'llm_bypassed', { value: true, enumerable: false });
            Object.defineProperty(mapped, 'answer', { value: kgRes.answer, enumerable: false });
        }
        Object.defineProperty(mapped, 'metadata', { value: kgMetadata, enumerable: false });
        Object.defineProperty(mapped, 'confidence', { value: kgRes.confidence || mapped[0]?.confidence || 0, enumerable: false });

        return mapped;
      };

    const ensureKgRetrievalFinished = async (reason) => {
      if (!kgRetrievalState.launched || kgRetrievalState.finished || !kgRetrievalState.pending) {
        return;
      }

      logger.warn("Awaiting pending KG retrieval before downstream finalization", {
        requestId,
        reason,
        intent: kgRetrievalState.intent
      });

      const completedKgRawData = await kgRetrievalState.pending;
      kgRawData = kgRawData || completedKgRawData;
      rawResults.kg = buildKgResponse(kgRawData);
    };

    responseKgCompletionGuard = ensureKgRetrievalFinished;

    const getKgSelectedFactCount = (kgRes, mappedKg = []) => {
      const metadata = kgRes?.metadata || mappedKg?.metadata || {};
      const candidates = [
        metadata.selected_fact_count,
        metadata.selectedFactsCount,
        Array.isArray(kgRes) ? kgRes.length : null,
        Array.isArray(mappedKg) ? mappedKg.length : null
      ];

      for (const candidate of candidates) {
        const parsed = Number.parseInt(candidate, 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }

      return 0;
    };

    const hasProtectedOntologyKgFacts = (kgRes, mappedKg = []) => {
      const metadata = kgRes?.metadata || mappedKg?.metadata || {};
      const detectedKgIntent = String(
        metadata.detected_intent ||
        routingDecision?.routing_features?.ontology_intent ||
        intentKeyword ||
        ""
      ).toUpperCase();

      return ONTOLOGY_KG_INTENTS.has(detectedKgIntent) &&
        getKgSelectedFactCount(kgRes, mappedKg) > 0;
    };

    const lockKgDirectRouteForSelectedOntologyFacts = (reason) => {
      const selectedOntologyIntent =
        normalizeOntologyKgIntent(kgRawData?.metadata?.detected_intent) ||
        normalizeOntologyKgIntent(rawResults.kg?.metadata?.detected_intent) ||
        normalizeOntologyKgIntent(routingDecision?.routing_features?.ontology_intent) ||
        lockedOntologyIntent;

      if (selectedOntologyIntent) {
        lockedOntologyIntent = selectedOntologyIntent;
        intentKeyword = lockedOntologyIntent;
        routingDecision.routing_features = {
          ...(routingDecision.routing_features || {}),
          ontology_intent: lockedOntologyIntent,
          intent_hint: lockedOntologyIntent,
          locked_intent: lockedOntologyIntent
        };
        routeDiagnostics.locked_intent = lockedOntologyIntent;
      }

      route = ROUTES.KG_DIRECT;
      routingDecision.route = route;
      routingDecision.fallback_chain = lockedOntologyIntent === "CURRICULUM"
        ? [ROUTES.KG_ONLY]
        : (routingDecision.fallback_chain || [])
          .filter(candidate => candidate !== ROUTES.RAG_ONLY && candidate !== ROUTES.RAG_DIRECT);
      routeDiagnostics.final_route = route;
      routeDiagnostics.route_chosen = route;
      routeDiagnostics.fallback_triggers.push(reason);
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

    const cleanRagDirectAnswer = (answerText) => {
      return String(answerText || "")
        .replace(/\s+/g, " ")
        .replace(/^(according to verified (university )?(academic )?(policy )?sources[:,]?\s*)/i, "")
        .replace(/^(according to (the )?(retrieved|verified) (context|documents|sources)[:,]?\s*)/i, "")
        .replace(/^(based on (the )?(retrieved|verified) (context|documents|sources)[:,]?\s*)/i, "")
        .trim();
    };

    const buildConversationalRagAnswer = (ragRes, evidence = []) => {
      const sourceAnswer = cleanRagDirectAnswer(ragRes?.answer);
      if (sourceAnswer.length >= 30) return sourceAnswer;

      const evidenceSentences = evidence
        .map(item => cleanRagDirectAnswer(item.excerpt))
        .filter(text => text.length >= 30)
        .slice(0, 2);

      if (evidenceSentences.length > 0) return evidenceSentences.join(" ");
      return "I found partial AAST policy context, but the available source text is not specific enough for a direct answer.";
    };

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

      const directAnswer = buildConversationalRagAnswer(ragRes, evidence);

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

    const extractClarificationTarget = () => {
      if (followUpResolution?.target) {
        return Array.isArray(followUpResolution.target)
          ? followUpResolution.target[0]
          : followUpResolution.target;
      }
      if (entities[0]) return entities[0];

      const personMatch = query.match(/\b(?:dr|doctor|professor|prof)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})\b/);
      if (personMatch) return personMatch[1].trim();

      const normalized = query
        .replace(/\b(who|what|where|which|is|are|the|office|of|for|tell me|about|does|teach|teaches)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

      return normalized || "that academic entity";
    };

    const shouldClarifyWeakKgResponse = (kgRes, mappedKg) => {
      if (goldenMatch) return false;
      if (!kgRes || !Array.isArray(mappedKg) || mappedKg.length === 0) return false;

      const metadata = kgRes.metadata || {};
      const selectedFactCount = Number(metadata.selected_fact_count || mappedKg.length || 0);
      const topBaseScore = Number(metadata.top_fact_base_score || kgRes.confidence || 0);
      const personOrOfficeQuery =
        intentKeyword === "PERSON" ||
        followUpResolution?.intentHint === "PERSON" ||
        /\b(who is|dr|doctor|professor|prof|office|room|location)\b/i.test(query);

      return personOrOfficeQuery && selectedFactCount <= 1 && topBaseScore > 0 && topBaseScore < 0.35;
    };

    const returnGoldenPayload = async (payload, responseTier, auditExtra = {}) => {
      const finalRoute = payload.route_used || payload.route || route;
      routeDiagnostics.final_route = finalRoute;
      routeDiagnostics.route_chosen = finalRoute;
      routeDiagnostics.golden_path = {
        ...(routeDiagnostics.golden_path || {}),
        response_tier: responseTier,
        cache_hit: !!auditExtra.cache_hit
      };

      await recordAssistantTurn(payload.final_answer || payload.answer, {
        route: finalRoute,
        intent: goldenMatch?.intent || intentKeyword,
        entities,
        neo4jContext: rawResults.kg || [],
        ragContext: Array.isArray(rawResults.rag?.results) ? rawResults.rag.results : [],
        decisionContext: rawResults.decision || rawResults.career || null,
        faqContext: faqHit || null,
        usedFacts: payload.used_facts || []
      });
      incrementMetric("golden_path_response");
      if (auditExtra.cache_hit) incrementMetric("golden_path_cache_hit");

      writeRoutingAudit({
        requestId,
        cid: conversationId,
        query,
        originalQuery,
        golden_id: goldenMatch?.id,
        category: goldenMatch?.category,
        initial_route: initialRoute,
        final_route: finalRoute,
        confidence: payload.confidence,
        response_tier: responseTier,
        latency_ms: Date.now() - requestStartTime,
        cache_hit: !!auditExtra.cache_hit,
        degraded_services,
        fallback_triggers: routeDiagnostics.fallback_triggers,
        failure_diagnostics: routeDiagnostics.failure_diagnostics
      });

      return res.json(
        responseFormatter.format(
          payload,
          conversationId,
          requestId,
          {
            degraded_services,
            subsystem_health: healthStatus,
            latency_ms: Date.now() - requestStartTime,
            routing_confidence: payload.confidence || routingDecision.confidence || 0,
            response_tier: responseTier,
            query_normalization: normalizationTrace,
            route_diagnostics: routeDiagnostics
          }
        )
      );
    };

    if (goldenMatch) {
      const cachedGoldenPayload = getGoldenCachedPayload(goldenMatch);
      if (cachedGoldenPayload) {
        routeDiagnostics.fallback_triggers.push("GOLDEN_CACHE_HIT");
        cachedGoldenPayload.explainability = {
          ...(cachedGoldenPayload.explainability || {}),
          golden_cache_hit: true,
          llm_bypassed: true
        };
        return await returnGoldenPayload(cachedGoldenPayload, "GOLDEN_CACHE_HIT", { cache_hit: true });
      }
    }

    const retrieveRagEvidence = async (fallbackReason) => {
      routeDiagnostics.fallback_triggers.push(fallbackReason);
      await ragSemaphore.acquire();
      const ragRes = await timeoutWrapper(
        ragService.search(query, { topK: 5 }),
        goldenMatch ? Math.min(goldenMatch.timeoutMs || 2500, 2800) : timeoutFromEnv(["RAG_ROUTE_TIMEOUT_MS", "ROUTE_TIMEOUT_MS"], 20000),
        null
      )
        .finally(() => ragSemaphore.release());

      if (!ragRes) {
        degraded_services.push("RAG_TIMEOUT");
        routeDiagnostics.failure_diagnostics.push("RAG_TIMEOUT");
        rawResults.rag = { results: [], confidence: 0, metadata: {}, fallback_used: false };
        return null;
      }

      rawResults.rag = {
        results: ragRes.sources || [],
        confidence: ragRes.raw_confidence || 0,
        metadata: ragRes.metadata || {},
        fallback_used: ragRes.fallback_used || false,
        answer: ragRes.answer || null,
        pass_used: ragRes.pass_used || null,
        query_category: ragRes.query_category || ragRes.category || null
      };

      logger.info("RAG fallback retrieval success", {
        requestId,
        fallbackReason,
        confidence: rawResults.rag.confidence,
        source_count: rawResults.rag.results.length
      });

      return ragRes;
    };

    // ---------- 4. PARALLEL EXECUTION PIPELINES ----------
    const deterministicTimeoutMs = goldenMatch?.timeoutMs || 5000;
    const kgTimeoutMs = goldenMatch ? Math.min(deterministicTimeoutMs, 2800) : timeoutFromEnv(["KG_ROUTE_TIMEOUT_MS"], 5000);
    const ragTimeoutMs = goldenMatch ? Math.min(deterministicTimeoutMs, 2800) : timeoutFromEnv(["RAG_ROUTE_TIMEOUT_MS", "ROUTE_TIMEOUT_MS"], 20000);
    const hybridRouteTimeoutMs = goldenMatch ? Math.min(deterministicTimeoutMs, 2800) : timeoutFromEnv(["HYBRID_ROUTE_TIMEOUT_MS", "ROUTE_TIMEOUT_MS"], 20000);
    const decisionTimeoutMs = goldenMatch ? Math.min(Math.max(deterministicTimeoutMs, 2400), 3500) : 8000;

    logger.info("Effective route timeout budgets", {
      requestId,
      route,
      kg_timeout_ms: kgTimeoutMs,
      rag_timeout_ms: ragTimeoutMs,
      hybrid_route_timeout_ms: hybridRouteTimeoutMs,
      decision_timeout_ms: decisionTimeoutMs,
      golden_path: !!goldenMatch
    });

    // TASK 8 — PROMPT TOKEN BUDGET LOGGING
    const estimatedTokens = Math.ceil(query.length / 4);
    if (estimatedTokens > 800) {
      console.warn(`[TOKEN_BUDGET][${requestId}] Oversized query: ~${estimatedTokens} tokens (${query.length} chars)`);
      logger.warn("Oversized prompt detected", { requestId, estimatedTokens, queryLength: query.length });
      incrementMetric("oversized_prompt_warnings");
    } else {
      console.log(`[TOKEN_BUDGET][${requestId}] Estimated prompt tokens: ~${estimatedTokens}`);
    }

    if (multiIntentPlan?.isMultiIntent && !goldenMatch) {
      const multiParts = [];
      const usedFacts = [];
      const citations = [];
      const missingInformation = [];
      const kgGraphFacts = [];
      const ragSources = [];
      const kgContexts = [];

      for (const intentPart of multiIntentPlan.intents) {
        const scopedQuery = buildIntentScopedQuery(query, intentPart, multiIntentPlan);

        if (intentPart.retrieval === "KG") {
          let intentKgRaw = null;
          intentKgRaw = await runNeo4jRetrieval({
            retrievalQuery: scopedQuery,
            retrievalIntent: intentPart.kgIntent || "GENERAL",
            limit: 5,
            routeForOptions: route
          });

          const kgEvidence = buildKgResponse(intentKgRaw);
          if (kgEvidence.length > 0) {
            const partAnswer = intentKgRaw?.answer || kgEvidence[0]?.evidence;
            multiParts.push({
              label: intentPart.label,
              answer: partAnswer,
              confidence: intentKgRaw?.confidence || kgEvidence[0]?.confidence || 0.55
            });
            usedFacts.push(...kgEvidence.map(fact => fact.evidence).filter(Boolean));
            kgContexts.push(...kgEvidence);
            kgGraphFacts.push(...(Array.isArray(intentKgRaw) ? intentKgRaw : []));
          } else {
            missingInformation.push(`No verified ${intentPart.label} knowledge graph evidence was found.`);
          }

          continue;
        }

        if (intentPart.retrieval === "RAG") {
          await ragSemaphore.acquire();
          const intentRagRaw = await timeoutWrapper(
            ragService.search(scopedQuery, { topK: 3 }),
            ragTimeoutMs,
            null
          ).finally(() => ragSemaphore.release());

          if (hasStrongRagEvidence(intentRagRaw)) {
            const ragPayload = buildDeterministicRagPayload(intentRagRaw, ROUTES.RAG_DIRECT);
            multiParts.push({
              label: intentPart.label,
              answer: ragPayload.final_answer,
              confidence: ragPayload.confidence || 0.55
            });
            usedFacts.push(...(ragPayload.used_facts || []));
            citations.push(...(ragPayload.citations || []));
            ragSources.push(...(intentRagRaw.sources || []));
          } else {
            missingInformation.push(`No verified ${intentPart.label} policy evidence was found.`);
          }
        }
      }

      if (multiParts.length > 0) {
        rawResults.kg = kgContexts;
        rawResults.rag = {
          results: ragSources,
          confidence: Math.max(...multiParts.map(part => part.confidence || 0), 0),
          metadata: { deterministic_multi_intent: true },
          fallback_used: false
        };
        kgRawData = kgGraphFacts.length > 0 ? kgGraphFacts : null;

        const labelPhrase = multiParts
          .map(part => part.label)
          .join(" and ");
        const intro = multiIntentPlan.subject
          ? `For ${multiIntentPlan.subject}, I found verified information for ${labelPhrase}.`
          : `I found verified information for ${labelPhrase}.`;
        const finalAnswer = `${intro}\n${multiParts
          .map(part => `${part.label.charAt(0).toUpperCase()}${part.label.slice(1)}: ${part.answer}`)
          .join("\n")}`;
        const confidenceValues = multiParts.map(part => part.confidence || 0.5);
        const multiConfidence = Math.max(
          0.45,
          Math.min(0.92, confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
        );

        const multiPayload = {
          final_answer: finalAnswer,
          answer: finalAnswer,
          confidence: multiConfidence,
          route_used: ROUTES.HYBRID_KG_RAG,
          contributing_sources: [...new Set(multiParts.map(part => part.label === "prerequisites" || part.label === "office" ? "KG_DIRECT" : "RAG_DIRECT"))],
          used_facts: [...new Set(usedFacts)],
          missing_information: missingInformation,
          graph: kgRawData ? convertToGraphData(kgRawData) : { nodes: [], links: [] },
          citations,
          explainability: {
            deterministic: true,
            multi_intent: true,
            intents: multiIntentPlan.intents.map(intent => intent.key),
            unified_answer_bypassed: true,
            llm_bypassed: true
          },
          reasoning: "Deterministic multi-intent decomposition retrieved each academic intent separately and merged grounded evidence without LLM synthesis.",
          metadata: {
            multi_intent: {
              subject: multiIntentPlan.subject,
              deterministic_route: "DETERMINISTIC_MULTI_INTENT",
              intents: multiIntentPlan.intents.map(intent => ({
                key: intent.key,
                retrieval: intent.retrieval
              }))
            }
          }
        };

        routeDiagnostics.final_route = "DETERMINISTIC_MULTI_INTENT";
        routeDiagnostics.route_chosen = "DETERMINISTIC_MULTI_INTENT";
        routeDiagnostics.conversation_priority = {
          ...(routeDiagnostics.conversation_priority || {}),
          multi_intent: {
            intents: multiIntentPlan.intents.map(intent => intent.key),
            subject: multiIntentPlan.subject,
            deterministic_merge: true
          }
        };

        await recordAssistantTurn(multiPayload.final_answer, {
          route: multiPayload.route_used,
          intent: "MULTI_INTENT",
          entities,
          neo4jContext: kgContexts,
          ragContext: ragSources,
          usedFacts: multiPayload.used_facts
        });

        incrementMetric("conversation_multi_intent_deterministic");
        writeRoutingAudit({
          requestId,
          cid: conversationId,
          query,
          originalQuery,
          initial_route: initialRoute,
          final_route: multiPayload.route_used,
          confidence: multiPayload.confidence,
          response_tier: "DETERMINISTIC_MULTI_INTENT",
          latency_ms: Date.now() - requestStartTime,
          degraded_services,
          fallback_triggers: routeDiagnostics.fallback_triggers,
          failure_diagnostics: routeDiagnostics.failure_diagnostics,
          multi_intent: multiIntentPlan.intents.map(intent => intent.key)
        });

        return res.json(responseFormatter.format(
          multiPayload,
          conversationId,
          requestId,
          {
            degraded_services,
            subsystem_health: healthStatus,
            latency_ms: Date.now() - requestStartTime,
            routing_confidence: multiPayload.confidence,
            response_tier: "DETERMINISTIC_MULTI_INTENT",
            query_normalization: normalizationTrace,
            route_diagnostics: routeDiagnostics
          }
        ));
      }
    }

    // TASK 7 — Acquire Neo4j semaphore slot before any KG retrieval
    try {
      if (route === ROUTES.KG_ONLY || route === ROUTES.KG_DIRECT) {
        const kgResolvedIntent = resolveKgRetrievalIntent();
        const kgRetrievalQuery = resolveCurriculumCarryoverQuery(query, kgResolvedIntent).retrievalQuery;
        kgRawData = await runNeo4jRetrieval({
          retrievalQuery: kgRetrievalQuery,
          retrievalIntent: kgResolvedIntent,
          limit: 5,
          routeForOptions: route
        });
        
        if (!kgRawData) {
          incrementMetric("kg_timeout_failures");
          degraded_services.push("KG_TIMEOUT");
          routeDiagnostics.failure_diagnostics.push("KG_TIMEOUT");
        }
        rawResults.kg = buildKgResponse(kgRawData);

        const curriculumMetadata = kgRawData?.metadata || rawResults.kg?.metadata || {};
        const isCurriculumKgRequest =
          intentKeyword === "CURRICULUM" ||
          curriculumMetadata.detected_intent === "CURRICULUM" ||
          curriculumMetadata.source_type === "CURRICULUM_KG";

        if (isCurriculumKgRequest && (!rawResults.kg || rawResults.kg.length === 0)) {
          const curriculumAnswer = kgRawData?.answer || rawResults.kg?.answer || CURRICULUM_NO_INFO_MESSAGE;
          const curriculumPayload = {
            final_answer: curriculumAnswer,
            answer: curriculumAnswer,
            confidence: 0,
            route_used: ROUTES.KG_DIRECT,
            sources: ["KG_DIRECT"],
            used_facts: [],
            missing_information: [CURRICULUM_NO_INFO_MESSAGE],
            graph: { nodes: [], links: [] },
            source: "KG_DIRECT",
            explainability: {
              deterministic: true,
              direct_kg: true,
              source_type: "CURRICULUM_KG",
              matched_course: curriculumMetadata.matched_course || null,
              matched_week: curriculumMetadata.matched_week ?? null,
              matched_topic: curriculumMetadata.matched_topic || null,
              unified_answer_bypassed: true,
              llm_bypassed: true,
              rag_bypassed: true
            },
            metadata: {
              ...curriculumMetadata,
              source_type: "CURRICULUM_KG"
            },
            reasoning: "Deterministic curriculum KG retrieval had insufficient verified syllabus evidence, so the exact safe fallback was returned."
          };

          routeDiagnostics.final_route = ROUTES.KG_DIRECT;
          routeDiagnostics.route_chosen = ROUTES.KG_DIRECT;
          routeDiagnostics.failure_diagnostics.push(curriculumMetadata.failure_reason || "CURRICULUM_INSUFFICIENT_INFORMATION");

          await updateLastCurriculumCourse(kgRawData, rawResults.kg);

          await recordAssistantTurn(curriculumPayload.final_answer, {
            route: curriculumPayload.route_used,
            intent: "CURRICULUM",
            entities,
            neo4jContext: [],
            usedFacts: []
          });

          return res.json(
            responseFormatter.format(
              curriculumPayload,
              conversationId,
              requestId,
              {
                degraded_services,
                subsystem_health: healthStatus,
                latency_ms: Date.now() - requestStartTime,
                routing_confidence: 0,
                response_tier: "DETERMINISTIC_CURRICULUM_EMPTY",
                query_normalization: normalizationTrace,
                route_diagnostics: routeDiagnostics
              }
            )
          );
        }

        if (hasProtectedOntologyKgFacts(kgRawData, rawResults.kg)) {
          lockKgDirectRouteForSelectedOntologyFacts("ONTOLOGY_KG_FACTS_ROUTE_LOCK");
        }

        if (shouldClarifyWeakKgResponse(kgRawData, rawResults.kg)) {
          const clarificationTarget = extractClarificationTarget();
          const clarificationAnswer = `I found partial information about ${clarificationTarget}. Could you clarify which department, course, or role you mean?`;
          routeDiagnostics.final_route = "KG_CLARIFICATION";
          routeDiagnostics.route_chosen = "KG_CLARIFICATION";
          routeDiagnostics.failure_diagnostics.push("KG_WEAK_AMBIGUOUS_EVIDENCE");

          await recordAssistantTurn(clarificationAnswer, {
            route: "KG_CLARIFICATION",
            intent: intentKeyword,
            entities,
            neo4jContext: rawResults.kg || [],
            usedFacts: rawResults.kg.map(fact => fact.evidence).filter(Boolean)
          });

          incrementMetric("kg_weak_evidence_clarification");

          return res.json(responseFormatter.format({
            answer: clarificationAnswer,
            final_answer: clarificationAnswer,
            confidence: 0.38,
            route: "KG_CLARIFICATION",
            sources: ["KG_DIRECT"],
            used_facts: rawResults.kg.map(fact => fact.evidence).filter(Boolean),
            missing_information: ["Knowledge graph evidence was partial or ambiguous."],
            graph: convertToGraphData(kgRawData),
            explainability: {
              deterministic: true,
              confidence_layer: true,
              clarification_required: true,
              llm_bypassed: true
            },
            reasoning: "Knowledge graph retrieval returned partial low-confidence evidence, so the system asked for clarification instead of over-answering."
          }, conversationId, requestId, {
            degraded_services,
            subsystem_health: healthStatus,
            latency_ms: Date.now() - requestStartTime,
            routing_confidence: 0.38,
            response_tier: "CLARIFICATION_REQUIRED",
            query_normalization: normalizationTrace,
            route_diagnostics: routeDiagnostics
          }));
        }

        // PHASE 8: DETERMINISTIC KG EMPTY-RESULT GUARD
        await ensureKgRetrievalFinished("KG_EMPTY_RESULT_GUARD");
        if ((route === ROUTES.KG_ONLY || route === ROUTES.KG_DIRECT) && (!rawResults.kg || rawResults.kg.length === 0)) {
          const ragFallbackAllowed =
            (routingDecision.fallback_chain || []).some(candidate => candidate === ROUTES.RAG_ONLY || candidate === ROUTES.RAG_DIRECT) &&
            healthStatus.rag !== false;

          if (ragFallbackAllowed) {
            const ragFallback = await retrieveRagEvidence("KG_EMPTY_RAG_ESCALATION");
            if (rawResults.rag?.results?.length > 0 || hasStrongRagEvidence(ragFallback)) {
              degraded_services.push("KG_EMPTY");
              routeDiagnostics.failure_diagnostics.push("KG_EMPTY");
              route = ROUTES.RAG_ONLY;
              routingDecision.route = route;
              routeDiagnostics.final_route = route;
              routeDiagnostics.route_chosen = route;
              console.log(`[ORCHESTRATOR][${requestId}] KG empty; escalated to RAG_ONLY with evidence.`);
            }
          }
        }

        await ensureKgRetrievalFinished("KG_EMPTY_EXIT_GUARD");
        if ((route === ROUTES.KG_ONLY || route === ROUTES.KG_DIRECT) && (!rawResults.kg || rawResults.kg.length === 0)) {
          if (goldenMatch) {
            const goldenFallback = buildGoldenFallbackPayload(goldenMatch, {
              routeOverride: route,
              reason: routeDiagnostics.failure_diagnostics.includes("KG_TIMEOUT") ? "KG_TIMEOUT" : "KG_EMPTY"
            });

            if (goldenFallback) {
              degraded_services.push("GOLDEN_STATIC_FALLBACK");
              routeDiagnostics.fallback_triggers.push("GOLDEN_KG_STATIC_FALLBACK");
              setGoldenCachedPayload(goldenMatch, goldenFallback);
              return await returnGoldenPayload(goldenFallback, "GOLDEN_DEGRADED_SUCCESS");
            }
          }

          console.log(`[ORCHESTRATOR][${requestId}] KG_ONLY empty-result exit triggered.`);
          const resolvedTarget = followUpResolution?.resolved
            ? [followUpResolution.target].flat().filter(Boolean).join(", ")
            : "";
          const emptyKgAnswer = resolvedTarget
            ? `I resolved that as ${resolvedTarget}, but I couldn't find verified knowledge graph evidence for the requested detail.`
            : "I couldn't find verified knowledge graph evidence for this query.";
          return res.json(
            responseFormatter.format({
              answer: emptyKgAnswer,
              confidence: 0.25,
              used_facts: [],
              missing_information: [resolvedTarget ? "Resolved follow-up target, but no verified institutional graph evidence found for the requested detail." : "No verified institutional graph evidence found."],
              graph: { nodes: [], links: [] },
              route: "KG_ONLY",
              sources: [],
              reasoning: "Knowledge graph search completed but returned no verified matches."
            }, conversationId, requestId, {
              degraded_services,
              subsystem_health: healthStatus,
              latency_ms: Date.now() - requestStartTime,
              routing_confidence: routingDecision.confidence || 0,
              response_tier: "DEGRADED_SUCCESS",
              query_normalization: normalizationTrace,
              route_diagnostics: routeDiagnostics
            })
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
            const selectedEvidenceAnswer = rawResults.kg
              .map(fact => fact.evidence)
              .filter(Boolean)
              .join("\n");
            const answer = rawResults.kg.answer || selectedEvidenceAnswer || bestKG.evidence;
            const latencyMs = Date.now() - requestStartTime;
            const kgResponseMetadata = rawResults.kg.metadata || {};
            const curriculumExplainability = kgResponseMetadata.source_type === "CURRICULUM_KG" ? {
                source_type: "CURRICULUM_KG",
                matched_course: kgResponseMetadata.matched_course || bestKG.metadata?.matched_course || null,
                matched_week: kgResponseMetadata.matched_week ?? bestKG.metadata?.matched_week ?? null,
                matched_topic: kgResponseMetadata.matched_topic || bestKG.metadata?.matched_topic || null,
                llm_bypassed: true,
                rag_bypassed: true
            } : {};

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
                    direct_kg: true,
                    ...curriculumExplainability
                },
                metadata: kgResponseMetadata.source_type ? kgResponseMetadata : undefined
            };

            await updateLastCurriculumCourse(kgRawData, rawResults.kg);

            if (goldenMatch) {
              deterministicPayload.explainability = {
                ...(deterministicPayload.explainability || {}),
                golden_path: true,
                golden_id: goldenMatch.id,
                unified_answer_bypassed: true,
                llm_bypassed: true
              };
              deterministicPayload.metadata = {
                ...(deterministicPayload.metadata || {}),
                golden_path: {
                  id: goldenMatch.id,
                  category: goldenMatch.category,
                  execution: goldenMatch.execution,
                  priority: goldenMatch.priority
                }
              };
              setGoldenCachedPayload(goldenMatch, deterministicPayload);
              return await returnGoldenPayload(deterministicPayload, "DETERMINISTIC_SUCCESS");
            }

            await recordAssistantTurn(deterministicPayload.final_answer, {
              route: deterministicPayload.route_used || route,
              intent: intentKeyword,
              entities,
              neo4jContext: rawResults.kg || [],
              usedFacts: deterministicPayload.used_facts || []
            });

            return res.json(
                responseFormatter.format(
                    deterministicPayload,
                    conversationId,
                    requestId,
                    {
                        degraded_services,
                        subsystem_health: healthStatus,
                        latency_ms: Date.now() - requestStartTime,
                        routing_confidence: 0.98,
                        query_normalization: normalizationTrace,
                        route_diagnostics: routeDiagnostics
                    }
                )
            );
        }
      }
      else if (route === ROUTES.RAG_ONLY || route === ROUTES.RAG_DIRECT) {
        await ragSemaphore.acquire();
        const ragRes = await timeoutWrapper(ragService.search(query, { topK: 5 }), ragTimeoutMs, null).finally(() => ragSemaphore.release());
        
        if (!ragRes) {
          degraded_services.push("RAG_TIMEOUT");
          routeDiagnostics.failure_diagnostics.push("RAG_TIMEOUT");
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
            routeDiagnostics.failure_diagnostics.push("RAG_EMPTY");
            if (goldenMatch) {
              const goldenFallback = buildGoldenFallbackPayload(goldenMatch, {
                routeOverride: route,
                reason: "RAG_EMPTY"
              });

              if (goldenFallback) {
                degraded_services.push("GOLDEN_STATIC_FALLBACK");
                routeDiagnostics.fallback_triggers.push("GOLDEN_RAG_STATIC_FALLBACK");
                setGoldenCachedPayload(goldenMatch, goldenFallback);
                return await returnGoldenPayload(goldenFallback, "GOLDEN_DEGRADED_SUCCESS");
              }
            }

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
              }, conversationId, requestId, {
                degraded_services,
                subsystem_health: healthStatus,
                latency_ms: Date.now() - requestStartTime,
                routing_confidence: routingDecision.confidence || 0,
                response_tier: "DEGRADED_SUCCESS",
                query_normalization: normalizationTrace,
                route_diagnostics: routeDiagnostics
              })
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

            await recordAssistantTurn(deterministicPayload.final_answer, {
              route: deterministicPayload.route_used || route,
              intent: intentKeyword,
              entities,
              ragContext: Array.isArray(rawResults.rag?.results) ? rawResults.rag.results : [],
              usedFacts: deterministicPayload.used_facts || []
            });

            if (goldenMatch) {
              deterministicPayload.explainability = {
                ...(deterministicPayload.explainability || {}),
                golden_path: true,
                golden_id: goldenMatch.id
              };
              setGoldenCachedPayload(goldenMatch, deterministicPayload);
              writeRoutingAudit({
                requestId,
                cid: conversationId,
                query,
                originalQuery,
                golden_id: goldenMatch.id,
                category: goldenMatch.category,
                initial_route: initialRoute,
                final_route: deterministicPayload.route_used,
                confidence: deterministicPayload.confidence,
                response_tier: "DETERMINISTIC_SUCCESS",
                latency_ms: Date.now() - requestStartTime,
                cache_hit: false,
                degraded_services,
                fallback_triggers: routeDiagnostics.fallback_triggers,
                failure_diagnostics: routeDiagnostics.failure_diagnostics
              });
            }

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
                  response_tier: "DETERMINISTIC_SUCCESS",
                  query_normalization: normalizationTrace,
                  route_diagnostics: routeDiagnostics
                }
              )
            );
          }
        }
      }
      else if (route === ROUTES.HYBRID_KG_RAG) {
        const [kgOutcome, ragOutcome] = await Promise.allSettled([
          runNeo4jRetrieval({
            retrievalQuery: query,
            retrievalIntent: resolveKgRetrievalIntent(),
            limit: 5,
            routeForOptions: route
          }),
          ragSemaphore.acquire().then(() => timeoutWrapper(ragService.search(query, { topK: 5 }), hybridRouteTimeoutMs, null).finally(() => ragSemaphore.release()))
        ]);

        if (kgOutcome.status === 'fulfilled' && kgOutcome.value) {
          kgRawData = kgOutcome.value;
          rawResults.kg = buildKgResponse(kgRawData);
          if (hasProtectedOntologyKgFacts(kgRawData, rawResults.kg)) {
            lockKgDirectRouteForSelectedOntologyFacts("HYBRID_ONTOLOGY_KG_FACTS_ROUTE_LOCK");
          }
        } else {
          console.error(`[HYBRID][${requestId}] KG failed:`, kgOutcome.reason);
          incrementMetric("subsystem_kg_failure");
          incrementMetric("kg_timeout_failures");
          degraded_services.push("KG_TIMEOUT");
          routeDiagnostics.failure_diagnostics.push("KG_TIMEOUT");
        }

        if (ragOutcome.status === 'fulfilled' && ragOutcome.value) {
          const ragData = ragOutcome.value;
          // SECTION B — RESPONSE NORMALIZATION ADAPTER
          rawResults.rag = {
            results: ragData.sources || [],
            confidence: ragData.raw_confidence || 0,
            metadata: ragData.metadata || {},
            fallback_used: ragData.fallback_used || false,
            answer: ragData.answer || null,
            pass_used: ragData.pass_used || null,
            query_category: ragData.query_category || ragData.category || null
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
          routeDiagnostics.failure_diagnostics.push("RAG_TIMEOUT");
          rawResults.rag = { results: [], confidence: 0, metadata: {}, fallback_used: false };
        }

        await ensureKgRetrievalFinished("HYBRID_TOTAL_FAILURE_GUARD");
        if ((!rawResults.kg || rawResults.kg.length === 0) && (!rawResults.rag?.results || rawResults.rag.results.length === 0)) {
          if (goldenMatch) {
            const goldenFallback = buildGoldenFallbackPayload(goldenMatch, {
              routeOverride: route,
              reason: "HYBRID_TOTAL_FAILURE"
            });

            if (goldenFallback) {
              degraded_services.push("GOLDEN_STATIC_FALLBACK");
              routeDiagnostics.failure_diagnostics.push("HYBRID_TOTAL_FAILURE");
              routeDiagnostics.fallback_triggers.push("GOLDEN_HYBRID_STATIC_FALLBACK");
              setGoldenCachedPayload(goldenMatch, goldenFallback);
              return await returnGoldenPayload(goldenFallback, "GOLDEN_DEGRADED_SUCCESS");
            }
          }

          console.warn(`[HYBRID][${requestId}] Total failure. Degrading to LLM.`);
          route = ROUTES.LLM_FALLBACK;
          routingDecision.route = route;
          routeDiagnostics.final_route = route;
          routeDiagnostics.route_chosen = route;
          degraded_services.push("HYBRID_TOTAL_FAILURE");
          routeDiagnostics.fallback_triggers.push("HYBRID_TOTAL_FAILURE_LLM_ESCALATION");
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
        const comparisonRequested =
          intentKeyword === "COMPARISON" ||
          goldenMatch?.category === "major_comparison" ||
          /\b(compare|comparison|vs|versus|difference between)\b/i.test(query);

        if (comparisonRequested) {
          const parsedEntities = [
            ...(Array.isArray(entities) ? entities : []),
            ...parseComparisonEntities(query)
          ].filter(Boolean);
          const uniqueEntities = [...new Set(parsedEntities)];
          const majorA = uniqueEntities[0];
          const majorB = uniqueEntities[1];

          if (!majorA || !majorB) {
            interactivePrompt = { msg: `Which two majors would you like to compare?`, missingFields: [] };
          } else {
            const comparison = compareMajors(
              majorA,
              majorB,
              memory?.studentProfile || { high_school_percentage: 80, budget: null },
              requestId
            );
            rawResults.decision = [{
              recommendation: `Comparison: ${majorA} vs ${majorB}\nSalary Outlook: ${comparison.salary_outlook}\nSkills Overlap: ${comparison.skills_overlap}`,
              factors: {
                ...comparison,
                profile_used: hasPercentage || hasBudget ? "student_memory" : "demo_default"
              },
              confidence: 0.86
            }];
          }
        } else if (!hasPercentage || !hasBudget) {
          let missingMsg = "To recommend the best major, please tell me your ";
          let missingFieldsArray = [];
          if (!hasPercentage && !hasBudget) { missingMsg += "high school percentage and budget."; missingFieldsArray = ["high_school_percentage", "budget"]; }
          else if (!hasPercentage) { missingMsg += "high school percentage."; missingFieldsArray = ["high_school_percentage"]; }
          else { missingMsg += "budget."; missingFieldsArray = ["budget"]; }
          interactivePrompt = { msg: missingMsg, missingFields: missingFieldsArray };
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
            decisionTimeoutMs, null
          );

          if (decisionResult && decisionResult.success) {
            rawResults.decision = [{
              recommendation: `Recommended Major: ${decisionResult.recommended_major}. Reason: ${decisionResult.reason}`,
              confidence: decisionResult.confidence / 100 || 0.85,
              factors: decisionResult
            }];
          } else if (decisionResult && decisionResult.is_missing_data) {
            interactivePrompt = { msg: `I'd love to help, but I need your ${decisionResult.missing_fields.join(" and ")}!`, missingFields: decisionResult.missing_fields };
          } else {
            degraded_services.push("DECISION_ENGINE_DEGRADED");
            routeDiagnostics.failure_diagnostics.push("DECISION_ENGINE_EMPTY");
            rawResults.decision = [{
              recommendation: "Based on your profile, AI, Computer Science, and Software Engineering are strong demo-safe options. For a final ranking, provide interests and budget so the decision engine can score affordability, training intensity, and fit.",
              confidence: 0.62,
              factors: {
                fallback: true,
                reason: "Decision API did not return a complete result within the route timeout."
              }
            }];
          }
        }
      }
      else if (route === ROUTES.CAREER_ENGINE) {
        const memory = getUserMemory(conversationId);
        const inferredAiCareer = /\b(ai|artificial intelligence|machine learning|data|robotics|nlp|natural language processing)\b/i.test(query);
        if ((!memory || Object.keys(memory).length === 0) && !goldenMatch && !inferredAiCareer) {
          interactivePrompt = { msg: "We need to find the right major for you first! Should we start with a recommendation?", missingFields: [] };
        } else {
          const careerMemory = (!memory || Object.keys(memory).length === 0)
            ? {
                studentProfile: {},
                preferences: {
                  interests: inferredAiCareer ? ["ai", "machine learning", "data"] : []
                }
              }
            : memory;
          const roadmap = await timeoutWrapper(Promise.resolve(buildCareerRoadmap(null, null, careerMemory)), goldenMatch ? 1600 : 5000, null);
          if (roadmap) {
            rawResults.career = [{
              career_path: `To become a ${roadmap.target_roles?.[0]}, focus on ${roadmap.top_skills?.join(', ')}. Demand: ${roadmap.industry_demand}`,
              market_data: roadmap,
              confidence: 0.8
            }];
          }
        }
      }

      if (hasProtectedOntologyKgFacts(kgRawData, rawResults.kg)) {
        lockKgDirectRouteForSelectedOntologyFacts("ONTOLOGY_KG_FACTS_DETERMINISTIC_RESPONSE");

        const bestKG = rawResults.kg[0];
        const answer = rawResults.kg.answer || bestKG?.evidence || "Verified knowledge graph evidence was found for this ontology query.";
        const deterministicPayload = {
          final_answer: answer,
          answer,
          confidence: Math.max(bestKG?.confidence || rawResults.kg.confidence || routingDecision.confidence || 0, 0.96),
          route_used: ROUTES.KG_DIRECT,
          sources: ["KG_DIRECT"],
          used_facts: rawResults.kg.map(fact => fact.evidence).filter(Boolean),
          missing_information: [],
          graph: convertToGraphData(kgRawData),
          source: "KG_DIRECT",
          explainability: {
            deterministic: true,
            direct_kg: true,
            ontology_route_lock: true,
            unified_answer_bypassed: true,
            llm_bypassed: true
          },
          reasoning: "Selected ontology KG facts were available, so RAG escalation was blocked and deterministic KG synthesis was used."
        };

        await updateLastCurriculumCourse(kgRawData, rawResults.kg);

        await recordAssistantTurn(deterministicPayload.final_answer, {
          route: deterministicPayload.route_used,
          intent: intentKeyword,
          entities,
          neo4jContext: rawResults.kg || [],
          usedFacts: deterministicPayload.used_facts || []
        });

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
              response_tier: "DETERMINISTIC_SUCCESS",
              query_normalization: normalizationTrace,
              route_diagnostics: routeDiagnostics
            }
          )
        );
      }

      await ensureKgRetrievalFinished("LLM_FALLBACK_GUARD");
      if (route === ROUTES.LLM_FALLBACK) {
        if (goldenMatch) {
          const goldenFallback = buildGoldenFallbackPayload(goldenMatch, {
            routeOverride: goldenMatch.route,
            reason: "LLM_ROUTE_AVOIDED"
          });

          if (goldenFallback) {
            degraded_services.push("GOLDEN_STATIC_FALLBACK");
            routeDiagnostics.fallback_triggers.push("GOLDEN_LLM_STATIC_FALLBACK");
            setGoldenCachedPayload(goldenMatch, goldenFallback);
            return await returnGoldenPayload(goldenFallback, "GOLDEN_DEGRADED_SUCCESS");
          }
        }

        incrementMetric("route_llm_fallback_hits");
        incrementMetric("llm_fallback_rate");
        const history = getConversationContext(conversationId, 4).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n");

        const prompt = `You are the AAST Academic Super-Agent, a professional, grounded, and helpful university advisor.
Your primary role is to assist students with major selection, career advice, and academic policies.
If you are unsure of specific university regulations, state clearly that the student should consult an official advisor.
Do NOT hallucinate fake policies or rules.

Recent Conversation Context:
${history}

Student Query: "${sanitizePromptInput(query)}"
Respond briefly, professionally, and conversationally as the AAST Advisor.`;

        // TASK 7 — LLM semaphore for concurrency protection
        let llmText = null;
        if (runtimeMode.singleGemmaGenerationMode) {
          incrementMetric("llm_fallback_presynthesis_bypassed");
          console.log(`[LLM_FALLBACK][${requestId}] pre-synthesis Gemma call bypassed by single-generation mode`);
        } else {
          await llmSemaphore.acquire();
          const fallbackTimeoutMs = timeoutFromEnv(["FALLBACK_LLM_TIMEOUT_MS"], 20000);
          const fallbackDeadlineMs = timeoutFromEnv(["FALLBACK_LLM_DEADLINE_MS"], 20000);
          console.log(`[LLM_FALLBACK][${requestId}] Effective timeout budget timeout=${fallbackTimeoutMs}ms deadline=${fallbackDeadlineMs}ms`);
          llmText = await timeoutWrapper(
            generateStableResponse({
              prompt,
              model: process.env.OLLAMA_FALLBACK_MODEL || process.env.PRIMARY_MODEL || process.env.OLLAMA_MODEL || "gemma4:e2b",
              requestId: `fallback_${requestId}`,
              timeoutMs: fallbackTimeoutMs,
              deadlineMs: fallbackDeadlineMs,
              routeType: "LLM_FALLBACK",
              trafficType: "fallback",
              options: {
                temperature: 0.08,
                top_p: 0.72,
                repeat_penalty: 1.18,
                num_predict: 220
              }
            }),
            fallbackDeadlineMs, null
          ).finally(() => llmSemaphore.release());
        }
        rawResults.llm = [{ response: llmText?.trim() || "Some systems are limited right now, but based on available academic guidance, here is the best support I can provide.", confidence: 0.3 }];
      }

      await ensureKgRetrievalFinished("UNIFIED_SYNTHESIS_GUARD");
      const traceData = {
        degraded_services,
        subsystem_health: healthStatus,
        latency_ms: Date.now() - requestStartTime,
        routing_confidence: routingDecision.confidence || 0,
        response_tier: degraded_services.length > 0 ? "DEGRADED_SUCCESS" : "FULL_SUCCESS",
        query_normalization: normalizationTrace,
        route_diagnostics: {
          ...routeDiagnostics,
          final_route: route,
          route_chosen: route,
          kg_hit_quality: {
            result_count: rawResults.kg?.length || 0,
            confidence: rawResults.kg?.confidence || rawResults.kg?.[0]?.confidence || 0,
            metadata: rawResults.kg?.metadata || {}
          },
          rag_hit_quality: {
            result_count: rawResults.rag?.results?.length || 0,
            confidence: rawResults.rag?.confidence || 0,
            metadata: rawResults.rag?.metadata || {}
          }
        }
      };

      // ---------- 5. FUSION LAYER (Unified Primary + Fusion Fallback) ----------
      if (
        goldenMatch &&
        route === ROUTES.HYBRID_KG_RAG &&
        ((rawResults.kg && rawResults.kg.length > 0) || (rawResults.rag?.results && rawResults.rag.results.length > 0))
      ) {
        const kgFacts = (rawResults.kg || []).map(item => item.evidence).filter(Boolean).slice(0, 3);
        const ragFacts = (rawResults.rag?.results || []).map(source => extractRagSourceText(source)).filter(text => text.length > 20).slice(0, 3);
        const answerParts = [];

        if (kgFacts.length > 0) {
          answerParts.push(`From the Knowledge Graph: ${kgFacts.join(" ")}`);
        }
        if (ragFacts.length > 0) {
          answerParts.push(`From verified policy context: ${ragFacts.join(" ")}`);
        }

        const deterministicHybridPayload = {
          final_answer: answerParts.join("\n\n"),
          answer: answerParts.join("\n\n"),
          confidence: Math.max(routingDecision.confidence || 0, 0.88),
          route_used: ROUTES.HYBRID_KG_RAG,
          sources: ["KG", "RAG"].filter(source => source === "KG" ? kgFacts.length > 0 : ragFacts.length > 0),
          contributing_sources: ["HYBRID", "KG", "RAG"].filter((source, index, array) => array.indexOf(source) === index),
          used_facts: [...kgFacts, ...ragFacts],
          missing_information: [],
          graph: kgRawData ? convertToGraphData(kgRawData) : { nodes: [], links: [] },
          explainability: {
            deterministic: true,
            golden_path: true,
            golden_id: goldenMatch.id,
            deterministic_hybrid: true,
            unified_answer_bypassed: true,
            llm_bypassed: true
          },
          reasoning: "Golden hybrid query answered from retrieved KG/RAG evidence without LLM synthesis."
        };

        setGoldenCachedPayload(goldenMatch, deterministicHybridPayload);
        return await returnGoldenPayload(deterministicHybridPayload, "DETERMINISTIC_SUCCESS");
      }

      if (interactivePrompt) {
        await recordAssistantTurn(interactivePrompt.msg, {
          route,
          intent: intentKeyword,
          entities
        });
        incrementMetric("route_interactive_hits");
        return res.json(responseFormatter.formatInteractive(interactivePrompt.msg, conversationId, requestId, interactivePrompt.missingFields, traceData));
      }

      if (
        goldenMatch &&
        (route === ROUTES.DECISION_ENGINE || route === ROUTES.CAREER_ENGINE) &&
        ((rawResults.decision && rawResults.decision[0]) || (rawResults.career && rawResults.career[0]))
      ) {
        const primary = rawResults.decision?.[0] || rawResults.career?.[0];
        const finalAnswer =
          primary.recommendation ||
          primary.career_path ||
          "A deterministic advisory result is available from the rule engine.";
        const deterministicRulePayload = {
          final_answer: finalAnswer,
          answer: finalAnswer,
          confidence: Math.max(primary.confidence || routingDecision.confidence || 0, 0.84),
          route_used: route,
          sources: [route],
          contributing_sources: [route],
          used_facts: [finalAnswer],
          missing_information: [],
          graph: buildGoldenFallbackPayload(goldenMatch, { routeOverride: route, reason: "RULE_ENGINE_GRAPH_HINT" })?.graph || { nodes: [], links: [] },
          explainability: {
            deterministic: true,
            golden_path: true,
            golden_id: goldenMatch.id,
            rule_engine: true,
            unified_answer_bypassed: true,
            llm_bypassed: true
          },
          reasoning: "Golden advisory query answered directly by the deterministic rule engine.",
          metadata: {
            golden_path: {
              id: goldenMatch.id,
              category: goldenMatch.category,
              execution: goldenMatch.execution,
              priority: goldenMatch.priority
            },
            factors: primary.factors || primary.market_data || {}
          }
        };

        setGoldenCachedPayload(goldenMatch, deterministicRulePayload);
        return await returnGoldenPayload(deterministicRulePayload, "DETERMINISTIC_SUCCESS");
      }

      let fusionPayload;
      const unifiedSynthesisRouteTimeoutMs = timeoutFromEnv(["UNIFIED_SYNTHESIS_ROUTE_TIMEOUT_MS"], 65000);
      logger.info("Unified synthesis route timeout budget", {
        requestId,
        route,
        timeout_ms: unifiedSynthesisRouteTimeoutMs
      });

      try {
        console.log(`[UNIFIED_SYNTHESIS_ACTIVE][${requestId}] route=${route}`);
        fusionPayload = await timeoutWrapper(
          generateUnifiedAnswer({
            query,
            routeType: route,
            retrievalConfidence: routingDecision.confidence || 0,
            neo4jContext: rawResults.kg || [],
            ragContext: Array.isArray(rawResults.rag?.results) ? rawResults.rag.results : [],
            faqContext: faqHit || null,
            decisionContext: rawResults.decision || rawResults.career || null,
            history: getConversationContext(conversationId, 6),
            conversationMemory: getConversationMemory(conversationId)
          }),
          unifiedSynthesisRouteTimeoutMs,
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

          if (
            route === ROUTES.HYBRID_KG_RAG &&
            rawResults.kg?.length > 0 &&
            ragFacts.length > 0
          ) {
            const finalAnswer = String(fusionPayload.final_answer || fusionPayload.answer || "").trim();
            const answerLower = finalAnswer.toLowerCase();
            const ragAlreadyPresent = ragFacts.some(fact => {
              const excerpt = fact.slice(0, 80).toLowerCase();
              return excerpt.length > 30 && answerLower.includes(excerpt);
            });

            if (finalAnswer && !ragAlreadyPresent) {
              const ragSummary = `AAST academic regulations: ${ragFacts.slice(0, 2).join(" ")}`;
              fusionPayload.final_answer = `${finalAnswer}\n\n${ragSummary}`;
              fusionPayload.answer = fusionPayload.final_answer;
            }
          }
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

      await recordAssistantTurn(fusionPayload.final_answer, {
        route: fusionPayload.route_used || route,
        intent: intentKeyword,
        entities,
        neo4jContext: rawResults.kg || [],
        ragContext: Array.isArray(rawResults.rag?.results) ? rawResults.rag.results : [],
        decisionContext: rawResults.decision || rawResults.career || null,
        faqContext: faqHit || null,
        usedFacts: fusionPayload.used_facts || []
      });

      incrementMetric("response_formatter_success");

      // Structured API Envelope via Formatting Layer
      if (goldenMatch) {
        setGoldenCachedPayload(goldenMatch, fusionPayload);
        writeRoutingAudit({
          requestId,
          cid: conversationId,
          query,
          originalQuery,
          golden_id: goldenMatch.id,
          category: goldenMatch.category,
          initial_route: initialRoute,
          final_route: route,
          confidence: fusionPayload.confidence,
          response_tier: traceData.response_tier,
          latency_ms: Date.now() - requestStartTime,
          cache_hit: false,
          degraded_services,
          fallback_triggers: routeDiagnostics.fallback_triggers,
          failure_diagnostics: routeDiagnostics.failure_diagnostics
        });
      }

      return res.json(responseFormatter.format(fusionPayload, conversationId, requestId, traceData));

    } catch (err) {
      console.error(`[ORCHESTRATOR][${requestId}] Execution Error:`, err.message);
      incrementMetric("route_failure_fallback");

      const traceData = { 
          degraded_services: ["FATAL_ERROR"], 
          latency_ms: Date.now() - requestStartTime, 
          routing_confidence: 0,
          response_tier: "FATAL_FALLBACK",
          query_normalization: normalizationTrace,
          route_diagnostics: {
            ...routeDiagnostics,
            final_route: "FATAL_FALLBACK",
            failure_diagnostics: [...(routeDiagnostics.failure_diagnostics || []), err.message]
          }
      };

      // TASK 5 — STRONGER FATAL FALLBACK: fusionService attempt with static backstop
      let fallbackAnswer = "Some advanced systems are temporarily unavailable, but official academic advisors can confirm final university policy details.";
      let fallbackRoute = "FATAL_FALLBACK";
      if (goldenMatch) {
        const goldenFallback = buildGoldenFallbackPayload(goldenMatch, {
          routeOverride: goldenMatch.route,
          reason: "FATAL_GOLDEN_STATIC_FALLBACK"
        });

        if (goldenFallback) {
          incrementMetric("golden_path_fatal_static_fallback");
          writeRoutingAudit({
            requestId,
            cid: conversationId,
            query,
            originalQuery,
            golden_id: goldenMatch.id,
            category: goldenMatch.category,
            initial_route: routeDiagnostics.initial_route,
            final_route: goldenFallback.route_used,
            confidence: goldenFallback.confidence,
            response_tier: "GOLDEN_FATAL_FALLBACK",
            latency_ms: Date.now() - requestStartTime,
            cache_hit: false,
            degraded_services: traceData.degraded_services,
            fallback_triggers: ["FATAL_GOLDEN_STATIC_FALLBACK"],
            failure_diagnostics: traceData.route_diagnostics.failure_diagnostics
          });

          await recordAssistantTurn(goldenFallback.final_answer, {
            route: goldenFallback.route_used || goldenMatch.route,
            intent: goldenMatch.intent || intentKeyword,
            entities,
            usedFacts: goldenFallback.used_facts || []
          });
          return res.status(200).json(responseFormatter.format(goldenFallback, conversationId, requestId, traceData));
        }
      }
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

      if (conversationId !== "UNKNOWN") {
        await recordAssistantTurn(fallbackAnswer, {
          route: fallbackRoute,
          intent: intentKeyword,
          entities
        });
      }

      return res.status(200).json(responseFormatter.formatErrorFallback(fallbackAnswer, fallbackRoute, conversationId, requestId, traceData));
    }
  } catch (globalErr) {
    console.error(`[ORCHESTRATOR][${requestId}] Fatal Global Error:`, globalErr.message);
    return res.status(500).json(responseFormatter.formatErrorFallback("Fatal Internal Orchestrator Error", "ERROR", "UNKNOWN", requestId, {}));
  }
});

try {
  console.log("[Startup] Waiting for Ollama readiness orchestration...");
  const llmStartupStatus = await modelFailoverManager.waitForStartupCompletion();
  logger.info("LLM startup readiness orchestration completed", {
    startupReadinessPhase: llmStartupStatus.startup_readiness_phase,
    ollamaReady: llmStartupStatus.ollama_ready,
    breakerState: llmStartupStatus.breaker_state,
    truePrimaryModel: llmStartupStatus.true_primary_model,
    activeRuntimeModel: llmStartupStatus.active_runtime_model,
    ollamaWaitAttempts: llmStartupStatus.ollama_wait_attempts,
    ollamaWaitDurationMs: llmStartupStatus.ollama_wait_duration_ms
  });
  console.log(
    `[Startup] Ollama phase=${llmStartupStatus.startup_readiness_phase} ` +
    `ready=${llmStartupStatus.ollama_ready} breaker=${llmStartupStatus.breaker_state}`
  );
  gemmaWarmService.start();
} catch (startupErr) {
  logger.error("LLM startup readiness orchestration failed", {
    error: startupErr.message
  });
  console.error("[Startup] LLM readiness orchestration failed:", startupErr.message);
  gemmaWarmService.start();
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`🔗 Decision API: ${process.env.DECISION_API_URL || "http://127.0.0.1:8005"}`);
});
