# Cleanup verification

**Stage F · C00–C03 · verified local source and existing appliance**

The cleanup is applied and uncommitted at `6367b0df`. Baseline source tests ran before the edits. Post-cleanup source gates used the same native dependency installation. The runtime smoke hit the existing July image and is evidence of appliance continuity. [Execution and rollback](13_CLEANUP_EXECUTION_LOG.md) · [Manifest and hashes](cleanup_manifest.json)

| Gate | Baseline | After cleanup |
|---|---|---|
| Backend scripts | `npm run test:health`, `test:kg`, `test:topology`, `test:auth`, `test:auth-provisioning`, `test:admin-proxy`, `test:golden-cache`, `test:routing` and `test:decision` passed. | All nine passed again. `node --check` passed for the three edited JS files. |
| Backend focused tests | Eight Node harnesses passed. | `conversationalIntelligence`, `demoConversationMemory`, `demoConversationFollowup`, `retrievalEntityAlignment`, `groundingVerification`, `fusionEvidenceContract`, `fallbackTruthContract` and `directRagGroundingContract` passed. Each is under `aast-ai-agent-main/backend/testing/<name>.test.js`. |
| Frontend | `npm test` passed nine native tests plus standalone Decision truth. Lint, `tsc --noEmit --project tsconfig.app.json` and build passed. | Same pass. Vite built 3,857 modules into a fresh temporary outDir. Same 1,113.83 kB JS / 343.62 kB gzip and known Browserslist and external-outDir warnings. |
| Python RAG | `python -m pytest -p no:cacheprovider -q test_phase3_retriever.py test_rag_readiness.py` passed 57 tests and 12 subtests. | Same counts. Both edited Python modules compiled with no bytecode output. |
| Python Decision | `python scripts/run_delivery_checks.py` passed 44 tests plus isolated migration, integrity and service smoke checks. | Same counts and hermetic delivery success. |
| Appliance health | Frontend, advisor, Neo4j, Qdrant, retriever, answer and Decision 200. July image and supervisor verified. | Same image ID and revision. Frontend, advisor and all five internal probes returned 200. |
| Appliance conversation | 25 guest conversations, 125 responses and steady CIDs. | Fresh guest authentication and three sequential chat responses returned meaningful envelopes with one steady CID. Smoke checks HTTP, answer presence and state continuity. See [full diagnostic](04_CONVERSATION_TRANSCRIPTS.md) for observed relevance and attribution defects. |
| Git scope | 48 modified tracked Markdown paths, 10 untracked documentation paths, clean index and  five clean planned source paths. | Same prior paths plus the five scoped source edits. Zero staged paths, same HEAD. Scoped `git diff --check` passed. Git emitted its existing LF/CRLF conversion notice for three JS files, and pre-existing byte line terminators were preserved in the patch. |

The source tests include HTTP contract fixtures and a hermetic Decision service check. A resource-constrained host and the live/source mismatch prevented a second full-stack deployment of the cleaned August source during this audit. T-00 and T-70 require exact-revision image and integrated smoke before a rebuilt release is promoted. [Runtime audit](01_REPOSITORY_AND_RUNTIME_AUDIT.md) · [Release tests](18_TESTING_AND_REGRESSION_STRATEGY.md)

## Deliverable and reversal checks

A non-mutating reverse-patch check passed for all five source paths. Git warned that reversing the patch would restore seven whitespace-only lines from an original private code block. No reverse was applied. Final scope reconciliation matched the preflight path list plus those five changes. The deliverable check parsed all five machine-readable files, resolved report links and task paths, joined the 89 observed case IDs to the 125 request records and verified the five post-edit source digests in the manifest and task merge dependencies.
