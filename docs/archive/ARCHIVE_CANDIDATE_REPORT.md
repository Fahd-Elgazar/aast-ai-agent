# Archive Candidate Report
**AAST AI Agent — Legacy Code Verification and Deactivation Proof**

This report documents the verification process applied to code assets identified as archive candidates. It confirms that they have zero imports or runtime references, verifying their safe storage under the `archive/` directory.

---

## 1. Relocated Experimental Modules

The following files under `archive/multimodal/` were relocated from the root directory during the cleanup phase. We confirm their status below:

### 1.1 `archive/multimodal/app.py`
*   **Import Count:** **0**
*   **Runtime References:** **0**
*   **Docker References:** **0**
*   **Startup References:** **0**
*   **Status:** **ARCHIVED**
*   **Proof of Deactivation:** Previously served as a FastAPI image pipeline endpoint for Llava/Gemma. It is not listed in `docker-compose.yml`, not used by the node orchestrator, and does not interact with the text-based advising loop.

### 1.2 `archive/multimodal/pipeline/image_pipeline.py`
*   **Import Count:** **0**
*   **Runtime/Docker References:** **0**
*   **Status:** **ARCHIVED**
*   **Proof of Deactivation:** Preprocesses raw image matrices for multimodal input checks. Unused by active modules.

### 1.3 `archive/multimodal/reasoning/gemma_client.py`
*   **Import Count:** **0**
*   **Runtime/Docker References:** **0**
*   **Status:** **ARCHIVED**
*   **Proof of Deactivation:** Local Python Ollama connector class. Express uses its own native `services/ollamaService.js` for Gemma, meaning this Python client is obsolete.

### 1.4 `archive/multimodal/vision/` (scene_classifier.py, llava_client.py, dynamic_prompt.py)
*   **Import Count:** **0**
*   **Runtime/Docker References:** **0**
*   **Status:** **ARCHIVED**
*   **Proof of Deactivation:** Vision processing logic specific to LLaVA image descriptions. Deactivated.

---

## 2. Review Required (Not Archived)

The following components remain in the backend and are identified as legacy, but they are kept in their original locations to prevent potential build/script breakage (in compliance with Rule 1):

*   **`aast-ai-agent-main/backend/index.js`**
    *   *Import Count:* 0 (not imported by other scripts, but it is a primary entry point candidate in package metadata).
    *   *Docker References:* Bypassed (Dockerfile calls `node orchestrator.js`).
    *   *Classification:* **REVIEW_REQUIRED** (Do not archive/move; freeze in place to prevent breaking legacy build scripts or diagnostic testing entrypoints).
*   **`aast-ai-agent-main/backend/db/mysql.js` & `routes/mysql.js`**
    *   *Import Count:* Imported only by the legacy `index.js`.
    *   *Classification:* **REVIEW_REQUIRED** (Bypassed but kept in place).
*   **`aast-ai-agent-main/backend/routes/auth.js` & `models/User.js`**
    *   *Import Count:* Imported only by `routes/auth.js` / `index.js`.
    *   *Classification:* **REVIEW_REQUIRED** (Bypassed but kept in place).
