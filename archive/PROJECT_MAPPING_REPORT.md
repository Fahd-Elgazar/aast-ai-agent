# Project Mapping Report

Generated: 2026-06-20 14:24:03 +03:00

| Container | Compose Project | Working Directory | Compose File Path | Service | Source Folder Mapping | From C:\AI_AGENT? |
|---|---|---|---|---|---|---|
| aast-ai-agent-backend-1 | aast-ai-agent | C:\AI_AGENT | C:\AI_AGENT\docker-compose.yml | backend | C:\AI_AGENT\aast-ai-agent-main\backend | YES |
| aast-ai-agent-rag-answer-1 | aast-ai-agent | C:\AI_AGENT | C:\AI_AGENT\docker-compose.yml | rag-answer | C:\AI_AGENT\aast-ai-agent-main\backend\rag_system | YES |
| aast-ai-agent-frontend-1 | aast-ai-agent | C:\AI_AGENT | C:\AI_AGENT\docker-compose.yml | frontend | C:\AI_AGENT\aast-ai-agent-main\frontend | YES |
| aast-ai-agent-rag-retriever-1 | aast-ai-agent | C:\AI_AGENT | C:\AI_AGENT\docker-compose.yml | rag-retriever | C:\AI_AGENT\aast-ai-agent-main\backend\rag_system | YES |
| aast-ai-agent-qdrant-1 | aast-ai-agent | C:\AI_AGENT | C:\AI_AGENT\docker-compose.yml | qdrant |  | YES |
| aast-ai-agent-decision-api-1 | aast-ai-agent | C:\AI_AGENT | C:\AI_AGENT\docker-compose.yml | decision-api | C:\AI_AGENT\college-decision-system-backend | YES |
| aast-ai-agent-neo4j-1 | aast-ai-agent | C:\AI_AGENT | C:\AI_AGENT\docker-compose.yml | neo4j |  | YES |
| infra-frontend-1 | infra | C:\Users\mh978\Downloads\mobile computing project\infra | C:\Users\mh978\Downloads\mobile computing project\infra\docker-compose.yml | frontend |  | NO |
| infra-backend-1 | infra | C:\Users\mh978\Downloads\mobile computing project\infra | C:\Users\mh978\Downloads\mobile computing project\infra\docker-compose.yml | backend |  | NO |
| infra-db-bootstrap-1 | infra | C:\Users\mh978\Downloads\mobile computing project\infra | C:\Users\mh978\Downloads\mobile computing project\infra\docker-compose.yml | db-bootstrap |  | NO |
| infra-db-1 | infra | C:\Users\mh978\Downloads\mobile computing project\infra | C:\Users\mh978\Downloads\mobile computing project\infra\docker-compose.yml | db |  | NO |
| fair-price-eg-frontend-1 | fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\docker-compose.yml | frontend |  | NO |
| fair-price-eg-backend-1 | fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\docker-compose.yml | backend |  | NO |
| fair-price-eg-db-bootstrap-1 | fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\docker-compose.yml | db-bootstrap |  | NO |
| fair-price-eg-db-1 | fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\docker-compose.yml | db |  | NO |
| fair-price-eg-clean-validation-backend-1 | fair-price-eg-clean-validation | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\docker-compose.yml | backend |  | NO |
| fair-price-eg-clean-validation-db-bootstrap-1 | fair-price-eg-clean-validation | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\docker-compose.yml | db-bootstrap |  | NO |
| fair-price-eg-clean-validation-db-1 | fair-price-eg-clean-validation | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\docker-compose.yml | db |  | NO |
| fair-price-eg-staging-smoke-1 | fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg | C:\Users\mh978\Downloads\mobile computing project\pf_scraper\fair-price-eg\docker-compose.yml | staging-smoke |  | NO |
| qdrant_prod |  |  |  |  |  | UNKNOWN: no Compose labels |
| nifty_shtern |  |  |  |  |  | UNKNOWN: no Compose labels |
| infallible_cannon |  |  |  |  |  | UNKNOWN: no Compose labels |
| amazing_saha |  |  |  |  |  | UNKNOWN: no Compose labels |
| priceless_lumiere |  |  |  |  |  | UNKNOWN: no Compose labels |
| cranky_blackburn |  |  |  |  |  | UNKNOWN: no Compose labels |
| trusting_heyrovsky |  |  |  |  |  | UNKNOWN: no Compose labels |
| stoic_almeida |  |  |  |  |  | UNKNOWN: no Compose labels |
| youthful_allen |  |  |  |  |  | UNKNOWN: no Compose labels |
| musing_jackson |  |  |  |  |  | UNKNOWN: no Compose labels |
| loving_pare |  |  |  |  |  | UNKNOWN: no Compose labels |
| college-decision-support-system-frontend-1 | college-decision-support-system | C:\Users\mh978\Downloads\college-decision - support-system | C:\Users\mh978\Downloads\college-decision - support-system\docker-compose.yml | frontend |  | NO |
| college-decision-support-system-backend-1 | college-decision-support-system | C:\Users\mh978\Downloads\college-decision - support-system | C:\Users\mh978\Downloads\college-decision - support-system\docker-compose.yml | backend |  | NO |

## Finding
All seven aast-ai-agent-* containers have Compose labels pointing to C:\AI_AGENT and C:\AI_AGENT\docker-compose.yml. Other visible containers point to other working directories or have no Compose labels.

