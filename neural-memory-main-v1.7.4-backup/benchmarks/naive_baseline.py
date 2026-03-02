"""Naive keyword-overlap baseline for benchmark comparison.

This is the strawman that NeuralMemory's activation-based recall must beat.
Simple approach: tokenize query, count shared words with each memory, rank by overlap.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Common English stop words to exclude from keyword matching
_STOP_WORDS: frozenset[str] = frozenset(
    {
        "the",
        "a",
        "an",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "shall",
        "can",
        "we",
        "i",
        "they",
        "you",
        "he",
        "she",
        "it",
        "our",
        "my",
        "your",
        "their",
        "his",
        "her",
        "its",
        "to",
        "of",
        "in",
        "for",
        "on",
        "with",
        "at",
        "by",
        "from",
        "as",
        "into",
        "about",
        "between",
        "through",
        "after",
        "before",
        "during",
        "that",
        "this",
        "which",
        "what",
        "who",
        "whom",
        "where",
        "when",
        "how",
        "why",
        "not",
        "but",
        "and",
        "or",
        "if",
        "then",
        "than",
        "so",
        "up",
        "down",
        "out",
        "just",
        "also",
        "very",
        "too",
    }
)


@dataclass(frozen=True)
class BaselineResult:
    """Result from naive keyword-overlap ranking.

    Attributes:
        memory_id: The memory identifier
        content: The memory text
        score: Keyword overlap score
        shared_keywords: Keywords shared between query and memory
    """

    memory_id: str
    content: str
    score: float
    shared_keywords: set[str]


def tokenize(text: str) -> set[str]:
    """Tokenize text into lowercase keyword set, excluding stop words.

    Args:
        text: Input text

    Returns:
        Set of lowercase keywords (3+ chars, no stop words)
    """
    words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9_.-]+\b", text)
    return {w.lower() for w in words if w.lower() not in _STOP_WORDS and len(w) >= 3}


def keyword_overlap_score(query_tokens: set[str], memory_tokens: set[str]) -> float:
    """Compute keyword overlap score between query and memory.

    Score = |intersection| / |query_tokens| (recall-oriented).
    If query has no tokens, returns 0.

    Args:
        query_tokens: Tokenized query
        memory_tokens: Tokenized memory

    Returns:
        Overlap score in [0, 1]
    """
    if not query_tokens:
        return 0.0
    shared = query_tokens & memory_tokens
    return len(shared) / len(query_tokens)


def rank_memories(
    query: str,
    memories: list[tuple[str, str]],
    top_k: int = 10,
) -> list[BaselineResult]:
    """Rank memories by keyword overlap with query.

    Args:
        query: The search query
        memories: List of (memory_id, content) tuples
        top_k: Number of top results to return

    Returns:
        Top-K memories ranked by keyword overlap score
    """
    query_tokens = tokenize(query)

    results: list[BaselineResult] = []
    for memory_id, content in memories:
        memory_tokens = tokenize(content)
        shared = query_tokens & memory_tokens
        score = keyword_overlap_score(query_tokens, memory_tokens)

        if score > 0:
            results.append(
                BaselineResult(
                    memory_id=memory_id,
                    content=content,
                    score=score,
                    shared_keywords=shared,
                )
            )

    # Sort by score descending, then by memory_id for stability
    results.sort(key=lambda r: (-r.score, r.memory_id))

    return results[:top_k]


def evaluate_baseline(
    queries: list[tuple[str, str, set[str]]],
    memories: list[tuple[str, str]],
    k: int = 5,
) -> dict[str, dict[str, float]]:
    """Evaluate the naive baseline on ground truth queries.

    Args:
        queries: List of (query_text, category, expected_ids) tuples
        memories: List of (memory_id, content) tuples
        k: K value for metrics

    Returns:
        Dict with per-category and overall metrics
    """
    from benchmarks.metrics import BenchmarkReport, evaluate_query

    report = BenchmarkReport()

    for query_text, category, expected_ids in queries:
        ranked = rank_memories(query_text, memories, top_k=k)
        retrieved_ids = [r.memory_id for r in ranked]

        qm = evaluate_query(
            query=query_text,
            category=category,
            retrieved_ids=retrieved_ids,
            relevant_ids=expected_ids,
            k=k,
        )
        report.query_metrics.append(qm)

    report.compute_aggregates()

    result: dict[str, dict[str, float]] = {
        "overall": {
            "precision": report.mean_precision,
            "recall": report.mean_recall,
            "mrr": report.mrr,
            "ndcg": report.mean_ndcg,
        },
    }
    result.update(report.category_breakdown)

    return result
