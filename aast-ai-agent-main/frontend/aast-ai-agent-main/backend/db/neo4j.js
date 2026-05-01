import neo4j from "neo4j-driver";
import dotenv from "dotenv";

dotenv.config();

let driver;
const DATABASE = process.env.NEO4J_DATABASE || "neo4j";

export async function connectNeo4j() {
  if (driver) return driver;
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
    console.log("[NEO4J] Connected");
    console.log("🗄️ Using Neo4j database:", DATABASE);

    return driver;
  } catch (error) {
    console.error("[Neo4j ERROR]", error.message);
    driver = null;
    return null;
  }
}

export function getSession() {
  if (!driver) {
    console.error("[Neo4j ERROR] Neo4j driver not initialized. Falling back.");
    return {
      run: async () => { throw new Error("Neo4j driver not initialized"); },
      close: async () => { }
    };
  }

  return driver.session({
    database: DATABASE, // 🔴 FORCE DATABASE
  });
}

export { driver };
