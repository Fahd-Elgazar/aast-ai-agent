import express from "express";
import fs from "fs";
import path from "path";

const router = express.Router();

// ensure logs folder exists and use same logs/chat.log
const LOG_DIR = path.resolve(process.cwd(), "logs");
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch (e) {}
const LEGACY_QUERY_LOG = path.join(LOG_DIR, "chat.log");

function legacyLogSync(text) {
  try {
    fs.appendFileSync(LEGACY_QUERY_LOG, text + "\n", { encoding: "utf8" });
  } catch (err) {
    console.error("❌ Failed to write legacy query log:", err);
  }
}

// small ID generator
function makeId() {
  return Math.random().toString(16).slice(2, 8);
}

router.post("/query", (req, res) => {
  const { query } = req.body ?? {};
  const cid = makeId();

  console.log(new Date().toLocaleString(), `🔥 [legacy ${cid}] User:`, query);

  // log user msg
  legacyLogSync(`${new Date().toLocaleString()} | [legacy ${cid}] User: ${query}`);

  // legacy reply
  const answer = `Backend received: "${query}"`;

  // log bot reply
  legacyLogSync(`${new Date().toLocaleString()} | [legacy ${cid}] Bot: ${answer}`);

  return res.json({
    answer,
    source: "debug-legacy",
    cid,
  });
});

export default router;
