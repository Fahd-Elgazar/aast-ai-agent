import { getSession } from "../db/neo4j.js";
import fetch from "node-fetch";
import { logger } from "./logger.js";
import { incrementMetric, recordDuration, startTimer } from "./metrics.js";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

/* ============================================================
   OLLAMA EMBEDDING
============================================================ */

async function embed(text, requestId = "none") {
  const maxAttempts = Number(process.env.EMBED_MAX_ATTEMPTS || 2);
  const timeoutMs = Number(process.env.EMBED_TIMEOUT_MS || 30000);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const stopEmbeddingTimer = startTimer();
    let durationRecorded = false;

    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "nomic-embed-text",
          prompt: text
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      recordDuration("embedding.latency_ms", stopEmbeddingTimer());
      durationRecorded = true;

      if (!res.ok) {
        throw new Error(`Embedding service returned HTTP ${res.status}`);
      }

      const json = await res.json();

      if (!json || !json.embedding) {
        throw new Error("Embedding failed: missing embedding vector");
      }

      if (attempt > 1) {
        incrementMetric("embedding.retry_success");
      }

      return json.embedding;
    } catch (err) {
      clearTimeout(timeout);
      if (!durationRecorded) {
        recordDuration("embedding.latency_ms", stopEmbeddingTimer());
      }
      lastError = err;

      if (err.name === "AbortError") {
        incrementMetric("embedding.timeout");
        logger.warn("Embedding request timed out", {
          requestId,
          attempt,
          maxAttempts,
          timeoutMs
        });
      } else {
        incrementMetric("embedding.error");
        logger.warn("Embedding request failed", {
          requestId,
          attempt,
          maxAttempts,
          error: err.message
        });
      }
    }
  }

  incrementMetric("embedding.failed");
  throw lastError || new Error("Embedding failed after retries");
}

async function refineAnswerWithLocalLLM(facts, query) {
  // Disable GRAPH augmentation if ENABLE_GRAPH is set to false
  if (process.env.ENABLE_GRAPH === 'false') return null;

  const factTexts = facts.map(fact => fact?.text).filter(Boolean);
  if (factTexts.length === 0) return null;

  const maxAttempts = Number(process.env.GRAPH_MAX_ATTEMPTS || 2);
  const timeoutMs = Number(process.env.GRAPH_TIMEOUT_MS || 8000);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OLLAMA_GRAPH_MODEL || process.env.OLLAMA_MODEL || "llama3.1",
          prompt: `User Question:
${query}

Academic Facts:
${factTexts.join("\n")}

Generate a concise academic answer using only the facts above. If the facts are insufficient, say that the information was not found.`,
          stream: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (!res.ok) {
        throw new Error(`GRAPH service returned HTTP ${res.status}`);
      }

      const json = await res.json();
      const response = json?.response?.trim();
      if (response) {
        if (attempt > 1) {
        incrementMetric("knowledge_graph.retry_success");
        }
        return response;
      } else {
        throw new Error("GRAPH response empty");
      }
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      if (err.name === "AbortError") {
        incrementMetric("knowledge_graph.timeout");
        logger.warn("GRAPH request timed out", {
          attempt,
          maxAttempts,
          timeoutMs
        });
      } else {
        incrementMetric("knowledge_graph.error");
        logger.warn("GRAPH augmentation unavailable", {
          attempt,
          maxAttempts,
          error: err.message
        });
      }
    }
  }

  incrementMetric("knowledge_graph.failed");
  return null;
}

/* ============================================================
   QUERY UNDERSTANDING
============================================================ */

const NO_RESULT_MESSAGE = "I couldn't find relevant academic information for that query.";
const RELATIONS_PER_NODE = 6;
const RETRIEVAL_THRESHOLDS = [0.45, 0.35, 0.25];
const ACADEMIC_RELATIONS = [
  "TEACHES",
  "HAS_COURSE",
  "HAS_PREREQUISITE",
  "HAS_ADMIN",
  "DEAN_OF",
  "HEAD_OF",
  "ADMINISTERS",
  "WORKS_IN",
  "HAS_ROLE"
];
const ADMIN_RELATIONS = [
  "HAS_ADMIN",
  "DEAN_OF",
  "HEAD_OF",
  "ADMINISTERS",
  "CHAIRS",
  "DIRECTS",
  "MANAGES"
];

const STOP_WORDS = new Set([
  "a",
  "about",
  "all",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "before",
  "between",
  "by",
  "can",
  "class",
  "classes",
  "compare",
  "comparison",
  "course",
  "courses",
  "degree",
  "degrees",
  "describe",
  "description",
  "did",
  "difference",
  "differences",
  "different",
  "do",
  "doctor",
  "does",
  "dr",
  "explain",
  "find",
  "for",
  "from",
  "give",
  "how",
  "in",
  "info",
  "instruct",
  "instructor",
  "instructors",
  "instructs",
  "into",
  "is",
  "list",
  "major",
  "majors",
  "me",
  "of",
  "on",
  "or",
  "please",
  "professor",
  "professors",
  "program",
  "programme",
  "programmes",
  "programs",
  "prequisite",
  "prequsties",
  "prerequisite",
  "prerequisites",
  "required",
  "requirement",
  "requirements",
  "show",
  "staff",
  "subject",
  "subjects",
  "taught",
  "taking",
  "teach",
  "teacher",
  "teachers",
  "teaches",
  "teaching",
  "tell",
  "the",
  "to",
  "versus",
  "vs",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with"
]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(?:[a-z]\.){2,}/g, match => match.replace(/\./g, ""))
    .replace(/[_-]+/g, " ")
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9+#\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntent(query, requestedIntent = "ALL") {
  const normalizedQuery = normalizeText(query);
  const normalizedIntent = normalizeText(requestedIntent).toUpperCase();

  if (normalizedIntent === "PERSON") return "PERSON";
  if (normalizedIntent === "ADMIN") return "ADMIN";
  if (normalizedIntent === "PREREQUISITE") return "PREREQUISITE";
  if (normalizedIntent === "TEACHING") return "TEACHING";
  if (["COMPARE", "COMPARISON"].includes(normalizedIntent)) return "COMPARE";
  if (normalizedIntent === "PROGRAM") return "PROGRAM";

  if (/\b(dean|admin|administrator|chairman|director|leadership)\b|\bhead of\b/.test(normalizedQuery)) {
    return "ADMIN";
  }

  if (/\b(prerequisite|prerequisites|prequisite|prequsties|requirements)\b|\brequired before\b|\bbefore taking\b/.test(normalizedQuery)) {
    return "PREREQUISITE";
  }

  if (/\b(teach|teaches|teacher|teachers|teaching|taught|instructs)\b/.test(normalizedQuery)) {
    return "TEACHING";
  }

  if (/\bwho is\b|\b(professor|dr|doctor|instructor|staff)\b/.test(normalizedQuery)) {
    return "PERSON";
  }

  if (/\b(compare|comparison|different|difference|differences|versus|vs)\b/.test(normalizedQuery)) {
    return "COMPARE";
  }

  if (/\b(program|programs|programme|programmes|major|majors|degree|degrees|curriculum|study plan|courses|subjects|track|tracks|roadmap)\b/.test(normalizedQuery)) {
    return "PROGRAM";
  }

  return "GENERAL";
}

function getVectorIndex(intent) {
  return getVectorIndexes(intent)[0];
}

function getVectorIndexes(intent) {
  if (intent === "TEACHING") return ["course_index"];
  if (intent === "PREREQUISITE") return ["course_index", "node_embedding_index"];
  if (intent === "PERSON") return ["professor_embedding_index", "staff_embedding_index", "node_embedding_index"];
  if (intent === "ADMIN") return ["node_embedding_index"];
  if (intent === "PROGRAM" || intent === "COMPARE") return ["program_embedding_index"];
  return ["node_embedding_index"];
}

function addKeyword(keywords, keyword) {
  const normalized = normalizeText(keyword);
  if (!normalized || STOP_WORDS.has(normalized)) return;
  if (!normalized.includes(" ") && normalized.length < 2) return;
  keywords.add(normalized);
}

function addSegmentKeywords(phraseKeywords, tokenKeywords, segment) {
  if (segment.length === 0) return;

  if (segment.length > 1) {
    const maxPhraseSize = Math.min(segment.length, 4);

    for (let size = maxPhraseSize; size >= 2; size -= 1) {
      for (let index = 0; index <= segment.length - size; index += 1) {
        const phrase = segment.slice(index, index + size).join(" ");
        addKeyword(phraseKeywords, phrase);

        const compactPhrase = phrase.replace(/\s+/g, "");
        if (size === 2 && compactPhrase.length >= 4 && compactPhrase.length <= 24) {
          addKeyword(phraseKeywords, compactPhrase);
        }
      }
    }

    if (segment.length <= 6 && segment.every(token => /^[a-z]/.test(token) && !/\d/.test(token))) {
      addKeyword(phraseKeywords, segment.map(token => token[0]).join(""));
    }
  }

  if (segment.length === 1 || segment.some(token => /\d|[+#]/.test(token))) {
    segment.forEach(token => addKeyword(tokenKeywords, token));
  } else {
    segment
      .filter(token => token.length <= 3)
      .forEach(token => addKeyword(tokenKeywords, token));
  }
}

function extractKeywords(query) {
  const normalized = normalizeText(query);
  if (!normalized) return [];

  const phraseKeywords = new Set();
  const tokenKeywords = new Set();
  const tokens = normalized.split(" ");
  let currentSegment = [];

  for (const token of tokens) {
    if (STOP_WORDS.has(token)) {
      addSegmentKeywords(phraseKeywords, tokenKeywords, currentSegment);
      currentSegment = [];
      continue;
    }

    currentSegment.push(token);
  }

  addSegmentKeywords(phraseKeywords, tokenKeywords, currentSegment);
  return Array.from(new Set([...phraseKeywords, ...tokenKeywords])).slice(0, 12);
}

function buildKeywordParams(query) {
  const keywords = extractKeywords(query);

  return {
    keywords,
    phraseKeywords: keywords.filter(keyword => keyword.includes(" ")),
    acronymKeywords: keywords.filter(keyword => /^[a-z0-9+#]{2,6}$/.test(keyword))
  };
}

/* ============================================================
   CYPHER BUILDERS
============================================================ */

function normalizeCypherExpression(expression) {
  return `replace(replace(replace(toLower(coalesce(${expression}, "")), " ", ""), "-", ""), "_", "")`;
}

function normalizedKeywordCypher(keywordVar = "k") {
  return `replace(replace(replace(toLower(${keywordVar}), " ", ""), "-", ""), "_", "")`;
}

function keywordFields(variableName) {
  return [
    `${variableName}.name`,
    `${variableName}.title`,
    `${variableName}.role`,
    `${variableName}.department`,
    `${variableName}.college`,
    `${variableName}.faculty`,
    `${variableName}.code`,
    `${variableName}.course_code`,
    `${variableName}.description`,
    `${variableName}.info`
  ];
}

function keywordContainsPredicate(primaryVar, relatedVar = null) {
  const fields = keywordFields(primaryVar);
  if (relatedVar) fields.push(...keywordFields(relatedVar));

  return `(
    size($keywords) = 0
    OR ${fields.map(field => `ANY(k IN $keywords WHERE ${normalizeCypherExpression(field)} CONTAINS ${normalizedKeywordCypher()})`).join("\n    OR ")}
  )`;
}

function adminScopeKeywordPredicate(primaryVar, relatedVar) {
  const ignored = `["dean", "admin", "administrator", "chairman", "director", "leadership", "head"]`;
  const fields = [...keywordFields(primaryVar), ...keywordFields(relatedVar)];

  return `ANY(k IN $keywords WHERE NOT k IN ${ignored} AND (${fields.map(field => `${normalizeCypherExpression(field)} CONTAINS ${normalizedKeywordCypher()}`).join(" OR ")}))`;
}

function cypherStringList(values) {
  return `[${values.map(value => `"${value}"`).join(", ")}]`;
}

function exactEntityPredicate(variableName, keywordParam = "$keywords") {
  const fields = [
    `${variableName}.name`,
    `${variableName}.title`,
    `${variableName}.code`,
    `${variableName}.course_code`
  ];

  return `ANY(k IN ${keywordParam} WHERE ${fields.map(field => `${normalizeCypherExpression(field)} = ${normalizedKeywordCypher()}`).join(" OR ")})`;
}

function keywordMatchBooleans(primaryVar, relatedVar) {
  return `
    ${exactEntityPredicate(primaryVar, "$phraseKeywords")} AS nodeExactPhraseMatch,
    ANY(k IN $keywords WHERE ${normalizeCypherExpression(`${primaryVar}.name`)} = ${normalizedKeywordCypher()}) AS nodeExactKeywordMatch,
    ${exactEntityPredicate(primaryVar, "$acronymKeywords")} AS nodeAcronymMatch,
    ANY(k IN $keywords WHERE ${normalizeCypherExpression(`${primaryVar}.name`)} CONTAINS ${normalizedKeywordCypher()}) AS nodeKeywordMatch,
    CASE WHEN ${relatedVar} IS NOT NULL THEN ${exactEntityPredicate(relatedVar, "$phraseKeywords")} ELSE false END AS relatedExactPhraseMatch,
    CASE WHEN ${relatedVar} IS NOT NULL THEN ANY(k IN $keywords WHERE ${normalizeCypherExpression(`${relatedVar}.name`)} = ${normalizedKeywordCypher()}) ELSE false END AS relatedExactKeywordMatch,
    CASE WHEN ${relatedVar} IS NOT NULL THEN ${exactEntityPredicate(relatedVar, "$acronymKeywords")} ELSE false END AS relatedAcronymMatch,
    CASE WHEN ${relatedVar} IS NOT NULL THEN ANY(k IN $keywords WHERE ${normalizeCypherExpression(`${relatedVar}.name`)} CONTAINS ${normalizedKeywordCypher()}) ELSE false END AS relatedKeywordMatch
  `;
}

function returnProjection(nodeVar, relatedVar, relVar) {
  return `
    RETURN
      elementId(${nodeVar}) AS id,
      labels(${nodeVar})[0] AS label,
      coalesce(${nodeVar}.name, ${nodeVar}.college, ${nodeVar}.title, ${nodeVar}.institution) AS name,
      ${nodeVar} {.*, embedding: null} AS props,
      CASE WHEN ${relatedVar} IS NULL THEN null ELSE elementId(${relatedVar}) END AS relatedId,
      CASE WHEN ${relatedVar} IS NULL THEN null ELSE labels(${relatedVar})[0] END AS relatedLabel,
      coalesce(${relatedVar}.name, ${relatedVar}.college, ${relatedVar}.title, ${relatedVar}.institution) AS relatedName,
      CASE WHEN ${relatedVar} IS NULL THEN null ELSE ${relatedVar} {.*, embedding: null} END AS relatedProps,
      type(${relVar}) AS relType,
      CASE WHEN ${relVar} IS NULL THEN null ELSE coalesce(startNode(${relVar}).name, startNode(${relVar}).college, startNode(${relVar}).title, startNode(${relVar}).institution) END AS relSourceName,
      CASE WHEN ${relVar} IS NULL THEN null ELSE labels(startNode(${relVar}))[0] END AS relSourceLabel,
      CASE WHEN ${relVar} IS NULL THEN null ELSE coalesce(endNode(${relVar}).name, endNode(${relVar}).college, endNode(${relVar}).title, endNode(${relVar}).institution) END AS relTargetName,
      CASE WHEN ${relVar} IS NULL THEN null ELSE labels(endNode(${relVar}))[0] END AS relTargetLabel,
      semanticScore AS baseScore,
      boostedScore AS boostedScore,
      finalScore AS score,
      relationRank AS relationRank,
      nodeKeywordMatch AS nodeKeywordMatch,
      relatedKeywordMatch AS relatedKeywordMatch
    ORDER BY score DESC, relationRank ASC
  `;
}

function buildTeachingCypher(searchLimit, resultLimit) {
  return `
    CALL db.index.vector.queryNodes($indexName, ${50}, $vector)
    YIELD node AS courseNode, score AS semanticScore
    WHERE semanticScore >= $threshold

    MATCH (staffNode)-[teachesRel:TEACHES]->(courseNode)
    WHERE coalesce(staffNode.name, "") <> ""
      AND ${keywordContainsPredicate("courseNode", "staffNode")}

    WITH courseNode, staffNode, teachesRel, semanticScore,
      ${keywordMatchBooleans("courseNode", "staffNode")}

    WITH courseNode, staffNode, teachesRel, semanticScore, nodeKeywordMatch, relatedKeywordMatch,
      CASE
        WHEN nodeExactPhraseMatch THEN semanticScore * 3.2
        WHEN nodeExactKeywordMatch THEN semanticScore * 2.8
        WHEN nodeAcronymMatch THEN semanticScore * 2.6
        WHEN nodeKeywordMatch THEN semanticScore * 2.2
        WHEN relatedExactPhraseMatch THEN semanticScore * 2.0
        WHEN relatedExactKeywordMatch THEN semanticScore * 1.9
        WHEN relatedAcronymMatch THEN semanticScore * 1.8
        WHEN relatedKeywordMatch THEN semanticScore * 1.6
        ELSE semanticScore * 1.5
      END AS boostedScore,
      0 AS relationRank

    WITH courseNode, staffNode, teachesRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
      boostedScore AS finalScore

    ${returnProjection("courseNode", "staffNode", "teachesRel")}
    LIMIT ${resultLimit}
  `;
}

function buildProgramCypher(searchLimit, resultLimit) {
  return `
    CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
    YIELD node AS programNode, score AS semanticScore
    WHERE semanticScore >= $threshold

    OPTIONAL MATCH (programNode)-[courseRel:HAS_COURSE]->(courseNode)
    WITH programNode, courseNode, courseRel, semanticScore
    WHERE courseRel IS NULL OR coalesce(courseNode.name, "") <> ""
    WITH programNode, courseNode, courseRel, semanticScore
    WHERE ${keywordContainsPredicate("programNode", "courseNode")}

    WITH programNode, courseNode, courseRel, semanticScore,
      ${keywordMatchBooleans("programNode", "courseNode")}

    WITH programNode, courseNode, courseRel, semanticScore, nodeKeywordMatch, relatedKeywordMatch,
      CASE
        WHEN nodeExactPhraseMatch THEN semanticScore * 2.8
        WHEN nodeExactKeywordMatch THEN semanticScore * 2.4
        WHEN nodeAcronymMatch THEN semanticScore * 2.1
        WHEN nodeKeywordMatch THEN semanticScore * 1.7
        WHEN relatedExactPhraseMatch THEN semanticScore * 1.6
        WHEN relatedExactKeywordMatch THEN semanticScore * 1.45
        WHEN relatedAcronymMatch THEN semanticScore * 1.35
        WHEN relatedKeywordMatch THEN semanticScore * 1.25
        ELSE semanticScore
      END *
      CASE WHEN type(courseRel) = "HAS_COURSE" THEN 1.5 ELSE 1 END AS boostedScore,
      CASE WHEN type(courseRel) = "HAS_COURSE" THEN 0 ELSE 2 END AS relationRank

    WITH programNode, courseNode, courseRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
      boostedScore AS finalScore

    ${returnProjection("programNode", "courseNode", "courseRel")}
    LIMIT ${resultLimit}
  `;
}

function buildPersonCypher(searchLimit, resultLimit) {
  return `
    CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
    YIELD node AS personNode, score AS semanticScore
    WHERE semanticScore >= $threshold
      AND coalesce(personNode.name, "") <> ""
      AND (
        ANY(nodeLabel IN labels(personNode) WHERE nodeLabel IN ["Person", "Professor", "TeachingStaff", "Staff", "Instructor"])
        OR toLower(coalesce(personNode.role, "")) CONTAINS "professor"
        OR toLower(coalesce(personNode.role, "")) CONTAINS "instructor"
        OR toLower(coalesce(personNode.title, "")) CONTAINS "professor"
        OR toLower(coalesce(personNode.title, "")) CONTAINS "instructor"
      )
      AND ${keywordContainsPredicate("personNode")}

    // Compute exact-match booleans early for filtering
    WITH personNode, semanticScore,
      ${exactEntityPredicate("personNode", "$phraseKeywords")} AS _nodeExactPhrase,
      ANY(k IN $keywords WHERE ${normalizeCypherExpression("personNode.name")} = ${normalizedKeywordCypher()}) AS _nodeExactKw
    WHERE _nodeExactPhrase OR _nodeExactKw

    OPTIONAL MATCH (personNode)-[profileRel]-(relatedNode)
    WHERE profileRel IS NULL
      OR type(profileRel) IN ["TEACHES", "HAS_ADMIN", "DEAN_OF", "HEAD_OF", "ADMINISTERS", "CHAIRS", "DIRECTS", "MANAGES", "BELONGS_TO", "WORKS_IN", "MEMBER_OF", "HAS_ROLE"]

    WITH personNode, semanticScore, profileRel, relatedNode,
      CASE
        WHEN type(profileRel) = "TEACHES" THEN 1
        WHEN type(profileRel) IN ${cypherStringList(ADMIN_RELATIONS)} THEN 2
        ELSE 3
      END AS relationPriority
    ORDER BY semanticScore DESC, relationPriority ASC

    WITH personNode, semanticScore,
      [row IN collect(CASE WHEN profileRel IS NULL THEN null ELSE { rel: profileRel, related: relatedNode, rank: relationPriority } END) WHERE row IS NOT NULL][0..${RELATIONS_PER_NODE}] AS relationRows
    UNWIND relationRows + [{ rel: null, related: null, rank: 0 }] AS relationRow

    WITH personNode,
      relationRow.rel AS profileRel,
      relationRow.related AS relatedNode,
      relationRow.rank AS relationRank,
      semanticScore

    WITH personNode,
       profileRel,
       relatedNode,
       relationRank,
       semanticScore,
     ${keywordMatchBooleans("personNode", "relatedNode")}

    WITH personNode, relatedNode, profileRel, semanticScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
      CASE
        WHEN nodeExactPhraseMatch THEN semanticScore * 3.4
        WHEN nodeExactKeywordMatch THEN semanticScore * 3.0
        WHEN nodeAcronymMatch THEN semanticScore * 2.4
        WHEN type(profileRel) = "TEACHES" THEN semanticScore * 1.8
        WHEN type(profileRel) IN ${cypherStringList(ADMIN_RELATIONS)} THEN semanticScore * 1.7
        WHEN nodeKeywordMatch THEN semanticScore * 1.5
        WHEN relatedKeywordMatch THEN semanticScore * 1.2
        ELSE semanticScore
      END AS boostedScore

    WITH personNode, relatedNode, profileRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
      boostedScore AS finalScore

    ${returnProjection("personNode", "relatedNode", "profileRel")}
    LIMIT ${resultLimit}
  `;
}

function buildAdminCypher(searchLimit, resultLimit) {
  return `
    CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
    YIELD node AS matchedNode, score AS semanticScore
    WHERE semanticScore >= $threshold

    MATCH (adminPerson)-[adminRel]->(collegeNode)
    WHERE (
  (
    ANY(k IN $keywords WHERE
      toLower(k) CONTAINS "dean"
      OR toLower(k) CONTAINS "vice"
      OR toLower(k) CONTAINS "assistant"
    )
    AND type(adminRel) IN ["DEAN_OF", "HAS_ADMIN"]
  )
  OR
  (
    NOT ANY(k IN $keywords WHERE
      toLower(k) CONTAINS "dean"
      OR toLower(k) CONTAINS "vice"
      OR toLower(k) CONTAINS "assistant"
    )
    AND type(adminRel) IN ${cypherStringList(ADMIN_RELATIONS)}
  )
)

    WITH matchedNode, semanticScore, adminPerson, adminRel, collegeNode
    WHERE matchedNode = adminPerson
      OR matchedNode = collegeNode
      OR ${adminScopeKeywordPredicate("adminPerson", "collegeNode")}

    WITH collegeNode, adminPerson, adminRel, semanticScore,
         ${keywordMatchBooleans("collegeNode", "adminPerson")}

    WITH collegeNode, adminPerson, adminRel, semanticScore,
         nodeKeywordMatch, relatedKeywordMatch,

         CASE
           WHEN type(adminRel) IN ["HEAD_OF", "HEAD_OF_UNIT"]
                AND ANY(k IN $keywords WHERE toLower(k) CONTAINS "dean")
             THEN semanticScore * 0.3

           WHEN ANY(k IN $keywords WHERE toLower(k) CONTAINS "vice")
                AND toLower(coalesce(adminPerson.role, "")) CONTAINS "vice"
             THEN semanticScore * 12

           WHEN ANY(k IN $keywords WHERE toLower(k) CONTAINS "dean")
                AND (
                  toLower(coalesce(adminPerson.role, "")) CONTAINS "assistant"
                  OR toLower(coalesce(adminPerson.role, "")) CONTAINS "vice"
                  OR toLower(coalesce(adminPerson.role, "")) CONTAINS "associate"
                  OR toLower(coalesce(adminPerson.role, "")) CONTAINS "deputy"
                )
             THEN semanticScore * 0.15

           WHEN type(adminRel) = "DEAN_OF"
             THEN semanticScore * 15

           WHEN type(adminRel) = "HAS_ADMIN"
                AND toLower(coalesce(adminPerson.role, "")) CONTAINS "dean"
                AND NOT toLower(coalesce(adminPerson.role, "")) CONTAINS "assistant"
                AND NOT toLower(coalesce(adminPerson.role, "")) CONTAINS "vice"
                AND NOT toLower(coalesce(adminPerson.role, "")) CONTAINS "associate"
                AND NOT toLower(coalesce(adminPerson.role, "")) CONTAINS "deputy"
             THEN semanticScore * 15

           WHEN type(adminRel) = "HAS_ADMIN"
                AND toLower(coalesce(adminPerson.role, "")) CONTAINS "vice"
             THEN semanticScore * 7

           WHEN type(adminRel) IN ["HEAD_OF", "HEAD_OF_UNIT"]
                AND ANY(k IN $keywords WHERE toLower(k) CONTAINS "head")
             THEN semanticScore * 8

           WHEN type(adminRel) IN ["CHAIRS", "DIRECTS", "MANAGES"]
             THEN semanticScore * 3.8

           WHEN toLower(coalesce(adminPerson.role, "")) CONTAINS "chairman"
                AND ANY(k IN $keywords WHERE toLower(k) CONTAINS "chairman")
             THEN semanticScore * 3.5

           WHEN toLower(coalesce(adminPerson.role, "")) CONTAINS "director"
                AND ANY(k IN $keywords WHERE toLower(k) CONTAINS "director")
             THEN semanticScore * 3.5

           WHEN nodeExactPhraseMatch OR relatedExactPhraseMatch
             THEN semanticScore * 3.2

           WHEN nodeExactKeywordMatch OR relatedExactKeywordMatch
             THEN semanticScore * 2.8

           WHEN nodeAcronymMatch OR relatedAcronymMatch
             THEN semanticScore * 2.4

           WHEN nodeKeywordMatch OR relatedKeywordMatch
             THEN semanticScore * 1.8

           ELSE semanticScore * 1.6
         END AS boostedScore,

         0 AS relationRank

    WITH collegeNode, adminPerson, adminRel, semanticScore,
         boostedScore, relationRank,
         nodeKeywordMatch, relatedKeywordMatch,
         boostedScore AS finalScore

    ${returnProjection("collegeNode", "adminPerson", "adminRel")}

    LIMIT ${resultLimit}
  `;
}


function buildPrerequisiteCypher(searchLimit, resultLimit) {
  return `
    CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
    YIELD node AS courseNode, score AS semanticScore
    WHERE semanticScore >= $threshold

    MATCH (courseNode)-[prereqRel:HAS_PREREQUISITE]->(prereqNode)
    WHERE ANY(nodeLabel IN labels(courseNode) WHERE nodeLabel = "Course")
      AND ANY(nodeLabel IN labels(prereqNode) WHERE nodeLabel = "Course")
      AND coalesce(prereqNode.name, "") <> ""
      AND ${keywordContainsPredicate("courseNode", "prereqNode")}

    WITH courseNode, prereqNode, prereqRel, semanticScore,
      ${keywordMatchBooleans("courseNode", "prereqNode")}

    WITH courseNode, prereqNode, prereqRel, semanticScore, nodeKeywordMatch, relatedKeywordMatch,
      CASE
        WHEN nodeExactPhraseMatch THEN semanticScore * 3.2
        WHEN nodeExactKeywordMatch THEN semanticScore * 2.8
        WHEN nodeAcronymMatch THEN semanticScore * 2.4
        WHEN nodeKeywordMatch THEN semanticScore * 2.0
        WHEN relatedExactPhraseMatch OR relatedExactKeywordMatch THEN semanticScore * 1.8
        WHEN relatedKeywordMatch THEN semanticScore * 1.4
        ELSE semanticScore * 1.6
      END AS boostedScore,
      0 AS relationRank

    WITH courseNode, prereqNode, prereqRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
      boostedScore AS finalScore

    ${returnProjection("courseNode", "prereqNode", "prereqRel")}
    LIMIT ${resultLimit}
  `;
}

function buildGeneralCypher(searchLimit, resultLimit) {
  return `
    CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
    YIELD node AS matchedNode, score AS semanticScore
    WHERE semanticScore >= $threshold

    OPTIONAL MATCH (matchedNode)-[graphRel]-(neighborNode)
    WHERE graphRel IS NULL OR type(graphRel) IN ${cypherStringList(ACADEMIC_RELATIONS)}
    WITH matchedNode, semanticScore, graphRel, neighborNode,
      CASE
        WHEN type(graphRel) = "TEACHES" THEN 0
        WHEN type(graphRel) = "HAS_COURSE" THEN 1
        WHEN type(graphRel) = "HAS_PREREQUISITE" THEN 2
        WHEN type(graphRel) IN ${cypherStringList(ADMIN_RELATIONS)} THEN 3
        ELSE 3
      END AS relationRank
    ORDER BY semanticScore DESC, relationRank ASC

    WITH matchedNode, semanticScore, collect({ rel: graphRel, related: neighborNode })[0..${RELATIONS_PER_NODE}] AS relationRows
    UNWIND relationRows AS relationRow

    WITH matchedNode, semanticScore, relationRow.rel AS graphRel, relationRow.related AS neighborNode
    WHERE ${keywordContainsPredicate("matchedNode", "neighborNode")}

    WITH matchedNode, neighborNode, graphRel, semanticScore,
      ${keywordMatchBooleans("matchedNode", "neighborNode")}

    WITH matchedNode, neighborNode, graphRel, semanticScore, nodeKeywordMatch, relatedKeywordMatch,
      CASE
        WHEN type(graphRel) = "TEACHES" THEN semanticScore * 1.6
        WHEN type(graphRel) = "HAS_COURSE" THEN semanticScore * 1.5
        WHEN type(graphRel) = "HAS_PREREQUISITE" THEN semanticScore * 1.45
        WHEN type(graphRel) IN ${cypherStringList(ADMIN_RELATIONS)} THEN semanticScore * 1.35
        ELSE semanticScore
      END *
      CASE
        WHEN nodeExactPhraseMatch OR relatedExactPhraseMatch THEN 2.0
        WHEN nodeExactKeywordMatch OR relatedExactKeywordMatch THEN 1.75
        WHEN nodeAcronymMatch OR relatedAcronymMatch THEN 1.6
        WHEN nodeKeywordMatch OR relatedKeywordMatch THEN 1.2
        ELSE 1
      END AS boostedScore,
      CASE
        WHEN type(graphRel) = "TEACHES" THEN 0
        WHEN type(graphRel) = "HAS_COURSE" THEN 1
        WHEN type(graphRel) = "HAS_PREREQUISITE" THEN 2
        WHEN type(graphRel) IN ${cypherStringList(ADMIN_RELATIONS)} THEN 3
        ELSE 4
      END AS relationRank

    WITH matchedNode, neighborNode, graphRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
      boostedScore AS finalScore

    ${returnProjection("matchedNode", "neighborNode", "graphRel")}
    LIMIT ${resultLimit}
  `;
}

function getCypherBuilder(intent) {
  if (intent === "PERSON") return buildPersonCypher;
  if (intent === "ADMIN") return buildAdminCypher;
  if (intent === "PREREQUISITE") return buildPrerequisiteCypher;
  if (intent === "TEACHING") return buildTeachingCypher;
  if (intent === "PROGRAM" || intent === "COMPARE") return buildProgramCypher;
  return buildGeneralCypher;
}

/* ============================================================
   FACT FORMATTING
============================================================ */

function toNumber(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value || 0);
}

function cleanValue(value) {
  if (value === null || value === undefined || value === "" || value === "null") return null;
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function humanizeTriple(text) {
  const match = text.match(/^\(([^:]+):\s*"([^"]+)"\)\s*--\[([^\]]+)\]-->\s*\(([^:]+):\s*"([^"]+)"\)$/);
  if (!match) return text;

  const sourceLabel = match[1];
  const sourceName = match[2];
  const relType = match[3];
  const targetLabel = match[4];
  const targetName = match[5];

  if (relType === "TEACHES") {
    return `${sourceName} teaches the ${targetName} course.`;
  }

  if (relType === "HAS_COURSE") {
    return `${sourceName} includes the ${targetName} course.`;
  }

  if (relType === "HAS_PREREQUISITE") {
    return `${targetName} is a prerequisite for ${sourceName}.`;
  }

  if (ADMIN_RELATIONS.includes(relType)) {
    return `${sourceName} has an administrative role for ${targetName}.`;
  }

  return `(${sourceLabel}: "${sourceName}") --[${relType}]--> (${targetLabel}: "${targetName}")`;
}

function formatPropertyFact(label, name, props, score, relationRank) {
  const preferredKeys = [
    "description",
    "info",
    "overview",
    "summary",
    "details",
    "role",
    "title",
    "department",
    "college",
    "faculty",
    "code",
    "course_code",
    "credits",
    "semester",
    "prerequisites",
    "dean",
    "vice_dean",
    "chairman",
    "director",
    "grading_system",
    "policy",
    "regulations"
  ];

  for (const key of preferredKeys) {
    const value = cleanValue(props?.[key]);
    if (value) {
      return {
        text: `(${label || "Entity"}: "${name}") ${key}: ${value}`,
        kind: "property",
        relType: null,
        score,
        relationRank
      };
    }
  }

  return {
    text: `${label || "Entity"}: ${name}`,
    kind: "property",
    relType: null,
    score,
    relationRank
  };
}

function formatRecordFact(record) {
  const label = record.get("label");
  const name = record.get("name");
  const props = record.get("props") || {};
  const relatedLabel = record.get("relatedLabel");
  const relatedName = record.get("relatedName");
  const relType = record.get("relType");
  const relSourceName = record.get("relSourceName");
  const relSourceLabel = record.get("relSourceLabel");
  const relTargetName = record.get("relTargetName");
  const relTargetLabel = record.get("relTargetLabel");
  const score = toNumber(record.get("score"));
  const baseScore = toNumber(record.get("baseScore"));
  const boostedScore = toNumber(record.get("boostedScore"));
  const relationRank = toNumber(record.get("relationRank"));

  if (!relType || !relatedName) {
    return formatPropertyFact(label, name, props, score, relationRank);
  }

  const triple = `(${relSourceLabel}: "${relSourceName}") --[${relType}]--> (${relTargetLabel}: "${relTargetName}")`;

  return {
    text: humanizeTriple(triple),
    triple,
    relationKey: `${relType}:${relSourceName}->${relTargetName}`,
    kind: "relation",
    relType,
    score,
    baseScore,
    boostedScore,
    relationRank,
    graph: {
      source: relSourceName,
      sourceLabel: relSourceLabel,
      target: relTargetName,
      targetLabel: relTargetLabel,
      type: relType
    }
  };
}

function dedupeFacts(facts) {
  const seen = new Set();
  const deduped = [];

  for (const fact of facts) {
    const key = (fact.relationKey || fact.text || "").toLowerCase();
    if (!key || seen.has(key)) continue;

    seen.add(key);
    deduped.push(fact);
  }

  return deduped;
}

function getGoodFacts(facts, intent) {
  const threshold = Math.min(...RETRIEVAL_THRESHOLDS);
  return facts.filter(fact => (fact.baseScore || fact.score || 0) >= threshold);
}

function selectTopQualityFacts(facts, intent, limit) {
  const maxFacts = Math.max(Math.min(limit || 5, 8), 1);
  const sorted = dedupeFacts(facts).sort((a, b) => {
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    return (a.relationRank ?? 3) - (b.relationRank ?? 3);
  });

  if (intent === "TEACHING") {
    return sorted.filter(fact => fact.relType === "TEACHES").slice(0, maxFacts);
  }

  if (intent === "ADMIN") {
    const adminFacts = sorted.filter(fact => ADMIN_RELATIONS.includes(fact.relType));
    const otherFacts = sorted.filter(fact => !ADMIN_RELATIONS.includes(fact.relType));
    return [...adminFacts, ...otherFacts].slice(0, maxFacts);
  }

  if (intent === "PREREQUISITE") {
    const prerequisiteFacts = sorted.filter(fact => fact.relType === "HAS_PREREQUISITE");
    const otherFacts = sorted.filter(fact => fact.relType !== "HAS_PREREQUISITE");
    return [...prerequisiteFacts, ...otherFacts].slice(0, maxFacts);
  }

  if (intent === "PERSON") {
    const profileFacts = sorted.filter(fact => fact.kind === "property");
    const relationFacts = sorted.filter(fact => fact.kind === "relation");
    return [...profileFacts, ...relationFacts].slice(0, maxFacts);
  }

  if (intent === "PROGRAM" || intent === "COMPARE") {
    const programFacts = sorted.filter(fact => fact.relType === "HAS_COURSE");
    const otherFacts = sorted.filter(fact => fact.relType !== "HAS_COURSE");
    return [...programFacts, ...otherFacts].slice(0, maxFacts);
  }

  return sorted.slice(0, maxFacts);
}

function synthesizeAnswer(facts) {
  if (!facts || facts.length === 0) return NO_RESULT_MESSAGE;
  return facts.map(fact => fact.text).filter(Boolean).join("\n");
}

function normalizeLastMessages(lastMessages) {
  if (!lastMessages) return "";
  if (typeof lastMessages === "string") return lastMessages;

  if (Array.isArray(lastMessages)) {
    return lastMessages
      .map(message => {
        if (typeof message === "string") return message;
        const role = message.role || "message";
        const content = message.content || message.text || "";
        return `${role}: ${content}`;
      })
      .filter(Boolean)
      .slice(-6)
      .join("\n");
  }

  return String(lastMessages);
}

function buildGraphResponse(answer, confidence, facts) {
  const response = Array.isArray(facts) ? facts : [];

  Object.defineProperties(response, {
    answer: {
      value: answer,
      enumerable: false
    },
    confidence: {
      value: confidence,
      enumerable: false
    },
    facts: {
      value: response,
      enumerable: false
    },
    source: {
      value: "knowledge_graph",
      enumerable: false
    }
  });

  return response;
}

/* ============================================================
   RETRIEVAL
============================================================ */

async function runRetrieval(session, cypher, params) {
  const stopNeo4jTimer = startTimer();

  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    recordDuration("neo4j.latency_ms", stopNeo4jTimer());
  }
}

function isMissingIndexError(err) {
  return /no such.*index|index.*not.*found|index does not exist/i.test(err?.message || "");
}

async function retrieveWithThresholds(session, queryPlan, baseParams) {
  let bestRecords = [];
  let usedThreshold = RETRIEVAL_THRESHOLDS[0];
  let usedIndexName = queryPlan.indexNames[0];

  for (const indexName of queryPlan.indexNames) {
    for (const threshold of RETRIEVAL_THRESHOLDS) {
      const cypher = queryPlan.buildCypher(queryPlan.searchLimit, queryPlan.resultLimit);

      try {
        const records = await runRetrieval(session, cypher, {
          ...baseParams,
          indexName,
          threshold
        });

        usedThreshold = threshold;
        usedIndexName = indexName;

        if (records.length > 0) {
          return { records, usedThreshold, usedIndexName };
        }

        bestRecords = records;
      } catch (err) {
        if (isMissingIndexError(err)) {
          logger.warn("Vector index unavailable, trying fallback index", {
            indexName,
            intent: queryPlan.intent,
            error: err.message
          });
          break;
        }

        throw err;
      }
    }

    if (indexName !== queryPlan.indexNames[queryPlan.indexNames.length - 1]) {
      incrementMetric("retrieval.index_fallback");
    }
  }

  return { records: bestRecords, usedThreshold, usedIndexName };
}

function buildQueryPlan(intent, searchLimit, resultLimit) {
  return {
    intent,
    indexNames: getVectorIndexes(intent),
    buildCypher: getCypherBuilder(intent),
    searchLimit,
    resultLimit
  };
}

export async function fetchNeo4jContext(query, intent = "ALL", limit = 5, requestId = "none", lastMessages = "") {
  const stopQueryTimer = startTimer();
  incrementMetric("retrieval.query_total");

  const session = getSession();
  const detectedIntent = detectIntent(query, intent);
  const keywordParams = buildKeywordParams(query);
  const { keywords } = keywordParams;
  const resultLimit = Math.max(limit * 3, 8);
  const searchLimit = Math.max(resultLimit * 3, 25);

  logger.info("Neo4j retrieval started", {
    requestId,
    intent: detectedIntent,
    vectorIndex: getVectorIndex(detectedIntent),
    keywords
  });

  try {
    const conversationContext = normalizeLastMessages(lastMessages);
    const enrichedQuery = `Conversation:
${conversationContext}

User:
${query}`;
    const embeddingInput = detectedIntent === "GENERAL" ? enrichedQuery : query;
    const vector = await embed(embeddingInput, requestId);

    const baseParams = {
      vector,
      ...keywordParams
    };

    const primaryPlan = buildQueryPlan(detectedIntent, searchLimit, resultLimit);
    let { records, usedThreshold, usedIndexName } = await retrieveWithThresholds(session, primaryPlan, baseParams);
    let semanticFallbackUsed = false;

    if (records.length === 0 && !["GENERAL", "TEACHING"].includes(detectedIntent)) {
      semanticFallbackUsed = true;
      incrementMetric("retrieval.semantic_fallback");
      // Use intent-scoped fallback: PERSON queries stay within person indexes to prevent course/program contamination
      const fallbackIntent = detectedIntent === "PERSON" ? "PERSON" : "GENERAL";
      const fallbackPlan = buildQueryPlan(fallbackIntent, searchLimit, resultLimit);
      ({ records, usedThreshold, usedIndexName } = await retrieveWithThresholds(session, fallbackPlan, baseParams));
    }

    const facts = records.map(formatRecordFact);
    const goodFacts = getGoodFacts(facts, detectedIntent);
    const selectedFacts = selectTopQualityFacts(goodFacts, detectedIntent, limit);
    const confidence = selectedFacts[0]?.baseScore || selectedFacts[0]?.score || 0;

    logger.info("Neo4j retrieval completed", {
      requestId,
      resultsCount: records.length,
      selectedFactsCount: selectedFacts.length,
      threshold: usedThreshold,
      indexName: usedIndexName,
      semanticFallbackUsed
    });
    logger.debug("Neo4j ranking details", {
      requestId,
      ranking: records.map((record, index) => ({
        rank: index + 1,
        name: record.get("name"),
        relatedName: record.get("relatedName"),
        relType: record.get("relType"),
        baseScore: toNumber(record.get("baseScore")),
        finalScore: toNumber(record.get("score"))
      }))
    });

    if (selectedFacts.length === 0) {
      incrementMetric("retrieval.no_results");
      return buildGraphResponse(NO_RESULT_MESSAGE, 0, []);
    }

    const refinedAnswer = await refineAnswerWithLocalLLM(selectedFacts, query);
    const answer = refinedAnswer || synthesizeAnswer(selectedFacts);

    return buildGraphResponse(answer, confidence, selectedFacts);
  } catch (err) {
    incrementMetric("retrieval.error");
    logger.error("Neo4j context error", {
      requestId,
      error: err
    });
    return buildGraphResponse(NO_RESULT_MESSAGE, 0, []);
  } finally {
    recordDuration("query.latency_ms", stopQueryTimer());
    await session.close();
  }
}

export function convertToGraphData(neo4jResults) {
  const nodesMap = new Map();
  const links = [];
  const results = Array.isArray(neo4jResults) ? neo4jResults : neo4jResults?.facts || [];

  for (const item of results) {
    if (item?.graph?.source && item?.graph?.target) {
      nodesMap.set(item.graph.source, {
        id: item.graph.source,
        label: item.graph.sourceLabel || "Entity",
        group: 1
      });
      nodesMap.set(item.graph.target, {
        id: item.graph.target,
        label: item.graph.targetLabel || "Entity",
        group: 2
      });
      links.push({
        source: item.graph.source,
        target: item.graph.target,
        type: item.graph.type
      });
      continue;
    }

    const text = item?.triple || item?.text;
    if (!text) continue;

    const relMatch = text.match(/\(([^:]+):\s*"([^"]+)"\)\s*--\[([^\]]+)\]-->\s*\(([^:]+):\s*"([^"]+)"\)/);
    if (!relMatch) continue;

    const sourceLabel = relMatch[1].trim();
    const sourceName = relMatch[2].trim();
    const relType = relMatch[3].trim();
    const targetLabel = relMatch[4].trim();
    const targetName = relMatch[5].trim();

    nodesMap.set(sourceName, { id: sourceName, label: sourceLabel, group: 1 });
    nodesMap.set(targetName, { id: targetName, label: targetLabel, group: 2 });
    links.push({ source: sourceName, target: targetName, type: relType });
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links
  };
}
