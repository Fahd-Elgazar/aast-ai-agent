import { verifyKgEmbeddingReadinessFromEnv } from "../services/kgEmbeddingReadiness.js";


try {
  const readiness = await verifyKgEmbeddingReadinessFromEnv();
  console.log(
    `[KG_EMBED_STARTUP] READY model=${readiness.model} dimensions=${readiness.dimensions} durationMs=${readiness.durationMs}`
  );
  await import("../orchestrator.js");
} catch (error) {
  console.error(
    `[ORCHESTRATOR_STARTUP] FAIL code=${error?.code || "ORCHESTRATOR_STARTUP_FAILED"} error="${error?.message || String(error)}"`
  );
  process.exit(1);
}
