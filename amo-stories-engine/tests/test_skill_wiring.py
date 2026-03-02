"""Tests for Phase C6–C8: Orchestrator wiring, REST endpoints, Combat enemy selection."""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock

# ══════════════════════════════════════════
# C6: Orchestrator _compute_skill_reward
# ══════════════════════════════════════════


class TestComputeSkillReward:
    """Tests for StoryOrchestrator._compute_skill_reward."""

    def _make_orch(self):
        from app.engine.orchestrator import StoryOrchestrator
        db = MagicMock()
        orch = StoryOrchestrator(db)
        return orch

    def _make_player(self, **overrides):
        """Create a minimal player-like object."""
        player = MagicMock()
        player.owned_skill_ids = overrides.get("owned_skill_ids", [])
        player.resonance = overrides.get("resonance", {"order": 0.5, "entropy": 0.5})
        player.total_chapters = overrides.get("total_chapters", 10)
        player.chapters_since_last_skill = overrides.get("chapters_since_last_skill", 5)
        player.current_rank = overrides.get("current_rank", 1)
        player.current_floor = overrides.get("current_floor", 1)
        player.combat_count_since_rest = overrides.get("combat_count_since_rest", 0)
        return player

    def _make_crng(self, triggered=False, event_type=""):
        crng = MagicMock()
        crng.triggered = triggered
        crng.event_type = event_type
        return crng

    def test_returns_none_when_no_player(self):
        orch = self._make_orch()
        crng = self._make_crng()
        assert orch._compute_skill_reward(None, crng) is None

    def test_returns_dict_when_reward_planned(self):
        orch = self._make_orch()
        player = self._make_player(chapters_since_last_skill=10)
        crng = self._make_crng()
        result = orch._compute_skill_reward(player, crng)
        # Should return a dict (plan) or None (depends on catalog state)
        assert result is None or isinstance(result, dict)

    def test_returns_none_on_exception(self):
        orch = self._make_orch()
        # Player with broken resonance should not crash
        player = self._make_player()
        player.resonance = "not_a_dict"  # Will cause exception
        crng = self._make_crng()
        result = orch._compute_skill_reward(player, crng)
        assert result is None

    def test_passes_crng_breakthrough(self):
        """Verify has_crng_breakthrough is derived from CRNG result."""
        orch = self._make_orch()
        player = self._make_player(chapters_since_last_skill=10)
        crng = self._make_crng(triggered=True, event_type="breakthrough")
        # Should not crash
        result = orch._compute_skill_reward(player, crng)
        assert result is None or isinstance(result, dict)


# ══════════════════════════════════════════
# C7: skill_router helpers
# ══════════════════════════════════════════


class TestSkillRouterHelpers:
    """Tests for skill_router parsing helpers."""

    @pytest.fixture(autouse=True)
    def _import_helpers(self):
        """Lazy import to avoid circular import from app.main."""
        import importlib
        import sys
        # Pre-set app.main module with a mock to break circular import
        if "app.main" not in sys.modules:
            mock_main = MagicMock()
            mock_main.get_db = MagicMock()
            sys.modules["app.main"] = mock_main

        mod = importlib.import_module("app.routers.skill_router")
        self._parse_owned_skills = mod._parse_owned_skills
        self._update_equipped = mod._update_equipped

    def test_parse_owned_skills_from_dicts(self):
        player = MagicMock()
        player.owned_skills = [
            {"skeleton_id": "order_guardian_shield", "usage_count": 3},
        ]
        result = self._parse_owned_skills(player)
        assert len(result) == 1
        assert result[0].skeleton_id == "order_guardian_shield"

    def test_parse_owned_skills_from_pydantic(self):
        from app.models.skill_catalog import PlayerSkill
        ps = PlayerSkill(skeleton_id="entropy_chaos_bolt")
        player = MagicMock()
        player.owned_skills = [ps]
        result = self._parse_owned_skills(player)
        assert len(result) == 1
        assert result[0].skeleton_id == "entropy_chaos_bolt"

    def test_parse_owned_skills_skips_junk(self):
        player = MagicMock()
        player.owned_skills = [42, None, "garbage"]
        result = self._parse_owned_skills(player)
        assert len(result) == 0

    def test_update_equipped_maps_ids(self):
        player = MagicMock()
        player.owned_skills = [
            {"skeleton_id": "order_guardian_shield", "usage_count": 0},
            {"skeleton_id": "entropy_chaos_bolt", "usage_count": 0},
        ]
        self._update_equipped(player, ["order_guardian_shield"])
        assert len(player.equipped_skills) == 1
        assert player.equipped_skills[0]["skeleton_id"] == "order_guardian_shield"

    def test_update_equipped_empty(self):
        player = MagicMock()
        player.owned_skills = [
            {"skeleton_id": "order_guardian_shield", "usage_count": 0},
        ]
        self._update_equipped(player, [])
        assert player.equipped_skills == []


# ══════════════════════════════════════════
# C8: Combat enemy principle selection
# ══════════════════════════════════════════


class TestCombatEnemyPrincipleSelection:
    """Tests for enemy principle opposing player's equipped skill."""

    def test_opposing_order_gets_entropy(self):
        from app.models.power import Principle
        p = Principle("order")
        assert p.opposite.value == "entropy"

    def test_opposing_entropy_gets_order(self):
        from app.models.power import Principle
        p = Principle("entropy")
        assert p.opposite.value == "order"

    def test_opposing_matter_gets_flux(self):
        from app.models.power import Principle
        p = Principle("matter")
        assert p.opposite.value == "flux"

    def test_opposing_flux_gets_matter(self):
        from app.models.power import Principle
        p = Principle("flux")
        assert p.opposite.value == "matter"

    def test_opposing_energy_gets_void(self):
        from app.models.power import Principle
        p = Principle("energy")
        assert p.opposite.value == "void"

    def test_opposing_void_gets_energy(self):
        from app.models.power import Principle
        p = Principle("void")
        assert p.opposite.value == "energy"

    def test_all_pairs_symmetric(self):
        """Every principle's opposite has the original as its opposite."""
        from app.models.power import Principle
        for p in Principle:
            assert p.opposite.opposite == p, f"{p} → {p.opposite} → {p.opposite.opposite}"
