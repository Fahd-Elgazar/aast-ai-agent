function numberFromEnv(name, fallback, { min = 0, max = 1 } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return fallback;

  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(max, Math.max(min, parsed));
}

export const ROUTING_CALIBRATION = Object.freeze({
  kgConfidenceThreshold: numberFromEnv("KG_CONFIDENCE_THRESHOLD", 0.40),
  hybridConfidenceThreshold: numberFromEnv("HYBRID_CONFIDENCE_THRESHOLD", 0.34),
  llmFallbackThreshold: numberFromEnv("LLM_FALLBACK_THRESHOLD", 0.18),
  personAliasBoost: numberFromEnv("PERSON_ALIAS_BOOST", 0.22),
  requirementsHybridBoost: numberFromEnv("REQUIREMENTS_HYBRID_BOOST", 0.26),
  scholarshipHybridBoost: numberFromEnv("SCHOLARSHIP_HYBRID_BOOST", 0.34),
  ambiguityMargin: numberFromEnv("ROUTE_AMBIGUITY_MARGIN", 0.12),
  historicalRouteBoost: numberFromEnv("ROUTE_HISTORY_BOOST", 0.06),
  deterministicKgThreshold: numberFromEnv("DETERMINISTIC_KG_THRESHOLD", 0.70),
  deterministicRagThreshold: numberFromEnv("DETERMINISTIC_RAG_THRESHOLD", 0.70),
});

export default ROUTING_CALIBRATION;
