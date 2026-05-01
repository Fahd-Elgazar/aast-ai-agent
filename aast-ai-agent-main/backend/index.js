// WARNING: This file may be legacy.
// Main production entry appears to be orchestrator.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

import graphRoutes from "./routes/graph.js";
import searchRoutes from "./routes/search.js";
import sqlRoutes from "./routes/mysql.js";
import createHealthRouter from "./routes/health.js";

// ✅ NEW — Chatbot route
import chatbotRouter from "./routes/chatbot.js";

import { connectNeo4j, getSession } from "./db/neo4j.js";
import { connectMySQL } from "./db/mysql.js";
import { connectMeili } from "./db/meili.js";
import mongoose from "mongoose";

mongoose.connect("mongodb://127.0.0.1:27017/authDB")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));
dotenv.config();
import authRoutes from "./routes/auth.js";
const app = express();
app.use(express.json());
app.use("/auth", authRoutes);

app.use(cors());
app.use(bodyParser.json());
app.use("/health", createHealthRouter());
app.use("/api/health", createHealthRouter());

// Root route
app.get("/", (req, res) => {
  res.send("🚀 AAST Backend Server is running successfully!");
});

const mode = process.argv[2];
const PORT =
  mode === "neo"
    ? process.env.NEO4J_PORT || 5001
    : mode === "sql"
    ? process.env.SQL_PORT || 5000
    : mode === "meili"
    ? process.env.MEILI_PORT || 5002
    : process.env.PORT || 5000;

/* ================================================================
   🟩 Neo4j Server
=================================================================*/
async function startNeo4jServer() {
  try {
    console.log("🔄 Connecting to Neo4j...");
    await connectNeo4j();
    console.log("✅ Successfully connected to Neo4j.");

    // Routes
    app.use("/api/chatbot", chatbotRouter);   // ⭐ ADDED
    app.use("/api/graph", graphRoutes);

    // Neo4j health
    app.get("/api/neo4j/check", async (req, res) => {
      try {
        const session = getSession();
        const result = await session.run("RETURN 'Neo4j is alive' AS status");
        const status = result.records[0].get("status");
        await session.close();
        res.json({ status: `✅ ${status}` });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log("🟩 Mode: Neo4j Server");
      console.log(`🌐 Running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start Neo4j server:", err.message);
  }
}

/* ================================================================
   🟦 MySQL Server
=================================================================*/
async function startSQLServer() {
  try {
    console.log("🔄 Connecting to MySQL...");
    await connectMySQL();
    console.log("✅ Successfully connected to MySQL.");

    // Routes
    app.use("/api/chatbot", chatbotRouter);   // ⭐ ADDED
    app.use("/api/sql", sqlRoutes);

    app.get("/api/mysql/check", async (req, res) => {
      res.json({ status: "✅ MySQL is connected and running" });
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log("🟦 Mode: SQL Server");
      console.log(`🌐 Running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start SQL server:", err.message);
  }
}

/* ================================================================
   🟨 MeiliSearch Server
=================================================================*/
async function startMeiliServer() {
  try {
    console.log("🔄 Connecting to MeiliSearch...");
    await connectMeili();
    console.log("✅ Successfully connected to MeiliSearch.");

    // Routes
    app.use("/api/chatbot", chatbotRouter);   // ⭐ ADDED
    app.use("/api/search", searchRoutes);

    app.get("/api/meili/check", async (req, res) => {
      try {
        res.json({ status: "✅ MeiliSearch is running" });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log("🟨 Mode: MeiliSearch Server");
      console.log(`🌐 Running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start MeiliSearch server:", err.message);
  }
}

/* ================================================================
   🧭 Global Health Check
=================================================================*/
app.get("/api/health", async (req, res) => {
  const status = { neo4j: "❌", mysql: "❌", meili: "❌" };

  try {
    const session = getSession();
    await session.run("RETURN 1");
    await session.close();
    status.neo4j = "✅ Connected";
  } catch {}

  try {
    await connectMySQL();
    status.mysql = "✅ Connected";
  } catch {}

  try {
    await connectMeili();
    status.meili = "✅ Connected";
  } catch {}

  res.json(status);
});

/* ================================================================
   🧭 Mode Selector
=================================================================*/
switch (mode) {
  case "neo":
    startNeo4jServer();
    break;
  case "sql":
    startSQLServer();
    break;
  case "meili":
    startMeiliServer();
    break;
  default:
    console.log(`
❌ Please specify which service to start:

👉 npm run neo
👉 npm run sql
👉 npm run meili
`);
}
