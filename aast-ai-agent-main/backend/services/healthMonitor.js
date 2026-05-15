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
    service: "HealthMonitor",
    event,
    timestamp: nowIso(),
    ...payload,
  }));
}

function modelBaseName(model) {
  return String(model || "").split(":")[0];
}

function matchesModelName(candidate, requestedModel) {
  if (!candidate || !requestedModel) return false;

  const candidateText = String(candidate);
  const requestedText = String(requestedModel);
  const candidateBase = modelBaseName(candidateText);
  const requestedBase = modelBaseName(requestedText);

  return (
    candidateText === requestedText ||
    candidateText === `${requestedText}:latest` ||
    candidateText.startsWith(`${requestedText}:`) ||
    (candidateBase === requestedText && !requestedText.includes(":")) ||
    (candidateBase === requestedBase &&
      (requestedText.endsWith(":latest") || candidateText.endsWith(":latest")))
  );
}

function buildPullCommand(model) {
  return `ollama pull ${model}`;
}

export class HealthMonitor {
  constructor(config = LLM_CONFIG, logger = defaultLogger) {
    this.config = config;
    this.logger = logger;
    this.serverHealthy = false;
    this.lastTagsAt = 0;
    this.lastTagsLatencyMs = null;
    this.availableModels = [];
    this.models = new Map();
    this.startupValidation = {
      checked: false,
      readiness: "UNKNOWN",
      startup_readiness_phase: "UNKNOWN",
      ollama_ready: false,
      ollama_wait_attempts: 0,
      ollama_wait_duration_ms: 0,
      primary_model: config.primaryModel,
      backup_model: config.backupModel,
      primary_installed: false,
      backup_installed: false,
      missing_models: [],
      warnings: [],
      recommended_commands: [
        buildPullCommand(config.primaryModel),
        buildPullCommand(config.backupModel),
      ],
      validated_at: null,
    };
    this.startupPreloadStatus = {
      attempted: false,
      completed: false,
      preload_warning: false,
      primary_cold_start_pending: false,
      primary: null,
      backup: null,
      models: [],
      updated_at: null,
    };
  }

  setStartupReadiness(readinessStatus = {}) {
    this.startupValidation = {
      ...this.startupValidation,
      startup_readiness_phase:
        readinessStatus.startup_readiness_phase ||
        this.startupValidation.startup_readiness_phase,
      ollama_ready:
        typeof readinessStatus.ollama_ready === "boolean"
          ? readinessStatus.ollama_ready
          : this.startupValidation.ollama_ready,
      ollama_wait_attempts:
        readinessStatus.ollama_wait_attempts ??
        this.startupValidation.ollama_wait_attempts,
      ollama_wait_duration_ms:
        readinessStatus.ollama_wait_duration_ms ??
        this.startupValidation.ollama_wait_duration_ms,
    };
  }

  getModelRecord(model) {
    if (!this.models.has(model)) {
      this.models.set(model, {
        model,
        healthy: false,
        available: false,
        consecutive_failures: 0,
        consecutive_successes: 0,
        last_success_at: null,
        last_failure_at: null,
        last_probe_at: null,
        last_latency_ms: null,
        last_error: null,
      });
    }

    return this.models.get(model);
  }

  recordModelSuccess(model, { latencyMs = null, probe = false } = {}) {
    const record = this.getModelRecord(model);
    record.healthy = true;
    record.consecutive_failures = 0;
    record.consecutive_successes += 1;
    record.last_success_at = nowIso();
    record.last_latency_ms = latencyMs;
    record.last_error = null;
    if (probe) record.last_probe_at = record.last_success_at;
  }

  recordModelFailure(model, error, { latencyMs = null, probe = false } = {}) {
    const record = this.getModelRecord(model);
    record.healthy = false;
    record.consecutive_failures += 1;
    record.consecutive_successes = 0;
    record.last_failure_at = nowIso();
    record.last_latency_ms = latencyMs;
    record.last_error = error?.message || String(error);
    if (probe) record.last_probe_at = record.last_failure_at;
  }

  recordModelPreloadWarning(model, error, { latencyMs = null } = {}) {
    const record = this.getModelRecord(model);
    record.last_probe_at = nowIso();
    record.last_latency_ms = latencyMs;
    record.last_error = error?.message || String(error);
  }

  clearPrimaryColdStart() {
    const backupWarning = this.startupPreloadStatus.backup?.ok === false;
    this.startupPreloadStatus = {
      ...this.startupPreloadStatus,
      primary_cold_start_pending: false,
      preload_warning: backupWarning,
      updated_at: nowIso(),
    };
  }

  async checkTags({ timeoutMs = this.config.timeouts.healthMs } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
      const response = await fetch(this.config.tagsUrl, {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Ollama tags returned HTTP ${response.status}`);
      }

      const data = await response.json();
      const models = Array.isArray(data.models)
        ? data.models.map((model) => model.name).filter(Boolean)
        : [];

      this.serverHealthy = true;
      this.lastTagsAt = Date.now();
      this.lastTagsLatencyMs = Date.now() - start;
      this.availableModels = models;

      for (const model of [this.config.primaryModel, this.config.backupModel]) {
        const record = this.getModelRecord(model);
        record.available = models.some((candidate) => matchesModelName(candidate, model));
      }

      this.logger("INFO", "tags_health_success", {
        latency_ms: this.lastTagsLatencyMs,
        available_models: models.length,
        primary_available: this.getModelRecord(this.config.primaryModel).available,
        backup_available: this.getModelRecord(this.config.backupModel).available,
      });

      return this.getStatus();
    } catch (error) {
      this.serverHealthy = false;
      this.lastTagsAt = Date.now();
      this.lastTagsLatencyMs = Date.now() - start;

      this.logger("WARN", "tags_health_failed", {
        latency_ms: this.lastTagsLatencyMs,
        error_message: error.name === "AbortError" ? "timeout" : error.message,
      });

      return this.getStatus();
    } finally {
      clearTimeout(timer);
    }
  }

  async validateModelInstallations({ reason = "startup_model_validation" } = {}) {
    const status = await this.checkTags();
    const primary = this.getModelRecord(this.config.primaryModel);
    const backup = this.getModelRecord(this.config.backupModel);
    const missingModels = [];
    const warnings = [];

    if (!status.server_healthy) {
      this.startupValidation = {
        ...this.startupValidation,
        checked: true,
        readiness: "CRITICAL_OLLAMA_UNAVAILABLE",
        reason,
        primary_model: this.config.primaryModel,
        backup_model: this.config.backupModel,
        primary_installed: false,
        backup_installed: false,
        missing_models: [],
        warnings: [
          `Ollama API unavailable at ${this.config.ollamaBaseUrl}. Start Ollama and verify /api/tags.`,
        ],
        recommended_commands: ["ollama serve"],
        available_models: [],
        ollama_ready: false,
        validated_at: nowIso(),
      };

      this.logger("ERROR", "startup_model_validation_complete", this.startupValidation);
      return this.startupValidation;
    }

    if (!primary.available) {
      missingModels.push(this.config.primaryModel);
      warnings.push(
        `Primary model missing: ${this.config.primaryModel}. Run: ${buildPullCommand(this.config.primaryModel)}`
      );
    }

    if (!backup.available) {
      missingModels.push(this.config.backupModel);
      warnings.push(
        `Backup model missing: ${this.config.backupModel}. Run: ${buildPullCommand(this.config.backupModel)}`
      );
    }

    let readiness = "HEALTHY";
    if (!primary.available && !backup.available) {
      readiness = "CRITICAL";
    } else if (!primary.available) {
      readiness = "PRIMARY_MISSING_DEGRADED";
    } else if (!backup.available) {
      readiness = "BACKUP_MISSING_DEGRADED";
    }

    this.startupValidation = {
      checked: true,
      readiness,
      reason,
      startup_readiness_phase: this.startupValidation.startup_readiness_phase,
      ollama_ready: this.serverHealthy,
      ollama_wait_attempts: this.startupValidation.ollama_wait_attempts,
      ollama_wait_duration_ms: this.startupValidation.ollama_wait_duration_ms,
      primary_model: this.config.primaryModel,
      backup_model: this.config.backupModel,
      primary_installed: primary.available,
      backup_installed: backup.available,
      missing_models: missingModels,
      warnings,
      recommended_commands: missingModels.map(buildPullCommand),
      available_models: status.available_models,
      validated_at: nowIso(),
    };

    const level = readiness === "HEALTHY"
      ? "INFO"
      : readiness === "BACKUP_MISSING_DEGRADED"
        ? "WARN"
        : "ERROR";

    this.logger(level, "startup_model_validation_complete", this.startupValidation);
    return this.startupValidation;
  }

  async probeModel(
    model,
    {
      timeoutMs = this.config.timeouts.healthMs,
      reason = "health_probe",
      prompt = "ping",
      recordFailure = true,
    } = {}
  ) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
      const response = await fetch(this.config.generateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          keep_alive: this.config.keepAlive,
          options: {
            temperature: 0,
            top_p: 0.1,
            num_predict: 1,
          },
        }),
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        throw new Error(`Ollama probe returned HTTP ${response.status}`);
      }

      this.serverHealthy = true;
      this.recordModelSuccess(model, { latencyMs, probe: true });

      this.logger("INFO", "model_probe_success", {
        model,
        reason,
        latency_ms: latencyMs,
      });

      return { ok: true, model, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - start;
      if (recordFailure) {
        this.recordModelFailure(model, error, { latencyMs, probe: true });
      } else {
        this.recordModelPreloadWarning(model, error, { latencyMs });
      }

      this.logger("WARN", "model_probe_failed", {
        model,
        reason,
        latency_ms: latencyMs,
        error_message: error.name === "AbortError" ? "timeout" : error.message,
      });

      return {
        ok: false,
        model,
        latencyMs,
        error: error.name === "AbortError" ? "timeout" : error.message,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async preloadModels(
    models = [this.config.primaryModel, this.config.backupModel],
    {
      prompt = "hi",
      timeoutMs = this.config.timeouts.preloadMs,
      recordFailure = false,
    } = {}
  ) {
    const uniqueModels = [...new Set(models.filter(Boolean))];
    this.startupPreloadStatus = {
      ...this.startupPreloadStatus,
      attempted: true,
      completed: false,
      models: uniqueModels.map((model) => ({ model, ok: null })),
      updated_at: nowIso(),
    };

    const results = await Promise.allSettled(
      uniqueModels.map((model) =>
        this.probeModel(model, {
          timeoutMs,
          reason: "startup_preload",
          prompt,
          recordFailure,
        })
      )
    );

    const summary = results.map((result, index) => ({
      model: uniqueModels[index],
      ok: result.status === "fulfilled" && result.value?.ok === true,
      error:
        result.status === "rejected"
          ? result.reason?.message || String(result.reason)
          : result.value?.error,
    }));

    const primaryResult = summary.find((item) => item.model === this.config.primaryModel);
    const backupResult = summary.find((item) => item.model === this.config.backupModel);
    const primaryInstalled = this.startupValidation.primary_installed === true;
    const primaryPreloadFailed = primaryInstalled && primaryResult && primaryResult.ok !== true;
    const backupPreloadFailed = backupResult && backupResult.ok !== true;

    this.startupPreloadStatus = {
      attempted: true,
      completed: true,
      preload_warning: primaryPreloadFailed || backupPreloadFailed,
      primary_cold_start_pending: primaryPreloadFailed,
      primary: primaryResult || null,
      backup: backupResult || null,
      models: summary,
      updated_at: nowIso(),
    };

    this.logger(
      primaryPreloadFailed ? "WARN" : "INFO",
      "startup_preload_complete",
      {
        models: summary,
        primary_cold_start_pending: this.startupPreloadStatus.primary_cold_start_pending,
        preload_warning: this.startupPreloadStatus.preload_warning,
      }
    );
    return summary;
  }

  getStatus() {
    const primary = this.getModelRecord(this.config.primaryModel);
    const backup = this.getModelRecord(this.config.backupModel);

    return {
      server_healthy: this.serverHealthy,
      last_tags_at: this.lastTagsAt,
      last_tags_latency_ms: this.lastTagsLatencyMs,
      available_models: this.availableModels,
      primary: { ...primary },
      backup: { ...backup },
      startup_validation: { ...this.startupValidation },
      startup_preload_status: { ...this.startupPreloadStatus },
    };
  }
}

export default HealthMonitor;
