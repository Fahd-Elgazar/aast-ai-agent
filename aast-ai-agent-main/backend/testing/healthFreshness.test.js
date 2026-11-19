import assert from "node:assert/strict";

import { classifyGoldenQuery } from "../config/goldenPathRegistry.js";
import { normalizeAcademicQuery } from "../services/academicQueryNormalizer.js";
import brainRouter from "../services/brainRouter.js";
import { createSubsystemHealthManager } from "../services/subsystemHealthManager.js";


const HEALTHY = {
  kg: true,
  rag: true,
  decision: true,
  career: true,
  faq: true,
  llm: true,
};

const UNHEALTHY = {
  kg: false,
  rag: false,
  decision: false,
  career: false,
  faq: false,
  llm: false,
};

async function testColdStartCannotInventOptimisticHealth() {
  let now = 1_000;
  let probeCalls = 0;
  const observedHealth = {
    ...UNHEALTHY,
    faq: true,
    llm: true,
  };
  const manager = createSubsystemHealthManager({
    cacheTtlMs: 100,
    failureThreshold: 1,
    now: () => now,
    probe: async () => {
      probeCalls += 1;
      return observedHealth;
    },
  });

  assert.deepEqual(manager.getSnapshot(), UNHEALTHY);
  assert.equal(manager.getMetadata().observed, false);

  // Legacy flags are deliberately ignored: a cold routing read must probe.
  const health = await manager.readAuthoritative({ fast: true, optimistic: true });
  assert.equal(probeCalls, 1);
  assert.deepEqual(health, observedHealth);
  assert.deepEqual(manager.getMetadata(), {
    observed: true,
    observedAt: now,
    ageMs: 0,
    fresh: true,
    refreshInFlight: false,
  });

  const normalization = normalizeAcademicQuery("who teaches NLP");
  const query = normalization.normalized;
  const golden = classifyGoldenQuery(query);
  assert.equal(golden?.id, "golden_hany_teaches");

  const analysis = brainRouter.analyzeQuery(
    { query, intent: "GENERAL", normalization },
    "GENERAL",
    { lastRoute: null }
  );
  const decision = brainRouter.determineBestRoute(analysis, health);
  assert.equal(decision.route, "FAQ");
  assert.equal(decision.degraded_reason, "KG_UNHEALTHY_GOLDEN_DEGRADE");

  now += 1;
}

async function testFreshCacheIsReusedAndExpiredCacheRefreshes() {
  let now = 2_000;
  let probeCalls = 0;
  const probeResults = [HEALTHY, UNHEALTHY];
  const manager = createSubsystemHealthManager({
    cacheTtlMs: 100,
    failureThreshold: 1,
    now: () => now,
    probe: async () => probeResults[probeCalls++],
  });

  assert.deepEqual(await manager.readAuthoritative(), HEALTHY);
  assert.equal(probeCalls, 1);

  now = 2_099;
  assert.deepEqual(
    await manager.readAuthoritative({ fast: true, optimistic: true }),
    HEALTHY
  );
  assert.equal(probeCalls, 1, "fresh observed state should not be re-probed");

  now = 2_100;
  assert.deepEqual(
    await manager.readAuthoritative({ fast: true, optimistic: true }),
    UNHEALTHY
  );
  assert.equal(probeCalls, 2, "expired state must trigger a probe");
}

async function testConcurrentExpiredReadsShareOneProbe() {
  let now = 3_000;
  let probeCalls = 0;
  let releaseProbe;
  const pendingProbe = new Promise(resolve => {
    releaseProbe = resolve;
  });
  const manager = createSubsystemHealthManager({
    cacheTtlMs: 100,
    failureThreshold: 1,
    now: () => now,
    probe: async () => {
      probeCalls += 1;
      return pendingProbe;
    },
  });

  const first = manager.readAuthoritative();
  const second = manager.readAuthoritative();
  await Promise.resolve();
  assert.equal(probeCalls, 1);

  releaseProbe(HEALTHY);
  assert.deepEqual(await first, HEALTHY);
  assert.deepEqual(await second, HEALTHY);
  assert.equal(probeCalls, 1);

  now += 1;
}

async function testHysteresisUsesFreshFailureObservations() {
  let now = 4_000;
  let probeCalls = 0;
  const probeResults = [HEALTHY, UNHEALTHY, UNHEALTHY];
  const manager = createSubsystemHealthManager({
    cacheTtlMs: 10,
    failureThreshold: 2,
    now: () => now,
    probe: async () => probeResults[probeCalls++],
  });

  assert.deepEqual(await manager.readAuthoritative(), HEALTHY);

  now = 4_010;
  assert.deepEqual(await manager.readAuthoritative(), HEALTHY);
  assert.equal(probeCalls, 2);
  assert.equal(manager.getMetadata().fresh, true);

  now = 4_020;
  assert.deepEqual(await manager.readAuthoritative(), UNHEALTHY);
  assert.equal(probeCalls, 3);
}

async function testProbeCycleErrorFailsClosedWithObservedState() {
  let probeErrors = 0;
  const manager = createSubsystemHealthManager({
    cacheTtlMs: 100,
    failureThreshold: 1,
    now: () => 5_000,
    probe: async () => {
      throw new Error("synthetic probe failure");
    },
    onProbeError: error => {
      probeErrors += 1;
      assert.equal(error.message, "synthetic probe failure");
    },
  });

  assert.deepEqual(await manager.readAuthoritative(), UNHEALTHY);
  assert.equal(probeErrors, 1);
  assert.equal(manager.getMetadata().observed, true);
  assert.equal(manager.getMetadata().fresh, true);
}

await testColdStartCannotInventOptimisticHealth();
await testFreshCacheIsReusedAndExpiredCacheRefreshes();
await testConcurrentExpiredReadsShareOneProbe();
await testHysteresisUsesFreshFailureObservations();
await testProbeCycleErrorFailsClosedWithObservedState();

console.log("healthFreshness.test.js passed 5 authoritative health-state scenarios.");
