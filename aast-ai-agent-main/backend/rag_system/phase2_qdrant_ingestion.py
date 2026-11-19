"""
========================================================
PHASE 2 QDRANT INGESTION ENGINE — PRODUCTION v2.0
========================================================
Project     : Explainable Hybrid GraphRAG + VectorRAG
              Academic Advisor (CAI-AAST)
Purpose     : Production-grade Qdrant ingestion pipeline
              for refined academic RAG knowledge base
Author      : Senior AI Systems Engineering Pipeline
Environment : Windows-compatible, Python 3.9+
========================================================
"""

import argparse
import gc
import json
import logging
import math
import os
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

import numpy as np
from tenacity import retry, stop_after_attempt, wait_exponential

from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    VectorParams,
    PointStruct,
    PayloadSchemaType
)

# ============================================================
# CONFIGURATION
# ============================================================

COLLECTION_NAME = os.getenv("RAG_COLLECTION_NAME", "aast_academic_rag_production")
CORPUS_PATH_ENV = "RAG_CORPUS_PATH"

QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))

EMBEDDING_MODEL = "BAAI/bge-m3"
VECTOR_SIZE = 1024
BATCH_SIZE = max(1, int(os.getenv("RAG_INGEST_BATCH_SIZE", os.getenv("RAG_EMBED_BATCH_SIZE", "8"))))
EMBEDDING_DEVICE = os.getenv("RAG_EMBEDDING_DEVICE", "cpu").strip() or "cpu"
EMBEDDING_LOW_CPU_MEM_USAGE = os.getenv("RAG_LOW_CPU_MEM_USAGE", "true").lower() in {"1", "true", "yes", "on"}
TORCH_NUM_THREADS = max(1, int(os.getenv("RAG_TORCH_NUM_THREADS", "1")))

REPORT_FILE = "ingestion_report.json"

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("OMP_NUM_THREADS", str(TORCH_NUM_THREADS))
os.environ.setdefault("MKL_NUM_THREADS", str(TORCH_NUM_THREADS))

# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

logger = logging.getLogger(__name__)

# ============================================================
# ARGPARSE
# ============================================================

def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Production Qdrant ingestion pipeline"
    )

    parser.add_argument(
        "--input",
        default=None,
        help=(
            "Path to the private refined institutional corpus JSON. "
            f"May also be supplied through {CORPUS_PATH_ENV}; no corpus is bundled."
        )
    )

    parser.add_argument(
        "--force-rebuild",
        action="store_true",
        help="Delete and rebuild collection if it exists"
    )

    parser.add_argument(
        "--preflight-only",
        action="store_true",
        help=(
            "Validate the private corpus and generate/validate all embeddings "
            "without connecting to or modifying Qdrant."
        )
    )

    return parser.parse_args(argv)


# ============================================================
# DATA LOADER
# ============================================================

def resolve_corpus_path(cli_path: str = None, environment=None) -> Path:
    """Resolve the explicit private corpus input without assuming local assets."""
    env = os.environ if environment is None else environment
    configured_path = str(cli_path or env.get(CORPUS_PATH_ENV, "")).strip()

    if not configured_path:
        raise ValueError(
            "No RAG corpus configured. Supply --input <path> or set "
            f"{CORPUS_PATH_ENV}. Institutional corpus data is not bundled "
            "with the retriever image or source tree."
        )

    path = Path(configured_path).expanduser()
    if not path.is_file():
        raise FileNotFoundError(f"RAG corpus file not found: {path}")

    return path


def load_dataset(file_path: str) -> List[Dict[str, Any]]:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {file_path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("RAG corpus root must be a JSON array of chunk objects.")

    logger.info(f"Loaded dataset with {len(data)} entries.")
    return data


# ============================================================
# SCHEMA VALIDATION
# ============================================================

REQUIRED_FIELDS = {
    "id",
    "title",
    "content",
    "category",
    "subcategory",
    "priority",
    "document_type",
    "program_level",
    "source",
    "quality_score",
    "tags"
}

REQUIRED_NONEMPTY_TEXT_FIELDS = {
    "title",
    "content",
    "category",
    "subcategory",
    "priority",
    "document_type",
    "program_level",
    "source",
}


def _point_id_key(value: Any) -> str:
    if isinstance(value, bool):
        raise ValueError("must be an unsigned 64-bit integer or canonical UUID string")
    if isinstance(value, int):
        if value < 0 or value > (2 ** 64) - 1:
            raise ValueError("must be an unsigned 64-bit integer or canonical UUID string")
        return f"int:{value}"
    if isinstance(value, str):
        try:
            parsed = uuid.UUID(value)
            if value.lower() == str(parsed):
                return f"uuid:{parsed}"
        except (ValueError, AttributeError):
            pass
    raise ValueError("must be an unsigned 64-bit integer or canonical UUID string")

def validate_dataset(data: List[Dict[str, Any]]) -> None:
    if not data:
        raise ValueError("RAG corpus must contain at least one chunk.")

    errors = []
    seen_ids = set()

    for idx, item in enumerate(data):
        if not isinstance(item, dict):
            errors.append(f"entry {idx}: must be a JSON object")
            continue

        missing = REQUIRED_FIELDS - set(item.keys())
        if missing:
            errors.append(f"entry {idx}: missing fields {sorted(missing)}")
            continue

        try:
            point_key = _point_id_key(item["id"])
            if point_key in seen_ids:
                errors.append(f"entry {idx}: duplicate id {item['id']!r}")
            else:
                seen_ids.add(point_key)
        except ValueError as exc:
            errors.append(f"entry {idx}: id {exc}")

        for field in REQUIRED_NONEMPTY_TEXT_FIELDS:
            value = item.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"entry {idx}: {field} must be a non-empty string")

        quality_score = item.get("quality_score")
        if (
            isinstance(quality_score, bool)
            or not isinstance(quality_score, (float, int))
            or not math.isfinite(float(quality_score))
            or not 0.0 <= float(quality_score) <= 1.0
        ):
            errors.append(
                f"entry {idx}: quality_score must be a finite number between 0 and 1"
            )

        tags = item.get("tags")
        if not isinstance(tags, list):
            errors.append(f"entry {idx}: tags must be a list")
        elif any(not isinstance(tag, str) or not tag.strip() for tag in tags):
            errors.append(f"entry {idx}: tags must contain only non-empty strings")

    if errors:
        preview = "; ".join(errors[:20])
        suffix = f"; and {len(errors) - 20} more" if len(errors) > 20 else ""
        raise ValueError(f"RAG corpus validation failed: {preview}{suffix}")

    logger.info("Dataset schema validation PASSED.")


def validate_embeddings(data: List[Dict[str, Any]], embeddings: np.ndarray) -> None:
    array = np.asarray(embeddings)
    if array.ndim != 2:
        raise ValueError(
            f"Embedding matrix must be two-dimensional; received shape {array.shape}."
        )
    if array.shape[0] != len(data):
        raise ValueError(
            f"Embedding count mismatch: expected {len(data)}, got {array.shape[0]}."
        )
    if array.shape[1] != VECTOR_SIZE:
        raise ValueError(
            f"Embedding dimension mismatch: expected {VECTOR_SIZE}, got {array.shape[1]}."
        )
    if not np.issubdtype(array.dtype, np.number) or np.issubdtype(array.dtype, np.bool_):
        raise ValueError("Embeddings must contain numeric floating-point values.")
    if not np.isfinite(array).all():
        raise ValueError("Embeddings contain NaN or infinite values.")

    logger.info("Embedding count, dimension, and finiteness validation PASSED.")


# ============================================================
# EMBEDDING ENGINE
# ============================================================

class EmbeddingEngine:

    def __init__(self, model_name: str):
        logger.info(f"Loading embedding model: {model_name}")
        start = time.time()
        try:
            import torch  # type: ignore

            torch.set_num_threads(TORCH_NUM_THREADS)
            if hasattr(torch, "set_num_interop_threads"):
                torch.set_num_interop_threads(1)
        except Exception as exc:
            logger.warning(f"Torch thread tuning skipped: {exc}")

        from sentence_transformers import SentenceTransformer

        kwargs = {"device": EMBEDDING_DEVICE}
        if EMBEDDING_LOW_CPU_MEM_USAGE:
            kwargs["model_kwargs"] = {"low_cpu_mem_usage": True}
        try:
            self.model = SentenceTransformer(model_name, **kwargs)
        except TypeError:
            kwargs.pop("model_kwargs", None)
            self.model = SentenceTransformer(model_name, **kwargs)
        logger.info(
            f"Embedding model loaded in {time.time() - start:.2f}s"
        )

    def build_embedding_text(self, item: Dict[str, Any]) -> str:
        return (
            f"{item['title']} "
            f"[Category: {item['category']}] "
            f"[DocType: {item['document_type']}] "
            f"{item['content']}"
        )

    def encode_batch(self, texts: List[str]) -> np.ndarray:
        return self.model.encode(
            texts,
            batch_size=BATCH_SIZE,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=True
        )

    def close(self):
        self.model = None
        gc.collect()


# ============================================================
# QDRANT INGESTION ENGINE
# ============================================================

class QdrantIngestionEngine:

    def __init__(self):
        logger.info("Connecting to Qdrant...")
        self.client = QdrantClient(
            host=QDRANT_HOST,
            port=QDRANT_PORT
        )

        # Fail fast connectivity test
        try:
            self.client.get_collections()
            logger.info("Qdrant connection verified.")
        except Exception as e:
            self.close()
            raise ConnectionError(
                f"Unable to connect to Qdrant: {e}"
            )

    def close(self):
        client = getattr(self, "client", None)
        self.client = None
        close = getattr(client, "close", None)
        if callable(close):
            close()

    def rebuild_collection(self, force_rebuild: bool):
        collections = self.client.get_collections().collections
        existing = [c.name for c in collections]

        if COLLECTION_NAME in existing:
            if not force_rebuild:
                raise RuntimeError(
                    f"Collection '{COLLECTION_NAME}' already exists. "
                    f"Use --force-rebuild to overwrite."
                )

            logger.info(
                f"Deleting existing collection: {COLLECTION_NAME}"
            )
            self.client.delete_collection(COLLECTION_NAME)

        logger.info(
            f"Creating production collection: {COLLECTION_NAME}"
        )

        self.client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=VECTOR_SIZE,
                distance=Distance.COSINE
            )
        )

        logger.info("Collection created successfully.")

    def create_payload_indexes(self):
        logger.info("Creating payload indexes...")

        fields = [
            "category",
            "priority",
            "document_type",
            "program_level",
            "source",
            "quality_score"
        ]

        for field in fields:
            schema = (
                PayloadSchemaType.FLOAT
                if field == "quality_score"
                else PayloadSchemaType.KEYWORD
            )

            self.client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name=field,
                field_schema=schema
            )

        logger.info("Payload indexes created successfully.")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=10),
        reraise=True
    )
    def safe_upsert(self, points: List[PointStruct]):
        self.client.upsert(
            collection_name=COLLECTION_NAME,
            points=points
        )

    def upload_data(
        self,
        data: List[Dict[str, Any]],
        embeddings: np.ndarray
    ):
        total = len(data)

        logger.info("Starting Qdrant upload...")

        for start_idx in range(0, total, BATCH_SIZE):
            end_idx = min(start_idx + BATCH_SIZE, total)

            points = []

            for i in range(start_idx, end_idx):
                item = data[i]

                payload = {
                    "title": item["title"],
                    "content": item["content"],
                    "category": item["category"],
                    "subcategory": item["subcategory"],
                    "priority": item["priority"],
                    "document_type": item["document_type"],
                    "program_level": item["program_level"],
                    "source": item["source"],
                    "quality_score": item["quality_score"],
                    "tags": item["tags"]
                }

                points.append(
                    PointStruct(
                        id=item["id"],
                        vector=embeddings[i].tolist(),
                        payload=payload
                    )
                )

            self.safe_upsert(points)

            logger.info(
                f"Uploaded batch {start_idx}-{end_idx}/{total}"
            )

        logger.info("All data uploaded successfully.")

    def validate_collection(self, expected_count: int):
        logger.info("Running ingestion validation...")

        info = self.client.get_collection(COLLECTION_NAME)
        actual_count = info.points_count

        if actual_count != expected_count:
            raise ValueError(
                f"Point count mismatch: "
                f"expected {expected_count}, got {actual_count}"
            )

        logger.info("Point count validation PASSED.")

        logger.info("Running smoke retrieval test...")

        points, _ = self.client.scroll(
            collection_name=COLLECTION_NAME,
            limit=3
        )

        if not points:
            raise ValueError("Smoke test FAILED: no points found.")

        required_payload_keys = {
            "title",
            "content",
            "category",
            "priority",
            "quality_score"
        }

        for idx, point in enumerate(points):
            payload_keys = set(point.payload.keys())

            missing = required_payload_keys - payload_keys

            if missing:
                raise ValueError(
                    f"Smoke test FAILED at point {idx}: "
                    f"missing payload keys {missing}"
                )

        logger.info("Smoke retrieval validation PASSED.")
        logger.info("Collection validation PASSED.")


# ============================================================
# REPORTING
# ============================================================

def generate_ingestion_report(
    total_entries: int,
    total_time: float
):
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "collection_name": COLLECTION_NAME,
        "total_entries_indexed": total_entries,
        "embedding_model": EMBEDDING_MODEL,
        "vector_size": VECTOR_SIZE,
        "batch_size": BATCH_SIZE,
        "embedding_device": EMBEDDING_DEVICE,
        "torch_num_threads": TORCH_NUM_THREADS,
        "low_cpu_mem_usage": EMBEDDING_LOW_CPU_MEM_USAGE,
        "payload_fields_indexed": 6,
        "total_runtime_seconds": round(total_time, 2),
        "production_status": "READY"
    }

    logger.info("===================================================")
    logger.info("PHASE 2 INGESTION REPORT")
    logger.info("===================================================")

    for key, value in report.items():
        logger.info(f"{key}: {value}")

    logger.info("===================================================")

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    logger.info(f"Ingestion report saved to {REPORT_FILE}")


# ============================================================
# MAIN
# ============================================================

def main():
    args = parse_args()

    logger.info("===================================================")
    logger.info("PHASE 2 QDRANT INGESTION ENGINE STARTED")
    logger.info("===================================================")

    start_time = time.time()

    qdrant = None
    embedder = None
    try:
        # Validate every private input and every generated vector before a
        # forced rebuild is allowed to delete the existing collection.
        corpus_path = resolve_corpus_path(args.input)
        data = load_dataset(corpus_path)
        validate_dataset(data)

        embedder = EmbeddingEngine(EMBEDDING_MODEL)
        texts = [embedder.build_embedding_text(item) for item in data]
        embeddings = embedder.encode_batch(texts)
        validate_embeddings(data, embeddings)

        if args.preflight_only:
            logger.info("Private corpus preflight PASSED; Qdrant was not modified.")
            return

        qdrant = QdrantIngestionEngine()
        qdrant.rebuild_collection(force_rebuild=args.force_rebuild)
        qdrant.create_payload_indexes()
        qdrant.upload_data(data, embeddings)
        qdrant.validate_collection(len(data))

        total_time = time.time() - start_time
        generate_ingestion_report(
            total_entries=len(data),
            total_time=total_time
        )
    finally:
        try:
            if qdrant is not None:
                qdrant.close()
        finally:
            if embedder is not None:
                embedder.close()

    logger.info("===================================================")
    logger.info("PHASE 2 QDRANT INGESTION ENGINE COMPLETE")
    logger.info("===================================================")


if __name__ == "__main__":
    main()


# ============================================================
# requirements.txt
# ============================================================
# qdrant-client==1.9.1
# sentence-transformers==2.7.0
# torch==2.3.0
# numpy==1.26.4
# tenacity==8.3.0
