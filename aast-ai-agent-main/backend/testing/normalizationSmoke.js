import assert from "node:assert/strict";
import { expandAcademicQuery, normalizeAcademicQuery } from "../services/academicQueryNormalizer.js";

const cases = [
  ["what is blockchain prequisties", "what is blockchain prerequisites"],
  ["what is machine learning prequisties", "what is machine learning prerequisites"],
  ["who teaches nlp", "who teaches natural language processing"],
  ["who is vice dean ai", "who is vice dean college of artificial intelligence"],
  ["block chain", "blockchain"],
  ["block-chain", "blockchain"],
  ["mobilecomputing", "mobile computing"],
  ["gpa req", "GPA requirements"],
  ["scholarship req", "scholarship requirements"],
  ["scholrship", "scholarship"],
  ["scholrship req", "scholarship requirements"],
  ["transfer req", "transfer requirements"],
  ["attendance req", "attendance requirements"],
  ["course reg", "registration requirements"],
  ["CS101 prereq", "CS 101 prerequisites"],
  ["robotics lab", "robotics lab"],
  ["labs", "labs"],
  ["What specializations exist in AI?", "What specializations exist in artificial intelligence?"],
];

for (const [input, expected] of cases) {
  const result = normalizeAcademicQuery(input);
  assert.equal(result.normalized, expected, input);
}

const roboticsExpansion = expandAcademicQuery("robotics lab");
assert.equal(roboticsExpansion.normalized, "robotics lab");
assert.ok(roboticsExpansion.expanded.includes("robotics lab"));
assert.ok(roboticsExpansion.expanded.includes("facility"));
assert.ok(roboticsExpansion.expanded.includes("laboratory"));
assert.ok(!roboticsExpansion.expanded.includes("iot lab"));
assert.ok(!roboticsExpansion.expanded.includes("virtual reality lab"));

console.log(`normalization smoke passed (${cases.length} cases)`);
