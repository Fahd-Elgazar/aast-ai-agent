import fetch from "node-fetch";


const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "nomic-embed-text";
const DEFAULT_TIMEOUT_MS = 90_000;

export class KgEmbeddingReadinessError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "KgEmbeddingReadinessError";
    this.code = code;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getKgEmbeddingReadinessConfig(env = process.env) {
  return {
    baseUrl: String(env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    model: String(env.KG_EMBED_MODEL || DEFAULT_MODEL).trim(),
    timeoutMs: positiveInteger(env.KG_EMBED_STARTUP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

export function isRequiredModelInstalled(models, requiredModel) {
  const required = String(requiredModel || "").trim();
  if (!required) return false;

  const acceptedNames = required.includes(":")
    ? new Set([required])
    : new Set([required, `${required}:latest`]);

  return (Array.isArray(models) ? models : []).some((entry) => {
    const name = typeof entry === "string" ? entry : entry?.name || entry?.model;
    return acceptedNames.has(String(name || "").trim());
  });
}

async function requestJsonWithinDeadline({
  url,
  options,
  deadlineAt,
  fetchImpl,
  now,
  failureCode,
  operation,
}) {
  const remainingMs = deadlineAt - now();
  if (remainingMs <= 0) {
    throw new KgEmbeddingReadinessError(
      "KG_EMBED_STARTUP_TIMEOUT",
      `KG embedding ${operation} exceeded the startup deadline`
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remainingMs);

  try {
    const response = await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response?.ok) {
      throw new KgEmbeddingReadinessError(
        failureCode,
        `KG embedding ${operation} returned HTTP ${response?.status ?? "unknown"}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof KgEmbeddingReadinessError) throw error;
    if (error?.name === "AbortError") {
      throw new KgEmbeddingReadinessError(
        "KG_EMBED_STARTUP_TIMEOUT",
        `KG embedding ${operation} exceeded the startup deadline`,
        { cause: error }
      );
    }

    throw new KgEmbeddingReadinessError(
      failureCode,
      `KG embedding ${operation} failed: ${error?.message || String(error)}`,
      { cause: error }
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyKgEmbeddingReadiness({
  baseUrl = DEFAULT_BASE_URL,
  model = DEFAULT_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, "");
  const requiredModel = String(model).trim();
  const boundedTimeoutMs = positiveInteger(timeoutMs, DEFAULT_TIMEOUT_MS);
  const startedAt = now();
  const deadlineAt = startedAt + boundedTimeoutMs;

  if (!requiredModel) {
    throw new KgEmbeddingReadinessError(
      "KG_EMBED_MODEL_INVALID",
      "KG_EMBED_MODEL must name a required Ollama embedding model"
    );
  }

  const tags = await requestJsonWithinDeadline({
    url: `${normalizedBaseUrl}/api/tags`,
    options: { method: "GET" },
    deadlineAt,
    fetchImpl,
    now,
    failureCode: "KG_EMBED_MODEL_LIST_FAILED",
    operation: "model inventory check",
  });

  if (!isRequiredModelInstalled(tags?.models, requiredModel)) {
    throw new KgEmbeddingReadinessError(
      "KG_EMBED_MODEL_MISSING",
      `Required KG embedding model '${requiredModel}' is not installed. Run: ollama pull ${requiredModel}`
    );
  }

  const warmup = await requestJsonWithinDeadline({
    url: `${normalizedBaseUrl}/api/embeddings`,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: requiredModel, prompt: "warmup" }),
    },
    deadlineAt,
    fetchImpl,
    now,
    failureCode: "KG_EMBED_PREWARM_FAILED",
    operation: "prewarm",
  });

  if (
    !Array.isArray(warmup?.embedding) ||
    warmup.embedding.length === 0 ||
    warmup.embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new KgEmbeddingReadinessError(
      "KG_EMBED_INVALID_VECTOR",
      `KG embedding prewarm for '${requiredModel}' returned an invalid vector`
    );
  }

  return {
    baseUrl: normalizedBaseUrl,
    model: requiredModel,
    dimensions: warmup.embedding.length,
    durationMs: Math.max(0, now() - startedAt),
  };
}

export function verifyKgEmbeddingReadinessFromEnv(options = {}) {
  return verifyKgEmbeddingReadiness({
    ...getKgEmbeddingReadinessConfig(options.env),
    ...options,
  });
}

/* ============================================================
  CLA-WOW-001 — EMBEDDING DIVERSITY GUARD
  The live KG can hold many embedded nodes that collapse to a
  handful of vector signatures. Exact intents must not depend on
  such a degenerate semantic pool, so callers can quarantine
  semantic retrieval when diversity is invalid.
============================================================ */

export function vectorSignature(vector, precision = 5) {
  if (!Array.isArray(vector) || vector.length === 0) return "";
  const factor = 10 ** precision;
  return vector
    .map((value) => (Number.isFinite(value) ? Math.round(value * factor) / factor : "x"))
    .join(",");
}

export function evaluateEmbeddingDiversity(vectors, { minDistinct = 8, minDistinctRatio = 0.15 } = {}) {
  const list = Array.isArray(vectors)
    ? vectors.filter((vector) => Array.isArray(vector) && vector.length > 0)
    : [];
  const nodeCount = list.length;
  const distinctSignatures = new Set(list.map((vector) => vectorSignature(vector))).size;
  const distinctRatio = nodeCount > 0 ? distinctSignatures / nodeCount : 0;

  let valid = true;
  let reason = "OK";
  if (nodeCount === 0) {
    valid = false;
    reason = "NO_VECTORS";
  } else if (distinctSignatures < Math.min(minDistinct, nodeCount) && distinctRatio < minDistinctRatio) {
    // Clearly degenerate: few distinct signatures both in absolute terms and
    // relative to the pool (e.g. 91 embedded nodes, 4 signatures).
    valid = false;
    reason = "LOW_DIVERSITY";
  }

  return { nodeCount, distinctSignatures, distinctRatio, valid, reason };
}

export function shouldQuarantineSemanticRetrieval({ isExactIntent = false, diversity = null } = {}) {
  if (!isExactIntent || !diversity) return false;
  return diversity.valid === false;
}
