# Security Review Report
**AAST AI Agent — Security Audit and Vulnerability Assessment**

This report documents the security audit of the AAST Academic AI Agent, reviewing credential storage, API access controls, endpoint authentication, network exposure, and filesystem access controls.

---

## 1. Secrets and API Credentials Audit
*   **Storage Method:** Environment variables defined in root `.env` files.
*   **Vulnerability:** plain-text credentials (including `GEMINI_API_KEY`, `NEO4J_PASSWORD`, and `INTERNAL_SECRET_KEY`) reside directly on the filesystem.
*   **Risk:** HIGH. If the host machine or repository backup is compromised, credentials are leaked.
*   **Hardening Action:** Migrate production credentials to a secure secret vault (e.g., HashiCorp Vault or environment-injected container secrets) and strictly block `.env` files from Git tracking.

---

## 2. API Endpoint Authentication
*   **Orchestrator Backend:** Uses a custom header validation check (`INTERNAL_SECRET_KEY`) for incoming requests.
*   **Vulnerability:** Custom key checking does not provide fine-grained user access control, token expiration, or request signing.
*   **DSS Microservice:** Bypasses authorization middleware in several development routers.
*   **Risk:** MEDIUM. Unauthorized internal clients could query endpoints if they intercept the secret header.
*   **Hardening Action:** Implement robust JWT tokenization for client requests and bind endpoints to user session IDs.

---

## 3. Network & CORS Exposure
*   **Active Rules:** Express backend imports `cors` and implements a blanket policy `app.use(cors())`.
*   **Vulnerability:** Allows requests from any origin, exposing the APIs to Cross-Origin Resource Sharing (CORS) exploits.
*   **Risk:** MEDIUM.
*   **Hardening Action:** Restrict CORS configuration to a whitelist of approved domain names.

---

## 4. Unused Attack Surface (Legacy Code)
*   **Inactive Files:** Legacy adapters (`index.js`, `db/mysql.js`, `routes/mysql.js`, `routes/auth.js`) contain active Mongoose MongoDB connection setups and raw SQL query routes.
*   **Vulnerability:** Although bypassed by the live `orchestrator.js` runtime, these files are still present in the codebase, leaving an unpruned attack surface.
*   **Risk:** MEDIUM.
*   **Hardening Action:** Completely delete or comment out all legacy adapters and routes to prevent accidental startup or execution.

---

## 5. File Traversal & Path Validation
*   **Active Rules:** Express conversation service uses local JSON files for session data management.
*   **Vulnerability:** If user inputs are passed directly to path resolution functions when loading sessions, it could open paths to directory traversal exploits.
*   **Risk:** MEDIUM.
*   **Hardening Action:** Strictly validate conversation IDs against alphanumeric regular expressions to prevent path traversal injections.
