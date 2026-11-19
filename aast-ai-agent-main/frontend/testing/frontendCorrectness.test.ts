import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  ADVISOR_REQUEST_TIMEOUT_MS,
  AdvisorRequestCoordinator,
  ConversationLoadGate,
  askAgent,
  getResponseConversationId,
} from "../src/services/agentService.ts";
import {
  DEFAULT_TIMEOUT_MS,
  HttpRequestCancelledError,
  HttpTimeoutError,
  fetchAndConsumeWithTimeout,
  fetchWithTimeout,
} from "../src/services/httpClient.ts";
import {
  MAX_LOCAL_CHAT_HISTORY_MESSAGES,
  retainLocalHistory,
} from "../src/services/backendService.ts";

class MemoryStorage implements Storage {
  #values = new Map<string, string>();

  get length() {
    return this.#values.size;
  }

  clear() {
    this.#values.clear();
  }

  getItem(key: string) {
    return this.#values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.#values.delete(key);
  }

  setItem(key: string, value: string) {
    this.#values.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: new MemoryStorage(),
});
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: new MemoryStorage(),
});

test("a response is current only for its originating conversation", () => {
  const coordinator = new AdvisorRequestCoordinator();
  const request = coordinator.begin("conversation-a");

  assert.equal(coordinator.isCurrent(request, "conversation-a"), true);
  assert.equal(coordinator.isCurrent(request, "conversation-b"), false);

  coordinator.cancel();
  assert.equal(request.controller.signal.aborted, true);
  assert.equal(coordinator.isCurrent(request, "conversation-a"), false);
});

test("a newer request supersedes and cancels the older request", () => {
  const coordinator = new AdvisorRequestCoordinator();
  const older = coordinator.begin("conversation-a");
  const newer = coordinator.begin("conversation-a");

  assert.equal(older.controller.signal.aborted, true);
  assert.equal(coordinator.isCurrent(older, "conversation-a"), false);
  assert.equal(coordinator.isCurrent(newer, "conversation-a"), true);
});

test("the interim advisor deadline stays below the current proxy ceiling", () => {
  assert.ok(ADVISOR_REQUEST_TIMEOUT_MS > DEFAULT_TIMEOUT_MS);
  assert.equal(ADVISOR_REQUEST_TIMEOUT_MS, 55_000);
  assert.ok(ADVISOR_REQUEST_TIMEOUT_MS < 60_000);
});

test("first-response CID adoption cancels stale loading and defers one automatic reload", async () => {
  let resolveLoad!: () => void;
  const controlledLoad = new Promise<void>((resolve) => {
    resolveLoad = resolve;
  });
  const loadCoordinator = new AdvisorRequestCoordinator();
  const loadGate = new ConversationLoadGate();
  const load = loadCoordinator.begin("server-cid");
  const staleLoadWouldApply = controlledLoad.then(() =>
    loadCoordinator.isCurrent(load, "server-cid")
  );

  loadCoordinator.cancel();
  loadGate.deferNextAutomaticLoad("server-cid");
  resolveLoad();

  assert.equal(await staleLoadWouldApply, false);
  assert.equal(load.controller.signal.aborted, true);
  assert.equal(loadGate.shouldLoad("server-cid"), false);
  assert.equal(loadGate.shouldLoad("server-cid"), true);
});

test("caller cancellation remains distinct from a request timeout", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const rejectAbort = () => reject(new DOMException("Aborted", "AbortError"));
      if (init?.signal?.aborted) rejectAbort();
      else init?.signal?.addEventListener("abort", rejectAbort, { once: true });
    })) as typeof fetch;

  try {
    const controller = new AbortController();
    const pending = fetchWithTimeout("http://advisor.test/query", {
      signal: controller.signal,
    }, 1_000);

    controller.abort();
    await assert.rejects(pending, HttpRequestCancelledError);

    await assert.rejects(
      fetchWithTimeout("http://advisor.test/query", {}, 1),
      HttpTimeoutError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("deadline and cancellation remain active while consuming the response body", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: () => new Promise((_resolve, reject) => {
      const rejectAbort = () => reject(new DOMException("Aborted", "AbortError"));
      if (init?.signal?.aborted) rejectAbort();
      else init?.signal?.addEventListener("abort", rejectAbort, { once: true });
    }),
  }) as Response) as typeof fetch;

  try {
    await assert.rejects(
      fetchAndConsumeWithTimeout(
        "http://advisor.test/slow-body",
        {},
        (response) => response.json(),
        1,
      ),
      HttpTimeoutError,
    );

    const controller = new AbortController();
    const pending = fetchAndConsumeWithTimeout(
      "http://advisor.test/cancelled-body",
      { signal: controller.signal },
      (response) => response.json(),
      1_000,
    );
    controller.abort();
    await assert.rejects(pending, HttpRequestCancelledError);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("production services cannot consume bodies after fetchWithTimeout returns", () => {
  const sourceRoot = join(process.cwd(), "src");
  const unsafeCallSites: string[] = [];

  const inspectDirectory = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        inspectDirectory(path);
        continue;
      }
      if (!/\.(?:ts|tsx)$/.test(entry.name) || path.endsWith("httpClient.ts")) continue;
      if (/\bfetchWithTimeout\s*\(/.test(readFileSync(path, "utf8"))) unsafeCallSites.push(path);
    }
  };

  inspectDirectory(sourceRoot);
  assert.deepEqual(
    unsafeCallSites,
    [],
    "body-consuming services must use fetchAndConsumeWithTimeout",
  );
});

test("the second advisor turn sends the CID returned by the first response", async () => {
  const originalFetch = globalThis.fetch;
  const requestBodies: Array<Record<string, unknown>> = [];
  let responseNumber = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestBodies.push(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
    responseNumber += 1;
    const payload = responseNumber === 1
      ? { answer: "First answer", cid: "server-cid" }
      : { answer: "Follow-up answer", cid: "server-cid" };
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    } as Response;
  }) as typeof fetch;

  try {
    const firstResponse = await askAgent("first question", null);
    const cid = getResponseConversationId(firstResponse);
    assert.equal(cid, "server-cid");

    await askAgent("follow-up question", cid);
    assert.equal(Object.hasOwn(requestBodies[0], "cid"), false);
    assert.equal(requestBodies[1].cid, "server-cid");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("local fallback history retains only the newest bounded messages", () => {
  const history = Array.from(
    { length: MAX_LOCAL_CHAT_HISTORY_MESSAGES + 5 },
    (_unused, index) => index,
  );

  const retained = retainLocalHistory(history);
  assert.equal(retained.length, MAX_LOCAL_CHAT_HISTORY_MESSAGES);
  assert.deepEqual(retained, history.slice(-MAX_LOCAL_CHAT_HISTORY_MESSAGES));
});
