from neo4j import GraphDatabase
import os
from dotenv import load_dotenv
import requests

load_dotenv()

driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD"))
)

OLLAMA_URL = "http://localhost:11434/api/embeddings"
MODEL = "nomic-embed-text"


# ============================================================
# OLLAMA EMBEDDING
# ============================================================

def embed(text):

    res = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL,
            "prompt": text
        }
    )

    res.raise_for_status()

    data = res.json()

    if "embedding" not in data:
        raise ValueError("Embedding missing from Ollama response")

    return data["embedding"]


# ============================================================
# WRITE EMBEDDINGS BATCH
# ============================================================

def write_embeddings_batch(tx, data):

    query = """
    UNWIND $data AS item
    MATCH (n)
    WHERE elementId(n) = item.eid
    SET n.embedding = item.vector
    """

    tx.run(query, data=data)


# ============================================================
# BUILD RICH CONTEXT FOR EMBEDDING
# ============================================================

def build_context(labels, props):

    parts = []

    # include labels
    for label in labels:
        parts.append(label)

    # include properties as key:value
    for key, value in props.items():

        if key == "embedding":
            continue

        if value is None:
            continue

        parts.append(f"{key}: {value}")

    return " ".join(parts)


# ============================================================
# MAIN EMBEDDING LOOP
# ============================================================

def run():

    with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:

        while True:

            result = session.run("""
                MATCH (n:SemanticNode)
                WHERE n.embedding IS NULL
                RETURN elementId(n) AS eid,
                       labels(n) AS labels,
                       properties(n) AS props
                LIMIT 100
            """)

            nodes = result.data()

            if not nodes:
                print("✅ All nodes embedded.")
                break

            print(f"Found {len(nodes)} nodes")

            batch = []

            for node in nodes:

                context = build_context(node["labels"], node["props"])

                print("Embedding:", context)

                try:

                    vector = embed(context)

                    batch.append({
                        "eid": node["eid"],
                        "vector": vector
                    })

                except Exception as e:

                    print("❌ Failed:", e)

            if batch:

                session.execute_write(write_embeddings_batch, batch)

                print(f"✨ Wrote batch of {len(batch)} embeddings")


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    run()