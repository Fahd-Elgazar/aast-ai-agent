"""
========================================================
PHASE 3 RETRIEVER ENGINE — PRODUCTION v2.0
========================================================
Project     : Explainable Hybrid GraphRAG + VectorRAG
              Academic Advisor (CAI-AAST)
Purpose     : High-precision enterprise retrieval engine
Environment : Windows-compatible, Python 3.9+
Dependencies:
    pip install qdrant-client==1.9.1 sentence-transformers==3.0.1 fastapi==0.111.0 uvicorn==0.30.1 numpy==1.26.4
========================================================
"""

import gc
import logging
import os
import re
import threading
import time
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Filter,
    FieldCondition,
    MatchValue
)

# ============================================================
# CONFIGURATION
# ============================================================

QDRANT_HOST = "localhost"
QDRANT_PORT = 6333
COLLECTION_NAME = "aast_academic_rag_production"

EMBEDDING_MODEL = "BAAI/bge-m3"
EMBEDDING_INIT_MODE = os.getenv("RAG_EMBEDDING_INIT_MODE", "lazy").strip().lower()
EMBEDDING_DEVICE = os.getenv("RAG_EMBEDDING_DEVICE", "cpu").strip() or "cpu"
EMBEDDING_BATCH_SIZE = max(1, int(os.getenv("RAG_EMBED_BATCH_SIZE", "4")))
EMBEDDING_LOW_CPU_MEM_USAGE = os.getenv("RAG_LOW_CPU_MEM_USAGE", "true").lower() in {"1", "true", "yes", "on"}
EMBEDDING_DYNAMIC_QUANTIZE = os.getenv("RAG_EMBEDDING_DYNAMIC_QUANTIZE", "false").lower() in {"1", "true", "yes", "on"}
TORCH_NUM_THREADS = max(1, int(os.getenv("RAG_TORCH_NUM_THREADS", "1")))

DEFAULT_TOP_K = 8
FINAL_TOP_K = 5
MAX_TOP_K = 50

CATEGORY_BOOSTS = {
    "academic_rules": 1.25,
    "academic_policies": 1.20,
    "grading_policies": 1.30,
    "financial_policies": 1.20,
    "admissions": 1.30,
    "admissions_registration": 1.25,
    "compliance": 1.15,
    "postgraduate_programs": 1.15,
    "institutional": 0.80,
    "other": 1.00
}

PRIORITY_BOOSTS = {
    "high": 1.25,
    "medium": 1.10,
    "low": 0.80
}

MIN_CONFIDENCE_THRESHOLD = 0.45

# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

logger = logging.getLogger(__name__)

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("OMP_NUM_THREADS", str(TORCH_NUM_THREADS))
os.environ.setdefault("MKL_NUM_THREADS", str(TORCH_NUM_THREADS))


def _process_memory_mb() -> Dict[str, Optional[float]]:
    try:
        import psutil  # type: ignore

        process = psutil.Process(os.getpid())
        rss = process.memory_info().rss / 1024 / 1024
        return {"rss_mb": round(rss, 1)}
    except Exception:
        return {"rss_mb": None}


def _configure_torch_runtime():
    try:
        import torch  # type: ignore

        torch.set_num_threads(TORCH_NUM_THREADS)
        if hasattr(torch, "set_num_interop_threads"):
            torch.set_num_interop_threads(1)
        return torch
    except Exception as exc:
        logger.warning("Torch runtime tuning skipped: %s", exc)
        return None

# ============================================================
# REQUEST MODELS
# ============================================================

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = Field(DEFAULT_TOP_K, ge=1, le=MAX_TOP_K)
    category: Optional[str] = None
    program_level: Optional[str] = None
    priority_only: Optional[bool] = False


# ============================================================
# EMBEDDING ENGINE
# ============================================================

class EmbeddingEngine:
    def __init__(self):
        self.model = None
        self.load_lock = threading.Lock()
        self.loaded_at: Optional[float] = None
        self.last_error: Optional[str] = None
        self.load_seconds: Optional[float] = None
        self.encode_count = 0
        self.last_encode_seconds: Optional[float] = None

    def _build_model(self):
        torch = _configure_torch_runtime()
        from sentence_transformers import SentenceTransformer

        kwargs = {"device": EMBEDDING_DEVICE}
        if EMBEDDING_LOW_CPU_MEM_USAGE:
            kwargs["model_kwargs"] = {"low_cpu_mem_usage": True}

        try:
            model = SentenceTransformer(EMBEDDING_MODEL, **kwargs)
        except TypeError:
            kwargs.pop("model_kwargs", None)
            model = SentenceTransformer(EMBEDDING_MODEL, **kwargs)

        if EMBEDDING_DYNAMIC_QUANTIZE and torch is not None:
            try:
                model._first_module().auto_model = torch.quantization.quantize_dynamic(
                    model._first_module().auto_model,
                    {torch.nn.Linear},
                    dtype=torch.qint8,
                )
                logger.info("Dynamic quantization applied to embedding model (opt-in).")
            except Exception as exc:
                logger.warning("Dynamic quantization skipped: %s", exc)

        return model

    def load(self):
        if self.model is not None:
            return self.model

        with self.load_lock:
            if self.model is not None:
                return self.model

            logger.info(
                "Lazy-loading embedding model %s on %s (low_cpu_mem_usage=%s, batch=%s)",
                EMBEDDING_MODEL,
                EMBEDDING_DEVICE,
                EMBEDDING_LOW_CPU_MEM_USAGE,
                EMBEDDING_BATCH_SIZE,
            )
            start = time.time()
            try:
                self.model = self._build_model()
                self.loaded_at = time.time()
                self.load_seconds = round(self.loaded_at - start, 3)
                self.last_error = None
                logger.info("Embedding model loaded in %.2fs", self.load_seconds)
                return self.model
            except Exception as exc:
                self.last_error = str(exc)
                logger.exception("Embedding model load failed.")
                gc.collect()
                raise

    def encode_query(self, query: str) -> Any:
        start = time.time()
        model = self.load()
        vector = model.encode(
            query,
            batch_size=EMBEDDING_BATCH_SIZE,
            normalize_embeddings=True,
            convert_to_numpy=True
        )
        self.encode_count += 1
        self.last_encode_seconds = round(time.time() - start, 3)
        return vector

    def status(self) -> Dict[str, Any]:
        return {
            "model": EMBEDDING_MODEL,
            "init_mode": EMBEDDING_INIT_MODE,
            "loaded": self.model is not None,
            "device": EMBEDDING_DEVICE,
            "low_cpu_mem_usage": EMBEDDING_LOW_CPU_MEM_USAGE,
            "dynamic_quantize": EMBEDDING_DYNAMIC_QUANTIZE,
            "batch_size": EMBEDDING_BATCH_SIZE,
            "torch_num_threads": TORCH_NUM_THREADS,
            "loaded_at": self.loaded_at,
            "load_seconds": self.load_seconds,
            "last_error": self.last_error,
            "encode_count": self.encode_count,
            "last_encode_seconds": self.last_encode_seconds,
        }


# ============================================================
# QUERY CLASSIFIER
# ============================================================

class QueryClassifier:
    """
    Lightweight keyword-based metadata routing classifier.
    Can later be replaced by an LLM intent router.
    Uses word-boundary matching to avoid substring false positives.
    """

    CATEGORY_KEYWORDS = {
        "grading_policies": ["gpa", "grade", "grades", "probation", "dismissal", "cgpa"],
        "financial_policies": ["scholarship", "fees", "tuition", "financial", "payment", "cost"],
        "admissions": ["admission", "admissions", "enroll", "enrollment", "transfer"],
        "compliance": ["compliance", "quality", "regulation", "accreditation"],
        "postgraduate_programs": ["master", "msc", "postgraduate", "graduate", "phd", "doctorate"],
    }

    @staticmethod
    def _word_in_query(word: str, query_tokens: List[str]) -> bool:
        return word in query_tokens

    @classmethod
    def infer_category(cls, query: str) -> Optional[str]:
        tokens = re.findall(r"\b\w+\b", query.lower())

        for category, keywords in cls.CATEGORY_KEYWORDS.items():
            if any(cls._word_in_query(kw, tokens) for kw in keywords):
                return category

        return None


# ============================================================
# RERANKER
# ============================================================

class RetrievalReranker:
    """
    Score normalization approach:
    Raw score is multiplied by boosts, then clamped to [0.0, 1.0]
    to preserve consistency with the confidence threshold.
    """

    @staticmethod
    def compute_final_score(result) -> float:
        payload = getattr(result, "payload", {}) or {}

        base_score = getattr(result, "score", 0.0)
        category = payload.get("category", "other")
        priority = payload.get("priority", "medium")
        
        try:
            quality_score = float(payload.get("quality_score", 0.5))
        except (ValueError, TypeError):
            quality_score = 0.5

        category_boost = CATEGORY_BOOSTS.get(category, 1.0)
        priority_boost = PRIORITY_BOOSTS.get(priority, 1.0)

        # Boost applied as additive weight to preserve [0,1] range
        boost_factor = (category_boost + priority_boost + (1 + quality_score)) / 3
        final_score = base_score * boost_factor

        # Clamp to [0.0, 1.0]
        final_score = min(max(final_score, 0.0), 1.0)

        return round(final_score, 4)


# ============================================================
# MAIN RETRIEVAL ENGINE
# ============================================================

class ProductionRetriever:
    def __init__(self):
        logger.info("Connecting to Qdrant...")
        self.client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

        try:
            self.client.get_collections()
            logger.info("Qdrant connection verified.")
        except Exception as e:
            raise ConnectionError(f"Unable to connect to Qdrant: {e}")

        self.embedder = EmbeddingEngine()
        self.started_at = time.time()

        if EMBEDDING_INIT_MODE == "eager":
            self.embedder.load()

    def _extract_points(self, response: Any) -> List[Any]:
        """Safely extract points from Qdrant response regardless of SDK version/format."""
        if response is None:
            return []
        
        # If it's a tuple (e.g., (results, next_page))
        if isinstance(response, tuple):
            if len(response) > 0:
                return self._extract_points(response[0])
            return []
            
        # If it's a QueryResponse object (has .points)
        if hasattr(response, "points"):
            return response.points
            
        # If it's an iterable of points already
        if isinstance(response, list):
            return response
            
        return []

    def build_filter(
        self,
        category: Optional[str],
        program_level: Optional[str],
        priority_only: bool
    ) -> Optional[Filter]:

        conditions = []

        if category:
            conditions.append(
                FieldCondition(key="category", match=MatchValue(value=category))
            )

        if program_level:
            conditions.append(
                FieldCondition(key="program_level", match=MatchValue(value=program_level))
            )

        if priority_only:
            conditions.append(
                FieldCondition(key="priority", match=MatchValue(value="high"))
            )

        return Filter(must=conditions) if conditions else None

    def search(
        self,
        query: str,
        top_k: int = DEFAULT_TOP_K,
        category: Optional[str] = None,
        program_level: Optional[str] = None,
        priority_only: bool = False
    ) -> Dict[str, Any]:

        start_time = time.time()

        # Auto category inference (only when user did not supply one)
        category_inferred = False
        inferred_category = QueryClassifier.infer_category(query)

        if not category and inferred_category:
            category = inferred_category
            category_inferred = True

        query_vector = self.embedder.encode_query(query)

        search_filter = self.build_filter(
            category=category,
            program_level=program_level,
            priority_only=priority_only
        )

        fallback_used = False

        try:
            raw_results = self.client.query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector.tolist(),
                query_filter=search_filter,
                limit=top_k
            )
        except Exception as e:
            logger.warning(f"query_points failed, attempting search compatibility mode: {e}")
            raw_results = self.client.search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector.tolist(),
                query_filter=search_filter,
                limit=top_k
            )

        points = self._extract_points(raw_results)

        # Fallback if no results found with category filter
        if not points and category is not None:
            fallback_used = True
            logger.info(f"Category '{category}' filter yielded 0 results. Triggering fallback search.")
            search_filter = self.build_filter(
                category=None,
                program_level=program_level,
                priority_only=priority_only
            )
            try:
                raw_results = self.client.query_points(
                    collection_name=COLLECTION_NAME,
                    query=query_vector.tolist(),
                    query_filter=search_filter,
                    limit=top_k
                )
            except Exception:
                raw_results = self.client.search(
                    collection_name=COLLECTION_NAME,
                    query_vector=query_vector.tolist(),
                    query_filter=search_filter,
                    limit=top_k
                )
            points = self._extract_points(raw_results)

        reranked = []

        for result in points:
            final_score = RetrievalReranker.compute_final_score(result)

            if final_score < MIN_CONFIDENCE_THRESHOLD:
                continue

            payload = getattr(result, "payload", {}) or {}

            reranked.append({
                "id": getattr(result, "id", None),
                "title": payload.get("title", "Unknown Title"),
                "content": payload.get("content", ""),
                "category": payload.get("category", "unknown"),
                "subcategory": payload.get("subcategory"),
                "priority": payload.get("priority", "medium"),
                "document_type": payload.get("document_type", "unknown"),
                "program_level": payload.get("program_level"),
                "source": payload.get("source", "unknown"),
                "quality_score": payload.get("quality_score", 0.5),
                "retrieval_score": round(getattr(result, "score", 0.0), 4),
                "final_score": final_score,
                "tags": payload.get("tags", [])
            })

        # Sort by final score
        reranked.sort(key=lambda x: x["final_score"], reverse=True)

        # Source diversity control (max 2 per source)
        diverse_results = []
        source_counts = {}
        for r in reranked:
            src = r.get("source", "unknown")
            if source_counts.get(src, 0) < 2:
                diverse_results.append(r)
                source_counts[src] = source_counts.get(src, 0) + 1
        
        reranked = diverse_results

        # Initial avg confidence for dynamic sizing
        avg_confidence = (
            round(sum(x["final_score"] for x in reranked) / len(reranked), 4)
            if reranked else 0.0
        )

        # Dynamic retrieval sizing
        if avg_confidence > 0.80:
            dynamic_top_k = 3
        elif avg_confidence > 0.65:
            dynamic_top_k = 5
        else:
            dynamic_top_k = 8

        reranked = reranked[:dynamic_top_k]

        latency = round(time.time() - start_time, 3)

        # Recalculate avg confidence after final trim
        avg_confidence = (
            round(sum(x["final_score"] for x in reranked) / len(reranked), 4)
            if reranked else 0.0
        )

        # Determine confidence level
        if avg_confidence >= 0.80:
            confidence_level = "HIGH"
        elif avg_confidence >= 0.65:
            confidence_level = "MEDIUM"
        else:
            confidence_level = "LOW"

        unique_sources = len(set(x.get("source", "unknown") for x in reranked))
        source_diversity_score = round(unique_sources / len(reranked), 2) if reranked else 0.0

        logger.info(
            f"query='{query}' category={category} "
            f"inferred={category_inferred} fallback={fallback_used} results={len(reranked)} "
            f"latency={latency}s avg_confidence={avg_confidence} level={confidence_level}"
        )

        return {
            "query": query,
            "category_filter": category,
            "category_inferred": category_inferred,
            "fallback_used": fallback_used,
            "program_level_filter": program_level,
            "priority_only": priority_only,
            "results_count": len(reranked),
            "avg_confidence": avg_confidence,
            "retrieval_confidence_level": confidence_level,
            "source_diversity_score": source_diversity_score,
            "latency_seconds": latency,
            "results": reranked
        }


# ============================================================
# LIFESPAN — deferred initialization (no module-level side effects)
# ============================================================

retriever: Optional[ProductionRetriever] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global retriever
    logger.info("Initializing ProductionRetriever with embedding init mode: %s", EMBEDDING_INIT_MODE)
    retriever = ProductionRetriever()
    logger.info("ProductionRetriever ready.")
    yield
    logger.info("Shutting down.")


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="CAI-AAST Production VectorRAG Retriever",
    version="3.1",
    lifespan=lifespan
)


# ============================================================
# API ROUTES
# ============================================================

@app.get("/")
def root():
    return {
        "status": "healthy",
        "system": "Production VectorRAG Retriever",
        "collection": COLLECTION_NAME
    }


@app.post("/search")
def search_endpoint(request: SearchRequest):
    if retriever is None:
        raise HTTPException(status_code=503, detail="Retriever is still initializing.")

    if not request.query.strip():
        raise HTTPException(
            status_code=422,
            detail="Query cannot be empty."
        )

    try:
        return retriever.search(
            query=request.query,
            top_k=request.top_k,
            category=request.category,
            program_level=request.program_level,
            priority_only=request.priority_only
        )

    except Exception as e:
        logger.exception("Search failed.")
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again."
        )


@app.get("/health")
def system_health():
    try:
        if retriever is None:
            return {
                "status": "starting",
                "qdrant_connected": False,
                "embedding": {
                    "model": EMBEDDING_MODEL,
                    "init_mode": EMBEDDING_INIT_MODE,
                    "loaded": False
                },
                "memory": _process_memory_mb(),
            }

        collections = retriever.client.get_collections()
        return {
            "status": "healthy",
            "qdrant_connected": True,
            "embedding_model": EMBEDDING_MODEL,
            "embedding": retriever.embedder.status(),
            "collection_name": COLLECTION_NAME,
            "collections_available": len(collections.collections),
            "memory": _process_memory_mb(),
        }

    except Exception as e:
        logger.exception("Health check failed.")
        return {
            "status": "unhealthy",
            "error": "Qdrant unreachable."
        }


@app.get("/benchmark")
def run_benchmark():
    test_queries = [
        "What are the general academic policies?",
        "How do I apply for admissions?",
        "Are there any scholarships available?",
        "How is the GPA grading scale calculated?"
    ]
    
    total_latency = 0.0
    total_confidence = 0.0
    
    try:
        for q in test_queries:
            res = retriever.search(query=q, top_k=8)
            total_latency += res["latency_seconds"]
            total_confidence += res["avg_confidence"]
            
        avg_latency = round(total_latency / len(test_queries), 3)
        avg_confidence = round(total_confidence / len(test_queries), 3)
        
        # Readiness score out of 100
        readiness_score = 100
        if avg_latency > 0.5:
            readiness_score -= int((avg_latency - 0.5) * 20)
        if avg_confidence < 0.8:
            readiness_score -= int((0.8 - avg_confidence) * 100)
            
        readiness_score = max(0, min(100, readiness_score))
        
        return {
            "status": "healthy",
            "avg_latency_seconds": avg_latency,
            "avg_confidence": avg_confidence,
            "retriever_readiness_score": f"{readiness_score}/100"
        }
    except Exception as e:
        logger.exception("Benchmark failed.")
        return {
            "status": "unhealthy",
            "error": "Benchmark failed."
        }


# ============================================================
# LOCAL RUN
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "phase3_retriever:app",
        host="0.0.0.0",
        port=8001,
        reload=False
    )
