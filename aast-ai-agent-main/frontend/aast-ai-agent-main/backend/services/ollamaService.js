import fetch from "node-fetch";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 20000);

// Startup diagnostic — logged once on module load
console.log(`[LLM][INIT] Ollama base URL: ${OLLAMA_BASE_URL}, timeout: ${OLLAMA_TIMEOUT_MS}ms`);

export async function callOllama(prompt, model = "gemma4:e4b", requestId = "none") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  const start = Date.now();
  const endpoint = `${OLLAMA_BASE_URL}/api/generate`;
  console.log(`[LLM][${requestId}] start (model: ${model}, endpoint: ${endpoint})`);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timer);
    const duration = Date.now() - start;
    console.log(`[LLM][${requestId}] response status=${res.status} duration=${duration}ms`);

    if (!res.ok) {
      console.error(`[LLM][${requestId}] HTTP error: status=${res.status} statusText=${res.statusText}`);
      throw new Error(`Ollama returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log(`[LLM][${requestId}] end duration=${duration}ms`);
    console.log(`[LLM RAW][${requestId}]`, data.response?.trim() ?? "");
    return data.response?.trim() ?? "";
  } catch (err) {
    const duration = Date.now() - start;
    clearTimeout(timer);
    if (err.name === "AbortError") {
      console.error(`[LLM][${requestId}] TIMEOUT after ${duration}ms (limit: ${OLLAMA_TIMEOUT_MS}ms, endpoint: ${endpoint})`);
      throw new Error(`Ollama request timed out after ${duration}ms (limit: ${OLLAMA_TIMEOUT_MS}ms)`);
    }
    console.error(`[LLM][${requestId}] end (error) duration=${duration}ms error=${err.message}`);
    throw err;
  }
}