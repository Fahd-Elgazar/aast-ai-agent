import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORCHESTRATOR_URL = 'http://localhost:8000/api/chatbot/query';

// --- Scientific Metric Utilities ---

function detectFusionContradictions(answer) {
    if (!answer) return false;
    const lower = answer.toLowerCase();
    
    // Logical inconsistency patterns
    const hasMandatory = lower.includes("mandatory") || lower.includes("required") || lower.includes("must");
    const hasOptional = lower.includes("optional") || lower.includes("waived") || lower.includes("not required");
    
    const hasEligible = lower.includes("eligible") || lower.includes("can apply");
    const hasIneligible = lower.includes("ineligible") || lower.includes("cannot apply");
    
    // Contradiction hit
    if ((hasMandatory && hasOptional) || (hasEligible && hasIneligible)) {
        return true;
    }
    return false;
}

function calculatePercent(part, total) {
    if (total === 0) return "N/A";
    return ((part / total) * 100).toFixed(2);
}

function calculatePercentNum(part, total) {
    if (total === 0) return 0;
    return (part / total) * 100;
}

function getPercentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
}

// --- Benchmark Runner ---

async function runRetrievalBenchmark() {
    console.log("========================================================");
    console.log(" PHASE 5C: SCIENTIFIC RETRIEVAL QUALITY EVALUATION ");
    console.log("========================================================\n");

    const queries = JSON.parse(fs.readFileSync(path.join(__dirname, 'benchmarkQueries.json'), 'utf8'));
    const expectedRoutes = JSON.parse(fs.readFileSync(path.join(__dirname, 'expectedRoutes.json'), 'utf8'));
    const behaviors = JSON.parse(fs.readFileSync(path.join(__dirname, 'expectedBehaviors.json'), 'utf8'));
    
    // 1. O(1) QUERY LOOKUP HASH MAP (Performance Fix)
    const queryMap = Object.fromEntries(queries.map(q => [q.query_id, q.query]));
    const behaviorMap = Object.fromEntries(behaviors.map(b => [b.route, b]));

    // Tracking variables
    let kgTotal = 0, kgPrecise = 0, kgEmpty = 0, kgRelationMiss = 0;
    let ragTotal = 0, ragRecall = 0, ragCited = 0, ragSemantic = 0;
    let hybridTotal = 0, hybridFullSuccess = 0, hybridPartial = 0, hybridTotalFailure = 0;
    
    let contradictionTotal = 0, contradictionDetected = 0, contradictionMissed = 0;
    let totalSources = 0, uniqueSources = 0, duplicatedSourcesCount = 0;
    let validExpectations = 0, expectedChecks = 0;
    
    let network_failures = 0, orchestrator_failures = 0, invalid_payload_failures = 0;
    
    let latencies = [];
    const failures = [];

    for (const item of expectedRoutes) {
        const queryText = queryMap[item.query_id];
        if (!queryText) continue;

        const startTime = Date.now();
        let res;
        try {
            res = await fetch(ORCHESTRATOR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryText, cid: `retrieval_${item.query_id}_${Date.now()}` })
            });
        } catch(e) {
            network_failures++;
            failures.push({ query_id: item.query_id, issue: "Network Failure" });
            continue;
        }

        if (!res.ok) {
            orchestrator_failures++;
            failures.push({ query_id: item.query_id, issue: `Orchestrator HTTP ${res.status}` });
            continue;
        }

        let data;
        try {
            data = await res.json();
        } catch (e) {
            invalid_payload_failures++;
            failures.push({ query_id: item.query_id, issue: "Invalid JSON Payload" });
            continue;
        }
        
        const latency = Date.now() - startTime;
        latencies.push(latency);
        
        const sources = data.sources || [];
        const citations = data.citations || [];
        const answer = data.answer || "";
        const conf = data.confidence || 0;
        
        // Dynamic Source Diversity & Redundancy Scoring
        const dedupedSources = [...new Set(sources)];
        totalSources += sources.length;
        uniqueSources += dedupedSources.length;
        if (sources.length > dedupedSources.length) duplicatedSourcesCount += (sources.length - dedupedSources.length);

        // Contradiction Logic
        const hasContradiction = detectFusionContradictions(answer);
        const expectedBeh = behaviorMap[item.expected_route];
        
        if (expectedBeh && expectedBeh.contradiction_sensitivity === "High") {
            contradictionTotal++;
            if (hasContradiction) contradictionDetected++;
            else contradictionMissed++;
        }

        // Expected Behavior Validations (Explainability Check)
        if (expectedBeh) {
            expectedChecks++;
            let isValid = true;
            if (conf < expectedBeh.expected_min_confidence) isValid = false;
            if (expectedBeh.required_citation_presence && citations.length === 0) isValid = false;
            
            const reqSources = expectedBeh.expected_source_types || [];
            for (const req of reqSources) {
                if (!sources.includes(req) && !sources.includes("HYBRID") && !sources.includes("INTERACTIVE")) {
                    isValid = false;
                }
            }
            if (isValid) validExpectations++;
        }

        // Retrieval Metrics by Route
        if (item.expected_route === "KG_ONLY") {
            kgTotal++;
            if (sources.includes("KG")) kgPrecise++;
            else kgRelationMiss++;
            
            if (answer.toLowerCase().includes("unable") || conf < 0.4) kgEmpty++;
            
            if (!sources.includes("KG")) {
                failures.push({ query_id: item.query_id, expected: "KG", got: sources, issue: "Missing KG source" });
            }
        }
        else if (item.expected_route === "RAG_ONLY") {
            ragTotal++;
            if (sources.includes("RAG")) ragRecall++;
            if (citations.length > 0) ragCited++;
            if (conf >= 0.7 && sources.includes("RAG")) ragSemantic++;
            
            if (!sources.includes("RAG")) {
                failures.push({ query_id: item.query_id, expected: "RAG", got: sources, issue: "Missing RAG source" });
            }
        }
        else if (item.expected_route === "HYBRID_KG_RAG") {
            hybridTotal++;
            const hasKG = sources.includes("KG");
            const hasRAG = sources.includes("RAG");
            const hasHybrid = sources.includes("HYBRID");
            
            // Strict Hybrid Validation
            if ((hasKG && hasRAG) || (hasHybrid && (hasKG || hasRAG))) {
                hybridFullSuccess++;
            } else if (hasKG || hasRAG) {
                hybridPartial++;
            } else {
                hybridTotalFailure++;
                failures.push({ query_id: item.query_id, expected: "HYBRID", got: sources, issue: "Hybrid degradation to fallback" });
            }
        }
        process.stdout.write(`\rEvaluating logic semantics: [${item.query_id}] ... `);
    }

    console.log("\n\nGenerating scientific retrieval_report.json...\n");

    const avgLatency = latencies.length ? latencies.reduce((a,b)=>a+b,0)/latencies.length : 0;
    const medianLatency = getPercentile(latencies, 50);
    const p95Latency = getPercentile(latencies, 95);
    const worstLatency = latencies.length ? Math.max(...latencies) : 0;

    const kgPreciseNum = calculatePercentNum(kgPrecise, kgTotal);
    const ragRecallNum = calculatePercentNum(ragRecall, ragTotal);
    const hybridFullNum = calculatePercentNum(hybridFullSuccess, hybridTotal);
    const behaviorValNum = calculatePercentNum(validExpectations, expectedChecks);
    
    // Inverse weighting: Less missed contradictions = higher integrity
    const contradictionScoreNum = contradictionTotal > 0 ? (100 - calculatePercentNum(contradictionMissed, contradictionTotal)) : 100;
    
    // Composite Integrity Score
    const benchmarkIntegrityScore = (
        (kgPreciseNum * 0.2) + 
        (ragRecallNum * 0.2) + 
        (hybridFullNum * 0.2) + 
        (behaviorValNum * 0.2) + 
        (contradictionScoreNum * 0.2)
    ).toFixed(2);

    const report = {
        kg_precision_percent: calculatePercent(kgPrecise, kgTotal),
        kg_empty_hit_percent: calculatePercent(kgEmpty, kgTotal),
        kg_relation_miss_percent: calculatePercent(kgRelationMiss, kgTotal),
        
        rag_recall_percent: calculatePercent(ragRecall, ragTotal),
        rag_citation_precision_percent: calculatePercent(ragCited, ragTotal),
        rag_semantic_accuracy_percent: calculatePercent(ragSemantic, ragTotal),
        
        hybrid_full_success_percent: calculatePercent(hybridFullSuccess, hybridTotal),
        hybrid_partial_degradation_percent: calculatePercent(hybridPartial, hybridTotal),
        hybrid_total_failure_percent: calculatePercent(hybridTotalFailure, hybridTotal),
        
        contradiction_detection_percent: calculatePercent(contradictionDetected, contradictionTotal),
        contradiction_miss_percent: calculatePercent(contradictionMissed, contradictionTotal),
        
        source_diversity_score: totalSources ? ((uniqueSources / totalSources) * 10).toFixed(2) + "/10" : "0/10",
        evidence_redundancy_percent: totalSources ? calculatePercent(duplicatedSourcesCount, totalSources) : "0.00",
        
        avg_latency_ms: avgLatency.toFixed(0),
        median_latency_ms: medianLatency,
        p95_latency_ms: p95Latency,
        worst_latency_ms: worstLatency,
        
        network_failures,
        orchestrator_failures,
        invalid_payload_failures,
        
        benchmark_integrity_score,
        failure_examples: failures
    };

    fs.writeFileSync(path.join(__dirname, 'retrieval_report.json'), JSON.stringify(report, null, 2));
    console.log("✅ Scientific retrieval validation complete.");
}

runRetrievalBenchmark().catch(console.error);
