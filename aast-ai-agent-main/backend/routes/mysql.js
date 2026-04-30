// routes/sql.js
import express from "express";
import { getPool } from "../db/mysql.js";  // ✅ uses the shared pool

const router = express.Router();

// GET /api/sql/students?limit=20&offset=0
router.get("/students", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      "SELECT student_id, first_name, last_name, email, major, year FROM students LIMIT ? OFFSET ?",
      [limit, offset]
    );
    res.json({ count: rows.length, rows });
  } catch (err) {
    console.error("Error fetching students:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ✅ VERY IMPORTANT: default export
export default router;
