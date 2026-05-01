import express from 'express';
import { getSession } from '../db/neo4j.js';

const router = express.Router();

// Example: return Course nodes
router.get('/courses', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run('MATCH (c:Course) RETURN c LIMIT 25');
    const rows = result.records.map(r => r.get('c').properties);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// Example: get student by id (graph node)
router.get('/student/:id', async (req, res) => {
  const { id } = req.params;
  const session = getSession();
  try {
    const q = 'MATCH (s:Student {id: $id}) RETURN s LIMIT 1';
    const result = await session.run(q, { id: Number(id) });

    if (result.records.length === 0)
      return res.status(404).json({ error: 'Not found' });

    const student = result.records[0].get('s').properties;
    res.json(student);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// Health check
router.get('/test', async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run("RETURN 1 AS ok");
    res.json({ connected: true, value: result.records[0].get("ok") });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  } finally {
    await session.close();
  }
});

// 🔍 DEBUG: test Campus → College traversal
router.get("/debug/campus-college", async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (c:Campus)-[r]->(col:College)
      RETURN c.name AS campus, type(r) AS rel, col.name AS college
      LIMIT 10
    `);

    res.json(
      result.records.map(r => ({
        campus: r.get("campus"),
        relation: r.get("rel"),
        college: r.get("college")
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// 🧠 NEW: Multi-entity dynamic graph expansion (NER READY)
router.post("/entity", async (req, res) => {
  const session = getSession();
  const { entities } = req.body;

  if (!entities || !Array.isArray(entities) || entities.length === 0) {
    return res.status(400).json({ error: "entities array required" });
  }

  try {

    // 1️⃣ Find matching nodes from extracted entities
    const findResult = await session.run(`
      MATCH (n)
      WHERE n.name IS NOT NULL
      AND ANY(e IN $entities WHERE toLower(n.name) CONTAINS toLower(e))
      RETURN DISTINCT n.name AS name
    `, { entities });

    if (!findResult.records.length) {
      return res.json({ found: false, relations: [] });
    }

    const matchedNames = findResult.records.map(r => r.get("name"));

    // 2️⃣ Expand all matched nodes
    const result = await session.run(`
      MATCH (n)
      WHERE n.name IN $matchedNames
      MATCH (n)-[r]-(m)
      RETURN
        labels(n)[0] AS fromLabel,
        n.name AS fromName,
        type(r) AS relation,
        labels(m)[0] AS toLabel,
        m.name AS toName
      LIMIT 50
    `, { matchedNames });

    const relations = result.records.map(r => ({
      from: {
        label: r.get("fromLabel"),
        name: r.get("fromName")
      },
      relation: r.get("relation"),
      to: {
        label: r.get("toLabel"),
        name: r.get("toName") ?? r.get("toLabel")
      }
    }));

    res.json({
      found: true,
      entities: matchedNames,
      relations
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// ✅ REQUIRED DEFAULT EXPORT
export default router;