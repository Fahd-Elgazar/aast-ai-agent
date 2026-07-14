import { execFile } from "child_process";
import { LLM_CONFIG } from "../config/llmConfig.js";

const LATENCY_WINDOW_SIZE = 100;
const PROCESS_NAMES = ["ollama", "ollama_llama_server", "llama-server"];

function roundMb(bytes) {
  return Math.round((Number(bytes || 0) / 1024 / 1024) * 10) / 10;
}

function nowIso() {
  return new Date().toISOString();
}

function parseWindowsCsvLine(line) {
  const values = [];
  const regex = /"([^"]*)"|([^,]+)/g;
  let match;

  while ((match = regex.exec(line)) !== null) {
    values.push(match[1] ?? match[2] ?? "");
  }

  return values;
}

function parseKb(value) {
  const numeric = String(value || "").replace(/[^\d]/g, "");
  const parsed = Number.parseInt(numeric, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pressureLevel(rssMb, config = LLM_CONFIG.gemma) {
  if (rssMb >= config.pressureCriticalRssMb) return "critical";
  if (rssMb >= config.pressureHighRssMb) return "high";
  return "normal";
}

class GemmaTelemetryService {
  constructor(config = LLM_CONFIG) {
    this.config = config;
    this.started = false;
    this.memoryTimer = null;
    this.latencies = [];
    this.activeRequests = 0;
    this.queueDepth = 0;
    this.lastContextSize = 0;
    this.lastPromptTokens = 0;
    this.lastOutputTokens = 0;
    this.lastNumPredict = null;
    this.lastPromptTruncated = false;
    this.promptTruncations = 0;
    this.overloadRetries = 0;
    this.totalRetries = 0;
    this.retryCounts = {};
    this.failureCounts = {};
    this.lastFailure = null;
    this.lastSuccessAt = null;
    this.warmPoolActive = false;
    this.lastWarmPoolAt = null;
    this.lastWarmPoolError = null;
    this.ollamaMemory = {
      available: false,
      rss_bytes: null,
      rss_mb: null,
      process_count: 0,
      checked_at: null,
      error: null,
    };
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.pollOllamaMemory().catch(() => {});
    this.memoryTimer = setInterval(() => {
      this.pollOllamaMemory().catch(() => {});
    }, this.config.gemma.ollamaMemoryPollMs);
    this.memoryTimer.unref?.();
  }

  getProcessMemory() {
    const memory = process.memoryUsage();
    const rssMb = roundMb(memory.rss);

    return {
      rss_bytes: memory.rss,
      heap_total_bytes: memory.heapTotal,
      heap_used_bytes: memory.heapUsed,
      external_bytes: memory.external,
      rss_mb: rssMb,
      heap_total_mb: roundMb(memory.heapTotal),
      heap_used_mb: roundMb(memory.heapUsed),
      external_mb: roundMb(memory.external),
    };
  }

  getMemoryPressure() {
    const processMemory = this.getProcessMemory();
    const ollamaRssMb = this.ollamaMemory.rss_mb || 0;
    const combinedRssMb = processMemory.rss_mb + ollamaRssMb;
    const level = pressureLevel(combinedRssMb, this.config.gemma);

    return {
      level,
      high: level === "high" || level === "critical",
      critical: level === "critical",
      combined_rss_mb: Math.round(combinedRssMb * 10) / 10,
      process_rss_mb: processMemory.rss_mb,
      ollama_rss_mb: this.ollamaMemory.rss_mb,
      high_threshold_mb: this.config.gemma.pressureHighRssMb,
      critical_threshold_mb: this.config.gemma.pressureCriticalRssMb,
    };
  }

  recordQueue({ active = this.activeRequests, pending = this.queueDepth } = {}) {
    this.activeRequests = active;
    this.queueDepth = pending;
  }

  recordPromptBudget({
    promptTokens = 0,
    contextTokens = 0,
    outputTokens = 0,
    numPredict = null,
    truncated = false,
  } = {}) {
    this.lastPromptTokens = promptTokens;
    this.lastContextSize = contextTokens;
    this.lastOutputTokens = outputTokens;
    this.lastNumPredict = numPredict;
    this.lastPromptTruncated = truncated;
    if (truncated) this.promptTruncations += 1;
  }

  recordRetry(classification = {}) {
    const type = classification.type || "unknown";
    this.totalRetries += 1;
    this.retryCounts[type] = (this.retryCounts[type] || 0) + 1;
    if (classification.overload === true || type === "overload") {
      this.overloadRetries += 1;
    }
  }

  recordSuccess({ latencyMs = 0, outputTokens = 0 } = {}) {
    this.latencies.push(Number(latencyMs) || 0);
    while (this.latencies.length > LATENCY_WINDOW_SIZE) {
      this.latencies.shift();
    }
    this.lastOutputTokens = outputTokens || this.lastOutputTokens;
    this.lastSuccessAt = nowIso();
  }

  recordFailure({ classification = {}, error = null } = {}) {
    const type = classification.type || "unknown";
    this.failureCounts[type] = (this.failureCounts[type] || 0) + 1;
    this.lastFailure = {
      type,
      message: error?.message || String(error || ""),
      status: error?.status,
      at: nowIso(),
    };
  }

  recordWarmPool({ active = this.warmPoolActive, ok = null, error = null } = {}) {
    this.warmPoolActive = active;
    this.lastWarmPoolAt = nowIso();
    this.lastWarmPoolError = ok === false ? error?.message || String(error || "") : null;
  }

  getAverageLatency() {
    if (this.latencies.length === 0) return 0;
    const total = this.latencies.reduce((sum, value) => sum + value, 0);
    return Math.round(total / this.latencies.length);
  }

  async pollOllamaMemory() {
    if (process.platform === "win32") {
      return this.pollWindowsOllamaMemory();
    }

    return this.pollPosixOllamaMemory();
  }

  pollWindowsOllamaMemory() {
    return new Promise((resolve) => {
      execFile("tasklist", ["/FO", "CSV", "/NH"], { timeout: 2500 }, (error, stdout) => {
        if (error) {
          this.ollamaMemory = {
            ...this.ollamaMemory,
            available: false,
            checked_at: nowIso(),
            error: error.message,
          };
          resolve(this.ollamaMemory);
          return;
        }

        let rssKb = 0;
        let processCount = 0;
        for (const line of String(stdout || "").split(/\r?\n/)) {
          if (!line.trim()) continue;
          const values = parseWindowsCsvLine(line);
          const imageName = String(values[0] || "").toLowerCase().replace(/\.exe$/, "");
          if (!PROCESS_NAMES.some((name) => imageName.includes(name))) continue;
          rssKb += parseKb(values[4]);
          processCount += 1;
        }

        this.ollamaMemory = {
          available: true,
          rss_bytes: rssKb * 1024,
          rss_mb: Math.round((rssKb / 1024) * 10) / 10,
          process_count: processCount,
          checked_at: nowIso(),
          error: null,
        };
        resolve(this.ollamaMemory);
      });
    });
  }

  pollPosixOllamaMemory() {
    return new Promise((resolve) => {
      execFile("ps", ["-eo", "comm,rss"], { timeout: 2500 }, (error, stdout) => {
        if (error) {
          this.ollamaMemory = {
            ...this.ollamaMemory,
            available: false,
            checked_at: nowIso(),
            error: error.message,
          };
          resolve(this.ollamaMemory);
          return;
        }

        let rssKb = 0;
        let processCount = 0;
        for (const line of String(stdout || "").split(/\r?\n/).slice(1)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parts = trimmed.split(/\s+/);
          const rss = parseKb(parts.pop());
          const command = parts.join(" ").toLowerCase();
          if (!PROCESS_NAMES.some((name) => command.includes(name))) continue;
          rssKb += rss;
          processCount += 1;
        }

        this.ollamaMemory = {
          available: true,
          rss_bytes: rssKb * 1024,
          rss_mb: Math.round((rssKb / 1024) * 10) / 10,
          process_count: processCount,
          checked_at: nowIso(),
          error: null,
        };
        resolve(this.ollamaMemory);
      });
    });
  }

  getStatus() {
    return {
      gemma_memory_pressure: this.getMemoryPressure(),
      gemma_queue_depth: this.queueDepth,
      gemma_active_requests: this.activeRequests,
      gemma_context_size: this.lastContextSize,
      gemma_prompt_tokens: this.lastPromptTokens,
      gemma_output_tokens: this.lastOutputTokens,
      gemma_num_predict: this.lastNumPredict,
      prompt_truncated: this.lastPromptTruncated,
      prompt_truncations: this.promptTruncations,
      warm_pool_active: this.warmPoolActive,
      warm_pool_last_run_at: this.lastWarmPoolAt,
      warm_pool_last_error: this.lastWarmPoolError,
      avg_generation_latency: this.getAverageLatency(),
      overload_retries: this.overloadRetries,
      total_retries: this.totalRetries,
      retry_counts: { ...this.retryCounts },
      failure_counts: { ...this.failureCounts },
      last_failure: this.lastFailure,
      last_success_at: this.lastSuccessAt,
      process_memory: this.getProcessMemory(),
      ollama_memory: { ...this.ollamaMemory },
    };
  }
}

export const gemmaTelemetryService = new GemmaTelemetryService();

export function getGemmaTelemetrySnapshot() {
  return gemmaTelemetryService.getStatus();
}

export default gemmaTelemetryService;
