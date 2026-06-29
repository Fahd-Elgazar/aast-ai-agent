# Evaluation Gap Report
**AAST AI Agent — Quality Assurance and Benchmarking Gaps**

This report lists the missing evaluations and benchmarking tests that must be completed before writing Chapter 5 (Evaluation) of the graduation project book.

---

## 1. Identified Evaluation Gaps

### 1.1 User advising Study (Subjective Usability)
*   *Gap:* No subjective user evaluations exist in the repository.
*   *Impact:* Without surveys from actual students and advisors evaluating advice accuracy and visual graph helper utility, the project lacks academic validation of real-world usability.
*   *Requirement:* Conduct a user study (e.g. System Usability Scale (SUS) questionnaire) and compile charts showing user ratings.

### 1.2 Comparative Baseline RAG Analysis
*   *Gap:* The repository contains system benchmarking reports but lacks comparisons against baseline implementations (such as a standard Vector RAG-only chatbot).
*   *Impact:* The project cannot prove that its hybrid GraphRAG+DSS architecture outperforms simpler, standard implementations in accuracy or latency.
*   *Requirement:* Run accuracy and hallucination benchmarks on a standard RAG baseline to compare against the AAST hybrid model.

### 1.3 Ablation Studies
*   *Gap:* No benchmarks exist evaluating performance when specific subsystems are disabled (e.g., bypassing DSS calculations or disabling Neo4j relationships context).
*   *Impact:* Cannot quantify the specific contribution of each modular subsystem to accuracy and latency.
*   *Requirement:* Design and log ablation benchmarks comparing the full model against sub-system configurations.

### 1.4 Concurrency & Load Stress Benchmarking
*   *Gap:* All latency tests were run under single-user parameters.
*   *Impact:* System response times under multi-user concurrent loads are unknown.
*   *Requirement:* Run simulated user stress tests using a benchmarking tool (like Apache JMeter or Locust) and log response time changes under load.
