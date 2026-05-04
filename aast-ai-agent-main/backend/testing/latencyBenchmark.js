import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ORCHESTRATOR_URL = 'http://localhost:8000/api/chatbot/query';

function getPercentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
}

async function runLatencyBenchmark() {
    console.log("========================================================");
    console.log(" PHASE 5D: SCIENTIFIC LATENCY BENCHMARKING ");
    console.log("========================================================\n");

    let queries = [];
    try {
        queries = JSON.parse(fs.readFileSync(path.join(__dirname, 'benchmarkQueries.json'), 'utf8'));
    } catch (e) {
        console.error("Missing benchmarkQueries.json. Run previous phases first.");
        return;
    }

    const latenciesByRoute = {
        KG: [], RAG: [], HYBRID: [], DECISION: [], CAREER: [], FAQ: [], LLM: [], INTERACTIVE: []
    };

    let timeout_failures = 0;
    let network_failures = 0;
    let degraded_route_count = 0;
    let total_health_probe_latency = 0;
    let total_fusion_latency = 0;

    for (const q of queries) {
        const start = Date.now();
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 12000); // 12s hard timeout
            
            const res = await fetch(ORCHESTRATOR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q.query, cid: `latency_${q.query_id}_${Date.now()}` }),
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!res.ok) {
                if (res.status === 503 || res.status === 504) timeout_failures++;
                else network_failures++;
                continue;
            }

            const data = await res.json();
            const end = Date.now();
            const totalNetworkLatency = end - start;
            
            const actualRoute = data.metadata?.trace?.route || data.route || "LLM";
            const traceLatency = data.metadata?.trace?.latency_ms || totalNetworkLatency;
            
            // Heuristic estimations based on architecture
            const networkOverhead = totalNetworkLatency - traceLatency;
            const healthProbeLatency = Math.min(traceLatency * 0.05, 50); // Probes are parallel/cached
            const fusionLatency = Math.min(traceLatency * 0.15, 150); // Fusion formatting
            
            total_health_probe_latency += healthProbeLatency;
            total_fusion_latency += fusionLatency;

            if (data.metadata?.trace?.degraded_services?.length > 0) {
                degraded_route_count++;
            }

            if (latenciesByRoute[actualRoute]) {
                latenciesByRoute[actualRoute].push(totalNetworkLatency);
            } else {
                latenciesByRoute["LLM"].push(totalNetworkLatency);
            }

        } catch (e) {
            if (e.name === 'AbortError') timeout_failures++;
            else network_failures++;
        }
        process.stdout.write(`\rBenchmarking actual route latency: ${q.query_id} ... `);
    }
    
    console.log("\n\nGenerating latency_report.json...\n");
    
    const report = {
        metadata: {
            total_queries: queries.length,
            network_failures,
            timeout_failures,
            degraded_route_count,
            estimated_avg_health_probe_latency_ms: queries.length ? (total_health_probe_latency / queries.length).toFixed(0) : 0,
            estimated_avg_fusion_latency_ms: queries.length ? (total_fusion_latency / queries.length).toFixed(0) : 0
        },
        routes: {},
        targets_validation: {}
    };

    const targets = {
        "KG": 1500,
        "RAG": 2500,
        "HYBRID": 4000,
        "DECISION": 3500,
        "CAREER": 3500,
        "FAQ": 1000,
        "LLM": 6000
    };

    for (const [route, arr] of Object.entries(latenciesByRoute)) {
        if (arr.length === 0) continue;
        const avg = parseInt((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(0));
        const p50 = getPercentile(arr, 50);
        const p95 = getPercentile(arr, 95);
        const p99 = getPercentile(arr, 99);
        const min = Math.min(...arr);
        const max = Math.max(...arr);

        report.routes[route] = {
            count: arr.length,
            avg_ms: avg,
            median_ms: p50,
            p95_ms: p95,
            p99_ms: p99,
            min_ms: min,
            max_ms: max
        };

        if (targets[route]) {
            report.targets_validation[`${route} < ${targets[route]}ms`] = p95 <= targets[route] ? "PASS" : "FAIL";
        }
    }

    fs.writeFileSync(path.join(__dirname, 'latency_report.json'), JSON.stringify(report, null, 2));
    console.log("✅ Scientific Latency report generated successfully.");
}

runLatencyBenchmark().catch(console.error);
