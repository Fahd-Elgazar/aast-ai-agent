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
  assert.equal(out[1].text, "scholarship is divided equally, except if multiple students achieve a 4.00.", "a lone fragment is not capitalised mid-sentence");
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
  const transfer = out.filter(o => o.audience === "transferred_students");
  assert.equal(transfer.length, 2, "a 3.4 rule never absorbs a 3.8 rule");
  assert.match(transfer[0].text, /3\.4/);
  assert.match(transfer[1].text, /3\.8/);
  assert.deepEqual(transfer.map(o => o.citations.map(c => c.id)), [["t1"], ["t2"]]);
}

// 7. Whole passages and unrelated sources come back unchanged.
{
  const whole = [
    { id: "c1", title: "Official Academic Calendar", text: "The Official Academic Calendar is issued by the Arab Academy each year and lists registration, examination and holiday dates for all colleges." },
    { id: "p1", title: "Academic Probation Rule", text: "A student whose cumulative GPA falls below 2.0 is placed on academic probation for the following semester." },
  ];
  assert.equal(stitch(whole, "scholarship"), whole);
}

// 8. Live Q5 shape: three general fragments whose order is ambiguous stay as
//    written (no capital letters mid-sentence), and the two tie-rule
//    fragments, which can only follow each other, are joined.
{
  const tie = { source: "tie.pdf", document_type: "policy", category: "scholarships" };
  const out = stitch([
    { id: "e1", title: S, ...doc, text: "To qualify, a student must maintain a GPA of at least 3.4," },
    { id: "e2", title: S, ...doc, text: "and have completed all previous study hours without interruption" },
    { id: "e3", title: S, ...doc, text: "belong to a major with at least 15 students," },
    { id: "r1", title: "Scholarship Tie Rules", ...tie, text: "scholarship is divided equally, except if multiple students achieve a 4.00," },
    { id: "r2", title: "Scholarship Tie Rules", ...tie, text: "in which case each receives a full scholarship." },
  ], MERIT);
  const texts = out.map(o => o.text);
  assert.deepEqual(texts.slice(0, 3), [
    "To qualify, a student must maintain a GPA of at least 3.4,",
    "and have completed all previous study hours without interruption",
    "belong to a major with at least 15 students,",
  ]);
  assert.ok(texts.includes("Scholarship is divided equally, except if multiple students achieve a 4.00, in which case each receives a full scholarship."));
  assert.ok(texts.every(text => !/[,a-z] [A-Z][a-z]+ (have|to|which)\b/.test(text)), "no capital letter in the middle of a sentence");
}

// 9. Two transfer rules from different sources share the 3.4 threshold but
//    disagree. Both are kept, each with only its own citation, and each is
//    marked as conflicting with the other.
{
  const out = stitch([
    { id: "m1", title: S, ...doc, text: "Merit awards require a GPA of at least 3.4." },
    { id: "ta", title: "Transfer Student Scholarship Eligibility", source: "transfer_a.pdf", text: "Transferred students with a GPA of at least 3.4 are eligible for the scholarship." },
    { id: "tb", title: "Scholarship Eligibility for Transfer Students", source: "transfer_b.pdf", text: "Transferred students with a GPA of at least 3.4 are not eligible for the scholarship." },
  ], MERIT);
  const transfer = out.filter(o => o.audience === "transferred_students");
  assert.equal(transfer.length, 2, "both conflicting rules are kept");
  assert.equal(transfer[0].text, "For transferred students: Transferred students with a GPA of at least 3.4 are eligible for the scholarship.");
  assert.equal(transfer[1].text, "Transferred students with a GPA of at least 3.4 are not eligible for the scholarship.");
  assert.deepEqual(transfer[0].citations.map(c => c.id), ["ta"], "each claim keeps only its own citation");
  assert.deepEqual(transfer[1].citations.map(c => c.id), ["tb"]);
  assert.deepEqual(transfer[0].conflicts_with, ["tb"]);
  assert.deepEqual(transfer[1].conflicts_with, ["ta"]);
}

console.log("RAG fragment stitch tests passed.");

// 10. Fusion keeps one citation per joined chunk, so a claim's citations are
//     not reduced to the first chunk.
{
  const { default: fusionService } = await import("../services/fusionService.js");
  const [evidence] = fusionService.processRAGResults([{
    title: "Scholarship Eligibility Criteria",
    text: "To qualify, a student must maintain a GPA of at least 3.4, and complete at least 15 credit hours per semester.",
    citations: [
      { id: "s1", title: "Scholarship Eligibility Criteria", source: "cai_scholarships.pdf" },
      { id: "s2", title: "Scholarship Eligibility Criteria", source: "cai_scholarships.pdf" },
    ],
  }]);
  assert.deepEqual(evidence.citations.map(c => c.id), ["s1", "s2"]);
  console.log("RAG fragment stitch fusion citation test passed.");
}
