import assert from "node:assert/strict";

process.env.RAG_ANSWER_ENGINE_ENABLED = "false";
process.env.SINGLE_GEMMA_GENERATION_MODE = "false";
process.env.DEFENSE_MODE = "false";

const { default: ragService } = await import("../services/ragService.js");

const S = "Scholarship Eligibility Criteria";
const T = "Transfer Student Requirements";
// Ranked the way the live run returned them: transfer fragments first,
// scholarship fragments out of sentence order.
const ranked = [
  { id: "t1", title: T, text: "Transfer students must submit an official transcript", score: 0.62 },
  { id: "s2", title: S, text: "and complete at least 15 credit hours per semester.", score: 0.6 },
  { id: "t2", title: T, text: "from their previous institution.", score: 0.58 },
  { id: "s1", title: S, text: "To qualify, a student must maintain a GPA of at least 3.4,", score: 0.57 },
  { id: "s3", title: S, text: "Scholarships are reviewed at the end of each academic year.", score: 0.5 },
  { id: "c1", title: "Official Academic Calendar", text: "The Official Academic Calendar is issued by the Arab Academy each year and lists registration, examination and holiday dates for all colleges.", score: 0.4 },
];

const out = ragService._stitchFragmentSources(ranked, "What are the merit scholarship eligibility criteria?");

assert.equal(out.length, 3, "fragments sharing a title become one passage each");
assert.equal(out[0].title, S, "the passage whose title matches the question comes first");
assert.equal(
  out[0].text,
  "To qualify, a student must maintain a GPA of at least 3.4, and complete at least 15 credit hours per semester. Scholarships are reviewed at the end of each academic year."
);
assert.deepEqual(out[0].merged_chunk_ids, ["s2", "s1", "s3"]);
assert.equal(out[1].title, T);
assert.equal(out[1].text, "Transfer students must submit an official transcript from their previous institution.");
assert.equal(out[2].title, "Official Academic Calendar", "a whole passage is kept as it was");
assert.equal(out[2].merged_fragment_count, undefined);

// Without fragments, sources and their order are returned unchanged.
const whole = [ranked[5], { id: "p1", title: "Academic Probation Rule", text: "A student whose cumulative GPA falls below 2.0 is placed on academic probation for the following semester." }];
assert.equal(ragService._stitchFragmentSources(whole, "scholarship"), whole);

// A fragment left mid-sentence at the end is closed with a full stop.
const lone = ragService._stitchFragmentSources([
  { id: "a", title: S, text: "Awards are renewed yearly." },
  { id: "b", title: S, text: "To qualify, a student must maintain a GPA of at least 3.4," },
], "scholarship eligibility");
assert.equal(lone[0].text, "Awards are renewed yearly. To qualify, a student must maintain a GPA of at least 3.4.");

console.log("RAG fragment stitch tests passed.");
