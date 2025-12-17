// backend/geminiService.js
import dotenv from "dotenv";
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CONFIG_MODEL = process.env.GEMINI_MODEL || "models/gemini-2.5-flash";

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in .env");
}

/**
 * Convert a messages array to a single text prompt suitable for Gemini generateContent.
 * messages: [{ role: "system"|"user"|"assistant", content: "..." }, ...]
 */
function buildPromptFromMessages(messages = []) {
  // Start with an optional system instruction (only the first system message)
  const systemMsg = messages.find(m => m.role === "system")?.content ?? "";
  // Then append dialog turns in order (skip the system messages that we've handled)
  const dialogParts = messages
    .filter(m => m.role !== "system")
    .map(m => {
      const roleLabel = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : m.role;
      // keep each as a short block
      return `${roleLabel}: ${m.content}`;
    });

  // Join with two newlines so Gemini sees structure
  const joined = [systemMsg, ...dialogParts].filter(Boolean).join("\n\n");
  return joined;
}

/**
 * Call Gemini with a messages array and return the assistant text.
 * - messages: array of message objects {role, content}
 * - modelPath: optional override like "models/gemini-2.5-flash" or short name
 */
export async function callGeminiMessages({ messages = [], modelPath = CONFIG_MODEL } = {}) {
  // modelPath may be "models/..." already
  const model = modelPath.startsWith("models/") ? modelPath : `models/${modelPath}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const promptText = buildPromptFromMessages(messages);

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: promptText }]
      }
    ]
  };

  // call
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  // helpful debug logs (remove in prod)
  console.log("=== Gemini RAW RESPONSE (start) ===");
  console.log(raw);
  console.log("=== Gemini RAW RESPONSE (end) ===");

  if (!res.ok) {
    // parse JSON if possible for nice error messages
    let json;
    try { json = JSON.parse(raw); } catch(e) { json = raw; }
    throw new Error(`Gemini API error ${res.status}: ${JSON.stringify(json)}`);
  }

  const json = JSON.parse(raw);

  const candidateText =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    json?.candidates?.[0]?.content?.text ??
    json?.output?.[0]?.content?.parts?.[0]?.text ??
    null;

  return candidateText ? String(candidateText).trim() : null;
}
