"""Phase 1 tests — Unique Skill System V2 Model Foundation.

Tests backward compatibility, new V2 fields, growth state,
and PrincipleResonance (Sovereign prep).
"""

import pytest
from datetime import datetime

from app.models.player import (
    SubSkill,
    UniqueSkill,
    PlayerState,
    SkillCategory,
)
from app.models.unique_skill_growth import (
    GrowthType,
    ScarType,
    WeaknessType,
    TraumaEvent,
    AspectOption,
    UltimateSkillForm,
    UniqueSkillGrowthState,
    PrincipleResonance,
)


# ──────────────────────────────────────────────
# SubSkill
# ──────────────────────────────────────────────

class TestSubSkill:
    """SubSkill model tests."""

    def test_create_default(self):
        ss = SubSkill()
        assert ss.name == ""
        assert ss.type == ""
        assert ss.mechanic == ""

    def test_create_domain_passive(self):
        ss = SubSkill(
            name="Thân Thép",
            type="passive",
            mechanic="Immune Normal defensive skills cùng category, +5% phys resist",
            cost="",
            trigger="",
            unlocked_at="seed",
        )
        assert ss.name == "Thân Thép"
        assert ss.type == "passive"
        assert ss.unlocked_at == "seed"

    def test_create_active(self):
        ss = SubSkill(
            name="Nộ Cương",
            type="active",
            mechanic="Voluntary full-body harden 3s",
            cost="25 stability",
            unlocked_at="aspect",
        )
        assert ss.type == "active"
        assert ss.cost == "25 stability"

    def test_create_reactive(self):
        ss = SubSkill(
            name="Phản Xạ Thép",
            type="reactive",
            mechanic="Reflect 20% damage on successful harden",
            trigger="When hardening succeeds",
            unlocked_at="bloom",
        )
        assert ss.type == "reactive"
        assert ss.trigger == "When hardening succeeds"


# ──────────────────────────────────────────────
# UniqueSkill V2
# ──────────────────────────────────────────────

class TestUniqueSkillV2:
    """UniqueSkill V2 field tests."""

    def test_v2_fields_default_empty(self):
        """New V2 fields default to empty — backward compatible."""
        skill = UniqueSkill(name="Test Skill")
        assert skill.sub_skills == []
        assert skill.domain_category == ""
        assert skill.domain_passive_name == ""
        assert skill.domain_passive_mechanic == ""
        assert skill.weakness_type == ""
        assert skill.axis_blind_spot == ""
        assert skill.unique_clause == ""
        assert skill.current_stage == "seed"

    def test_v2_full_creation(self):
        """Create a full V2 skill with all fields."""
        skill = UniqueSkill(
            name="Thệ Ước Thép",
            description="Cứng hóa phần cơ thể đang bị va chạm",
            category="manifestation",
            trait_tags=["oath", "shadow"],
            mechanic="Reactive hardening — 1 vùng, instant",
            weakness="Mất xúc giác 30 giây sau cứng hóa",
            weakness_type="sensory_tax",
            axis_blind_spot="Chỉ tác động trực tiếp — không buff/shield từ xa cho đồng đội",
            unique_clause="Stability < 30% → skill MẠNH hơn",
            domain_category="manifestation",
            domain_passive_name="Thân Thép",
            domain_passive_mechanic="Immune Normal defensive cùng category",
            sub_skills=[
                SubSkill(
                    name="Thân Thép",
                    type="passive",
                    mechanic="Immune Normal defensive, +5% resist",
                    unlocked_at="seed",
                ),
            ],
            current_stage="seed",
        )
        assert skill.name == "Thệ Ước Thép"
        assert skill.weakness_type == "sensory_tax"
        assert len(skill.sub_skills) == 1
        assert skill.sub_skills[0].name == "Thân Thép"
        assert skill.current_stage == "seed"

    def test_v1_json_backward_compat(self):
        """V1 JSON (no V2 fields) still deserializes correctly."""
        v1_data = {
            "name": "Legacy Skill",
            "description": "A V1 skill",
            "category": "perception",
            "mechanic": "See truth",
            "weakness": "Gets headaches",
            "trait_tags": ["mind"],
        }
        skill = UniqueSkill(**v1_data)
        assert skill.name == "Legacy Skill"
        # V2 fields default gracefully
        assert skill.sub_skills == []
        assert skill.weakness_type == ""
        assert skill.current_stage == "seed"
        assert skill.unique_clause == ""

    def test_v1_fields_preserved(self):
        """All V1 fields still exist and work."""
        skill = UniqueSkill(
            name="Test",
            resilience=85.0,
            instability=15.0,
            is_revealed=True,
            soul_resonance="This skill is yours",
            evolution_hint="Will grow into perception mastery",
            uniqueness_score=0.95,
            forge_timestamp=datetime(2026, 1, 1),
        )
        assert skill.resilience == 85.0
        assert skill.instability == 15.0
        assert skill.is_revealed is True
        assert skill.evolution_hint == "Will grow into perception mastery"


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class TestEnums:
    """Growth system enum tests."""

    def test_growth_types(self):
        assert GrowthType.BASE == "base"
        assert GrowthType.ECHO == "echo"
        assert GrowthType.SCAR == "scar"

    def test_scar_types(self):
        assert ScarType.DEFENSIVE == "defensive"
        assert ScarType.COUNTER == "counter"
        assert ScarType.WARNING == "warning"

    def test_weakness_taxonomy_has_7_types(self):
        assert len(WeaknessType) == 7

    def test_weakness_type_values(self):
        expected = {
            "soul_echo", "principle_bleed", "resonance_dependency",
            "target_paradox", "sensory_tax", "environment_lock",
            "escalation_curse",
        }
        actual = {wt.value for wt in WeaknessType}
        assert actual == expected


# ──────────────────────────────────────────────
# UniqueSkillGrowthState
# ──────────────────────────────────────────────

class TestGrowthState:
    """Growth state tracking tests."""

    def test_default_state(self):
        state = UniqueSkillGrowthState()
        assert state.current_stage == "seed"
        assert state.active_growth == GrowthType.BASE
        assert state.bloom_completed is False
        assert state.aspect_forged is False
        assert state.ultimate_forged is False
        assert state.combat_bonus == 0.0

    def test_echo_tracking(self):
        state = UniqueSkillGrowthState(
            echo_coherence_streak=10,
            bloom_path="echo",
            bloom_completed=True,
            current_stage="bloom",
        )
        assert state.echo_coherence_streak == 10
        assert state.bloom_path == "echo"
        assert state.bloom_completed is True

    def test_scar_tracking(self):
        trauma = TraumaEvent(
            chapter=5,
            description="Nearly killed by boss",
            severity="near_death",
        )
        state = UniqueSkillGrowthState(
            scar_trauma_count=3,
            scar_adapted=True,
            scar_type=ScarType.DEFENSIVE,
            trauma_log=[trauma],
        )
        assert state.scar_trauma_count == 3
        assert state.scar_type == ScarType.DEFENSIVE
        assert len(state.trauma_log) == 1
        assert state.trauma_log[0].severity == "near_death"

    def test_aspect_options(self):
        opt = AspectOption(
            name="Nộ Cương",
            description="Offensive hardening",
            strength="Burst damage",
            trade_off="Lower defense",
        )
        state = UniqueSkillGrowthState(
            aspect_options=[opt],
            aspect_chosen="Nộ Cương",
            aspect_forged=True,
            current_stage="aspect",
        )
        assert len(state.aspect_options) == 1
        assert state.aspect_chosen == "Nộ Cương"
        assert state.current_stage == "aspect"

    def test_ultimate_form(self):
        ult = UltimateSkillForm(
            name="Thiết Thệ Bất Hoại — Chúa Tể Kim Cương",
            title="Chúa Tể Kim Cương",
            absorbed_skill_name="Matter Shield",
            ultimate_ability_name="Thiết Thệ Tuyệt Đối",
            ultimate_ability_description="Reality hardens in 10m radius",
        )
        state = UniqueSkillGrowthState(
            ultimate_forged=True,
            ultimate_form=ult,
            current_stage="ultimate",
            naming_event_completed=True,
        )
        assert state.ultimate_form.title == "Chúa Tể Kim Cương"
        assert state.ultimate_form.absorbed_skill_name == "Matter Shield"
        assert state.naming_event_completed is True

    def test_stage_progression(self):
        """Stages are just strings — engine enforces order."""
        for stage in ["seed", "bloom", "aspect", "ultimate"]:
            state = UniqueSkillGrowthState(current_stage=stage)
            assert state.current_stage == stage


# ──────────────────────────────────────────────
# PrincipleResonance
# ──────────────────────────────────────────────

class TestPrincipleResonance:
    """Principle Resonance (Sovereign prep) tests."""

    def test_default_all_zero(self):
        res = PrincipleResonance()
        assert res.order == 0.0
        assert res.entropy == 0.0
        assert res.is_proto_sovereign is False
        assert res.dominant_principle == ""

    def test_proto_sovereign_detected(self):
        res = PrincipleResonance(
            order=0.85,
            entropy=0.1,
            matter=0.05,
            flux=0.0,
            energy=0.0,
            void=0.0,
            is_proto_sovereign=True,
            dominant_principle="order",
        )
        assert res.is_proto_sovereign is True
        assert res.dominant_principle == "order"
        assert res.order >= 0.8

    def test_not_proto_sovereign(self):
        res = PrincipleResonance(
            order=0.4,
            entropy=0.35,
            matter=0.25,
            is_proto_sovereign=False,
        )
        assert res.is_proto_sovereign is False
        assert max(res.order, res.entropy, res.matter) < 0.8

    def test_void_capped_season1(self):
        """Void should be capped ≤ 0.3 in Season 1-2."""
        res = PrincipleResonance(void=0.3)
        assert res.void <= 0.3


# ──────────────────────────────────────────────
# PlayerState Integration
# ──────────────────────────────────────────────

class TestPlayerStateV2:
    """PlayerState with V2 fields integration."""

    def test_player_state_has_growth(self):
        state = PlayerState(name="Test Player")
        assert state.unique_skill_growth is None
        assert state.principle_resonance is None

    def test_player_state_with_growth(self):
        growth = UniqueSkillGrowthState(
            skill_id="skill_001",
            original_skill_name="Thệ Ước Thép",
            current_skill_name="Thệ Ước Thép",
            current_stage="bloom",
            bloom_completed=True,
        )
        resonance = PrincipleResonance(
            order=0.1,
            matter=0.85,
            is_proto_sovereign=True,
            dominant_principle="matter",
        )
        state = PlayerState(
            name="Kaito",
            unique_skill_growth=growth,
            principle_resonance=resonance,
        )
        assert state.unique_skill_growth.current_stage == "bloom"
        assert state.principle_resonance.is_proto_sovereign is True

    def test_player_state_v1_compat(self):
        """V1 PlayerState data (no growth fields) still works."""
        v1_data = {
            "name": "Legacy Player",
            "archetype": "vanguard",
        }
        state = PlayerState(**v1_data)
        assert state.name == "Legacy Player"
        assert state.unique_skill_growth is None
        assert state.principle_resonance is None

    def test_player_state_serialization_roundtrip(self):
        """Full state serialization/deserialization."""
        skill = UniqueSkill(
            name="Vết Nứt Sự Thật",
            category="perception",
            weakness_type="sensory_tax",
            current_stage="seed",
            sub_skills=[
                SubSkill(name="Trực Giác Nứt", type="passive", unlocked_at="seed"),
            ],
        )
        growth = UniqueSkillGrowthState(
            skill_id="s001",
            original_skill_name="Vết Nứt Sự Thật",
            current_skill_name="Vết Nứt Sự Thật",
        )
        resonance = PrincipleResonance(order=0.9, is_proto_sovereign=True, dominant_principle="order")
        state = PlayerState(
            name="Yuki",
            unique_skill=skill,
            unique_skill_growth=growth,
            principle_resonance=resonance,
        )
        # Round-trip through JSON
        json_str = state.model_dump_json()
        restored = PlayerState.model_validate_json(json_str)
        assert restored.name == "Yuki"
        assert restored.unique_skill.name == "Vết Nứt Sự Thật"
        assert restored.unique_skill.sub_skills[0].name == "Trực Giác Nứt"
        assert restored.unique_skill_growth.current_stage == "seed"
        assert restored.principle_resonance.is_proto_sovereign is True
