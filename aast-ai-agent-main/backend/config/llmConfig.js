import dotenv from "dotenv";

dotenv.config();

function integerFromEnv(name, fallback, { min = 0 } = {}) {
  const raw = process.env[name];
  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(parsed, min);
}

function numberFromEnv(
  name,
  fallback,
  { min = 0, max = Number.POSITIVE_INFINITY } = {}
) {
  const raw = process.env[name];
  const parsed = Number.parseFloat(raw);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
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
  "http://192.168.1.7:11434"
).replace(/\/$/, "");

const primaryModel = stringFromEnv(
  "PRIMARY_MODEL",
  stringFromEnv("OLLAMA_MODEL", "gemma4:e2b")
);

const LLM_CONFIG = Object.freeze({
  ollamaBaseUrl,
  generateUrl: `${ollamaBaseUrl}/api/generate`,
  tagsUrl: `${ollamaBaseUrl}/api/tags`,

  primaryModel,
  backupModel: stringFromEnv(
    "BACKUP_MODEL",
    stringFromEnv("OLLAMA_BACKUP_MODEL", "tinyllama:latest")
  ),

  keepAlive: stringFromEnv("OLLAMA_KEEP_ALIVE", "10m"),

  gemma: Object.freeze({
    maxContextTokens: integerFromEnv("GEMMA_MAX_CONTEXT_TOKENS", 2600, {
      min: 1024,
    }),
    contextHeadroomTokens: integerFromEnv("GEMMA_CONTEXT_HEADROOM_TOKENS", 192, {
      min: 32,
    }),
    highPressureContextTokens: integerFromEnv(
      "GEMMA_HIGH_PRESSURE_CONTEXT_TOKENS",
      2200,
      { min: 1024 }
    ),
    deferSynthesisTokens: integerFromEnv("GEMMA_DEFER_SYNTHESIS_TOKENS", 2400, {
      min: 1024,
    }),
    numCtx: integerFromEnv("GEMMA_NUM_CTX", 3072, { min: 1024 }),
    minNumCtx: integerFromEnv("GEMMA_MIN_NUM_CTX", 512, { min: 256 }),
    numThread: integerFromEnv("GEMMA_NUM_THREAD", 0, { min: 0 }),
    numBatch: integerFromEnv("GEMMA_NUM_BATCH", 0, { min: 0 }),
    maxActiveRequests: integerFromEnv("GEMMA_MAX_ACTIVE_REQUESTS", 1, {
      min: 1,
    }),
    maxQueueDepth: integerFromEnv("GEMMA_QUEUE_MAX_DEPTH", 2, { min: 0 }),
    queueTimeoutMs: integerFromEnv("GEMMA_QUEUE_TIMEOUT_MS", 8000, {
      min: 1000,
    }),
    pressureHighRssMb: integerFromEnv("GEMMA_MEMORY_HIGH_RSS_MB", 6144, {
      min: 256,
    }),
    pressureCriticalRssMb: integerFromEnv("GEMMA_MEMORY_CRITICAL_RSS_MB", 8192, {
      min: 512,
    }),
    ollamaMemoryPollMs: integerFromEnv("GEMMA_OLLAMA_MEMORY_POLL_MS", 30000, {
      min: 5000,
    }),
    defaults: Object.freeze({
      temperature: numberFromEnv("GEMMA_TEMPERATURE", 0.15, {
        min: 0,
        max: 1,
      }),
      topP: numberFromEnv("GEMMA_TOP_P", 0.8, {
        min: 0.05,
        max: 1,
      }),
      repeatPenalty: numberFromEnv("GEMMA_REPEAT_PENALTY", 1.16, {
        min: 1,
        max: 2,
      }),
    }),
    numPredict: Object.freeze({
      light: integerFromEnv("GEMMA_NUM_PREDICT_LIGHT", 128, { min: 16 }),
      intent: integerFromEnv("GEMMA_NUM_PREDICT_INTENT", 96, { min: 16 }),
      synthesis: integerFromEnv("GEMMA_NUM_PREDICT_SYNTHESIS", 220, {
        min: 64,
      }),
      heavy: integerFromEnv("GEMMA_NUM_PREDICT_HEAVY", 160, { min: 64 }),
      fallback: integerFromEnv("GEMMA_NUM_PREDICT_FALLBACK", 160, {
        min: 64,
      }),
      max: integerFromEnv("GEMMA_NUM_PREDICT_MAX", 256, { min: 64 }),
    }),
  }),

  warmPool: Object.freeze({
    enabled: booleanFromEnv("GEMMA_WARM_POOL_ENABLED", false),
    intervalMs: integerFromEnv("GEMMA_WARM_POOL_INTERVAL_MS", 420000, {
      min: 30000,
    }),
    timeoutMs: integerFromEnv("GEMMA_WARM_POOL_TIMEOUT_MS", 8000, {
      min: 1000,
    }),
    initialDelayMs: integerFromEnv("GEMMA_WARM_POOL_INITIAL_DELAY_MS", 45000, {
      min: 1000,
    }),
    jitterMs: integerFromEnv("GEMMA_WARM_POOL_JITTER_MS", 30000, {
      min: 0,
    }),
    skipWhenQueueBusy: booleanFromEnv("GEMMA_WARM_POOL_SKIP_QUEUE_BUSY", true),
    skipWhenMemoryHigh: booleanFromEnv("GEMMA_WARM_POOL_SKIP_MEMORY_HIGH", true),
    prompt: stringFromEnv("GEMMA_WARM_POOL_PROMPT", "."),
  }),

  timeouts: Object.freeze({
    primaryMs: integerFromEnv(
      "PRIMARY_TIMEOUT_MS",
      integerFromEnv("OLLAMA_TIMEOUT_MS", 20000, { min: 1000 }),
      { min: 1000 }
    ),
    synthesisMs: integerFromEnv(
      "SYNTHESIS_TIMEOUT_MS",
      integerFromEnv(
        "OLLAMA_SYNTHESIS_TIMEOUT_MS",
        integerFromEnv(
          "PRIMARY_TIMEOUT_MS",
          integerFromEnv("OLLAMA_TIMEOUT_MS", 20000, { min: 1000 }),
          { min: 1000 }
        ),
        { min: 1000 }
      ),
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
      20000,
      { min: 3000 }
    ),
    synthesisDeadlineMs: integerFromEnv(
      "SYNTHESIS_DEADLINE_MS",
      integerFromEnv(
        "LLM_SYNTHESIS_DEADLINE_MS",
        integerFromEnv("LLM_REQUEST_DEADLINE_MS", 20000, { min: 3000 }),
        { min: 3000 }
      ),
      { min: 3000 }
    ),
    healthMs: integerFromEnv("HEALTHCHECK_TIMEOUT_MS", 3000, { min: 500 }),
    preloadMs: integerFromEnv("MODEL_PRELOAD_TIMEOUT_MS", 15000, { min: 1000 }),
    preloadStaggerMs: integerFromEnv("MODEL_PRELOAD_STAGGER_MS", 5000, {
      min: 0,
    }),
    warmProbeMs: integerFromEnv("MODEL_WARM_PROBE_TIMEOUT_MS", 8000, {
      min: 1000,
    }),
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
    primaryLimit: integerFromEnv("PRIMARY_RETRY_LIMIT", 0, { min: 0 }),
    backupLimit: integerFromEnv("BACKUP_RETRY_LIMIT", 1, { min: 0 }),
    baseDelayMs: integerFromEnv("OLLAMA_RETRY_BASE_DELAY_MS", 300, { min: 0 }),
    maxDelayMs: integerFromEnv("OLLAMA_RETRY_MAX_DELAY_MS", 1200, { min: 0 }),
    overloadDelayMs: integerFromEnv("OLLAMA_OVERLOAD_RETRY_DELAY_MS", 250, {
      min: 0,
    }),
    recoveryDelayMs: integerFromEnv("OLLAMA_RECOVERY_RETRY_DELAY_MS", 1200, {
      min: 0,
    }),
    recoveryMaxDelayMs: integerFromEnv("OLLAMA_RECOVERY_RETRY_MAX_DELAY_MS", 5000, {
      min: 0,
    }),
  }),

  failover: Object.freeze({
    primaryMaxFailures: integerFromEnv("PRIMARY_MAX_FAILURES", 3, { min: 1 }),
    backupMaxFailures: integerFromEnv("BACKUP_MAX_FAILURES", 1, { min: 1 }),
    breakerThreshold: integerFromEnv("BREAKER_THRESHOLD", 5, { min: 1 }),
    halfOpenIntervalMs: integerFromEnv("HALF_OPEN_INTERVAL_MS", 30000, {
      min: 1000,
    }),
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

export { LLM_CONFIG };
export default LLM_CONFIG;
