import neo4j from "neo4j-driver";
import dotenv from "dotenv";

dotenv.config();

let driver;
let connectPromise;
let lastReconnectWarningAt = 0;
const DATABASE = process.env.NEO4J_DATABASE || "neo4j";

export async function connectNeo4j() {
  if (driver) return driver;

  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    let candidateDriver;

    try {
      candidateDriver = neo4j.driver(
        process.env.NEO4J_URI || "bolt://localhost:7687",
        neo4j.auth.basic(
          process.env.NEO4J_USER || "neo4j",
          process.env.NEO4J_PASSWORD || "password"
        )
      );

      await candidateDriver.verifyConnectivity();
      driver = candidateDriver;
      console.log("Connected to Neo4j successfully.");
      console.log("[NEO4J] Connected");
      console.log("Using Neo4j database:", DATABASE);

      return driver;
    } catch (error) {
      console.error("[Neo4j ERROR]", error.message);
      if (candidateDriver) {
        await candidateDriver.close().catch(() => {});
      }
      driver = null;
      return null;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

export function getSession() {
  if (driver) {
    return driver.session({
      database: DATABASE,
    });
  }

  const now = Date.now();
  if (now - lastReconnectWarningAt > 30000) {
    lastReconnectWarningAt = now;
    console.warn("[Neo4j WARN] Neo4j driver not initialized. Attempting lazy reconnect.");
  }

  let lazySession;

  async function resolveSession() {
    if (lazySession) return lazySession;

    const activeDriver = await connectNeo4j();
    if (!activeDriver) {
      throw new Error("Neo4j driver not initialized");
    }

    lazySession = activeDriver.session({
      database: DATABASE,
    });

    return lazySession;
  }

  return {
    run: async (...args) => {
      const session = await resolveSession();
      return session.run(...args);
    },
    close: async () => {
      if (lazySession) {
        await lazySession.close();
      }
    },
  };
}

export { driver };
