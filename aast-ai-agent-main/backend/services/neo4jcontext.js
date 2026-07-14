  import { getSession } from "../db/neo4j.js";
  import { isCourseByTopicLookup } from "./queryShape.js";
  import fetch from "node-fetch";
  import { logger } from "./logger.js";
  import { incrementMetric, recordDuration, startTimer } from "./metrics.js";
  import { generateStableResponse } from "./ollamaService.js";
  import { expandAcademicQuery } from "./academicQueryNormalizer.js";
  import { runtimeMode } from "../config/runtimeMode.js";

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
    if (!runtimeMode.graphRefineEnabled || runtimeMode.singleGemmaGenerationMode || runtimeMode.defenseMode) {
      incrementMetric("knowledge_graph.refinement_policy_bypass");
      return null;
    }

    const factTexts = facts
      .map(fact => fact?.text)
      .filter(Boolean)
      .slice(0, Number.parseInt(process.env.KG_GRAPH_REFINE_FACT_LIMIT || "6", 10))
      .map(text => text.length > 320 ? `${text.slice(0, 320).trimEnd()}...[truncated]` : text);
    if (factTexts.length === 0) return null;

    const maxAttempts = Number(process.env.GRAPH_MAX_ATTEMPTS || 2);
    const timeoutMs = Number(process.env.GRAPH_TIMEOUT_MS || 8000);
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await generateStableResponse({
          model: process.env.OLLAMA_GRAPH_MODEL || process.env.PRIMARY_MODEL || process.env.OLLAMA_MODEL || "gemma4:e2b",
          requestId: `graph_refine_${Date.now()}`,
          timeoutMs,
          deadlineMs: Math.max(timeoutMs, 12000),
          routeType: "KG_ONLY",
          trafficType: "graph_refine",
          options: {
            temperature: 0.08,
            top_p: 0.72,
            repeat_penalty: 1.15,
            num_predict: Number.parseInt(process.env.KG_GRAPH_NUM_PREDICT || "120", 10)
          },
          prompt: `User Question:
  ${query}

  Academic Facts:
  ${factTexts.join("\n")}

  Generate a concise academic answer using only the facts above. If the facts are insufficient, say that the information was not found.`,
        });

        const cleanedResponse = response?.trim();
        if (cleanedResponse) {
          if (attempt > 1) {
          incrementMetric("knowledge_graph.retry_success");
          }
          return cleanedResponse;
        } else {
          throw new Error("GRAPH response empty");
        }
      } catch (err) {
        lastError = err;

        if (err.name === "AbortError" || /timeout|timed out/i.test(err.message || "")) {
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

  async function safeDeterministicReformatter(baseAnswer, query) {
    if (process.env.ENABLE_GRAPH === 'false') return null;
    if (!runtimeMode.safeReformatEnabled || runtimeMode.singleGemmaGenerationMode || runtimeMode.defenseMode) {
      incrementMetric("knowledge_graph.safe_reformat_policy_bypass");
      return null;
    }

    const maxAttempts = Number(process.env.REFORMAT_MAX_ATTEMPTS || 1);
    const timeoutMs = Number(process.env.REFORMAT_TIMEOUT_MS || 4000);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await generateStableResponse({
          model: process.env.OLLAMA_GRAPH_MODEL || process.env.PRIMARY_MODEL || process.env.OLLAMA_MODEL || "gemma4:e2b",
          requestId: `graph_reformat_${Date.now()}`,
          timeoutMs,
          deadlineMs: Math.max(timeoutMs, 8000),
          routeType: "KG_ONLY",
          trafficType: "graph_reformat",
          options: {
            temperature: 0.05,
            top_p: 0.70,
            repeat_penalty: 1.12,
            num_predict: Number.parseInt(process.env.KG_REFORMAT_NUM_PREDICT || "96", 10)
          },
          prompt: `Reformat the following academic answer for clarity and professionalism.

  STRICT RULES:
  - Use ONLY the provided facts
  - Do NOT add new information
  - Do NOT infer
  - Do NOT assume
  - Do NOT change factual meaning
  - Do NOT omit important facts
  - Keep answer concise
  - If facts are insufficient, return original answer unchanged

  User Question:
  ${query}

  Facts:
  ${baseAnswer}`,
        });

        const cleanedResponse = response?.trim();
        if (cleanedResponse && cleanedResponse.length > 0) {
          incrementMetric("knowledge_graph.safe_reformat_success");
          return cleanedResponse;
        }
        throw new Error("Empty reformat response");
      } catch (err) {
        if (err.name === "AbortError" || /timeout|timed out/i.test(err.message || "")) {
          incrementMetric("knowledge_graph.safe_reformat_timeout");
        } else {
          incrementMetric("knowledge_graph.safe_reformat_failure");
        }
        logger.warn("Safe reformat failed, using base answer", {
          attempt,
          error: err.message
        });
      }
    }

    return null;
  }

  /* ============================================================
    QUERY UNDERSTANDING
  ============================================================ */

  const NO_RESULT_MESSAGE = "I couldn't find relevant academic information for that query.";
  const CURRICULUM_NO_INFO_MESSAGE = "I don't have enough verified curriculum information to answer that fully.";
  const DEFAULT_CONTEXT_LIMIT = Number.parseInt(process.env.KG_DEFAULT_CONTEXT_LIMIT || "10", 10);
  const RELATIONS_PER_NODE = Number.parseInt(process.env.KG_RELATIONS_PER_NODE || "12", 10);
  const GENERAL_RELATIONS_PER_NODE = Number.parseInt(process.env.KG_GENERAL_RELATIONS_PER_NODE || "10", 10);
  const ONTOLOGY_RELATIONS_PER_NODE = Number.parseInt(process.env.KG_ONTOLOGY_RELATIONS_PER_NODE || "12", 10);
  const MAX_PERSON_SUMMARY_LINES = Number.parseInt(process.env.KG_MAX_PERSON_SUMMARY_LINES || "6", 10);
  const MAX_FACTS_BY_INTENT = {
    PERSON: Number.parseInt(process.env.KG_PERSON_MAX_FACTS || "18", 10),
    ADMIN: Number.parseInt(process.env.KG_ADMIN_MAX_FACTS || "14", 10),
    PROGRAM: Number.parseInt(process.env.KG_PROGRAM_MAX_FACTS || "10", 10),
    COMPARE: Number.parseInt(process.env.KG_PROGRAM_MAX_FACTS || "10", 10),
    FACILITY: Number.parseInt(process.env.KG_FACILITY_MAX_FACTS || "14", 10),
    TRACK: Number.parseInt(process.env.KG_TRACK_MAX_FACTS || "14", 10),
    PARTNER_INSTITUTION: Number.parseInt(process.env.KG_PARTNER_MAX_FACTS || "8", 10),
    GOVERNANCE: Number.parseInt(process.env.KG_GOVERNANCE_MAX_FACTS || "14", 10),
    POLICY: Number.parseInt(process.env.KG_POLICY_MAX_FACTS || "12", 10),
    CAMPUS: Number.parseInt(process.env.KG_CAMPUS_MAX_FACTS || "10", 10),
    CURRICULUM: Number.parseInt(process.env.KG_CURRICULUM_MAX_FACTS || "12", 10),
    DEFAULT: Number.parseInt(process.env.KG_DEFAULT_MAX_FACTS || "8", 10)
  };
  const DEFAULT_RETRIEVAL_THRESHOLDS = [0.45, 0.35, 0.25];
  const ONTOLOGY_RETRIEVAL_THRESHOLDS = {
    FACILITY: [0.30, 0.25],
    TRACK: [0.30, 0.25],
    PARTNER_INSTITUTION: [0.30, 0.25]
  };

  function getRetrievalThresholds(intent) {
    return ONTOLOGY_RETRIEVAL_THRESHOLDS[intent] || DEFAULT_RETRIEVAL_THRESHOLDS;
  }

  function getGoodFactThreshold(intent) {
    return Math.min(...getRetrievalThresholds(intent));
  }
  const PERSON_LABELS = new Set(["Person", "Professor", "TeachingStaff", "Staff", "Instructor"]);
  const ONTOLOGY_INTENTS = new Set([
    "FACILITY",
    "TRACK",
    "PARTNER_INSTITUTION",
    "GOVERNANCE",
    "POLICY",
    "CAMPUS",
    "CURRICULUM"
  ]);
  const ACADEMIC_RELATIONS = [
    "HOSTS",
    "OFFERS",
    "INCLUDES_PROGRAM",
    "TEACHES",
    "HAS_COURSE",
    "HAS_PREREQUISITE",
    "HAS_SYLLABUS",
    "HAS_ADMIN",
    "DEAN_OF",
    "HEAD_OF",
    "HEAD_OF_UNIT",
    "ADMINISTERS",
    "CHAIRS",
    "DIRECTS",
    "MANAGES",
    "BELONGS_TO",
    "WORKS_IN",
    "HAS_OFFICE",
    "OFFICE_IN",
    "LOCATED_IN",
    "HAS_DEPARTMENT",
    "BELONGS_TO_DEPARTMENT",
    "MEMBER_OF",
    "SPECIALIZES_IN",
    "HAS_SPECIALIZATION",
    "PART_OF_TRACK",
    "RECOMMENDED_AFTER",
    "LEADS_TO",
    "CAREER_ALIGNMENT",
    "COMPARES_WITH",
    "COORDINATES",
    "COORDINATOR_OF",
    "ACTS_AS",
    "HAS_ROLE",
    "HAS_FACILITY",
    "CONTAINS_COMPONENT",
    "HAS_PARTNER_INSTITUTION",
    "HAS_GOVERNANCE_BODY",
    "HAS_UNIT",
    "SUPPORTS_POLICY_QUERY",
    "FOLLOWS_POLICY",
    "USES_GRADING_SYSTEM",
    "HAS_TUITION_PATHWAY",
    "HAS_SCHOLARSHIP_POLICY",
    "HAS_ADVISING_PATHWAY",
    "HAS_SCHOLARSHIP",
    "HAS_ACCREDITATION"
  ];
  const ADMIN_RELATIONS = [
    "HAS_ADMIN",
    "DEAN_OF",
    "HEAD_OF",
    "HEAD_OF_UNIT",
    "ADMINISTERS",
    "CHAIRS",
    "DIRECTS",
    "MANAGES"
  ];
  const PERSON_PROFILE_RELATIONS = [
    "TEACHES",
    "HAS_ROLE",
    "ACTS_AS",
    "BELONGS_TO",
    "WORKS_IN",
    "HAS_OFFICE",
    "OFFICE_IN",
    "LOCATED_IN",
    "HAS_DEPARTMENT",
    "BELONGS_TO_DEPARTMENT",
    "MEMBER_OF",
    "SPECIALIZES_IN",
    "HAS_SPECIALIZATION",
    "COORDINATES",
    "COORDINATOR_OF",
    ...ADMIN_RELATIONS
  ];
  const FACILITY_RELATIONS = ["HAS_FACILITY", "CONTAINS_COMPONENT"];
  const TRACK_RELATIONS = [
    "SPECIALIZES_IN",
    "HAS_SPECIALIZATION",
    "PART_OF_TRACK",
    "HAS_COURSE",
    "LEADS_TO",
    "CAREER_ALIGNMENT",
    "COMPARES_WITH"
  ];
  const PARTNER_RELATIONS = ["HAS_PARTNER_INSTITUTION"];
  const GOVERNANCE_RELATIONS = [
    "HAS_GOVERNANCE_BODY",
    "HAS_UNIT",
    "HAS_ADMIN",
    "HEAD_OF",
    "HEAD_OF_UNIT",
    "MANAGES",
    "ADMINISTERS",
    "DEAN_OF",
    "HAS_ROLE",
    "ACTS_AS",
    "BELONGS_TO"
  ];
  const POLICY_RELATIONS = [
    "SUPPORTS_POLICY_QUERY",
    "FOLLOWS_POLICY",
    "USES_GRADING_SYSTEM",
    "HAS_TUITION_PATHWAY",
    "HAS_SCHOLARSHIP_POLICY",
    "HAS_ADVISING_PATHWAY",
    "HAS_SCHOLARSHIP",
    "BELONGS_TO"
  ];
  const CAMPUS_RELATIONS = [
    "HOSTS",
    "OFFERS",
    "INCLUDES_PROGRAM",
    "HAS_FACILITY",
    "BELONGS_TO"
  ];
  const GENERIC_ONTOLOGY_TERMS = new Set([
    "available",
    "availability",
    "exist",
    "exists",
    "existing",
    "offered",
    "offer",
    "offers",
    "track",
    "tracks",
    "specialization",
    "specializations",
    "pathway",
    "pathways",
    "focus",
    "area",
    "areas",
    "concentration",
    "concentrations",
    "facility",
    "facilities",
    "lab",
    "labs",
    "laboratory",
    "laboratories",
    "center",
    "centers",
    "centre",
    "component",
    "components",
    "equipment",
    "partner",
    "partners",
    "institution",
    "institutions",
    "university",
    "universities",
    "collaboration",
    "collaborations",
    "governance",
    "body",
    "bodies",
    "unit",
    "units",
    "quality",
    "policy",
    "policies",
    "rule",
    "rules",
    "regulation",
    "regulations",
    "system",
    "systems",
    "criteria",
    "campus",
    "campuses",
    "branch",
    "branches"
  ]);

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
    "available",
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
    "offer",
    "offered",
    "offers",
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

  function looksLikeNamedPersonLookup(query, normalizedQuery) {
    if (!/\btell me about\b/.test(normalizedQuery)) return false;
    if (/\b(program|programme|major|course|curriculum|prerequisite|college|admission|fee|tuition)\b/.test(normalizedQuery)) {
      return false;
    }

    if (/\b(professor|dr|doctor|instructor|staff)\b/.test(normalizedQuery)) return true;

    const lookupTarget = String(query || "").replace(/^.*?\btell me about\b/i, "").trim();
    return /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4}\b/.test(lookupTarget);
  }

  function detectOntologyIntent(normalizedQuery) {
    if (/\b(week|weekly|topic|topics|syllabus|lecture|lectures|module|modules|transformers?|rag|multimodal|text generation|self-supervised learning)\b/.test(normalizedQuery)) {
      return "CURRICULUM";
    }

    if (/\b(partner institution|partner university|academic partner|international partner|international collaboration|collaboration universit|uclan|barcelona)\b/.test(normalizedQuery)) {
      return "PARTNER_INSTITUTION";
    }

    if (/\b(facility component|lab component|equipment|devices|hardware)\b/.test(normalizedQuery)) {
      return "FACILITY";
    }

    if (/\b(facility|facilities|lab|labs|laboratory|laboratories|robotics lab|iot lab|vr lab|virtual reality lab|workstations lab|embedded systems lab)\b/.test(normalizedQuery)) {
      return "FACILITY";
    }

    if (/\b(governance|governance body|governance unit|quality unit|quality assurance unit|program governance|college governance|leadership unit)\b/.test(normalizedQuery)) {
      return "GOVERNANCE";
    }

    if (/\b(policy pathway|policy pathways|grading system|grading systems|grading policy|passing criteria|tuition pathway|scholarship pathway|advising pathway)\b/.test(normalizedQuery)) {
      return "POLICY";
    }

    if (/\b(track|tracks|specialization|specializations|pathway|pathways|focus area|major track|concentration|concentrations)\b/.test(normalizedQuery)) {
      return "TRACK";
    }

    if (/\b(campus|campuses|branch|branches|el alamein|new el alamein)\b/.test(normalizedQuery)) {
      return "CAMPUS";
    }

    if (/\b(policy|policies|regulation|regulations|rules)\b/.test(normalizedQuery)) {
      return "POLICY";
    }

    return null;
  }

  function hasCourseRequirementContext(normalizedQuery) {
    return /\b(course|courses|subject|subjects|module|modules|before taking|required before|depends on|prerequisite|prerequisites|prereq)\b/.test(normalizedQuery);
  }

  function normalizeIntentKeyword(intent) {
    return String(intent || "ALL")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^A-Z_]/g, "");
  }

  function detectIntent(query, requestedIntent = "ALL") {
    const normalizedQuery = normalizeText(query);
    const normalizedIntent = normalizeIntentKeyword(requestedIntent);
    const ontologyIntent = detectOntologyIntent(normalizedQuery);

    if (isCourseByTopicLookup(normalizedQuery)) return "CURRICULUM";
    if (ONTOLOGY_INTENTS.has(normalizedIntent)) return normalizedIntent;
    if (ontologyIntent && normalizedIntent === "PERSON") return ontologyIntent;
    if (ontologyIntent && ["ALL", "GENERAL", "PROGRAM", "COMPARE", "COMPARISON"].includes(normalizedIntent)) return ontologyIntent;
    if (normalizedIntent === "PERSON") return "PERSON";
    if (normalizedIntent === "ADMIN") return "ADMIN";
    if (normalizedIntent === "PREREQUISITE") return "PREREQUISITE";
    if (normalizedIntent === "TEACHING") return "TEACHING";
    if (["COMPARE", "COMPARISON"].includes(normalizedIntent)) return "COMPARE";
    if (normalizedIntent === "PROGRAM") return "PROGRAM";

    if (/\b(dean|admin|administrator|chairman|director|leadership)\b|\bhead of\b/.test(normalizedQuery)) {
      return "ADMIN";
    }

    if (/\b(prerequisite|prerequisites|prequisite|prequsties|prereq)\b|\brequired before\b|\bbefore taking\b/.test(normalizedQuery)) {
      return "PREREQUISITE";
    }

    if (/\b(requirement|requirements)\b/.test(normalizedQuery) && hasCourseRequirementContext(normalizedQuery) && ontologyIntent !== "POLICY") {
      return "PREREQUISITE";
    }

    if (/\b(teach|teaches|teacher|teachers|teaching|taught|instructs)\b/.test(normalizedQuery)) {
      return "TEACHING";
    }

    if (/\b(office|room|location)\b/.test(normalizedQuery) && /\b(professor|dr|doctor|instructor|staff|dean|hany|abouelfarag|abou el farag)\b/.test(normalizedQuery)) {
      return "PERSON";
    }

    if (/\bwho is\b|\b(professor|dr|doctor|instructor|staff)\b/.test(normalizedQuery) || looksLikeNamedPersonLookup(query, normalizedQuery)) {
      return "PERSON";
    }

    if (ontologyIntent) {
      return ontologyIntent;
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
    if (intent === "TRACK") return ["node_embedding_index", "program_embedding_index"];
    if (ONTOLOGY_INTENTS.has(intent)) return ["node_embedding_index"];
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

  function isGenericOntologyKeyword(keyword) {
    const normalized = normalizeText(keyword);
    if (!normalized) return true;

    const tokens = normalized.split(" ").filter(Boolean);
    if (tokens.length === 0) return true;

    return tokens.every(token => STOP_WORDS.has(token) || GENERIC_ONTOLOGY_TERMS.has(token));
  }

  function extractContentTokens(query) {
    return normalizeText(query)
      .split(" ")
      .filter(token => token.length >= 3)
      .filter(token => !STOP_WORDS.has(token) && !GENERIC_ONTOLOGY_TERMS.has(token));
  }

  function buildKeywordParams(query) {
    const keywords = extractKeywords(query);
    const contentKeywords = Array.from(new Set([
      ...keywords.filter(keyword => !isGenericOntologyKeyword(keyword)),
      ...extractContentTokens(query)
    ])).slice(0, 24);

    return {
      keywords,
      phraseKeywords: keywords.filter(keyword => keyword.includes(" ")),
      acronymKeywords: keywords.filter(keyword => /^[a-z0-9+#]{2,6}$/.test(keyword)),
      contentKeywords,
      contentPhraseKeywords: contentKeywords.filter(keyword => keyword.includes(" ")),
      contentAcronymKeywords: contentKeywords.filter(keyword => /^[a-z0-9+#]{2,6}$/.test(keyword))
    };
  }

  const CURRICULUM_COURSE_ALIASES = Object.freeze([
    { canonical: "natural language processing", aliases: ["natural language processing", "nlp"] },
    { canonical: "cognitive computing", aliases: ["cognitive computing"] },
    { canonical: "mobile computing", aliases: ["mobile computing"] },
    { canonical: "machine learning", aliases: ["machine learning", "ml"] },
    { canonical: "deep learning", aliases: ["deep learning", "dl"] },
    { canonical: "computer vision", aliases: ["computer vision", "cv"] },
    { canonical: "information retrieval", aliases: ["information retrieval", "ir"] },
    { canonical: "artificial intelligence", aliases: ["artificial intelligence", "ai"] },
  ]);

  const CURRICULUM_TOPIC_ALIASES = Object.freeze([
    { pattern: /\btransformers?\b/i, topic: "transformer", display: "transformers" },
    { pattern: /\brag\b/i, topic: "rag", display: "RAG" },
    { pattern: /\bmultimodal\b/i, topic: "multimodal", display: "multimodal" },
    { pattern: /\btext generation\b/i, topic: "text generation", display: "text generation" },
    { pattern: /\bself-supervised learning\b/i, topic: "self-supervised learning", display: "self-supervised learning" },
  ]);

  function extractCurriculumWeek(query) {
    const weekMatch = String(query || "").match(/week\s+(\d+)/i);
    if (!weekMatch) return null;

    const week = Number.parseInt(weekMatch[1], 10);
    return Number.isFinite(week) && week > 0 ? week : null;
  }

  function extractCurriculumTopic(query) {
    const text = String(query || "");
    for (const alias of CURRICULUM_TOPIC_ALIASES) {
      if (alias.pattern.test(text)) {
        return {
          topic: alias.topic,
          display: alias.display
        };
      }
    }

    if (!/\b(?:which|what)\s+courses?\b/i.test(text)) return null;

    const topicMatch = text.match(/\b(?:teaches|teach|covers|cover)\s+([A-Za-z0-9+#][A-Za-z0-9+#\s-]{1,60})\??$/i);
    if (!topicMatch) return null;

    const candidate = topicMatch[1]
      .replace(/\b(course|courses|topic|topics|module|modules|concept|concepts|the|a|an)\b/gi, " ")
      .replace(/[?.!]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!candidate) return null;
    return {
      topic: candidate.toLowerCase(),
      display: candidate
    };
  }

  function extractCurriculumCourseName(query) {
    const normalized = normalizeText(query);
    if (!normalized) return "";

    for (const course of CURRICULUM_COURSE_ALIASES) {
      if (course.aliases.some(alias => {
        const normalizedAlias = normalizeText(alias);
        return normalized === normalizedAlias || normalized.includes(` ${normalizedAlias} `) || normalized.startsWith(`${normalizedAlias} `) || normalized.endsWith(` ${normalizedAlias}`);
      })) {
        return course.canonical;
      }
    }

    const scopedMatch = normalized.match(/\b(?:in|for|of)\s+(.+?)$/i);
    if (!scopedMatch) return "";

    const candidate = scopedMatch[1]
      .replace(/\b(week\s+\d+|week|weekly|topic|topics|module|modules|syllabus|lecture|lectures|cover|covers|covered|include|includes|exist|exists|teach|teaches|course|courses|curriculum)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    return candidate.length >= 3 ? candidate : "";
  }

  function parseCurriculumSchedule(schedule) {
    try {
      const parsed = JSON.parse(schedule);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getCurriculumEntryWeek(entry) {
    const week = Number(entry?.week);
    return Number.isFinite(week) ? week : null;
  }

  function getCurriculumEntryTopic(entry) {
    const topic = entry?.topic ?? entry?.module ?? entry?.title ?? entry?.lecture ?? entry?.concept;
    return String(topic || "").replace(/\s+/g, " ").trim();
  }

  function curriculumTopicIncludes(entry, topicName) {
    const topic = getCurriculumEntryTopic(entry).toLowerCase();
    const needle = String(topicName || "").toLowerCase().trim();
    return !!topic && !!needle && topic.includes(needle);
  }

  function makeCurriculumFact({ course, text, week = null, topic = null, matchedTopic = null }) {
    return {
      text,
      kind: "curriculum",
      relType: "HAS_SYLLABUS",
      label: "Course",
      name: course,
      relatedLabel: "CourseSyllabus",
      relatedName: `${course} syllabus`,
      relSourceName: course,
      relSourceLabel: "Course",
      relTargetName: `${course} syllabus`,
      relTargetLabel: "CourseSyllabus",
      score: 1,
      baseScore: 1,
      boostedScore: 1,
      relationRank: 0,
      source_type: "CURRICULUM_KG",
      metadata: {
        source_type: "CURRICULUM_KG",
        matched_course: course || null,
        matched_week: week,
        matched_topic: matchedTopic || topic || null
      },
      graph: {
        source: course,
        sourceLabel: "Course",
        sourceProperties: {},
        target: `${course} syllabus`,
        targetLabel: "CourseSyllabus",
        targetProperties: {},
        type: "HAS_SYLLABUS"
      }
    };
  }

  function buildCurriculumFailure(metadata = {}) {
    return {
      answer: CURRICULUM_NO_INFO_MESSAGE,
      confidence: 0,
      facts: [],
      metadata: {
        source_type: "CURRICULUM_KG",
        detected_intent: "CURRICULUM",
        retrieval_mode: "deterministic_curriculum",
        semantic_fallback_used: false,
        failure_reason: "INSUFFICIENT_CURRICULUM_INFORMATION",
        ...metadata
      }
    };
  }

  function buildCurriculumSuccess(answer, facts, metadata = {}) {
    return {
      answer,
      confidence: 1,
      facts,
      metadata: {
        source_type: "CURRICULUM_KG",
        detected_intent: "CURRICULUM",
        retrieval_mode: "deterministic_curriculum",
        semantic_fallback_used: false,
        selected_fact_count: facts.length,
        ...metadata
      }
    };
  }

  function buildCurriculumAnswer(query, records) {
    const requestedWeek = extractCurriculumWeek(query);
    const requestedTopic = extractCurriculumTopic(query);
    const requestedCourse = extractCurriculumCourseName(query);
    const rows = records
      .map(record => ({
        course: cleanValue(record.get("course")),
        schedule: record.get("schedule")
      }))
      .filter(row => row.course);

    const parsedRows = rows
      .map(row => ({
        ...row,
        entries: parseCurriculumSchedule(row.schedule)
      }))
      .filter(row => row.entries.length > 0);

    if (parsedRows.length === 0) {
      return buildCurriculumFailure({
        matched_course: requestedCourse || null,
        matched_week: requestedWeek,
        matched_topic: requestedTopic?.display || null
      });
    }

    const asksForCourseByTopic = requestedTopic && /\b(?:which|what)\s+courses?\b/i.test(query);
    if (asksForCourseByTopic) {
      const matchedCourses = parsedRows
        .filter(row => row.entries.some(entry => curriculumTopicIncludes(entry, requestedTopic.topic)))
        .map(row => row.course)
        .filter(Boolean);
      const uniqueCourses = [...new Set(matchedCourses)];

      if (uniqueCourses.length === 0) {
        return buildCurriculumFailure({
          matched_topic: requestedTopic.display
        });
      }

      const answer = `The following courses cover ${requestedTopic.display}:\n${uniqueCourses.map(course => `- ${course}`).join("\n")}`;
      const facts = uniqueCourses.map(course => makeCurriculumFact({
        course,
        text: `${course} covers ${requestedTopic.display}.`,
        matchedTopic: requestedTopic.display
      }));

      return buildCurriculumSuccess(answer, facts, {
        matched_topic: requestedTopic.display,
        matched_course_count: uniqueCourses.length
      });
    }

    const courseRow = parsedRows[0];
    if (!courseRow) {
      return buildCurriculumFailure({
        matched_course: requestedCourse || null
      });
    }

    if (requestedWeek !== null) {
      const weekEntry = courseRow.entries.find(entry => getCurriculumEntryWeek(entry) === requestedWeek);
      const topic = getCurriculumEntryTopic(weekEntry);

      if (!topic) {
        return buildCurriculumFailure({
          matched_course: courseRow.course,
          matched_week: requestedWeek
        });
      }

      const answer = `Week ${requestedWeek} in ${courseRow.course} covers:\n${topic}`;
      const factText = `Week ${requestedWeek} in ${courseRow.course} covers ${topic}.`;
      const facts = [makeCurriculumFact({
        course: courseRow.course,
        text: factText,
        week: requestedWeek,
        topic
      })];

      return buildCurriculumSuccess(answer, facts, {
        matched_course: courseRow.course,
        matched_week: requestedWeek,
        matched_topic: topic
      });
    }

    const topics = courseRow.entries
      .map(entry => ({
        week: getCurriculumEntryWeek(entry),
        topic: getCurriculumEntryTopic(entry)
      }))
      .filter(entry => entry.topic);

    if (topics.length === 0) {
      return buildCurriculumFailure({
        matched_course: courseRow.course
      });
    }

    const asksForModules = /\b(module|modules)\b/i.test(query);
    const asksWeekly = /\b(weekly|each week)\b/i.test(query);
    const noun = asksForModules ? "modules" : "topics";
    const prefix = asksWeekly ? `weekly ${noun}` : noun;
    const lines = topics.map(entry => entry.week === null ? `- ${entry.topic}` : `- Week ${entry.week}: ${entry.topic}`);
    const answer = `${courseRow.course} ${prefix} include:\n${lines.join("\n")}`;
    const facts = topics.map(entry => makeCurriculumFact({
      course: courseRow.course,
      text: entry.week === null
        ? `${courseRow.course} covers ${entry.topic}.`
        : `Week ${entry.week} in ${courseRow.course} covers ${entry.topic}.`,
      week: entry.week,
      topic: entry.topic
    }));

    return buildCurriculumSuccess(answer, facts, {
      matched_course: courseRow.course
    });
  }

  /* ============================================================
    CYPHER BUILDERS
  ============================================================ */

  function buildCurriculumCypher(searchLimit = 25, resultLimit = 25) {
    const safeLimit = Math.max(1, Math.min(Number.parseInt(resultLimit, 10) || Number.parseInt(searchLimit, 10) || 25, 50));
    return `
      MATCH (c:Course)-[:HAS_SYLLABUS]->(s:CourseSyllabus)
      WHERE (
          $courseName <> ""
          AND (
            toLower(coalesce(c.name, "")) CONTAINS toLower($courseName)
            OR toLower(coalesce(c.code, "")) CONTAINS toLower($courseName)
            OR toLower(coalesce(c.course_code, "")) CONTAINS toLower($courseName)
          )
        )
        OR (
          $courseName = ""
          AND $topicName <> ""
          AND toLower(coalesce(s.schedule, "")) CONTAINS toLower($topicName)
        )
      RETURN c.name AS course, s.schedule AS schedule
      ORDER BY course
      LIMIT ${safeLimit}
    `;
  }

  function normalizeCypherExpression(expression) {
    return `replace(replace(replace(toLower(coalesce(${expression}, "")), " ", ""), "-", ""), "_", "")`;
  }

  function normalizedKeywordCypher(keywordVar = "k") {
    return `replace(replace(replace(toLower(${keywordVar}), " ", ""), "-", ""), "_", "")`;
  }

  function keywordFields(variableName) {
    return [
      `${variableName}.name`,
      `${variableName}.full_name`,
      `${variableName}.degree_name`,
      `${variableName}.title`,
      `${variableName}.role`,
      `${variableName}.department`,
      `${variableName}.college`,
      `${variableName}.faculty`,
      `${variableName}.code`,
      `${variableName}.course_code`,
      `${variableName}.facility_type`,
      `${variableName}.track_type`,
      `${variableName}.policy_type`,
      `${variableName}.scope`,
      `${variableName}.location_code`,
      `${variableName}.mission`,
      `${variableName}.vision`,
      `${variableName}.applicability`,
      `${variableName}.description`,
      `${variableName}.info`
    ];
  }

  function keywordContainsPredicate(primaryVar, relatedVar = null, keywordParam = "$keywords") {
    const fields = keywordFields(primaryVar);
    if (relatedVar) fields.push(...keywordFields(relatedVar));

    return `(
      size(${keywordParam}) = 0
      OR ${fields.map(field => `ANY(k IN ${keywordParam} WHERE ${normalizeCypherExpression(field)} CONTAINS ${normalizedKeywordCypher()})`).join("\n    OR ")}
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
      `${variableName}.full_name`,
      `${variableName}.degree_name`,
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

  function returnProjection(nodeVar, relatedVar, relVar, orderBy = "score DESC, relationRank ASC") {
    return `
      RETURN
        elementId(${nodeVar}) AS id,
        labels(${nodeVar})[0] AS label,
        coalesce(${nodeVar}.name, ${nodeVar}.full_name, ${nodeVar}.degree_name, ${nodeVar}.college, ${nodeVar}.title, ${nodeVar}.institution) AS name,
        ${nodeVar} {.*, embedding: null} AS props,
        CASE WHEN ${relatedVar} IS NULL THEN null ELSE elementId(${relatedVar}) END AS relatedId,
        CASE WHEN ${relatedVar} IS NULL THEN null ELSE labels(${relatedVar})[0] END AS relatedLabel,
        coalesce(${relatedVar}.name, ${relatedVar}.full_name, ${relatedVar}.degree_name, ${relatedVar}.college, ${relatedVar}.title, ${relatedVar}.institution) AS relatedName,
        CASE WHEN ${relatedVar} IS NULL THEN null ELSE ${relatedVar} {.*, embedding: null} END AS relatedProps,
        type(${relVar}) AS relType,
        CASE WHEN ${relVar} IS NULL THEN null ELSE coalesce(startNode(${relVar}).name, startNode(${relVar}).full_name, startNode(${relVar}).degree_name, startNode(${relVar}).college, startNode(${relVar}).title, startNode(${relVar}).institution) END AS relSourceName,
        CASE WHEN ${relVar} IS NULL THEN null ELSE labels(startNode(${relVar}))[0] END AS relSourceLabel,
        CASE WHEN ${relVar} IS NULL THEN null ELSE coalesce(endNode(${relVar}).name, endNode(${relVar}).full_name, endNode(${relVar}).degree_name, endNode(${relVar}).college, endNode(${relVar}).title, endNode(${relVar}).institution) END AS relTargetName,
        CASE WHEN ${relVar} IS NULL THEN null ELSE labels(endNode(${relVar}))[0] END AS relTargetLabel,
        semanticScore AS baseScore,
        boostedScore AS boostedScore,
        finalScore AS score,
        relationRank AS relationRank,
        nodeKeywordMatch AS nodeKeywordMatch,
        relatedKeywordMatch AS relatedKeywordMatch
      ORDER BY ${orderBy}
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

      // Compute exact/contains booleans early for filtering. Person aliases
      // often normalize to the bare name while KG records may include titles.
      WITH personNode, semanticScore,
        ${exactEntityPredicate("personNode", "$phraseKeywords")} AS _nodeExactPhrase,
        ANY(k IN $keywords WHERE ${normalizeCypherExpression("personNode.name")} = ${normalizedKeywordCypher()}) AS _nodeExactKw,
        ANY(k IN $phraseKeywords WHERE
          ${normalizeCypherExpression("personNode.name")} CONTAINS ${normalizedKeywordCypher()}
          OR ${normalizeCypherExpression("personNode.title")} CONTAINS ${normalizedKeywordCypher()}
          OR ${normalizeCypherExpression("personNode.role")} CONTAINS ${normalizedKeywordCypher()}
        ) AS _nodePhraseContains,
        ANY(k IN $keywords WHERE size(k) >= 4 AND (
          ${normalizeCypherExpression("personNode.name")} CONTAINS ${normalizedKeywordCypher()}
          OR ${normalizeCypherExpression("personNode.title")} CONTAINS ${normalizedKeywordCypher()}
          OR ${normalizeCypherExpression("personNode.role")} CONTAINS ${normalizedKeywordCypher()}
        )) AS _nodeKeywordContains
      WHERE _nodeExactPhrase OR _nodeExactKw OR _nodePhraseContains OR _nodeKeywordContains

      // Expand bridged duplicate faculty nodes before collecting profile edges.
      OPTIONAL MATCH (personNode)-[:IS_SAME_ENTITY]-(samePerson)
      WITH personNode, semanticScore, [personNode] + collect(DISTINCT samePerson) AS profilePeople
      UNWIND profilePeople AS profilePerson

      OPTIONAL MATCH (profilePerson)-[profileRel]-(relatedNode)
      WHERE profileRel IS NULL
        OR type(profileRel) IN ${cypherStringList(PERSON_PROFILE_RELATIONS)}

      WITH personNode, semanticScore, profileRel, relatedNode,
        CASE
          WHEN type(profileRel) = "TEACHES" THEN 1
          WHEN type(profileRel) IN ${cypherStringList(ADMIN_RELATIONS)} THEN 2
          WHEN type(profileRel) IN ["HAS_ROLE", "ACTS_AS"] THEN 2
          WHEN type(profileRel) IN ["HAS_OFFICE", "OFFICE_IN", "LOCATED_IN"] THEN 3
          WHEN type(profileRel) IN ["WORKS_IN", "HAS_DEPARTMENT", "BELONGS_TO_DEPARTMENT"] THEN 3
          WHEN type(profileRel) IN ["SPECIALIZES_IN", "HAS_SPECIALIZATION"] THEN 4
          WHEN type(profileRel) IN ["COORDINATES", "COORDINATOR_OF"] THEN 4
          ELSE 5
        END AS relationPriority
      ORDER BY semanticScore DESC, relationPriority ASC

      WITH personNode, semanticScore,
        [row IN collect(DISTINCT CASE WHEN profileRel IS NULL THEN null ELSE { rel: profileRel, related: relatedNode, rank: relationPriority } END) WHERE row IS NOT NULL][0..${RELATIONS_PER_NODE}] AS relationRows
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
          WHEN type(profileRel) IN ["HAS_OFFICE", "OFFICE_IN", "LOCATED_IN"] THEN semanticScore * 1.65
          WHEN type(profileRel) IN ["WORKS_IN", "HAS_DEPARTMENT", "BELONGS_TO_DEPARTMENT"] THEN semanticScore * 1.55
          WHEN type(profileRel) IN ["SPECIALIZES_IN", "HAS_SPECIALIZATION", "COORDINATES", "COORDINATOR_OF"] THEN semanticScore * 1.45
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

  function buildFacilityCypher(searchLimit, resultLimit) {
    return `
      CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
      YIELD node AS matchedNode, score AS semanticScore
      WHERE semanticScore >= $threshold

      MATCH (collegeNode)-[facilityRel:HAS_FACILITY]->(facilityNode)
      OPTIONAL MATCH (facilityNode)-[componentRel:CONTAINS_COMPONENT]->(componentNode)
      WHERE matchedNode = collegeNode
        OR matchedNode = facilityNode
        OR (componentRel IS NOT NULL AND matchedNode = componentNode)
        OR (
          size($contentKeywords) = 0
          AND ANY(nodeLabel IN labels(matchedNode) WHERE nodeLabel IN ["College", "Facility", "FacilityComponent"])
        )
        OR ${keywordContainsPredicate("collegeNode", "facilityNode", "$contentKeywords")}
        OR (componentRel IS NOT NULL AND ${keywordContainsPredicate("facilityNode", "componentNode", "$contentKeywords")})

      WITH semanticScore,
        [{ primary: collegeNode, related: facilityNode, rel: facilityRel, rank: 0 }]
        + CASE
            WHEN componentRel IS NULL THEN []
            ELSE [{ primary: facilityNode, related: componentNode, rel: componentRel, rank: 1 }]
          END AS relationRows

      UNWIND relationRows AS row
      WITH row.primary AS primaryNode,
          row.related AS relatedNode,
          row.rel AS graphRel,
          row.rank AS relationRank,
          semanticScore
      WHERE ${keywordContainsPredicate("primaryNode", "relatedNode", "$contentKeywords")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank,
        ${keywordMatchBooleans("primaryNode", "relatedNode")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        CASE
          WHEN nodeExactPhraseMatch OR relatedExactPhraseMatch THEN 1
          WHEN nodeExactKeywordMatch OR relatedExactKeywordMatch THEN 1
          WHEN nodeAcronymMatch OR relatedAcronymMatch THEN 1
          ELSE 0
        END AS exactEntityMatch,
        CASE
          WHEN size($contentKeywords) > 0 AND ANY(k IN $contentKeywords WHERE
            ${normalizeCypherExpression("primaryNode.name")} CONTAINS ${normalizedKeywordCypher()}
            OR ${normalizeCypherExpression("relatedNode.name")} CONTAINS ${normalizedKeywordCypher()}
            OR ${normalizeCypherExpression("primaryNode.full_name")} CONTAINS ${normalizedKeywordCypher()}
            OR ${normalizeCypherExpression("relatedNode.full_name")} CONTAINS ${normalizedKeywordCypher()}
          ) THEN 1
          WHEN nodeKeywordMatch OR relatedKeywordMatch THEN 1
          ELSE 0
        END AS semanticContainment,
        CASE
          WHEN type(graphRel) = "HAS_FACILITY" THEN semanticScore * 2.4
          WHEN type(graphRel) = "CONTAINS_COMPONENT" THEN semanticScore * 2.1
          ELSE semanticScore
        END *
        CASE
          WHEN nodeExactPhraseMatch OR relatedExactPhraseMatch THEN 2.0
          WHEN nodeExactKeywordMatch OR relatedExactKeywordMatch THEN 1.75
          WHEN nodeAcronymMatch OR relatedAcronymMatch THEN 1.55
          WHEN nodeKeywordMatch OR relatedKeywordMatch THEN 1.25
          ELSE 1
        END AS boostedScore

      WITH primaryNode, relatedNode, graphRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        exactEntityMatch,
        semanticContainment,
        boostedScore + (exactEntityMatch * 2.0) + (semanticContainment * 0.75) AS finalScore

      ${returnProjection("primaryNode", "relatedNode", "graphRel", "exactEntityMatch DESC, semanticContainment DESC, score DESC, relationRank ASC")}
      LIMIT ${resultLimit}
    `;
  }

  function buildTrackCypher(searchLimit, resultLimit) {
    return `
      CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
      YIELD node AS matchedNode, score AS trackVectorScore
      WHERE trackVectorScore >= $threshold

      CALL {
        WITH matchedNode, trackVectorScore
        MATCH (programNode)-[graphRel]->(trackNode)
        WHERE type(graphRel) IN ["SPECIALIZES_IN", "HAS_SPECIALIZATION"]
          AND ANY(nodeLabel IN labels(trackNode) WHERE nodeLabel IN ["Track", "Specialization"])
          AND (
            matchedNode = programNode
            OR matchedNode = trackNode
            OR ANY(nodeLabel IN labels(matchedNode) WHERE nodeLabel IN ["Program", "Track", "Specialization"])
            OR ${keywordContainsPredicate("programNode", "trackNode", "$contentKeywords")}
          )
        RETURN programNode AS primaryNode, trackNode AS relatedNode, graphRel, trackVectorScore AS semanticScore,
          CASE WHEN type(graphRel) = "SPECIALIZES_IN" THEN 0 ELSE 1 END AS relationRank

        UNION

        WITH matchedNode, trackVectorScore
        MATCH (courseNode)-[graphRel:PART_OF_TRACK]->(trackNode)
        WHERE (
            matchedNode = courseNode
            OR matchedNode = trackNode
            OR ANY(nodeLabel IN labels(matchedNode) WHERE nodeLabel IN ["Course", "Track"])
            OR ${keywordContainsPredicate("courseNode", "trackNode", "$contentKeywords")}
          )
        RETURN courseNode AS primaryNode, trackNode AS relatedNode, graphRel, trackVectorScore AS semanticScore, 2 AS relationRank

        UNION

        WITH matchedNode, trackVectorScore
        MATCH (trackNode)-[graphRel]->(careerNode)
        WHERE type(graphRel) IN ["LEADS_TO", "CAREER_ALIGNMENT", "COMPARES_WITH"]
          AND ANY(nodeLabel IN labels(trackNode) WHERE nodeLabel IN ["Track", "Specialization"])
          AND (
            matchedNode = trackNode
            OR matchedNode = careerNode
            OR ${keywordContainsPredicate("trackNode", "careerNode", "$contentKeywords")}
          )
        RETURN trackNode AS primaryNode, careerNode AS relatedNode, graphRel, trackVectorScore AS semanticScore, 3 AS relationRank
      }

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank
      WHERE ${keywordContainsPredicate("primaryNode", "relatedNode", "$contentKeywords")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank,
        ${keywordMatchBooleans("primaryNode", "relatedNode")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        CASE
          WHEN type(graphRel) = "SPECIALIZES_IN" THEN semanticScore * 2.5
          WHEN type(graphRel) = "HAS_SPECIALIZATION" THEN semanticScore * 2.4
          WHEN type(graphRel) = "PART_OF_TRACK" THEN semanticScore * 2.0
          WHEN type(graphRel) IN ["LEADS_TO", "CAREER_ALIGNMENT"] THEN semanticScore * 1.45
          WHEN type(graphRel) = "COMPARES_WITH" THEN semanticScore * 1.25
          ELSE semanticScore
        END *
        CASE
          WHEN nodeExactPhraseMatch OR relatedExactPhraseMatch THEN 2.0
          WHEN nodeExactKeywordMatch OR relatedExactKeywordMatch THEN 1.75
          WHEN nodeAcronymMatch OR relatedAcronymMatch THEN 1.55
          WHEN nodeKeywordMatch OR relatedKeywordMatch THEN 1.25
          ELSE 1
        END AS boostedScore

      WITH primaryNode, relatedNode, graphRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        boostedScore AS finalScore

      ${returnProjection("primaryNode", "relatedNode", "graphRel")}
      LIMIT ${resultLimit}
    `;
  }

  function buildPartnerInstitutionCypher(searchLimit, resultLimit) {
    return `
      CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
      YIELD node AS matchedNode, score AS semanticScore
      WHERE semanticScore >= $threshold

      MATCH (collegeNode)-[graphRel:HAS_PARTNER_INSTITUTION]->(partnerNode)
      WHERE matchedNode = collegeNode
        OR matchedNode = partnerNode
        OR ANY(nodeLabel IN labels(matchedNode) WHERE nodeLabel IN ["College", "PartnerInstitution"])
        OR ${keywordContainsPredicate("collegeNode", "partnerNode", "$contentKeywords")}

      WITH collegeNode AS primaryNode, partnerNode AS relatedNode, graphRel, semanticScore,
        0 AS relationRank
      WHERE ${keywordContainsPredicate("primaryNode", "relatedNode", "$contentKeywords")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank,
        ${keywordMatchBooleans("primaryNode", "relatedNode")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        semanticScore *
        CASE
          WHEN nodeExactPhraseMatch OR relatedExactPhraseMatch THEN 3.0
          WHEN nodeExactKeywordMatch OR relatedExactKeywordMatch THEN 2.5
          WHEN nodeAcronymMatch OR relatedAcronymMatch THEN 2.0
          WHEN nodeKeywordMatch OR relatedKeywordMatch THEN 1.6
          ELSE 2.2
        END AS boostedScore

      WITH primaryNode, relatedNode, graphRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        boostedScore AS finalScore

      ${returnProjection("primaryNode", "relatedNode", "graphRel")}
      LIMIT ${resultLimit}
    `;
  }

  function buildGovernanceCypher(searchLimit, resultLimit) {
    return `
      CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
      YIELD node AS matchedNode, score AS governanceVectorScore
      WHERE governanceVectorScore >= $threshold

      CALL {
        WITH matchedNode, governanceVectorScore
        MATCH (collegeNode)-[graphRel]->(unitNode)
        WHERE type(graphRel) IN ["HAS_GOVERNANCE_BODY", "HAS_UNIT", "HAS_DEPARTMENT"]
          AND ANY(nodeLabel IN labels(unitNode) WHERE nodeLabel IN ["GovernanceUnit", "QualityUnit", "Department"])
          AND (
            matchedNode = collegeNode
            OR matchedNode = unitNode
            OR ANY(nodeLabel IN labels(matchedNode) WHERE nodeLabel IN ["College", "GovernanceUnit", "QualityUnit", "Department"])
            OR ${keywordContainsPredicate("collegeNode", "unitNode", "$contentKeywords")}
          )
        RETURN collegeNode AS primaryNode, unitNode AS relatedNode, graphRel, governanceVectorScore AS semanticScore,
          CASE
            WHEN type(graphRel) = "HAS_GOVERNANCE_BODY" THEN 0
            WHEN type(graphRel) = "HAS_UNIT" THEN 1
            ELSE 2
          END AS relationRank

        UNION

        WITH matchedNode, governanceVectorScore
        MATCH (personNode)-[graphRel]->(unitNode)
        WHERE type(graphRel) IN ["HAS_ADMIN", "HEAD_OF", "HEAD_OF_UNIT", "MANAGES", "ADMINISTERS", "DEAN_OF"]
          AND ANY(nodeLabel IN labels(unitNode) WHERE nodeLabel IN ["GovernanceUnit", "QualityUnit", "Department", "College"])
          AND (
            matchedNode = personNode
            OR matchedNode = unitNode
            OR ${keywordContainsPredicate("personNode", "unitNode", "$contentKeywords")}
          )
        RETURN personNode AS primaryNode, unitNode AS relatedNode, graphRel, governanceVectorScore AS semanticScore, 1 AS relationRank

        UNION

        WITH matchedNode, governanceVectorScore
        MATCH (unitNode)-[graphRel]->(programNode)
        WHERE type(graphRel) IN ["MANAGES", "BELONGS_TO"]
          AND ANY(nodeLabel IN labels(unitNode) WHERE nodeLabel IN ["GovernanceUnit", "QualityUnit", "Department"])
          AND (
            matchedNode = unitNode
            OR matchedNode = programNode
            OR ${keywordContainsPredicate("unitNode", "programNode", "$contentKeywords")}
          )
        RETURN unitNode AS primaryNode, programNode AS relatedNode, graphRel, governanceVectorScore AS semanticScore, 3 AS relationRank
      }

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank
      WHERE ${keywordContainsPredicate("primaryNode", "relatedNode", "$contentKeywords")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank,
        ${keywordMatchBooleans("primaryNode", "relatedNode")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        CASE
          WHEN type(graphRel) = "HAS_GOVERNANCE_BODY" THEN semanticScore * 2.5
          WHEN type(graphRel) IN ["HAS_UNIT", "HAS_DEPARTMENT"] THEN semanticScore * 2.2
          WHEN type(graphRel) IN ["HEAD_OF", "HEAD_OF_UNIT", "HAS_ADMIN", "DEAN_OF"] THEN semanticScore * 2.0
          WHEN type(graphRel) IN ["MANAGES", "ADMINISTERS"] THEN semanticScore * 1.8
          ELSE semanticScore * 1.25
        END *
        CASE
          WHEN nodeExactPhraseMatch OR relatedExactPhraseMatch THEN 2.0
          WHEN nodeExactKeywordMatch OR relatedExactKeywordMatch THEN 1.75
          WHEN nodeAcronymMatch OR relatedAcronymMatch THEN 1.55
          WHEN nodeKeywordMatch OR relatedKeywordMatch THEN 1.25
          ELSE 1
        END AS boostedScore

      WITH primaryNode, relatedNode, graphRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        boostedScore AS finalScore

      ${returnProjection("primaryNode", "relatedNode", "graphRel")}
      LIMIT ${resultLimit}
    `;
  }

  function buildPolicyCypher(searchLimit, resultLimit) {
    return `
      CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
      YIELD node AS matchedNode, score AS policyVectorScore
      WHERE policyVectorScore >= $threshold

      CALL {
        WITH matchedNode, policyVectorScore
        MATCH (collegeNode)-[graphRel]->(policyNode)
        WHERE type(graphRel) IN ["SUPPORTS_POLICY_QUERY", "FOLLOWS_POLICY", "USES_GRADING_SYSTEM"]
          AND ANY(nodeLabel IN labels(policyNode) WHERE nodeLabel IN ["Policy", "GradingPolicy", "GradingSystem"])
          AND (
            matchedNode = collegeNode
            OR matchedNode = policyNode
            OR ANY(nodeLabel IN labels(matchedNode) WHERE nodeLabel IN ["College", "Policy", "GradingPolicy", "GradingSystem"])
            OR ${keywordContainsPredicate("collegeNode", "policyNode", "$contentKeywords")}
          )
        RETURN collegeNode AS primaryNode, policyNode AS relatedNode, graphRel, policyVectorScore AS semanticScore,
          CASE
            WHEN type(graphRel) = "FOLLOWS_POLICY" THEN 0
            WHEN type(graphRel) = "USES_GRADING_SYSTEM" THEN 1
            ELSE 2
          END AS relationRank

        UNION

        WITH matchedNode, policyVectorScore
        MATCH (programNode)-[graphRel]->(policyNode)
        WHERE type(graphRel) IN ["HAS_TUITION_PATHWAY", "HAS_SCHOLARSHIP_POLICY", "HAS_ADVISING_PATHWAY", "HAS_SCHOLARSHIP"]
          AND ANY(nodeLabel IN labels(policyNode) WHERE nodeLabel IN ["Policy", "Scholarship"])
          AND (
            matchedNode = programNode
            OR matchedNode = policyNode
            OR ${keywordContainsPredicate("programNode", "policyNode", "$contentKeywords")}
          )
        RETURN programNode AS primaryNode, policyNode AS relatedNode, graphRel, policyVectorScore AS semanticScore, 1 AS relationRank

        UNION

        WITH matchedNode, policyVectorScore
        MATCH (policyNode)-[graphRel:BELONGS_TO]->(collegeNode)
        WHERE ANY(nodeLabel IN labels(policyNode) WHERE nodeLabel IN ["Policy", "GradingPolicy", "GradingSystem", "Scholarship"])
          AND (
            matchedNode = policyNode
            OR matchedNode = collegeNode
            OR ${keywordContainsPredicate("policyNode", "collegeNode", "$contentKeywords")}
          )
        RETURN policyNode AS primaryNode, collegeNode AS relatedNode, graphRel, policyVectorScore AS semanticScore, 3 AS relationRank
      }

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank
      WHERE ${keywordContainsPredicate("primaryNode", "relatedNode", "$contentKeywords")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank,
        ${keywordMatchBooleans("primaryNode", "relatedNode")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        CASE
          WHEN type(graphRel) = "FOLLOWS_POLICY" THEN semanticScore * 2.5
          WHEN type(graphRel) = "USES_GRADING_SYSTEM" THEN semanticScore * 2.4
          WHEN type(graphRel) = "SUPPORTS_POLICY_QUERY" THEN semanticScore * 2.2
          WHEN type(graphRel) IN ["HAS_TUITION_PATHWAY", "HAS_SCHOLARSHIP_POLICY", "HAS_ADVISING_PATHWAY"] THEN semanticScore * 2.0
          WHEN type(graphRel) = "HAS_SCHOLARSHIP" THEN semanticScore * 1.8
          ELSE semanticScore * 1.25
        END *
        CASE
          WHEN nodeExactPhraseMatch OR relatedExactPhraseMatch THEN 2.0
          WHEN nodeExactKeywordMatch OR relatedExactKeywordMatch THEN 1.75
          WHEN nodeAcronymMatch OR relatedAcronymMatch THEN 1.55
          WHEN nodeKeywordMatch OR relatedKeywordMatch THEN 1.25
          ELSE 1
        END AS boostedScore

      WITH primaryNode, relatedNode, graphRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        boostedScore AS finalScore

      ${returnProjection("primaryNode", "relatedNode", "graphRel")}
      LIMIT ${resultLimit}
    `;
  }

  function buildCampusCypher(searchLimit, resultLimit) {
    return `
      CALL db.index.vector.queryNodes($indexName, ${searchLimit}, $vector)
      YIELD node AS matchedNode, score AS campusVectorScore
      WHERE campusVectorScore >= $threshold

      CALL {
        WITH matchedNode, campusVectorScore
        MATCH (campusNode)-[graphRel:HOSTS]->(collegeNode)
        WHERE matchedNode = campusNode
          OR matchedNode = collegeNode
          OR ANY(nodeLabel IN labels(matchedNode) WHERE nodeLabel IN ["Campus", "College"])
          OR ${keywordContainsPredicate("campusNode", "collegeNode", "$contentKeywords")}
        RETURN campusNode AS primaryNode, collegeNode AS relatedNode, graphRel, campusVectorScore AS semanticScore, 0 AS relationRank

        UNION

        WITH matchedNode, campusVectorScore
        MATCH (collegeNode)-[graphRel:OFFERS]->(degreeNode)
        WHERE matchedNode = collegeNode
          OR matchedNode = degreeNode
          OR ${keywordContainsPredicate("collegeNode", "degreeNode", "$contentKeywords")}
        RETURN collegeNode AS primaryNode, degreeNode AS relatedNode, graphRel, campusVectorScore AS semanticScore, 1 AS relationRank

        UNION

        WITH matchedNode, campusVectorScore
        MATCH (degreeNode)-[graphRel:INCLUDES_PROGRAM]->(programNode)
        WHERE matchedNode = degreeNode
          OR matchedNode = programNode
          OR ${keywordContainsPredicate("degreeNode", "programNode", "$contentKeywords")}
        RETURN degreeNode AS primaryNode, programNode AS relatedNode, graphRel, campusVectorScore AS semanticScore, 2 AS relationRank
      }

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank
      WHERE ${keywordContainsPredicate("primaryNode", "relatedNode", "$contentKeywords")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank,
        ${keywordMatchBooleans("primaryNode", "relatedNode")}

      WITH primaryNode, relatedNode, graphRel, semanticScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        CASE
          WHEN type(graphRel) = "HOSTS" THEN semanticScore * 2.4
          WHEN type(graphRel) = "OFFERS" THEN semanticScore * 2.0
          WHEN type(graphRel) = "INCLUDES_PROGRAM" THEN semanticScore * 1.8
          ELSE semanticScore
        END *
        CASE
          WHEN nodeExactPhraseMatch OR relatedExactPhraseMatch THEN 2.0
          WHEN nodeExactKeywordMatch OR relatedExactKeywordMatch THEN 1.75
          WHEN nodeAcronymMatch OR relatedAcronymMatch THEN 1.55
          WHEN nodeKeywordMatch OR relatedKeywordMatch THEN 1.25
          ELSE 1
        END AS boostedScore

      WITH primaryNode, relatedNode, graphRel, semanticScore, boostedScore, relationRank, nodeKeywordMatch, relatedKeywordMatch,
        boostedScore AS finalScore

      ${returnProjection("primaryNode", "relatedNode", "graphRel")}
      LIMIT ${resultLimit}
    `;
  }

  function isOntologyAggregationQuery(normalizedQuery, intent, exactEntity = null) {
    if (exactEntity) return false;

    const asksForList = /\b(what|which|list|show|all|available|availability|offer|offers|offered|have|has|there)\b/.test(normalizedQuery);
    if (!asksForList) return false;

    if (intent === "FACILITY") {
      return /\b(facility|facilities|lab|labs|laboratory|laboratories)\b/.test(normalizedQuery);
    }

    if (intent === "TRACK") {
      return /\b(track|tracks|specialization|specializations|pathway|pathways)\b/.test(normalizedQuery);
    }

    return false;
  }

  function buildFacilityAggregationCypher(resultLimit) {
    return `
      MATCH (collegeNode)-[graphRel:HAS_FACILITY]->(facilityNode)
      WHERE ANY(nodeLabel IN labels(collegeNode) WHERE nodeLabel IN ["College"])
        AND ANY(nodeLabel IN labels(facilityNode) WHERE nodeLabel IN ["Facility"])

      WITH collegeNode AS primaryNode,
          facilityNode AS relatedNode,
          graphRel,
          1.0 AS semanticScore,
          2.5 AS boostedScore,
          2.5 AS finalScore,
          0 AS relationRank,
          true AS nodeKeywordMatch,
          true AS relatedKeywordMatch

      ${returnProjection("primaryNode", "relatedNode", "graphRel", "relatedName ASC")}
      LIMIT ${resultLimit}
    `;
  }

  function buildTrackAggregationCypher(resultLimit) {
    return `
      MATCH (programNode)-[graphRel]->(trackNode)
      WHERE type(graphRel) IN ["SPECIALIZES_IN", "HAS_SPECIALIZATION"]
        AND ANY(nodeLabel IN labels(programNode) WHERE nodeLabel IN ["Program"])
        AND ANY(nodeLabel IN labels(trackNode) WHERE nodeLabel IN ["Track", "Specialization"])

      WITH programNode, trackNode, graphRel,
        CASE WHEN type(graphRel) = "HAS_SPECIALIZATION" THEN 0 ELSE 1 END AS relationRank
      ORDER BY relationRank ASC, coalesce(trackNode.name, trackNode.full_name, "") ASC

      WITH trackNode, collect({ program: programNode, rel: graphRel, rank: relationRank })[0] AS row
      WITH row.program AS primaryNode,
          trackNode AS relatedNode,
          row.rel AS graphRel,
          1.0 AS semanticScore,
          2.4 AS boostedScore,
          2.4 AS finalScore,
          row.rank AS relationRank,
          true AS nodeKeywordMatch,
          true AS relatedKeywordMatch

      ${returnProjection("primaryNode", "relatedNode", "graphRel", "relationRank ASC, relatedName ASC")}
      LIMIT ${resultLimit}
    `;
  }

  function buildAggregationCypher(intent, resultLimit) {
    if (intent === "FACILITY") return buildFacilityAggregationCypher(resultLimit);
    if (intent === "TRACK") return buildTrackAggregationCypher(resultLimit);
    return null;
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
          WHEN type(graphRel) IN ["HOSTS", "OFFERS", "INCLUDES_PROGRAM"] THEN 0
          WHEN type(graphRel) = "TEACHES" THEN 0
          WHEN type(graphRel) = "HAS_COURSE" THEN 1
          WHEN type(graphRel) IN ["SPECIALIZES_IN", "HAS_SPECIALIZATION", "PART_OF_TRACK"] THEN 1
          WHEN type(graphRel) IN ["HAS_FACILITY", "CONTAINS_COMPONENT", "HAS_PARTNER_INSTITUTION"] THEN 1
          WHEN type(graphRel) = "HAS_PREREQUISITE" THEN 2
          WHEN type(graphRel) IN ["SUPPORTS_POLICY_QUERY", "FOLLOWS_POLICY", "USES_GRADING_SYSTEM", "HAS_TUITION_PATHWAY", "HAS_SCHOLARSHIP_POLICY", "HAS_ADVISING_PATHWAY"] THEN 2
          WHEN type(graphRel) IN ["HAS_GOVERNANCE_BODY", "HAS_UNIT"] THEN 2
          WHEN type(graphRel) IN ["HAS_OFFICE", "OFFICE_IN", "LOCATED_IN"] THEN 2
          WHEN type(graphRel) IN ${cypherStringList(ADMIN_RELATIONS)} THEN 3
          ELSE 3
        END AS relationRank
      ORDER BY semanticScore DESC, relationRank ASC

      WITH matchedNode, semanticScore, collect({ rel: graphRel, related: neighborNode })[0..${GENERAL_RELATIONS_PER_NODE}] AS relationRows
      UNWIND relationRows AS relationRow

      WITH matchedNode, semanticScore, relationRow.rel AS graphRel, relationRow.related AS neighborNode
      WHERE ${keywordContainsPredicate("matchedNode", "neighborNode")}

      WITH matchedNode, neighborNode, graphRel, semanticScore,
        ${keywordMatchBooleans("matchedNode", "neighborNode")}

      WITH matchedNode, neighborNode, graphRel, semanticScore, nodeKeywordMatch, relatedKeywordMatch,
        CASE
          WHEN type(graphRel) IN ["HOSTS", "OFFERS", "INCLUDES_PROGRAM"] THEN semanticScore * 1.7
          WHEN type(graphRel) = "TEACHES" THEN semanticScore * 1.6
          WHEN type(graphRel) = "HAS_COURSE" THEN semanticScore * 1.5
          WHEN type(graphRel) IN ["SPECIALIZES_IN", "HAS_SPECIALIZATION", "PART_OF_TRACK"] THEN semanticScore * 1.5
          WHEN type(graphRel) IN ["HAS_FACILITY", "CONTAINS_COMPONENT", "HAS_PARTNER_INSTITUTION"] THEN semanticScore * 1.5
          WHEN type(graphRel) = "HAS_PREREQUISITE" THEN semanticScore * 1.45
          WHEN type(graphRel) IN ["SUPPORTS_POLICY_QUERY", "FOLLOWS_POLICY", "USES_GRADING_SYSTEM", "HAS_TUITION_PATHWAY", "HAS_SCHOLARSHIP_POLICY", "HAS_ADVISING_PATHWAY"] THEN semanticScore * 1.42
          WHEN type(graphRel) IN ["HAS_GOVERNANCE_BODY", "HAS_UNIT"] THEN semanticScore * 1.4
          WHEN type(graphRel) IN ["HAS_OFFICE", "OFFICE_IN", "LOCATED_IN"] THEN semanticScore * 1.42
          WHEN type(graphRel) IN ["SPECIALIZES_IN", "HAS_SPECIALIZATION", "COORDINATES", "COORDINATOR_OF"] THEN semanticScore * 1.35
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
          WHEN type(graphRel) IN ["HOSTS", "OFFERS", "INCLUDES_PROGRAM"] THEN 0
          WHEN type(graphRel) = "TEACHES" THEN 0
          WHEN type(graphRel) = "HAS_COURSE" THEN 1
          WHEN type(graphRel) IN ["SPECIALIZES_IN", "HAS_SPECIALIZATION", "PART_OF_TRACK"] THEN 1
          WHEN type(graphRel) IN ["HAS_FACILITY", "CONTAINS_COMPONENT", "HAS_PARTNER_INSTITUTION"] THEN 1
          WHEN type(graphRel) = "HAS_PREREQUISITE" THEN 2
          WHEN type(graphRel) IN ["SUPPORTS_POLICY_QUERY", "FOLLOWS_POLICY", "USES_GRADING_SYSTEM", "HAS_TUITION_PATHWAY", "HAS_SCHOLARSHIP_POLICY", "HAS_ADVISING_PATHWAY"] THEN 2
          WHEN type(graphRel) IN ["HAS_GOVERNANCE_BODY", "HAS_UNIT"] THEN 2
          WHEN type(graphRel) IN ["HAS_OFFICE", "OFFICE_IN", "LOCATED_IN"] THEN 2
          WHEN type(graphRel) IN ${cypherStringList(ADMIN_RELATIONS)} THEN 3
          WHEN type(graphRel) IN ["SPECIALIZES_IN", "HAS_SPECIALIZATION", "COORDINATES", "COORDINATOR_OF"] THEN 3
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
    if (intent === "FACILITY") return buildFacilityCypher;
    if (intent === "TRACK") return buildTrackCypher;
    if (intent === "PARTNER_INSTITUTION") return buildPartnerInstitutionCypher;
    if (intent === "GOVERNANCE") return buildGovernanceCypher;
    if (intent === "POLICY") return buildPolicyCypher;
    if (intent === "CAMPUS") return buildCampusCypher;
    if (intent === "CURRICULUM") return buildCurriculumCypher;
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

  function isPersonLabel(label) {
    return PERSON_LABELS.has(String(label || ""));
  }

  function factKey(fact) {
    return String(fact?.relationKey || `${fact?.kind || "fact"}:${fact?.label || ""}:${fact?.name || ""}:${fact?.text || ""}`).toLowerCase();
  }

  function stripTrailingPeriod(value) {
    return String(value || "").replace(/\s+/g, " ").trim().replace(/[.]+$/g, "");
  }

  function lowerFirst(value) {
    const text = stripTrailingPeriod(value);
    if (!text) return "";
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  function formatNaturalList(items) {
    const values = [];
    const seen = new Set();

    for (const item of items) {
      const clean = stripTrailingPeriod(item);
      const key = normalizeText(clean);
      if (!clean || seen.has(key)) continue;
      seen.add(key);
      values.push(clean);
    }

    if (values.length === 0) return "";
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
  }

  function cleanRoleTitle(value) {
    const text = cleanValue(value);
    if (!text) return "";
    return stripTrailingPeriod(text)
      .replace(/\s+/g, " ")
      .replace(/^(role|title)\s*:\s*/i, "")
      .trim();
  }

  function getRoleFromProperties(props = {}) {
    return cleanRoleTitle(props.role) || cleanRoleTitle(props.title);
  }

  function roleClause(role) {
    const cleanRole = cleanRoleTitle(role);
    if (!cleanRole) return "";
    if (/^(serves|works|teaches|heads|chairs|directs|manages|coordinates|administers)\b/i.test(cleanRole)) {
      return lowerFirst(cleanRole);
    }
    return `serves as ${cleanRole}`;
  }

  function humanizeRelationFact({
    relType,
    sourceName,
    targetName,
    sourceLabel = "",
    targetLabel = "",
    sourceProperties = {},
    targetProperties = {}
  }) {
    if (!relType || !sourceName || !targetName) return null;

    const sourceRole = getRoleFromProperties(sourceProperties);
    const targetRole = getRoleFromProperties(targetProperties);

    if (relType === "TEACHES") {
      return `${sourceName} teaches the ${targetName} course.`;
    }

    if (relType === "HAS_COURSE") {
      return `${sourceName} includes the ${targetName} course.`;
    }

    if (relType === "HAS_PREREQUISITE") {
      return `${targetName} is a prerequisite for ${sourceName}.`;
    }

    if (relType === "HAS_SYLLABUS") {
      return `${sourceName} has syllabus ${targetName}.`;
    }

    if (relType === "HOSTS") {
      return `${sourceName} hosts ${targetName}.`;
    }

    if (relType === "OFFERS") {
      return `${sourceName} offers ${targetName}.`;
    }

    if (relType === "INCLUDES_PROGRAM") {
      return `${sourceName} includes the ${targetName} program.`;
    }

    if (relType === "HAS_ACCREDITATION") {
      return `${sourceName} has accreditation from ${targetName}.`;
    }

    if (relType === "HAS_FACILITY") {
      return `${sourceName} has the ${targetName} facility.`;
    }

    if (relType === "CONTAINS_COMPONENT") {
      return `${sourceName} contains ${targetName}.`;
    }

    if (relType === "HAS_PARTNER_INSTITUTION") {
      return `${sourceName} has partner institution ${targetName}.`;
    }

    if (relType === "HAS_GOVERNANCE_BODY") {
      return `${sourceName} has governance body ${targetName}.`;
    }

    if (relType === "HAS_UNIT") {
      return `${sourceName} has unit ${targetName}.`;
    }

    if (relType === "SUPPORTS_POLICY_QUERY") {
      return `${sourceName} supports the ${targetName} policy pathway.`;
    }

    if (relType === "FOLLOWS_POLICY") {
      return `${sourceName} follows ${targetName}.`;
    }

    if (relType === "USES_GRADING_SYSTEM") {
      return `${sourceName} uses ${targetName}.`;
    }

    if (relType === "HAS_TUITION_PATHWAY") {
      return `${sourceName} has tuition pathway ${targetName}.`;
    }

    if (relType === "HAS_SCHOLARSHIP_POLICY") {
      return `${sourceName} has scholarship policy ${targetName}.`;
    }

    if (relType === "HAS_ADVISING_PATHWAY") {
      return `${sourceName} has academic advising pathway ${targetName}.`;
    }

    if (relType === "HAS_SCHOLARSHIP") {
      return `${sourceName} has scholarship ${targetName}.`;
    }

    if (relType === "DEAN_OF") {
      const role = /dean/i.test(sourceRole) ? sourceRole : "Dean";
      return `${sourceName} serves as ${role} for ${targetName}.`;
    }

    if (relType === "HAS_ADMIN") {
      const role = sourceRole || targetRole;
      return role
        ? `${sourceName} serves as ${role} for ${targetName}.`
        : `${sourceName} serves in administration for ${targetName}.`;
    }

    if (["HEAD_OF", "HEAD_OF_UNIT"].includes(relType)) {
      const role = /head|director|chair/i.test(sourceRole) ? sourceRole : "";
      return role
        ? `${sourceName} serves as ${role} for ${targetName}.`
        : `${sourceName} heads ${targetName}.`;
    }

    if (["HAS_ROLE", "ACTS_AS"].includes(relType)) {
      return `${sourceName} serves as ${targetName}.`;
    }

    if (relType === "WORKS_IN") {
      return `${sourceName} works in ${targetName}.`;
    }

    if (["HAS_OFFICE", "OFFICE_IN", "LOCATED_IN"].includes(relType)) {
      return `${sourceName}'s office is in ${targetName}.`;
    }

    if (["HAS_DEPARTMENT", "BELONGS_TO_DEPARTMENT"].includes(relType)) {
      if (!isPersonLabel(sourceLabel)) {
        return `${sourceName} has department ${targetName}.`;
      }
      return `${sourceName} works in ${targetName}.`;
    }

    if (relType === "MEMBER_OF") {
      return `${sourceName} is a member of ${targetName}.`;
    }

    if (["SPECIALIZES_IN", "HAS_SPECIALIZATION"].includes(relType)) {
      return `${sourceName} specializes in ${targetName}.`;
    }

    if (relType === "PART_OF_TRACK") {
      return `${sourceName} is part of the ${targetName} track.`;
    }

    if (relType === "RECOMMENDED_AFTER") {
      return `${sourceName} is recommended after ${targetName}.`;
    }

    if (relType === "LEADS_TO") {
      return `${sourceName} leads to ${targetName}.`;
    }

    if (relType === "CAREER_ALIGNMENT") {
      return `${sourceName} aligns with the ${targetName} career role.`;
    }

    if (relType === "COMPARES_WITH") {
      return `${sourceName} compares with ${targetName}.`;
    }

    if (["COORDINATES", "COORDINATOR_OF"].includes(relType)) {
      return `${sourceName} coordinates ${targetName}.`;
    }

    if (relType === "BELONGS_TO") {
      return `${sourceName} is part of ${targetName}.`;
    }

    if (relType === "ADMINISTERS") {
      return `${sourceName} administers ${targetName}.`;
    }

    if (relType === "CHAIRS") {
      return `${sourceName} chairs ${targetName}.`;
    }

    if (relType === "DIRECTS") {
      return `${sourceName} directs ${targetName}.`;
    }

    if (relType === "MANAGES") {
      return `${sourceName} manages ${targetName}.`;
    }

    return null;
  }

  function humanizeTriple(text) {
    const match = text.match(/^\(([^:]+):\s*"([^"]+)"\)\s*--\[([^\]]+)\]-->\s*\(([^:]+):\s*"([^"]+)"\)$/);
    if (!match) return text;

    const sourceLabel = match[1];
    const sourceName = match[2];
    const relType = match[3];
    const targetLabel = match[4];
    const targetName = match[5];

    const relationText = humanizeRelationFact({ relType, sourceName, targetName, sourceLabel, targetLabel });
    if (relationText) return relationText;

    return `(${sourceLabel}: "${sourceName}") --[${relType}]--> (${targetLabel}: "${targetName}")`;
  }

  function formatPropertyFact(label, name, props, score, relationRank) {
    if (isPersonLabel(label)) {
      const profileProperties = {};
      for (const key of ["role", "title", "department", "college", "faculty", "office", "room", "location", "specialization", "specializations"]) {
        const value = cleanValue(props?.[key]);
        if (value) profileProperties[key] = value;
      }

      const profileText = Object.values(profileProperties).filter(Boolean).join("; ");
      if (profileText) {
        return {
          text: `(${label || "Person"}: "${name}") profile: ${profileText}`,
          kind: "property",
          relType: null,
          label,
          name,
          entityName: name,
          profileProperties,
          score,
          relationRank
        };
      }
    }

    const preferredKeys = [
      "description",
      "info",
      "overview",
      "summary",
      "details",
      "full_name",
      "degree_name",
      "role",
      "title",
      "department",
      "college",
      "faculty",
      "office",
      "room",
      "location",
      "specialization",
      "specializations",
      "code",
      "course_code",
      "facility_type",
      "track_type",
      "policy_type",
      "scope",
      "location_code",
      "applicability",
      "mission",
      "vision",
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
          label,
          name,
          score,
          relationRank
        };
      }
    }

    return {
      text: `${label || "Entity"}: ${name}`,
      kind: "property",
      relType: null,
      label,
      name,
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
    const relatedProps = record.get("relatedProps") || {};
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

    const sourceProperties = relSourceName === name ? props : (relSourceName === relatedName ? relatedProps : {});
    const targetProperties = relTargetName === name ? props : (relTargetName === relatedName ? relatedProps : {});
    const triple = `(${relSourceLabel}: "${relSourceName}") --[${relType}]--> (${relTargetLabel}: "${relTargetName}")`;
    const relationText = humanizeRelationFact({
      relType,
      sourceName: relSourceName,
      targetName: relTargetName,
      sourceLabel: relSourceLabel,
      targetLabel: relTargetLabel,
      sourceProperties,
      targetProperties
    }) || humanizeTriple(triple);

    return {
      text: relationText,
      triple,
      relationKey: `${relType}:${relSourceName}->${relTargetName}`,
      kind: "relation",
      relType,
      label,
      name,
      relatedLabel,
      relatedName,
      relSourceName,
      relSourceLabel,
      relTargetName,
      relTargetLabel,
      score,
      baseScore,
      boostedScore,
      relationRank,
      graph: {
        source: relSourceName,
        sourceLabel: relSourceLabel,
        sourceProperties,
        target: relTargetName,
        targetLabel: relTargetLabel,
        targetProperties,
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
    const threshold = getGoodFactThreshold(intent);
    return facts.filter(fact => (fact.baseScore || fact.score || 0) >= threshold);
  }

  function getPersonNameForFact(fact) {
    if (!fact) return null;

    if (fact.kind === "property" && isPersonLabel(fact.label)) {
      return fact.entityName || fact.name;
    }

    const graph = fact.graph || {};
    if (isPersonLabel(graph.sourceLabel)) return graph.source;
    if (isPersonLabel(graph.targetLabel)) return graph.target;
    if (isPersonLabel(fact.relSourceLabel)) return fact.relSourceName;
    if (isPersonLabel(fact.relTargetLabel)) return fact.relTargetName;
    return null;
  }

  function getOtherEntityNameForPersonFact(fact, personName) {
    const personKey = normalizeText(personName);
    const sourceName = fact?.graph?.source || fact?.relSourceName;
    const targetName = fact?.graph?.target || fact?.relTargetName;

    if (normalizeText(sourceName) === personKey) return targetName;
    if (normalizeText(targetName) === personKey) return sourceName;
    return fact?.relatedName || targetName || sourceName;
  }

  function getPersonPropertiesForFact(fact, personName) {
    const personKey = normalizeText(personName);

    if (normalizeText(fact?.graph?.source) === personKey) {
      return fact.graph.sourceProperties || {};
    }

    if (normalizeText(fact?.graph?.target) === personKey) {
      return fact.graph.targetProperties || {};
    }

    if (normalizeText(fact?.relSourceName) === personKey) {
      return fact?.graph?.sourceProperties || {};
    }

    if (normalizeText(fact?.relTargetName) === personKey) {
      return fact?.graph?.targetProperties || {};
    }

    return {};
  }

  function personRelationSummaryLine(fact, personName) {
    const otherName = getOtherEntityNameForPersonFact(fact, personName);
    if (!otherName || normalizeText(otherName) === normalizeText(personName)) return null;

    const personProps = getPersonPropertiesForFact(fact, personName);
    const role = getRoleFromProperties(personProps);

    switch (fact.relType) {
      case "TEACHES":
        return { text: `teaches ${otherName}`, priority: 1 };
      case "DEAN_OF":
        return {
          text: /dean/i.test(role) ? `serves as ${role} for ${otherName}` : `serves as Dean for ${otherName}`,
          priority: 2
        };
      case "HAS_ADMIN":
        return {
          text: role ? `serves as ${role} for ${otherName}` : `serves in administration for ${otherName}`,
          priority: 2
        };
      case "HEAD_OF":
      case "HEAD_OF_UNIT":
        return {
          text: /head|director|chair/i.test(role) ? `serves as ${role} for ${otherName}` : `heads ${otherName}`,
          priority: 2
        };
      case "HAS_ROLE":
      case "ACTS_AS":
        return { text: `serves as ${otherName}`, priority: 3 };
      case "MANAGES":
        return { text: `manages ${otherName}`, priority: 4 };
      case "ADMINISTERS":
        return { text: `administers ${otherName}`, priority: 4 };
      case "CHAIRS":
        return { text: `chairs ${otherName}`, priority: 4 };
      case "DIRECTS":
        return { text: `directs ${otherName}`, priority: 4 };
      case "WORKS_IN":
        return { text: `works in ${otherName}`, priority: 5 };
      case "HAS_OFFICE":
      case "OFFICE_IN":
      case "LOCATED_IN":
        return { text: `has office in ${otherName}`, priority: 5 };
      case "HAS_DEPARTMENT":
      case "BELONGS_TO_DEPARTMENT":
        return { text: `works in ${otherName}`, priority: 5 };
      case "MEMBER_OF":
        return { text: `is a member of ${otherName}`, priority: 6 };
      case "BELONGS_TO":
        return { text: `is part of ${otherName}`, priority: 6 };
      case "SPECIALIZES_IN":
      case "HAS_SPECIALIZATION":
        return { text: `specializes in ${otherName}`, priority: 6 };
      case "COORDINATES":
      case "COORDINATOR_OF":
        return { text: `coordinates ${otherName}`, priority: 4 };
      default:
        return null;
    }
  }

  function addPersonSummaryLine(lineMap, text, priority) {
    const cleanText = String(text || "").replace(/\s+/g, " ").trim();
    if (!cleanText) return;

    const key = normalizeText(cleanText);
    const existing = lineMap.get(key);
    if (!existing || priority < existing.priority) {
      lineMap.set(key, { text: cleanText, priority });
    }
  }

  function normalizePersonClause(text) {
    const clean = stripTrailingPeriod(text);
    if (!clean) return "";

    const teaches = clean.match(/^teaches\s+(?:the\s+)?(.+?)(?:\s+course)?$/i);
    if (teaches) return { type: "teaches", value: teaches[1].trim() };

    return { type: "clause", value: lowerFirst(clean) };
  }

  function buildNaturalPersonSummaryText(personName, lines) {
    const teachings = [];
    const clauses = [];

    for (const line of lines) {
      const normalized = normalizePersonClause(line.text);
      if (!normalized) continue;
      if (normalized.type === "teaches") teachings.push(normalized.value);
      else clauses.push(normalized.value);
    }

    const mergedClauses = [];
    const teachingList = formatNaturalList(teachings);
    if (teachingList) mergedClauses.push(`teaches ${teachingList}`);
    mergedClauses.push(...clauses);

    const sentenceBody = formatNaturalList(mergedClauses);
    return sentenceBody ? `${personName} ${sentenceBody}.` : null;
  }

  function buildPersonSummaryFacts(facts) {
    const groups = new Map();

    for (const fact of facts) {
      const personName = getPersonNameForFact(fact);
      const personKey = normalizeText(personName);
      if (!personKey) continue;

      if (!groups.has(personKey)) {
        groups.set(personKey, {
          name: personName,
          facts: [],
          maxScore: 0,
          maxBaseScore: 0
        });
      }

      const group = groups.get(personKey);
      group.facts.push(fact);
      group.maxScore = Math.max(group.maxScore, fact.score || 0);
      group.maxBaseScore = Math.max(group.maxBaseScore, fact.baseScore || fact.score || 0);
    }

    return Array.from(groups.values())
      .map(group => {
        const lineMap = new Map();

        for (const fact of group.facts) {
          if (fact.kind === "property" && fact.profileProperties) {
            addPersonSummaryLine(lineMap, roleClause(fact.profileProperties.role), 3);
            addPersonSummaryLine(lineMap, roleClause(fact.profileProperties.title), 7);
            if (fact.profileProperties.department) {
              addPersonSummaryLine(lineMap, `works in ${fact.profileProperties.department}`, 8);
            }
            if (fact.profileProperties.office) {
              addPersonSummaryLine(lineMap, `has office in ${fact.profileProperties.office}`, 5);
            }
            if (fact.profileProperties.room) {
              addPersonSummaryLine(lineMap, `has office in ${fact.profileProperties.room}`, 5);
            }
            if (fact.profileProperties.location) {
              addPersonSummaryLine(lineMap, `has office in ${fact.profileProperties.location}`, 6);
            }
            if (fact.profileProperties.specialization) {
              addPersonSummaryLine(lineMap, `specializes in ${fact.profileProperties.specialization}`, 6);
            }
            if (fact.profileProperties.specializations) {
              addPersonSummaryLine(lineMap, `specializes in ${fact.profileProperties.specializations}`, 6);
            }
            if (fact.profileProperties.college) {
              addPersonSummaryLine(lineMap, `is affiliated with ${fact.profileProperties.college}`, 8);
            }
            if (fact.profileProperties.faculty) {
              addPersonSummaryLine(lineMap, `is affiliated with ${fact.profileProperties.faculty}`, 8);
            }
            continue;
          }

          if (fact.kind !== "relation") continue;
          const summaryLine = personRelationSummaryLine(fact, group.name);
          if (summaryLine) {
            addPersonSummaryLine(lineMap, summaryLine.text, summaryLine.priority);
          }
        }

        const lines = Array.from(lineMap.values())
          .sort((a, b) => a.priority - b.priority || a.text.localeCompare(b.text))
          .slice(0, MAX_PERSON_SUMMARY_LINES);

        if (lines.length < 1) return null;

        const summaryText = buildNaturalPersonSummaryText(group.name, lines);
        if (!summaryText) return null;

        return {
          text: summaryText,
          kind: "person_summary",
          relType: null,
          label: "Person",
          name: group.name,
          entityName: group.name,
          summaryType: "person_profile",
          sourceFactKeys: group.facts.map(factKey),
          score: group.maxScore,
          baseScore: group.maxBaseScore,
          boostedScore: group.maxScore,
          relationRank: 0
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  function selectPersonProfileFacts(sortedFacts, maxFacts) {
    const summaries = buildPersonSummaryFacts(sortedFacts);
    const profileFacts = sortedFacts.filter(fact => fact.kind === "property");
    const relationFacts = sortedFacts.filter(fact => fact.kind === "relation");

    if (summaries.length === 0) {
      return [...profileFacts, ...relationFacts].slice(0, maxFacts);
    }

    const supportingKeys = new Set(summaries.flatMap(summary => summary.sourceFactKeys || []));
    const supportingFacts = sortedFacts.filter(fact => supportingKeys.has(factKey(fact)));
    const remainingFacts = sortedFacts.filter(fact => !supportingKeys.has(factKey(fact)));

    return [...summaries, ...supportingFacts, ...remainingFacts].slice(0, maxFacts);
  }

  function selectTopQualityFacts(facts, intent, limit) {
    const requestedLimit = Number.parseInt(limit, 10) || DEFAULT_CONTEXT_LIMIT;
    const intentCap = MAX_FACTS_BY_INTENT[intent] || MAX_FACTS_BY_INTENT.DEFAULT;
    const maxFacts = Math.max(Math.min(Math.max(requestedLimit, intentCap), intentCap), 1);
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
      return selectPersonProfileFacts(sorted, maxFacts);
    }

    if (intent === "FACILITY") {
      const facilityFacts = sorted.filter(fact => FACILITY_RELATIONS.includes(fact.relType));
      const otherFacts = sorted.filter(fact => !FACILITY_RELATIONS.includes(fact.relType));
      return [...facilityFacts, ...otherFacts].slice(0, maxFacts);
    }

    if (intent === "TRACK") {
      const trackFacts = sorted.filter(fact => TRACK_RELATIONS.includes(fact.relType));
      const otherFacts = sorted.filter(fact => !TRACK_RELATIONS.includes(fact.relType));
      return [...trackFacts, ...otherFacts].slice(0, maxFacts);
    }

    if (intent === "PARTNER_INSTITUTION") {
      const partnerFacts = sorted.filter(fact => PARTNER_RELATIONS.includes(fact.relType));
      const otherFacts = sorted.filter(fact => !PARTNER_RELATIONS.includes(fact.relType));
      return [...partnerFacts, ...otherFacts].slice(0, maxFacts);
    }

    if (intent === "GOVERNANCE") {
      const governanceFacts = sorted.filter(fact => GOVERNANCE_RELATIONS.includes(fact.relType));
      const otherFacts = sorted.filter(fact => !GOVERNANCE_RELATIONS.includes(fact.relType));
      return [...governanceFacts, ...otherFacts].slice(0, maxFacts);
    }

    if (intent === "POLICY") {
      const policyFacts = sorted.filter(fact => POLICY_RELATIONS.includes(fact.relType));
      const otherFacts = sorted.filter(fact => !POLICY_RELATIONS.includes(fact.relType));
      return [...policyFacts, ...otherFacts].slice(0, maxFacts);
    }

    if (intent === "CAMPUS") {
      const campusFacts = sorted.filter(fact => CAMPUS_RELATIONS.includes(fact.relType));
      const otherFacts = sorted.filter(fact => !CAMPUS_RELATIONS.includes(fact.relType));
      return [...campusFacts, ...otherFacts].slice(0, maxFacts);
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

    const personSummaries = facts.filter(fact => fact?.kind === "person_summary" && fact.text);
    if (personSummaries.length > 0) {
      const coveredKeys = new Set(personSummaries.flatMap(summary => summary.sourceFactKeys || []));
      const remainingNonPersonFacts = facts
        .filter(fact => fact?.kind !== "person_summary")
        .filter(fact => !coveredKeys.has(factKey(fact)))
        .filter(fact => !getPersonNameForFact(fact))
        .map(fact => fact.text)
        .filter(Boolean);

      return [
        ...personSummaries.map(summary => summary.text),
        ...remainingNonPersonFacts
      ].join("\n");
    }

    const personFactCount = facts.filter(fact => getPersonNameForFact(fact)).length;
    if (personFactCount > 0) {
      const groupedSummaries = buildPersonSummaryFacts(facts);
      if (groupedSummaries.length > 0) {
        const coveredKeys = new Set(groupedSummaries.flatMap(summary => summary.sourceFactKeys || []));
        const remainingFacts = facts
          .filter(fact => !coveredKeys.has(factKey(fact)))
          .filter(fact => !getPersonNameForFact(fact))
          .map(fact => fact.text)
          .filter(Boolean);

        return [
          ...groupedSummaries.map(summary => summary.text),
          ...remainingFacts
        ].join("\n");
      }
    }

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

  function buildGraphResponse(answer, confidence, facts, isDeterministicKG = false, reformatted = false, metadata = {}) {
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
      },
      deterministic: {
        value: isDeterministicKG,
        enumerable: false
      },
      llm_bypassed: {
        value: isDeterministicKG,
        enumerable: false
      },
      reformatted: {
        value: reformatted,
        enumerable: false
      },
      metadata: {
        value: metadata,
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
    const thresholds = getRetrievalThresholds(queryPlan.intent);
    let usedThreshold = thresholds[0];
    let usedIndexName = queryPlan.indexNames[0];

    for (const indexName of queryPlan.indexNames) {
      for (const threshold of thresholds) {
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

  export async function fetchNeo4jContext(query, intent = "ALL", limit = DEFAULT_CONTEXT_LIMIT, requestId = "none", lastMessages = "", options = {}) {
    const stopQueryTimer = startTimer();
    incrementMetric("retrieval.query_total");

    const session = getSession();
    const skipGraphRefinementForUnifiedSynthesis = options?.skipGraphRefinementForUnifiedSynthesis === true;
    const queryExpansion = expandAcademicQuery(query);
    const exactOntologyEntity = queryExpansion.exact_entity || null;
    const retrievalQuery = exactOntologyEntity?.search_text || queryExpansion.expanded || query;
    const normalizedRequestedIntent = normalizeIntentKeyword(intent);
    const requestedOntologyIntent = ONTOLOGY_INTENTS.has(normalizedRequestedIntent)
      ? normalizedRequestedIntent
      : null;
    const requestedProtectedIntent = ["TEACHING", "PREREQUISITE", "ADMIN", "PERSON"].includes(normalizedRequestedIntent)
      ? normalizedRequestedIntent
      : null;
    const detectedIntent =
      requestedOntologyIntent ||
      requestedProtectedIntent ||
      exactOntologyEntity?.intent ||
      detectIntent(retrievalQuery, intent);
    const normalizedRetrievalQuery = normalizeText(retrievalQuery);
    const requestedLimit = Math.max(Number.parseInt(limit, 10) || DEFAULT_CONTEXT_LIMIT, 1);
    const personRecallBoost = detectedIntent === "PERSON" && /\b(who is|tell me about|doctor|professor|dr|dean|office|room|location|specializes|specialization)\b/.test(normalizeText(retrievalQuery));
    const effectiveLimit = personRecallBoost ? Math.max(requestedLimit, DEFAULT_CONTEXT_LIMIT) : requestedLimit;

    const deterministicIntents = ["TEACHING", "PREREQUISITE", "ADMIN", "PERSON", ...ONTOLOGY_INTENTS];
    const isDeterministicKG = deterministicIntents.includes(detectedIntent);

    const keywordParams = buildKeywordParams(retrievalQuery);
    const { keywords, contentKeywords } = keywordParams;
    const resultLimit = Math.max(effectiveLimit * 3, 8);
    const searchLimit = Math.max(resultLimit * 3, 25);

    logger.info("Neo4j retrieval started", {
      requestId,
      intent: detectedIntent,
      vectorIndex: getVectorIndex(detectedIntent),
      keywords,
      contentKeywords,
      ontologyExpansions: queryExpansion.expansions?.map(expansion => expansion.category) || []
    });

    try {
      if (detectedIntent === "CURRICULUM") {
        const curriculumQuery = queryExpansion.normalized || query;
        const curriculumTopic = extractCurriculumTopic(curriculumQuery);
        const curriculumCourse = extractCurriculumCourseName(curriculumQuery);
        const curriculumWeek = extractCurriculumWeek(curriculumQuery);
        const curriculumRecords = await runRetrieval(session, buildCurriculumCypher(searchLimit, resultLimit), {
          courseName: curriculumCourse,
          topicName: curriculumTopic?.topic || "",
          weekNumber: curriculumWeek
        });
        const curriculumResult = buildCurriculumAnswer(curriculumQuery, curriculumRecords);

        logger.info("Neo4j deterministic curriculum retrieval completed", {
          requestId,
          recordsCount: curriculumRecords.length,
          selectedFactsCount: curriculumResult.facts.length,
          matchedCourse: curriculumResult.metadata.matched_course || curriculumCourse || null,
          matchedWeek: curriculumResult.metadata.matched_week ?? curriculumWeek,
          matchedTopic: curriculumResult.metadata.matched_topic || curriculumTopic?.display || null
        });

        incrementMetric("knowledge_graph.curriculum_deterministic_bypass");
        return buildGraphResponse(curriculumResult.answer, curriculumResult.confidence, curriculumResult.facts, true, false, {
          ...curriculumResult.metadata,
          keyword_count: keywords.length,
          content_keyword_count: contentKeywords.length,
          ontology_expansions: queryExpansion.expansions || [],
          exact_entity: exactOntologyEntity,
          requested_limit: requestedLimit,
          effective_limit: effectiveLimit,
          graph_refinement_skipped: true
        });
      }

      const aggregationCypher = isOntologyAggregationQuery(normalizedRetrievalQuery, detectedIntent, exactOntologyEntity)
        ? buildAggregationCypher(detectedIntent, resultLimit)
        : null;

      if (aggregationCypher) {
        const records = await runRetrieval(session, aggregationCypher, keywordParams);
        const facts = records.map(formatRecordFact);
        const selectedFacts = selectTopQualityFacts(facts, detectedIntent, effectiveLimit);
        const confidence = selectedFacts[0]?.baseScore || selectedFacts[0]?.score || 0;

        logger.info("Neo4j deterministic aggregation completed", {
          requestId,
          intent: detectedIntent,
          resultsCount: records.length,
          selectedFactsCount: selectedFacts.length
        });

        if (selectedFacts.length > 0) {
          const answer = synthesizeAnswer(selectedFacts);
          incrementMetric("knowledge_graph.deterministic_bypass");

          return buildGraphResponse(answer, confidence, selectedFacts, true, false, {
            detected_intent: detectedIntent,
            retrieval_mode: "deterministic_aggregation",
            semantic_fallback_used: false,
            keyword_count: keywords.length,
            content_keyword_count: contentKeywords.length,
            ontology_expansions: queryExpansion.expansions || [],
            exact_entity: exactOntologyEntity,
            requested_limit: requestedLimit,
            effective_limit: effectiveLimit,
            selected_fact_count: selectedFacts.length,
            top_fact_score: selectedFacts[0]?.score || 0,
            top_fact_base_score: selectedFacts[0]?.baseScore || 0,
            graph_refinement_skipped: true
          });
        }
      }

      const conversationContext = normalizeLastMessages(lastMessages);
      const enrichedQuery = `Conversation:
  ${conversationContext}

  User:
  ${retrievalQuery}`;
      const embeddingInput = detectedIntent === "GENERAL" ? enrichedQuery : retrievalQuery;
      // LG-04: embedding is the KG path's hidden hard dependency (nomic-embed-text).
      // Log its outcome per request so a cold/absent embed model is attributable.
      const embedStart = Date.now();
      const vector = await embed(embeddingInput, requestId);
      console.log(`[KG_EMBED][${requestId}] intent=${detectedIntent} ok=true durationMs=${Date.now() - embedStart} model=nomic-embed-text`);

      const baseParams = {
        vector,
        ...keywordParams
      };

      const primaryPlan = buildQueryPlan(detectedIntent, searchLimit, resultLimit);
      let { records, usedThreshold, usedIndexName } = await retrieveWithThresholds(session, primaryPlan, baseParams);
      let semanticFallbackUsed = false;

      if (
        records.length === 0 &&
        !exactOntologyEntity &&
        !["GENERAL", "TEACHING"].includes(detectedIntent) &&
        !ONTOLOGY_INTENTS.has(detectedIntent)
      ) {
        semanticFallbackUsed = true;
        incrementMetric("retrieval.semantic_fallback");
        // Use intent-scoped fallback: PERSON queries stay within person indexes to prevent course/program contamination
        const fallbackIntent = detectedIntent === "PERSON" ? "PERSON" : "GENERAL";
        const fallbackPlan = buildQueryPlan(fallbackIntent, searchLimit, resultLimit);
        ({ records, usedThreshold, usedIndexName } = await retrieveWithThresholds(session, fallbackPlan, baseParams));
      }

      const facts = records.map(formatRecordFact);
      const goodFacts = getGoodFacts(facts, detectedIntent);
      const selectedFacts = selectTopQualityFacts(goodFacts, detectedIntent, effectiveLimit);
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
        // LG-05: distinguishes "graph genuinely has no data" from "retrieval
        // failed upstream" when the same query intermittently returns empty.
        console.warn(
          `[KG_EMPTY][${requestId}] intent=${detectedIntent} rawRecords=${records.length} ` +
          `threshold=${usedThreshold} index=${usedIndexName} semFallback=${semanticFallbackUsed} reason=NO_SELECTED_FACTS`
        );
        return buildGraphResponse(NO_RESULT_MESSAGE, 0, [], isDeterministicKG, false, {
          detected_intent: detectedIntent,
          retrieval_threshold: usedThreshold,
          vector_index: usedIndexName,
          semantic_fallback_used: semanticFallbackUsed,
          keyword_count: keywords.length,
          content_keyword_count: contentKeywords.length,
          ontology_expansions: queryExpansion.expansions || [],
          exact_entity: exactOntologyEntity,
          requested_limit: requestedLimit,
          effective_limit: effectiveLimit,
          selected_fact_count: 0,
          failure_reason: "NO_SELECTED_FACTS"
        });
      }

      let answer;
      let reformatted = false;
      let graphRefinementSkipped = false;
      if (isDeterministicKG) {
        const deterministicBaseAnswer = synthesizeAnswer(selectedFacts);

        answer = deterministicBaseAnswer;
        reformatted = false;

        logger.info("[PHASE5_1] Deterministic KG synthesized without LLM", {
          requestId,
          detectedIntent,
          llm_bypassed: true,
          reformatted,
          factsUsed: selectedFacts.length
        });

        incrementMetric("knowledge_graph.deterministic_bypass");
      } else {
        if (skipGraphRefinementForUnifiedSynthesis) {
          graphRefinementSkipped = true;
          answer = synthesizeAnswer(selectedFacts);
          console.log(`[GRAPH_REFINEMENT_SKIPPED][${requestId}] intent=${detectedIntent} facts=${selectedFacts.length}`);
          console.log(`[SINGLE_SYNTHESIS_MODE][${requestId}] graph_refinement=skipped unified_synthesis=active`);
          logger.info("[GRAPH_REFINEMENT_SKIPPED]", {
            requestId,
            detectedIntent,
            reason: "unified_synthesis_active",
            singleSynthesisMode: true,
            factsUsed: selectedFacts.length
          });
          incrementMetric("knowledge_graph.refinement_skipped_for_unified_synthesis");
        } else {
          const refinedAnswer = await refineAnswerWithLocalLLM(selectedFacts, query);
          answer = refinedAnswer || synthesizeAnswer(selectedFacts);
        }
      }

      return buildGraphResponse(answer, confidence, selectedFacts, isDeterministicKG, reformatted, {
        detected_intent: detectedIntent,
        retrieval_threshold: usedThreshold,
        vector_index: usedIndexName,
        semantic_fallback_used: semanticFallbackUsed,
        keyword_count: keywords.length,
        content_keyword_count: contentKeywords.length,
        ontology_expansions: queryExpansion.expansions || [],
        exact_entity: exactOntologyEntity,
        requested_limit: requestedLimit,
        effective_limit: effectiveLimit,
        selected_fact_count: selectedFacts.length,
        top_fact_score: selectedFacts[0]?.score || 0,
        top_fact_base_score: selectedFacts[0]?.baseScore || 0,
        graph_refinement_skipped: graphRefinementSkipped
      });
    } catch (err) {
      incrementMetric("retrieval.error");
      logger.error("Neo4j context error", {
        requestId,
        error: err
      });
      // LG-05 companion: exception-path empties are distinct from no-data empties.
      console.warn(`[KG_EXCEPTION][${requestId}] intent=${detectedIntent} error="${err.message}" -> empty graph response`);
      return buildGraphResponse(NO_RESULT_MESSAGE, 0, [], false, false, {
        detected_intent: detectedIntent,
        failure_reason: "KG_EXCEPTION",
        error: err.message
      });
    } finally {
      recordDuration("query.latency_ms", stopQueryTimer());
      await session.close();
    }
  }

  export function convertToGraphData(neo4jResults) {
    const nodesMap = new Map();
    const links = [];
    const results = Array.isArray(neo4jResults) ? neo4jResults : neo4jResults?.facts || [];
    const linkKeys = new Set();

    const buildNode = (id, type, properties = {}, group = 1) => ({
      id,
      label: id,
      type: type || "Entity",
      properties: properties && typeof properties === "object" ? properties : {},
      group
    });

    const upsertNode = (id, type, properties = {}, group = 1) => {
      if (!id) return;
      const existing = nodesMap.get(id);
      nodesMap.set(id, {
        ...(existing || {}),
        ...buildNode(id, type, properties, group)
      });
    };

    const addLink = (source, target, type) => {
      if (!source || !target) return;
      const relType = type || "RELATED_TO";
      const key = `${source}::${relType}::${target}`;
      if (linkKeys.has(key)) return;
      linkKeys.add(key);
      links.push({
        source,
        target,
        type: relType
      });
    };

    for (const item of results) {
      if (item?.graph?.source && item?.graph?.target) {
        upsertNode(item.graph.source, item.graph.sourceLabel, item.graph.sourceProperties, 1);
        upsertNode(item.graph.target, item.graph.targetLabel, item.graph.targetProperties, 2);
        addLink(item.graph.source, item.graph.target, item.graph.type);
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

      upsertNode(sourceName, sourceLabel, {}, 1);
      upsertNode(targetName, targetLabel, {}, 2);
      addLink(sourceName, targetName, relType);
    }

    return {
      nodes: Array.from(nodesMap.values()),
      links
    };
  }
