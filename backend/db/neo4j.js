import neo4j from "neo4j-driver";
import dotenv from "dotenv";

dotenv.config();

let driver;
const DATABASE = process.env.NEO4J_DATABASE || "neo4j-data-new";

export async function connectNeo4j() {
  try {
    driver = neo4j.driver(
      process.env.NEO4J_URI || "bolt://localhost:7687",
      neo4j.auth.basic(
        process.env.NEO4J_USER || "neo4j",
        process.env.NEO4J_PASSWORD || "password"
      )
    );

    await driver.verifyConnectivity();
    console.log("✅ Connected to Neo4j successfully.");
    console.log("🗄️ Using Neo4j database:", DATABASE);

    return driver;
  } catch (error) {
    console.error("❌ Failed to connect to Neo4j:", error.message);
    process.exit(1);
  }
}

export function getSession() {
  if (!driver) {
    throw new Error("Neo4j driver not initialized. Call connectNeo4j() first.");
  }

  return driver.session({
    database: DATABASE, // 🔴 FORCE DATABASE
  });
}

export { driver };
