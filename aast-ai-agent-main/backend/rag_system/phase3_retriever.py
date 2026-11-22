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

import asyncio
import gc
import logging
import os
import re
import threading
import time
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional, Set

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
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

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
COLLECTION_NAME = os.getenv("RAG_COLLECTION_NAME", "aast_academic_rag_production")
EXPECTED_VECTOR_SIZE = 1024

EMBEDDING_MODEL = "BAAI/bge-m3"
EMBEDDING_INIT_MODE = os.getenv("RAG_EMBEDDING_INIT_MODE", "eager").strip().lower()
EMBEDDING_DEVICE = os.getenv("RAG_EMBEDDING_DEVICE", "cpu").strip() or "cpu"
EMBEDDING_BATCH_SIZE = max(1, int(os.getenv("RAG_EMBED_BATCH_SIZE", "4")))
EMBEDDING_LOW_CPU_MEM_USAGE = os.getenv("RAG_LOW_CPU_MEM_USAGE", "true").lower() in {"1", "true", "yes", "on"}
EMBEDDING_DYNAMIC_QUANTIZE = os.getenv("RAG_EMBEDDING_DYNAMIC_QUANTIZE", "false").lower() in {"1", "true", "yes", "on"}
TORCH_NUM_THREADS = max(1, int(os.getenv("RAG_TORCH_NUM_THREADS", "4")))
HEALTH_REQUIRES_EMBEDDING = os.getenv("RAG_HEALTH_REQUIRES_EMBEDDING", "true").lower() in {"1", "true", "yes", "on"}
WARMUP_QUERY = os.getenv("RAG_WARMUP_QUERY", "admission requirements academic policies").strip() or "admission requirements academic policies"
READINESS_SMOKE_LIMIT = max(1, min(int(os.getenv("RAG_READINESS_SMOKE_LIMIT", "3")), 10))
EXPECTED_DISTANCE = "cosine"
READINESS_REQUIRED_PAYLOAD_FIELDS = {
    "title",
    "content",
    "category",
    "subcategory",
    "priority",
    "document_type",
    "program_level",
    "source",
    "quality_score",
    "tags",
}

DEFAULT_TOP_K = 8
FINAL_TOP_K = 5
MAX_TOP_K = 50

# CLA-WOW-002: retrieve a wide candidate pool BEFORE reranking, then select a
# small bounded final set. A shallow pool cannot recover a passage that dense
# search ranks just outside top_k but that reranking would promote.
CANDIDATE_POOL_SIZE = int(os.getenv("RAG_CANDIDATE_POOL_SIZE", "22"))
MIN_FINAL_TOP_K = int(os.getenv("RAG_MIN_FINAL_TOP_K", "5"))
MAX_FINAL_TOP_K = int(os.getenv("RAG_MAX_FINAL_TOP_K", "8"))

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

# CLA-WOW-002: minimum reranked relevance an accepted chunk must reach. Enforced
# after reranking so a semantic false positive can be dropped, and so unsupported
# / out-of-domain queries abstain instead of returning unrelated chunks.
MIN_RELEVANCE_THRESHOLD = float(os.getenv("RAG_MIN_RELEVANCE_THRESHOLD", str(MIN_CONFIDENCE_THRESHOLD)))

# A chunk is only acceptable if it shares at least one of these alignment signals
# with the standalone query (lexical, entity/title, category, or document type).
ALIGNMENT_SIGNAL_KEYS = (
    "lexical_overlap",
    "title_similarity",
    "category_alignment",
    "document_type_alignment",
    "tag_overlap",
)

PHASE_B_WEIGHTS = {
    "semantic_similarity": 0.30,
    "document_type_alignment": 0.24,
    "title_similarity": 0.16,
    "lexical_overlap": 0.12,
    "category_alignment": 0.08,
    "tag_overlap": 0.05,
    "program_level_alignment": 0.03,
    "priority_score": 0.01,
    "quality_score": 0.01,
}

TOKEN_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "before",
    "between", "by", "can", "do", "does", "during", "each", "for", "from",
    "had", "has", "have", "how", "i", "if", "in", "into", "is", "many",
    "my", "of", "on", "or", "student", "students", "such", "the", "to",
    "what", "when", "which", "who", "with", "college", "artificial",
    "intelligence",
}

TOKEN_SYNONYMS = {
    "admissions": "admission",
    "admitted": "admission",
    "apply": "application",
    "cgpa": "gpa",
    "conditioned": "condition",
    "documents": "document",
    "exemption": "scholarship",
    "fees": "fee",
    "grades": "grade",
    "grading": "grade",
    "prerequisites": "prerequisite",
    "programs": "program",
    "required": "requirement",
    "requirements": "requirement",
    "scholarships": "scholarship",
    "semesters": "semester",
    "specializations": "specialization",
    "transferred": "transfer",
}

GENERIC_FIELD_PARTS = {
    "academic", "general", "policies", "policy", "program", "programs",
    "requirement", "requirements", "rules",
}

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
        self.load_started_at: Optional[float] = None
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
            self.load_started_at = start
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
            "loading": self.load_lock.locked() and self.model is None,
            "device": EMBEDDING_DEVICE,
            "low_cpu_mem_usage": EMBEDDING_LOW_CPU_MEM_USAGE,
            "dynamic_quantize": EMBEDDING_DYNAMIC_QUANTIZE,
            "batch_size": EMBEDDING_BATCH_SIZE,
            "torch_num_threads": TORCH_NUM_THREADS,
            "loaded_at": self.loaded_at,
            "load_started_at": self.load_started_at,
            "load_seconds": self.load_seconds,
            "last_error": self.last_error,
            "encode_count": self.encode_count,
            "last_encode_seconds": self.last_encode_seconds,
        }

    def close(self):
        with self.load_lock:
            self.model = None
            self.loaded_at = None
        gc.collect()


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
    Phase B metadata-aware reranker.
    It only reorders candidates that Qdrant already returned; it does not
    filter categories, document types, tags, or program levels.
    """

    @staticmethod
    def _normalize(value: Any) -> str:
        normalized = re.sub(r"[^a-z0-9]+", "_", str(value or "").lower())
        return re.sub(r"_+", "_", normalized).strip("_")

    @staticmethod
    def _tokenize(value: Any) -> List[str]:
        raw_tokens = re.findall(r"\b[a-z0-9]+\b", str(value or "").lower().replace("_", " "))
        tokens = []
        for token in raw_tokens:
            mapped = TOKEN_SYNONYMS.get(token, token)
            if len(mapped) > 1 and mapped not in TOKEN_STOPWORDS:
                tokens.append(mapped)
        return tokens

    @classmethod
    def _split_field_values(cls, value: Any) -> Set[str]:
        if isinstance(value, (list, tuple, set)):
            values = value
        else:
            values = re.split(r"[/|,]", str(value or ""))
        return {cls._normalize(v) for v in values if cls._normalize(v)}

    @staticmethod
    def _overlap_score(query_terms: List[str], candidate_terms: List[str]) -> float:
        unique_query_terms = list(dict.fromkeys(query_terms))
        if not unique_query_terms:
            return 0.0

        candidate_set = set(candidate_terms)
        matches = sum(1 for term in unique_query_terms if term in candidate_set)
        return matches / len(unique_query_terms)

    @classmethod
    def _family_match(cls, expected_values: Set[str], actual_value: Any) -> bool:
        actual_parts = {
            part for part in cls._normalize(actual_value).split("_")
            if len(part) > 3 and part not in GENERIC_FIELD_PARTS
        }
        if not actual_parts:
            return False

        for expected in expected_values:
            expected_parts = {
                part for part in expected.split("_")
                if len(part) > 3 and part not in GENERIC_FIELD_PARTS
            }
            if actual_parts & expected_parts:
                return True
        return False

    @staticmethod
    def _clamp01(value: Any, default: float = 0.0) -> float:
        try:
            numeric = float(value)
        except (ValueError, TypeError):
            numeric = default
        return min(max(numeric, 0.0), 1.0)

    @classmethod
    def build_query_profile(
        cls,
        query: str,
        category: Optional[str] = None,
        program_level: Optional[str] = None,
    ) -> Dict[str, Any]:
        query_lower = query.lower()
        categories: Set[str] = set()
        document_types: Set[str] = set()
        program_levels: Set[str] = set()

        def add_categories(*values: str):
            categories.update(cls._normalize(v) for v in values if v)

        def add_document_types(*values: str):
            document_types.update(cls._normalize(v) for v in values if v)

        def add_program_levels(*values: str):
            program_levels.update(cls._normalize(v) for v in values if v)

        if re.search(r"\b(scholarship|exemption|high-performing|4\.00|tie|tuition exemption)\b", query_lower):
            add_categories("academic_policies", "financial_policies")
            add_document_types("scholarship_policy")

        if re.search(r"\b(tuition|fee|fees|payment|cost)\b", query_lower):
            add_categories("financial_policies")
            add_document_types("tuition_policy", "scholarship_policy")

        if re.search(r"\b(admission|admissions|admit|apply|application|documents|required|requirements|checklist|score|pass degree)\b", query_lower):
            add_categories("admissions", "admissions_registration")
            add_document_types("admission_policy")

        if re.search(r"\b(transfer|transferred|internal transfer|external transfer)\b", query_lower):
            add_categories("admissions_registration")
            add_document_types("transfer_policy", "admission_policy")

        if re.search(r"\b(orientation|registration|register|credit hour|semester course load|course load)\b", query_lower):
            add_categories("admissions_registration", "academic_programs")
            add_document_types("registration_policy")

        if re.search(r"\b(gpa|cgpa|grade|grades|probation|underachievement|conditioned pass|repeat|repeated|failed course|marks|final exam|incomplete|passing|dismissal)\b", query_lower):
            add_categories("grading_policies", "academic_rules", "academic_policies")
            add_document_types("grading_policy")

        if re.search(r"\b(absent|absence)\b", query_lower):
            add_categories("grading_policies", "academic_rules")
            add_document_types("attendance_policy", "grading_policy")

        if re.search(r"\b(prerequisite|prerequisites)\b", query_lower):
            add_categories("academic_rules")
            add_document_types("prerequisite_policy")

        if re.search(r"\b(advisor|adviser|support|course selection|academic planning)\b", query_lower):
            add_categories("academic_policies")
            add_document_types("compliance_policy", "general_policy")

        if re.search(r"\b(program|structure|duration|study|specialization|specializations|academic year|first four|summer studies|uclan|credit hour system)\b", query_lower):
            add_categories("academic_programs", "postgraduate_programs")
            add_document_types("general_policy", "graduation_policy", "registration_policy")

        if re.search(r"\b(msc|master|postgraduate|graduate|thesis|research|supervision|nlp|xai|bilingual|milestones)\b", query_lower):
            add_categories("postgraduate_programs", "academic_policies")
            add_document_types("research_requirement", "graduation_policy", "general_policy", "admission_policy")
            add_program_levels("postgraduate")

        if re.search(r"\b(undergraduate|secondary)\b", query_lower):
            add_program_levels("undergraduate")

        if program_level:
            add_program_levels(program_level)

        # Use caller/category inference only as a fallback signal. This avoids
        # reintroducing Phase A's wrong-category behavior as a strong rank bias.
        if category and not categories:
            add_categories(category)

        query_terms = cls._tokenize(query)
        return {
            "categories": categories,
            "document_types": document_types,
            "program_levels": program_levels,
            "query_terms": list(dict.fromkeys(query_terms)),
        }

    @classmethod
    def _alignment_score(cls, expected_values: Set[str], actual_value: Any, family_value: float) -> float:
        actual = cls._normalize(actual_value)
        if not expected_values:
            return 0.0
        if actual in expected_values:
            return 1.0
        if cls._family_match(expected_values, actual):
            return family_value
        return 0.0

    @classmethod
    def _program_level_score(cls, expected_levels: Set[str], actual_level: Any) -> float:
        actual = cls._normalize(actual_level)
        if not expected_levels:
            return 0.5
        if actual in expected_levels:
            return 1.0
        if actual:
            return 0.1
        return 0.45

    @classmethod
    def _priority_score(cls, value: Any) -> float:
        normalized = cls._normalize(value)
        if normalized == "high":
            return 1.0
        if normalized == "medium":
            return 0.6
        if normalized == "low":
            return 0.25

        try:
            numeric = float(value)
            if numeric > 1:
                numeric = numeric / 10
            return cls._clamp01(numeric, default=0.5)
        except (ValueError, TypeError):
            return 0.5

    @staticmethod
    def _round_signals(signals: Dict[str, float]) -> Dict[str, float]:
        return {key: round(value, 4) for key, value in signals.items()}

    @classmethod
    def compute_phase_b_score(cls, result, query_profile: Dict[str, Any]) -> Dict[str, Any]:
        payload = getattr(result, "payload", {}) or {}

        title_terms = cls._tokenize(
            f"{payload.get('title', '')} {payload.get('subcategory', '')}"
        )
        tag_terms = cls._tokenize(" ".join(payload.get("tags", []) or []))
        content_terms = cls._tokenize(payload.get("content", ""))
        query_terms = query_profile.get("query_terms", [])

        signals = {
            "semantic_similarity": cls._clamp01(getattr(result, "score", 0.0)),
            "document_type_alignment": cls._alignment_score(
                query_profile.get("document_types", set()),
                payload.get("document_type"),
                0.5,
            ),
            "title_similarity": cls._overlap_score(query_terms, title_terms),
            "lexical_overlap": cls._overlap_score(query_terms, title_terms + tag_terms + content_terms),
            "category_alignment": cls._alignment_score(
                query_profile.get("categories", set()),
                payload.get("category"),
                0.55,
            ),
            "tag_overlap": cls._overlap_score(query_terms, tag_terms),
            "program_level_alignment": cls._program_level_score(
                query_profile.get("program_levels", set()),
                payload.get("program_level"),
            ),
            "priority_score": cls._priority_score(payload.get("priority", "medium")),
            "quality_score": cls._clamp01(payload.get("quality_score", 0.5), default=0.5),
        }

        phase_b_score = sum(
            signals[name] * PHASE_B_WEIGHTS[name]
            for name in PHASE_B_WEIGHTS
        )

        return {
            "score": round(phase_b_score, 4),
            "signals": cls._round_signals(signals),
            "weights": PHASE_B_WEIGHTS,
        }

    @classmethod
    def evaluate_acceptance(cls, final_score: float, signals: Dict[str, float]) -> Dict[str, Any]:
        """
        Decide whether a reranked candidate is admissible evidence and record an
        auditable reason. A chunk must (1) share query alignment and (2) reach the
        minimum reranked relevance. Reranked relevance is authoritative, so a
        high-semantic / no-metadata false positive is rejected.
        """
        has_alignment = any(
            cls._clamp01(signals.get(key, 0.0)) > 0.0 for key in ALIGNMENT_SIGNAL_KEYS
        )
        if not has_alignment:
            return {"accepted": False, "reason": "no_query_alignment", "has_alignment": False}
        if final_score < MIN_RELEVANCE_THRESHOLD:
            return {"accepted": False, "reason": "below_min_relevance", "has_alignment": True}
        return {"accepted": True, "reason": "accepted", "has_alignment": True}


def _final_top_k(top_k: int) -> int:
    """Bound the final result count to the configured 5..8 window."""
    try:
        requested = int(top_k)
    except (TypeError, ValueError):
        requested = DEFAULT_TOP_K
    return max(MIN_FINAL_TOP_K, min(requested, MAX_FINAL_TOP_K))


def _candidate_limit(top_k: int) -> int:
    """Widen the Qdrant fetch to at least the candidate pool, capped at MAX_TOP_K."""
    try:
        requested = int(top_k)
    except (TypeError, ValueError):
        requested = DEFAULT_TOP_K
    return max(1, min(max(CANDIDATE_POOL_SIZE, requested), MAX_TOP_K))


def rank_gate_select(points: List[Any], query_profile: Dict[str, Any], final_k: int) -> Dict[str, Any]:
    """
    Rerank a candidate pool, enforce relevance/alignment gating, and select the
    final bounded set. Pure with respect to I/O (no Qdrant/embedder) so it is unit
    testable against fixture points. Reranked relevance is authoritative — the
    confidence score is the reranked score, never max(rerank, raw_semantic).
    """
    reranked: List[Dict[str, Any]] = []

    for result in points:
        phase_b = RetrievalReranker.compute_phase_b_score(result, query_profile)
        final_score = phase_b["score"]
        signals = phase_b["signals"]
        retrieval_score = round(RetrievalReranker._clamp01(getattr(result, "score", 0.0)), 4)
        verdict = RetrievalReranker.evaluate_acceptance(final_score, signals)
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
            "retrieval_score": retrieval_score,
            "phase_b_score": final_score,
            "final_score": final_score,
            # Authoritative: reranked relevance, not max(rerank, raw semantic).
            "confidence_score": final_score,
            "accepted": verdict["accepted"],
            "acceptance_reason": verdict["reason"],
            "has_alignment": verdict["has_alignment"],
            "ranking_signals": signals,
            "ranking_weights": phase_b["weights"],
            "ranking_profile": "metadata_heavy",
            "tags": payload.get("tags", []),
        })

    reranked.sort(key=lambda x: x["final_score"], reverse=True)

    accepted = [r for r in reranked if r["accepted"]]
    rejected = [
        {
            "id": r["id"],
            "reason": r["acceptance_reason"],
            "final_score": r["final_score"],
            "retrieval_score": r["retrieval_score"],
        }
        for r in reranked if not r["accepted"]
    ]

    selected = accepted[:final_k]
    abstained = len(selected) == 0

    abstention_reason = None
    if abstained:
        if not reranked:
            abstention_reason = "no_candidates"
        elif not any(r["has_alignment"] for r in reranked):
            abstention_reason = "out_of_domain_no_alignment"
        else:
            abstention_reason = "below_min_relevance"

    avg_confidence = (
        round(sum(r["confidence_score"] for r in selected) / len(selected), 4)
        if selected else 0.0
    )

    return {
        "selected": selected,
        "rejected": rejected,
        "candidates_evaluated": len(reranked),
        "accepted_count": len(accepted),
        "abstained": abstained,
        "abstention_reason": abstention_reason,
        "avg_confidence": avg_confidence,
    }


# ============================================================
# MAIN RETRIEVAL ENGINE
# ============================================================

class ProductionRetriever:
    def __init__(self):
        logger.info("Connecting to Qdrant...")
        self.client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        self.embedder: Optional[EmbeddingEngine] = None

        try:
            self.client.get_collections()
            logger.info("Qdrant connection verified.")
        except Exception as e:
            self.close()
            raise ConnectionError(f"Unable to connect to Qdrant: {e}")

        try:
            self.embedder = EmbeddingEngine()
            self.started_at = time.time()

            if EMBEDDING_INIT_MODE == "eager":
                self.embedder.load()
        except Exception:
            self.close()
            raise

    def close(self):
        embedder = getattr(self, "embedder", None)
        client = getattr(self, "client", None)
        self.embedder = None
        self.client = None
        try:
            if embedder is not None:
                embedder.close()
        finally:
            close = getattr(client, "close", None)
            if callable(close):
                close()

    def warmup(self, query: str = WARMUP_QUERY) -> Dict[str, Any]:
        start = time.time()
        self.embedder.encode_query(query)
        latency = round(time.time() - start, 3)
        logger.info("Retriever warmup completed in %.2fs", latency)
        return {
            "status": "ready",
            "warmup_query": query,
            "latency_seconds": latency,
            "embedding": self.embedder.status(),
        }

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

    def _query_qdrant(
        self,
        query_vector: List[float],
        query_filter: Optional[Filter],
        limit: int,
    ) -> Any:
        """Use the SDK method supported by the installed qdrant-client version."""
        query_points = getattr(self.client, "query_points", None)
        if callable(query_points):
            return query_points(
                collection_name=COLLECTION_NAME,
                query=query_vector,
                query_filter=query_filter,
                limit=limit,
            )

        legacy_search = getattr(self.client, "search", None)
        if callable(legacy_search):
            return legacy_search(
                collection_name=COLLECTION_NAME,
                query_vector=query_vector,
                query_filter=query_filter,
                limit=limit,
            )

        raise RuntimeError(
            "Installed qdrant-client exposes neither query_points() nor search()."
        )

    def build_filter(
        self,
        category: Optional[str],
        program_level: Optional[str],
        priority_only: bool
    ) -> Optional[Filter]:

        conditions = []

        # Category is intentionally kept as a diagnostic/ranking signal only.
        # Applying it as a Qdrant must-filter excludes relevant cross-category evidence.

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

        # CLA-WOW-002: fetch a wide candidate pool, then select a small bounded set.
        candidate_limit = _candidate_limit(top_k)
        final_k = _final_top_k(top_k)

        # Auto category inference (only when user did not supply one)
        category_inferred = False
        inferred_category = QueryClassifier.infer_category(query)

        if not category and inferred_category:
            category = inferred_category
            category_inferred = True

        query_profile = RetrievalReranker.build_query_profile(
            query=query,
            category=category,
            program_level=program_level
        )

        query_vector = self.embedder.encode_query(query)

        search_filter = self.build_filter(
            category=category,
            program_level=program_level,
            priority_only=priority_only
        )

        fallback_used = False

        raw_results = self._query_qdrant(
            query_vector=query_vector.tolist(),
            query_filter=search_filter,
            limit=candidate_limit,
        )

        points = self._extract_points(raw_results)

        # Category is a ranking/diagnostic signal, not a Qdrant filter. Repeating
        # the same vector query without it cannot widen the candidate set, so an
        # empty result proceeds directly to the explicit abstention path.

        # Rerank the wide candidate pool, enforce relevance/alignment gating, and
        # select the bounded final set (abstaining when nothing qualifies).
        outcome = rank_gate_select(points, query_profile, final_k)
        reranked = outcome["selected"]

        latency = round(time.time() - start_time, 3)

        avg_confidence = outcome["avg_confidence"]

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
            f"inferred={category_inferred} fallback={fallback_used} "
            f"pool={candidate_limit} evaluated={outcome['candidates_evaluated']} "
            f"accepted={outcome['accepted_count']} results={len(reranked)} "
            f"abstained={outcome['abstained']} reason={outcome['abstention_reason']} "
            f"latency={latency}s avg_confidence={avg_confidence} level={confidence_level}"
        )

        return {
            "query": query,
            "category_filter": category,
            "category_filter_applied": False,
            "category_inferred": category_inferred,
            "fallback_used": fallback_used,
            "program_level_filter": program_level,
            "priority_only": priority_only,
            "results_count": len(reranked),
            "avg_confidence": avg_confidence,
            "retrieval_confidence_level": confidence_level,
            "source_diversity_score": source_diversity_score,
            "latency_seconds": latency,
            # CLA-WOW-002 auditable relevance envelope.
            "candidate_pool_size": candidate_limit,
            "candidates_evaluated": outcome["candidates_evaluated"],
            "accepted_count": outcome["accepted_count"],
            "min_relevance_threshold": MIN_RELEVANCE_THRESHOLD,
            "abstained": outcome["abstained"],
            "abstention_reason": outcome["abstention_reason"],
            "rejections": outcome["rejected"],
            "results": reranked
        }


# ============================================================
# LIFESPAN — deferred initialization (no module-level side effects)
# ============================================================

retriever: Optional[ProductionRetriever] = None
retriever_init_failure: Optional[str] = None
retriever_state_lock = threading.Lock()

RETRIEVER_INIT_MAX_ATTEMPTS = int(os.getenv("RETRIEVER_INIT_MAX_ATTEMPTS", "5"))
RETRIEVER_INIT_BACKOFF_SECONDS = float(os.getenv("RETRIEVER_INIT_BACKOFF_SECONDS", "2"))
RETRIEVER_RECOVERY_INTERVAL_SECONDS = float(os.getenv("RETRIEVER_RECOVERY_INTERVAL_SECONDS", "10"))


def _classify_initialization_failure(error: Exception) -> str:
    return (
        "qdrant_unavailable"
        if isinstance(error, ConnectionError)
        else "retriever_initialization_failed"
    )


def _close_retriever(instance: Optional[ProductionRetriever]):
    if instance is None:
        return
    try:
        instance.close()
    except Exception:
        logger.exception("Failed to close retriever resources cleanly.")


def _construct_and_warm_retriever() -> ProductionRetriever:
    candidate: Optional[ProductionRetriever] = None
    try:
        candidate = ProductionRetriever()
        if EMBEDDING_INIT_MODE == "eager":
            candidate.warmup()
        return candidate
    except Exception:
        _close_retriever(candidate)
        raise


async def _initialize_retriever_once() -> bool:
    global retriever, retriever_init_failure
    try:
        candidate = await asyncio.to_thread(_construct_and_warm_retriever)
    except Exception as error:
        with retriever_state_lock:
            retriever_init_failure = _classify_initialization_failure(error)
        logger.warning("Retriever initialization attempt failed: %s", retriever_init_failure)
        return False

    with retriever_state_lock:
        previous = retriever
        retriever = candidate
        retriever_init_failure = None
    if previous is not candidate:
        await asyncio.to_thread(_close_retriever, previous)
    logger.info("ProductionRetriever initialized and warmup policy completed.")
    return True


async def _initialize_retriever_with_retries(max_attempts: int) -> bool:
    attempts = max(1, max_attempts)
    for attempt in range(1, attempts + 1):
        if await _initialize_retriever_once():
            return True
        if attempt < attempts:
            wait_seconds = RETRIEVER_INIT_BACKOFF_SECONDS * (2 ** (attempt - 1))
            logger.warning(
                "Retriever initialization failed (attempt %d/%d); retrying in %.1fs.",
                attempt,
                attempts,
                wait_seconds,
            )
            await asyncio.sleep(wait_seconds)
    return False


async def _recover_retriever_until_ready(shutdown_event: asyncio.Event):
    while not shutdown_event.is_set():
        if await _initialize_retriever_once():
            return
        try:
            await asyncio.wait_for(
                shutdown_event.wait(),
                timeout=max(0.1, RETRIEVER_RECOVERY_INTERVAL_SECONDS),
            )
        except asyncio.TimeoutError:
            continue


@asynccontextmanager
async def lifespan(app: FastAPI):
    global retriever, retriever_init_failure
    logger.info("Initializing ProductionRetriever with embedding init mode: %s", EMBEDDING_INIT_MODE)
    with retriever_state_lock:
        retriever = None
        retriever_init_failure = None

    initialized = await _initialize_retriever_with_retries(RETRIEVER_INIT_MAX_ATTEMPTS)
    shutdown_event = asyncio.Event()
    recovery_task = None
    if not initialized:
        logger.error(
            "Initial retriever attempts exhausted; readiness remains false and background recovery is active."
        )
        recovery_task = asyncio.create_task(
            _recover_retriever_until_ready(shutdown_event),
            name="rag-retriever-recovery",
        )

    try:
        yield
    finally:
        shutdown_event.set()
        if recovery_task is not None:
            # Do not cancel a to_thread initialization: Python cannot stop the
            # worker and cancellation could orphan a newly-created model/client.
            # Let the active attempt finish, observe the shutdown event, and
            # then close the published resources below.
            await recovery_task
        with retriever_state_lock:
            active_retriever = retriever
            retriever = None
            retriever_init_failure = None
        await asyncio.to_thread(_close_retriever, active_retriever)
        logger.info("Retriever resources closed; shutdown complete.")


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


@app.get("/live")
def liveness():
    """Process liveness only; dependency and data checks belong to readiness."""
    return {
        "status": "alive",
        "system": "Production VectorRAG Retriever",
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

    except Exception:
        logger.exception("Search failed.")
        raise HTTPException(
            status_code=500,
            detail="An internal error occurred. Please try again."
        )


def _collection_names(response: Any) -> Set[str]:
    collections = getattr(response, "collections", []) or []
    names = set()
    for item in collections:
        name = item.get("name") if isinstance(item, dict) else getattr(item, "name", None)
        if name:
            names.add(str(name))
    return names


def _collection_vector_size(collection_info: Any) -> Optional[int]:
    config = getattr(collection_info, "config", None)
    params = getattr(config, "params", None)
    vectors = getattr(params, "vectors", None)

    # The retriever sends unnamed vectors. A named-vector collection therefore
    # has an incompatible schema even when one named vector happens to be 1024d.
    if isinstance(vectors, dict):
        return None

    size = getattr(vectors, "size", None)
    try:
        return int(size)
    except (TypeError, ValueError):
        return None


def _normalized_enum_value(value: Any) -> str:
    raw = getattr(value, "value", value)
    return str(raw or "").strip().lower()


def _collection_vector_distance(collection_info: Any) -> Optional[str]:
    config = getattr(collection_info, "config", None)
    params = getattr(config, "params", None)
    vectors = getattr(params, "vectors", None)
    if isinstance(vectors, dict):
        return None
    distance = _normalized_enum_value(getattr(vectors, "distance", None))
    return distance or None


def _optimizer_error(optimizer_status: Any) -> Optional[str]:
    if _normalized_enum_value(optimizer_status) == "ok":
        return None
    if isinstance(optimizer_status, dict):
        error = optimizer_status.get("error")
    else:
        error = getattr(optimizer_status, "error", None)
    if isinstance(error, str) and error.strip():
        return error.strip()
    return "optimizer_status_unavailable"


def _extract_scroll_points(response: Any) -> List[Any]:
    if isinstance(response, tuple):
        return list(response[0] or [])
    points = getattr(response, "points", None)
    if points is not None:
        return list(points)
    if isinstance(response, list):
        return response
    return []


def _payload_smoke_error(points: List[Any]) -> Optional[str]:
    if not points:
        return "payload_smoke_empty"
    for point in points:
        payload = getattr(point, "payload", None)
        if not isinstance(payload, dict):
            return "payload_missing"
        missing = READINESS_REQUIRED_PAYLOAD_FIELDS - set(payload.keys())
        if missing:
            return f"payload_fields_missing:{','.join(sorted(missing))}"
        for field in (
            "title",
            "content",
            "category",
            "subcategory",
            "priority",
            "document_type",
            "program_level",
            "source",
        ):
            if not isinstance(payload.get(field), str) or not payload[field].strip():
                return f"payload_field_invalid:{field}"
        quality = payload.get("quality_score")
        if (
            isinstance(quality, bool)
            or not isinstance(quality, (int, float))
            or not 0.0 <= float(quality) <= 1.0
        ):
            return "payload_field_invalid:quality_score"
        tags = payload.get("tags")
        if not isinstance(tags, list):
            return "payload_field_invalid:tags"
    return None


def evaluate_readiness(active_retriever: Optional[ProductionRetriever]) -> tuple[int, Dict[str, Any]]:
    """Return an HTTP status and truthful dependency/data readiness payload."""
    checks = {
        "qdrant_connected": False,
        "collection_exists": False,
        "vector_size_compatible": False,
        "vector_distance_compatible": False,
        "collection_non_empty": False,
        "collection_status_healthy": False,
        "optimizer_healthy": False,
        "payload_smoke_valid": False,
        "embedding_ready": False,
    }
    payload: Dict[str, Any] = {
        "status": "not_ready",
        "collection_name": COLLECTION_NAME,
        "expected_vector_size": EXPECTED_VECTOR_SIZE,
        "expected_distance": EXPECTED_DISTANCE,
        "qdrant_connected": False,
        "checks": checks,
        "reasons": [],
        "memory": _process_memory_mb(),
    }

    if active_retriever is None:
        payload["reasons"].append(retriever_init_failure or "retriever_initializing")
        return 503, payload

    try:
        collections = active_retriever.client.get_collections()
        checks["qdrant_connected"] = True
        payload["qdrant_connected"] = True
    except Exception:
        payload["reasons"].append("qdrant_unavailable")
        return 503, payload

    if COLLECTION_NAME not in _collection_names(collections):
        payload["reasons"].append("collection_missing")
        return 503, payload

    checks["collection_exists"] = True

    try:
        collection_info = active_retriever.client.get_collection(COLLECTION_NAME)
    except Exception:
        payload["reasons"].append("collection_metadata_unavailable")
        return 503, payload

    actual_vector_size = _collection_vector_size(collection_info)
    payload["actual_vector_size"] = actual_vector_size
    if actual_vector_size != EXPECTED_VECTOR_SIZE:
        payload["reasons"].append("vector_size_incompatible")
        return 503, payload
    checks["vector_size_compatible"] = True

    actual_distance = _collection_vector_distance(collection_info)
    payload["actual_distance"] = actual_distance
    if actual_distance != EXPECTED_DISTANCE:
        payload["reasons"].append("vector_distance_incompatible")
        return 503, payload
    checks["vector_distance_compatible"] = True

    point_count = getattr(collection_info, "points_count", None)
    payload["points_count"] = point_count
    if not isinstance(point_count, int) or point_count <= 0:
        payload["reasons"].append(
            "collection_empty" if point_count == 0 else "point_count_unavailable"
        )
        return 503, payload
    checks["collection_non_empty"] = True

    collection_status = _normalized_enum_value(getattr(collection_info, "status", None))
    payload["collection_status"] = collection_status or None
    if collection_status != "green":
        payload["reasons"].append("collection_status_unhealthy")
        return 503, payload
    checks["collection_status_healthy"] = True

    optimizer_error = _optimizer_error(getattr(collection_info, "optimizer_status", None))
    payload["optimizer_error"] = optimizer_error
    if optimizer_error is not None:
        payload["reasons"].append("optimizer_unhealthy")
        return 503, payload
    checks["optimizer_healthy"] = True

    try:
        scroll_response = active_retriever.client.scroll(
            collection_name=COLLECTION_NAME,
            limit=READINESS_SMOKE_LIMIT,
            with_payload=True,
            with_vectors=False,
        )
        smoke_points = _extract_scroll_points(scroll_response)
    except Exception:
        payload["reasons"].append("payload_smoke_failed")
        return 503, payload
    smoke_error = _payload_smoke_error(smoke_points)
    payload["payload_smoke_count"] = len(smoke_points)
    if smoke_error is not None:
        payload["reasons"].append(smoke_error)
        return 503, payload
    checks["payload_smoke_valid"] = True

    try:
        embedding_status = active_retriever.embedder.status()
    except Exception:
        payload["reasons"].append("embedding_status_unavailable")
        return 503, payload
    embedding_loaded = bool(embedding_status.get("loaded"))
    lazy_embedding_available = (
        EMBEDDING_INIT_MODE == "lazy"
        and not embedding_status.get("last_error")
    )
    checks["embedding_ready"] = (
        embedding_loaded
        or lazy_embedding_available
        or not HEALTH_REQUIRES_EMBEDDING
    )
    payload["embedding"] = embedding_status
    if not checks["embedding_ready"]:
        payload["reasons"].append("embedding_not_ready")
        return 503, payload

    payload["status"] = "ready"
    return 200, payload


@app.get("/ready")
@app.get("/health")
def system_health():
    status_code, payload = evaluate_readiness(retriever)
    return JSONResponse(status_code=status_code, content=payload)


@app.post("/warmup")
def warmup_endpoint(request: Optional[SearchRequest] = None):
    if retriever is None:
        raise HTTPException(status_code=503, detail="Retriever is still initializing.")

    query = WARMUP_QUERY
    if request is not None and request.query and request.query.strip():
        query = request.query.strip()

    try:
        return retriever.warmup(query)
    except Exception:
        logger.exception("Warmup failed.")
        raise HTTPException(status_code=503, detail="Retriever warmup failed.")


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
    except Exception:
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
