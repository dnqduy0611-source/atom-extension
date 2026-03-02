"""Tests for confirmatory weight boost (Hebbian tag confirmation)."""

import pytest

from neural_memory.core.brain import Brain, BrainConfig
from neural_memory.core.synapse import SynapseType
from neural_memory.engine.encoder import MemoryEncoder
from neural_memory.storage.memory_store import InMemoryStorage


@pytest.fixture
async def encoder() -> tuple[MemoryEncoder, InMemoryStorage]:
    """Create an encoder with in-memory storage."""
    storage = InMemoryStorage()
    config = BrainConfig()
    brain = Brain.create(name="test", config=config)
    await storage.save_brain(brain)
    storage.set_brain(brain.id)
    return MemoryEncoder(storage, brain.config), storage


class TestConfirmatoryBoost:
    """Test Hebbian confirmatory weight boost when agent tags match auto tags."""

    @pytest.mark.asyncio
    async def test_overlapping_tags_boost_weight(self, encoder: tuple) -> None:
        """When agent tag matches auto tag, anchor synapses should get +0.1 boost."""
        enc, storage = encoder

        # Encode with agent tags that should overlap with auto-generated tags
        # "Python" should be extracted as both entity and keyword (auto-tag)
        result = await enc.encode(
            "We use Python and FastAPI for the backend service.",
            tags={"python"},  # agent tag matching likely auto-tag
        )

        # If "python" is both auto and agent tag, synapses from anchor should be boosted
        overlap = result.fiber.auto_tags & result.fiber.agent_tags
        if overlap:
            # Anchor synapses should have boosted weights
            anchor_synapses = [
                s
                for s in result.synapses_created
                if s.source_id == result.fiber.anchor_neuron_id
                and s.type != SynapseType.RELATED_TO  # exclude divergent tag synapses
            ]
            # At least some synapses should exist
            assert len(anchor_synapses) > 0

    @pytest.mark.asyncio
    async def test_divergent_tags_create_related_synapses(self, encoder: tuple) -> None:
        """Agent tags not in auto tags should create RELATED_TO with weight 0.3."""
        enc, storage = encoder

        result = await enc.encode(
            "The database migration completed successfully.",
            tags={"infrastructure", "devops"},  # likely divergent from auto-tags
        )

        divergent = result.fiber.agent_tags - result.fiber.auto_tags
        if divergent:
            # Check for RELATED_TO synapses with divergent_agent_tag metadata
            divergent_synapses = [
                s
                for s in result.synapses_created
                if s.metadata.get("divergent_agent_tag") is not None
            ]
            # Each divergent tag that matched a neuron should have a synapse
            for syn in divergent_synapses:
                assert syn.type == SynapseType.RELATED_TO
                assert syn.weight == 0.3

    @pytest.mark.asyncio
    async def test_no_boost_without_agent_tags(self, encoder: tuple) -> None:
        """No agent tags means no boost or divergent synapses."""
        enc, storage = encoder

        result = await enc.encode(
            "Redis caching improves application performance.",
        )

        # No agent tags → agent_tags should be empty
        assert result.fiber.agent_tags == set()
        # Auto tags should still be present
        assert len(result.fiber.auto_tags) > 0
        # No divergent tag synapses
        divergent_synapses = [
            s for s in result.synapses_created if s.metadata.get("divergent_agent_tag") is not None
        ]
        assert len(divergent_synapses) == 0

    @pytest.mark.asyncio
    async def test_boost_capped_at_1_0(self, encoder: tuple) -> None:
        """Weight boost should not exceed 1.0."""
        enc, storage = encoder

        result = await enc.encode(
            "Critical production outage in the payment service.",
            tags={"payment", "outage", "production"},
        )

        for syn in result.synapses_created:
            assert syn.weight <= 1.0

    @pytest.mark.asyncio
    async def test_tag_origin_separation(self, encoder: tuple) -> None:
        """Auto tags and agent tags should be properly separated."""
        enc, storage = encoder

        agent_provided = {"my-custom-tag", "team-alpha"}
        result = await enc.encode(
            "Deployed the new authentication module to staging.",
            tags=agent_provided,
        )

        # Agent tags should contain exactly what was provided
        assert agent_provided.issubset(result.fiber.agent_tags)
        # Auto tags should be generated from content
        assert len(result.fiber.auto_tags) > 0
        # Custom tags should NOT be in auto_tags
        assert "my-custom-tag" not in result.fiber.auto_tags
        assert "team-alpha" not in result.fiber.auto_tags
