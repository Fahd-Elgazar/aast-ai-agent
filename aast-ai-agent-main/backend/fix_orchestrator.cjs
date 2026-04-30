const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'orchestrator.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add extractBalancedJSON
const extractBalancedStr = `const intentCache = new Map();
const neo4jCache = new Map();

function extractBalancedJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  text = text.slice(start, end + 1);

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") depth--;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }
  return null;
}

async function extractDynamicIntent(query, requestId, isRetry = false) {`;
code = code.replace(
  'const intentCache = new Map();\nconst neo4jCache = new Map();\n\nasync function extractDynamicIntent(query, requestId, isRetry = false) {',
  extractBalancedStr
);

// 2. Update prompt
const oldPrompt = `Rules:
- If asking a factual question (e.g. "What are the modules in AI?"), intent is GENERAL.
- If seeking advice, a choice, or a recommendation (e.g. "What should I study?"), intent is RECOMMEND.
- If asking specifically about a career path or how to become a role, intent is CAREER_PATH_DETAIL.
- If asking to compare two majors or options, intent is COMPARISON.

Query: "\${safeQuery}"

Return ONLY JSON. No explanation. No markdown.
Exact format:`;

const newPrompt = `Rules:
- Output ONLY valid JSON, starting with { and ending with }.
- No markdown, no code blocks, no explanations, no conversational text.
- If asking a factual question (e.g. "What are the modules in AI?"), intent is GENERAL.
- If seeking advice, a choice, or a recommendation (e.g. "What should I study?"), intent is RECOMMEND.
- If asking specifically about a career path or how to become a role, intent is CAREER_PATH_DETAIL.
- If asking to compare two majors or options, intent is COMPARISON.

Query: "\${safeQuery}"

Exact format:`;
code = code.replace(oldPrompt, newPrompt);

// 3. Update parsing logic
const oldParse = `    try {
      const markdownMatch = rawToken.match(/\\u0060\\u0060\\u0060(?:json)?\\s*([\\s\\S]*?)\\s*\\u0060\\u0060\\u0060/);
      const cleanToken = markdownMatch ? markdownMatch[1] : rawToken;
      parsed = JSON.parse(cleanToken);
    } catch {
      console.error(\`[Intent][\${requestId}] Parse Failure: Invalid JSON.\`);`;

const newParse = `    try {
      const jsonString = extractBalancedJSON(rawToken);
      if (!jsonString) throw new Error("Invalid JSON");
      parsed = JSON.parse(jsonString);
    } catch {
      console.error(\`[Intent][\${requestId}] Parse Failure: Invalid JSON.\`);`;
code = code.replace(oldParse, newParse);

// 4. Factual fast-track
const oldFastTrack = `  const memForRouting = getUserMemory(conversationId);
  const isProfileIncomplete = !memForRouting?.studentProfile?.high_school_percentage || !memForRouting?.studentProfile?.budget;

  if ((pMatchQuery || bMatchQuery || kMatchQuery) && isProfileIncomplete) {`;

const newFastTrack = `  const memForRouting = getUserMemory(conversationId);
  const isProfileIncomplete = !memForRouting?.studentProfile?.high_school_percentage || !memForRouting?.studentProfile?.budget;

  const factualRegex = /^(who|what|where|which|how|when)\\b/i;
  const isFactual = factualRegex.test(query.trim());

  if (isFactual) {
    console.log(\`[Routing][\${requestId}] Factual query detected, bypassing intent classifier.\`);
    intentData = { intent: "GENERAL", confidence: 1.0, entities: [] };
  } else if ((pMatchQuery || bMatchQuery || kMatchQuery) && isProfileIncomplete) {`;
code = code.replace(oldFastTrack, newFastTrack);

// 5. Remove Unified LLM and Replace Fallback logic
// We can use string indexOf to slice out the block from `const unifiedPrompt = \`` down to the end of the `if (!KNOWN_INTENTS.includes(intentKeyword))` block.
const startUnifiedIdx = code.indexOf('  const unifiedPrompt = `');
const endKnownIntentsIdx = code.indexOf('  // ---------- TOOL ABSTRACTION ----------');

if (startUnifiedIdx !== -1 && endKnownIntentsIdx !== -1) {
  const newFallbackLogic = `  const MIN_CONFIDENCE = 0.6;
  const KNOWN_INTENTS = ["GENERAL", "RECOMMEND", "RECOMMENDATION", "DECISION", "CAREER_PATH_DETAIL", "COMPARISON", "REJECT", "PREREQUISITE", "DEAN", "UNKNOWN_PARSE", "UNKNOWN_TIMEOUT"];

  if (intentKeyword === "UNKNOWN_PARSE" || intentKeyword === "UNKNOWN_TIMEOUT" || !KNOWN_INTENTS.includes(intentKeyword)) {
    console.log(\`[Chatbot][\${requestId}] Intercepted fallback (\${intentKeyword}). Routing to GENERAL.\`);
    intentKeyword = "GENERAL";
  } else if (confidence < MIN_CONFIDENCE) {
    console.warn(\`[Routing][\${requestId}] Low confidence intent\`, {
      intent: intentKeyword,
      confidence,
      query
    });
    const queryLower = query.toLowerCase();
    const recommendHints = ["recommend", "suggest", "what should i study", "best major"];
    const comparisonHints = ["compare", "difference", "vs", "better than"];

    let semanticOverride = false;

    if (confidence > 0.3) {
      if (recommendHints.some(hint => queryLower.includes(hint))) {
        console.warn(\`[Routing][\${requestId}] Semantic override applied\`, { originalIntent: intentKeyword, newIntent: "RECOMMEND", query });
        intentKeyword = "RECOMMEND";
        semanticOverride = true;
      } else if (comparisonHints.some(hint => queryLower.includes(hint))) {
        console.warn(\`[Routing][\${requestId}] Semantic override applied\`, { originalIntent: intentKeyword, newIntent: "COMPARISON", query });
        intentKeyword = "COMPARISON";
        semanticOverride = true;
      }
    }

    if (!semanticOverride) {
       console.log(\`[Chatbot][\${requestId}] Low confidence without override. Routing to GENERAL.\`);
       intentKeyword = "GENERAL";
    }
  }

`;
  code = code.slice(0, startUnifiedIdx) + newFallbackLogic + code.slice(endKnownIntentsIdx);
}

// 6. Remove Optional Tool Calling Layer
const startToolLayerIdx = code.indexOf('  const safeEntities = Array.isArray(unifiedDecision?.entities)');
const endToolLayerIdx = code.indexOf('  // Resolve routing intent aliases safely');

if (startToolLayerIdx !== -1 && endToolLayerIdx !== -1) {
  const newSafeEntities = `  const safeEntities = Array.isArray(intentData?.entities)
    ? intentData.entities
    : [];

`;
  code = code.slice(0, startToolLayerIdx) + newSafeEntities + code.slice(endToolLayerIdx);
}

fs.writeFileSync(filePath, code);
console.log("orchestrator.js successfully updated.");
