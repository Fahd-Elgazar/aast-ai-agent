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

// "robotics lab" is an EXACT ontology entity: expansion is intentionally
// bypassed and retrieval uses the canonical entity text (deterministic KG
// path). The previous assertions here predated detectExactOntologyEntity and
// asserted the generic-expansion behavior, which no longer applies to exact
// entities.
const roboticsExpansion = expandAcademicQuery("robotics lab");
assert.equal(roboticsExpansion.normalized, "robotics lab");
assert.ok(roboticsExpansion.exact_entity, "robotics lab should match an exact ontology entity");
assert.equal(roboticsExpansion.exact_entity.intent, "FACILITY");
assert.equal(roboticsExpansion.expanded.toLowerCase(), "robotics lab");
assert.equal(roboticsExpansion.expansion_count, 0);
assert.ok(!roboticsExpansion.expanded.toLowerCase().includes("iot lab"));
assert.ok(!roboticsExpansion.expanded.toLowerCase().includes("virtual reality lab"));

// Generic (non-exact) facility queries still receive keyword expansion.
const genericExpansion = expandAcademicQuery("what labs are available");
assert.ok(!genericExpansion.exact_entity);
assert.ok(genericExpansion.expanded.includes("facility"));
assert.ok(genericExpansion.expanded.includes("laboratory"));
assert.ok(genericExpansion.expansion_count > 0);

console.log(`normalization smoke passed (${cases.length} cases + expansion contract)`);
