# Query Classification Implementation Plan

Repository: `C:\AI_AGENT`
Branch: `recovery-baseline`
Status: design only. Do not implement until explicit approval.

## Architecture Design

Add a small classification layer that produces a semantic contract before final route execution:

```js
{
  category: "ACADEMIC_POLICY" | "ACADEMIC_KNOWLEDGE" | "ACADEMIC_ADVISING",
  evidence_required: boolean,
  evidence_preferred: boolean,
  allow_llm_without_institutional_evidence: boolean,
  classification_confidence: number,
  matched_signals: string[],
  safety_notes: string[]
}
```

This classifier must not replace `brainRouter.js`. It should sit beside it and constrain behavior only where safe.

## Category Contracts

### Category 1: ACADEMIC_POLICY

Examples:

- GPA probation
- registration
- scholarships
- transfer requirements
- withdrawal
- credit hours
- university regulations

Contract:

- evidence_required: true
- evidence_preferred: true
- allow_llm_without_institutional_evidence: false

Allowed flow:

- RAG
- Knowledge Graph
- verified institutional documents

If evidence is unavailable:

- refuse with the current verified-evidence refusal style.

Never:

- answer institutional policy from Gemma/Gemini alone,
- convert a policy question into general academic knowledge because of "what is" phrasing,
- hide missing evidence.

### Category 2: ACADEMIC_KNOWLEDGE

Examples:

- machine learning
- deep learning
- neural networks
- Python
- algorithms
- NLP
- computer vision
- software engineering concepts

Contract:

- evidence_required: false
- evidence_preferred: false
- allow_llm_without_institutional_evidence: true

Allowed flow:

- Gemma primary
- Gemini backup
- deterministic unavailable fallback if both providers fail

Never:

- require university policy evidence for general conceptual explanations,
- claim AAST-specific rules unless policy evidence is present.

### Category 3: ACADEMIC_ADVISING

Examples:

- how can I improve my GPA?
- how should I study machine learning?
- should I learn Python before deep learning?
- what skills do I need for computer vision?

Contract:

- evidence_required: false
- evidence_preferred: true
- allow_llm_without_institutional_evidence: true

Allowed flow:

1. Try RAG/KG if evidence is relevant.
2. If evidence exists, blend evidence and LLM.
3. If evidence is missing, answer with LLM.
4. Append advisory disclaimer.

Disclaimer requirement:

Use a short note equivalent to: "This is academic guidance, not an official university policy decision. Confirm official requirements with your advisor or portal."

## Safety Rules

1. Policy-first guard wins over conceptual phrasing.
2. Explicit institutional terms win over LLM fallback.
3. `policy`, `regulation`, `rules`, `allowed`, `eligible`, `minimum`, `maximum`, `deadline`, `required`, `requirements`, `can I`, `when`, and `how many` must force policy if a policy-domain term is present.
4. Conceptual phrases such as `explain the concept of GPA` can be knowledge only when no official/institutional rule is requested.
5. Advisory phrases such as `should I`, `how can I improve`, `how should I study`, `what skills do I need`, and `roadmap` force advising unless official policy wording is requested.
6. Existing golden path, deterministic KG, deterministic RAG, FAQ, conversation, and refusal branches must remain intact.
7. Existing route names must remain intact for backward compatibility.
8. Classification metadata is additive in `metadata.trace.route_diagnostics`.

## Exact Files To Modify

### New file: `aast-ai-agent-main/backend/services/queryClassificationService.js`

Purpose:

- pure deterministic classification layer,
- no external service calls,
- no package dependencies,
- no Docker changes,
- no database access.

Required exports:

- `classifyAcademicQuery(query, context = {})`
- `isPolicyDomainQuery(query)`
- `isAdvisingQuery(query)`
- `isConceptualKnowledgeQuery(query)`
- `buildClassificationTrace(result)`

Required behavior:

- returns one of the three categories,
- returns evidence contract booleans,
- returns matched signals,
- returns confidence independent of route confidence,
- fails closed to `ACADEMIC_POLICY` when policy-domain and policy-command signals conflict with conceptual/advising signals.

### Modify: `aast-ai-agent-main/backend/orchestrator.js`

Exact functions/areas:

- route handler for `app.post("/api/chatbot/query", ...)`
- after query normalization and follow-up resolution,
- before dynamic intent extraction,
- route diagnostics construction,
- route execution around `LLM_FALLBACK`, `RAG_ONLY`, `RAG_DIRECT`, and `HYBRID_KG_RAG`,
- final `generateUnifiedAnswer(...)` call site.

Required changes:

- call `classifyAcademicQuery(query, { originalQuery, normalizationTrace, priorConversationMemory })`;
- add `query_classification` into `routeDiagnostics`;
- do not override conversation, FAQ, demo, or golden path bypasses;
- if category is `ACADEMIC_POLICY`, enforce existing evidence-required behavior and block open LLM fallback;
- if category is `ACADEMIC_KNOWLEDGE`, route to a new non-policy LLM answer path when no institutional evidence is needed;
- if category is `ACADEMIC_ADVISING`, attempt evidence first, then permit non-policy LLM guidance plus disclaimer;
- preserve all existing metrics and route labels.

### Modify: `aast-ai-agent-main/backend/services/unifiedAnswerService.js`

Exact functions/areas:

- keep `generateUnifiedAnswer()` unchanged for evidence-required routes,
- add a separate exported function, for example `generateAcademicKnowledgeAnswer()`,
- reuse existing internal `runFinalSynthesis()` for Gemma primary and Gemini backup,
- add a non-policy prompt that explicitly forbids university-policy claims without evidence.

Required behavior:

- for `ACADEMIC_KNOWLEDGE`, do not require `KG/RAG/FAQ/decision` context;
- for `ACADEMIC_ADVISING`, support optional evidence and required disclaimer;
- if the prompt is actually policy-like, refuse and tell caller to use policy route;
- preserve Gemma primary and Gemini backup metadata.

### Modify: `aast-ai-agent-main/backend/services/responseFormatter.js`

Exact functions/areas:

- `format(...)`
- `formatStatic(...)`
- `formatErrorFallback(...)`

Required changes:

- include `query_classification` in `metadata.trace`;
- include classification confidence and evidence contract in explainability;
- do not rename existing route/source fields.

### Modify only if needed: `aast-ai-agent-main/backend/services/metrics.js`

Only add whitelisted counters if the existing metric system requires registration.

Potential counters:

- `query_classification_policy_total`
- `query_classification_knowledge_total`
- `query_classification_advising_total`
- `query_classification_policy_refusal_total`
- `query_classification_shadow_disagreement_total`

Do not remove or rename existing metrics.

### New file: `aast-ai-agent-main/backend/testing/queryClassificationSimulation.js`

Purpose:

- executable offline simulation,
- at least the 104 cases in `QUERY_CLASSIFICATION_SIMULATION.md`,
- no live API calls,
- verifies false policy/knowledge/advising counts.

Required checks:

- false policy classification must be 0,
- false knowledge classification must be 0 for policy-domain queries,
- false advising classification must be 0 for policy-domain queries,
- no golden path route names changed.

## Implementation Sequence

1. Implement `queryClassificationService.js` in isolation.
2. Add offline simulation tests for the 104-query set.
3. Run static simulation only; do not connect to runtime services.
4. Add classifier to `orchestrator.js` in shadow mode first.
5. Add classification trace to `responseFormatter.js`.
6. Add knowledge/advising answer path in `unifiedAnswerService.js`.
7. Enable behavior only for `ACADEMIC_KNOWLEDGE` first.
8. Keep `ACADEMIC_POLICY` as trace-only until policy regression tests pass.
9. Enable `ACADEMIC_ADVISING` fallback only after policy and knowledge pass.

## Migration Risk

High-risk areas:

- policy queries could be misclassified as knowledge and answered without evidence,
- current RAG precision could decrease if category hints change,
- explainability could decrease if route diagnostics are replaced instead of extended,
- deterministic KG/RAG direct answers could change if classifier overrides route locks,
- latency could increase if advising always performs RAG before LLM.

Mitigations:

- default to shadow mode for the first implementation pass,
- fail closed to policy when uncertain,
- preserve current route labels,
- preserve current deterministic bypasses,
- do not change RAG schema or Qdrant payloads,
- do not change Neo4j queries,
- do not change Docker or compose,
- do not change package dependencies,
- add classification metadata instead of changing response shape.

## Rollback Plan

Fast rollback:

- set `QUERY_CLASSIFICATION_ENABLED=false` or equivalent runtime flag if added,
- leave classifier in shadow mode only,
- route all requests through current `brainRouter.js` behavior.

Code rollback:

- remove `queryClassificationService.js`,
- remove classifier import/call from `orchestrator.js`,
- remove `query_classification` trace injection from `responseFormatter.js`,
- remove new knowledge/advising answer export from `unifiedAnswerService.js`,
- remove classification simulation file.

No rollback should touch:

- Docker volumes,
- Neo4j,
- Qdrant,
- compose files,
- package files,
- existing health endpoints.

## Required Verification Before Merge

Static:

- `node --check aast-ai-agent-main/backend/services/queryClassificationService.js`
- `node --check aast-ai-agent-main/backend/orchestrator.js`
- `node --check aast-ai-agent-main/backend/services/unifiedAnswerService.js`
- `node --check aast-ai-agent-main/backend/services/responseFormatter.js`

Offline simulation:

- run `backend/testing/queryClassificationSimulation.js`
- require 0 false policy classification
- require 0 false knowledge classification on policy-domain questions
- require 0 false advising classification on policy-domain questions

Runtime smoke after approval only:

- one policy query with evidence,
- one policy query without evidence,
- one general knowledge query without university evidence,
- one advising query with evidence,
- one advising query without evidence,
- one existing golden path query,
- one deterministic KG person/course query,
- one FAQ query.

## Safety Gate

Before implementation, the answers are:

1. Can current policy behavior break?

YES. If the classifier is inserted before golden path, deterministic KG, deterministic RAG, or RAG empty-result guards, policy behavior can change.

2. Can RAG precision decrease?

YES. If new category mapping changes RAG category hints, query expansion, or fallback behavior, RAG precision can decrease.

3. Can explainability decrease?

YES. If classification replaces route diagnostics instead of extending them, explainability decreases.

4. Can deterministic answers change?

YES. If classifier output overrides `KG_DIRECT`, `RAG_DIRECT`, golden path, FAQ, or deterministic multi-intent branches, deterministic answers can change.

5. Can routing latency increase?

YES. Advising flow adds "try evidence first, then LLM" behavior and can increase latency if not bounded.

## Gate Verdict

STOP.

Do not implement yet.

Reason: the safety gate has YES answers. The architecture is feasible, but it is only safe if implemented in shadow mode first, with policy-first fail-closed behavior and explicit approval after the reports are reviewed.

