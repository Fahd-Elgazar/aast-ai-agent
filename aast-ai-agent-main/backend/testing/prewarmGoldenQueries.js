import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import { getGoldenPrewarmQueries } from "../config/goldenPathRegistry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORCHESTRATOR_URL =
  process.env.ORCHESTRATOR_URL ||
  `http://localhost:${process.env.ORCHESTRATOR_PORT || 8004}/api/chatbot/query`;

async function postQuery(item) {
  const started = Date.now();
  const res = await fetch(ORCHESTRATOR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: item.query,
      cid: `golden_prewarm_${item.id}`
    })
  });

  const data = await res.json();
  return {
    id: item.id,
    query: item.query,
    expected_route: item.route,
    actual_route: data.metadata?.trace?.route || data.route,
    confidence: data.confidence || 0,
    latency_ms: Date.now() - started,
    ok: res.ok && !!data.answer,
    graph_nodes: data.graph?.nodes?.length || 0,
    graph_links: data.graph?.links?.length || 0
  };
}

async function run() {
  const queries = getGoldenPrewarmQueries();
  const results = [];

  console.log("========================================================");
  console.log(" PHASE 3E: GOLDEN QUERY CACHE PREWARM ");
  console.log("========================================================\n");
  console.log(`Target: ${ORCHESTRATOR_URL}`);
  console.log(`Queries: ${queries.length}\n`);

  for (const item of queries) {
    try {
      const result = await postQuery(item);
      results.push(result);
      process.stdout.write(`\rPrewarming ${results.length}/${queries.length}: ${item.id} -> ${result.actual_route}`);
    } catch (err) {
      results.push({
        id: item.id,
        query: item.query,
        expected_route: item.route,
        actual_route: "NETWORK_ERROR",
        confidence: 0,
        latency_ms: 0,
        ok: false,
        error: err.message
      });
      process.stdout.write(`\rPrewarming ${results.length}/${queries.length}: ${item.id} -> ERROR`);
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    target: ORCHESTRATOR_URL,
    total_queries: queries.length,
    successful: results.filter(item => item.ok).length,
    failed: results.filter(item => !item.ok).length,
    average_latency_ms: results.length
      ? Math.round(results.reduce((sum, item) => sum + (item.latency_ms || 0), 0) / results.length)
      : 0,
    results
  };

  fs.writeFileSync(
    path.join(__dirname, "golden_prewarm_report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("\n\nPrewarm report saved to testing/golden_prewarm_report.json");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
