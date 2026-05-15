import assert from "node:assert/strict";
import { normalizeAcademicQuery } from "../services/academicQueryNormalizer.js";

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
];

for (const [input, expected] of cases) {
  const result = normalizeAcademicQuery(input);
  assert.equal(result.normalized, expected, input);
}

console.log(`normalization smoke passed (${cases.length} cases)`);
