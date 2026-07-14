import { getSession } from "../db/neo4j.js";

const DEMO_GRAPH_TRIGGERS = new Set([
  "show ai program graph",
  "show me ai program graph",
  "ai program graph",
  "display ai graph",
  "show ai graph",
  "show me ai graph",
  "show ai college graph",
  "show me ai college graph",
  "display ai college graph",
  "open ai college graph",
  "ai college graph",
]);

const COLLEGE_ID = "COLLEGE_CAI_EL_ALAMEIN";
const INTELLIGENT_SYSTEMS_ID =
  "CAMPUS_EG_EL_ALAMEIN__COLLEGE_CAI_EL_ALAMEIN__PROGRAM_INTELLIGENT_SYSTEMS";
const DATA_SCIENCE_ID =
  "CAMPUS_EG_EL_ALAMEIN__COLLEGE_CAI_EL_ALAMEIN__PROGRAM_DATA_SCIENCE";

const AI_COLLEGE_GRAPH_QUERY = `
  MATCH (source)-[relationship]->(target)
  WHERE
    (
      type(relationship) = "BELONGS_TO"
      AND source.id IN $programIds
      AND target.id = $collegeId
    )
    OR (
      type(relationship) = "HAS_PARTNER_INSTITUTION"
      AND source.id = $collegeId
      AND target.id = $partnerId
    )
    OR (
      type(relationship) = "HAS_COURSE"
      AND source.id = $intelligentSystemsId
      AND target.id IN $courseIds
    )
    OR (
      type(relationship) = "DEAN_OF"
      AND source.name = $deanName
      AND target.id = $collegeId
    )
    OR (
      type(relationship) = "ADMINISTERS"
      AND source.name = $viceDeanName
      AND target.id = $collegeId
    )
    OR (
      type(relationship) = "HEAD_OF"
      AND source.name = $qualityHeadName
      AND target.id = $qualityUnitId
    )
    OR (
      type(relationship) = "BELONGS_TO"
      AND source.id = $qualityUnitId
      AND target.id = $collegeId
    )
    OR (
      type(relationship) = "TEACHES"
      AND source.name = $qualityHeadName
      AND target.id = $nlpCourseId
    )
    OR (
      type(relationship) = "HAS_PREREQUISITE"
      AND (
        (source.id = $computerVisionId AND target.id = $imageProcessingId)
        OR (source.id = $deepLearningId AND target.id = $machineLearningId)
      )
    )
  RETURN DISTINCT
    source.name AS sourceName,
    source.id AS sourceId,
    labels(source) AS sourceLabels,
    source.role AS sourceRole,
    source.title AS sourceTitle,
    type(relationship) AS relationshipType,
    target.name AS targetName,
    target.id AS targetId,
    labels(target) AS targetLabels,
    target.role AS targetRole,
    target.title AS targetTitle
  ORDER BY relationshipType, sourceName, targetName
  LIMIT 60
`;

const AI_COLLEGE_GRAPH_PARAMS = {
  collegeId: COLLEGE_ID,
  programIds: [INTELLIGENT_SYSTEMS_ID, DATA_SCIENCE_ID],
  intelligentSystemsId: INTELLIGENT_SYSTEMS_ID,
  partnerId: "PARTNERINST_UAB",
  qualityUnitId: "UNIT_CAI_EL_ALAMEIN_QUALITY",
  nlpCourseId: "COURSE_NATURAL_LANGUAGE_PROCESSING",
  computerVisionId: "COURSE_COMPUTER_VISION",
  imageProcessingId: "COURSE_IMAGE_PROCESSING_AND_PATTERN_RECOGNITION",
  deepLearningId: "COURSE_IN311",
  machineLearningId: "COURSE_IN221",
  courseIds: [
    "COURSE_NATURAL_LANGUAGE_PROCESSING",
    "COURSE_COGNITIVE_COMPUTING",
    "COURSE_COMPUTER_VISION",
    "COURSE_IMAGE_PROCESSING_AND_PATTERN_RECOGNITION",
    "COURSE_IN221",
    "COURSE_IN311",
  ],
  deanName: "Ali Ali Mohamed Fahmy",
  viceDeanName: "Ahmed Abdelkhalik Ahmed Abouelfarag",
  qualityHeadName: "Hany Hanafy Mahmoud Said",
};

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

function toText(value) {
  return value == null ? "" : String(value).trim();
}

function visualCategory(labels, name, role) {
  const labelSet = new Set(Array.isArray(labels) ? labels : []);
  const normalizedRole = toText(role).toLowerCase();

  if (name === "College of Artificial Intelligence") return "Program";
  if (labelSet.has("Program")) return "Major";
  if (labelSet.has("Course")) return "Course";
  if (labelSet.has("QualityUnit")) return "Quality Unit";
  if (
    labelSet.has("Professor") ||
    labelSet.has("Person") ||
    normalizedRole.includes("dean") ||
    normalizedRole.includes("head")
  ) return "Leadership";
  return "Entity";
}

function addNode(nodes, nodeMap, rawNode) {
  const name = toText(rawNode.name);
  if (!name || nodeMap.has(name)) return;

  const node = {
    id: name,
    name,
    label: visualCategory(rawNode.labels, name, rawNode.role),
    category: visualCategory(rawNode.labels, name, rawNode.role),
    role: toText(rawNode.role) || undefined,
    title: toText(rawNode.title) || undefined,
    canonicalId: toText(rawNode.id) || undefined,
    evidenceSource: "live_neo4j",
  };

  nodeMap.set(name, node);
  nodes.push(node);
}

function buildLiveGraph(records) {
  const nodes = [];
  const links = [];
  const nodeMap = new Map();
  const linkKeys = new Set();

  for (const record of records) {
    const source = {
      name: record.get("sourceName"),
      id: record.get("sourceId"),
      labels: record.get("sourceLabels"),
      role: record.get("sourceRole"),
      title: record.get("sourceTitle"),
    };
    const target = {
      name: record.get("targetName"),
      id: record.get("targetId"),
      labels: record.get("targetLabels"),
      role: record.get("targetRole"),
      title: record.get("targetTitle"),
    };
    const relationshipType = toText(record.get("relationshipType"));
    const sourceName = toText(source.name);
    const targetName = toText(target.name);

    if (!sourceName || !targetName || !relationshipType) continue;
    addNode(nodes, nodeMap, source);
    addNode(nodes, nodeMap, target);

    const linkKey = `${sourceName}|${relationshipType}|${targetName}`;
    if (linkKeys.has(linkKey)) continue;
    linkKeys.add(linkKey);
    links.push({
      source: sourceName,
      target: targetName,
      type: relationshipType,
    });
  }

  return {
    nodes,
    links,
    source: "neo4j",
    demoMode: true,
    primaryNodeId: "College of Artificial Intelligence",
    cypherQuery: AI_COLLEGE_GRAPH_QUERY.trim(),
    metadata: {
      title: "AI College Intelligence Map",
      subtitle: "Live leadership, programs, courses, prerequisites, teaching, and partnership evidence",
      badge: "Live Neo4j Verified",
    },
  };
}

function hasLink(graph, source, type, target) {
  return graph.links.some(
    (link) => link.source === source && link.type === type && link.target === target,
  );
}

function buildUsedFacts(graph) {
  const facts = [];

  if (
    hasLink(graph, "Intelligent Systems", "BELONGS_TO", "College of Artificial Intelligence") &&
    hasLink(graph, "Data Science", "BELONGS_TO", "College of Artificial Intelligence")
  ) {
    facts.push("The College of Artificial Intelligence includes Intelligent Systems and Data Science.");
  }
  if (hasLink(graph, "Ali Ali Mohamed Fahmy", "DEAN_OF", "College of Artificial Intelligence")) {
    facts.push("Ali Ali Mohamed Fahmy is Dean of the College of Artificial Intelligence.");
  }
  if (hasLink(graph, "Ahmed Abdelkhalik Ahmed Abouelfarag", "ADMINISTERS", "College of Artificial Intelligence")) {
    facts.push("Ahmed Abdelkhalik Ahmed Abouelfarag is Vice Dean of the College of Artificial Intelligence.");
  }
  if (hasLink(graph, "Hany Hanafy Mahmoud Said", "HEAD_OF", "Quality Unit")) {
    facts.push("Hany Hanafy Mahmoud Said heads the Quality Unit.");
  }
  if (hasLink(graph, "Hany Hanafy Mahmoud Said", "TEACHES", "Natural Language Processing")) {
    facts.push("Hany Hanafy Mahmoud Said teaches Natural Language Processing.");
  }
  if (hasLink(graph, "Computer Vision", "HAS_PREREQUISITE", "Image Processing & Pattern Recognition")) {
    facts.push("Image Processing & Pattern Recognition is a prerequisite for Computer Vision.");
  }
  if (hasLink(graph, "Deep Learning", "HAS_PREREQUISITE", "Machine Learning")) {
    facts.push("Machine Learning is a prerequisite for Deep Learning.");
  }
  if (
    hasLink(
      graph,
      "College of Artificial Intelligence",
      "HAS_PARTNER_INSTITUTION",
      "Autònoma University of Barcelona",
    )
  ) {
    facts.push("Autònoma University of Barcelona is an international partner institution.");
  }

  return facts;
}

function buildFailureResponse({
  conversationId,
  requestId,
  normalizationTrace,
  latencyMs,
  error,
}) {
  return {
    answer: "I couldn't load the live AI College graph safely. Neo4j evidence is currently unavailable.",
    final_answer: "I couldn't load the live AI College graph safely. Neo4j evidence is currently unavailable.",
    source: "neo4j",
    route: "DEMO_GRAPH",
    confidence: 0,
    sources: [],
    used_facts: [],
    missing_information: ["Live Neo4j graph evidence was unavailable."],
    graph: null,
    explainability: {
      deterministic: true,
      demo_mode: true,
      neo4j_bypassed: false,
      production_fallback_preserved: true,
      cypher_verified: false,
      failure_reason: error?.message || "NEO4J_GRAPH_UNAVAILABLE",
    },
    citations: [],
    reasoning: "The safe graph trigger never substitutes static presentation data for unavailable live evidence.",
    metadata: {
      demo_mode: true,
      trace: {
        request_id: requestId,
        route: "DEMO_GRAPH",
        degraded_services: ["NEO4J"],
        subsystem_health: { neo4j: false },
        latency_ms: latencyMs,
        routing_confidence: 1,
        response_tier: "LIVE_GRAPH_UNAVAILABLE",
        query_normalization: normalizationTrace || null,
      },
    },
    cid: conversationId,
    conversationId,
    requestId,
  };
}

export async function buildDemoGraphResponse({
  conversationId,
  requestId,
  normalizationTrace,
  latencyMs = 0,
} = {}) {
  const session = getSession();
  const startedAt = Date.now();

  try {
    const result = await session.run(AI_COLLEGE_GRAPH_QUERY, AI_COLLEGE_GRAPH_PARAMS);
    const graph = buildLiveGraph(result.records);
    if (graph.nodes.length === 0 || graph.links.length === 0) {
      throw new Error("AI College graph query returned no verified relationships.");
    }

    const usedFacts = buildUsedFacts(graph);
    const answer =
      `Verified AI College graph loaded from Neo4j with ${graph.nodes.length} entities ` +
      `and ${graph.links.length} relationships. Open the graph evidence to explore it.`;

    return {
      answer,
      final_answer: answer,
      source: "neo4j",
      route: "DEMO_GRAPH",
      confidence: 1,
      sources: ["neo4j"],
      used_facts: usedFacts,
      missing_information: [],
      graph,
      explainability: {
        deterministic: true,
        demo_mode: true,
        neo4j_bypassed: false,
        production_fallback_preserved: true,
        cypher_verified: true,
      },
      citations: [],
      reasoning: "A read-only, parameterized Neo4j query returned the presentation graph.",
      metadata: {
        demo_mode: true,
        trace: {
          request_id: requestId,
          route: "DEMO_GRAPH",
          degraded_services: [],
          subsystem_health: { neo4j: true },
          latency_ms: latencyMs + (Date.now() - startedAt),
          routing_confidence: 1,
          response_tier: "LIVE_NEO4J_SHOWCASE",
          query_normalization: normalizationTrace || null,
          route_diagnostics: {
            final_route: "DEMO_GRAPH",
            bypassed: ["INTENT_CLASSIFIER", "RAG_RETRIEVAL", "LLM_SYNTHESIS"],
          },
        },
      },
      cid: conversationId,
      conversationId,
      requestId,
    };
  } catch (error) {
    return buildFailureResponse({
      conversationId,
      requestId,
      normalizationTrace,
      latencyMs: latencyMs + (Date.now() - startedAt),
      error,
    });
  } finally {
    await session.close();
  }
}
