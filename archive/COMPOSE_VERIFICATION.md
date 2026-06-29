# Compose Verification

Generated: 2026-06-20 14:25:39 +03:00

## Answer
YES. Docker metadata proves that `C:\AI_AGENT\docker-compose.yml` created the active `aast-ai-agent-*` stack.

## Evidence
| Service | Container | Compose Project | Compose File Path | Working Directory | Config Hash | Compose Image Label |
|---|---|---|---|---|---|---|
| backend | aast-ai-agent-backend-1 | aast-ai-agent | C:\AI_AGENT\docker-compose.yml | C:\AI_AGENT | d4e15f381ebcef66d258f6f99bd92503a537fe7a4d234b47bc95ece803315181 | sha256:a51876406bd444fa6f151e238d1b95ad409008b6fc7dc4ec57e8ab4f898a4c02 |
| decision-api | aast-ai-agent-decision-api-1 | aast-ai-agent | C:\AI_AGENT\docker-compose.yml | C:\AI_AGENT | baa1d33ab9f547fc8ba46a637fc1b1b2f2301123e3b29741a44111e4a7d6a9f8 | sha256:e0a65efbfe55d45e46b5323c17b9be52eb3298bc32f27a15205f09c8a7e31886 |
| frontend | aast-ai-agent-frontend-1 | aast-ai-agent | C:\AI_AGENT\docker-compose.yml | C:\AI_AGENT | b38610a5f5ca4597eca3d094fe7ea7ac6e40087dbd5516861f6156002908886a | sha256:7a78cc9be14267dd40c37829e2e36ebcbd23418ca2969fe578e15739ef7c30d2 |
| neo4j | aast-ai-agent-neo4j-1 | aast-ai-agent | C:\AI_AGENT\docker-compose.yml | C:\AI_AGENT | 96637e228a5ad6d3ede8490e5ef3392b44cf90438302d4a35f6065dfd240981b | sha256:0b5d3ab6ec1b866890dbfb53bf4fe1cf039f9e03c96165599a403005b7e7bcc3 |
| qdrant | aast-ai-agent-qdrant-1 | aast-ai-agent | C:\AI_AGENT\docker-compose.yml | C:\AI_AGENT | c8dd782f7278f895bdbe87d3db16e7d86a0685772d88977e0e1327d20bcab232 | sha256:05fecce7dce45d1254e0468bc037e8210e187fd56fa847688b012293d5f08aae |
| rag-answer | aast-ai-agent-rag-answer-1 | aast-ai-agent | C:\AI_AGENT\docker-compose.yml | C:\AI_AGENT | 37947a6b953cdc3c0868ab8c1439b86180d170c34f56cedd3444fbaf9c2acd62 | sha256:5981e7d0e5cf942a1eca36f863f342a2ed652fe1d3a60944cec0bf3ab9aab8bc |
| rag-retriever | aast-ai-agent-rag-retriever-1 | aast-ai-agent | C:\AI_AGENT\docker-compose.yml | C:\AI_AGENT | 8275590ca32f166d612460aaba5efeec3da30167c0c336562383dc1964d9fcb8 | sha256:b3840bd6cdbe5573bd65126f77693ab032a7c7f65339ae182885fc0248541adf |

## Rendered Compose Source Paths
- backend build context: `C:\AI_AGENT\aast-ai-agent-main\backend`
- frontend build context: `C:\AI_AGENT\aast-ai-agent-main\frontend`
- decision-api build context: `C:\AI_AGENT\college-decision-system-backend`
- rag-retriever build context: `C:\AI_AGENT\aast-ai-agent-main\backend\rag_system`
- rag-answer build context: `C:\AI_AGENT\aast-ai-agent-main\backend\rag_system`
- neo4j image: `neo4j:5.26-community`
- qdrant image: `qdrant/qdrant:v1.12.5`
