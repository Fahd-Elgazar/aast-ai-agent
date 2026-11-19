import assert from "node:assert/strict";

import {
  acquireBeforeDeadline,
  createBoundedSemaphore,
  runWithRetainedSemaphoreLease,
  SemaphoreAcquireTimeoutError,
} from "../services/boundedSemaphore.js";
import {
  isRequiredModelInstalled,
  KgEmbeddingReadinessError,
  verifyKgEmbeddingReadiness,
} from "../services/kgEmbeddingReadiness.js";


function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

async function waitFor(predicate, timeoutMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for test condition");
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function testLatestAliasAndColdPrewarmGate() {
  let resolveWarmup;
  let readinessSettled = false;
  const calls = [];

  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/api/tags")) {
      return jsonResponse({ models: [{ name: "nomic-embed-text:latest" }] });
    }

    return new Promise((resolve) => {
      resolveWarmup = () => resolve(jsonResponse({ embedding: [0.1, 0.2, 0.3] }));
    });
  };

  const readinessPromise = verifyKgEmbeddingReadiness({
    baseUrl: "http://ollama:11434/",
    model: "nomic-embed-text",
    timeoutMs: 1_000,
    fetchImpl,
  });
  readinessPromise.then(() => {
    readinessSettled = true;
  });

  await waitFor(() => typeof resolveWarmup === "function");
  assert.equal(readinessSettled, false, "startup must wait for cold-model prewarm completion");
  resolveWarmup();

  const readiness = await readinessPromise;
  assert.equal(readiness.model, "nomic-embed-text");
  assert.equal(readiness.dimensions, 3);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "http://ollama:11434/api/embeddings");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    model: "nomic-embed-text",
    prompt: "warmup",
  });
}

async function testMissingModelFailsBeforePrewarm() {
  let embeddingCalls = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/api/tags")) {
      return jsonResponse({ models: [{ name: "gemma4:e2b" }] });
    }
    embeddingCalls += 1;
    return jsonResponse({ embedding: [0.1] });
  };

  await assert.rejects(
    verifyKgEmbeddingReadiness({
      model: "nomic-embed-text",
      fetchImpl,
    }),
    (error) => {
      assert.ok(error instanceof KgEmbeddingReadinessError);
      assert.equal(error.code, "KG_EMBED_MODEL_MISSING");
      assert.match(error.message, /ollama pull nomic-embed-text/);
      return true;
    }
  );
  assert.equal(embeddingCalls, 0, "a missing model must not attempt prewarm");
}

async function testPrewarmTimeoutFailsClosed() {
  const fetchImpl = async (url, options = {}) => {
    if (url.endsWith("/api/tags")) {
      return jsonResponse({ models: [{ name: "nomic-embed-text:latest" }] });
    }

    return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    });
  };

  await assert.rejects(
    verifyKgEmbeddingReadiness({ timeoutMs: 25, fetchImpl }),
    (error) => {
      assert.ok(error instanceof KgEmbeddingReadinessError);
      assert.equal(error.code, "KG_EMBED_STARTUP_TIMEOUT");
      return true;
    }
  );
}

async function testModelTagMatchingIsConservative() {
  const models = [{ name: "nomic-embed-text:latest" }, { model: "gemma4:e2b" }];
  assert.equal(isRequiredModelInstalled(models, "nomic-embed-text"), true);
  assert.equal(isRequiredModelInstalled(models, "nomic-embed-text:latest"), true);
  assert.equal(isRequiredModelInstalled(models, "nomic-embed-text:v2"), false);
  assert.equal(isRequiredModelInstalled(models, "gemma4:e2b"), true);
}

async function testSaturatedSemaphoreTimesOutAndRemovesWaiter() {
  const semaphore = createBoundedSemaphore(1);
  await semaphore.acquire();

  await assert.rejects(
    acquireBeforeDeadline(semaphore, {
      deadlineAt: Date.now() + 30,
      maxWaitMs: 20,
    }),
    (error) => {
      assert.ok(error instanceof SemaphoreAcquireTimeoutError);
      assert.equal(error.code, "SEMAPHORE_ACQUIRE_TIMEOUT");
      return true;
    }
  );

  assert.equal(semaphore.active, 1);
  assert.equal(semaphore.pending, 0, "timed-out waiter must be removed from the queue");
  semaphore.release();
  assert.equal(semaphore.active, 0);
}

async function testReleasedSlotTransfersWithinSharedDeadline() {
  const semaphore = createBoundedSemaphore(1);
  await semaphore.acquire();

  const deadlineAt = Date.now() + 250;
  const queued = acquireBeforeDeadline(semaphore, {
    deadlineAt,
    maxWaitMs: 150,
  });
  assert.equal(semaphore.pending, 1);

  setTimeout(() => semaphore.release(), 15);
  const acquisition = await queued;

  assert.equal(semaphore.active, 1, "released capacity must transfer to the queued caller");
  assert.equal(semaphore.pending, 0);
  assert.ok(acquisition.remainingMs > 0);
  assert.ok(acquisition.remainingMs <= 250);
  assert.ok(acquisition.waitedMs >= 0);

  semaphore.release();
  assert.equal(semaphore.active, 0);
}

async function testTimedOutCallerCannotReleaseActiveWorkLease() {
  const semaphore = createBoundedSemaphore(1);
  let finishWork;
  const work = runWithRetainedSemaphoreLease(
    semaphore,
    () => new Promise(resolve => {
      finishWork = resolve;
    }),
    { deadlineAt: Date.now() + 250 }
  );

  await waitFor(() => typeof finishWork === "function");
  assert.equal(semaphore.active, 1);

  const callerResult = await Promise.race([
    work.then(() => "completed"),
    new Promise(resolve => setTimeout(() => resolve("timed_out"), 10)),
  ]);
  assert.equal(callerResult, "timed_out");
  assert.equal(
    semaphore.active,
    1,
    "a caller-side timeout must not release capacity while work is still active"
  );

  finishWork("done");
  assert.equal(await work, "done");
  assert.equal(semaphore.active, 0);
}

const tests = [
  testLatestAliasAndColdPrewarmGate,
  testMissingModelFailsBeforePrewarm,
  testPrewarmTimeoutFailsClosed,
  testModelTagMatchingIsConservative,
  testSaturatedSemaphoreTimesOutAndRemovesWaiter,
  testReleasedSlotTransfersWithinSharedDeadline,
  testTimedOutCallerCannotReleaseActiveWorkLease,
];

for (const test of tests) {
  await test();
}

console.log(`KG reliability tests passed (${tests.length}/${tests.length}).`);
