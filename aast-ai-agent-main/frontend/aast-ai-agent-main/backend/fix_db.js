import { getSession, connectNeo4j } from "./db/neo4j.js";

async function run() {
  await connectNeo4j();
  const session = getSession();
  try {
    console.log("Adding missing TEACHES relationship...");
    await session.run(`
      MATCH (c:Course {name: "Block Chain"})
      MATCH (p)
      WHERE p.name = "Amira Elsaid"
      MERGE (p)-[:TEACHES]->(c)
    `);

    console.log("Verifying relationship...");
    const result = await session.run(`
      MATCH (c:Course {name: "Block Chain"})<-[:TEACHES]-(p)
      RETURN p.name AS professor, c.name AS course
    `);
    
    result.records.forEach(rec => {
      console.log(`Verified: ${rec.get("professor")} teaches ${rec.get("course")}`);
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await session.close();
    process.exit(0);
  }
}

run();
