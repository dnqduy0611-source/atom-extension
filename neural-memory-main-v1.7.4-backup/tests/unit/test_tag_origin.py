"""Tests for tag origin tracking in Fiber model."""

from datetime import datetime

from neural_memory.core.fiber import Fiber


class TestTagOriginTracking:
    """Test Fiber tag origin (auto_tags vs agent_tags)."""

    def test_tags_property_returns_union(self) -> None:
        """fiber.tags should return union of auto_tags and agent_tags."""
        fiber = Fiber(
            id="f1",
            neuron_ids={"n1"},
            synapse_ids=set(),
            anchor_neuron_id="n1",
            auto_tags={"python", "api"},
            agent_tags={"backend", "important"},
            created_at=datetime(2026, 1, 1),
        )
        assert fiber.tags == {"python", "api", "backend", "important"}

    def test_tags_property_deduplicates(self) -> None:
        """When same tag in both origins, tags property returns it once."""
        fiber = Fiber(
            id="f1",
            neuron_ids={"n1"},
            synapse_ids=set(),
            anchor_neuron_id="n1",
            auto_tags={"python", "shared"},
            agent_tags={"shared", "custom"},
            created_at=datetime(2026, 1, 1),
        )
        assert fiber.tags == {"python", "shared", "custom"}
        assert len(fiber.tags) == 3

    def test_create_with_legacy_tags_goes_to_agent(self) -> None:
        """Fiber.create(tags=...) should put them in agent_tags for backward compat."""
        fiber = Fiber.create(
            neuron_ids={"n1"},
            synapse_ids=set(),
            anchor_neuron_id="n1",
            tags={"legacy-tag1", "legacy-tag2"},
        )
        assert fiber.agent_tags == {"legacy-tag1", "legacy-tag2"}
        assert fiber.auto_tags == set()
        assert fiber.tags == {"legacy-tag1", "legacy-tag2"}

    def test_create_with_origin_params(self) -> None:
        """Fiber.create(auto_tags=..., agent_tags=...) separates correctly."""
        fiber = Fiber.create(
            neuron_ids={"n1"},
            synapse_ids=set(),
            anchor_neuron_id="n1",
            auto_tags={"auto1", "auto2"},
            agent_tags={"agent1"},
        )
        assert fiber.auto_tags == {"auto1", "auto2"}
        assert fiber.agent_tags == {"agent1"}
        assert fiber.tags == {"auto1", "auto2", "agent1"}

    def test_create_no_tags(self) -> None:
        """Fiber.create() without any tags should have empty sets."""
        fiber = Fiber.create(
            neuron_ids={"n1"},
            synapse_ids=set(),
            anchor_neuron_id="n1",
        )
        assert fiber.auto_tags == set()
        assert fiber.agent_tags == set()
        assert fiber.tags == set()

    def test_add_tags_goes_to_agent_tags(self) -> None:
        """add_tags() should add to agent_tags by default."""
        fiber = Fiber.create(
            neuron_ids={"n1"},
            synapse_ids=set(),
            anchor_neuron_id="n1",
            auto_tags={"auto1"},
        )
        updated = fiber.add_tags("new-tag")
        assert "new-tag" in updated.agent_tags
        assert "new-tag" not in updated.auto_tags
        assert "auto1" in updated.auto_tags
        assert updated.tags == {"auto1", "new-tag"}

    def test_add_auto_tags_goes_to_auto_tags(self) -> None:
        """add_auto_tags() should add to auto_tags."""
        fiber = Fiber.create(
            neuron_ids={"n1"},
            synapse_ids=set(),
            anchor_neuron_id="n1",
            agent_tags={"agent1"},
        )
        updated = fiber.add_auto_tags("auto-new")
        assert "auto-new" in updated.auto_tags
        assert "auto-new" not in updated.agent_tags
        assert "agent1" in updated.agent_tags

    def test_backward_compat_empty_origins(self) -> None:
        """When both origin sets are empty, tags property returns empty set."""
        fiber = Fiber(
            id="f1",
            neuron_ids={"n1"},
            synapse_ids=set(),
            anchor_neuron_id="n1",
            created_at=datetime(2026, 1, 1),
        )
        assert fiber.tags == set()
        assert fiber.auto_tags == set()
        assert fiber.agent_tags == set()

    def test_immutability_add_tags(self) -> None:
        """add_tags() should return new Fiber, not mutate original."""
        original = Fiber.create(
            neuron_ids={"n1"},
            synapse_ids=set(),
            anchor_neuron_id="n1",
            auto_tags={"auto1"},
            agent_tags={"agent1"},
        )
        modified = original.add_tags("new")
        assert "new" not in original.agent_tags
        assert "new" in modified.agent_tags
        assert original.auto_tags == {"auto1"}

    def test_immutability_add_auto_tags(self) -> None:
        """add_auto_tags() should return new Fiber, not mutate original."""
        original = Fiber.create(
            neuron_ids={"n1"},
            synapse_ids=set(),
            anchor_neuron_id="n1",
            auto_tags={"auto1"},
        )
        modified = original.add_auto_tags("auto2")
        assert "auto2" not in original.auto_tags
        assert "auto2" in modified.auto_tags
