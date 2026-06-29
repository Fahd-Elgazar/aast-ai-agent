# Post Deployment Verification

Generated: 2026-06-20 14:44:34 +03:00

## Deployment Result
PARTIAL. The deployment could not fully complete because frontend build failed, Neo4j could not bind host port 7687, and backend is restart-looping on a missing dependency.

## Service State
``text
NAME                            IMAGE                               COMMAND                  SERVICE         CREATED         STATUS                         PORTS
aast-ai-agent-backend-1         aast-ai-agent/backend:local         "docker-entrypoint.s…"   backend         2 minutes ago   Restarting (1) 8 seconds ago   
aast-ai-agent-decision-api-1    aast-ai-agent/decision-api:local    "sh -c 'if [ ! -f /a…"   decision-api    2 minutes ago   Up 2 minutes (healthy)         127.0.0.1:8005->8005/tcp
aast-ai-agent-frontend-1        aast-ai-agent/frontend:local        "/docker-entrypoint.…"   frontend        2 days ago      Exited (0) 37 minutes ago      
aast-ai-agent-neo4j-1           neo4j:5.26-community                "tini -g -- /startup…"   neo4j           2 minutes ago   Created                        
aast-ai-agent-qdrant-1          qdrant/qdrant:v1.12.5               "./entrypoint.sh"        qdrant          2 minutes ago   Up 2 minutes (healthy)         127.0.0.1:6333->6333/tcp
aast-ai-agent-rag-answer-1      aast-ai-agent/rag-answer:local      "uvicorn phase4_llm_…"   rag-answer      2 minutes ago   Up 2 minutes (healthy)         127.0.0.1:8002->8002/tcp
aast-ai-agent-rag-retriever-1   aast-ai-agent/rag-retriever:local   "uvicorn phase3_retr…"   rag-retriever   2 minutes ago   Up 2 minutes (healthy)         127.0.0.1:8001->8001/tcp

``

## Inspect Summary
``text
NAME=/aast-ai-agent-backend-1 STATUS=restarting RUNNING=true HEALTH=unhealthy EXIT=1 IMAGE=sha256:44b656696c0e6b6728217b5cef3ebc99b1a7101a12956742d650e63ef762f626
NAME=/aast-ai-agent-frontend-1 STATUS=exited RUNNING=false HEALTH=unhealthy EXIT=0 IMAGE=sha256:7a78cc9be14267dd40c37829e2e36ebcbd23418ca2969fe578e15739ef7c30d2
NAME=/aast-ai-agent-neo4j-1 STATUS=created RUNNING=false HEALTH=none EXIT=0 IMAGE=sha256:0b5d3ab6ec1b866890dbfb53bf4fe1cf039f9e03c96165599a403005b7e7bcc3
NAME=/aast-ai-agent-qdrant-1 STATUS=running RUNNING=true HEALTH=healthy EXIT=0 IMAGE=sha256:05fecce7dce45d1254e0468bc037e8210e187fd56fa847688b012293d5f08aae
NAME=/aast-ai-agent-rag-retriever-1 STATUS=running RUNNING=true HEALTH=healthy EXIT=0 IMAGE=sha256:423720f8cae2f996d1de5f44cbda8187ab3e792258d8d51fa9c2757f53c7fb97
NAME=/aast-ai-agent-rag-answer-1 STATUS=running RUNNING=true HEALTH=healthy EXIT=0 IMAGE=sha256:a8abf738c5296fefca79fbdc947088f4163577f5f2772f96c97fa98f381b270e
NAME=/aast-ai-agent-decision-api-1 STATUS=running RUNNING=true HEALTH=healthy EXIT=0 IMAGE=sha256:ef577adc82ddcc602ef481ffdd695568896ce8adb72b246f56a6a89e54531dcc

``

## Rebuilt Image Evidence
``text

aast-ai-agent/decision-api:local                     
sha256:ef577adc82ddcc602ef481ffdd695568896ce8adb72b246f56a6a89e54531dcc   2026-06-20 14:40:37 +0300 EEST   9.27GB
aast-ai-agent/backend:local                          
sha256:44b656696c0e6b6728217b5cef3ebc99b1a7101a12956742d650e63ef762f626   2026-06-20 14:40:31 +0300 EEST   1.91GB
aast-ai-agent/rag-answer:local                       
sha256:a8abf738c5296fefca79fbdc947088f4163577f5f2772f96c97fa98f381b270e   2026-06-20 14:40:28 +0300 EEST   269MB
aast-ai-agent/rag-retriever:local                    
sha256:423720f8cae2f996d1de5f44cbda8187ab3e792258d8d51fa9c2757f53c7fb97   2026-05-23 17:53:52 +0300 EEST   2.45GB
aast-ai-agent/frontend:local                         
sha256:7a78cc9be14267dd40c37829e2e36ebcbd23418ca2969fe578e15739ef7c30d2   2026-05-23 17:18:54 +0300 EEST   75MB



``

## Route Checks
| Route | Status | Body/Error |
|---|---:|---|
| http://127.0.0.1:8004/health | FAIL | Unable to connect to the remote server |
| http://127.0.0.1:8004/api/health | FAIL | Unable to connect to the remote server |
| http://127.0.0.1:8004/health/metrics | FAIL | Unable to connect to the remote server |
| http://127.0.0.1:5173/ | FAIL | Unable to connect to the remote server |
| http://127.0.0.1:8001/health | 200 | {"status":"healthy","qdrant_connected":true,"embedding_model":"BAAI/bge-m3","embedding":{"model":"BAAI/bge-m3","init_mode":"lazy","loaded":false,"loading":false,"device":"cpu","low_cpu_mem_usage":true,"dynamic_quantize":false,"batch_size":4,"torch_num_threads":1,"loaded_at":null,"load_started_at":nu...TRUNCATED |
| http://127.0.0.1:8002/health | 200 | {"status":"healthy","retriever_api":"http://rag-retriever:8001/search","ollama_model":"gemma4:e2b","answer_engine_enabled":false} |
| http://127.0.0.1:8005/health | 200 | {"status":"ok","voice":{"enabled":false,"whisper_model":"base","device":"cpu","whisper_loaded":false,"llm_loaded":false,"status":"deferred"},"startup":{"voice_router_enabled":false,"whisper_lazy_load":true}} |
| http://127.0.0.1:6333/ | 200 | {"title":"qdrant - vector search engine","version":"1.12.5","commit":"27260abda78509e1a3e8822c8d8819c4fe189f5b"} |

## Neo4j Check
docker exec aast-ai-agent-neo4j-1 cypher-shell ... cannot run because the Neo4j container is not running. Host port 127.0.0.1:7687 is owned by:
``text

   Id ProcessName Path                                                                                      
   -- ----------- ----                                                                                      
16712 java        C:\Users\mh978\.Neo4jDesktop2\Cache\runtime\zulu21.44.17-ca-jdk21.0.8-win_x64\bin\java.exe



``

## Acceptance Criteria
| Criterion | Result |
|---|---|
| All seven containers running | FAIL: frontend exited, neo4j created/not running, backend restarting |
| backend healthy | FAIL: backend restart loop, missing cli-table3 |
| decision-api healthy | PASS |
| rag-retriever healthy | PASS |
| rag-answer healthy | PASS; answer engine disabled is reported by /health |
| neo4j healthy | FAIL: host port 7687 conflict |
| qdrant healthy | PASS |
| backend /health/metrics reachable | FAIL |

## Blockers
1. Frontend latest image did not build: src/components/pages/AdvisorPage.tsx(492,9): error TS6133: 'sidebarWidth' is declared but its value is never read.
2. Backend latest image starts latest source but crashes: Cannot find package 'cli-table3' imported from /app/services/metrics.js.
3. Neo4j cannot start because 127.0.0.1:7687 is already used by Neo4j Desktop Java process.
