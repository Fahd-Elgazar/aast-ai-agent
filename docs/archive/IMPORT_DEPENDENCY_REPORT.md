# Import Dependency Report
**AAST AI Agent — Core Orchestrator Dependency Mapping**

This report traces the dependency graph of the Node.js production Express orchestrator, mapping out direct imports, transitive imports, and evaluating the runtime criticality of each module.

---

## 1. Core Dependency Graph (orchestrator.js)

The active Express gateway (`orchestrator.js`) imports several service wrappers and route handlers. Below is the mapping of direct imports and their transitive components:

### 1.1 Direct Route Handlers
*   `routes/chatbot.js` (Binds chat API calls)
    *   *Transitive:* None.
*   `routes/decision.js` (Binds DSS recommendations)
    *   *Transitive:* None.
*   `routes/conversations.js` (Binds conversational history queries)
    *   *Transitive:* None.
*   `routes/health.js` (Binds platform checks)
    *   *Transitive:* None.

### 1.2 Core Services & Databases
*   `faqService.js` (Local keyword dictionary parsing)
    *   *Transitive:* None.
*   `greetings.js` (Casual conversational intent processing)
    *   *Transitive:* None.
*   `services/neo4jcontext.js` (Graph context lookup)
    *   *Transitive:* `db/neo4j.js` (driver connection)
*   `db/neo4j.js` (Bolt database driver)
    *   *Transitive:* Neo4j driver package
*   `services/decisionService.js` (Routes requests to DSS)
    *   *Transitive:* Node `axios` package
*   `services/metrics.js` (Telemetry metrics)
    *   *Transitive:* `prom-client`
*   `services/logger.js` (Logging output formatting)
    *   *Transitive:* `winston`
*   `services/unifiedAnswerService.js` (Aggregates response context)
    *   *Transitive:* `services/neo4jcontext.js`, `services/ragService.js`
*   `services/geminiService.js` (Google Gemini API wrapper)
    *   *Transitive:* `@google/generative-ai`
*   `services/modelFailoverManager.js` (Handles API fault tolerance)
    *   *Transitive:* `services/geminiService.js`, `services/ollamaService.js`
*   `services/ollamaService.js` (Ollama request router)
    *   *Transitive:* None.
*   `services/gemmaWarmService.js` (Pre-heats local Gemma nodes)
    *   *Transitive:* `services/ollamaService.js`
*   `services/academicQueryNormalizer.js` (Standardizes query structures)
    *   *Transitive:* `services/academicAliases.js`
*   `services/conversationService.js` (Session logging memory management)
    *   *Transitive:* `services/persistenceLayer.js`
*   `services/persistenceLayer.js` (Local JSON conversation files reader/writer)
    *   *Transitive:* Node `fs`, `path`
*   `services/brainRouter.js` (Intent-to-processing path mapping)
    *   *Transitive:* `config/goldenPathRegistry.js`
*   `services/fusionService.js` (Augments contexts)
    *   *Transitive:* None.
*   `services/ragService.js` (Queries Python traditional RAG retrieve server)
    *   *Transitive:* Node `axios`
*   `services/healthProbes.js` (Service reach validation)
    *   *Transitive:* None.
*   `services/responseFormatter.js` (Markdown and string sanitizing)
    *   *Transitive:* None.
*   `services/demoGraphService.js` (Mock graph datasets builder)
    *   *Transitive:* None.
*   `services/conversationalHumanizer.js` (Alters tone of generated text)
    *   *Transitive:* None.
*   `services/conversationMetaIntent.js` (Handles history clears/renames)
    *   *Transitive:* None.
*   `services/conversationPriority.js` (Evaluates route precedence)
    *   *Transitive:* None.
*   `config/goldenPathRegistry.js` (Exact match query mapping)
    *   *Transitive:* `config/routingCalibration.js`

---

## 2. Runtime Criticality Classifications

We classify core dependencies based on the impact of their failure on the orchestrator startup or basic chat request handling:

| Dependency Component | Criticality | Startup Blocker? | Failure Impact |
| :--- | :---: | :---: | :--- |
| `orchestrator.js` | **CRITICAL** | **YES** | Entire backend platform crashes. |
| `services/brainRouter.js` | **CRITICAL** | **YES** | Chatbot queries cannot be classified or routed. |
| `services/unifiedAnswerService.js`| **CRITICAL** | **YES** | Chatbot fails to compile context and returns empty strings. |
| `services/conversationService.js`| **CRITICAL** | **YES** | Sessions fail to load; memory fails to persist. |
| `services/neo4jcontext.js` | **HIGH** | **NO** | Graph queries fail (fallback to vector RAG triggered). |
| `services/ragService.js` | **HIGH** | **NO** | Traditional RAG queries fail (fallback to GraphRAG / general LLM triggered). |
| `services/decisionService.js` | **HIGH** | **NO** | Tuition/admission recommendations fail (returns database connection errors). |
| `services/logger.js` | **CRITICAL** | **YES** | Server fails to initialize (logging streams must open). |
| `services/metrics.js` | **SUPPORTING** | **NO** | Telemetry logs are not written; server remains functional. |
| `config/goldenPathRegistry.js` | **HIGH** | **YES** | Server fails to parse configuration files. |
