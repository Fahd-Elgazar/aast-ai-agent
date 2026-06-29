import { LLM_CONFIG } from "../config/llmConfig.js";
import { CIRCUIT_STATES, CircuitStateManager } from "./circuitStateManager.js";
import { HealthMonitor } from "./healthMonitor.js";
import {
  OllamaReadinessService,
  STARTUP_READINESS_PHASES,
} from "./ollamaReadinessService.js";
import { getGemmaTelemetrySnapshot } from "./gemmaTelemetryService.js";

function emitLog(level, event, payload = {}) {
  if (level === "DEBUG" && process.env.LLM_DEBUG !== "true") {
    return;
  }

  const writer =
    level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;

  writer(JSON.stringify({
    level,
    service: "ModelFailoverManager",
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  }));
}

function normalizeModel(model) {
  return String(model || "").trim();
}

export class ModelFailoverManager {
  constructor(config = LLM_CONFIG) {
    this.config = config;
    this.circuit = new CircuitStateManager(
      {
        ...config.failover,
        initialState: config.readiness.startupWaitEnabled
          ? CIRCUIT_STATES.WAITING_FOR_OLLAMA
          : CIRCUIT_STATES.CLOSED,
      },
      emitLog
    );
    this.healthMonitor = new HealthMonitor(config, emitLog);
    this.readinessService = new OllamaReadinessService(config, emitLog);
    this.started = false;
    this.backgroundLoopsStarted = false;
    this.startupPromise = null;
    this.healthTimer = null;
    this.recoveryTimer = null;
    this.recoveryProbeInFlight = false;
    this.startupValidation = null;
    this.primaryColdStartPending = false;
    this.preloadWarning = false;
  }

  start() {
    if (this.started) return this.startupPromise;
    this.started = true;

    this.startupPromise = this.runStartupSequence()
      .catch((error) => {
        emitLog("WARN", "startup_validation_failed", {
          error_message: error.message,
          ...this.circuit.getSnapshot(),
        });
        return this.getStatus();
      })
      .finally(() => {
        this.startBackgroundHealthLoops();
      });

    emitLog("INFO", "failover_manager_started", this.getStatus());
    return this.startupPromise;
  }

  startBackgroundHealthLoops() {
    if (this.backgroundLoopsStarted || !this.config.failover.periodicHealthEnabled) {
      return;
    }

    this.backgroundLoopsStarted = true;

    this.healthTimer = setInterval(() => {
      this.refreshHealth().catch((error) => {
        emitLog("WARN", "periodic_health_failed", {
          error_message: error.message,
          ...this.circuit.getSnapshot(),
        });
      });
    }, this.config.failover.healthProbeIntervalMs);
    this.healthTimer.unref?.();

    this.recoveryTimer = setInterval(() => {
      this.runPrimaryRecoveryProbe().catch((error) => {
        emitLog("WARN", "recovery_probe_failed_unhandled", {
          error_message: error.message,
          ...this.circuit.getSnapshot(),
        });
      });
    }, this.config.failover.halfOpenIntervalMs);
    this.recoveryTimer.unref?.();
  }

  async waitForStartupCompletion() {
    if (!this.started) {
      this.start();
    }

    return this.startupPromise || this.getStatus();
  }

  async runStartupSequence() {
    if (this.config.readiness.startupWaitEnabled) {
      this.circuit.markWaitingForOllama("startup_readiness_wait_started", {
        tags_url: this.config.tagsUrl,
      });
    }

    const readiness = await this.readinessService.waitForReady();
    this.healthMonitor.setStartupReadiness(readiness);

    if (!readiness.ollama_ready) {
      const validation = await this.validateStartupModels({
        reason: "startup_ollama_readiness_failed",
      });

      if (validation.readiness !== "CRITICAL_OLLAMA_UNAVAILABLE") {
        emitLog("WARN", "readiness_wait_late_success", {
          readiness,
          validation,
          ...this.circuit.getSnapshot(),
        });

        const lateStartupResult = this.config.failover.startupPreloadEnabled
          ? await this.preloadValidatedStartupModels(validation)
          : this.getStatus();

        this.readinessService.setPhase(STARTUP_READINESS_PHASES.READY, {
          ollama_ready: true,
          completed_at: new Date().toISOString(),
        });
        this.healthMonitor.setStartupReadiness(this.readinessService.getStatus());

        return lateStartupResult;
      }

      emitLog("ERROR", "startup_readiness_failed", {
        readiness,
        validation,
        ...this.circuit.getSnapshot(),
      });

      return this.getStatus();
    }

    this.readinessService.setPhase(
      STARTUP_READINESS_PHASES.STARTUP_VALIDATING_MODELS,
      { ollama_ready: true }
    );
    this.healthMonitor.setStartupReadiness(this.readinessService.getStatus());

    const startupResult = this.config.failover.startupPreloadEnabled
      ? await this.validateAndPreloadStartup()
      : await this.validateStartupModels();

    this.readinessService.setPhase(STARTUP_READINESS_PHASES.READY, {
      ollama_ready: true,
      completed_at: new Date().toISOString(),
    });
    this.healthMonitor.setStartupReadiness(this.readinessService.getStatus());

    emitLog("INFO", "startup_readiness_complete", {
      startup_result: startupResult,
      ...this.getStatus(),
    });

    return this.getStatus();
  }

  applyStartupValidation(validation) {
    this.startupValidation = validation;

    if (!validation?.checked) {
      return;
    }

    if (validation.readiness === "CRITICAL_OLLAMA_UNAVAILABLE") {
      this.circuit.transition(
        CIRCUIT_STATES.OPEN,
        "startup_ollama_unavailable",
        {
          primary_model: this.config.primaryModel,
          backup_model: this.config.backupModel,
          recommended_commands: validation.recommended_commands,
        }
      );
      return;
    }

    if (!validation.primary_installed && validation.backup_installed) {
      this.circuit.transition(
        CIRCUIT_STATES.DEGRADED,
        "startup_primary_model_missing",
        {
          primary_model: this.config.primaryModel,
          backup_model: this.config.backupModel,
          recommended_commands: validation.recommended_commands,
        }
      );
      return;
    }

    if (!validation.primary_installed && !validation.backup_installed) {
      this.circuit.transition(
        CIRCUIT_STATES.OPEN,
        "startup_required_models_missing",
        {
          primary_model: this.config.primaryModel,
          backup_model: this.config.backupModel,
          recommended_commands: validation.recommended_commands,
        }
      );
      return;
    }

    if (validation.primary_installed && !validation.backup_installed) {
      this.circuit.markOllamaReady("startup_primary_ready_backup_missing", {
        primary_model: this.config.primaryModel,
        backup_model: this.config.backupModel,
      });
      emitLog("WARN", "startup_backup_model_missing", {
        primary_model: this.config.primaryModel,
        backup_model: this.config.backupModel,
        warning: `Backup model missing. Run: ollama pull ${this.config.backupModel}`,
        currently_using: this.config.primaryModel,
        recommended_commands: validation.recommended_commands,
        ...this.circuit.getSnapshot(),
      });
      return;
    }

    this.circuit.markOllamaReady("startup_models_ready", {
      primary_model: this.config.primaryModel,
      backup_model: this.config.backupModel,
    });

    emitLog("INFO", "startup_models_ready", {
      primary_model: this.config.primaryModel,
      backup_model: this.config.backupModel,
      readiness: validation.readiness,
      ...this.circuit.getSnapshot(),
    });
  }

  applyStartupPreloadSummary(summary = []) {
    const primaryResult = summary.find((item) => item.model === this.config.primaryModel);
    const backupResult = summary.find((item) => item.model === this.config.backupModel);
    const validation = this.startupValidation || this.healthMonitor.getStatus().startup_validation;
    const primaryInstalled = validation?.primary_installed === true;
    const backupInstalled = validation?.backup_installed === true;
    const primaryPreloadFailed = primaryInstalled && primaryResult && primaryResult.ok !== true;

    this.preloadWarning = summary.some((item) => item.ok !== true);
    this.primaryColdStartPending = primaryPreloadFailed;

    if (primaryPreloadFailed && backupInstalled) {
      this.circuit.markPrimaryCold("startup_primary_preload_failed", {
        primary_model: this.config.primaryModel,
        backup_model: this.config.backupModel,
        preload_error: primaryResult.error,
      });
    }

    if (primaryPreloadFailed) {
      emitLog("WARN", "primary_preload_warning_non_fatal", {
        primary_model: this.config.primaryModel,
        backup_model: this.config.backupModel,
        primary_cold_start_pending: true,
        preload_warning: true,
        preload_error: primaryResult.error,
        backup_ready: backupResult?.ok === true || backupInstalled,
        breaker_state: this.circuit.getSnapshot().breaker_state,
        message: "Gemma is installed and remains the true primary; first live request will retry cold start.",
      });
      return;
    }

    if (primaryResult?.ok === true) {
      this.primaryColdStartPending = false;
      this.preloadWarning = backupResult?.ok === false;
    }
  }

  clearPrimaryColdStart(reason = "primary_runtime_success") {
    if (!this.primaryColdStartPending && !this.preloadWarning) {
      return;
    }

    this.healthMonitor.clearPrimaryColdStart();
    this.primaryColdStartPending = false;
    this.preloadWarning =
      this.healthMonitor.getStatus().startup_preload_status?.preload_warning === true;

    emitLog("INFO", "primary_cold_start_cleared", {
      reason,
      primary_model: this.config.primaryModel,
      active_runtime_model: this.config.primaryModel,
      breaker_state: this.circuit.getSnapshot().breaker_state,
    });
  }

  isPrimaryModel(model) {
    const requested = normalizeModel(model);
    return (
      !requested ||
      requested === this.config.primaryModel ||
      requested === `${this.config.primaryModel}:latest`
    );
  }

  getInitialRoute(requestedModel = this.config.primaryModel) {
    const normalizedRequestedModel = normalizeModel(requestedModel) || this.config.primaryModel;
    const primaryRequested = this.isPrimaryModel(normalizedRequestedModel);

    if (primaryRequested && this.circuit.isOpen()) {
      return {
        role: "none",
        model: null,
        reason: "breaker_open",
      };
    }

    if (primaryRequested && this.circuit.isWaitingForOllama()) {
      return {
        role: "none",
        model: null,
        reason: "waiting_for_ollama",
      };
    }

    if (primaryRequested && this.circuit.shouldUseBackup()) {
      return {
        role: "backup",
        model: this.config.backupModel,
        reason: "primary_degraded",
      };
    }

    return {
      role: primaryRequested ? "primary" : "custom",
      model: normalizedRequestedModel,
      reason: "primary_available",
    };
  }

  canFallbackToBackup(failedRole) {
    const health = this.healthMonitor.getStatus();
    const circuit = this.circuit.getSnapshot();
    const runtimeFailureThresholdReached =
      this.circuit.shouldUseBackup() ||
      circuit.primary_failures >= this.config.failover.primaryMaxFailures;

    return (
      failedRole === "primary" &&
      runtimeFailureThresholdReached &&
      normalizeModel(this.config.backupModel) &&
      this.config.backupModel !== this.config.primaryModel &&
      (
        health.startup_validation?.checked !== true ||
        health.backup?.available === true
      )
    );
  }

  recordModelSuccess({ model, role, latencyMs = null }) {
    this.healthMonitor.recordModelSuccess(model, { latencyMs });

    if (role === "primary" || role === "custom") {
      if (this.isPrimaryModel(model)) {
        this.clearPrimaryColdStart("primary_runtime_success");
        this.circuit.recordPrimarySuccess({ probe: false });
      }
      return;
    }

    if (role === "backup") {
      this.circuit.recordBackupSuccess();
    }
  }

  recordModelFailure({ model, role, error, latencyMs = null }) {
    this.healthMonitor.recordModelFailure(model, error, { latencyMs });

    if (role === "primary" || (role === "custom" && this.isPrimaryModel(model))) {
      this.circuit.recordPrimaryFailure({ probe: false });
      return;
    }

    if (role === "backup") {
      this.circuit.recordBackupFailure();
    }
  }

  activateBackup(reason = "primary_request_failed") {
    this.circuit.recordBackupActivation(reason);
    emitLog("WARN", "backup_model_activated", {
      active_model: this.config.backupModel,
      primary_model: this.config.primaryModel,
      backup_model: this.config.backupModel,
      reason,
      ...this.circuit.getSnapshot(),
    });
  }

  recordAllModelsFailed(reason = "primary_and_backup_failed") {
    this.circuit.recordAllModelsFailed(reason);
    emitLog("ERROR", "all_models_failed", {
      reason,
      active_model: null,
      primary_model: this.config.primaryModel,
      backup_model: this.config.backupModel,
      ...this.circuit.getSnapshot(),
    });
  }

  async refreshHealth() {
    const status = await this.healthMonitor.checkTags();

    emitLog("INFO", "llm_health_status", {
      primary_model: this.config.primaryModel,
      backup_model: this.config.backupModel,
      primary_healthy: status.primary.healthy,
      backup_healthy: status.backup.healthy,
      primary_available: status.primary.available,
      backup_available: status.backup.available,
      server_healthy: status.server_healthy,
      ...this.circuit.getSnapshot(),
    });

    return this.getStatus();
  }

  async preloadModels() {
    return this.healthMonitor.preloadModels([
      this.config.primaryModel,
      this.config.backupModel,
    ]);
  }

  async validateStartupModels(options = {}) {
    const validation = await this.healthMonitor.validateModelInstallations(options);
    this.applyStartupValidation(validation);
    return validation;
  }

  async validateAndPreloadStartup() {
    const validation = await this.validateStartupModels();
    return this.preloadValidatedStartupModels(validation);
  }

  async preloadValidatedStartupModels(validation) {
    const modelsToPreload = [
      validation.primary_installed ? this.config.primaryModel : null,
      validation.backup_installed ? this.config.backupModel : null,
    ].filter(Boolean);

    if (modelsToPreload.length === 0) {
      emitLog("ERROR", "startup_preload_skipped_no_models", {
        primary_model: this.config.primaryModel,
        backup_model: this.config.backupModel,
        recommended_commands: validation.recommended_commands,
        ...this.circuit.getSnapshot(),
      });
      return [];
    }

    this.readinessService.setPhase(
      STARTUP_READINESS_PHASES.STARTUP_PRELOADING_MODELS,
      { ollama_ready: true }
    );
    this.healthMonitor.setStartupReadiness(this.readinessService.getStatus());

    const summary = await this.healthMonitor.preloadModels(modelsToPreload);
    this.applyStartupPreloadSummary(summary);
    return summary;
  }

  async preloadModel(model) {
    const result = await this.healthMonitor.probeModel(model, {
      timeoutMs: this.config.timeouts.preloadMs,
      reason: "manual_preload",
    });

    if (result.ok && this.isPrimaryModel(model)) {
      this.circuit.recordPrimarySuccess({ probe: true });
    }

    return result.ok;
  }

  scheduleRecoveryProbeIfDue() {
    if (!this.circuit.shouldProbePrimary()) {
      return;
    }

    this.runPrimaryRecoveryProbe().catch((error) => {
      emitLog("WARN", "background_recovery_probe_failed", {
        error_message: error.message,
        ...this.circuit.getSnapshot(),
      });
    });
  }

  async runPrimaryRecoveryProbe() {
    if (this.recoveryProbeInFlight || !this.circuit.shouldProbePrimary()) {
      return this.getStatus();
    }

    this.recoveryProbeInFlight = true;
    this.circuit.markPrimaryProbeStarted();

    try {
      const result = await this.healthMonitor.probeModel(this.config.primaryModel, {
        timeoutMs: this.config.timeouts.healthMs,
        reason: "primary_recovery_probe",
      });

      if (result.ok) {
        this.circuit.recordPrimarySuccess({ probe: true });
        emitLog("INFO", "recovery_success", {
          model: this.config.primaryModel,
          latency_ms: result.latencyMs,
          ...this.circuit.getSnapshot(),
        });
      } else {
        this.circuit.recordPrimaryFailure({ probe: true });
      }

      return this.getStatus();
    } finally {
      this.recoveryProbeInFlight = false;
    }
  }

  getStatus() {
    const circuit = this.circuit.getSnapshot();
    const health = this.healthMonitor.getStatus();
    const readiness = this.readinessService.getStatus();
    const gemmaTelemetry = getGemmaTelemetrySnapshot();
    const failoverActive =
      circuit.breaker_state === CIRCUIT_STATES.DEGRADED ||
      circuit.breaker_state === CIRCUIT_STATES.HALF_OPEN;
    const primaryCold =
      circuit.breaker_state === CIRCUIT_STATES.PRIMARY_COLD ||
      this.primaryColdStartPending === true ||
      health.startup_preload_status?.primary_cold_start_pending === true;
    const breakerOpen = circuit.breaker_state === CIRCUIT_STATES.OPEN;
    const waitingForOllama = circuit.breaker_state === CIRCUIT_STATES.WAITING_FOR_OLLAMA;
    const activeRuntimeModel = breakerOpen || waitingForOllama
      ? null
      : failoverActive
        ? this.config.backupModel
        : this.config.primaryModel;

    return {
      startup_readiness_phase: readiness.startup_readiness_phase,
      ollama_ready: readiness.ollama_ready,
      ollama_wait_attempts: readiness.ollama_wait_attempts,
      ollama_wait_duration_ms: readiness.ollama_wait_duration_ms,
      ollama_readiness: readiness,
      true_primary_model: this.config.primaryModel,
      primary_model: this.config.primaryModel,
      backup_model: this.config.backupModel,
      active_runtime_model: activeRuntimeModel,
      active_model: activeRuntimeModel,
      failover_active: failoverActive,
      primary_cold_start_pending: primaryCold,
      preload_warning:
        this.preloadWarning === true ||
        health.startup_preload_status?.preload_warning === true,
      startup_preload_status: health.startup_preload_status,
      backup_ready:
        health.backup?.available === true &&
        (
          health.backup?.healthy === true ||
          health.startup_preload_status?.backup?.ok === true ||
          health.startup_validation?.backup_installed === true
        ),
      breaker_state: circuit.breaker_state,
      primary_failures: circuit.primary_failures,
      backup_failures: circuit.backup_failures,
      backup_activations: circuit.backup_activations,
      failover_count: circuit.failover_count,
      recovery_success: circuit.recovery_success,
      server_healthy: health.server_healthy,
      primary_health: health.primary,
      backup_health: health.backup,
      gemma_telemetry: gemmaTelemetry,
      gemma_memory_pressure: gemmaTelemetry.gemma_memory_pressure,
      gemma_queue_depth: gemmaTelemetry.gemma_queue_depth,
      gemma_active_requests: gemmaTelemetry.gemma_active_requests,
      gemma_context_size: gemmaTelemetry.gemma_context_size,
      avg_generation_latency: gemmaTelemetry.avg_generation_latency,
      overload_retries: gemmaTelemetry.overload_retries,
      warm_pool_active: gemmaTelemetry.warm_pool_active,
      available_models: health.available_models,
      startup_validation: health.startup_validation,
      installed_status: {
        primary_installed: health.primary?.available === true,
        backup_installed: health.backup?.available === true,
      },
      missing_model_warnings: health.startup_validation?.warnings || [],
      recommended_commands: health.startup_validation?.recommended_commands || [],
    };
  }
}

export const modelFailoverManager = new ModelFailoverManager();

export default modelFailoverManager;
