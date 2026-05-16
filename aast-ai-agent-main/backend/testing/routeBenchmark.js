import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORCHESTRATOR_URL =
    process.env.ORCHESTRATOR_URL ||
    `http://localhost:${process.env.ORCHESTRATOR_PORT || 8004}/api/chatbot/query`;

function canonicalRoute(route) {
    const raw = String(route || "LLM_FALLBACK").toUpperCase();
    if (raw.includes("HYBRID")) return "HYBRID_KG_RAG";
    if (raw.includes("KG")) return "KG_ONLY";
    if (raw.includes("RAG")) return "RAG_ONLY";
    if (raw.includes("DECISION")) return "DECISION_ENGINE";
    if (raw.includes("CAREER")) return "CAREER_ENGINE";
    if (raw.includes("FAQ")) return "FAQ";
    if (raw.includes("INTERACTIVE")) return "INTERACTIVE";
    return "LLM_FALLBACK";
}

async function runRouteBenchmark() {
    console.log("========================================================");
    console.log(" PHASE 5B: AUTOMATED ROUTE ACCURACY TESTING ");
    console.log("========================================================\n");

    const queries = JSON.parse(fs.readFileSync(path.join(__dirname, 'benchmarkQueries.json'), 'utf8'));
    const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'expectedRoutes.json'), 'utf8'));
    const behaviors = JSON.parse(fs.readFileSync(path.join(__dirname, 'expectedBehaviors.json'), 'utf8'));
    
    const expectedMap = {};
    expected.forEach(e => expectedMap[e.query_id] = e.expected_route);

    let total = 0;
    let correct = 0;
    let misroutes = 0;
    let latencies = [];
    let lowConfidence = 0;
    let fallbacks = 0;
    
    const confusionMatrix = {};
    const misrouteExamples = [];
    const classAccuracy = { KG_ONLY: {t:0,c:0}, RAG_ONLY: {t:0,c:0}, HYBRID_KG_RAG: {t:0,c:0}, DECISION_ENGINE: {t:0,c:0}, CAREER_ENGINE: {t:0,c:0}, FAQ: {t:0,c:0}, LLM_FALLBACK: {t:0,c:0} };

    for (const item of queries) {
        total++;
        const expectedRoute = expectedMap[item.query_id];
        
        const startTime = Date.now();
        let res;
        try {
            res = await fetch(ORCHESTRATOR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: item.query, cid: `bench_${item.query_id}_${Date.now()}` })
            });
        } catch (e) {
            console.error(`\n[ERROR] Failed to reach orchestrator for ${item.query_id}. Is the server running?`);
            continue;
        }
        
        const data = await res.json();
        const latency = Date.now() - startTime;
        latencies.push(latency);
        
        const predictedRouteRaw = data.metadata?.trace?.route || data.route || "LLM_FALLBACK";
        const predictedRoute = canonicalRoute(predictedRouteRaw);
        const conf = data.confidence || 0;

        if (!confusionMatrix[expectedRoute]) confusionMatrix[expectedRoute] = {};
        confusionMatrix[expectedRoute][predictedRoute] = (confusionMatrix[expectedRoute][predictedRoute] || 0) + 1;

        if (classAccuracy[expectedRoute]) classAccuracy[expectedRoute].t++;

        const expectedBeh = behaviors.find(b => b.route === expectedRoute);

        let isCorrect = false;
        // INTERACTIVE is a valid partial state for DECISION routing
        if (predictedRoute === expectedRoute || (expectedRoute === "DECISION_ENGINE" && predictedRoute === "INTERACTIVE")) {
            correct++;
            isCorrect = true;
            if (classAccuracy[expectedRoute]) classAccuracy[expectedRoute].c++;
        } else {
            misroutes++;
            misrouteExamples.push({
                query_id: item.query_id,
                expected: expectedRoute,
                predicted: predictedRoute,
                confidence: conf
            });
        }

        if (predictedRoute === "LLM_FALLBACK") fallbacks++;
        if (expectedBeh && conf < expectedBeh.expected_min_confidence) {
            lowConfidence++;
        }

        process.stdout.write(`\rEvaluating: [${total}/${queries.length}] -> ${isCorrect ? '✅' : '❌'}`);
    }

    console.log("\n\nGenerating route_accuracy_report.json...\n");

    const report = {
        total_queries: total,
        route_accuracy_percent: ((correct / total) * 100).toFixed(2),
        misroute_percent: ((misroutes / total) * 100).toFixed(2),
        accuracy_by_route_class: Object.fromEntries(
            Object.entries(classAccuracy).map(([k, v]) => [k, v.t > 0 ? ((v.c/v.t)*100).toFixed(2) + '%' : 'N/A'])
        ),
        hybrid_precision_percent: classAccuracy["HYBRID_KG_RAG"].t > 0 ? ((classAccuracy["HYBRID_KG_RAG"].c / classAccuracy["HYBRID_KG_RAG"].t) * 100).toFixed(2) : "N/A",
        faq_precision_percent: classAccuracy["FAQ"].t > 0 ? ((classAccuracy["FAQ"].c / classAccuracy["FAQ"].t) * 100).toFixed(2) : "N/A",
        fallback_frequency_percent: ((fallbacks / total) * 100).toFixed(2),
        confidence_realism_score: (((total - lowConfidence) / total) * 100).toFixed(2) + "%",
        average_latency_ms: (latencies.reduce((a,b)=>a+b,0)/latencies.length).toFixed(0),
        worst_latency_ms: Math.max(...latencies),
        low_confidence_mismatches: lowConfidence,
        confusion_matrix: confusionMatrix,
        misroute_examples: misrouteExamples
    };

    fs.writeFileSync(path.join(__dirname, 'route_accuracy_report.json'), JSON.stringify(report, null, 2));
    console.log("✅ Report saved successfully.");
}

runRouteBenchmark().catch(console.error);
