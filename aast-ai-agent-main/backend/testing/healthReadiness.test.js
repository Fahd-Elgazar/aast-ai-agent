import assert from "node:assert/strict";

import {
  areRequiredTopologyServicesReady,
  isRagHealthReady,
} from "../routes/healthReadiness.js";

assert.equal(
  isRagHealthReady({
    system_status: "HEALTHY",
    retriever: { ok: true, endpoint_valid: true },
  }),
  true,
  "a ready retriever with a valid endpoint must satisfy RAG readiness",
);

assert.equal(
  isRagHealthReady({
    system_status: "DEGRADED",
    retriever: { ok: false, endpoint_valid: false },
    answer_engine: { ok: true, endpoint_valid: true },
  }),
  false,
  "an answer service must not hide an unavailable required retriever",
);

assert.equal(
  isRagHealthReady({
    system_status: "HEALTHY",
    retriever: { ok: true, endpoint_valid: false },
  }),
  false,
  "a healthy ping must not hide a misconfigured retrieval endpoint",
);

const fullServices = {
  neo4j: "required",
  ollama: "required",
  qdrant: "required",
  ragRetriever: "required",
  ragAnswer: "optional",
  decisionApi: "required",
};
const allReady = {
  neo4j: true,
  ollama: true,
  qdrant: true,
  ragRetriever: true,
  ragAnswer: false,
  decisionApi: true,
};

assert.equal(
  areRequiredTopologyServicesReady(fullServices, allReady),
  true,
  "an unavailable optional answer service must not fail platform readiness",
);
assert.equal(
  areRequiredTopologyServicesReady(fullServices, { ...allReady, ragRetriever: false }),
  false,
  "a required RAG retriever must participate in platform readiness",
);
assert.equal(
  areRequiredTopologyServicesReady(fullServices, { ...allReady, decisionApi: false }),
  false,
  "every required topology service must participate in platform readiness",
);
assert.equal(
  areRequiredTopologyServicesReady({ qdrant: "disabled" }, { qdrant: false }),
  true,
  "disabled quick-mode services must not make the platform unready",
);

console.log("Health readiness truth tests passed.");
