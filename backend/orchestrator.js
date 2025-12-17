// orchestrator.js (top)
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";

import chatbotRouter from "./routes/chatbot.js";
import { searchFAQ } from "./faqService.js";
import { callGeminiMessages } from "./geminiService.js";
import { checkGreeting } from "./greetings.js";
import { ragSearch } from "./ragService.js";

const app = express();
const PORT = 8000;

/* ============================================================
   📁 LOGGING SETUP
============================================================ */
const LOG_DIR = path.resolve(process.cwd(), "logs");
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) {}
const QUERY_LOG = path.join(LOG_DIR, "chat.log");

console.log("LOG PATH:", QUERY_LOG, "CWD:", process.cwd());

function logToFile(text) {
  try {
    fs.appendFileSync(QUERY_LOG, text + "\n", "utf8");
  } catch (err) {
    console.error("❌ Failed to write query log:", err);
  }
}

function makeId() {
  return Math.random().toString(16).slice(2, 8);
}

app.use(cors());
app.use(bodyParser.json());

app.use("/api/chatbot/legacy", chatbotRouter);

/* ============================================================
   🧠 Conversation memory
============================================================ */
const conversations = new Map();

function pushConversationTurn(convId, role, content, maxTurns = 12) {
  const arr = conversations.get(convId) || [];
  arr.push({ role, content });
  const start = Math.max(0, arr.length - maxTurns);
  conversations.set(convId, arr.slice(start));
}

/* ============================================================
   🤖 MAIN ORCHESTRATOR
============================================================ */
app.post("/api/chatbot/query", async (req, res) => {
  const { query } = req.body ?? {};

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query is required" });
  }

  const cid = makeId();
  const time = new Date().toLocaleString();

  console.log(`${time} 🔥 [${cid}] User: ${query}`);
  logToFile(`${time} | [${cid}] User: ${query}`);

  /* ------------------ GREETING ------------------ */
  let answer = checkGreeting(query);
  if (answer) {
    logToFile(`${time} | [${cid}] Bot: ${answer}`);
    return res.json({ answer, source: "greeting", cid });
  }

  /* ------------------ STEP 1: RAG FIRST ------------------ */
  let ragUsed = false;

  try {
    const rag = await ragSearch(query, 3);
    const convId = cid;

    if (rag && rag.distance < 0.25) {
      logToFile(`${time} | [${cid}] Bot (RAG): ${rag.doc}`);
      return res.json({
        answer: rag.doc,
        source: "rag-only",
        cid
      });
    }

    if (rag) {
      ragUsed = true;

      if (!conversations.has(convId)) {
        conversations.set(convId, [
          {
            role: "system",
            content:
              "You are an official AAST college assistant. Be concise and factual. If you don't know, say you don't know."
          }
        ]);
      }

      pushConversationTurn(
        convId,
        "system",
        `Use the following AAST context to answer:\n${rag.doc}`,
        12
      );
    }
  } catch (err) {
    console.error("❌ RAG failed:", err);
  }

  /* ------------------ STEP 2: FAQ (FALLBACK) ------------------ */
  try {
    const faqHit = searchFAQ(query);
    if (faqHit && !ragUsed) {
      logToFile(`${time} | [${cid}] Bot: ${faqHit.answer}`);
      return res.json({
        answer: faqHit.answer,
        source: "faq",
        faqId: faqHit.id,
        cid
      });
    }
  } catch (err) {
    console.error("❌ FAQ search failed:", err);
  }

  /* ------------------ STEP 3: LLM ------------------ */
  try {
    const convId = cid;

    if (!conversations.has(convId)) {
      conversations.set(convId, [
        {
          role: "system",
          content:
            "You are an official AAST college assistant. Be concise and factual. If you don't know, say you don't know."
        }
      ]);
    }

    pushConversationTurn(convId, "user", query, 12);

    const messages = conversations.get(convId);
    const llmText = await callGeminiMessages({ messages });

    if (llmText && llmText.trim()) {
      answer = llmText.trim();
      pushConversationTurn(convId, "assistant", answer, 12);
      logToFile(`${time} | [${cid}] Bot: ${answer}`);
      return res.json({ answer, source: "llm-gemini", cid });
    }
  } catch (err) {
    console.error("❌ Gemini failed:", err);
  }

  /* ------------------ FALLBACK ------------------ */
  answer = "I couldn't find an answer.";
  logToFile(`${time} | [${cid}] Bot: ${answer}`);
  return res.json({ answer, source: "fallback", cid });
});

/* ============================================================
   🌍 Helper Endpoints
============================================================ */
app.get("/", (req, res) => {
  res.send("🚀 Orchestrator backend running");
});

app.get("/api/chatbot/history/:cid", (req, res) => {
  res.json({
    cid: req.params.cid,
    history: conversations.get(req.params.cid) || []
  });
});

app.post("/api/chatbot/clear/:cid", (req, res) => {
  conversations.delete(req.params.cid);
  res.json({ ok: true, cid: req.params.cid });
});

/* ============================================================
   ▶️ START SERVER
============================================================ */
app.listen(PORT, () => {
  console.log(`🚀 Orchestrator running on http://localhost:${PORT}`);
});
