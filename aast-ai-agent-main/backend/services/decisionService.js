import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { callOllama } from "./ollamaService.js";

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
      const now = Date.now();
      const ttl = 3 * 60 * 60 * 1000;
      
      for (const [k, v] of Object.entries(parsed)) {
        const lastActive = v.lastActive || now;
        const remaining = (lastActive + ttl) - now;
        
        if (remaining <= 0) {
          continue;
        }
        
        decisionMemory.set(k, v);
        const timer = setTimeout(async () => {
          decisionMemory.delete(k);
          decisionTimers.delete(k);
          scheduleSave();
        }, remaining);
        decisionTimers.set(k, timer);
      }
      console.log(`[Memory] Loaded ${decisionMemory.size} sessions from disk.`);
      scheduleSave();
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

export function getUserMemory(cid) {
  return decisionMemory.get(cid) || {};
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

export async function updateUserMemory(cid, newData) {
  const current = decisionMemory.get(cid) || {
    studentProfile: {},
    preferences: {},
    history: [],
    rejected_majors: [],
    liked_majors: [],
    last_recommendation: "",
    version: "v2"
  };
  
  const updated = deepMerge(current, newData);
  
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

  if (decisionTimers.has(cid)) {
    clearTimeout(decisionTimers.get(cid));
  }
  const timer = setTimeout(async () => {
    decisionMemory.delete(cid);
    decisionTimers.delete(cid);
    scheduleSave();
  }, 3 * 60 * 60 * 1000);
  decisionTimers.set(cid, timer);

  return updated;
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

  return {
    studentProfile: {
      certificate_type: normalizeString(p.certificate_type || p.certificateType) || "unknown",
      high_school_percentage: parseFloat(p.high_school_percentage || p.highSchoolPercentage) || 0,
      budget: p.budget == null
        ? null
        : Number.isFinite(Number(p.budget))
          ? Number(p.budget)
          : null,
      track_type: normalizeString(p.track_type || p.trackType) || "unknown",
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
  if (studentProfile.high_school_percentage < 0 || studentProfile.high_school_percentage > 100) {
    throw new Error("Invalid high school percentage");
  }

  if (studentProfile.budget < 0) {
    throw new Error("Invalid budget");
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

    const llmPromise = callOllama(prompt);

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

/* ============================================================
   🚀 DYNAMIC CAREER ROADMAP ENGINE
============================================================ */

function generateRoles(profile, pref) {
  const interests = (pref?.interests || []).join(" ").toLowerCase();
  
  if (interests.includes("ai") || interests.includes("robotics") || interests.includes("data") || interests.includes("compute")) {
    return ["AI Engineer", "Data Scientist", "Systems Architect"];
  }
  if (interests.includes("business") || interests.includes("manage") || interests.includes("finance")) {
    return ["Business Analyst", "Product Manager", "Operations Consultant"];
  }
  if (interests.includes("design") || interests.includes("art") || interests.includes("create")) {
    return ["UX/UI Designer", "Creative Lead", "Frontend Developer"];
  }
  if (interests.includes("engineering") || interests.includes("build") || interests.includes("machine")) {
    return ["Mechanical Engineer", "Project Architect", "Drilling Engineer"];
  }
  
  return ["Industry Specialist", "Technical Consultant", "Project Coordinator"];
}

function generateSkills(profile, pref) {
  const interests = (pref?.interests || []).join(" ").toLowerCase();
  
  if (interests.includes("ai") || interests.includes("data") || interests.includes("compute")) {
    return ["Python", "Machine Learning", "Neural Networks", "Data Engineering"];
  }
  if (interests.includes("business")) {
    return ["Strategic Planning", "Financial Modeling", "Agile Management"];
  }
  if (interests.includes("engineering")) {
    return ["CAD Operations", "Structural Analysis", "Project Management"];
  }
  
  return ["Problem Solving", "Critical Thinking", "Digital Literacy"];
}

function estimateMarket(profile) {
  return "High Growth trajectory in Egypt/MENA with strong global remote-work integration.";
}

const skills_map = {
  "analysis": ["Python for Data Science", "SQL Fundamentals", "Data Visualization (Tableau/PowerBI)"],
  "ai & ml": ["Linear Algebra", "Neural Networks basics", "PyTorch or TensorFlow"],
  "machine learning": ["Linear Algebra", "Neural Networks basics", "PyTorch or TensorFlow"],
  "software development": ["Git & GitHub", "Clean Code Principles", "Unit Testing"],
  "petroleum engineering": ["Reservoir Simulation basics", "Well Logging interpretation", "Petrel Software intro"],
  "business & management": ["Project Management (PMP basics)", "Strategic Thinking", "Financial Accounting"],
  "python": ["Python Syntax Basics", "Data Structures", "Object-Oriented Programming (OOP)"],
  "neural networks": ["Mathematics for ML", "Deep Learning Architectures", "Model Optimization"],
  "data engineering": ["Database Design", "ETL Pipelines", "Cloud Infrastructure (AWS/Azure)"],
  "strategic planning": ["SWOT Analysis", "Goal Setting Frameworks", "Market Research"],
  "financial modeling": ["Excel mastery", "Valuation methodologies", "Forecasting techniques"],
  "agile management": ["Scrum Framework", "Sprint Planning", "Jira/Trello usage"],
  "cad operations": ["AutoCAD Basics", "3D Modeling", "Drafting Standards"],
  "structural analysis": ["Statics & Dynamics", "Material Science", "Finite Element Analysis (FEA)"],
  "project management": ["Risk Assessment", "Resource Allocation", "Timeline Management"],
  "problem solving": ["Root Cause Analysis", "Logical Reasoning", "Algorithm Design"],
  "critical thinking": ["Information Evaluation", "Bias Identification", "Decision Matrix Analysis"],
  "digital literacy": ["Office Suites", "Basic Scripting", "Cybersecurity Awareness"]
};

function mapSkillsToLearning(skillsArray) {
  if (!skillsArray || !Array.isArray(skillsArray)) return [];
  
  return skillsArray.map(skill => {
    const key = String(skill).toLowerCase().trim();
    const steps = skills_map[key] || ["Online research and specialized courses"];
    return { skill, steps };
  });
}

function generateTimeline(profile) {
  return [
    "University Fundamentals (Years 1-2)",
    "Specialization & Internships (Years 3-4)",
    "Junior Role Placement (Post-Graduation)"
  ];
}

export function buildCareerRoadmap(profile, preferences, memory) {
  // Graceful fallback processing securely combining tracked stats
  const safeProfile = profile || memory?.studentProfile || {};
  const safePref = preferences || memory?.preferences || {};
  
  const generatedSkills = generateSkills(safeProfile, safePref);
  
  return {
    target_roles: generateRoles(safeProfile, safePref),
    top_skills: generatedSkills,
    industry_demand: estimateMarket(safeProfile),
    learning_path: mapSkillsToLearning(generatedSkills),
    timeline: generateTimeline(safeProfile)
  };
}

/* ============================================================
   🛡️ DECISION OUTPUT VALIDATOR
============================================================ */

function safeDecision(rawOutput, fallbackMajor) {
  const safeConfidence = Math.min(Math.max(Number(rawOutput.confidence) || 50, 0), 100);
  const safeMajor = typeof rawOutput.recommended_major === "string" && rawOutput.recommended_major ? rawOutput.recommended_major : fallbackMajor;
  const rawTopRecommendations = Array.isArray(rawOutput.top_recommendations)
    ? rawOutput.top_recommendations
    : Array.isArray(rawOutput.candidates)
      ? rawOutput.candidates
      : Array.isArray(rawOutput.score_breakdown?.candidates)
        ? rawOutput.score_breakdown.candidates
      : [];

  let topRecommendations = rawTopRecommendations
    .map(item => {
      const major = typeof item?.major === "string"
        ? item.major
        : typeof item?.recommended_major === "string"
          ? item.recommended_major
          : typeof item?.name === "string"
            ? item.name
            : null;
      const rawScore = item?.score ?? item?.confidence ?? item?.match_score;
      const score = Math.min(Math.max(Number(rawScore) || safeConfidence, 0), 100);

      if (!major) return null;
      return { major, score };
    })
    .filter(Boolean)
    .slice(0, 3);

  if (topRecommendations.length === 0) {
    topRecommendations = [
      { major: safeMajor, score: safeConfidence },
      { major: Array.isArray(rawOutput.alternatives) && rawOutput.alternatives[0] ? rawOutput.alternatives[0] : safeMajor, score: Math.max(safeConfidence - 4, 0) },
      { major: Array.isArray(rawOutput.alternatives) && rawOutput.alternatives[1] ? rawOutput.alternatives[1] : safeMajor, score: Math.max(safeConfidence - 7, 0) }
    ];
  }

  topRecommendations = topRecommendations
    .filter((item, index, array) => item.major && array.findIndex(entry => entry.major === item.major) === index)
    .slice(0, 3);

  if (topRecommendations.length < 3) {
    const fallbackMajors = [
      safeMajor,
      ...(Array.isArray(rawOutput.alternatives) ? rawOutput.alternatives : []),
      fallbackMajor,
      "Information Technology",
      "Business Administration"
    ];

    for (const major of fallbackMajors) {
      if (!major || topRecommendations.some(item => item.major === major)) continue;
      topRecommendations.push({
        major,
        score: Math.max(safeConfidence - (topRecommendations.length * 4), 0)
      });
      if (topRecommendations.length === 3) break;
    }
  }
  
  return {
    success: true,
    recommended_major: safeMajor,
    confidence: safeConfidence,
    top_recommendations: topRecommendations,
    reason: rawOutput.reason || "Recommended based on your academic profile match.",
    warnings: Array.isArray(rawOutput.warnings) ? rawOutput.warnings : [],
    pros: Array.isArray(rawOutput.pros) ? rawOutput.pros : ["Aligns well with recent academic track records."],
    cons_and_risks: Array.isArray(rawOutput.cons_and_risks) ? rawOutput.cons_and_risks : ["Standard university workload and prerequisites."],
    alternatives: Array.isArray(rawOutput.alternatives) && rawOutput.alternatives.length > 0 ? rawOutput.alternatives : ["General Program", "Information Technology"],
    career_roadmap: typeof rawOutput.career_roadmap === "object" && rawOutput.career_roadmap !== null 
      ? rawOutput.career_roadmap 
      : { target_roles: ["Professional"], top_skills: ["Analysis"], industry_demand: "Stable demand." },
    confidence_breakdown: typeof rawOutput.confidence_breakdown === "object" && rawOutput.confidence_breakdown 
      ? rawOutput.confidence_breakdown 
      : { overall: safeConfidence },
    next_steps: Array.isArray(rawOutput.next_steps) && rawOutput.next_steps.length > 0 ? rawOutput.next_steps : ["Consult with an academic advisor."]
  };
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

export async function getRecommendation({ studentProfile: inputSP, preferences: inputPref, text, memory, cid, requestId = "none" }) {
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
          extracted_partial: extracted || {}
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

    console.log(`[DECISION][${requestId}] Input:`, { studentProfile: sp, preferences: pref });
    console.time(`[DECISION][${requestId}]`);

    /* ========================================================
       🌐 API CALL (WITH TIMEOUT)
    ======================================================== */

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let response;
    for (let i = 0; i < 2; i++) {
      try {
        response = await fetch(`${API_URL}/api/v1/decisions/recommend`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Secret": SECRET_KEY,
          },
          body: JSON.stringify({
            student_profile: sp,
            preferences: pref,
          }),
          signal: controller.signal,
        });
        if (response.ok) break;
      } catch (err) {
        if (i === 1) throw err;
      }
    }

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Decision API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.recommended_major) {
      throw new Error("Invalid response from decision API");
    }

    console.timeEnd(`[DECISION][${requestId}]`);
    console.log(`[DECISION][${requestId}] Output:`, data);

    /* ========================================================
       🧠 SAVE MEMORY
    ======================================================== */

    let finalMajor = data.recommended_major;
    const alternatives = data.alternatives || ["Related IT degree", "Data Science"];
    
    // Safety Fallback Check ensuring we pick an alternative if completely blocked
    const memCacheCheck = cid ? decisionMemory.get(cid) : null;
    if (memCacheCheck && memCacheCheck.rejected_majors && memCacheCheck.rejected_majors.includes(finalMajor)) {
       console.log(`[Decision] Swapping recommendation: ${finalMajor} was previously rejected.`);
       // Traverse alternatives to find one not rejected
       const viableAlternative = alternatives.find(alt => !memCacheCheck.rejected_majors.includes(alt));
       if (viableAlternative) {
         alternatives[0] = finalMajor;
         finalMajor = viableAlternative;
       } else {
         finalMajor = "General Sciences/Business";
       }
    }

    if (cid) {
      await updateUserMemory(cid, {
        studentProfile: sp,
        preferences: pref,
        last_recommendation: finalMajor
      });
    }

    /* ========================================================
       ✅ SUCCESS RESPONSE
    ======================================================== */
    const memCache = cid ? decisionMemory.get(cid) : null;
    const dynamicRoadmap = buildCareerRoadmap(sp, pref, memCache);
    const generatedNextSteps = generateNextSteps(finalMajor);

    const grades_score = sp.high_school_percentage >= 85 ? 95 : (sp.high_school_percentage >= 70 ? 80 : 60);
    const interests_score = (pref.interests && pref.interests.length > 0) ? 90 : 50; 
    const market_score = 85;

    const confidence_breakdown = {
      grades_score,
      interests_score,
      market_score,
      overall: data.confidence || 0
    };

    return safeDecision({
      recommended_major: finalMajor,
      confidence: data.confidence,
      top_recommendations: data.top_recommendations || data.candidates,
      reason: data.reason,
      warnings: data.warnings,
      pros: data.pros,
      cons_and_risks: data.cons_and_risks,
      alternatives: alternatives,
      career_roadmap: dynamicRoadmap,
      confidence_breakdown,
      next_steps: generatedNextSteps
    }, "General Sciences/Business");

  } catch (err) {
    if (err.name === "AbortError") {
      console.error(`[ERROR][${requestId}] ⏱ Decision API Timeout`);
    } else {
      console.error(`[ERROR][${requestId}] Decision Error:`, err.message);
    }

    return {
      success: false,
      is_fallback: true,
      message: err.message || "Decision system unavailable"
    };
  }
}

/* ============================================================
   🚀 NEXT STEP GENERATOR
============================================================ */

export function generateNextSteps(major) {
  const m = String(major).toLowerCase();
  
  if (m.includes("engineering") || m.includes("mechanic") || m.includes("architect")) {
    return ["Review Calculus and Physics fundamentals", "Check AAST lab facility schedule", "Research SPE/IEEE student chapters"];
  }
  if (m.includes("computer") || m.includes("ai") || m.includes("data") || m.includes("software")) {
    return ["Start core language logic tutorials (Python/C++)", "Explore AAST competitive programming team", "Look into regional hackathon schedules"];
  }
  if (m.includes("business") || m.includes("manage") || m.includes("finance")) {
    return ["Read introductory market/economic concepts", "Check AAST student union business clubs", "Draft a mock startup or consulting pitch"];
  }
  return ["Consult with your assigned academic advisor", "Review prerequisite 101 courses in the catalog", "Join relevant extracurricular student forums"];
}

/* ============================================================
   🚀 WHAT-IF SIMULATION ENGINE
============================================================ */

export function compareMajors(majorA, majorB, profile, requestId = "none") {
  console.log(`[DECISION][${requestId}] Input (Compare):`, { majorA, majorB, profile });
  console.time(`[DECISION][${requestId}]`);
  const safeProfile = profile || {};
  const mathScore = safeProfile.high_school_percentage || 80;
  
  const isEngA = majorA.toLowerCase().includes("engineering") || majorA.toLowerCase().includes("architecture");
  const isCmpA = majorA.toLowerCase().includes("computer") || majorA.toLowerCase().includes("ai") || majorA.toLowerCase().includes("data");
  
  const isEngB = majorB.toLowerCase().includes("engineering") || majorB.toLowerCase().includes("architecture");
  const isCmpB = majorB.toLowerCase().includes("computer") || majorB.toLowerCase().includes("ai") || majorB.toLowerCase().includes("data");

  let diffA = isEngA ? 8 : (isCmpA ? 7 : 5);
  let diffB = isEngB ? 8 : (isCmpB ? 7 : 5);

  if (mathScore < 80) {
    if (isEngA || isCmpA) diffA += 2;
    if (isEngB || isCmpB) diffB += 2;
  }

  return {
    majorA,
    majorB,
    salary_outlook: `In the Egyptian market, starting salaries for ${majorA} and ${majorB} are competitive, but ${isCmpA || isCmpB ? 'tech-focused roles' : 'specialized roles'} typically see a 15-20% premium over the first 3 years.`,
    difficulty_level: {
      [majorA]: Math.min(diffA, 10),
      [majorB]: Math.min(diffB, 10)
    },
    skills_overlap: `Both fields share foundational problem-solving skills. However, ${majorA} focuses more on specialized core logic, whereas ${majorB} leans into parallel systems.`,
    career_progression: `In 5-10 years, ${majorA} graduates often move into senior local leadership. ${majorB} paths frequently branch into global remote integration and management.`
  };
  
  console.timeEnd(`[DECISION][${requestId}]`);
  console.log(`[DECISION][${requestId}] Output (Compare):`, result);
  return result;
}
