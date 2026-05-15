function integerFromEnv(name, fallback, { min = 0 } = {}) {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(parsed, min);
}

function stringFromEnv(name, fallback) {
  const raw = process.env[name];
  return typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
}

function booleanFromEnv(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== "string") return fallback;

  if (/^(1|true|yes|on)$/i.test(raw)) return true;
  if (/^(0|false|no|off)$/i.test(raw)) return false;

  return fallback;
}

const ollamaBaseUrl = stringFromEnv(
  "OLLAMA_BASE_URL",
  "http://localhost:11434"
).replace(/\/$/, "");

const primaryModel = stringFromEnv(
  "PRIMARY_MODEL",
  stringFromEnv("OLLAMA_MODEL", "gemma4:e2b")
);

export const LLM_CONFIG = Object.freeze({
  ollamaBaseUrl,
  generateUrl: `${ollamaBaseUrl}/api/generate`,
  tagsUrl: `${ollamaBaseUrl}/api/tags`,

  primaryModel,
  backupModel: stringFromEnv(
    "BACKUP_MODEL",
    stringFromEnv("OLLAMA_BACKUP_MODEL", "tinyllama:latest")
  ),

  keepAlive: stringFromEnv("OLLAMA_KEEP_ALIVE", "10m"),

  timeouts: Object.freeze({
    primaryMs: integerFromEnv(
      "PRIMARY_TIMEOUT_MS",
      integerFromEnv("OLLAMA_TIMEOUT_MS", 12000, { min: 1000 }),
      { min: 1000 }
    ),
    backupMs: integerFromEnv("BACKUP_TIMEOUT_MS", 10000, { min: 1000 }),
    primaryColdStartMs: integerFromEnv(
      "PRIMARY_COLD_START_TIMEOUT_MS",
      30000,
      { min: 3000 }
    ),
    generationDeadlineMs: integerFromEnv(
      "LLM_REQUEST_DEADLINE_MS",
      22000,
      { min: 3000 }
    ),
    healthMs: integerFromEnv("HEALTHCHECK_TIMEOUT_MS", 3000, { min: 500 }),
    preloadMs: integerFromEnv("MODEL_PRELOAD_TIMEOUT_MS", 15000, { min: 1000 }),
    minRemainingMs: integerFromEnv("LLM_MIN_REMAINING_MS", 1500, { min: 250 }),
  }),

  readiness: Object.freeze({
    startupWaitEnabled: booleanFromEnv("OLLAMA_STARTUP_WAIT_ENABLED", true),
    startupWaitTimeoutMs: integerFromEnv(
      "OLLAMA_STARTUP_WAIT_TIMEOUT_MS",
      60000,
      { min: 1000 }
    ),
    startupWaitIntervalMs: integerFromEnv(
      "OLLAMA_STARTUP_WAIT_INTERVAL_MS",
      2000,
      { min: 250 }
    ),
  }),

  retries: Object.freeze({
    primaryLimit: integerFromEnv("PRIMARY_RETRY_LIMIT", 2, { min: 0 }),
    backupLimit: integerFromEnv("BACKUP_RETRY_LIMIT", 1, { min: 0 }),
    baseDelayMs: integerFromEnv("OLLAMA_RETRY_BASE_DELAY_MS", 300, { min: 0 }),
    maxDelayMs: integerFromEnv("OLLAMA_RETRY_MAX_DELAY_MS", 1200, { min: 0 }),
  }),

  failover: Object.freeze({
    primaryMaxFailures: integerFromEnv("PRIMARY_MAX_FAILURES", 3, { min: 1 }),
    backupMaxFailures: integerFromEnv("BACKUP_MAX_FAILURES", 1, { min: 1 }),
    breakerThreshold: integerFromEnv("BREAKER_THRESHOLD", 5, { min: 1 }),
    halfOpenIntervalMs: integerFromEnv(
      "HALF_OPEN_INTERVAL_MS",
      30000,
      { min: 1000 }
    ),
    recoverySuccessThreshold: integerFromEnv(
      "PRIMARY_RECOVERY_SUCCESSES",
      2,
      { min: 1 }
    ),
    healthProbeIntervalMs: integerFromEnv(
      "HEALTH_PROBE_INTERVAL_MS",
      30000,
      { min: 5000 }
    ),
    startupPreloadEnabled: booleanFromEnv("STARTUP_PRELOAD_ENABLED", true),
    periodicHealthEnabled: booleanFromEnv("PERIODIC_HEALTH_ENABLED", true),
  }),
});

export default LLM_CONFIG;
