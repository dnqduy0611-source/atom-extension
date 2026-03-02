"""Standard IR evaluation metrics for NeuralMemory benchmarks.

Implements:
- Precision@K: How many top-K results are relevant
- Recall@K: How many relevant results found in top-K
- MRR (Mean Reciprocal Rank): How quickly the first relevant result appears
- NDCG@K (Normalized Discounted Cumulative Gain): Overall ranking quality
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass(frozen=True)
class QueryMetrics:
    """Metrics for a single query evaluation.

    Attributes:
        query: The query text
        category: Query category
        precision_at_k: Precision@K value
        recall_at_k: Recall@K value
        reciprocal_rank: 1/rank of first relevant result (0 if none)
        ndcg_at_k: NDCG@K value
        k: The K value used
        relevant_found: Number of relevant results in top-K
        total_relevant: Total number of relevant results
    """

    query: str
    category: str
    precision_at_k: float
    recall_at_k: float
    reciprocal_rank: float
    ndcg_at_k: float
    k: int
    relevant_found: int
    total_relevant: int


@dataclass
class BenchmarkReport:
    """Aggregate metrics across all queries.

    Attributes:
        query_metrics: Per-query metrics
        mean_precision: Mean Precision@K across queries
        mean_recall: Mean Recall@K across queries
        mrr: Mean Reciprocal Rank
        mean_ndcg: Mean NDCG@K
        category_breakdown: Metrics per query category
    """

    query_metrics: list[QueryMetrics] = field(default_factory=list)
    mean_precision: float = 0.0
    mean_recall: float = 0.0
    mrr: float = 0.0
    mean_ndcg: float = 0.0
    category_breakdown: dict[str, dict[str, float]] = field(default_factory=dict)

    def compute_aggregates(self) -> None:
        """Compute aggregate metrics from per-query results."""
        if not self.query_metrics:
            return

        n = len(self.query_metrics)
        self.mean_precision = sum(q.precision_at_k for q in self.query_metrics) / n
        self.mean_recall = sum(q.recall_at_k for q in self.query_metrics) / n
        self.mrr = sum(q.reciprocal_rank for q in self.query_metrics) / n
        self.mean_ndcg = sum(q.ndcg_at_k for q in self.query_metrics) / n

        # Per-category breakdown
        categories: dict[str, list[QueryMetrics]] = {}
        for qm in self.query_metrics:
            categories.setdefault(qm.category, []).append(qm)

        for cat, metrics in categories.items():
            cn = len(metrics)
            self.category_breakdown[cat] = {
                "precision": sum(q.precision_at_k for q in metrics) / cn,
                "recall": sum(q.recall_at_k for q in metrics) / cn,
                "mrr": sum(q.reciprocal_rank for q in metrics) / cn,
                "ndcg": sum(q.ndcg_at_k for q in metrics) / cn,
                "count": cn,
            }


def precision_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    """Compute Precision@K: fraction of top-K results that are relevant.

    Args:
        retrieved_ids: Ordered list of retrieved memory IDs
        relevant_ids: Set of truly relevant memory IDs
        k: Number of top results to consider

    Returns:
        Precision@K value in [0, 1]
    """
    if k <= 0:
        return 0.0
    top_k = retrieved_ids[:k]
    if not top_k:
        return 0.0
    relevant_in_top_k = sum(1 for rid in top_k if rid in relevant_ids)
    return relevant_in_top_k / k


def recall_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    """Compute Recall@K: fraction of relevant results found in top-K.

    Args:
        retrieved_ids: Ordered list of retrieved memory IDs
        relevant_ids: Set of truly relevant memory IDs
        k: Number of top results to consider

    Returns:
        Recall@K value in [0, 1]
    """
    if not relevant_ids:
        return 1.0  # No relevant → perfect recall by convention
    top_k = retrieved_ids[:k]
    relevant_found = sum(1 for rid in top_k if rid in relevant_ids)
    return relevant_found / len(relevant_ids)


def reciprocal_rank(retrieved_ids: list[str], relevant_ids: set[str]) -> float:
    """Compute Reciprocal Rank: 1/rank of first relevant result.

    Args:
        retrieved_ids: Ordered list of retrieved memory IDs
        relevant_ids: Set of truly relevant memory IDs

    Returns:
        1/rank of first relevant result, 0 if none found
    """
    for i, rid in enumerate(retrieved_ids):
        if rid in relevant_ids:
            return 1.0 / (i + 1)
    return 0.0


def dcg_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    """Compute Discounted Cumulative Gain at K.

    Uses binary relevance: 1 if relevant, 0 otherwise.

    Args:
        retrieved_ids: Ordered list of retrieved memory IDs
        relevant_ids: Set of truly relevant memory IDs
        k: Number of top results to consider

    Returns:
        DCG@K value
    """
    dcg = 0.0
    for i, rid in enumerate(retrieved_ids[:k]):
        rel = 1.0 if rid in relevant_ids else 0.0
        dcg += rel / math.log2(i + 2)  # i+2 because log2(1) = 0
    return dcg


def ndcg_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    """Compute Normalized DCG at K.

    NDCG = DCG / ideal_DCG. Ideal ranking places all relevant docs first.

    Args:
        retrieved_ids: Ordered list of retrieved memory IDs
        relevant_ids: Set of truly relevant memory IDs
        k: Number of top results to consider

    Returns:
        NDCG@K value in [0, 1]
    """
    actual_dcg = dcg_at_k(retrieved_ids, relevant_ids, k)

    # Ideal: all relevant documents ranked first
    n_relevant = min(len(relevant_ids), k)
    ideal_dcg = sum(1.0 / math.log2(i + 2) for i in range(n_relevant))

    if ideal_dcg == 0:
        return 0.0

    return actual_dcg / ideal_dcg


def evaluate_query(
    query: str,
    category: str,
    retrieved_ids: list[str],
    relevant_ids: set[str],
    k: int = 5,
) -> QueryMetrics:
    """Evaluate a single query against ground truth.

    Args:
        query: The query text
        category: Query category
        retrieved_ids: Ordered list of retrieved memory IDs
        relevant_ids: Set of truly relevant memory IDs
        k: K value for @K metrics

    Returns:
        QueryMetrics with all metric values
    """
    p_at_k = precision_at_k(retrieved_ids, relevant_ids, k)
    r_at_k = recall_at_k(retrieved_ids, relevant_ids, k)
    rr = reciprocal_rank(retrieved_ids, relevant_ids)
    ndcg = ndcg_at_k(retrieved_ids, relevant_ids, k)

    relevant_found = sum(1 for rid in retrieved_ids[:k] if rid in relevant_ids)

    return QueryMetrics(
        query=query,
        category=category,
        precision_at_k=p_at_k,
        recall_at_k=r_at_k,
        reciprocal_rank=rr,
        ndcg_at_k=ndcg,
        k=k,
        relevant_found=relevant_found,
        total_relevant=len(relevant_ids),
    )
