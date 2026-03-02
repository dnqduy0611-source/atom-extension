"""Unit tests for real-time conflict detection and resolution."""

from __future__ import annotations

from datetime import datetime

from neural_memory.core.neuron import Neuron, NeuronState, NeuronType
from neural_memory.core.synapse import SynapseType
from neural_memory.engine.conflict_detection import (
    Conflict,
    ConflictType,
    _content_agrees,
    _extract_predicates,
    _extract_search_terms,
    _is_decision_content,
    _predicates_conflict,
    _subjects_match,
    _tag_overlap,
    detect_conflicts,
    resolve_conflicts,
)

# ========== Helper extraction tests ==========


class TestPredicateExtraction:
    """Tests for extracting subject-predicate pairs from content."""

    def test_extract_use_pattern(self) -> None:
        """Should extract 'We use PostgreSQL' as predicate."""
        preds = _extract_predicates("We use PostgreSQL")
        assert len(preds) >= 1
        assert any("postgresql" in p.predicate for p in preds)

    def test_extract_chose_pattern(self) -> None:
        """Should extract 'We chose React' as predicate."""
        preds = _extract_predicates("We chose React for the frontend")
        assert len(preds) >= 1
        assert any("react" in p.predicate for p in preds)

    def test_extract_decided_pattern(self) -> None:
        """Should extract 'We decided to use TypeScript'."""
        preds = _extract_predicates("We decided to use TypeScript")
        assert len(preds) >= 1

    def test_no_predicates_in_plain_text(self) -> None:
        """Plain text without predicate patterns should return empty."""
        preds = _extract_predicates("Alice likes coffee in the morning")
        assert len(preds) == 0

    def test_extract_switched_to(self) -> None:
        """Should extract 'switched to' pattern."""
        preds = _extract_predicates("We switched to MySQL")
        assert len(preds) >= 1
        assert any("mysql" in p.predicate for p in preds)


class TestPredicateConflict:
    """Tests for predicate conflict detection."""

    def test_different_predicates_conflict(self) -> None:
        """'postgresql' vs 'mysql' should conflict."""
        assert _predicates_conflict("postgresql", "mysql")

    def test_same_predicate_no_conflict(self) -> None:
        """Same predicate should not conflict."""
        assert not _predicates_conflict("postgresql", "postgresql")

    def test_empty_predicate_no_conflict(self) -> None:
        """Empty predicates should not conflict."""
        assert not _predicates_conflict("", "mysql")
        assert not _predicates_conflict("postgresql", "")

    def test_high_overlap_no_conflict(self) -> None:
        """Predicates with >70% word overlap should not conflict."""
        assert not _predicates_conflict(
            "react with typescript",
            "react with typescript and tailwind",
        )


class TestSubjectMatch:
    """Tests for subject matching."""

    def test_exact_match(self) -> None:
        """Identical subjects should match."""
        assert _subjects_match("the team", "the team")

    def test_implicit_agents_match(self) -> None:
        """Both implicit agents should match."""
        assert _subjects_match("_implicit_agent", "_implicit_agent")

    def test_implicit_matches_explicit(self) -> None:
        """Implicit agent should match any explicit subject."""
        assert _subjects_match("_implicit_agent", "our team")

    def test_substring_match(self) -> None:
        """Subjects containing each other should match."""
        assert _subjects_match("team", "the team")


class TestTagOverlap:
    """Tests for tag Jaccard similarity."""

    def test_identical_tags(self) -> None:
        """Identical tag sets should have overlap 1.0."""
        assert _tag_overlap({"a", "b"}, {"a", "b"}) == 1.0

    def test_disjoint_tags(self) -> None:
        """Disjoint tag sets should have overlap 0.0."""
        assert _tag_overlap({"a", "b"}, {"c", "d"}) == 0.0

    def test_partial_overlap(self) -> None:
        """Partial overlap should be between 0 and 1."""
        overlap = _tag_overlap({"a", "b", "c"}, {"b", "c", "d"})
        assert 0.0 < overlap < 1.0

    def test_empty_tags(self) -> None:
        """Empty tags should return 0.0."""
        assert _tag_overlap(set(), {"a"}) == 0.0
        assert _tag_overlap({"a"}, set()) == 0.0


class TestHelpers:
    """Tests for miscellaneous helper functions."""

    def test_is_decision_content(self) -> None:
        """Decision-like content should be detected."""
        assert _is_decision_content("We decided to use PostgreSQL")
        assert _is_decision_content("We chose React")
        assert not _is_decision_content("Alice likes coffee")

    def test_content_agrees(self) -> None:
        """Similar content should agree."""
        assert _content_agrees(
            "We use PostgreSQL for our database",
            "We use PostgreSQL for our main database",
        )
        assert not _content_agrees(
            "The team chose PostgreSQL as the primary database",
            "The team chose MySQL as the primary database engine",
        )

    def test_extract_search_terms(self) -> None:
        """Should extract non-stop-word terms."""
        terms = _extract_search_terms("We use PostgreSQL for the database")
        assert "PostgreSQL" in terms
        assert "database" in terms
        # Stop words should be excluded
        assert "the" not in [t.lower() for t in terms]

    def test_search_terms_deduplicated(self) -> None:
        """Should not have duplicate terms."""
        terms = _extract_search_terms("PostgreSQL PostgreSQL database database")
        lower_terms = [t.lower() for t in terms]
        assert len(lower_terms) == len(set(lower_terms))


# ========== Integration tests with storage ==========


class _MockStorage:
    """Minimal mock storage for conflict detection tests."""

    def __init__(self) -> None:
        self._neurons: dict[str, Neuron] = {}
        self._states: dict[str, NeuronState] = {}
        self._synapses: list[object] = []

    async def find_neurons(
        self,
        type: NeuronType | None = None,
        content_contains: str | None = None,
        content_exact: str | None = None,
        time_range: tuple[datetime, datetime] | None = None,
        limit: int = 100,
    ) -> list[Neuron]:
        results = []
        for neuron in self._neurons.values():
            if type is not None and neuron.type != type:
                continue
            if content_contains is not None:
                if content_contains.lower() not in neuron.content.lower():
                    continue
            if content_exact is not None and neuron.content != content_exact:
                continue
            results.append(neuron)
        return results[:limit]

    async def get_neuron(self, neuron_id: str) -> Neuron | None:
        return self._neurons.get(neuron_id)

    async def get_neurons_batch(self, neuron_ids: list[str]) -> dict[str, Neuron]:
        return {nid: self._neurons[nid] for nid in neuron_ids if nid in self._neurons}

    async def get_neuron_state(self, neuron_id: str) -> NeuronState | None:
        return self._states.get(neuron_id)

    async def update_neuron_state(self, state: NeuronState) -> None:
        self._states[state.neuron_id] = state

    async def update_neuron(self, neuron: Neuron) -> None:
        self._neurons[neuron.id] = neuron

    async def add_synapse(self, synapse: object) -> str:
        self._synapses.append(synapse)
        return getattr(synapse, "id", "")

    def add_neuron_for_test(self, neuron: Neuron, state: NeuronState | None = None) -> None:
        """Helper to add a neuron to the mock."""
        self._neurons[neuron.id] = neuron
        if state is not None:
            self._states[neuron.id] = state


class TestDetectConflicts:
    """Tests for conflict detection with storage."""

    async def test_detects_factual_contradiction(self) -> None:
        """Should detect contradiction between 'use PostgreSQL' and 'use MySQL'."""
        storage = _MockStorage()
        existing = Neuron.create(
            type=NeuronType.CONCEPT,
            content="We use PostgreSQL for our database",
            neuron_id="existing-1",
        )
        storage.add_neuron_for_test(existing)

        conflicts = await detect_conflicts(
            content="We use MySQL for our database",
            tags={"database", "backend"},
            storage=storage,
        )
        assert len(conflicts) >= 1
        assert conflicts[0].type == ConflictType.FACTUAL_CONTRADICTION
        assert conflicts[0].existing_neuron_id == "existing-1"

    async def test_no_conflict_for_unrelated(self) -> None:
        """Unrelated memories should not conflict."""
        storage = _MockStorage()
        existing = Neuron.create(
            type=NeuronType.CONCEPT,
            content="Alice likes coffee",
            neuron_id="existing-1",
        )
        storage.add_neuron_for_test(existing)

        conflicts = await detect_conflicts(
            content="Bob prefers tea",
            tags={"preferences"},
            storage=storage,
        )
        assert len(conflicts) == 0

    async def test_skips_time_neurons(self) -> None:
        """TIME neurons should never be flagged as conflicts."""
        storage = _MockStorage()
        time_neuron = Neuron.create(
            type=NeuronType.TIME,
            content="We use PostgreSQL",
            neuron_id="time-1",
        )
        storage.add_neuron_for_test(time_neuron)

        conflicts = await detect_conflicts(
            content="We use MySQL",
            tags=set(),
            storage=storage,
        )
        assert len(conflicts) == 0

    async def test_skips_already_disputed(self) -> None:
        """Already-disputed neurons should not be re-flagged."""
        storage = _MockStorage()
        existing = Neuron.create(
            type=NeuronType.CONCEPT,
            content="We use PostgreSQL for our database",
            metadata={"_disputed": True},
            neuron_id="existing-1",
        )
        storage.add_neuron_for_test(existing)

        conflicts = await detect_conflicts(
            content="We use MySQL for our database",
            tags=set(),
            storage=storage,
        )
        assert len(conflicts) == 0

    async def test_empty_storage_no_conflicts(self) -> None:
        """Empty storage should produce no conflicts."""
        storage = _MockStorage()
        conflicts = await detect_conflicts(
            content="We use PostgreSQL",
            tags=set(),
            storage=storage,
        )
        assert len(conflicts) == 0

    async def test_detects_decision_reversal(self) -> None:
        """Should detect reversal when a new decision conflicts with existing."""
        storage = _MockStorage()
        existing = Neuron.create(
            type=NeuronType.CONCEPT,
            content="We decided to use PostgreSQL for the backend database",
            metadata={"tags": ["database", "backend", "infrastructure"]},
            neuron_id="existing-1",
        )
        storage.add_neuron_for_test(existing)

        conflicts = await detect_conflicts(
            content="We decided to switch to MySQL for the backend database",
            tags={"database", "backend", "infrastructure"},
            storage=storage,
            memory_type="decision",
        )
        # Should detect either factual contradiction or decision reversal
        assert len(conflicts) >= 1


class TestResolveConflicts:
    """Tests for conflict resolution actions."""

    async def test_marks_disputed(self) -> None:
        """Resolution should mark existing neuron as _disputed."""
        storage = _MockStorage()
        existing = Neuron.create(
            type=NeuronType.CONCEPT,
            content="We use PostgreSQL",
            neuron_id="existing-1",
        )
        state = NeuronState(neuron_id="existing-1", activation_level=0.8)
        storage.add_neuron_for_test(existing, state)

        conflict = Conflict(
            type=ConflictType.FACTUAL_CONTRADICTION,
            existing_neuron_id="existing-1",
            existing_content="We use PostgreSQL",
            new_content="We use MySQL",
            confidence=0.8,
            subject="_implicit_agent",
            existing_predicate="postgresql",
            new_predicate="mysql",
        )

        resolutions = await resolve_conflicts(
            [conflict],
            new_neuron_id="new-1",
            storage=storage,
        )
        assert len(resolutions) == 1

        updated = await storage.get_neuron("existing-1")
        assert updated is not None
        assert updated.metadata.get("_disputed") is True

    async def test_creates_contradicts_synapse(self) -> None:
        """Resolution should create a CONTRADICTS synapse."""
        storage = _MockStorage()
        existing = Neuron.create(
            type=NeuronType.CONCEPT,
            content="We use PostgreSQL",
            neuron_id="existing-1",
        )
        state = NeuronState(neuron_id="existing-1", activation_level=0.8)
        storage.add_neuron_for_test(existing, state)

        conflict = Conflict(
            type=ConflictType.FACTUAL_CONTRADICTION,
            existing_neuron_id="existing-1",
            existing_content="We use PostgreSQL",
            new_content="We use MySQL",
            confidence=0.8,
        )

        resolutions = await resolve_conflicts(
            [conflict],
            new_neuron_id="new-1",
            storage=storage,
        )
        assert len(resolutions) == 1
        synapse = resolutions[0].contradicts_synapse
        assert synapse.type == SynapseType.CONTRADICTS
        assert synapse.source_id == "new-1"
        assert synapse.target_id == "existing-1"

    async def test_reduces_confidence(self) -> None:
        """Resolution should reduce existing neuron's activation."""
        storage = _MockStorage()
        existing = Neuron.create(
            type=NeuronType.CONCEPT,
            content="We use PostgreSQL",
            neuron_id="existing-1",
        )
        state = NeuronState(neuron_id="existing-1", activation_level=0.8)
        storage.add_neuron_for_test(existing, state)

        conflict = Conflict(
            type=ConflictType.FACTUAL_CONTRADICTION,
            existing_neuron_id="existing-1",
            existing_content="We use PostgreSQL",
            new_content="We use MySQL",
            confidence=0.9,
        )

        resolutions = await resolve_conflicts(
            [conflict],
            new_neuron_id="new-1",
            storage=storage,
        )
        assert resolutions[0].confidence_reduced_by > 0

        updated_state = await storage.get_neuron_state("existing-1")
        assert updated_state is not None
        assert updated_state.activation_level < 0.8

    async def test_supersedes_low_confidence(self) -> None:
        """Neuron with very low confidence after reduction should be superseded."""
        storage = _MockStorage()
        existing = Neuron.create(
            type=NeuronType.CONCEPT,
            content="We use PostgreSQL",
            neuron_id="existing-1",
        )
        # Very low starting confidence
        state = NeuronState(neuron_id="existing-1", activation_level=0.15)
        storage.add_neuron_for_test(existing, state)

        conflict = Conflict(
            type=ConflictType.FACTUAL_CONTRADICTION,
            existing_neuron_id="existing-1",
            existing_content="We use PostgreSQL",
            new_content="We use MySQL",
            confidence=0.9,
        )

        resolutions = await resolve_conflicts(
            [conflict],
            new_neuron_id="new-1",
            storage=storage,
        )
        assert len(resolutions) == 1
        assert resolutions[0].superseded is True

        updated = await storage.get_neuron("existing-1")
        assert updated is not None
        assert updated.metadata.get("_superseded") is True

    async def test_no_resolution_for_missing_neuron(self) -> None:
        """If existing neuron is gone, skip resolution gracefully."""
        storage = _MockStorage()

        conflict = Conflict(
            type=ConflictType.FACTUAL_CONTRADICTION,
            existing_neuron_id="missing-1",
            existing_content="We use PostgreSQL",
            new_content="We use MySQL",
            confidence=0.8,
        )

        resolutions = await resolve_conflicts(
            [conflict],
            new_neuron_id="new-1",
            storage=storage,
        )
        assert len(resolutions) == 0
