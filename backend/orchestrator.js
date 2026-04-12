// orchestrator.js

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

import chatbotRouter from "./routes/chatbot.js";
import { searchFAQ } from "./faqService.js";
import { checkGreeting } from "./greetings.js";
import { ragSearch } from "./ragService.js";
import { fetchNeo4jContext } from "./services/neo4jcontext.js";
import { connectNeo4j } from "./db/neo4j.js";
import { getSession } from "./db/neo4j.js";

const app = express();
const PORT = 8000;

/* ============================================================
   📁 LOGGING SYSTEM (IMPROVED)
============================================================ */

const LOG_DIR = path.resolve(process.cwd(), "logs");

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const QUERY_LOG = path.join(LOG_DIR, "chat.log");

function logToFile(text) {

  const timestamp = new Date().toLocaleString();
  const entry = `[${timestamp}] ${text}\n`;

  try {
    fs.appendFileSync(QUERY_LOG, entry, "utf8");
  } catch (err) {
    console.error("❌ Log write failed:", err);
  }

}

function makeId() {
  return Math.random().toString(16).slice(2, 10);
}

app.use(cors());
app.use(bodyParser.json());
app.use("/api/chatbot/legacy", chatbotRouter);

/* ============================================================
   🧠 CONVERSATION MEMORY
============================================================ */

const conversations = new Map();
const MAX_TURNS = 12;
const SESSION_TTL = 3 * 60 * 60 * 1000;

function getConversation(cid) {

  const now = Date.now();
  const convo = conversations.get(cid);

  if (!convo || now - convo.lastActive > SESSION_TTL) {

    const fresh = {
      messages: [
        {
          role: "system",
          content: `
You are the AAST University Assistant.

You receive verified knowledge triples from a Knowledge Graph.

Rules:
- Only use the information provided in the graph context.
- Do not invent information.
- If the graph does not contain the answer say:
"I don't have that information in the knowledge graph."

Be concise and professional.
`
        }
      ],
      lastActive: now
    };

    conversations.set(cid, fresh);
    return fresh;
  }

  convo.lastActive = now;
  return convo;
}

function pushTurn(convo, role, content) {

  convo.messages.push({ role, content });

  if (convo.messages.length > MAX_TURNS) {

    const system = convo.messages[0];
    const tail = convo.messages.slice(-MAX_TURNS);

    convo.messages = [system, ...tail];
  }
}

/* ============================================================
   🧠 OLLAMA INTENT CLASSIFIER (WITH DEBUG LOGGING)
============================================================ */

async function extractDynamicIntent(query) {

  try {

    const res = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b-instruct-q4_K_M",
      prompt: `
      Extract structured information from the query.

      Return in this exact format:
      INTENT: <ONE WORD>
      ENTITIES: <comma separated list>

      Examples:
      Query: Who is the dean of AI college?
      INTENT: DEAN
      ENTITIES: AI college

      Query: What are prerequisites for machine learning?
      INTENT: PREREQUISITE
      ENTITIES: Machine Learning

      Query: ${query}

      Output:
      `,
        stream: false
      })
    });

    const data = await res.json();

    const rawToken = data?.response || "";
    // 🔵 ADDED: structured parsing
    let intent = "ALL";
    let entities = [];

    try {

      const intentMatch = rawToken.match(/INTENT:\s*(.*)/i);
      const entityMatch = rawToken.match(/ENTITIES:\s*(.*)/i);

      if (intentMatch) {
        intent = intentMatch[1].trim().toUpperCase().replace(/[^A-Z]/g, "");
      }

      if (entityMatch) {
        entities = entityMatch[1]
          .split(",")
          .map(e => e.trim())
          .filter(e => e.length > 0);
      }

    } catch (err) {
      console.log("⚠️ Parsing failed");
    }

    console.log(`🔎 LLM RAW INTENT TOKEN: "${rawToken.trim()}"`);
    logToFile(`OLLAMA INTENT RAW TOKEN: "${rawToken.trim()}"`);

    const cleanKeyword =
      rawToken
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, "");

    console.log(`🧠 LLM CLEANED KEYWORD: ${cleanKeyword || "ALL"}`);
    logToFile(`OLLAMA INTENT CLEANED: "${cleanKeyword}"`);

      return {
        intent: intent || "ALL",
        entities
      };

  } catch (err) {

    logToFile(`OLLAMA INTENT ERROR: ${err.message}`);
    console.error("❌ Intent extraction failed:", err);

    return "ALL";
  }
}
// 🔵 ADDED: ENTITY SEARCH
async function fetchEntitiesFromNeo4j(entities) {

  if (!entities || entities.length === 0) return [];

  const session = getSession();

  try {

    const results = [];

    for (const entity of entities) {

      const res = await session.run(
        `
        MATCH (n)
        WHERE toLower(n.name) CONTAINS toLower($entity)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT 10
        `,
        { entity }
      );

      res.records.forEach(record => {

        const n = record.get("n");
        const r = record.get("r");
        const m = record.get("m");

        if (n && r && m) {
          results.push({
            text: `(${n.labels[0]}: "${n.properties.name}") --[${r.type}]--> (${m.labels[0]}: "${m.properties.name}")`
          });
        }

      });

    }

    return results;

  } catch (err) {

    console.error("❌ Entity search error:", err);
    return [];

  } finally {

    await session.close();

  }

}
/* ============================================================
   🤖 MAIN CHAT ENDPOINT
============================================================ */

app.post("/api/chatbot/query", async (req, res) => {

  const { query, cid } = req.body ?? {};

  if (!query) {
    return res.status(400).json({ error: "query required" });
  }

  const conversationId = cid || makeId();
  const convo = getConversation(conversationId);

  const time = new Date().toLocaleString();

  console.log(`${time} 🔥 [${conversationId}] ${query}`);
  logToFile(`USER [${conversationId}]: ${query}`);

  // 🔵 ADDED
  console.log("🧭 PIPELINE START");
  logToFile("PIPELINE START");

  /* ---------- GREETING CHECK ---------- */

  let answer = checkGreeting(query);

  if (answer) {

    logToFile(`BOT [${conversationId}]: (Greeting)`);

    return res.json({
      answer,
      source: "greeting",
      cid: conversationId
    });
  }

  /* ---------- INTENT CLASSIFICATION ---------- */

  const intentData = await extractDynamicIntent(query);

const intentKeyword = intentData.intent;
const entities = intentData.entities || [];

// 🔵 ADDED LOG
console.log("🧠 ENTITIES DETECTED:", entities);
logToFile(`ENTITIES: ${entities.join(", ")}`);

  console.log(`🧠 Intent detected: ${intentKeyword}`);
  logToFile(`INTENT USED: ${intentKeyword}`);

  // 🔵 ADDED
  console.log("🔍 RETRIEVAL STRATEGY: intent → vector search → fallback");
  logToFile("RETRIEVAL STRATEGY: intent → vector search → fallback");

  /* ---------- GRAPH RETRIEVAL ---------- */

  let graphContext = [];

  try {

    graphContext = await fetchNeo4jContext(query, intentKeyword, 5);
    // 🔵 ADDED: entity-based retrieval
const entityContext = await fetchEntitiesFromNeo4j(entities);

// 🔵 MERGE RESULTS
const combined = [...graphContext, ...entityContext];

// remove duplicates
const unique = [];
const seen = new Set();

for (const item of combined) {
  if (!seen.has(item.text)) {
    seen.add(item.text);
    unique.push(item);
  }
}

graphContext = unique;
// 🔵 LOGGING
console.log(`🔗 Entity facts added: ${entityContext.length}`);
logToFile(`ENTITY FACT COUNT: ${entityContext.length}`);

    console.log(`🧩 Neo4j facts retrieved: ${graphContext.length}`);
    logToFile(`NEO4J FACT COUNT: ${graphContext.length}`);

    // 🔵 ADDED
    if (graphContext.length === 0) {
      console.log("⚠️ No graph results returned");
      logToFile("NO GRAPH RESULTS");
    }

    console.log("📊 Neo4j Relations:");

    graphContext.slice(0, 20).forEach((fact, i) => {

      const line = `${i + 1}. ${fact.text}`;

      console.log(line);
      logToFile(`FACT ${i + 1}: ${fact.text}`);

    });

  } catch (err) {

    console.error("❌ Neo4j retrieval error:", err);
    logToFile(`NEO4J ERROR: ${err.message}`);
  }

  /* ---------- FAQ FALLBACK ---------- */

  const faqHit = searchFAQ(query);

  if (faqHit && graphContext.length === 0) {

    logToFile(`BOT [${conversationId}]: (FAQ)`);

    return res.json({
      answer: faqHit.answer,
      source: "faq",
      cid: conversationId
    });
  }

  /* ---------- BUILD GRAPH CONTEXT ---------- */

  const graphText = graphContext.map(f => f.text).join("\n");

  // 🔵 ADDED
  console.log("📜 GRAPH TEXT SENT TO LLM:");
  console.log(graphText);
  logToFile("GRAPH TEXT SENT TO LLM:");
  logToFile(graphText);

  const systemPrompt = `
You are the AAST University Assistant.

Use the knowledge graph context below to answer the question.

If the information is not present say:
"I don't have that information in the knowledge graph."

GRAPH CONTEXT:
${graphText}
`;

  pushTurn(convo, "system", systemPrompt);
  pushTurn(convo, "user", query);

  /* ---------- OLLAMA ANSWER GENERATION ---------- */

  try {

    const prompt = convo.messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    // 🔵 ADDED
    console.log("🧠 FULL PROMPT SENT TO LLM:");
    console.log(prompt);
    logToFile("FULL PROMPT SENT TO LLM:");
    logToFile(prompt);

    const resLLM = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2:3b-instruct-q4_K_M",
        prompt,
        stream: false
      })
    });

    const data = await resLLM.json();

    // 🔵 ADDED
    console.log("🤖 RAW OLLAMA RESPONSE:", data);
    logToFile(`RAW OLLAMA RESPONSE: ${JSON.stringify(data)}`);

    answer = (data?.response || "").trim();

    // 🔵 ADDED
    console.log("💬 FINAL LLM ANSWER:", answer);
    logToFile(`FINAL LLM ANSWER: ${answer}`);

    pushTurn(convo, "assistant", answer);

    logToFile(`BOT [${conversationId}]: ${answer}`);

    return res.json({
      answer,
      source: "ollama-graph",
      cid: conversationId
    });

  } catch (err) {

    console.error("❌ Ollama generation error:", err);
    logToFile(`OLLAMA ERROR: ${err.message}`);
  }

  return res.json({
    answer: "I couldn't generate a response.",
    cid: conversationId
  });

});

/* ============================================================
   ▶ START SERVER
============================================================ */

(async () => {

  try {

    await connectNeo4j();

    app.listen(PORT, () => {
      console.log(`🚀 Orchestrator running at http://localhost:${PORT}`);
    });

  } catch (err) {

    console.error("❌ Failed to start:", err.message);
    process.exit(1);
  }

})();