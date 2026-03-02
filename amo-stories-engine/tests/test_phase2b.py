"""Tests for Phase 2B — Signature Move Evolution v2→v3.

Covers: Evolution conditions, crystal consumption, state transitions,
        context chaining, resonance burst, parser multi-tier.
Ref: WEAPON_SYSTEM_SPEC v1.0 §7
"""

from app.models.weapon import (
    SignatureMove,
    Weapon,
    WeaponBondEvent,
    WeaponGrade,
    WeaponLore,
    WeaponOrigin,
)
from app.models.pipeline import NarrativeState
from app.engine.signature_move_evolution import (
    CRYSTAL_REQUIREMENT,
    EVOLUTION_V2_BOND_THRESHOLD,
    RESONANCE_BURST_BONUS,
    TIER_MECHANICAL_VALUES,
    V3_SKILL_STAGES,
    apply_evolution_v2,
    apply_evolution_v3,
    can_evolve_v2,
    can_evolve_v3,
    check_resonance_burst,
    consume_crystal,
)
from app.narrative.signature_move_agent import (
    build_signature_move_v2_context,
    build_signature_move_v3_context,
    parse_signature_move_response,
)


# ═══════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════

def _awakened_weapon_v1(
    bond: float = 105.0,
    crystals: list[str] | None = None,
) -> Weapon:
    """Create an Awakened weapon with Signature Move v1."""
    return Weapon(
        id="test_awk",
        name="Test Awakened",
        weapon_type="sword",
        grade=WeaponGrade.awakened,
        primary_principle="entropy",
        secondary_principle="flux",
        soul_linked=True,
        bond_score=bond,
        lore=WeaponLore(origin=WeaponOrigin.crafting, history_summary="Test lore"),
        signature_move=SignatureMove(
            evolution_tier=1,
            name="Hư Vô Trảm",
            description="v1 description",
            mechanical_effect="drain_enhance",
            mechanical_value=0.05,
            v1_name="Hư Vô Trảm",
            v1_description="v1 description",
        ),
        soul_crystals=crystals or [],
        bond_events=[
            WeaponBondEvent(chapter=3, event_type="near_death", description="Survived", bond_delta=8.0),
            WeaponBondEvent(chapter=5, event_type="soul_choice", description="Chose path", bond_delta=6.0),
        ],
    )


def _v2_weapon(crystals: list[str] | None = None) -> Weapon:
    """Create a weapon with Signature Move v2."""
    w = _awakened_weapon_v1(bond=120.0, crystals=crystals)
    w.signature_move = SignatureMove(
        evolution_tier=2,
        name="Hư Vô Trảm: Thâm Uyên",
        description="v2 description",
        mechanical_effect="drain_enhance",
        mechanical_value=0.07,
        v1_name="Hư Vô Trảm",
        v1_description="v1 description",
    )
    w.climax_encounter_count = 1
    return w


# ═══════════════════════════════════════════════
# Constants Tests
# ═══════════════════════════════════════════════

class TestConstants:
    def test_v2_bond_threshold(self):
        assert EVOLUTION_V2_BOND_THRESHOLD == 101.0

    def test_resonance_burst_bonus(self):
        assert RESONANCE_BURST_BONUS == 0.03

    def test_tier_values(self):
        assert TIER_MECHANICAL_VALUES == {1: 0.05, 2: 0.07, 3: 0.10}

    def test_v3_skill_stages(self):
        assert "aspect" in V3_SKILL_STAGES
        assert "manifestation" in V3_SKILL_STAGES
        assert "seed" not in V3_SKILL_STAGES

    def test_crystal_requirements(self):
        assert "true_crystal" in CRYSTAL_REQUIREMENT[2]
        assert "sovereign" in CRYSTAL_REQUIREMENT[2]
        assert CRYSTAL_REQUIREMENT[3] == {"sovereign"}


# ═══════════════════════════════════════════════
# can_evolve_v2 Tests
# ═══════════════════════════════════════════════

class TestCanEvolveV2:
    def test_all_conditions_met(self):
        w = _awakened_weapon_v1(bond=105.0, crystals=["true_crystal"])
        ok, reason = can_evolve_v2(w, has_soul_choice_this_chapter=True)
        assert ok is True
        assert reason == "ok"

    def test_bond_too_low(self):
        w = _awakened_weapon_v1(bond=100.0, crystals=["true_crystal"])
        ok, reason = can_evolve_v2(w, has_soul_choice_this_chapter=True)
        assert ok is False
        assert "bond_too_low" in reason

    def test_bond_exact_threshold(self):
        w = _awakened_weapon_v1(bond=101.0, crystals=["true_crystal"])
        ok, reason = can_evolve_v2(w, has_soul_choice_this_chapter=True)
        assert ok is True

    def test_no_crystal(self):
        w = _awakened_weapon_v1(bond=105.0, crystals=[])
        ok, reason = can_evolve_v2(w, has_soul_choice_this_chapter=True)
        assert ok is False
        assert reason == "no_crystal"

    def test_pale_crystal_not_enough(self):
        w = _awakened_weapon_v1(bond=105.0, crystals=["pale"])
        ok, reason = can_evolve_v2(w, has_soul_choice_this_chapter=True)
        assert ok is False

    def test_sovereign_crystal_accepted(self):
        w = _awakened_weapon_v1(bond=105.0, crystals=["sovereign"])
        ok, reason = can_evolve_v2(w, has_soul_choice_this_chapter=True)
        assert ok is True

    def test_no_soul_choice(self):
        w = _awakened_weapon_v1(bond=105.0, crystals=["true_crystal"])
        ok, reason = can_evolve_v2(w, has_soul_choice_this_chapter=False)
        assert ok is False
        assert reason == "no_soul_choice"

    def test_wrong_grade(self):
        w = _awakened_weapon_v1()
        w.grade = WeaponGrade.soul_linked
        ok, reason = can_evolve_v2(w, has_soul_choice_this_chapter=True)
        assert ok is False
        assert reason == "weapon_not_awakened"


# ═══════════════════════════════════════════════
# can_evolve_v3 Tests
# ═══════════════════════════════════════════════

class TestCanEvolveV3:
    def test_all_conditions_met(self):
        w = _v2_weapon(crystals=["sovereign"])
        ok, reason = can_evolve_v3(w, unique_skill_stage="aspect")
        assert ok is True

    def test_skill_stage_too_low(self):
        w = _v2_weapon(crystals=["sovereign"])
        ok, reason = can_evolve_v3(w, unique_skill_stage="bloom")
        assert ok is False
        assert "skill_stage_too_low" in reason

    def test_no_sovereign(self):
        w = _v2_weapon(crystals=["true_crystal"])
        ok, reason = can_evolve_v3(w, unique_skill_stage="aspect")
        assert ok is False
        assert reason == "no_sovereign_crystal"

    def test_no_climax(self):
        w = _v2_weapon(crystals=["sovereign"])
        w.climax_encounter_count = 0
        ok, reason = can_evolve_v3(w, unique_skill_stage="aspect")
        assert ok is False
        assert reason == "no_climax_encounter"

    def test_wrong_tier(self):
        w = _awakened_weapon_v1(crystals=["sovereign"])
        ok, reason = can_evolve_v3(w, unique_skill_stage="aspect")
        assert ok is False
        assert "wrong_tier_1" in reason


# ═══════════════════════════════════════════════
# Crystal Consumption Tests
# ═══════════════════════════════════════════════

class TestCrystalConsumption:
    def test_consume_true_crystal(self):
        w = _awakened_weapon_v1(crystals=["true_crystal"])
        consumed = consume_crystal(w, CRYSTAL_REQUIREMENT[2])
        assert consumed == "true_crystal"
        assert "true_crystal" not in w.soul_crystals

    def test_consume_prefers_sovereign(self):
        w = _awakened_weapon_v1(crystals=["true_crystal", "sovereign"])
        consumed = consume_crystal(w, CRYSTAL_REQUIREMENT[2])
        assert consumed == "sovereign"

    def test_consume_returns_none_when_empty(self):
        w = _awakened_weapon_v1(crystals=[])
        consumed = consume_crystal(w, CRYSTAL_REQUIREMENT[2])
        assert consumed is None


# ═══════════════════════════════════════════════
# apply_evolution Tests
# ═══════════════════════════════════════════════

class TestApplyEvolution:
    def test_v2_bumps_tier(self):
        w = _awakened_weapon_v1(bond=105.0, crystals=["true_crystal"])
        apply_evolution_v2(w)
        assert w.signature_move.evolution_tier == 2
        assert w.signature_move.mechanical_value == 0.07

    def test_v2_crystal_consumed(self):
        w = _awakened_weapon_v1(bond=105.0, crystals=["true_crystal"])
        apply_evolution_v2(w)
        assert "true_crystal" not in w.soul_crystals

    def test_v2_preserves_v1_context(self):
        w = _awakened_weapon_v1(bond=105.0, crystals=["true_crystal"])
        apply_evolution_v2(w)
        assert w.signature_move.v1_name == "Hư Vô Trảm"
        assert w.signature_move.v1_description == "v1 description"

    def test_v2_no_crystal_no_change(self):
        w = _awakened_weapon_v1(bond=105.0, crystals=[])
        apply_evolution_v2(w)
        assert w.signature_move.evolution_tier == 1  # unchanged

    def test_v3_bumps_tier(self):
        w = _v2_weapon(crystals=["sovereign"])
        apply_evolution_v3(w, unique_skill_name="Phá Thiên")
        assert w.signature_move.evolution_tier == 3
        assert w.signature_move.mechanical_value == 0.10

    def test_v3_preserves_v2_context(self):
        w = _v2_weapon(crystals=["sovereign"])
        apply_evolution_v3(w, unique_skill_name="Phá Thiên")
        assert w.signature_move.v2_name == "Hư Vô Trảm: Thâm Uyên"
        assert w.signature_move.v2_description == "v2 description"

    def test_v3_sets_secondary_effect(self):
        w = _v2_weapon(crystals=["sovereign"])
        apply_evolution_v3(w, unique_skill_name="Phá Thiên")
        assert "Phá Thiên" in w.signature_move.secondary_effect

    def test_v3_crystal_consumed(self):
        w = _v2_weapon(crystals=["sovereign"])
        apply_evolution_v3(w, unique_skill_name="Test")
        assert "sovereign" not in w.soul_crystals


# ═══════════════════════════════════════════════
# Resonance Burst Tests
# ═══════════════════════════════════════════════

class TestResonanceBurst:
    def test_v3_with_skill_gives_bonus(self):
        w = _v2_weapon(crystals=["sovereign"])
        apply_evolution_v3(w)
        bonus = check_resonance_burst(w, unique_skill_used_this_chapter=True)
        assert bonus == 0.03

    def test_v3_without_skill_no_bonus(self):
        w = _v2_weapon(crystals=["sovereign"])
        apply_evolution_v3(w)
        bonus = check_resonance_burst(w, unique_skill_used_this_chapter=False)
        assert bonus == 0.0

    def test_v2_with_skill_no_bonus(self):
        w = _v2_weapon()
        bonus = check_resonance_burst(w, unique_skill_used_this_chapter=True)
        assert bonus == 0.0

    def test_v1_no_bonus(self):
        w = _awakened_weapon_v1()
        bonus = check_resonance_burst(w, unique_skill_used_this_chapter=True)
        assert bonus == 0.0


# ═══════════════════════════════════════════════
# Context Builder Tests (v2/v3)
# ═══════════════════════════════════════════════

class TestContextBuilders:
    def test_v2_context_structure(self):
        w = _awakened_weapon_v1()
        ctx = build_signature_move_v2_context(w, unique_skill_stage="bloom")
        assert ctx["evolution_tier"] == 2
        assert ctx["v1_move_name"] == "Hư Vô Trảm"
        assert ctx["v1_move_description"] == "v1 description"
        assert ctx["unique_skill_stage"] == "bloom"

    def test_v3_context_structure(self):
        w = _v2_weapon()
        ctx = build_signature_move_v3_context(
            w,
            unique_skill_name="Phá Thiên",
            unique_skill_aspect="destruction",
            climax_chapter_summary="Epic boss fight",
        )
        assert ctx["evolution_tier"] == 3
        assert ctx["v1_move_name"] == "Hư Vô Trảm"
        assert ctx["v2_move_name"] == ""  # v2_name not set on SignatureMove yet
        assert ctx["unique_skill_name"] == "Phá Thiên"
        assert ctx["climax_chapter_summary"] == "Epic boss fight"


# ═══════════════════════════════════════════════
# Parser Multi-Tier Tests
# ═══════════════════════════════════════════════

class TestParserMultiTier:
    def test_parse_v2(self):
        raw = '{"name": "Hư Vô Trảm: Thâm Uyên", "description": "Evolved form"}'
        existing = SignatureMove(
            evolution_tier=1, name="Hư Vô Trảm", v1_name="Hư Vô Trảm", v1_description="v1 desc"
        )
        move = parse_signature_move_response(raw, tier=2, existing_move=existing)
        assert move is not None
        assert move.evolution_tier == 2
        assert move.v1_name == "Hư Vô Trảm"  # preserved
        assert move.mechanical_value == 0.07

    def test_parse_v3_preserves_chain(self):
        raw = '{"name": "Hợp Nhất", "description": "Final form", "secondary_effect": "synergy"}'
        existing = SignatureMove(
            evolution_tier=2, name="Thâm Uyên", v1_name="Hư Vô Trảm", v1_description="v1 desc"
        )
        move = parse_signature_move_response(raw, tier=3, existing_move=existing)
        assert move is not None
        assert move.evolution_tier == 3
        assert move.v1_name == "Hư Vô Trảm"
        assert move.v2_name == "Thâm Uyên"
        assert move.mechanical_value == 0.10


# ═══════════════════════════════════════════════
# Model Field Tests
# ═══════════════════════════════════════════════

class TestModelFields:
    def test_weapon_climax_count_default(self):
        w = Weapon()
        assert w.climax_encounter_count == 0

    def test_weapon_soul_crystals_default(self):
        w = Weapon()
        assert w.soul_crystals == []

    def test_signature_move_v2_fields(self):
        sm = SignatureMove()
        assert sm.v2_name == ""
        assert sm.v2_description == ""

    def test_pipeline_evolution_pending(self):
        ns = NarrativeState()
        assert ns.weapon_evolution_pending == ""
