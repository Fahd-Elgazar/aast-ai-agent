from neo4j import GraphDatabase
import os
from dotenv import load_dotenv
import requests

load_dotenv()

driver = GraphDatabase.driver(
    os.getenv("NEO4J_URI"),
    auth=(os.getenv("NEO4J_USER"), os.getenv("NEO4J_PASSWORD"))
)

OLLAMA_URL = "http://192.168.1.7:11434/api/embeddings"
MODEL = "nomic-embed-text"
ALLOWED_KEYS = ["name", "description", "role", "course_code"]
EMBED_TIMEOUT_SECONDS = 10
EMBED_MAX_ATTEMPTS = 2


# Optional Neo4j index suggestion:
# CREATE INDEX embedding_failed_index
# FOR (n)
# ON (n.embedding_failed);


# ============================================================
# OLLAMA EMBEDDING
# ============================================================

def embed(text):
    for attempt in range(1, EMBED_MAX_ATTEMPTS + 1):
        try:
            res = requests.post(
                OLLAMA_URL,
                json={
                    "model": MODEL,
                    "prompt": f"Represent this entity for semantic search: {text}"
                },
                timeout=EMBED_TIMEOUT_SECONDS
            )
            res.raise_for_status()
            data = res.json()
            return data.get("embedding", None)
        except Exception as e:
            print(f"❌ Embedding attempt {attempt}/{EMBED_MAX_ATTEMPTS} failed: {e}")

    return None


# ============================================================
# WRITE EMBEDDINGS BATCH
# ============================================================

def write_embeddings_batch(tx, data):

    query = """
    UNWIND $data AS item
    MATCH (n)
    WHERE elementId(n) = item.eid
    AND n.embedding IS NULL
    SET n.embedding = item.vector
    """

    tx.run(query, data=data)


def mark_failed_batch(tx, ids):

    query = """
    UNWIND $ids AS id
    MATCH (n)
    WHERE elementId(n) = id
    SET n.embedding_failed = true
    """

    tx.run(query, ids=ids)


# ============================================================
# BUILD RICH CONTEXT FOR EMBEDDING
# ============================================================
def build_context(labels, props):

    parts = []

    # label as type
    if labels:
        parts.append(f"Type: {', '.join(labels)}")

    # important fields with better wording
    if props.get("name"):
        parts.append(f"Name: {props['name']}")

    if props.get("role"):
        parts.append(f"Role: {props['role']}")

    if props.get("description"):
        parts.append(f"Description: {props['description']}")

    if props.get("course_code"):
        parts.append(f"Course Code: {props['course_code']}")

    return ". ".join(parts)[:700]

# ============================================================
# MAIN EMBEDDING LOOP
# ============================================================

def run():

    total_embedded = 0

    with driver.session(database=os.getenv("NEO4J_DATABASE")) as session:

        while True:

            result = session.run("""
                MATCH (n)
                WHERE n.embedding IS NULL
                AND (n.name IS NOT NULL OR n.description IS NOT NULL)
                AND n.name IS NOT NULL
                AND (n.embedding_failed IS NULL OR n.embedding_failed = false)
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
            failed_nodes = []

            for node in nodes:

                context = build_context(node["labels"], node["props"])

                if not context.strip():
                    print("⚠️ Skipped (empty context):", node["eid"])
                    failed_nodes.append(node["eid"])
                    continue

                print(f"Embedding node: {node['eid']}")

                vector = embed(context)

                if vector:
                    batch.append({
                        "eid": node["eid"],
                        "vector": vector
                    })
                else:
                    print("⚠️ Skipped (no embedding):", node["eid"])
                    failed_nodes.append(node["eid"])

            if batch:

                session.execute_write(write_embeddings_batch, batch)
                total_embedded += len(batch)

                print(f"✅ Embedded {len(batch)} nodes")
                print(f"✨ Wrote batch of {len(batch)} embeddings")
                print(f"📊 Total embedded so far: {total_embedded}")

            if failed_nodes:
                session.execute_write(mark_failed_batch, failed_nodes)


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    run()
    driver.close()
