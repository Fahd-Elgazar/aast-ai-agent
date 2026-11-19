FROM node:20-bookworm-slim AS frontend-build

WORKDIR /build/frontend
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=${VITE_API_BASE}
COPY aast-ai-agent-main/frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY aast-ai-agent-main/frontend/ ./
RUN npm run build

FROM node:20-bookworm-slim AS backend-build

WORKDIR /build/backend
COPY aast-ai-agent-main/backend/package*.json ./
RUN npm ci --omit=dev

FROM python:3.11-slim-bookworm AS python-build

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY college-decision-system-backend/requirements.txt /tmp/decision-requirements.txt
COPY aast-ai-agent-main/backend/rag_system/requirements.retriever.txt /tmp/rag-retriever-requirements.txt
COPY aast-ai-agent-main/backend/rag_system/requirements.answer.txt /tmp/rag-answer-requirements.txt

RUN python -m venv /opt/venvs/decision \
    && /opt/venvs/decision/bin/pip install -r /tmp/decision-requirements.txt

RUN python -m venv /opt/venvs/rag \
    && /opt/venvs/rag/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch==2.3.1+cpu \
    && /opt/venvs/rag/bin/pip install -r /tmp/rag-retriever-requirements.txt -r /tmp/rag-answer-requirements.txt

FROM qdrant/qdrant:v1.12.5 AS qdrant-runtime
FROM python:3.11-slim-bookworm AS python-runtime
FROM node:20-bookworm-slim AS node-runtime

FROM neo4j:5.26-community

USER root

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TOKENIZERS_PARALLELISM=false \
    NODE_ENV=production

COPY --from=python-runtime /usr/local/ /usr/local/
COPY --from=node-runtime /usr/local/ /usr/local/
COPY --from=python-build /opt/venvs/ /opt/venvs/
COPY --from=qdrant-runtime /qdrant/ /opt/qdrant/

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       curl \
       libbz2-1.0 \
       libffi8 \
       libgomp1 \
       liblzma5 \
       libsqlite3-0 \
       libssl3 \
       libunwind8 \
       netcat-openbsd \
       nginx \
       procps \
       supervisor \
       zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

WORKDIR /opt/aast/backend
COPY aast-ai-agent-main/backend/ ./
COPY --from=backend-build /build/backend/node_modules/ ./node_modules/

WORKDIR /opt/aast/decision
COPY college-decision-system-backend/ ./

WORKDIR /opt/aast/rag
COPY aast-ai-agent-main/backend/rag_system/phase3_retriever.py ./
COPY aast-ai-agent-main/backend/rag_system/phase2_qdrant_ingestion.py ./
COPY aast-ai-agent-main/backend/rag_system/phase4_llm_answer_engine.py ./

COPY --from=frontend-build /build/frontend/dist/ /usr/share/nginx/html/
COPY appliance/nginx.conf /etc/nginx/nginx.conf
COPY appliance/supervisord.conf /etc/supervisor/conf.d/aast-appliance.conf
COPY appliance/entrypoint.sh appliance/wait_for.py appliance/healthcheck.py appliance/run-service.sh /opt/appliance/

RUN chmod 0755 /opt/appliance/entrypoint.sh /opt/appliance/run-service.sh \
    && mkdir -p \
       /opt/aast/backend/logs \
       /opt/aast/decision/runtime/voice \
       /opt/qdrant/storage \
       /var/lib/aast \
       /var/log/supervisor \
       /run/nginx

EXPOSE 5173

HEALTHCHECK --interval=20s --timeout=15s --retries=8 --start-period=180s \
  CMD ["/usr/local/bin/python", "/opt/appliance/healthcheck.py"]

ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/opt/appliance/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
