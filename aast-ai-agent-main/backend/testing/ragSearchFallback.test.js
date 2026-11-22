import assert from "node:assert/strict";

process.env.RAG_ANSWER_ENGINE_ENABLED = "false";
process.env.SINGLE_GEMMA_GENERATION_MODE = "false";
process.env.DEFENSE_MODE = "false";

const { default: ragService } = await import("../services/ragService.js");

const calendarSource = { text: "Official Academic Calendar issued by the Arab Academy.", score: 0.489, title: "Official Academic Calendar" };
const result = (confidence, sources = [calendarSource]) => ({
  success: true,
  abstained: false,
  confidence,
  raw_confidence: confidence,
  sources,
  metadata: {},
});

async function run(pass1, pass2) {
  let calls = 0;
  ragService._telemetry.capabilities.validated = true;
  ragService._callRetriever = async () => (calls++ === 0 ? pass1 : pass2);
  return ragService.search("Who issues the official academic calendar?");
}

// A weak PASS 2 must not discard a PASS 1 result that cleared the relevance floor.
const keptPass1 = await run(result(0.489), result(0.1, []));
assert.equal(keptPass1.success, true, "PASS 1 above the floor should be used when PASS 2 is weaker");
assert.equal(keptPass1.sources?.[0]?.title, "Official Academic Calendar");
assert.equal(keptPass1.metadata?.retrieval_only, true);

// Existing behavior: PASS 2 above the floor still wins.
const pass2Wins = await run(result(0.3, [{ text: "weak first-pass passage that is long enough", score: 0.3 }]), result(0.46, [calendarSource]));
assert.equal(pass2Wins.success, true);
assert.equal(pass2Wins.sources?.[0]?.title, "Official Academic Calendar");

// Existing behavior: both below the floor abstain instead of returning weak evidence.
const bothWeak = await run(result(0.2, [{ text: "unrelated passage that is long enough", score: 0.2 }]), result(0.1, []));
assert.equal(bothWeak.success, false, "both passes below the floor must still return no evidence");

console.log("RAG search fallback tests passed.");
