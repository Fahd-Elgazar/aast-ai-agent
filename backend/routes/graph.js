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
    if (result.records.length === 0) return res.status(404).json({ error: 'Not found' });
    const student = result.records[0].get('s').properties;
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});
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

export default router;
