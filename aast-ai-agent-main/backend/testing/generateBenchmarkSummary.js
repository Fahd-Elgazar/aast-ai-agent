import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeRead(filename) {
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, filename), 'utf8'));
    } catch (e) {
        return null;
    }
}

function generateMarkdown() {
    console.log("Generating Dynamic Benchmark Summary...");

    const routeData = safeRead('route_accuracy_report.json') || {};
    const retrievalData = safeRead('retrieval_report.json') || {};
    const latencyData = safeRead('latency_report.json') || {};
    const hallucinationData = safeRead('hallucination_report.json') || {};
    const frontendData = safeRead('frontend_contract_report.json') || {};
    const failureData = safeRead('failure_simulation_report.json') || {};

    const integrityScore = parseFloat(retrievalData.benchmark_integrity_score || 0);
    const passThreshold = integrityScore > 85 ? "RESEARCH-GRADE / ENTERPRISE PRODUCTION READY" : "REQUIRES OPTIMIZATION";

    const md = `
# AAST Explainable Hybrid GraphRAG Academic Super-Agent
## Phase 5 Scientific Benchmark Summary

### 1. Executive Overview
This dynamically generated report consolidates the research-grade validation of the AAST Academic Super-Agent. The testing suite was executed programmatically against the active orchestrator API, enforcing strict academic and enterprise standards.

**Final Benchmark Integrity Score:** ${integrityScore.toFixed(2)}/100
**Deployment Status:** ${passThreshold}

### 2. Routing Intelligence (Phase 5B)
- **Total Queries Tested:** ${routeData.total_queries || 'N/A'}
- **Overall Route Accuracy:** ${routeData.route_accuracy_percent || 'N/A'}%
- **Misroute Rate:** ${routeData.misroute_percent || 'N/A'}%
- **Hybrid Target Precision:** ${routeData.hybrid_precision_percent || 'N/A'}%
- **Confidence Realism Score:** ${routeData.confidence_realism_score || 'N/A'}

### 3. Retrieval Precision & Explainability (Phase 5C)
- **KG Precision (No False Positives):** ${retrievalData.kg_precision_percent || 'N/A'}%
- **RAG Policy Recall:** ${retrievalData.rag_recall_percent || 'N/A'}%
- **Hybrid Fusion Full Success:** ${retrievalData.hybrid_full_success_percent || 'N/A'}%
- **Contradiction Detection Efficiency:** ${retrievalData.contradiction_detection_percent || 'N/A'}%
- **Source Diversity Score:** ${retrievalData.source_diversity_score || 'N/A'}
- **Evidence Redundancy Limit:** ${retrievalData.evidence_redundancy_percent || 'N/A'}%

### 4. Latency Analysis (Phase 5D)
| Subsystem | Avg (ms) | p50 (ms) | p95 (ms) | Target validation |
|-----------|----------|----------|----------|-------------------|
| KG_ONLY | ${latencyData.routes?.KG?.avg_ms || 'N/A'} | ${latencyData.routes?.KG?.median_ms || 'N/A'} | ${latencyData.routes?.KG?.p95_ms || 'N/A'} | ${latencyData.targets_validation?.["KG < 1500ms"] || 'N/A'} |
| RAG_ONLY | ${latencyData.routes?.RAG?.avg_ms || 'N/A'} | ${latencyData.routes?.RAG?.median_ms || 'N/A'} | ${latencyData.routes?.RAG?.p95_ms || 'N/A'} | ${latencyData.targets_validation?.["RAG < 2500ms"] || 'N/A'} |
| HYBRID | ${latencyData.routes?.HYBRID?.avg_ms || 'N/A'} | ${latencyData.routes?.HYBRID?.median_ms || 'N/A'} | ${latencyData.routes?.HYBRID?.p95_ms || 'N/A'} | ${latencyData.targets_validation?.["HYBRID < 4000ms"] || 'N/A'} |
| FALLBACK | ${latencyData.routes?.LLM?.avg_ms || 'N/A'} | ${latencyData.routes?.LLM?.median_ms || 'N/A'} | ${latencyData.routes?.LLM?.p95_ms || 'N/A'} | ${latencyData.targets_validation?.["LLM < 6000ms"] || 'N/A'} |

*Estimated Internal Probe Overhead: ${latencyData.metadata?.estimated_avg_health_probe_latency_ms || 0}ms*

### 5. Hallucination & Prompt Security (Phase 5E)
- **Total Adversarial Tests:** ${hallucinationData.total_tests || 'N/A'}
- **Overall Hallucination Rate:** ${hallucinationData.hallucination_rate_percent || 'N/A'}% (${hallucinationData.target_validation?.["Overall Hallucination < 5%"] || 'N/A'})
- **Prompt Injection Success:** ${hallucinationData.prompt_injection_success_rate || 'N/A'}
- **Fabricated Policy Rate:** ${hallucinationData.fabricated_policy_rate || 'N/A'}
- **Safe Refusal Rate:** ${hallucinationData.safe_refusal_rate || 'N/A'}

### 6. Frontend UI Safety (Phase 5G)
- **Schema Validation Rate:** ${frontendData.contract_success_rate || 'N/A'}
- **Malformed Payload Rate:** ${frontendData.malformed_payload_rate || 'N/A'}
- **Frontend Break Risk:** ${frontendData.frontend_break_risk_percent || 'N/A'}

### 7. Failure Simulation & System Degradation (Phase 5F)
- **Graceful Degradation Rate:** ${failureData.graceful_degradation_rate || 'N/A'}
- **Catastrophic Crash Rate:** ${failureData.catastrophic_failure_rate || 'N/A'}
- **Continuity Preservation:** ${failureData.continuity_preservation_rate || 'N/A'}

---
*Generated dynamically by AAST AI Evaluation Framework.*
`;

    fs.writeFileSync(path.join(__dirname, 'benchmark_summary.md'), md.trim());
    console.log("✅ Dynamic benchmark_summary.md generated successfully based on local telemetry.");
}

generateBenchmarkSummary();
