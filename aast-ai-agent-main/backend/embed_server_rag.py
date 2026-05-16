import os
import threading
import time
from typing import Any, Optional

from fastapi import FastAPI, HTTPException

app = FastAPI()

EMBEDDING_MODEL = "BAAI/bge-m3"
EMBEDDING_DEVICE = os.getenv("RAG_EMBEDDING_DEVICE", "cpu").strip() or "cpu"
EMBEDDING_BATCH_SIZE = max(1, int(os.getenv("RAG_EMBED_BATCH_SIZE", "4")))
EMBEDDING_LOW_CPU_MEM_USAGE = os.getenv("RAG_LOW_CPU_MEM_USAGE", "true").lower() in {"1", "true", "yes", "on"}
TORCH_NUM_THREADS = max(1, int(os.getenv("RAG_TORCH_NUM_THREADS", "1")))

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("OMP_NUM_THREADS", str(TORCH_NUM_THREADS))
os.environ.setdefault("MKL_NUM_THREADS", str(TORCH_NUM_THREADS))


class LazyEmbedder:
    def __init__(self):
        self._model: Any = None
        self._lock = threading.Lock()
        self.loaded_at: Optional[float] = None
        self.load_seconds: Optional[float] = None
        self.last_error: Optional[str] = None

    def load(self):
        if self._model is not None:
            return self._model

        with self._lock:
            if self._model is not None:
                return self._model

            start = time.time()
            try:
                import torch  # type: ignore
                from sentence_transformers import SentenceTransformer

                torch.set_num_threads(TORCH_NUM_THREADS)
                kwargs = {"device": EMBEDDING_DEVICE}
                if EMBEDDING_LOW_CPU_MEM_USAGE:
                    kwargs["model_kwargs"] = {"low_cpu_mem_usage": True}
                try:
                    self._model = SentenceTransformer(EMBEDDING_MODEL, **kwargs)
                except TypeError:
                    kwargs.pop("model_kwargs", None)
                    self._model = SentenceTransformer(EMBEDDING_MODEL, **kwargs)
                self.loaded_at = time.time()
                self.load_seconds = round(self.loaded_at - start, 3)
                self.last_error = None
            except Exception as exc:
                self.last_error = str(exc)
                raise

            return self._model

    def encode(self, text: str):
        model = self.load()
        return model.encode(
            text,
            batch_size=EMBEDDING_BATCH_SIZE,
            normalize_embeddings=True,
        ).tolist()

    def status(self):
        return {
            "model": EMBEDDING_MODEL,
            "loaded": self._model is not None,
            "device": EMBEDDING_DEVICE,
            "batch_size": EMBEDDING_BATCH_SIZE,
            "low_cpu_mem_usage": EMBEDDING_LOW_CPU_MEM_USAGE,
            "torch_num_threads": TORCH_NUM_THREADS,
            "loaded_at": self.loaded_at,
            "load_seconds": self.load_seconds,
            "last_error": self.last_error,
        }


embedder = LazyEmbedder()


@app.get("/embed")
def embed(text: str):
    if not text.strip():
        raise HTTPException(status_code=422, detail="Text cannot be empty.")
    vector = embedder.encode(text)
    return {"vector": vector}


@app.get("/health")
def health():
    return {"status": "ok", "embedding": embedder.status()}
