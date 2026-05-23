export type GraphEntityKind =
  | "Program"
  | "Major"
  | "Course"
  | "Leadership"
  | "Metadata"
  | "Professor"
  | "Department"
  | "Quality Unit"
  | "Role"
  | "Career"
  | "Scholarship"
  | "Policy"
  | "Entity";

export interface NodeVisualStyle {
  color: string;
  softColor: string;
  borderColor: string;
  textColor: string;
  glowColor: string;
}

export interface RelationshipVisualStyle {
  color: string;
  softColor: string;
  label: string;
  dash?: number[];
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: GraphEntityKind;
  rawType: string;
  group: number;
  properties: Record<string, unknown>;
  degree: number;
  cluster: GraphEntityKind;
  isPrimary?: boolean;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface KnowledgeGraphLink {
  id: string;
  source: string | KnowledgeGraphNode;
  target: string | KnowledgeGraphNode;
  type: string;
  label: string;
  value: number;
  color: string;
  curvature: number;
}

export interface NormalizedGraph {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
  nodeMap: Map<string, KnowledgeGraphNode>;
  primaryNodeId: string | null;
  cypherQuery?: string;
  isDemo: boolean;
  title?: string;
  subtitle?: string;
  badge?: string;
  typeCounts: Record<GraphEntityKind, number>;
  relationshipCounts: Record<string, number>;
}

const RESERVED_NODE_KEYS = new Set([
  "id",
  "identity",
  "elementId",
  "label",
  "labels",
  "name",
  "title",
  "type",
  "kind",
  "category",
  "group",
  "x",
  "y",
  "fx",
  "fy",
  "vx",
  "vy",
  "properties",
  "metadata",
]);

export const NODE_TYPE_ORDER: GraphEntityKind[] = [
  "Program",
  "Major",
  "Course",
  "Leadership",
  "Metadata",
  "Professor",
  "Department",
  "Quality Unit",
  "Role",
  "Career",
  "Scholarship",
  "Policy",
  "Entity",
];

export const NODE_KIND_STYLES: Record<GraphEntityKind, NodeVisualStyle> = {
  Program: {
    color: "#a855f7",
    softColor: "rgba(168, 85, 247, 0.17)",
    borderColor: "rgba(216, 180, 254, 0.58)",
    textColor: "#7e22ce",
    glowColor: "rgba(168, 85, 247, 0.55)",
  },
  Major: {
    color: "#06b6d4",
    softColor: "rgba(6, 182, 212, 0.16)",
    borderColor: "rgba(103, 232, 249, 0.52)",
    textColor: "#0e7490",
    glowColor: "rgba(6, 182, 212, 0.42)",
  },
  Course: {
    color: "#3b82f6",
    softColor: "rgba(59, 130, 246, 0.14)",
    borderColor: "rgba(96, 165, 250, 0.48)",
    textColor: "#1d4ed8",
    glowColor: "rgba(59, 130, 246, 0.36)",
  },
  Leadership: {
    color: "#d4af37",
    softColor: "rgba(212, 175, 55, 0.18)",
    borderColor: "rgba(250, 204, 21, 0.52)",
    textColor: "#a16207",
    glowColor: "rgba(212, 175, 55, 0.42)",
  },
  Metadata: {
    color: "#22c55e",
    softColor: "rgba(34, 197, 94, 0.14)",
    borderColor: "rgba(74, 222, 128, 0.46)",
    textColor: "#15803d",
    glowColor: "rgba(34, 197, 94, 0.34)",
  },
  Professor: {
    color: "#2563eb",
    softColor: "rgba(37, 99, 235, 0.14)",
    borderColor: "rgba(37, 99, 235, 0.45)",
    textColor: "#1d4ed8",
    glowColor: "rgba(37, 99, 235, 0.35)",
  },
  Department: {
    color: "#16a34a",
    softColor: "rgba(22, 163, 74, 0.14)",
    borderColor: "rgba(22, 163, 74, 0.45)",
    textColor: "#15803d",
    glowColor: "rgba(22, 163, 74, 0.35)",
  },
  "Quality Unit": {
    color: "#d4af37",
    softColor: "rgba(212, 175, 55, 0.18)",
    borderColor: "rgba(212, 175, 55, 0.5)",
    textColor: "#a16207",
    glowColor: "rgba(212, 175, 55, 0.38)",
  },
  Role: {
    color: "#f97316",
    softColor: "rgba(249, 115, 22, 0.14)",
    borderColor: "rgba(249, 115, 22, 0.45)",
    textColor: "#ea580c",
    glowColor: "rgba(249, 115, 22, 0.34)",
  },
  Career: {
    color: "#06b6d4",
    softColor: "rgba(6, 182, 212, 0.14)",
    borderColor: "rgba(6, 182, 212, 0.45)",
    textColor: "#0891b2",
    glowColor: "rgba(6, 182, 212, 0.34)",
  },
  Scholarship: {
    color: "#ec4899",
    softColor: "rgba(236, 72, 153, 0.14)",
    borderColor: "rgba(236, 72, 153, 0.45)",
    textColor: "#db2777",
    glowColor: "rgba(236, 72, 153, 0.34)",
  },
  Policy: {
    color: "#64748b",
    softColor: "rgba(100, 116, 139, 0.14)",
    borderColor: "rgba(100, 116, 139, 0.42)",
    textColor: "#475569",
    glowColor: "rgba(100, 116, 139, 0.28)",
  },
  Entity: {
    color: "#0f766e",
    softColor: "rgba(15, 118, 110, 0.12)",
    borderColor: "rgba(15, 118, 110, 0.38)",
    textColor: "#0f766e",
    glowColor: "rgba(15, 118, 110, 0.28)",
  },
};

export const RELATIONSHIP_STYLES: Record<string, RelationshipVisualStyle> = {
  TEACHES: {
    color: "#2563eb",
    softColor: "rgba(37, 99, 235, 0.14)",
    label: "Teaches",
  },
  HEAD_OF: {
    color: "#d4af37",
    softColor: "rgba(212, 175, 55, 0.18)",
    label: "Head of",
  },
  WORKS_IN: {
    color: "#16a34a",
    softColor: "rgba(22, 163, 74, 0.14)",
    label: "Works in",
  },
  HAS_PREREQUISITE: {
    color: "#f59e0b",
    softColor: "rgba(245, 158, 11, 0.16)",
    label: "Prerequisite",
  },
  LEADS_TO: {
    color: "#06b6d4",
    softColor: "rgba(6, 182, 212, 0.16)",
    label: "Leads to",
  },
  ACTS_AS: {
    color: "#f97316",
    softColor: "rgba(249, 115, 22, 0.16)",
    label: "Acts as",
  },
  IS_SAME_ENTITY: {
    color: "#94a3b8",
    softColor: "rgba(148, 163, 184, 0.18)",
    label: "Same entity",
    dash: [5, 5],
  },
  BELONGS_TO: {
    color: "#4f46e5",
    softColor: "rgba(79, 70, 229, 0.16)",
    label: "Belongs to",
  },
  SPECIALIZES_IN: {
    color: "#a855f7",
    softColor: "rgba(168, 85, 247, 0.16)",
    label: "Specializes in",
  },
  HAS_ROLE: {
    color: "#fb923c",
    softColor: "rgba(251, 146, 60, 0.16)",
    label: "Has role",
  },
  DEAN_OF: {
    color: "#d4af37",
    softColor: "rgba(212, 175, 55, 0.18)",
    label: "Dean of",
  },
  ADMINISTERS: {
    color: "#f97316",
    softColor: "rgba(249, 115, 22, 0.16)",
    label: "Administers",
  },
  HAS_COURSE: {
    color: "#3b82f6",
    softColor: "rgba(59, 130, 246, 0.16)",
    label: "Has course",
  },
  ESTABLISHED_IN: {
    color: "#22c55e",
    softColor: "rgba(34, 197, 94, 0.16)",
    label: "Established in",
  },
  AWARDS_DEGREE: {
    color: "#16a34a",
    softColor: "rgba(22, 163, 74, 0.16)",
    label: "Awards degree",
  },
  OFFERS: {
    color: "#06b6d4",
    softColor: "rgba(6, 182, 212, 0.18)",
    label: "Offers",
  },
  LED_BY: {
    color: "#d4af37",
    softColor: "rgba(212, 175, 55, 0.18)",
    label: "Led by",
  },
  QUALITY_HEAD: {
    color: "#facc15",
    softColor: "rgba(250, 204, 21, 0.18)",
    label: "Quality head",
  },
  MANAGED_BY: {
    color: "#f59e0b",
    softColor: "rgba(245, 158, 11, 0.18)",
    label: "Managed by",
  },
  HAS_QUALITY_PROCESS: {
    color: "#d4af37",
    softColor: "rgba(212, 175, 55, 0.18)",
    label: "Quality process",
  },
  INCLUDES: {
    color: "#8b5cf6",
    softColor: "rgba(139, 92, 246, 0.16)",
    label: "Includes",
  },
  INTERESTED_IN: {
    color: "#06b6d4",
    softColor: "rgba(6, 182, 212, 0.16)",
    label: "Interested in",
  },
  RELATED_TO: {
    color: "#64748b",
    softColor: "rgba(100, 116, 139, 0.14)",
    label: "Related to",
  },
};

export const CLUSTER_ANCHORS: Record<GraphEntityKind, { x: number; y: number }> = {
  Program: { x: 0, y: 0 },
  Major: { x: 0, y: 118 },
  Course: { x: 165, y: 188 },
  Leadership: { x: -230, y: -115 },
  Metadata: { x: 225, y: -122 },
  Professor: { x: -210, y: -35 },
  Department: { x: -15, y: 150 },
  "Quality Unit": { x: 185, y: 120 },
  Role: { x: -190, y: 120 },
  Career: { x: 255, y: -10 },
  Scholarship: { x: 95, y: 220 },
  Policy: { x: 240, y: 185 },
  Entity: { x: 0, y: 0 },
};

const EMPTY_COUNTS = NODE_TYPE_ORDER.reduce(
  (counts, type) => ({ ...counts, [type]: 0 }),
  {} as Record<GraphEntityKind, number>,
);

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringFrom(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function categoryToken(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function arrayRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!toRecord(item))
    : [];
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function jitter(id: string, axis: "x" | "y", spread = 82): number {
  const hash = stableHash(`${id}:${axis}`);
  return ((hash % 1000) / 1000 - 0.5) * spread;
}

function normalizeRelationshipType(value: unknown): string {
  const raw = stringFrom(value) || "RELATED_TO";
  return raw.replace(/[\s-]+/g, "_").replace(/[^\w]/g, "").toUpperCase() || "RELATED_TO";
}

function humanizeRelationship(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readLabels(value: Record<string, unknown>): string[] {
  const labels = value.labels;
  if (Array.isArray(labels)) {
    return labels.map(stringFrom).filter((label): label is string => !!label);
  }

  const label = stringFrom(value.label);
  return label ? [label] : [];
}

function collectProperties(node: Record<string, unknown>): Record<string, unknown> {
  const directProperties = toRecord(node.properties) || {};
  const metadata = toRecord(node.metadata) || {};
  const direct: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    if (RESERVED_NODE_KEYS.has(key)) continue;
    if (typeof value === "function" || typeof value === "undefined") continue;
    direct[key] = value;
  }

  return {
    ...direct,
    ...metadata,
    ...directProperties,
  };
}

function extractNodeId(node: Record<string, unknown>, fallback?: string): string | null {
  const properties = toRecord(node.properties) || {};
  const identity = toRecord(node.identity);
  return (
    stringFrom(node.id) ||
    stringFrom(node.elementId) ||
    stringFrom(node.name) ||
    stringFrom(properties.id) ||
    stringFrom(properties.name) ||
    stringFrom(identity?.low) ||
    fallback ||
    null
  );
}

function readRawType(node: Record<string, unknown>, properties: Record<string, unknown>): string {
  const labels = readLabels(node);
  return (
    stringFrom(node.type) ||
    stringFrom(node.kind) ||
    stringFrom(node.category) ||
    labels[0] ||
    stringFrom(properties.type) ||
    stringFrom(properties.kind) ||
    "Entity"
  );
}

function inferNodeKind(rawType: string, label: string, properties: Record<string, unknown>): GraphEntityKind {
  const propertyText = Object.values(properties)
    .map((value) => (typeof value === "string" || typeof value === "number" ? String(value) : ""))
    .join(" ");
  const haystack = `${rawType} ${label} ${propertyText}`.toLowerCase();

  if (
    haystack.includes("leadership") ||
    haystack.includes("dean") ||
    haystack.includes("vice dean") ||
    haystack.includes("head of quality") ||
    haystack.includes("head of unit")
  ) {
    return "Leadership";
  }
  if (
    haystack.includes("metadata") ||
    haystack.includes("established") ||
    haystack.includes("degree") ||
    rawType.toLowerCase() === "year"
  ) {
    return "Metadata";
  }
  if (haystack.includes("quality")) return "Quality Unit";
  if (haystack.includes("scholarship") || haystack.includes("financial aid")) return "Scholarship";
  if (
    haystack.includes("career") ||
    haystack.includes("job") ||
    haystack.includes("engineer") ||
    haystack.includes("scientist") ||
    haystack.includes("architect")
  ) {
    return "Career";
  }
  if (
    haystack.includes("course") ||
    haystack.includes("module") ||
    haystack.includes("subject") ||
    haystack.includes("natural language processing") ||
    haystack.includes("cognitive computing")
  ) {
    return "Course";
  }
  if (
    haystack.includes("major") ||
    haystack.includes("track") ||
    haystack.includes("specialization")
  ) {
    return "Major";
  }
  if (
    haystack.includes("program") ||
    haystack.includes("programme")
  ) {
    return "Program";
  }
  if (
    haystack.includes("policy") ||
    haystack.includes("process") ||
    haystack.includes("requirement") ||
    haystack.includes("regulation")
  ) {
    return "Policy";
  }
  if (
    haystack.includes("role") ||
    haystack.includes("leader") ||
    haystack.includes("head of") ||
    rawType.toLowerCase() === "role"
  ) {
    return "Role";
  }
  if (
    haystack.includes("department") ||
    haystack.includes("college") ||
    haystack.includes("faculty") ||
    haystack.includes("school") ||
    haystack.includes("campus")
  ) {
    return "Department";
  }
  if (
    haystack.includes("professor") ||
    haystack.includes("lecturer") ||
    haystack.includes("faculty member") ||
    haystack.includes("teacher") ||
    rawType.toLowerCase() === "person"
  ) {
    return "Professor";
  }

  return "Entity";
}

function readEndpointLabel(endpoint: unknown): string | null {
  const record = toRecord(endpoint);
  if (!record) return stringFrom(endpoint);
  const properties = toRecord(record.properties) || {};
  return (
    stringFrom(record.label) ||
    stringFrom(record.name) ||
    stringFrom(properties.name) ||
    stringFrom(record.id)
  );
}

export function getEndpointId(endpoint: string | number | KnowledgeGraphNode | null | undefined): string {
  if (typeof endpoint === "string" || typeof endpoint === "number") return String(endpoint);
  if (!endpoint) return "";
  return endpoint.id;
}

function extractEndpointId(endpoint: unknown): string | null {
  if (typeof endpoint === "string" || typeof endpoint === "number") return String(endpoint);
  const record = toRecord(endpoint);
  if (!record) return null;
  return extractNodeId(record) || readEndpointLabel(record);
}

function buildNodeFromRecord(record: Record<string, unknown>, index: number): KnowledgeGraphNode {
  const properties = collectProperties(record);
  const id = extractNodeId(record, `node-${index + 1}`) || `node-${index + 1}`;
  const rawType = readRawType(record, properties);
  const recordLabel = stringFrom(record.label);
  const rawCategory = stringFrom(record.category) || stringFrom(record.type) || stringFrom(record.kind);
  const labelLooksLikeType =
    !!recordLabel &&
    !!rawCategory &&
    categoryToken(recordLabel) === categoryToken(rawCategory);
  const label =
    labelLooksLikeType
      ? stringFrom(record.name) ||
        stringFrom(properties.name) ||
        stringFrom(properties.title) ||
        id
      : recordLabel ||
        stringFrom(record.name) ||
        stringFrom(properties.name) ||
        stringFrom(properties.title) ||
        id;
  const type = inferNodeKind(rawType, label, properties);
  const anchor = CLUSTER_ANCHORS[type];
  const x = numberFrom(record.x) ?? anchor.x + jitter(id, "x");
  const y = numberFrom(record.y) ?? anchor.y + jitter(id, "y");
  const group = numberFrom(record.group) ?? NODE_TYPE_ORDER.indexOf(type) + 1;

  return {
    id,
    label,
    type,
    rawType,
    group,
    properties,
    degree: 0,
    cluster: type,
    x,
    y,
  };
}

function buildMissingNode(id: string, endpoint: unknown, group: number): KnowledgeGraphNode {
  const record = toRecord(endpoint);
  const properties = record ? collectProperties(record) : {};
  const label = (record && readEndpointLabel(record)) || id;
  const rawType = record ? readRawType(record, properties) : "Entity";
  const type = inferNodeKind(rawType, label, properties);
  const anchor = CLUSTER_ANCHORS[type];

  return {
    id,
    label,
    type,
    rawType,
    group,
    properties,
    degree: 0,
    cluster: type,
    x: anchor.x + jitter(id, "x"),
    y: anchor.y + jitter(id, "y"),
  };
}

function selectPrimaryNode(nodes: KnowledgeGraphNode[], explicitPrimaryId?: string): string | null {
  if (explicitPrimaryId && nodes.some((node) => node.id === explicitPrimaryId)) return explicitPrimaryId;
  if (!nodes.length) return null;

  const groupedPrimary = nodes.find((node) => node.group === 1);
  if (groupedPrimary) return groupedPrimary.id;

  return [...nodes].sort((left, right) => right.degree - left.degree)[0]?.id ?? nodes[0].id;
}

function assignCurvature(links: KnowledgeGraphLink[]): void {
  const pairGroups = new Map<string, KnowledgeGraphLink[]>();

  for (const link of links) {
    const source = getEndpointId(link.source);
    const target = getEndpointId(link.target);
    const pair = [source, target].sort().join("::");
    const group = pairGroups.get(pair) || [];
    group.push(link);
    pairGroups.set(pair, group);
  }

  for (const group of pairGroups.values()) {
    if (group.length === 1) {
      group[0].curvature = 0.05;
      continue;
    }

    group.forEach((link, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      const magnitude = 0.12 + Math.floor(index / 2) * 0.08;
      link.curvature = direction * magnitude;
    });
  }
}

export function normalizeGraphData(raw: unknown): NormalizedGraph {
  const graph = toRecord(raw);
  const nodesMap = new Map<string, KnowledgeGraphNode>();
  const links: KnowledgeGraphLink[] = [];
  const typeCounts: Record<GraphEntityKind, number> = { ...EMPTY_COUNTS };
  const relationshipCounts: Record<string, number> = {};

  if (!graph) {
    return {
      nodes: [],
      links,
      nodeMap: nodesMap,
      primaryNodeId: null,
      isDemo: false,
      typeCounts,
      relationshipCounts,
    };
  }

  const metadata = toRecord(graph.metadata) || {};
  const rawNodes = arrayRecords(graph.nodes);
  const rawLinks = arrayRecords(Array.isArray(graph.links) ? graph.links : graph.edges);

  rawNodes.forEach((nodeRecord, index) => {
    const node = buildNodeFromRecord(nodeRecord, index);
    const existing = nodesMap.get(node.id);
    nodesMap.set(node.id, existing ? { ...existing, ...node, degree: existing.degree } : node);
  });

  rawLinks.forEach((linkRecord, index) => {
    const sourceEndpoint =
      linkRecord.source ??
      linkRecord.from ??
      linkRecord.start ??
      linkRecord.startNode ??
      linkRecord.sourceId;
    const targetEndpoint =
      linkRecord.target ??
      linkRecord.to ??
      linkRecord.end ??
      linkRecord.endNode ??
      linkRecord.targetId;
    const source = extractEndpointId(sourceEndpoint);
    const target = extractEndpointId(targetEndpoint);

    if (!source || !target) return;

    if (!nodesMap.has(source)) nodesMap.set(source, buildMissingNode(source, sourceEndpoint, 1));
    if (!nodesMap.has(target)) nodesMap.set(target, buildMissingNode(target, targetEndpoint, 2));

    const sourceNode = nodesMap.get(source);
    const targetNode = nodesMap.get(target);
    if (sourceNode) sourceNode.degree += 1;
    if (targetNode) targetNode.degree += 1;

    const type = normalizeRelationshipType(
      linkRecord.type ??
        linkRecord.relationship ??
        linkRecord.relation ??
        linkRecord.label ??
        linkRecord.name,
    );
    const style = getRelationshipStyle(type);
    const value = numberFrom(linkRecord.value) ?? numberFrom(linkRecord.weight) ?? 1;
    const id = stringFrom(linkRecord.id) || `${source}:${type}:${target}:${index}`;

    relationshipCounts[type] = (relationshipCounts[type] || 0) + 1;
    links.push({
      id,
      source,
      target,
      type,
      label: style.label,
      value,
      color: style.color,
      curvature: 0.05,
    });
  });

  assignCurvature(links);

  const nodes = Array.from(nodesMap.values()).map((node) => {
    typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    return node;
  });

  const primaryNodeId = selectPrimaryNode(nodes, stringFrom(graph.primaryNodeId) || stringFrom(graph.rootNodeId) || undefined);
  if (primaryNodeId) {
    const primary = nodesMap.get(primaryNodeId);
    if (primary) {
      primary.isPrimary = true;
      primary.fx = 0;
      primary.fy = 0;
      primary.x = 0;
      primary.y = 0;
    }
  }

  return {
    nodes,
    links,
    nodeMap: nodesMap,
    primaryNodeId,
    cypherQuery: stringFrom(graph.cypherQuery) || stringFrom(graph.query) || undefined,
    isDemo:
      graph.demoMode === true ||
      stringFrom(graph.source)?.toLowerCase() === "demo_graph" ||
      metadata.demo_mode === true,
    title: stringFrom(metadata.title) || stringFrom(graph.title) || undefined,
    subtitle: stringFrom(metadata.subtitle) || stringFrom(graph.subtitle) || undefined,
    badge: stringFrom(metadata.badge) || undefined,
    typeCounts,
    relationshipCounts,
  };
}

export function getNodeStyle(type: GraphEntityKind): NodeVisualStyle {
  return NODE_KIND_STYLES[type] || NODE_KIND_STYLES.Entity;
}

export function getRelationshipStyle(type: string): RelationshipVisualStyle {
  return (
    RELATIONSHIP_STYLES[type] || {
      color: "#64748b",
      softColor: "rgba(100, 116, 139, 0.14)",
      label: humanizeRelationship(type),
    }
  );
}

export function getConnectedNodeIds(links: KnowledgeGraphLink[], nodeId: string): Set<string> {
  const connected = new Set<string>([nodeId]);

  for (const link of links) {
    const source = getEndpointId(link.source);
    const target = getEndpointId(link.target);
    if (source === nodeId) connected.add(target);
    if (target === nodeId) connected.add(source);
  }

  return connected;
}

export function getConnectedLinks(links: KnowledgeGraphLink[], nodeId: string): KnowledgeGraphLink[] {
  return links.filter((link) => {
    const source = getEndpointId(link.source);
    const target = getEndpointId(link.target);
    return source === nodeId || target === nodeId;
  });
}

export function graphSearchText(node: KnowledgeGraphNode): string {
  const properties = Object.values(node.properties)
    .map((value) => {
      if (typeof value === "string" || typeof value === "number") return String(value);
      if (Array.isArray(value)) return value.join(" ");
      return "";
    })
    .join(" ");
  return `${node.label} ${node.id} ${node.type} ${node.rawType} ${properties}`.toLowerCase();
}

export function formatPropertyValue(value: unknown): string {
  if (value == null) return "Not available";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatPropertyValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function importantRelationshipTypes(relationshipCounts: Record<string, number>): string[] {
  const preferred = [
    "ESTABLISHED_IN",
    "AWARDS_DEGREE",
    "OFFERS",
    "LED_BY",
    "QUALITY_HEAD",
    "MANAGED_BY",
    "HAS_COURSE",
    "TEACHES",
    "HEAD_OF",
    "WORKS_IN",
    "HAS_PREREQUISITE",
    "LEADS_TO",
    "ACTS_AS",
    "IS_SAME_ENTITY",
    "BELONGS_TO",
    "SPECIALIZES_IN",
    "HAS_ROLE",
  ];
  const present = Object.keys(relationshipCounts);
  return [
    ...preferred.filter((type) => present.includes(type)),
    ...present.filter((type) => !preferred.includes(type)).sort(),
  ];
}
