export const CIRCUIT_STATES = Object.freeze({
  WAITING_FOR_OLLAMA: "WAITING_FOR_OLLAMA",
  PRIMARY_COLD: "PRIMARY_COLD",
  CLOSED: "CLOSED",
  DEGRADED: "DEGRADED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN",
});

function noop() {}

export class CircuitStateManager {
  constructor(config = {}, logger = noop) {
    this.config = {
      primaryMaxFailures: config.primaryMaxFailures ?? 3,
      backupMaxFailures: config.backupMaxFailures ?? 1,
      breakerThreshold: config.breakerThreshold ?? 5,
      halfOpenIntervalMs: config.halfOpenIntervalMs ?? 30000,
      recoverySuccessThreshold: config.recoverySuccessThreshold ?? 2,
      initialState: config.initialState || CIRCUIT_STATES.CLOSED,
    };

    this.logger = logger;
    this.state = this.config.initialState;
    this.primaryFailures = 0;
    this.backupFailures = 0;
    this.totalFailures = 0;
    this.backupActivations = 0;
    this.failoverCount = 0;
    this.recoverySuccess = 0;
    this.lastTransitionAt = Date.now();
    this.lastPrimaryProbeAt = 0;
    this.lastPrimarySuccessAt = 0;
    this.lastBackupSuccessAt = 0;
    this.lastFailureAt = 0;
    this.openedAt = 0;
  }

  getSnapshot() {
    return {
      breaker_state: this.state,
      primary_failures: this.primaryFailures,
      backup_failures: this.backupFailures,
      total_failures: this.totalFailures,
      backup_activations: this.backupActivations,
      failover_count: this.failoverCount,
      recovery_success: this.recoverySuccess,
      last_transition_at: this.lastTransitionAt,
      last_primary_probe_at: this.lastPrimaryProbeAt,
      last_primary_success_at: this.lastPrimarySuccessAt,
      last_backup_success_at: this.lastBackupSuccessAt,
      last_failure_at: this.lastFailureAt,
      opened_at: this.openedAt,
    };
  }

  isOpen() {
    return this.state === CIRCUIT_STATES.OPEN;
  }

  isWaitingForOllama() {
    return this.state === CIRCUIT_STATES.WAITING_FOR_OLLAMA;
  }

  isPrimaryAvailableForUserTraffic() {
    return (
      this.state === CIRCUIT_STATES.CLOSED ||
      this.state === CIRCUIT_STATES.PRIMARY_COLD
    );
  }

  shouldUseBackup() {
    return (
      this.state === CIRCUIT_STATES.DEGRADED ||
      this.state === CIRCUIT_STATES.HALF_OPEN
    );
  }

  shouldProbePrimary(now = Date.now()) {
    if (
      this.state === CIRCUIT_STATES.WAITING_FOR_OLLAMA ||
      this.state === CIRCUIT_STATES.CLOSED ||
      this.state === CIRCUIT_STATES.PRIMARY_COLD
    ) {
      return false;
    }

    if (
      this.state === CIRCUIT_STATES.OPEN &&
      this.openedAt > 0 &&
      now - this.openedAt < this.config.halfOpenIntervalMs
    ) {
      return false;
    }

    return now - this.lastPrimaryProbeAt >= this.config.halfOpenIntervalMs;
  }

  markPrimaryProbeStarted(reason = "scheduled_recovery_probe") {
    this.lastPrimaryProbeAt = Date.now();

    if (
      this.state !== CIRCUIT_STATES.WAITING_FOR_OLLAMA &&
      this.state !== CIRCUIT_STATES.CLOSED &&
      this.state !== CIRCUIT_STATES.PRIMARY_COLD
    ) {
      this.transition(CIRCUIT_STATES.HALF_OPEN, reason);
    }
  }

  recordPrimarySuccess({ probe = false } = {}) {
    this.primaryFailures = 0;
    this.lastPrimarySuccessAt = Date.now();

    if (!probe) {
      this.totalFailures = 0;
      this.recoverySuccess = 0;
      this.transition(CIRCUIT_STATES.CLOSED, "primary_request_success");
      return;
    }

    this.recoverySuccess += 1;
    this.totalFailures = 0;

    if (this.recoverySuccess >= this.config.recoverySuccessThreshold) {
      this.backupFailures = 0;
      this.recoverySuccess = 0;
      this.transition(CIRCUIT_STATES.CLOSED, "primary_recovery_success");
      return;
    }

    this.transition(CIRCUIT_STATES.HALF_OPEN, "primary_probe_success");
  }

  recordPrimaryFailure({ probe = false } = {}) {
    this.primaryFailures += 1;
    this.totalFailures += 1;
    this.recoverySuccess = 0;
    this.lastFailureAt = Date.now();

    if (probe && this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.transition(CIRCUIT_STATES.DEGRADED, "primary_probe_failed");
      return;
    }

    if (
      this.primaryFailures >= this.config.primaryMaxFailures &&
      (
        this.state === CIRCUIT_STATES.CLOSED ||
        this.state === CIRCUIT_STATES.PRIMARY_COLD
      )
    ) {
      this.transition(CIRCUIT_STATES.DEGRADED, "primary_failure_threshold");
    }
  }

  markPrimaryCold(reason = "startup_primary_preload_failed", extra = {}) {
    if (
      this.state === CIRCUIT_STATES.CLOSED ||
      this.state === CIRCUIT_STATES.WAITING_FOR_OLLAMA
    ) {
      this.transition(CIRCUIT_STATES.PRIMARY_COLD, reason, extra);
    }
  }

  markWaitingForOllama(reason = "startup_waiting_for_ollama", extra = {}) {
    if (this.state !== CIRCUIT_STATES.WAITING_FOR_OLLAMA) {
      this.transition(CIRCUIT_STATES.WAITING_FOR_OLLAMA, reason, extra);
    }
  }

  markOllamaReady(reason = "ollama_ready", extra = {}) {
    if (this.state === CIRCUIT_STATES.WAITING_FOR_OLLAMA) {
      this.transition(CIRCUIT_STATES.CLOSED, reason, extra);
    }
  }

  recordBackupActivation(reason = "primary_unavailable") {
    this.backupActivations += 1;
    this.failoverCount += 1;

    if (
      this.state !== CIRCUIT_STATES.OPEN &&
      (
        (
          this.state !== CIRCUIT_STATES.CLOSED &&
          this.state !== CIRCUIT_STATES.WAITING_FOR_OLLAMA &&
          this.state !== CIRCUIT_STATES.PRIMARY_COLD
        ) ||
        this.primaryFailures >= this.config.primaryMaxFailures
      )
    ) {
      this.transition(CIRCUIT_STATES.DEGRADED, reason);
    }
  }

  recordBackupSuccess() {
    this.backupFailures = 0;
    this.totalFailures = 0;
    this.lastBackupSuccessAt = Date.now();

    if (this.state === CIRCUIT_STATES.OPEN) {
      this.transition(CIRCUIT_STATES.DEGRADED, "backup_recovered");
    }
  }

  recordBackupFailure() {
    this.backupFailures += 1;
    this.totalFailures += 1;
    this.lastFailureAt = Date.now();

    if (
      this.backupFailures >= this.config.backupMaxFailures ||
      this.totalFailures >= this.config.breakerThreshold
    ) {
      this.transition(CIRCUIT_STATES.OPEN, "backup_failure_threshold");
    }
  }

  recordAllModelsFailed(reason = "primary_and_backup_failed") {
    this.lastFailureAt = Date.now();
    this.transition(CIRCUIT_STATES.OPEN, reason);
  }

  transition(nextState, reason, extra = {}) {
    if (!Object.values(CIRCUIT_STATES).includes(nextState)) {
      return;
    }

    const previousState = this.state;

    if (previousState === nextState) {
      this.logger("DEBUG", "breaker_state_unchanged", {
        reason,
        ...this.getSnapshot(),
        ...extra,
      });
      return;
    }

    this.state = nextState;
    this.lastTransitionAt = Date.now();

    if (nextState === CIRCUIT_STATES.OPEN) {
      this.openedAt = this.lastTransitionAt;
    }

    this.logger("WARN", "breaker_state_changed", {
      from: previousState,
      to: nextState,
      reason,
      ...this.getSnapshot(),
      ...extra,
    });
  }
}

export default CircuitStateManager;
