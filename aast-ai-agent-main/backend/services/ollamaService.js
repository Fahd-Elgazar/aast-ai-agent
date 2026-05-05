/**
 * ============================================================
 * AAST Explainable Hybrid GraphRAG Academic Advisor
 * Production-Grade Ollama Service (Phase 3 Stability Patch)
 * ============================================================
 *
 * PURPOSE:
 * Centralized resilient Ollama inference layer for all backend LLM usage.
 *
 * FIXES INCLUDED:
 * - Unified model registry
 * - Shared timeout hierarchy
 * - 3-tier retry resilience
 * - Preserved AbortError for upstream retry detection
 * - HTTP 500 / 503 / ECONNRESET retry support
 * - Cold-start warmup
 * - Health probes
 * - Model preload
 * - Adaptive backoff
 * - Structured observability
 * - Reduced raw logging
 * - Frontend compatibility preserved
 * ============================================================
 */

import fetch from "node-fetch";

/// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

const OLLAMA_BASE_URL =
  (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");

const OLLAMA_GENERATE_URL = `${OLLAMA_BASE_URL}/api/generate`;
const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`;

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "gemma4:e2b";

const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 25000);

const MAX_RETRIES = Number(process.env.OLLAMA_MAX_RETRIES || 3);

const BASE_RETRY_DELAY_MS = Number(
  process.env.OLLAMA_RETRY_BASE_DELAY_MS || 1500
);

const HEALTHCHECK_TIMEOUT_MS = 5000;

// Phase 3 Production State
let lastWarmupAt = 0;
const WARMUP_INTERVAL_MS = 300000; // 5 min

let cachedHealth = null;
let cachedHealthAt = 0;
const HEALTH_CACHE_TTL_MS = 30000; // 30 sec

let consecutiveFailures = 0;
const FAILURE_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60000;
let circuitBreakerTrippedAt = 0;

// ─────────────────────────────────────────────────────────────
// OBSERVABILITY
// ─────────────────────────────────────────────────────────────

function log(level, event, payload = {}) {
  const logger =
    level === "ERROR"
      ? console.error
      : level === "WARN"
        ? console.warn
        : console.log;

  logger(
    JSON.stringify({
      level,
      service: "OllamaService",
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    })
  );
}

function logInfo(event, payload) {
  log("INFO", event, payload);
}

function logWarn(event, payload) {
  log("WARN", event, payload);
}

function logError(event, payload) {
  log("ERROR", event, payload);
}

// ─────────────────────────────────────────────────────────────
// RETRYABLE ERROR DETECTION
// ─────────────────────────────────────────────────────────────

function isRetryableError(error) {
  if (!error) return false;

  if (error.name === "AbortError") return true;

  const msg = (error.message || "").toLowerCase();

  return (
    msg.includes("http 500") ||
    msg.includes("http 503") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("model is loading")
  );
}

// ─────────────────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────────────────

export async function checkOllamaHealth() {
  const now = Date.now();
  if (cachedHealth && (now - cachedHealthAt < HEALTH_CACHE_TTL_MS)) {
    return cachedHealth;
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    HEALTHCHECK_TIMEOUT_MS
  );

  try {
    const res = await fetch(OLLAMA_TAGS_URL, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Health check failed: HTTP ${res.status}`);
    }

    const data = await res.json();

    const models =
      Array.isArray(data.models) ? data.models.map((m) => m.name) : [];

    const modelAvailable = models.includes(DEFAULT_MODEL);

    logInfo("health_check_passed", {
      model: DEFAULT_MODEL,
      available_models: models.length,
      model_available: modelAvailable,
    });

    cachedHealth = {
      healthy: true,
      modelAvailable,
      models,
    };
    cachedHealthAt = now;

    return cachedHealth;
  } catch (error) {
    clearTimeout(timer);

    logError("health_check_failed", {
      error_message: error.message,
    });

    // Don't cache failures for the full TTL
    return {
      healthy: false,
      modelAvailable: false,
      models: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────
// WARMUP
// ─────────────────────────────────────────────────────────────

export async function warmupOllama(model = DEFAULT_MODEL) {
  const now = Date.now();
  if (now - lastWarmupAt < WARMUP_INTERVAL_MS) {
    return true;
  }

  try {
    logInfo("warmup_start", { model });

    await executeOllamaRequest({
      prompt: "ping",
      model,
      requestId: "warmup",
      timeoutMs: 10000,
      options: {
        temperature: 0.0,
        top_p: 0.1,
      }
    });

    lastWarmupAt = now;
    logInfo("warmup_success", { model });

    return true;
  } catch (error) {
    logWarn("warmup_failed", {
      model,
      error_message: error.message,
    });

    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// LOW-LEVEL REQUEST
// ─────────────────────────────────────────────────────────────

async function executeOllamaRequest({
  prompt,
  model,
  requestId,
  timeoutMs,
  options = {},
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();

  try {
    const response = await fetch(OLLAMA_GENERATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const duration = Date.now() - start;

    if (!response.ok) {
      throw new Error(
        `Ollama returned HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    const answer =
      data?.response?.trim() ||
      data?.message?.content?.trim() ||
      "";

    if (!answer) {
      throw new Error("Ollama returned empty response");
    }

    logInfo("request_success", {
      requestId,
      model,
      duration_ms: duration,
      response_chars: answer.length,
    });

    // Reset circuit breaker on success
    consecutiveFailures = 0;

    return answer;
  } catch (error) {
    clearTimeout(timer);

    const duration = Date.now() - start;

    // Increment failure counter
    consecutiveFailures++;
    if (consecutiveFailures >= FAILURE_THRESHOLD) {
      circuitBreakerTrippedAt = Date.now();
      logError("circuit_breaker_tripped", { consecutiveFailures });
    }

    // Preserve AbortError
    if (error.name === "AbortError") {
      logWarn("request_timeout", {
        requestId,
        model,
        timeout_ms: timeoutMs,
        duration_ms: duration,
      });

      throw error;
    }

    logWarn("request_failure", {
      requestId,
      model,
      duration_ms: duration,
      error_message: error.message,
    });

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// STABLE PRODUCTION INTERFACE
// ─────────────────────────────────────────────────────────────

export async function generateStableResponse({
  prompt,
  model = DEFAULT_MODEL,
  requestId = "none",
  timeoutMs = OLLAMA_TIMEOUT_MS,
  options = {},
  skipWarmup = false,
}) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("Prompt is required for Ollama generation.");
  }

  // Step 0: Circuit Breaker Check
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    const timeSinceTrip = Date.now() - circuitBreakerTrippedAt;
    if (timeSinceTrip < CIRCUIT_BREAKER_RESET_MS) {
      logWarn("circuit_breaker_reject", { requestId, timeSinceTrip });
      throw new Error("Ollama service temporarily suspended due to repeated failures.");
    } else {
      // Cooldown expired, reset for a retry attempt
      logInfo("circuit_breaker_cooldown_expired", { requestId });
      consecutiveFailures = 0;
    }
  }

  // Step 1: Health Check
  const health = await checkOllamaHealth();

  if (!health.healthy) {
    throw new Error("Ollama server unavailable.");
  }

  if (!health.modelAvailable) {
    throw new Error(`Required Ollama model unavailable: ${model}`);
  }

  // Step 2: Warmup if needed
  if (!skipWarmup) {
    await warmupOllama(model);
  }

  let lastError;

  // Correct loop: 0 is initial, 1..MAX_RETRIES are retries.
  // Total attempts = initial + MAX_RETRIES.
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay =
          BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);

        logWarn("retry_scheduled", {
          requestId,
          attempt,
          delay_ms: delay,
        });

        await new Promise((resolve) =>
          setTimeout(resolve, delay)
        );
      }

      logInfo("generation_attempt", {
        requestId,
        model,
        attempt,
      });

      return await executeOllamaRequest({
        prompt,
        model,
        requestId,
        timeoutMs,
        options,
      });
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt >= MAX_RETRIES) {
        break;
      }
    }
  }

  logError("generation_failed", {
    requestId,
    model,
    retries_exhausted: true,
    error_message: lastError?.message,
  });

  throw lastError;
}

// ─────────────────────────────────────────────────────────────
// BACKWARD COMPATIBILITY
// ─────────────────────────────────────────────────────────────

export async function callOllama(
  prompt,
  model = DEFAULT_MODEL,
  requestId = "none"
) {
  return generateStableResponse({
    prompt,
    model,
    requestId,
  });
}

// ─────────────────────────────────────────────────────────────
// STARTUP DIAGNOSTIC
// ─────────────────────────────────────────────────────────────

logInfo("ollama_service_initialized", {
  base_url: OLLAMA_BASE_URL,
  model: DEFAULT_MODEL,
  timeout_ms: OLLAMA_TIMEOUT_MS,
  max_retries: MAX_RETRIES,
});