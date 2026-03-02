"""Tests for Phase 3 — Archon-Fragment Expansion.

Covers: 3 new fragments (Lex Primordialis, Morphic Hunger, Grace Eternal),
        properties, thresholds, condition checks, weapon data.
Ref: WEAPON_SYSTEM_SPEC v1.0 §8
"""

from app.models.weapon import WeaponGrade, WeaponOrigin
from app.engine.archon_fragment import (
    AFFINITY_THRESHOLDS,
    ARCHON_FRAGMENT_WEAPONS,
    ARCHON_KEYS,
    FRAGMENT_PROPERTIES,
    check_fragment_conditions,
    get_fragment_weapon,
)


# ═══════════════════════════════════════════════
# Data Completeness
# ═══════════════════════════════════════════════

class TestDataCompleteness:
    def test_five_archon_keys(self):
        assert len(ARCHON_KEYS) == 5
        assert set(ARCHON_KEYS) == {"aethis", "vyrel", "morphael", "dominar", "seraphine"}

    def test_five_fragment_weapons(self):
        assert len(ARCHON_FRAGMENT_WEAPONS) == 5

    def test_five_fragment_properties(self):
        assert len(FRAGMENT_PROPERTIES) == 5

    def test_five_thresholds(self):
        assert len(AFFINITY_THRESHOLDS) == 5

    def test_all_weapons_have_properties(self):
        for weapon_id in ARCHON_FRAGMENT_WEAPONS:
            assert weapon_id in FRAGMENT_PROPERTIES, f"Missing properties for {weapon_id}"


# ═══════════════════════════════════════════════
# Lex Primordialis (Aethis — Order)
# ═══════════════════════════════════════════════

class TestLexPrimordialis:
    def test_weapon_data(self):
        w = ARCHON_FRAGMENT_WEAPONS["lex_primordialis"]
        assert w.name == "Lex Primordialis"
        assert w.grade == WeaponGrade.archon_fragment
        assert w.primary_principle == "order"
        assert w.secondary_principle == "matter"
        assert w.tertiary_principle == "energy"
        assert w.archon_source == "aethis"
        assert w.soul_linked is True
        assert w.bond_score == 100.0
        assert w.lore.origin == WeaponOrigin.archon

    def test_properties(self):
        p = FRAGMENT_PROPERTIES["lex_primordialis"]
        assert p["archon"] == "Aethis (Order)"
        assert "stability drain" in p["global_passive"]
        assert p["divine_ability_name"] == "Absolute Decree"

    def test_condition_met(self):
        result = check_fragment_conditions(
            {"aethis": 3}, alignment=0.0, coherence=70.0,
        )
        assert result == "lex_primordialis"

    def test_condition_coherence_too_low(self):
        result = check_fragment_conditions(
            {"aethis": 3}, coherence=69.0,
        )
        assert result is None

    def test_condition_affinity_too_low(self):
        result = check_fragment_conditions(
            {"aethis": 2}, coherence=80.0,
        )
        assert result is None


# ═══════════════════════════════════════════════
# Morphic Hunger (Morphael — Evolution)
# ═══════════════════════════════════════════════

class TestMorphicHunger:
    def test_weapon_data(self):
        w = ARCHON_FRAGMENT_WEAPONS["morphic_hunger"]
        assert w.name == "Morphic Hunger"
        assert w.primary_principle == "flux"
        assert w.secondary_principle == "energy"
        assert w.tertiary_principle == "matter"
        assert w.archon_source == "morphael"
        assert w.weapon_type == "living_gauntlet"

    def test_properties(self):
        p = FRAGMENT_PROPERTIES["morphic_hunger"]
        assert p["archon"] == "Morphael (Evolution)"
        assert "+1%" in p["global_passive"]
        assert p["divine_ability_name"] == "Adaptive Apex"

    def test_condition_met(self):
        result = check_fragment_conditions(
            {"morphael": 2}, had_drift=True,
        )
        assert result == "morphic_hunger"

    def test_condition_no_drift(self):
        result = check_fragment_conditions(
            {"morphael": 2}, had_drift=False,
        )
        assert result is None


# ═══════════════════════════════════════════════
# Grace Eternal (Seraphine — Devotion)
# ═══════════════════════════════════════════════

class TestGraceEternal:
    def test_weapon_data(self):
        w = ARCHON_FRAGMENT_WEAPONS["grace_eternal"]
        assert w.name == "Grace Eternal"
        assert w.primary_principle == "energy"
        assert w.secondary_principle == "matter"
        assert w.tertiary_principle == "order"
        assert w.archon_source == "seraphine"

    def test_properties(self):
        p = FRAGMENT_PROPERTIES["grace_eternal"]
        assert p["archon"] == "Seraphine (Devotion)"
        assert "Fate Buffer" in p["global_passive"]
        assert p["divine_ability_name"] == "Eternal Devotion"

    def test_condition_met(self):
        result = check_fragment_conditions(
            {"seraphine": 3}, alignment=25.0,
        )
        assert result == "grace_eternal"

    def test_condition_alignment_too_low(self):
        result = check_fragment_conditions(
            {"seraphine": 3}, alignment=20.0,
        )
        assert result is None


# ═══════════════════════════════════════════════
# get_fragment_weapon (all 5)
# ═══════════════════════════════════════════════

class TestGetFragmentWeapon:
    def test_get_lex(self):
        w = get_fragment_weapon("lex_primordialis")
        assert w is not None
        assert w.name == "Lex Primordialis"

    def test_get_morphic(self):
        w = get_fragment_weapon("morphic_hunger")
        assert w is not None
        assert w.name == "Morphic Hunger"

    def test_get_grace(self):
        w = get_fragment_weapon("grace_eternal")
        assert w is not None
        assert w.name == "Grace Eternal"

    def test_deep_copy(self):
        w1 = get_fragment_weapon("lex_primordialis")
        w2 = get_fragment_weapon("lex_primordialis")
        assert w1 is not w2  # deep copy


# ═══════════════════════════════════════════════
# Priority (Phase 1 still works)
# ═══════════════════════════════════════════════

class TestPhase1Backward:
    def test_veil_unbound_still_works(self):
        result = check_fragment_conditions(
            {"vyrel": 3}, alignment=-25.0,
        )
        assert result == "veil_unbound"

    def test_iron_dominion_still_works(self):
        result = check_fragment_conditions(
            {"dominar": 2}, notoriety=30.0,
        )
        assert result == "iron_dominion"

    def test_priority_vyrel_first(self):
        """When multiple conditions met, vyrel checked first."""
        result = check_fragment_conditions(
            {"vyrel": 3, "seraphine": 3},
            alignment=-25.0,
        )
        assert result == "veil_unbound"
