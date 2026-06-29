# Book Appendix Discovery
**AAST AI Agent — Technical Appendices Mapping**

This report identifies raw logs, configuration files, and prompt templates in the repository that are suitable for inclusion in the thesis appendices.

---

## 1. Discovered Appendices

### Appendix A: Express API Route Mappings
*   **Source:** `aast-ai-agent-main/backend/routes/` (`chatbot.js`, `decision.js`, `conversations.js`).
*   **Format:** Code block mapping Express endpoints to their handler callbacks.
*   **Academic Value:** Documents the backend API gateway interface for developers.

### Appendix B: Core LLM Prompt Templates
*   **Source:** `aast-ai-agent-main/backend/services/unifiedAnswerService.js` & `rag_system/phase4_llm_answer_engine.py` (under LLM generation blocks).
*   **Format:** Raw Markdown templates showcasing context injections and system role instructions.
*   **Academic Value:** Essential for explainability, documenting exactly how context is formatted for LLM consumption.

### Appendix C: System Deployment Configurations
*   **Source:** Root `docker-compose.yml`, `aast-ai-agent-main/backend/Dockerfile`, and `college-decision-system-backend/Dockerfile`.
*   **Format:** YAML and Dockerfile code blocks.
*   **Academic Value:** Outlines the deployment and multi-container environment configurations.

### Appendix D: Reorganization Audit Logs
*   **Source:** `docs/reports/audit/` (older files documenting cleanup batches).
*   **Format:** Tabular validation logs.
*   **Academic Value:** Documents the code archaeology, refactoring steps, and validation matrices.
