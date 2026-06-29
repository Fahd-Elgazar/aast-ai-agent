# Missing Evidence Report
**AAST AI Agent — Outstanding Verification Requirements**

This report lists the claims in the project that currently lack empirical evidence, defining the required missing artifacts and priority.

---

## 1. Outstanding Verification Gaps

### 1.1 Subjective User advising Usability SUS Data
*   **Target Claim:** The visual GraphVisualizer advisor dashboard is user-friendly and improves advising outcomes.
*   **Missing Artifact:** Subjective feedback questionnaires, student advising survey results, and User study analysis charts.
*   **Priority:** **High**

### 1.2 Comparative Baseline RAG Benchmarks
*   **Target Claim:** The hybrid GraphRAG+DSS model performs with higher accuracy and lower hallucination rates than standard RAG.
*   **Missing Artifact:** Benchmarks running accuracy tests on a standard vector RAG baseline to compare against the AAST hybrid model.
*   **Priority:** **High**

### 1.3 Ablation Study Timings
*   **Target Claim:** Each modular sub-engine contributes directly to the overall accuracy and latency of the advising system.
*   **Missing Artifact:** Latency and accuracy log outputs run under deactivated Neo4j or DSS sub-systems.
*   **Priority:** **Medium**

### 1.4 Multi-User Concurrency stress Benchmarks
*   **Target Claim:** The Express orchestrator backend gateway is highly scalable and handles concurrent advisor sessions.
*   **Missing Artifact:** Concurrency stress test reports and latency charts logged under simulated concurrent user loads.
*   **Priority:** **Medium**
