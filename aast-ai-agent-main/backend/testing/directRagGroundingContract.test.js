import assert from "node:assert/strict";

import { finalizeGroundedAnswer } from "../services/unifiedAnswerService.js";
import responseFormatter from "../services/responseFormatter.js";
import { hasStrongDirectRagEvidence } from "../services/directRagEvidencePolicy.js";

assert.equal(hasStrongDirectRagEvidence({
  answer: "A plausible but unsupported generated answer that is long enough.",
  raw_confidence: 0.2,
  sources: [
    { text: "First readable source passage that is still below the relevance threshold.", score: 0.2 },
    { text: "Second readable source passage that must not pass merely because it exists.", score: 0.25 },
  ],
}), false, "answer presence and multiple weak sources must not trigger direct bypass");

assert.equal(hasStrongDirectRagEvidence({
  raw_confidence: 0.46,
  sources: [{ text: "A sufficiently relevant official policy passage with enough readable detail.", score: 0.46 }],
}), true);

assert.equal(hasStrongDirectRagEvidence({
  raw_confidence: 0.9,
  sources: [{ text: "too short", score: 0.9 }],
}), false, "high scores without usable evidence text must not trigger direct bypass");

const evidence = [{
  evidence_id: "rag:policy-1",
  evidence: "Students must maintain a cumulative GPA of 2.0 to remain in good academic standing.",
  source_type: "RAG",
  score: 0.78,
  metadata: {
    evidence_id: "rag:policy-1",
    title: "Academic Regulations",
    category: "GPA_POLICY",
    source: "Academic Regulations",
    score: 0.78,
  },
}];

const quality = finalizeGroundedAnswer({
  query: "What GPA is required for good academic standing?",
  answer: "Students must maintain a cumulative GPA of 2.0 to remain in good academic standing.",
  evidence,
});

assert.equal(quality.grounding.status, "fully_supported");
assert.equal(quality.citations.length, 1);
assert.equal(quality.citations[0].evidence_id, "rag:policy-1");

const formatted = responseFormatter.format({
  answer: quality.answer,
  final_answer: quality.answer,
  route_used: "RAG_DIRECT",
  confidence: 0.78,
  citations: quality.citations,
  used_facts: [evidence[0].evidence],
}, "contract-cid", "contract-request");

assert.equal(formatted.citations.length, 1, "grounded direct RAG citation must survive formatting");
assert.equal(formatted.citations[0].evidence_id, "rag:policy-1");
assert.equal(formatted.citations[0].score, 0.78);

const legacyConfidenceCitation = responseFormatter.format({
  answer: "Verified policy evidence.",
  route_used: "RAG_DIRECT",
  confidence: 0.6,
  citations: [{
    id: "rag:legacy",
    excerpt: "Verified policy evidence.",
    source: "Policy",
    confidence: 0.61,
  }],
}, "contract-cid", "legacy-request");

assert.equal(legacyConfidenceCitation.citations[0].score, 0.61);

console.log("Direct RAG grounding contract passed: evidence IDs, grounding, and citation scores are preserved.");
