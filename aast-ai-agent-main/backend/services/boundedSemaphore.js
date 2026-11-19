export class SemaphoreAcquireTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`Semaphore acquisition exceeded ${timeoutMs}ms`);
    this.name = "SemaphoreAcquireTimeoutError";
    this.code = "SEMAPHORE_ACQUIRE_TIMEOUT";
    this.timeoutMs = timeoutMs;
  }
}

function createAbortError() {
  const error = new Error("Semaphore acquisition was aborted");
  error.name = "AbortError";
  error.code = "SEMAPHORE_ACQUIRE_ABORTED";
  return error;
}

export function createBoundedSemaphore(
  max,
  {
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  } = {}
) {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError("Semaphore capacity must be a positive integer");
  }

  let active = 0;
  const queue = [];

  const removeWaiter = (waiter) => {
    const index = queue.indexOf(waiter);
    if (index >= 0) queue.splice(index, 1);
  };

  const settleWaiter = (waiter, settle, value) => {
    if (waiter.settled) return false;
    waiter.settled = true;

    if (waiter.timer) clearTimeoutFn(waiter.timer);
    if (waiter.signal && waiter.abortHandler) {
      waiter.signal.removeEventListener("abort", waiter.abortHandler);
    }

    settle(value);
    return true;
  };

  const grantQueuedWaiters = () => {
    while (active < max && queue.length > 0) {
      const waiter = queue.shift();
      if (waiter.settled) continue;

      active += 1;
      settleWaiter(waiter, waiter.resolve);
    }
  };

  return {
    acquire({ timeoutMs, signal } = {}) {
      if (signal?.aborted) return Promise.reject(createAbortError());

      if (active < max) {
        active += 1;
        return Promise.resolve();
      }

      const hasTimeout = timeoutMs !== undefined;
      if (hasTimeout && (!Number.isFinite(timeoutMs) || timeoutMs < 0)) {
        return Promise.reject(new RangeError("Semaphore timeout must be a non-negative finite number"));
      }

      if (timeoutMs === 0) {
        return Promise.reject(new SemaphoreAcquireTimeoutError(0));
      }

      return new Promise((resolve, reject) => {
        const waiter = {
          resolve,
          reject,
          signal,
          abortHandler: null,
          timer: null,
          settled: false,
        };

        const rejectAndRemove = (error) => {
          removeWaiter(waiter);
          settleWaiter(waiter, reject, error);
        };

        queue.push(waiter);

        if (hasTimeout) {
          waiter.timer = setTimeoutFn(
            () => rejectAndRemove(new SemaphoreAcquireTimeoutError(timeoutMs)),
            timeoutMs
          );
        }

        if (signal) {
          waiter.abortHandler = () => rejectAndRemove(createAbortError());
          signal.addEventListener("abort", waiter.abortHandler, { once: true });
          if (signal.aborted) waiter.abortHandler();
        }
      });
    },

    release() {
      if (active < 1) {
        throw new Error("Semaphore release called without an active acquisition");
      }

      active -= 1;
      grantQueuedWaiters();
    },

    get active() {
      return active;
    },

    get pending() {
      return queue.length;
    },
  };
}

export async function acquireBeforeDeadline(
  semaphore,
  {
    deadlineAt,
    maxWaitMs = Number.POSITIVE_INFINITY,
    signal,
    now = Date.now,
  }
) {
  const startedAt = now();
  const remainingBeforeAcquire = deadlineAt - startedAt;
  const configuredWait = Number.isFinite(maxWaitMs)
    ? Math.max(0, maxWaitMs)
    : remainingBeforeAcquire;
  const acquisitionBudgetMs = Math.max(0, Math.min(remainingBeforeAcquire, configuredWait));

  if (remainingBeforeAcquire <= 0) {
    throw new SemaphoreAcquireTimeoutError(0);
  }

  await semaphore.acquire({ timeoutMs: acquisitionBudgetMs, signal });

  const acquiredAt = now();
  const remainingMs = deadlineAt - acquiredAt;
  if (remainingMs <= 0) {
    semaphore.release();
    throw new SemaphoreAcquireTimeoutError(acquisitionBudgetMs);
  }

  return {
    acquisitionBudgetMs,
    remainingMs,
    waitedMs: Math.max(0, acquiredAt - startedAt),
  };
}

/**
 * Acquire capacity before a shared deadline and retain that capacity until the
 * real operation settles. Racing this promise against a stage timeout cannot
 * release the lease while abandoned work still consumes the subsystem.
 */
export async function runWithRetainedSemaphoreLease(
  semaphore,
  operation,
  {
    deadlineAt,
    maxWaitMs = Number.POSITIVE_INFINITY,
    signal,
    now = Date.now,
  } = {}
) {
  if (typeof operation !== "function") {
    throw new TypeError("Semaphore operation must be a function");
  }

  const effectiveDeadline = Number.isFinite(deadlineAt)
    ? deadlineAt
    : Number.MAX_SAFE_INTEGER;
  const acquisition = await acquireBeforeDeadline(semaphore, {
    deadlineAt: effectiveDeadline,
    maxWaitMs,
    signal,
    now,
  });

  try {
    if (signal?.aborted) throw createAbortError();
    return await operation(acquisition);
  } finally {
    semaphore.release();
  }
}
