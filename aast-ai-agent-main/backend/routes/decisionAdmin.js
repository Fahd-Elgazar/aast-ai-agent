import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getAdminPrograms, updateAdminProgram } from "../services/decisionAdminService.js";

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get("/programs", async (req, res) => {
  try {
    const programs = await getAdminPrograms(req.get("authorization"));
    return res.json(programs);
  } catch (error) {
    console.error("Decision admin program read failed:", error.message);
    return res.status(Number.isInteger(error.status) ? error.status : 502).json({
      error: "decision_admin_unavailable",
      message: error.message,
    });
  }
});

router.put("/programs/:programId", async (req, res) => {
  try {
    const result = await updateAdminProgram(
      req.params.programId,
      req.body || {},
      req.get("authorization")
    );
    return res.json(result);
  } catch (error) {
    console.error("Decision admin program update failed:", error.message);
    return res.status(Number.isInteger(error.status) ? error.status : 502).json({
      error: "decision_admin_unavailable",
      message: error.message,
    });
  }
});

export default router;
