const DEFAULT_MIN_RELEVANCE = 0.45;

function normalizeScore(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return 0;
  const probability = parsed > 1 ? parsed / 100 : parsed;
  return Math.max(0, Math.min(1, probability));
}

function sourceText(source) {
  const candidates = [
    source?.answer,
    source?.text,
    source?.content,
    source?.page_content,
    source?.chunk,
    source?.excerpt,
    source?.summary,
    source?.body,
    source?.document,
    source?.metadata?.text,
    source?.metadata?.content,
    source?.payload?.text,
    source?.payload?.content,
  ];
  const text = candidates.find(value => typeof value === "string" && value.trim());
  return String(text || "").replace(/\s+/g, " ").trim();
}

export function hasStrongDirectRagEvidence(ragResult, {
  minRelevance = DEFAULT_MIN_RELEVANCE,
} = {}) {
  const sources = Array.isArray(ragResult?.sources) ? ragResult.sources : [];
  const readableSources = sources.filter(source => sourceText(source).length >= 30);
  if (readableSources.length === 0) return false;

  const topSourceScore = Math.max(
    ...readableSources.map(source => normalizeScore(
      source?.rerank_score ?? source?.score ?? source?.confidence
    )),
    0
  );
  const retrievalScore = normalizeScore(ragResult?.raw_confidence ?? ragResult?.confidence);

  // Answer text and source count are not relevance evidence. At least one
  // retriever/reranker score must independently satisfy the acceptance floor.
  return Math.max(topSourceScore, retrievalScore) >= minRelevance;
}

export default { hasStrongDirectRagEvidence };
