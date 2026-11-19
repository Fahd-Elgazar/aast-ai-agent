"""Focused tests for RAG build inputs, Qdrant compatibility, and readiness."""

import json
import os
import sys
import tempfile
import threading
import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import phase2_qdrant_ingestion as ingestion  # noqa: E402
import phase3_retriever as retriever_module  # noqa: E402
import phase4_llm_answer_engine as answer_engine  # noqa: E402
from phase3_retriever import ProductionRetriever, evaluate_readiness  # noqa: E402


class FakeEmbedder:
    def __init__(self, loaded=True, status_error=None, last_error=None):
        self.loaded = loaded
        self.status_error = status_error
        self.last_error = last_error

    def status(self):
        if self.status_error:
            raise self.status_error
        return {"model": "fake", "loaded": self.loaded, "last_error": self.last_error}

    def encode_query(self, _query):
        return np.zeros(retriever_module.EXPECTED_VECTOR_SIZE, dtype=np.float32)


def valid_payload():
    return {
        "title": "Official policy",
        "content": "Verified institutional policy content.",
        "category": "academic_policies",
        "subcategory": "general",
        "priority": "high",
        "document_type": "policy",
        "program_level": "undergraduate",
        "source": "official_handbook",
        "quality_score": 0.9,
        "tags": ["policy"],
    }


def valid_dataset_item(point_id=None):
    return {
        "id": str(uuid.uuid4()) if point_id is None else point_id,
        **valid_payload(),
    }


def collection_info(
    vector_size=None,
    points_count=1,
    named_vectors=False,
    distance="Cosine",
    status="green",
    optimizer_status="ok",
):
    if vector_size is None:
        vector_size = retriever_module.EXPECTED_VECTOR_SIZE
    vectors = (
        {"academic": SimpleNamespace(size=vector_size, distance=distance)}
        if named_vectors
        else SimpleNamespace(size=vector_size, distance=distance)
    )
    return SimpleNamespace(
        config=SimpleNamespace(params=SimpleNamespace(vectors=vectors)),
        points_count=points_count,
        status=status,
        optimizer_status=optimizer_status,
    )


class FakeQdrantClient:
    def __init__(
        self,
        names=None,
        info=None,
        collections_error=None,
        info_error=None,
        scroll_points=None,
        scroll_error=None,
    ):
        self.names = [retriever_module.COLLECTION_NAME] if names is None else names
        self.info = info or collection_info()
        self.collections_error = collections_error
        self.info_error = info_error
        self.scroll_points = (
            [SimpleNamespace(payload=valid_payload())]
            if scroll_points is None
            else scroll_points
        )
        self.scroll_error = scroll_error
        self.closed = False

    def get_collections(self):
        if self.collections_error:
            raise self.collections_error
        return SimpleNamespace(
            collections=[SimpleNamespace(name=name) for name in self.names]
        )

    def get_collection(self, _name):
        if self.info_error:
            raise self.info_error
        return self.info

    def scroll(self, **_kwargs):
        if self.scroll_error:
            raise self.scroll_error
        return self.scroll_points, None

    def close(self):
        self.closed = True


def fake_retriever(
    client=None,
    embedding_loaded=True,
    embedding_status_error=None,
    embedding_last_error=None,
):
    return SimpleNamespace(
        client=client or FakeQdrantClient(),
        embedder=FakeEmbedder(
            embedding_loaded,
            embedding_status_error,
            embedding_last_error,
        ),
    )


class TestPrivateCorpusContract(unittest.TestCase):
    def test_cli_path_is_explicit_and_takes_precedence(self):
        with tempfile.TemporaryDirectory() as directory:
            cli_path = Path(directory) / "cli.json"
            env_path = Path(directory) / "env.json"
            cli_path.write_text("[]", encoding="utf-8")
            env_path.write_text("[]", encoding="utf-8")

            resolved = ingestion.resolve_corpus_path(
                str(cli_path),
                {ingestion.CORPUS_PATH_ENV: str(env_path)},
            )

            self.assertEqual(resolved, cli_path)

    def test_environment_path_is_supported(self):
        with tempfile.TemporaryDirectory() as directory:
            corpus_path = Path(directory) / "private.json"
            corpus_path.write_text("[]", encoding="utf-8")

            resolved = ingestion.resolve_corpus_path(
                environment={ingestion.CORPUS_PATH_ENV: str(corpus_path)}
            )

            self.assertEqual(resolved, corpus_path)

    def test_missing_configuration_fails_truthfully(self):
        with self.assertRaisesRegex(ValueError, "Institutional corpus data is not bundled"):
            ingestion.resolve_corpus_path(environment={})

    def test_missing_configured_file_fails_before_ingestion(self):
        with tempfile.TemporaryDirectory() as directory:
            missing_path = Path(directory) / "absent.json"
            with self.assertRaisesRegex(FileNotFoundError, "RAG corpus file not found"):
                ingestion.resolve_corpus_path(str(missing_path), {})

    def test_corpus_root_must_be_an_array(self):
        with tempfile.TemporaryDirectory() as directory:
            corpus_path = Path(directory) / "invalid.json"
            corpus_path.write_text('{"content": "not an array"}', encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "root must be a JSON array"):
                ingestion.load_dataset(corpus_path)

    def test_empty_corpus_is_rejected_before_collection_rebuild(self):
        with self.assertRaisesRegex(ValueError, "at least one chunk"):
            ingestion.validate_dataset([])

    def test_dataset_requires_unique_qdrant_compatible_ids(self):
        duplicate_id = str(uuid.uuid4())
        with self.assertRaisesRegex(ValueError, "duplicate id"):
            ingestion.validate_dataset([
                valid_dataset_item(duplicate_id),
                valid_dataset_item(duplicate_id),
            ])
        with self.assertRaisesRegex(ValueError, "unsigned 64-bit integer or canonical UUID"):
            ingestion.validate_dataset([valid_dataset_item("chunk-one")])
        for invalid_id in (-1, 2 ** 64, True, uuid.uuid4().hex):
            with self.subTest(point_id=invalid_id), self.assertRaisesRegex(
                ValueError, "unsigned 64-bit integer or canonical UUID"
            ):
                ingestion.validate_dataset([valid_dataset_item(invalid_id)])
        ingestion.validate_dataset([valid_dataset_item(0)])

    def test_dataset_requires_typed_nonempty_fields_and_tags(self):
        item = valid_dataset_item()
        item["content"] = "  "
        with self.assertRaisesRegex(ValueError, "content must be a non-empty string"):
            ingestion.validate_dataset([item])

        item = valid_dataset_item()
        item["tags"] = "policy"
        with self.assertRaisesRegex(ValueError, "tags must be a list"):
            ingestion.validate_dataset([item])

    def test_quality_score_is_finite_bounded_and_not_boolean(self):
        for invalid_quality in (True, float("nan"), float("inf"), -0.1, 1.1):
            item = valid_dataset_item()
            item["quality_score"] = invalid_quality
            with self.subTest(quality=invalid_quality), self.assertRaisesRegex(
                ValueError, "quality_score must be a finite number between 0 and 1"
            ):
                ingestion.validate_dataset([item])

    def test_embeddings_are_validated_before_rebuild(self):
        data = [valid_dataset_item(), valid_dataset_item()]
        valid = np.zeros((2, ingestion.VECTOR_SIZE), dtype=np.float32)
        ingestion.validate_embeddings(data, valid)

        invalid_cases = [
            (valid[:1], "count mismatch"),
            (np.zeros((2, 8), dtype=np.float32), "dimension mismatch"),
            (np.full((2, ingestion.VECTOR_SIZE), np.nan), "NaN or infinite"),
        ]
        for embeddings, message in invalid_cases:
            with self.subTest(message=message), self.assertRaisesRegex(ValueError, message):
                ingestion.validate_embeddings(data, embeddings)

    def test_retriever_image_does_not_copy_private_corpus(self):
        dockerfile = Path(__file__).with_name("Dockerfile.retriever").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("cleaned_chunked_cai_production_v4.json", dockerfile)
        self.assertIn("COPY phase3_retriever.py ./", dockerfile)

    def test_private_corpus_deployment_contract_uses_read_only_bind_mount(self):
        compose = Path(__file__).with_name("compose.private-corpus.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("RAG_PRIVATE_CORPUS_PATH", compose)
        self.assertIn("read_only: true", compose)
        self.assertIn("--preflight-only", compose)
        self.assertIn('profiles: ["preflight"]', compose)
        self.assertIn('profiles: ["ingest"]', compose)
        self.assertEqual(compose.count('restart: "no"'), 2)
        self.assertNotIn("cleaned_chunked_cai_production_v4.json", compose)
        dockerignore = Path(__file__).with_name(".dockerignore").read_text(
            encoding="utf-8"
        )
        self.assertIn("*.json", dockerignore)

    def test_invalid_embeddings_stop_before_qdrant_and_resources_close(self):
        with tempfile.TemporaryDirectory() as directory:
            corpus_path = Path(directory) / "corpus.json"
            corpus_path.write_text(
                json.dumps([valid_dataset_item()]), encoding="utf-8"
            )
            embedder = Mock()
            embedder.build_embedding_text.return_value = "chunk"
            embedder.encode_batch.return_value = np.zeros((1, 8), dtype=np.float32)
            qdrant_factory = Mock()
            args = SimpleNamespace(
                input=str(corpus_path), force_rebuild=True, preflight_only=False
            )
            with patch.object(ingestion, "parse_args", return_value=args), patch.object(
                ingestion, "EmbeddingEngine", return_value=embedder
            ), patch.object(ingestion, "QdrantIngestionEngine", qdrant_factory):
                with self.assertRaisesRegex(ValueError, "dimension mismatch"):
                    ingestion.main()

            qdrant_factory.assert_not_called()
            embedder.close.assert_called_once()

    def test_preflight_is_non_mutating_and_closes_model(self):
        with tempfile.TemporaryDirectory() as directory:
            corpus_path = Path(directory) / "corpus.json"
            corpus_path.write_text(
                json.dumps([valid_dataset_item()]), encoding="utf-8"
            )
            embedder = Mock()
            embedder.build_embedding_text.return_value = "chunk"
            embedder.encode_batch.return_value = np.zeros(
                (1, ingestion.VECTOR_SIZE), dtype=np.float32
            )
            qdrant_factory = Mock()
            args = SimpleNamespace(
                input=str(corpus_path), force_rebuild=False, preflight_only=True
            )
            with patch.object(ingestion, "parse_args", return_value=args), patch.object(
                ingestion, "EmbeddingEngine", return_value=embedder
            ), patch.object(ingestion, "QdrantIngestionEngine", qdrant_factory):
                ingestion.main()

            qdrant_factory.assert_not_called()
            embedder.close.assert_called_once()

    def test_ingestion_close_releases_qdrant_client(self):
        engine = object.__new__(ingestion.QdrantIngestionEngine)
        client = Mock()
        engine.client = client
        engine.close()
        client.close.assert_called_once()
        self.assertIsNone(engine.client)


class TestRetrieverLifespan(unittest.IsolatedAsyncioTestCase):
    async def test_qdrant_startup_failure_keeps_process_live_but_not_ready(self):
        with patch.object(retriever_module, "RETRIEVER_INIT_MAX_ATTEMPTS", 1), patch.object(
            retriever_module, "RETRIEVER_RECOVERY_INTERVAL_SECONDS", 60
        ), patch.object(
            retriever_module,
            "ProductionRetriever",
            side_effect=ConnectionError("qdrant unavailable"),
        ), patch.object(retriever_module, "retriever", None), patch.object(
            retriever_module, "retriever_init_failure", None
        ):
            async with retriever_module.lifespan(retriever_module.app):
                self.assertIsNone(retriever_module.retriever)
                self.assertEqual(
                    retriever_module.retriever_init_failure, "qdrant_unavailable"
                )

    async def test_recovery_after_initial_attempt_exhaustion(self):
        candidate = Mock()
        candidate.close = Mock()
        initializer = Mock(side_effect=[ConnectionError("not yet"), candidate])
        with patch.object(retriever_module, "RETRIEVER_INIT_MAX_ATTEMPTS", 1), patch.object(
            retriever_module, "RETRIEVER_RECOVERY_INTERVAL_SECONDS", 0.01
        ), patch.object(retriever_module, "EMBEDDING_INIT_MODE", "lazy"), patch.object(
            retriever_module, "ProductionRetriever", initializer
        ), patch.object(retriever_module, "retriever", None), patch.object(
            retriever_module, "retriever_init_failure", None
        ):
            async with retriever_module.lifespan(retriever_module.app):
                for _attempt in range(100):
                    if retriever_module.retriever is candidate:
                        break
                    await retriever_module.asyncio.sleep(0.01)
                self.assertIs(retriever_module.retriever, candidate)
                self.assertIsNone(retriever_module.retriever_init_failure)

        candidate.close.assert_called_once()
        self.assertEqual(initializer.call_count, 2)

    async def test_shutdown_drains_active_recovery_and_closes_candidate(self):
        candidate = Mock()
        candidate.close = Mock()
        recovery_started = threading.Event()
        release_recovery = threading.Event()
        calls = 0

        def initializer():
            nonlocal calls
            calls += 1
            if calls == 1:
                raise ConnectionError("not yet")
            recovery_started.set()
            if not release_recovery.wait(timeout=2):
                raise TimeoutError("test did not release recovery")
            return candidate

        with patch.object(retriever_module, "RETRIEVER_INIT_MAX_ATTEMPTS", 1), patch.object(
            retriever_module, "RETRIEVER_RECOVERY_INTERVAL_SECONDS", 0.01
        ), patch.object(retriever_module, "EMBEDDING_INIT_MODE", "lazy"), patch.object(
            retriever_module, "ProductionRetriever", side_effect=initializer
        ), patch.object(retriever_module, "retriever", None), patch.object(
            retriever_module, "retriever_init_failure", None
        ):
            async with retriever_module.lifespan(retriever_module.app):
                started = await retriever_module.asyncio.to_thread(
                    recovery_started.wait, 1
                )
                self.assertTrue(started)
                retriever_module.asyncio.get_running_loop().call_later(
                    0.01, release_recovery.set
                )

        candidate.close.assert_called_once()
        self.assertIsNone(retriever_module.retriever)

    def test_eager_warmup_failure_closes_partial_candidate(self):
        candidate = Mock()
        candidate.warmup.side_effect = RuntimeError("warmup failed")
        with patch.object(retriever_module, "EMBEDDING_INIT_MODE", "eager"), patch.object(
            retriever_module, "ProductionRetriever", return_value=candidate
        ):
            with self.assertRaisesRegex(RuntimeError, "warmup failed"):
                retriever_module._construct_and_warm_retriever()
        candidate.close.assert_called_once()


class TestRetrieverReadiness(unittest.TestCase):
    def setUp(self):
        self.embedding_requirement = patch.object(
            retriever_module, "HEALTH_REQUIRES_EMBEDDING", True
        )
        self.embedding_requirement.start()

    def tearDown(self):
        self.embedding_requirement.stop()

    def assert_not_ready(self, active_retriever, reason):
        status_code, payload = evaluate_readiness(active_retriever)
        self.assertEqual(status_code, 503)
        self.assertEqual(payload["status"], "not_ready")
        self.assertIn(reason, payload["reasons"])
        return payload

    def test_initializing_is_non_2xx(self):
        self.assert_not_ready(None, "retriever_initializing")

    def test_qdrant_unavailable_is_non_2xx(self):
        client = FakeQdrantClient(collections_error=ConnectionError("down"))
        payload = self.assert_not_ready(fake_retriever(client), "qdrant_unavailable")
        self.assertFalse(payload["qdrant_connected"])

    def test_configured_collection_must_exist(self):
        self.assert_not_ready(
            fake_retriever(FakeQdrantClient(names=["different_collection"])),
            "collection_missing",
        )

    def test_collection_metadata_must_be_readable(self):
        client = FakeQdrantClient(info_error=RuntimeError("metadata unavailable"))
        self.assert_not_ready(fake_retriever(client), "collection_metadata_unavailable")

    def test_vector_size_must_match_embedding_model(self):
        client = FakeQdrantClient(info=collection_info(vector_size=1536))
        payload = self.assert_not_ready(
            fake_retriever(client), "vector_size_incompatible"
        )
        self.assertEqual(payload["actual_vector_size"], 1536)

    def test_named_vectors_are_rejected_for_unnamed_query_contract(self):
        client = FakeQdrantClient(info=collection_info(named_vectors=True))
        payload = self.assert_not_ready(
            fake_retriever(client), "vector_size_incompatible"
        )
        self.assertIsNone(payload["actual_vector_size"])

    def test_zero_point_collection_is_non_2xx(self):
        client = FakeQdrantClient(info=collection_info(points_count=0))
        payload = self.assert_not_ready(fake_retriever(client), "collection_empty")
        self.assertEqual(payload["points_count"], 0)

    def test_collection_requires_cosine_distance(self):
        client = FakeQdrantClient(info=collection_info(distance="Dot"))
        self.assert_not_ready(fake_retriever(client), "vector_distance_incompatible")

    def test_collection_status_must_be_green(self):
        client = FakeQdrantClient(info=collection_info(status="yellow"))
        self.assert_not_ready(fake_retriever(client), "collection_status_unhealthy")

    def test_optimizer_error_blocks_readiness(self):
        optimizer_error = SimpleNamespace(error="segment optimization failed")
        client = FakeQdrantClient(info=collection_info(optimizer_status=optimizer_error))
        payload = self.assert_not_ready(fake_retriever(client), "optimizer_unhealthy")
        self.assertEqual(payload["optimizer_error"], "segment optimization failed")

    def test_payload_smoke_requires_complete_nonempty_content(self):
        incomplete = valid_payload()
        incomplete["content"] = ""
        client = FakeQdrantClient(
            scroll_points=[SimpleNamespace(payload=incomplete)]
        )
        self.assert_not_ready(
            fake_retriever(client), "payload_field_invalid:content"
        )

    def test_payload_smoke_failure_blocks_readiness(self):
        client = FakeQdrantClient(scroll_error=RuntimeError("scroll failed"))
        self.assert_not_ready(fake_retriever(client), "payload_smoke_failed")

    def test_embedding_requirement_is_enforced(self):
        with patch.object(retriever_module, "EMBEDDING_INIT_MODE", "eager"):
            self.assert_not_ready(
                fake_retriever(embedding_loaded=False), "embedding_not_ready"
            )

    def test_lazy_mode_can_be_ready_before_first_model_load(self):
        with patch.object(retriever_module, "EMBEDDING_INIT_MODE", "lazy"):
            status_code, payload = evaluate_readiness(
                fake_retriever(embedding_loaded=False)
            )
        self.assertEqual(status_code, 200)
        self.assertTrue(payload["checks"]["embedding_ready"])

    def test_lazy_mode_reports_a_previous_model_load_failure(self):
        with patch.object(retriever_module, "EMBEDDING_INIT_MODE", "lazy"):
            self.assert_not_ready(
                fake_retriever(
                    embedding_loaded=False,
                    embedding_last_error="model load failed",
                ),
                "embedding_not_ready",
            )

    def test_embedding_status_failure_is_non_2xx(self):
        self.assert_not_ready(
            fake_retriever(embedding_status_error=RuntimeError("status failed")),
            "embedding_status_unavailable",
        )

    def test_complete_collection_is_ready(self):
        status_code, payload = evaluate_readiness(fake_retriever())
        self.assertEqual(status_code, 200)
        self.assertEqual(payload["status"], "ready")
        self.assertEqual(payload["points_count"], 1)
        self.assertTrue(payload["qdrant_connected"])
        self.assertTrue(all(payload["checks"].values()))

    def test_http_health_preserves_non_2xx_status(self):
        with patch.object(retriever_module, "retriever", None), patch.object(
            retriever_module, "retriever_init_failure", "qdrant_unavailable"
        ):
            response = retriever_module.system_health()

        self.assertEqual(response.status_code, 503)
        self.assertIn(
            "qdrant_unavailable", json.loads(response.body.decode("utf-8"))["reasons"]
        )

    def test_liveness_is_independent_of_readiness(self):
        self.assertEqual(retriever_module.liveness()["status"], "alive")

    def test_retriever_close_releases_qdrant_and_embedding_resources(self):
        instance = object.__new__(ProductionRetriever)
        client = Mock()
        embedder = Mock()
        instance.client = client
        instance.embedder = embedder
        instance.close()
        client.close.assert_called_once()
        embedder.close.assert_called_once()
        self.assertIsNone(instance.client)
        self.assertIsNone(instance.embedder)


class FakeHttpResponse:
    def __init__(self, status_code, payload=None, json_error=None):
        self.status_code = status_code
        self.payload = payload
        self.json_error = json_error

    def json(self):
        if self.json_error:
            raise self.json_error
        return self.payload


class TestAnswerEngineReadinessConsumer(unittest.TestCase):
    def test_ready_retriever_is_accepted(self):
        response = FakeHttpResponse(200, {"status": "ready"})
        self.assertTrue(answer_engine.retriever_health_is_ready(response))

    def test_non_2xx_retriever_is_rejected(self):
        response = FakeHttpResponse(503, {"status": "not_ready"})
        self.assertFalse(answer_engine.retriever_health_is_ready(response))

    def test_ambiguous_200_response_is_rejected(self):
        response = FakeHttpResponse(200, {})
        self.assertFalse(answer_engine.retriever_health_is_ready(response))


class ModernClient:
    def __init__(self, result=None, error=None):
        self.result = [] if result is None else result
        self.error = error
        self.query_calls = 0
        self.search_calls = 0

    def query_points(self, **_kwargs):
        self.query_calls += 1
        if self.error:
            raise self.error
        return self.result

    def search(self, **_kwargs):
        self.search_calls += 1
        return self.result


class LegacyClient:
    def __init__(self, result=None):
        self.result = [] if result is None else result
        self.search_calls = 0

    def search(self, **_kwargs):
        self.search_calls += 1
        return self.result


def query_only_retriever(client):
    instance = object.__new__(ProductionRetriever)
    instance.client = client
    instance.embedder = FakeEmbedder()
    instance.started_at = 0
    return instance


class TestQdrantClientCompatibility(unittest.TestCase):
    def test_modern_client_uses_query_points(self):
        client = ModernClient(result=["modern"])
        result = query_only_retriever(client)._query_qdrant([], None, 5)
        self.assertEqual(result, ["modern"])
        self.assertEqual(client.query_calls, 1)
        self.assertEqual(client.search_calls, 0)

    def test_pinned_legacy_client_uses_search_without_exception_first(self):
        client = LegacyClient(result=["legacy"])
        result = query_only_retriever(client)._query_qdrant([], None, 5)
        self.assertEqual(result, ["legacy"])
        self.assertEqual(client.search_calls, 1)

    def test_real_query_failure_is_not_misclassified_as_sdk_compatibility(self):
        client = ModernClient(error=ConnectionError("qdrant down"))
        with self.assertRaisesRegex(ConnectionError, "qdrant down"):
            query_only_retriever(client)._query_qdrant([], None, 5)
        self.assertEqual(client.search_calls, 0)

    def test_empty_categorized_query_runs_one_qdrant_request_then_abstains(self):
        client = ModernClient(result=[])
        result = query_only_retriever(client).search(
            "scholarship eligibility", category="financial_policies"
        )
        self.assertTrue(result["abstained"])
        self.assertEqual(result["abstention_reason"], "no_candidates")
        self.assertEqual(client.query_calls, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
