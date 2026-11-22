import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, parseEnv } from "node:util";

const root = fileURLToPath(new URL("..", import.meta.url));
const envFile = path.join(root, ".env.iccta.local");
const profileFile = path.join(root, "research", "conversation-baseline", "profile.json");
const project = process.env.AAST_CONFERENCE_PROJECT ?? "aast-iccta-2026";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const corpusFields = ["title", "content", "category", "subcategory", "priority", "document_type",
  "program_level", "source", "quality_score", "tags"];

function docker(args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync("docker", args, {
    cwd: root, encoding: "utf8", stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw new Error("Cannot run Docker: " + result.error.message);
  if (result.status !== 0 && !allowFailure) throw new Error("Docker command failed: " + args[0]);
  return result;
}

function compose(args, options) {
  return docker(["compose", "-p", project, "--env-file", envFile, "-f", "docker-compose.yml", ...args], options);
}

function localSettings(file) {
  return existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
}

function initEnv(dataDirectory) {
  if (existsSync(envFile)) return;
  const template = readFileSync(path.join(root, ".env.docker.example"), "utf8");
  const replacements = {
    AAST_DATA_DIR: dataDirectory.split(path.sep).join("/"),
    AAST_ICCTA_PIN_MODELS: "true",
    AAST_FRONTEND_PORT: "15173",
    AAST_BACKEND_PORT: "18004",
    AAST_DECISION_PORT: "18005",
    AAST_RETRIEVER_PORT: "18001",
    AAST_RAG_ANSWER_PORT: "18002",
    AAST_QDRANT_PORT: "16333",
    AAST_NEO4J_HTTP_PORT: "17474",
    AAST_NEO4J_BOLT_PORT: "17687",
    NEO4J_HEAP_INITIAL: "256m",
    NEO4J_HEAP_MAX: "768m",
    NEO4J_PAGECACHE: "256m",
    NEO4J_PASSWORD: randomBytes(24).toString("hex"),
    INTERNAL_SECRET_KEY: randomBytes(32).toString("hex"),
    AUTH_JWT_SECRET: randomBytes(32).toString("hex"),
  };
  assert(!/["\r\n$]/.test(replacements.AAST_DATA_DIR), "Fixture path contains unsupported characters");
  const output = template.replace(/^([A-Z_]+)=.*$/gm, (line, key) =>
    Object.hasOwn(replacements, key) ? key + "=" + JSON.stringify(replacements[key]) : line);
  writeFileSync(envFile, output, { flag: "wx", mode: 0o600 });
}

function readProfile() {
  return JSON.parse(readFileSync(profileFile, "utf8"));
}

function config() {
  assert(/^aast-iccta-[a-z0-9_-]*$/.test(project), "Use an isolated project name starting with aast-iccta-");
  assert(existsSync(envFile), "Start the conference stack first");
  return JSON.parse(compose(["config", "--format", "json"], { capture: true }).stdout);
}

function serviceUrl(conf, service, target) {
  const binding = conf.services[service]?.ports?.find(port => Number(port.target) === target);
  assert(binding && binding.host_ip === "127.0.0.1", "Expected loopback port for " + service);
  return "http://127.0.0.1:" + binding.published;
}

async function request(url, options = {}, timeout = 30_000) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
}

async function json(url, options, timeout) {
  const response = await request(url, options, timeout);
  assert(response.ok, new URL(url).pathname + " returned HTTP " + response.status);
  return response.json();
}

function post(body, headers = {}) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

function verifiedFile(dir, item) {
  assert(item?.file && item.sha256 && Number.isInteger(item.bytes), "Fixture identity is pending");
  assert(path.basename(item.file) === item.file, "Invalid fixture filename");
  const name = path.join(dir, item.file);
  const bytes = readFileSync(name);
  assert(bytes.length === item.bytes && sha256(bytes) === item.sha256, "Fixture checksum mismatch: " + item.file);
  return { name, bytes };
}

function typedGraph(profile) {
  const query = [
    "MATCH (a)-[:HAS_COURSE]->(b)",
    "WHERE a.name = 'Intelligent Systems' AND b.name = 'Machine Learning' AND b.id = $id",
    "WITH count(*) AS courses",
    "MATCH ()-[r]->()",
    "WITH courses, count(r) AS edges, count(CASE WHEN type(r) = 'RECOMMENDED_AFTER' THEN 1 END) AS sequences",
    "MATCH (n)",
    "RETURN toString(courses) + ':' + toString(sequences) + ':' + toString(count(n)) + ':' + toString(edges) AS proof",
  ].join(" ");
  const proof = compose([
    "exec", "-T", "neo4j", "sh", "-ec",
    'cypher-shell --format plain -d neo4j -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" --param "$1" "$2"',
    "neo4j-proof", "{id: '" + profile.neo4j.evidence.machineLearningGraphId + "'}", query,
  ], { capture: true }).stdout.trim().split(/\r?\n/).at(-1);
  assert.equal(proof?.replace(/"/g, ""),
    [1, profile.neo4j.recommendedAfter, profile.neo4j.nodes, profile.neo4j.relationships].join(":"));
}

function normalizeUuid(id) {
  return String(id).toLowerCase().replace(/-/g, "");
}

async function verifyQdrant(base, profile, corpus) {
  const collection = base + "/collections/" + profile.qdrant.collection;
  const count = await json(collection + "/points/count", post({ exact: true }));
  const details = (await json(collection)).result;
  assert.equal(count.result.count, profile.qdrant.points, "Unexpected Qdrant point count");
  assert.equal(details.config.params.vectors.size, profile.qdrant.dimensions, "Unexpected Qdrant vector size");
  assert.equal(details.config.params.vectors.distance, profile.qdrant.distance, "Unexpected Qdrant distance");
  const expected = profile.qdrant.evidence;
  const calendar = (await json(collection + "/points/" + expected.calendar)).result;
  assert.match(calendar.payload.title, /Official Academic Calendar/i);

  if (corpus) {
    const all = (await json(collection + "/points/scroll", post({ limit: profile.qdrant.points + 1, with_vector: false, with_payload: true }))).result;
    const byId = new Map(all.points.map(point => [normalizeUuid(point.id), point.payload]));
    assert.equal(all.next_page_offset, null);
    assert.equal(byId.size, corpus.length);
    for (const { id, ...chunk } of corpus) {
      const payload = byId.get(normalizeUuid(id));
      assert(payload, "Restored Qdrant fixture is missing an expected point");
      const matching = corpusFields.every(key =>
        Object.hasOwn(payload, key) && JSON.stringify(payload[key]) === JSON.stringify(chunk[key]));
      assert(matching, "Restored Qdrant fixture payload does not match the corpus");
    }
    for (const id of [expected.probation, ...expected.scholarship]) {
      assert(byId.has(normalizeUuid(id)), "An expected policy point is missing");
    }
  }
}

async function restoreQdrant(base, profile, dataDirectory, corpus, corpusName, reingest) {
  const collection = base + "/collections/" + profile.qdrant.collection;
  const current = await request(collection);
  if (current.ok) {
    await verifyQdrant(base, profile, corpus);
    console.log("PASS existing Qdrant collection matches approved fixtures");
    return;
  }
  assert.equal(current.status, 404, "Could not inspect Qdrant collection");
  if (reingest) {
    compose(["run", "--rm", "--build", "--no-deps", "--volume",
      corpusName + ":/run/private/corpus.json:ro", "rag-corpus-ingest"]);
  } else {
    const { bytes } = verifiedFile(dataDirectory, profile.qdrant.snapshot);
    const form = new FormData();
    form.append("snapshot", new Blob([bytes]), profile.qdrant.snapshot.file);
    const installed = await json(collection + "/snapshots/upload?priority=snapshot&wait=true", {
      method: "POST", body: form,
    }, 180_000);
    assert.equal(installed.result, true, "Qdrant did not confirm the snapshot restore");
  }
  await verifyQdrant(base, profile, corpus);
  console.log("PASS Qdrant restored and matched the approved corpus");
}

export async function smoke() {
  const conf = config();
  const profile = readProfile();
  const frontend = serviceUrl(conf, "frontend", 5173);
  const qdrant = serviceUrl(conf, "qdrant", 6333);
  const retriever = serviceUrl(conf, "rag-retriever", 8001);
  const decisions = serviceUrl(conf, "decision-api", 8005);
  assert((await request(frontend + "/")).ok, "Frontend / failed");
  console.log("PASS frontend /");
  const health = await json(frontend + "/api/health");
  assert.equal(health.ok, true, "Advisor readiness reported unhealthy");
  console.log("PASS /api/health");
  typedGraph(profile);
  console.log("PASS Neo4j HAS_COURSE and RECOMMENDED_AFTER");
  assert((await request(qdrant + "/readyz")).ok, "Qdrant /readyz failed");
  await verifyQdrant(qdrant, profile);
  console.log("PASS Qdrant /readyz and official calendar passage");
  await json(retriever + "/health", {}, 120_000);
  const search = await json(retriever + "/search", post({ query: "Official Academic Calendar", top_k: 5 }), 120_000);
  assert(search.results?.some(result => /Official Academic Calendar/i.test(result.title)), "Retriever did not return the calendar passage");
  console.log("PASS retriever /health and /search calendar evidence");
  await json(decisions + "/health");
  console.log("PASS Decision /health");

  const guest = await json(frontend + "/api/auth/guest", post({}));
  assert(guest.token, "Advisor did not issue a guest token");
  const headers = { Authorization: "Bearer " + guest.token };
  const turns = [
    "Which bachelor's programs does the College of Artificial Intelligence offer at El Alamein?",
    "What careers can the first one lead to?",
    "Which program includes Machine Learning, and what are its course code and credits?",
  ];
  let cid;
  for (const [index, query] of turns.entries()) {
    const answer = await json(frontend + "/api/chatbot/query", post({ query, cid }, headers), 120_000);
    assert(typeof answer.answer === "string" && answer.answer.trim() && answer.cid, "Missing assistant response or CID");
    if (cid) assert.equal(answer.cid, cid, "Advisor changed the conversation ID");
    cid = answer.cid;
    console.log("PASS advisor turn " + (index + 1) + " of 3 (same CID)");
  }
}

async function start() {
  const { values } = parseArgs({ options: { "data-dir": { type: "string" }, reingest: { type: "boolean" } } });
  const requested = values["data-dir"] ?? process.env.AAST_DATA_DIR ??
    localSettings(envFile).AAST_DATA_DIR ?? localSettings(path.join(root, ".env")).AAST_DATA_DIR;
  assert(requested && path.isAbsolute(requested), "Set AAST_DATA_DIR to the absolute private fixture directory");
  const dataDirectory = existsSync(requested) ? realpathSync(requested) : path.resolve(requested);
  const fromRepo = path.relative(realpathSync(root), dataDirectory);
  assert(fromRepo === ".." || fromRepo.startsWith(".." + path.sep) || path.isAbsolute(fromRepo),
    "Keep the private fixture directory outside the code checkout");
  const profile = readProfile();
  const graph = verifiedFile(dataDirectory, profile.neo4j.dump);
  const corpusFile = verifiedFile(dataDirectory, profile.qdrant.corpus);
  if (!values.reingest) verifiedFile(dataDirectory, profile.qdrant.snapshot);
  const corpus = JSON.parse(corpusFile.bytes);
  assert(Array.isArray(corpus), "Expected the approved array of corpus chunks");
  initEnv(dataDirectory);
  const conf = config();
  const qdrant = serviceUrl(conf, "qdrant", 6333);
  const containers = compose(["ps", "--status", "running", "-q", "neo4j"], { capture: true }).stdout.trim();
  if (!containers) {
    compose([
      "run", "--rm", "--no-deps", "--volume", graph.name + ":/backups/neo4j.dump:ro",
      "neo4j", "bash", "-ec",
      "if test ! -f /data/databases/neo4j/neostore; then neo4j-admin database load neo4j --from-path=/backups; fi",
    ]);
  }
  compose(["up", "-d", "--wait", "--wait-timeout", "180", "qdrant", "neo4j"]);
  typedGraph(profile);
  await restoreQdrant(qdrant, profile, dataDirectory, corpus, corpusFile.name, values.reingest);
  compose(["up", "-d", "--build", "--wait", "--wait-timeout", "240", "decision-api"]);
  compose([
    "run", "--rm", "--no-deps", "--entrypoint", "python",
    "--volume", path.join(root, "scripts", "seed-conference-decision.py") + ":/run/iccta/seed.py:ro",
    "--volume", path.join(root, "college-decision-system-backend", "tests", "fixtures", "decision_seed.py") + ":/run/iccta/decision_seed.py:ro",
    "-e", "PYTHONPATH=/app", "decision-api", "/run/iccta/seed.py",
  ]);
  compose(["up", "-d", "--build", "--wait", "--wait-timeout", "600"]);
  await smoke();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await start();
  } catch (error) {
    console.error("FAIL " + error.message);
    process.exitCode = 1;
  }
}
