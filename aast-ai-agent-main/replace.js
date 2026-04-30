const fs = require('fs');
let c = fs.readFileSync('backend/orchestrator.js', 'utf8');
const startIdx = c.indexOf('  // ---------- CAREER PATH ROUTING ----------');
const endIdx = c.lastIndexOf('});');

if (startIdx !== -1 && endIdx !== -1) {
  const newContent = `  // ---------- TOOL ABSTRACTION ----------
  const toolContext = {
    query,
    entities,
    convo,
    requestId,
    conversationId,
    res,
    intentKeyword,
    intentData
  };

  const TOOLS = {
    CAREER_PATH_DETAIL: async (ctx) => {
      const { query, entities, convo, requestId, conversationId, res, intentKeyword } = ctx;
      console.log(\`[CareerPath] Memory lookup for CID:\`, conversationId);
      const memory = getUserMemory(conversationId);
      let answer = "";
      
      if (!memory || Object.keys(memory).length === 0) {
        answer = "We need to find the right major for you first! Should we start with a recommendation?";
      } else {
        const roadmap = buildCareerRoadmap(null, null, memory);
        const role = roadmap.target_roles?.[0] || 'Professional';
        const skills = roadmap.top_skills?.join(', ') || 'core skills';
        const demand = roadmap.industry_demand || 'solid market outlook';
        const timeline = roadmap.timeline || [];

        answer = \`To become a \${role}, here is your plan:\\n\\n1. Focus on \${skills}.\\n2. Look for \${demand}\\n3. Follow the timeline:\\n   - \${timeline.join('\\n   - ')}\`;
      }

      pushTurn(convo, "assistant", answer);
      return res.json({ answer, source: "career_path", cid: conversationId, requestId });
    },

    COMPARISON: async (ctx) => {
      const { query, entities, convo, requestId, conversationId, res, intentKeyword } = ctx;
      console.log(\`[Comparison] Entities extracted:\`, entities);
      const memory = getUserMemory(conversationId);
      
      if (entities.length < 2) {
        const detected = entities[0] || "that major";
        const answer = \`I see you're interested in \${detected}. Which other major would you like to compare it with? (e.g., "Compare \${detected} with AI")\`;
        pushTurn(convo, "assistant", answer);
        return res.json({ answer, source: "comparison", cid: conversationId, requestId });
      }

      const majorA = entities[0];
      const majorB = entities[1];
      const safeProfile = memory?.studentProfile || {};
      const comparison = compareMajors(majorA, majorB, safeProfile);

      let answer = \`Here is a structured comparison between **\${majorA}** and **\${majorB}**:\\n\\n\`;
      answer += \`💰 **Salary Outlook:**\\n\${comparison.salary_outlook}\\n\\n\`;
      answer += \`⚡ **Difficulty Level (1-10):**\\n- \${majorA}: \${comparison.difficulty_level[majorA]}/10\\n- \${majorB}: \${comparison.difficulty_level[majorB]}/10\\n*(Based on your background profile)*\\n\\n\`;
      answer += \`🧠 **Skills Overlap:**\\n\${comparison.skills_overlap}\\n\\n\`;
      answer += \`🚀 **Career Progression:**\\n\${comparison.career_progression}\\n\`;

      pushTurn(convo, "assistant", answer);
      return res.json({ answer, source: "comparison", cid: conversationId, requestId });
    },

    RECOMMEND: async (ctx) => {
      const { query, entities, convo, requestId, conversationId, res, intentKeyword, intentData } = ctx;
      
      const queryLower2 = query.toLowerCase();
      const hasNegativeKeyword = queryLower2.includes("don't like") || queryLower2.includes("something else") || queryLower2.includes("not this one") || queryLower2.includes("other options") || queryLower2.includes("don't want");
      const isLLMReject = intentKeyword === "REJECT" && intentData.confidence > 0.7;
      const isNegative = hasNegativeKeyword || isLLMReject;

      console.log(\`[Decision] Input Query:\`, query);
      const memory = getUserMemory(conversationId);
      
      if (isNegative && memory && memory.last_recommendation) {
        console.log(\`[Decision] Pushing programmatic rejection for: \${memory.last_recommendation}\`);
        await updateUserMemory(conversationId, {
          rejected_majors: [memory.last_recommendation]
        });
      }

      console.log(\`[Decision] Memory:\`, memory);

      try {
        const decisionResult = await getRecommendation({ text: query, memory: memory, cid: conversationId });
        console.log(\`[Decision] Result:\`, decisionResult);

        if (!decisionResult || decisionResult.is_fallback) {
          console.warn("[Decision] Fallback triggered");
          return res.json({ answer: "⚠️ Decision system is currently unavailable. Please try again.", source: "decision", cid: conversationId, requestId });
        }

        if (decisionResult.is_missing_data) {
          console.log(\`[DecisionRoute][\${requestId}] Result: Missing data\`);
          const fields = decisionResult.missing_fields || [];
          const missingList = fields.join(" and ");
          let missingMsg = \`I'd love to help with a recommendation, but I need to know your \${missingList} first!\`;
          pushTurn(convo, "assistant", missingMsg);
          return res.json({ answer: missingMsg, source: "decision", cid: conversationId, requestId });
        }

        if (decisionResult && decisionResult.success) {
          const rec = decisionResult;
          console.log(\`[DecisionRoute][\${requestId}] Result: Success\`);

          const confidenceScore = rec.confidence > 1 ? rec.confidence : rec.confidence * 100;
          let responseAnswer = "";
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          try {
            const llmPrompt = \`Generate a short, highly personalized and encouraging narrative for a student recommending they study '\${rec.recommended_major}'.
Context metrics: Confidence is \${confidenceScore.toFixed(1)}%. Reason: \${rec.reason}. Top skills needed: \${rec.career_roadmap?.top_skills?.join(', ')}.
Requirements:
1) Explain briefly why this major fits them using the provided reason.
2) Give a brief encouraging summary of their realistic timeline (e.g., "In 4 years, you will be ready for...").
3) Mention exactly 1 specific skill from the top skills they should start learning today.
Keep it under 5 sentences. Be warm and professional. Do NOT use emojis.\`;

            const llmRes = await fetch("http://localhost:11434/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ model: "llama3.2:3b-instruct-q4_K_M", prompt: llmPrompt, stream: false }),
              signal: controller.signal
            });
            const llmData = await llmRes.json();
            responseAnswer = llmData?.response?.trim();
          } catch (e) {
            console.error("Personalization LLM failed", e);
          } finally {
            clearTimeout(timeout);
          }

          if (!responseAnswer || responseAnswer.length < 10) {
            responseAnswer = \`🎓 **Recommended Major: \${rec.recommended_major}**\\n\\nStudy this major because \${rec.reason}. In 4 years you'll be well on your way! Start by looking into \${rec.career_roadmap?.top_skills?.[0] || 'core basics'}.\`;
          }

          if (rec.next_steps && rec.next_steps.length > 0) {
            responseAnswer += \`\\n\\n🚀 Your Next Steps:\\n- \${rec.next_steps.join("\\n- ")}\`;
          }

          pushTurn(convo, "assistant", responseAnswer);
          return res.json({ answer: responseAnswer, source: "decision", decision: decisionResult, cid: conversationId, requestId });
        }
      } catch (err) {
        console.error("Decision Routing Error:", { requestId, message: err.message, query });
        return res.json({ answer: "Recommendation system encountered an error. Please try again.", source: "decision", cid: conversationId, requestId });
      }
    },

    GENERAL: async (ctx) => {
      const { query, entities, convo, requestId, conversationId, res, intentKeyword } = ctx;
      let graphContext = [];
      const qKey = query.toLowerCase().trim();
      const cachedNeo = neo4jCache.get(qKey);
      if (cachedNeo && Date.now() - cachedNeo.time < 60000) {
        graphContext = cachedNeo.data;
      } else {
        try {
          const [neoFacts, entityFacts] = await Promise.all([
            fetchNeo4jContext(query, intentKeyword, 5),
            fetchEntitiesFromNeo4j(entities)
          ]);

          const combined = [...neoFacts, ...entityFacts];
          const seen = new Set();
          graphContext = combined.filter(item => {
            const duplicate = seen.has(item.text);
            seen.add(item.text);
            return !duplicate;
          });
          
          neo4jCache.set(qKey, { time: Date.now(), data: graphContext });
          if (neo4jCache.size > 50) neo4jCache.delete(neo4jCache.keys().next().value);
        } catch (err) {
          console.error(\`[RAG][\${requestId}] Neo4j Error:\`, err.message);
        }
      }

      const faqHit = searchFAQ(query);
      if (faqHit && graphContext.length === 0) {
        return res.json({ answer: faqHit.answer, source: "faq", cid: conversationId, requestId });
      }

      const graphText = graphContext.map(f => f.text).join("\\n");
      const systemPrompt = \`You are the AAST University Assistant. If info is missing, say "I don't have that information in the knowledge graph."\\n\\nCONTEXT:\\n\${graphText}\`;

      updateSystemPrompt(convo, systemPrompt);

      for (let attempt = 1; attempt <= 2; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); 

        try {
          const prompt = convo.messages.map(m => \`\${m.role.toUpperCase()}: \${m.content}\`).join("\\n\\n");
          const resLLM = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama3.2:3b-instruct-q4_K_M", prompt, stream: false }),
            signal: controller.signal
          });

          clearTimeout(timeout);
          const data = await resLLM.json();
          const finalAnswer = (data?.response || "I'm sorry, I couldn't generate an answer.").trim();

          pushTurn(convo, "assistant", finalAnswer);
          const parsedGraph = convertToGraphData(graphContext);
          return res.json({ answer: finalAnswer, source: "rag", graph: parsedGraph, cid: conversationId, requestId });

        } catch (err) {
          clearTimeout(timeout);
          if (err.name === "AbortError") {
            if (attempt === 1) {
              console.warn(\`[RAG][\${requestId}] Timeout, retrying...\`);
              continue;
            }
            console.error("Ollama Timeout (Generation):", { requestId }); 
            logToFile(\`OLLAMA TIMEOUT [\${requestId}] (Generation)\`); 
            return res.json({ answer: "I'm sorry, the request timed out. Please try again.", source: "rag", cid: conversationId, requestId });
          }
          console.error(\`[LLM][\${requestId}] Error:\`, err.message);
          return res.json({ answer: "System error occurred.", source: "error", cid: conversationId, requestId });
        }
      }
    }
  };

  TOOLS.RECOMMENDATION = TOOLS.RECOMMEND;
  TOOLS.DECISION = TOOLS.RECOMMEND;

  // Resolve routing intent aliases safely
  const queryLowerCheck = query.toLowerCase();
  const isNegativeCheck = queryLowerCheck.includes("don't like") || queryLowerCheck.includes("something else") || queryLowerCheck.includes("not this one") || queryLowerCheck.includes("other options") || queryLowerCheck.includes("don't want") || (intentKeyword === "REJECT" && intentData.confidence > 0.7);
  
  if (isNegativeCheck) intentKeyword = "RECOMMEND";
  if (!TOOLS[intentKeyword]) intentKeyword = "GENERAL";

  console.log(\`[Tool][\${requestId}] Executing tool: \${intentKeyword}\`);
  if (TOOLS[intentKeyword]) {
    return await TOOLS[intentKeyword](toolContext);
  }
`;

  fs.writeFileSync('backend/orchestrator.js', c.substring(0, startIdx) + newContent + '\n});');
  console.log('success');
} else {
  console.log('fail', startIdx, endIdx);
}
