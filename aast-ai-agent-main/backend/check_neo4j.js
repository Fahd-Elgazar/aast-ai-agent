import { connectNeo4j, getSession } from "./db/neo4j.js";

async function check() {
  try {
    await connectNeo4j();
    console.log("Connected to Neo4j");
    const session = getSession();
    const result = await session.run("SHOW INDEXES");
    const indexes = result.records.map(r => r.get('name'));
    console.log("Indexes:", indexes);
    
    // Check if node_embedding_index exists and its dimensions
    const indexResult = await session.run("SHOW VECTOR INDEXES");
    if (indexResult.records.length > 0) {
      console.log("Vector Indexes:");
      indexResult.records.forEach(r => {
        console.log(`- ${r.get('name')}: dimensions=${r.get('options')?.vector?.dimensions}`);
      });
    } else {
      console.log("No vector indexes found.");
    }
    
    await session.close();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

check();
