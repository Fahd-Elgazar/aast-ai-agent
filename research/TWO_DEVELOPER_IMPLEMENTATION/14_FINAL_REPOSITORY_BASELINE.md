# Verified GitHub source baseline

Both developers can fetch the **same public source snapshot** on `integration/latest-project-baseline`. The synchronized application and test revision is `1ffc196b402cad48b0fea7c952d1d7584fce2d05`. Follow-up commits that finalize these planning documents do not change that source. Pin the source SHA for tests. Branch from the reviewed integration head for work after P0. [Synchronized source](https://github.com/Fahd-Elgazar/aast-ai-agent/tree/1ffc196b402cad48b0fea7c952d1d7584fce2d05) · [Integration branch](https://github.com/Fahd-Elgazar/aast-ai-agent/tree/integration/latest-project-baseline)

| Identity | Verified observation |
|---|---|
| Integrated local source | `6367b0df91f208e518fb7e04cd7c81bdb82b9ae4` on unified-platform. Zero later commits on that branch, zero staged paths, 53 modified tracked paths (48 Markdown plus the five cleanup paths) and 10 untracked documentation files. |
| Earlier public source | `3e2f0100254a0d20a9e81b52d28c127d612f9dc1` on main and reliability-hardening. The private local line is 61 commits ahead and changes 264 paths relative to that public tree. |
| Historical plan | `b79a5e76a6fa35a8e983d9d33f5378639f2f86f6` on plan/conversation-two-developer, with all 17 original artifacts. It is the first parent of the screened application snapshot. |
| Published code | `ee4d0f7950385b798e54c9cd23e7f2fee2819617` copies the selected source and fixtures and adds 26 audit files. `1ffc196b402cad48b0fea7c952d1d7584fce2d05` carries the four existing backend/frontend manifest and lockfile changes from `fb1dc3668ec537513f906de027176a46d53c2b59`. |
| Running Docker appliance | Healthy July image `sha256:13b75b6fd0ed9c841d121e4d35ce96e883e18be9e3d12031b9b6af732ac08257`, OCI revision `4a38cf5f9969e893cf04a39e1306a74cc8fbe939`. Docker 28.5.1, Compose 2.40.0-desktop.1. The inspection identifies the running image only. |
| Native tools used | Node 22.21.0, npm 10.9.4, CPython 3.10.10 with installed RAG and Decision dependencies. Installed Python 3.11 is distinct; CI declares Python 3.11 for Decision. |

## Published scope and exclusions

- The selected source captures authenticated owner-scoped advisor and conversation routes, standalone/appliance configuration, typed memory, graph and RAG provenance, sentence grounding, frontend response ordering and cancellation, Decision ranking and envelope truth, retrieval/readiness gates, synthetic Decision fixtures, and Compose environment examples. Source files and tests match the August commit except the four dependency files. README and appliance instructions were updated for the GitHub handoff.
- Kept the original public planning history. The 61 unpublished commits include archived patch bundles, demo result exports and superseded project-management material. A screened snapshot keeps those ancestors outside the public branch. The [published audit](../CONVERSATIONAL_AGENT_REBUILD/PUBLICATION_NOTE.md) keeps the diagnostic method, findings, synthetic prompts, turn dispositions, cleanup manifest and roadmap. Raw reply text, retrieved passages, request/session identifiers and server logs stay with the originals.
- Unstaged project-management edits, the unpublished PDF, historical evaluation records, and local documentation with machine-specific or unverified state remain in their original locations. The committed stabilization architecture, integrated fixes and workstream overview are available here. Unmerged conversation, admission, cancellation and frontend changes overlap with owned phases and require focused acceptance tests before adoption. The Decision and RAG readiness branch patches already have equivalents in the integrated line. The isolated dependency patch was the additional committed change selected for synchronization.
- Local environment files, credentials, databases, embedding/model weights, institutional corpora, caches, node_modules, build outputs and the accepted manuscript were excluded. The graph, vector and institutional Decision datasets must come through an approved source; their release fingerprints are pending.

## Cleanup status

C00–C03 remain **pending independent Claude Code review**. All five working-copy SHA-256 values match the original manifest. The diff adds 5 lines and removes 272. A separate patch was exported locally, passed `git apply --check` against the publication candidate, and has SHA-256 `1d347439e67559f409dd272c6373dd09e5f4f0f335ef5553cb2c045652237c94`. Mohammed supplies that file to the reviewer through a private channel. The five published source files match their original pre-cleanup Git blob IDs. Do not infer approval from the earlier audit or application check. [Patch manifest](../CONVERSATIONAL_AGENT_REBUILD/cleanup_manifest.json) · [Before/after Git blobs](planning_verification_report.md)

## Verification performed

| Check | Status and result |
|---|---|
| Backend clean npm install | **PASS** on both original and carried dependency sets. All nine npm checks and nine focused Node tests in [test gates](06_TESTING_AND_ACCEPTANCE_GATES.md) passed on both. |
| Frontend clean npm install, test, lint, explicit tsc and production build | **PASS** on both dependency sets. |
| RAG pytest | **PASS** · 57 tests and 12 subtests on the synchronized Python source. |
| Decision delivery script | **PASS** · 44 tests, SQLite migrations, integrity audit and hermetic API smoke. |
| Docker Compose parser | **PASS** · standalone, appliance and private-corpus service discovery using config --no-interpolate --services. This parses the service model only. |
| Source diff hygiene | Strict diff check flagged 14 inherited extra blank lines at EOF. Each staged file matched the August source blob. Rerun with only blank-at-EOF disabled: **PASS**. Dependency and planning diffs pass the strict check independently. |
| Secret scan and disclosure check | **PASS** · Gitleaks on staged diffs and outgoing commits, plus path restriction and credential-pattern checks. |
| npm runtime dependency audit | **FAIL** as a vulnerability-free gate. After carrying the patch, backend reports 1 critical, 3 high and 1 moderate (critical aggregate on proxy-addr). Frontend reports 3 high and 2 moderate, down from 9 findings. Mohammed records disposition under BASE and CANDIDATE before approving a release. |
| Exact-revision full stack, Gemini/Ollama warm comparison, 125-turn rerun, cleanup-after rerun on machine 2 | **NOT RUN here**. P0/P5 require an isolated authorized corpus/graph/profile, verified model fingerprints, and independent review. Historical results on the July image and the original cleanup are separate evidence. |

## Reproducible synthetic fixtures

SHA-256 values below use the Git blob bytes. On a Windows checkout with CRLF conversion, use Git blob bytes or normalize line endings before comparison.

| File under research/CONVERSATIONAL_AGENT_REBUILD | SHA-256 |
|---|---|
| conversation_results.jsonl · 125 fixed synthetic turns in 25 sessions | `59d1bdb297c815476c2e5034a642bfc5f2b9f47a2109290378d4327316307b19` |
| conversation_scenarios.json · prompts and intended behavior | `98f6cd99cc80e1102423c1a978a446162fee8a2bc807d891d91f271763793ad2` |
| failure_catalog.json · 89 failure records | `c839be3325ed549d5595cf847c54ad2ac28088b6b9834fe054e00aa615868525` |
| cleanup_manifest.json | `485611047e3a5d74bd3c064d663cbe40edd2fb1e6f0ca70555da65a977d3207b` |
