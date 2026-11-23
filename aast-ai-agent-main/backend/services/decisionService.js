import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { runtimeMode } from "../config/runtimeMode.js";

dotenv.config();

/* ============================================================
   🔐 CONFIG
============================================================ */
const API_URL = process.env.DECISION_API_URL || "http://127.0.0.1:8005";
const SECRET_KEY = process.env.INTERNAL_SECRET_KEY || "your-secret-key-here";

/* ============================================================
   🧠 MEMORY STORE (PER SESSION)
============================================================ */

const MEMORY_FILE = path.join(process.cwd(), "decision_memory.json");
const MAX_SESSIONS = 1000;
const decisionMemory = new Map();
const decisionTimers = new Map();

// Initialize memory from disk
async function initMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = await fs.promises.readFile(MEMORY_FILE, "utf-8");
      const parsed = JSON.parse(data);
      for (const [k, v] of Object.entries(parsed)) {
        decisionMemory.set(k, v);
      }
      console.log(`[Memory] Loaded ${decisionMemory.size} sessions from disk.`);
    }
  } catch (err) {
    console.error("Failed to load persistent memory:", err.message);
  }
}
initMemory();

let saveQueue = Promise.resolve();
let saveScheduled = false;

function scheduleSave() {
  if (saveScheduled) return;
  saveScheduled = true;

  setTimeout(async () => {
    saveScheduled = false;
    await saveMemory();
  }, 300);
}

async function saveMemory() {
  saveQueue = saveQueue.then(async () => {
    try {
      const obj = Object.fromEntries(decisionMemory);
      const tempFile = MEMORY_FILE + ".tmp";
      await fs.promises.writeFile(tempFile, JSON.stringify(obj, null, 2));
      await fs.promises.rename(tempFile, MEMORY_FILE);
    } catch (err) {
      console.error("Failed to save persistent memory:", err.message);
    }
  });
  return saveQueue;
}

function requireDecisionOwner(ownerId) {
  const normalized = typeof ownerId === "string" ? ownerId.trim() : "";
  if (!normalized || normalized.length > 256) throw new Error("A valid decision-memory owner is required");
  return normalized;
}

export function getUserMemory(cid, { ownerId } = {}) {
  const owner = requireDecisionOwner(ownerId);
  const memory = decisionMemory.get(cid);
  return memory?.ownerId === owner ? memory : {};
}

export function getDecisionMemoryStatus() {
  return {
    activeSessions: decisionMemory.size,
    activeTimers: decisionTimers.size,
    maxSessions: MAX_SESSIONS,
    persistenceFile: MEMORY_FILE,
    persistenceQueued: saveScheduled
  };
}

function deepMerge(target = {}, source = {}) {
  const output = { ...target };

  for (const key in source) {
    if (
      typeof source[key] === "object" &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      output[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  }

  return output;
}

export async function updateUserMemory(cid, newData, { ownerId } = {}) {
  const owner = requireDecisionOwner(ownerId);
  const stored = decisionMemory.get(cid);
  if (stored && stored.ownerId !== owner) throw new Error("Decision memory not found");

  const current = stored || {
    ownerId: owner,
    studentProfile: {},
    preferences: {},
    history: [],
    rejected_majors: [],
    liked_majors: [],
    last_recommendation: "",
    version: "v2"
  };
  
  const updated = deepMerge(current, { ...newData, ownerId: owner });
  
  // Custom logic for arrays appending instead of overwriting
  if (newData.history) updated.history = [...new Set([...(current.history || []), ...newData.history])];
  if (newData.rejected_majors) updated.rejected_majors = [...new Set([...(current.rejected_majors || []), ...newData.rejected_majors])];
  if (newData.liked_majors) updated.liked_majors = [...new Set([...(current.liked_majors || []), ...newData.liked_majors])];

  updated.lastActive = Date.now();
  decisionMemory.set(cid, updated);

  if (decisionMemory.size > MAX_SESSIONS) {
    const firstKey = decisionMemory.keys().next().value;
    if (decisionTimers?.has?.(firstKey)) {
      clearTimeout(decisionTimers.get(firstKey));
      decisionTimers.delete(firstKey);
    }
    decisionMemory.delete(firstKey);
  }

  scheduleSave();

  return updated;
}

export async function deleteUserMemory(cid, { ownerId } = {}) {
  const owner = requireDecisionOwner(ownerId);
  const stored = decisionMemory.get(cid);
  if (!stored || stored.ownerId !== owner) return false;

  if (decisionTimers.has(cid)) {
    clearTimeout(decisionTimers.get(cid));
    decisionTimers.delete(cid);
  }

  const deleted = decisionMemory.delete(cid);
  if (deleted) scheduleSave();
  return deleted;
}

/* ============================================================
   🔧 NORMALIZATION
============================================================ */

function normalizeString(str) {
  if (typeof str !== "string") return str;
  return str.toLowerCase().trim();
}

function normalizeData(profile, preferences) {
  const p = profile || {};
  const pref = preferences || {};
  const rawPercentage = p.high_school_percentage ?? p.highSchoolPercentage;
  const parsedPercentage = rawPercentage == null ? null : Number(rawPercentage);

  return {
    studentProfile: {
      certificate_type: normalizeString(p.certificate_type || p.certificateType) || "unknown",
      high_school_percentage: Number.isFinite(parsedPercentage) ? parsedPercentage : null,
      budget: p.budget == null
        ? null
        : Number.isFinite(Number(p.budget))
          ? Number(p.budget)
          : null,
      track_type: normalizeString(p.track_type || p.trackType) || "unknown",
      preferred_branch: normalizeString(p.preferred_branch || p.preferredBranch) || null,
      preferred_city: normalizeString(p.preferred_city || p.preferredCity) || null,
    },
    preferences: {
      interests: (pref.interests || [])
        .filter(i => typeof i === "string")
        .map(normalizeString)
        .filter(Boolean),

      career_goals: (pref.career_goals || pref.careerGoals || [])
        .filter(i => typeof i === "string")
        .map(normalizeString)
        .filter(Boolean),
    }
  };
}

/* ============================================================
   ✅ VALIDATION
============================================================ */

function validateInput(studentProfile) {
  if (!Number.isFinite(studentProfile.high_school_percentage)) {
    const error = new Error("A numeric high school percentage is required");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  if (studentProfile.high_school_percentage < 0 || studentProfile.high_school_percentage > 100) {
    const error = new Error("High school percentage must be between 0 and 100");
    error.code = "INVALID_REQUEST";
    throw error;
  }

  if (studentProfile.budget !== null && (!Number.isFinite(studentProfile.budget) || studentProfile.budget < 0)) {
    const error = new Error("Budget must be a non-negative number");
    error.code = "INVALID_REQUEST";
    throw error;
  }
}

/* ============================================================
   🧠 JSON EXTRACTION (RULE + LLM)
============================================================ */

export async function extractProfileData(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid input text");
  }

  /* ---------- RULE BASED ---------- */
  try {
    let jsonString = null;

    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);

    if (markdownMatch) {
      jsonString = markdownMatch[1];
    } else {
      const match = text.match(/\{[\s\S]*?\}/);

      if (match) {
        return JSON.parse(match[0]);
      }
    }

    if (jsonString) {
      const parsed = JSON.parse(jsonString);
      return parsed;
    }

  } catch {
    console.warn("Rule extraction failed → fallback to LLM");
  }

  /* ---------- LLM FALLBACK ---------- */
  if (!runtimeMode.decisionLlmExtractionEnabled || runtimeMode.singleGemmaGenerationMode || runtimeMode.defenseMode) {
    console.warn("Decision LLM extraction disabled; using deterministic rule extraction only.");
    return null;
  }

  try {
    const prompt = `
Extract student profile and preferences as JSON ONLY:

{
  "studentProfile": {
    "certificate_type": "string",
    "high_school_percentage": number,
    "budget": number,
    "track_type": "string"
  },
  "preferences": {
    "interests": ["string"],
    "career_goals": ["string"]
  }
}

Text:
${text}
`;

    // Keep the model runtime out of structured Decision API requests and unit
    // tests. Natural-language extraction is the only path that needs it.
    const { callOllama } = await import("./ollamaService.js");
    const llmPromise = callOllama(prompt, undefined, `decision_extract_${Date.now()}`, {
      routeType: "DECISION_EXTRACTION",
      trafficType: "decision_extraction",
      timeoutMs: Number(process.env.DECISION_EXTRACT_TIMEOUT_MS || 12000),
      deadlineMs: Number(process.env.DECISION_EXTRACT_DEADLINE_MS || 18000),
      options: {
        temperature: 0,
        top_p: 0.1,
        repeat_penalty: 1.08,
        num_predict: 160,
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("LLM timeout")), 60000)
    );

    const llmResponse = await Promise.race([llmPromise, timeoutPromise]);

    const first = llmResponse.indexOf("{");
    const last = llmResponse.lastIndexOf("}");

    if (first !== -1 && last !== -1) {
      return JSON.parse(llmResponse.substring(first, last + 1));
    }

    throw new Error("Invalid LLM JSON");

  } catch (err) {
    console.warn("Failed to extract profile data:", err.message);
    return null;
  }
}

async function safeExtractProfileData(text) {
  let timeoutId;

  try {
    const timeoutPromise = new Promise(resolve => {
      timeoutId = setTimeout(() => {
        console.warn("Profile extraction timed out after 4 seconds");
        resolve(null);
      }, 4000);
    });

    return await Promise.race([
      extractProfileData(text),
      timeoutPromise
    ]);
  } catch (err) {
    console.warn("Safe profile extraction failed:", err.message);
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function buildCareerRoadmap(profile, preferences, memory) {
  const candidates = [
    profile?.career_roadmap,
    preferences?.career_roadmap,
    memory?.career_roadmap,
    memory?.last_decision?.career_roadmap,
  ];
  const roadmap = candidates.find(candidate => (
    typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)
  ));
  if (!roadmap) return null;

  const targetRoles = cleanWarnings(roadmap.target_roles);
  const topSkills = cleanWarnings(roadmap.top_skills);
  const industryDemand = cleanString(roadmap.industry_demand);
  if (targetRoles.length === 0 || topSkills.length === 0 || !industryDemand) return null;

  const verifiedRoadmap = {
    target_roles: targetRoles,
    top_skills: topSkills,
    industry_demand: industryDemand,
  };
  if (Array.isArray(roadmap.learning_path)) verifiedRoadmap.learning_path = roadmap.learning_path;
  if (Array.isArray(roadmap.timeline)) verifiedRoadmap.timeline = cleanWarnings(roadmap.timeline);
  return verifiedRoadmap;
}

/* ============================================================
   🛡️ DECISION OUTPUT VALIDATOR
============================================================ */

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanWarnings(value) {
  return Array.isArray(value)
    ? value.filter(item => typeof item === "string" && item.trim()).map(item => item.trim())
    : [];
}

function noResultsResponse(data, reason = null) {
  const response = {
    success: true,
    result_status: "no_results",
    recommended_major: null,
    confidence: null,
    score_breakdown: null,
    warnings: cleanWarnings(data?.warnings),
    recommendations: [],
  };

  const upstreamReason = cleanString(reason) || cleanString(data?.reason);
  if (upstreamReason) response.reason = upstreamReason;
  if (Number.isInteger(data?.total_candidates_considered) && data.total_candidates_considered >= 0) {
    response.total_candidates_considered = data.total_candidates_considered;
  }
  return response;
}

function invalidUpstreamResponse(message) {
  const error = new Error(message);
  error.code = "INVALID_UPSTREAM_RESPONSE";
  return error;
}

function isValidRecommendation(item) {
  if (
    !isRecord(item) ||
    !cleanString(item.program_name) ||
    !cleanString(item.college_name) ||
    !cleanString(item.match_type) ||
    !cleanString(item.confidence_level) ||
    !cleanString(item.affordability_label) ||
    !cleanString(item.explanation_summary) ||
    typeof item.score !== "number" ||
    !Number.isFinite(item.score) ||
    item.score < 0 ||
    item.score > 100
  ) return false;

  const fee = item.estimated_semester_fee;
  if (fee !== null && (typeof fee !== "number" || !Number.isFinite(fee) || fee < 0)) return false;
  if (fee !== null && (!cleanString(item.currency) || !cleanString(item.fee_mode))) return false;

  const breakdown = item.score_breakdown;
  if (!isRecord(breakdown)) return false;
  const componentFields = [
    "interest_alignment",
    "affordability",
    "employment_outlook",
    "location_preference",
    "career_flexibility",
    "certificate_compatibility",
    "decision_data_completeness",
    "missing_data_penalty",
    "interest_alignment_contribution",
    "affordability_contribution",
    "employment_outlook_contribution",
    "location_preference_contribution",
    "career_flexibility_contribution",
    "certificate_compatibility_contribution",
    "weighted_subtotal",
    "total",
  ];
  if (componentFields.some(field => (
    typeof breakdown[field] !== "number" ||
    !Number.isFinite(breakdown[field]) ||
    breakdown[field] < 0 ||
    breakdown[field] > 100
  ))) return false;

  const contributionTotal = [
    "interest_alignment_contribution",
    "affordability_contribution",
    "employment_outlook_contribution",
    "location_preference_contribution",
    "career_flexibility_contribution",
    "certificate_compatibility_contribution",
  ].reduce((sum, field) => sum + breakdown[field], 0);
  const tolerance = 0.06;
  return (
    Math.abs(contributionTotal - breakdown.weighted_subtotal) <= tolerance &&
    Math.abs(Math.max(0, breakdown.weighted_subtotal - breakdown.missing_data_penalty) - breakdown.total) <= tolerance &&
    Math.abs(breakdown.total - item.score) <= tolerance
  );
}

export function normalizeDecisionResponse(data, { rejectedMajors = [] } = {}) {
  if (!isRecord(data)) {
    throw invalidUpstreamResponse("Decision API returned an invalid response");
  }

  if (data.success !== true) {
    throw invalidUpstreamResponse("Decision API reported an unsuccessful result");
  }

  if (data.result_status !== "ok" && data.result_status !== "no_results") {
    throw invalidUpstreamResponse("Decision API returned an unknown result status");
  }

  if (!Array.isArray(data.recommendations)) {
    throw invalidUpstreamResponse("Decision API omitted the recommendations array");
  }

  const recommendations = data.recommendations.filter(isValidRecommendation);
  if (recommendations.length !== data.recommendations.length) {
    throw invalidUpstreamResponse("Decision API returned a malformed recommendation");
  }
  const upstreamMajor = cleanString(data.recommended_major);

  if (data.result_status === "no_results") {
    if (
      upstreamMajor ||
      recommendations.length > 0 ||
      data.confidence !== null ||
      data.score_breakdown !== null
    ) {
      throw invalidUpstreamResponse("Decision API returned a contradictory empty result");
    }
    return noResultsResponse(data);
  }

  if (!upstreamMajor || recommendations.length === 0) {
    throw invalidUpstreamResponse("Decision API omitted the recommended program");
  }

  const rejected = new Set(
    rejectedMajors.filter(item => typeof item === "string" && item.trim())
  );
  let selectedRecommendation = recommendations.find(item => {
    const programName = cleanString(item.program_name);
    return programName && programName === upstreamMajor;
  });
  if (!selectedRecommendation) {
    throw invalidUpstreamResponse("Decision API recommendation does not match the selected program");
  }
  let selectedMajor = upstreamMajor;

  if (selectedMajor && rejected.has(selectedMajor)) {
    selectedRecommendation = recommendations.find(item => {
      const programName = cleanString(item.program_name);
      return programName && !rejected.has(programName);
    });
    selectedMajor = cleanString(selectedRecommendation?.program_name);
    if (!selectedMajor) {
      return noResultsResponse(data, "All returned programs were previously rejected.");
    }
  }

  if (!selectedMajor) {
    throw invalidUpstreamResponse("Decision API omitted the recommended program");
  }

  const response = {
    success: true,
    result_status: "ok",
    recommended_major: selectedMajor,
    recommendations,
    warnings: cleanWarnings(selectedRecommendation?.warnings ?? data.warnings),
  };

  response.confidence = selectedRecommendation.score;

  const reason = cleanString(selectedRecommendation?.explanation_summary) || cleanString(data.reason);
  if (reason) response.reason = reason;

  const scoreBreakdown = selectedRecommendation?.score_breakdown ?? data.score_breakdown;
  if (isRecord(scoreBreakdown)) response.score_breakdown = scoreBreakdown;

  if (Number.isInteger(data.total_candidates_considered) && data.total_candidates_considered >= 0) {
    response.total_candidates_considered = data.total_candidates_considered;
  }

  return response;
}

export function decisionFailureResponse(error) {
  if (error?.code === "INVALID_REQUEST" || error?.code === "UPSTREAM_VALIDATION") {
    return {
      success: false,
      result_status: "invalid_request",
      error_code: "INVALID_REQUEST",
      message: error?.code === "INVALID_REQUEST"
        ? error.message
        : "The decision request was rejected as invalid.",
    };
  }

  const timedOut = error?.name === "AbortError";
  return {
    success: false,
    result_status: "unavailable",
    error_code: timedOut ? "DECISION_TIMEOUT" : "DECISION_UNAVAILABLE",
    message: timedOut
      ? "The decision service timed out."
      : "The decision service is unavailable.",
  };
}

export function toOrchestratorDecisionEvidence(result) {
  if (
    !isRecord(result) ||
    result.success !== true ||
    result.result_status !== "ok" ||
    !cleanString(result.recommended_major) ||
    !cleanString(result.reason) ||
    typeof result.confidence !== "number" ||
    !Number.isFinite(result.confidence) ||
    result.confidence < 0 ||
    result.confidence > 100
  ) return null;

  return {
    recommendation: `Recommended Major: ${result.recommended_major}. Reason: ${result.reason}`,
    confidence: result.confidence / 100,
    factors: result,
  };
}

export async function requestDecisionApi({
  studentProfile,
  preferences,
  timeoutMs,
  maxAttempts,
  fetchImpl = fetch,
  apiUrl = API_URL,
  secretKey = SECRET_KEY,
}) {
  let lastResponse;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(`${apiUrl}/api/v1/decisions/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": secretKey,
        },
        body: JSON.stringify({
          student_profile: studentProfile,
          preferences,
        }),
        signal: controller.signal,
      });
      lastResponse = response;

      if (!response.ok) continue;

      // Keep the same deadline active through body consumption. A server that
      // sends headers and then stalls must not hold this request indefinitely.
      return await response.json();
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const error = new Error("Decision API request failed");
  error.code = lastResponse?.status === 400 || lastResponse?.status === 422
    ? "UPSTREAM_VALIDATION"
    : "UPSTREAM_UNAVAILABLE";
  throw error;
}

/* ============================================================
   🚀 MAIN FUNCTION
============================================================ */

function safeMerge(base = {}, update = {}) {
  const result = { ...base };
  for (const key in update) {
    if (update[key] !== undefined && update[key] !== null) {
      result[key] = update[key];
    }
  }
  return result;
}

export async function getRecommendation({ studentProfile: inputSP, preferences: inputPref, text, memory, cid, ownerId, requestId = "none" }) {
  try {
    let studentProfile;
    let preferences;

    /* ========================================================
       🧠 HANDLE TEXT INPUT + MEMORY MERGE
    ======================================================== */

    if (text) {
      const mem = memory || {};
      studentProfile = mem.studentProfile || {};
      preferences = mem.preferences || {};

      const hasEnoughData =
        studentProfile?.high_school_percentage != null &&
        studentProfile?.budget != null &&
        preferences?.interests?.length > 0;

      let extracted = null;
      if (!hasEnoughData && text && text.length > 10) {
        console.log(`[DECISION][${requestId}] Trying LLM extraction...`);
        extracted = await safeExtractProfileData(text);
      } else {
        console.log(`[DECISION][${requestId}] Skipping LLM extraction`);
      }

      if (extracted) {
        studentProfile = safeMerge(
          studentProfile,
          extracted.studentProfile || extracted.student_profile
        );

        preferences = safeMerge(
          preferences,
          extracted.preferences
        );
      }

      /* ---------- Missing Data ---------- */
      const missing_fields = [];
      if (!studentProfile.high_school_percentage && studentProfile.high_school_percentage !== 0) missing_fields.push("high school percentage");
      if (!studentProfile.budget && studentProfile.budget !== 0) missing_fields.push("budget");

      if (missing_fields.length > 0) {
        return {
          success: false,
          is_missing_data: true,
          missing_fields,
        };
      }
    } else {
      studentProfile = inputSP;
      preferences = inputPref || {};
    }

    /* ========================================================
       🔧 NORMALIZE + VALIDATE
    ======================================================== */

    const { studentProfile: sp, preferences: pref } = normalizeData(studentProfile, preferences);

    validateInput(sp);

    console.time(`[DECISION][${requestId}]`);

    /* ========================================================
       🌐 API CALL (WITH TIMEOUT)
    ======================================================== */

    const decisionTimeoutMs = Number(process.env.DECISION_API_TIMEOUT_MS || 7000);
    const decisionMaxAttempts = Math.max(1, Number(process.env.DECISION_API_MAX_ATTEMPTS || 1));
    const data = await requestDecisionApi({
      studentProfile: sp,
      preferences: pref,
      timeoutMs: decisionTimeoutMs,
      maxAttempts: decisionMaxAttempts,
    });

    console.timeEnd(`[DECISION][${requestId}]`);

    /* ========================================================
       🧠 SAVE MEMORY
    ======================================================== */

    const memCacheCheck = cid ? getUserMemory(cid, { ownerId }) : null;
    const normalizedResult = normalizeDecisionResponse(data, {
      rejectedMajors: memCacheCheck?.rejected_majors || [],
    });

    if (cid && normalizedResult.result_status === "ok") {
      await updateUserMemory(cid, {
        studentProfile: sp,
        preferences: pref,
        last_recommendation: normalizedResult.recommended_major,
      }, { ownerId });
    }

    /* ========================================================
       ✅ SUCCESS RESPONSE
    ======================================================== */
    return normalizedResult;

  } catch (err) {
    if (err.name === "AbortError") {
      console.error(`[ERROR][${requestId}] ⏱ Decision API Timeout`);
    } else {
      console.error(`[ERROR][${requestId}] Decision Error:`, err.message);
    }

    return decisionFailureResponse(err);
  }
}

/* ============================================================
   🚀 NEXT STEP GENERATOR
============================================================ */

export function generateNextSteps(upstreamSteps) {
  return cleanWarnings(upstreamSteps);
}

/* ============================================================
   🚀 WHAT-IF SIMULATION ENGINE
============================================================ */
export function compareMajors() {
  return {
    success: false,
    result_status: "unsupported",
    reason: "No verified comparison data was provided by the Decision API.",
  };
}
