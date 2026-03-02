"""Tests for the Skill Integration Engine.

Validates:
- Tier 2 skill creation from two Tier 1 skills
- Validation: ownership, different principles, template existence
- ID generation (deterministic, order-independent)
- Archetype blending
- Limitation inheritance
- can_integrate checker
- get_integration_options
"""

import pytest

from app.engine.skill_integration import (
    INSTABILITY_COSTS,
    IntegrationError,
    IntegrationResult,
    _blend_archetype,
    _combine_weaknesses,
    _generate_tier2_id,
    _inherit_heavier_limitation,
    can_integrate,
    get_integration_options,
    integrate_skills,
)
from app.models.skill_catalog import (
    SKILL_CATALOG,
    NarrativeSkin,
    PlayerSkill,
    SkillArchetype,
    SkillSkeleton,
)


# ════════════════════════════════════════════
# Fixtures
# ════════════════════════════════════════════

@pytest.fixture
def owned_two_different() -> list[PlayerSkill]:
    """Player owns 2 skills from different principles."""
    return [
        PlayerSkill(skeleton_id="order_off_01"),
        PlayerSkill(skeleton_id="entropy_off_01"),
    ]


@pytest.fixture
def owned_same_principle() -> list[PlayerSkill]:
    """Player owns 2 skills from same principle."""
    return [
        PlayerSkill(skeleton_id="order_off_01"),
        PlayerSkill(skeleton_id="order_off_02"),
    ]


@pytest.fixture
def owned_many() -> list[PlayerSkill]:
    """Player with diverse skills."""
    return [
        PlayerSkill(skeleton_id="order_off_01"),
        PlayerSkill(skeleton_id="entropy_off_01"),
        PlayerSkill(skeleton_id="matter_def_01"),
        PlayerSkill(skeleton_id="flux_off_01"),
    ]


# ════════════════════════════════════════════
# integrate_skills — happy path
# ════════════════════════════════════════════

class TestIntegrateSkills:

    def test_opposing_pair_creates_tier2(self, owned_two_different):
        """Order + Entropy = opposing pair → Tier 2 with high instability."""
        result = integrate_skills(
            "order_off_01", "entropy_off_01", owned_two_different,
        )
        assert isinstance(result, IntegrationResult)
        assert result.tier2_skeleton.tier == 2
        assert result.tier2_skeleton.secondary_principle != ""
        assert result.instability_added == INSTABILITY_COSTS["high"]
        assert result.power_multiplier == 1.4
        assert len(result.consumed_ids) == 2

    def test_adjacent_pair_low_instability(self):
        """Order + Matter = adjacent pair → low instability."""
        owned = [
            PlayerSkill(skeleton_id="order_off_01"),
            PlayerSkill(skeleton_id="matter_off_01"),
        ]
        result = integrate_skills("order_off_01", "matter_off_01", owned)
        assert result.instability_added == INSTABILITY_COSTS["low"]
        assert result.power_multiplier == 1.1

    def test_cross_cluster_pair_moderate(self):
        """Order + Flux = cross-cluster → moderate instability."""
        owned = [
            PlayerSkill(skeleton_id="order_off_01"),
            PlayerSkill(skeleton_id="flux_off_01"),
        ]
        result = integrate_skills("order_off_01", "flux_off_01", owned)
        assert result.instability_added == INSTABILITY_COSTS["moderate"]
        assert result.power_multiplier == 1.2

    def test_tier2_mechanic_combines_both(self, owned_two_different):
        result = integrate_skills(
            "order_off_01", "entropy_off_01", owned_two_different,
        )
        skel_a = SKILL_CATALOG["order_off_01"]
        skel_b = SKILL_CATALOG["entropy_off_01"]
        assert skel_a.mechanic in result.tier2_skeleton.mechanic
        assert skel_b.mechanic in result.tier2_skeleton.mechanic

    def test_tier2_has_tags(self, owned_two_different):
        result = integrate_skills(
            "order_off_01", "entropy_off_01", owned_two_different,
        )
        tags = result.tier2_skeleton.tags
        assert any("integrated:" in t for t in tags)
        assert any("blend:" in t for t in tags)

    def test_custom_narrative(self, owned_two_different):
        skin = NarrativeSkin(
            display_name="Paradox Strike",
            description="Order and chaos collide.",
            discovery_line="The contradiction made you stronger.",
        )
        result = integrate_skills(
            "order_off_01", "entropy_off_01", owned_two_different,
            narrative=skin,
        )
        assert result.tier2_player_skill.narrative.display_name == "Paradox Strike"


# ════════════════════════════════════════════
# integrate_skills — error cases
# ════════════════════════════════════════════

class TestIntegrateErrors:

    def test_not_owned(self):
        owned = [PlayerSkill(skeleton_id="order_off_01")]
        with pytest.raises(IntegrationError, match="does not own"):
            integrate_skills("order_off_01", "entropy_off_01", owned)

    def test_same_skill(self, owned_two_different):
        with pytest.raises(IntegrationError, match="itself"):
            integrate_skills("order_off_01", "order_off_01", owned_two_different)

    def test_same_principle(self, owned_same_principle):
        with pytest.raises(IntegrationError, match="different principles"):
            integrate_skills("order_off_01", "order_off_02", owned_same_principle)

    def test_unknown_skeleton(self):
        owned = [
            PlayerSkill(skeleton_id="order_off_01"),
            PlayerSkill(skeleton_id="nonexistent_99"),
        ]
        with pytest.raises(IntegrationError, match="not found"):
            integrate_skills("order_off_01", "nonexistent_99", owned)


# ════════════════════════════════════════════
# can_integrate
# ════════════════════════════════════════════

class TestCanIntegrate:

    def test_valid_pair(self):
        ok, msg = can_integrate(
            "order_off_01", "entropy_off_01",
            ["order_off_01", "entropy_off_01"],
        )
        assert ok is True
        assert msg == "OK"

    def test_not_owned(self):
        ok, msg = can_integrate("order_off_01", "entropy_off_01", ["order_off_01"])
        assert ok is False

    def test_same_skill(self):
        ok, msg = can_integrate("order_off_01", "order_off_01", ["order_off_01"])
        assert ok is False

    def test_same_principle(self):
        ok, msg = can_integrate(
            "order_off_01", "order_off_02",
            ["order_off_01", "order_off_02"],
        )
        assert ok is False
        assert "principle" in msg.lower()


# ════════════════════════════════════════════
# get_integration_options
# ════════════════════════════════════════════

class TestGetIntegrationOptions:

    def test_returns_valid_pairs(self):
        options = get_integration_options(["order_off_01", "entropy_off_01"])
        assert len(options) == 1
        assert options[0][2].archetype_blend == "paradox"

    def test_same_principle_excluded(self):
        options = get_integration_options(["order_off_01", "order_off_02"])
        assert len(options) == 0

    def test_multiple_pairs(self, owned_many):
        ids = [ps.skeleton_id for ps in owned_many]
        options = get_integration_options(ids)
        # 4 skills from 4 different principles → C(4,2) = 6 pairs,
        # all should have templates
        assert len(options) == 6


# ════════════════════════════════════════════
# ID Generation
# ════════════════════════════════════════════

class TestIDGeneration:

    def test_deterministic(self):
        id1 = _generate_tier2_id("order_off_01", "entropy_off_01")
        id2 = _generate_tier2_id("order_off_01", "entropy_off_01")
        assert id1 == id2

    def test_order_independent(self):
        id1 = _generate_tier2_id("order_off_01", "entropy_off_01")
        id2 = _generate_tier2_id("entropy_off_01", "order_off_01")
        assert id1 == id2

    def test_starts_with_t2(self):
        tier2_id = _generate_tier2_id("order_off_01", "matter_off_01")
        assert tier2_id.startswith("t2_")


# ════════════════════════════════════════════
# Internal Helpers
# ════════════════════════════════════════════

class TestHelpers:

    def test_blend_archetype_same(self):
        assert _blend_archetype(SkillArchetype.OFFENSIVE, SkillArchetype.OFFENSIVE) == SkillArchetype.OFFENSIVE

    def test_blend_archetype_offensive_wins(self):
        assert _blend_archetype(SkillArchetype.DEFENSIVE, SkillArchetype.OFFENSIVE) == SkillArchetype.OFFENSIVE

    def test_blend_archetype_defensive_over_support(self):
        assert _blend_archetype(SkillArchetype.SUPPORT, SkillArchetype.DEFENSIVE) == SkillArchetype.DEFENSIVE

    def test_inherit_heavier_limitation(self):
        short = SkillSkeleton(
            id="a", catalog_name="a", principle="order",
            archetype=SkillArchetype.OFFENSIVE, damage_type="structural",
            delivery="melee", mechanic="hit", limitation="short",
            weakness="",
        )
        long = SkillSkeleton(
            id="b", catalog_name="b", principle="entropy",
            archetype=SkillArchetype.OFFENSIVE, damage_type="stability",
            delivery="melee", mechanic="hit",
            limitation="much longer limitation text here",
            weakness="",
        )
        assert _inherit_heavier_limitation(short, long) == long.limitation

    def test_combine_weaknesses(self):
        a = SkillSkeleton(
            id="a", catalog_name="a", principle="order",
            archetype=SkillArchetype.OFFENSIVE, damage_type="structural",
            delivery="melee", mechanic="hit", limitation="x",
            weakness="weak to fire",
        )
        b = SkillSkeleton(
            id="b", catalog_name="b", principle="entropy",
            archetype=SkillArchetype.OFFENSIVE, damage_type="stability",
            delivery="melee", mechanic="hit", limitation="x",
            weakness="weak to ice",
        )
        result = _combine_weaknesses(a, b)
        assert "fire" in result
        assert "ice" in result

    def test_combine_weaknesses_empty(self):
        a = SkillSkeleton(
            id="a", catalog_name="a", principle="order",
            archetype=SkillArchetype.OFFENSIVE, damage_type="structural",
            delivery="melee", mechanic="hit", limitation="x", weakness="",
        )
        b = SkillSkeleton(
            id="b", catalog_name="b", principle="entropy",
            archetype=SkillArchetype.OFFENSIVE, damage_type="stability",
            delivery="melee", mechanic="hit", limitation="x", weakness="",
        )
        result = _combine_weaknesses(a, b)
        assert "Unstable" in result
