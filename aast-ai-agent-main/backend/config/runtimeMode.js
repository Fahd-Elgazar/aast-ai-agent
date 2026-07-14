import dotenv from "dotenv";

dotenv.config();

function booleanFromEnv(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== "string") return fallback;

  if (/^(1|true|yes|on)$/i.test(raw)) return true;
  if (/^(0|false|no|off)$/i.test(raw)) return false;

  return fallback;
}

function stringFromEnv(name, fallback) {
  const raw = process.env[name];
  return typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
}

const defenseMode = booleanFromEnv("DEFENSE_MODE", false);
const singleGemmaGenerationMode = booleanFromEnv("SINGLE_GEMMA_GENERATION_MODE", true);
const primaryLlmProvider =
  stringFromEnv("PRIMARY_LLM_PROVIDER", "gemma").toLowerCase() === "gemini"
    ? "gemini"
    : "gemma";

export const runtimeMode = Object.freeze({
  defenseMode,
  singleGemmaGenerationMode,
  primaryLlmProvider,
  geminiBackupEnabled: booleanFromEnv("GEMINI_BACKUP_ENABLED", true),
  llmIntentEnabled: booleanFromEnv("LLM_INTENT_ENABLED", false),
  graphRefineEnabled: booleanFromEnv("KG_GRAPH_REFINE_ENABLED", false),
  safeReformatEnabled: booleanFromEnv("KG_SAFE_REFORMAT_ENABLED", false),
  ragAnswerEngineEnabled: booleanFromEnv("RAG_ANSWER_ENGINE_ENABLED", false),
  decisionLlmExtractionEnabled: booleanFromEnv("DECISION_LLM_EXTRACTION_ENABLED", false),
  humanizerEnabled: booleanFromEnv("GEMINI_HUMANIZER_ENABLED", false),
  // RC-12: when true (default), LLM synthesis samples greedily (temperature 0)
  // so an identical prompt yields identical output. Set DETERMINISTIC_SYNTHESIS=false
  // to restore the route-adaptive 0.10-0.18 temperature profile.
  deterministicSynthesis: booleanFromEnv("DETERMINISTIC_SYNTHESIS", true),
});

export function getRuntimeModeStatus() {
  return Object.freeze({
    runtimeModeLoaded: true,
    ...runtimeMode,
    primaryModel: stringFromEnv(
      "PRIMARY_MODEL",
      stringFromEnv("OLLAMA_MODEL", "gemma4:e2b")
    ),
    backupModel: stringFromEnv(
      "BACKUP_MODEL",
      stringFromEnv("OLLAMA_BACKUP_MODEL", "tinyllama:latest")
    ),
  });
}

export function isSingleGemmaGenerationMode() {
  return runtimeMode.singleGemmaGenerationMode;
}

export function isGeminiBackupEnabled() {
  return runtimeMode.geminiBackupEnabled;
}

export default runtimeMode;
