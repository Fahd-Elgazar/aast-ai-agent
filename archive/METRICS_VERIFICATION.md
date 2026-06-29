# Metrics Verification

Generated: 2026-06-20 14:27:15 +03:00

## Backend Endpoint Probes
| URL | Result |
|---|---|
| http://127.0.0.1:8004/health | connection failed: backend container not running |
| http://127.0.0.1:8004/api/health | connection failed: backend container not running |
| http://127.0.0.1:8004/health/metrics | connection failed: backend container not running |

## Related Service Probes
| URL | Result |
|---|---|
| http://127.0.0.1:8002/health | HTTP 503 from rag-answer |
| http://127.0.0.1:8002/api/health | HTTP 404 from rag-answer |
| http://127.0.0.1:8002/health/metrics | HTTP 404 from rag-answer |
| http://127.0.0.1:8005/health | HTTP 200 from decision-api |
| http://127.0.0.1:6333/ | HTTP 200 from qdrant |

## Metrics Verdict
The requested backend metrics endpoint is not reachable. Gemma metrics are not verifiably present at runtime because the backend is stopped and /health/metrics cannot be reached.
