const DEMO_GRAPH_TRIGGERS = new Set([
  "show ai program graph",
  "show me ai program graph",
  "ai program graph",
  "display ai graph",
]);

function normalizeDemoGraphQuery(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDemoGraphQuery(query) {
  return DEMO_GRAPH_TRIGGERS.has(normalizeDemoGraphQuery(query));
}

export const demoAiProgramGraph = {
  source: "demo_graph",
  demoMode: true,
  primaryNodeId: "AAST AI Program",
  cypherQuery:
    "MATCH p=(program:Program {name:'AAST AI Program'})-[r*1..2]->(entity) RETURN p",
  metadata: {
    title: "AI Academic Advisor",
    subtitle: "Neo4j Graph Intelligence",
    badge: "Cypher Verified",
    established: "2019",
    degree: "Bachelor of Artificial Intelligence",
  },
  nodes: [
    {
      id: "AAST AI Program",
      label: "Program",
      category: "program",
      role: "Central academic program",
      established: "2019",
      degree: "Bachelor of Artificial Intelligence",
      x: 0,
      y: 0,
    },
    {
      id: "2019",
      label: "Metadata",
      category: "metadata",
      role: "Established year",
      value: "2019",
      x: 230,
      y: -122,
    },
    {
      id: "Bachelor of Artificial Intelligence",
      label: "Metadata",
      category: "metadata",
      role: "Degree",
      value: "Bachelor of Artificial Intelligence",
      x: 250,
      y: -22,
    },
    {
      id: "Ali Ali Fahmy",
      label: "Leadership",
      category: "leadership",
      role: "Dean",
      x: -255,
      y: -138,
    },
    {
      id: "Ahmed Abo Elfarag",
      label: "Leadership",
      category: "leadership",
      role: "Vice Dean",
      x: -248,
      y: -30,
    },
    {
      id: "Hany Hanafy",
      label: "Leadership",
      category: "leadership",
      role: "Head of Quality and Head of Unit",
      x: -242,
      y: 82,
    },
    {
      id: "Data Science Major",
      label: "Major",
      category: "major",
      role: "Academic track",
      x: -115,
      y: 150,
    },
    {
      id: "Robotics Major",
      label: "Major",
      category: "major",
      role: "Academic track",
      x: 118,
      y: 150,
    },
    {
      id: "Machine Learning",
      label: "Course",
      category: "course",
      role: "Data Science subject",
      x: -210,
      y: 270,
    },
    {
      id: "Natural Language Processing",
      label: "Course",
      category: "course",
      role: "Data Science subject",
      x: -115,
      y: 320,
    },
    {
      id: "Computer Vision",
      label: "Course",
      category: "course",
      role: "Data Science subject",
      x: -18,
      y: 270,
    },
    {
      id: "Embedded Systems",
      label: "Course",
      category: "course",
      role: "Robotics subject",
      x: 48,
      y: 270,
    },
    {
      id: "Autonomous Systems",
      label: "Course",
      category: "course",
      role: "Robotics subject",
      x: 145,
      y: 324,
    },
    {
      id: "Intelligent Control",
      label: "Course",
      category: "course",
      role: "Robotics subject",
      x: 242,
      y: 270,
    },
    {
      id: "Robot Kinematics",
      label: "Course",
      category: "course",
      role: "Robotics subject",
      x: 345,
      y: 320,
    },
  ],
  links: [
    {
      source: "AAST AI Program",
      target: "2019",
      type: "ESTABLISHED_IN",
    },
    {
      source: "AAST AI Program",
      target: "Bachelor of Artificial Intelligence",
      type: "AWARDS_DEGREE",
    },
    {
      source: "AAST AI Program",
      target: "Data Science Major",
      type: "OFFERS",
    },
    {
      source: "AAST AI Program",
      target: "Robotics Major",
      type: "OFFERS",
    },
    {
      source: "AAST AI Program",
      target: "Ali Ali Fahmy",
      type: "LED_BY",
    },
    {
      source: "AAST AI Program",
      target: "Ahmed Abo Elfarag",
      type: "LED_BY",
    },
    {
      source: "AAST AI Program",
      target: "Hany Hanafy",
      type: "QUALITY_HEAD",
    },
    {
      source: "AAST AI Program",
      target: "Hany Hanafy",
      type: "MANAGED_BY",
    },
    {
      source: "Data Science Major",
      target: "Machine Learning",
      type: "HAS_COURSE",
    },
    {
      source: "Data Science Major",
      target: "Natural Language Processing",
      type: "HAS_COURSE",
    },
    {
      source: "Data Science Major",
      target: "Computer Vision",
      type: "HAS_COURSE",
    },
    {
      source: "Robotics Major",
      target: "Embedded Systems",
      type: "HAS_COURSE",
    },
    {
      source: "Robotics Major",
      target: "Autonomous Systems",
      type: "HAS_COURSE",
    },
    {
      source: "Robotics Major",
      target: "Intelligent Control",
      type: "HAS_COURSE",
    },
    {
      source: "Robotics Major",
      target: "Robot Kinematics",
      type: "HAS_COURSE",
    },
  ],
};

export function buildDemoGraphResponse({
  conversationId,
  requestId,
  normalizationTrace,
  latencyMs = 0,
} = {}) {
  return {
    answer: "Graph evidence loaded for the AI program.",
    final_answer: "Graph evidence loaded for the AI program.",
    source: "demo_graph",
    route: "DEMO_GRAPH",
    confidence: 1,
    sources: ["demo_graph"],
    used_facts: [
      "AAST AI Program was established in 2019.",
      "The degree is Bachelor of Artificial Intelligence.",
      "The program offers Data Science Major and Robotics Major.",
      "Leadership includes Ali Ali Fahmy, Ahmed Abo Elfarag, and Hany Hanafy.",
    ],
    missing_information: [],
    graph: demoAiProgramGraph,
    explainability: {
      deterministic: true,
      demo_mode: true,
      neo4j_bypassed: true,
      production_fallback_preserved: true,
      cypher_verified: true,
    },
    citations: [],
    reasoning:
      "Demo-only academic intelligence graph returned before production routing for investor presentation mode.",
    metadata: {
      demo_mode: true,
      trace: {
        request_id: requestId,
        route: "DEMO_GRAPH",
        degraded_services: [],
        subsystem_health: {},
        latency_ms: latencyMs,
        routing_confidence: 1,
        response_tier: "DEMO_SHOWCASE",
        query_normalization: normalizationTrace || null,
        route_diagnostics: {
          final_route: "DEMO_GRAPH",
          bypassed: ["INTENT_CLASSIFIER", "NEO4J_RETRIEVAL", "RAG_RETRIEVAL", "LLM_SYNTHESIS"],
        },
      },
    },
    cid: conversationId,
    conversationId,
    requestId,
  };
}
