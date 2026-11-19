import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getRecommendation,
} from "../services/decisionService.js";

const router = express.Router();
router.use(requireAuth);

/**
 * Helper: Deep validation of payload
 */
export function validatePayload(studentProfile, preferences) {
  if (
    !studentProfile ||
    typeof studentProfile !== "object" ||
    Array.isArray(studentProfile) ||
    !preferences ||
    typeof preferences !== "object" ||
    Array.isArray(preferences)
  ) {
    return { valid: false, error: "studentProfile and preferences must be non-null objects." };
  }

  // Check required fields
  const hsp = studentProfile.high_school_percentage ?? studentProfile.highSchoolPercentage;
  if (hsp === undefined || hsp === null) {
    return { valid: false, error: "Missing high_school_percentage" };
  }
  if (!Number.isFinite(Number(hsp)) || Number(hsp) < 0 || Number(hsp) > 100) {
    return { valid: false, error: "high_school_percentage must be a number between 0 and 100" };
  }

  if (
    studentProfile.budget !== undefined &&
    studentProfile.budget !== null &&
    (!Number.isFinite(Number(studentProfile.budget)) || Number(studentProfile.budget) < 0)
  ) {
    return { valid: false, error: "budget must be a non-negative number" };
  }

  if (
    preferences.interests !== undefined &&
    (!Array.isArray(preferences.interests) || preferences.interests.some(item => typeof item !== "string"))
  ) {
    return { valid: false, error: "preferences.interests must be an array of strings" };
  }

  return { valid: true };
}

export function httpStatusForDecisionResult(result) {
  if (
    result?.success === true &&
    (result?.result_status === "ok" || result?.result_status === "no_results")
  ) return 200;
  if (result?.success === false && result?.result_status === "invalid_request") return 400;
  if (
    result?.success === false &&
    result?.result_status === "unavailable" &&
    result?.error_code === "DECISION_TIMEOUT"
  ) return 504;
  if (result?.success === false && result?.result_status === "unavailable") return 503;
  return 500;
}

/**
 * POST /recommend
 * Public recommendation route.
 * Internal FastAPI authentication is handled inside decisionService.js.
 */
router.post("/recommend", async (req, res) => {
  const requestId = `rec_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
  const timestamp = new Date().toISOString();

  console.log(`[Decision Route] Request Received: ${requestId} | Time: ${timestamp}`);

  try {
    const { studentProfile, preferences } = req.body || {};

    const validation = validatePayload(studentProfile, preferences);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        result_status: "invalid_request",
        error_code: "INVALID_REQUEST",
        source: "decision_route",
        error: validation.error,
        requestId
      });
    }

    const recommendationResult = await getRecommendation({
      studentProfile,
      preferences,
      requestId,
    });

    return res.status(httpStatusForDecisionResult(recommendationResult)).json({
      ...recommendationResult,
      requestId
    });

  } catch (error) {
    console.error("Route Error [/api/decision/recommend]:", {
      requestId,
      errorType: error?.name || "Error",
    });

    return res.status(500).json({
      success: false,
      result_status: "unavailable",
      error_code: "INTERNAL_ERROR",
      source: "decision_route",
      error: "Internal processing error",
      requestId
    });
  }
});

export default router;
