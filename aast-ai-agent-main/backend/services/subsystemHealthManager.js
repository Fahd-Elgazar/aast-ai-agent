export const DEFAULT_HEALTH_SUBSYSTEMS = Object.freeze([
  "kg",
  "rag",
  "decision",
  "career",
  "faq",
  "llm",
]);

function callHook(hook, ...args) {
  try {
    hook?.(...args);
  } catch {
    // Health reporting must not fail because telemetry or logging failed.
  }
}

function normalizeNonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Owns the observable subsystem-health state and its freshness contract.
 * A routing read may reuse only a fresh observed snapshot. Cold or expired
 * state always starts one shared probe cycle; no optimistic state is invented.
 */
export function createSubsystemHealthManager({
  subsystems = DEFAULT_HEALTH_SUBSYSTEMS,
  cacheTtlMs = 15_000,
  failureThreshold = 2,
  now = () => Date.now(),
  probe,
  onProbeFailure,
  onTransitions,
  onProbeError,
} = {}) {
  if (typeof probe !== "function") {
    throw new TypeError("createSubsystemHealthManager requires a probe function");
  }

  const subsystemNames = [...new Set(subsystems)];
  const ttlMs = normalizeNonNegativeNumber(cacheTtlMs, 15_000);
  const threshold = Math.max(1, Math.floor(normalizeNonNegativeNumber(failureThreshold, 2)));
  const cachedHealth = Object.fromEntries(subsystemNames.map(name => [name, false]));
  const consecutiveFailures = Object.fromEntries(subsystemNames.map(name => [name, 0]));

  let lastObservedAt = null;
  let refreshInFlight = null;

  function getSnapshot() {
    return { ...cachedHealth };
  }

  function getCacheAge() {
    if (lastObservedAt === null) return Infinity;
    return Math.max(0, Number(now()) - lastObservedAt);
  }

  function isFresh() {
    return lastObservedAt !== null && getCacheAge() < ttlMs;
  }

  function getMetadata() {
    return {
      observed: lastObservedAt !== null,
      observedAt: lastObservedAt,
      ageMs: getCacheAge(),
      fresh: isFresh(),
      refreshInFlight: refreshInFlight !== null,
    };
  }

  function applyProbeResults(rawResults) {
    const transitions = [];

    for (const name of subsystemNames) {
      const probeOk = rawResults?.[name] === true;

      if (probeOk) {
        if (!cachedHealth[name]) transitions.push(`${name}:UP`);
        cachedHealth[name] = true;
        consecutiveFailures[name] = 0;
      } else {
        consecutiveFailures[name] += 1;
        callHook(onProbeFailure, name, consecutiveFailures[name]);

        if (consecutiveFailures[name] >= threshold && cachedHealth[name]) {
          cachedHealth[name] = false;
          transitions.push(
            `${name}:DOWN(after ${consecutiveFailures[name]} consecutive failures)`
          );
        }
      }
    }

    lastObservedAt = Number(now());
    if (transitions.length > 0) callHook(onTransitions, [...transitions]);
    return getSnapshot();
  }

  async function runRefresh() {
    let rawResults;
    try {
      rawResults = await probe();
    } catch (error) {
      callHook(onProbeError, error);
      rawResults = Object.fromEntries(subsystemNames.map(name => [name, false]));
    }
    return applyProbeResults(rawResults);
  }

  async function readAuthoritative(options = {}) {
    const forceRefresh = options?.forceRefresh === true;
    if (!forceRefresh && isFresh()) return getSnapshot();

    if (!refreshInFlight) {
      refreshInFlight = runRefresh().finally(() => {
        refreshInFlight = null;
      });
    }

    await refreshInFlight;
    return getSnapshot();
  }

  return Object.freeze({
    getCacheAge,
    getMetadata,
    getSnapshot,
    isFresh,
    readAuthoritative,
  });
}
