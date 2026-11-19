import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function argument(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const baseUrl = String(
  argument("--base-url", process.env.DEAN_DEMO_BASE_URL || "http://127.0.0.1:5173")
).replace(/\/+$/, "");
const suite = argument("--suite", "all");
const runs = Math.max(1, Number.parseInt(argument("--runs", "3"), 10) || 3);
const deployedCommit = argument("--commit", process.env.DEAN_DEMO_COMMIT || "UNSPECIFIED");
const outputPath = argument("--output", "");
const requestTimeoutMs = Math.max(
  5000,
  Number.parseInt(argument("--timeout-ms", process.env.DEAN_DEMO_TIMEOUT_MS || "30000"), 10) || 30000
);

const COMMON_FORBIDDEN = [
  "fatal internal orchestrator error",
  "some advanced systems are temporarily unavailable",
  "i couldn't find verified knowledge graph evidence",
  "i do not have enough verified",
  "i don't have enough verified"
];

const PROGRAM_COMPARISON_CHECKPOINTS = [
  "Machine Learning",
  "Deep Learning",
  "Natural Language Processing",
  "Computer Vision",
  "Computing Algorithms",
  "Fundamentals of Data Science",
  "Statistics for Data Science",
  "Data Mining",
  "Big Data Analytics",
  "Database Systems Design",
  "Information Retrieval & Search Engines"
];

const INTELLIGENT_SYSTEMS_CAREERS = [
  "AI Engineer",
  "Machine Learning Engineer",
  "Robotics Engineer",
  "Research Engineer"
];

const DATA_SCIENCE_CAREERS = [
  "Data Scientist",
  "Data Analyst",
  "Business Intelligence Engineer",
  "Big Data Engineer"
];

const goldenConversation = [
  {
    id: "DEAN-01",
    query: "I am advising a student interested in artificial intelligence. Which bachelor's programs does the College of Artificial Intelligence offer at El Alamein?",
    required: [
      "College of Artificial Intelligence",
      "Bachelor of Science",
      "Intelligent Systems",
      "Data Science",
      ["4-year", "four-year"],
      "Artificial Intelligence",
      ["Data & Analytics", "data and analytics"]
    ],
    minCitations: 3,
    citationRelations: ["OFFERS", "INCLUDES_PROGRAM"]
  },
  {
    id: "DEAN-02",
    query: "Compare those two for a student choosing between building intelligent systems and working deeply with data.",
    required: PROGRAM_COMPARISON_CHECKPOINTS,
    minCitations: 11,
    citationRelations: ["HAS_COURSE"]
  },
  {
    id: "DEAN-03",
    query: "What careers can the first one lead to?",
    required: ["Intelligent Systems", ...INTELLIGENT_SYSTEMS_CAREERS],
    minCitations: 4,
    citationRelations: ["LEADS_TO"]
  },
  {
    id: "DEAN-04",
    query: "And the second?",
    required: ["Data Science", ...DATA_SCIENCE_CAREERS],
    minCitations: 4,
    citationRelations: ["LEADS_TO"]
  },
  {
    id: "DEAN-05",
    query: "Which of those programs includes Machine Learning?",
    required: ["Intelligent Systems", "Machine Learning", "IN221", "3"],
    minCitations: 1,
    citationRelations: ["HAS_COURSE"]
  },
  {
    id: "DEAN-06",
    query: "What must a student complete before taking it?",
    required: ["Machine Learning", "Fundamentals of AI", "Linear Algebra"],
    forbidden: ["Deep Learning"],
    minCitations: 2,
    citationRelations: ["HAS_PREREQUISITE"]
  },
  {
    id: "DEAN-07",
    query: "If the student is interested in language technology, what is recommended after that?",
    required: ["Natural Language Processing", "Machine Learning", "Intelligent Systems"],
    minCitations: 2,
    citationRelations: ["RECOMMENDED_AFTER", "HAS_COURSE"]
  },
  {
    id: "DEAN-08",
    query: "Who teaches Natural Language Processing?",
    required: ["Hany Hanafy Mahmoud Said", "Natural Language Processing"],
    minCitations: 1,
    citationRelations: ["TEACHES"]
  },
  {
    id: "DEAN-09",
    query: "Does he teach anything else?",
    required: ["Hany Hanafy Mahmoud Said", "Cognitive Computing"],
    minCitations: 1,
    citationRelations: ["TEACHES"]
  },
  {
    id: "DEAN-10",
    query: "Does he hold another role at the college?",
    required: ["Hany Hanafy Mahmoud Said", "Quality Unit"],
    minCitations: 1,
    citationRelations: ["HEAD_OF"]
  },
  {
    id: "DEAN-11",
    query: "Before we finish, who is the dean of the college?",
    required: ["Ali Ali Mohamed Fahmy", "College of Artificial Intelligence"],
    forbidden: ["Ahmed Abdelkhalik Ahmed Abouelfarag"],
    minCitations: 1,
    citationRelations: ["DEAN_OF"]
  },
  {
    id: "DEAN-12",
    query: "Summarize the advice you gave me in three concise bullets.",
    required: [
      "Intelligent Systems",
      "Data Science",
      "Machine Learning",
      "Fundamentals of AI",
      "Linear Algebra",
      "Natural Language Processing",
      "Hany Hanafy Mahmoud Said",
      "Cognitive Computing",
      "Quality Unit",
      "Ali Ali Mohamed Fahmy"
    ],
    expectedRoute: "CONVERSATION",
    requireGrounding: false,
    requireThreeBullets: true,
    maxCitations: 0
  }
];

const standaloneBank = [
  {
    id: "DQB-001",
    query: "Which bachelor's programs does the College of Artificial Intelligence offer at El Alamein?",
    required: ["Bachelor of Science", "Intelligent Systems", "Data Science", ["4-year", "four-year"], "Artificial Intelligence", ["Data & Analytics", "data and analytics"]],
    minCitations: 3,
    citationRelations: ["OFFERS", "INCLUDES_PROGRAM"]
  },
  {
    id: "DQB-002",
    query: "What two programs are included in the Bachelor of Science offered by the College of Artificial Intelligence at El Alamein?",
    required: ["Bachelor of Science", "Intelligent Systems", "Data Science", ["4-year", "four-year"], "BSc"],
    minCitations: 3,
    citationRelations: ["OFFERS", "INCLUDES_PROGRAM"]
  },
  {
    id: "DQB-003",
    query: "Compare the Intelligent Systems and Data Science programs by their main curriculum areas.",
    required: PROGRAM_COMPARISON_CHECKPOINTS,
    minCitations: 11,
    citationRelations: ["HAS_COURSE"]
  },
  {
    id: "DQB-004",
    query: "Compare Intelligent Systems with Data Science for a student choosing between building AI systems and working deeply with data.",
    required: PROGRAM_COMPARISON_CHECKPOINTS,
    minCitations: 11,
    citationRelations: ["HAS_COURSE"]
  },
  {
    id: "DQB-005",
    query: "What career roles can the Intelligent Systems program lead to?",
    required: ["Intelligent Systems", ...INTELLIGENT_SYSTEMS_CAREERS],
    minCitations: 4,
    citationRelations: ["LEADS_TO"]
  },
  {
    id: "DQB-006",
    query: "List all career roles shown for Intelligent Systems.",
    required: ["Intelligent Systems", ...INTELLIGENT_SYSTEMS_CAREERS],
    minCitations: 4,
    citationRelations: ["LEADS_TO"]
  },
  {
    id: "DQB-007",
    query: "What career roles can the Data Science program lead to?",
    required: ["Data Science", ...DATA_SCIENCE_CAREERS],
    minCitations: 4,
    citationRelations: ["LEADS_TO"]
  },
  {
    id: "DQB-008",
    query: "List all career roles shown for Data Science.",
    required: ["Data Science", ...DATA_SCIENCE_CAREERS],
    minCitations: 4,
    citationRelations: ["LEADS_TO"]
  },
  {
    id: "DQB-009",
    query: "Which program includes Machine Learning, and what are its course code and credits?",
    required: ["Intelligent Systems", "Machine Learning", "IN221", "3"],
    minCitations: 1,
    citationRelations: ["HAS_COURSE"]
  },
  {
    id: "DQB-010",
    query: "Does Intelligent Systems include Machine Learning? Give me the course code and credit value.",
    required: ["Intelligent Systems", "Machine Learning", "IN221", "3"],
    minCitations: 1,
    citationRelations: ["HAS_COURSE"]
  },
  {
    id: "DQB-011",
    query: "What are all prerequisites for Machine Learning, course IN221?",
    required: ["Machine Learning", "Fundamentals of AI", "Linear Algebra"],
    forbidden: ["Deep Learning"],
    minCitations: 2,
    citationRelations: ["HAS_PREREQUISITE"]
  },
  {
    id: "DQB-012",
    query: "What must a student complete before taking IN221 Machine Learning?",
    required: ["Machine Learning", "Fundamentals of AI", "Linear Algebra"],
    forbidden: ["Deep Learning"],
    minCitations: 2,
    citationRelations: ["HAS_PREREQUISITE"]
  },
  {
    id: "DQB-013",
    query: "Which course is recommended after Machine Learning for language technology, and which program includes it?",
    required: ["Natural Language Processing", "Machine Learning", "Intelligent Systems"],
    minCitations: 2,
    citationRelations: ["RECOMMENDED_AFTER", "HAS_COURSE"]
  },
  {
    id: "DQB-014",
    query: "Is Computer Vision recommended after Machine Learning?",
    required: ["Computer Vision", "Machine Learning"],
    minCitations: 1,
    citationRelations: ["RECOMMENDED_AFTER"]
  },
  {
    id: "DQB-015",
    query: "Which course is recommended after Natural Language Processing?",
    required: ["Cognitive Computing", "Natural Language Processing"],
    minCitations: 1,
    citationRelations: ["RECOMMENDED_AFTER"]
  },
  {
    id: "DQB-016",
    query: "Who teaches Natural Language Processing?",
    required: ["Hany Hanafy Mahmoud Said", "Natural Language Processing"],
    minCitations: 1,
    citationRelations: ["TEACHES"]
  },
  {
    id: "DQB-017",
    query: "What courses does Hany Hanafy Mahmoud Said teach?",
    required: ["Hany Hanafy Mahmoud Said", "Natural Language Processing", "Cognitive Computing"],
    minCitations: 2,
    citationRelations: ["TEACHES"]
  },
  {
    id: "DQB-018",
    query: "Besides Natural Language Processing, what else does Hany Hanafy Mahmoud Said teach?",
    required: ["Hany Hanafy Mahmoud Said", "Cognitive Computing"],
    minCitations: 1,
    citationRelations: ["TEACHES"]
  },
  {
    id: "DQB-019",
    query: "What other role does Hany Hanafy Mahmoud Said hold at the college?",
    required: ["Hany Hanafy Mahmoud Said", "Quality Unit"],
    minCitations: 1,
    citationRelations: ["HEAD_OF"]
  },
  {
    id: "DQB-020",
    query: "Who is the Head of the Quality Unit at the College of Artificial Intelligence?",
    required: ["Hany Hanafy Mahmoud Said", "Quality Unit"],
    minCitations: 1,
    citationRelations: ["HEAD_OF"]
  },
  {
    id: "DQB-021",
    query: "Who is the dean of the College of Artificial Intelligence?",
    required: ["Ali Ali Mohamed Fahmy", "College of Artificial Intelligence"],
    forbidden: ["Ahmed Abdelkhalik Ahmed Abouelfarag"],
    minCitations: 1,
    citationRelations: ["DEAN_OF"]
  },
  {
    id: "DQB-022",
    query: "Is Ali Ali Mohamed Fahmy the dean of the College of Artificial Intelligence?",
    required: ["Ali Ali Mohamed Fahmy", "Dean", "College of Artificial Intelligence"],
    forbidden: ["Ahmed Abdelkhalik Ahmed Abouelfarag"],
    minCitations: 1,
    citationRelations: ["DEAN_OF"]
  },
  {
    id: "DQB-023",
    query: "Which career role is Natural Language Processing aligned with?",
    required: ["Natural Language Processing", "NLP Engineer"],
    minCitations: 1,
    citationRelations: ["CAREER_ALIGNMENT"]
  },
  {
    id: "DQB-024",
    query: "Which career role is Cognitive Computing aligned with?",
    required: ["Cognitive Computing", "Cognitive AI Engineer"],
    minCitations: 1,
    citationRelations: ["CAREER_ALIGNMENT"]
  }
];

function normalized(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function includesCheckpoint(answer, checkpoint) {
  const options = Array.isArray(checkpoint) ? checkpoint : [checkpoint];
  const text = normalized(answer);
  return options.some(option => text.includes(normalized(option)));
}

function countBullets(answer) {
  return String(answer || "")
    .split(/\r?\n/)
    .filter(line => /^\s*[-*]\s+/.test(line))
    .length;
}

function validate(spec, response, status) {
  const failures = [];
  const answer = String(response?.answer || response?.final_answer || "");
  if (status !== 200) failures.push(`HTTP_${status}`);
  if (!answer.trim()) failures.push("EMPTY_ANSWER");

  for (const checkpoint of spec.required || []) {
    if (!includesCheckpoint(answer, checkpoint)) {
      const label = Array.isArray(checkpoint) ? checkpoint.join(" OR ") : checkpoint;
      failures.push(`MISSING:${label}`);
    }
  }

  for (const forbidden of [...COMMON_FORBIDDEN, ...(spec.forbidden || [])]) {
    if (includesCheckpoint(answer, forbidden)) failures.push(`FORBIDDEN:${forbidden}`);
  }

  const route = String(response?.route || "");
  if (/ERROR|FATAL|LLM/i.test(route)) failures.push(`UNSAFE_ROUTE:${route || "EMPTY"}`);
  if (spec.expectedRoute && route !== spec.expectedRoute) {
    failures.push(`ROUTE:${route || "EMPTY"}!=${spec.expectedRoute}`);
  }

  const citations = Array.isArray(response?.citations) ? response.citations : [];
  if (Number.isFinite(spec.minCitations) && citations.length < spec.minCitations) {
    failures.push(`CITATIONS:${citations.length}<${spec.minCitations}`);
  }
  if (Number.isFinite(spec.maxCitations) && citations.length > spec.maxCitations) {
    failures.push(`CITATIONS:${citations.length}>${spec.maxCitations}`);
  }

  const citationCategories = new Set(
    citations.map(citation => String(citation?.category || "").toUpperCase())
  );
  for (const relation of spec.citationRelations || []) {
    if (!citationCategories.has(relation)) failures.push(`MISSING_CITATION_RELATION:${relation}`);
  }

  if (spec.requireGrounding !== false) {
    const grounding = response?.metadata?.grounding;
    if (grounding?.status !== "fully_supported") {
      failures.push(`GROUNDING:${grounding?.status || "MISSING"}`);
    }
    if ((grounding?.unsupported_sentences || []).length > 0) {
      failures.push("GROUNDING_HAS_UNSUPPORTED_SENTENCES");
    }
    if ((grounding?.conflicting_sentences || []).length > 0) {
      failures.push("GROUNDING_HAS_CONFLICT");
    }
  }

  if (spec.requireThreeBullets && countBullets(answer) !== 3) {
    failures.push(`BULLETS:${countBullets(answer)}!=3`);
  }

  return failures;
}

async function postJson(pathname, body, token = "") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = { answer: "", parse_error: true };
    }
    return { status: response.status, payload };
  } finally {
    clearTimeout(timer);
  }
}

async function issueFreshPrincipal() {
  const studentId = process.env.DEAN_DEMO_STUDENT_ID;
  const password = process.env.DEAN_DEMO_PASSWORD;
  const auth = studentId && password
    ? await postJson("/api/auth/login", { studentId, password })
    : await postJson("/api/auth/guest", {});
  if (auth.status < 200 || auth.status >= 300 || !auth.payload?.token) {
    throw new Error(`Authentication failed with HTTP ${auth.status}: ${JSON.stringify(auth.payload)}`);
  }
  return {
    token: auth.payload.token,
    principal: auth.payload.user || auth.payload.principal || null
  };
}

async function ask(token, query, cid) {
  const startedAt = Date.now();
  const result = await postJson("/api/chatbot/query", { query, cid }, token);
  return {
    ...result,
    latency_ms: Date.now() - startedAt
  };
}

async function runGolden(runNumber) {
  const { token, principal } = await issueFreshPrincipal();
  const cid = `dean-golden-${Date.now()}-${runNumber}-${Math.random().toString(16).slice(2)}`;
  const turns = [];
  for (const spec of goldenConversation) {
    const result = await ask(token, spec.query, cid);
    const failures = validate(spec, result.payload, result.status);
    turns.push({
      id: spec.id,
      query: spec.query,
      status: result.status,
      latency_ms: result.latency_ms,
      pass: failures.length === 0,
      failures,
      response: result.payload
    });
  }
  return {
    run: runNumber,
    principal_subject: principal?.subject || principal?.sub || "fresh-authenticated-principal",
    cid,
    pass: turns.every(turn => turn.pass),
    turns
  };
}

async function runBank(runNumber) {
  const { token, principal } = await issueFreshPrincipal();
  const questions = [];
  for (const spec of standaloneBank) {
    const cid = `dean-bank-${spec.id}-${Date.now()}-${runNumber}-${Math.random().toString(16).slice(2)}`;
    const result = await ask(token, spec.query, cid);
    const failures = validate(spec, result.payload, result.status);
    questions.push({
      id: spec.id,
      query: spec.query,
      cid,
      status: result.status,
      latency_ms: result.latency_ms,
      pass: failures.length === 0,
      failures,
      response: result.payload
    });
  }
  return {
    run: runNumber,
    principal_subject: principal?.subject || principal?.sub || "fresh-authenticated-principal",
    pass: questions.every(question => question.pass),
    questions
  };
}

const report = {
  schema: 1,
  started_at: new Date().toISOString(),
  base_url: baseUrl,
  deployed_commit: deployedCommit,
  suite,
  requested_runs: runs,
  golden: [],
  bank: []
};

try {
  if (!["all", "golden", "bank"].includes(suite)) {
    throw new Error(`Unknown suite '${suite}'. Use all, golden, or bank.`);
  }

  for (let run = 1; run <= runs; run += 1) {
    if (suite === "all" || suite === "golden") {
      console.log(`[DEAN_WOW] Golden conversation run ${run}/${runs}`);
      report.golden.push(await runGolden(run));
    }
    if (suite === "all" || suite === "bank") {
      console.log(`[DEAN_WOW] Standalone question bank run ${run}/${runs}`);
      report.bank.push(await runBank(run));
    }
  }
} catch (error) {
  report.fatal_error = error?.stack || error?.message || String(error);
}

report.completed_at = new Date().toISOString();
const goldenTurns = report.golden.flatMap(run => run.turns || []);
const bankQuestions = report.bank.flatMap(run => run.questions || []);
report.summary = {
  golden_passed: goldenTurns.filter(turn => turn.pass).length,
  golden_total: goldenTurns.length,
  bank_passed: bankQuestions.filter(question => question.pass).length,
  bank_total: bankQuestions.length,
  all_passed:
    !report.fatal_error &&
    goldenTurns.every(turn => turn.pass) &&
    bankQuestions.every(question => question.pass) &&
    (suite === "bank" || goldenTurns.length === goldenConversation.length * runs) &&
    (suite === "golden" || bankQuestions.length === standaloneBank.length * runs)
};

if (outputPath) {
  const resolvedOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`[DEAN_WOW] Raw report saved to ${resolvedOutput}`);
}

console.log(JSON.stringify(report.summary, null, 2));
if (report.fatal_error) console.error(report.fatal_error);
process.exit(report.summary.all_passed ? 0 : 1);
