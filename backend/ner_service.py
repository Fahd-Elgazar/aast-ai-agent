from fastapi import FastAPI
from pydantic import BaseModel
from neo4j import GraphDatabase
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE")

driver = GraphDatabase.driver(
    NEO4J_URI,
    auth=(NEO4J_USER, NEO4J_PASSWORD)
)

def load_graph_entities():
    with driver.session(database=NEO4J_DATABASE) as session:
        result = session.run("""
            MATCH (n)
            WHERE n.name IS NOT NULL
            RETURN n.name AS entity
        """)

        entities = [
            record["entity"]
            for record in result
            if record["entity"] is not None
        ]

        print(f"Loaded {len(entities)} entities from Neo4j (DB={NEO4J_DATABASE})")
        return list(set(entities))

entities = load_graph_entities()

# 🔹 Normalize entities for partial matching
normalized = []
for e in entities:
    normalized.append({
        "original": e,
        "tokens": set(e.lower().split())
    })

class Query(BaseModel):
    text: str

@app.post("/extract")
def extract_entities(query: Query):
    words = set(query.text.lower().split())
    found = []

    for item in normalized:
        overlap = words.intersection(item["tokens"])
        if len(overlap) >= 1:
            found.append(item["original"])

    return {
        "entities": list(set(found))
    }