import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ORCHESTRATOR_URL =
    process.env.ORCHESTRATOR_URL ||
    `http://localhost:${process.env.ORCHESTRATOR_PORT || 8004}/api/chatbot/query`;

const VALID_ROUTES = ["KG", "RAG", "HYBRID", "DECISION", "CAREER", "FAQ", "INTERACTIVE", "LLM", "ERROR"];
const VALID_SOURCES = ["KG", "RAG", "HYBRID", "DECISION", "CAREER", "FAQ", "INTERACTIVE", "LLM"];

async function runFrontendContractTest() {
    console.log("========================================================");
    console.log(" PHASE 5G: STRICT FRONTEND SCHEMA VALIDATION ");
    console.log("========================================================\n");

    let queries = [];
    try {
        queries = JSON.parse(fs.readFileSync(path.join(__dirname, 'benchmarkQueries.json'), 'utf8'));
    } catch (e) {
        console.error("Missing benchmarkQueries.json");
        return;
    }

    let total = 0;
    let success = 0;
    let malformed = 0;
    let frontend_break_risk = 0;
    const failures = [];

    for (const q of queries) {
        total++;
        try {
            const res = await fetch(ORCHESTRATOR_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q.query, cid: `contract_${q.query_id}` })
            });
            const data = await res.json();
            
            let isMalformed = false;
            let isBreakRisk = false;
            let issueDetails = [];

            // 1. Missing Core Fields
            if (typeof data.answer !== "string") { isMalformed = true; isBreakRisk = true; issueDetails.push("Missing/invalid 'answer'"); }
            if (typeof data.route !== "string") { isMalformed = true; issueDetails.push("Missing/invalid 'route'"); }
            if (typeof data.confidence !== "number") { isMalformed = true; issueDetails.push("Missing/invalid 'confidence'"); }
            if (!Array.isArray(data.sources)) { isMalformed = true; isBreakRisk = true; issueDetails.push("Missing/invalid 'sources' array"); }
            if (!Array.isArray(data.citations)) { isMalformed = true; issueDetails.push("Missing/invalid 'citations' array"); }
            if (typeof data.reasoning !== "string") { isMalformed = true; issueDetails.push("Missing/invalid 'reasoning'"); }
            if (typeof data.metadata?.trace !== "object") { isMalformed = true; issueDetails.push("Missing/invalid 'metadata.trace'"); }

            // 2. Bounds and Enums
            if (data.confidence < 0 || data.confidence > 1) {
                isMalformed = true; issueDetails.push("Confidence out of bounds (0-1)");
            }
            if (data.route && !VALID_ROUTES.includes(data.route)) {
                isMalformed = true; issueDetails.push(`Invalid route enum: ${data.route}`);
            }
            if (data.sources) {
                for (const s of data.sources) {
                    if (!VALID_SOURCES.includes(s)) {
                        isMalformed = true; issueDetails.push(`Invalid source enum: ${s}`);
                    }
                }
            }

            if (isMalformed) {
                malformed++;
                if (isBreakRisk) frontend_break_risk++;
                failures.push({ query_id: q.query_id, route: data.route, issues: issueDetails });
            } else {
                success++;
            }

        } catch (e) {
            malformed++;
            frontend_break_risk++;
            failures.push({ query_id: q.query_id, route: "NETWORK_ERROR", issues: ["Failed to fetch API"] });
        }
        process.stdout.write(`\rValidating Schema Contract: ${q.query_id} ... `);
    }

    const report = {
        total_validations: total,
        contract_success_rate: ((success / total) * 100).toFixed(2) + "%",
        malformed_payload_rate: ((malformed / total) * 100).toFixed(2) + "%",
        frontend_break_risk_percent: ((frontend_break_risk / total) * 100).toFixed(2) + "%",
        target_validation: {
            "Frontend Break Risk === 0%": frontend_break_risk === 0 ? "PASS" : "FAIL"
        },
        failures
    };

    fs.writeFileSync(path.join(__dirname, 'frontend_contract_report.json'), JSON.stringify(report, null, 2));
    console.log("\n\n✅ Frontend Contract Validation report generated.");
}

runFrontendContractTest().catch(console.error);
