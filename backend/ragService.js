import { ChromaClient } from "chromadb";

const client = new ChromaClient({
  host: "localhost",
  port: 8001,
  ssl: false
});

let collectionCache = null;

async function getCollection() {
  if (!collectionCache) {
    const collections = await client.listCollections();
    collectionCache = await client.getCollection({
      name: collections[0].name
    });
  }
  return collectionCache;
}

export async function ragSearch(query, k = 3) {
  const collection = await getCollection();

  const res = await collection.query({
    queryTexts: [query],
    nResults: k
  });

  if (!res?.documents?.[0]?.length) return null;

  return {
    doc: res.documents[0][0],
    distance: res.distances[0][0],
    metadata: res.metadatas[0][0]
  };
}
