"""
Run activation benchmarks, ground-truth evaluation, and coherence tests.

Usage:
    python benchmarks/run_benchmarks.py

Outputs:
    docs/benchmarks.md  -- MkDocs-compatible benchmark results page
"""

from __future__ import annotations

import asyncio
import random
import statistics
import sys
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from benchmarks.ground_truth import MEMORIES as GT_MEMORIES
from benchmarks.ground_truth import QUERIES as GT_QUERIES
from benchmarks.metrics import BenchmarkReport, evaluate_query
from benchmarks.naive_baseline import evaluate_baseline
from neural_memory.core.brain import Brain, BrainConfig
from neural_memory.core.fiber import Fiber
from neural_memory.core.neuron import Neuron, NeuronType
from neural_memory.core.synapse import Synapse, SynapseType
from neural_memory.engine.activation import SpreadingActivation
from neural_memory.engine.encoder import MemoryEncoder
from neural_memory.engine.reflex_activation import ReflexActivation
from neural_memory.engine.retrieval import DepthLevel, ReflexPipeline
from neural_memory.storage.memory_store import InMemoryStorage

NEURON_TYPES = [
    NeuronType.TIME,
    NeuronType.ENTITY,
    NeuronType.ACTION,
    NeuronType.CONCEPT,
    NeuronType.SPATIAL,
]
SYNAPSE_TYPES = [
    SynapseType.RELATED_TO,
    SynapseType.CAUSED_BY,
    SynapseType.INVOLVES,
    SynapseType.HAPPENED_AT,
]

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"


# ── Graph builder ─────────────────────────────────────────────────────────────


async def build_graph(
    n_neurons: int,
    n_fibers: int,
    pathway_length: int = 10,
    overlap: float = 0.3,
) -> tuple[InMemoryStorage, BrainConfig, list[str], list[Fiber], list[list[str]]]:
    config = BrainConfig(activation_threshold=0.05, max_spread_hops=4)
    storage = InMemoryStorage()
    brain = Brain.create(name="bench", config=config)
    await storage.save_brain(brain)
    storage.set_brain(brain.id)

    neuron_ids: list[str] = []
    for i in range(n_neurons):
        n = Neuron.create(
            type=NEURON_TYPES[i % len(NEURON_TYPES)],
            content=f"neuron_{i}",
            neuron_id=f"n{i}",
        )
        await storage.add_neuron(n)
        neuron_ids.append(n.id)

    synapse_ids: list[str] = []
    edges: set[tuple[str, str]] = set()
    sid = 0
    # Sequential chain
    for i in range(n_neurons - 1):
        src, tgt = f"n{i}", f"n{i + 1}"
        edges.add((src, tgt))
        s = Synapse.create(src, tgt, SynapseType.RELATED_TO, weight=0.8, synapse_id=f"s{sid}")
        await storage.add_synapse(s)
        synapse_ids.append(s.id)
        sid += 1
    # Cross-links
    for _ in range(n_neurons * 2):
        src, tgt = random.choice(neuron_ids), random.choice(neuron_ids)
        if src == tgt or (src, tgt) in edges:
            continue
        edges.add((src, tgt))
        s = Synapse.create(
            src,
            tgt,
            random.choice(SYNAPSE_TYPES),
            weight=round(random.uniform(0.3, 0.9), 2),
            synapse_id=f"s{sid}",
        )
        await storage.add_synapse(s)
        synapse_ids.append(s.id)
        sid += 1

    # Hub neurons shared across fibers
    n_hubs = max(5, n_neurons // 20)
    hub_ids = [f"n{i}" for i in random.sample(range(n_neurons), n_hubs)]

    fibers: list[Fiber] = []
    for i in range(n_fibers):
        n_h = max(1, int(pathway_length * overlap))
        n_u = pathway_length - n_h
        hubs = random.sample(hub_ids, min(n_h, len(hub_ids)))
        unique = random.sample(
            [x for x in neuron_ids if x not in hubs], min(n_u, len(neuron_ids) - len(hubs))
        )
        pathway = hubs + unique
        random.shuffle(pathway)
        fsyn = set(random.sample(synapse_ids, min(pathway_length, len(synapse_ids))))
        f = Fiber.create(
            neuron_ids=set(pathway),
            synapse_ids=fsyn,
            anchor_neuron_id=pathway[0],
            pathway=pathway,
            fiber_id=f"fiber_{i}",
        )
        f = f.conduct(
            conducted_at=datetime.now(tz=UTC) - timedelta(hours=random.uniform(0, 48)),
            reinforce=False,
        )
        f = f.with_conductivity(round(random.uniform(0.6, 1.0), 2))
        await storage.add_fiber(f)
        fibers.append(f)

    anchor_sets = [[fibers[j % len(fibers)].pathway[0]] for j in range(3)]
    return storage, config, neuron_ids, fibers, anchor_sets


# ── Timing helper ─────────────────────────────────────────────────────────────


async def timed(coro_factory, n: int = 10) -> list[float]:
    await coro_factory()  # warmup
    times: list[float] = []
    for _ in range(n):
        t0 = time.perf_counter()
        await coro_factory()
        times.append((time.perf_counter() - t0) * 1000)
    return times


# ── Benchmark: synthetic activation ───────────────────────────────────────────


async def bench_activation(sizes: list[dict], n_runs: int) -> list[dict]:
    rows: list[dict] = []
    for cfg in sizes:
        n, nf, pl = cfg["neurons"], cfg["fibers"], cfg["pathway"]
        storage, config, nids, fibers, anchor_sets = await build_graph(n, nf, pl)
        all_anchors = [a for s in anchor_sets for a in s]

        # Relevant fibers for anchors
        rel_fibers: list[Fiber] = []
        seen: set[str] = set()
        for aid in all_anchors:
            for f in await storage.find_fibers(contains_neuron=aid, limit=10):
                if f.id not in seen:
                    rel_fibers.append(f)
                    seen.add(f.id)

        classic_act = SpreadingActivation(storage, config)
        reflex_act = ReflexActivation(storage, config)

        # Classic
        t_c = await timed(
            lambda _c=classic_act, _a=all_anchors: _c.activate(_a, max_hops=4), n_runs
        )
        r_c = await classic_act.activate(all_anchors, max_hops=4)

        # Reflex
        t_r = await timed(
            lambda _r=reflex_act, _a=all_anchors, _f=rel_fibers: _r.activate_trail(
                _a, _f, datetime.now(tz=UTC)
            ),
            n_runs,
        )
        r_r = await reflex_act.activate_trail(all_anchors, rel_fibers, datetime.now(tz=UTC))

        # Hybrid (simulated: reflex + limited classic merged)
        async def hybrid(
            _r: ReflexActivation = reflex_act,
            _c: SpreadingActivation = classic_act,
            _a: list[str] = all_anchors,
            _f: list[Fiber] = rel_fibers,
        ) -> dict:
            rr = await _r.activate_trail(_a, _f, datetime.now(tz=UTC))
            cr = await _c.activate(_a, max_hops=2)
            merged = dict(rr)
            for nid, res in cr.items():
                if nid not in merged:
                    merged[nid] = res
            return merged

        t_h = await timed(hybrid, n_runs)
        r_h = await hybrid()

        classic_ids = set(r_c.keys())
        reflex_ids = set(r_r.keys())
        hybrid_ids = set(r_h.keys())

        recall_reflex = len(reflex_ids & classic_ids) / max(1, len(classic_ids)) * 100
        recall_hybrid = len(hybrid_ids & classic_ids) / max(1, len(classic_ids)) * 100

        rows.append(
            {
                "neurons": n,
                "fibers": nf,
                "classic_ms": round(statistics.median(t_c), 2),
                "reflex_ms": round(statistics.median(t_r), 2),
                "hybrid_ms": round(statistics.median(t_h), 2),
                "classic_n": len(r_c),
                "reflex_n": len(r_r),
                "hybrid_n": len(r_h),
                "recall_reflex": round(recall_reflex, 1),
                "recall_hybrid": round(recall_hybrid, 1),
            }
        )
    return rows


# ── Benchmark: full pipeline ──────────────────────────────────────────────────

MEMORIES = [
    "Met Alice at the coffee shop on Tuesday to discuss API design",
    "Alice suggested using JWT for authentication instead of sessions",
    "DECISION: Use PostgreSQL for the database. Reason: better JSON support",
    "Fixed the auth bug with null check in login.py line 42",
    "Bob reviewed PR #123 and requested changes to error handling",
    "Deployed v2.1 to staging on Wednesday, all tests passed",
    "The outage on Thursday was caused by a connection pool leak",
    "TODO: Implement rate limiting before the launch next Monday",
    "Alice and Bob agreed to pair program on the caching layer",
    "Meeting with the team to discuss Q1 roadmap priorities",
    "INSIGHT: Redis pub/sub is better than polling for real-time updates",
    "Standup: Bob blocked on CI pipeline, Alice finishing auth module",
    "Refactored UserService to use dependency injection pattern",
    "Found memory leak in WebSocket handler during load testing",
    "DECISION: Switch from REST to gRPC for internal services",
]

QUERIES = [
    ("What did Alice suggest?", DepthLevel.INSTANT),
    ("What was the auth bug fix?", DepthLevel.INSTANT),
    ("What happened on Thursday?", DepthLevel.CONTEXT),
    ("Why did we choose PostgreSQL?", DepthLevel.DEEP),
    ("What is Bob working on?", DepthLevel.CONTEXT),
]


async def bench_pipeline(n_runs: int) -> list[dict]:
    rows: list[dict] = []

    for use_reflex, label in [(False, "classic"), (True, "hybrid")]:
        config = BrainConfig(activation_threshold=0.1, max_spread_hops=4, max_context_tokens=500)
        storage = InMemoryStorage()
        brain = Brain.create(name="bench", config=config)
        await storage.save_brain(brain)
        storage.set_brain(brain.id)

        encoder = MemoryEncoder(storage, config)
        for mem in MEMORIES:
            await encoder.encode(mem)

        pipeline = ReflexPipeline(storage, config, use_reflex=use_reflex)

        for query_text, depth in QUERIES:
            times: list[float] = []
            last = None
            for _ in range(n_runs):
                t0 = time.perf_counter()
                result = await pipeline.query(query_text, depth=depth)
                times.append((time.perf_counter() - t0) * 1000)
                last = result

            rows.append(
                {
                    "mode": label,
                    "query": query_text,
                    "depth": depth.name,
                    "median_ms": round(statistics.median(times), 2),
                    "neurons": last.neurons_activated if last else 0,
                    "confidence": round(last.confidence, 2) if last else 0,
                    "answer": (last.answer or "")[:50] if last else "",
                }
            )

    return rows


# ── Ground-truth evaluation ───────────────────────────────────────────────────


async def bench_ground_truth(k: int = 5) -> tuple[BenchmarkReport, dict[str, dict[str, float]]]:
    """Run ground-truth evaluation: NeuralMemory vs naive baseline.

    Returns:
        Tuple of (neural_report, baseline_results)
    """
    # Set up NeuralMemory
    config = BrainConfig(activation_threshold=0.1, max_spread_hops=4, max_context_tokens=500)
    storage = InMemoryStorage()
    brain = Brain.create(name="ground-truth-bench", config=config)
    await storage.save_brain(brain)
    storage.set_brain(brain.id)

    encoder = MemoryEncoder(storage, config)
    pipeline = ReflexPipeline(storage, config, use_reflex=True)

    # Encode all ground-truth memories
    gt_id_to_fiber: dict[str, str] = {}
    for mem in GT_MEMORIES:
        result = await encoder.encode(mem.content, tags=mem.tags)
        gt_id_to_fiber[mem.id] = result.fiber.id

    # Evaluate NeuralMemory
    neural_report = BenchmarkReport()
    for query in GT_QUERIES:
        result = await pipeline.query(query.query)
        retrieved_fiber_ids = result.fibers_matched

        # Map expected IDs to fiber IDs
        expected_fiber_ids = {gt_id_to_fiber.get(eid, eid) for eid in query.expected_ids}

        qm = evaluate_query(
            query=query.query,
            category=query.category,
            retrieved_ids=retrieved_fiber_ids,
            relevant_ids=expected_fiber_ids,
            k=k,
        )
        neural_report.query_metrics.append(qm)

    neural_report.compute_aggregates()

    # Evaluate naive baseline
    memories_for_baseline = [(m.id, m.content) for m in GT_MEMORIES]
    queries_for_baseline = [(q.query, q.category, q.expected_ids) for q in GT_QUERIES]
    baseline_results = evaluate_baseline(queries_for_baseline, memories_for_baseline, k=k)

    return neural_report, baseline_results


# ── Markdown generation ───────────────────────────────────────────────────────


def md_table(headers: list[str], rows: list[list[str]]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "|" + "|".join(" --- " for _ in headers) + "|",
    ]
    for row in rows:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def generate_markdown(
    act_rows: list[dict],
    pipe_rows: list[dict],
    timestamp: str,
    neural_report: BenchmarkReport | None = None,
    baseline_results: dict[str, dict[str, float]] | None = None,
) -> str:
    sections: list[str] = []

    sections.append("# Benchmarks\n")
    sections.append(f"Last updated: **{timestamp}**\n")
    sections.append("Generated by `benchmarks/run_benchmarks.py`.\n")

    # ── Activation benchmark ──
    sections.append("## Activation Engine\n")
    sections.append(
        "Compares three activation modes on synthetic graphs with overlapping fiber pathways:\n"
    )
    sections.append("- **Classic**: BFS spreading activation with distance-based decay")
    sections.append("- **Reflex**: Trail-based activation through fiber pathways only")
    sections.append(
        "- **Hybrid**: Reflex primary + limited classic BFS for discovery (default in v0.6.0+)\n"
    )

    headers = [
        "Neurons",
        "Fibers",
        "Classic (ms)",
        "Reflex (ms)",
        "Hybrid (ms)",
        "Classic #",
        "Reflex #",
        "Hybrid #",
        "Reflex Recall",
        "Hybrid Recall",
    ]
    table_rows = []
    for r in act_rows:
        table_rows.append(
            [
                str(r["neurons"]),
                str(r["fibers"]),
                str(r["classic_ms"]),
                str(r["reflex_ms"]),
                str(r["hybrid_ms"]),
                str(r["classic_n"]),
                str(r["reflex_n"]),
                str(r["hybrid_n"]),
                f"{r['recall_reflex']}%",
                f"{r['recall_hybrid']}%",
            ]
        )
    sections.append(md_table(headers, table_rows))

    # Speedup summary
    sections.append("\n### Speedup\n")
    headers2 = ["Graph Size", "Classic vs Hybrid", "Classic vs Reflex"]
    rows2 = []
    for r in act_rows:
        sp_h = round(r["classic_ms"] / max(r["hybrid_ms"], 0.001), 1)
        sp_r = round(r["classic_ms"] / max(r["reflex_ms"], 0.001), 1)
        rows2.append([str(r["neurons"]), f"{sp_h}x", f"{sp_r}x"])
    sections.append(md_table(headers2, rows2))

    # Recall improvement
    avg_recall_reflex = statistics.mean(r["recall_reflex"] for r in act_rows)
    avg_recall_hybrid = statistics.mean(r["recall_hybrid"] for r in act_rows)
    sections.append(
        f"\n**Average recall** -- Reflex only: {avg_recall_reflex:.1f}% | Hybrid: {avg_recall_hybrid:.1f}%\n"
    )

    # ── Pipeline benchmark ──
    sections.append("## Full Pipeline\n")
    sections.append("End-to-end benchmark: 15 encoded memories, 5 queries, 10 runs each.\n")

    headers3 = [
        "Query",
        "Depth",
        "Classic (ms)",
        "Hybrid (ms)",
        "Speedup",
        "C-Neurons",
        "H-Neurons",
        "C-Conf",
        "H-Conf",
    ]
    pipe_table: list[list[str]] = []

    queries_seen: list[str] = []
    classic_map: dict[str, dict] = {}
    hybrid_map: dict[str, dict] = {}
    for r in pipe_rows:
        if r["mode"] == "classic":
            classic_map[r["query"]] = r
            if r["query"] not in queries_seen:
                queries_seen.append(r["query"])
        else:
            hybrid_map[r["query"]] = r

    total_c = 0.0
    total_h = 0.0
    for q in queries_seen:
        c = classic_map.get(q, {})
        h = hybrid_map.get(q, {})
        c_ms = c.get("median_ms", 0)
        h_ms = h.get("median_ms", 0)
        total_c += c_ms
        total_h += h_ms
        sp = round(c_ms / max(h_ms, 0.001), 1)
        pipe_table.append(
            [
                q,
                c.get("depth", ""),
                str(c_ms),
                str(h_ms),
                f"{sp}x",
                str(c.get("neurons", 0)),
                str(h.get("neurons", 0)),
                str(c.get("confidence", 0)),
                str(h.get("confidence", 0)),
            ]
        )

    pipe_table.append(
        [
            "**Total**",
            "",
            f"**{round(total_c, 2)}**",
            f"**{round(total_h, 2)}**",
            f"**{round(total_c / max(total_h, 0.001), 1)}x**",
            "",
            "",
            "",
            "",
        ]
    )

    sections.append(md_table(headers3, pipe_table))

    # ── Ground-truth evaluation ──
    if neural_report is not None and baseline_results is not None:
        sections.append("## Ground-Truth Evaluation\n")
        sections.append(f"30 curated memories, {len(neural_report.query_metrics)} queries, K=5.\n")

        # Overall comparison
        bl = baseline_results.get("overall", {})
        sections.append("### Overall (NeuralMemory vs Naive Baseline)\n")
        headers_gt = ["Metric", "NeuralMemory", "Naive Baseline", "Winner"]
        rows_gt = []
        for metric_name, neural_val, baseline_val in [
            ("Precision@5", neural_report.mean_precision, bl.get("precision", 0)),
            ("Recall@5", neural_report.mean_recall, bl.get("recall", 0)),
            ("MRR", neural_report.mrr, bl.get("mrr", 0)),
            ("NDCG@5", neural_report.mean_ndcg, bl.get("ndcg", 0)),
        ]:
            winner = "NeuralMemory" if neural_val >= baseline_val else "Baseline"
            rows_gt.append(
                [
                    metric_name,
                    f"{neural_val:.3f}",
                    f"{baseline_val:.3f}",
                    f"**{winner}**",
                ]
            )
        sections.append(md_table(headers_gt, rows_gt))

        # Per-category breakdown
        sections.append("\n### Per-Category Recall\n")
        headers_cat = ["Category", "NeuralMemory", "Baseline", "Count"]
        rows_cat = []
        for cat, cat_metrics in sorted(neural_report.category_breakdown.items()):
            bl_cat = baseline_results.get(cat, {})
            rows_cat.append(
                [
                    cat,
                    f"{cat_metrics.get('recall', 0):.3f}",
                    f"{bl_cat.get('recall', 0):.3f}",
                    str(int(cat_metrics.get("count", 0))),
                ]
            )
        sections.append(md_table(headers_cat, rows_cat))

    # ── Methodology ──
    sections.append("\n## Methodology\n")
    sections.append(
        """
- **Platform**: InMemoryStorage (NetworkX), single-threaded async
- **Runs**: 10 per measurement (median reported)
- **Warmup**: 1 warmup run excluded from timing
- **Hybrid strategy**: Reflex trail activation (primary) + classic BFS with `max_hops // 2` (discovery, dampened 0.6x)
- **Seed**: `random.seed(42)` for reproducibility

### Regenerate

```bash
python benchmarks/run_benchmarks.py
```

Results are written to `docs/benchmarks.md`.
""".strip()
    )

    return "\n\n".join(sections) + "\n"


# ── Main ──────────────────────────────────────────────────────────────────────


async def main() -> None:
    random.seed(42)
    n_runs = 10

    print("Running activation benchmarks...")
    act_sizes = [
        {"neurons": 100, "fibers": 10, "pathway": 8},
        {"neurons": 500, "fibers": 50, "pathway": 10},
        {"neurons": 1000, "fibers": 100, "pathway": 12},
        {"neurons": 3000, "fibers": 300, "pathway": 12},
        {"neurons": 5000, "fibers": 500, "pathway": 15},
    ]
    act_rows = await bench_activation(act_sizes, n_runs)

    for r in act_rows:
        sp = round(r["classic_ms"] / max(r["hybrid_ms"], 0.001), 1)
        print(
            f"  {r['neurons']:>5} neurons: classic={r['classic_ms']}ms hybrid={r['hybrid_ms']}ms ({sp}x) recall={r['recall_hybrid']}%"
        )

    print("\nRunning pipeline benchmarks...")
    pipe_rows = await bench_pipeline(n_runs)

    for r in pipe_rows:
        print(
            f"  [{r['mode']:>7}] {r['query'][:35]:35s} {r['median_ms']}ms  neurons={r['neurons']}  conf={r['confidence']}"
        )

    print("\nRunning ground-truth evaluation...")
    neural_report, baseline_results = await bench_ground_truth(k=5)
    bl = baseline_results.get("overall", {})
    print(
        f"  NeuralMemory -- P@5={neural_report.mean_precision:.3f}  R@5={neural_report.mean_recall:.3f}  MRR={neural_report.mrr:.3f}  NDCG@5={neural_report.mean_ndcg:.3f}"
    )
    print(
        f"  Baseline     -- P@5={bl.get('precision', 0):.3f}  R@5={bl.get('recall', 0):.3f}  MRR={bl.get('mrr', 0):.3f}  NDCG@5={bl.get('ndcg', 0):.3f}"
    )

    for cat, metrics in sorted(neural_report.category_breakdown.items()):
        bl_cat = baseline_results.get(cat, {})
        print(
            f"    {cat:12s}  neural_recall={metrics.get('recall', 0):.3f}  baseline_recall={bl_cat.get('recall', 0):.3f}"
        )

    # Generate docs
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    md = generate_markdown(act_rows, pipe_rows, timestamp, neural_report, baseline_results)

    out_path = DOCS_DIR / "benchmarks.md"
    out_path.write_text(md, encoding="utf-8")
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
