"""Unit tests for multi-neuron answer reconstruction."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock

import pytest

from neural_memory.core.fiber import Fiber
from neural_memory.core.neuron import Neuron, NeuronState, NeuronType
from neural_memory.engine.activation import ActivationResult
from neural_memory.engine.reconstruction import (
    SynthesisMethod,
    _score_candidates,
    reconstruct_answer,
)


def _make_activation(neuron_id: str, level: float) -> ActivationResult:
    """Create a test ActivationResult."""
    return ActivationResult(
        neuron_id=neuron_id,
        activation_level=level,
        hop_distance=1,
        path=["anchor", neuron_id],
        source_anchor="anchor",
    )


def _make_neuron(
    neuron_id: str, content: str, neuron_type: NeuronType = NeuronType.ENTITY
) -> Neuron:
    """Create a test Neuron."""
    return Neuron(
        id=neuron_id,
        type=neuron_type,
        content=content,
        created_at=datetime(2026, 1, 1),
    )


def _make_fiber(
    fiber_id: str,
    neuron_ids: set[str],
    summary: str | None = None,
    pathway: list[str] | None = None,
) -> Fiber:
    """Create a test Fiber."""
    return Fiber(
        id=fiber_id,
        neuron_ids=neuron_ids,
        synapse_ids=set(),
        anchor_neuron_id=next(iter(neuron_ids)) if neuron_ids else "",
        pathway=pathway or [],
        summary=summary,
        created_at=datetime(2026, 1, 1),
    )


def _make_mock_storage(
    neurons: dict[str, Neuron] | None = None,
    states: dict[str, NeuronState] | None = None,
) -> AsyncMock:
    """Create a mock storage with configurable neuron/state lookups."""
    storage = AsyncMock()
    neurons = neurons or {}
    states = states or {}

    async def get_neuron(nid: str) -> Neuron | None:
        return neurons.get(nid)

    async def get_neuron_state(nid: str) -> NeuronState | None:
        return states.get(nid)

    async def get_neurons_batch(nids: list[str]) -> dict[str, Neuron]:
        return {nid: neurons[nid] for nid in nids if nid in neurons}

    storage.get_neuron = AsyncMock(side_effect=get_neuron)
    storage.get_neuron_state = AsyncMock(side_effect=get_neuron_state)
    storage.get_neurons_batch = AsyncMock(side_effect=get_neurons_batch)
    storage.get_synapses = AsyncMock(return_value=[])

    return storage


class TestScoreCandidates:
    """Tests for candidate scoring."""

    def test_intersections_boosted(self) -> None:
        """Intersection neurons should get 1.5x score boost."""
        activations = {
            "n1": _make_activation("n1", 0.6),
            "n2": _make_activation("n2", 0.8),
        }
        candidates = _score_candidates(activations, intersections=["n1"])
        # n1 gets 0.6 * 1.5 = 0.9, n2 stays 0.8 → n1 should rank first
        assert candidates[0][0] == "n1"
        assert candidates[0][1] == pytest.approx(0.9, abs=0.01)

    def test_non_intersection_unboosted(self) -> None:
        """Non-intersection neurons should keep original score."""
        activations = {
            "n1": _make_activation("n1", 0.6),
        }
        candidates = _score_candidates(activations, intersections=[])
        assert candidates[0][1] == pytest.approx(0.6, abs=0.01)

    def test_sorted_descending(self) -> None:
        """Candidates should be sorted by score descending."""
        activations = {
            "n1": _make_activation("n1", 0.3),
            "n2": _make_activation("n2", 0.8),
            "n3": _make_activation("n3", 0.5),
        }
        candidates = _score_candidates(activations, intersections=[])
        scores = [c[1] for c in candidates]
        assert scores == sorted(scores, reverse=True)


class TestReconstructAnswer:
    """Tests for answer reconstruction strategies."""

    @pytest.mark.asyncio
    async def test_empty_activations(self) -> None:
        """Empty activations should return NONE method."""
        storage = _make_mock_storage()
        result = await reconstruct_answer(storage, {}, [], [])
        assert result.method == SynthesisMethod.NONE
        assert result.answer is None
        assert result.confidence == 0.0

    @pytest.mark.asyncio
    async def test_single_mode_high_confidence(self) -> None:
        """High confidence top neuron should use SINGLE mode."""
        neurons = {"n1": _make_neuron("n1", "PostgreSQL is the database")}
        states = {"n1": NeuronState(neuron_id="n1", activation_level=0.9, access_frequency=5)}
        storage = _make_mock_storage(neurons, states)

        activations = {"n1": _make_activation("n1", 0.9)}
        result = await reconstruct_answer(
            storage,
            activations,
            intersections=["n1"],
            fibers=[],
        )
        assert result.method == SynthesisMethod.SINGLE
        assert result.answer == "PostgreSQL is the database"
        assert len(result.contributing_neuron_ids) == 1

    @pytest.mark.asyncio
    async def test_fiber_summary_mode(self) -> None:
        """Fiber with summary should use FIBER_SUMMARY mode."""
        neurons = {"n1": _make_neuron("n1", "raw content")}
        states = {"n1": NeuronState(neuron_id="n1")}
        storage = _make_mock_storage(neurons, states)

        activations = {"n1": _make_activation("n1", 0.5)}
        fiber = _make_fiber("f1", {"n1"}, summary="Team uses PostgreSQL for production")
        result = await reconstruct_answer(
            storage,
            activations,
            intersections=[],
            fibers=[fiber],
        )
        assert result.method == SynthesisMethod.FIBER_SUMMARY
        assert result.answer == "Team uses PostgreSQL for production"

    @pytest.mark.asyncio
    async def test_multi_neuron_mode(self) -> None:
        """Multiple neurons without summary should use MULTI_NEURON mode."""
        neurons = {
            "n1": _make_neuron("n1", "Alice"),
            "n2": _make_neuron("n2", "reviewed PR"),
            "n3": _make_neuron("n3", "yesterday"),
        }
        states = {nid: NeuronState(neuron_id=nid) for nid in neurons}
        storage = _make_mock_storage(neurons, states)

        activations = {
            "n1": _make_activation("n1", 0.6),
            "n2": _make_activation("n2", 0.5),
            "n3": _make_activation("n3", 0.4),
        }
        fiber = _make_fiber("f1", {"n1", "n2", "n3"})
        result = await reconstruct_answer(
            storage,
            activations,
            intersections=[],
            fibers=[fiber],
        )
        assert result.method == SynthesisMethod.MULTI_NEURON
        assert result.answer is not None
        assert "Alice" in result.answer
        assert "reviewed PR" in result.answer
        assert len(result.contributing_neuron_ids) >= 2

    @pytest.mark.asyncio
    async def test_multi_neuron_respects_pathway_order(self) -> None:
        """Multi-neuron mode should order by fiber pathway position."""
        neurons = {
            "n1": _make_neuron("n1", "first"),
            "n2": _make_neuron("n2", "second"),
            "n3": _make_neuron("n3", "third"),
        }
        states = {nid: NeuronState(neuron_id=nid) for nid in neurons}
        storage = _make_mock_storage(neurons, states)

        activations = {
            "n1": _make_activation("n1", 0.5),
            "n2": _make_activation("n2", 0.6),  # higher activation
            "n3": _make_activation("n3", 0.4),
        }
        # Pathway order: n3 → n1 → n2
        fiber = _make_fiber(
            "f1",
            {"n1", "n2", "n3"},
            pathway=["n3", "n1", "n2"],
        )
        result = await reconstruct_answer(
            storage,
            activations,
            intersections=[],
            fibers=[fiber],
        )
        assert result.method == SynthesisMethod.MULTI_NEURON
        # Answer should follow pathway order: third; first; second
        parts = result.answer.split("; ")
        assert parts[0] == "third"
        assert parts[1] == "first"
        assert parts[2] == "second"

    @pytest.mark.asyncio
    async def test_time_neurons_excluded_from_multi(self) -> None:
        """TIME neurons should be excluded from multi-neuron reconstruction."""
        neurons = {
            "n1": _make_neuron("n1", "Alice", NeuronType.ENTITY),
            "t1": _make_neuron("t1", "2026-01-01", NeuronType.TIME),
        }
        states = {nid: NeuronState(neuron_id=nid) for nid in neurons}
        storage = _make_mock_storage(neurons, states)

        activations = {
            "n1": _make_activation("n1", 0.5),
            "t1": _make_activation("t1", 0.6),
        }
        result = await reconstruct_answer(
            storage,
            activations,
            intersections=[],
            fibers=[],
        )
        assert "t1" not in result.contributing_neuron_ids

    @pytest.mark.asyncio
    async def test_score_breakdown_present(self) -> None:
        """Score breakdown should always be present when there are candidates."""
        neurons = {"n1": _make_neuron("n1", "content")}
        states = {"n1": NeuronState(neuron_id="n1", access_frequency=3)}
        storage = _make_mock_storage(neurons, states)

        activations = {"n1": _make_activation("n1", 0.9)}
        result = await reconstruct_answer(
            storage,
            activations,
            intersections=["n1"],
            fibers=[],
        )
        assert result.score_breakdown is not None
        assert result.score_breakdown.base_activation > 0
        assert result.score_breakdown.intersection_boost > 0

    @pytest.mark.asyncio
    async def test_max_contributing_respected(self) -> None:
        """max_contributing should limit multi-neuron count."""
        neurons = {f"n{i}": _make_neuron(f"n{i}", f"content-{i}") for i in range(10)}
        states = {nid: NeuronState(neuron_id=nid) for nid in neurons}
        storage = _make_mock_storage(neurons, states)

        activations = {f"n{i}": _make_activation(f"n{i}", 0.4 + (i * 0.01)) for i in range(10)}
        result = await reconstruct_answer(
            storage,
            activations,
            intersections=[],
            fibers=[],
            max_contributing=3,
        )
        assert len(result.contributing_neuron_ids) <= 3
