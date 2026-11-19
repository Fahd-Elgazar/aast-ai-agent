import assert from "node:assert/strict";

import {
  buildGoldenFallbackPayload,
  classifyGoldenQuery,
} from "../config/goldenPathRegistry.js";

const deanQuery = "Who is the dean of artificial intelligence?";
const match = classifyGoldenQuery(deanQuery);

assert.ok(match, "fixture must match a deterministic route policy");
assert.ok(match.fallback, "fixture must exercise a legacy static fallback entry");
assert.equal(
  buildGoldenFallbackPayload(match, {
    routeOverride: "KG_DIRECT",
    reason: "KG_EMPTY",
  }),
  null,
  "a route match must never become factual evidence when live retrieval is empty"
);
assert.equal(
  buildGoldenFallbackPayload(match, {
    routeOverride: "KG_DIRECT",
    reason: "FATAL_GOLDEN_STATIC_FALLBACK",
  }),
  null,
  "fatal execution must not resurrect named academic facts from registry text"
);

console.log("Fallback truth contract passed: static golden facts cannot be emitted without retrieved evidence.");
