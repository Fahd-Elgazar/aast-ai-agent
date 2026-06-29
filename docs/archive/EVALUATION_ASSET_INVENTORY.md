# Evaluation Asset Inventory
**AAST AI Agent — Quality, Performance, and Benchmarking Assets**

This document catalogs all existing testing metrics, latency reports, benchmark summaries, and system validation files in the repository that can serve as evidence for the graduation project evaluation chapter.

---

## 1. Discovered Evaluation Assets

| Asset Name | Repository Path | Type | Purpose | Metric Category |
| :--- | :--- | :---: | :--- | :---: |
| **Groundedness Audit** | `docs/reverse_engineering/ACCURACY_VALIDATION_REPORT.md` | Markdown | Summarizes LLM accuracy and hallucination rates. | Grounding |
| **Performance Audit** | `docs/reports/04_PERFORMANCE_ANALYSIS.md` | Markdown | Timing statistics for LLM calls and failovers. | Latency |
| **Independent Audit** | `docs/reports/final_verdict_aast_ai_agent (1).docx` | Word | Security vulnerability scans and stress test results. | Security/Stress |
| **Graph Metrics** | `docs/reports/graph_metrics_phase4b.md` | Markdown | Node counts and Neo4j Cypher execution timings. | GraphRAG |
| **Golden Path Results**| `aast-ai-agent-main/backend/testing/benchmark_summary.md` | Markdown | Summarizes routing accuracy and fallback hits. | Accuracy |
| **Latency Log** | `aast-ai-agent-main/backend/testing/latency_report.json` | JSON | Timing stats for each query intent category. | Latency |
| **Accuracy Log** | `aast-ai-agent-main/backend/testing/route_accuracy_report.json` | JSON | Intent classification accuracy check records. | Accuracy |
| **Hallucination Log** | `aast-ai-agent-main/backend/testing/hallucination_report.json` | JSON | LLM text overlap comparisons against databases. | Grounding |
| **Resilience Log** | `aast-ai-agent-main/backend/testing/failure_simulation_report.json` | JSON | PM2 process survival timings under server drops. | Resilience |
| **Integrity Tests** | `college-decision-system-backend/tests/` (8 files) | Python | Verifies DSS tuition and admission calculations. | Correctness |
