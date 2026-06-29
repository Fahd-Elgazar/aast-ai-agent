# Professor Attack Simulation

Prepare for these aggressive questions. If you use the "Weak Answer," you will be penalized. Use the "Strong Answer."

### Attack 1: The Hallucination Challenge
**Question**: *"You claim GraphRAG prevents hallucinations. But at the end of the day, you are still feeding text into an LLM. How can you mathematically guarantee the LLM won't ignore the Graph context and invent a prerequisite?"*
* **Weak Answer**: "We put in the prompt 'do not hallucinate' and the LLM usually listens to the context."
* **Strong Answer**: "We cannot mathematically guarantee the LLM's text output. However, our Explainability Layer acts as a deterministic safety net. The UI independently renders the Neo4j Graph nodes fetched by the orchestrator alongside the text. If the LLM hallucinates, the visual graph will contradict it, allowing the user to immediately detect the discrepancy based on the primary source of truth."

### Attack 2: The Latency Challenge
**Question**: *"Your end-to-end request involves a Node server hitting a Python server hitting Qdrant, while simultaneously hitting Neo4j, fusing JSON, and calling an external Cloud LLM. This seems incredibly bloated. What is your latency overhead?"*
* **Weak Answer**: "It's a little slow, usually takes 5 to 10 seconds, but that's normal for AI."
* **Strong Answer**: "We aggressively optimized latency through parallel execution. The Brain Router dispatches the Neo4j query and the Python/Qdrant query asynchronously via `Promise.all`. The only blocking synchronous bottleneck is the final LLM generation. Furthermore, by using heuristic routing instead of LLM-based routing, we shaved ~800ms off the pipeline."

### Attack 3: The Data Invalidation Challenge
**Question**: *"A new university policy is published today that overrides last year's probation policy. How does your Vector database know which policy is the right one? Won't semantic search return both and confuse the LLM?"*
* **Weak Answer**: "We just upload the new PDF to Qdrant."
* **Strong Answer**: "Vector databases don't understand temporal deprecation natively. To solve this, our ingestion pipeline attaches semantic metadata (e.g., `academic_year`, `policy_status`) to the vector payloads. When the Python retriever queries Qdrant, it applies a metadata filter to strictly exclude `status=deprecated` vectors, ensuring the LLM only receives active policies."

### Attack 4: The Circuit Breaker Flaw
**Question**: *"Your Circuit Breaker falls back to Ollama when Gemini goes down. But if Gemini times out after 10 seconds, and Ollama takes 10 seconds to load the model into VRAM, the user has waited 20 seconds. This is terrible UX. How do you defend this?"*
* **Weak Answer**: "We couldn't fix Ollama's load time, so the user just has to wait."
* **Strong Answer**: "You are correct about cold-start latency. To mitigate this, our `circuitStateManager.js` monitors degradation *before* failure. If error rates spike, the circuit enters a `DEGRADED` state and sends a pre-warm ping to Ollama to load the model into VRAM in the background *before* the circuit fully opens. This masks the cold-start penalty."

### Attack 5: The Scalability Challenge
**Question**: *"Node.js is single-threaded. Your `fusionService.js` is processing large arrays of graph relationships and vector chunks. Under a load of 500 concurrent students, won't you block the event loop and crash the Orchestrator?"*
* **Weak Answer**: "Node is fast enough for our current user base."
* **Strong Answer**: "That is a valid concern for heavy JSON parsing. Currently, the orchestrator handles lightweight fusion via mapping. If deployed at scale, the fusion and formatting logic should be offloaded either to a dedicated worker thread pool in Node.js, or shifted down to the Python microservice which is better suited for heavy data transformation, leaving Node to act strictly as a non-blocking API gateway."
