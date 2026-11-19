import fs from "node:fs";


const contractUrl = new URL("./runtimeTopology.json", import.meta.url);
const contract = JSON.parse(fs.readFileSync(contractUrl, "utf8"));
const ALLOWED_DISPOSITIONS = new Set(["disabled", "optional", "required"]);
const RAG_ROUTES = new Set(["RAG_DIRECT", "RAG_ONLY", "HYBRID_KG_RAG"]);
const ROUTE_SERVICE_DEPENDENCIES = Object.freeze({
  KG_DIRECT: ["neo4j", "ollama"],
  KG_ONLY: ["neo4j", "ollama"],
  RAG_DIRECT: ["qdrant", "ragRetriever"],
  RAG_ONLY: ["qdrant", "ragRetriever"],
  HYBRID_KG_RAG: ["neo4j", "ollama", "qdrant", "ragRetriever"],
  DECISION_ENGINE: ["decisionApi"],
  LLM_FALLBACK: ["ollama"],
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function validateContract(value) {
  if (!value?.defaultMode || !value?.modes?.[value.defaultMode]) {
    throw new Error("Runtime topology contract must define a valid defaultMode");
  }

  for (const [mode, definition] of Object.entries(value.modes)) {
    if (typeof definition.ragRoutesEnabled !== "boolean") {
      throw new Error(`Runtime topology mode '${mode}' must define ragRoutesEnabled`);
    }

    for (const [service, disposition] of Object.entries(definition.services || {})) {
      if (!ALLOWED_DISPOSITIONS.has(disposition)) {
        throw new Error(
          `Runtime topology mode '${mode}' has invalid disposition '${disposition}' for '${service}'`
        );
      }
    }
  }
}

validateContract(contract);
deepFreeze(contract);

export const runtimeTopologyContract = contract;

export function resolveRuntimeTopology(env = process.env) {
  const requestedMode = String(env.AAST_LAUNCHER_MODE || "").trim().toLowerCase();
  const mode = contract.modes[requestedMode] ? requestedMode : contract.defaultMode;
  const definition = contract.modes[mode];

  return Object.freeze({
    mode,
    requestedMode: requestedMode || null,
    usedDefault: mode !== requestedMode,
    description: definition.description,
    ragRoutesEnabled: definition.ragRoutesEnabled,
    services: definition.services,
  });
}

export function constrainSubsystemHealthForTopology(health, topology = resolveRuntimeTopology()) {
  const services = topology.services || topology.topologyServices || {};
  const isEnabled = service => services[service] !== "disabled";

  return {
    ...health,
    kg: isEnabled("neo4j") && isEnabled("ollama") && health?.kg === true,
    rag:
      topology.ragRoutesEnabled === true &&
      isEnabled("qdrant") &&
      isEnabled("ragRetriever") &&
      health?.rag === true,
    decision: isEnabled("decisionApi") && health?.decision === true,
    llm: isEnabled("ollama") && health?.llm === true,
  };
}

export function isRouteAllowedByTopology(route, topology = resolveRuntimeTopology()) {
  if (!topology.ragRoutesEnabled && RAG_ROUTES.has(route)) return false;

  const services = topology.services || topology.topologyServices || {};
  const dependencies = ROUTE_SERVICE_DEPENDENCIES[route] || [];
  return dependencies.every(service => services[service] !== "disabled");
}
