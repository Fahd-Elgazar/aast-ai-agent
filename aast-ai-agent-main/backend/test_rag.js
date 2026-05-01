import { QdrantClient } from "@qdrant/js-client-rest";
import axios from "axios";

const client = new QdrantClient({
  url: "http://localhost:6333",
});

async function run() {
  const query = "who is the dean of ai";

  // get embedding from python server
  const res = await axios.get("http://localhost:8001/embed", {
    params: { text: query },
  });

  const vector = res.data.vector;

  // search qdrant
const results = await client.search("aast_rag", {
  vector: {
    name: "dense",   // 🔥 THIS is the correct one
    vector: vector
  },
  limit: 3,
});

  console.log("RAW RESULTS:", results);

  const context = results.map(r => r.payload.text).join("\n");

  console.log("\nCONTEXT:\n", context);
}

const context = results.map(r => r.payload.text).join("\n");

const prompt = `
Answer the question using ONLY the context below:

${context}

Question: who is the dean of ai
`;

const response = await llm.invoke(prompt);

console.log("FINAL ANSWER:", response);
run();