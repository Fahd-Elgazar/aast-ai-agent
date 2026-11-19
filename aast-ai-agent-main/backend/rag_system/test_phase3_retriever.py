"""
CLA-WOW-002 focused tests for the Phase 3 retriever relevance/abstention layer.

These exercise the pure rerank -> gate -> select pipeline (rank_gate_select and
helpers) against fixture Qdrant points, so they run without a live Qdrant server,
embedding model, or FastAPI app.

Run:  python -m unittest rag_system.test_phase3_retriever      (from backend/)
  or: python test_phase3_retriever.py                          (from rag_system/)
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from phase3_retriever import (  # noqa: E402
    RetrievalReranker,
    rank_gate_select,
    _candidate_limit,
    _final_top_k,
    CANDIDATE_POOL_SIZE,
    MIN_FINAL_TOP_K,
    MAX_FINAL_TOP_K,
    MIN_RELEVANCE_THRESHOLD,
)


class FakePoint:
    """Minimal stand-in for a Qdrant scored point (.id, .score, .payload)."""

    def __init__(self, pid, score, payload):
        self.id = pid
        self.score = score
        self.payload = payload


def scholarship_profile():
    return RetrievalReranker.build_query_profile(
        "scholarship gpa requirements for high-performing students"
    )


def aligned_scholarship_chunk(pid="c_good", score=0.72):
    return FakePoint(pid, score, {
        "title": "Scholarship Eligibility Policy",
        "subcategory": "scholarship",
        "category": "financial_policies",
        "document_type": "scholarship_policy",
        "content": "scholarship gpa requirement eligibility high performing students tuition exemption",
        "tags": ["scholarship", "gpa"],
        "priority": "high",
        "quality_score": 0.9,
        "source": "handbook",
    })


def semantic_false_positive(pid="c_fp", score=0.95):
    # High raw dense score but no lexical/category/doc-type alignment to the query.
    return FakePoint(pid, score, {
        "title": "Cafeteria Menu",
        "subcategory": "food",
        "category": "institutional",
        "document_type": "unknown",
        "content": "lunch menu pizza salad opening times seating",
        "tags": [],
        "priority": "low",
        "quality_score": 0.3,
        "source": "misc",
    })


class TestCandidateDepth(unittest.TestCase):
    def test_pool_is_widened_before_selection(self):
        # Callers asking for the old shallow top_k still get the wide pool.
        self.assertGreaterEqual(_candidate_limit(8), CANDIDATE_POOL_SIZE)
        self.assertGreaterEqual(_candidate_limit(5), 20)
        self.assertLessEqual(_candidate_limit(5), 24)

    def test_final_top_k_is_bounded(self):
        self.assertEqual(_final_top_k(8), min(8, MAX_FINAL_TOP_K))
        # A deep request (PASS 2 top_k=15) is still capped at the final window.
        self.assertEqual(_final_top_k(15), MAX_FINAL_TOP_K)
        # Tiny requests are floored.
        self.assertEqual(_final_top_k(1), MIN_FINAL_TOP_K)
        self.assertTrue(MIN_FINAL_TOP_K <= _final_top_k(6) <= MAX_FINAL_TOP_K)


class TestRerankAndGate(unittest.TestCase):
    def test_confidence_is_authoritative_not_max_inflated(self):
        profile = scholarship_profile()
        out = rank_gate_select([aligned_scholarship_chunk()], profile, _final_top_k(8))
        chunk = out["selected"][0]
        # Confidence equals the reranked score, never max(rerank, raw_semantic).
        self.assertEqual(chunk["confidence_score"], chunk["final_score"])

        # A semantic false positive reranks BELOW its raw dense score: rerank can
        # lower confidence (the old code took max() and kept it inflated).
        fp_out = rank_gate_select([semantic_false_positive()], profile, _final_top_k(8))
        fp = fp_out["rejected"][0]
        self.assertLess(fp["final_score"], fp["retrieval_score"])

    def test_rerank_lowers_semantic_false_positive(self):
        profile = scholarship_profile()
        out = rank_gate_select(
            [semantic_false_positive(), aligned_scholarship_chunk()],
            profile,
            _final_top_k(8),
        )
        selected_ids = [r["id"] for r in out["selected"]]
        self.assertIn("c_good", selected_ids)
        self.assertNotIn("c_fp", selected_ids)
        reasons = {r["id"]: r["reason"] for r in out["rejected"]}
        self.assertEqual(reasons.get("c_fp"), "no_query_alignment")

    def test_rerank_ordering_prefers_higher_final_score(self):
        profile = scholarship_profile()
        strong = aligned_scholarship_chunk("strong", score=0.80)
        weaker = FakePoint("weaker", 0.55, {
            "title": "General Student Handbook",
            "category": "academic_policies",
            "document_type": "general_policy",
            "content": "scholarship general information",
            "tags": [], "priority": "medium", "quality_score": 0.5, "source": "handbook",
        })
        out = rank_gate_select([weaker, strong], profile, _final_top_k(8))
        self.assertEqual(out["selected"][0]["id"], "strong")

    def test_min_relevance_threshold_enforced(self):
        profile = scholarship_profile()
        # Shares one content term (weak lexical alignment) but low overall relevance.
        weak = FakePoint("weak", 0.10, {
            "title": "Campus Map",
            "category": "institutional",
            "document_type": "unknown",
            "content": "scholarship",  # single overlap -> has_alignment True, score low
            "tags": [], "priority": "low", "quality_score": 0.2, "source": "misc",
        })
        verdict = RetrievalReranker.evaluate_acceptance(
            0.30, {"lexical_overlap": 0.2, "title_similarity": 0.0, "category_alignment": 0.0,
                   "document_type_alignment": 0.0, "tag_overlap": 0.0}
        )
        self.assertFalse(verdict["accepted"])
        self.assertEqual(verdict["reason"], "below_min_relevance")

        out = rank_gate_select([weak], profile, _final_top_k(8))
        self.assertTrue(out["abstained"])
        self.assertEqual(out["rejected"][0]["reason"], "below_min_relevance")

    def test_category_mismatch_without_alignment_is_rejected(self):
        profile = scholarship_profile()
        out = rank_gate_select([semantic_false_positive()], profile, _final_top_k(8))
        self.assertTrue(out["abstained"])
        self.assertEqual(out["abstention_reason"], "out_of_domain_no_alignment")


class TestAbstention(unittest.TestCase):
    def test_library_hours_probe_abstains(self):
        profile = RetrievalReranker.build_query_profile("what are the library opening hours")
        grading_chunk = FakePoint("g1", 0.66, {
            "title": "Grading Policy", "category": "grading_policies",
            "document_type": "grading_policy",
            "content": "gpa probation dismissal repeat course marks",
            "tags": ["gpa"], "priority": "high", "quality_score": 0.8, "source": "handbook",
        })
        out = rank_gate_select([grading_chunk], profile, _final_top_k(8))
        self.assertTrue(out["abstained"])
        self.assertEqual(len(out["selected"]), 0)

    def test_pets_dormitory_probe_abstains(self):
        profile = RetrievalReranker.build_query_profile("can I keep a pet dog in the dormitory")
        chunks = [semantic_false_positive("fp1"), FakePoint("adm", 0.6, {
            "title": "Admission Requirements", "category": "admissions",
            "document_type": "admission_policy",
            "content": "admission requirement document score transfer",
            "tags": ["admission"], "priority": "high", "quality_score": 0.7, "source": "handbook",
        })]
        out = rank_gate_select(chunks, profile, _final_top_k(8))
        self.assertTrue(out["abstained"])
        self.assertEqual(len(out["selected"]), 0)

    def test_empty_pool_abstains_with_reason(self):
        out = rank_gate_select([], scholarship_profile(), _final_top_k(8))
        self.assertTrue(out["abstained"])
        self.assertEqual(out["abstention_reason"], "no_candidates")


class TestAuditTrail(unittest.TestCase):
    def test_every_result_records_acceptance_reason(self):
        profile = scholarship_profile()
        out = rank_gate_select(
            [aligned_scholarship_chunk(), semantic_false_positive()],
            profile,
            _final_top_k(8),
        )
        for chunk in out["selected"]:
            self.assertEqual(chunk["acceptance_reason"], "accepted")
            self.assertTrue(chunk["accepted"])
        for rejection in out["rejected"]:
            self.assertIn("reason", rejection)
            self.assertIn("final_score", rejection)


if __name__ == "__main__":
    unittest.main(verbosity=2)
