"""Unit tests for evaluation metrics."""

from __future__ import annotations

import math
import sys
from pathlib import Path

# Ensure benchmarks module is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "benchmarks"))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from benchmarks.metrics import (
    BenchmarkReport,
    dcg_at_k,
    evaluate_query,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
)
from benchmarks.naive_baseline import keyword_overlap_score, rank_memories, tokenize


class TestPrecisionAtK:
    """Tests for Precision@K metric."""

    def test_perfect_precision(self) -> None:
        """All top-K results are relevant."""
        assert precision_at_k(["a", "b", "c"], {"a", "b", "c"}, k=3) == 1.0

    def test_zero_precision(self) -> None:
        """No top-K results are relevant."""
        assert precision_at_k(["x", "y", "z"], {"a", "b"}, k=3) == 0.0

    def test_partial_precision(self) -> None:
        """Some top-K results are relevant."""
        p = precision_at_k(["a", "x", "b"], {"a", "b"}, k=3)
        assert abs(p - 2 / 3) < 1e-9

    def test_k_larger_than_results(self) -> None:
        """K > number of retrieved results."""
        p = precision_at_k(["a"], {"a", "b"}, k=5)
        assert abs(p - 1 / 5) < 1e-9

    def test_empty_retrieved(self) -> None:
        """Empty retrieved list."""
        assert precision_at_k([], {"a"}, k=5) == 0.0

    def test_k_zero(self) -> None:
        """K=0 returns 0."""
        assert precision_at_k(["a"], {"a"}, k=0) == 0.0


class TestRecallAtK:
    """Tests for Recall@K metric."""

    def test_perfect_recall(self) -> None:
        """All relevant results found in top-K."""
        assert recall_at_k(["a", "b"], {"a", "b"}, k=5) == 1.0

    def test_zero_recall(self) -> None:
        """No relevant results found."""
        assert recall_at_k(["x", "y"], {"a", "b"}, k=2) == 0.0

    def test_partial_recall(self) -> None:
        """Only some relevant results found."""
        r = recall_at_k(["a", "x"], {"a", "b"}, k=2)
        assert abs(r - 0.5) < 1e-9

    def test_no_relevant(self) -> None:
        """No relevant IDs → perfect recall by convention."""
        assert recall_at_k(["a", "b"], set(), k=2) == 1.0


class TestReciprocalRank:
    """Tests for Reciprocal Rank metric."""

    def test_first_result_relevant(self) -> None:
        """First result is relevant → RR = 1.0."""
        assert reciprocal_rank(["a", "b", "c"], {"a"}) == 1.0

    def test_second_result_relevant(self) -> None:
        """Second result is relevant → RR = 0.5."""
        assert reciprocal_rank(["x", "a", "c"], {"a"}) == 0.5

    def test_third_result_relevant(self) -> None:
        """Third result is relevant → RR = 1/3."""
        rr = reciprocal_rank(["x", "y", "a"], {"a"})
        assert abs(rr - 1 / 3) < 1e-9

    def test_no_relevant_found(self) -> None:
        """No relevant result found → RR = 0."""
        assert reciprocal_rank(["x", "y", "z"], {"a"}) == 0.0

    def test_multiple_relevant(self) -> None:
        """Multiple relevant results → rank of FIRST one matters."""
        rr = reciprocal_rank(["x", "a", "b"], {"a", "b"})
        assert rr == 0.5  # First relevant at position 2


class TestNDCGAtK:
    """Tests for NDCG@K metric."""

    def test_perfect_ranking(self) -> None:
        """Ideal ranking → NDCG = 1.0."""
        ndcg = ndcg_at_k(["a", "b", "c"], {"a", "b", "c"}, k=3)
        assert abs(ndcg - 1.0) < 1e-9

    def test_worst_ranking(self) -> None:
        """No relevant results → NDCG = 0."""
        assert ndcg_at_k(["x", "y", "z"], {"a"}, k=3) == 0.0

    def test_inverted_ranking(self) -> None:
        """Relevant result at end → NDCG < 1."""
        ndcg = ndcg_at_k(["x", "y", "a"], {"a"}, k=3)
        assert 0 < ndcg < 1.0

    def test_dcg_formula(self) -> None:
        """Verify DCG formula: sum(rel_i / log2(i+2))."""
        # ["a", "x", "b"] with relevant = {a, b}
        # DCG = 1/log2(2) + 0/log2(3) + 1/log2(4) = 1.0 + 0 + 0.5 = 1.5
        dcg = dcg_at_k(["a", "x", "b"], {"a", "b"}, k=3)
        expected = 1.0 / math.log2(2) + 0.0 + 1.0 / math.log2(4)
        assert abs(dcg - expected) < 1e-9


class TestEvaluateQuery:
    """Tests for the combined evaluate_query function."""

    def test_produces_all_metrics(self) -> None:
        """evaluate_query should return all metric fields."""
        qm = evaluate_query(
            query="test query",
            category="factual",
            retrieved_ids=["a", "b", "c"],
            relevant_ids={"a", "c"},
            k=3,
        )
        assert qm.query == "test query"
        assert qm.category == "factual"
        assert qm.k == 3
        assert qm.relevant_found == 2
        assert qm.total_relevant == 2
        assert abs(qm.precision_at_k - 2 / 3) < 1e-9
        assert qm.recall_at_k == 1.0
        assert qm.reciprocal_rank == 1.0  # First result is relevant


class TestBenchmarkReport:
    """Tests for aggregate report computation."""

    def test_aggregate_computation(self) -> None:
        """compute_aggregates should average per-query metrics."""
        report = BenchmarkReport()
        report.query_metrics = [
            evaluate_query("q1", "factual", ["a", "b"], {"a"}, k=2),
            evaluate_query("q2", "temporal", ["x", "y"], {"y"}, k=2),
        ]
        report.compute_aggregates()

        assert report.mean_precision > 0
        assert report.mean_recall > 0
        assert report.mrr > 0
        assert "factual" in report.category_breakdown
        assert "temporal" in report.category_breakdown

    def test_empty_report(self) -> None:
        """Empty report should have zero metrics."""
        report = BenchmarkReport()
        report.compute_aggregates()
        assert report.mean_precision == 0.0
        assert report.mean_recall == 0.0


class TestNaiveBaseline:
    """Tests for the naive keyword-overlap baseline."""

    def test_tokenize_removes_stop_words(self) -> None:
        """Stop words should be excluded."""
        tokens = tokenize("The quick brown fox is very fast")
        assert "the" not in tokens
        assert "very" not in tokens
        assert "quick" in tokens
        assert "brown" in tokens

    def test_tokenize_min_length(self) -> None:
        """Tokens shorter than 3 chars should be excluded."""
        tokens = tokenize("I am a very good AI agent")
        assert "am" not in tokens
        assert "good" in tokens
        assert "agent" in tokens

    def test_keyword_overlap_score(self) -> None:
        """Score should reflect fraction of query keywords found."""
        q_tokens = {"database", "postgresql", "setup"}
        m_tokens = {"postgresql", "database", "migration"}
        score = keyword_overlap_score(q_tokens, m_tokens)
        assert abs(score - 2 / 3) < 1e-9

    def test_rank_memories_ordering(self) -> None:
        """Higher overlap should rank higher."""
        memories = [
            ("m1", "Alice likes coffee"),
            ("m2", "We use PostgreSQL for the database"),
            ("m3", "PostgreSQL database migration script"),
        ]
        results = rank_memories("What database do we use PostgreSQL?", memories, top_k=3)
        assert len(results) >= 1
        # m2 and m3 should rank above m1 (more keyword overlap with "PostgreSQL database")
        result_ids = [r.memory_id for r in results]
        if "m1" in result_ids:
            assert result_ids.index("m1") > 0  # m1 should not be first

    def test_empty_query(self) -> None:
        """Empty query should return no results."""
        results = rank_memories("", [("m1", "some content")], top_k=5)
        assert len(results) == 0
