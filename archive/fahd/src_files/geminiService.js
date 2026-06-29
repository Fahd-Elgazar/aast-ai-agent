import fetch from "node-fetch";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_GEMINI_TIMEOUT_MS = 10000;

let startupWarningEmitted = false;

function integerFromEnv(names, fallback, { min = 1 } = {}) {
  for (const name of names) {
    const parsed = Number.parseInt(process.env[name], 10);
    if (Number.isFinite(parsed)) {
      return Math.max(parsed, min);
    }
  }

  return fallback;
}

function stringFromEnv(names, fallback) {
  for (const name of names) {
    const raw = process.env[name];
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
  }

  return fallback;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function createGeminiError(message, details = {}) {
  const error = new Error(message);
  Object.assign(error, {
    provider: "gemini",
    fallbackEligible: true,
    ...details,
  });
  return error;
}

function getApiKey() {
  return typeof process.env.GEMINI_API_KEY === "string"
    ? process.env.GEMINI_API_KEY.trim()
    : "";
}

function getModel() {
  return stringFromEnv(["GEMINI_MODEL"], DEFAULT_GEMINI_MODEL);
}

function getBaseUrl() {
  return stringFromEnv(["GEMINI_BASE_URL"], DEFAULT_GEMINI_BASE_URL).replace(/\/$/, "");
}

function getDefaultTimeoutMs() {
  return integerFromEnv(
    ["GEMINI_SYNTHESIS_TIMEOUT_MS", "GEMINI_TIMEOUT_MS"],
    DEFAULT_GEMINI_TIMEOUT_MS,
    { min: 1000 }
  );
}

export function validateGeminiEnvironment({ warn = true } = {}) {
  const configured = !!getApiKey();

  if (!configured && warn && !startupWarningEmitted) {
    startupWarningEmitted = true;
    console.warn(
      "[GEMINI_STARTUP_WARNING] GEMINI_API_KEY is missing; final conversational synthesis will use local Ollama fallback."
    );
  }

  return {
    configured,
    model: getModel(),
    timeoutMs: getDefaultTimeoutMs(),
    baseUrl: getBaseUrl(),
  };
}

export function isGeminiTimeoutError(error) {
  return (
    error?.code === "GEMINI_TIMEOUT" ||
    error?.name === "AbortError" ||
    String(error?.message || "").toLowerCase().includes("timeout")
  );
}

function sanitizePromptForExternalSynthesis(prompt) {
  return String(prompt || "")
    .replace(/Knowledge Graph Facts \(Neo4j[^)]*\)/gi, "Verified Structured Academic Facts")
    .replace(/Retrieved Document Context \(RAG[^)]*\)/gi, "Verified University Document Passages")
    .replace(/\s+\((?:source:\s*[^),]+,\s*)?(?:nodes|rels):\s*\d+(?:,\s*(?:nodes|rels):\s*\d+)?\)/gi, "")
    .trim();
}

function buildGenerationConfig(options = {}) {
  const config = {
    candidateCount: 1,
    temperature: clampNumber(options.temperature, 0, 1, 0.15),
    topP: clampNumber(options.top_p ?? options.topP, 0.05, 1, 0.8),
  };

  const maxOutputTokens = Number.parseInt(options.num_predict ?? options.maxOutputTokens, 10);
  if (Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) {
    config.maxOutputTokens = Math.min(Math.max(maxOutputTokens, 64), 2048);
  }

  if (options.disableThinking === true) {
    config.thinkingConfig = { thinkingBudget: 0 };
  }

  return config;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  if (typeof data?.text === "string") {
    return data.text.trim();
  }

  return "";
}

export async function generateGeminiSynthesis({
  prompt,
  requestId = "none",
  timeoutMs = getDefaultTimeoutMs(),
  options = {},
} = {}) {
  if (!prompt || typeof prompt !== "string") {
    throw createGeminiError("Prompt is required for Gemini synthesis.", {
      code: "GEMINI_INVALID_PROMPT",
      retryable: false,
    });
  }

  if (process.env.GEMINI_SYNTHESIS_FORCE_ERROR === "true") {
    throw createGeminiError("Gemini forced failure for fallback verification.", {
      code: "GEMINI_FORCED_ERROR",
      retryable: true,
    });
  }

  if (process.env.GEMINI_SYNTHESIS_FORCE_TIMEOUT === "true") {
    throw createGeminiError("Gemini forced timeout for fallback verification.", {
      code: "GEMINI_TIMEOUT",
      retryable: true,
    });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw createGeminiError("GEMINI_API_KEY is missing.", {
      code: "GEMINI_MISSING_API_KEY",
      retryable: false,
    });
  }

  const model = getModel();
  const url = `${getBaseUrl()}/${encodeURIComponent(model)}:generateContent`;
  const cleanPrompt = sanitizePromptForExternalSynthesis(prompt);
  const controller = new AbortController();
  const effectiveTimeoutMs = Number.isFinite(Number(timeoutMs))
    ? Math.max(Number(timeoutMs), 1000)
    : getDefaultTimeoutMs();
  const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: cleanPrompt }],
          },
        ],
        generationConfig: buildGenerationConfig(options),
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startedAt;
    const data = await response.json().catch(async () => ({
      error: { message: await response.text().catch(() => "") },
    }));

    if (!response.ok) {
      throw createGeminiError(`Gemini returned HTTP ${response.status}.`, {
        code: response.status === 429 ? "GEMINI_RATE_LIMIT" : "GEMINI_HTTP_ERROR",
        status: response.status,
        retryable: [408, 409, 425, 429, 500, 502, 503, 504].includes(response.status),
        bodyPreview: String(data?.error?.message || "").slice(0, 240),
      });
    }

    const text = extractText(data);
    if (!text) {
      throw createGeminiError("Gemini returned empty synthesis output.", {
        code: "GEMINI_EMPTY_RESPONSE",
        retryable: true,
      });
    }

    return {
      text,
      provider: "gemini",
      model,
      requestId,
      latencyMs,
      promptChars: cleanPrompt.length,
      outputTokens: data?.usageMetadata?.candidatesTokenCount ?? null,
      promptTokens: data?.usageMetadata?.promptTokenCount ?? null,
      totalTokens: data?.usageMetadata?.totalTokenCount ?? null,
      finishReason: data?.candidates?.[0]?.finishReason || null,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createGeminiError(`Gemini synthesis timed out after ${effectiveTimeoutMs}ms.`, {
        code: "GEMINI_TIMEOUT",
        retryable: true,
        timeoutMs: effectiveTimeoutMs,
      });
    }

    if (error?.provider === "gemini") {
      throw error;
    }

    throw createGeminiError(error?.message || "Gemini synthesis failed.", {
      code: "GEMINI_REQUEST_FAILED",
      retryable: true,
    });
  } finally {
    clearTimeout(timer);
  }
}
