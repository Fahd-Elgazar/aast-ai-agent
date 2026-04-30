import express from "express";
import { client } from "../db/meili.js"; // ✅ Correct named import

const router = express.Router();

// Add documents to an index
router.post("/add", async (req, res) => {
  try {
    const { indexName, documents } = req.body;
    if (!indexName || !documents)
      return res
        .status(400)
        .json({ error: "indexName and documents required" });

    const index = client.index(indexName);
    const result = await index.addDocuments(documents);
    res.json({ message: "Indexed", result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Search
router.get("/q", async (req, res) => {
  try {
    const { indexName, q } = req.query;
    if (!indexName || !q)
      return res
        .status(400)
        .json({ error: "indexName and q required" });

    const index = client.index(indexName);
    const results = await index.search(q, { limit: 10 });
    res.json({ hits: results.hits });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
