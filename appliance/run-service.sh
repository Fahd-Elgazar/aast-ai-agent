#!/usr/bin/env bash
set -euo pipefail

service="${1:?service name required}"

case "${service}" in
  qdrant)
    cd /opt/qdrant
    export QDRANT__STORAGE__STORAGE_PATH=/opt/qdrant/storage
    exec ./entrypoint.sh
    ;;
  neo4j)
    cd /var/lib/neo4j
    # Application connection variables share the NEO4J_ prefix used by the
    # official image for config translation. Keep only the variables that the
    # Neo4j process itself understands.
    exec env \
      -u NEO4J_DATABASE \
      -u NEO4J_PASSWORD \
      -u NEO4J_URI \
      -u NEO4J_USER \
      /startup/docker-entrypoint.sh neo4j
    ;;
  decision-api)
    cd /opt/aast/decision
    exec /opt/venvs/decision/bin/uvicorn app.main:app --host 127.0.0.1 --port 8005
    ;;
  rag-retriever)
    /usr/local/bin/python /opt/appliance/wait_for.py --http http://127.0.0.1:6333/ --timeout 90
    cd /opt/aast/rag
    exec /opt/venvs/rag/bin/uvicorn phase3_retriever:app --host 127.0.0.1 --port 8001
    ;;
  rag-answer)
    /usr/local/bin/python /opt/appliance/wait_for.py --http http://127.0.0.1:8001/health --timeout 300
    cd /opt/aast/rag
    exec /opt/venvs/rag/bin/uvicorn phase4_llm_answer_engine:app --host 127.0.0.1 --port 8002
    ;;
  backend)
    /usr/local/bin/python /opt/appliance/wait_for.py --tcp 127.0.0.1 7687 --timeout 180
    /usr/local/bin/python /opt/appliance/wait_for.py --http http://127.0.0.1:8005/health --timeout 180
    /usr/local/bin/python /opt/appliance/wait_for.py --http http://127.0.0.1:8001/health --timeout 360
    /usr/local/bin/python /opt/appliance/wait_for.py --http "${OLLAMA_BASE_URL%/}/api/tags" --timeout 60
    cd /opt/aast/backend
    exec npm run start:container
    ;;
  nginx)
    /usr/local/bin/python /opt/appliance/wait_for.py --tcp 127.0.0.1 8004 --timeout 420
    exec /usr/sbin/nginx -g 'daemon off;'
    ;;
  *)
    echo "Unknown appliance service: ${service}" >&2
    exit 64
    ;;
esac
