import fetch from "node-fetch";
import { LLM_CONFIG } from "../config/llmConfig.js";

function nowIso() {
  return new Date().toISOString();
}

function defaultLogger(level, event, payload = {}) {
  const writer =
    level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;

  writer(JSON.stringify({
    level,
    service: "OllamaReadinessService",
    event,
    timestamp: nowIso(),
    ...payload,
  }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const STARTUP_READINESS_PHASES = Object.freeze({
  WAITING_FOR_OLLAMA: "WAITING_FOR_OLLAMA",
  OLLAMA_READY: "OLLAMA_READY",
  OLLAMA_UNAVAILABLE: "OLLAMA_UNAVAILABLE",
  STARTUP_VALIDATING_MODELS: "STARTUP_VALIDATING_MODELS",
  STARTUP_PRELOADING_MODELS: "STARTUP_PRELOADING_MODELS",
  READY: "READY",
});

export class OllamaReadinessService {
  constructor(config = LLM_CONFIG, logger = defaultLogger) {
    this.config = config;
    this.logger = logger;
    this.status = {
      enabled: config.readiness.startupWaitEnabled,
      startup_readiness_phase: config.readiness.startupWaitEnabled
        ? STARTUP_READINESS_PHASES.WAITING_FOR_OLLAMA
        : STARTUP_READINESS_PHASES.OLLAMA_READY,
      ollama_ready: !config.readiness.startupWaitEnabled,
      ollama_wait_attempts: 0,
      ollama_wait_duration_ms: 0,
      started_at: null,
      completed_at: null,
      last_error: null,
      tags_url: config.tagsUrl,
    };
  }

  getStatus() {
    return { ...this.status };
  }

  setPhase(phase, extra = {}) {
    this.status = {
      ...this.status,
      startup_readiness_phase: phase,
      ...extra,
    };
  }

  async probeTags(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.config.tagsUrl, {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama tags returned HTTP ${response.status}`);
      }

      const data = await response.json();
      return {
        ok: true,
        models: Array.isArray(data.models) ? data.models.length : 0,
      };
    } catch (error) {
      return {
        ok: false,
        error: error.name === "AbortError" ? "timeout" : error.message,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async waitForReady({
    timeoutMs = this.config.readiness.startupWaitTimeoutMs,
    intervalMs = this.config.readiness.startupWaitIntervalMs,
  } = {}) {
    const waitEnabled = this.config.readiness.startupWaitEnabled;
    const startedAt = Date.now();

    this.status = {
      ...this.status,
      enabled: waitEnabled,
      startup_readiness_phase: waitEnabled
        ? STARTUP_READINESS_PHASES.WAITING_FOR_OLLAMA
        : STARTUP_READINESS_PHASES.OLLAMA_READY,
      ollama_ready: !waitEnabled,
      ollama_wait_attempts: 0,
      ollama_wait_duration_ms: 0,
      started_at: nowIso(),
      completed_at: waitEnabled ? null : nowIso(),
      last_error: null,
      tags_url: this.config.tagsUrl,
    };

    if (!waitEnabled) {
      return this.getStatus();
    }

    this.logger("INFO", "readiness_wait_started", {
      tags_url: this.config.tagsUrl,
      timeout_ms: timeoutMs,
      interval_ms: intervalMs,
    });

    const deadlineAt = startedAt + timeoutMs;
    let lastError = null;

    while (Date.now() <= deadlineAt) {
      const attempt = this.status.ollama_wait_attempts + 1;
      const remainingMs = Math.max(0, deadlineAt - Date.now());
      const requestTimeoutMs = Math.min(
        Math.max(this.config.timeouts.healthMs, 500),
        Math.max(remainingMs, 500)
      );
      const result = await this.probeTags(requestTimeoutMs);
      const durationMs = Date.now() - startedAt;

      this.status = {
        ...this.status,
        ollama_wait_attempts: attempt,
        ollama_wait_duration_ms: durationMs,
        last_error: result.ok ? null : result.error,
      };

      if (result.ok) {
        this.status = {
          ...this.status,
          startup_readiness_phase: STARTUP_READINESS_PHASES.OLLAMA_READY,
          ollama_ready: true,
          completed_at: nowIso(),
        };

        this.logger("INFO", "readiness_wait_success", {
          total_wait_time: durationMs,
          retry_count: Math.max(0, attempt - 1),
          ollama_wait_attempts: attempt,
          available_models: result.models,
        });

        return this.getStatus();
      }

      lastError = result.error;

      if (Date.now() >= deadlineAt) {
        break;
      }

      this.logger("WARN", "readiness_wait_retry", {
        retry_count: attempt,
        ollama_wait_attempts: attempt,
        elapsed_ms: durationMs,
        next_retry_ms: intervalMs,
        error_message: result.error,
      });

      await sleep(Math.min(intervalMs, Math.max(0, deadlineAt - Date.now())));
    }

    const totalWaitTime = Date.now() - startedAt;
    this.status = {
      ...this.status,
      startup_readiness_phase: STARTUP_READINESS_PHASES.OLLAMA_UNAVAILABLE,
      ollama_ready: false,
      ollama_wait_duration_ms: totalWaitTime,
      completed_at: nowIso(),
      last_error: lastError || "timeout",
    };

    this.logger("ERROR", "readiness_wait_failed", {
      total_wait_time: totalWaitTime,
      retry_count: this.status.ollama_wait_attempts,
      ollama_wait_attempts: this.status.ollama_wait_attempts,
      error_message: this.status.last_error,
    });

    return this.getStatus();
  }
}

export default OllamaReadinessService;
