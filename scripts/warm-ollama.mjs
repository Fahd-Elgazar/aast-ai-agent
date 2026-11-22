import { readFileSync } from "node:fs";

const url = process.env.OLLAMA_BASE_URL ?? "http://host.docker.internal:11434";
const primary = process.env.PRIMARY_MODEL ?? "gemma4:e2b";
const modelNames = [primary, process.env.BACKUP_MODEL ?? "tinyllama:latest", process.env.KG_EMBED_MODEL ?? "nomic-embed-text"];
const timeout = Number(process.env.OLLAMA_WARM_TIMEOUT_MS ?? 240_000);

try {
  const tags = await fetch(new URL("api/tags", url.replace(/\/?$/, "/")), { signal: AbortSignal.timeout(10_000) });
  if (!tags.ok) throw new Error("Ollama model list was unavailable");
  const installed = new Map((await tags.json()).models.map(model => [model.name, model.digest]));
  if (process.env.AAST_ICCTA_PIN_MODELS === "true") {
    const profile = JSON.parse(readFileSync("/profile.json", "utf8"));
    for (const model of profile.models.ollama) {
      if (installed.get(model.name) !== model.sha256) throw new Error("Ollama digest differs for " + model.name);
    }
  }
  const missing = modelNames.filter(model => !installed.has(model.includes(":") ? model : model + ":latest"));
  if (missing.length) throw new Error("Pull these Ollama models first: " + missing.join(", "));

  const warm = await fetch(new URL("api/generate", url.replace(/\/?$/, "/")), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: primary, stream: false, keep_alive: "10m" }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!warm.ok || !(await warm.json()).done) throw new Error("Ollama primary model did not finish warming");
  console.log("PASS Ollama ready and primary model warmed");
} catch (error) {
  console.error("FAIL Ollama readiness: " + error.message);
  process.exitCode = 1;
}
