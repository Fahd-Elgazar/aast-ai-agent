import express from "express";
import { getRecommendation } from "../services/decisionService.js";

const router = express.Router();

/**
 * Helper: Deep validation of payload
 */
function validatePayload(studentProfile, preferences) {
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

  return { valid: true };
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
      return res.status(200).json({
        success: false,
        source: "decision_route",
        error: validation.error,
        requestId
      });
    }

    const recommendationResult = await getRecommendation({ studentProfile, preferences });

    return res.status(200).json({
      ...recommendationResult,
      requestId
    });

  } catch (error) {
    console.error("Route Error [/api/decision/recommend]:", {
      requestId,
      message: error.message,
      stack: error.stack,
      body: req.body
    });

    return res.status(200).json({
      success: false,
      source: "decision_route",
      error: "Internal processing error",
      requestId
    });
  }
});

export default router;
