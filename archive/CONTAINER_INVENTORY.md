# Container Inventory

Generated: 2026-06-20 14:24:03 +03:00

Scope: all running and stopped Docker containers visible to this Docker daemon. Sensitive environment values matching KEY/PASSWORD/SECRET/TOKEN/CREDENTIAL are redacted; variable presence is preserved.

| Container Name | Container ID | Image Name | Image ID | Created | Running State | Exposed Ports |
|---|---:|---|---:|---|---|---|
| aast-ai-agent-backend-1 | 193319943a9d | aast-ai-agent/backend:local | a51876406bd4 | 2026-06-18T09:51:10.544614774Z | exited (exit 1) |  |
| aast-ai-agent-rag-answer-1 | 0b134145469e | aast-ai-agent/rag-answer:local | 5981e7d0e5cf | 2026-06-18T09:51:07.585557166Z | running (running) | 8002/tcp -> 127.0.0.1:8002 |
| aast-ai-agent-frontend-1 | 68c04b2d0a4f | aast-ai-agent/frontend:local | 7a78cc9be142 | 2026-06-17T17:39:10.933401411Z | exited (exit 0) |  |
| aast-ai-agent-rag-retriever-1 | df0aa7489f94 | aast-ai-agent/rag-retriever:local | b3840bd6cdbe | 2026-06-17T17:39:10.113436184Z | exited (exit 137) |  |
| aast-ai-agent-qdrant-1 | d3651ddd1439 | qdrant/qdrant:v1.12.5 | 05fecce7dce4 | 2026-06-17T17:39:09.49609327Z | running (running) | 6333/tcp -> 127.0.0.1:6333 |
| aast-ai-agent-decision-api-1 | 1496cd381aa8 | aast-ai-agent/decision-api:local | e0a65efbfe55 | 2026-06-17T17:39:09.492906995Z | running (running) | 8005/tcp -> 127.0.0.1:8005 |
| aast-ai-agent-neo4j-1 | 77b751e0a0fa | neo4j:5.26-community | 0b5d3ab6ec1b | 2026-06-17T17:39:09.491401043Z | exited (exit 137) |  |
| infra-frontend-1 | 3e3c2ac00263 | infra-frontend | 07c1a3a5a2e8 | 2026-06-12T22:17:50.343903172Z | exited (exit 0) |  |
| infra-backend-1 | 7d887b75eb0f | infra-backend | 1e6bd625a7f2 | 2026-06-12T22:17:50.227590894Z | exited (exit 0) |  |
| infra-db-bootstrap-1 | d37f07ed57c7 | infra-db-bootstrap | 679f01135db8 | 2026-06-12T22:17:50.112007449Z | exited (exit 0) |  |
| infra-db-1 | 5f48ecb4d0c2 | postgis/postgis:16-3.4 | 44126d872ac9 | 2026-06-12T22:17:49.983730345Z | exited (exit 0) |  |
| fair-price-eg-frontend-1 | a0145861dc88 | fair-price-eg-frontend | 802bb43e79ab | 2026-06-11T16:04:48.512127893Z | exited (exit 0) |  |
| fair-price-eg-backend-1 | e1ddc1f3c803 | fair-price-eg-backend | 4085ea97b687 | 2026-06-11T12:16:47.108806947Z | exited (exit 0) |  |
| fair-price-eg-db-bootstrap-1 | b1eb99fb644c | fair-price-eg-db-bootstrap | 00ae9787443e | 2026-06-11T12:16:46.702617767Z | exited (exit 0) |  |
| fair-price-eg-db-1 | 853f736497aa | postgis/postgis:16-3.4 | 44126d872ac9 | 2026-06-03T04:59:43.793220351Z | exited (exit 0) |  |
| fair-price-eg-clean-validation-backend-1 | 3c940c73298d | fair-price-eg-clean-validation-backend | a9d682ea11e0 | 2026-05-31T00:15:48.378774858Z | exited (exit 137) |  |
| fair-price-eg-clean-validation-db-bootstrap-1 | 95ef7643b255 | fair-price-eg-clean-validation-db-bootstrap | 09e0dbeb423e | 2026-05-31T00:13:05.660176466Z | exited (exit 0) |  |
| fair-price-eg-clean-validation-db-1 | 3544d4594da0 | postgis/postgis:16-3.4 | 44126d872ac9 | 2026-05-31T00:11:40.671775735Z | exited (exit 0) |  |
| fair-price-eg-staging-smoke-1 | b901c00dc216 | fair-price-eg-staging-smoke | f777439d406a | 2026-05-24T23:55:13.832233635Z | exited (exit 128) |  |
| qdrant_prod | 0c8b0019ef44 | qdrant/qdrant | f1c7272cdac5 | 2026-05-05T08:27:06.414986966Z | exited (exit 143) |  |
| nifty_shtern | b6942ea8bf20 | qdrant/qdrant | f1c7272cdac5 | 2026-05-05T08:17:27.846854349Z | exited (exit 130) |  |
| infallible_cannon | 572ab83ba3ad | qdrant/qdrant | f1c7272cdac5 | 2026-05-04T12:43:54.011888303Z | exited (exit 143) |  |
| amazing_saha | b1f0b1d0622b | qdrant/qdrant | f1c7272cdac5 | 2026-05-04T12:39:21.133660514Z | exited (exit 143) |  |
| priceless_lumiere | d4d3d18cb8cd | qdrant/qdrant | f1c7272cdac5 | 2026-05-04T12:24:43.893674488Z | exited (exit 255) |  |
| cranky_blackburn | aaeccaa6fed8 | qdrant/qdrant | f1c7272cdac5 | 2026-05-04T11:54:55.203820064Z | exited (exit 130) |  |
| trusting_heyrovsky | 60fe733f8293 | qdrant/qdrant | f1c7272cdac5 | 2026-05-03T13:17:51.10268991Z | exited (exit 143) |  |
| stoic_almeida | 64ca488609ef | qdrant/qdrant | f1c7272cdac5 | 2026-05-03T12:22:47.972063725Z | exited (exit 143) |  |
| youthful_allen | 0534a02eef06 | qdrant/qdrant | f1c7272cdac5 | 2026-05-03T11:40:19.112363888Z | exited (exit 130) |  |
| musing_jackson | d3875e24f42d | qdrant/qdrant | f1c7272cdac5 | 2026-05-02T20:38:49.102559825Z | exited (exit 143) |  |
| loving_pare | a2c08d5638ce | qdrant/qdrant | f1c7272cdac5 | 2026-05-01T12:51:57.082300324Z | exited (exit 143) |  |
| college-decision-support-system-frontend-1 | 0f8fda53fc92 | college-decision-support-system-frontend | 1c2b6565530b | 2026-04-16T13:55:44.955388372Z | running (running) | 80/tcp -> 0.0.0.0:80, :::80 |
| college-decision-support-system-backend-1 | 722f573d11d6 | college-decision-support-system-backend | ac4a02877447 | 2026-04-16T13:55:35.591055923Z | running (running) | 8000/tcp -> 0.0.0.0:8000, :::8000 |

## aast-ai-agent-backend-1
- Container ID: 193319943a9d341d23e3ec7b23afd95e3988c54c8519219180628969cfef8b2d
- Image Name: aast-ai-agent/backend:local
- Image ID: sha256:a51876406bd444fa6f151e238d1b95ad409008b6fc7dc4ec57e8ab4f898a4c02
- Created Date: 2026-06-18T09:51:10.544614774Z
- Running State: status=exited, running=False, exit_code=1, started=2026-06-20T11:02:41.717285931Z, finished=2026-06-20T11:06:44.56019462Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_backend_data/_data; destination=/app/data; rw=True; name=aast-ai-agent_backend_data
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_backend_logs/_data; destination=/app/logs; rw=True; name=aast-ai-agent_backend_logs
- Networks:
- aast-ai-agent_ai-agent-net; ip=; aliases=aast-ai-agent-backend-1,backend
- Environment Variables:
- NODE_OPTIONS=--max-old-space-size=4096
- FALLBACK_LLM_TIMEOUT_MS=20000
- OLLAMA_RETRY_MAX_DELAY_MS=1200
- DECISION_API_TIMEOUT_MS=7000
- PRIMARY_RETRY_LIMIT=1
- STARTUP_PRELOAD_ENABLED=true
- NEO4J_USER=neo4j
- PRIMARY_MODEL=gemma4:e2b
- RAG_RETRIEVER_PATH=/search
- LOG_DIR=/app/logs
- OLLAMA_RETRY_BASE_DELAY_MS=300
- BACKUP_MAX_FAILURES=1
- SYNTHESIS_TIMEOUT_MS=20000
- NEO4J_DATABASE=neo4j
- NODE_ENV=production
- PERIODIC_HEALTH_ENABLED=true
- RAG_TIMEOUT_MS=20000
- OLLAMA_STARTUP_WAIT_TIMEOUT_MS=45000
- RAG_ROUTE_TIMEOUT_MS=20000
- INTERNAL_SECRET_KEY=<REDACTED>
- RAG_RETRIEVER_URL=http://rag-retriever:8001
- PRIMARY_RECOVERY_SUCCESSES=2
- INTENT_DEADLINE_MS=20000
- PRIMARY_TIMEOUT_MS=20000
- NEO4J_URI=bolt://neo4j:7687
- MODEL_PRELOAD_TIMEOUT_MS=10000
- HYBRID_ROUTE_TIMEOUT_MS=20000
- RAG_HEALTH_TIMEOUT_MS=2500
- NEO4J_PASSWORD=<REDACTED>
- OLLAMA_TIMEOUT_MS=20000
- OLLAMA_STARTUP_WAIT_INTERVAL_MS=1500
- BREAKER_THRESHOLD=5
- RAG_ANSWER_PATH=/answer
- OLLAMA_STARTUP_WAIT_ENABLED=true
- ORCHESTRATOR_PORT=8004
- HEALTH_PROBE_INTERVAL_MS=30000
- BACKUP_TIMEOUT_MS=7000
- HALF_OPEN_INTERVAL_MS=30000
- PRIMARY_COLD_START_TIMEOUT_MS=22000
- QUERY_NORMALIZER_FUZZY=true
- RAG_MAX_RETRIES=1
- BACKUP_MODEL=tinyllama:latest
- FALLBACK_LLM_DEADLINE_MS=20000
- BACKUP_RETRY_LIMIT=0
- DECISION_API_MAX_ATTEMPTS=1
- SYNTHESIS_DEADLINE_MS=20000
- OLLAMA_BASE_URL=http://host.docker.internal:11434
- INTENT_TIMEOUT_MS=20000
- DECISION_API_URL=http://decision-api:8005
- RAG_BASE_URL=http://rag-retriever:8001
- LLM_REQUEST_DEADLINE_MS=20000
- OLLAMA_KEEP_ALIVE=10m
- PRIMARY_MAX_FAILURES=3
- INTENT_RETRY_LIMIT=0
- QUERY_NORMALIZER_MAX_CHARS=600
- GEMINI_API_KEY=<REDACTED>
- RAG_ANSWER_URL=http://rag-answer:8002
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- NODE_VERSION=20.20.2
- YARN_VERSION=1.22.22

## aast-ai-agent-rag-answer-1
- Container ID: 0b134145469ecf3324ee8203ac0635a881c93c013089c0f413952a1ea26d1f17
- Image Name: aast-ai-agent/rag-answer:local
- Image ID: sha256:5981e7d0e5cf942a1eca36f863f342a2ed652fe1d3a60944cec0bf3ab9aab8bc
- Created Date: 2026-06-18T09:51:07.585557166Z
- Running State: status=running, running=True, exit_code=0, started=2026-06-20T11:12:54.607391896Z, finished=2026-06-20T11:06:46.495603643Z
- Exposed Ports / Bindings:
- 8002/tcp => 127.0.0.1:8002
- Mounted Volumes:
- none
- Networks:
- aast-ai-agent_ai-agent-net; ip=172.18.0.4; aliases=aast-ai-agent-rag-answer-1,rag-answer
- Environment Variables:
- RAG_ANSWER_HEALTH_TIMEOUT_SECONDS=8
- RAG_RETRIEVER_URL=http://rag-retriever:8001
- OLLAMA_BASE_URL=http://host.docker.internal:11434
- RAG_ANSWER_MODEL=tinyllama
- RAG_ANSWER_TIMEOUT_SECONDS=180
- RAG_RETRIEVER_TIMEOUT_SECONDS=180
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

## aast-ai-agent-frontend-1
- Container ID: 68c04b2d0a4f5d4a15ae897cbfaeaf2c2032067b11dfea84121e247fa00bf8e4
- Image Name: aast-ai-agent/frontend:local
- Image ID: sha256:7a78cc9be14267dd40c37829e2e36ebcbd23418ca2969fe578e15739ef7c30d2
- Created Date: 2026-06-17T17:39:10.933401411Z
- Running State: status=exited, running=False, exit_code=0, started=2026-06-20T11:02:41.714347006Z, finished=2026-06-20T11:06:43.32072325Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- none
- Networks:
- aast-ai-agent_ai-agent-net; ip=; aliases=aast-ai-agent-frontend-1,frontend
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- NGINX_VERSION=1.27.5
- PKG_RELEASE=1
- DYNPKG_RELEASE=1
- NJS_VERSION=0.8.10
- NJS_RELEASE=1

## aast-ai-agent-rag-retriever-1
- Container ID: df0aa7489f94de731c3e9a63069e3980b755d996d704c4129ad7a4a67b30eced
- Image Name: aast-ai-agent/rag-retriever:local
- Image ID: sha256:b3840bd6cdbe5573bd65126f77693ab032a7c7f65339ae182885fc0248541adf
- Created Date: 2026-06-17T17:39:10.113436184Z
- Running State: status=exited, running=False, exit_code=137, started=2026-06-20T11:02:41.699678651Z, finished=2026-06-20T11:06:44.667092938Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_rag_hf_cache/_data; destination=/root/.cache/huggingface; rw=True; name=aast-ai-agent_rag_hf_cache
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_rag_torch_cache/_data; destination=/root/.cache/torch; rw=True; name=aast-ai-agent_rag_torch_cache
- Networks:
- aast-ai-agent_ai-agent-net; ip=; aliases=aast-ai-agent-rag-retriever-1,rag-retriever
- Environment Variables:
- QDRANT_PORT=6333
- TOKENIZERS_PARALLELISM=<REDACTED>
- RAG_EMBEDDING_DYNAMIC_QUANTIZE=false
- RAG_EMBEDDING_DEVICE=cpu
- RAG_EMBED_BATCH_SIZE=4
- RAG_LOW_CPU_MEM_USAGE=true
- RAG_TORCH_NUM_THREADS=1
- OMP_NUM_THREADS=1
- MKL_NUM_THREADS=1
- QDRANT_HOST=qdrant
- RAG_COLLECTION_NAME=aast_academic_rag_production
- RAG_EMBEDDING_INIT_MODE=lazy
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

## aast-ai-agent-qdrant-1
- Container ID: d3651ddd1439c289abeaf77240704b1497a316c048841a089923f71ef2482c52
- Image Name: qdrant/qdrant:v1.12.5
- Image ID: sha256:05fecce7dce45d1254e0468bc037e8210e187fd56fa847688b012293d5f08aae
- Created Date: 2026-06-17T17:39:09.49609327Z
- Running State: status=running, running=True, exit_code=0, started=2026-06-20T11:12:54.596367628Z, finished=2026-06-20T11:06:46.194075059Z
- Exposed Ports / Bindings:
- 6333/tcp => 127.0.0.1:6333
- Mounted Volumes:
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_qdrant_data/_data; destination=/qdrant/storage; rw=True; name=aast-ai-agent_qdrant_data
- Networks:
- aast-ai-agent_ai-agent-net; ip=172.18.0.2; aliases=aast-ai-agent-qdrant-1,qdrant
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## aast-ai-agent-decision-api-1
- Container ID: 1496cd381aa8bc050b2cd6b9b37de83067d68f4f7a78be860a4831c465ebd00f
- Image Name: aast-ai-agent/decision-api:local
- Image ID: sha256:e0a65efbfe55d45e46b5323c17b9be52eb3298bc32f27a15205f09c8a7e31886
- Created Date: 2026-06-17T17:39:09.492906995Z
- Running State: status=running, running=True, exit_code=0, started=2026-06-20T11:12:54.613749231Z, finished=2026-06-20T11:06:44.275905521Z
- Exposed Ports / Bindings:
- 8005/tcp => 127.0.0.1:8005
- Mounted Volumes:
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_decision_data/_data; destination=/app/runtime; rw=True; name=aast-ai-agent_decision_data
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_decision_whisper_cache/_data; destination=/root/.cache/whisper; rw=True; name=aast-ai-agent_decision_whisper_cache
- Networks:
- aast-ai-agent_ai-agent-net; ip=172.18.0.3; aliases=aast-ai-agent-decision-api-1,decision-api
- Environment Variables:
- PORT=8005
- DATABASE_URL=sqlite:////app/runtime/dev.db
- VOICE_TEMP_DIR=/app/runtime/voice
- GEMINI_API_KEY=<REDACTED>
- DEBUG=True
- INTERNAL_SECRET_KEY=<REDACTED>
- HOST=0.0.0.0
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

## aast-ai-agent-neo4j-1
- Container ID: 77b751e0a0fa3cf2c49564e3a9a6a9e90fdb55c046579c45beccf99ad072bcaf
- Image Name: neo4j:5.26-community
- Image ID: sha256:0b5d3ab6ec1b866890dbfb53bf4fe1cf039f9e03c96165599a403005b7e7bcc3
- Created Date: 2026-06-17T17:39:09.491401043Z
- Running State: status=exited, running=False, exit_code=137, started=2026-06-20T11:02:41.668020199Z, finished=2026-06-20T11:06:44.524758256Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_neo4j_data/_data; destination=/data; rw=True; name=aast-ai-agent_neo4j_data
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_neo4j_logs/_data; destination=/logs; rw=True; name=aast-ai-agent_neo4j_logs
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_neo4j_plugins/_data; destination=/plugins; rw=True; name=aast-ai-agent_neo4j_plugins
- type=volume; source=/var/lib/docker/volumes/aast-ai-agent_neo4j_import/_data; destination=/var/lib/neo4j/import; rw=True; name=aast-ai-agent_neo4j_import
- Networks:
- aast-ai-agent_ai-agent-net; ip=; aliases=aast-ai-agent-neo4j-1,neo4j
- Environment Variables:
- NEO4J_AUTH=neo4j/12345678
- NEO4J_dbms_default__database=neo4j
- NEO4J_server_memory_heap_initial__size=512m
- NEO4J_server_memory_heap_max__size=1G
- NEO4J_server_memory_pagecache_size=512m
- PATH=/var/lib/neo4j/bin:/opt/java/openjdk/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- JAVA_HOME=/opt/java/openjdk
- NEO4J_SHA256=dfc04996dbdab58a9b8a7d7dc2c6bbcad61c55d58a0c296197206135cd888c90
- NEO4J_TARBALL=neo4j-community-5.26.26-unix.tar.gz
- NEO4J_EDITION=community
- NEO4J_HOME=/var/lib/neo4j
- LANG=C.UTF-8

## infra-frontend-1
- Container ID: 3e3c2ac0026330d6c89e233cb097fcdc1d1b32707692b79d83d3ba798cd24a3d
- Image Name: infra-frontend
- Image ID: sha256:07c1a3a5a2e81d30d2be0d2d79d69e3cbf9a388ed293e1aa59e6f119f0eb90e3
- Created Date: 2026-06-12T22:17:50.343903172Z
- Running State: status=exited, running=False, exit_code=0, started=2026-06-12T22:18:27.440648546Z, finished=2026-06-12T22:19:29.018181906Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- none
- Networks:
- infra_default; ip=; aliases=infra-frontend-1,frontend
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- NGINX_VERSION=1.27.5
- PKG_RELEASE=1
- DYNPKG_RELEASE=1
- NJS_VERSION=0.8.10
- NJS_RELEASE=1

## infra-backend-1
- Container ID: 7d887b75eb0fb8e6a640c4803124d58a321b23231dd0bbb33aca180669d597fe
- Image Name: infra-backend
- Image ID: sha256:1e6bd625a7f2c0395aa9e11a14786ee4ec25d2f99c3151db8d2cdd35b9b18ca3
- Created Date: 2026-06-12T22:17:50.227590894Z
- Running State: status=exited, running=False, exit_code=0, started=2026-06-12T22:18:16.627803161Z, finished=2026-06-12T22:19:29.793692403Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\mobile computing project\data\db_clean; destination=/data; rw=False; name=
- Networks:
- infra_default; ip=; aliases=infra-backend-1,backend
- Environment Variables:
- SLOW_QUERY_MS=250
- JWT_ISSUER=valorai
- CORS_ORIGINS=http://localhost:3000;http://localhost:5173;http://127.0.0.1:3000;http://127.0.0.1:5173
- FIREBASE_PROJECT_ID=valorai-e25b8
- COPILOT_NARRATION_INTENTS=
- COPILOT_GEMINI_DATA_GOVERNANCE_ACKNOWLEDGED=false
- JWT_ACCESS_TOKEN_EXPIRE_MINUTES=<REDACTED>
- MAX_REQUEST_BODY_BYTES=65536
- API_REQUEST_TIMEOUT_SECONDS=20
- VALUATION_LATENCY_SLO_MS=1500
- LOG_JSON=true
- COPILOT_GEMINI_API_KEY=<REDACTED>
- COPILOT_NARRATION_ENABLED=false
- RATE_LIMIT_PER_MINUTE=120
- DB_STARTUP_RETRIES=30
- LOG_LEVEL=INFO
- SLOW_REQUEST_MS=1500
- DEBUG=false
- DB_STARTUP_RETRY_SECONDS=1
- JWT_SECRET=<REDACTED>
- API_LATENCY_SLO_MS=1200
- DATABASE_URL=postgresql+psycopg://fairprice:fairprice@db:5432/fairprice
- JWT_AUDIENCE=valorai-api
- ENV=production
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

## infra-db-bootstrap-1
- Container ID: d37f07ed57c7563d481edf34584ae21919f12c94d48a6a979e37c54acd24151a
- Image Name: infra-db-bootstrap
- Image ID: sha256:679f01135db8349432ec285125e5e55705e04cdedc08027b3e1769e1ff0a3df6
- Created Date: 2026-06-12T22:17:50.112007449Z
- Running State: status=exited, running=False, exit_code=0, started=2026-06-12T22:17:56.35880879Z, finished=2026-06-12T22:18:16.22414031Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\mobile computing project\data\db_clean; destination=/data; rw=False; name=
- Networks:
- infra_default; ip=; aliases=infra-db-bootstrap-1,db-bootstrap
- Environment Variables:
- DB_STARTUP_RETRIES=30
- LOG_JSON=true
- DB_STARTUP_RETRY_SECONDS=1
- ENV=production
- DATABASE_URL=postgresql+psycopg://fairprice:fairprice@db:5432/fairprice
- JWT_SECRET=<REDACTED>
- JWT_AUDIENCE=valorai-api
- JWT_ISSUER=valorai
- LOG_LEVEL=INFO
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

## infra-db-1
- Container ID: 5f48ecb4d0c2ee9dcbca406b18c0d14d152b68b38c852b70c760902c4fdc080b
- Image Name: postgis/postgis:16-3.4
- Image ID: sha256:44126d872ac91993766c341e369c539e8196614321765d36a6f1bab0419a5fa5
- Created Date: 2026-06-12T22:17:49.983730345Z
- Running State: status=exited, running=False, exit_code=0, started=2026-06-12T22:17:50.573061557Z, finished=2026-06-12T22:19:30.503024163Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=volume; source=/var/lib/docker/volumes/infra_db_data/_data; destination=/var/lib/postgresql/data; rw=True; name=infra_db_data
- Networks:
- infra_default; ip=; aliases=infra-db-1,db
- Environment Variables:
- POSTGRES_PASSWORD=<REDACTED>
- POSTGRES_DB=fairprice
- POSTGRES_USER=fairprice
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/16/bin
- GOSU_VERSION=1.17
- LANG=en_US.utf8
- PG_MAJOR=16
- PG_VERSION=16.4-1.pgdg110+2
- PGDATA=/var/lib/postgresql/data
- POSTGIS_MAJOR=3
- POSTGIS_VERSION=3.4.3+dfsg-2.pgdg110+1

## fair-price-eg-frontend-1
- Container ID: a0145861dc88d272e53ce65fafd2665bad2a0abbd6a1a7afe85c30aecfabf19b
- Image Name: fair-price-eg-frontend
- Image ID: sha256:802bb43e79ab45ce0c1c2aba25a3d2d8621069d0e477f1a0820e141daee4dd0d
- Created Date: 2026-06-11T16:04:48.512127893Z
- Running State: status=exited, running=False, exit_code=0, started=2026-06-12T22:07:14.848369171Z, finished=2026-06-12T22:12:28.109240275Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- none
- Networks:
- fair-price-eg_default; ip=; aliases=fair-price-eg-frontend-1,frontend
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- NGINX_VERSION=1.27.5
- PKG_RELEASE=1
- DYNPKG_RELEASE=1
- NJS_VERSION=0.8.10
- NJS_RELEASE=1

## fair-price-eg-backend-1
- Container ID: e1ddc1f3c803f446b18e59c4b4b323a9de84bbf34c066ed756a5d04c68452372
- Image Name: fair-price-eg-backend
- Image ID: sha256:4085ea97b687825b3c40ca0723c1bf9bb795c53c395688d3b032305c4c1fd30f
- Created Date: 2026-06-11T12:16:47.108806947Z
- Running State: status=exited, running=False, exit_code=0, started=2026-06-12T22:07:14.897456393Z, finished=2026-06-12T22:12:28.945067629Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\data; destination=/data; rw=False; name=
- Networks:
- fair-price-eg_default; ip=; aliases=fair-price-eg-backend-1,backend
- Environment Variables:
- COPILOT_NARRATION_INTENTS=
- DATABASE_URL=postgresql+psycopg://fairprice:fairprice@db:5432/fairprice
- SLOW_REQUEST_MS=1500
- DEBUG=false
- JWT_AUDIENCE=valorai-api
- FIREBASE_PROJECT_ID=valorai-e25b8
- DB_STARTUP_RETRIES=30
- VALUATION_LATENCY_SLO_MS=1500
- RATE_LIMIT_PER_MINUTE=120
- JWT_ISSUER=valorai
- COPILOT_GEMINI_DATA_GOVERNANCE_ACKNOWLEDGED=false
- ENV=production
- COPILOT_NARRATION_ENABLED=false
- LOG_LEVEL=INFO
- LOG_JSON=false
- API_LATENCY_SLO_MS=1200
- CORS_ORIGINS=http://localhost:3000;http://127.0.0.1:3000;http://localhost:5173;http://127.0.0.1:5173
- DB_STARTUP_RETRY_SECONDS=1
- JWT_ACCESS_TOKEN_EXPIRE_MINUTES=<REDACTED>
- JWT_SECRET=<REDACTED>
- API_REQUEST_TIMEOUT_SECONDS=20
- COPILOT_GEMINI_API_KEY=<REDACTED>
- SLOW_QUERY_MS=250
- MAX_REQUEST_BODY_BYTES=65536
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

## fair-price-eg-db-bootstrap-1
- Container ID: b1eb99fb644c8663b171b069870e9a73c0c815b8c087ed9c1ca3905df8d403e1
- Image Name: fair-price-eg-db-bootstrap
- Image ID: sha256:00ae9787443e2e8f5edaa9ffa141896b1c169fa5e6cbf77ece5c6de741911b05
- Created Date: 2026-06-11T12:16:46.702617767Z
- Running State: status=exited, running=False, exit_code=0, started=2026-06-11T16:04:49.675658006Z, finished=2026-06-11T16:05:06.402643944Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\data; destination=/data; rw=False; name=
- Networks:
- fair-price-eg_default; ip=; aliases=fair-price-eg-db-bootstrap-1,db-bootstrap
- Environment Variables:
- JWT_ISSUER=valorai
- JWT_AUDIENCE=valorai-api
- DB_STARTUP_RETRIES=30
- ENV=production
- JWT_SECRET=<REDACTED>
- DB_STARTUP_RETRY_SECONDS=1
- LOG_LEVEL=INFO
- DATABASE_URL=postgresql+psycopg://fairprice:fairprice@db:5432/fairprice
- LOG_JSON=false
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

## fair-price-eg-db-1
- Container ID: 853f736497aaf201cad6b8943709756f6e0413ceb5391e7308e1e14142a949df
- Image Name: postgis/postgis:16-3.4
- Image ID: sha256:44126d872ac91993766c341e369c539e8196614321765d36a6f1bab0419a5fa5
- Created Date: 2026-06-03T04:59:43.793220351Z
- Running State: status=exited, running=False, exit_code=0, started=2026-06-12T22:07:14.865476274Z, finished=2026-06-12T22:12:29.375301069Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=volume; source=/var/lib/docker/volumes/fair-price-eg_db_data/_data; destination=/var/lib/postgresql/data; rw=True; name=fair-price-eg_db_data
- Networks:
- fair-price-eg_default; ip=; aliases=fair-price-eg-db-1,db
- Environment Variables:
- POSTGRES_DB=fairprice
- POSTGRES_USER=fairprice
- POSTGRES_PASSWORD=<REDACTED>
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/16/bin
- GOSU_VERSION=1.17
- LANG=en_US.utf8
- PG_MAJOR=16
- PG_VERSION=16.4-1.pgdg110+2
- PGDATA=/var/lib/postgresql/data
- POSTGIS_MAJOR=3
- POSTGIS_VERSION=3.4.3+dfsg-2.pgdg110+1

## fair-price-eg-clean-validation-backend-1
- Container ID: 3c940c73298dde1ff5598863fcbb48b56d7d309ee0dbee4fa5e71c623d159d2a
- Image Name: fair-price-eg-clean-validation-backend
- Image ID: sha256:a9d682ea11e07dcb87361f733d80e831ac575b8a376eb362a95a1a3ffdbf97c5
- Created Date: 2026-05-31T00:15:48.378774858Z
- Running State: status=exited, running=False, exit_code=137, started=2026-06-02T20:03:06.777382101Z, finished=2026-06-02T20:15:38.606204064Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\data; destination=/data; rw=False; name=
- Networks:
- fair-price-eg-clean-validation_default; ip=; aliases=fair-price-eg-clean-validation-backend-1,backend
- Environment Variables:
- DATABASE_URL=postgresql+psycopg://fairprice:fairprice@db:5432/fairprice
- MAX_REQUEST_BODY_BYTES=65536
- DB_STARTUP_RETRY_SECONDS=1
- ENV=production
- SLOW_REQUEST_MS=1500
- LOG_LEVEL=INFO
- DEBUG=false
- API_LATENCY_SLO_MS=1200
- CORS_ORIGINS=http://localhost:3000;http://127.0.0.1:3000
- VALUATION_LATENCY_SLO_MS=1500
- LOG_JSON=true
- RATE_LIMIT_PER_MINUTE=120
- DB_STARTUP_RETRIES=30
- SLOW_QUERY_MS=250
- API_REQUEST_TIMEOUT_SECONDS=20
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

## fair-price-eg-clean-validation-db-bootstrap-1
- Container ID: 95ef7643b255ecc5105026f27b92a674a100403e4867cdb033ef3921fdb617c1
- Image Name: fair-price-eg-clean-validation-db-bootstrap
- Image ID: sha256:09e0dbeb423e16126eb027ec84ccfc1eb5664fbb80e26463c3986f58aa8111be
- Created Date: 2026-05-31T00:13:05.660176466Z
- Running State: status=exited, running=False, exit_code=0, started=2026-05-31T00:15:49.132973985Z, finished=2026-05-31T00:16:17.251691542Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\data; destination=/data; rw=False; name=
- Networks:
- fair-price-eg-clean-validation_default; ip=; aliases=fair-price-eg-clean-validation-db-bootstrap-1,db-bootstrap
- Environment Variables:
- DB_STARTUP_RETRY_SECONDS=1
- ENV=production
- LOG_LEVEL=INFO
- LOG_JSON=true
- DATABASE_URL=postgresql+psycopg://fairprice:fairprice@db:5432/fairprice
- DB_STARTUP_RETRIES=30
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

## fair-price-eg-clean-validation-db-1
- Container ID: 3544d4594da014d546ab44f313d67c704be0440abfa6a32a1b8eac5094183ea0
- Image Name: postgis/postgis:16-3.4
- Image ID: sha256:44126d872ac91993766c341e369c539e8196614321765d36a6f1bab0419a5fa5
- Created Date: 2026-05-31T00:11:40.671775735Z
- Running State: status=exited, running=False, exit_code=0, started=2026-06-02T20:03:06.803688797Z, finished=2026-06-02T20:15:39.265733032Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=volume; source=/var/lib/docker/volumes/fair-price-eg-clean-validation_db_data/_data; destination=/var/lib/postgresql/data; rw=True; name=fair-price-eg-clean-validation_db_data
- Networks:
- fair-price-eg-clean-validation_default; ip=; aliases=fair-price-eg-clean-validation-db-1,db
- Environment Variables:
- POSTGRES_DB=fairprice
- POSTGRES_USER=fairprice
- POSTGRES_PASSWORD=<REDACTED>
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/lib/postgresql/16/bin
- GOSU_VERSION=1.17
- LANG=en_US.utf8
- PG_MAJOR=16
- PG_VERSION=16.4-1.pgdg110+2
- PGDATA=/var/lib/postgresql/data
- POSTGIS_MAJOR=3
- POSTGIS_VERSION=3.4.3+dfsg-2.pgdg110+1

## fair-price-eg-staging-smoke-1
- Container ID: b901c00dc2167722eb995d6d8e7f770b759df688bd398e9d13f6ade21bc8bed2
- Image Name: fair-price-eg-staging-smoke
- Image ID: sha256:f777439d406aac2499406a810f981bf5bf8c966572536873e30c8ce9d9373e29
- Created Date: 2026-05-24T23:55:13.832233635Z
- Running State: status=exited, running=False, exit_code=128, started=2026-05-24T23:55:40.866905442Z, finished=2026-05-24T23:55:41.459059067Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- none
- Networks:
- fair-price-eg_default; ip=; aliases=fair-price-eg-staging-smoke-1,staging-smoke
- Environment Variables:
- DATABASE_URL=postgresql+psycopg://fairprice:fairprice@db:5432/fairprice
- ENV=staging
- LOG_LEVEL=INFO
- LOG_JSON=true
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

## qdrant_prod
- Container ID: 0c8b0019ef441d58b0027402bf785a989e546eeabab5d66608cb128abada8d54
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-05T08:27:06.414986966Z
- Running State: status=exited, running=False, exit_code=143, started=2026-06-17T15:41:16.128293955Z, finished=2026-06-17T16:52:03.344628404Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=volume; source=/var/lib/docker/volumes/qdrant_storage/_data; destination=/qdrant/storage; rw=True; name=qdrant_storage
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## nifty_shtern
- Container ID: b6942ea8bf2074b1e3c8f94d44294b9fd3377a480f7000e8be4c09546ed119e3
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-05T08:17:27.846854349Z
- Running State: status=exited, running=False, exit_code=130, started=2026-05-05T08:17:28.125113481Z, finished=2026-05-05T08:25:18.780323533Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- none
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## infallible_cannon
- Container ID: 572ab83ba3ad03ac82775c7c54cf01d44c84b5e6afddceb896e0ff16198d9240
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-04T12:43:54.011888303Z
- Running State: status=exited, running=False, exit_code=143, started=2026-05-04T12:43:54.2672688Z, finished=2026-05-04T13:17:04.40208952Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- none
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## amazing_saha
- Container ID: b1f0b1d0622b01dc472dc825c352f233cc7b1525d542de1082dda3d812ea3adb
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-04T12:39:21.133660514Z
- Running State: status=exited, running=False, exit_code=143, started=2026-05-04T12:39:21.331231626Z, finished=2026-05-04T12:42:15.704288875Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- none
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## priceless_lumiere
- Container ID: d4d3d18cb8cdc71b03f15a0dc9bd56490bd6b19c4101f0e3a4d3bf010dd7aabb
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-04T12:24:43.893674488Z
- Running State: status=exited, running=False, exit_code=255, started=2026-05-04T12:24:44.065383072Z, finished=2026-05-04T12:38:18.857088822Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- none
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## cranky_blackburn
- Container ID: aaeccaa6fed85050881d3992f22e4853f6f68a929de4e893e104d90181e84c89
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-04T11:54:55.203820064Z
- Running State: status=exited, running=False, exit_code=130, started=2026-05-04T11:54:55.401769849Z, finished=2026-05-04T12:08:19.102967819Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- none
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## trusting_heyrovsky
- Container ID: 60fe733f8293c6568d5a0aeefcef4017e095204e63b863f430fe8d25b0bd72a1
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-03T13:17:51.10268991Z
- Running State: status=exited, running=False, exit_code=143, started=2026-05-03T13:17:51.261510405Z, finished=2026-05-03T13:25:02.674989027Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- none
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## stoic_almeida
- Container ID: 64ca488609effbbc9b1280d4fcccd2e4c22d5744ae17303e8608a8b5dcd1e1ab
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-03T12:22:47.972063725Z
- Running State: status=exited, running=False, exit_code=143, started=2026-05-03T12:22:48.210571255Z, finished=2026-05-03T13:14:09.408988142Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\AI_AGENT\aast-ai-agent-main\backend\rag_system\qdrant_storage; destination=/qdrant/storage; rw=True; name=
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## youthful_allen
- Container ID: 0534a02eef06909343668d7026034d0336f6533cd8e26e22505a796a7856291a
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-03T11:40:19.112363888Z
- Running State: status=exited, running=False, exit_code=130, started=2026-05-03T11:40:19.27179577Z, finished=2026-05-03T12:22:43.980184794Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\AI_AGENT\aast-ai-agent-main\backend\rag_system\qdrant_storage; destination=/qdrant/storage; rw=True; name=
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## musing_jackson
- Container ID: d3875e24f42d27f9b90d2f16fd4c898699233bdf97ded6fed1d5a19138ef1e58
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-02T20:38:49.102559825Z
- Running State: status=exited, running=False, exit_code=143, started=2026-05-02T20:38:49.685659046Z, finished=2026-05-02T20:50:40.899394636Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\AI_AGENT\aast-ai-agent-main\backend\rag_system\qdrant_storage; destination=/qdrant/storage; rw=True; name=
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## loving_pare
- Container ID: a2c08d5638ce1950cec867443ee51d7ace86bcd99ee55fe548f67497a1cc189a
- Image Name: qdrant/qdrant
- Image ID: sha256:f1c7272cdac52b38c1a0e89313922d940ba50afd90d593a1605dbbc214e66ffb
- Created Date: 2026-05-01T12:51:57.082300324Z
- Running State: status=exited, running=False, exit_code=143, started=2026-05-01T12:51:57.330523065Z, finished=2026-05-01T15:05:18.062808935Z
- Exposed Ports / Bindings:
- none
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\CAI_AAST\qdrant_storage; destination=/qdrant/storage; rw=True; name=
- Networks:
- bridge; ip=; aliases=
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- DIR=
- TZ=Etc/UTC
- RUN_MODE=production

## college-decision-support-system-frontend-1
- Container ID: 0f8fda53fc92a7ea86e82da1eea0d7211b9995c8223de9da6f65d233ebfc7932
- Image Name: college-decision-support-system-frontend
- Image ID: sha256:1c2b6565530beee0efcc44e5292140ab4e790d65ddd51dfea9ade493d51fcc7b
- Created Date: 2026-04-16T13:55:44.955388372Z
- Running State: status=running, running=True, exit_code=0, started=2026-06-20T11:12:48.244960803Z, finished=2026-06-20T11:03:10.337963741Z
- Exposed Ports / Bindings:
- 80/tcp => 0.0.0.0:80, :::80
- Mounted Volumes:
- none
- Networks:
- college-decision-support-system_default; ip=172.21.0.2; aliases=college-decision-support-system-frontend-1,frontend
- Environment Variables:
- PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- NGINX_VERSION=1.30.0
- PKG_RELEASE=1
- DYNPKG_RELEASE=1
- NJS_VERSION=0.9.6
- NJS_RELEASE=1
- ACME_VERSION=0.3.1

## college-decision-support-system-backend-1
- Container ID: 722f573d11d6fc2350f8358fa065d39abe502f88660a622c78aa0f7ceeef7190
- Image Name: college-decision-support-system-backend
- Image ID: sha256:ac4a02877447a10bc471f52cd958b8fe8207f988754030e873e79f2524c16e4d
- Created Date: 2026-04-16T13:55:35.591055923Z
- Running State: status=running, running=True, exit_code=0, started=2026-06-20T11:12:48.24968576Z, finished=2026-06-20T11:03:11.839053873Z
- Exposed Ports / Bindings:
- 8000/tcp => 0.0.0.0:8000, :::8000
- Mounted Volumes:
- type=bind; source=C:\Users\mh978\Downloads\college-decision - support-system\college-decision-system-backend; destination=/app; rw=True; name=
- type=volume; source=/var/lib/docker/volumes/123ee8246352838684cc3db416ee4beecc17b56f7fa004e6e2b2b14487eb2386/_data; destination=/app/node_modules; rw=True; name=123ee8246352838684cc3db416ee4beecc17b56f7fa004e6e2b2b14487eb2386
- Networks:
- college-decision-support-system_default; ip=172.21.0.3; aliases=college-decision-support-system-backend-1,backend
- Environment Variables:
- DATABASE_URL=sqlite:///./dev.db
- GEMINI_API_KEY=<REDACTED>
- DEBUG=True
- PATH=/usr/local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
- LANG=C.UTF-8
- GPG_KEY=<REDACTED>
- PYTHON_VERSION=3.11.15
- PYTHON_SHA256=272179ddd9a2e41a0fc8e42e33dfbdca0b3711aa5abf372d3f2d51543d09b625
- PYTHONDONTWRITEBYTECODE=1
- PYTHONUNBUFFERED=1

