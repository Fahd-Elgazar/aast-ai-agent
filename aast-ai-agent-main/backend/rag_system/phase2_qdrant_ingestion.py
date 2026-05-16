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
import json
import logging
import os
import time
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

COLLECTION_NAME = "aast_academic_rag_production"

QDRANT_HOST = "localhost"
QDRANT_PORT = 6333

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

def parse_args():
    parser = argparse.ArgumentParser(
        description="Production Qdrant ingestion pipeline"
    )

    parser.add_argument(
        "--input",
        required=True,
        help=r"C:\Users\mh978\Downloads\AI_AGENT\aast-ai-agent-main\backend\rag_system\cleaned_chunked_cai_production_v4.json"
    )

    parser.add_argument(
        "--force-rebuild",
        action="store_true",
        help="Delete and rebuild collection if it exists"
    )

    return parser.parse_args()


# ============================================================
# DATA LOADER
# ============================================================

def load_dataset(file_path: str) -> List[Dict[str, Any]]:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {file_path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

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

def validate_dataset(data: List[Dict[str, Any]]) -> None:
    invalid_count = 0

    for idx, item in enumerate(data):
        missing = REQUIRED_FIELDS - set(item.keys())

        if missing:
            invalid_count += 1
            logger.warning(f"Entry {idx} missing fields: {missing}")

        if not isinstance(item.get("quality_score"), (float, int)):
            invalid_count += 1
            logger.warning(
                f"Entry {idx} invalid quality_score type: "
                f"{type(item.get('quality_score'))}"
            )

    if invalid_count > 0:
        raise ValueError(f"{invalid_count} invalid entries detected.")

    logger.info("Dataset schema validation PASSED.")


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
            raise ConnectionError(
                f"Unable to connect to Qdrant: {e}"
            )

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

    # Fail fast Qdrant connection
    qdrant = QdrantIngestionEngine()

    # Load dataset only after Qdrant confirmed
    data = load_dataset(args.input)

    validate_dataset(data)

    embedder = EmbeddingEngine(EMBEDDING_MODEL)

    texts = [
        embedder.build_embedding_text(item)
        for item in data
    ]

    embeddings = embedder.encode_batch(texts)

    qdrant.rebuild_collection(
        force_rebuild=args.force_rebuild
    )

    qdrant.create_payload_indexes()
    qdrant.upload_data(data, embeddings)
    qdrant.validate_collection(len(data))

    total_time = time.time() - start_time

    generate_ingestion_report(
        total_entries=len(data),
        total_time=total_time
    )

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
