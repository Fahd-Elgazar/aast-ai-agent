# Query Routing Audit

Repository: `C:\AI_AGENT`
Branch: `recovery-baseline`
Mode: read-only application audit; this file is a report artifact only.

## Executive Verdict

The production query entry point is `POST /api/chatbot/query` in `aast-ai-agent-main/backend/orchestrator.js`.

The current system already has multiple deterministic safety layers for institutional questions, but it does not have a clean top-level distinction between:

- institutional academic policy,
- general academic knowledge,
- academic advising.

That gap explains the main quality issue: many general academic knowledge questions are routed into KG/RAG evidence paths or into `LLM_FALLBACK`, where `unifiedAnswerService.js` still requires verified context and can return insufficient-evidence responses instead of a useful conceptual answer.

Do not implement a classifier ahead of the current deterministic locks without a safety gate. Current policy behavior can break if the new classifier is allowed to override existing golden path, KG direct, RAG direct, or empty-evidence refusal paths.

## Files Audited

Primary runtime path:

- `aast-ai-agent-main/frontend/src/components/pages/AdvisorPage.tsx`
- `aast-ai-agent-main/frontend/src/services/agentService.ts`
- `aast-ai-agent-main/backend/orchestrator.js`
- `aast-ai-agent-main/backend/services/brainRouter.js`
- `aast-ai-agent-main/backend/services/ragService.js`
- `aast-ai-agent-main/backend/services/decisionService.js`
- `aast-ai-agent-main/backend/services/unifiedAnswerService.js`
- `aast-ai-agent-main/backend/services/fusionService.js`
- `aast-ai-agent-main/backend/services/responseFormatter.js`
- `aast-ai-agent-main/backend/services/neo4jcontext.js`
- `aast-ai-agent-main/backend/config/routingCalibration.js`
- `aast-ai-agent-main/backend/config/goldenPathRegistry.js`

Secondary route:

- `aast-ai-agent-main/backend/routes/chatbot.js` is mounted at `/api/chatbot/legacy`; it only echoes the query and is not the production route.

## Entry Point Of User Queries

Frontend:

- `AdvisorPage.tsx` calls `askAgent(...)`.
- `agentService.ts` posts to `${API_BASE}/chatbot/query`.
- The backend route is `app.post("/api/chatbot/query", ...)` in `orchestrator.js`.

Backend route mounting:

- `orchestrator.js` mounts `routes/chatbot.js` only at `/api/chatbot/legacy`.
- The live production query path is implemented inline in `orchestrator.js`, not in `routes/chatbot.js`.

## Current Query Flow

```text
AdvisorPage.tsx
  -> frontend services/agentService.ts
  -> POST /api/chatbot/query
  -> orchestrator.js
     -> validate query
     -> normalizeAcademicQuery()
     -> load conversation + memory
     -> conversation meta/light/follow-up gates
     -> golden path detection
     -> demo graph gate
     -> greeting/FAQ pre-routing
     -> intent classification / heuristic intent shortcuts
     -> checkSubsystemHealth()
     -> brainRouter.analyzeQuery()
        -> detectRoutingSignals()
        -> ragService.detectQueryCategory()
        -> deterministic policy classifier
        -> deterministic KG classifier
        -> golden path calibration
     -> brainRouter.determineBestRoute()
     -> orchestrator route locks / overrides
     -> execute one of:
        - KG_DIRECT / KG_ONLY via fetchNeo4jContext()
        - RAG_DIRECT / RAG_ONLY via ragService.search()
        - HYBRID_KG_RAG via KG + RAG
        - DECISION_ENGINE via decisionService.getRecommendation()
        - CAREER_ENGINE via decisionService.buildCareerRoadmap()
        - LLM_FALLBACK via generateStableResponse(), then unified synthesis
     -> deterministic bypasses when safe
     -> generateUnifiedAnswer()
        -> context evidence gates
        -> Gemma primary
        -> Gemini backup
        -> deterministic context fallback
     -> fusionService fallback if unified synthesis fails
     -> responseFormatter.format()
     -> optional conversationalHumanizer
     -> response JSON
```

## Current Route Types

Defined in `brainRouter.js` and mirrored in `orchestrator.js`:

- `KG_DIRECT`
- `KG_ONLY`
- `RAG_DIRECT`
- `RAG_ONLY`
- `HYBRID_KG_RAG`
- `DECISION_ENGINE`
- `CAREER_ENGINE`
- `FAQ`
- `LLM_FALLBACK`

Additional orchestrator response routes/bypasses:

- `CONVERSATION_META`
- `CONVERSATION_LIGHT`
- `CONVERSATION_FOLLOWUP_CLARIFY`
- `DEMO_GRAPH`
- `GREETING`
- `DETERMINISTIC_MULTI_INTENT`
- `KG_CLARIFICATION`
- `FATAL_FALLBACK`

## Current Query Classification Logic

### Orchestrator pre-classification

`orchestrator.js` performs several layers before `brainRouter`:

- local conversation meta intent,
- light conversational intent,
- follow-up reference resolution,
- golden path matching,
- demo graph matching,
- greeting and FAQ matching,
- heuristic intent shortcuts for program, factual, ontology, and profile-incomplete recommendation queries,
- dynamic intent extraction only if heuristics do not decide first.

### brainRouter classification

`brainRouter.js` combines:

- lexical dictionaries for KG, RAG, decision, career, FAQ,
- alias matches from `academicAliases.js`,
- ontology intent detection for facility, track, partner institution, governance, policy, campus, curriculum,
- deterministic academic factual query detection,
- deterministic policy query detection,
- semantic RAG category detection by calling `ragService.detectQueryCategory()`,
- golden path registry calibration.

Important behavior:

- `classifyQuestionFeatures()` treats structural policy terms like `policy`, `grading`, `grading system`, and `scholarship pathway` as `kg_policy`.
- `determineBestRoute()` enforces ontology KG routes before the deterministic RAG policy shortcut.
- As a result, some policy-looking queries currently become `KG_DIRECT` before RAG policy handling can run.

Example observed offline:

- `What are the GPA probation rules at AAST?` -> `KG_DIRECT (1)`
- `What is the minimum GPA to avoid probation?` -> `RAG_DIRECT (0.96)`

This is not automatically unsafe because KG may contain verified institutional facts, but it means policy safety is split between KG and RAG rather than governed by one explicit policy category.

## brainRouter.js Behavior

`brainRouter.js` is the central route scorer.

It:

- declares route constants,
- sets confidence thresholds from `routingCalibration.js`,
- calculates lexical and feature-based scores,
- normalizes route scores against theoretical maxima,
- detects ambiguity between close routes,
- detects deterministic KG questions,
- detects deterministic policy questions,
- applies RAG semantic category boosts,
- applies golden path route locks,
- returns a route decision envelope with route, confidence, reasoning, fallback chain, required services, thresholds, and telemetry.

Relevant thresholds from `routingCalibration.js`:

- KG confidence threshold: `0.40`
- hybrid trigger threshold: `0.34`
- LLM fallback threshold: `0.18`
- deterministic KG threshold: `0.70`
- deterministic RAG threshold: `0.70`

Key risk:

`brainRouter` is route-oriented, not category-oriented. It answers "which subsystem should execute?" rather than "is evidence mandatory, preferred, or optional?" The new classification layer should add that missing semantic contract without replacing route scoring.

## decisionService.js Behavior

`decisionService.js` is an advising and recommendation service, not an institutional policy authority.

It handles:

- in-memory and persisted decision memory,
- profile extraction from text,
- optional LLM extraction for structured student profile fields,
- remote decision API calls to `/api/v1/decisions/recommend`,
- recommendation validation and fallback shaping,
- career roadmap construction,
- major comparison.

Important:

- `getRecommendation()` needs student profile data such as high school percentage and budget.
- Missing data returns an interactive prompt path in `orchestrator.js`.
- `buildCareerRoadmap()` is deterministic and advisory.
- `compareMajors()` is deterministic but contains broad market-style claims; it should remain under advising, not policy.

The new classification should treat `DECISION_ENGINE` and `CAREER_ENGINE` as `ACADEMIC_ADVISING` execution tools.

## ragService.js Behavior

`ragService.js` is a multi-pass retrieval gateway:

1. Detects semantic category with `detectQueryCategory()`.
2. Expands the query with synonyms.
3. Pass 1 calls retriever `/search` with normal `top_k`.
4. If weak, Pass 2 simplifies the query and increases retrieval depth.
5. If still weak and allowed by runtime mode, Pass 3 calls the grounded answer engine.
6. Reranks sources by officiality, quality, priority, confidence, and category match.
7. Returns a canonical RAG envelope with confidence, sources, used facts, missing information, metadata, and observability.

RAG category labels include:

- `academic_policy`
- `financial_aid`
- `tuition`
- `admissions`
- `curriculum`
- `examination`
- `registration`
- `institutional`
- `housing`

RAG confidence model:

- raw retriever score comes from `avg_confidence`, `confidence`, or `score`;
- `HIGH` is at least `0.75`;
- `MEDIUM` is at least `0.45`;
- strong result requires success, raw confidence at least `0.65`, and at least one source.

Important finding:

The current `search(query)` signature accepts only `query`, but callers pass `ragService.search(query, { topK: 5 })` and `ragService.search(scopedQuery, { topK: 3 })`. Those options are ignored by the current function signature. Internal `CONFIG.TOP_K` and `CONFIG.TOP_K_DEEP` are used instead.

## unifiedAnswerService.js Behavior

`unifiedAnswerService.js` is the final synthesis owner for non-bypassed routes.

It:

- resolves route types,
- builds verified context blocks from FAQ, KG, RAG, and decision outputs,
- exits early if all verified context is absent,
- exits early if retrieval confidence is below the degraded threshold,
- builds the final prompt with strict verified-context rules,
- runs Gemma primary through `runOllamaSynthesis()`,
- if Gemma fails, runs Gemini backup when enabled,
- if both model paths fail, returns deterministic context fallback when possible,
- returns structured answer metadata with sources, route, confidence, model provider, and failover details.

Current strict prompt behavior:

- "ONLY use the verified context provided below."
- "NEVER hallucinate, invent, speculate, or assume any university policy, rule, or data."
- If context is insufficient, use the insufficient-data phrase.

Important finding:

`orchestrator.js` creates `rawResults.llm` during `LLM_FALLBACK`, but `generateUnifiedAnswer()` does not accept `llmContext`. Therefore general knowledge questions routed to `LLM_FALLBACK` can still hit the verified-context absence guard and return insufficient evidence rather than using the LLM text as the final answer.

This is probably the central quality gap for general academic knowledge.

## Deterministic Routing Layer

Current deterministic layers:

- conversation meta and light conversation bypasses,
- FAQ pre-route,
- golden path registry route locks,
- ontology KG locks,
- direct academic entity KG locks,
- curriculum KG lock,
- deterministic RAG policy shortcut,
- deterministic KG direct response,
- deterministic RAG direct response,
- deterministic multi-intent decomposition,
- deterministic golden cache and static fallbacks,
- deterministic context fallback in unified synthesis.

These are production safety assets. The new classifier must not bypass them.

## Policy-Safety Layer

Current policy safety is distributed:

- `brainRouter.classifyDeterministicPolicyQuery()` detects GPA, transfer, probation, scholarship, admission, tuition, regulation, and policy terms.
- `brainRouter.determineBestRoute()` can force `RAG_DIRECT` for strong deterministic policy.
- `orchestrator.js` returns "I couldn't find verified institutional policy evidence for this query" when `RAG_ONLY` is empty.
- deterministic RAG direct bypass answers only after `hasStrongRagEvidence()`.
- `unifiedAnswerService.js` forbids policy invention in the synthesis prompt.
- `responseFormatter.js` preserves route diagnostics and missing information.

Key weakness:

Policy safety is route-based rather than category-based. A policy query can be `KG_DIRECT`, `RAG_DIRECT`, `RAG_ONLY`, or `HYBRID_KG_RAG` depending on lexical/ontology signals. That is workable only if all policy category outputs are evidence-required and never allowed to fall into open LLM generation.

## Route Confidence Scoring

Current confidence sources:

- `brainRouter` route confidence from normalized route scores and deterministic overrides.
- deterministic KG routes can return `0.99` or at least `0.96`.
- deterministic RAG policy routes return `0.96`.
- RAG raw confidence comes from retriever/answer engine scores.
- RAG confidence tiers are `HIGH`, `MEDIUM`, and `LOW`.
- KG evidence confidence is recomputed in `orchestrator.js` using graph richness, entity overlap, source score, entity score, and alias score.
- `unifiedAnswerService.js` normalizes contract confidence and may mark fallback/weak responses.

The new classifier should add a separate `classification_confidence` field, not reuse route confidence as classification confidence.

## Current Failover Model

Route-level failover:

- golden KG can degrade to RAG/FAQ/LLM depending health,
- golden RAG can degrade to KG/FAQ/LLM depending health,
- hybrid can degrade to KG/RAG/FAQ/LLM depending health,
- decision can fall back to career/FAQ/LLM,
- career can fall back to decision/FAQ/LLM,
- KG empty can escalate to RAG if fallback chain allows and RAG is healthy,
- RAG empty returns verified-evidence refusal,
- hybrid total failure can degrade to `LLM_FALLBACK`,
- fatal exceptions attempt `fusionService` and then static fallback.

Model-level failover:

- Gemma primary is attempted first in current code.
- Gemini backup is attempted if Gemma fails and backup is enabled.
- deterministic context fallback is used when both model providers fail and verified context exists.

Response-level failover:

- `fusionService.fuse()` is used when unified synthesis fails.
- `responseFormatter.formatErrorFallback()` is used for fatal fallback envelopes.

## Current RAG Bypass Logic

RAG is bypassed when:

- conversation meta/light intent answers locally,
- greeting or FAQ answers pre-route,
- demo graph route is selected,
- deterministic KG route answers directly,
- curriculum KG route answers or safely refuses,
- golden cache/static fallback answers,
- deterministic multi-intent KG-only parts answer directly,
- `RAG_DIRECT` produces deterministic policy payload and bypasses unified synthesis,
- unified synthesis receives enough KG/FAQ/decision context without needing RAG,
- runtime mode disables RAG answer engine Pass 3 and returns retrieval-only results.

RAG is not bypassed for policy if `RAG_ONLY` or `RAG_DIRECT` is selected, but policy queries can still be routed through KG or hybrid before RAG.

## Call Graph

```text
POST /api/chatbot/query
  orchestrator.js route handler
    normalizeAcademicQuery()
    getConversation()
    detectMetaConversationIntent()
    detectLightConversationalIntent()
    resolveFollowUpReference()
    classifyGoldenQuery()
    checkGreeting()
    searchFAQ()
    extractDynamicIntent()
    checkSubsystemHealth()
    brainRouter.analyzeQuery()
      classifyGoldenQuery()
      classifyQuestionFeatures()
      detectRoutingSignals()
      ragService.detectQueryCategory()
      classifyDeterministicPolicyQuery()
      isDeterministicAcademicQuery()
      normalizeSignals()
    brainRouter.determineBestRoute()
    route execution:
      fetchNeo4jContext()
        detectIntent()
        buildQueryPlan()
        retrieveWithThresholds()
        synthesizeAnswer()
        buildGraphResponse()
      ragService.search()
        detectQueryCategory()
        expandQuery()
        _callRetriever()
        simplifyQuery()
        _callRetriever()
        _callAnswerEngine()
        _buildSearchResult()
      getRecommendation()
        safeExtractProfileData()
        fetch decision API
        safeDecision()
      buildCareerRoadmap()
      generateStableResponse() for LLM_FALLBACK pre-synthesis
    generateUnifiedAnswer()
      buildContextPayload()
      buildPrompt()
      runFinalSynthesis()
        runOllamaSynthesis()
        generateGeminiSynthesis()
        deterministic context fallback
      createResult()
    fusionService.fuse() if unified fails
    responseFormatter.format()
    humanizeGroundedAnswer()
```

## Audit Findings

1. The production entry point is `orchestrator.js`, not `routes/chatbot.js`.
2. The current system has route classification, not a clean evidence-requirement classification.
3. General academic knowledge is often over-routed to KG/RAG or starved by the verified-context gate.
4. Policy safety exists but is distributed across KG, RAG, unified synthesis, and route locks.
5. Some policy queries currently route `KG_DIRECT` because ontology policy locks run before deterministic RAG policy enforcement.
6. `LLM_FALLBACK` does not provide a clean general-knowledge final answer path because `rawResults.llm` is not passed into `generateUnifiedAnswer()`.
7. `ragService.search(query, { topK })` callers pass options that the current `search(query)` implementation ignores.
8. Explainability is strong and should be preserved by adding classification metadata to existing diagnostics rather than replacing route names.

