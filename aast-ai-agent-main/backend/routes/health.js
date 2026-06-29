import express from "express";
import fetch from "node-fetch";
import { getSession } from "../db/neo4j.js";
import { getDecisionMemoryStatus } from "../services/decisionService.js";
import { getMetricsSnapshot } from "../services/metrics.js";
import { logger } from "../services/logger.js";
import { getOllamaRuntimeStatus } from "../services/ollamaService.js";
import { getRuntimeModeStatus } from "../config/runtimeMode.js";
import ragService from "../services/ragService.js";

const DEFAULT_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 2500);
const DECISION_API_URL = process.env.DECISION_API_URL || "http://127.0.0.1:8005";

function withTimeout(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout)
  };
}

function getProcessMemory() {
  const memory = process.memoryUsage();
  const toMb = (value) => Math.round((Number(value || 0) / 1024 / 1024) * 10) / 10;

  return {
    pid: process.pid,
    rss_mb: toMb(memory.rss),
    heap_total_mb: toMb(memory.heapTotal),
    heap_used_mb: toMb(memory.heapUsed),
    external_mb: toMb(memory.external),
    node_options: process.env.NODE_OPTIONS || null
  };
}

function counterValue(counters, name) {
  const value = Number(counters?.[name] || 0);
  return Number.isFinite(value) ? value : 0;
}

function rate(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function buildRuntimeMetricsSnapshot() {
  const snapshot = getMetricsSnapshot();
  const counters = snapshot.counters || {};
  const ollama = getOllamaRuntimeStatus();
  const telemetry = ollama?.gemma_telemetry || {};
  const gemmaRequests = counterValue(counters, "gemma_requests_total");
  const gemmaSuccess = counterValue(counters, "gemma_success_total");
  const gemmaFailure = counterValue(counters, "gemma_failure_total");
  const rateDenominator = Math.max(gemmaRequests, gemmaSuccess + gemmaFailure);

  return {
    ...snapshot,
    gemma_requests_total: gemmaRequests,
    gemma_success_total: gemmaSuccess,
    gemma_failure_total: gemmaFailure,
    gemma_timeout_total: counterValue(counters, "gemma_timeout_total"),
    gemma_queue_depth: Number(ollama?.gemma_queue_depth ?? telemetry.gemma_queue_depth ?? 0),
    gemini_fallback_total: counterValue(counters, "gemini_fallback_total"),
    deterministic_fallback_total: counterValue(counters, "deterministic_fallback_total"),
    success_rate: rate(gemmaSuccess, rateDenominator),
    failure_rate: rate(gemmaFailure, rateDenominator),
    runtime_mode: getRuntimeModeStatus(),
  };
}

async function checkNeo4j() {
  const session = getSession();
  const start = Date.now();

  try {
    await session.run("RETURN 1 AS ok");
    return {
      ok: true,
      latencyMs: Date.now() - start
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.message
    };
  } finally {
    await session.close();
  }
}

async function checkOllama() {
  const start = Date.now();
  const status = getOllamaRuntimeStatus();

  return {
    ok: status.breaker_state !== "OPEN" && (
      status.server_healthy ||
      status.primary_health?.healthy ||
      status.backup_health?.healthy
    ),
    latencyMs: Date.now() - start,
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
    activeModel: status.active_model,
    truePrimaryModel: status.true_primary_model,
    activeRuntimeModel: status.active_runtime_model,
    primaryModel: status.primary_model,
    backupModel: status.backup_model,
    activeBackupModel: status.failover_active ? status.backup_model : null,
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
    installedStatus: status.installed_status,
    startupReadiness: status.startup_validation,
    missingModelWarnings: status.missing_model_warnings,
    recommendedCommands: status.recommended_commands,
    primary: status.primary_health,
    backup: status.backup_health,
    failoverCount: status.failover_count,
    recoverySuccess: status.recovery_success
  };
}

async function checkDecisionApi() {
  const start = Date.now();
  const timeout = withTimeout();

  try {
    const res = await fetch(`${DECISION_API_URL}/health`, {
      method: "GET",
      signal: timeout.signal
    });

    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    return {
      ok: res.ok,
      latencyMs: Date.now() - start,
      status: res.status,
      voice: body?.voice || null,
      startup: body?.startup || null
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.name === "AbortError" ? "timeout" : err.message
    };
  } finally {
    timeout.clear();
  }
}

async function checkRag() {
  const start = Date.now();

  try {
    const health = await Promise.race([
      ragService.healthCheck(),
      new Promise((resolve) =>
        setTimeout(
          () => resolve({ status: "timeout", ok: false }),
          Number(process.env.RAG_HEALTH_TIMEOUT_MS || 2500)
        )
      )
    ]);

    return {
      ok:
        health === true ||
        health?.status === "healthy" ||
        health?.status === "ok" ||
        health?.system_status === "HEALTHY" ||
        health?.system_status === "DEGRADED" ||
        health?.retriever?.ok === true,
      latencyMs: Date.now() - start,
      ...health
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.message
    };
  }
}

function buildDeploymentRecommendations({ ollama, rag, decisionApi, processMemory }) {
  const recommendations = [];
  const gemmaPressure = ollama?.gemma_memory_pressure;

  if (gemmaPressure?.high) {
    recommendations.push(
      `Gemma memory pressure is ${gemmaPressure.level}; keep GEMMA_MAX_ACTIVE_REQUESTS=1 and reduce concurrent browser/dev tasks.`
    );
  }

  if (ollama?.gemma_queue_depth > 0) {
    recommendations.push(
      "Gemma queue has pending work; reduce parallel chat requests or lower GEMMA_QUEUE_MAX_DEPTH for stricter backpressure."
    );
  }

  const ragEmbedding = rag?.retriever?.embedding || rag?.embedding;
  if (ragEmbedding && ragEmbedding.loaded === false) {
    recommendations.push(
      "BGE-M3 is deferred; first RAG query will be slower while the singleton embedder loads."
    );
  }

  if (decisionApi?.voice?.whisper_loaded === false) {
    recommendations.push(
      "Whisper is deferred; first voice request will load the model at runtime."
    );
  }

  if (processMemory.heap_used_mb > 2500) {
    recommendations.push(
      "Node heap is high; keep NODE_OPTIONS=--max-old-space-size=4096 for Vite/backend local runs."
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("No immediate resource bottleneck detected.");
  }

  return recommendations;
}

async function buildHealthPayload(getCacheStatus) {
  const [neo4j, ollama, decisionApi, rag] = await Promise.all([
    checkNeo4j(),
    checkOllama(),
    checkDecisionApi(),
    checkRag()
  ]);

  const processMemory = getProcessMemory();
  const payload = {
    ok: neo4j.ok && ollama.ok && decisionApi.ok,
    timestamp: new Date().toISOString(),
    services: {
      neo4j,
      ollama,
      decisionApi,
      rag
    },
    memory: {
      process: processMemory,
      decision: getDecisionMemoryStatus(),
      cache: typeof getCacheStatus === "function" ? getCacheStatus() : null
    },
    frontend: {
      node_options: process.env.NODE_OPTIONS || "--max-old-space-size=4096",
      vite_guidance: "Use npm run dev or npm run dev:lowmem from the frontend package."
    },
    readiness: {
      startup_phase: ollama.startup_readiness_phase,
      ollama_ready: ollama.ollama_ready,
      decision_ready: decisionApi.ok,
      rag_ready: rag.ok,
      voice_deferred: decisionApi?.voice?.whisper_loaded === false,
      bge_m3_deferred:
        rag?.retriever?.embedding?.loaded === false ||
        rag?.embedding?.loaded === false
    },
    diagnostics: {
      recommendations: buildDeploymentRecommendations({
        ollama,
        rag,
        decisionApi,
        processMemory
      })
    },
    runtimeMode: getRuntimeModeStatus(),
    metrics: buildRuntimeMetricsSnapshot()
  };

  return payload;
}

export default function createHealthRouter({ getCacheStatus } = {}) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const payload = await buildHealthPayload(getCacheStatus);

    logger.debug("Health check completed", {
      ok: payload.ok,
      neo4j: payload.services.neo4j.ok,
      ollama: payload.services.ollama.ok,
      decisionApi: payload.services.decisionApi.ok,
      rag: payload.services.rag.ok
    });

    res.status(payload.ok ? 200 : 503).json(payload);
  });

  router.get("/enterprise", async (req, res) => {
    const payload = await buildHealthPayload(getCacheStatus);
    res.status(payload.ok ? 200 : 503).json({
      ...payload,
      dashboard: {
        gemma: payload.services.ollama.gemmaTelemetry,
        rag: payload.services.rag,
        voice: payload.services.decisionApi.voice,
        queues: {
          gemma_queue_depth: payload.services.ollama.gemma_queue_depth,
          gemma_active_requests:
            payload.services.ollama.gemmaTelemetry?.gemma_active_requests
        },
        startup: payload.readiness
      }
    });
  });

  router.get("/metrics", (req, res) => {
    res.json(buildRuntimeMetricsSnapshot());
  });

  return router;
}
