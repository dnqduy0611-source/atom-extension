"""Tests for the Skill Discovery & Reward Service.

Validates:
- plan_skill_reward decision logic
- Discovery accept/reject flow
- Equip/unequip mechanics
- Integration slot recovery
- Under-represented principle finding
"""

import pytest

from app.engine.skill_discovery import (
    EARLY_GAME_REWARD_INTERVAL,
    MAX_NORMAL_SLOTS,
    SkillDiscovery,
    SkillDiscoveryAction,
    SkillRewardPlan,
    SkillSource,
    accept_skill,
    create_discovery,
    equip_skill,
    integration_slot_recovery,
    plan_skill_reward,
    reject_skill,
    unequip_skill,
    _find_underrepresented_principle,
    _weighted_random_principle,
)
from app.models.skill_catalog import (
    NarrativeSkin,
    PlayerSkill,
    SKILL_CATALOG,
)


# ════════════════════════════════════════════
# Fixtures
# ════════════════════════════════════════════

@pytest.fixture
def base_resonance() -> dict[str, float]:
    """Typical player resonance after quiz."""
    return {
        "entropy": 0.6,
        "flux": 0.3,
        "void": 0.1,
        "order": 0.0,
        "matter": 0.0,
        "energy": 0.0,
    }


@pytest.fixture
def empty_owned() -> list[str]:
    return []


@pytest.fixture
def some_owned_skills() -> list[PlayerSkill]:
    """Player with 3 owned skills."""
    return [
        PlayerSkill(skeleton_id="entropy_off_01"),
        PlayerSkill(skeleton_id="entropy_def_01"),
        PlayerSkill(skeleton_id="flux_off_01"),
    ]


# ════════════════════════════════════════════
# plan_skill_reward
# ════════════════════════════════════════════

class TestPlanSkillReward:

    def test_no_reward_too_soon(self, base_resonance, empty_owned):
        """No reward if chapters_since_last_skill < minimum."""
        result = plan_skill_reward(
            owned_skill_ids=empty_owned,
            resonance=base_resonance,
            total_chapters=5,
            chapters_since_last_skill=0,  # Just got one
            current_rank=1,
            current_floor=1,
        )
        assert result.should_reward is False

    def test_reward_after_interval_early_game(self, base_resonance, empty_owned):
        """Should reward after EARLY_GAME_REWARD_INTERVAL at Rank 1."""
        result = plan_skill_reward(
            owned_skill_ids=empty_owned,
            resonance=base_resonance,
            total_chapters=5,
            chapters_since_last_skill=EARLY_GAME_REWARD_INTERVAL,
            current_rank=1,
            current_floor=1,
        )
        assert result.should_reward is True
        assert len(result.candidate_ids) > 0

    def test_crng_breakthrough_priority(self, base_resonance, empty_owned):
        """CRNG breakthrough should trigger reward even if interval not met."""
        result = plan_skill_reward(
            owned_skill_ids=empty_owned,
            resonance=base_resonance,
            total_chapters=5,
            chapters_since_last_skill=2,
            current_rank=1,
            current_floor=1,
            has_crng_breakthrough=True,
        )
        assert result.should_reward is True
        assert result.source == SkillSource.CRNG_BREAKTHROUGH

    def test_training_awakening_after_combat(self, base_resonance, empty_owned):
        """Training awakening when 3+ combats since rest."""
        result = plan_skill_reward(
            owned_skill_ids=empty_owned,
            resonance=base_resonance,
            total_chapters=5,
            chapters_since_last_skill=2,
            current_rank=1,
            current_floor=1,
            combat_count_since_rest=3,
        )
        assert result.should_reward is True
        assert result.source == SkillSource.TRAINING_AWAKENING

    def test_candidate_excludes_owned(self, base_resonance):
        """Candidates should not include already-owned skills."""
        owned = ["entropy_off_01", "entropy_off_02"]
        result = plan_skill_reward(
            owned_skill_ids=owned,
            resonance=base_resonance,
            total_chapters=5,
            chapters_since_last_skill=3,
            current_rank=1,
            current_floor=1,
        )
        if result.should_reward:
            for cid in result.candidate_ids:
                assert cid not in owned


# ════════════════════════════════════════════
# create_discovery
# ════════════════════════════════════════════

class TestCreateDiscovery:

    def test_valid_skill(self):
        disc = create_discovery(
            "matter_off_01",
            SkillSource.FLOOR_BOSS,
            narrative_context="Boss dropped something",
            chapter=3,
        )
        assert disc.skeleton_id == "matter_off_01"
        assert disc.skeleton.catalog_name == "Iron Fist"
        assert disc.source == SkillSource.FLOOR_BOSS

    def test_invalid_skill(self):
        with pytest.raises(ValueError, match="Unknown skill ID"):
            create_discovery("nonexistent_99", SkillSource.FLOOR_CLEAR)


# ════════════════════════════════════════════
# accept_skill / reject_skill
# ════════════════════════════════════════════

class TestAcceptReject:

    def test_accept_skill_success(self):
        disc = create_discovery("order_off_01", SkillSource.NPC_ENCOUNTER)
        ps = accept_skill(disc, owned_skills=[])
        assert ps.skeleton_id == "order_off_01"
        assert ps.usage_count == 0

    def test_accept_skill_with_narrative(self):
        disc = create_discovery("matter_def_01", SkillSource.TOWER_EXPLORATION)
        skin = NarrativeSkin(
            display_name="Oath Wall",
            description="Born from a promise.",
            discovery_line="It appeared the moment you thought of her.",
        )
        ps = accept_skill(disc, owned_skills=[], narrative=skin)
        assert ps.narrative.display_name == "Oath Wall"

    def test_accept_duplicate_raises(self):
        disc = create_discovery("order_off_01", SkillSource.NPC_ENCOUNTER)
        existing = [PlayerSkill(skeleton_id="order_off_01")]
        with pytest.raises(ValueError, match="already owns"):
            accept_skill(disc, owned_skills=existing)

    def test_reject_skill_no_error(self):
        disc = create_discovery("void_off_01", SkillSource.LORE_SECRET)
        reject_skill(disc)  # Should not raise


# ════════════════════════════════════════════
# equip / unequip
# ════════════════════════════════════════════

class TestEquipUnequip:

    def test_equip_success(self):
        owned = [PlayerSkill(skeleton_id="order_off_01")]
        result = equip_skill("order_off_01", owned, [])
        assert "order_off_01" in result

    def test_equip_not_owned_raises(self):
        with pytest.raises(ValueError, match="does not own"):
            equip_skill("order_off_01", [], [])

    def test_equip_already_equipped_raises(self):
        owned = [PlayerSkill(skeleton_id="order_off_01")]
        with pytest.raises(ValueError, match="already equipped"):
            equip_skill("order_off_01", owned, ["order_off_01"])

    def test_equip_slots_full_raises(self):
        owned = [PlayerSkill(skeleton_id=f"order_off_0{i}") for i in range(1, 5)]
        owned.append(PlayerSkill(skeleton_id="entropy_off_01"))
        equipped = [f"order_off_0{i}" for i in range(1, 5)]
        assert len(equipped) == MAX_NORMAL_SLOTS
        with pytest.raises(ValueError, match="slots are full"):
            equip_skill("entropy_off_01", owned, equipped)

    def test_unequip_success(self):
        result = unequip_skill("order_off_01", ["order_off_01", "matter_off_01"])
        assert "order_off_01" not in result
        assert "matter_off_01" in result

    def test_unequip_not_equipped_raises(self):
        with pytest.raises(ValueError, match="not equipped"):
            unequip_skill("order_off_01", [])


# ════════════════════════════════════════════
# Integration Slot Recovery
# ════════════════════════════════════════════

class TestIntegrationSlotRecovery:

    def test_recovery_frees_slot(self):
        equipped = ["order_off_01", "entropy_off_01", "matter_off_01", "flux_off_01"]
        result = integration_slot_recovery(
            consumed_ids=["order_off_01", "entropy_off_01"],
            new_tier2_id="t2_order_entropy_001",
            equipped_ids=equipped,
        )
        assert "order_off_01" not in result
        assert "entropy_off_01" not in result
        assert "t2_order_entropy_001" in result
        # 4 - 2 consumed + 1 new = 3 → 1 slot free
        assert len(result) == 3


# ════════════════════════════════════════════
# Helper Functions
# ════════════════════════════════════════════

class TestHelpers:

    def test_underrepresented_principle_prefers_high_resonance_low_count(self):
        """Should pick principle with high resonance but few owned skills."""
        owned_ids = [
            "entropy_off_01", "entropy_off_02", "entropy_def_01",  # 3 entropy
        ]
        resonance = {"entropy": 0.6, "flux": 0.3, "void": 0.1}
        result = _find_underrepresented_principle(owned_ids, resonance)
        # flux has 0 owned + 0.3 resonance → should be picked over entropy (3 owned)
        assert result == "flux"

    def test_underrepresented_empty_owned(self):
        """With no owned skills, should pick highest resonance principle."""
        resonance = {"matter": 0.7, "energy": 0.2, "void": 0.1}
        result = _find_underrepresented_principle([], resonance)
        assert result == "matter"

    def test_weighted_random_principle_returns_valid(self):
        resonance = {"order": 0.5, "entropy": 0.3, "matter": 0.2}
        result = _weighted_random_principle(resonance)
        assert result in resonance

    def test_weighted_random_zero_resonance(self):
        """With zero resonance, pick randomly from PRINCIPLES."""
        result = _weighted_random_principle({})
        assert result in ["order", "entropy", "matter", "flux", "energy", "void"]


# ════════════════════════════════════════════
# Player Model Integration
# ════════════════════════════════════════════

class TestPlayerModel:

    def test_owned_skill_ids_property(self):
        from app.models.player import PlayerState
        p = PlayerState(
            owned_skills=[
                {"skeleton_id": "order_off_01"},
                {"skeleton_id": "matter_def_01"},
            ],
        )
        assert p.owned_skill_ids == ["order_off_01", "matter_def_01"]

    def test_empty_owned_skill_ids(self):
        from app.models.player import PlayerState
        p = PlayerState()
        assert p.owned_skill_ids == []

    def test_equipped_skill_ids_property(self):
        from app.models.player import PlayerState
        p = PlayerState(
            equipped_skills=[
                {"skeleton_id": "order_off_01"},
                {"skeleton_id": "entropy_off_01"},
            ],
        )
        assert p.equipped_skill_ids == ["order_off_01", "entropy_off_01"]


# ════════════════════════════════════════════
# Beat Model
# ════════════════════════════════════════════

class TestBeatModel:

    def test_beat_skill_reward_default_none(self):
        from app.models.pipeline import Beat
        b = Beat()
        assert b.skill_reward is None

    def test_beat_with_skill_reward(self):
        from app.models.pipeline import Beat
        b = Beat(
            scene_type="discovery",
            skill_reward={"should_reward": True, "candidate_ids": ["order_off_01"]},
        )
        assert b.skill_reward is not None
        assert b.skill_reward["should_reward"] is True
