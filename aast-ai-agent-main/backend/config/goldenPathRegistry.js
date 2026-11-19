const ROUTES = Object.freeze({
  KG_DIRECT: "KG_DIRECT",
  RAG_DIRECT: "RAG_DIRECT",
  HYBRID_KG_RAG: "HYBRID_KG_RAG",
  DECISION_ENGINE: "DECISION_ENGINE",
  CAREER_ENGINE: "CAREER_ENGINE",
  FAQ: "FAQ",
  LLM_FALLBACK: "LLM_FALLBACK",
});

export const ROUTE_PRIORITY = Object.freeze({
  KG_DIRECT: 100,
  DIRECT_NEO4J: 100,
  RAG_DIRECT: 90,
  DETERMINISTIC_HYBRID: 80,
  HYBRID_KG_RAG: 80,
  RULE_ENGINE: 70,
  DECISION_ENGINE: 70,
  CAREER_ENGINE: 68,
  FAQ: 45,
  LLM_FALLBACK: 5,
});

export const QUERY_CATEGORY_TABLE = Object.freeze({
  faculty_profile: {
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    description: "Named professor or staff profile lookup.",
  },
  faculty_teaching: {
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    description: "Professor-course TEACHES relationship lookup.",
  },
  leadership_role: {
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    description: "Dean, vice dean, head, director, or quality-unit role lookup.",
  },
  course_prerequisites: {
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    description: "Course dependency and prerequisite graph lookup.",
  },
  program_modules: {
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    description: "Major, module, curriculum, track, or course-list lookup.",
  },
  admissions_policy: {
    route: ROUTES.RAG_DIRECT,
    execution: "RAG_DIRECT",
    description: "Official requirements and policy documentation lookup.",
  },
  deterministic_hybrid: {
    route: ROUTES.HYBRID_KG_RAG,
    execution: "DETERMINISTIC_HYBRID",
    description: "Structured KG facts plus policy context with no LLM-first chain.",
  },
  major_comparison: {
    route: ROUTES.DECISION_ENGINE,
    execution: "RULE_ENGINE",
    description: "Rule-based comparison or what-if major analysis.",
  },
  major_recommendation: {
    route: ROUTES.DECISION_ENGINE,
    execution: "RULE_ENGINE",
    description: "Decision-engine recommendation with profile pre-validation.",
  },
  career_roadmap: {
    route: ROUTES.CAREER_ENGINE,
    execution: "RULE_ENGINE",
    description: "Career roadmap generated from deterministic career rules.",
  },
});

export const ENTITY_PRIORITY_TABLE = Object.freeze([
  {
    entity_type: "professor",
    priority: 100,
    route: ROUTES.KG_DIRECT,
    examples: ["hany hanafy", "osama badawy", "amira elsaid"],
  },
  {
    entity_type: "course",
    priority: 96,
    route: ROUTES.KG_DIRECT,
    examples: ["natural language processing", "machine learning", "blockchain"],
  },
  {
    entity_type: "role",
    priority: 94,
    route: ROUTES.KG_DIRECT,
    examples: ["dean", "vice dean", "head of quality unit", "department head"],
  },
  {
    entity_type: "department",
    priority: 90,
    route: ROUTES.KG_DIRECT,
    examples: ["college of artificial intelligence", "college of computing"],
  },
  {
    entity_type: "major",
    priority: 86,
    route: ROUTES.KG_DIRECT,
    examples: ["artificial intelligence", "cybersecurity", "intelligent systems"],
  },
  {
    entity_type: "policy",
    priority: 76,
    route: ROUTES.RAG_DIRECT,
    examples: ["admissions", "quality assurance", "scholarship", "GPA"],
  },
]);

function graphFact(source, relType, target, sourceType = "Person", targetType = "Course") {
  return {
    nodes: [
      { id: source, label: source, type: sourceType, properties: {}, group: 1 },
      { id: target, label: target, type: targetType, properties: {}, group: 2 },
    ],
    links: [{ source, target, type: relType }],
  };
}

const FALLBACKS = Object.freeze({
  hanyProfile: {
    answer: "Hany Hanafy Mahmoud Said teaches the Natural Language Processing course.",
    confidence: 0.92,
    facts: ["Hany Hanafy Mahmoud Said teaches the Natural Language Processing course."],
    graph: graphFact("Hany Hanafy Mahmoud Said", "TEACHES", "Natural Language Processing"),
  },
  aiDean: {
    answer: "Ali Ali Mohamed Fahmy is the Dean of the College of Artificial Intelligence.",
    confidence: 0.9,
    facts: ["Ali Ali Mohamed Fahmy is the Dean of the College of Artificial Intelligence."],
    graph: graphFact(
      "Ali Ali Mohamed Fahmy",
      "DEAN_OF",
      "College of Artificial Intelligence",
      "Person",
      "College"
    ),
  },
  aiModules: {
    answer:
      "The AI-focused curriculum path highlights intelligent systems topics such as Machine Learning, Natural Language Processing, Computer Vision, Robotics, Embedded AI, Cognitive Systems, and Explainable AI.",
    confidence: 0.82,
    facts: [
      "Intelligent Systems includes the Machine Learning course.",
      "AI specializations include Natural Language Processing, Computer Vision, Robotics, Embedded AI, Cognitive Systems, and Explainable AI.",
    ],
    graph: graphFact("Intelligent Systems", "HAS_COURSE", "Machine Learning", "Major", "Course"),
  },
  qualityFallback: {
    answer:
      "The query is locked to the academic leadership Knowledge Graph path. CAI quality assurance content is available, and the live graph is the authoritative source for the named head or responsible role.",
    confidence: 0.74,
    facts: [
      "CAI regularly undergoes internal and external evaluations to ensure quality standards.",
      "Leadership and quality-unit lookups are routed directly to the Knowledge Graph.",
    ],
    graph: graphFact("College of Artificial Intelligence", "HAS_QUALITY_PROCESS", "Quality Assurance", "College", "Policy"),
  },
  viceDeanFallback: {
    answer:
      "The vice-dean lookup is locked to the academic leadership Knowledge Graph path. The live graph is the authoritative source for the named vice dean and role relationship.",
    confidence: 0.72,
    facts: ["Vice-dean questions are routed directly to the Knowledge Graph leadership-role path."],
    graph: graphFact("Vice Dean", "ADMINISTERS", "College of Artificial Intelligence", "Role", "College"),
  },
  prerequisiteFallback: {
    answer:
      "Prerequisite questions are locked to the Knowledge Graph course-dependency path. For an exact course, the graph returns the HAS_PREREQUISITE relationships and supporting course nodes.",
    confidence: 0.76,
    facts: ["Course prerequisites are represented as Knowledge Graph HAS_PREREQUISITE relationships."],
    graph: graphFact("Requested Course", "HAS_PREREQUISITE", "Prerequisite Course", "Course", "Course"),
  },
  careerAi: {
    answer:
      "For an AI career roadmap: build Python and math foundations, move into machine learning and neural networks, add data engineering and model evaluation, then specialize toward AI Engineer, Data Scientist, or Systems Architect roles.",
    confidence: 0.86,
    facts: [
      "AI career preparation emphasizes Python, Machine Learning, Neural Networks, and Data Engineering.",
      "Common AI target roles include AI Engineer, Data Scientist, and Systems Architect.",
    ],
    graph: graphFact("Artificial Intelligence", "LEADS_TO", "AI Engineer", "Major", "CareerRole"),
  },
});

export const GOLDEN_PATH_REGISTRY = Object.freeze([
  {
    id: "golden_dean_program_offerings",
    priority: 100,
    category: "program_modules",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "PROGRAM",
    cacheable: true,
    timeoutMs: 8000,
    entityTypes: ["college", "degree", "program"],
    entities: ["College of Artificial Intelligence", "Bachelor of Science"],
    patterns: [
      /^(?=.*\bprograms?\b)(?=.*\b(?:bachelor|bsc)\b)(?=.*\bcollege of artificial intelligence\b).*$/i,
    ],
    variants: [
      "Which bachelor's programs does the College of Artificial Intelligence offer at El Alamein?",
      "What two programs are included in the Bachelor of Science offered by the College of Artificial Intelligence at El Alamein?",
    ],
  },
  {
    id: "golden_dean_program_comparison",
    priority: 100,
    category: "program_modules",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "COMPARE",
    cacheable: true,
    timeoutMs: 8000,
    entityTypes: ["program", "course"],
    entities: ["Intelligent Systems", "Data Science"],
    patterns: [
      /^(?=.*\b(?:compare|comparison|difference)\b)(?=.*\bintelligent systems\b)(?=.*\bdata science\b).*$/i,
    ],
    variants: [
      "Compare Intelligent Systems and Data Science.",
      "Compare Intelligent Systems with Data Science for a student choosing between building AI systems and working deeply with data.",
    ],
  },
  {
    id: "golden_dean_program_careers",
    priority: 100,
    category: "program_modules",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "PROGRAM",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["program", "career"],
    entities: ["program career roles"],
    patterns: [
      /^(?=.*\b(?:career|careers|jobs?|roles?)\b)(?=.*\b(?:intelligent systems|data science)\b).*$/i,
    ],
    variants: [
      "What career roles can the Intelligent Systems program lead to?",
      "What career roles can the Data Science program lead to?",
    ],
  },
  {
    id: "golden_dean_machine_learning_membership",
    priority: 100,
    category: "program_modules",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "PROGRAM",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["program", "course"],
    entities: ["Intelligent Systems", "Machine Learning"],
    patterns: [
      /^(?=.*\bmachine learning\b)(?=.*\b(?:which program|program includes|course code|credits?|credit value)\b).*$/i,
      /^(?=.*\bmachine learning\b)(?=.*\bintelligent systems\b)(?=.*\bdata science\b)(?=.*\b(?:which|include|includes)\b).*$/i,
    ],
    variants: [
      "Which program includes Machine Learning, and what are its course code and credits?",
      "Does Intelligent Systems include Machine Learning? Give me the course code and credit value.",
    ],
  },
  {
    id: "golden_dean_course_sequence",
    priority: 100,
    category: "course_prerequisites",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "PROGRAM",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["course", "program"],
    entities: ["course sequence"],
    patterns: [
      /^(?=.*\b(?:recommended after|comes after|take after)\b)(?=.*\b(?:machine learning|natural language processing)\b).*$/i,
    ],
    variants: [
      "Which course is recommended after Machine Learning for language technology?",
      "Which course is recommended after Natural Language Processing?",
    ],
  },
  {
    id: "golden_dean_course_career_alignment",
    priority: 100,
    category: "program_modules",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "PROGRAM",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["course", "career"],
    entities: ["course career alignment"],
    patterns: [
      /^(?=.*\bcareer role\b)(?=.*\b(?:natural language processing|cognitive computing)\b).*$/i,
    ],
    variants: [
      "Which career role is Natural Language Processing aligned with?",
      "Which career role is Cognitive Computing aligned with?",
    ],
  },
  {
    id: "golden_dean_hany_role",
    priority: 100,
    category: "leadership_role",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "ADMIN",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["professor", "role", "unit"],
    entities: ["Hany Hanafy Mahmoud Said", "Quality Unit"],
    patterns: [
      /^(?=.*\bhany hanafy(?: mahmoud said)?\b)(?=.*\b(?:other role|another role|hold.*role|quality unit)\b).*$/i,
    ],
    variants: [
      "What other role does Hany Hanafy Mahmoud Said hold at the college?",
      "Does Hany Hanafy Mahmoud Said hold another role at the college?",
    ],
  },
  {
    id: "golden_dean_ali_role",
    priority: 100,
    category: "leadership_role",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "ADMIN",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["person", "role", "college"],
    entities: ["Ali Ali Mohamed Fahmy", "College of Artificial Intelligence"],
    patterns: [
      /^(?=.*\bali ali mohamed fahmy\b)(?=.*\bdean\b)(?=.*\bcollege of artificial intelligence\b).*$/i,
    ],
    variants: [
      "Is Ali Ali Mohamed Fahmy the dean of the College of Artificial Intelligence?",
    ],
  },
  {
    id: "golden_hany_profile",
    priority: 100,
    category: "faculty_profile",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "PERSON",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["professor", "course"],
    entities: ["hany hanafy", "natural language processing"],
    patterns: [
      /\bwho\s+is\s+(?:dr\s+|doctor\s+|prof(?:essor)?\s+)?hany(?:\s+hanaf[yi])?(?:\s+mahmoud\s+said)?\b/i,
      /\b(?:dr|doctor|prof(?:essor)?)\s+hany(?:\s+hanaf[yi])?(?:\s+mahmoud\s+said)?\b/i,
      /^hany\s+hanaf[yi](?:\s+mahmoud\s+said)?$/i,
    ],
    variants: ["Who is Hany Hanafy?", "dr hany", "who is professor hany"],
    fallback: FALLBACKS.hanyProfile,
  },
  {
    id: "golden_hany_teaches",
    priority: 100,
    category: "faculty_teaching",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "TEACHING",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["professor", "course"],
    entities: ["hany hanafy", "natural language processing"],
    patterns: [
      /\bwhat\s+does\s+(?:dr\s+|doctor\s+|prof(?:essor)?\s+)?hany(?:\s+hanaf[yi])?(?:\s+mahmoud\s+said)?\s+teach\b/i,
      /\bwho\s+teaches\s+(?:nlp|natural language processing)\b/i,
    ],
    variants: ["What does Hany Hanafy teach?", "who teaches NLP"],
    fallback: FALLBACKS.hanyProfile,
  },
  {
    id: "golden_head_quality_unit",
    priority: 97,
    category: "leadership_role",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "ADMIN",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["role", "department", "policy"],
    entities: ["quality unit", "quality assurance"],
    patterns: [
      /\bwho\s+is\s+(?:the\s+)?head\s+of\s+(?:the\s+)?quality\s+unit\b/i,
      /\b(?:quality\s+unit|quality assurance).*\b(head|director|responsible|leader)\b/i,
    ],
    variants: ["Who is head of quality unit?", "quality unit head"],
    fallback: FALLBACKS.qualityFallback,
  },
  {
    id: "golden_ai_prerequisites",
    priority: 96,
    category: "course_prerequisites",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "PREREQUISITE",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["course", "major"],
    entities: ["artificial intelligence", "prerequisites"],
    patterns: [
      /\b(?:what\s+are\s+)?(?:ai|artificial intelligence).*\b(prerequisite|prerequisites|prereq|requirements)\b/i,
      /\b(prerequisite|prerequisites|prereq|requirements).*\b(?:ai|artificial intelligence)\b/i,
    ],
    variants: ["What are AI prerequisites?", "AI prereqs"],
    fallback: FALLBACKS.prerequisiteFallback,
  },
  {
    id: "golden_ai_vs_cybersecurity",
    priority: 94,
    category: "major_comparison",
    route: ROUTES.DECISION_ENGINE,
    execution: "RULE_ENGINE",
    intent: "COMPARISON",
    cacheable: false,
    timeoutMs: 2600,
    entityTypes: ["major"],
    entities: ["Artificial Intelligence", "Cybersecurity"],
    patterns: [
      /\b(compare|comparison|difference|vs|versus)\b.*\b(?:ai|artificial intelligence)\b.*\b(?:cyber\s*security|cybersecurity)\b/i,
      /\b(?:ai|artificial intelligence)\b.*\b(compare|comparison|difference|vs|versus)\b.*\b(?:cyber\s*security|cybersecurity)\b/i,
      /\b(?:cyber\s*security|cybersecurity)\b.*\b(compare|comparison|difference|vs|versus)\b.*\b(?:ai|artificial intelligence)\b/i,
    ],
    variants: ["Compare AI vs Cybersecurity", "AI versus cyber security"],
  },
  {
    id: "golden_best_major",
    priority: 92,
    category: "major_recommendation",
    route: ROUTES.DECISION_ENGINE,
    execution: "RULE_ENGINE",
    intent: "RECOMMEND",
    cacheable: false,
    timeoutMs: 2800,
    entityTypes: ["major", "profile"],
    entities: ["major recommendation"],
    patterns: [
      /\b(recommend|best major|which major|what major|choose a major|help me decide)\b/i,
    ],
    variants: ["Recommend best major", "Which major should I choose?"],
  },
  {
    id: "golden_ai_career_roadmap",
    priority: 91,
    category: "career_roadmap",
    route: ROUTES.CAREER_ENGINE,
    execution: "RULE_ENGINE",
    intent: "CAREER_PATH_DETAIL",
    cacheable: true,
    timeoutMs: 2200,
    entityTypes: ["major", "career"],
    entities: ["artificial intelligence", "ai career"],
    patterns: [
      /\b(career\s+roadmap|roadmap|career\s+path|how\s+do\s+i\s+become|jobs?)\b.*\b(?:ai|artificial intelligence|machine learning)\b/i,
      /\b(?:ai|artificial intelligence|machine learning)\b.*\b(career\s+roadmap|roadmap|career\s+path|jobs?)\b/i,
    ],
    variants: ["Career roadmap for AI", "What is the roadmap for a career in AI?"],
    fallback: FALLBACKS.careerAi,
  },
  {
    id: "golden_vice_dean_ai",
    priority: 98,
    category: "leadership_role",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "ADMIN",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["role", "department"],
    entities: ["vice dean", "college of artificial intelligence"],
    patterns: [
      /\bwho\s+is\s+(?:the\s+)?vice\s+dean\s+of\s+(?:the\s+)?(?:ai|artificial intelligence|college of artificial intelligence)\b/i,
      /\bvice\s+dean\s+(?:of\s+)?(?:ai|artificial intelligence|college of artificial intelligence)\b/i,
      /\b(?:ai|artificial intelligence)\s+vice\s+dean\b/i,
    ],
    variants: ["Who is vice dean of AI?", "vice dean ai"],
    fallback: FALLBACKS.viceDeanFallback,
  },
  {
    id: "golden_dean_department",
    priority: 95,
    category: "leadership_role",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "ADMIN",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["role", "department"],
    entities: ["dean"],
    patterns: [
      /\bwho\s+is\s+(?:the\s+)?dean\s+of\s+(?:the\s+)?(?:ai|artificial intelligence|college|faculty|department|computing|computer science)\b/i,
      /\bdean\s+(?:of\s+)?(?:ai|artificial intelligence|computing|computer science|department|faculty|college)\b/i,
    ],
    variants: ["Dean of AI department", "Who is dean of artificial intelligence?"],
    fallback: FALLBACKS.aiDean,
  },
  {
    id: "golden_modules_major",
    priority: 93,
    category: "program_modules",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "PROGRAM",
    cacheable: true,
    timeoutMs: 2500,
    entityTypes: ["major", "course"],
    entities: ["modules", "major"],
    patterns: [
      /\b(modules|courses|subjects|curriculum|study plan)\b.*\b(?:in|for|of)\s+(?:ai|artificial intelligence|intelligent systems|data science|cybersecurity|computer science)\b/i,
      /\b(?:ai|artificial intelligence|intelligent systems|data science|cybersecurity|computer science)\b.*\b(modules|courses|subjects|curriculum|study plan)\b/i,
    ],
    variants: ["Modules in AI major", "What courses are in Artificial Intelligence?"],
    fallback: FALLBACKS.aiModules,
  },
  {
    id: "golden_course_prerequisites",
    priority: 98,
    category: "course_prerequisites",
    route: ROUTES.KG_DIRECT,
    execution: "DIRECT_NEO4J",
    intent: "PREREQUISITE",
    cacheable: true,
    timeoutMs: 2400,
    entityTypes: ["course"],
    entities: ["prerequisites"],
    patterns: [
      /\b(prerequisite|prerequisites|prereq|requirements|required before|before taking)\b.*\b(?:ai|artificial intelligence)\s*\d{3,4}\b/i,
      /\b(?:ai|artificial intelligence)\s*\d{3,4}\b.*\b(prerequisite|prerequisites|prereq|requirements|required before|before taking)\b/i,
      /\b(prerequisite|prerequisites|prereq|requirements|required before|before taking)\b.*\b[A-Za-z]{2,5}\s*\d{3,4}\b/i,
      /\b[A-Za-z]{2,5}\s*\d{3,4}\b.*\b(prerequisite|prerequisites|prereq|requirements|required before|before taking)\b/i,
      /\b(prerequisite|prerequisites|prereq|requirements|required before|before taking)\b.*\b(machine learning|blockchain|natural language processing|mobile computing|data structures|database systems)\b/i,
      /\b(machine learning|blockchain|natural language processing|mobile computing|data structures|database systems)\b.*\b(prerequisite|prerequisites|prereq|requirements|required before|before taking)\b/i,
    ],
    variants: ["Prerequisites for AI 301", "Machine Learning prerequisites"],
    fallback: FALLBACKS.prerequisiteFallback,
  },
]);

function normalizeForGoldenPath(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(?:a\.?i\.?|ai)\b/g, "artificial intelligence")
    .replace(/\bcyber\s+security\b/g, "cybersecurity")
    .replace(/[^a-z0-9+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyGoldenQuery(query) {
  const normalized = normalizeForGoldenPath(query);
  if (!normalized) return null;

  const candidates = GOLDEN_PATH_REGISTRY
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(normalized)))
    .sort((a, b) => b.priority - a.priority);

  const match = candidates[0];
  if (!match) return null;

  return {
    id: match.id,
    priority: match.priority,
    category: match.category,
    route: match.route,
    execution: match.execution,
    intent: match.intent,
    cacheable: match.cacheable !== false,
    timeoutMs: match.timeoutMs || 2500,
    entity_types: match.entityTypes || [],
    entities: match.entities || [],
    variants: match.variants || [],
    fallback: match.fallback || null,
    confidence: Math.min(0.99, 0.84 + match.priority / 1000),
    registry_version: "phase3-golden-path-v1",
  };
}

export function extractGoldenEntities(match, query = "") {
  if (!match) return [];
  if (match.id === "golden_ai_vs_cybersecurity") {
    return ["Artificial Intelligence", "Cybersecurity"];
  }

  if (match.category === "major_comparison") {
    return parseComparisonEntities(query);
  }

  // Registry `entities` may describe a query family (for example
  // "program career roles") rather than an institutional entity. Prefer exact
  // identities actually named in this question so descriptive placeholders
  // never enter typed conversation memory or later golden matching.
  const exactEntities = resolveExactEntities(query)
    .map(entity => entity.canonical_name)
    .filter(Boolean);
  if (exactEntities.length > 0) {
    return [...new Set(exactEntities)];
  }

  return Array.isArray(match.entities) ? match.entities : [];
}

export function parseComparisonEntities(query = "") {
  const normalized = normalizeForGoldenPath(query);
  const known = [
    ["Artificial Intelligence", /\bartificial intelligence\b/],
    ["Cybersecurity", /\bcybersecurity\b/],
    ["Computer Science", /\bcomputer science\b|\bcs\b/],
    ["Software Engineering", /\bsoftware engineering\b/],
    ["Data Science", /\bdata science\b/],
    ["Mechatronics", /\bmechatronics\b/],
  ];

  const found = [];
  for (const [label, pattern] of known) {
    if (pattern.test(normalized) && !found.includes(label)) {
      found.push(label);
    }
  }

  if (found.length >= 2) return found.slice(0, 2);

  const splitMatch = normalized.match(/compare\s+(.+?)\s+(?:with|and|vs|versus)\s+(.+)/);
  if (splitMatch) {
    return [splitMatch[1], splitMatch[2]]
      .map((value) => value.replace(/\b(major|program|track)\b/g, "").trim())
      .filter(Boolean)
      .slice(0, 2);
  }

  return found;
}

export function buildGoldenFallbackPayload() {
  // A query classifier is routing metadata, not academic evidence. Historical
  // fallback text attached named facts to a successful-looking route even when
  // KG/RAG retrieval had timed out or returned nothing. Keep this compatibility
  // function for existing callers, but make unverified factual fallback
  // construction impossible. Callers must return a truthful evidence gap.
  return null;
}

/* ============================================================
  CLA-WOW-001 — EXACT ENTITY IDENTITY REGISTRY
  Canonical person/course/program identities used to run
  deterministic exact retrieval before semantic search.
  Grounded in aast-ai-agent-main/backend/data/clean_graph.json
  canonical node ids so exact lookups map to live graph nodes.
============================================================ */

export const EXACT_ENTITY_REGISTRY = Object.freeze([
  {
    canonical_id: "CAMPUS_EG_EL_ALAMEIN",
    canonical_name: "El Alamein Campus",
    entity_type: "campus",
    intent: "PROGRAM",
    aliases: ["el alamein", "alamein campus", "el alamein campus"],
    course_code: null,
  },
  {
    canonical_id: "COLLEGE_CAI_EL_ALAMEIN",
    canonical_name: "College of Artificial Intelligence",
    entity_type: "college",
    intent: "PROGRAM",
    aliases: [
      "college of artificial intelligence",
      "artificial intelligence college",
      "ai college",
      "the college",
    ],
    course_code: null,
  },
  {
    canonical_id: "DEGREE_EG_EL_ALAMEIN_CAI_BSC_UNDERGRAD",
    canonical_name: "Bachelor of Science in Artificial Intelligence",
    entity_type: "degree",
    intent: "PROGRAM",
    aliases: [
      "bachelor of science",
      "bachelor's program",
      "bachelor's programs",
      "bachelors program",
      "bachelors programs",
      "bachelor program",
      "bsc programs",
      "bsc program",
      "bsc",
    ],
    course_code: null,
  },
  {
    canonical_id: "PROF_HANY_HANAFY_MAHMOUD_SAID",
    canonical_name: "Hany Hanafy Mahmoud Said",
    entity_type: "professor",
    intent: "PERSON",
    aliases: ["hany", "hany hanafy", "dr hany", "doctor hany", "professor hany", "hany hanafy mahmoud said"],
    course_code: null,
  },
  {
    canonical_id: "PERSON_ALI_ALI_MOHAMED_FAHMY",
    canonical_name: "Ali Ali Mohamed Fahmy",
    entity_type: "person",
    intent: "PERSON",
    aliases: ["ali ali mohamed fahmy", "the dean", "dean of the college"],
    course_code: null,
  },
  {
    canonical_id: "COURSE_NATURAL_LANGUAGE_PROCESSING",
    canonical_name: "Natural Language Processing",
    entity_type: "course",
    intent: "COURSE",
    aliases: ["nlp", "natural language processing"],
    course_code: null,
  },
  {
    canonical_id: "COURSE_IN221",
    canonical_name: "Machine Learning",
    entity_type: "course",
    intent: "COURSE",
    aliases: ["ml", "machine learning"],
    course_code: "IN221",
  },
  {
    canonical_id: "COURSE_COGNITIVE_COMPUTING",
    canonical_name: "Cognitive Computing",
    entity_type: "course",
    intent: "COURSE",
    aliases: ["cognitive computing"],
    course_code: null,
  },
  {
    canonical_id: "COURSE_FUNDAMENTALS_OF_AI",
    canonical_name: "Fundamentals of AI",
    entity_type: "course",
    intent: "COURSE",
    aliases: ["fundamentals of ai", "fundamentals of artificial intelligence"],
    course_code: null,
  },
  {
    canonical_id: "COURSE_LINEAR_ALGEBRA",
    canonical_name: "Linear Algebra",
    entity_type: "course",
    intent: "COURSE",
    aliases: ["linear algebra"],
    course_code: null,
  },
  {
    canonical_id: "COURSE_CALCULUS_I",
    canonical_name: "Calculus I",
    entity_type: "course",
    intent: "COURSE",
    aliases: ["calculus i", "calculus 1", "calculus one"],
    course_code: null,
  },
  {
    canonical_id: "COURSE_CALCULUS_II",
    canonical_name: "Calculus II",
    entity_type: "course",
    intent: "COURSE",
    aliases: ["calculus ii", "calculus 2", "calculus two"],
    course_code: null,
  },
  {
    canonical_id: "COURSE_BLOCK_CHAIN",
    canonical_name: "Block Chain",
    entity_type: "course",
    intent: "COURSE",
    aliases: ["blockchain", "block chain", "block-chain"],
    course_code: null,
  },
  {
    canonical_id: "CAMPUS_EG_EL_ALAMEIN__COLLEGE_CAI_EL_ALAMEIN__PROGRAM_INTELLIGENT_SYSTEMS",
    canonical_name: "Intelligent Systems",
    entity_type: "program",
    intent: "PROGRAM",
    aliases: ["intelligent systems"],
    course_code: null,
  },
  {
    canonical_id: "CAMPUS_EG_EL_ALAMEIN__COLLEGE_CAI_EL_ALAMEIN__PROGRAM_DATA_SCIENCE",
    canonical_name: "Data Science",
    entity_type: "program",
    intent: "PROGRAM",
    aliases: ["data science"],
    course_code: null,
  },
  {
    canonical_id: "UNIT_CAI_EL_ALAMEIN_QUALITY",
    canonical_name: "Quality Unit",
    entity_type: "unit",
    intent: "PERSON",
    aliases: ["quality unit"],
    course_code: null,
  },
]);

function escapeExactSurface(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactSurfacePattern(surface) {
  const parts = String(surface).trim().split(/[\s-]+/).filter(Boolean).map(escapeExactSurface);
  const body = parts.length > 1 ? parts.join("[\\s-]+") : (parts[0] || "");
  // Whole-token / whole-phrase match so short aliases (e.g. "ml") never match
  // inside unrelated words and distinct entities cannot cross-resolve.
  return new RegExp(`(^|[^a-z0-9])(${body})(?=$|[^a-z0-9])`, "i");
}

const EXACT_ENTITY_SURFACE_INDEX = EXACT_ENTITY_REGISTRY
  .flatMap((entity) =>
    [entity.canonical_name, entity.course_code, ...entity.aliases]
      .filter(Boolean)
      .map((surface) => ({ entity, surface, pattern: exactSurfacePattern(surface) }))
  )
  // Longest surface first so the most specific identity wins.
  .sort((a, b) => b.surface.length - a.surface.length);

export function resolveExactEntities(query) {
  const text = String(query || "").toLowerCase();
  if (!text.trim()) return [];

  const resolved = [];
  const seen = new Set();
  for (const candidate of EXACT_ENTITY_SURFACE_INDEX) {
    const match = candidate.pattern.exec(text);
    if (match && !seen.has(candidate.entity.canonical_id)) {
      const entity = candidate.entity;
      seen.add(entity.canonical_id);
      resolved.push({
        canonical_id: entity.canonical_id,
        canonical_name: entity.canonical_name,
        entity_type: entity.entity_type,
        intent: entity.intent,
        aliases: entity.aliases.slice(),
        course_code: entity.course_code,
        matched_surface: candidate.surface,
        matched_index: match.index + match[1].length,
      });
    }
  }

  return resolved.sort((a, b) => a.matched_index - b.matched_index);
}

export function resolveExactEntity(query) {
  return resolveExactEntities(query)[0] || null;
}

export function getGoldenPrewarmQueries() {
  return GOLDEN_PATH_REGISTRY
    .filter((entry) => entry.cacheable !== false)
    .map((entry) => ({
      id: entry.id,
      query: entry.variants?.[0] || entry.entities?.[0] || entry.id,
      route: entry.route,
      category: entry.category,
      priority: entry.priority,
    }));
}

export default {
  ROUTES,
  ROUTE_PRIORITY,
  QUERY_CATEGORY_TABLE,
  ENTITY_PRIORITY_TABLE,
  GOLDEN_PATH_REGISTRY,
  EXACT_ENTITY_REGISTRY,
  classifyGoldenQuery,
  extractGoldenEntities,
  parseComparisonEntities,
  buildGoldenFallbackPayload,
  getGoldenPrewarmQueries,
  resolveExactEntities,
  resolveExactEntity,
};
