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
import { gemmaRequestLimiter } from "./gemmaRequestLimiter.js";
import { gemmaTelemetryService } from "./gemmaTelemetryService.js";

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

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function clampNumber(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
}

export function classifyOllamaError(error) {
  if (!error) {
    return {
      type: "unknown",
      retryable: false,
      overload: false,
      circuitEligible: true,
    };
  }

  const message = String(error.message || "").toLowerCase();
  const bodyPreview = String(error.bodyPreview || "").toLowerCase();
  const combined = `${message} ${bodyPreview}`;

  if (
    error.code === "GEMMA_QUEUE_OVERFLOW" ||
    error.code === "GEMMA_QUEUE_TIMEOUT" ||
    error.overload === true ||
    combined.includes("server busy") ||
    combined.includes("too many requests") ||
    combined.includes("no available slots") ||
    combined.includes("queue")
  ) {
    return {
      type: "overload",
      retryable: true,
      overload: true,
      circuitEligible: false,
      recovery: "short",
    };
  }

  if (error.name === "AbortError" || combined.includes("timed out") || combined.includes("timeout")) {
    return {
      type: "timeout",
      retryable: true,
      overload: false,
      circuitEligible: true,
      recovery: "medium",
    };
  }

  if (
    combined.includes("econnreset") ||
    combined.includes("socket hang up") ||
    combined.includes("fetch failed") ||
    combined.includes("network")
  ) {
    return {
      type: "connection_reset",
      retryable: true,
      overload: false,
      circuitEligible: true,
      recovery: "cold",
    };
  }

  if (
    combined.includes("model is loading") ||
    combined.includes("loading model") ||
    combined.includes("llama runner") ||
    combined.includes("runner") ||
    combined.includes("out of memory") ||
    combined.includes("memory allocation") ||
    combined.includes("cannot allocate") ||
    combined.includes("cuda") ||
    combined.includes("kv cache") ||
    combined.includes("context length") ||
    combined.includes("failed to load") ||
    combined.includes("runner process")
  ) {
    return {
      type: "cold_boot_or_runtime",
      retryable: true,
      overload: false,
      circuitEligible: true,
      recovery: "cold",
    };
  }

  if (error.status === 500) {
    return {
      type: "http_500_runtime",
      retryable: true,
      overload: false,
      circuitEligible: true,
      recovery: "medium",
    };
  }

  if (isRetryableStatus(error.status)) {
    return {
      type: `http_${error.status}`,
      retryable: true,
      overload: error.status === 429,
      circuitEligible: error.status !== 429,
      recovery: error.status === 429 ? "short" : "medium",
    };
  }

  if (error.retryable === true) {
    return {
      type: "retryable",
      retryable: true,
      overload: false,
      circuitEligible: true,
      recovery: "medium",
    };
  }

  return {
    type: "non_retryable",
    retryable: false,
    overload: false,
    circuitEligible: true,
    recovery: "none",
  };
}

export function isRetryableError(error) {
  const classification = classifyOllamaError(error);
  if (classification.retryable === true) return true;
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

function retryDelayMs(retryNumber, classification = {}) {
  if (classification.recovery === "short" || classification.overload) {
    return LLM_CONFIG.retries.overloadDelayMs;
  }

  const baseDelay =
    classification.recovery === "cold"
      ? LLM_CONFIG.retries.recoveryDelayMs
      : LLM_CONFIG.retries.baseDelayMs;
  const maxDelay =
    classification.recovery === "cold"
      ? LLM_CONFIG.retries.recoveryMaxDelayMs
      : LLM_CONFIG.retries.maxDelayMs;
  const exponential = baseDelay * Math.pow(2, Math.max(0, retryNumber - 1));
  return Math.min(exponential, maxDelay);
}

function resolveNumPredict(routeType, explicitNumPredict) {
  if (Number.isFinite(Number(explicitNumPredict))) {
    return clampNumber(
      explicitNumPredict,
      1,
      LLM_CONFIG.gemma.numPredict.max
    );
  }

  const normalizedRoute = String(routeType || "").toUpperCase();
  if (normalizedRoute.includes("INTENT")) return LLM_CONFIG.gemma.numPredict.intent;
  if (normalizedRoute.includes("FALLBACK")) return LLM_CONFIG.gemma.numPredict.fallback;
  if (normalizedRoute.includes("HYBRID") || normalizedRoute.includes("RAG")) {
    return LLM_CONFIG.gemma.numPredict.heavy;
  }
  if (normalizedRoute.includes("KG") || normalizedRoute.includes("FAQ")) {
    return LLM_CONFIG.gemma.numPredict.light;
  }
  return LLM_CONFIG.gemma.numPredict.synthesis;
}

function buildStableOptions(options = {}, { routeType = "GENERAL", promptTokens = 0 } = {}) {
  const pressure = gemmaTelemetryService.getMemoryPressure();
  const normalized = { ...options };
  const maxTemp = pressure.high ? 0.12 : 0.20;
  const maxTopP = pressure.high ? 0.78 : 0.85;
  let numPredict = resolveNumPredict(routeType, normalized.num_predict);

  if (promptTokens >= LLM_CONFIG.gemma.deferSynthesisTokens || pressure.high) {
    numPredict = Math.min(numPredict, LLM_CONFIG.gemma.numPredict.heavy);
  }

  if (pressure.critical) {
    numPredict = Math.min(numPredict, LLM_CONFIG.gemma.numPredict.light);
  }

  const stableOptions = {
    ...normalized,
    temperature: clampNumber(
      normalized.temperature ?? LLM_CONFIG.gemma.defaults.temperature,
      0,
      maxTemp
    ),
    top_p: clampNumber(
      normalized.top_p ?? LLM_CONFIG.gemma.defaults.topP,
      0.05,
      maxTopP
    ),
    repeat_penalty: clampNumber(
      normalized.repeat_penalty ?? LLM_CONFIG.gemma.defaults.repeatPenalty,
      1,
      2
    ),
    num_predict: Math.max(1, Math.floor(numPredict)),
    num_ctx: Math.min(
      Math.max(
        Number(normalized.num_ctx) || LLM_CONFIG.gemma.numCtx,
        LLM_CONFIG.gemma.minNumCtx
      ),
      LLM_CONFIG.gemma.numCtx
    ),
  };

  if (LLM_CONFIG.gemma.numThread > 0 && stableOptions.num_thread == null) {
    stableOptions.num_thread = LLM_CONFIG.gemma.numThread;
  }

  if (LLM_CONFIG.gemma.numBatch > 0 && stableOptions.num_batch == null) {
    stableOptions.num_batch = LLM_CONFIG.gemma.numBatch;
  }

  return stableOptions;
}

function enforcePromptBudget(prompt, options = {}) {
  const pressure = gemmaTelemetryService.getMemoryPressure();
  const reserveTokens =
    Number(options.num_predict || 0) + LLM_CONFIG.gemma.contextHeadroomTokens;
  const contextCeiling = pressure.high
    ? Math.min(
        LLM_CONFIG.gemma.maxContextTokens,
        LLM_CONFIG.gemma.highPressureContextTokens
      )
    : LLM_CONFIG.gemma.maxContextTokens;
  const maxPromptTokens = Math.max(256, contextCeiling - reserveTokens);
  const promptTokens = estimateTokens(prompt);

  if (promptTokens <= maxPromptTokens) {
    return {
      prompt,
      promptTokens,
      maxPromptTokens,
      truncated: false,
      pressure,
    };
  }

  const targetChars = maxPromptTokens * 4;
  const marker = "\n\n[Gemma prompt hard-truncated to protect local context budget]\n\n";
  const headChars = Math.max(1200, Math.floor(targetChars * 0.62));
  const tailChars = Math.max(800, targetChars - headChars - marker.length);
  const truncatedPrompt =
    prompt.slice(0, headChars).trimEnd() +
    marker +
    prompt.slice(Math.max(0, prompt.length - tailChars)).trimStart();

  return {
    prompt: truncatedPrompt,
    promptTokens: estimateTokens(truncatedPrompt),
    originalPromptTokens: promptTokens,
    maxPromptTokens,
    truncated: true,
    pressure,
  };
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
    const promptTokens =
      Number.isFinite(Number(data?.prompt_eval_count))
        ? Number(data.prompt_eval_count)
        : estimateTokens(prompt);
    const outputTokens =
      Number.isFinite(Number(data?.eval_count))
        ? Number(data.eval_count)
        : estimateTokens(answer);

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
      prompt_tokens: promptTokens,
      output_tokens: outputTokens,
      num_predict: options.num_predict,
    });

    return { answer, durationMs, promptTokens, outputTokens };
  } catch (error) {
    const durationMs = Date.now() - start;
    const classification = classifyOllamaError(error);
    gemmaTelemetryService.recordFailure({ classification, error });

    log(error.name === "AbortError" ? "WARN" : "WARN", "request_failure", {
      requestId,
      model,
      role,
      duration_ms: durationMs,
      timeout_ms: timeoutMs,
      retryable: isRetryableError(error),
      error_type: classification.type,
      circuit_eligible: classification.circuitEligible,
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
  routeType = "GENERAL",
  recordFailure = true,
  trafficType = "user",
}) {
  const startedAt = Date.now();
  let lastError = null;
  let lastClassification = null;
  let attemptsMade = 0;

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
      route_type: routeType,
      traffic_type: trafficType,
      attempt,
      retry_limit: retryLimit,
      timeout_ms: attemptTimeoutMs,
      remaining_budget_ms: remainingMs,
      breaker_state: modelFailoverManager.getStatus().breaker_state,
    });

    try {
      attemptsMade = attempt + 1;
      const result = await gemmaRequestLimiter.run(async ({ waitMs, queueDepthAtAcquire }) => {
        const remainingAfterQueueMs = deadlineAt - Date.now();
        if (remainingAfterQueueMs < LLM_CONFIG.timeouts.minRemainingMs) {
          const error = new Error("LLM request deadline exhausted while waiting for Gemma queue");
          error.code = "GEMMA_QUEUE_TIMEOUT";
          error.retryable = true;
          error.overload = true;
          error.circuitEligible = false;
          throw error;
        }

        if (waitMs > 0) {
          log("INFO", "gemma_queue_wait_complete", {
            requestId,
            model,
            role,
            route_type: routeType,
            wait_ms: waitMs,
            queue_depth_at_acquire: queueDepthAtAcquire,
          });
        }

        return executeOllamaRequest({
          prompt,
          model,
          requestId,
          timeoutMs: Math.min(attemptTimeoutMs, remainingAfterQueueMs),
          options,
          role,
        });
      }, { requestId, model, role, routeType, trafficType });

      gemmaTelemetryService.recordSuccess({
        latencyMs: Date.now() - startedAt,
        outputTokens: result.outputTokens,
      });

      const latencyMs = Date.now() - startedAt;
      modelFailoverManager.recordModelSuccess({ model, role, latencyMs });

      return {
        answer: result.answer,
        attempts: attempt + 1,
        latencyMs,
        model,
        role,
        routeType,
        promptTokens: result.promptTokens,
        outputTokens: result.outputTokens,
      };
    } catch (error) {
      lastError = error;
      lastClassification = classifyOllamaError(error);

      if (!isRetryableError(error) || attempt >= retryLimit) {
        break;
      }

      const delayMs = retryDelayMs(attempt + 1, lastClassification);

      if (deadlineAt - Date.now() - delayMs < LLM_CONFIG.timeouts.minRemainingMs) {
        break;
      }

      gemmaTelemetryService.recordRetry(lastClassification);

      log("WARN", "retry_scheduled", {
        requestId,
        model,
        role,
        route_type: routeType,
        traffic_type: trafficType,
        error_type: lastClassification.type,
        circuit_eligible: lastClassification.circuitEligible,
        attempt,
        next_attempt: attempt + 1,
        delay_ms: delayMs,
      });

      await sleep(delayMs);
    }
  }

  const latencyMs = Date.now() - startedAt;
  if (!lastClassification) {
    lastClassification = classifyOllamaError(lastError);
  }
  const circuitEligible = lastClassification?.circuitEligible !== false;

  if (recordFailure && circuitEligible) {
    modelFailoverManager.recordModelFailure({
      model,
      role,
      error: lastError,
      latencyMs,
    });
  } else {
    log("WARN", "failure_not_counted_for_circuit", {
      requestId,
      model,
      role,
      route_type: routeType,
      traffic_type: trafficType,
      error_type: lastClassification?.type,
      record_failure: recordFailure,
      circuit_eligible: circuitEligible,
      latency_ms: latencyMs,
    });
  }

  log("ERROR", "generation_failed", {
    requestId,
    model,
    role,
    route_type: routeType,
    traffic_type: trafficType,
    attempts: attemptsMade || retryLimit + 1,
    latency_ms: latencyMs,
    error_message: lastError?.message,
    error_type: lastClassification?.type,
    circuit_eligible: circuitEligible,
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
    gemma_memory_pressure: status.gemma_memory_pressure,
    gemma_queue_depth: status.gemma_queue_depth,
    gemma_context_size: status.gemma_context_size,
    warm_pool_active: status.warm_pool_active,
    avg_generation_latency: status.avg_generation_latency,
    overload_retries: status.overload_retries,
    gemmaTelemetry: status.gemma_telemetry,
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
  routeType = "GENERAL",
  allowBackup = true,
  recordFailure = true,
  trafficType = "user",
} = {}) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("Prompt is required for Ollama generation.");
  }

  const initialOptions = buildStableOptions(options, {
    routeType,
    promptTokens: estimateTokens(prompt),
  });
  const budget = enforcePromptBudget(prompt, initialOptions);
  const stabilizedOptions = buildStableOptions(initialOptions, {
    routeType,
    promptTokens: budget.promptTokens,
  });
  const effectivePrompt = budget.prompt;

  gemmaTelemetryService.recordPromptBudget({
    promptTokens: budget.promptTokens,
    contextTokens: budget.promptTokens,
    numPredict: stabilizedOptions.num_predict,
    truncated: budget.truncated,
  });

  if (budget.truncated) {
    log("WARN", "prompt_budget_hard_truncated", {
      requestId,
      model,
      route_type: routeType,
      traffic_type: trafficType,
      original_prompt_tokens: budget.originalPromptTokens,
      final_prompt_tokens: budget.promptTokens,
      max_prompt_tokens: budget.maxPromptTokens,
      memory_pressure: budget.pressure.level,
      num_predict: stabilizedOptions.num_predict,
    });
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
      routeType,
      prompt_tokens: budget.promptTokens,
      prompt_truncated: budget.truncated,
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
      prompt: effectivePrompt,
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
      options: stabilizedOptions,
      routeType,
      recordFailure,
      trafficType,
    });

    rememberGenerationMetadata(requestId, {
      success: true,
      failover_used: initialRoute.role === "backup",
      primary_cold_start_attempt: primaryColdStartAttempt,
      prompt_truncated: budget.truncated,
      original_prompt_tokens: budget.originalPromptTokens,
      max_prompt_tokens: budget.maxPromptTokens,
      options: stabilizedOptions,
      ...initialResult,
      ...modelFailoverManager.getStatus(),
    });

    return initialResult.answer;
  } catch (primaryError) {
    const primaryClassification = classifyOllamaError(primaryError);

    if (
      !allowBackup ||
      primaryClassification.circuitEligible === false ||
      !modelFailoverManager.canFallbackToBackup(initialRoute.role)
    ) {
      if (initialRoute.role === "primary") {
        log("WARN", "primary_failure_below_failover_threshold", {
          requestId,
          primary_model: LLM_CONFIG.primaryModel,
          backup_model: LLM_CONFIG.backupModel,
          error_message: primaryError?.message,
          error_type: primaryClassification.type,
          allow_backup: allowBackup,
          circuit_eligible: primaryClassification.circuitEligible,
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
        error_type: primaryClassification.type,
        prompt_truncated: budget.truncated,
        prompt_tokens: budget.promptTokens,
        ...modelFailoverManager.getStatus(),
      });

      throw primaryError;
    }

    modelFailoverManager.activateBackup("primary_generation_failed");

    try {
      const backupResult = await generateWithRetries({
        prompt: effectivePrompt,
        model: LLM_CONFIG.backupModel,
        role: "backup",
        requestId,
        retryLimit: LLM_CONFIG.retries.backupLimit,
        timeoutMs: LLM_CONFIG.timeouts.backupMs,
        deadlineAt,
        options: stabilizedOptions,
        routeType,
        recordFailure,
        trafficType,
      });

      rememberGenerationMetadata(requestId, {
        success: true,
        failover_used: true,
        primary_cold_start_attempt: primaryColdStartAttempt,
        primary_error: primaryError?.message,
        primary_error_type: primaryClassification.type,
        prompt_truncated: budget.truncated,
        original_prompt_tokens: budget.originalPromptTokens,
        max_prompt_tokens: budget.maxPromptTokens,
        options: stabilizedOptions,
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
        prompt_truncated: budget.truncated,
        prompt_tokens: budget.promptTokens,
        ...modelFailoverManager.getStatus(),
      });

      throw backupError;
    }
  }
}

export async function callOllama(
  prompt,
  model = LLM_CONFIG.primaryModel,
  requestId = "none",
  generationOptions = {}
) {
  return generateStableResponse({
    prompt,
    model,
    requestId,
    ...generationOptions,
  });
}

gemmaTelemetryService.start();
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
  gemma_max_context_tokens: LLM_CONFIG.gemma.maxContextTokens,
  gemma_max_active_requests: LLM_CONFIG.gemma.maxActiveRequests,
  gemma_queue_max_depth: LLM_CONFIG.gemma.maxQueueDepth,
  warm_pool_enabled: LLM_CONFIG.warmPool.enabled,
});
