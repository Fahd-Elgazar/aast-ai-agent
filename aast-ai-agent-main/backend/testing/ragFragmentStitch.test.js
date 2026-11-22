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
assert.equal(out[1].title, "Official Academic Calendar", "a whole passage is kept as it was");
assert.equal(out[1].merged_fragment_count, undefined);
assert.equal(out[2].title, T, "a transfer-only passage goes last on a general question");
assert.equal(out[2].text, "For transferred students: Transfer students must submit an official transcript from their previous institution.");

// Without fragments, sources and their order are returned unchanged.
const whole = [ranked[5], { id: "p1", title: "Academic Probation Rule", text: "A student whose cumulative GPA falls below 2.0 is placed on academic probation for the following semester." }];
assert.equal(ragService._stitchFragmentSources(whole, "scholarship"), whole);

// A fragment left mid-sentence at the end is closed with a full stop.
const lone = ragService._stitchFragmentSources([
  { id: "a", title: S, text: "Awards are renewed yearly." },
  { id: "b", title: S, text: "To qualify, a student must maintain a GPA of at least 3.4," },
], "scholarship eligibility");
assert.equal(lone[0].text, "Awards are renewed yearly. To qualify, a student must maintain a GPA of at least 3.4.");

// Live-run shape: the transfer-student rule shares the scholarship title and
// ranks first. It must not lead a general merit question, and must not repeat.
const live = [
  { id: "x1", title: S, text: "Transferred students from abroad or other institutions are only eligible for tuition fee exemption scholarships after they have completed at least two full semesters within the same major at CAI." },
  { id: "x2", title: S, text: "To qualify, a student must maintain a GPA of at least 3.4," },
  { id: "x3", title: S, text: "and have completed all previous study hours without interruption." },
  { id: "x4", title: S, text: "Transferred students from abroad or other institutions are only eligible for tuition fee exemption scholarships after they have completed at least two full semesters within the same major at CAI." },
];
const merit = ragService._stitchFragmentSources(live, "What are the merit scholarship eligibility criteria?");
assert.equal(merit[0].text, "To qualify, a student must maintain a GPA of at least 3.4, and have completed all previous study hours without interruption.");
assert.equal(merit[1].audience, "transferred_students");
assert.match(merit[1].text, /^For transferred students: Transferred students from abroad/);
assert.equal((merit[1].text.match(/Transferred students/g) || []).length, 1, "the repeated transfer rule appears once");

// A transfer question keeps the transfer rule inline.
const asked = ragService._stitchFragmentSources(live, "Can transfer students get a scholarship?");
assert.equal(asked.length, 1);
assert.match(asked[0].text, /^Transferred students from abroad/);

// Live-run shape 2: transfer rules in their own titled chunks rank first.
const titled = [
  { id: "y1", title: "Scholarship Eligibility for Transfer Students", text: "Transferred students from abroad or other institutions are only eligible for tuition fee exemption scholarships after they have completed at least two full semesters within the same major at CAI." },
  { id: "y2", title: S, text: "To qualify, a student must maintain a GPA of at least 3.4," },
  { id: "y3", title: S, text: "and have completed all previous study hours without interruption." },
  { id: "y4", title: "Scholarship Tie Rules", text: "If multiple students achieve a 4.00, each receives a full scholarship." },
  { id: "y5", title: "Transfer Student Scholarship Eligibility", text: "Transferred students from abroad are eligible only after completing two semesters in the same major." },
];
const ordered = ragService._stitchFragmentSources(titled, "What are the merit scholarship eligibility criteria?");
assert.deepEqual(ordered.map(o => o.id), ["y2", "y4", "y1", "y5"], "general criteria first, transfer rules last");
assert.match(ordered[2].text, /^For transferred students: /);
assert.equal(ordered[0].text, "To qualify, a student must maintain a GPA of at least 3.4, and have completed all previous study hours without interruption.");
const transferAsk = ragService._stitchFragmentSources(titled, "Scholarships for transfer students?");
assert.equal(transferAsk[0].id, "y1", "a transfer question keeps rank order");
assert.ok(transferAsk.every(o => !/^For transferred/.test(o.text)), "and adds no label");

console.log("RAG fragment stitch tests passed.");
