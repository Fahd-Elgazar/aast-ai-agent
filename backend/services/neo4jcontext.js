import { getSession } from "../db/neo4j.js";
import fetch from "node-fetch";

/* ============================================================
   OLLAMA EMBEDDING
============================================================ */

async function embed(text) {
  const res = await fetch("http://localhost:11434/api/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text
    })
  });

  const json = await res.json();

  if (!json || !json.embedding) {
    throw new Error("Embedding failed");
  }

  return json.embedding;
}

/* ============================================================
   HUMANIZE TRIPLES (NEW – helps small LLM understand graph)
============================================================ */

function humanizeTriple(text) {

  if (text.includes("--[HAS_ADMIN]-->")) {

    const person = text.match(/Person: "([^"]+)"/)?.[1];
    const college = text.match(/College: "([^"]+)"/)?.[1];

    if (person && college) {
      return `${person} is an administrator of the ${college}.`;
    }

  }

  return text;
}

/* ============================================================
   GRAPH RETRIEVAL
============================================================ */

export async function fetchNeo4jContext(query, intent = "ALL", limit = 5) {

  const session = getSession();

  try {

    const vector = await embed(query);

    // 🔧 IMPORTANT: inject integer directly into query
    const searchLimit = limit * 3;

    const cypher = `
      CALL db.index.vector.queryNodes('node_embedding_index', ${searchLimit}, $vector)
      YIELD node, score
      WHERE score > 0.6

      OPTIONAL MATCH (node)-[r]->(m)

      WITH node, score, r, m,
           toUpper(type(r)) AS relType,
           toUpper(labels(m)[0]) AS targetLabel

      WHERE $intent = 'ALL'
         OR relType CONTAINS $intent
         OR targetLabel CONTAINS $intent

      RETURN
        elementId(node) AS id,
        labels(node)[0] AS label,
        node.name AS name,
        node {.*, embedding:null} AS props,
        collect({
          rel:type(r),
          toLabel:labels(m)[0],
          toName:m.name
        })[0..10] AS relations,
        score
      ORDER BY score DESC
      LIMIT ${limit}
    `;

    const result = await session.run(cypher, {
      vector,
      intent
    });

    let records = result.records;

    /* ============================================================
       SEMANTIC FALLBACK (NEW)
       If intent filter removes results, retry using pure embeddings
    ============================================================ */

    if (records.length === 0 && intent !== "ALL") {

      const cypherNoIntent = `
        CALL db.index.vector.queryNodes('node_embedding_index', ${searchLimit}, $vector)
        YIELD node, score
        WHERE score > 0.6

        OPTIONAL MATCH (node)-[r]->(m)

        RETURN
          elementId(node) AS id,
          labels(node)[0] AS label,
          node.name AS name,
          node {.*, embedding:null} AS props,
          collect({
            rel:type(r),
            toLabel:labels(m)[0],
            toName:m.name
          })[0..10] AS relations,
          score
        ORDER BY score DESC
        LIMIT ${limit}
      `;

      const retry = await session.run(cypherNoIntent, { vector });
      records = retry.records;
    }

    const facts = [];
    const seen = new Set();

    records.forEach(record => {

      const id = record.get("id");
      const label = record.get("label");
      const name = record.get("name");
      const props = record.get("props");
      const relations = record.get("relations");
      const score = record.get("score");

      if (!seen.has(id)) {

        /* ---------- properties ---------- */

        Object.entries(props).forEach(([key, value]) => {

          if (
            key !== "embedding" &&
            key !== "name" &&
            value !== null
          ) {

            facts.push({
              text: `(${label}: "${name}") ${key}: ${value}`,
              score
            });

          }

        });

        /* ---------- relationships ---------- */

        relations.forEach(rel => {

          if (rel.rel && rel.toName) {

            const triple =
              `(${label}: "${name}") --[${rel.rel}]--> (${rel.toLabel}: "${rel.toName}")`;

            facts.push({
              text: humanizeTriple(triple), // 🔵 NEW (humanized)
              score
            });

          }

        });

        seen.add(id);
      }

    });

    return facts;

  } catch (err) {

    console.error("❌ Neo4j context error:", err);
    return [];

  } finally {

    await session.close();

  }

}