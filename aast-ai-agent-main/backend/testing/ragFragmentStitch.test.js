import assert from "node:assert/strict";

process.env.RAG_ANSWER_ENGINE_ENABLED = "false";
process.env.SINGLE_GEMMA_GENERATION_MODE = "false";
process.env.DEFENSE_MODE = "false";

const { default: ragService } = await import("../services/ragService.js");
const stitch = (sources, query) => ragService._stitchFragmentSources(sources, query);

const S = "Scholarship Eligibility Criteria";
const doc = { source: "cai_scholarships.pdf", document_type: "policy", category: "scholarships" };
const MERIT = "What are the merit scholarship eligibility criteria?";

// 1. A fragment that stops mid-sentence is joined with the single fragment of
//    the same document that continues it. Every chunk keeps its citation.
{
  const out = stitch([
    { id: "s2", title: S, ...doc, text: "and complete at least 15 credit hours per semester." },
    { id: "s1", title: S, ...doc, text: "To qualify, a student must maintain a GPA of at least 3.4," },
    { id: "s3", title: S, ...doc, text: "Scholarships are reviewed at the end of each academic year." },
  ], MERIT);
  assert.equal(out[0].text, "To qualify, a student must maintain a GPA of at least 3.4, and complete at least 15 credit hours per semester.");
  assert.deepEqual(out[0].citations.map(c => c.id), ["s1", "s2"], "the citations of both joined chunks are kept");
  assert.equal(out[1].id, "s3", "a complete sentence is not joined without supported order");
  assert.equal(out.length, 2);
}

// 2. Different documents that share a title are never joined.
{
  const out = stitch([
    { id: "a1", title: S, source: "undergraduate_rules.pdf", text: "To qualify, a student must maintain a GPA of at least 3.4," },
    { id: "b1", title: S, source: "postgraduate_rules.pdf", text: "and hold no failed courses in the last two terms." },
  ], MERIT);
  assert.deepEqual(out.map(o => o.id), ["a1", "b1"]);
  assert.equal(out[0].merged_fragment_count, undefined);
}

// 3. Distinct GPA thresholds stay distinct, and an ambiguous continuation is
//    not guessed.
{
  const out = stitch([
    { id: "g1", title: S, ...doc, text: "For a full scholarship, a student must maintain a GPA of at least 3.8," },
    { id: "g2", title: S, ...doc, text: "For a partial scholarship, a student must maintain a GPA of at least 3.4," },
    { id: "g3", title: S, ...doc, text: "and have completed all previous study hours without interruption." },
  ], MERIT);
  assert.equal(out.length, 3, "two fragments could continue into g3, so nothing is joined");
  assert.ok(out.some(o => /3\.8/.test(o.text)) && out.some(o => /3\.4/.test(o.text)), "both thresholds survive");
}

// 4. An explicit chunk position is used for order when every chunk has one.
{
  const out = stitch([
    { id: "p2", title: S, ...doc, chunk_index: 2, text: "and have completed all previous study hours without interruption." },
    { id: "p1", title: S, ...doc, chunk_index: 1, text: "To qualify, a student must maintain a GPA of at least 3.4," },
  ], MERIT);
  assert.equal(out[0].text, "To qualify, a student must maintain a GPA of at least 3.4, and have completed all previous study hours without interruption.");
}

// 5. Live-run shape: transfer rules in their own documents rank first. They go
//    last on a general question, once, with every citation kept.
{
  const live = [
    { id: "y1", title: "Scholarship Eligibility for Transfer Students", source: "t1", text: "Transferred students from abroad or other institutions are only eligible for tuition fee exemption scholarships after they have completed at least two full semesters within the same major at CAI." },
    { id: "y2", title: S, ...doc, text: "To qualify, a student must maintain a GPA of at least 3.4," },
    { id: "y3", title: S, ...doc, text: "and have completed all previous study hours without interruption." },
    { id: "y4", title: "Scholarship Tie Rules", source: "t2", text: "scholarship is divided equally, except if multiple students achieve a 4.00." },
    { id: "y5", title: "Transfer Student Scholarship Eligibility", source: "t3", text: "Transferred students from abroad are eligible only after completing two semesters in the same major." },
  ];
  const out = stitch(live, MERIT);
  assert.deepEqual(out.map(o => o.id), ["y2", "y4", "y1"], "general criteria first, transfer rules last");
  assert.equal(out[0].text, "To qualify, a student must maintain a GPA of at least 3.4, and have completed all previous study hours without interruption.");
  assert.equal(out[1].text, "Scholarship is divided equally, except if multiple students achieve a 4.00.", "a passage starting mid-sentence is capitalised");
  assert.match(out[2].text, /^For transferred students: Transferred students from abroad or other institutions/);
  assert.equal((out[2].text.match(/Transferred students/g) || []).length, 1, "the restated transfer rule appears once");
  assert.deepEqual(out[2].citations.map(c => c.id), ["y1", "y5"], "the merged-away transfer chunk is still cited");

  // A transfer question keeps rank order and adds no label.
  const asked = stitch(live, "Can transfer students get a scholarship?");
  assert.equal(asked[0].id, "y1");
  assert.ok(asked.every(o => !/^For transferred/.test(o.text)));
}

// 6. Transfer rules with different numbers are not collapsed.
{
  const out = stitch([
    { id: "m1", title: S, ...doc, text: "Merit awards require a GPA of at least 3.4." },
    { id: "t1", title: "Transfer Student Scholarship Eligibility", source: "t1", text: "Transferred students need a GPA of at least 3.4 after two semesters." },
    { id: "t2", title: "Scholarship Eligibility for Transfer Students", source: "t2", text: "Transferred students need a GPA of at least 3.8 after two semesters." },
  ], MERIT);
  assert.match(out[1].text, /3\.4/);
  assert.match(out[1].text, /3\.8/);
}

// 7. Whole passages and unrelated sources come back unchanged.
{
  const whole = [
    { id: "c1", title: "Official Academic Calendar", text: "The Official Academic Calendar is issued by the Arab Academy each year and lists registration, examination and holiday dates for all colleges." },
    { id: "p1", title: "Academic Probation Rule", text: "A student whose cumulative GPA falls below 2.0 is placed on academic probation for the following semester." },
  ];
  assert.equal(stitch(whole, "scholarship"), whole);
}

console.log("RAG fragment stitch tests passed.");
