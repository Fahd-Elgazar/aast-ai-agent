import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { GOLDEN_PATH_REGISTRY } from "../config/goldenPathRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL ||
  `http://localhost:${process.env.ORCHESTRATOR_PORT || 8004}/api/chatbot/query`;

const repeatsArg = process.argv.find(arg => arg.startsWith("--repeats="));
const REPEATS = Number.parseInt(repeatsArg?.split("=")[1] || process.env.GOLDEN_BENCHMARK_REPEATS || "50", 10);
const PREFERRED_LATENCY_MS = Number.parseInt(process.env.GOLDEN_PREFERRED_LATENCY_MS || "3000", 10);

function canonicalRoute(route) {
  const raw = String(route || "LLM_FALLBACK").toUpperCase();
  if (raw.includes("KG_DIRECT")) return "KG_DIRECT";
  if (raw.includes("RAG_DIRECT")) return "RAG_DIRECT";
  if (raw.includes("HYBRID")) return "HYBRID_KG_RAG";
  if (raw.includes("KG")) return "KG_DIRECT";
  if (raw.includes("RAG")) return "RAG_DIRECT";
  if (raw.includes("DECISION")) return "DECISION_ENGINE";
  if (raw.includes("CAREER")) return "CAREER_ENGINE";
  if (raw.includes("INTERACTIVE")) return "INTERACTIVE";
  if (raw.includes("FAQ")) return "FAQ";
  return "LLM_FALLBACK";
}

function routeAcceptable(expected, actual) {
  const normalizedActual = canonicalRoute(actual);
  if (expected === normalizedActual) return true;
  if (expected === "KG_DIRECT" && ["RAG_DIRECT", "FAQ"].includes(normalizedActual)) return true;
  if (expected === "RAG_DIRECT" && ["KG_DIRECT", "FAQ"].includes(normalizedActual)) return true;
  if (expected === "DECISION_ENGINE" && normalizedActual === "INTERACTIVE") return true;
  return false;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function graphFingerprint(graph) {
  const nodes = (graph?.nodes || [])
    .map(node => `${node.id || node.label}:${node.type || ""}`)
    .sort();
  const links = (graph?.links || [])
    .map(link => `${link.source}->${link.type || ""}->${link.target}`)
    .sort();
  return JSON.stringify({ nodes, links });
}

async function runOnce(entry, query, runIndex) {
  const started = Date.now();
  const res = await fetch(ORCHESTRATOR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      cid: `golden_bench_${entry.id}_${runIndex}`
    })
  });

  const data = await res.json();
  const latencyMs = Date.now() - started;

  return {
    status: res.status,
    ok: res.ok && !!data.answer,
    latency_ms: latencyMs,
    route: data.metadata?.trace?.route || data.route,
    confidence: data.confidence || 0,
    answer_chars: String(data.answer || "").length,
    graph_nodes: data.graph?.nodes?.length || 0,
    graph_links: data.graph?.links?.length || 0,
    graph_fingerprint: graphFingerprint(data.graph),
    response_tier: data.metadata?.trace?.response_tier,
    degraded_services: data.metadata?.trace?.degraded_services || [],
    fallback_triggers: data.metadata?.trace?.route_diagnostics?.fallback_triggers || []
  };
}

async function run() {
  console.log("========================================================");
  console.log(" PHASE 3 GOLDEN PATH DETERMINISM BENCHMARK ");
  console.log("========================================================\n");
  console.log(`Target: ${ORCHESTRATOR_URL}`);
  console.log(`Repeats per query: ${REPEATS}`);
  console.log(`Preferred latency: <${PREFERRED_LATENCY_MS}ms\n`);

  const summaries = [];
  let totalRuns = 0;

  for (const entry of GOLDEN_PATH_REGISTRY) {
    const query = entry.variants?.[0] || entry.entities?.[0] || entry.id;
    const runs = [];

    for (let i = 0; i < REPEATS; i += 1) {
      try {
        runs.push(await runOnce(entry, query, i));
      } catch (err) {
        runs.push({
          ok: false,
          status: 0,
          latency_ms: 0,
          route: "NETWORK_ERROR",
          confidence: 0,
          answer_chars: 0,
          graph_nodes: 0,
          graph_links: 0,
          graph_fingerprint: "NETWORK_ERROR",
          error: err.message
        });
      }
      totalRuns += 1;
      process.stdout.write(`\rRunning ${entry.id}: ${i + 1}/${REPEATS}`);
    }

    const latencies = runs.map(run => run.latency_ms).filter(Boolean);
    const routeCounts = runs.reduce((acc, run) => {
      const route = canonicalRoute(run.route);
      acc[route] = (acc[route] || 0) + 1;
      return acc;
    }, {});
    const graphFingerprints = [...new Set(runs.map(run => run.graph_fingerprint))];
    const failures = runs.filter(run => !run.ok || !routeAcceptable(entry.route, run.route));
    const slowRuns = runs.filter(run => run.latency_ms > PREFERRED_LATENCY_MS);

    summaries.push({
      id: entry.id,
      category: entry.category,
      query,
      expected_route: entry.route,
      total_runs: runs.length,
      pass: failures.length === 0,
      no_crash_rate: `${(((runs.length - runs.filter(run => !run.ok).length) / runs.length) * 100).toFixed(2)}%`,
      route_stability_rate: `${(((runs.length - failures.length) / runs.length) * 100).toFixed(2)}%`,
      route_counts: routeCounts,
      avg_latency_ms: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
      p50_latency_ms: percentile(latencies, 50),
      p95_latency_ms: percentile(latencies, 95),
      max_latency_ms: latencies.length ? Math.max(...latencies) : 0,
      preferred_latency_pass_rate: `${(((runs.length - slowRuns.length) / runs.length) * 100).toFixed(2)}%`,
      graph_payload_stable: graphFingerprints.length <= 1,
      graph_fingerprint_count: graphFingerprints.length,
      failures: failures.slice(0, 5),
      slow_runs: slowRuns.slice(0, 5)
    });

    console.log(` -> ${summaries[summaries.length - 1].pass ? "PASS" : "CHECK"}`);
  }

  const failed = summaries.filter(summary => !summary.pass);
  const report = {
    generated_at: new Date().toISOString(),
    target: ORCHESTRATOR_URL,
    repeats_per_query: REPEATS,
    preferred_latency_ms: PREFERRED_LATENCY_MS,
    total_queries: GOLDEN_PATH_REGISTRY.length,
    total_runs: totalRuns,
    passed_queries: summaries.length - failed.length,
    failed_queries: failed.length,
    all_queries_passed: failed.length === 0,
    summaries
  };

  fs.writeFileSync(
    path.join(__dirname, "golden_path_benchmark_report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("\nGolden path report saved to testing/golden_path_benchmark_report.json");
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
