from fastapi import FastAPI
from sentence_transformers import SentenceTransformer

app = FastAPI()
model = SentenceTransformer("BAAI/bge-m3")

@app.get("/embed")
def embed(text: str):
    vector = model.encode(text, normalize_embeddings=True).tolist()
    return {"vector": vector}