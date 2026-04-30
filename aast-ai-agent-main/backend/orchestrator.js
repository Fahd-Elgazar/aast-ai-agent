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

const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 8000;

// Security check for Internal Secret
const INTERNAL_SECRET = process.env.INTERNAL_SECRET_KEY;
if (!INTERNAL_SECRET) {
  throw new Error("CRITICAL: INTERNAL_SECRET_KEY is missing from environment variables.");
}

/* ============================================================
   📁 LOGGING SYSTEM
============================================================ */

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

// Initialize Neo4j before routes
await connectNeo4j();
console.log("✅ Neo4j connected successfully");

// Routes
app.use("/api/chatbot/legacy", chatbotRouter);
app.use("/api/decision", decisionRouter);
/* ============================================================
   🧠 CONVERSATION MEMORY & CACHE (REDIS PRODUCTION VERSION)
============================================================ */



const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisClient.on("error", err => {
  logger.error("Redis Client Error", { error: err.message });
});

await redisClient.connect();

const decisionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

const MAX_TURNS = 12;
const SESSION_TTL_SECONDS = 60 * 60 * 3; // 3 hours

async function embedQuery(text) {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text
    })
  });

  const data = await res.json();
  return data.embedding;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

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

async function saveConversation(cid, convo) {
  convo.lastActive = Date.now();

  await redisClient.set(
    `conversation:${cid}`,
    JSON.stringify(convo),
    {
      EX: SESSION_TTL_SECONDS
    }
  );
}

async function getConversation(cid) {
  try {
    const existing = await redisClient.get(`conversation:${cid}`);

    if (existing) {
      const convo = JSON.parse(existing);
      convo.lastActive = Date.now();

      await saveConversation(cid, convo);

      return convo;
    }

    const fresh = buildFreshConversation();

    await saveConversation(cid, fresh);

    return fresh;
  } catch (err) {
    logger.error("Conversation retrieval failed", {
      cid,
      error: err.message
    });

    return buildFreshConversation();
  }
}

async function pushTurn(cid, convo, role, content) {
  convo.messages.push({
    role,
    content
  });

  if (convo.messages.length > MAX_TURNS) {
    const system = convo.messages[0];
    const tail = convo.messages.slice(-(MAX_TURNS - 1));
    convo.messages = [system, ...tail];
  }

  await saveConversation(cid, convo);
}

async function updateSystemPrompt(cid, convo, content) {
  const systemIdx = convo.messages.findIndex(
    m => m.role === "system"
  );

  if (systemIdx !== -1) {
    convo.messages[systemIdx].content = content;
  } else {
    convo.messages.unshift({
      role: "system",
      content
    });
  }

  await saveConversation(cid, convo);
}

/* ============================================================
   🧠 OLLAMA INTENT CLASSIFIER (HARDENED)
============================================================ */

const intentCache = new Map();
const neo4jCache = new Map();

function getRuntimeCacheStatus() {
  return {
    conversations: "redis_managed",
    maxConversations: null,
    intentCacheEntries: intentCache.size,
    neo4jCacheEntries: neo4jCache.size,
    decisionCacheEntries: decisionCache.size,
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

async function extractDynamicIntent(query, requestId, isRetry = false) {
  const qKey = query.toLowerCase().trim();
  const cached = intentCache.get(qKey);
  if (cached && Date.now() - cached.time < 300000) {
    incrementMetric("cache.hit");
    return cached.data;
  }
  incrementMetric("cache.miss");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20s

  try {
    const safeQuery = query.replace(/["{}]/g, "");
    console.time(`[LLM][${requestId}]`);
    let res;
    try {
      res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma4:e4b",
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
    if (intentCache.size > 50) intentCache.delete(intentCache.keys().next().value);
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

async function fetchEntitiesFromNeo4j(entities, requestId = "none") {
  if (!entities || entities.length === 0) return [];
  const session = getSession();
  console.log(`[NEO4J][${requestId}] Query starting...`);
  console.time(`[NEO4J][${requestId}]`);
  try {
    const results = [];
    for (const entity of entities) {
      const res = await session.run(
        `MATCH (n) WHERE toLower(n.name) CONTAINS toLower($entity) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 5`,
        { entity }
      );
      console.log(`[NEO4J][${requestId}] Query executed`);
      res.records.forEach(record => {
        const n = record.get("n");
        const r = record.get("r");
        const m = record.get("m");
        if (n && r && m) {
          results.push({ text: `(${n.labels[0]}: "${n.properties.name}") --[${r.type}]--> (${m.labels[0]}: "${m.properties.name}")` });
        }
      });
    }
    console.timeEnd(`[NEO4J][${requestId}]`);
    console.log(`[NEO4J][${requestId}] results: ${results.length}`);
    console.log(`[NEO4J][${requestId}] fallback: ${results.length === 0}`);
    return results;
  } catch (err) {
    console.timeEnd(`[NEO4J][${requestId}]`);
    return [];
  } finally {
    await session.close();
  }
}

/* ============================================================
   🤖 MAIN CHAT ENDPOINT
============================================================ */

app.post("/api/chatbot/query", async (req, res) => {
  const requestId = Date.now();
  const requestStartTime = Date.now();
  incrementMetric("http.chatbot.query_total");
  const originalJson = res.json;
  res.json = function (body) {
    const duration = Date.now() - requestStartTime;
    const size = Buffer.byteLength(JSON.stringify(body));
    recordDuration("http.chatbot.latency_ms", duration);
    logger.info("Chatbot response completed", {
      requestId,
      source: body.source || "unknown",
      durationMs: duration,
      responseBytes: size
    });
    console.log(`[RESPONSE][${requestId}] source=${body.source || "unknown"} time=${duration}ms size=${size}b`);
    return originalJson.call(this, body);
  };

  try {
    console.log(`[Chatbot][${requestId}] Request Started`);

    const { query, cid } = req.body ?? {};
    if (!query) return res.status(400).json({ error: "query required", requestId });

    const conversationId = cid || makeId();
    console.log(`[REQUEST][${requestId}] ${query} CID: ${conversationId}`);

    const convo = await getConversation(conversationId);

    logToFile(`USER [${conversationId}]: ${query}`);
    await pushTurn(conversationId, convo, "user", query);

    // ---------- GREETING CHECK ----------
    let answer = checkGreeting(query);
    if (answer) {
      await pushTurn(conversationId, convo, "assistant", answer);
      // 3) Standardized response source: greeting
      return res.json({ answer, source: "greeting", cid: conversationId, requestId });
    }

    // ---------- FAQ CHECK ----------
    const faqHit = searchFAQ(query);
    if (faqHit) {
      await pushTurn(conversationId, convo, "assistant", faqHit.answer);
      return res.json({ answer: faqHit.answer, source: "faq", cid: conversationId, requestId });
    }

    // ---------- INTENT CLASSIFICATION ----------
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
      console.log(`[Routing][${requestId}] Program query detected, forcing PROGRAM intent.`);
      intentData = { intent: "PROGRAM", confidence: 1.0, entities: [] };
    } else if (isFactual) {
      console.log(`[Routing][${requestId}] Factual query detected, bypassing intent classifier.`);
      intentData = { intent: "GENERAL", confidence: 1.0, entities: [] };
    } else if ((pMatchQuery || bMatchQuery || kMatchQuery) && isProfileIncomplete) {
      console.log(`[Routing][${requestId}] Contextual override applied: RECOMMEND flow continuation`);
      intentData = { intent: "RECOMMEND", confidence: 1.0, entities: [] };
    } else {
      intentData = await extractDynamicIntent(query, requestId);
    }
    let intentKeyword = intentData.intent;
    const entities = intentData.entities || [];
    const confidence = intentData.confidence || 0;

    console.log(`[INTENT][${requestId}] intent: ${intentKeyword}, confidence: ${confidence}, entities: ${JSON.stringify(entities)}`);

    if (intentKeyword === "UNKNOWN_TIMEOUT") {
      return res.status(503).json({
        answer: "System is busy, please try again.",
        source: "error",
        cid: conversationId,
        requestId
      });
    }

    const MIN_CONFIDENCE = 0.6;
    const KNOWN_INTENTS = ["GENERAL", "RECOMMEND", "RECOMMENDATION", "DECISION", "CAREER_PATH_DETAIL", "COMPARISON", "REJECT", "PREREQUISITE", "DEAN", "ADMIN", "PERSON", "PROGRAM", "UNKNOWN_PARSE", "UNKNOWN_TIMEOUT"];

    if (intentKeyword === "UNKNOWN_PARSE" || intentKeyword === "UNKNOWN_TIMEOUT" || !KNOWN_INTENTS.includes(intentKeyword)) {
      console.log(`[Chatbot][${requestId}] Intercepted fallback (${intentKeyword}). Routing to GENERAL.`);
      intentKeyword = "GENERAL";
    } else if (confidence < MIN_CONFIDENCE) {
      console.warn(`[Routing][${requestId}] Low confidence intent`, {
        intent: intentKeyword,
        confidence,
        query
      });
      const queryLower = query.toLowerCase();
      const recommendHints = ["recommend", "suggest", "what should i study", "best major"];
      const comparisonHints = ["compare", "difference", "vs", "better than"];

      let semanticOverride = false;

      if (confidence > 0.3) {
        if (recommendHints.some(hint => queryLower.includes(hint))) {
          console.warn(`[Routing][${requestId}] Semantic override applied`, { originalIntent: intentKeyword, newIntent: "RECOMMEND", query });
          intentKeyword = "RECOMMEND";
          semanticOverride = true;
        } else if (comparisonHints.some(hint => queryLower.includes(hint))) {
          console.warn(`[Routing][${requestId}] Semantic override applied`, { originalIntent: intentKeyword, newIntent: "COMPARISON", query });
          intentKeyword = "COMPARISON";
          semanticOverride = true;
        }
      }

      if (!semanticOverride) {
        console.log(`[Chatbot][${requestId}] Low confidence without override. Routing to GENERAL.`);
        intentKeyword = "GENERAL";
      }
    }

    // ---------- TOOL ABSTRACTION ----------
    const toolContext = {
      query,
      entities,
      convo,
      requestId,
      conversationId,
      res,
      intentKeyword,
      intentData
    };

    const TOOLS = {
      CAREER_PATH_DETAIL: async (ctx) => {
        const { query, entities, convo, requestId, conversationId, res, intentKeyword } = ctx;
        console.log(`[CareerPath] Memory lookup for CID:`, conversationId);
        const memory = getUserMemory(conversationId);
        let answer = "";

        if (!memory || Object.keys(memory).length === 0) {
          answer = "We need to find the right major for you first! Should we start with a recommendation?";
        } else {
          const roadmap = buildCareerRoadmap(null, null, memory);
          const role = roadmap.target_roles?.[0] || 'Professional';
          const skills = roadmap.top_skills?.join(', ') || 'core skills';
          const demand = roadmap.industry_demand || 'solid market outlook';
          const timeline = roadmap.timeline || [];

          answer = `To become a ${role}, here is your plan:\n\n1. Focus on ${skills}.\n2. Look for ${demand}\n3. Follow the timeline:\n   - ${timeline.join('\n   - ')}`;
        }

        await pushTurn(conversationId, convo, "assistant", answer);
        return res.json({ answer, source: "career_path", cid: conversationId, requestId });
      },

      COMPARISON: async (ctx) => {
        const { query, entities, convo, requestId, conversationId, res, intentKeyword } = ctx;
        console.log(`[Comparison] Entities extracted:`, entities);
        const memory = getUserMemory(conversationId);

        if (entities.length < 2) {
          const detected = entities[0] || "that major";
          const answer = `I see you're interested in ${detected}. Which other major would you like to compare it with? (e.g., "Compare ${detected} with AI")`;
          await pushTurn(conversationId, convo, "assistant", answer);
          return res.json({ answer, source: "comparison", cid: conversationId, requestId });
        }

        const majorA = entities[0];
        const majorB = entities[1];
        const safeProfile = memory?.studentProfile || {};
        const comparison = compareMajors(majorA, majorB, safeProfile, requestId);

        let answer = `Here is a structured comparison between **${majorA}** and **${majorB}**:\n\n`;
        answer += `💰 **Salary Outlook:**\n${comparison.salary_outlook}\n\n`;
        answer += `⚡ **Difficulty Level (1-10):**\n- ${majorA}: ${comparison.difficulty_level[majorA]}/10\n- ${majorB}: ${comparison.difficulty_level[majorB]}/10\n*(Based on your background profile)*\n\n`;
        answer += `🧠 **Skills Overlap:**\n${comparison.skills_overlap}\n\n`;
        answer += `🚀 **Career Progression:**\n${comparison.career_progression}\n`;

        await pushTurn(conversationId, convo, "assistant", answer);
        return res.json({ answer, source: "comparison", cid: conversationId, requestId });
      },

      RECOMMEND: async (ctx) => {
        const { query, convo, conversationId, res, requestId } = ctx;

        console.log(`[Decision] Input Query:`, query);
        let memory = getUserMemory(conversationId);

        // --- 1. EXTRACT STRUCTURED DATA ---
        const pMatchSimple = query.match(/\b\d{2,3}\b/);
        let bMatchSimple = query.match(/-?\b\d{4,6}\b/);
        const budgetContextMatch = query.match(/budget[\s\w]*?(-?\d+)/i);
        if (!bMatchSimple && budgetContextMatch) bMatchSimple = [budgetContextMatch[1]];
        const kMatch = query.match(/(-?\d+)\s*[kK]\b/);

        let updated = false;
        const updates = { studentProfile: {} };

        if (pMatchSimple) {
          updates.studentProfile.high_school_percentage = parseInt(pMatchSimple[0], 10);
          updated = true;
        }

        let budgetVal = null;
        if (bMatchSimple) {
          budgetVal = parseInt(bMatchSimple[0], 10);
        } else if (kMatch) {
          budgetVal = parseInt(kMatch[1], 10) * 1000;
        }

        if (budgetVal !== null) {
          updates.studentProfile.budget = budgetVal;
          updated = true;
        }

        const keywordMap = {
          ai: ["ai", "artificial intelligence", "machine learning", "deep learning", "neural networks", "robotics"],
          data: ["data", "data science", "analytics", "big data", "statistics"],
          programming: ["coding", "programming", "software", "development", "computer science", "web development", "app development"],
          cybersecurity: ["cybersecurity", "security", "hacking", "infosec", "network security"],
          mechanical_engineering: ["mechanical", "mechanics", "machines", "manufacturing"],
          civil_engineering: ["civil", "construction", "infrastructure", "structural"],
          electrical_engineering: ["electrical", "electronics", "circuits", "power systems"],
          aerospace_engineering: ["aerospace", "aeronautics", "space", "astronautical"],
          business: ["business", "management", "entrepreneurship", "startup", "mba"],
          finance: ["finance", "accounting", "banking", "investment", "wealth"],
          economics: ["economics", "economy", "macroeconomics", "microeconomics"],
          medicine: ["medicine", "medical", "doctor", "healthcare", "nursing", "clinical", "surgery"],
          biology: ["biology", "genetics", "biotech", "anatomy", "life science"],
          chemistry: ["chemistry", "chemical", "biochemistry", "materials"],
          physics: ["physics", "astrophysics", "quantum", "thermodynamics"],
          law: ["law", "legal", "lawyer", "attorney", "justice", "jurisprudence"],
          design: ["design", "ui", "ux", "art", "graphic design", "creative", "illustration"],
          media: ["media", "journalism", "content creation", "broadcasting", "news", "video production"],
          aviation: ["aviation", "pilot", "flight", "aircraft", "aeronautics"],
          tourism: ["tourism", "hospitality", "hotel", "travel", "event management"],
          psychology: ["psychology", "mental health", "therapy", "counseling", "behavioral", "neuroscience"],
          education: ["education", "teaching", "teacher", "pedagogy", "learning"],
          communication: ["communication", "public relations", "pr", "corporate communications"],
          marketing: ["marketing", "advertising", "seo", "branding", "digital marketing"],
          architecture: ["architecture", "buildings", "urban planning", "interior design"],
          languages: ["languages", "translation", "linguistics", "foreign language", "literature"],
          political_science: ["politics", "political science", "international relations", "diplomacy", "government"],
          environmental_science: ["environment", "sustainability", "ecology", "climate", "conservation"]
        };

        const queryLower = query.toLowerCase();
        const extractedInterests = [];
        for (const [key, variants] of Object.entries(keywordMap)) {
          if (variants.some(variant => queryLower.includes(variant))) {
            extractedInterests.push(key);
          }
        }

        if (extractedInterests.length > 0) {
          if (!updates.preferences) updates.preferences = {};
          const existingInterests = memory?.preferences?.interests || [];
          updates.preferences.interests = [...new Set([...existingInterests, ...extractedInterests])];
          updated = true;
        }

        if (updated) {
          await updateUserMemory(conversationId, updates);
          memory = getUserMemory(conversationId);
        }

        const hasPercentage = memory?.studentProfile?.high_school_percentage != null;
        const hasBudget = memory?.studentProfile?.budget != null;

        // --- 3. IF MISSING DATA, ASK USER ---
        if (!hasPercentage || !hasBudget) {
          let missingMsg = "To recommend the best major, please tell me your ";
          if (!hasPercentage && !hasBudget) missingMsg += "high school percentage and budget.";
          else if (!hasPercentage) missingMsg += "high school percentage.";
          else missingMsg += "budget.";

          await pushTurn(conversationId, convo, "assistant", missingMsg);
          return res.json({ answer: missingMsg, source: "decision", cid: conversationId, requestId });
        }

        try {
          // --- 2. CALL DECISION ENGINE ---
          const decisionResult = await getRecommendation({
            studentProfile: memory?.studentProfile || {},
            preferences: memory?.preferences || {},
            text: query,
            memory: memory,
            cid: conversationId,
            requestId
          });

          if (!decisionResult || decisionResult.is_fallback) {
            throw new Error("Decision engine fallback");
          }

          if (decisionResult.is_missing_data) {
            const fields = decisionResult.missing_fields || [];
            const missingMsg = `I'd love to help, but I need your ${fields.join(" and ")}!`;
            await pushTurn(conversationId, convo, "assistant", missingMsg);
            return res.json({ answer: missingMsg, source: "decision", cid: conversationId, requestId });
          }

          // --- 4. FORMAT RESPONSE USING DECISION RESULT ---
          if (decisionResult && decisionResult.success) {
            const rec = decisionResult;
            const topRecommendations = Array.isArray(rec.top_recommendations) && rec.top_recommendations.length > 0
              ? rec.top_recommendations
              : [{ major: rec.recommended_major, score: rec.confidence }];

            let responseAnswer = `🎓 **Recommended Major: ${rec.recommended_major}**\n\n`;
            responseAnswer = `🎓 Top Recommendations:\n\n${topRecommendations
              .slice(0, 3)
              .map((item, index) => `${index + 1}. ${item.major} (${Math.round(Number(item.score) || 0)}%)`)
              .join("\n")}\n\n` + responseAnswer;
            responseAnswer = responseAnswer
              .replace(/^[^\n]*Top Recommendations:/, `\u{1F393} Top Recommendations:`)
              .replace(/^[^\n]*\*\*Recommended Major:/m, `\u{1F393} **Recommended Major:`);
            responseAnswer += `Because: ${rec.reason}\n\n`;

            if (memory?.studentProfile?.budget !== undefined && memory.studentProfile.budget < 2000) {
              responseAnswer += `⚠️ Your budget is very limited, options may be restricted.\n\n`;
            }

            if (rec.next_steps && rec.next_steps.length > 0) {
              responseAnswer += `Next steps:\n- ${rec.next_steps.join("\n- ")}`;
            }

            await pushTurn(conversationId, convo, "assistant", responseAnswer);
            return res.json({ answer: responseAnswer, source: "decision", decision: decisionResult, cid: conversationId, requestId });
          }

        } catch (err) {
          // --- 4. ADD SAFETY FALLBACK (LLM) ---
          console.warn(`[Decision] Falling back to LLM due to error:`, err.message);
          try {
            const llmRes = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "gemma4:e4b",
                prompt: `Recommend a major for a student who asked: "${query}". Answer briefly in 2 sentences.`,
                stream: false
              })
            });
            const llmData = await llmRes.json();
            const llmAnswer = llmData?.response?.trim() || "I couldn't generate a recommendation.";
            await pushTurn(conversationId, convo, "assistant", llmAnswer);
            return res.json({ answer: llmAnswer, source: "fallback_llm", cid: conversationId, requestId });
          } catch (llmErr) {
            return res.json({ answer: "⚠️ Recommendation system encountered an error. Please try again.", source: "error", cid: conversationId, requestId });
          }
        }
      },

      GENERAL: async (ctx) => {
        const { query, intentKeyword, convo, conversationId, res, requestId } = ctx;

        const graphContext = await fetchNeo4jContext(
          query,
          intentKeyword,
          5,
          requestId,
          convo.messages
        );

        if (graphContext && graphContext.length > 0) {
          console.log(`[RAG][${requestId}] Using Neo4j context`);

          const answer = graphContext.answer || graphContext
            .slice(0, 5)
            .map(f => f.text)
            .join("\n");

          await pushTurn(conversationId, convo, "assistant", answer);
          return res.json({
            answer,
            source: "rag",
            cid: conversationId,
            requestId
          });
        }

        console.log(`[RAG][${requestId}] No context found for query: ${query}`);
        logToFile(`[Failed Query][${requestId}] ${query}`);
        const fallbackMsg = "I couldn't find exact info, but I can help you explore majors or recommend one.";
        await pushTurn(conversationId, convo, "assistant", fallbackMsg);
        return res.json({
          answer: fallbackMsg,
          source: "fallback",
          cid: conversationId,
          requestId
        });
      }
    };

    TOOLS.RECOMMENDATION = TOOLS.RECOMMEND;
    TOOLS.DECISION = TOOLS.RECOMMEND;
    TOOLS.PREREQUISITE = TOOLS.GENERAL;
    TOOLS.DEAN = TOOLS.GENERAL;
    TOOLS.ADMIN = TOOLS.GENERAL;
    TOOLS.PERSON = TOOLS.GENERAL;
    TOOLS.PROGRAM = TOOLS.GENERAL;

    const safeEntities = Array.isArray(intentData?.entities)
      ? intentData.entities
      : [];

    // Resolve routing intent aliases safely
    const queryLowerCheck = query.toLowerCase();
    const isNegativeCheck = queryLowerCheck.includes("don't like") || queryLowerCheck.includes("something else") || queryLowerCheck.includes("not this one") || queryLowerCheck.includes("other options") || queryLowerCheck.includes("don't want") || (intentKeyword === "REJECT" && intentData.confidence > 0.7);

    let selectedTool = intentKeyword;

    if (isNegativeCheck) {
      selectedTool = "RECOMMEND";
    }

    if (!TOOLS[selectedTool]) {
      console.warn(`[Tool][${requestId}] Unknown tool: ${selectedTool}`);

      const msg = "I couldn't understand your request clearly. Could you rephrase it?";
      await pushTurn(conversationId, convo, "assistant", msg);

      return res.json({
        answer: msg,
        source: "error",
        cid: conversationId,
        requestId
      });
    }

    if (!selectedTool || typeof TOOLS[selectedTool] !== "function") {
      console.warn(`[Tool][${requestId}] Invalid tool execution attempt`, selectedTool);

      const msg = "I couldn't process your request properly. Please try again.";
      await pushTurn(conversationId, convo, "assistant", msg);

      return res.json({
        answer: msg,
        source: "error",
        cid: conversationId,
        requestId
      });
    }

    try {
      console.log(`[TOOL][${requestId}] ${selectedTool}`);
      return await TOOLS[selectedTool](toolContext);
    } catch (err) {
      console.error(`[ERROR][${requestId}] Tool Execution failed: ${err.message}`);

      const msg = "Something went wrong while processing your request.";
      await pushTurn(conversationId, convo, "assistant", msg);

      return res.json({
        answer: msg,
        source: "error",
        cid: conversationId,
        requestId
      });
    }

  } catch (error) {
    console.error(`[ERROR][${requestId}] Route Error: ${error.message}`);
    const conversationId = req.body?.cid || "fallback";
    return res.status(500).json({
      answer: "System is busy, please try again.",
      source: "error",
      cid: conversationId,
      requestId: Date.now()
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`🔗 Decision API: ${process.env.DECISION_API_URL || "http://127.0.0.1:8005"}`);
});
