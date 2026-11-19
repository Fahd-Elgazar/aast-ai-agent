import { verifyKgEmbeddingReadinessFromEnv } from "../services/kgEmbeddingReadiness.js";


try {
  const readiness = await verifyKgEmbeddingReadinessFromEnv();
  console.log(
    `[KG_EMBED_STARTUP] READY model=${readiness.model} dimensions=${readiness.dimensions} durationMs=${readiness.durationMs}`
  );
} catch (error) {
  console.error(
    `[KG_EMBED_STARTUP] FAIL code=${error?.code || "KG_EMBED_STARTUP_FAILED"} error="${error?.message || String(error)}"`
  );
  process.exitCode = 1;
}
