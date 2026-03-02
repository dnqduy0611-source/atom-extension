"""Long-horizon coherence test for NeuralMemory.

Simulates 5 sessions across 30 days:
1. Day 1: encode initial memories, query
2. Day 3: encode more, query day 1
3. Day 7: encode more, query days 1+3
4. Day 14: run consolidation, query all
5. Day 30: test long-term retention

Target: > 60% recall accuracy at day 30.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from benchmarks.ground_truth import MEMORIES, QUERIES, get_session_schedule
from benchmarks.metrics import BenchmarkReport, evaluate_query


@dataclass(frozen=True)
class SessionResult:
    """Results from a single coherence test session.

    Attributes:
        day: Day offset of this session
        memories_encoded: Number of memories encoded in this session
        total_memories: Total memories encoded so far
        queries_tested: Number of queries evaluated
        mean_recall: Average recall for queries tested at this session
        mean_precision: Average precision for queries tested
        mrr: Mean reciprocal rank for this session's queries
    """

    day: int
    memories_encoded: int
    total_memories: int
    queries_tested: int
    mean_recall: float
    mean_precision: float
    mrr: float


@dataclass
class CoherenceReport:
    """Full coherence test report across all sessions.

    Attributes:
        sessions: Per-session results
        final_recall: Recall at day 30
        final_precision: Precision at day 30
        final_mrr: MRR at day 30
        target_met: Whether > 60% recall was achieved
    """

    sessions: list[SessionResult] = field(default_factory=list)
    final_recall: float = 0.0
    final_precision: float = 0.0
    final_mrr: float = 0.0
    target_met: bool = False


async def run_coherence_test(
    encode_fn: object,
    query_fn: object,
    consolidate_fn: object | None = None,
    k: int = 5,
) -> CoherenceReport:
    """Run the multi-session coherence test.

    Args:
        encode_fn: async (content, tags, timestamp) -> memory_id mapping
            Returns dict mapping ground-truth ID to actual system ID
        query_fn: async (query_text) -> list[str] of retrieved memory IDs
        consolidate_fn: optional async () -> None to run consolidation
        k: K value for metrics

    Returns:
        CoherenceReport with per-session and final results
    """
    report = CoherenceReport()
    schedule = get_session_schedule()

    base_time = datetime(2026, 1, 1, 9, 0, 0)
    # Map from ground-truth ID to actual system ID
    id_mapping: dict[str, str] = {}
    total_encoded = 0

    for _session_idx, (day, day_memories) in enumerate(schedule):
        session_time = base_time + timedelta(days=day)

        # Encode this session's memories
        for mem in day_memories:
            mem_time = session_time + timedelta(minutes=len(id_mapping))
            actual_id = await encode_fn(mem.content, mem.tags, mem_time)
            if isinstance(actual_id, dict):
                id_mapping.update(actual_id)
            else:
                id_mapping[mem.id] = actual_id
            total_encoded += 1

        # Run consolidation on day 14+ if available
        if day >= 14 and consolidate_fn is not None:
            await consolidate_fn()

        # Evaluate queries that should be answerable by now
        available_ids = {m.id for m in MEMORIES if m.day_offset <= day}
        testable_queries = [
            q
            for q in QUERIES
            if q.expected_ids & available_ids  # At least some expected results exist
        ]

        session_report = BenchmarkReport()
        for query in testable_queries:
            # Map expected IDs to actual system IDs
            mapped_expected = {
                id_mapping.get(eid, eid) for eid in query.expected_ids if eid in available_ids
            }

            retrieved = await query_fn(query.query)
            if not isinstance(retrieved, list):
                retrieved = list(retrieved)

            qm = evaluate_query(
                query=query.query,
                category=query.category,
                retrieved_ids=retrieved,
                relevant_ids=mapped_expected,
                k=k,
            )
            session_report.query_metrics.append(qm)

        session_report.compute_aggregates()

        session_result = SessionResult(
            day=day,
            memories_encoded=len(day_memories),
            total_memories=total_encoded,
            queries_tested=len(testable_queries),
            mean_recall=session_report.mean_recall,
            mean_precision=session_report.mean_precision,
            mrr=session_report.mrr,
        )
        report.sessions.append(session_result)

    # Final session is the last one
    if report.sessions:
        final = report.sessions[-1]
        report.final_recall = final.mean_recall
        report.final_precision = final.mean_precision
        report.final_mrr = final.mrr
        report.target_met = final.mean_recall >= 0.6

    return report


def format_coherence_report(report: CoherenceReport) -> str:
    """Format coherence report as markdown table.

    Args:
        report: The coherence test report

    Returns:
        Markdown-formatted report string
    """
    lines: list[str] = []
    lines.append("### Long-Horizon Coherence Test\n")
    lines.append("| Day | Memories | Total | Queries | Recall | Precision | MRR |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- |")

    for session in report.sessions:
        lines.append(
            f"| {session.day} | {session.memories_encoded} | {session.total_memories} "
            f"| {session.queries_tested} | {session.mean_recall:.1%} "
            f"| {session.mean_precision:.1%} | {session.mrr:.3f} |"
        )

    lines.append("")
    target_icon = "PASS" if report.target_met else "FAIL"
    lines.append(f"**Day 30 Recall: {report.final_recall:.1%}** (target: >= 60%) [{target_icon}]")

    return "\n".join(lines)
