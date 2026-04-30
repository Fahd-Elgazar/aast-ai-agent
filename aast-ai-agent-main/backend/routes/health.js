import express from "express";
import fetch from "node-fetch";
import { getSession } from "../db/neo4j.js";
import { getDecisionMemoryStatus } from "../services/decisionService.js";
import { getMetricsSnapshot } from "../services/metrics.js";
import { logger } from "../services/logger.js";

const DEFAULT_TIMEOUT_MS = Number(process.env.HEALTH_TIMEOUT_MS || 2500);
const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const DECISION_API_URL = process.env.DECISION_API_URL || "http://127.0.0.1:8005";

function withTimeout(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout)
  };
}

async function checkNeo4j() {
  const session = getSession();
  const start = Date.now();

  try {
    await session.run("RETURN 1 AS ok");
    return {
      ok: true,
      latencyMs: Date.now() - start
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.message
    };
  } finally {
    await session.close();
  }
}

async function checkOllama() {
  const start = Date.now();
  const timeout = withTimeout();

  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: timeout.signal
    });

    return {
      ok: res.ok,
      latencyMs: Date.now() - start,
      status: res.status
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.name === "AbortError" ? "timeout" : err.message
    };
  } finally {
    timeout.clear();
  }
}

async function checkDecisionApi() {
  const start = Date.now();
  const timeout = withTimeout();

  try {
    const res = await fetch(`${DECISION_API_URL}/health`, {
      method: "GET",
      signal: timeout.signal
    });

    return {
      ok: res.ok,
      latencyMs: Date.now() - start,
      status: res.status
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.name === "AbortError" ? "timeout" : err.message
    };
  } finally {
    timeout.clear();
  }
}

export default function createHealthRouter({ getCacheStatus } = {}) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    const [neo4j, ollama, decisionApi] = await Promise.all([
      checkNeo4j(),
      checkOllama(),
      checkDecisionApi()
    ]);

    const payload = {
      ok: neo4j.ok && ollama.ok,
      timestamp: new Date().toISOString(),
      services: {
        neo4j,
        ollama,
        decisionApi
      },
      memory: {
        decision: getDecisionMemoryStatus(),
        cache: typeof getCacheStatus === "function" ? getCacheStatus() : null
      },
      metrics: getMetricsSnapshot()
    };

    logger.debug("Health check completed", {
      ok: payload.ok,
      neo4j: neo4j.ok,
      ollama: ollama.ok,
      decisionApi: decisionApi.ok
    });

    res.status(payload.ok ? 200 : 503).json(payload);
  });

  router.get("/metrics", (req, res) => {
    res.json(getMetricsSnapshot());
  });

  return router;
}
