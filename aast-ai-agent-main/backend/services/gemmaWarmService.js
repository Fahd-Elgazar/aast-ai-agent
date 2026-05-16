import { LLM_CONFIG } from "../config/llmConfig.js";
import { generateStableResponse } from "./ollamaService.js";
import { gemmaTelemetryService } from "./gemmaTelemetryService.js";
import { getGemmaLimiterSnapshot } from "./gemmaRequestLimiter.js";

function log(level, event, payload = {}) {
  const writer =
    level === "ERROR" ? console.error : level === "WARN" ? console.warn : console.log;

  writer(JSON.stringify({
    level,
    service: "GemmaWarmService",
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  }));
}

class GemmaWarmService {
  constructor(config = LLM_CONFIG) {
    this.config = config;
    this.started = false;
    this.timer = null;
    this.inFlight = false;
  }

  start() {
    if (this.started || !this.config.warmPool.enabled) {
      gemmaTelemetryService.recordWarmPool({ active: false, ok: true });
      return;
    }

    this.started = true;
    gemmaTelemetryService.recordWarmPool({ active: true, ok: true });

    const intervalWithJitter = () => {
      this.keepAlive().catch((error) => {
        log("WARN", "keepalive_unhandled_error", { error_message: error.message });
      });
    };

    this.timer = setInterval(intervalWithJitter, this.config.warmPool.intervalMs);
    this.timer.unref?.();

    setTimeout(() => {
      this.keepAlive().catch((error) => {
        log("WARN", "initial_keepalive_failed", { error_message: error.message });
      });
    }, this.config.warmPool.initialDelayMs + this.randomJitter()).unref?.();

    log("INFO", "warm_pool_started", {
      primary_model: this.config.primaryModel,
      interval_ms: this.config.warmPool.intervalMs,
      timeout_ms: this.config.warmPool.timeoutMs,
      initial_delay_ms: this.config.warmPool.initialDelayMs,
      jitter_ms: this.config.warmPool.jitterMs,
    });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
    gemmaTelemetryService.recordWarmPool({ active: false, ok: true });
  }

  async keepAlive() {
    if (this.inFlight) {
      log("INFO", "keepalive_skipped_inflight", {
        primary_model: this.config.primaryModel,
      });
      return;
    }

    const queue = getGemmaLimiterSnapshot();
    const pressure = gemmaTelemetryService.getMemoryPressure();

    if (
      this.config.warmPool.skipWhenQueueBusy &&
      (queue.active > 0 || queue.pending > 0)
    ) {
      log("INFO", "keepalive_skipped_queue_busy", {
        primary_model: this.config.primaryModel,
        active_requests: queue.active,
        pending_requests: queue.pending,
      });
      gemmaTelemetryService.recordWarmPool({ active: true, ok: true });
      return;
    }

    if (this.config.warmPool.skipWhenMemoryHigh && pressure.high) {
      log("INFO", "keepalive_skipped_memory_pressure", {
        primary_model: this.config.primaryModel,
        memory_pressure: pressure.level,
        combined_rss_mb: pressure.combined_rss_mb,
      });
      gemmaTelemetryService.recordWarmPool({ active: true, ok: true });
      return;
    }

    this.inFlight = true;
    gemmaTelemetryService.recordWarmPool({ active: true, ok: true });
    const startedAt = Date.now();

    try {
      await generateStableResponse({
        prompt: this.config.warmPool.prompt,
        model: this.config.primaryModel,
        requestId: `warm_${Date.now()}`,
        timeoutMs: this.config.warmPool.timeoutMs,
        deadlineMs: this.config.warmPool.timeoutMs,
        routeType: "WARM_POOL",
        trafficType: "warm_pool",
        allowBackup: false,
        recordFailure: false,
        options: {
          temperature: 0,
          top_p: 0.1,
          repeat_penalty: 1.05,
          num_predict: 1,
          num_ctx: Math.min(this.config.gemma.numCtx, this.config.gemma.minNumCtx),
        },
      });

      gemmaTelemetryService.recordWarmPool({ active: true, ok: true });
      log("INFO", "keepalive_success", {
        primary_model: this.config.primaryModel,
        latency_ms: Date.now() - startedAt,
      });
    } catch (error) {
      gemmaTelemetryService.recordWarmPool({ active: true, ok: false, error });
      log("WARN", "keepalive_failed_non_fatal", {
        primary_model: this.config.primaryModel,
        latency_ms: Date.now() - startedAt,
        error_message: error.message,
      });
    } finally {
      this.inFlight = false;
    }
  }

  getStatus() {
    return {
      started: this.started,
      in_flight: this.inFlight,
      enabled: this.config.warmPool.enabled,
      interval_ms: this.config.warmPool.intervalMs,
      timeout_ms: this.config.warmPool.timeoutMs,
      initial_delay_ms: this.config.warmPool.initialDelayMs,
      jitter_ms: this.config.warmPool.jitterMs,
      skip_when_queue_busy: this.config.warmPool.skipWhenQueueBusy,
      skip_when_memory_high: this.config.warmPool.skipWhenMemoryHigh,
    };
  }

  randomJitter() {
    if (!this.config.warmPool.jitterMs) return 0;
    return Math.floor(Math.random() * this.config.warmPool.jitterMs);
  }
}

export const gemmaWarmService = new GemmaWarmService();

export default gemmaWarmService;
