import { LLM_CONFIG } from "../config/llmConfig.js";
import { gemmaTelemetryService } from "./gemmaTelemetryService.js";
import { setGauge } from "./metrics.js";

function createQueueError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.retryable = true;
  error.overload = true;
  error.circuitEligible = false;
  return error;
}

class GemmaRequestLimiter {
  constructor(config = LLM_CONFIG, telemetry = gemmaTelemetryService) {
    this.config = config;
    this.telemetry = telemetry;
    this.active = 0;
    this.queue = [];
  }

  snapshot() {
    return {
      active: this.active,
      pending: this.queue.length,
      maxActive: this.config.gemma.maxActiveRequests,
      maxQueueDepth: this.config.gemma.maxQueueDepth,
    };
  }

  syncTelemetry() {
    this.telemetry.recordQueue({
      active: this.active,
      pending: this.queue.length,
    });
    setGauge("gemma_queue_depth", this.queue.length);
    setGauge("gemma_active_requests", this.active);
  }

  async run(task, metadata = {}) {
    const acquired = await this.acquire(metadata);
    const waitMs = Date.now() - acquired.enqueuedAt;

    try {
      return await task({ waitMs, queueDepthAtAcquire: acquired.queueDepthAtAcquire });
    } finally {
      this.release();
    }
  }

  acquire(metadata = {}) {
    const enqueuedAt = Date.now();

    if (this.active < this.config.gemma.maxActiveRequests) {
      this.active += 1;
      this.syncTelemetry();
      return Promise.resolve({
        enqueuedAt,
        queueDepthAtAcquire: this.queue.length,
        metadata,
      });
    }

    if (this.queue.length >= this.config.gemma.maxQueueDepth) {
      this.syncTelemetry();
      return Promise.reject(
        createQueueError(
          "GEMMA_QUEUE_OVERFLOW",
          "Gemma request queue is full; retry when active inference pressure drops."
        )
      );
    }

    return new Promise((resolve, reject) => {
      const item = {
        metadata,
        enqueuedAt,
        resolve,
        reject,
        timer: null,
      };

      item.timer = setTimeout(() => {
        const index = this.queue.indexOf(item);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        this.syncTelemetry();
        reject(
          createQueueError(
            "GEMMA_QUEUE_TIMEOUT",
            "Gemma request waited too long in the inference queue."
          )
        );
      }, this.config.gemma.queueTimeoutMs);

      item.timer.unref?.();
      this.queue.push(item);
      this.syncTelemetry();
    });
  }

  release() {
    this.active = Math.max(0, this.active - 1);

    while (this.queue.length > 0) {
      const next = this.queue.shift();
      clearTimeout(next.timer);

      this.active += 1;
      this.syncTelemetry();
      next.resolve({
        enqueuedAt: next.enqueuedAt,
        queueDepthAtAcquire: this.queue.length,
        metadata: next.metadata,
      });
      return;
    }

    this.syncTelemetry();
  }
}

export const gemmaRequestLimiter = new GemmaRequestLimiter();

export function getGemmaLimiterSnapshot() {
  return gemmaRequestLimiter.snapshot();
}

export default gemmaRequestLimiter;
