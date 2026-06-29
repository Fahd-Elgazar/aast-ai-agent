# Reconciliation Diff Report

Generated: 2026-06-21T01:28:51.1281157+03:00

Canonical A: C:\AI_AGENT
Secondary B: C:\Users\mh978\Downloads\AI_AGENT n

## docker-compose.yml

A path: `C:\AI_AGENT\docker-compose.yml`
B path: `C:\Users\mh978\Downloads\AI_AGENT n\docker-compose.yml`
Risk level: MEDIUM

Added functionality: Backend Gemma/runtime env defaults and longer LLM timeout envs in B.

Removed functionality: B removes explicit RAG_ANSWER_ENGINE_ENABLED from rag-answer and changes RAG_ANSWER_MODEL default from gemma4:e2b to tinyllama.

Exact diff:
```diff
diff --git "a/C:\\AI_AGENT\\docker-compose.yml" "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\docker-compose.yml"
index 3918519c..e535536f 100644
--- "a/C:\\AI_AGENT\\docker-compose.yml"
+++ "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\docker-compose.yml"	
@@ -39,6 +39,17 @@ services:
       RAG_RETRIEVER_URL: http://rag-retriever:8001
       RAG_ANSWER_URL: http://rag-answer:8002
       OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
+      SINGLE_GEMMA_GENERATION_MODE: ${SINGLE_GEMMA_GENERATION_MODE:-true}
+      GEMINI_BACKUP_ENABLED: ${GEMINI_BACKUP_ENABLED:-true}
+      PRIMARY_MODEL: ${PRIMARY_MODEL:-gemma4:e2b}
+      GEMMA_NUM_CTX: ${GEMMA_NUM_CTX:-512}
+      GEMMA_NUM_BATCH: ${GEMMA_NUM_BATCH:-16}
+      PRIMARY_TIMEOUT_MS: ${PRIMARY_TIMEOUT_MS:-60000}
+      SYNTHESIS_TIMEOUT_MS: ${SYNTHESIS_TIMEOUT_MS:-60000}
+      PRIMARY_COLD_START_TIMEOUT_MS: ${PRIMARY_COLD_START_TIMEOUT_MS:-90000}
+      MODEL_PRELOAD_TIMEOUT_MS: ${MODEL_PRELOAD_TIMEOUT_MS:-90000}
+      LLM_REQUEST_DEADLINE_MS: ${LLM_REQUEST_DEADLINE_MS:-60000}
+      SYNTHESIS_DEADLINE_MS: ${SYNTHESIS_DEADLINE_MS:-60000}
       NEO4J_URI: bolt://neo4j:7687
       NEO4J_USER: ${NEO4J_USER:-neo4j}
       NEO4J_PASSWORD: ${NEO4J_PASSWORD:-12345678}
@@ -143,8 +154,7 @@ services:
     environment:
       RAG_RETRIEVER_URL: http://rag-retriever:8001
       OLLAMA_BASE_URL: ${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
-      RAG_ANSWER_ENGINE_ENABLED: ${RAG_ANSWER_ENGINE_ENABLED:-false}
-      RAG_ANSWER_MODEL: ${RAG_ANSWER_MODEL:-gemma4:e2b}
+      RAG_ANSWER_MODEL: ${RAG_ANSWER_MODEL:-tinyllama}
       RAG_ANSWER_TIMEOUT_SECONDS: ${RAG_ANSWER_TIMEOUT_SECONDS:-180}
       RAG_RETRIEVER_TIMEOUT_SECONDS: ${RAG_RETRIEVER_TIMEOUT_SECONDS:-180}
       RAG_ANSWER_HEALTH_TIMEOUT_SECONDS: ${RAG_ANSWER_HEALTH_TIMEOUT_SECONDS:-8}
```

## backend/services/runtimeMode.js

A path: `C:\AI_AGENT\aast-ai-agent-main\backend\config\runtimeMode.js`
B path: `C:\Users\mh978\Downloads\AI_AGENT n\aast-ai-agent-main\backend\services\runtimeMode.js`
Risk level: LOW if adapted as helpers/shim, HIGH if it replaces canonical config.

Added functionality: B adds runtime mode status helpers, model fields, and load log.

Removed functionality: B lacks canonical defense-mode, RAG, decision, graph, and humanizer toggles present in A config/runtimeMode.js.

Exact diff:
```diff
diff --git "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\config\\runtimeMode.js" "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\services\\runtimeMode.js"
index 7dd701ce..22f23f0d 100644
--- "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\config\\runtimeMode.js"
+++ "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\services\\runtimeMode.js"	
@@ -1,7 +1,3 @@
-import dotenv from "dotenv";
-
-dotenv.config();
-
 function booleanFromEnv(name, fallback) {
   const raw = process.env[name];
   if (typeof raw !== "string") return fallback;
@@ -12,19 +8,32 @@ function booleanFromEnv(name, fallback) {
   return fallback;
 }
 
-const defenseMode = booleanFromEnv("DEFENSE_MODE", false);
-const singleGemmaGenerationMode = booleanFromEnv("SINGLE_GEMMA_GENERATION_MODE", true);
-
-export const runtimeMode = Object.freeze({
-  defenseMode,
-  singleGemmaGenerationMode,
+const runtimeModeStatus = Object.freeze({
+  runtimeModeLoaded: true,
+  singleGemmaGenerationMode: booleanFromEnv("SINGLE_GEMMA_GENERATION_MODE", true),
   geminiBackupEnabled: booleanFromEnv("GEMINI_BACKUP_ENABLED", true),
-  llmIntentEnabled: booleanFromEnv("LLM_INTENT_ENABLED", false),
-  graphRefineEnabled: booleanFromEnv("KG_GRAPH_REFINE_ENABLED", false),
-  safeReformatEnabled: booleanFromEnv("KG_SAFE_REFORMAT_ENABLED", false),
-  ragAnswerEngineEnabled: booleanFromEnv("RAG_ANSWER_ENGINE_ENABLED", false),
-  decisionLlmExtractionEnabled: booleanFromEnv("DECISION_LLM_EXTRACTION_ENABLED", false),
-  humanizerEnabled: booleanFromEnv("GEMINI_HUMANIZER_ENABLED", false),
+  primaryModel: process.env.PRIMARY_MODEL || process.env.OLLAMA_MODEL || "gemma4:e2b",
+  backupModel: process.env.BACKUP_MODEL || process.env.OLLAMA_BACKUP_MODEL || "tinyllama:latest",
 });
 
-export default runtimeMode;
+console.log(JSON.stringify({
+  level: "INFO",
+  service: "RuntimeMode",
+  event: "runtime_mode_loaded",
+  timestamp: new Date().toISOString(),
+  ...runtimeModeStatus,
+}));
+
+export function getRuntimeModeStatus() {
+  return runtimeModeStatus;
+}
+
+export function isSingleGemmaGenerationMode() {
+  return runtimeModeStatus.singleGemmaGenerationMode;
+}
+
+export function isGeminiBackupEnabled() {
+  return runtimeModeStatus.geminiBackupEnabled;
+}
+
+export default runtimeModeStatus;
```

## backend/routes/health.js

A path: `C:\AI_AGENT\aast-ai-agent-main\backend\routes\health.js`
B path: `C:\Users\mh978\Downloads\AI_AGENT n\aast-ai-agent-main\backend\routes\health.js`
Risk level: MEDIUM

Added functionality: B exposes runtimeMode in health payload and enriches /metrics with Gemma/Gemini/deterministic fallback counters and queue depth.

Removed functionality: B rewrites imports to a src/ tree not used by canonical A.

Exact diff:
```diff
diff --git "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\routes\\health.js" "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\routes\\health.js"
index 24bd9813..d031271d 100644
--- "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\routes\\health.js"
+++ "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\routes\\health.js"	
@@ -1,257 +1,293 @@
-import express from "express";
-import fetch from "node-fetch";
-import { getSession } from "../db/neo4j.js";
-import { getDecisionMemoryStatus } from "../services/decisionService.js";
-import { getMetricsSnapshot } from "../services/metrics.js";
-import { logger } from "../services/logger.js";
+import express from "express";
+import fetch from "node-fetch";
+import { getSession } from "../src/infrastructure/neo4j/neo4j.js";
+import { getDecisionMemoryStatus } from "../services/decisionService.js";
+import { getMetricsSnapshot } from "../src/infrastructure/telemetry/metrics.js";
+import { logger } from "../src/infrastructure/telemetry/logger.js";
 import { getOllamaRuntimeStatus } from "../services/ollamaService.js";
+import { getRuntimeModeStatus } from "../services/runtimeMode.js";
 import ragService from "../services/ragService.js";
-
-const DEFAULT_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 2500);
-const DECISION_API_URL = process.env.DECISION_API_URL || "http://127.0.0.1:8005";
-
-function withTimeout(timeoutMs = DEFAULT_TIMEOUT_MS) {
-  const controller = new AbortController();
-  const timeout = setTimeout(() => controller.abort(), timeoutMs);
-
-  return {
-    signal: controller.signal,
-    clear: () => clearTimeout(timeout)
-  };
-}
-
+
+const DEFAULT_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 2500);
+const DECISION_API_URL = process.env.DECISION_API_URL || "http://127.0.0.1:8005";
+
+function withTimeout(timeoutMs = DEFAULT_TIMEOUT_MS) {
+  const controller = new AbortController();
+  const timeout = setTimeout(() => controller.abort(), timeoutMs);
+
+  return {
+    signal: controller.signal,
+    clear: () => clearTimeout(timeout)
+  };
+}
+
 function getProcessMemory() {
-  const memory = process.memoryUsage();
-  const toMb = (value) => Math.round((Number(value || 0) / 1024 / 1024) * 10) / 10;
-
-  return {
-    pid: process.pid,
-    rss_mb: toMb(memory.rss),
-    heap_total_mb: toMb(memory.heapTotal),
-    heap_used_mb: toMb(memory.heapUsed),
-    external_mb: toMb(memory.external),
-    node_options: process.env.NODE_OPTIONS || null
-  };
+  const memory = process.memoryUsage();
+  const toMb = (value) => Math.round((Number(value || 0) / 1024 / 1024) * 10) / 10;
+
+  return {
+    pid: process.pid,
+    rss_mb: toMb(memory.rss),
+    heap_total_mb: toMb(memory.heapTotal),
+    heap_used_mb: toMb(memory.heapUsed),
+    external_mb: toMb(memory.external),
+    node_options: process.env.NODE_OPTIONS || null
+  };
 }
 
-async function checkNeo4j() {
-  const session = getSession();
-  const start = Date.now();
+function counterValue(counters, name) {
+  const value = Number(counters?.[name] || 0);
+  return Number.isFinite(value) ? value : 0;
+}
 
-  try {
-    await session.run("RETURN 1 AS ok");
-    return {
-      ok: true,
-      latencyMs: Date.now() - start
-    };
-  } catch (err) {
-    return {
-      ok: false,
-      latencyMs: Date.now() - start,
-      error: err.message
-    };
-  } finally {
-    await session.close();
-  }
+function rate(numerator, denominator) {
+  if (!denominator) return 0;
+  return Number((numerator / denominator).toFixed(4));
 }
 
-async function checkOllama() {
-  const start = Date.now();
-  const status = getOllamaRuntimeStatus();
+function buildRuntimeMetricsSnapshot() {
+  const snapshot = getMetricsSnapshot();
+  const counters = snapshot.counters || {};
+  const ollama = getOllamaRuntimeStatus();
+  const telemetry = ollama?.gemma_telemetry || {};
+  const gemmaRequests = counterValue(counters, "gemma_requests_total");
+  const gemmaSuccess = counterValue(counters, "gemma_success_total");
+  const gemmaFailure = counterValue(counters, "gemma_failure_total");
+  const rateDenominator = Math.max(gemmaRequests, gemmaSuccess + gemmaFailure);
 
   return {
-    ok: status.breaker_state !== "OPEN" && (
-      status.server_healthy ||
-      status.primary_health?.healthy ||
-      status.backup_health?.healthy
-    ),
-    latencyMs: Date.now() - start,
-    breakerState: status.breaker_state,
-    startup_readiness_phase: status.startup_readiness_phase,
-    ollama_ready: status.ollama_ready,
-    ollama_wait_attempts: status.ollama_wait_attempts,
-    ollama_wait_duration_ms: status.ollama_wait_duration_ms,
-    startupReadinessPhase: status.startup_readiness_phase,
-    ollamaReady: status.ollama_ready,
-    ollamaWaitAttempts: status.ollama_wait_attempts,
-    ollamaWaitDurationMs: status.ollama_wait_duration_ms,
-    failoverActive: status.failover_active,
-    activeModel: status.active_model,
-    truePrimaryModel: status.true_primary_model,
-    activeRuntimeModel: status.active_runtime_model,
-    primaryModel: status.primary_model,
-    backupModel: status.backup_model,
-    activeBackupModel: status.failover_active ? status.backup_model : null,
-    primaryColdStartPending: status.primary_cold_start_pending,
-    preloadWarning: status.preload_warning,
-    startupPreloadStatus: status.startup_preload_status,
-    backupReady: status.backup_ready,
-    gemma_memory_pressure: status.gemma_memory_pressure,
-    gemma_queue_depth: status.gemma_queue_depth,
-    gemma_context_size: status.gemma_context_size,
-    warm_pool_active: status.warm_pool_active,
-    avg_generation_latency: status.avg_generation_latency,
-    overload_retries: status.overload_retries,
-    gemmaTelemetry: status.gemma_telemetry,
-    installedStatus: status.installed_status,
-    startupReadiness: status.startup_validation,
-    missingModelWarnings: status.missing_model_warnings,
-    recommendedCommands: status.recommended_commands,
-    primary: status.primary_health,
-    backup: status.backup_health,
-    failoverCount: status.failover_count,
-    recoverySuccess: status.recovery_success
+    ...snapshot,
+    gemma_requests_total: gemmaRequests,
+    gemma_success_total: gemmaSuccess,
+    gemma_failure_total: gemmaFailure,
+    gemma_timeout_total: counterValue(counters, "gemma_timeout_total"),
+    gemma_queue_depth: Number(ollama?.gemma_queue_depth ?? telemetry.gemma_queue_depth ?? 0),
+    gemini_fallback_total: counterValue(counters, "gemini_fallback_total"),
+    deterministic_fallback_total: counterValue(counters, "deterministic_fallback_total"),
+    success_rate: rate(gemmaSuccess, rateDenominator),
+    failure_rate: rate(gemmaFailure, rateDenominator),
+    runtime_mode: getRuntimeModeStatus(),
   };
 }
-
-async function checkDecisionApi() {
-  const start = Date.now();
-  const timeout = withTimeout();
-
-  try {
-    const res = await fetch(`${DECISION_API_URL}/health`, {
-      method: "GET",
-      signal: timeout.signal
-    });
-
-    let body = null;
-    try {
-      body = await res.json();
-    } catch {
-      body = null;
-    }
-
-    return {
-      ok: res.ok,
-      latencyMs: Date.now() - start,
-      status: res.status,
-      voice: body?.voice || null,
-      startup: body?.startup || null
-    };
-  } catch (err) {
-    return {
-      ok: false,
-      latencyMs: Date.now() - start,
-      error: err.name === "AbortError" ? "timeout" : err.message
-    };
-  } finally {
-    timeout.clear();
-  }
-}
-
-async function checkRag() {
-  const start = Date.now();
-
-  try {
-    const health = await Promise.race([
-      ragService.healthCheck(),
-      new Promise((resolve) =>
-        setTimeout(
-          () => resolve({ status: "timeout", ok: false }),
-          Number(process.env.RAG_HEALTH_TIMEOUT_MS || 2500)
-        )
-      )
-    ]);
-
-    return {
-      ok:
-        health === true ||
-        health?.status === "healthy" ||
-        health?.status === "ok" ||
-        health?.system_status === "HEALTHY" ||
-        health?.system_status === "DEGRADED" ||
-        health?.retriever?.ok === true,
-      latencyMs: Date.now() - start,
-      ...health
-    };
-  } catch (err) {
-    return {
-      ok: false,
-      latencyMs: Date.now() - start,
-      error: err.message
-    };
-  }
-}
-
-function buildDeploymentRecommendations({ ollama, rag, decisionApi, processMemory }) {
-  const recommendations = [];
-  const gemmaPressure = ollama?.gemma_memory_pressure;
-
-  if (gemmaPressure?.high) {
-    recommendations.push(
-      `Gemma memory pressure is ${gemmaPressure.level}; keep GEMMA_MAX_ACTIVE_REQUESTS=1 and reduce concurrent browser/dev tasks.`
-    );
-  }
-
-  if (ollama?.gemma_queue_depth > 0) {
-    recommendations.push(
-      "Gemma queue has pending work; reduce parallel chat requests or lower GEMMA_QUEUE_MAX_DEPTH for stricter backpressure."
-    );
-  }
-
-  const ragEmbedding = rag?.retriever?.embedding || rag?.embedding;
-  if (ragEmbedding && ragEmbedding.loaded === false) {
-    recommendations.push(
-      "BGE-M3 is deferred; first RAG query will be slower while the singleton embedder loads."
-    );
-  }
-
-  if (decisionApi?.voice?.whisper_loaded === false) {
-    recommendations.push(
-      "Whisper is deferred; first voice request will load the model at runtime."
-    );
-  }
-
-  if (processMemory.heap_used_mb > 2500) {
-    recommendations.push(
-      "Node heap is high; keep NODE_OPTIONS=--max-old-space-size=4096 for Vite/backend local runs."
-    );
-  }
-
-  if (recommendations.length === 0) {
-    recommendations.push("No immediate resource bottleneck detected.");
-  }
-
-  return recommendations;
-}
-
-async function buildHealthPayload(getCacheStatus) {
-  const [neo4j, ollama, decisionApi, rag] = await Promise.all([
-    checkNeo4j(),
-    checkOllama(),
-    checkDecisionApi(),
-    checkRag()
-  ]);
-
-  const processMemory = getProcessMemory();
-  const payload = {
-    ok: neo4j.ok && ollama.ok && decisionApi.ok,
-    timestamp: new Date().toISOString(),
-    services: {
-      neo4j,
-      ollama,
-      decisionApi,
-      rag
-    },
-    memory: {
-      process: processMemory,
-      decision: getDecisionMemoryStatus(),
-      cache: typeof getCacheStatus === "function" ? getCacheStatus() : null
-    },
-    frontend: {
-      node_options: process.env.NODE_OPTIONS || "--max-old-space-size=4096",
-      vite_guidance: "Use npm run dev or npm run dev:lowmem from the frontend package."
-    },
-    readiness: {
-      startup_phase: ollama.startup_readiness_phase,
-      ollama_ready: ollama.ollama_ready,
-      decision_ready: decisionApi.ok,
-      rag_ready: rag.ok,
-      voice_deferred: decisionApi?.voice?.whisper_loaded === false,
-      bge_m3_deferred:
-        rag?.retriever?.embedding?.loaded === false ||
-        rag?.embedding?.loaded === false
-    },
+
+async function checkNeo4j() {
+  const session = getSession();
+  const start = Date.now();
+
+  try {
+    await session.run("RETURN 1 AS ok");
+    return {
+      ok: true,
+      latencyMs: Date.now() - start
+    };
+  } catch (err) {
+    return {
+      ok: false,
+      latencyMs: Date.now() - start,
+      error: err.message
+    };
+  } finally {
+    await session.close();
+  }
+}
+
+async function checkOllama() {
+  const start = Date.now();
+  const status = getOllamaRuntimeStatus();
+
+  return {
+    ok: status.breaker_state !== "OPEN" && (
+      status.server_healthy ||
+      status.primary_health?.healthy ||
+      status.backup_health?.healthy
+    ),
+    latencyMs: Date.now() - start,
+    breakerState: status.breaker_state,
+    startup_readiness_phase: status.startup_readiness_phase,
+    ollama_ready: status.ollama_ready,
+    ollama_wait_attempts: status.ollama_wait_attempts,
+    ollama_wait_duration_ms: status.ollama_wait_duration_ms,
+    startupReadinessPhase: status.startup_readiness_phase,
+    ollamaReady: status.ollama_ready,
+    ollamaWaitAttempts: status.ollama_wait_attempts,
+    ollamaWaitDurationMs: status.ollama_wait_duration_ms,
+    failoverActive: status.failover_active,
+    activeModel: status.active_model,
+    truePrimaryModel: status.true_primary_model,
+    activeRuntimeModel: status.active_runtime_model,
+    primaryModel: status.primary_model,
+    backupModel: status.backup_model,
+    activeBackupModel: status.failover_active ? status.backup_model : null,
+    primaryColdStartPending: status.primary_cold_start_pending,
+    preloadWarning: status.preload_warning,
+    startupPreloadStatus: status.startup_preload_status,
+    backupReady: status.backup_ready,
+    gemma_memory_pressure: status.gemma_memory_pressure,
+    gemma_queue_depth: status.gemma_queue_depth,
+    gemma_context_size: status.gemma_context_size,
+    warm_pool_active: status.warm_pool_active,
+    avg_generation_latency: status.avg_generation_latency,
+    overload_retries: status.overload_retries,
+    gemmaTelemetry: status.gemma_telemetry,
+    installedStatus: status.installed_status,
+    startupReadiness: status.startup_validation,
+    missingModelWarnings: status.missing_model_warnings,
+    recommendedCommands: status.recommended_commands,
+    primary: status.primary_health,
+    backup: status.backup_health,
+    failoverCount: status.failover_count,
+    recoverySuccess: status.recovery_success
+  };
+}
+
+async function checkDecisionApi() {
+  const start = Date.now();
+  const timeout = withTimeout();
+
+  try {
+    const res = await fetch(`${DECISION_API_URL}/health`, {
+      method: "GET",
+      signal: timeout.signal
+    });
+
+    let body = null;
+    try {
+      body = await res.json();
+    } catch {
+      body = null;
+    }
+
+    return {
+      ok: res.ok,
+      latencyMs: Date.now() - start,
+      status: res.status,
+      voice: body?.voice || null,
+      startup: body?.startup || null
+    };
+  } catch (err) {
+    return {
+      ok: false,
+      latencyMs: Date.now() - start,
+      error: err.name === "AbortError" ? "timeout" : err.message
+    };
+  } finally {
+    timeout.clear();
+  }
+}
+
+async function checkRag() {
+  const start = Date.now();
+
+  try {
+    const health = await Promise.race([
+      ragService.healthCheck(),
+      new Promise((resolve) =>
+        setTimeout(
+          () => resolve({ status: "timeout", ok: false }),
+          Number(process.env.RAG_HEALTH_TIMEOUT_MS || 2500)
+        )
+      )
+    ]);
+
+    return {
+      ok:
+        health === true ||
+        health?.status === "healthy" ||
+        health?.status === "ok" ||
+        health?.system_status === "HEALTHY" ||
+        health?.system_status === "DEGRADED" ||
+        health?.retriever?.ok === true,
+      latencyMs: Date.now() - start,
+      ...health
+    };
+  } catch (err) {
+    return {
+      ok: false,
+      latencyMs: Date.now() - start,
+      error: err.message
+    };
+  }
+}
+
+function buildDeploymentRecommendations({ ollama, rag, decisionApi, processMemory }) {
+  const recommendations = [];
+  const gemmaPressure = ollama?.gemma_memory_pressure;
+
+  if (gemmaPressure?.high) {
+    recommendations.push(
+      `Gemma memory pressure is ${gemmaPressure.level}; keep GEMMA_MAX_ACTIVE_REQUESTS=1 and reduce concurrent browser/dev tasks.`
+    );
+  }
+
+  if (ollama?.gemma_queue_depth > 0) {
+    recommendations.push(
+      "Gemma queue has pending work; reduce parallel chat requests or lower GEMMA_QUEUE_MAX_DEPTH for stricter backpressure."
+    );
+  }
+
+  const ragEmbedding = rag?.retriever?.embedding || rag?.embedding;
+  if (ragEmbedding && ragEmbedding.loaded === false) {
+    recommendations.push(
+      "BGE-M3 is deferred; first RAG query will be slower while the singleton embedder loads."
+    );
+  }
+
+  if (decisionApi?.voice?.whisper_loaded === false) {
+    recommendations.push(
+      "Whisper is deferred; first voice request will load the model at runtime."
+    );
+  }
+
+  if (processMemory.heap_used_mb > 2500) {
+    recommendations.push(
+      "Node heap is high; keep NODE_OPTIONS=--max-old-space-size=4096 for Vite/backend local runs."
+    );
+  }
+
+  if (recommendations.length === 0) {
+    recommendations.push("No immediate resource bottleneck detected.");
+  }
+
+  return recommendations;
+}
+
+async function buildHealthPayload(getCacheStatus) {
+  const [neo4j, ollama, decisionApi, rag] = await Promise.all([
+    checkNeo4j(),
+    checkOllama(),
+    checkDecisionApi(),
+    checkRag()
+  ]);
+
+  const processMemory = getProcessMemory();
+  const payload = {
+    ok: neo4j.ok && ollama.ok && decisionApi.ok,
+    timestamp: new Date().toISOString(),
+    services: {
+      neo4j,
+      ollama,
+      decisionApi,
+      rag
+    },
+    memory: {
+      process: processMemory,
+      decision: getDecisionMemoryStatus(),
+      cache: typeof getCacheStatus === "function" ? getCacheStatus() : null
+    },
+    frontend: {
+      node_options: process.env.NODE_OPTIONS || "--max-old-space-size=4096",
+      vite_guidance: "Use npm run dev or npm run dev:lowmem from the frontend package."
+    },
+    readiness: {
+      startup_phase: ollama.startup_readiness_phase,
+      ollama_ready: ollama.ollama_ready,
+      decision_ready: decisionApi.ok,
+      rag_ready: rag.ok,
+      voice_deferred: decisionApi?.voice?.whisper_loaded === false,
+      bge_m3_deferred:
+        rag?.retriever?.embedding?.loaded === false ||
+        rag?.embedding?.loaded === false
+    },
     diagnostics: {
       recommendations: buildDeploymentRecommendations({
         ollama,
@@ -260,50 +296,51 @@ async function buildHealthPayload(getCacheStatus) {
         processMemory
       })
     },
-    metrics: getMetricsSnapshot()
+    runtimeMode: getRuntimeModeStatus(),
+    metrics: buildRuntimeMetricsSnapshot()
   };
-
-  return payload;
-}
-
-export default function createHealthRouter({ getCacheStatus } = {}) {
-  const router = express.Router();
-
-  router.get("/", async (req, res) => {
-    const payload = await buildHealthPayload(getCacheStatus);
-
-    logger.debug("Health check completed", {
-      ok: payload.ok,
-      neo4j: payload.services.neo4j.ok,
-      ollama: payload.services.ollama.ok,
-      decisionApi: payload.services.decisionApi.ok,
-      rag: payload.services.rag.ok
-    });
-
-    res.status(payload.ok ? 200 : 503).json(payload);
-  });
-
-  router.get("/enterprise", async (req, res) => {
-    const payload = await buildHealthPayload(getCacheStatus);
-    res.status(payload.ok ? 200 : 503).json({
-      ...payload,
-      dashboard: {
-        gemma: payload.services.ollama.gemmaTelemetry,
-        rag: payload.services.rag,
-        voice: payload.services.decisionApi.voice,
-        queues: {
-          gemma_queue_depth: payload.services.ollama.gemma_queue_depth,
-          gemma_active_requests:
-            payload.services.ollama.gemmaTelemetry?.gemma_active_requests
-        },
-        startup: payload.readiness
-      }
-    });
-  });
-
+
+  return payload;
+}
+
+export default function createHealthRouter({ getCacheStatus } = {}) {
+  const router = express.Router();
+
+  router.get("/", async (req, res) => {
+    const payload = await buildHealthPayload(getCacheStatus);
+
+    logger.debug("Health check completed", {
+      ok: payload.ok,
+      neo4j: payload.services.neo4j.ok,
+      ollama: payload.services.ollama.ok,
+      decisionApi: payload.services.decisionApi.ok,
+      rag: payload.services.rag.ok
+    });
+
+    res.status(payload.ok ? 200 : 503).json(payload);
+  });
+
+  router.get("/enterprise", async (req, res) => {
+    const payload = await buildHealthPayload(getCacheStatus);
+    res.status(payload.ok ? 200 : 503).json({
+      ...payload,
+      dashboard: {
+        gemma: payload.services.ollama.gemmaTelemetry,
+        rag: payload.services.rag,
+        voice: payload.services.decisionApi.voice,
+        queues: {
+          gemma_queue_depth: payload.services.ollama.gemma_queue_depth,
+          gemma_active_requests:
+            payload.services.ollama.gemmaTelemetry?.gemma_active_requests
+        },
+        startup: payload.readiness
+      }
+    });
+  });
+
   router.get("/metrics", (req, res) => {
-    res.json(getMetricsSnapshot());
+    res.json(buildRuntimeMetricsSnapshot());
   });
-
-  return router;
-}
+
+  return router;
+}
```

## backend/services/conversationalHumanizer.js

A path: `C:\AI_AGENT\aast-ai-agent-main\backend\services\conversationalHumanizer.js`
B path: `C:\Users\mh978\Downloads\AI_AGENT n\aast-ai-agent-main\backend\services\conversationalHumanizer.js`
Risk level: LOW if behavior is mapped to canonical runtimeMode; MEDIUM if B service import is copied directly.

Added functionality: B skips Gemini humanizer when single Gemma generation mode is active.

Removed functionality: B replaces A runtimeMode.humanizerEnabled check with a narrower string comparison.

Exact diff:
```diff
diff --git "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\services\\conversationalHumanizer.js" "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\services\\conversationalHumanizer.js"
index cc0c8dfd..58e18c9d 100644
--- "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\services\\conversationalHumanizer.js"
+++ "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\services\\conversationalHumanizer.js"	
@@ -1,5 +1,5 @@
 import { generateGeminiSynthesis } from "./geminiService.js";
-import { runtimeMode } from "../config/runtimeMode.js";
+import { isSingleGemmaGenerationMode } from "./runtimeMode.js";
 
 const DEFAULT_HUMANIZER_TIMEOUT_MS = 7000;
 const DEFAULT_MAX_OUTPUT_TOKENS = 180;
@@ -323,11 +323,22 @@ export async function humanizeGroundedAnswer({
     return { answer, changed: false, skipped: true, reason: "EMPTY_GROUNDED_ANSWER" };
   }
 
-  if (!runtimeMode.humanizerEnabled) {
+  if (process.env.GEMINI_HUMANIZER_ENABLED === "false") {
     console.log(`[GEMINI_HUMANIZER][HUMANIZER_SKIPPED][${requestId}] reason=DISABLED route=${route}`);
     return { answer, changed: expansion.changed, skipped: true, reason: "DISABLED", expansionReason: expansion.reason };
   }
 
+  if (isSingleGemmaGenerationMode()) {
+    console.log(`[GEMINI_HUMANIZER][HUMANIZER_SKIPPED][${requestId}] reason=SINGLE_GEMMA_GENERATION_MODE route=${route}`);
+    return {
+      answer,
+      changed: expansion.changed,
+      skipped: true,
+      reason: "SINGLE_GEMMA_GENERATION_MODE",
+      expansionReason: expansion.reason
+    };
+  }
+
   if (process.env.GEMINI_HUMANIZER_FORCE_TIMEOUT === "true") {
     console.log(`[GEMINI_HUMANIZER][HUMANIZER_FALLBACK][${requestId}] reason=FORCED_TIMEOUT route=${route}`);
     return { answer, changed: expansion.changed, fallback: true, reason: "FORCED_TIMEOUT", expansionReason: expansion.reason };
```

## backend/services/unifiedAnswerService.js

A path: `C:\AI_AGENT\aast-ai-agent-main\backend\services\unifiedAnswerService.js`
B path: `C:\Users\mh978\Downloads\AI_AGENT n\aast-ai-agent-main\backend\services\unifiedAnswerService.js`
Risk level: HIGH

Added functionality: B adds explicit single-mode branch and Gemini fallback counters/logs, but A already has Gemma-primary/Gemini-backup/deterministic behavior.

Removed functionality: B removes several deterministic_fallback_total increments and changes non-single mode to Gemini-first with Ollama fallback.

Exact diff:
```diff
diff --git "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\services\\unifiedAnswerService.js" "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\services\\unifiedAnswerService.js"
index 12f62558..9b6604c4 100644
--- "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\services\\unifiedAnswerService.js"
+++ "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\services\\unifiedAnswerService.js"	
@@ -1,490 +1,494 @@
-/**
- * ============================================================
- * AAST Explainable Hybrid GraphRAG Academic Advisor
- * Unified Answer Generation Service
- * ============================================================
- *
- * PURPOSE:
- *   This module serves as the SINGLE FINAL ANSWER LAYER for the
- *   entire advisory pipeline. It receives pre-verified, structured
- *   context from four upstream sources:
- *     1. Neo4j Knowledge Graph   → neo4jContext
- *     2. RAG Retriever Documents → ragContext
- *     3. FAQ System              → faqContext
- *     4. Decision System         → decisionContext
- *
- *   It synthesizes all available context through a locally-hosted
- *   Ollama LLM (Gemma) into a single, natural, student-friendly,
- *   professionally-toned advisory response — without hallucination
- *   or reliance on outside knowledge.
- *
- * AUTHOR:  AAST Academic Advisor Engineering Team
- * VERSION: 4.1.1  — Final Phase 3 stability micro-patches
- *
- * CHANGELOG (v4.1.1):
- *   - Fixed immutability violation: cloning inference options before mutation in degraded mode.
- *   - Improved prompt trimming accuracy: implemented iterative build-measure-trim-rebuild loop.
- *   - Polished deterministic fallback tone: replaced mechanical prefixes with professional academic language.
- *   - Enhanced source attribution: deterministic fallback now uses robust builder-level usage detection.
- *   - Added recursive critical trimming safety loop to prevent token budget overflows.
- *
- * CHANGELOG (v4.1.0):
- *   - Removed direct fetch and localized Ollama infra in favor of centralized ollamaService.
- *   - Implemented tiered confidence gating (0.25 degraded threshold).
- *   - Added deterministic fallback mechanism to preserve verified context on LLM failure.
- *   - Implemented proactive prompt auto-trimming to prevent context window overflow.
- *   - Integrated generateStableResponse for improved inference reliability.
- * ============================================================
- */
-
-import {
-    generateStableResponse,
-    getLastGenerationMetadata,
-    getOllamaRuntimeStatus
-} from "./ollamaService.js";
-import {
-    generateGeminiSynthesis,
-    isGeminiTimeoutError
-} from "./geminiService.js";
+/**
+ * ============================================================
+ * AAST Explainable Hybrid GraphRAG Academic Advisor
+ * Unified Answer Generation Service
+ * ============================================================
+ *
+ * PURPOSE:
+ *   This module serves as the SINGLE FINAL ANSWER LAYER for the
+ *   entire advisory pipeline. It receives pre-verified, structured
+ *   context from four upstream sources:
+ *     1. Neo4j Knowledge Graph   → neo4jContext
+ *     2. RAG Retriever Documents → ragContext
+ *     3. FAQ System              → faqContext
+ *     4. Decision System         → decisionContext
+ *
+ *   It synthesizes all available context through a locally-hosted
+ *   Ollama LLM (Gemma) into a single, natural, student-friendly,
+ *   professionally-toned advisory response — without hallucination
+ *   or reliance on outside knowledge.
+ *
+ * AUTHOR:  AAST Academic Advisor Engineering Team
+ * VERSION: 4.1.1  — Final Phase 3 stability micro-patches
+ *
+ * CHANGELOG (v4.1.1):
+ *   - Fixed immutability violation: cloning inference options before mutation in degraded mode.
+ *   - Improved prompt trimming accuracy: implemented iterative build-measure-trim-rebuild loop.
+ *   - Polished deterministic fallback tone: replaced mechanical prefixes with professional academic language.
+ *   - Enhanced source attribution: deterministic fallback now uses robust builder-level usage detection.
+ *   - Added recursive critical trimming safety loop to prevent token budget overflows.
+ *
+ * CHANGELOG (v4.1.0):
+ *   - Removed direct fetch and localized Ollama infra in favor of centralized ollamaService.
+ *   - Implemented tiered confidence gating (0.25 degraded threshold).
+ *   - Added deterministic fallback mechanism to preserve verified context on LLM failure.
+ *   - Implemented proactive prompt auto-trimming to prevent context window overflow.
+ *   - Integrated generateStableResponse for improved inference reliability.
+ * ============================================================
+ */
+
+import {
+    generateStableResponse,
+    getLastGenerationMetadata,
+    getOllamaRuntimeStatus
+} from "./ollamaService.js";
+import {
+    generateGeminiSynthesis,
+    isGeminiTimeoutError
+} from "./geminiService.js";
 import { convertToGraphData } from "./neo4jcontext.js";
-import { LLM_CONFIG } from "../config/llmConfig.js";
-import { getGemmaTelemetrySnapshot } from "./gemmaTelemetryService.js";
-import { incrementMetric } from "./metrics.js";
-import { runtimeMode } from "../config/runtimeMode.js";
-
-// ─────────────────────────────────────────────────────────────
-// SECTION 0 — CONFIGURATION CONSTANTS
-// ─────────────────────────────────────────────────────────────
-
-/** Local Gemma model used as the primary synthesis provider. */
-const MODEL = process.env.PRIMARY_MODEL || process.env.OLLAMA_MODEL || "gemma4:e2b";
-
-function timeoutFromEnv(names, fallback) {
-    for (const name of names) {
-        const parsed = Number.parseInt(process.env[name], 10);
-        if (Number.isFinite(parsed)) {
-            return parsed;
-        }
-    }
-
-    return fallback;
-}
-
-const SYNTHESIS_TIMEOUT_MS = timeoutFromEnv(
-    ["SYNTHESIS_TIMEOUT_MS", "OLLAMA_SYNTHESIS_TIMEOUT_MS"],
-    LLM_CONFIG.timeouts.synthesisMs || LLM_CONFIG.timeouts.primaryMs
-);
-
-const SYNTHESIS_DEADLINE_MS = timeoutFromEnv(
-    ["SYNTHESIS_DEADLINE_MS", "LLM_SYNTHESIS_DEADLINE_MS"],
-    LLM_CONFIG.timeouts.synthesisDeadlineMs || LLM_CONFIG.timeouts.generationDeadlineMs
-);
-
-const GEMINI_SYNTHESIS_TIMEOUT_MS = timeoutFromEnv(
-    ["GEMINI_SYNTHESIS_TIMEOUT_MS", "GEMINI_TIMEOUT_MS"],
-    10000
-);
-
-/**
- * Minimum retrieval confidence score (0–1).
- * Below this threshold the LLM call is bypassed.
- */
-const CONFIDENCE_GATE_THRESHOLD = 0.40;
-
-/**
- * Threshold for degraded operation (0–1).
- * Between this and the full threshold, we operate in high-caution mode.
- */
-const DEGRADED_CONFIDENCE_THRESHOLD = 0.25;
-
-/** Maximum KG facts to inject into the prompt. */
-const MAX_KG_FACTS = 3;
-
-/** Maximum RAG passages to inject into the prompt. */
-const MAX_RAG_PASSAGES = 3;
-
-/** Maximum recent non-system conversation messages to expose to synthesis. */
-const MAX_HISTORY_MESSAGES = 4;
-
-/** Maximum characters per conversation-history message. */
-const MAX_HISTORY_MESSAGE_CHARS = 320;
-
-/** Maximum total characters for the conversation-history prompt block. */
-const MAX_HISTORY_TOTAL_CHARS = 1000;
-
-/** Maximum total characters for lightweight session-memory injection. */
-const MAX_MEMORY_BLOCK_CHARS = 500;
-
-/**
- * Maximum character length for any string value inside the decision
- * factors block. Values exceeding this are truncated with an ellipsis.
- */
-const DECISION_MAX_VALUE_CHARS = 200;
-
-/**
- * Maximum serialization depth for nested objects in the decision factors block.
- * Objects deeper than this are replaced with a compact placeholder.
- */
-const DECISION_MAX_DEPTH = 3;
-
-/**
- * Prompt token count at which a WARNING-level alert is emitted.
- * Signals the prompt is approaching the model's comfortable context budget.
- */
-const PROMPT_TOKEN_WARN_THRESHOLD = Math.floor(LLM_CONFIG.gemma.maxContextTokens * 0.80);
-
-/**
- * Prompt token count at which a CRITICAL-level alert is emitted.
- * At this size, context truncation by the model is likely, degrading quality.
- */
-const PROMPT_TOKEN_CRITICAL_THRESHOLD = LLM_CONFIG.gemma.maxContextTokens;
-
-/**
- * Fallback message returned when the generation system is unavailable.
- */
-const FALLBACK_ANSWER =
-    "I'm sorry, the answer generation system is currently unavailable. " +
-    "Please try again in a moment or contact your academic advisor directly.";
-
-/**
- * Returned when context is below confidence threshold or insufficient
- * to answer without hallucination risk.
- */
-const INSUFFICIENT_DATA_PHRASE =
-    "I don't have enough verified information to answer that fully. " +
-    "Please consult your academic advisor or the university's official portal for accurate details.";
-
-
-// ─────────────────────────────────────────────────────────────
-// SECTION 1 — ROUTE TYPE REGISTRY
-// ─────────────────────────────────────────────────────────────
-
-/**
- * Enumeration of supported route types.
- * @readonly
- * @enum {string}
- */
-const ROUTE_TYPES = Object.freeze({
-    KG_ONLY: "KG_ONLY",
-    RAG_ONLY: "RAG_ONLY",
-    FAQ_ONLY: "FAQ_ONLY",
-    DECISION: "DECISION",
-    CAREER: "CAREER",
-    GENERAL: "GENERAL",
-    HYBRID: "HYBRID",
-    LLM_FALLBACK: "LLM_FALLBACK",
-});
-
-/**
- * TASK 1 — Per-route Ollama inference parameter sets.
- *
- * Temperature controls factual precision per route:
- *   FAQ_ONLY    (0.10) — Near-verbatim reproduction of verified policy wording.
- *   KG_ONLY     (0.15) — Precise entity/code quoting from structured graph data.
- *   DECISION    (0.20) — Controlled advisory language from rule engine verdicts.
- *   RAG_ONLY    (0.25) — Moderate paraphrase latitude for policy summarization.
- *   HYBRID      (0.30) — Synthesis flexibility needed across heterogeneous sources.
- *   LLM_FALLBACK(0.05) — Maximum conservatism when evidence is sparse.
- *
- * top_p is tightened at lower temperatures to prevent degenerate low-probability
- * token selection from countering the precision intent of the low temperature.
- *
- * repeat_penalty is slightly elevated on LLM_FALLBACK to suppress the
- * self-referential loops Gemma exhibits when context is thin.
- *
- * @type {Record<string, { temperature: number, top_p: number, repeat_penalty: number }>}
- */
-const ROUTE_INFERENCE_OPTIONS = Object.freeze({
-    [ROUTE_TYPES.KG_ONLY]: { temperature: 0.12, top_p: 0.78, repeat_penalty: 1.16 },
-    [ROUTE_TYPES.FAQ_ONLY]: { temperature: 0.10, top_p: 0.75, repeat_penalty: 1.10 },
-    [ROUTE_TYPES.RAG_ONLY]: { temperature: 0.16, top_p: 0.82, repeat_penalty: 1.16 },
-    [ROUTE_TYPES.DECISION]: { temperature: 0.14, top_p: 0.80, repeat_penalty: 1.15 },
-    [ROUTE_TYPES.CAREER]: { temperature: 0.14, top_p: 0.80, repeat_penalty: 1.15 },
-    [ROUTE_TYPES.GENERAL]: { temperature: 0.16, top_p: 0.82, repeat_penalty: 1.15 },
-    [ROUTE_TYPES.HYBRID]: { temperature: 0.18, top_p: 0.84, repeat_penalty: 1.16 },
-    [ROUTE_TYPES.LLM_FALLBACK]: { temperature: 0.05, top_p: 0.70, repeat_penalty: 1.20 },
-});
-
-/**
- * Returns the Ollama inference options for a given resolved route type.
- * Falls back to LLM_FALLBACK options if the route is unrecognised.
- *
- * @param {string} resolvedRouteType - A valid ROUTE_TYPES value.
- * @returns {{ temperature: number, top_p: number, repeat_penalty: number }}
- */
-function buildInferenceOptions(resolvedRouteType) {
-    return (
-        ROUTE_INFERENCE_OPTIONS[resolvedRouteType] ??
-        ROUTE_INFERENCE_OPTIONS[ROUTE_TYPES.LLM_FALLBACK]
-    );
-}
-
-/**
- * Per-route behavioral instruction blocks injected into the system prompt.
- *
- * TASK 7: RAG_ONLY and HYBRID now include a policy formatting directive
- * that encourages natural AAST policy anchoring.
- * This grounds policy answers to the institution's own regulatory voice,
- * reducing generic-AI phrasing and increasing perceived authority/trust.
- *
- * @type {Record<string, string>}
- */
-const ROUTE_INSTRUCTIONS = {
-    [ROUTE_TYPES.KG_ONLY]: `
-ROUTE: Knowledge Graph Only
-You are answering from verified, structured factual data extracted from the university knowledge graph.
-- Prioritize precision. Quote entity names, course codes, and numeric values exactly as they appear.
-- Do not infer or extend beyond the explicit graph facts provided.
-- If a fact seems contradictory, surface the ambiguity rather than resolving it silently.
-- Omit information that is not directly stated in the Knowledge Graph block.
-`.trim(),
-
-    [ROUTE_TYPES.RAG_ONLY]: `
-ROUTE: Document Retrieval Only
-You are answering from semantically retrieved policy or regulation documents.
-- When the retrieved content contains a policy rule or regulation, anchor it naturally with wording like:
-  "AAST academic regulations state that ..." before explaining the rule.
-- Summarize the relevant policy clearly and accurately.
-- Preserve key regulatory language where critical to meaning.
-- If the passage is partial or appears cut off, acknowledge the limitation and recommend
-  the student verify via the official university portal.
-- Do not supplement retrieved passages with any invented policy detail.
-`.trim(),
-
-    [ROUTE_TYPES.FAQ_ONLY]: `
-ROUTE: FAQ Match
-You are answering from a verified frequently-asked-question entry — the highest confidence source available.
-- Reflect the official answer as precisely as possible while adapting tone to be student-friendly.
-- Do not alter the substance, requirements, or conditions stated in the FAQ answer.
-- If the student's question is slightly different from the matched FAQ, note the exact scope of what is confirmed.
-`.trim(),
-
-    [ROUTE_TYPES.DECISION]: `
-ROUTE: Decision Engine
-You are presenting the outcome and reasoning of a rule-based decision engine evaluation.
-- Lead with the decision outcome clearly (eligible / not eligible / conditional / etc.).
-- Walk through each factor the engine evaluated in plain language.
-- Be advisory and constructive — if the outcome is negative, suggest next steps where
-  inferable from the factors.
-- Do not soften or contradict the engine's verdict; present it professionally.
-`.trim(),
-
-    [ROUTE_TYPES.CAREER]: `
-ROUTE: Career Engine
-You are presenting a verified academic-to-career roadmap.
-- Lead with the target role or pathway clearly.
-- Explain the top skills, progression logic, and academic preparation steps from the provided evidence.
-- Keep the response practical and student-friendly.
-- Do not invent market claims, certifications, or university rules not present in the context.
-`.trim(),
-
-    [ROUTE_TYPES.GENERAL]: `
-ROUTE: General Academic Guidance
-You are answering with the best verified academic context available.
-- Prefer grounded academic guidance over broad motivational language.
-- If the context is partial, state the limitation clearly.
-- Do not imply policy certainty unless verified policy evidence is present.
-- Keep the response useful, cautious, and professionally phrased.
-`.trim(),
-
-    [ROUTE_TYPES.HYBRID]: `
-ROUTE: Hybrid (Multi-Source)
-You are synthesizing from multiple verified sources of different types.
-- Prioritize in order: FAQ answer → Knowledge Graph facts → Decision factors → Retrieved documents.
-- Use each source for what it does best: FAQ for confirmed policy wording, Decision for eligibility
-  verdict, KG for specific entities and relationships, RAG for regulatory depth.
-- Where the answer draws on policy or regulatory documents, anchor it naturally with wording like:
-  "AAST academic regulations state that ..." before explaining the rule.
-- Where sources overlap and agree, synthesize them seamlessly.
-- Where sources differ, surface the most authoritative source and note any discrepancy.
-- Do not blend uncertain and certain facts without clearly distinguishing confidence levels.
-`.trim(),
-
-    [ROUTE_TYPES.LLM_FALLBACK]: `
-ROUTE: LLM Fallback (Low Confidence)
-You are operating in maximum-caution mode because retrieval confidence is low or no structured context was returned.
-- Be extremely conservative. Only state what is directly and explicitly in the provided context.
-- If the context does not contain a clear answer, respond with the insufficient-data phrase — do not attempt to infer.
-- Do not attempt to recall or apply any university-specific knowledge not present in the context.
-- Encourage the student to verify with their official academic advisor or university portal.
-`.trim(),
-};
-
-const EMPTY_GRAPH = Object.freeze({ nodes: [], links: [] });
-
-
-// ─────────────────────────────────────────────────────────────
-// SECTION 2 — OBSERVABILITY LAYER
-// ─────────────────────────────────────────────────────────────
-
-/**
- * Emits a structured INFO-level log to stdout.
- * @param {string} event
- * @param {object} [payload]
- */
-function logInfo(event, payload = {}) {
-    console.log(JSON.stringify({
-        level: "INFO",
-        service: "UnifiedAnswerService",
-        event,
-        timestamp: new Date().toISOString(),
-        ...payload,
-    }));
-}
-
-/**
- * Emits a structured WARN-level log to stdout.
- * @param {string} event
- * @param {object} [payload]
- */
-function logWarn(event, payload = {}) {
-    console.warn(JSON.stringify({
-        level: "WARN",
-        service: "UnifiedAnswerService",
-        event,
-        timestamp: new Date().toISOString(),
-        ...payload,
-    }));
-}
-
-/**
- * Emits a structured ERROR-level log to stderr.
- * @param {string} event
- * @param {object} [payload]
- */
-function logError(event, payload = {}) {
-    console.error(JSON.stringify({
-        level: "ERROR",
-        service: "UnifiedAnswerService",
-        event,
-        timestamp: new Date().toISOString(),
-        ...payload,
-    }));
-}
-
-/**
- * Estimates prompt token count via chars/4 heuristic.
- * Sufficient for budget alerting without a tokenizer dependency.
- *
- * @param {string} text
- * @returns {number}
- */
-function estimateTokens(text) {
-    return Math.ceil((text ?? "").length / 4);
-}
-
-function hardTruncateToTokenBudget(text, maxTokens) {
-    const value = String(text ?? "");
-    const maxChars = Math.max(0, maxTokens * 4);
-
-    if (estimateTokens(value) <= maxTokens) {
-        return { text: value, truncated: false };
-    }
-
-    return {
-        text:
-            value.slice(0, Math.max(0, maxChars)).trimEnd() +
-            "\n\n[Lower-priority context truncated to protect Gemma context budget.]",
-        truncated: true,
-    };
-}
-
-function routeNumPredict(routeType, promptTokenEst = 0) {
-    const route = String(routeType || "").toUpperCase();
-    const pressure = getGemmaTelemetrySnapshot().gemma_memory_pressure;
-    let value = LLM_CONFIG.gemma.numPredict.synthesis;
-
-    if (route.includes("HYBRID") || route.includes("RAG")) {
-        value = LLM_CONFIG.gemma.numPredict.heavy;
-    } else if (route.includes("KG") || route.includes("FAQ")) {
-        value = LLM_CONFIG.gemma.numPredict.light;
-    } else if (route.includes("FALLBACK")) {
-        value = LLM_CONFIG.gemma.numPredict.fallback;
-    }
-
-    if (promptTokenEst >= PROMPT_TOKEN_WARN_THRESHOLD || pressure.high) {
-        value = Math.min(value, LLM_CONFIG.gemma.numPredict.heavy);
-    }
-
-    if (pressure.critical) {
-        value = Math.min(value, LLM_CONFIG.gemma.numPredict.light);
-    }
-
-    return value;
-}
-
-
-// ─────────────────────────────────────────────────────────────
-// SECTION 3 — CONTEXT BUILDERS
-// All builders now return { block, count, used } instead of bare
-// strings. The `used` boolean feeds TASK 6 source attribution.
-// ─────────────────────────────────────────────────────────────
-
-async function runOllamaSynthesis({
-    prompt,
-    resolvedRoute,
-    inferenceOptions,
-    requestId,
-    promptTokenEst,
-    fallbackFromGemini = false,
-    allowBackup = false,
-}) {
-    const ollamaStart = Date.now();
-    const ollamaRequestId = `${fallbackFromGemini ? "unified_ollama_fallback" : "unified_gemma_primary"}_${Date.now()}`;
-    const ollamaModel = MODEL;
-
-    logInfo("synthesis_timeout_budget_resolved", {
-        route: resolvedRoute,
-        requestId: ollamaRequestId,
-        synthesis_timeout_ms: SYNTHESIS_TIMEOUT_MS,
-        synthesis_deadline_ms: SYNTHESIS_DEADLINE_MS,
-        primary_timeout_ms: LLM_CONFIG.timeouts.primaryMs,
-        generation_deadline_ms: LLM_CONFIG.timeouts.generationDeadlineMs,
-        fallback_from_gemini: fallbackFromGemini,
-    });
-
-    const rawAnswer = await generateStableResponse({
-        prompt,
-        model: ollamaModel,
-        requestId: ollamaRequestId,
-        timeoutMs: SYNTHESIS_TIMEOUT_MS,
-        deadlineMs: SYNTHESIS_DEADLINE_MS,
-        options: inferenceOptions,
-        routeType: resolvedRoute,
-        trafficType: fallbackFromGemini ? "synthesis_fallback" : "synthesis",
-        allowBackup,
-    });
-
-    const ollamaLatencyMs = Date.now() - ollamaStart;
-    const ollamaRuntime = getOllamaRuntimeStatus();
-    const ollamaGenerationMeta = getLastGenerationMetadata(ollamaRequestId);
-
-    logInfo("ollama_response_received", {
-        route: resolvedRoute,
-        requestId,
-        ollama_request_id: ollamaRequestId,
-        ollama_latency_ms: ollamaLatencyMs,
-        raw_response_chars: rawAnswer.length,
-        model_used: ollamaGenerationMeta?.model || ollamaRuntime.active_model,
-        breaker_state: ollamaRuntime.breaker_state,
-        failover_active: ollamaRuntime.failover_active,
-        prompt_tokens: ollamaGenerationMeta?.promptTokens || promptTokenEst,
-        output_tokens: ollamaGenerationMeta?.outputTokens || estimateTokens(rawAnswer),
-        fallback_from_gemini: fallbackFromGemini,
-    });
-
-    return {
-        rawAnswer,
-        synthesisProvider: fallbackFromGemini ? "gemma_after_gemini" : "gemma_primary",
-        synthesisLatencyMs: ollamaLatencyMs,
-        ollamaLatencyMs,
-        ollamaRuntime,
-        ollamaGenerationMeta,
-        geminiResult: null,
-        geminiFallbackReason: null,
-    };
-}
-
+import { LLM_CONFIG } from "../src/config/llmConfig.js";
+import { getGemmaTelemetrySnapshot } from "../src/infrastructure/telemetry/gemmaTelemetryService.js";
+import { incrementMetric } from "../src/infrastructure/telemetry/metrics.js";
+import {
+    getRuntimeModeStatus,
+    isGeminiBackupEnabled,
+    isSingleGemmaGenerationMode
+} from "./runtimeMode.js";
+
+// ─────────────────────────────────────────────────────────────
+// SECTION 0 — CONFIGURATION CONSTANTS
+// ─────────────────────────────────────────────────────────────
+
+/** Local model retained for Ollama fallback synthesis. */
+const MODEL = process.env.PRIMARY_MODEL || process.env.OLLAMA_MODEL || "gemma4:e2b";
+
+function timeoutFromEnv(names, fallback) {
+    for (const name of names) {
+        const parsed = Number.parseInt(process.env[name], 10);
+        if (Number.isFinite(parsed)) {
+            return parsed;
+        }
+    }
+
+    return fallback;
+}
+
+const SYNTHESIS_TIMEOUT_MS = timeoutFromEnv(
+    ["SYNTHESIS_TIMEOUT_MS", "OLLAMA_SYNTHESIS_TIMEOUT_MS"],
+    LLM_CONFIG.timeouts.synthesisMs || LLM_CONFIG.timeouts.primaryMs
+);
+
+const SYNTHESIS_DEADLINE_MS = timeoutFromEnv(
+    ["SYNTHESIS_DEADLINE_MS", "LLM_SYNTHESIS_DEADLINE_MS"],
+    LLM_CONFIG.timeouts.synthesisDeadlineMs || LLM_CONFIG.timeouts.generationDeadlineMs
+);
+
+const GEMINI_SYNTHESIS_TIMEOUT_MS = timeoutFromEnv(
+    ["GEMINI_SYNTHESIS_TIMEOUT_MS", "GEMINI_TIMEOUT_MS"],
+    10000
+);
+
+/**
+ * Minimum retrieval confidence score (0–1).
+ * Below this threshold the LLM call is bypassed.
+ */
+const CONFIDENCE_GATE_THRESHOLD = 0.40;
+
+/**
+ * Threshold for degraded operation (0–1).
+ * Between this and the full threshold, we operate in high-caution mode.
+ */
+const DEGRADED_CONFIDENCE_THRESHOLD = 0.25;
+
+/** Maximum KG facts to inject into the prompt. */
+const MAX_KG_FACTS = 3;
+
+/** Maximum RAG passages to inject into the prompt. */
+const MAX_RAG_PASSAGES = 3;
+
+/** Maximum recent non-system conversation messages to expose to synthesis. */
+const MAX_HISTORY_MESSAGES = 4;
+
+/** Maximum characters per conversation-history message. */
+const MAX_HISTORY_MESSAGE_CHARS = 320;
+
+/** Maximum total characters for the conversation-history prompt block. */
+const MAX_HISTORY_TOTAL_CHARS = 1000;
+
+/** Maximum total characters for lightweight session-memory injection. */
+const MAX_MEMORY_BLOCK_CHARS = 500;
+
+/**
+ * Maximum character length for any string value inside the decision
+ * factors block. Values exceeding this are truncated with an ellipsis.
+ */
+const DECISION_MAX_VALUE_CHARS = 200;
+
+/**
+ * Maximum serialization depth for nested objects in the decision factors block.
+ * Objects deeper than this are replaced with a compact placeholder.
+ */
+const DECISION_MAX_DEPTH = 3;
+
+/**
+ * Prompt token count at which a WARNING-level alert is emitted.
+ * Signals the prompt is approaching the model's comfortable context budget.
+ */
+const PROMPT_TOKEN_WARN_THRESHOLD = Math.floor(LLM_CONFIG.gemma.maxContextTokens * 0.80);
+
+/**
+ * Prompt token count at which a CRITICAL-level alert is emitted.
+ * At this size, context truncation by the model is likely, degrading quality.
+ */
+const PROMPT_TOKEN_CRITICAL_THRESHOLD = LLM_CONFIG.gemma.maxContextTokens;
+
+/**
+ * Fallback message returned when the generation system is unavailable.
+ */
+const FALLBACK_ANSWER =
+    "I'm sorry, the answer generation system is currently unavailable. " +
+    "Please try again in a moment or contact your academic advisor directly.";
+
+/**
+ * Returned when context is below confidence threshold or insufficient
+ * to answer without hallucination risk.
+ */
+const INSUFFICIENT_DATA_PHRASE =
+    "I don't have enough verified information to answer that fully. " +
+    "Please consult your academic advisor or the university's official portal for accurate details.";
+
+
+// ─────────────────────────────────────────────────────────────
+// SECTION 1 — ROUTE TYPE REGISTRY
+// ─────────────────────────────────────────────────────────────
+
+/**
+ * Enumeration of supported route types.
+ * @readonly
+ * @enum {string}
+ */
+const ROUTE_TYPES = Object.freeze({
+    KG_ONLY: "KG_ONLY",
+    RAG_ONLY: "RAG_ONLY",
+    FAQ_ONLY: "FAQ_ONLY",
+    DECISION: "DECISION",
+    CAREER: "CAREER",
+    GENERAL: "GENERAL",
+    HYBRID: "HYBRID",
+    LLM_FALLBACK: "LLM_FALLBACK",
+});
+
+/**
+ * TASK 1 — Per-route Ollama inference parameter sets.
+ *
+ * Temperature controls factual precision per route:
+ *   FAQ_ONLY    (0.10) — Near-verbatim reproduction of verified policy wording.
+ *   KG_ONLY     (0.15) — Precise entity/code quoting from structured graph data.
+ *   DECISION    (0.20) — Controlled advisory language from rule engine verdicts.
+ *   RAG_ONLY    (0.25) — Moderate paraphrase latitude for policy summarization.
+ *   HYBRID      (0.30) — Synthesis flexibility needed across heterogeneous sources.
+ *   LLM_FALLBACK(0.05) — Maximum conservatism when evidence is sparse.
+ *
+ * top_p is tightened at lower temperatures to prevent degenerate low-probability
+ * token selection from countering the precision intent of the low temperature.
+ *
+ * repeat_penalty is slightly elevated on LLM_FALLBACK to suppress the
+ * self-referential loops Gemma exhibits when context is thin.
+ *
+ * @type {Record<string, { temperature: number, top_p: number, repeat_penalty: number }>}
+ */
+const ROUTE_INFERENCE_OPTIONS = Object.freeze({
+    [ROUTE_TYPES.KG_ONLY]: { temperature: 0.12, top_p: 0.78, repeat_penalty: 1.16 },
+    [ROUTE_TYPES.FAQ_ONLY]: { temperature: 0.10, top_p: 0.75, repeat_penalty: 1.10 },
+    [ROUTE_TYPES.RAG_ONLY]: { temperature: 0.16, top_p: 0.82, repeat_penalty: 1.16 },
+    [ROUTE_TYPES.DECISION]: { temperature: 0.14, top_p: 0.80, repeat_penalty: 1.15 },
+    [ROUTE_TYPES.CAREER]: { temperature: 0.14, top_p: 0.80, repeat_penalty: 1.15 },
+    [ROUTE_TYPES.GENERAL]: { temperature: 0.16, top_p: 0.82, repeat_penalty: 1.15 },
+    [ROUTE_TYPES.HYBRID]: { temperature: 0.18, top_p: 0.84, repeat_penalty: 1.16 },
+    [ROUTE_TYPES.LLM_FALLBACK]: { temperature: 0.05, top_p: 0.70, repeat_penalty: 1.20 },
+});
+
+/**
+ * Returns the Ollama inference options for a given resolved route type.
+ * Falls back to LLM_FALLBACK options if the route is unrecognised.
+ *
+ * @param {string} resolvedRouteType - A valid ROUTE_TYPES value.
+ * @returns {{ temperature: number, top_p: number, repeat_penalty: number }}
+ */
+function buildInferenceOptions(resolvedRouteType) {
+    return (
+        ROUTE_INFERENCE_OPTIONS[resolvedRouteType] ??
+        ROUTE_INFERENCE_OPTIONS[ROUTE_TYPES.LLM_FALLBACK]
+    );
+}
+
+/**
+ * Per-route behavioral instruction blocks injected into the system prompt.
+ *
+ * TASK 7: RAG_ONLY and HYBRID now include a policy formatting directive
+ * that encourages natural AAST policy anchoring.
+ * This grounds policy answers to the institution's own regulatory voice,
+ * reducing generic-AI phrasing and increasing perceived authority/trust.
+ *
+ * @type {Record<string, string>}
+ */
+const ROUTE_INSTRUCTIONS = {
+    [ROUTE_TYPES.KG_ONLY]: `
+ROUTE: Knowledge Graph Only
+You are answering from verified, structured factual data extracted from the university knowledge graph.
+- Prioritize precision. Quote entity names, course codes, and numeric values exactly as they appear.
+- Do not infer or extend beyond the explicit graph facts provided.
+- If a fact seems contradictory, surface the ambiguity rather than resolving it silently.
+- Omit information that is not directly stated in the Knowledge Graph block.
+`.trim(),
+
+    [ROUTE_TYPES.RAG_ONLY]: `
+ROUTE: Document Retrieval Only
+You are answering from semantically retrieved policy or regulation documents.
+- When the retrieved content contains a policy rule or regulation, anchor it naturally with wording like:
+  "AAST academic regulations state that ..." before explaining the rule.
+- Summarize the relevant policy clearly and accurately.
+- Preserve key regulatory language where critical to meaning.
+- If the passage is partial or appears cut off, acknowledge the limitation and recommend
+  the student verify via the official university portal.
+- Do not supplement retrieved passages with any invented policy detail.
+`.trim(),
+
+    [ROUTE_TYPES.FAQ_ONLY]: `
+ROUTE: FAQ Match
+You are answering from a verified frequently-asked-question entry — the highest confidence source available.
+- Reflect the official answer as precisely as possible while adapting tone to be student-friendly.
+- Do not alter the substance, requirements, or conditions stated in the FAQ answer.
+- If the student's question is slightly different from the matched FAQ, note the exact scope of what is confirmed.
+`.trim(),
+
+    [ROUTE_TYPES.DECISION]: `
+ROUTE: Decision Engine
+You are presenting the outcome and reasoning of a rule-based decision engine evaluation.
+- Lead with the decision outcome clearly (eligible / not eligible / conditional / etc.).
+- Walk through each factor the engine evaluated in plain language.
+- Be advisory and constructive — if the outcome is negative, suggest next steps where
+  inferable from the factors.
+- Do not soften or contradict the engine's verdict; present it professionally.
+`.trim(),
+
+    [ROUTE_TYPES.CAREER]: `
+ROUTE: Career Engine
+You are presenting a verified academic-to-career roadmap.
+- Lead with the target role or pathway clearly.
+- Explain the top skills, progression logic, and academic preparation steps from the provided evidence.
+- Keep the response practical and student-friendly.
+- Do not invent market claims, certifications, or university rules not present in the context.
+`.trim(),
+
+    [ROUTE_TYPES.GENERAL]: `
+ROUTE: General Academic Guidance
+You are answering with the best verified academic context available.
+- Prefer grounded academic guidance over broad motivational language.
+- If the context is partial, state the limitation clearly.
+- Do not imply policy certainty unless verified policy evidence is present.
+- Keep the response useful, cautious, and professionally phrased.
+`.trim(),
+
+    [ROUTE_TYPES.HYBRID]: `
+ROUTE: Hybrid (Multi-Source)
+You are synthesizing from multiple verified sources of different types.
+- Prioritize in order: FAQ answer → Knowledge Graph facts → Decision factors → Retrieved documents.
+- Use each source for what it does best: FAQ for confirmed policy wording, Decision for eligibility
+  verdict, KG for specific entities and relationships, RAG for regulatory depth.
+- Where the answer draws on policy or regulatory documents, anchor it naturally with wording like:
+  "AAST academic regulations state that ..." before explaining the rule.
+- Where sources overlap and agree, synthesize them seamlessly.
+- Where sources differ, surface the most authoritative source and note any discrepancy.
+- Do not blend uncertain and certain facts without clearly distinguishing confidence levels.
+`.trim(),
+
+    [ROUTE_TYPES.LLM_FALLBACK]: `
+ROUTE: LLM Fallback (Low Confidence)
+You are operating in maximum-caution mode because retrieval confidence is low or no structured context was returned.
+- Be extremely conservative. Only state what is directly and explicitly in the provided context.
+- If the context does not contain a clear answer, respond with the insufficient-data phrase — do not attempt to infer.
+- Do not attempt to recall or apply any university-specific knowledge not present in the context.
+- Encourage the student to verify with their official academic advisor or university portal.
+`.trim(),
+};
+
+const EMPTY_GRAPH = Object.freeze({ nodes: [], links: [] });
+
+
+// ─────────────────────────────────────────────────────────────
+// SECTION 2 — OBSERVABILITY LAYER
+// ─────────────────────────────────────────────────────────────
+
+/**
+ * Emits a structured INFO-level log to stdout.
+ * @param {string} event
+ * @param {object} [payload]
+ */
+function logInfo(event, payload = {}) {
+    console.log(JSON.stringify({
+        level: "INFO",
+        service: "UnifiedAnswerService",
+        event,
+        timestamp: new Date().toISOString(),
+        ...payload,
+    }));
+}
+
+/**
+ * Emits a structured WARN-level log to stdout.
+ * @param {string} event
+ * @param {object} [payload]
+ */
+function logWarn(event, payload = {}) {
+    console.warn(JSON.stringify({
+        level: "WARN",
+        service: "UnifiedAnswerService",
+        event,
+        timestamp: new Date().toISOString(),
+        ...payload,
+    }));
+}
+
+/**
+ * Emits a structured ERROR-level log to stderr.
+ * @param {string} event
+ * @param {object} [payload]
+ */
+function logError(event, payload = {}) {
+    console.error(JSON.stringify({
+        level: "ERROR",
+        service: "UnifiedAnswerService",
+        event,
+        timestamp: new Date().toISOString(),
+        ...payload,
+    }));
+}
+
+/**
+ * Estimates prompt token count via chars/4 heuristic.
+ * Sufficient for budget alerting without a tokenizer dependency.
+ *
+ * @param {string} text
+ * @returns {number}
+ */
+function estimateTokens(text) {
+    return Math.ceil((text ?? "").length / 4);
+}
+
+function hardTruncateToTokenBudget(text, maxTokens) {
+    const value = String(text ?? "");
+    const maxChars = Math.max(0, maxTokens * 4);
+
+    if (estimateTokens(value) <= maxTokens) {
+        return { text: value, truncated: false };
+    }
+
+    return {
+        text:
+            value.slice(0, Math.max(0, maxChars)).trimEnd() +
+            "\n\n[Lower-priority context truncated to protect Gemma context budget.]",
+        truncated: true,
+    };
+}
+
+function routeNumPredict(routeType, promptTokenEst = 0) {
+    const route = String(routeType || "").toUpperCase();
+    const pressure = getGemmaTelemetrySnapshot().gemma_memory_pressure;
+    let value = LLM_CONFIG.gemma.numPredict.synthesis;
+
+    if (route.includes("HYBRID") || route.includes("RAG")) {
+        value = LLM_CONFIG.gemma.numPredict.heavy;
+    } else if (route.includes("KG") || route.includes("FAQ")) {
+        value = LLM_CONFIG.gemma.numPredict.light;
+    } else if (route.includes("FALLBACK")) {
+        value = LLM_CONFIG.gemma.numPredict.fallback;
+    }
+
+    if (promptTokenEst >= PROMPT_TOKEN_WARN_THRESHOLD || pressure.high) {
+        value = Math.min(value, LLM_CONFIG.gemma.numPredict.heavy);
+    }
+
+    if (pressure.critical) {
+        value = Math.min(value, LLM_CONFIG.gemma.numPredict.light);
+    }
+
+    return value;
+}
+
+
+// ─────────────────────────────────────────────────────────────
+// SECTION 3 — CONTEXT BUILDERS
+// All builders now return { block, count, used } instead of bare
+// strings. The `used` boolean feeds TASK 6 source attribution.
+// ─────────────────────────────────────────────────────────────
+
+async function runOllamaSynthesis({
+    prompt,
+    resolvedRoute,
+    inferenceOptions,
+    requestId,
+    promptTokenEst,
+    fallbackFromGemini = false,
+}) {
+    const ollamaStart = Date.now();
+    const ollamaRequestId = `${fallbackFromGemini ? "unified_ollama_fallback" : "unified"}_${Date.now()}`;
+    const ollamaModel = fallbackFromGemini
+        ? (process.env.OLLAMA_FORMATTER_MODEL || LLM_CONFIG.backupModel || MODEL)
+        : MODEL;
+
+    logInfo("synthesis_timeout_budget_resolved", {
+        route: resolvedRoute,
+        requestId: ollamaRequestId,
+        synthesis_timeout_ms: SYNTHESIS_TIMEOUT_MS,
+        synthesis_deadline_ms: SYNTHESIS_DEADLINE_MS,
+        primary_timeout_ms: LLM_CONFIG.timeouts.primaryMs,
+        generation_deadline_ms: LLM_CONFIG.timeouts.generationDeadlineMs,
+        fallback_from_gemini: fallbackFromGemini,
+    });
+
+    const rawAnswer = await generateStableResponse({
+        prompt,
+        model: ollamaModel,
+        requestId: ollamaRequestId,
+        timeoutMs: SYNTHESIS_TIMEOUT_MS,
+        deadlineMs: SYNTHESIS_DEADLINE_MS,
+        options: inferenceOptions,
+        routeType: resolvedRoute,
+        trafficType: fallbackFromGemini ? "synthesis_fallback" : "synthesis",
+    });
+
+    const ollamaLatencyMs = Date.now() - ollamaStart;
+    const ollamaRuntime = getOllamaRuntimeStatus();
+    const ollamaGenerationMeta = getLastGenerationMetadata(ollamaRequestId);
+
+    logInfo("ollama_response_received", {
+        route: resolvedRoute,
+        requestId,
+        ollama_request_id: ollamaRequestId,
+        ollama_latency_ms: ollamaLatencyMs,
+        raw_response_chars: rawAnswer.length,
+        model_used: ollamaGenerationMeta?.model || ollamaRuntime.active_model,
+        breaker_state: ollamaRuntime.breaker_state,
+        failover_active: ollamaRuntime.failover_active,
+        prompt_tokens: ollamaGenerationMeta?.promptTokens || promptTokenEst,
+        output_tokens: ollamaGenerationMeta?.outputTokens || estimateTokens(rawAnswer),
+        fallback_from_gemini: fallbackFromGemini,
+    });
+
+    return {
+        rawAnswer,
+        synthesisProvider: fallbackFromGemini ? "ollama_fallback" : "ollama",
+        synthesisLatencyMs: ollamaLatencyMs,
+        ollamaLatencyMs,
+        ollamaRuntime,
+        ollamaGenerationMeta,
+        geminiResult: null,
+        geminiFallbackReason: null,
+    };
+}
+
 async function runFinalSynthesis({
     prompt,
     resolvedRoute,
@@ -493,66 +497,15 @@ async function runFinalSynthesis({
     promptTokenEst,
     deterministicFallbackAnswer = "",
 }) {
-    let gemmaPrimaryFailureReason = null;
-
-    try {
-        console.log(`[GEMMA_SYNTHESIS_ACTIVE][${requestId}] route=${resolvedRoute}`);
-        const gemmaResult = await runOllamaSynthesis({
-            prompt,
-            resolvedRoute,
-            inferenceOptions,
-            requestId,
-            promptTokenEst,
-            allowBackup: false,
-        });
-
-        return {
-            ...gemmaResult,
-            geminiFallbackReason: null,
-            deterministicFallbackUsed: false,
-        };
-    } catch (gemmaError) {
-        const gemmaReason = gemmaError?.code || gemmaError?.message || "GEMMA_ERROR";
-        gemmaPrimaryFailureReason = {
-            reason: gemmaReason,
-            status: gemmaError?.status,
-        };
-        console.warn(`[GEMMA_PRIMARY_FAILED][${requestId}] route=${resolvedRoute} reason=${gemmaReason}`);
-        logWarn("gemma_primary_failed", {
-            route: resolvedRoute,
-            requestId,
-            reason: gemmaReason,
-            status: gemmaError?.status,
-        });
-    }
-
-    if (runtimeMode.geminiBackupEnabled === false) {
-        if (deterministicFallbackAnswer) {
-            incrementMetric("deterministic_fallback_total");
-            return {
-                rawAnswer: deterministicFallbackAnswer,
-                synthesisProvider: "deterministic_context_fallback",
-                synthesisLatencyMs: 0,
-                ollamaLatencyMs: null,
-                ollamaRuntime: getOllamaRuntimeStatus(),
-                ollamaGenerationMeta: null,
-                geminiResult: null,
-                geminiFallbackReason: {
-                    reason: "GEMINI_BACKUP_DISABLED",
-                    timeout: false,
-                },
-                gemmaPrimaryFailureReason,
-                deterministicFallbackUsed: true,
-            };
-        }
-
-        throw new Error("Gemma primary failed and Gemini backup is disabled.");
-    }
-
     const geminiRequestId = `gemini_${Date.now()}`;
+    const runtimeMode = getRuntimeModeStatus();
+
+    const runGeminiBackup = async (gemmaError = null) => {
+        console.warn(
+            `[GEMINI_BACKUP_ACTIVE][${requestId}] route=${resolvedRoute} reason=${gemmaError?.code || gemmaError?.message || "GEMMA_PRIMARY_FAILED"}`
+        );
+        incrementMetric("gemini_fallback_total");
 
-    try {
-        console.log(`[GEMINI_BACKUP_ACTIVE][${requestId}] route=${resolvedRoute}`);
         const geminiResult = await generateGeminiSynthesis({
             prompt,
             requestId: geminiRequestId,
@@ -563,8 +516,7 @@ async function runFinalSynthesis({
         console.log(
             `[GEMINI_BACKUP_SUCCESS][${requestId}] route=${resolvedRoute} latency_ms=${geminiResult.latencyMs}`
         );
-        incrementMetric("gemini_fallback_total");
-        logInfo("gemini_response_received", {
+        logInfo("gemini_backup_response_received", {
             route: resolvedRoute,
             requestId,
             gemini_request_id: geminiRequestId,
@@ -574,6 +526,7 @@ async function runFinalSynthesis({
             prompt_tokens: geminiResult.promptTokens || promptTokenEst,
             output_tokens: geminiResult.outputTokens || estimateTokens(geminiResult.text),
             finish_reason: geminiResult.finishReason,
+            primary_error: gemmaError?.code || gemmaError?.message || null,
         });
 
         return {
@@ -584,10 +537,114 @@ async function runFinalSynthesis({
             ollamaRuntime: getOllamaRuntimeStatus(),
             ollamaGenerationMeta: null,
             geminiResult,
-            geminiFallbackReason: null,
-            gemmaPrimaryFailureReason,
+            geminiFallbackReason: gemmaError
+                ? {
+                    reason: gemmaError?.code || gemmaError?.message || "GEMMA_PRIMARY_FAILED",
+                    status: gemmaError?.status,
+                    timeout: String(gemmaError?.message || "").toLowerCase().includes("timeout"),
+                }
+                : null,
             deterministicFallbackUsed: false,
         };
+    };
+
+    if (isSingleGemmaGenerationMode()) {
+        logInfo("single_gemma_generation_mode_active", {
+            route: resolvedRoute,
+            requestId,
+            runtimeMode,
+        });
+
+        try {
+            const gemmaResult = await runOllamaSynthesis({
+                prompt,
+                resolvedRoute,
+                inferenceOptions,
+                requestId,
+                promptTokenEst,
+                fallbackFromGemini: false,
+            });
+
+            return {
+                ...gemmaResult,
+                deterministicFallbackUsed: false,
+            };
+        } catch (gemmaError) {
+            const reason = gemmaError?.code || gemmaError?.message || "GEMMA_PRIMARY_FAILED";
+            const timeout = String(reason).toLowerCase().includes("timeout");
+
+            console.warn(`[GEMMA_PRIMARY_FAILED][${requestId}] route=${resolvedRoute} reason=${reason}`);
+            logWarn("gemma_primary_failed", {
+                route: resolvedRoute,
+                requestId,
+                reason,
+                status: gemmaError?.status,
+                timeout,
+                gemini_backup_enabled: isGeminiBackupEnabled(),
+            });
+
+            if (isGeminiBackupEnabled()) {
+                try {
+                    return await runGeminiBackup(gemmaError);
+                } catch (geminiError) {
+                    const geminiReason = geminiError?.code || geminiError?.message || "GEMINI_BACKUP_FAILED";
+                    const geminiTimeout = isGeminiTimeoutError(geminiError);
+
+                    console.warn(`[GEMINI_BACKUP_FAILED][${requestId}] route=${resolvedRoute} reason=${geminiReason}`);
+                    logWarn("gemini_backup_failed", {
+                        route: resolvedRoute,
+                        requestId,
+                        gemini_request_id: geminiRequestId,
+                        reason: geminiReason,
+                        status: geminiError?.status,
+                        timeout: geminiTimeout,
+                    });
+
+                    if (deterministicFallbackAnswer) {
+                        incrementMetric("deterministic_fallback_total");
+                        return {
+                            rawAnswer: deterministicFallbackAnswer,
+                            synthesisProvider: "deterministic_context_fallback",
+                            synthesisLatencyMs: 0,
+                            ollamaLatencyMs: null,
+                            ollamaRuntime: getOllamaRuntimeStatus(),
+                            ollamaGenerationMeta: null,
+                            geminiResult: null,
+                            geminiFallbackReason: {
+                                reason: geminiReason,
+                                status: geminiError?.status,
+                                timeout: geminiTimeout,
+                            },
+                            deterministicFallbackUsed: true,
+                        };
+                    }
+
+                    throw geminiError;
+                }
+            }
+
+            if (deterministicFallbackAnswer) {
+                incrementMetric("deterministic_fallback_total");
+                return {
+                    rawAnswer: deterministicFallbackAnswer,
+                    synthesisProvider: "deterministic_context_fallback",
+                    synthesisLatencyMs: 0,
+                    ollamaLatencyMs: null,
+                    ollamaRuntime: getOllamaRuntimeStatus(),
+                    ollamaGenerationMeta: null,
+                    geminiResult: null,
+                    geminiFallbackReason: null,
+                    deterministicFallbackUsed: true,
+                };
+            }
+
+            throw gemmaError;
+        }
+    }
+
+    try {
+        console.log(`[GEMINI_SYNTHESIS_ACTIVE][${requestId}] route=${resolvedRoute}`);
+        return await runGeminiBackup();
     } catch (geminiError) {
         const timeout = isGeminiTimeoutError(geminiError);
         const reason = geminiError?.code || geminiError?.message || "GEMINI_ERROR";
@@ -596,8 +653,8 @@ async function runFinalSynthesis({
             console.warn(`[GEMINI_TIMEOUT][${requestId}] route=${resolvedRoute}`);
         }
 
-        console.warn(`[GEMINI_BACKUP_FAILED][${requestId}] route=${resolvedRoute} reason=${reason}`);
-        logWarn("gemini_backup_failed", {
+        console.warn(`[GEMINI_FALLBACK_TRIGGERED][${requestId}] route=${resolvedRoute} reason=${reason}`);
+        logWarn("gemini_fallback_triggered", {
             route: resolvedRoute,
             requestId,
             gemini_request_id: geminiRequestId,
@@ -608,7 +665,7 @@ async function runFinalSynthesis({
 
         if (deterministicFallbackAnswer) {
             incrementMetric("deterministic_fallback_total");
-            logWarn("gemini_backup_to_deterministic_context", {
+            logWarn("gemini_fallback_to_deterministic_context", {
                 route: resolvedRoute,
                 requestId,
                 gemini_request_id: geminiRequestId,
@@ -628,2019 +685,2037 @@ async function runFinalSynthesis({
                     status: geminiError?.status,
                     timeout,
                 },
-                gemmaPrimaryFailureReason,
                 deterministicFallbackUsed: true,
             };
         }
 
-        throw geminiError;
-    }
-}
-
-function cleanGraphNodeLabel(value) {
-    let text = String(value || "").trim();
-    if (!text) return "";
-
-    const quoted = text.match(/"([^"]+)"/) || text.match(/'([^']+)'/);
-    if (quoted) return quoted[1].trim();
-
-    const propertyName = text.match(/\b(?:name|title|code|id)\s*:\s*["']?([^"',}]+)["']?/i);
-    if (propertyName) return propertyName[1].trim();
-
-    if (text.includes(":")) {
-        const parts = text.split(":");
-        text = parts[parts.length - 1].trim();
-    }
-
-    return text
-        .replace(/[{}]/g, "")
-        .replace(/\s+/g, " ")
-        .trim();
-}
-
-function cleanGraphRelationLabel(value) {
-    let text = String(value || "").trim();
-    if (!text) return "";
-    if (text.includes(":")) text = text.split(":").pop();
-    return text
-        .replace(/[`"']/g, "")
-        .replace(/\s+/g, "_")
-        .toUpperCase();
-}
-
-function relationToSentence(source, relation, target) {
-    if (!source || !relation || !target) return null;
-
-    const relationText = relation.toLowerCase().replace(/_/g, " ");
-
-    switch (relation) {
-        case "TEACHES":
-            return `${source} teaches ${target}.`;
-        case "HAS_PREREQUISITE":
-        case "REQUIRES":
-            return `${source} requires ${target}.`;
-        case "PREREQUISITE_FOR":
-            return `${source} is a prerequisite for ${target}.`;
-        case "HAS_COURSE":
-            return `${source} includes ${target}.`;
-        case "HEAD_OF":
-        case "HEAD_OF_UNIT":
-            return `${source} is head of ${target}.`;
-        case "DEAN_OF":
-            return `${source} is dean of ${target}.`;
-        case "HAS_ROLE":
-        case "ACTS_AS":
-            return `${source} serves as ${target}.`;
-        case "WORKS_IN":
-            return `${source} works in ${target}.`;
-        case "MEMBER_OF":
-            return `${source} is a member of ${target}.`;
-        case "BELONGS_TO":
-            return `${source} belongs to ${target}.`;
-        case "ADMINISTERS":
-        case "CHAIRS":
-        case "DIRECTS":
-        case "MANAGES":
-            return `${source} ${relationText} ${target}.`;
-        default:
-            return `${source} has ${relationText} relationship with ${target}.`;
-    }
-}
-
-function graphTripleToSentence(sourceRaw, relationRaw, targetRaw) {
-    const source = cleanGraphNodeLabel(sourceRaw);
-    const relation = cleanGraphRelationLabel(relationRaw);
-    const target = cleanGraphNodeLabel(targetRaw);
-    return relationToSentence(source, relation, target);
-}
-
-function normalizeGraphEvidence(text) {
-    let normalized = String(text || "").replace(/\s+/g, " ").trim();
-    if (!normalized) return "";
-
-    const graphTriplePattern =
-        /\(([^()]+)\)\s*-+\s*\[\s*:?\s*([A-Za-z0-9_]+(?::[A-Za-z0-9_]+)?)\s*\]\s*-+>\s*\(([^()]+)\)/g;
-
-    normalized = normalized.replace(graphTriplePattern, (match, source, relation, target) =>
-        graphTripleToSentence(source, relation, target) || match
-    );
-
-    const propertyPattern = /^\(([^:()]+):\s*["']?([^"')]+)["']?\)\s+([A-Za-z0-9_ ]+):\s*(.+)$/;
-    const propertyMatch = normalized.match(propertyPattern);
-    if (propertyMatch) {
-        const entityName = propertyMatch[2].trim();
-        const propertyName = propertyMatch[3].trim().toLowerCase().replace(/_/g, " ");
-        const propertyValue = propertyMatch[4].trim();
-        return `${entityName} ${propertyName}: ${propertyValue}`;
-    }
-
-    return normalized;
-}
-
-/**
- * Builds a readable text block from Neo4j Knowledge Graph results.
- * Sorts by confidence descending, caps at MAX_KG_FACTS.
- *
- * @param {Array<{ evidence?: string, confidence?: number, metadata?: object }>} neo4jContext
- * @param {number} [limit=MAX_KG_FACTS]
- * @returns {{ block: string, count: number, used: boolean }}
- */
-function buildNeo4jBlock(neo4jContext, limit = MAX_KG_FACTS) {
-    if (!Array.isArray(neo4jContext) || neo4jContext.length === 0) {
-        return { block: "", count: 0, used: false };
-    }
-
-    const sorted = [...neo4jContext].sort((a, b) =>
-        (b.confidence ?? 0) - (a.confidence ?? 0)
-    );
-    const capped = sorted.slice(0, limit);
-
-    const lines = capped
-        .map((item, idx) => {
-            if (!item || typeof item !== "object") return null;
-            const rawEvidence = normalizeGraphEvidence(item.evidence ?? item.text ?? item.content ?? "");
-            const evidence = rawEvidence.length > 520
-                ? `${rawEvidence.slice(0, 520).trimEnd()}\u2026[truncated]`
-                : rawEvidence;
-            if (!evidence) return null;
-
-            const confidenceLabel =
-                typeof item.confidence === "number"
-                    ? ` [confidence: ${Math.round(item.confidence * 100)}%]`
-                    : "";
-
-            const meta = item.metadata ?? {};
-            const metaParts = [];
-            if (meta.source) metaParts.push(`source: ${meta.source}`);
-            if (typeof meta.node_count === "number") metaParts.push(`nodes: ${meta.node_count}`);
-            if (typeof meta.rel_count === "number") metaParts.push(`rels: ${meta.rel_count}`);
-            const metaLabel = metaParts.length > 0 ? ` (${metaParts.join(", ")})` : "";
-
-            return `  [KG-${idx + 1}]${confidenceLabel} ${evidence}${metaLabel}`;
-        })
-        .filter(Boolean);
-
-    if (lines.length === 0) return { block: "", count: 0, used: false };
-
-    const block =
-        "### Knowledge Graph Facts (Neo4j — Verified Structured Data)\n" +
-        lines.join("\n");
-
-    return { block, count: lines.length, used: true };
-}
-
-/**
- * Builds a readable text block from RAG-retrieved document chunks.
- * Accepts { results } envelope, raw array, or pre-joined string.
- * Caps at limit (default MAX_RAG_PASSAGES).
- *
- * @param {{ results?: Array<object> } | Array<object> | string | null} ragContext
- * @param {number} [limit=MAX_RAG_PASSAGES]
- * @returns {{ block: string, count: number, used: boolean }}
- */
-function buildRagBlock(ragContext, limit = MAX_RAG_PASSAGES) {
-    if (!ragContext) return { block: "", count: 0, used: false };
-
-    let unwrapped = ragContext;
-    if (
-        typeof ragContext === "object" &&
-        !Array.isArray(ragContext) &&
-        Array.isArray(ragContext.results)
-    ) {
-        unwrapped = ragContext.results;
-    }
-
-    let passages = [];
-
-    if (typeof unwrapped === "string") {
-        passages = unwrapped.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
-    } else if (Array.isArray(unwrapped)) {
-        passages = unwrapped
-            .map(item => {
-                if (typeof item === "string") return item.trim();
-                if (item && typeof item === "object") {
-                    return (item.text ?? item.content ?? item.pageContent ?? "").trim();
-                }
-                return "";
-            })
-            .filter(Boolean);
-    }
-
-    if (passages.length === 0) return { block: "", count: 0, used: false };
-
-    const capped = passages.slice(0, limit).map((passage) =>
-        passage.length > 600
-            ? `${passage.slice(0, 600).trimEnd()}\u2026[truncated]`
-            : passage
-    );
-
-    const block =
-        "### Retrieved Document Context (RAG — Verified Passages)\n" +
-        capped.join("\n\n");
-
-    return { block, count: capped.length, used: true };
-}
-
-/**
- * Builds a readable text block from an FAQ system result.
- * FAQ is the highest-confidence source; placed first in context.
- *
- * @param {{ question?: string; answer?: string; source?: string } | null} faqContext
- * @returns {{ block: string, count: number, used: boolean }}
- */
-function buildFaqBlock(faqContext) {
-    if (!faqContext || typeof faqContext !== "object") return { block: "", count: 0, used: false };
-
-    const question = faqContext.question?.trim() ?? "";
-    const answer = faqContext.answer?.trim() ?? "";
-    const source = faqContext.source?.trim() ?? "";
-
-    if (!answer) return { block: "", count: 0, used: false };
-
-    let block = "### FAQ Match (Highest-Confidence — Official Policy Wording)\n";
-    if (question) block += `  Question : ${question}\n`;
-    block += `  Answer   : ${answer}`;
-    if (source) block += `\n  Source   : ${source}`;
-
-    return { block, count: 1, used: true };
-}
-
-
-// ─────────────────────────────────────────────────────────────
-// SECTION 3a — DECISION BLOCK SAFE SERIALIZATION
-// TASK 5: Depth-limited, value-truncated serialization prevents
-// deeply nested rule engine results from bloating the prompt.
-// ─────────────────────────────────────────────────────────────
-
-/**
- * Recursively serializes an arbitrary value to a prompt-safe representation
- * with configurable depth and string-value length limits.
- *
- * Depth-limiting strategy:
- *   - Primitives are always serialized.
- *   - Arrays at depth >= maxDepth are summarized as "[N items]".
- *   - Objects at depth >= maxDepth are replaced with "[object]".
- *   - String values longer than maxStringChars are truncated with "…[truncated]".
- *
- * This prevents the common failure mode where nested prerequisite trees or
- * rule engine payloads flood the prompt with hundreds of irrelevant tokens
- * that crowd out base instructions and route directives.
- *
- * @param {unknown}  value
- * @param {number}   maxDepth       - Max nesting depth.
- * @param {number}   maxStringChars - Max chars for any single string value.
- * @param {number}   [_depth=0]     - Current recursion depth (internal use only).
- * @returns {unknown}                 Prompt-safe representation of value.
- */
-function depthLimitedSerialize(
-    value,
-    maxDepth = DECISION_MAX_DEPTH,
-    maxStringChars = DECISION_MAX_VALUE_CHARS,
-    _depth = 0
-) {
-    if (value === null || value === undefined) return value;
-
-    if (typeof value === "string") {
-        return value.length > maxStringChars
-            ? `${value.slice(0, maxStringChars)}\u2026[truncated]`
-            : value;
-    }
-
-    if (typeof value === "number" || typeof value === "boolean") return value;
-
-    if (_depth >= maxDepth) {
-        if (Array.isArray(value)) return `[${value.length} items]`;
-        if (typeof value === "object") return "[object]";
-        return String(value);
-    }
-
-    if (Array.isArray(value)) {
-        return value.map(item =>
-            depthLimitedSerialize(item, maxDepth, maxStringChars, _depth + 1)
-        );
-    }
-
-    if (typeof value === "object") {
-        const result = {};
-        for (const [k, v] of Object.entries(value)) {
-            result[k] = depthLimitedSerialize(v, maxDepth, maxStringChars, _depth + 1);
-        }
-        return result;
-    }
-
-    return String(value);
-}
-
-/**
- * Builds a readable text block from the decision engine's `factors` object.
- * Uses depth-limited serialization to prevent prompt token overflow.
- *
- * @param {Record<string, unknown> | null} decisionContext
- * @returns {{ block: string, count: number, used: boolean }}
- */
-function buildDecisionBlock(decisionContext) {
-    const normalizedDecisionContext =
-        Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;
-
-    if (
-        !normalizedDecisionContext ||
-        typeof normalizedDecisionContext !== "object" ||
-        Array.isArray(normalizedDecisionContext) ||
-        Object.keys(normalizedDecisionContext).length === 0
-    ) {
-        return { block: "", count: 0, used: false };
-    }
-
-    let summary;
-    try {
-        const safe = depthLimitedSerialize(normalizedDecisionContext);
-
-        const factorLines = Object.entries(safe).map(([k, v]) => {
-            const displayValue =
-                typeof v === "object" && v !== null
-                    ? JSON.stringify(v)
-                    : String(v);
-            return `  \u2022 ${k}: ${displayValue}`;
-        });
-        summary = factorLines.join("\n");
-    } catch {
-        logWarn("decision_block_serialize_failed", {
-            reason: "factors object could not be serialized safely — block skipped",
+        console.warn(`[GEMINI_FALLBACK_TO_OLLAMA][${requestId}] route=${resolvedRoute} reason=${reason}`);
+        logWarn("gemini_fallback_to_ollama", {
+            route: resolvedRoute,
+            requestId,
+            gemini_request_id: geminiRequestId,
+            reason,
+            status: geminiError?.status,
+            timeout,
         });
-        return { block: "", count: 0, used: false };
-    }
-
-    const block =
-        "### Decision Engine Factors (Rule-Based Engine — Verified Logic)\n" +
-        summary;
-
-    return { block, count: Object.keys(normalizedDecisionContext).length, used: true };
-}
 
-/**
- * PROMPT AUTO-TRIMMING (Phase 3 Stabilization)
- * ───────────────────────────────────────────
- * Proactively reduces context sizes based on prompt budget thresholds.
- *
- * @param {number} currentTokens
- * @returns {object} Trimmed limits for builders
- */
-function trimContextToBudget(currentTokens) {
-    const config = {
-        kgFacts: MAX_KG_FACTS,
-        ragPassages: MAX_RAG_PASSAGES,
-        includeRag: true,
-        includeKg: true,
-        includeDecision: true,
-        includeFaq: true,
-    };
+        const fallback = await runOllamaSynthesis({
+            prompt,
+            resolvedRoute,
+            inferenceOptions,
+            requestId,
+            promptTokenEst,
+            fallbackFromGemini: true,
+        });
 
-    if (currentTokens >= PROMPT_TOKEN_CRITICAL_THRESHOLD) {
-        logWarn("context_trimming_critical", { tokens: currentTokens });
-        // Drop low-priority context first while preserving KG and decision facts.
-        config.includeRag = false;
-        config.kgFacts = Math.max(1, MAX_KG_FACTS);
-        config.includeKg = true;
-        config.includeDecision = true;
-    } else if (currentTokens >= PROMPT_TOKEN_WARN_THRESHOLD) {
-        logWarn("context_trimming_warning", { tokens: currentTokens });
-        config.kgFacts = MAX_KG_FACTS;
-        config.ragPassages = Math.max(1, Math.floor(MAX_RAG_PASSAGES / 2));
+        return {
+            ...fallback,
+            geminiFallbackReason: {
+                reason,
+                status: geminiError?.status,
+                timeout,
+            },
+            deterministicFallbackUsed: false,
+        };
     }
-
-    return config;
-}
-
-/**
- * Aggregates all context blocks into a single composite payload.
- * Priority ordering: FAQ (1st) → Decision (2nd) → KG (3rd) → RAG (4th).
- *
- * TASK 6: Computes sources_used attribution booleans from builder results.
- *
- * @param {object} params
- * @param {object} [trimConfig]
- * @returns {{ payload: string, metrics: object, sources_used: SourcesUsed }}
- */
-function buildContextPayload({ neo4jContext, ragContext, faqContext, decisionContext }, trimConfig = null) {
-    const config = trimConfig || {
-        kgFacts: MAX_KG_FACTS,
-        ragPassages: MAX_RAG_PASSAGES,
-        includeRag: true,
-        includeKg: true,
-        includeDecision: true,
-        includeFaq: true
-    };
-
-    const faqResult = config.includeFaq ? buildFaqBlock(faqContext) : { block: "", count: 0, used: false };
-    const decisionResult = config.includeDecision ? buildDecisionBlock(decisionContext) : { block: "", count: 0, used: false };
-    const kgResult = config.includeKg ? buildNeo4jBlock(neo4jContext, config.kgFacts) : { block: "", count: 0, used: false };
-    const ragResult = config.includeRag ? buildRagBlock(ragContext, config.ragPassages) : { block: "", count: 0, used: false };
-
-    // Priority order: FAQ direct answer, then KG facts > Decision > RAG.
-    const orderedBlocks = [
-        faqResult.block,
-        kgResult.block,
-        decisionResult.block,
-        ragResult.block,
-    ].filter(Boolean);
-
-    const payload = orderedBlocks.join("\n\n");
-
-    /**
-     * TASK 6 — Source attribution: which builders produced non-empty content.
-     * @type {SourcesUsed}
-     */
-    const sources_used = {
-        faq: faqResult.used,
-        decision: decisionResult.used,
-        kg: kgResult.used,
-        rag: ragResult.used,
-    };
-
-    const metrics = {
-        faq_entries: faqResult.count,
-        decision_factors: decisionResult.count,
-        kg_facts: kgResult.count,
-        rag_passages: ragResult.count,
-        total_blocks: orderedBlocks.length,
-        payload_chars: payload.length,
-        payload_tokens_est: estimateTokens(payload),
-        sources_used,
-    };
-
-    return { payload, metrics, sources_used };
-}
-
-/**
- * PHASE 8.5 — DETERMINISTIC HYBRID FUSION SYNTHESIS
- * Merges top KG facts and top RAG passages into a coherent advisory response
- * without LLM inference. Ensures recruiter-grade coverage of both domains.
- *
- * @param {Array} neo4jContext
- * @param {Array} ragContext
- * @returns {string} Fused hybrid answer
- */
-function buildDeterministicHybridAnswer(neo4jContext, ragContext) {
-    const kgFacts = extractKgFacts(neo4jContext, 2);
-    const ragFacts = extractRagFacts(ragContext, 2);
-
-    if (kgFacts.length === 0 && ragFacts.length === 0) return "";
-
-    const parts = [];
-
-    if (kgFacts.length > 0) {
-        parts.push(kgFacts.join(" "));
-    }
-
-    if (ragFacts.length > 0) {
-        const ragIntro = "AAST academic regulations: ";
-        parts.push(ragIntro + ragFacts.join(" "));
-    }
-
-    return parts.join("\n\n").trim();
-}
-
-/**
- * DETERMINISTIC FALLBACK BUILDER (Phase 3 Stabilization)
- * ──────────────────────────────────────────────────
- * Synthesizes a verified answer from structured context without LLM inference.
- * Used as a primary safety net for LLM failures or timeouts.
- */
-function buildDeterministicFallbackAnswer({ faqContext, decisionContext, neo4jContext, ragContext }) {
-    const normalizedDecisionContext =
-        Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;
-
-    // 1. FAQ answer (Highest precision)
-    if (faqContext?.answer) {
-        return `According to verified university policy: ${faqContext.answer}`;
-    }
-
-    // 2. Decision summary
-    if (normalizedDecisionContext) {
-        const outcome =
-            normalizedDecisionContext.outcome ||
-            normalizedDecisionContext.verdict ||
-            normalizedDecisionContext.recommendation ||
-            normalizedDecisionContext.career_path;
-        if (outcome) {
-            return `Based on verified academic evaluation: The advisory system has determined the outcome is: ${outcome}. Please contact your advisor for full details.`;
-        }
-    }
-
-    // 3. KG top fact
-    if (Array.isArray(neo4jContext) && neo4jContext.length > 0) {
-        const sorted = [...neo4jContext].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
-        const topFact = sorted[0];
-        const evidence = normalizeGraphEvidence(topFact?.evidence || topFact?.text || topFact?.content);
-        if (evidence) {
-            return `According to verified university records: ${evidence}`;
-        }
-    }
-
-    // 4. RAG summary (First passage)
-    if (ragContext) {
-        let firstPassage = "";
-        if (Array.isArray(ragContext) && ragContext[0]) {
-            firstPassage = typeof ragContext[0] === 'string' ? ragContext[0] : (ragContext[0].text || ragContext[0].content);
-        } else if (ragContext.results && ragContext.results[0]) {
-            firstPassage = ragContext.results[0].text || ragContext.results[0].content;
-        }
-
-        if (firstPassage && firstPassage.length > 20) {
-            return `According to official university documentation: ${firstPassage.slice(0, 300).trim()}...`;
-        }
-    }
-
-    return null;
-}
-
-
-// ─────────────────────────────────────────────────────────────
-// SECTION 4 — PROMPT BUILDER (Route-Aware)
-// ─────────────────────────────────────────────────────────────
-
-/**
- * Core system prompt establishing the advisor persona and hard rules.
- * Route-specific instructions are appended dynamically at build time.
- *
- * TASK 2 note: "ALWAYS write complete sentences." instruction added
- * to reinforce the truncation-guard objective at the model level.
- */
-const BASE_SYSTEM_PROMPT = `
-You are an expert academic advisor at AAST (Arab Academy for Science, Technology & Maritime Transport).
-Your role is to assist students with accurate, trustworthy, and professional academic guidance.
-
-STRICT RULES YOU MUST FOLLOW AT ALL TIMES:
-───
-1. ONLY use the verified context provided below. Do NOT use any outside knowledge.
-2. NEVER hallucinate, invent, speculate, or assume any university policy, rule, or data.
-3. NEVER reference facts, names, deadlines, requirements, or regulations not explicitly in the provided context.
-4. If the provided context does not contain enough information to answer the question confidently, respond with exactly:
-   "${INSUFFICIENT_DATA_PHRASE}"
-5. Do NOT mention that you are an AI model, that you consulted a database, or describe your internal workings.
-6. NEVER say "according to my training data" or "based on my knowledge" — speak purely from the verified context given.
-
-TONE AND STYLE:
-───
-- Warm, professional, and student-friendly.
-- Clear and direct. Plain English. No invented jargon.
-- Empathetic and encouraging where appropriate.
-- Concise but complete — no padding, no omission of critical detail.
-- Natural paragraphs. Bullet lists acceptable when listing steps or options.
-- Do NOT start with "Based on the context provided" or similar meta-phrases.
-- Do NOT repeat the student's question back verbatim as an opener.
-- If the user starts conversationally, respond briefly and professionally before answering.
-- ALWAYS write complete sentences. Never end mid-sentence or with a dangling clause.
-
-RESPONSE QUALITY STANDARDS:
-───
-- Accuracy over creativity. When uncertain, err toward caution.
-- Every factual claim must be traceable to the provided context.
-- Prioritise: FAQ answer → Decision factors → Knowledge Graph facts → Document passages.
-`.trim();
-
-/**
- * Resolves and validates the route type.
- * Unknown or missing route types fall back to LLM_FALLBACK.
- *
- * @param {string|undefined} routeType
- * @returns {string} A valid ROUTE_TYPES value.
- */
-function resolveRouteType(routeType) {
-    const normalizedRoute = String(routeType || "").trim().toUpperCase();
-
-    if (normalizedRoute && Object.values(ROUTE_TYPES).includes(normalizedRoute)) {
-        return normalizedRoute;
-    }
-
-    if (normalizedRoute === "HYBRID_KG_RAG") return ROUTE_TYPES.HYBRID;
-    if (["DECISION_ENGINE", "DECISION", "RECOMMEND", "RECOMMENDATION", "COMPARISON"].includes(normalizedRoute)) {
-        return ROUTE_TYPES.DECISION;
-    }
-    if (["CAREER_ENGINE", "CAREER", "CAREER_PATH_DETAIL"].includes(normalizedRoute)) {
-        return ROUTE_TYPES.CAREER;
-    }
-    if (normalizedRoute === "GENERAL") return ROUTE_TYPES.GENERAL;
-    if (normalizedRoute === "KG") return ROUTE_TYPES.KG_ONLY;
-    if (normalizedRoute === "RAG") return ROUTE_TYPES.RAG_ONLY;
-    if (normalizedRoute === "FAQ") return ROUTE_TYPES.FAQ_ONLY;
-
-    return ROUTE_TYPES.LLM_FALLBACK;
-}
-
-function normalizeExplainabilityRoute(routeType, query = "", decisionContext = null) {
-    const normalizedRoute = String(routeType || "").trim().toUpperCase();
-    const normalizedQuery = String(query || "").toLowerCase();
-    const normalizedDecisionContext =
-        Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;
-    const recommendationText = String(
-        normalizedDecisionContext?.recommendation ||
-        normalizedDecisionContext?.career_path ||
-        normalizedDecisionContext?.outcome ||
-        ""
-    ).toLowerCase();
-
-    if (normalizedRoute === "HYBRID_KG_RAG" || normalizedRoute === "HYBRID") return "HYBRID_KG_RAG";
-    if (["CAREER_ENGINE", "CAREER", "CAREER_PATH_DETAIL"].includes(normalizedRoute)) return "CAREER";
-    if (normalizedRoute === "LLM_FALLBACK") return "LLM_FALLBACK";
-    if (normalizedRoute === "GENERAL") return "GENERAL";
-    if (normalizedRoute === "FAQ_ONLY") return "GENERAL";
-    if (normalizedRoute === "KG_ONLY") return "GENERAL";
-    if (normalizedRoute === "RAG_ONLY") return "GENERAL";
-
-    if (
-        normalizedRoute === "COMPARISON" ||
-        recommendationText.startsWith("comparison:") ||
-        /\b(compare|comparison|versus|vs)\b/.test(normalizedQuery)
-    ) {
-        return "COMPARISON";
-    }
-
-    if (
-        normalizedRoute === "RECOMMEND" ||
-        normalizedRoute === "RECOMMENDATION" ||
-        /\b(best major|recommend|recommended major|which major)\b/.test(normalizedQuery)
-    ) {
-        return "RECOMMENDATION";
-    }
-
-    if (normalizedRoute === "DECISION_ENGINE" || normalizedRoute === "DECISION") {
-        return "DECISION";
-    }
-
-    return "LLM_FALLBACK";
-}
-
-function normalizeHistoryContent(content) {
-    const text = String(content || "")
-        .replace(/\s+/g, " ")
-        .trim();
-
-    if (!text) return "";
-
-    return text.length > MAX_HISTORY_MESSAGE_CHARS
-        ? `${text.slice(0, MAX_HISTORY_MESSAGE_CHARS).trim()}...`
-        : text;
-}
-
-function buildConversationHistoryBlock(history = [], currentQuery = "") {
-    if (!Array.isArray(history) || history.length === 0) return "";
-
-    const currentQueryKey = normalizeHistoryContent(currentQuery).toLowerCase();
-    const messages = history
-        .filter(message => message && typeof message === "object")
-        .filter(message => String(message.role || "").toLowerCase() !== "system")
-        .map(message => ({
-            role: String(message.role || "").toLowerCase(),
-            content: normalizeHistoryContent(message.content),
-        }))
-        .filter(message => ["user", "assistant"].includes(message.role) && message.content)
-        .slice(-MAX_HISTORY_MESSAGES);
-
-    if (
-        messages.length > 0 &&
-        messages[messages.length - 1].role === "user" &&
-        messages[messages.length - 1].content.toLowerCase() === currentQueryKey
-    ) {
-        messages.pop();
-    }
-
-    if (messages.length === 0) return "";
-
-    let totalChars = 0;
-    const lines = [];
-
-    for (const message of messages) {
-        const line = `${message.role.toUpperCase()}: ${message.content}`;
-        if (totalChars + line.length > MAX_HISTORY_TOTAL_CHARS) break;
-        lines.push(line);
-        totalChars += line.length;
-    }
-
-    if (lines.length === 0) return "";
-
-    return [
-        "RECENT CONVERSATION HISTORY:",
-        "Use this only for continuity, pronoun resolution, and conversational flow. Do not treat it as verified academic evidence.",
-        ...lines,
-    ].join("\n");
-}
-
-function normalizeMemoryValue(value, limit = 140) {
-    if (typeof value !== "string") return "";
-    return value.replace(/\s+/g, " ").trim().slice(0, limit);
-}
-
-function formatMemoryEntity(entity) {
-    if (!entity) return "";
-
-    if (typeof entity === "string") {
-        return normalizeMemoryValue(entity);
-    }
-
-    if (typeof entity !== "object") return "";
-
-    const value = normalizeMemoryValue(entity.value || entity.name || entity.label);
-    const type = normalizeMemoryValue(entity.type || "entity", 40);
-    return value ? `${type}: ${value}` : "";
-}
-
-function buildConversationMemoryBlock(conversationMemory = null) {
-    if (!conversationMemory || typeof conversationMemory !== "object") return "";
-
-    const lines = [];
-    const topic = normalizeMemoryValue(conversationMemory.lastTopic, 80);
-    const entity = formatMemoryEntity(conversationMemory.lastEntity);
-    const intent = normalizeMemoryValue(conversationMemory.lastIntent, 80);
-    const recentSubjects = Array.isArray(conversationMemory.recentSubjects)
-        ? conversationMemory.recentSubjects.map(subject => normalizeMemoryValue(subject, 80)).filter(Boolean).slice(0, 3)
-        : [];
-    const summary = normalizeMemoryValue(conversationMemory.lastAssistantSummary, 180);
-
-    if (topic) lines.push(`- Current topic: ${topic}`);
-    if (entity) lines.push(`- Last discussed entity: ${entity}`);
-    if (recentSubjects.length > 0) lines.push(`- Recent subject: ${recentSubjects.join("; ")}`);
-    if (intent) lines.push(`- Recent intent: ${intent}`);
-    if (summary) lines.push(`- Last assistant answer summary: ${summary}`);
-
-    if (lines.length === 0) return "";
-
-    const block = [
-        "CONVERSATION MEMORY:",
-        "Use only for continuity and pronoun resolution. It is not verified evidence; verified context always wins.",
-        ...lines
-    ].join("\n");
-
-    return block.length > MAX_MEMORY_BLOCK_CHARS
-        ? `${block.slice(0, MAX_MEMORY_BLOCK_CHARS).trimEnd()}...`
-        : block;
-}
-
-/**
- * Assembles the full inference prompt from base system prompt,
- * route-specific behavioral instructions, context payload, and query.
- *
- * @param {string} query
- * @param {string} contextPayload
- * @param {string} routeType
- * @param {Array} [history=[]]
- * @param {object|null} [conversationMemory=null]
- * @returns {string}
- */
-function buildPrompt(query, contextPayload, routeType, history = [], conversationMemory = null) {
-    const routeInstruction =
-        ROUTE_INSTRUCTIONS[routeType] ??
-        ROUTE_INSTRUCTIONS[ROUTE_TYPES.LLM_FALLBACK];
-
-    const divider = "─".repeat(60);
-
-    const contextSection = contextPayload
-        ? `VERIFIED CONTEXT:\n${divider}\n${contextPayload}\n${divider}`
-        : `VERIFIED CONTEXT:\n${divider}\n[No structured context was retrieved for this query.]\n${divider}`;
-    const historySection = buildConversationHistoryBlock(history, query);
-    const memorySection = buildConversationMemoryBlock(conversationMemory);
-
-    return (
-        `${BASE_SYSTEM_PROMPT}\n\n` +
-        `${routeInstruction}\n\n` +
-        `${memorySection ? `${memorySection}\n\n` : ""}` +
-        `${historySection ? `${historySection}\n\n` : ""}` +
-        `${contextSection}\n\n` +
-        `STUDENT QUERY:\n${query.trim()}\n\n` +
-        `ADVISOR RESPONSE:`
-    );
-}
-
-
-// ─────────────────────────────────────────────────────────────
-// SECTION 5 — RESPONSE SANITIZATION + ANTI-TRUNCATION GUARD
-// TASK 3 + existing sanitization pipeline.
-// ─────────────────────────────────────────────────────────────
-
-/**
- * Regex patterns indicating model self-reference or generic AI filler.
- * @type {RegExp[]}
- */
-const META_PHRASE_PATTERNS = [
-    /based on the (context|information) provided/gi,
-    /according to my training data/gi,
-    /as an? (ai|language model|llm|chatbot)/gi,
-    /i (don't|do not) have access to real.?time/gi,
-    /my knowledge (cut.?off|cutoff)/gi,
-    /i cannot (browse|access|search) the (internet|web|database)/gi,
-    /let me (look that up|check|search)/gi,
-    /^(great question!?)[,\s]/i,
-    /\[no structured context was retrieved[^\]]*\]/gi,
-];
-
-/**
- * Characters that unambiguously terminate a complete sentence.
- * Used by repairTruncation to determine response completeness.
- * @type {RegExp}
- */
-const TERMINAL_PUNCTUATION_RE = /[.!?\u2026"')\]]/;
-
-/**
- * TASK 3 — Anti-truncation guard.
- *
- * Detects incomplete LLM responses using the absence of terminal punctuation
- * at the end of the text. This catches the failure mode where Gemma's output
- * is cut off by context-window overflow mid-generation.
- *
- * Repair strategy:
- *   1. Locate the last sentence-boundary punctuation in the text.
- *   2. Trim to that boundary, discarding the dangling incomplete fragment.
- *   3. If the repaired remainder is under 20 characters, the response is
- *      too damaged to be useful — return INSUFFICIENT_DATA_PHRASE instead.
- *
- * The model-level instruction "ALWAYS write complete sentences" in BASE_SYSTEM_PROMPT
- * reduces truncation frequency; this guard handles the cases that slip through.
- *
- * @param {string} text - Post-sanitization response text.
- * @returns {{ text: string, repaired: boolean, truncated: boolean }}
- */
-function repairTruncation(text) {
-    if (!text) return { text, repaired: false, truncated: false };
-
-    const trimmed = text.trimEnd();
-    const lastChar = trimmed.at(-1) ?? "";
-
-    // Terminal punctuation present — response is complete
-    if (TERMINAL_PUNCTUATION_RE.test(lastChar)) {
-        return { text: trimmed, repaired: false, truncated: false };
-    }
-
-    // Appears truncated — find the last sentence boundary
-    const lastBoundaryMatch = trimmed.match(/[.!?\u2026][^.!?\u2026]*$/);
-
-    if (lastBoundaryMatch) {
-        const lastBoundaryIdx = trimmed.lastIndexOf(lastBoundaryMatch[0]);
-        if (lastBoundaryIdx > 0) {
-            const repaired = trimmed.slice(0, lastBoundaryIdx + 1).trim();
-
-            if (repaired.length >= 20) {
-                return { text: repaired, repaired: true, truncated: true };
-            }
-        }
-    }
-
-    // Repair produced insufficient text — return safe fallback
-    return {
-        text: INSUFFICIENT_DATA_PHRASE,
-        repaired: false,
-        truncated: true,
-    };
-}
-
-/**
- * Sanitizes raw LLM output through a multi-stage cleaning pipeline.
- *
- * Stages:
- *   1. Null/empty guard            → FALLBACK_ANSWER
- *   2. Meta-phrase strip           → remove model self-references (inline + full-line)
- *   3. Consecutive deduplication   → collapse repeated adjacent sentences
- *   4. Whitespace normalization    → collapse excess blank lines
- *   5. Minimum length guard        → ultra-short → INSUFFICIENT_DATA_PHRASE
- *   6. Truncation repair (TASK 3)  → detect and fix incomplete sentence endings
- *
- * @param {string|null|undefined} rawResponse
- * @returns {{ text: string, sanitized: boolean, truncated: boolean, rejection_reason?: string }}
- */
-function sanitizeResponse(rawResponse) {
-    // Stage 1: Null/empty guard
-    if (!rawResponse || typeof rawResponse !== "string" || rawResponse.trim().length === 0) {
-        return { text: FALLBACK_ANSWER, sanitized: true, truncated: false, rejection_reason: "empty_response" };
-    }
-
-    let text = rawResponse.trim();
-
-    // Stage 2: Strip meta-model phrases
-    const lines = text.split("\n");
-    const cleanedLines = lines
-        .map(line => {
-            const stripped = line.trim();
-            for (const pattern of META_PHRASE_PATTERNS) {
-                pattern.lastIndex = 0;
-                if (pattern.test(stripped)) {
-                    if (stripped.replace(pattern, "").trim().length < 10) return null;
-                }
-            }
-            let cleaned = line;
-            for (const pattern of META_PHRASE_PATTERNS) {
-                pattern.lastIndex = 0;
-                cleaned = cleaned.replace(pattern, "");
-            }
-            return cleaned.trim() || null;
-        })
-        .filter(line => line !== null);
-
-    text = cleanedLines.join("\n").trim();
-
-    // Stage 3: Consecutive sentence deduplication
-    const sentences = text.split(/(?<=[.!?])\s+/);
-    const deduplicated = sentences.filter((sentence, idx) => {
-        if (idx === 0) return true;
-        const normalize = s =>
-            s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
-        return normalize(sentence) !== normalize(sentences[idx - 1]);
-    });
-    text = deduplicated.join(" ").trim();
-
-    // Stage 4: Whitespace normalization
-    text = text.replace(/\n{3,}/g, "\n\n").trim();
-
-    // Stage 5: Minimum length guard
-    if (text.split(/\s+/).length < 5) {
-        return {
-            text: INSUFFICIENT_DATA_PHRASE,
-            sanitized: true,
-            truncated: false,
-            rejection_reason: "response_too_short",
-        };
-    }
-
-    // Stage 6: Truncation repair (TASK 3)
-    const { text: repairedText, repaired, truncated } = repairTruncation(text);
-
-    const wasSanitized = repairedText !== rawResponse.trim() || repaired;
-
-    return {
-        text: repairedText,
-        sanitized: wasSanitized,
-        truncated,
-        rejection_reason: repaired ? "truncation_repaired" : undefined,
-    };
-}
-
-
-// ─────────────────────────────────────────────────────────────
-// SECTION 6 — STRUCTURED RESPONSE TYPE (TASK 2)
-// UnifiedAnswerResult replaces the bare string return.
-// toString() provides soft backward compatibility.
-// ─────────────────────────────────────────────────────────────
-
-/**
- * @typedef {object} SourcesUsed
- * @property {boolean} faq      - Whether a FAQ entry contributed to the answer.
- * @property {boolean} kg       - Whether KG facts contributed to the answer.
- * @property {boolean} rag      - Whether RAG passages contributed to the answer.
- * @property {boolean} decision - Whether decision engine factors contributed.
- */
-
-/**
- * @typedef {object} UnifiedAnswerResult
- * @property {string}      answer       - The synthesized advisory answer string.
- * @property {string}      route        - The resolved ROUTE_TYPES value used.
- * @property {number}      confidence   - The retrievalConfidence value passed in.
- * @property {SourcesUsed} sources_used - Which upstream sources contributed.
- * @property {number}      latency_ms   - Total pipeline wall-clock time in ms.
- * @property {boolean}     sanitized    - Whether the response was modified by sanitization.
- * @property {boolean}     truncated    - Whether a truncated response was detected.
- */
-
-/**
- * Constructs a UnifiedAnswerResult object.
- *
- * BACKWARD COMPATIBILITY NOTE:
- *   The returned object implements toString() returning `answer`, enabling
- *   orchestrators that use the result in string contexts (template literals,
- *   implicit coercion, responseFormatter.format(result)) to continue working
- *   without modification.
- *
- *   Recommended v4 migration:
- *     const result  = await generateUnifiedAnswer({ ... });
- *     const answer  = result.answer;
- *     const sources = result.sources_used;   // new transparency capability
- *
- * @param {object} params
- * @returns {UnifiedAnswerResult}
- */
-function normalizeProbability(value, fallback = 0) {
-    const n = Number.parseFloat(value);
-    if (!Number.isFinite(n)) return fallback;
-    return Math.max(0, Math.min(1, n));
-}
-
-function unwrapDecisionContext(decisionContext) {
-    return Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;
-}
-
-function dedupeTextList(values) {
-    const seen = new Set();
-    const deduped = [];
-
-    for (const value of values) {
-        const text = String(value || "").replace(/\s+/g, " ").trim();
-        if (!text) continue;
-        const key = text.toLowerCase();
-        if (seen.has(key)) continue;
-        seen.add(key);
-        deduped.push(text);
-    }
-
-    return deduped;
-}
-
-function truncateEvidence(text, maxChars = 320) {
-    const normalized = String(text || "").replace(/\s+/g, " ").trim();
-    if (!normalized) return "";
-    return normalized.length > maxChars ? `${normalized.slice(0, maxChars).trim()}...` : normalized;
-}
-
-function extractKgFacts(neo4jContext, limit = MAX_KG_FACTS) {
-    if (!Array.isArray(neo4jContext) || neo4jContext.length === 0) return [];
-
-    return dedupeTextList(
-        neo4jContext
-            .slice()
-            .sort((a, b) => (b?.confidence ?? 0) - (a?.confidence ?? 0))
-            .map(item => item?.evidence ?? item?.text ?? item?.content ?? "")
-            .map(text => normalizeGraphEvidence(text))
-            .map(text => truncateEvidence(text, 260))
-    ).slice(0, limit);
-}
-
-function extractRagFacts(ragContext, limit = MAX_RAG_PASSAGES) {
-    if (!ragContext) return [];
-
-    const normalizedContext =
-        typeof ragContext === "object" &&
-        !Array.isArray(ragContext) &&
-        Array.isArray(ragContext.results)
-            ? ragContext.results
-            : ragContext;
-
-    if (typeof normalizedContext === "string") {
-        return dedupeTextList(
-            normalizedContext
-                .split(/\n{2,}/)
-                .map(text => truncateEvidence(text, 320))
-        ).slice(0, limit);
-    }
-
-    if (!Array.isArray(normalizedContext)) return [];
-
-    return dedupeTextList(
-        normalizedContext.map(item => {
-            if (typeof item === "string") return truncateEvidence(item, 320);
-            return truncateEvidence(
-                item?.excerpt ??
-                item?.text ??
-                item?.content ??
-                item?.pageContent ??
-                item?.page_content ??
-                item?.summary ??
-                item?.answer ??
-                item?.metadata?.text ??
-                item?.metadata?.content ??
-                "",
-                320
-            );
-        })
-    ).slice(0, limit);
-}
-
-function extractFaqFacts(faqContext) {
-    if (!faqContext || typeof faqContext !== "object") return [];
-    return dedupeTextList([truncateEvidence(faqContext.answer, 260)]);
-}
-
-function extractDecisionFacts(decisionContext, limit = 4) {
-    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
-    if (!normalizedDecisionContext || typeof normalizedDecisionContext !== "object") return [];
-
-    const factors = normalizedDecisionContext.factors || normalizedDecisionContext.market_data || normalizedDecisionContext;
-    const evidence = [
-        normalizedDecisionContext.recommendation,
-        normalizedDecisionContext.career_path,
-        normalizedDecisionContext.outcome,
-        normalizedDecisionContext.verdict,
-        normalizedDecisionContext.reason,
-        factors?.reason,
-        factors?.recommended_major ? `Recommended major: ${factors.recommended_major}` : "",
-        Array.isArray(factors?.top_skills) && factors.top_skills.length > 0
-            ? `Top skills: ${factors.top_skills.join(", ")}`
-            : "",
-        Array.isArray(factors?.career_roadmap?.target_roles) && factors.career_roadmap.target_roles.length > 0
-            ? `Target roles: ${factors.career_roadmap.target_roles.join(", ")}`
-            : "",
-        Array.isArray(factors?.career_roadmap?.top_skills) && factors.career_roadmap.top_skills.length > 0
-            ? `Career roadmap skills: ${factors.career_roadmap.top_skills.join(", ")}`
-            : "",
-        factors?.career_roadmap?.industry_demand ? `Industry demand: ${factors.career_roadmap.industry_demand}` : "",
-        Array.isArray(factors?.next_steps) && factors.next_steps.length > 0
-            ? `Next steps: ${factors.next_steps.join(", ")}`
-            : "",
-        factors?.salary_outlook ? `Salary outlook: ${factors.salary_outlook}` : "",
-        factors?.skills_overlap ? `Skills overlap: ${factors.skills_overlap}` : "",
-    ];
-
-    return dedupeTextList(evidence.map(text => truncateEvidence(text, 320))).slice(0, limit);
-}
-
-function buildExplainabilityGraph(neo4jContext) {
-    if (!Array.isArray(neo4jContext) || neo4jContext.length === 0) {
-        return { nodes: [], links: [] };
-    }
-
-    try {
-        const graph = convertToGraphData(neo4jContext);
-        return {
-            nodes: Array.isArray(graph?.nodes) ? graph.nodes : [],
-            links: Array.isArray(graph?.links) ? graph.links : []
-        };
-    } catch {
-        return { nodes: [], links: [] };
-    }
-}
-
-function normalizeContractConfidence(confidence, responseRoute, { failure = false, weak = false } = {}) {
-    const numericConfidence = normalizeProbability(confidence, weak ? 0.35 : 0.55);
-
-    if (failure) return 0.2;
-    if (responseRoute === "HYBRID_KG_RAG") return parseFloat(Math.max(0.70, Math.min(0.89, numericConfidence)).toFixed(3));
-    if (["DECISION", "RECOMMENDATION", "CAREER", "COMPARISON"].includes(responseRoute)) {
-        return parseFloat(Math.max(0.70, Math.min(0.89, numericConfidence)).toFixed(3));
-    }
-    if (responseRoute === "GENERAL" || responseRoute === "LLM_FALLBACK") {
-        if (numericConfidence < 0.50) {
-            return parseFloat(Math.max(0.20, Math.min(0.49, numericConfidence)).toFixed(3));
-        }
-        return parseFloat(Math.max(0.50, Math.min(0.69, numericConfidence)).toFixed(3));
-    }
-
-    return parseFloat(Math.max(0.50, Math.min(0.69, numericConfidence)).toFixed(3));
-}
-
-function buildExplainabilitySources(responseRoute, sources_used, { faqContext, decisionContext } = {}) {
-    const sources = [];
-    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
-
-    if (responseRoute === "HYBRID_KG_RAG") {
-        if (sources_used?.kg) sources.push("KG_DIRECT");
-        if (sources_used?.rag) sources.push("RAG_DIRECT");
-        if (normalizedDecisionContext) sources.push("DECISION");
-    }
-
-    if (["GENERAL", "LLM_FALLBACK"].includes(responseRoute)) {
-        if (sources_used?.kg) sources.push("KG_DIRECT");
-        if (sources_used?.rag) sources.push("RAG_DIRECT");
-    }
-
-    if (["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)) {
-        if (normalizedDecisionContext) sources.push("DECISION");
-    }
-
-    if (responseRoute === "CAREER") {
-        if (normalizedDecisionContext) sources.push("CAREER");
-    }
-
-    if (faqContext?.answer || sources_used?.faq) {
-        sources.push("FAQ");
-    }
-
-    if (["DECISION", "RECOMMENDATION", "COMPARISON", "CAREER", "HYBRID_KG_RAG"].includes(responseRoute)) {
-        if (sources_used?.kg) sources.push("KG_DIRECT");
-        if (sources_used?.rag) sources.push("RAG_DIRECT");
-    }
-
-    return [...new Set(sources)];
-}
-
-function buildMissingInformation({
-    responseRoute,
-    normalizedConfidence,
-    usedFacts,
-    sources_used,
-    decisionContext,
-    failure = false,
-    limitedEvidenceMessage = "Response generated with limited institutional evidence."
-}) {
-    if (failure) return ["Insufficient evidence available."];
-
-    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
-    const factors = normalizedDecisionContext?.factors || normalizedDecisionContext?.market_data || normalizedDecisionContext || {};
-    const missing = [];
-
-    if (responseRoute === "HYBRID_KG_RAG") {
-        if (usedFacts.length === 0 || !sources_used?.kg || !sources_used?.rag) {
-            missing.push("Partial institutional evidence available.");
-        }
-    }
-
-    if (responseRoute === "GENERAL" || responseRoute === "LLM_FALLBACK") {
-        if (normalizedConfidence < 0.7) {
-            missing.push(limitedEvidenceMessage);
-        }
-    }
-
-    if (["DECISION", "RECOMMENDATION", "COMPARISON", "CAREER"].includes(responseRoute)) {
-        const missingFields = [
-            ...(Array.isArray(normalizedDecisionContext?.missing_fields) ? normalizedDecisionContext.missing_fields : []),
-            ...(Array.isArray(factors?.missing_fields) ? factors.missing_fields : [])
-        ];
-
-        missingFields.forEach(field => {
-            const normalizedField = String(field).toLowerCase();
-            if (normalizedField.includes("gpa") || normalizedField.includes("percentage")) {
-                missing.push("Missing GPA information.");
-            } else if (normalizedField.includes("goal") || normalizedField.includes("interest")) {
-                missing.push("Missing goals information.");
-            } else if (normalizedField.includes("special")) {
-                missing.push("Missing specialization information.");
-            } else {
-                missing.push(`Missing ${String(field).trim()} information.`);
-            }
-        });
-
-        if (responseRoute === "CAREER" && !Array.isArray(factors?.target_roles) && !Array.isArray(factors?.career_roadmap?.target_roles)) {
-            missing.push("Missing specialization information.");
-        }
-    }
-
-    if (usedFacts.length === 0 && missing.length === 0) {
-        missing.push("Insufficient evidence available.");
-    }
-
-    return dedupeTextList(missing);
-}
-
-function buildReasoning({
-    responseRoute,
-    sources_used,
-    normalizedConfidence,
-    missingInformation,
-    failure = false
-}) {
-    if (failure) {
-        return "System fallback triggered due to insufficient evidence.";
-    }
-
-    if (responseRoute === "HYBRID_KG_RAG") {
-        return `Deterministic hybrid fusion combined ${sources_used?.kg ? "knowledge graph facts" : "available structured records"} with ${sources_used?.rag ? "retrieved policy passages" : "available document evidence"} to produce a grounded academic answer${missingInformation.length > 0 ? " with partial coverage safeguards." : "."}`;
-    }
-
-    if (["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)) {
-        return "Recommendation logic was derived from verified decision-engine factors and any available supporting academic evidence.";
-    }
-
-    if (responseRoute === "CAREER") {
-        return "Career guidance was synthesized from the verified roadmap output and any available institutional support evidence.";
-    }
-
-    if (responseRoute === "GENERAL") {
-        return `General advisory synthesis used the best available verified context${normalizedConfidence < 0.7 ? " with explicit evidence limitations." : "."}`;
-    }
-
-    return `Fallback path used limited verified institutional context${normalizedConfidence < 0.5 ? " with weak evidence safeguards." : "."}`;
 }
-
-function buildExplainabilityMetadata({
-    requestedRoute,
-    resolvedRoute,
-    responseRoute,
-    normalizedConfidence,
-    sources_used,
-    latency_ms,
-    sanitized,
-    truncated,
-    contextMetrics,
-    providedMetadata,
-    graph,
-    usedFacts,
-    failure = false,
-    decisionContext
-}) {
-    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
-    const factors = normalizedDecisionContext?.factors || normalizedDecisionContext?.market_data || normalizedDecisionContext || {};
-    const decisionConfidence = normalizeProbability(
-        normalizedDecisionContext?.confidence ??
-        factors?.confidence ??
-        factors?.confidence_breakdown?.overall,
-        normalizedConfidence
-    );
-
-    const baseMetadata = {
-        route_requested: requestedRoute,
-        inference_route: resolvedRoute,
-        route_safety: failure ? "SAFE_FAILURE" : normalizedConfidence >= 0.7 ? "SAFE_VERIFIED" : "SAFE_LIMITED",
-        latency_ms,
-        sanitized,
-        truncated,
-        source_count: Array.isArray(usedFacts) ? usedFacts.length : 0,
-        graph_node_count: Array.isArray(graph?.nodes) ? graph.nodes.length : 0,
-        graph_link_count: Array.isArray(graph?.links) ? graph.links.length : 0,
-        evidence_coverage: {
-            faq: !!sources_used?.faq,
-            kg: !!sources_used?.kg,
-            rag: !!sources_used?.rag,
-            decision: !!sources_used?.decision
-        },
-        ...(contextMetrics || {})
-    };
-
-    if (responseRoute === "HYBRID_KG_RAG") {
-        baseMetadata.fusion_strategy = "KG_RAG_EVIDENCE_BLEND";
-        baseMetadata.confidence_blend = parseFloat(((normalizedConfidence + normalizeProbability(decisionConfidence, normalizedConfidence)) / 2).toFixed(3));
-        baseMetadata.coverage_quality = usedFacts.length >= 4 ? "HIGH" : usedFacts.length >= 2 ? "MEDIUM" : "LOW";
-    }
-
-    if (["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)) {
-        baseMetadata.decision_factors = Object.keys(factors || {});
-        baseMetadata.decision_confidence = decisionConfidence;
-    }
-
-    if (responseRoute === "CAREER") {
-        baseMetadata.career_confidence = decisionConfidence;
-        baseMetadata.roadmap_confidence = normalizeProbability(
-            factors?.career_roadmap?.confidence ??
-            factors?.confidence_breakdown?.overall ??
-            decisionConfidence,
-            decisionConfidence
-        );
-    }
-
-    if (responseRoute === "GENERAL" || responseRoute === "LLM_FALLBACK") {
-        baseMetadata.fallback_path = responseRoute;
-        baseMetadata.evidence_limitations = normalizedConfidence < 0.7;
-    }
-
-    return {
-        ...baseMetadata,
-        ...(providedMetadata || {})
-    };
-}
-
-function createResult({
-    answer,
-    route,
-    confidence,
-    sources_used,
-    latency_ms,
-    sanitized,
-    truncated = false,
-    query = "",
-    requestedRoute = route,
-    neo4jContext = [],
-    ragContext = [],
-    faqContext = null,
-    decisionContext = null,
-    contextMetrics = {},
-    metadata = {},
-    reasoning = "",
-    failure = false,
-    missing_information = null,
-    used_facts = null,
-    graph = null,
-    sources = null,
-}) {
-    const responseRoute = normalizeExplainabilityRoute(route, query, decisionContext);
-    const normalizedConfidence = normalizeContractConfidence(confidence, responseRoute, {
-        failure,
-        weak: normalizeProbability(confidence, 0) < 0.5
-    });
-    const explainabilityGraph = graph || (responseRoute === "HYBRID_KG_RAG"
-        ? buildExplainabilityGraph(neo4jContext)
-        : { nodes: [], links: [] });
-    const kgFacts = extractKgFacts(neo4jContext, responseRoute === "HYBRID_KG_RAG" ? 2 : MAX_KG_FACTS);
-    const ragFacts = extractRagFacts(ragContext, responseRoute === "HYBRID_KG_RAG" ? 3 : MAX_RAG_PASSAGES);
-    const faqFacts = extractFaqFacts(faqContext);
-    const decisionFacts = extractDecisionFacts(decisionContext, 4);
-    const compiledFacts = used_facts || (
-        responseRoute === "HYBRID_KG_RAG"
-            ? [...kgFacts.slice(0, 2), ...ragFacts.slice(0, 3), ...decisionFacts.slice(0, 2)]
-            : ["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)
-                ? [...decisionFacts, ...ragFacts.slice(0, 2), ...kgFacts.slice(0, 1)]
-                : responseRoute === "CAREER"
-                    ? [...decisionFacts, ...ragFacts.slice(0, 2)]
-                    : responseRoute === "GENERAL"
-                        ? [...kgFacts.slice(0, 2), ...ragFacts.slice(0, 2), ...faqFacts.slice(0, 1)]
-                        : [...faqFacts.slice(0, 1), ...kgFacts.slice(0, 1), ...ragFacts.slice(0, 1)]
-    );
-    const finalUsedFacts = dedupeTextList(compiledFacts).slice(0, 6);
-    const finalMissingInformation = Array.isArray(missing_information)
-        ? missing_information
-        : buildMissingInformation({
-            responseRoute,
-            normalizedConfidence,
-            usedFacts: finalUsedFacts,
-            sources_used,
-            decisionContext,
-            failure,
-            limitedEvidenceMessage: "Response generated with limited institutional evidence."
-        });
-    const finalSources = Array.isArray(sources)
-        ? [...new Set(sources)]
-        : buildExplainabilitySources(responseRoute, sources_used, { faqContext, decisionContext });
-    const finalReasoning = reasoning || buildReasoning({
-        responseRoute,
-        sources_used,
-        normalizedConfidence,
-        missingInformation: finalMissingInformation,
-        failure
-    });
-    const finalMetadata = buildExplainabilityMetadata({
-        requestedRoute,
-        resolvedRoute: route,
-        responseRoute,
-        normalizedConfidence,
-        sources_used,
-        latency_ms,
-        sanitized,
-        truncated,
-        contextMetrics,
-        providedMetadata: metadata,
-        graph: explainabilityGraph,
-        usedFacts: finalUsedFacts,
-        failure,
-        decisionContext
-    });
-    finalMetadata.source_count = Array.isArray(finalSources) ? finalSources.length : 0;
-    finalMetadata.used_fact_count = Array.isArray(finalUsedFacts) ? finalUsedFacts.length : 0;
-
-    const result = {
-        answer,
-        confidence: normalizedConfidence,
-        used_facts: finalUsedFacts,
-        missing_information: finalMissingInformation,
-        graph: explainabilityGraph || EMPTY_GRAPH,
-        route: responseRoute,
-        sources: finalSources,
-        reasoning: finalReasoning,
-        metadata: finalMetadata,
-        sources_used,
-        latency_ms,
-        sanitized,
-        truncated
-    };
-
-    result.toString = () => answer;
-    return result;
-}
-
-/**
- * Creates a UnifiedAnswerResult for fallback/error scenarios.
- * Ensures consistent shape on all exit paths.
- *
- * @param {string} answerText
- * @param {string} route
- * @param {number} confidence
- * @param {number} latency_ms
- * @param {SourcesUsed} [sources_used]
- * @returns {UnifiedAnswerResult}
- */
-function createFallbackResult(answerText, route, confidence, latency_ms, sources_used = null, options = {}) {
-    return createResult({
-        answer: answerText,
-        route: options.route || "LLM_FALLBACK",
-        requestedRoute: route,
-        confidence: options.confidence ?? confidence,
-        sources_used: sources_used || { faq: false, kg: false, rag: false, decision: false },
-        latency_ms,
-        sanitized: false,
-        truncated: false,
-        query: options.query || "",
-        neo4jContext: options.neo4jContext || [],
-        ragContext: options.ragContext || [],
-        faqContext: options.faqContext || null,
-        decisionContext: options.decisionContext || null,
-        contextMetrics: options.contextMetrics || {},
-        metadata: options.metadata || { route_safety: "SAFE_FAILURE" },
-        reasoning: options.reasoning || "System fallback triggered due to insufficient evidence.",
-        missing_information: options.missing_information || ["Insufficient evidence available."],
-        graph: { nodes: [], links: [] },
-        sources: options.sources || [],
-        failure: options.failure ?? true,
-    });
-}
-
-
-// ─────────────────────────────────────────────────────────────
-// SECTION 8 — PRIMARY EXPORT
-// ─────────────────────────────────────────────────────────────
-
-/**
- * generateUnifiedAnswer
- * ─────────────────────
- * Synthesises a final, grounded, student-friendly advisory answer
- * from the outputs of the KG, RAG, FAQ, and Decision subsystems.
- *
- * v4 RETURN TYPE: UnifiedAnswerResult — structured object exposing
- * answer text, route used, source attribution, latency, and sanitization
- * flags. The object's toString() returns the answer string directly for
- * soft backward compatibility with v3 orchestrators.
- *
- * @param {object} params
- * @param {string}  params.query
- * @param {string}  [params.routeType="LLM_FALLBACK"]
- * @param {number}  [params.retrievalConfidence=1.0]
- * @param {Array}   [params.neo4jContext=[]]
- * @param {*}       [params.ragContext=[]]
- * @param {object|null} [params.faqContext=null]
- * @param {object|null} [params.decisionContext=null]
- * @param {Array}   [params.history=[]]
- * @param {object|null} [params.conversationMemory=null]
- * @returns {Promise<UnifiedAnswerResult>}
- */
-export async function generateUnifiedAnswer({
-    query,
-    routeType = ROUTE_TYPES.LLM_FALLBACK,
-    retrievalConfidence = 1.0,
-    neo4jContext = [],
-    ragContext = [],
-    faqContext = null,
-    decisionContext = null,
-    history = [],
-    conversationMemory = null,
-} = {}) {
-    const requestedRoute = routeType;
-
-    // ── Guard: query is mandatory ─────────────────────────────────────
-    if (!query || typeof query !== "string" || query.trim() === "") {
-        logError("invalid_query", { reason: "empty_or_non_string_query" });
-        return createFallbackResult(FALLBACK_ANSWER, requestedRoute, retrievalConfidence, 0, null, {
-            route: "LLM_FALLBACK",
-            metadata: { route_safety: "SAFE_FAILURE" },
-            reasoning: "System fallback triggered due to insufficient evidence.",
-            missing_information: ["Insufficient evidence available."],
-            failure: true
-        });
-    }
-
-    const resolvedRoute = resolveRouteType(routeType);
-    const truncatedQuery = query.trim().slice(0, 120);
-    const pipelineStart = Date.now();
-
-    // PHASE 8: DETERMINISTIC EMPTY-CONTEXT GUARD
-    // Pre-calculate block metadata to check for total evidence absence
-    const faqMeta = buildFaqBlock(faqContext);
-    const decisionMeta = buildDecisionBlock(decisionContext);
-    const kgMeta = buildNeo4jBlock(neo4jContext);
-    const ragMeta = buildRagBlock(ragContext);
-
-    if (!faqMeta.used && !decisionMeta.used && !kgMeta.used && !ragMeta.used) {
-        logWarn("total_evidence_absence_early_exit", { route: routeType, query: truncatedQuery });
-        incrementMetric("deterministic_fallback_total");
-        return createFallbackResult(
-            "Insufficient verified academic evidence was found for this query.",
-            requestedRoute,
-            0.2,
-            Date.now() - pipelineStart,
-            null,
-            {
-                route: "LLM_FALLBACK",
-                reasoning: "All retrieval systems returned insufficient evidence. Bypassing LLM synthesis for safety.",
-                missing_information: ["Insufficient evidence available."],
-                metadata: { route_safety: "SAFE_FAILURE" }
-            }
-        );
-    }
-
-    // ── Tiered Confidence Gating (Phase 3 Stabilization) ────────────────
-    const isDegraded = retrievalConfidence >= DEGRADED_CONFIDENCE_THRESHOLD && retrievalConfidence < CONFIDENCE_GATE_THRESHOLD;
-
-    if (retrievalConfidence < DEGRADED_CONFIDENCE_THRESHOLD) {
-        logWarn("confidence_gate_triggered", {
-            route: resolvedRoute,
-            retrieval_confidence: retrievalConfidence,
-            threshold: DEGRADED_CONFIDENCE_THRESHOLD,
-            query_preview: truncatedQuery,
-            fallback_reason: "below_minimum_confidence",
-        });
-        incrementMetric("deterministic_fallback_total");
-        return createFallbackResult(INSUFFICIENT_DATA_PHRASE, requestedRoute, retrievalConfidence, 0, null, {
-            query,
-            route: "LLM_FALLBACK",
-            neo4jContext,
-            ragContext,
-            faqContext,
-            decisionContext,
-            metadata: { route_safety: "SAFE_FAILURE" },
-            reasoning: "System fallback triggered due to insufficient evidence.",
-            missing_information: ["Insufficient evidence available."],
-            failure: true
-        });
-    }
-
-    logInfo("pipeline_start", {
-        route: resolvedRoute,
-        retrieval_confidence: retrievalConfidence,
-        is_degraded: isDegraded,
-        query_preview: truncatedQuery,
-        model: MODEL,
-        backup_model: getOllamaRuntimeStatus().backup_model
-    });
-
-    try {
-        // ── Step 1: Assemble context with auto-trimming budget checks ─────
-        let currentTrimConfig = null;
-        let contextPayload, contextMetrics, sources_used;
-        let prompt, promptTokenEst;
-
-        // FINAL MICRO-PATCH 2: Iterative build-measure-trim-rebuild loop
-        for (let pass = 1; pass <= 3; pass++) {
-            ({ payload: contextPayload, metrics: contextMetrics, sources_used } =
-                buildContextPayload({ neo4jContext, ragContext, faqContext, decisionContext }, currentTrimConfig));
-
-            prompt = buildPrompt(query.trim(), contextPayload, resolvedRoute, history, conversationMemory);
-            promptTokenEst = estimateTokens(prompt);
-
-            if (promptTokenEst < PROMPT_TOKEN_WARN_THRESHOLD) break;
-            if (pass === 3) break; // Exceeded max passes
-
-            logWarn("budget_exceeded_recalculating_trim", { pass, tokens: promptTokenEst });
-            currentTrimConfig = trimContextToBudget(promptTokenEst);
-        }
-
-        const safePromptLimit = Math.max(
-            512,
-            LLM_CONFIG.gemma.maxContextTokens - LLM_CONFIG.gemma.contextHeadroomTokens
-        );
-
-        if (promptTokenEst > safePromptLimit) {
-            const emptyPromptTokens = estimateTokens(buildPrompt(query.trim(), "", resolvedRoute, history, conversationMemory));
-            const contextBudget = Math.max(128, safePromptLimit - emptyPromptTokens);
-            const truncation = hardTruncateToTokenBudget(contextPayload, contextBudget);
-
-            if (truncation.truncated) {
-                contextPayload = truncation.text;
-                prompt = buildPrompt(query.trim(), contextPayload, resolvedRoute, history, conversationMemory);
-                promptTokenEst = estimateTokens(prompt);
-                contextMetrics = {
-                    ...contextMetrics,
-                    payload_chars: contextPayload.length,
-                    payload_tokens_est: estimateTokens(contextPayload),
-                    hard_truncated: true,
-                    safe_prompt_limit: safePromptLimit,
-                };
-                logWarn("context_hard_truncated", {
-                    route: resolvedRoute,
-                    final_prompt_tokens: promptTokenEst,
-                    safe_prompt_limit: safePromptLimit,
-                    context_budget_tokens: contextBudget,
-                });
-            }
-        }
-
-        logInfo("context_finalized", {
-            route: resolvedRoute,
-            ...contextMetrics,
-            final_prompt_tokens: promptTokenEst
-        });
-
-        // ── Step 2: Build inference prompt ───────────────────────────────
-        // (Handled by iterative loop above)
-
-        // ── Step 3: Resolve route-adaptive inference options ────────────
-        // FINAL MICRO-PATCH 1: FIX IMMUTABILITY VIOLATION
-        const inferenceOptions = { ...buildInferenceOptions(resolvedRoute) };
-        inferenceOptions.num_predict = routeNumPredict(resolvedRoute, promptTokenEst);
-
-        const telemetryBeforeInference = getGemmaTelemetrySnapshot();
-        if (
-            telemetryBeforeInference.gemma_memory_pressure?.critical === true &&
-            promptTokenEst >= LLM_CONFIG.gemma.deferSynthesisTokens
-        ) {
-            const deterministicAnswer = buildDeterministicFallbackAnswer({
-                faqContext,
-                decisionContext,
-                neo4jContext,
-                ragContext
-            });
-
-            if (deterministicAnswer) {
-                const totalLatencyMs = Date.now() - pipelineStart;
-                incrementMetric("deterministic_fallback_total");
-                logWarn("memory_pressure_deferred_heavy_synthesis", {
-                    route: resolvedRoute,
-                    prompt_tokens: promptTokenEst,
-                    memory_pressure: telemetryBeforeInference.gemma_memory_pressure,
-                });
-
-                return createResult({
-                    answer: deterministicAnswer,
-                    route: resolvedRoute,
-                    confidence: retrievalConfidence,
-                    sources_used,
-                    latency_ms: totalLatencyMs,
-                    sanitized: false,
-                    truncated: false,
-                    query,
-                    requestedRoute,
-                    neo4jContext,
-                    ragContext,
-                    faqContext,
-                    decisionContext,
-                    contextMetrics,
-                    metadata: {
-                        memory_deferred: true,
-                        route_safety: "MEMORY_PRESSURE_DEFERRED",
-                        prompt_tokens: promptTokenEst,
-                        gemma_memory_pressure: telemetryBeforeInference.gemma_memory_pressure,
-                    }
-                });
-            }
-        }
-
-        // Implement Degraded Mode: Lower temperature for caution
-        if (isDegraded) {
-            logInfo("degraded_mode_active", { original_temp: inferenceOptions.temperature });
-            inferenceOptions.temperature = Math.min(inferenceOptions.temperature, 0.10);
-        }
-
-        logInfo("inference_options_resolved", {
-            route: resolvedRoute,
-            temperature: inferenceOptions.temperature,
-            top_p: inferenceOptions.top_p,
-            repeat_penalty: inferenceOptions.repeat_penalty,
-            num_predict: inferenceOptions.num_predict,
-        });
-
-        const deterministicContextAnswer = buildDeterministicFallbackAnswer({
-            faqContext,
-            decisionContext,
-            neo4jContext,
-            ragContext
-        });
-
-        // Step 4: Gemma primary, Gemini backup, deterministic fallback.
-        const {
-            rawAnswer,
-            synthesisProvider,
-            synthesisLatencyMs,
-            ollamaLatencyMs,
-            ollamaRuntime,
-            ollamaGenerationMeta,
-            geminiResult,
-            geminiFallbackReason,
-            gemmaPrimaryFailureReason,
-            deterministicFallbackUsed,
-        } = await runFinalSynthesis({
-            prompt,
-            resolvedRoute,
-            inferenceOptions,
-            requestId: `unified_${Date.now()}`,
-            promptTokenEst,
-            deterministicFallbackAnswer: deterministicContextAnswer,
-        });
-
-        // ── Step 5: Sanitize + truncation repair ─────────────────────────
-        const { text: finalAnswer, sanitized, truncated, rejection_reason } =
-            sanitizeResponse(rawAnswer);
-
-        if (sanitized || truncated) {
-            logWarn("response_post_processed", {
-                route: resolvedRoute,
-                sanitized,
-                truncated,
-                rejection_reason: rejection_reason ?? "meta_phrase_stripped",
-                raw_chars: rawAnswer.length,
-                clean_chars: finalAnswer.length,
-            });
-        }
-
-        const totalLatencyMs = Date.now() - pipelineStart;
-
-        logInfo("pipeline_complete", {
-            route: resolvedRoute,
-            total_latency_ms: totalLatencyMs,
-            synthesis_provider: synthesisProvider,
-            synthesis_latency_ms: synthesisLatencyMs,
-            ollama_latency_ms: ollamaLatencyMs,
-            answer_chars: finalAnswer.length,
-            answer_tokens_est: estimateTokens(finalAnswer),
-            sanitized,
-            truncated,
-            sources_used,
-        });
-
-        // ── Step 6: Return structured result ────────────────────
-        return createResult({
-            answer: finalAnswer,
-            route: resolvedRoute,
-            confidence: retrievalConfidence,
-            sources_used,
-            latency_ms: totalLatencyMs,
-            sanitized,
-            truncated,
-            query,
-            requestedRoute,
-            neo4jContext,
-            ragContext,
-            faqContext,
-            decisionContext,
-            contextMetrics,
-            metadata: {
-                model: geminiResult?.model || ollamaGenerationMeta?.model || MODEL,
-                synthesis_provider: synthesisProvider,
-                synthesis_latency_ms: synthesisLatencyMs,
-                gemini_model: geminiResult?.model || null,
-                gemini_latency_ms: geminiResult?.latencyMs || null,
-                gemini_finish_reason: geminiResult?.finishReason || null,
-                gemma_primary_used: synthesisProvider === "gemma_primary",
-                gemma_primary_failure_reason: gemmaPrimaryFailureReason,
-                gemini_backup_used: synthesisProvider === "gemini_backup",
-                gemini_backup_reason: geminiFallbackReason,
-                deterministic_context_fallback: deterministicFallbackUsed,
-                primary_model: ollamaRuntime.primary_model,
-                backup_model: ollamaRuntime.backup_model,
-                is_degraded: isDegraded,
-                llm_failover_active: ollamaRuntime.failover_active,
-                breaker_state: ollamaRuntime.breaker_state,
-                primary_failures: ollamaRuntime.primary_failures,
-                backup_activations: ollamaRuntime.backup_activations,
-                failover_count: ollamaRuntime.failover_count,
-                recovery_success: ollamaRuntime.recovery_success,
-                failover_used: !!ollamaGenerationMeta?.failover_used,
-                prompt_tokens: promptTokenEst,
-                prompt_truncated: !!ollamaGenerationMeta?.prompt_truncated || !!contextMetrics?.hard_truncated,
-                num_predict: inferenceOptions.num_predict,
-                output_tokens: geminiResult?.outputTokens || ollamaGenerationMeta?.outputTokens || estimateTokens(finalAnswer),
-                gemma_memory_pressure: ollamaRuntime.gemma_memory_pressure,
-                gemma_queue_depth: ollamaRuntime.gemma_queue_depth,
-                overload_retries: ollamaRuntime.overload_retries,
-                ollama_latency_ms: ollamaLatencyMs
-            }
-        });
-
-    } catch (error) {
-        const totalLatencyMs = Date.now() - pipelineStart;
-        const ollamaRuntimeOnFailure = getOllamaRuntimeStatus();
-
-        logError("pipeline_failed", {
-            route: resolvedRoute,
-            query_preview: truncatedQuery,
-            error_message: error?.message ?? String(error),
-            total_latency_ms: totalLatencyMs,
-            breaker_state: ollamaRuntimeOnFailure.breaker_state,
-            failover_active: ollamaRuntimeOnFailure.failover_active,
-        });
-
-        // ── Phase 3: Deterministic Fallback ──────────────────────────────
-        const deterministicAnswer = buildDeterministicFallbackAnswer({
-            faqContext,
-            decisionContext,
-            neo4jContext,
-            ragContext
-        });
-
-        // FINAL MICRO-PATCH 4: Robust source attribution for deterministic fallback
-        const fallbackSources = {
-            faq: !!buildFaqBlock(faqContext).used,
-            decision: !!buildDecisionBlock(decisionContext).used,
-            kg: !!buildNeo4jBlock(neo4jContext).used,
-            rag: !!buildRagBlock(ragContext).used,
-        };
-
-        // PHASE 8.5 — DETERMINISTIC HYBRID FUSION FALLBACK
-        if (resolvedRoute === ROUTE_TYPES.HYBRID && fallbackSources.kg && fallbackSources.rag) {
-            const hybridAnswer = buildDeterministicHybridAnswer(neo4jContext, ragContext);
-            if (hybridAnswer) {
-                logInfo("deterministic_hybrid_fallback_successful", { route: resolvedRoute });
-                incrementMetric("deterministic_fallback_total");
-                return createResult({
-                    answer: hybridAnswer,
-                    route: "HYBRID_KG_RAG",
-                    confidence: 0.89,
-                    sources_used: fallbackSources,
-                    latency_ms: totalLatencyMs,
-                    sanitized: false,
-                    truncated: false,
-                    query,
-                    requestedRoute,
-                    neo4jContext,
-                    ragContext,
-                    faqContext,
-                    decisionContext,
-                    metadata: {
-                        route_safety: "SAFE_HYBRID_FALLBACK",
-                        fallback_type: "DETERMINISTIC_HYBRID",
-                        primary_model: ollamaRuntimeOnFailure.primary_model,
-                        backup_model: ollamaRuntimeOnFailure.backup_model,
-                        breaker_state: ollamaRuntimeOnFailure.breaker_state,
-                        llm_failover_active: ollamaRuntimeOnFailure.failover_active,
-                        kg_fact_count: (kgMeta || buildNeo4jBlock(neo4jContext)).count,
-                        rag_fact_count: (ragMeta || buildRagBlock(ragContext)).count
-                    }
-                });
-            }
-        }
-
-        if (deterministicAnswer) {
-            logInfo("deterministic_fallback_successful", { route: resolvedRoute });
-            incrementMetric("deterministic_fallback_total");
-            return createResult({
-                answer: deterministicAnswer,
-                route: resolvedRoute,
-                confidence: retrievalConfidence,
-                sources_used: fallbackSources,
-                latency_ms: totalLatencyMs,
-                sanitized: false,
-                truncated: false,
-                query,
-                requestedRoute,
-                neo4jContext,
-                ragContext,
-                faqContext,
-                decisionContext,
-                metadata: {
-                    deterministic_fallback: true,
-                    route_safety: "SAFE_FALLBACK",
-                    primary_model: ollamaRuntimeOnFailure.primary_model,
-                    backup_model: ollamaRuntimeOnFailure.backup_model,
-                    breaker_state: ollamaRuntimeOnFailure.breaker_state,
-                    llm_failover_active: ollamaRuntimeOnFailure.failover_active,
-                    primary_failures: ollamaRuntimeOnFailure.primary_failures,
-                    backup_activations: ollamaRuntimeOnFailure.backup_activations,
-                    failover_count: ollamaRuntimeOnFailure.failover_count,
-                    recovery_success: ollamaRuntimeOnFailure.recovery_success
-                }
-            });
-        }
-
-        return createFallbackResult(FALLBACK_ANSWER, requestedRoute, retrievalConfidence, totalLatencyMs, fallbackSources, {
-            query,
-            route: "LLM_FALLBACK",
-            neo4jContext,
-            ragContext,
-            faqContext,
-            decisionContext,
-            metadata: {
-                route_safety: "SAFE_FAILURE",
-                primary_model: ollamaRuntimeOnFailure.primary_model,
-                backup_model: ollamaRuntimeOnFailure.backup_model,
-                breaker_state: ollamaRuntimeOnFailure.breaker_state,
-                llm_failover_active: ollamaRuntimeOnFailure.failover_active,
-                primary_failures: ollamaRuntimeOnFailure.primary_failures,
-                backup_activations: ollamaRuntimeOnFailure.backup_activations,
-                failover_count: ollamaRuntimeOnFailure.failover_count,
-                recovery_success: ollamaRuntimeOnFailure.recovery_success
-            },
-            reasoning: "System fallback triggered due to insufficient evidence.",
-            missing_information: ["Insufficient evidence available."],
-            failure: true
-        });
-    }
-}
-
-
-// ─────────────────────────────────────────────────────────────
-// NAMED INTERNAL EXPORTS
-// ─────────────────────────────────────────────────────────────
-
-export {
-    // ── Configuration ─────────────────────────────────────────────────
-    MODEL,
-    CONFIDENCE_GATE_THRESHOLD,
-    DEGRADED_CONFIDENCE_THRESHOLD,       // NEW Phase 3
-    MAX_KG_FACTS,
-    MAX_RAG_PASSAGES,
-    MAX_HISTORY_MESSAGES,
-    MAX_HISTORY_MESSAGE_CHARS,
-    MAX_HISTORY_TOTAL_CHARS,
-    MAX_MEMORY_BLOCK_CHARS,
-    DECISION_MAX_DEPTH,
-    DECISION_MAX_VALUE_CHARS,
-    PROMPT_TOKEN_WARN_THRESHOLD,
-    PROMPT_TOKEN_CRITICAL_THRESHOLD,
-    FALLBACK_ANSWER,
-    INSUFFICIENT_DATA_PHRASE,
-
-    // ── Route system ──────────────────────────────────────────────────
-    ROUTE_TYPES,
-    ROUTE_INSTRUCTIONS,
-    ROUTE_INFERENCE_OPTIONS,
-    resolveRouteType,
-    buildInferenceOptions,
-
-    // ── Context builders ──────────────────────────────────────────────
-    buildNeo4jBlock,
-    buildRagBlock,
-    buildFaqBlock,
-    buildDecisionBlock,
-    buildContextPayload,
-    normalizeGraphEvidence,
-    depthLimitedSerialize,
-    trimContextToBudget,                  // NEW Phase 3
-    buildDeterministicFallbackAnswer,     // NEW Phase 3
-
-    // ── Prompt assembly ───────────────────────────────────────────────
-    BASE_SYSTEM_PROMPT,
-    buildConversationHistoryBlock,
-    buildConversationMemoryBlock,
-    buildPrompt,
-
-    // ── Response pipeline ─────────────────────────────────────────────
-    sanitizeResponse,
-    repairTruncation,
-
-    // ── Result factories ──────────────────────────────────────────────
-    createResult,
-    createFallbackResult,
-
-    // ── Observability utilities ───────────────────────────────────────
-    logInfo,
-    logWarn,
-    logError,
-    estimateTokens,
-};
+
+function cleanGraphNodeLabel(value) {
+    let text = String(value || "").trim();
+    if (!text) return "";
+
+    const quoted = text.match(/"([^"]+)"/) || text.match(/'([^']+)'/);
+    if (quoted) return quoted[1].trim();
+
+    const propertyName = text.match(/\b(?:name|title|code|id)\s*:\s*["']?([^"',}]+)["']?/i);
+    if (propertyName) return propertyName[1].trim();
+
+    if (text.includes(":")) {
+        const parts = text.split(":");
+        text = parts[parts.length - 1].trim();
+    }
+
+    return text
+        .replace(/[{}]/g, "")
+        .replace(/\s+/g, " ")
+        .trim();
+}
+
+function cleanGraphRelationLabel(value) {
+    let text = String(value || "").trim();
+    if (!text) return "";
+    if (text.includes(":")) text = text.split(":").pop();
+    return text
+        .replace(/[`"']/g, "")
+        .replace(/\s+/g, "_")
+        .toUpperCase();
+}
+
+function relationToSentence(source, relation, target) {
+    if (!source || !relation || !target) return null;
+
+    const relationText = relation.toLowerCase().replace(/_/g, " ");
+
+    switch (relation) {
+        case "TEACHES":
+            return `${source} teaches ${target}.`;
+        case "HAS_PREREQUISITE":
+        case "REQUIRES":
+            return `${source} requires ${target}.`;
+        case "PREREQUISITE_FOR":
+            return `${source} is a prerequisite for ${target}.`;
+        case "HAS_COURSE":
+            return `${source} includes ${target}.`;
+        case "HEAD_OF":
+        case "HEAD_OF_UNIT":
+            return `${source} is head of ${target}.`;
+        case "DEAN_OF":
+            return `${source} is dean of ${target}.`;
+        case "HAS_ROLE":
+        case "ACTS_AS":
+            return `${source} serves as ${target}.`;
+        case "WORKS_IN":
+            return `${source} works in ${target}.`;
+        case "MEMBER_OF":
+            return `${source} is a member of ${target}.`;
+        case "BELONGS_TO":
+            return `${source} belongs to ${target}.`;
+        case "ADMINISTERS":
+        case "CHAIRS":
+        case "DIRECTS":
+        case "MANAGES":
+            return `${source} ${relationText} ${target}.`;
+        default:
+            return `${source} has ${relationText} relationship with ${target}.`;
+    }
+}
+
+function graphTripleToSentence(sourceRaw, relationRaw, targetRaw) {
+    const source = cleanGraphNodeLabel(sourceRaw);
+    const relation = cleanGraphRelationLabel(relationRaw);
+    const target = cleanGraphNodeLabel(targetRaw);
+    return relationToSentence(source, relation, target);
+}
+
+function normalizeGraphEvidence(text) {
+    let normalized = String(text || "").replace(/\s+/g, " ").trim();
+    if (!normalized) return "";
+
+    const graphTriplePattern =
+        /\(([^()]+)\)\s*-+\s*\[\s*:?\s*([A-Za-z0-9_]+(?::[A-Za-z0-9_]+)?)\s*\]\s*-+>\s*\(([^()]+)\)/g;
+
+    normalized = normalized.replace(graphTriplePattern, (match, source, relation, target) =>
+        graphTripleToSentence(source, relation, target) || match
+    );
+
+    const propertyPattern = /^\(([^:()]+):\s*["']?([^"')]+)["']?\)\s+([A-Za-z0-9_ ]+):\s*(.+)$/;
+    const propertyMatch = normalized.match(propertyPattern);
+    if (propertyMatch) {
+        const entityName = propertyMatch[2].trim();
+        const propertyName = propertyMatch[3].trim().toLowerCase().replace(/_/g, " ");
+        const propertyValue = propertyMatch[4].trim();
+        return `${entityName} ${propertyName}: ${propertyValue}`;
+    }
+
+    return normalized;
+}
+
+/**
+ * Builds a readable text block from Neo4j Knowledge Graph results.
+ * Sorts by confidence descending, caps at MAX_KG_FACTS.
+ *
+ * @param {Array<{ evidence?: string, confidence?: number, metadata?: object }>} neo4jContext
+ * @param {number} [limit=MAX_KG_FACTS]
+ * @returns {{ block: string, count: number, used: boolean }}
+ */
+function buildNeo4jBlock(neo4jContext, limit = MAX_KG_FACTS) {
+    if (!Array.isArray(neo4jContext) || neo4jContext.length === 0) {
+        return { block: "", count: 0, used: false };
+    }
+
+    const sorted = [...neo4jContext].sort((a, b) =>
+        (b.confidence ?? 0) - (a.confidence ?? 0)
+    );
+    const capped = sorted.slice(0, limit);
+
+    const lines = capped
+        .map((item, idx) => {
+            if (!item || typeof item !== "object") return null;
+            const rawEvidence = normalizeGraphEvidence(item.evidence ?? item.text ?? item.content ?? "");
+            const evidence = rawEvidence.length > 520
+                ? `${rawEvidence.slice(0, 520).trimEnd()}\u2026[truncated]`
+                : rawEvidence;
+            if (!evidence) return null;
+
+            const confidenceLabel =
+                typeof item.confidence === "number"
+                    ? ` [confidence: ${Math.round(item.confidence * 100)}%]`
+                    : "";
+
+            const meta = item.metadata ?? {};
+            const metaParts = [];
+            if (meta.source) metaParts.push(`source: ${meta.source}`);
+            if (typeof meta.node_count === "number") metaParts.push(`nodes: ${meta.node_count}`);
+            if (typeof meta.rel_count === "number") metaParts.push(`rels: ${meta.rel_count}`);
+            const metaLabel = metaParts.length > 0 ? ` (${metaParts.join(", ")})` : "";
+
+            return `  [KG-${idx + 1}]${confidenceLabel} ${evidence}${metaLabel}`;
+        })
+        .filter(Boolean);
+
+    if (lines.length === 0) return { block: "", count: 0, used: false };
+
+    const block =
+        "### Knowledge Graph Facts (Neo4j — Verified Structured Data)\n" +
+        lines.join("\n");
+
+    return { block, count: lines.length, used: true };
+}
+
+/**
+ * Builds a readable text block from RAG-retrieved document chunks.
+ * Accepts { results } envelope, raw array, or pre-joined string.
+ * Caps at limit (default MAX_RAG_PASSAGES).
+ *
+ * @param {{ results?: Array<object> } | Array<object> | string | null} ragContext
+ * @param {number} [limit=MAX_RAG_PASSAGES]
+ * @returns {{ block: string, count: number, used: boolean }}
+ */
+function buildRagBlock(ragContext, limit = MAX_RAG_PASSAGES) {
+    if (!ragContext) return { block: "", count: 0, used: false };
+
+    let unwrapped = ragContext;
+    if (
+        typeof ragContext === "object" &&
+        !Array.isArray(ragContext) &&
+        Array.isArray(ragContext.results)
+    ) {
+        unwrapped = ragContext.results;
+    }
+
+    let passages = [];
+
+    if (typeof unwrapped === "string") {
+        passages = unwrapped.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
+    } else if (Array.isArray(unwrapped)) {
+        passages = unwrapped
+            .map(item => {
+                if (typeof item === "string") return item.trim();
+                if (item && typeof item === "object") {
+                    return (item.text ?? item.content ?? item.pageContent ?? "").trim();
+                }
+                return "";
+            })
+            .filter(Boolean);
+    }
+
+    if (passages.length === 0) return { block: "", count: 0, used: false };
+
+    const capped = passages.slice(0, limit).map((passage) =>
+        passage.length > 600
+            ? `${passage.slice(0, 600).trimEnd()}\u2026[truncated]`
+            : passage
+    );
+
+    const block =
+        "### Retrieved Document Context (RAG — Verified Passages)\n" +
+        capped.join("\n\n");
+
+    return { block, count: capped.length, used: true };
+}
+
+/**
+ * Builds a readable text block from an FAQ system result.
+ * FAQ is the highest-confidence source; placed first in context.
+ *
+ * @param {{ question?: string; answer?: string; source?: string } | null} faqContext
+ * @returns {{ block: string, count: number, used: boolean }}
+ */
+function buildFaqBlock(faqContext) {
+    if (!faqContext || typeof faqContext !== "object") return { block: "", count: 0, used: false };
+
+    const question = faqContext.question?.trim() ?? "";
+    const answer = faqContext.answer?.trim() ?? "";
+    const source = faqContext.source?.trim() ?? "";
+
+    if (!answer) return { block: "", count: 0, used: false };
+
+    let block = "### FAQ Match (Highest-Confidence — Official Policy Wording)\n";
+    if (question) block += `  Question : ${question}\n`;
+    block += `  Answer   : ${answer}`;
+    if (source) block += `\n  Source   : ${source}`;
+
+    return { block, count: 1, used: true };
+}
+
+
+// ─────────────────────────────────────────────────────────────
+// SECTION 3a — DECISION BLOCK SAFE SERIALIZATION
+// TASK 5: Depth-limited, value-truncated serialization prevents
+// deeply nested rule engine results from bloating the prompt.
+// ─────────────────────────────────────────────────────────────
+
+/**
+ * Recursively serializes an arbitrary value to a prompt-safe representation
+ * with configurable depth and string-value length limits.
+ *
+ * Depth-limiting strategy:
+ *   - Primitives are always serialized.
+ *   - Arrays at depth >= maxDepth are summarized as "[N items]".
+ *   - Objects at depth >= maxDepth are replaced with "[object]".
+ *   - String values longer than maxStringChars are truncated with "…[truncated]".
+ *
+ * This prevents the common failure mode where nested prerequisite trees or
+ * rule engine payloads flood the prompt with hundreds of irrelevant tokens
+ * that crowd out base instructions and route directives.
+ *
+ * @param {unknown}  value
+ * @param {number}   maxDepth       - Max nesting depth.
+ * @param {number}   maxStringChars - Max chars for any single string value.
+ * @param {number}   [_depth=0]     - Current recursion depth (internal use only).
+ * @returns {unknown}                 Prompt-safe representation of value.
+ */
+function depthLimitedSerialize(
+    value,
+    maxDepth = DECISION_MAX_DEPTH,
+    maxStringChars = DECISION_MAX_VALUE_CHARS,
+    _depth = 0
+) {
+    if (value === null || value === undefined) return value;
+
+    if (typeof value === "string") {
+        return value.length > maxStringChars
+            ? `${value.slice(0, maxStringChars)}\u2026[truncated]`
+            : value;
+    }
+
+    if (typeof value === "number" || typeof value === "boolean") return value;
+
+    if (_depth >= maxDepth) {
+        if (Array.isArray(value)) return `[${value.length} items]`;
+        if (typeof value === "object") return "[object]";
+        return String(value);
+    }
+
+    if (Array.isArray(value)) {
+        return value.map(item =>
+            depthLimitedSerialize(item, maxDepth, maxStringChars, _depth + 1)
+        );
+    }
+
+    if (typeof value === "object") {
+        const result = {};
+        for (const [k, v] of Object.entries(value)) {
+            result[k] = depthLimitedSerialize(v, maxDepth, maxStringChars, _depth + 1);
+        }
+        return result;
+    }
+
+    return String(value);
+}
+
+/**
+ * Builds a readable text block from the decision engine's `factors` object.
+ * Uses depth-limited serialization to prevent prompt token overflow.
+ *
+ * @param {Record<string, unknown> | null} decisionContext
+ * @returns {{ block: string, count: number, used: boolean }}
+ */
+function buildDecisionBlock(decisionContext) {
+    const normalizedDecisionContext =
+        Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;
+
+    if (
+        !normalizedDecisionContext ||
+        typeof normalizedDecisionContext !== "object" ||
+        Array.isArray(normalizedDecisionContext) ||
+        Object.keys(normalizedDecisionContext).length === 0
+    ) {
+        return { block: "", count: 0, used: false };
+    }
+
+    let summary;
+    try {
+        const safe = depthLimitedSerialize(normalizedDecisionContext);
+
+        const factorLines = Object.entries(safe).map(([k, v]) => {
+            const displayValue =
+                typeof v === "object" && v !== null
+                    ? JSON.stringify(v)
+                    : String(v);
+            return `  \u2022 ${k}: ${displayValue}`;
+        });
+        summary = factorLines.join("\n");
+    } catch {
+        logWarn("decision_block_serialize_failed", {
+            reason: "factors object could not be serialized safely — block skipped",
+        });
+        return { block: "", count: 0, used: false };
+    }
+
+    const block =
+        "### Decision Engine Factors (Rule-Based Engine — Verified Logic)\n" +
+        summary;
+
+    return { block, count: Object.keys(normalizedDecisionContext).length, used: true };
+}
+
+/**
+ * PROMPT AUTO-TRIMMING (Phase 3 Stabilization)
+ * ───────────────────────────────────────────
+ * Proactively reduces context sizes based on prompt budget thresholds.
+ *
+ * @param {number} currentTokens
+ * @returns {object} Trimmed limits for builders
+ */
+function trimContextToBudget(currentTokens) {
+    const config = {
+        kgFacts: MAX_KG_FACTS,
+        ragPassages: MAX_RAG_PASSAGES,
+        includeRag: true,
+        includeKg: true,
+        includeDecision: true,
+        includeFaq: true,
+    };
+
+    if (currentTokens >= PROMPT_TOKEN_CRITICAL_THRESHOLD) {
+        logWarn("context_trimming_critical", { tokens: currentTokens });
+        // Drop low-priority context first while preserving KG and decision facts.
+        config.includeRag = false;
+        config.kgFacts = Math.max(1, MAX_KG_FACTS);
+        config.includeKg = true;
+        config.includeDecision = true;
+    } else if (currentTokens >= PROMPT_TOKEN_WARN_THRESHOLD) {
+        logWarn("context_trimming_warning", { tokens: currentTokens });
+        config.kgFacts = MAX_KG_FACTS;
+        config.ragPassages = Math.max(1, Math.floor(MAX_RAG_PASSAGES / 2));
+    }
+
+    return config;
+}
+
+/**
+ * Aggregates all context blocks into a single composite payload.
+ * Priority ordering: FAQ (1st) → Decision (2nd) → KG (3rd) → RAG (4th).
+ *
+ * TASK 6: Computes sources_used attribution booleans from builder results.
+ *
+ * @param {object} params
+ * @param {object} [trimConfig]
+ * @returns {{ payload: string, metrics: object, sources_used: SourcesUsed }}
+ */
+function buildContextPayload({ neo4jContext, ragContext, faqContext, decisionContext }, trimConfig = null) {
+    const config = trimConfig || {
+        kgFacts: MAX_KG_FACTS,
+        ragPassages: MAX_RAG_PASSAGES,
+        includeRag: true,
+        includeKg: true,
+        includeDecision: true,
+        includeFaq: true
+    };
+
+    const faqResult = config.includeFaq ? buildFaqBlock(faqContext) : { block: "", count: 0, used: false };
+    const decisionResult = config.includeDecision ? buildDecisionBlock(decisionContext) : { block: "", count: 0, used: false };
+    const kgResult = config.includeKg ? buildNeo4jBlock(neo4jContext, config.kgFacts) : { block: "", count: 0, used: false };
+    const ragResult = config.includeRag ? buildRagBlock(ragContext, config.ragPassages) : { block: "", count: 0, used: false };
+
+    // Priority order: FAQ direct answer, then KG facts > Decision > RAG.
+    const orderedBlocks = [
+        faqResult.block,
+        kgResult.block,
+        decisionResult.block,
+        ragResult.block,
+    ].filter(Boolean);
+
+    const payload = orderedBlocks.join("\n\n");
+
+    /**
+     * TASK 6 — Source attribution: which builders produced non-empty content.
+     * @type {SourcesUsed}
+     */
+    const sources_used = {
+        faq: faqResult.used,
+        decision: decisionResult.used,
+        kg: kgResult.used,
+        rag: ragResult.used,
+    };
+
+    const metrics = {
+        faq_entries: faqResult.count,
+        decision_factors: decisionResult.count,
+        kg_facts: kgResult.count,
+        rag_passages: ragResult.count,
+        total_blocks: orderedBlocks.length,
+        payload_chars: payload.length,
+        payload_tokens_est: estimateTokens(payload),
+        sources_used,
+    };
+
+    return { payload, metrics, sources_used };
+}
+
+/**
+ * PHASE 8.5 — DETERMINISTIC HYBRID FUSION SYNTHESIS
+ * Merges top KG facts and top RAG passages into a coherent advisory response
+ * without LLM inference. Ensures recruiter-grade coverage of both domains.
+ *
+ * @param {Array} neo4jContext
+ * @param {Array} ragContext
+ * @returns {string} Fused hybrid answer
+ */
+function buildDeterministicHybridAnswer(neo4jContext, ragContext) {
+    const kgFacts = extractKgFacts(neo4jContext, 2);
+    const ragFacts = extractRagFacts(ragContext, 2);
+
+    if (kgFacts.length === 0 && ragFacts.length === 0) return "";
+
+    const parts = [];
+
+    if (kgFacts.length > 0) {
+        parts.push(kgFacts.join(" "));
+    }
+
+    if (ragFacts.length > 0) {
+        const ragIntro = "AAST academic regulations: ";
+        parts.push(ragIntro + ragFacts.join(" "));
+    }
+
+    return parts.join("\n\n").trim();
+}
+
+/**
+ * DETERMINISTIC FALLBACK BUILDER (Phase 3 Stabilization)
+ * ──────────────────────────────────────────────────
+ * Synthesizes a verified answer from structured context without LLM inference.
+ * Used as a primary safety net for LLM failures or timeouts.
+ */
+function buildDeterministicFallbackAnswer({ faqContext, decisionContext, neo4jContext, ragContext }) {
+    const normalizedDecisionContext =
+        Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;
+
+    // 1. FAQ answer (Highest precision)
+    if (faqContext?.answer) {
+        return `According to verified university policy: ${faqContext.answer}`;
+    }
+
+    // 2. Decision summary
+    if (normalizedDecisionContext) {
+        const outcome =
+            normalizedDecisionContext.outcome ||
+            normalizedDecisionContext.verdict ||
+            normalizedDecisionContext.recommendation ||
+            normalizedDecisionContext.career_path;
+        if (outcome) {
+            return `Based on verified academic evaluation: The advisory system has determined the outcome is: ${outcome}. Please contact your advisor for full details.`;
+        }
+    }
+
+    // 3. KG top fact
+    if (Array.isArray(neo4jContext) && neo4jContext.length > 0) {
+        const sorted = [...neo4jContext].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
+        const topFact = sorted[0];
+        const evidence = normalizeGraphEvidence(topFact?.evidence || topFact?.text || topFact?.content);
+        if (evidence) {
+            return `According to verified university records: ${evidence}`;
+        }
+    }
+
+    // 4. RAG summary (First passage)
+    if (ragContext) {
+        let firstPassage = "";
+        if (Array.isArray(ragContext) && ragContext[0]) {
+            firstPassage = typeof ragContext[0] === 'string' ? ragContext[0] : (ragContext[0].text || ragContext[0].content);
+        } else if (ragContext.results && ragContext.results[0]) {
+            firstPassage = ragContext.results[0].text || ragContext.results[0].content;
+        }
+
+        if (firstPassage && firstPassage.length > 20) {
+            return `According to official university documentation: ${firstPassage.slice(0, 300).trim()}...`;
+        }
+    }
+
+    return null;
+}
+
+
+// ─────────────────────────────────────────────────────────────
+// SECTION 4 — PROMPT BUILDER (Route-Aware)
+// ─────────────────────────────────────────────────────────────
+
+/**
+ * Core system prompt establishing the advisor persona and hard rules.
+ * Route-specific instructions are appended dynamically at build time.
+ *
+ * TASK 2 note: "ALWAYS write complete sentences." instruction added
+ * to reinforce the truncation-guard objective at the model level.
+ */
+const BASE_SYSTEM_PROMPT = `
+You are an expert academic advisor at AAST (Arab Academy for Science, Technology & Maritime Transport).
+Your role is to assist students with accurate, trustworthy, and professional academic guidance.
+
+STRICT RULES YOU MUST FOLLOW AT ALL TIMES:
+───
+1. ONLY use the verified context provided below. Do NOT use any outside knowledge.
+2. NEVER hallucinate, invent, speculate, or assume any university policy, rule, or data.
+3. NEVER reference facts, names, deadlines, requirements, or regulations not explicitly in the provided context.
+4. If the provided context does not contain enough information to answer the question confidently, respond with exactly:
+   "${INSUFFICIENT_DATA_PHRASE}"
+5. Do NOT mention that you are an AI model, that you consulted a database, or describe your internal workings.
+6. NEVER say "according to my training data" or "based on my knowledge" — speak purely from the verified context given.
+
+TONE AND STYLE:
+───
+- Warm, professional, and student-friendly.
+- Clear and direct. Plain English. No invented jargon.
+- Empathetic and encouraging where appropriate.
+- Concise but complete — no padding, no omission of critical detail.
+- Natural paragraphs. Bullet lists acceptable when listing steps or options.
+- Do NOT start with "Based on the context provided" or similar meta-phrases.
+- Do NOT repeat the student's question back verbatim as an opener.
+- If the user starts conversationally, respond briefly and professionally before answering.
+- ALWAYS write complete sentences. Never end mid-sentence or with a dangling clause.
+
+RESPONSE QUALITY STANDARDS:
+───
+- Accuracy over creativity. When uncertain, err toward caution.
+- Every factual claim must be traceable to the provided context.
+- Prioritise: FAQ answer → Decision factors → Knowledge Graph facts → Document passages.
+`.trim();
+
+/**
+ * Resolves and validates the route type.
+ * Unknown or missing route types fall back to LLM_FALLBACK.
+ *
+ * @param {string|undefined} routeType
+ * @returns {string} A valid ROUTE_TYPES value.
+ */
+function resolveRouteType(routeType) {
+    const normalizedRoute = String(routeType || "").trim().toUpperCase();
+
+    if (normalizedRoute && Object.values(ROUTE_TYPES).includes(normalizedRoute)) {
+        return normalizedRoute;
+    }
+
+    if (normalizedRoute === "HYBRID_KG_RAG") return ROUTE_TYPES.HYBRID;
+    if (["DECISION_ENGINE", "DECISION", "RECOMMEND", "RECOMMENDATION", "COMPARISON"].includes(normalizedRoute)) {
+        return ROUTE_TYPES.DECISION;
+    }
+    if (["CAREER_ENGINE", "CAREER", "CAREER_PATH_DETAIL"].includes(normalizedRoute)) {
+        return ROUTE_TYPES.CAREER;
+    }
+    if (normalizedRoute === "GENERAL") return ROUTE_TYPES.GENERAL;
+    if (normalizedRoute === "KG") return ROUTE_TYPES.KG_ONLY;
+    if (normalizedRoute === "RAG") return ROUTE_TYPES.RAG_ONLY;
+    if (normalizedRoute === "FAQ") return ROUTE_TYPES.FAQ_ONLY;
+
+    return ROUTE_TYPES.LLM_FALLBACK;
+}
+
+function normalizeExplainabilityRoute(routeType, query = "", decisionContext = null) {
+    const normalizedRoute = String(routeType || "").trim().toUpperCase();
+    const normalizedQuery = String(query || "").toLowerCase();
+    const normalizedDecisionContext =
+        Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;
+    const recommendationText = String(
+        normalizedDecisionContext?.recommendation ||
+        normalizedDecisionContext?.career_path ||
+        normalizedDecisionContext?.outcome ||
+        ""
+    ).toLowerCase();
+
+    if (normalizedRoute === "HYBRID_KG_RAG" || normalizedRoute === "HYBRID") return "HYBRID_KG_RAG";
+    if (["CAREER_ENGINE", "CAREER", "CAREER_PATH_DETAIL"].includes(normalizedRoute)) return "CAREER";
+    if (normalizedRoute === "LLM_FALLBACK") return "LLM_FALLBACK";
+    if (normalizedRoute === "GENERAL") return "GENERAL";
+    if (normalizedRoute === "FAQ_ONLY") return "GENERAL";
+    if (normalizedRoute === "KG_ONLY") return "GENERAL";
+    if (normalizedRoute === "RAG_ONLY") return "GENERAL";
+
+    if (
+        normalizedRoute === "COMPARISON" ||
+        recommendationText.startsWith("comparison:") ||
+        /\b(compare|comparison|versus|vs)\b/.test(normalizedQuery)
+    ) {
+        return "COMPARISON";
+    }
+
+    if (
+        normalizedRoute === "RECOMMEND" ||
+        normalizedRoute === "RECOMMENDATION" ||
+        /\b(best major|recommend|recommended major|which major)\b/.test(normalizedQuery)
+    ) {
+        return "RECOMMENDATION";
+    }
+
+    if (normalizedRoute === "DECISION_ENGINE" || normalizedRoute === "DECISION") {
+        return "DECISION";
+    }
+
+    return "LLM_FALLBACK";
+}
+
+function normalizeHistoryContent(content) {
+    const text = String(content || "")
+        .replace(/\s+/g, " ")
+        .trim();
+
+    if (!text) return "";
+
+    return text.length > MAX_HISTORY_MESSAGE_CHARS
+        ? `${text.slice(0, MAX_HISTORY_MESSAGE_CHARS).trim()}...`
+        : text;
+}
+
+function buildConversationHistoryBlock(history = [], currentQuery = "") {
+    if (!Array.isArray(history) || history.length === 0) return "";
+
+    const currentQueryKey = normalizeHistoryContent(currentQuery).toLowerCase();
+    const messages = history
+        .filter(message => message && typeof message === "object")
+        .filter(message => String(message.role || "").toLowerCase() !== "system")
+        .map(message => ({
+            role: String(message.role || "").toLowerCase(),
+            content: normalizeHistoryContent(message.content),
+        }))
+        .filter(message => ["user", "assistant"].includes(message.role) && message.content)
+        .slice(-MAX_HISTORY_MESSAGES);
+
+    if (
+        messages.length > 0 &&
+        messages[messages.length - 1].role === "user" &&
+        messages[messages.length - 1].content.toLowerCase() === currentQueryKey
+    ) {
+        messages.pop();
+    }
+
+    if (messages.length === 0) return "";
+
+    let totalChars = 0;
+    const lines = [];
+
+    for (const message of messages) {
+        const line = `${message.role.toUpperCase()}: ${message.content}`;
+        if (totalChars + line.length > MAX_HISTORY_TOTAL_CHARS) break;
+        lines.push(line);
+        totalChars += line.length;
+    }
+
+    if (lines.length === 0) return "";
+
+    return [
+        "RECENT CONVERSATION HISTORY:",
+        "Use this only for continuity, pronoun resolution, and conversational flow. Do not treat it as verified academic evidence.",
+        ...lines,
+    ].join("\n");
+}
+
+function normalizeMemoryValue(value, limit = 140) {
+    if (typeof value !== "string") return "";
+    return value.replace(/\s+/g, " ").trim().slice(0, limit);
+}
+
+function formatMemoryEntity(entity) {
+    if (!entity) return "";
+
+    if (typeof entity === "string") {
+        return normalizeMemoryValue(entity);
+    }
+
+    if (typeof entity !== "object") return "";
+
+    const value = normalizeMemoryValue(entity.value || entity.name || entity.label);
+    const type = normalizeMemoryValue(entity.type || "entity", 40);
+    return value ? `${type}: ${value}` : "";
+}
+
+function buildConversationMemoryBlock(conversationMemory = null) {
+    if (!conversationMemory || typeof conversationMemory !== "object") return "";
+
+    const lines = [];
+    const topic = normalizeMemoryValue(conversationMemory.lastTopic, 80);
+    const entity = formatMemoryEntity(conversationMemory.lastEntity);
+    const intent = normalizeMemoryValue(conversationMemory.lastIntent, 80);
+    const recentSubjects = Array.isArray(conversationMemory.recentSubjects)
+        ? conversationMemory.recentSubjects.map(subject => normalizeMemoryValue(subject, 80)).filter(Boolean).slice(0, 3)
+        : [];
+    const summary = normalizeMemoryValue(conversationMemory.lastAssistantSummary, 180);
+
+    if (topic) lines.push(`- Current topic: ${topic}`);
+    if (entity) lines.push(`- Last discussed entity: ${entity}`);
+    if (recentSubjects.length > 0) lines.push(`- Recent subject: ${recentSubjects.join("; ")}`);
+    if (intent) lines.push(`- Recent intent: ${intent}`);
+    if (summary) lines.push(`- Last assistant answer summary: ${summary}`);
+
+    if (lines.length === 0) return "";
+
+    const block = [
+        "CONVERSATION MEMORY:",
+        "Use only for continuity and pronoun resolution. It is not verified evidence; verified context always wins.",
+        ...lines
+    ].join("\n");
+
+    return block.length > MAX_MEMORY_BLOCK_CHARS
+        ? `${block.slice(0, MAX_MEMORY_BLOCK_CHARS).trimEnd()}...`
+        : block;
+}
+
+/**
+ * Assembles the full inference prompt from base system prompt,
+ * route-specific behavioral instructions, context payload, and query.
+ *
+ * @param {string} query
+ * @param {string} contextPayload
+ * @param {string} routeType
+ * @param {Array} [history=[]]
+ * @param {object|null} [conversationMemory=null]
+ * @returns {string}
+ */
+function buildPrompt(query, contextPayload, routeType, history = [], conversationMemory = null) {
+    const routeInstruction =
+        ROUTE_INSTRUCTIONS[routeType] ??
+        ROUTE_INSTRUCTIONS[ROUTE_TYPES.LLM_FALLBACK];
+
+    const divider = "─".repeat(60);
+
+    const contextSection = contextPayload
+        ? `VERIFIED CONTEXT:\n${divider}\n${contextPayload}\n${divider}`
+        : `VERIFIED CONTEXT:\n${divider}\n[No structured context was retrieved for this query.]\n${divider}`;
+    const historySection = buildConversationHistoryBlock(history, query);
+    const memorySection = buildConversationMemoryBlock(conversationMemory);
+
+    return (
+        `${BASE_SYSTEM_PROMPT}\n\n` +
+        `${routeInstruction}\n\n` +
+        `${memorySection ? `${memorySection}\n\n` : ""}` +
+        `${historySection ? `${historySection}\n\n` : ""}` +
+        `${contextSection}\n\n` +
+        `STUDENT QUERY:\n${query.trim()}\n\n` +
+        `ADVISOR RESPONSE:`
+    );
+}
+
+
+// ─────────────────────────────────────────────────────────────
+// SECTION 5 — RESPONSE SANITIZATION + ANTI-TRUNCATION GUARD
+// TASK 3 + existing sanitization pipeline.
+// ─────────────────────────────────────────────────────────────
+
+/**
+ * Regex patterns indicating model self-reference or generic AI filler.
+ * @type {RegExp[]}
+ */
+const META_PHRASE_PATTERNS = [
+    /based on the (context|information) provided/gi,
+    /according to my training data/gi,
+    /as an? (ai|language model|llm|chatbot)/gi,
+    /i (don't|do not) have access to real.?time/gi,
+    /my knowledge (cut.?off|cutoff)/gi,
+    /i cannot (browse|access|search) the (internet|web|database)/gi,
+    /let me (look that up|check|search)/gi,
+    /^(great question!?)[,\s]/i,
+    /\[no structured context was retrieved[^\]]*\]/gi,
+];
+
+/**
+ * Characters that unambiguously terminate a complete sentence.
+ * Used by repairTruncation to determine response completeness.
+ * @type {RegExp}
+ */
+const TERMINAL_PUNCTUATION_RE = /[.!?\u2026"')\]]/;
+
+/**
+ * TASK 3 — Anti-truncation guard.
+ *
+ * Detects incomplete LLM responses using the absence of terminal punctuation
+ * at the end of the text. This catches the failure mode where Gemma's output
+ * is cut off by context-window overflow mid-generation.
+ *
+ * Repair strategy:
+ *   1. Locate the last sentence-boundary punctuation in the text.
+ *   2. Trim to that boundary, discarding the dangling incomplete fragment.
+ *   3. If the repaired remainder is under 20 characters, the response is
+ *      too damaged to be useful — return INSUFFICIENT_DATA_PHRASE instead.
+ *
+ * The model-level instruction "ALWAYS write complete sentences" in BASE_SYSTEM_PROMPT
+ * reduces truncation frequency; this guard handles the cases that slip through.
+ *
+ * @param {string} text - Post-sanitization response text.
+ * @returns {{ text: string, repaired: boolean, truncated: boolean }}
+ */
+function repairTruncation(text) {
+    if (!text) return { text, repaired: false, truncated: false };
+
+    const trimmed = text.trimEnd();
+    const lastChar = trimmed.at(-1) ?? "";
+
+    // Terminal punctuation present — response is complete
+    if (TERMINAL_PUNCTUATION_RE.test(lastChar)) {
+        return { text: trimmed, repaired: false, truncated: false };
+    }
+
+    // Appears truncated — find the last sentence boundary
+    const lastBoundaryMatch = trimmed.match(/[.!?\u2026][^.!?\u2026]*$/);
+
+    if (lastBoundaryMatch) {
+        const lastBoundaryIdx = trimmed.lastIndexOf(lastBoundaryMatch[0]);
+        if (lastBoundaryIdx > 0) {
+            const repaired = trimmed.slice(0, lastBoundaryIdx + 1).trim();
+
+            if (repaired.length >= 20) {
+                return { text: repaired, repaired: true, truncated: true };
+            }
+        }
+    }
+
+    // Repair produced insufficient text — return safe fallback
+    return {
+        text: INSUFFICIENT_DATA_PHRASE,
+        repaired: false,
+        truncated: true,
+    };
+}
+
+/**
+ * Sanitizes raw LLM output through a multi-stage cleaning pipeline.
+ *
+ * Stages:
+ *   1. Null/empty guard            → FALLBACK_ANSWER
+ *   2. Meta-phrase strip           → remove model self-references (inline + full-line)
+ *   3. Consecutive deduplication   → collapse repeated adjacent sentences
+ *   4. Whitespace normalization    → collapse excess blank lines
+ *   5. Minimum length guard        → ultra-short → INSUFFICIENT_DATA_PHRASE
+ *   6. Truncation repair (TASK 3)  → detect and fix incomplete sentence endings
+ *
+ * @param {string|null|undefined} rawResponse
+ * @returns {{ text: string, sanitized: boolean, truncated: boolean, rejection_reason?: string }}
+ */
+function sanitizeResponse(rawResponse) {
+    // Stage 1: Null/empty guard
+    if (!rawResponse || typeof rawResponse !== "string" || rawResponse.trim().length === 0) {
+        return { text: FALLBACK_ANSWER, sanitized: true, truncated: false, rejection_reason: "empty_response" };
+    }
+
+    let text = rawResponse.trim();
+
+    // Stage 2: Strip meta-model phrases
+    const lines = text.split("\n");
+    const cleanedLines = lines
+        .map(line => {
+            const stripped = line.trim();
+            for (const pattern of META_PHRASE_PATTERNS) {
+                pattern.lastIndex = 0;
+                if (pattern.test(stripped)) {
+                    if (stripped.replace(pattern, "").trim().length < 10) return null;
+                }
+            }
+            let cleaned = line;
+            for (const pattern of META_PHRASE_PATTERNS) {
+                pattern.lastIndex = 0;
+                cleaned = cleaned.replace(pattern, "");
+            }
+            return cleaned.trim() || null;
+        })
+        .filter(line => line !== null);
+
+    text = cleanedLines.join("\n").trim();
+
+    // Stage 3: Consecutive sentence deduplication
+    const sentences = text.split(/(?<=[.!?])\s+/);
+    const deduplicated = sentences.filter((sentence, idx) => {
+        if (idx === 0) return true;
+        const normalize = s =>
+            s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
+        return normalize(sentence) !== normalize(sentences[idx - 1]);
+    });
+    text = deduplicated.join(" ").trim();
+
+    // Stage 4: Whitespace normalization
+    text = text.replace(/\n{3,}/g, "\n\n").trim();
+
+    // Stage 5: Minimum length guard
+    if (text.split(/\s+/).length < 5) {
+        return {
+            text: INSUFFICIENT_DATA_PHRASE,
+            sanitized: true,
+            truncated: false,
+            rejection_reason: "response_too_short",
+        };
+    }
+
+    // Stage 6: Truncation repair (TASK 3)
+    const { text: repairedText, repaired, truncated } = repairTruncation(text);
+
+    const wasSanitized = repairedText !== rawResponse.trim() || repaired;
+
+    return {
+        text: repairedText,
+        sanitized: wasSanitized,
+        truncated,
+        rejection_reason: repaired ? "truncation_repaired" : undefined,
+    };
+}
+
+
+// ─────────────────────────────────────────────────────────────
+// SECTION 6 — STRUCTURED RESPONSE TYPE (TASK 2)
+// UnifiedAnswerResult replaces the bare string return.
+// toString() provides soft backward compatibility.
+// ─────────────────────────────────────────────────────────────
+
+/**
+ * @typedef {object} SourcesUsed
+ * @property {boolean} faq      - Whether a FAQ entry contributed to the answer.
+ * @property {boolean} kg       - Whether KG facts contributed to the answer.
+ * @property {boolean} rag      - Whether RAG passages contributed to the answer.
+ * @property {boolean} decision - Whether decision engine factors contributed.
+ */
+
+/**
+ * @typedef {object} UnifiedAnswerResult
+ * @property {string}      answer       - The synthesized advisory answer string.
+ * @property {string}      route        - The resolved ROUTE_TYPES value used.
+ * @property {number}      confidence   - The retrievalConfidence value passed in.
+ * @property {SourcesUsed} sources_used - Which upstream sources contributed.
+ * @property {number}      latency_ms   - Total pipeline wall-clock time in ms.
+ * @property {boolean}     sanitized    - Whether the response was modified by sanitization.
+ * @property {boolean}     truncated    - Whether a truncated response was detected.
+ */
+
+/**
+ * Constructs a UnifiedAnswerResult object.
+ *
+ * BACKWARD COMPATIBILITY NOTE:
+ *   The returned object implements toString() returning `answer`, enabling
+ *   orchestrators that use the result in string contexts (template literals,
+ *   implicit coercion, responseFormatter.format(result)) to continue working
+ *   without modification.
+ *
+ *   Recommended v4 migration:
+ *     const result  = await generateUnifiedAnswer({ ... });
+ *     const answer  = result.answer;
+ *     const sources = result.sources_used;   // new transparency capability
+ *
+ * @param {object} params
+ * @returns {UnifiedAnswerResult}
+ */
+function normalizeProbability(value, fallback = 0) {
+    const n = Number.parseFloat(value);
+    if (!Number.isFinite(n)) return fallback;
+    return Math.max(0, Math.min(1, n));
+}
+
+function unwrapDecisionContext(decisionContext) {
+    return Array.isArray(decisionContext) ? decisionContext[0] ?? null : decisionContext;
+}
+
+function dedupeTextList(values) {
+    const seen = new Set();
+    const deduped = [];
+
+    for (const value of values) {
+        const text = String(value || "").replace(/\s+/g, " ").trim();
+        if (!text) continue;
+        const key = text.toLowerCase();
+        if (seen.has(key)) continue;
+        seen.add(key);
+        deduped.push(text);
+    }
+
+    return deduped;
+}
+
+function truncateEvidence(text, maxChars = 320) {
+    const normalized = String(text || "").replace(/\s+/g, " ").trim();
+    if (!normalized) return "";
+    return normalized.length > maxChars ? `${normalized.slice(0, maxChars).trim()}...` : normalized;
+}
+
+function extractKgFacts(neo4jContext, limit = MAX_KG_FACTS) {
+    if (!Array.isArray(neo4jContext) || neo4jContext.length === 0) return [];
+
+    return dedupeTextList(
+        neo4jContext
+            .slice()
+            .sort((a, b) => (b?.confidence ?? 0) - (a?.confidence ?? 0))
+            .map(item => item?.evidence ?? item?.text ?? item?.content ?? "")
+            .map(text => normalizeGraphEvidence(text))
+            .map(text => truncateEvidence(text, 260))
+    ).slice(0, limit);
+}
+
+function extractRagFacts(ragContext, limit = MAX_RAG_PASSAGES) {
+    if (!ragContext) return [];
+
+    const normalizedContext =
+        typeof ragContext === "object" &&
+        !Array.isArray(ragContext) &&
+        Array.isArray(ragContext.results)
+            ? ragContext.results
+            : ragContext;
+
+    if (typeof normalizedContext === "string") {
+        return dedupeTextList(
+            normalizedContext
+                .split(/\n{2,}/)
+                .map(text => truncateEvidence(text, 320))
+        ).slice(0, limit);
+    }
+
+    if (!Array.isArray(normalizedContext)) return [];
+
+    return dedupeTextList(
+        normalizedContext.map(item => {
+            if (typeof item === "string") return truncateEvidence(item, 320);
+            return truncateEvidence(
+                item?.excerpt ??
+                item?.text ??
+                item?.content ??
+                item?.pageContent ??
+                item?.page_content ??
+                item?.summary ??
+                item?.answer ??
+                item?.metadata?.text ??
+                item?.metadata?.content ??
+                "",
+                320
+            );
+        })
+    ).slice(0, limit);
+}
+
+function extractFaqFacts(faqContext) {
+    if (!faqContext || typeof faqContext !== "object") return [];
+    return dedupeTextList([truncateEvidence(faqContext.answer, 260)]);
+}
+
+function extractDecisionFacts(decisionContext, limit = 4) {
+    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
+    if (!normalizedDecisionContext || typeof normalizedDecisionContext !== "object") return [];
+
+    const factors = normalizedDecisionContext.factors || normalizedDecisionContext.market_data || normalizedDecisionContext;
+    const evidence = [
+        normalizedDecisionContext.recommendation,
+        normalizedDecisionContext.career_path,
+        normalizedDecisionContext.outcome,
+        normalizedDecisionContext.verdict,
+        normalizedDecisionContext.reason,
+        factors?.reason,
+        factors?.recommended_major ? `Recommended major: ${factors.recommended_major}` : "",
+        Array.isArray(factors?.top_skills) && factors.top_skills.length > 0
+            ? `Top skills: ${factors.top_skills.join(", ")}`
+            : "",
+        Array.isArray(factors?.career_roadmap?.target_roles) && factors.career_roadmap.target_roles.length > 0
+            ? `Target roles: ${factors.career_roadmap.target_roles.join(", ")}`
+            : "",
+        Array.isArray(factors?.career_roadmap?.top_skills) && factors.career_roadmap.top_skills.length > 0
+            ? `Career roadmap skills: ${factors.career_roadmap.top_skills.join(", ")}`
+            : "",
+        factors?.career_roadmap?.industry_demand ? `Industry demand: ${factors.career_roadmap.industry_demand}` : "",
+        Array.isArray(factors?.next_steps) && factors.next_steps.length > 0
+            ? `Next steps: ${factors.next_steps.join(", ")}`
+            : "",
+        factors?.salary_outlook ? `Salary outlook: ${factors.salary_outlook}` : "",
+        factors?.skills_overlap ? `Skills overlap: ${factors.skills_overlap}` : "",
+    ];
+
+    return dedupeTextList(evidence.map(text => truncateEvidence(text, 320))).slice(0, limit);
+}
+
+function buildExplainabilityGraph(neo4jContext) {
+    if (!Array.isArray(neo4jContext) || neo4jContext.length === 0) {
+        return { nodes: [], links: [] };
+    }
+
+    try {
+        const graph = convertToGraphData(neo4jContext);
+        return {
+            nodes: Array.isArray(graph?.nodes) ? graph.nodes : [],
+            links: Array.isArray(graph?.links) ? graph.links : []
+        };
+    } catch {
+        return { nodes: [], links: [] };
+    }
+}
+
+function normalizeContractConfidence(confidence, responseRoute, { failure = false, weak = false } = {}) {
+    const numericConfidence = normalizeProbability(confidence, weak ? 0.35 : 0.55);
+
+    if (failure) return 0.2;
+    if (responseRoute === "HYBRID_KG_RAG") return parseFloat(Math.max(0.70, Math.min(0.89, numericConfidence)).toFixed(3));
+    if (["DECISION", "RECOMMENDATION", "CAREER", "COMPARISON"].includes(responseRoute)) {
+        return parseFloat(Math.max(0.70, Math.min(0.89, numericConfidence)).toFixed(3));
+    }
+    if (responseRoute === "GENERAL" || responseRoute === "LLM_FALLBACK") {
+        if (numericConfidence < 0.50) {
+            return parseFloat(Math.max(0.20, Math.min(0.49, numericConfidence)).toFixed(3));
+        }
+        return parseFloat(Math.max(0.50, Math.min(0.69, numericConfidence)).toFixed(3));
+    }
+
+    return parseFloat(Math.max(0.50, Math.min(0.69, numericConfidence)).toFixed(3));
+}
+
+function buildExplainabilitySources(responseRoute, sources_used, { faqContext, decisionContext } = {}) {
+    const sources = [];
+    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
+
+    if (responseRoute === "HYBRID_KG_RAG") {
+        if (sources_used?.kg) sources.push("KG_DIRECT");
+        if (sources_used?.rag) sources.push("RAG_DIRECT");
+        if (normalizedDecisionContext) sources.push("DECISION");
+    }
+
+    if (["GENERAL", "LLM_FALLBACK"].includes(responseRoute)) {
+        if (sources_used?.kg) sources.push("KG_DIRECT");
+        if (sources_used?.rag) sources.push("RAG_DIRECT");
+    }
+
+    if (["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)) {
+        if (normalizedDecisionContext) sources.push("DECISION");
+    }
+
+    if (responseRoute === "CAREER") {
+        if (normalizedDecisionContext) sources.push("CAREER");
+    }
+
+    if (faqContext?.answer || sources_used?.faq) {
+        sources.push("FAQ");
+    }
+
+    if (["DECISION", "RECOMMENDATION", "COMPARISON", "CAREER", "HYBRID_KG_RAG"].includes(responseRoute)) {
+        if (sources_used?.kg) sources.push("KG_DIRECT");
+        if (sources_used?.rag) sources.push("RAG_DIRECT");
+    }
+
+    return [...new Set(sources)];
+}
+
+function buildMissingInformation({
+    responseRoute,
+    normalizedConfidence,
+    usedFacts,
+    sources_used,
+    decisionContext,
+    failure = false,
+    limitedEvidenceMessage = "Response generated with limited institutional evidence."
+}) {
+    if (failure) return ["Insufficient evidence available."];
+
+    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
+    const factors = normalizedDecisionContext?.factors || normalizedDecisionContext?.market_data || normalizedDecisionContext || {};
+    const missing = [];
+
+    if (responseRoute === "HYBRID_KG_RAG") {
+        if (usedFacts.length === 0 || !sources_used?.kg || !sources_used?.rag) {
+            missing.push("Partial institutional evidence available.");
+        }
+    }
+
+    if (responseRoute === "GENERAL" || responseRoute === "LLM_FALLBACK") {
+        if (normalizedConfidence < 0.7) {
+            missing.push(limitedEvidenceMessage);
+        }
+    }
+
+    if (["DECISION", "RECOMMENDATION", "COMPARISON", "CAREER"].includes(responseRoute)) {
+        const missingFields = [
+            ...(Array.isArray(normalizedDecisionContext?.missing_fields) ? normalizedDecisionContext.missing_fields : []),
+            ...(Array.isArray(factors?.missing_fields) ? factors.missing_fields : [])
+        ];
+
+        missingFields.forEach(field => {
+            const normalizedField = String(field).toLowerCase();
+            if (normalizedField.includes("gpa") || normalizedField.includes("percentage")) {
+                missing.push("Missing GPA information.");
+            } else if (normalizedField.includes("goal") || normalizedField.includes("interest")) {
+                missing.push("Missing goals information.");
+            } else if (normalizedField.includes("special")) {
+                missing.push("Missing specialization information.");
+            } else {
+                missing.push(`Missing ${String(field).trim()} information.`);
+            }
+        });
+
+        if (responseRoute === "CAREER" && !Array.isArray(factors?.target_roles) && !Array.isArray(factors?.career_roadmap?.target_roles)) {
+            missing.push("Missing specialization information.");
+        }
+    }
+
+    if (usedFacts.length === 0 && missing.length === 0) {
+        missing.push("Insufficient evidence available.");
+    }
+
+    return dedupeTextList(missing);
+}
+
+function buildReasoning({
+    responseRoute,
+    sources_used,
+    normalizedConfidence,
+    missingInformation,
+    failure = false
+}) {
+    if (failure) {
+        return "System fallback triggered due to insufficient evidence.";
+    }
+
+    if (responseRoute === "HYBRID_KG_RAG") {
+        return `Deterministic hybrid fusion combined ${sources_used?.kg ? "knowledge graph facts" : "available structured records"} with ${sources_used?.rag ? "retrieved policy passages" : "available document evidence"} to produce a grounded academic answer${missingInformation.length > 0 ? " with partial coverage safeguards." : "."}`;
+    }
+
+    if (["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)) {
+        return "Recommendation logic was derived from verified decision-engine factors and any available supporting academic evidence.";
+    }
+
+    if (responseRoute === "CAREER") {
+        return "Career guidance was synthesized from the verified roadmap output and any available institutional support evidence.";
+    }
+
+    if (responseRoute === "GENERAL") {
+        return `General advisory synthesis used the best available verified context${normalizedConfidence < 0.7 ? " with explicit evidence limitations." : "."}`;
+    }
+
+    return `Fallback path used limited verified institutional context${normalizedConfidence < 0.5 ? " with weak evidence safeguards." : "."}`;
+}
+
+function buildExplainabilityMetadata({
+    requestedRoute,
+    resolvedRoute,
+    responseRoute,
+    normalizedConfidence,
+    sources_used,
+    latency_ms,
+    sanitized,
+    truncated,
+    contextMetrics,
+    providedMetadata,
+    graph,
+    usedFacts,
+    failure = false,
+    decisionContext
+}) {
+    const normalizedDecisionContext = unwrapDecisionContext(decisionContext);
+    const factors = normalizedDecisionContext?.factors || normalizedDecisionContext?.market_data || normalizedDecisionContext || {};
+    const decisionConfidence = normalizeProbability(
+        normalizedDecisionContext?.confidence ??
+        factors?.confidence ??
+        factors?.confidence_breakdown?.overall,
+        normalizedConfidence
+    );
+
+    const baseMetadata = {
+        route_requested: requestedRoute,
+        inference_route: resolvedRoute,
+        route_safety: failure ? "SAFE_FAILURE" : normalizedConfidence >= 0.7 ? "SAFE_VERIFIED" : "SAFE_LIMITED",
+        latency_ms,
+        sanitized,
+        truncated,
+        source_count: Array.isArray(usedFacts) ? usedFacts.length : 0,
+        graph_node_count: Array.isArray(graph?.nodes) ? graph.nodes.length : 0,
+        graph_link_count: Array.isArray(graph?.links) ? graph.links.length : 0,
+        evidence_coverage: {
+            faq: !!sources_used?.faq,
+            kg: !!sources_used?.kg,
+            rag: !!sources_used?.rag,
+            decision: !!sources_used?.decision
+        },
+        ...(contextMetrics || {})
+    };
+
+    if (responseRoute === "HYBRID_KG_RAG") {
+        baseMetadata.fusion_strategy = "KG_RAG_EVIDENCE_BLEND";
+        baseMetadata.confidence_blend = parseFloat(((normalizedConfidence + normalizeProbability(decisionConfidence, normalizedConfidence)) / 2).toFixed(3));
+        baseMetadata.coverage_quality = usedFacts.length >= 4 ? "HIGH" : usedFacts.length >= 2 ? "MEDIUM" : "LOW";
+    }
+
+    if (["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)) {
+        baseMetadata.decision_factors = Object.keys(factors || {});
+        baseMetadata.decision_confidence = decisionConfidence;
+    }
+
+    if (responseRoute === "CAREER") {
+        baseMetadata.career_confidence = decisionConfidence;
+        baseMetadata.roadmap_confidence = normalizeProbability(
+            factors?.career_roadmap?.confidence ??
+            factors?.confidence_breakdown?.overall ??
+            decisionConfidence,
+            decisionConfidence
+        );
+    }
+
+    if (responseRoute === "GENERAL" || responseRoute === "LLM_FALLBACK") {
+        baseMetadata.fallback_path = responseRoute;
+        baseMetadata.evidence_limitations = normalizedConfidence < 0.7;
+    }
+
+    return {
+        ...baseMetadata,
+        ...(providedMetadata || {})
+    };
+}
+
+function createResult({
+    answer,
+    route,
+    confidence,
+    sources_used,
+    latency_ms,
+    sanitized,
+    truncated = false,
+    query = "",
+    requestedRoute = route,
+    neo4jContext = [],
+    ragContext = [],
+    faqContext = null,
+    decisionContext = null,
+    contextMetrics = {},
+    metadata = {},
+    reasoning = "",
+    failure = false,
+    missing_information = null,
+    used_facts = null,
+    graph = null,
+    sources = null,
+}) {
+    const responseRoute = normalizeExplainabilityRoute(route, query, decisionContext);
+    const normalizedConfidence = normalizeContractConfidence(confidence, responseRoute, {
+        failure,
+        weak: normalizeProbability(confidence, 0) < 0.5
+    });
+    const explainabilityGraph = graph || (responseRoute === "HYBRID_KG_RAG"
+        ? buildExplainabilityGraph(neo4jContext)
+        : { nodes: [], links: [] });
+    const kgFacts = extractKgFacts(neo4jContext, responseRoute === "HYBRID_KG_RAG" ? 2 : MAX_KG_FACTS);
+    const ragFacts = extractRagFacts(ragContext, responseRoute === "HYBRID_KG_RAG" ? 3 : MAX_RAG_PASSAGES);
+    const faqFacts = extractFaqFacts(faqContext);
+    const decisionFacts = extractDecisionFacts(decisionContext, 4);
+    const compiledFacts = used_facts || (
+        responseRoute === "HYBRID_KG_RAG"
+            ? [...kgFacts.slice(0, 2), ...ragFacts.slice(0, 3), ...decisionFacts.slice(0, 2)]
+            : ["DECISION", "RECOMMENDATION", "COMPARISON"].includes(responseRoute)
+                ? [...decisionFacts, ...ragFacts.slice(0, 2), ...kgFacts.slice(0, 1)]
+                : responseRoute === "CAREER"
+                    ? [...decisionFacts, ...ragFacts.slice(0, 2)]
+                    : responseRoute === "GENERAL"
+                        ? [...kgFacts.slice(0, 2), ...ragFacts.slice(0, 2), ...faqFacts.slice(0, 1)]
+                        : [...faqFacts.slice(0, 1), ...kgFacts.slice(0, 1), ...ragFacts.slice(0, 1)]
+    );
+    const finalUsedFacts = dedupeTextList(compiledFacts).slice(0, 6);
+    const finalMissingInformation = Array.isArray(missing_information)
+        ? missing_information
+        : buildMissingInformation({
+            responseRoute,
+            normalizedConfidence,
+            usedFacts: finalUsedFacts,
+            sources_used,
+            decisionContext,
+            failure,
+            limitedEvidenceMessage: "Response generated with limited institutional evidence."
+        });
+    const finalSources = Array.isArray(sources)
+        ? [...new Set(sources)]
+        : buildExplainabilitySources(responseRoute, sources_used, { faqContext, decisionContext });
+    const finalReasoning = reasoning || buildReasoning({
+        responseRoute,
+        sources_used,
+        normalizedConfidence,
+        missingInformation: finalMissingInformation,
+        failure
+    });
+    const finalMetadata = buildExplainabilityMetadata({
+        requestedRoute,
+        resolvedRoute: route,
+        responseRoute,
+        normalizedConfidence,
+        sources_used,
+        latency_ms,
+        sanitized,
+        truncated,
+        contextMetrics,
+        providedMetadata: metadata,
+        graph: explainabilityGraph,
+        usedFacts: finalUsedFacts,
+        failure,
+        decisionContext
+    });
+    finalMetadata.source_count = Array.isArray(finalSources) ? finalSources.length : 0;
+    finalMetadata.used_fact_count = Array.isArray(finalUsedFacts) ? finalUsedFacts.length : 0;
+
+    const result = {
+        answer,
+        confidence: normalizedConfidence,
+        used_facts: finalUsedFacts,
+        missing_information: finalMissingInformation,
+        graph: explainabilityGraph || EMPTY_GRAPH,
+        route: responseRoute,
+        sources: finalSources,
+        reasoning: finalReasoning,
+        metadata: finalMetadata,
+        sources_used,
+        latency_ms,
+        sanitized,
+        truncated
+    };
+
+    result.toString = () => answer;
+    return result;
+}
+
+/**
+ * Creates a UnifiedAnswerResult for fallback/error scenarios.
+ * Ensures consistent shape on all exit paths.
+ *
+ * @param {string} answerText
+ * @param {string} route
+ * @param {number} confidence
+ * @param {number} latency_ms
+ * @param {SourcesUsed} [sources_used]
+ * @returns {UnifiedAnswerResult}
+ */
+function createFallbackResult(answerText, route, confidence, latency_ms, sources_used = null, options = {}) {
+    return createResult({
+        answer: answerText,
+        route: options.route || "LLM_FALLBACK",
+        requestedRoute: route,
+        confidence: options.confidence ?? confidence,
+        sources_used: sources_used || { faq: false, kg: false, rag: false, decision: false },
+        latency_ms,
+        sanitized: false,
+        truncated: false,
+        query: options.query || "",
+        neo4jContext: options.neo4jContext || [],
+        ragContext: options.ragContext || [],
+        faqContext: options.faqContext || null,
+        decisionContext: options.decisionContext || null,
+        contextMetrics: options.contextMetrics || {},
+        metadata: options.metadata || { route_safety: "SAFE_FAILURE" },
+        reasoning: options.reasoning || "System fallback triggered due to insufficient evidence.",
+        missing_information: options.missing_information || ["Insufficient evidence available."],
+        graph: { nodes: [], links: [] },
+        sources: options.sources || [],
+        failure: options.failure ?? true,
+    });
+}
+
+
+// ─────────────────────────────────────────────────────────────
+// SECTION 8 — PRIMARY EXPORT
+// ─────────────────────────────────────────────────────────────
+
+/**
+ * generateUnifiedAnswer
+ * ─────────────────────
+ * Synthesises a final, grounded, student-friendly advisory answer
+ * from the outputs of the KG, RAG, FAQ, and Decision subsystems.
+ *
+ * v4 RETURN TYPE: UnifiedAnswerResult — structured object exposing
+ * answer text, route used, source attribution, latency, and sanitization
+ * flags. The object's toString() returns the answer string directly for
+ * soft backward compatibility with v3 orchestrators.
+ *
+ * @param {object} params
+ * @param {string}  params.query
+ * @param {string}  [params.routeType="LLM_FALLBACK"]
+ * @param {number}  [params.retrievalConfidence=1.0]
+ * @param {Array}   [params.neo4jContext=[]]
+ * @param {*}       [params.ragContext=[]]
+ * @param {object|null} [params.faqContext=null]
+ * @param {object|null} [params.decisionContext=null]
+ * @param {Array}   [params.history=[]]
+ * @param {object|null} [params.conversationMemory=null]
+ * @returns {Promise<UnifiedAnswerResult>}
+ */
+export async function generateUnifiedAnswer({
+    query,
+    routeType = ROUTE_TYPES.LLM_FALLBACK,
+    retrievalConfidence = 1.0,
+    neo4jContext = [],
+    ragContext = [],
+    faqContext = null,
+    decisionContext = null,
+    history = [],
+    conversationMemory = null,
+} = {}) {
+    const requestedRoute = routeType;
+
+    // ── Guard: query is mandatory ─────────────────────────────────────
+    if (!query || typeof query !== "string" || query.trim() === "") {
+        logError("invalid_query", { reason: "empty_or_non_string_query" });
+        return createFallbackResult(FALLBACK_ANSWER, requestedRoute, retrievalConfidence, 0, null, {
+            route: "LLM_FALLBACK",
+            metadata: { route_safety: "SAFE_FAILURE" },
+            reasoning: "System fallback triggered due to insufficient evidence.",
+            missing_information: ["Insufficient evidence available."],
+            failure: true
+        });
+    }
+
+    const resolvedRoute = resolveRouteType(routeType);
+    const truncatedQuery = query.trim().slice(0, 120);
+    const pipelineStart = Date.now();
+
+    // PHASE 8: DETERMINISTIC EMPTY-CONTEXT GUARD
+    // Pre-calculate block metadata to check for total evidence absence
+    const faqMeta = buildFaqBlock(faqContext);
+    const decisionMeta = buildDecisionBlock(decisionContext);
+    const kgMeta = buildNeo4jBlock(neo4jContext);
+    const ragMeta = buildRagBlock(ragContext);
+
+    if (!faqMeta.used && !decisionMeta.used && !kgMeta.used && !ragMeta.used) {
+        logWarn("total_evidence_absence_early_exit", { route: routeType, query: truncatedQuery });
+        return createFallbackResult(
+            "Insufficient verified academic evidence was found for this query.",
+            requestedRoute,
+            0.2,
+            Date.now() - pipelineStart,
+            null,
+            {
+                route: "LLM_FALLBACK",
+                reasoning: "All retrieval systems returned insufficient evidence. Bypassing LLM synthesis for safety.",
+                missing_information: ["Insufficient evidence available."],
+                metadata: { route_safety: "SAFE_FAILURE" }
+            }
+        );
+    }
+
+    // ── Tiered Confidence Gating (Phase 3 Stabilization) ────────────────
+    const isDegraded = retrievalConfidence >= DEGRADED_CONFIDENCE_THRESHOLD && retrievalConfidence < CONFIDENCE_GATE_THRESHOLD;
+
+    if (retrievalConfidence < DEGRADED_CONFIDENCE_THRESHOLD) {
+        logWarn("confidence_gate_triggered", {
+            route: resolvedRoute,
+            retrieval_confidence: retrievalConfidence,
+            threshold: DEGRADED_CONFIDENCE_THRESHOLD,
+            query_preview: truncatedQuery,
+            fallback_reason: "below_minimum_confidence",
+        });
+        return createFallbackResult(INSUFFICIENT_DATA_PHRASE, requestedRoute, retrievalConfidence, 0, null, {
+            query,
+            route: "LLM_FALLBACK",
+            neo4jContext,
+            ragContext,
+            faqContext,
+            decisionContext,
+            metadata: { route_safety: "SAFE_FAILURE" },
+            reasoning: "System fallback triggered due to insufficient evidence.",
+            missing_information: ["Insufficient evidence available."],
+            failure: true
+        });
+    }
+
+    logInfo("pipeline_start", {
+        route: resolvedRoute,
+        retrieval_confidence: retrievalConfidence,
+        is_degraded: isDegraded,
+        query_preview: truncatedQuery,
+        model: MODEL,
+        backup_model: getOllamaRuntimeStatus().backup_model
+    });
+
+    try {
+        // ── Step 1: Assemble context with auto-trimming budget checks ─────
+        let currentTrimConfig = null;
+        let contextPayload, contextMetrics, sources_used;
+        let prompt, promptTokenEst;
+
+        // FINAL MICRO-PATCH 2: Iterative build-measure-trim-rebuild loop
+        for (let pass = 1; pass <= 3; pass++) {
+            ({ payload: contextPayload, metrics: contextMetrics, sources_used } =
+                buildContextPayload({ neo4jContext, ragContext, faqContext, decisionContext }, currentTrimConfig));
+
+            prompt = buildPrompt(query.trim(), contextPayload, resolvedRoute, history, conversationMemory);
+            promptTokenEst = estimateTokens(prompt);
+
+            if (promptTokenEst < PROMPT_TOKEN_WARN_THRESHOLD) break;
+            if (pass === 3) break; // Exceeded max passes
+
+            logWarn("budget_exceeded_recalculating_trim", { pass, tokens: promptTokenEst });
+            currentTrimConfig = trimContextToBudget(promptTokenEst);
+        }
+
+        const safePromptLimit = Math.max(
+            512,
+            LLM_CONFIG.gemma.maxContextTokens - LLM_CONFIG.gemma.contextHeadroomTokens
+        );
+
+        if (promptTokenEst > safePromptLimit) {
+            const emptyPromptTokens = estimateTokens(buildPrompt(query.trim(), "", resolvedRoute, history, conversationMemory));
+            const contextBudget = Math.max(128, safePromptLimit - emptyPromptTokens);
+            const truncation = hardTruncateToTokenBudget(contextPayload, contextBudget);
+
+            if (truncation.truncated) {
+                contextPayload = truncation.text;
+                prompt = buildPrompt(query.trim(), contextPayload, resolvedRoute, history, conversationMemory);
+                promptTokenEst = estimateTokens(prompt);
+                contextMetrics = {
+                    ...contextMetrics,
+                    payload_chars: contextPayload.length,
+                    payload_tokens_est: estimateTokens(contextPayload),
+                    hard_truncated: true,
+                    safe_prompt_limit: safePromptLimit,
+                };
+                logWarn("context_hard_truncated", {
+                    route: resolvedRoute,
+                    final_prompt_tokens: promptTokenEst,
+                    safe_prompt_limit: safePromptLimit,
+                    context_budget_tokens: contextBudget,
+                });
+            }
+        }
+
+        logInfo("context_finalized", {
+            route: resolvedRoute,
+            ...contextMetrics,
+            final_prompt_tokens: promptTokenEst
+        });
+
+        // ── Step 2: Build inference prompt ───────────────────────────────
+        // (Handled by iterative loop above)
+
+        // ── Step 3: Resolve route-adaptive inference options ────────────
+        // FINAL MICRO-PATCH 1: FIX IMMUTABILITY VIOLATION
+        const inferenceOptions = { ...buildInferenceOptions(resolvedRoute) };
+        inferenceOptions.num_predict = routeNumPredict(resolvedRoute, promptTokenEst);
+
+        const telemetryBeforeInference = getGemmaTelemetrySnapshot();
+        if (
+            telemetryBeforeInference.gemma_memory_pressure?.critical === true &&
+            promptTokenEst >= LLM_CONFIG.gemma.deferSynthesisTokens
+        ) {
+            const deterministicAnswer = buildDeterministicFallbackAnswer({
+                faqContext,
+                decisionContext,
+                neo4jContext,
+                ragContext
+            });
+
+            if (deterministicAnswer) {
+                const totalLatencyMs = Date.now() - pipelineStart;
+                logWarn("memory_pressure_deferred_heavy_synthesis", {
+                    route: resolvedRoute,
+                    prompt_tokens: promptTokenEst,
+                    memory_pressure: telemetryBeforeInference.gemma_memory_pressure,
+                });
+
+                return createResult({
+                    answer: deterministicAnswer,
+                    route: resolvedRoute,
+                    confidence: retrievalConfidence,
+                    sources_used,
+                    latency_ms: totalLatencyMs,
+                    sanitized: false,
+                    truncated: false,
+                    query,
+                    requestedRoute,
+                    neo4jContext,
+                    ragContext,
+                    faqContext,
+                    decisionContext,
+                    contextMetrics,
+                    metadata: {
+                        memory_deferred: true,
+                        route_safety: "MEMORY_PRESSURE_DEFERRED",
+                        prompt_tokens: promptTokenEst,
+                        gemma_memory_pressure: telemetryBeforeInference.gemma_memory_pressure,
+                    }
+                });
+            }
+        }
+
+        // Implement Degraded Mode: Lower temperature for caution
+        if (isDegraded) {
+            logInfo("degraded_mode_active", { original_temp: inferenceOptions.temperature });
+            inferenceOptions.temperature = Math.min(inferenceOptions.temperature, 0.10);
+        }
+
+        logInfo("inference_options_resolved", {
+            route: resolvedRoute,
+            temperature: inferenceOptions.temperature,
+            top_p: inferenceOptions.top_p,
+            repeat_penalty: inferenceOptions.repeat_penalty,
+            num_predict: inferenceOptions.num_predict,
+        });
+
+        const deterministicContextAnswer = buildDeterministicFallbackAnswer({
+            faqContext,
+            decisionContext,
+            neo4jContext,
+            ragContext
+        });
+
+        // ── Step 4: Gemini final synthesis with Ollama fallback ─────────
+        const {
+            rawAnswer,
+            synthesisProvider,
+            synthesisLatencyMs,
+            ollamaLatencyMs,
+            ollamaRuntime,
+            ollamaGenerationMeta,
+            geminiResult,
+            geminiFallbackReason,
+            deterministicFallbackUsed,
+        } = await runFinalSynthesis({
+            prompt,
+            resolvedRoute,
+            inferenceOptions,
+            requestId: `unified_${Date.now()}`,
+            promptTokenEst,
+            deterministicFallbackAnswer: deterministicContextAnswer,
+        });
+
+        // ── Step 5: Sanitize + truncation repair ─────────────────────────
+        const { text: finalAnswer, sanitized, truncated, rejection_reason } =
+            sanitizeResponse(rawAnswer);
+
+        if (sanitized || truncated) {
+            logWarn("response_post_processed", {
+                route: resolvedRoute,
+                sanitized,
+                truncated,
+                rejection_reason: rejection_reason ?? "meta_phrase_stripped",
+                raw_chars: rawAnswer.length,
+                clean_chars: finalAnswer.length,
+            });
+        }
+
+        const totalLatencyMs = Date.now() - pipelineStart;
+
+        logInfo("pipeline_complete", {
+            route: resolvedRoute,
+            total_latency_ms: totalLatencyMs,
+            synthesis_provider: synthesisProvider,
+            synthesis_latency_ms: synthesisLatencyMs,
+            ollama_latency_ms: ollamaLatencyMs,
+            answer_chars: finalAnswer.length,
+            answer_tokens_est: estimateTokens(finalAnswer),
+            sanitized,
+            truncated,
+            sources_used,
+        });
+
+        // ── Step 6: Return structured result ────────────────────
+        return createResult({
+            answer: finalAnswer,
+            route: resolvedRoute,
+            confidence: retrievalConfidence,
+            sources_used,
+            latency_ms: totalLatencyMs,
+            sanitized,
+            truncated,
+            query,
+            requestedRoute,
+            neo4jContext,
+            ragContext,
+            faqContext,
+            decisionContext,
+            contextMetrics,
+            metadata: {
+                model: geminiResult?.model || ollamaGenerationMeta?.model || MODEL,
+                synthesis_provider: synthesisProvider,
+                synthesis_latency_ms: synthesisLatencyMs,
+                gemini_model: geminiResult?.model || null,
+                gemini_latency_ms: geminiResult?.latencyMs || null,
+                gemini_finish_reason: geminiResult?.finishReason || null,
+                gemini_fallback_to_ollama: synthesisProvider === "ollama_fallback",
+                gemini_fallback_reason: geminiFallbackReason,
+                deterministic_context_fallback: deterministicFallbackUsed,
+                primary_model: ollamaRuntime.primary_model,
+                backup_model: ollamaRuntime.backup_model,
+                is_degraded: isDegraded,
+                llm_failover_active: ollamaRuntime.failover_active,
+                breaker_state: ollamaRuntime.breaker_state,
+                primary_failures: ollamaRuntime.primary_failures,
+                backup_activations: ollamaRuntime.backup_activations,
+                failover_count: ollamaRuntime.failover_count,
+                recovery_success: ollamaRuntime.recovery_success,
+                failover_used: !!ollamaGenerationMeta?.failover_used,
+                prompt_tokens: promptTokenEst,
+                prompt_truncated: !!ollamaGenerationMeta?.prompt_truncated || !!contextMetrics?.hard_truncated,
+                num_predict: inferenceOptions.num_predict,
+                output_tokens: geminiResult?.outputTokens || ollamaGenerationMeta?.outputTokens || estimateTokens(finalAnswer),
+                gemma_memory_pressure: ollamaRuntime.gemma_memory_pressure,
+                gemma_queue_depth: ollamaRuntime.gemma_queue_depth,
+                overload_retries: ollamaRuntime.overload_retries,
+                ollama_latency_ms: ollamaLatencyMs
+            }
+        });
+
+    } catch (error) {
+        const totalLatencyMs = Date.now() - pipelineStart;
+        const ollamaRuntimeOnFailure = getOllamaRuntimeStatus();
+
+        logError("pipeline_failed", {
+            route: resolvedRoute,
+            query_preview: truncatedQuery,
+            error_message: error?.message ?? String(error),
+            total_latency_ms: totalLatencyMs,
+            breaker_state: ollamaRuntimeOnFailure.breaker_state,
+            failover_active: ollamaRuntimeOnFailure.failover_active,
+        });
+
+        // ── Phase 3: Deterministic Fallback ──────────────────────────────
+        const deterministicAnswer = buildDeterministicFallbackAnswer({
+            faqContext,
+            decisionContext,
+            neo4jContext,
+            ragContext
+        });
+
+        // FINAL MICRO-PATCH 4: Robust source attribution for deterministic fallback
+        const fallbackSources = {
+            faq: !!buildFaqBlock(faqContext).used,
+            decision: !!buildDecisionBlock(decisionContext).used,
+            kg: !!buildNeo4jBlock(neo4jContext).used,
+            rag: !!buildRagBlock(ragContext).used,
+        };
+
+        // PHASE 8.5 — DETERMINISTIC HYBRID FUSION FALLBACK
+        if (resolvedRoute === ROUTE_TYPES.HYBRID && fallbackSources.kg && fallbackSources.rag) {
+            const hybridAnswer = buildDeterministicHybridAnswer(neo4jContext, ragContext);
+            if (hybridAnswer) {
+                logInfo("deterministic_hybrid_fallback_successful", { route: resolvedRoute });
+                return createResult({
+                    answer: hybridAnswer,
+                    route: "HYBRID_KG_RAG",
+                    confidence: 0.89,
+                    sources_used: fallbackSources,
+                    latency_ms: totalLatencyMs,
+                    sanitized: false,
+                    truncated: false,
+                    query,
+                    requestedRoute,
+                    neo4jContext,
+                    ragContext,
+                    faqContext,
+                    decisionContext,
+                    metadata: {
+                        route_safety: "SAFE_HYBRID_FALLBACK",
+                        fallback_type: "DETERMINISTIC_HYBRID",
+                        primary_model: ollamaRuntimeOnFailure.primary_model,
+                        backup_model: ollamaRuntimeOnFailure.backup_model,
+                        breaker_state: ollamaRuntimeOnFailure.breaker_state,
+                        llm_failover_active: ollamaRuntimeOnFailure.failover_active,
+                        kg_fact_count: (kgMeta || buildNeo4jBlock(neo4jContext)).count,
+                        rag_fact_count: (ragMeta || buildRagBlock(ragContext)).count
+                    }
+                });
+            }
+        }
+
+        if (deterministicAnswer) {
+            logInfo("deterministic_fallback_successful", { route: resolvedRoute });
+            return createResult({
+                answer: deterministicAnswer,
+                route: resolvedRoute,
+                confidence: retrievalConfidence,
+                sources_used: fallbackSources,
+                latency_ms: totalLatencyMs,
+                sanitized: false,
+                truncated: false,
+                query,
+                requestedRoute,
+                neo4jContext,
+                ragContext,
+                faqContext,
+                decisionContext,
+                metadata: {
+                    deterministic_fallback: true,
+                    route_safety: "SAFE_FALLBACK",
+                    primary_model: ollamaRuntimeOnFailure.primary_model,
+                    backup_model: ollamaRuntimeOnFailure.backup_model,
+                    breaker_state: ollamaRuntimeOnFailure.breaker_state,
+                    llm_failover_active: ollamaRuntimeOnFailure.failover_active,
+                    primary_failures: ollamaRuntimeOnFailure.primary_failures,
+                    backup_activations: ollamaRuntimeOnFailure.backup_activations,
+                    failover_count: ollamaRuntimeOnFailure.failover_count,
+                    recovery_success: ollamaRuntimeOnFailure.recovery_success
+                }
+            });
+        }
+
+        return createFallbackResult(FALLBACK_ANSWER, requestedRoute, retrievalConfidence, totalLatencyMs, fallbackSources, {
+            query,
+            route: "LLM_FALLBACK",
+            neo4jContext,
+            ragContext,
+            faqContext,
+            decisionContext,
+            metadata: {
+                route_safety: "SAFE_FAILURE",
+                primary_model: ollamaRuntimeOnFailure.primary_model,
+                backup_model: ollamaRuntimeOnFailure.backup_model,
+                breaker_state: ollamaRuntimeOnFailure.breaker_state,
+                llm_failover_active: ollamaRuntimeOnFailure.failover_active,
+                primary_failures: ollamaRuntimeOnFailure.primary_failures,
+                backup_activations: ollamaRuntimeOnFailure.backup_activations,
+                failover_count: ollamaRuntimeOnFailure.failover_count,
+                recovery_success: ollamaRuntimeOnFailure.recovery_success
+            },
+            reasoning: "System fallback triggered due to insufficient evidence.",
+            missing_information: ["Insufficient evidence available."],
+            failure: true
+        });
+    }
+}
+
+
+// ─────────────────────────────────────────────────────────────
+// NAMED INTERNAL EXPORTS
+// ─────────────────────────────────────────────────────────────
+
+export {
+    // ── Configuration ─────────────────────────────────────────────────
+    MODEL,
+    CONFIDENCE_GATE_THRESHOLD,
+    DEGRADED_CONFIDENCE_THRESHOLD,       // NEW Phase 3
+    MAX_KG_FACTS,
+    MAX_RAG_PASSAGES,
+    MAX_HISTORY_MESSAGES,
+    MAX_HISTORY_MESSAGE_CHARS,
+    MAX_HISTORY_TOTAL_CHARS,
+    MAX_MEMORY_BLOCK_CHARS,
+    DECISION_MAX_DEPTH,
+    DECISION_MAX_VALUE_CHARS,
+    PROMPT_TOKEN_WARN_THRESHOLD,
+    PROMPT_TOKEN_CRITICAL_THRESHOLD,
+    FALLBACK_ANSWER,
+    INSUFFICIENT_DATA_PHRASE,
+
+    // ── Route system ──────────────────────────────────────────────────
+    ROUTE_TYPES,
+    ROUTE_INSTRUCTIONS,
+    ROUTE_INFERENCE_OPTIONS,
+    resolveRouteType,
+    buildInferenceOptions,
+
+    // ── Context builders ──────────────────────────────────────────────
+    buildNeo4jBlock,
+    buildRagBlock,
+    buildFaqBlock,
+    buildDecisionBlock,
+    buildContextPayload,
+    normalizeGraphEvidence,
+    depthLimitedSerialize,
+    trimContextToBudget,                  // NEW Phase 3
+    buildDeterministicFallbackAnswer,     // NEW Phase 3
+
+    // ── Prompt assembly ───────────────────────────────────────────────
+    BASE_SYSTEM_PROMPT,
+    buildConversationHistoryBlock,
+    buildConversationMemoryBlock,
+    buildPrompt,
+
+    // ── Response pipeline ─────────────────────────────────────────────
+    sanitizeResponse,
+    repairTruncation,
+
+    // ── Result factories ──────────────────────────────────────────────
+    createResult,
+    createFallbackResult,
+
+    // ── Observability utilities ───────────────────────────────────────
+    logInfo,
+    logWarn,
+    logError,
+    estimateTokens,
+};
```

## backend/services/ollamaService.js

A path: `C:\AI_AGENT\aast-ai-agent-main\backend\services\ollamaService.js`
B path: `C:\Users\mh978\Downloads\AI_AGENT n\aast-ai-agent-main\backend\services\ollamaService.js`
Risk level: MEDIUM

Added functionality: B adds provider before/response/result logs and Gemma4 request options, plus changed metrics tracking semantics.

Removed functionality: B removes gemma_latency_ms recording and narrows failure timeout counting.

Exact diff:
```diff
diff --git "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\services\\ollamaService.js" "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\services\\ollamaService.js"
index 4a619732..c3949118 100644
--- "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\services\\ollamaService.js"
+++ "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\services\\ollamaService.js"	
@@ -1,371 +1,387 @@
-/**
- * Centralized Ollama inference layer with Gemma-first failover.
- *
- * Public API compatibility is intentionally preserved:
- * - generateStableResponse(...)
- * - callOllama(prompt, model, requestId)
- * - checkOllamaHealth()
- * - warmupOllama(model)
- */
-
-import fetch from "node-fetch";
-import { LLM_CONFIG } from "../config/llmConfig.js";
+/**
+ * Centralized Ollama inference layer with Gemma-first failover.
+ *
+ * Public API compatibility is intentionally preserved:
+ * - generateStableResponse(...)
+ * - callOllama(prompt, model, requestId)
+ * - checkOllamaHealth()
+ * - warmupOllama(model)
+ */
+
+import fetch from "node-fetch";
+import { LLM_CONFIG } from "../src/config/llmConfig.js";
 import { modelFailoverManager } from "./modelFailoverManager.js";
 import { gemmaRequestLimiter } from "./gemmaRequestLimiter.js";
-import { gemmaTelemetryService } from "./gemmaTelemetryService.js";
-import { incrementMetric, recordDuration } from "./metrics.js";
-
-const lastGenerationMetadata = new Map();
-const MAX_GENERATION_METADATA = 100;
-
-function log(level, event, payload = {}) {
-  const writer =
-    level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;
-
-  writer(JSON.stringify({
-    level,
-    service: "OllamaService",
-    event,
-    timestamp: new Date().toISOString(),
-    ...payload,
-  }));
-}
-
-function sleep(ms) {
-  return new Promise((resolve) => setTimeout(resolve, ms));
-}
-
-function isRetryableStatus(status) {
-  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
-}
-
-function estimateTokens(text) {
-  return Math.ceil(String(text || "").length / 4);
-}
-
+import { gemmaTelemetryService } from "../src/infrastructure/telemetry/gemmaTelemetryService.js";
+import { incrementMetric } from "../src/infrastructure/telemetry/metrics.js";
+
+const lastGenerationMetadata = new Map();
+const MAX_GENERATION_METADATA = 100;
+
+function log(level, event, payload = {}) {
+  const writer =
+    level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;
+
+  writer(JSON.stringify({
+    level,
+    service: "OllamaService",
+    event,
+    timestamp: new Date().toISOString(),
+    ...payload,
+  }));
+}
+
+function sleep(ms) {
+  return new Promise((resolve) => setTimeout(resolve, ms));
+}
+
+function isRetryableStatus(status) {
+  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
+}
+
+function estimateTokens(text) {
+  return Math.ceil(String(text || "").length / 4);
+}
+
 function clampNumber(value, min, max) {
   const parsed = Number(value);
   if (!Number.isFinite(parsed)) return min;
   return Math.min(Math.max(parsed, min), max);
 }
 
-function isGemmaModel(model) {
-  return /\bgemma/i.test(String(model || ""));
-}
-
-export function classifyOllamaError(error) {
-  if (!error) {
-    return {
-      type: "unknown",
-      retryable: false,
-      overload: false,
-      circuitEligible: true,
-    };
-  }
-
-  const message = String(error.message || "").toLowerCase();
-  const bodyPreview = String(error.bodyPreview || "").toLowerCase();
-  const combined = `${message} ${bodyPreview}`;
-
-  if (
-    error.code === "GEMMA_QUEUE_OVERFLOW" ||
-    error.code === "GEMMA_QUEUE_TIMEOUT" ||
-    error.overload === true ||
-    combined.includes("server busy") ||
-    combined.includes("too many requests") ||
-    combined.includes("no available slots") ||
-    combined.includes("queue")
-  ) {
-    return {
-      type: "overload",
-      retryable: true,
-      overload: true,
-      circuitEligible: false,
-      recovery: "short",
-    };
-  }
-
-  if (error.name === "AbortError" || combined.includes("timed out") || combined.includes("timeout")) {
-    return {
-      type: "timeout",
-      retryable: true,
-      overload: false,
-      circuitEligible: true,
-      recovery: "medium",
-    };
-  }
-
-  if (
-    combined.includes("econnreset") ||
-    combined.includes("socket hang up") ||
-    combined.includes("fetch failed") ||
-    combined.includes("network")
-  ) {
-    return {
-      type: "connection_reset",
-      retryable: true,
-      overload: false,
-      circuitEligible: true,
-      recovery: "cold",
-    };
-  }
-
-  if (
-    combined.includes("model is loading") ||
-    combined.includes("loading model") ||
-    combined.includes("llama runner") ||
-    combined.includes("runner") ||
-    combined.includes("out of memory") ||
-    combined.includes("memory allocation") ||
-    combined.includes("cannot allocate") ||
-    combined.includes("cuda") ||
-    combined.includes("kv cache") ||
-    combined.includes("context length") ||
-    combined.includes("failed to load") ||
-    combined.includes("runner process")
-  ) {
-    return {
-      type: "cold_boot_or_runtime",
-      retryable: true,
-      overload: false,
-      circuitEligible: true,
-      recovery: "cold",
-    };
-  }
-
-  if (error.status === 500) {
-    return {
-      type: "http_500_runtime",
-      retryable: true,
-      overload: false,
-      circuitEligible: true,
-      recovery: "medium",
-    };
-  }
-
-  if (isRetryableStatus(error.status)) {
-    return {
-      type: `http_${error.status}`,
-      retryable: true,
-      overload: error.status === 429,
-      circuitEligible: error.status !== 429,
-      recovery: error.status === 429 ? "short" : "medium",
-    };
-  }
-
-  if (error.retryable === true) {
-    return {
-      type: "retryable",
-      retryable: true,
-      overload: false,
-      circuitEligible: true,
-      recovery: "medium",
-    };
-  }
-
-  return {
-    type: "non_retryable",
-    retryable: false,
-    overload: false,
-    circuitEligible: true,
-    recovery: "none",
-  };
-}
-
-export function isRetryableError(error) {
-  const classification = classifyOllamaError(error);
-  if (classification.retryable === true) return true;
-  if (!error) return false;
-  if (error.retryable === true) return true;
-  if (error.name === "AbortError") return true;
-  if (isRetryableStatus(error.status)) return true;
-
-  const message = String(error.message || "").toLowerCase();
-  return (
-    message.includes("http 500") ||
-    message.includes("http 502") ||
-    message.includes("http 503") ||
-    message.includes("http 504") ||
-    message.includes("econnreset") ||
-    message.includes("socket hang up") ||
-    message.includes("network") ||
-    message.includes("fetch failed") ||
-    message.includes("model is loading") ||
-    message.includes("timed out") ||
-    message.includes("timeout")
-  );
-}
-
-function retryDelayMs(retryNumber, classification = {}) {
-  if (classification.recovery === "short" || classification.overload) {
-    return LLM_CONFIG.retries.overloadDelayMs;
-  }
-
-  const baseDelay =
-    classification.recovery === "cold"
-      ? LLM_CONFIG.retries.recoveryDelayMs
-      : LLM_CONFIG.retries.baseDelayMs;
-  const maxDelay =
-    classification.recovery === "cold"
-      ? LLM_CONFIG.retries.recoveryMaxDelayMs
-      : LLM_CONFIG.retries.maxDelayMs;
-  const exponential = baseDelay * Math.pow(2, Math.max(0, retryNumber - 1));
-  return Math.min(exponential, maxDelay);
-}
-
-function resolveNumPredict(routeType, explicitNumPredict) {
-  if (Number.isFinite(Number(explicitNumPredict))) {
-    return clampNumber(
-      explicitNumPredict,
-      1,
-      LLM_CONFIG.gemma.numPredict.max
-    );
-  }
-
-  const normalizedRoute = String(routeType || "").toUpperCase();
-  if (normalizedRoute.includes("INTENT")) return LLM_CONFIG.gemma.numPredict.intent;
-  if (normalizedRoute.includes("FALLBACK")) return LLM_CONFIG.gemma.numPredict.fallback;
-  if (normalizedRoute.includes("HYBRID") || normalizedRoute.includes("RAG")) {
-    return LLM_CONFIG.gemma.numPredict.heavy;
-  }
-  if (normalizedRoute.includes("KG") || normalizedRoute.includes("FAQ")) {
-    return LLM_CONFIG.gemma.numPredict.light;
-  }
-  return LLM_CONFIG.gemma.numPredict.synthesis;
-}
-
-function buildStableOptions(options = {}, { routeType = "GENERAL", promptTokens = 0 } = {}) {
-  const pressure = gemmaTelemetryService.getMemoryPressure();
-  const normalized = { ...options };
-  const maxTemp = pressure.high ? 0.12 : 0.20;
-  const maxTopP = pressure.high ? 0.78 : 0.85;
-  let numPredict = resolveNumPredict(routeType, normalized.num_predict);
-
-  if (promptTokens >= LLM_CONFIG.gemma.deferSynthesisTokens || pressure.high) {
-    numPredict = Math.min(numPredict, LLM_CONFIG.gemma.numPredict.heavy);
-  }
-
-  if (pressure.critical) {
-    numPredict = Math.min(numPredict, LLM_CONFIG.gemma.numPredict.light);
-  }
-
-  const stableOptions = {
-    ...normalized,
-    temperature: clampNumber(
-      normalized.temperature ?? LLM_CONFIG.gemma.defaults.temperature,
-      0,
-      maxTemp
-    ),
-    top_p: clampNumber(
-      normalized.top_p ?? LLM_CONFIG.gemma.defaults.topP,
-      0.05,
-      maxTopP
-    ),
-    repeat_penalty: clampNumber(
-      normalized.repeat_penalty ?? LLM_CONFIG.gemma.defaults.repeatPenalty,
-      1,
-      2
-    ),
-    num_predict: Math.max(1, Math.floor(numPredict)),
-    num_ctx: Math.min(
-      Math.max(
-        Number(normalized.num_ctx) || LLM_CONFIG.gemma.numCtx,
-        LLM_CONFIG.gemma.minNumCtx
-      ),
-      LLM_CONFIG.gemma.numCtx
-    ),
-  };
-
-  if (LLM_CONFIG.gemma.numThread > 0 && stableOptions.num_thread == null) {
-    stableOptions.num_thread = LLM_CONFIG.gemma.numThread;
-  }
-
-  if (LLM_CONFIG.gemma.numBatch > 0 && stableOptions.num_batch == null) {
-    stableOptions.num_batch = LLM_CONFIG.gemma.numBatch;
-  }
-
-  return stableOptions;
-}
-
-function enforcePromptBudget(prompt, options = {}) {
-  const pressure = gemmaTelemetryService.getMemoryPressure();
-  const reserveTokens =
-    Number(options.num_predict || 0) + LLM_CONFIG.gemma.contextHeadroomTokens;
-  const contextCeiling = pressure.high
-    ? Math.min(
-        LLM_CONFIG.gemma.maxContextTokens,
-        LLM_CONFIG.gemma.highPressureContextTokens
-      )
-    : LLM_CONFIG.gemma.maxContextTokens;
-  const maxPromptTokens = Math.max(256, contextCeiling - reserveTokens);
-  const promptTokens = estimateTokens(prompt);
-
-  if (promptTokens <= maxPromptTokens) {
-    return {
-      prompt,
-      promptTokens,
-      maxPromptTokens,
-      truncated: false,
-      pressure,
-    };
-  }
-
-  const targetChars = maxPromptTokens * 4;
-  const marker = "\n\n[Gemma prompt hard-truncated to protect local context budget]\n\n";
-  const headChars = Math.max(1200, Math.floor(targetChars * 0.62));
-  const tailChars = Math.max(800, targetChars - headChars - marker.length);
-  const truncatedPrompt =
-    prompt.slice(0, headChars).trimEnd() +
-    marker +
-    prompt.slice(Math.max(0, prompt.length - tailChars)).trimStart();
-
-  return {
-    prompt: truncatedPrompt,
-    promptTokens: estimateTokens(truncatedPrompt),
-    originalPromptTokens: promptTokens,
-    maxPromptTokens,
-    truncated: true,
-    pressure,
-  };
-}
-
-function createOllamaHttpError(response, bodyPreview = "") {
-  const error = new Error(
-    `Ollama returned HTTP ${response.status}: ${response.statusText}`
-  );
-  error.status = response.status;
-  error.retryable = isRetryableStatus(response.status);
-  error.bodyPreview = bodyPreview;
-  return error;
+function isPrimaryGemmaGeneration({ model, role }) {
+  return role === "primary" || model === LLM_CONFIG.primaryModel;
 }
-
-function rememberGenerationMetadata(requestId, metadata) {
-  if (!requestId) return;
-
-  lastGenerationMetadata.set(requestId, {
-    ...metadata,
-    recorded_at: new Date().toISOString(),
-  });
-
-  while (lastGenerationMetadata.size > MAX_GENERATION_METADATA) {
-    const oldestKey = lastGenerationMetadata.keys().next().value;
-    lastGenerationMetadata.delete(oldestKey);
-  }
-}
-
+
+export function classifyOllamaError(error) {
+  if (!error) {
+    return {
+      type: "unknown",
+      retryable: false,
+      overload: false,
+      circuitEligible: true,
+    };
+  }
+
+  const message = String(error.message || "").toLowerCase();
+  const bodyPreview = String(error.bodyPreview || "").toLowerCase();
+  const combined = `${message} ${bodyPreview}`;
+
+  if (
+    error.code === "GEMMA_QUEUE_OVERFLOW" ||
+    error.code === "GEMMA_QUEUE_TIMEOUT" ||
+    error.overload === true ||
+    combined.includes("server busy") ||
+    combined.includes("too many requests") ||
+    combined.includes("no available slots") ||
+    combined.includes("queue")
+  ) {
+    return {
+      type: "overload",
+      retryable: true,
+      overload: true,
+      circuitEligible: false,
+      recovery: "short",
+    };
+  }
+
+  if (error.name === "AbortError" || combined.includes("timed out") || combined.includes("timeout")) {
+    return {
+      type: "timeout",
+      retryable: true,
+      overload: false,
+      circuitEligible: true,
+      recovery: "medium",
+    };
+  }
+
+  if (
+    combined.includes("econnreset") ||
+    combined.includes("socket hang up") ||
+    combined.includes("fetch failed") ||
+    combined.includes("network")
+  ) {
+    return {
+      type: "connection_reset",
+      retryable: true,
+      overload: false,
+      circuitEligible: true,
+      recovery: "cold",
+    };
+  }
+
+  if (
+    combined.includes("model is loading") ||
+    combined.includes("loading model") ||
+    combined.includes("llama runner") ||
+    combined.includes("runner") ||
+    combined.includes("out of memory") ||
+    combined.includes("memory allocation") ||
+    combined.includes("cannot allocate") ||
+    combined.includes("cuda") ||
+    combined.includes("kv cache") ||
+    combined.includes("context length") ||
+    combined.includes("failed to load") ||
+    combined.includes("runner process")
+  ) {
+    return {
+      type: "cold_boot_or_runtime",
+      retryable: true,
+      overload: false,
+      circuitEligible: true,
+      recovery: "cold",
+    };
+  }
+
+  if (error.status === 500) {
+    return {
+      type: "http_500_runtime",
+      retryable: true,
+      overload: false,
+      circuitEligible: true,
+      recovery: "medium",
+    };
+  }
+
+  if (isRetryableStatus(error.status)) {
+    return {
+      type: `http_${error.status}`,
+      retryable: true,
+      overload: error.status === 429,
+      circuitEligible: error.status !== 429,
+      recovery: error.status === 429 ? "short" : "medium",
+    };
+  }
+
+  if (error.retryable === true) {
+    return {
+      type: "retryable",
+      retryable: true,
+      overload: false,
+      circuitEligible: true,
+      recovery: "medium",
+    };
+  }
+
+  return {
+    type: "non_retryable",
+    retryable: false,
+    overload: false,
+    circuitEligible: true,
+    recovery: "none",
+  };
+}
+
+export function isRetryableError(error) {
+  const classification = classifyOllamaError(error);
+  if (classification.retryable === true) return true;
+  if (!error) return false;
+  if (error.retryable === true) return true;
+  if (error.name === "AbortError") return true;
+  if (isRetryableStatus(error.status)) return true;
+
+  const message = String(error.message || "").toLowerCase();
+  return (
+    message.includes("http 500") ||
+    message.includes("http 502") ||
+    message.includes("http 503") ||
+    message.includes("http 504") ||
+    message.includes("econnreset") ||
+    message.includes("socket hang up") ||
+    message.includes("network") ||
+    message.includes("fetch failed") ||
+    message.includes("model is loading") ||
+    message.includes("timed out") ||
+    message.includes("timeout")
+  );
+}
+
+function retryDelayMs(retryNumber, classification = {}) {
+  if (classification.recovery === "short" || classification.overload) {
+    return LLM_CONFIG.retries.overloadDelayMs;
+  }
+
+  const baseDelay =
+    classification.recovery === "cold"
+      ? LLM_CONFIG.retries.recoveryDelayMs
+      : LLM_CONFIG.retries.baseDelayMs;
+  const maxDelay =
+    classification.recovery === "cold"
+      ? LLM_CONFIG.retries.recoveryMaxDelayMs
+      : LLM_CONFIG.retries.maxDelayMs;
+  const exponential = baseDelay * Math.pow(2, Math.max(0, retryNumber - 1));
+  return Math.min(exponential, maxDelay);
+}
+
+function resolveNumPredict(routeType, explicitNumPredict) {
+  if (Number.isFinite(Number(explicitNumPredict))) {
+    return clampNumber(
+      explicitNumPredict,
+      1,
+      LLM_CONFIG.gemma.numPredict.max
+    );
+  }
+
+  const normalizedRoute = String(routeType || "").toUpperCase();
+  if (normalizedRoute.includes("INTENT")) return LLM_CONFIG.gemma.numPredict.intent;
+  if (normalizedRoute.includes("FALLBACK")) return LLM_CONFIG.gemma.numPredict.fallback;
+  if (normalizedRoute.includes("HYBRID") || normalizedRoute.includes("RAG")) {
+    return LLM_CONFIG.gemma.numPredict.heavy;
+  }
+  if (normalizedRoute.includes("KG") || normalizedRoute.includes("FAQ")) {
+    return LLM_CONFIG.gemma.numPredict.light;
+  }
+  return LLM_CONFIG.gemma.numPredict.synthesis;
+}
+
+function buildStableOptions(options = {}, { routeType = "GENERAL", promptTokens = 0 } = {}) {
+  const pressure = gemmaTelemetryService.getMemoryPressure();
+  const normalized = { ...options };
+  const maxTemp = pressure.high ? 0.12 : 0.20;
+  const maxTopP = pressure.high ? 0.78 : 0.85;
+  let numPredict = resolveNumPredict(routeType, normalized.num_predict);
+
+  if (promptTokens >= LLM_CONFIG.gemma.deferSynthesisTokens || pressure.high) {
+    numPredict = Math.min(numPredict, LLM_CONFIG.gemma.numPredict.heavy);
+  }
+
+  if (pressure.critical) {
+    numPredict = Math.min(numPredict, LLM_CONFIG.gemma.numPredict.light);
+  }
+
+  const stableOptions = {
+    ...normalized,
+    temperature: clampNumber(
+      normalized.temperature ?? LLM_CONFIG.gemma.defaults.temperature,
+      0,
+      maxTemp
+    ),
+    top_p: clampNumber(
+      normalized.top_p ?? LLM_CONFIG.gemma.defaults.topP,
+      0.05,
+      maxTopP
+    ),
+    repeat_penalty: clampNumber(
+      normalized.repeat_penalty ?? LLM_CONFIG.gemma.defaults.repeatPenalty,
+      1,
+      2
+    ),
+    num_predict: Math.max(1, Math.floor(numPredict)),
+    num_ctx: Math.min(
+      Math.max(
+        Number(normalized.num_ctx) || LLM_CONFIG.gemma.numCtx,
+        LLM_CONFIG.gemma.minNumCtx
+      ),
+      LLM_CONFIG.gemma.numCtx
+    ),
+  };
+
+  if (LLM_CONFIG.gemma.numThread > 0 && stableOptions.num_thread == null) {
+    stableOptions.num_thread = LLM_CONFIG.gemma.numThread;
+  }
+
+  if (LLM_CONFIG.gemma.numBatch > 0 && stableOptions.num_batch == null) {
+    stableOptions.num_batch = LLM_CONFIG.gemma.numBatch;
+  }
+
+  return stableOptions;
+}
+
+function enforcePromptBudget(prompt, options = {}) {
+  const pressure = gemmaTelemetryService.getMemoryPressure();
+  const reserveTokens =
+    Number(options.num_predict || 0) + LLM_CONFIG.gemma.contextHeadroomTokens;
+  const contextCeiling = pressure.high
+    ? Math.min(
+        LLM_CONFIG.gemma.maxContextTokens,
+        LLM_CONFIG.gemma.highPressureContextTokens
+      )
+    : LLM_CONFIG.gemma.maxContextTokens;
+  const maxPromptTokens = Math.max(256, contextCeiling - reserveTokens);
+  const promptTokens = estimateTokens(prompt);
+
+  if (promptTokens <= maxPromptTokens) {
+    return {
+      prompt,
+      promptTokens,
+      maxPromptTokens,
+      truncated: false,
+      pressure,
+    };
+  }
+
+  const targetChars = maxPromptTokens * 4;
+  const marker = "\n\n[Gemma prompt hard-truncated to protect local context budget]\n\n";
+  const headChars = Math.max(1200, Math.floor(targetChars * 0.62));
+  const tailChars = Math.max(800, targetChars - headChars - marker.length);
+  const truncatedPrompt =
+    prompt.slice(0, headChars).trimEnd() +
+    marker +
+    prompt.slice(Math.max(0, prompt.length - tailChars)).trimStart();
+
+  return {
+    prompt: truncatedPrompt,
+    promptTokens: estimateTokens(truncatedPrompt),
+    originalPromptTokens: promptTokens,
+    maxPromptTokens,
+    truncated: true,
+    pressure,
+  };
+}
+
+function createOllamaHttpError(response, bodyPreview = "") {
+  const error = new Error(
+    `Ollama returned HTTP ${response.status}: ${response.statusText}`
+  );
+  error.status = response.status;
+  error.retryable = isRetryableStatus(response.status);
+  error.bodyPreview = bodyPreview;
+  return error;
+}
+
+function rememberGenerationMetadata(requestId, metadata) {
+  if (!requestId) return;
+
+  lastGenerationMetadata.set(requestId, {
+    ...metadata,
+    recorded_at: new Date().toISOString(),
+  });
+
+  while (lastGenerationMetadata.size > MAX_GENERATION_METADATA) {
+    const oldestKey = lastGenerationMetadata.keys().next().value;
+    lastGenerationMetadata.delete(oldestKey);
+  }
+}
+
 async function executeOllamaRequest({
   prompt,
   model,
-  requestId,
-  timeoutMs,
-  options = {},
-  role,
-}) {
-  const controller = new AbortController();
+  requestId,
+  timeoutMs,
+  options = {},
+  role,
+}) {
+  const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), timeoutMs);
   const start = Date.now();
+  const requestOptions = { ...options };
+  const isGemma4Model = String(model || "").toLowerCase().startsWith("gemma4:");
+
+  if (isGemma4Model && requestOptions.stop == null) {
+    requestOptions.stop = ["<eos>"];
+  }
 
   try {
+    log("INFO", "llm_provider_before", {
+      provider: "OLLAMA",
+      model,
+      endpoint: LLM_CONFIG.generateUrl,
+      request_id: requestId,
+    });
+    console.log(
+      `[LLM_PROVIDER] provider=OLLAMA model=${model} endpoint=${LLM_CONFIG.generateUrl} request_id=${requestId}`
+    );
+
     const response = await fetch(LLM_CONFIG.generateUrl, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
@@ -373,607 +389,629 @@ async function executeOllamaRequest({
         model,
         prompt,
         stream: false,
+        ...(isGemma4Model ? { think: false } : {}),
         keep_alive: LLM_CONFIG.keepAlive,
-        options,
+        options: requestOptions,
       }),
       signal: controller.signal,
-    });
+    });
 
     const durationMs = Date.now() - start;
+    log("INFO", "llm_provider_response", {
+      provider: "OLLAMA",
+      model,
+      endpoint: LLM_CONFIG.generateUrl,
+      request_id: requestId,
+      status: response.status,
+      ok: response.ok,
+      latency_ms: durationMs,
+    });
+    console.log(
+      `[LLM_PROVIDER_RESPONSE] provider=OLLAMA model=${model} endpoint=${LLM_CONFIG.generateUrl} request_id=${requestId} status=${response.status} ok=${response.ok} latency_ms=${durationMs}`
+    );
 
     if (!response.ok) {
       const bodyPreview = await response.text().catch(() => "");
       throw createOllamaHttpError(response, bodyPreview.slice(0, 240));
     }
-
-    const data = await response.json();
-    const answer =
-      data?.response?.trim() ||
-      data?.message?.content?.trim() ||
-      "";
-    const promptTokens =
-      Number.isFinite(Number(data?.prompt_eval_count))
-        ? Number(data.prompt_eval_count)
-        : estimateTokens(prompt);
-    const outputTokens =
-      Number.isFinite(Number(data?.eval_count))
-        ? Number(data.eval_count)
+
+    const data = await response.json();
+    const answer =
+      data?.response?.trim() ||
+      data?.message?.content?.trim() ||
+      "";
+    const promptTokens =
+      Number.isFinite(Number(data?.prompt_eval_count))
+        ? Number(data.prompt_eval_count)
+        : estimateTokens(prompt);
+    const outputTokens =
+      Number.isFinite(Number(data?.eval_count))
+        ? Number(data.eval_count)
         : estimateTokens(answer);
 
+    log("INFO", "llm_provider_result", {
+      provider: "OLLAMA",
+      model,
+      endpoint: LLM_CONFIG.generateUrl,
+      request_id: requestId,
+      response_chars: answer.length,
+      done_reason: data?.done_reason,
+      prompt_tokens: promptTokens,
+      output_tokens: outputTokens,
+    });
+    console.log(
+      `[LLM_PROVIDER_RESULT] provider=OLLAMA model=${model} endpoint=${LLM_CONFIG.generateUrl} request_id=${requestId} response_chars=${answer.length} done_reason=${data?.done_reason || "unknown"}`
+    );
+
     if (!answer) {
       const error = new Error("Ollama returned empty response");
       error.retryable = true;
       throw error;
-    }
-
-    log("INFO", "request_success", {
-      requestId,
-      model,
-      role,
-      duration_ms: durationMs,
+    }
+
+    log("INFO", "request_success", {
+      requestId,
+      model,
+      role,
+      duration_ms: durationMs,
       response_chars: answer.length,
       prompt_tokens: promptTokens,
       output_tokens: outputTokens,
-      num_predict: options.num_predict,
+      num_predict: requestOptions.num_predict,
     });
-
-    return { answer, durationMs, promptTokens, outputTokens };
-  } catch (error) {
-    const durationMs = Date.now() - start;
-    const classification = classifyOllamaError(error);
-    gemmaTelemetryService.recordFailure({ classification, error });
-
-    log(error.name === "AbortError" ? "WARN" : "WARN", "request_failure", {
-      requestId,
-      model,
-      role,
-      duration_ms: durationMs,
-      timeout_ms: timeoutMs,
-      retryable: isRetryableError(error),
-      error_type: classification.type,
-      circuit_eligible: classification.circuitEligible,
-      error_message: error.name === "AbortError" ? "timeout" : error.message,
-      status: error.status,
-    });
-
-    throw error;
-  } finally {
-    clearTimeout(timer);
-  }
-}
-
+
+    return { answer, durationMs, promptTokens, outputTokens };
+  } catch (error) {
+    const durationMs = Date.now() - start;
+    const classification = classifyOllamaError(error);
+    gemmaTelemetryService.recordFailure({ classification, error });
+
+    log(error.name === "AbortError" ? "WARN" : "WARN", "request_failure", {
+      requestId,
+      model,
+      role,
+      duration_ms: durationMs,
+      timeout_ms: timeoutMs,
+      retryable: isRetryableError(error),
+      error_type: classification.type,
+      circuit_eligible: classification.circuitEligible,
+      error_message: error.name === "AbortError" ? "timeout" : error.message,
+      status: error.status,
+    });
+
+    throw error;
+  } finally {
+    clearTimeout(timer);
+  }
+}
+
 async function generateWithRetries({
-  prompt,
-  model,
-  role,
-  requestId,
-  retryLimit,
-  timeoutMs,
-  deadlineAt,
-  options,
-  routeType = "GENERAL",
-  recordFailure = true,
-  trafficType = "user",
-}) {
-  const startedAt = Date.now();
+  prompt,
+  model,
+  role,
+  requestId,
+  retryLimit,
+  timeoutMs,
+  deadlineAt,
+  options,
+  routeType = "GENERAL",
+  recordFailure = true,
+  trafficType = "user",
+}) {
+  const startedAt = Date.now();
   let lastError = null;
   let lastClassification = null;
   let attemptsMade = 0;
-  const tracksGemmaMetrics = isGemmaModel(model);
+  const trackGemmaMetrics = isPrimaryGemmaGeneration({ model, role });
 
-  if (tracksGemmaMetrics) {
+  if (trackGemmaMetrics) {
     incrementMetric("gemma_requests_total");
   }
-
-  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
-    const remainingMs = deadlineAt - Date.now();
-
-    if (remainingMs < LLM_CONFIG.timeouts.minRemainingMs) {
-      lastError = new Error("LLM request deadline exhausted before next attempt");
-      lastError.retryable = true;
-      break;
-    }
-
-    const attemptTimeoutMs = Math.min(timeoutMs, remainingMs);
-
-    log("INFO", "generation_attempt", {
-      requestId,
-      model,
-      role,
-      route_type: routeType,
-      traffic_type: trafficType,
-      attempt,
-      retry_limit: retryLimit,
-      timeout_ms: attemptTimeoutMs,
-      remaining_budget_ms: remainingMs,
-      breaker_state: modelFailoverManager.getStatus().breaker_state,
-    });
-
-    try {
-      attemptsMade = attempt + 1;
-      const result = await gemmaRequestLimiter.run(async ({ waitMs, queueDepthAtAcquire }) => {
-        const remainingAfterQueueMs = deadlineAt - Date.now();
-        if (remainingAfterQueueMs < LLM_CONFIG.timeouts.minRemainingMs) {
-          const error = new Error("LLM request deadline exhausted while waiting for Gemma queue");
-          error.code = "GEMMA_QUEUE_TIMEOUT";
-          error.retryable = true;
-          error.overload = true;
-          error.circuitEligible = false;
-          throw error;
-        }
-
-        if (waitMs > 0) {
-          log("INFO", "gemma_queue_wait_complete", {
-            requestId,
-            model,
-            role,
-            route_type: routeType,
-            wait_ms: waitMs,
-            queue_depth_at_acquire: queueDepthAtAcquire,
-          });
-        }
-
-        return executeOllamaRequest({
-          prompt,
-          model,
-          requestId,
-          timeoutMs: Math.min(attemptTimeoutMs, remainingAfterQueueMs),
-          options,
-          role,
-        });
-      }, { requestId, model, role, routeType, trafficType });
-
-      gemmaTelemetryService.recordSuccess({
-        latencyMs: Date.now() - startedAt,
-        outputTokens: result.outputTokens,
-      });
-
-      const latencyMs = Date.now() - startedAt;
-      if (tracksGemmaMetrics) {
+
+  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
+    const remainingMs = deadlineAt - Date.now();
+
+    if (remainingMs < LLM_CONFIG.timeouts.minRemainingMs) {
+      lastError = new Error("LLM request deadline exhausted before next attempt");
+      lastError.retryable = true;
+      break;
+    }
+
+    const attemptTimeoutMs = Math.min(timeoutMs, remainingMs);
+
+    log("INFO", "generation_attempt", {
+      requestId,
+      model,
+      role,
+      route_type: routeType,
+      traffic_type: trafficType,
+      attempt,
+      retry_limit: retryLimit,
+      timeout_ms: attemptTimeoutMs,
+      remaining_budget_ms: remainingMs,
+      breaker_state: modelFailoverManager.getStatus().breaker_state,
+    });
+
+    try {
+      attemptsMade = attempt + 1;
+      const result = await gemmaRequestLimiter.run(async ({ waitMs, queueDepthAtAcquire }) => {
+        const remainingAfterQueueMs = deadlineAt - Date.now();
+        if (remainingAfterQueueMs < LLM_CONFIG.timeouts.minRemainingMs) {
+          const error = new Error("LLM request deadline exhausted while waiting for Gemma queue");
+          error.code = "GEMMA_QUEUE_TIMEOUT";
+          error.retryable = true;
+          error.overload = true;
+          error.circuitEligible = false;
+          throw error;
+        }
+
+        if (waitMs > 0) {
+          log("INFO", "gemma_queue_wait_complete", {
+            requestId,
+            model,
+            role,
+            route_type: routeType,
+            wait_ms: waitMs,
+            queue_depth_at_acquire: queueDepthAtAcquire,
+          });
+        }
+
+        return executeOllamaRequest({
+          prompt,
+          model,
+          requestId,
+          timeoutMs: Math.min(attemptTimeoutMs, remainingAfterQueueMs),
+          options,
+          role,
+        });
+      }, { requestId, model, role, routeType, trafficType });
+
+      gemmaTelemetryService.recordSuccess({
+        latencyMs: Date.now() - startedAt,
+        outputTokens: result.outputTokens,
+      });
+
+      const latencyMs = Date.now() - startedAt;
+      modelFailoverManager.recordModelSuccess({ model, role, latencyMs });
+      if (trackGemmaMetrics) {
         incrementMetric("gemma_success_total");
-        recordDuration("gemma_latency_ms", latencyMs);
       }
-      modelFailoverManager.recordModelSuccess({ model, role, latencyMs });
 
       return {
-        answer: result.answer,
-        attempts: attempt + 1,
-        latencyMs,
-        model,
-        role,
-        routeType,
-        promptTokens: result.promptTokens,
-        outputTokens: result.outputTokens,
-      };
-    } catch (error) {
-      lastError = error;
-      lastClassification = classifyOllamaError(error);
-
-      if (!isRetryableError(error) || attempt >= retryLimit) {
-        break;
-      }
-
-      const delayMs = retryDelayMs(attempt + 1, lastClassification);
-
-      if (deadlineAt - Date.now() - delayMs < LLM_CONFIG.timeouts.minRemainingMs) {
-        break;
-      }
-
-      gemmaTelemetryService.recordRetry(lastClassification);
-
-      log("WARN", "retry_scheduled", {
-        requestId,
-        model,
-        role,
-        route_type: routeType,
-        traffic_type: trafficType,
-        error_type: lastClassification.type,
-        circuit_eligible: lastClassification.circuitEligible,
-        attempt,
-        next_attempt: attempt + 1,
-        delay_ms: delayMs,
-      });
-
-      await sleep(delayMs);
-    }
-  }
+        answer: result.answer,
+        attempts: attempt + 1,
+        latencyMs,
+        model,
+        role,
+        routeType,
+        promptTokens: result.promptTokens,
+        outputTokens: result.outputTokens,
+      };
+    } catch (error) {
+      lastError = error;
+      lastClassification = classifyOllamaError(error);
+
+      if (!isRetryableError(error) || attempt >= retryLimit) {
+        break;
+      }
+
+      const delayMs = retryDelayMs(attempt + 1, lastClassification);
+
+      if (deadlineAt - Date.now() - delayMs < LLM_CONFIG.timeouts.minRemainingMs) {
+        break;
+      }
+
+      gemmaTelemetryService.recordRetry(lastClassification);
+
+      log("WARN", "retry_scheduled", {
+        requestId,
+        model,
+        role,
+        route_type: routeType,
+        traffic_type: trafficType,
+        error_type: lastClassification.type,
+        circuit_eligible: lastClassification.circuitEligible,
+        attempt,
+        next_attempt: attempt + 1,
+        delay_ms: delayMs,
+      });
+
+      await sleep(delayMs);
+    }
+  }
+
+  const latencyMs = Date.now() - startedAt;
+  if (!lastClassification) {
+    lastClassification = classifyOllamaError(lastError);
+  }
+  const circuitEligible = lastClassification?.circuitEligible !== false;
+
+  if (recordFailure && circuitEligible) {
+    modelFailoverManager.recordModelFailure({
+      model,
+      role,
+      error: lastError,
+      latencyMs,
+    });
+  } else {
+    log("WARN", "failure_not_counted_for_circuit", {
+      requestId,
+      model,
+      role,
+      route_type: routeType,
+      traffic_type: trafficType,
+      error_type: lastClassification?.type,
+      record_failure: recordFailure,
+      circuit_eligible: circuitEligible,
+      latency_ms: latencyMs,
+    });
+  }
+
+  log("ERROR", "generation_failed", {
+    requestId,
+    model,
+    role,
+    route_type: routeType,
+    traffic_type: trafficType,
+    attempts: attemptsMade || retryLimit + 1,
+    latency_ms: latencyMs,
+    error_message: lastError?.message,
+    error_type: lastClassification?.type,
+    circuit_eligible: circuitEligible,
+    breaker_state: modelFailoverManager.getStatus().breaker_state,
+  });
 
-  const latencyMs = Date.now() - startedAt;
-  if (!lastClassification) {
-    lastClassification = classifyOllamaError(lastError);
-  }
-  if (tracksGemmaMetrics) {
+  if (trackGemmaMetrics) {
     incrementMetric("gemma_failure_total");
-    recordDuration("gemma_latency_ms", latencyMs);
-    if (
-      lastClassification?.type === "timeout" ||
-      lastError?.code === "GEMMA_QUEUE_TIMEOUT" ||
-      /timeout|timed out/i.test(lastError?.message || "")
-    ) {
+    if (lastClassification?.type === "timeout") {
       incrementMetric("gemma_timeout_total");
     }
   }
-  const circuitEligible = lastClassification?.circuitEligible !== false;
-
-  if (recordFailure && circuitEligible) {
-    modelFailoverManager.recordModelFailure({
-      model,
-      role,
-      error: lastError,
-      latencyMs,
-    });
-  } else {
-    log("WARN", "failure_not_counted_for_circuit", {
-      requestId,
-      model,
-      role,
-      route_type: routeType,
-      traffic_type: trafficType,
-      error_type: lastClassification?.type,
-      record_failure: recordFailure,
-      circuit_eligible: circuitEligible,
-      latency_ms: latencyMs,
-    });
-  }
-
-  log("ERROR", "generation_failed", {
-    requestId,
-    model,
-    role,
-    route_type: routeType,
-    traffic_type: trafficType,
-    attempts: attemptsMade || retryLimit + 1,
-    latency_ms: latencyMs,
-    error_message: lastError?.message,
-    error_type: lastClassification?.type,
-    circuit_eligible: circuitEligible,
-    breaker_state: modelFailoverManager.getStatus().breaker_state,
-  });
 
   throw lastError;
 }
-
-export async function checkOllamaHealth() {
-  const status = await modelFailoverManager.refreshHealth();
-
-  return {
-    healthy: status.server_healthy && status.breaker_state !== "OPEN",
-    modelAvailable: status.primary_health.available,
-    backupModelAvailable: status.backup_health.available,
-    models: status.available_models,
-    primary: status.primary_health,
-    backup: status.backup_health,
-    breakerState: status.breaker_state,
-    startup_readiness_phase: status.startup_readiness_phase,
-    ollama_ready: status.ollama_ready,
-    ollama_wait_attempts: status.ollama_wait_attempts,
-    ollama_wait_duration_ms: status.ollama_wait_duration_ms,
-    startupReadinessPhase: status.startup_readiness_phase,
-    ollamaReady: status.ollama_ready,
-    ollamaWaitAttempts: status.ollama_wait_attempts,
-    ollamaWaitDurationMs: status.ollama_wait_duration_ms,
-    failoverActive: status.failover_active,
-    truePrimaryModel: status.true_primary_model,
-    activeRuntimeModel: status.active_runtime_model,
-    primaryColdStartPending: status.primary_cold_start_pending,
-    preloadWarning: status.preload_warning,
-    startupPreloadStatus: status.startup_preload_status,
-    backupReady: status.backup_ready,
-    gemma_memory_pressure: status.gemma_memory_pressure,
-    gemma_queue_depth: status.gemma_queue_depth,
-    gemma_context_size: status.gemma_context_size,
-    warm_pool_active: status.warm_pool_active,
-    avg_generation_latency: status.avg_generation_latency,
-    overload_retries: status.overload_retries,
-    gemmaTelemetry: status.gemma_telemetry,
-  };
-}
-
-export async function warmupOllama(model = LLM_CONFIG.primaryModel) {
-  return modelFailoverManager.preloadModel(model);
-}
-
-export async function preloadOllamaModels() {
-  return modelFailoverManager.preloadModels();
-}
-
-export function getOllamaRuntimeStatus() {
-  return modelFailoverManager.getStatus();
-}
-
-export function getLastGenerationMetadata(requestId) {
-  return lastGenerationMetadata.get(requestId) || null;
-}
-
-export async function generateStableResponse({
-  prompt,
-  model = LLM_CONFIG.primaryModel,
-  requestId = "none",
-  timeoutMs = LLM_CONFIG.timeouts.primaryMs,
-  deadlineMs = LLM_CONFIG.timeouts.generationDeadlineMs,
-  options = {},
-  skipWarmup = true,
-  routeType = "GENERAL",
-  allowBackup = true,
-  recordFailure = true,
-  trafficType = "user",
-} = {}) {
-  if (!prompt || typeof prompt !== "string") {
-    throw new Error("Prompt is required for Ollama generation.");
-  }
-
-  const initialOptions = buildStableOptions(options, {
-    routeType,
-    promptTokens: estimateTokens(prompt),
-  });
-  const budget = enforcePromptBudget(prompt, initialOptions);
-  const stabilizedOptions = buildStableOptions(initialOptions, {
-    routeType,
-    promptTokens: budget.promptTokens,
-  });
-  const effectivePrompt = budget.prompt;
-
-  gemmaTelemetryService.recordPromptBudget({
-    promptTokens: budget.promptTokens,
-    contextTokens: budget.promptTokens,
-    numPredict: stabilizedOptions.num_predict,
-    truncated: budget.truncated,
-  });
-
-  if (budget.truncated) {
-    log("WARN", "prompt_budget_hard_truncated", {
-      requestId,
-      model,
-      route_type: routeType,
-      traffic_type: trafficType,
-      original_prompt_tokens: budget.originalPromptTokens,
-      final_prompt_tokens: budget.promptTokens,
-      max_prompt_tokens: budget.maxPromptTokens,
-      memory_pressure: budget.pressure.level,
-      num_predict: stabilizedOptions.num_predict,
-    });
-  }
-
-  modelFailoverManager.start();
-  modelFailoverManager.scheduleRecoveryProbeIfDue();
-
-  if (skipWarmup === false) {
-    log("INFO", "warmup_skipped_for_latency", {
-      requestId,
-      reason: "per_request_warmup_disabled",
-    });
-  }
-
-  const initialRoute = modelFailoverManager.getInitialRoute(model);
-  const runtimeStatusBeforeAttempt = modelFailoverManager.getStatus();
-  const primaryColdStartAttempt =
-    initialRoute.role === "primary" &&
-    runtimeStatusBeforeAttempt.primary_cold_start_pending === true;
-  const requestStartedAt = Date.now();
-  const effectiveDeadlineMs = primaryColdStartAttempt
-    ? Math.max(deadlineMs, LLM_CONFIG.timeouts.primaryColdStartMs)
-    : Math.min(
-        Math.max(deadlineMs, LLM_CONFIG.timeouts.minRemainingMs),
-        LLM_CONFIG.timeouts.generationDeadlineMs
-      );
-  const deadlineAt = requestStartedAt + effectiveDeadlineMs;
-
-  if (initialRoute.role === "none") {
-    const status = modelFailoverManager.getStatus();
-    const error = new Error(
-      initialRoute.reason === "waiting_for_ollama"
-        ? "Ollama generation unavailable: startup readiness is waiting for Ollama."
-        : "Ollama generation unavailable: primary and backup models are unhealthy."
-    );
-    error.code =
-      initialRoute.reason === "waiting_for_ollama"
-        ? "LLM_WAITING_FOR_OLLAMA"
-        : "LLM_CIRCUIT_OPEN";
-
-    rememberGenerationMetadata(requestId, {
-      success: false,
-      model: null,
-      role: "none",
-      failover_used: false,
-      routeType,
-      prompt_tokens: budget.promptTokens,
-      prompt_truncated: budget.truncated,
-      ...status,
-    });
-
-    log("ERROR", "breaker_open_reject", {
-      requestId,
-      ...status,
-    });
-
-    throw error;
-  }
-
-  if (initialRoute.role === "backup") {
-    log("WARN", "backup_route_selected", {
-      requestId,
-      reason: initialRoute.reason,
-      primary_model: LLM_CONFIG.primaryModel,
-      backup_model: LLM_CONFIG.backupModel,
-      ...modelFailoverManager.getStatus(),
-    });
-  }
-
-  if (primaryColdStartAttempt) {
-    log("WARN", "primary_cold_start_live_retry", {
-      requestId,
-      model: initialRoute.model,
-      timeout_ms: LLM_CONFIG.timeouts.primaryColdStartMs,
-      deadline_ms: effectiveDeadlineMs,
-      breaker_state: runtimeStatusBeforeAttempt.breaker_state,
-      message: "Gemma remains primary; startup preload warning will be resolved by this live request if successful.",
-    });
-  }
-
-  try {
-    const initialResult = await generateWithRetries({
-      prompt: effectivePrompt,
-      model: initialRoute.model,
-      role: initialRoute.role,
-      requestId,
-      retryLimit:
-        initialRoute.role === "backup"
-          ? LLM_CONFIG.retries.backupLimit
-          : LLM_CONFIG.retries.primaryLimit,
-      timeoutMs:
-        initialRoute.role === "backup"
-          ? LLM_CONFIG.timeouts.backupMs
-          : primaryColdStartAttempt
-            ? Math.max(timeoutMs, LLM_CONFIG.timeouts.primaryColdStartMs)
-            : timeoutMs,
-      deadlineAt,
-      options: stabilizedOptions,
-      routeType,
-      recordFailure,
-      trafficType,
-    });
-
-    rememberGenerationMetadata(requestId, {
-      success: true,
-      failover_used: initialRoute.role === "backup",
-      primary_cold_start_attempt: primaryColdStartAttempt,
-      prompt_truncated: budget.truncated,
-      original_prompt_tokens: budget.originalPromptTokens,
-      max_prompt_tokens: budget.maxPromptTokens,
-      options: stabilizedOptions,
-      ...initialResult,
-      ...modelFailoverManager.getStatus(),
-    });
-
-    return initialResult.answer;
-  } catch (primaryError) {
-    const primaryClassification = classifyOllamaError(primaryError);
-
-    if (
-      !allowBackup ||
-      primaryClassification.circuitEligible === false ||
-      !modelFailoverManager.canFallbackToBackup(initialRoute.role)
-    ) {
-      if (initialRoute.role === "primary") {
-        log("WARN", "primary_failure_below_failover_threshold", {
-          requestId,
-          primary_model: LLM_CONFIG.primaryModel,
-          backup_model: LLM_CONFIG.backupModel,
-          error_message: primaryError?.message,
-          error_type: primaryClassification.type,
-          allow_backup: allowBackup,
-          circuit_eligible: primaryClassification.circuitEligible,
-          message: "Gemma remains active until consecutive runtime failures reach the failover threshold.",
-          ...modelFailoverManager.getStatus(),
-        });
-      }
-
-      if (initialRoute.role === "backup") {
-        modelFailoverManager.recordAllModelsFailed("backup_failed_while_degraded");
-      }
-
-      rememberGenerationMetadata(requestId, {
-        success: false,
-        model: initialRoute.model,
-        role: initialRoute.role,
-        failover_used: initialRoute.role === "backup",
-        primary_cold_start_attempt: primaryColdStartAttempt,
-        error_message: primaryError?.message,
-        error_type: primaryClassification.type,
-        prompt_truncated: budget.truncated,
-        prompt_tokens: budget.promptTokens,
-        ...modelFailoverManager.getStatus(),
-      });
-
-      throw primaryError;
-    }
-
-    modelFailoverManager.activateBackup("primary_generation_failed");
-
-    try {
-      const backupResult = await generateWithRetries({
-        prompt: effectivePrompt,
-        model: LLM_CONFIG.backupModel,
-        role: "backup",
-        requestId,
-        retryLimit: LLM_CONFIG.retries.backupLimit,
-        timeoutMs: LLM_CONFIG.timeouts.backupMs,
-        deadlineAt,
-        options: stabilizedOptions,
-        routeType,
-        recordFailure,
-        trafficType,
-      });
-
-      rememberGenerationMetadata(requestId, {
-        success: true,
-        failover_used: true,
-        primary_cold_start_attempt: primaryColdStartAttempt,
-        primary_error: primaryError?.message,
-        primary_error_type: primaryClassification.type,
-        prompt_truncated: budget.truncated,
-        original_prompt_tokens: budget.originalPromptTokens,
-        max_prompt_tokens: budget.maxPromptTokens,
-        options: stabilizedOptions,
-        ...backupResult,
-        ...modelFailoverManager.getStatus(),
-      });
-
-      return backupResult.answer;
-    } catch (backupError) {
-      modelFailoverManager.recordAllModelsFailed("primary_and_backup_failed");
-
-      rememberGenerationMetadata(requestId, {
-        success: false,
-        model: LLM_CONFIG.backupModel,
-        role: "backup",
-        failover_used: true,
-        primary_cold_start_attempt: primaryColdStartAttempt,
-        primary_error: primaryError?.message,
-        backup_error: backupError?.message,
-        prompt_truncated: budget.truncated,
-        prompt_tokens: budget.promptTokens,
-        ...modelFailoverManager.getStatus(),
-      });
-
-      throw backupError;
-    }
-  }
-}
-
-export async function callOllama(
-  prompt,
-  model = LLM_CONFIG.primaryModel,
-  requestId = "none",
-  generationOptions = {}
-) {
-  return generateStableResponse({
-    prompt,
-    model,
-    requestId,
-    ...generationOptions,
-  });
-}
-
-gemmaTelemetryService.start();
-modelFailoverManager.start();
-
-log("INFO", "ollama_service_initialized", {
-  base_url: LLM_CONFIG.ollamaBaseUrl,
-  primary_model: LLM_CONFIG.primaryModel,
-  backup_model: LLM_CONFIG.backupModel,
-  primary_retry_limit: LLM_CONFIG.retries.primaryLimit,
-  backup_retry_limit: LLM_CONFIG.retries.backupLimit,
-  primary_timeout_ms: LLM_CONFIG.timeouts.primaryMs,
-  synthesis_timeout_ms: LLM_CONFIG.timeouts.synthesisMs,
-  backup_timeout_ms: LLM_CONFIG.timeouts.backupMs,
-  generation_deadline_ms: LLM_CONFIG.timeouts.generationDeadlineMs,
-  synthesis_deadline_ms: LLM_CONFIG.timeouts.synthesisDeadlineMs,
-  primary_max_failures: LLM_CONFIG.failover.primaryMaxFailures,
-  breaker_threshold: LLM_CONFIG.failover.breakerThreshold,
-  half_open_interval_ms: LLM_CONFIG.failover.halfOpenIntervalMs,
-  gemma_max_context_tokens: LLM_CONFIG.gemma.maxContextTokens,
-  gemma_max_active_requests: LLM_CONFIG.gemma.maxActiveRequests,
-  gemma_queue_max_depth: LLM_CONFIG.gemma.maxQueueDepth,
-  warm_pool_enabled: LLM_CONFIG.warmPool.enabled,
-});
+
+export async function checkOllamaHealth() {
+  const status = await modelFailoverManager.refreshHealth();
+
+  return {
+    healthy: status.server_healthy && status.breaker_state !== "OPEN",
+    modelAvailable: status.primary_health.available,
+    backupModelAvailable: status.backup_health.available,
+    models: status.available_models,
+    primary: status.primary_health,
+    backup: status.backup_health,
+    breakerState: status.breaker_state,
+    startup_readiness_phase: status.startup_readiness_phase,
+    ollama_ready: status.ollama_ready,
+    ollama_wait_attempts: status.ollama_wait_attempts,
+    ollama_wait_duration_ms: status.ollama_wait_duration_ms,
+    startupReadinessPhase: status.startup_readiness_phase,
+    ollamaReady: status.ollama_ready,
+    ollamaWaitAttempts: status.ollama_wait_attempts,
+    ollamaWaitDurationMs: status.ollama_wait_duration_ms,
+    failoverActive: status.failover_active,
+    truePrimaryModel: status.true_primary_model,
+    activeRuntimeModel: status.active_runtime_model,
+    primaryColdStartPending: status.primary_cold_start_pending,
+    preloadWarning: status.preload_warning,
+    startupPreloadStatus: status.startup_preload_status,
+    backupReady: status.backup_ready,
+    gemma_memory_pressure: status.gemma_memory_pressure,
+    gemma_queue_depth: status.gemma_queue_depth,
+    gemma_context_size: status.gemma_context_size,
+    warm_pool_active: status.warm_pool_active,
+    avg_generation_latency: status.avg_generation_latency,
+    overload_retries: status.overload_retries,
+    gemmaTelemetry: status.gemma_telemetry,
+  };
+}
+
+export async function warmupOllama(model = LLM_CONFIG.primaryModel) {
+  return modelFailoverManager.preloadModel(model);
+}
+
+export async function preloadOllamaModels() {
+  return modelFailoverManager.preloadModels();
+}
+
+export function getOllamaRuntimeStatus() {
+  return modelFailoverManager.getStatus();
+}
+
+export function getLastGenerationMetadata(requestId) {
+  return lastGenerationMetadata.get(requestId) || null;
+}
+
+export async function generateStableResponse({
+  prompt,
+  model = LLM_CONFIG.primaryModel,
+  requestId = "none",
+  timeoutMs = LLM_CONFIG.timeouts.primaryMs,
+  deadlineMs = LLM_CONFIG.timeouts.generationDeadlineMs,
+  options = {},
+  skipWarmup = true,
+  routeType = "GENERAL",
+  allowBackup = true,
+  recordFailure = true,
+  trafficType = "user",
+} = {}) {
+  if (!prompt || typeof prompt !== "string") {
+    throw new Error("Prompt is required for Ollama generation.");
+  }
+
+  const initialOptions = buildStableOptions(options, {
+    routeType,
+    promptTokens: estimateTokens(prompt),
+  });
+  const budget = enforcePromptBudget(prompt, initialOptions);
+  const stabilizedOptions = buildStableOptions(initialOptions, {
+    routeType,
+    promptTokens: budget.promptTokens,
+  });
+  const effectivePrompt = budget.prompt;
+
+  gemmaTelemetryService.recordPromptBudget({
+    promptTokens: budget.promptTokens,
+    contextTokens: budget.promptTokens,
+    numPredict: stabilizedOptions.num_predict,
+    truncated: budget.truncated,
+  });
+
+  if (budget.truncated) {
+    log("WARN", "prompt_budget_hard_truncated", {
+      requestId,
+      model,
+      route_type: routeType,
+      traffic_type: trafficType,
+      original_prompt_tokens: budget.originalPromptTokens,
+      final_prompt_tokens: budget.promptTokens,
+      max_prompt_tokens: budget.maxPromptTokens,
+      memory_pressure: budget.pressure.level,
+      num_predict: stabilizedOptions.num_predict,
+    });
+  }
+
+  modelFailoverManager.start();
+  modelFailoverManager.scheduleRecoveryProbeIfDue();
+
+  if (skipWarmup === false) {
+    log("INFO", "warmup_skipped_for_latency", {
+      requestId,
+      reason: "per_request_warmup_disabled",
+    });
+  }
+
+  const initialRoute = modelFailoverManager.getInitialRoute(model);
+  const runtimeStatusBeforeAttempt = modelFailoverManager.getStatus();
+  const primaryColdStartAttempt =
+    initialRoute.role === "primary" &&
+    runtimeStatusBeforeAttempt.primary_cold_start_pending === true;
+  const requestStartedAt = Date.now();
+  const effectiveDeadlineMs = primaryColdStartAttempt
+    ? Math.max(deadlineMs, LLM_CONFIG.timeouts.primaryColdStartMs)
+    : Math.min(
+        Math.max(deadlineMs, LLM_CONFIG.timeouts.minRemainingMs),
+        LLM_CONFIG.timeouts.generationDeadlineMs
+      );
+  const deadlineAt = requestStartedAt + effectiveDeadlineMs;
+
+  if (initialRoute.role === "none") {
+    const status = modelFailoverManager.getStatus();
+    const error = new Error(
+      initialRoute.reason === "waiting_for_ollama"
+        ? "Ollama generation unavailable: startup readiness is waiting for Ollama."
+        : "Ollama generation unavailable: primary and backup models are unhealthy."
+    );
+    error.code =
+      initialRoute.reason === "waiting_for_ollama"
+        ? "LLM_WAITING_FOR_OLLAMA"
+        : "LLM_CIRCUIT_OPEN";
+
+    rememberGenerationMetadata(requestId, {
+      success: false,
+      model: null,
+      role: "none",
+      failover_used: false,
+      routeType,
+      prompt_tokens: budget.promptTokens,
+      prompt_truncated: budget.truncated,
+      ...status,
+    });
+
+    log("ERROR", "breaker_open_reject", {
+      requestId,
+      ...status,
+    });
+
+    throw error;
+  }
+
+  if (initialRoute.role === "backup") {
+    log("WARN", "backup_route_selected", {
+      requestId,
+      reason: initialRoute.reason,
+      primary_model: LLM_CONFIG.primaryModel,
+      backup_model: LLM_CONFIG.backupModel,
+      ...modelFailoverManager.getStatus(),
+    });
+  }
+
+  if (primaryColdStartAttempt) {
+    log("WARN", "primary_cold_start_live_retry", {
+      requestId,
+      model: initialRoute.model,
+      timeout_ms: LLM_CONFIG.timeouts.primaryColdStartMs,
+      deadline_ms: effectiveDeadlineMs,
+      breaker_state: runtimeStatusBeforeAttempt.breaker_state,
+      message: "Gemma remains primary; startup preload warning will be resolved by this live request if successful.",
+    });
+  }
+
+  try {
+    const initialResult = await generateWithRetries({
+      prompt: effectivePrompt,
+      model: initialRoute.model,
+      role: initialRoute.role,
+      requestId,
+      retryLimit:
+        initialRoute.role === "backup"
+          ? LLM_CONFIG.retries.backupLimit
+          : LLM_CONFIG.retries.primaryLimit,
+      timeoutMs:
+        initialRoute.role === "backup"
+          ? LLM_CONFIG.timeouts.backupMs
+          : primaryColdStartAttempt
+            ? Math.max(timeoutMs, LLM_CONFIG.timeouts.primaryColdStartMs)
+            : timeoutMs,
+      deadlineAt,
+      options: stabilizedOptions,
+      routeType,
+      recordFailure,
+      trafficType,
+    });
+
+    rememberGenerationMetadata(requestId, {
+      success: true,
+      failover_used: initialRoute.role === "backup",
+      primary_cold_start_attempt: primaryColdStartAttempt,
+      prompt_truncated: budget.truncated,
+      original_prompt_tokens: budget.originalPromptTokens,
+      max_prompt_tokens: budget.maxPromptTokens,
+      options: stabilizedOptions,
+      ...initialResult,
+      ...modelFailoverManager.getStatus(),
+    });
+
+    return initialResult.answer;
+  } catch (primaryError) {
+    const primaryClassification = classifyOllamaError(primaryError);
+
+    if (
+      !allowBackup ||
+      primaryClassification.circuitEligible === false ||
+      !modelFailoverManager.canFallbackToBackup(initialRoute.role)
+    ) {
+      if (initialRoute.role === "primary") {
+        log("WARN", "primary_failure_below_failover_threshold", {
+          requestId,
+          primary_model: LLM_CONFIG.primaryModel,
+          backup_model: LLM_CONFIG.backupModel,
+          error_message: primaryError?.message,
+          error_type: primaryClassification.type,
+          allow_backup: allowBackup,
+          circuit_eligible: primaryClassification.circuitEligible,
+          message: "Gemma remains active until consecutive runtime failures reach the failover threshold.",
+          ...modelFailoverManager.getStatus(),
+        });
+      }
+
+      if (initialRoute.role === "backup") {
+        modelFailoverManager.recordAllModelsFailed("backup_failed_while_degraded");
+      }
+
+      rememberGenerationMetadata(requestId, {
+        success: false,
+        model: initialRoute.model,
+        role: initialRoute.role,
+        failover_used: initialRoute.role === "backup",
+        primary_cold_start_attempt: primaryColdStartAttempt,
+        error_message: primaryError?.message,
+        error_type: primaryClassification.type,
+        prompt_truncated: budget.truncated,
+        prompt_tokens: budget.promptTokens,
+        ...modelFailoverManager.getStatus(),
+      });
+
+      throw primaryError;
+    }
+
+    modelFailoverManager.activateBackup("primary_generation_failed");
+
+    try {
+      const backupResult = await generateWithRetries({
+        prompt: effectivePrompt,
+        model: LLM_CONFIG.backupModel,
+        role: "backup",
+        requestId,
+        retryLimit: LLM_CONFIG.retries.backupLimit,
+        timeoutMs: LLM_CONFIG.timeouts.backupMs,
+        deadlineAt,
+        options: stabilizedOptions,
+        routeType,
+        recordFailure,
+        trafficType,
+      });
+
+      rememberGenerationMetadata(requestId, {
+        success: true,
+        failover_used: true,
+        primary_cold_start_attempt: primaryColdStartAttempt,
+        primary_error: primaryError?.message,
+        primary_error_type: primaryClassification.type,
+        prompt_truncated: budget.truncated,
+        original_prompt_tokens: budget.originalPromptTokens,
+        max_prompt_tokens: budget.maxPromptTokens,
+        options: stabilizedOptions,
+        ...backupResult,
+        ...modelFailoverManager.getStatus(),
+      });
+
+      return backupResult.answer;
+    } catch (backupError) {
+      modelFailoverManager.recordAllModelsFailed("primary_and_backup_failed");
+
+      rememberGenerationMetadata(requestId, {
+        success: false,
+        model: LLM_CONFIG.backupModel,
+        role: "backup",
+        failover_used: true,
+        primary_cold_start_attempt: primaryColdStartAttempt,
+        primary_error: primaryError?.message,
+        backup_error: backupError?.message,
+        prompt_truncated: budget.truncated,
+        prompt_tokens: budget.promptTokens,
+        ...modelFailoverManager.getStatus(),
+      });
+
+      throw backupError;
+    }
+  }
+}
+
+export async function callOllama(
+  prompt,
+  model = LLM_CONFIG.primaryModel,
+  requestId = "none",
+  generationOptions = {}
+) {
+  return generateStableResponse({
+    prompt,
+    model,
+    requestId,
+    ...generationOptions,
+  });
+}
+
+gemmaTelemetryService.start();
+modelFailoverManager.start();
+
+log("INFO", "ollama_service_initialized", {
+  base_url: LLM_CONFIG.ollamaBaseUrl,
+  primary_model: LLM_CONFIG.primaryModel,
+  backup_model: LLM_CONFIG.backupModel,
+  primary_retry_limit: LLM_CONFIG.retries.primaryLimit,
+  backup_retry_limit: LLM_CONFIG.retries.backupLimit,
+  primary_timeout_ms: LLM_CONFIG.timeouts.primaryMs,
+  synthesis_timeout_ms: LLM_CONFIG.timeouts.synthesisMs,
+  backup_timeout_ms: LLM_CONFIG.timeouts.backupMs,
+  generation_deadline_ms: LLM_CONFIG.timeouts.generationDeadlineMs,
+  synthesis_deadline_ms: LLM_CONFIG.timeouts.synthesisDeadlineMs,
+  primary_max_failures: LLM_CONFIG.failover.primaryMaxFailures,
+  breaker_threshold: LLM_CONFIG.failover.breakerThreshold,
+  half_open_interval_ms: LLM_CONFIG.failover.halfOpenIntervalMs,
+  gemma_max_context_tokens: LLM_CONFIG.gemma.maxContextTokens,
+  gemma_max_active_requests: LLM_CONFIG.gemma.maxActiveRequests,
+  gemma_queue_max_depth: LLM_CONFIG.gemma.maxQueueDepth,
+  warm_pool_enabled: LLM_CONFIG.warmPool.enabled,
+});
```

## backend/rag_system/requirements.retriever.txt

A path: `C:\AI_AGENT\aast-ai-agent-main\backend\rag_system\requirements.retriever.txt`
B path: `C:\Users\mh978\Downloads\AI_AGENT n\aast-ai-agent-main\backend\rag_system\requirements.retriever.txt`
Risk level: LOW

Added functionality: B adds transformers==4.41.2 and accelerate>=0.30 for retriever/runtime compatibility.

Removed functionality: None.

Exact diff:
```diff
diff --git "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\rag_system\\requirements.retriever.txt" "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\rag_system\\requirements.retriever.txt"
index 6f8a1309..9feebe6e 100644
--- "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\rag_system\\requirements.retriever.txt"
+++ "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\rag_system\\requirements.retriever.txt"	
@@ -5,3 +5,5 @@ sentence-transformers==3.0.1
 numpy==1.26.4
 tenacity==8.5.0
 psutil==5.9.8
+transformers==4.41.2
+accelerate>=0.30
\ No newline at end of file
```

## backend/package.json

A path: `C:\AI_AGENT\aast-ai-agent-main\backend\package.json`
B path: `C:\Users\mh978\Downloads\AI_AGENT n\aast-ai-agent-main\backend\package.json`
Risk level: LOW

Added functionality: B declares direct dependencies cli-table3 and node-fetch.

Removed functionality: None.

Exact diff:
```diff
diff --git "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\package.json" "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\package.json"
index 1359720c..aa5903b8 100644
--- "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\package.json"
+++ "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\package.json"	
@@ -34,7 +34,9 @@
     "neo4j-driver": "^5.9.0",
     "react": "^19.2.0",
     "react-dom": "^19.2.0",
-    "redis": "^5.12.1"
+    "redis": "^5.12.1",
+    "cli-table3": "^0.6.5",
+    "node-fetch": "^3.3.2"
   },
   "devDependencies": {
     "nodemon": "^3.1.10",
```

## backend/package-lock.json

A path: `C:\AI_AGENT\aast-ai-agent-main\backend\package-lock.json`
B path: `C:\Users\mh978\Downloads\AI_AGENT n\aast-ai-agent-main\backend\package-lock.json`
Risk level: LOW if regenerated from the accepted package.json dependency delta only.

Added functionality: B lockfile adds cli-table3 tree and direct node-fetch 3.x tree.

Removed functionality: Top-level node-fetch 2.x placement changes because direct node-fetch becomes 3.x and cross-fetch keeps node-fetch 2.x nested.

Exact diff:
```diff
diff --git "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\package-lock.json" "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\package-lock.json"
index 61434030..1c5cadd3 100644
--- "a/C:\\AI_AGENT\\aast-ai-agent-main\\backend\\package-lock.json"
+++ "b/C:\\Users\\mh978\\Downloads\\AI_AGENT n\\aast-ai-agent-main\\backend\\package-lock.json"	
@@ -18,6 +18,7 @@
         "boxen": "^8.0.1",
         "chalk": "^5.3.0",
         "chromadb": "^3.1.7",
+        "cli-table3": "^0.6.5",
         "cors": "^2.8.5",
         "dotenv": "^16.6.1",
         "express": "^4.18.2",
@@ -26,6 +27,7 @@
         "mongoose": "^9.6.1",
         "mysql2": "^3.6.0",
         "neo4j-driver": "^5.9.0",
+        "node-fetch": "^3.3.2",
         "react": "^19.2.0",
         "react-dom": "^19.2.0",
         "redis": "^5.12.1"
@@ -58,6 +60,16 @@
         "node": ">=20"
       }
     },
+    "node_modules/@colors/colors": {
+      "version": "1.5.0",
+      "resolved": "https://registry.npmjs.org/@colors/colors/-/colors-1.5.0.tgz",
+      "integrity": "sha512-ooWCrlZP11i8GImSjTHYHLkvFDP48nS4+204nGb1RiX/WXYHmJA2III9/e2DWVabCESdW7hBAEzHRqUn9OUVvQ==",
+      "license": "MIT",
+      "optional": true,
+      "engines": {
+        "node": ">=0.1.90"
+      }
+    },
     "node_modules/@emnapi/runtime": {
       "version": "1.7.1",
       "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.7.1.tgz",
@@ -2158,6 +2170,62 @@
         "url": "https://github.com/sponsors/sindresorhus"
       }
     },
+    "node_modules/cli-table3": {
+      "version": "0.6.5",
+      "resolved": "https://registry.npmjs.org/cli-table3/-/cli-table3-0.6.5.tgz",
+      "integrity": "sha512-+W/5efTR7y5HRD7gACw9yQjqMVvEMLBHmboM/kPWam+H+Hmyrgjh6YncVKK122YZkXrLudzTuAukUw9FnMf7IQ==",
+      "license": "MIT",
+      "dependencies": {
+        "string-width": "^4.2.0"
+      },
+      "engines": {
+        "node": "10.* || >= 12.*"
+      },
+      "optionalDependencies": {
+        "@colors/colors": "1.5.0"
+      }
+    },
+    "node_modules/cli-table3/node_modules/ansi-regex": {
+      "version": "5.0.1",
+      "resolved": "https://registry.npmjs.org/ansi-regex/-/ansi-regex-5.0.1.tgz",
+      "integrity": "sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==",
+      "license": "MIT",
+      "engines": {
+        "node": ">=8"
+      }
+    },
+    "node_modules/cli-table3/node_modules/emoji-regex": {
+      "version": "8.0.0",
+      "resolved": "https://registry.npmjs.org/emoji-regex/-/emoji-regex-8.0.0.tgz",
+      "integrity": "sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==",
+      "license": "MIT"
+    },
+    "node_modules/cli-table3/node_modules/string-width": {
+      "version": "4.2.3",
+      "resolved": "https://registry.npmjs.org/string-width/-/string-width-4.2.3.tgz",
+      "integrity": "sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==",
+      "license": "MIT",
+      "dependencies": {
+        "emoji-regex": "^8.0.0",
+        "is-fullwidth-code-point": "^3.0.0",
+        "strip-ansi": "^6.0.1"
+      },
+      "engines": {
+        "node": ">=8"
+      }
+    },
+    "node_modules/cli-table3/node_modules/strip-ansi": {
+      "version": "6.0.1",
+      "resolved": "https://registry.npmjs.org/strip-ansi/-/strip-ansi-6.0.1.tgz",
+      "integrity": "sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==",
+      "license": "MIT",
+      "dependencies": {
+        "ansi-regex": "^5.0.1"
+      },
+      "engines": {
+        "node": ">=8"
+      }
+    },
     "node_modules/cluster-key-slot": {
       "version": "1.1.2",
       "resolved": "https://registry.npmjs.org/cluster-key-slot/-/cluster-key-slot-1.1.2.tgz",
@@ -2232,6 +2300,35 @@
         "node-fetch": "^2.7.0"
       }
     },
+    "node_modules/cross-fetch/node_modules/node-fetch": {
+      "version": "2.7.0",
+      "resolved": "https://registry.npmjs.org/node-fetch/-/node-fetch-2.7.0.tgz",
+      "integrity": "sha512-c4FRfUm/dbcWZ7U+1Wq0AwCyFL+3nt2bEw05wfxSz+DWpWsitgmSgYmy2dQdWyKC1694ELPqMs/YzUSNozLt8A==",
+      "license": "MIT",
+      "dependencies": {
+        "whatwg-url": "^5.0.0"
+      },
+      "engines": {
+        "node": "4.x || >=6.0.0"
+      },
+      "peerDependencies": {
+        "encoding": "^0.1.0"
+      },
+      "peerDependenciesMeta": {
+        "encoding": {
+          "optional": true
+        }
+      }
+    },
+    "node_modules/data-uri-to-buffer": {
+      "version": "4.0.1",
+      "resolved": "https://registry.npmjs.org/data-uri-to-buffer/-/data-uri-to-buffer-4.0.1.tgz",
+      "integrity": "sha512-0R9ikRb668HB7QDxT1vkpuUBtqc53YyAwMwGeUFKRojY/NWKvdZ+9UYtRfGmhqNbRkTSVpMbmyhXipFFv2cb/A==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 12"
+      }
+    },
     "node_modules/debug": {
       "version": "2.6.9",
       "license": "MIT",
@@ -2549,6 +2646,29 @@
       ],
       "license": "BSD-3-Clause"
     },
+    "node_modules/fetch-blob": {
+      "version": "3.2.0",
+      "resolved": "https://registry.npmjs.org/fetch-blob/-/fetch-blob-3.2.0.tgz",
+      "integrity": "sha512-7yAQpD2UMJzLi1Dqv7qFYnPbaPx7ZfFK6PiIxQ4PfkGPyNyl2Ugx+a/umUonmKqjhM4DnfbMvdX6otXq83soQQ==",
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/jimmywarting"
+        },
+        {
+          "type": "paypal",
+          "url": "https://paypal.me/jimmywarting"
+        }
+      ],
+      "license": "MIT",
+      "dependencies": {
+        "node-domexception": "^1.0.0",
+        "web-streams-polyfill": "^3.0.3"
+      },
+      "engines": {
+        "node": "^12.20 || >= 14.13"
+      }
+    },
     "node_modules/fill-range": {
       "version": "7.1.1",
       "dev": true,
@@ -2618,6 +2738,18 @@
         "node": ">= 6"
       }
     },
+    "node_modules/formdata-polyfill": {
+      "version": "4.0.10",
+      "resolved": "https://registry.npmjs.org/formdata-polyfill/-/formdata-polyfill-4.0.10.tgz",
+      "integrity": "sha512-buewHzMvYL29jdeQTVILecSaZKnt/RJWjoZCF5OW60Z67/GmSLBkOFM7qh1PI3zFNtJbaZL5eQu1vLfazOwj4g==",
+      "license": "MIT",
+      "dependencies": {
+        "fetch-blob": "^3.1.2"
+      },
+      "engines": {
+        "node": ">=12.20.0"
+      }
+    },
     "node_modules/forwarded": {
       "version": "0.2.0",
       "license": "MIT",
@@ -3489,22 +3621,42 @@
         "node": "^18 || ^20 || >= 21"
       }
     },
+    "node_modules/node-domexception": {
+      "version": "1.0.0",
+      "resolved": "https://registry.npmjs.org/node-domexception/-/node-domexception-1.0.0.tgz",
+      "integrity": "sha512-/jKZoMpw0F8GRwl4/eLROPA3cfcXtLApP0QzLmUT/HuPCZWyB7IY9ZrMeKw2O/nFIqPQB3PVM9aYm0F312AXDQ==",
+      "deprecated": "Use your platform's native DOMException instead",
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/jimmywarting"
+        },
+        {
+          "type": "github",
+          "url": "https://paypal.me/jimmywarting"
+        }
+      ],
+      "license": "MIT",
+      "engines": {
+        "node": ">=10.5.0"
+      }
+    },
     "node_modules/node-fetch": {
-      "version": "2.7.0",
+      "version": "3.3.2",
+      "resolved": "https://registry.npmjs.org/node-fetch/-/node-fetch-3.3.2.tgz",
+      "integrity": "sha512-dRB78srN/l6gqWulah9SrxeYnxeddIG30+GOqK/9OlLVyLg3HPnr6SqOWTWOXKRwC2eGYCkZ59NNuSgvSrpgOA==",
       "license": "MIT",
       "dependencies": {
-        "whatwg-url": "^5.0.0"
+        "data-uri-to-buffer": "^4.0.0",
+        "fetch-blob": "^3.1.4",
+        "formdata-polyfill": "^4.0.10"
       },
       "engines": {
-        "node": "4.x || >=6.0.0"
-      },
-      "peerDependencies": {
-        "encoding": "^0.1.0"
+        "node": "^12.20.0 || ^14.13.1 || >=16.0.0"
       },
-      "peerDependenciesMeta": {
-        "encoding": {
-          "optional": true
-        }
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/node-fetch"
       }
     },
     "node_modules/node-gyp-build": {
@@ -4413,6 +4565,8 @@
     },
     "node_modules/tr46": {
       "version": "0.0.3",
+      "resolved": "https://registry.npmjs.org/tr46/-/tr46-0.0.3.tgz",
+      "integrity": "sha512-N3WMsuqV66lT30CrXNbEjx4GEwlow3v6rr4mCcv6prnfwhS01rkgyFdjPNBYd9br7LpXV1+Emh01fHnq2Gdgrw==",
       "license": "MIT"
     },
     "node_modules/tslib": {
@@ -4603,12 +4757,25 @@
         "url": "https://github.com/sponsors/jonschlinkert"
       }
     },
+    "node_modules/web-streams-polyfill": {
+      "version": "3.3.3",
+      "resolved": "https://registry.npmjs.org/web-streams-polyfill/-/web-streams-polyfill-3.3.3.tgz",
+      "integrity": "sha512-d2JWLCivmZYTSIoge9MsgFCZrt571BikcWGYkjC1khllbTeDlGqZ2D8vD8E/lJa8WGWbb7Plm8/XJYV7IJHZZw==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 8"
+      }
+    },
     "node_modules/webidl-conversions": {
       "version": "3.0.1",
+      "resolved": "https://registry.npmjs.org/webidl-conversions/-/webidl-conversions-3.0.1.tgz",
+      "integrity": "sha512-2JAn3z8AR6rjK8Sm8orRC0h/bcl/DqL7tRPdGZ4I1CjdF+EaMLmYxBHyXuKL849eucPFhvBoxMsflfOb8kxaeQ==",
       "license": "BSD-2-Clause"
     },
     "node_modules/whatwg-url": {
       "version": "5.0.0",
+      "resolved": "https://registry.npmjs.org/whatwg-url/-/whatwg-url-5.0.0.tgz",
+      "integrity": "sha512-saE57nupxk6v3HY35+jzBwYa0rKSy0XR8JSxZPwgLr7ys0IBzhGviA1/TUGJLmSVqs8pb9AnvICXEuOHLprYTw==",
       "license": "MIT",
       "dependencies": {
         "tr46": "~0.0.3",
```

