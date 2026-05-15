/**
 * Centralized Ollama inference layer with Gemma-first failover.
 *
 * Public API compatibility is intentionally preserved:
 * - generateStableResponse(...)
 * - callOllama(prompt, model, requestId)
 * - checkOllamaHealth()
 * - warmupOllama(model)
 */

import fetch from "node-fetch";
import { LLM_CONFIG } from "../config/llmConfig.js";
import { modelFailoverManager } from "./modelFailoverManager.js";

const lastGenerationMetadata = new Map();
const MAX_GENERATION_METADATA = 100;

function log(level, event, payload = {}) {
  const writer =
    level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;

  writer(JSON.stringify({
    level,
    service: "OllamaService",
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
}

export function isRetryableError(error) {
  if (!error) return false;
  if (error.retryable === true) return true;
  if (error.name === "AbortError") return true;
  if (isRetryableStatus(error.status)) return true;

  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("http 500") ||
    message.includes("http 502") ||
    message.includes("http 503") ||
    message.includes("http 504") ||
    message.includes("econnreset") ||
    message.includes("socket hang up") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("model is loading") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

function retryDelayMs(retryNumber) {
  const exponential =
    LLM_CONFIG.retries.baseDelayMs * Math.pow(2, Math.max(0, retryNumber - 1));
  return Math.min(exponential, LLM_CONFIG.retries.maxDelayMs);
}

function createOllamaHttpError(response, bodyPreview = "") {
  const error = new Error(
    `Ollama returned HTTP ${response.status}: ${response.statusText}`
  );
  error.status = response.status;
  error.retryable = isRetryableStatus(response.status);
  error.bodyPreview = bodyPreview;
  return error;
}

function rememberGenerationMetadata(requestId, metadata) {
  if (!requestId) return;

  lastGenerationMetadata.set(requestId, {
    ...metadata,
    recorded_at: new Date().toISOString(),
  });

  while (lastGenerationMetadata.size > MAX_GENERATION_METADATA) {
    const oldestKey = lastGenerationMetadata.keys().next().value;
    lastGenerationMetadata.delete(oldestKey);
  }
}

async function executeOllamaRequest({
  prompt,
  model,
  requestId,
  timeoutMs,
  options = {},
  role,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const response = await fetch(LLM_CONFIG.generateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        keep_alive: LLM_CONFIG.keepAlive,
        options,
      }),
      signal: controller.signal,
    });

    const durationMs = Date.now() - start;

    if (!response.ok) {
      const bodyPreview = await response.text().catch(() => "");
      throw createOllamaHttpError(response, bodyPreview.slice(0, 240));
    }

    const data = await response.json();
    const answer =
      data?.response?.trim() ||
      data?.message?.content?.trim() ||
      "";

    if (!answer) {
      const error = new Error("Ollama returned empty response");
      error.retryable = true;
      throw error;
    }

    log("INFO", "request_success", {
      requestId,
      model,
      role,
      duration_ms: durationMs,
      response_chars: answer.length,
    });

    return { answer, durationMs };
  } catch (error) {
    const durationMs = Date.now() - start;

    log(error.name === "AbortError" ? "WARN" : "WARN", "request_failure", {
      requestId,
      model,
      role,
      duration_ms: durationMs,
      timeout_ms: timeoutMs,
      retryable: isRetryableError(error),
      error_message: error.name === "AbortError" ? "timeout" : error.message,
      status: error.status,
    });

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function generateWithRetries({
  prompt,
  model,
  role,
  requestId,
  retryLimit,
  timeoutMs,
  deadlineAt,
  options,
}) {
  const startedAt = Date.now();
  let lastError = null;

  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
    const remainingMs = deadlineAt - Date.now();

    if (remainingMs < LLM_CONFIG.timeouts.minRemainingMs) {
      lastError = new Error("LLM request deadline exhausted before next attempt");
      lastError.retryable = true;
      break;
    }

    const attemptTimeoutMs = Math.min(timeoutMs, remainingMs);

    log("INFO", "generation_attempt", {
      requestId,
      model,
      role,
      attempt,
      retry_limit: retryLimit,
      timeout_ms: attemptTimeoutMs,
      remaining_budget_ms: remainingMs,
      breaker_state: modelFailoverManager.getStatus().breaker_state,
    });

    try {
      const result = await executeOllamaRequest({
        prompt,
        model,
        requestId,
        timeoutMs: attemptTimeoutMs,
        options,
        role,
      });

      const latencyMs = Date.now() - startedAt;
      modelFailoverManager.recordModelSuccess({ model, role, latencyMs });

      return {
        answer: result.answer,
        attempts: attempt + 1,
        latencyMs,
        model,
        role,
      };
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt >= retryLimit) {
        break;
      }

      const delayMs = retryDelayMs(attempt + 1);

      if (deadlineAt - Date.now() - delayMs < LLM_CONFIG.timeouts.minRemainingMs) {
        break;
      }

      log("WARN", "retry_scheduled", {
        requestId,
        model,
        role,
        attempt,
        next_attempt: attempt + 1,
        delay_ms: delayMs,
      });

      await sleep(delayMs);
    }
  }

  const latencyMs = Date.now() - startedAt;
  modelFailoverManager.recordModelFailure({
    model,
    role,
    error: lastError,
    latencyMs,
  });

  log("ERROR", "generation_failed", {
    requestId,
    model,
    role,
    attempts: retryLimit + 1,
    latency_ms: latencyMs,
    error_message: lastError?.message,
    breaker_state: modelFailoverManager.getStatus().breaker_state,
  });

  throw lastError;
}

export async function checkOllamaHealth() {
  const status = await modelFailoverManager.refreshHealth();

  return {
    healthy: status.server_healthy && status.breaker_state !== "OPEN",
    modelAvailable: status.primary_health.available,
    backupModelAvailable: status.backup_health.available,
    models: status.available_models,
    primary: status.primary_health,
    backup: status.backup_health,
    breakerState: status.breaker_state,
    startup_readiness_phase: status.startup_readiness_phase,
    ollama_ready: status.ollama_ready,
    ollama_wait_attempts: status.ollama_wait_attempts,
    ollama_wait_duration_ms: status.ollama_wait_duration_ms,
    startupReadinessPhase: status.startup_readiness_phase,
    ollamaReady: status.ollama_ready,
    ollamaWaitAttempts: status.ollama_wait_attempts,
    ollamaWaitDurationMs: status.ollama_wait_duration_ms,
    failoverActive: status.failover_active,
    truePrimaryModel: status.true_primary_model,
    activeRuntimeModel: status.active_runtime_model,
    primaryColdStartPending: status.primary_cold_start_pending,
    preloadWarning: status.preload_warning,
    startupPreloadStatus: status.startup_preload_status,
    backupReady: status.backup_ready,
  };
}

export async function warmupOllama(model = LLM_CONFIG.primaryModel) {
  return modelFailoverManager.preloadModel(model);
}

export async function preloadOllamaModels() {
  return modelFailoverManager.preloadModels();
}

export function getOllamaRuntimeStatus() {
  return modelFailoverManager.getStatus();
}

export function getLastGenerationMetadata(requestId) {
  return lastGenerationMetadata.get(requestId) || null;
}

export async function generateStableResponse({
  prompt,
  model = LLM_CONFIG.primaryModel,
  requestId = "none",
  timeoutMs = LLM_CONFIG.timeouts.primaryMs,
  deadlineMs = LLM_CONFIG.timeouts.generationDeadlineMs,
  options = {},
  skipWarmup = true,
} = {}) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("Prompt is required for Ollama generation.");
  }

  modelFailoverManager.start();
  modelFailoverManager.scheduleRecoveryProbeIfDue();

  if (skipWarmup === false) {
    log("INFO", "warmup_skipped_for_latency", {
      requestId,
      reason: "per_request_warmup_disabled",
    });
  }

  const initialRoute = modelFailoverManager.getInitialRoute(model);
  const runtimeStatusBeforeAttempt = modelFailoverManager.getStatus();
  const primaryColdStartAttempt =
    initialRoute.role === "primary" &&
    runtimeStatusBeforeAttempt.primary_cold_start_pending === true;
  const requestStartedAt = Date.now();
  const effectiveDeadlineMs = primaryColdStartAttempt
    ? Math.max(deadlineMs, LLM_CONFIG.timeouts.primaryColdStartMs)
    : Math.min(
        Math.max(deadlineMs, LLM_CONFIG.timeouts.minRemainingMs),
        LLM_CONFIG.timeouts.generationDeadlineMs
      );
  const deadlineAt = requestStartedAt + effectiveDeadlineMs;

  if (initialRoute.role === "none") {
    const status = modelFailoverManager.getStatus();
    const error = new Error(
      initialRoute.reason === "waiting_for_ollama"
        ? "Ollama generation unavailable: startup readiness is waiting for Ollama."
        : "Ollama generation unavailable: primary and backup models are unhealthy."
    );
    error.code =
      initialRoute.reason === "waiting_for_ollama"
        ? "LLM_WAITING_FOR_OLLAMA"
        : "LLM_CIRCUIT_OPEN";

    rememberGenerationMetadata(requestId, {
      success: false,
      model: null,
      role: "none",
      failover_used: false,
      ...status,
    });

    log("ERROR", "breaker_open_reject", {
      requestId,
      ...status,
    });

    throw error;
  }

  if (initialRoute.role === "backup") {
    log("WARN", "backup_route_selected", {
      requestId,
      reason: initialRoute.reason,
      primary_model: LLM_CONFIG.primaryModel,
      backup_model: LLM_CONFIG.backupModel,
      ...modelFailoverManager.getStatus(),
    });
  }

  if (primaryColdStartAttempt) {
    log("WARN", "primary_cold_start_live_retry", {
      requestId,
      model: initialRoute.model,
      timeout_ms: LLM_CONFIG.timeouts.primaryColdStartMs,
      deadline_ms: effectiveDeadlineMs,
      breaker_state: runtimeStatusBeforeAttempt.breaker_state,
      message: "Gemma remains primary; startup preload warning will be resolved by this live request if successful.",
    });
  }

  try {
    const initialResult = await generateWithRetries({
      prompt,
      model: initialRoute.model,
      role: initialRoute.role,
      requestId,
      retryLimit:
        initialRoute.role === "backup"
          ? LLM_CONFIG.retries.backupLimit
          : LLM_CONFIG.retries.primaryLimit,
      timeoutMs:
        initialRoute.role === "backup"
          ? LLM_CONFIG.timeouts.backupMs
          : primaryColdStartAttempt
            ? Math.max(timeoutMs, LLM_CONFIG.timeouts.primaryColdStartMs)
            : timeoutMs,
      deadlineAt,
      options,
    });

    rememberGenerationMetadata(requestId, {
      success: true,
      failover_used: initialRoute.role === "backup",
      primary_cold_start_attempt: primaryColdStartAttempt,
      ...initialResult,
      ...modelFailoverManager.getStatus(),
    });

    return initialResult.answer;
  } catch (primaryError) {
    if (!modelFailoverManager.canFallbackToBackup(initialRoute.role)) {
      if (initialRoute.role === "primary") {
        log("WARN", "primary_failure_below_failover_threshold", {
          requestId,
          primary_model: LLM_CONFIG.primaryModel,
          backup_model: LLM_CONFIG.backupModel,
          error_message: primaryError?.message,
          message: "Gemma remains active until consecutive runtime failures reach the failover threshold.",
          ...modelFailoverManager.getStatus(),
        });
      }

      if (initialRoute.role === "backup") {
        modelFailoverManager.recordAllModelsFailed("backup_failed_while_degraded");
      }

      rememberGenerationMetadata(requestId, {
        success: false,
        model: initialRoute.model,
        role: initialRoute.role,
        failover_used: initialRoute.role === "backup",
        primary_cold_start_attempt: primaryColdStartAttempt,
        error_message: primaryError?.message,
        ...modelFailoverManager.getStatus(),
      });

      throw primaryError;
    }

    modelFailoverManager.activateBackup("primary_generation_failed");

    try {
      const backupResult = await generateWithRetries({
        prompt,
        model: LLM_CONFIG.backupModel,
        role: "backup",
        requestId,
        retryLimit: LLM_CONFIG.retries.backupLimit,
        timeoutMs: LLM_CONFIG.timeouts.backupMs,
        deadlineAt,
        options,
      });

      rememberGenerationMetadata(requestId, {
        success: true,
        failover_used: true,
        primary_cold_start_attempt: primaryColdStartAttempt,
        primary_error: primaryError?.message,
        ...backupResult,
        ...modelFailoverManager.getStatus(),
      });

      return backupResult.answer;
    } catch (backupError) {
      modelFailoverManager.recordAllModelsFailed("primary_and_backup_failed");

      rememberGenerationMetadata(requestId, {
        success: false,
        model: LLM_CONFIG.backupModel,
        role: "backup",
        failover_used: true,
        primary_cold_start_attempt: primaryColdStartAttempt,
        primary_error: primaryError?.message,
        backup_error: backupError?.message,
        ...modelFailoverManager.getStatus(),
      });

      throw backupError;
    }
  }
}

export async function callOllama(
  prompt,
  model = LLM_CONFIG.primaryModel,
  requestId = "none"
) {
  return generateStableResponse({
    prompt,
    model,
    requestId,
  });
}

modelFailoverManager.start();

log("INFO", "ollama_service_initialized", {
  base_url: LLM_CONFIG.ollamaBaseUrl,
  primary_model: LLM_CONFIG.primaryModel,
  backup_model: LLM_CONFIG.backupModel,
  primary_retry_limit: LLM_CONFIG.retries.primaryLimit,
  backup_retry_limit: LLM_CONFIG.retries.backupLimit,
  primary_timeout_ms: LLM_CONFIG.timeouts.primaryMs,
  backup_timeout_ms: LLM_CONFIG.timeouts.backupMs,
  generation_deadline_ms: LLM_CONFIG.timeouts.generationDeadlineMs,
  primary_max_failures: LLM_CONFIG.failover.primaryMaxFailures,
  breaker_threshold: LLM_CONFIG.failover.breakerThreshold,
  half_open_interval_ms: LLM_CONFIG.failover.halfOpenIntervalMs,
});
