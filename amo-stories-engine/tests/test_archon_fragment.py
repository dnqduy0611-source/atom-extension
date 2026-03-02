"""Tests for Phase 1C — Archon-Fragment System.

Covers: Classifier, condition checker, Fragment weapon data, affinity tracking.
Ref: WEAPON_SYSTEM_SPEC v1.0 §8, §12
"""

from app.models.player import PlayerState
from app.models.pipeline import NarrativeState
from app.engine.archon_fragment import (
    AFFINITY_THRESHOLDS,
    ARCHON_FRAGMENT_WEAPONS,
    ARCHON_KEYS,
    FRAGMENT_PROPERTIES,
    check_fragment_conditions,
    classify_archon_affinity,
    get_dominant_archon,
    get_fragment_weapon,
    increment_archon_affinity,
)
from app.models.weapon import WeaponGrade, WeaponOrigin


# ═══════════════════════════════════════════════
# Classifier Tests
# ═══════════════════════════════════════════════

class TestArchonClassifier:
    def test_vyrel_freedom_signal(self):
        """Strong freedom assertion → vyrel."""
        result = classify_archon_affinity(
            alignment_change=-2.0,
            action_category="soul_choice",
        )
        assert result == "vyrel"

    def test_dominar_control_signal(self):
        """Dominance display → dominar."""
        result = classify_archon_affinity(
            notoriety_change=1.5,
            action_category="combat",
        )
        assert result == "dominar"

    def test_aethis_order_signal(self):
        """Strong coherence + purposeful action → aethis."""
        result = classify_archon_affinity(
            coherence_change=1.5,
            action_category="soul_choice",
        )
        assert result == "aethis"

    def test_morphael_evolution_signal(self):
        """Identity drift + exploration → morphael."""
        result = classify_archon_affinity(
            drift_detected="major",
            action_category="exploration",
        )
        assert result == "morphael"

    def test_seraphine_devotion_signal(self):
        """Strong positive alignment + social → seraphine."""
        result = classify_archon_affinity(
            alignment_change=2.0,
            action_category="social",
        )
        assert result == "seraphine"

    def test_neutral_chapter_returns_none(self):
        """Normal chapter with weak signals → None."""
        result = classify_archon_affinity(
            alignment_change=0.5,
            coherence_change=0.3,
            action_category="narrative",
        )
        assert result is None

    def test_wrong_category_returns_none(self):
        """Strong signal but wrong category → None."""
        # Strong freedom signal but action_category is combat (not in vyrel list)
        result = classify_archon_affinity(
            alignment_change=-3.0,
            action_category="combat",
        )
        assert result is None

    def test_priority_vyrel_over_seraphine(self):
        """Vyrel check comes first, so negative alignment wins."""
        result = classify_archon_affinity(
            alignment_change=-2.0,
            action_category="stealth",
        )
        assert result == "vyrel"


# ═══════════════════════════════════════════════
# Affinity Tracking Tests
# ═══════════════════════════════════════════════

class TestAffinityTracking:
    def test_increment_creates_key(self):
        aff = {}
        updated = increment_archon_affinity(aff, "vyrel")
        assert updated["vyrel"] == 1

    def test_increment_accumulates(self):
        aff = {"vyrel": 2}
        updated = increment_archon_affinity(aff, "vyrel")
        assert updated["vyrel"] == 3

    def test_invalid_key_ignored(self):
        aff = {"vyrel": 1}
        updated = increment_archon_affinity(aff, "invalid_archon")
        assert updated == {"vyrel": 1}

    def test_bounded_keys(self):
        """Only 5 valid archon keys should ever exist."""
        assert len(ARCHON_KEYS) == 5


# ═══════════════════════════════════════════════
# Condition Checker Tests
# ═══════════════════════════════════════════════

class TestFragmentConditions:
    def test_veil_unbound_met(self):
        """Vyrel ≥ 3 + alignment < -20 → veil_unbound."""
        result = check_fragment_conditions(
            archon_affinity={"vyrel": 3},
            alignment=-25.0,
        )
        assert result == "veil_unbound"

    def test_veil_unbound_affinity_too_low(self):
        result = check_fragment_conditions(
            archon_affinity={"vyrel": 2},
            alignment=-25.0,
        )
        assert result is None

    def test_veil_unbound_alignment_too_high(self):
        result = check_fragment_conditions(
            archon_affinity={"vyrel": 3},
            alignment=-10.0,  # Not < -20
        )
        assert result is None

    def test_iron_dominion_met(self):
        """Dominar ≥ 2 + notoriety ≥ 30 → iron_dominion."""
        result = check_fragment_conditions(
            archon_affinity={"dominar": 2},
            notoriety=35.0,
        )
        assert result == "iron_dominion"

    def test_iron_dominion_notoriety_too_low(self):
        result = check_fragment_conditions(
            archon_affinity={"dominar": 2},
            notoriety=20.0,
        )
        assert result is None

    def test_no_affinity_returns_none(self):
        result = check_fragment_conditions(
            archon_affinity={},
            alignment=-50.0,
            notoriety=50.0,
        )
        assert result is None

    def test_both_conditions_met_vyrel_priority(self):
        """If both conditions met, vyrel (checked first) wins."""
        result = check_fragment_conditions(
            archon_affinity={"vyrel": 3, "dominar": 2},
            alignment=-25.0,
            notoriety=35.0,
        )
        assert result == "veil_unbound"


# ═══════════════════════════════════════════════
# Fragment Weapon Data Tests
# ═══════════════════════════════════════════════

class TestFragmentWeapons:
    def test_two_fragments_in_phase1(self):
        """Phase 1 had 2, Phase 3 expanded to 5."""
        assert len(ARCHON_FRAGMENT_WEAPONS) == 5
        assert "veil_unbound" in ARCHON_FRAGMENT_WEAPONS
        assert "iron_dominion" in ARCHON_FRAGMENT_WEAPONS

    def test_veil_unbound_data(self):
        w = ARCHON_FRAGMENT_WEAPONS["veil_unbound"]
        assert w.grade == WeaponGrade.archon_fragment
        assert w.primary_principle == "entropy"
        assert w.secondary_principle == "flux"
        assert w.tertiary_principle == "void"
        assert w.is_archon_fragment is True
        assert w.soul_linked is True
        assert w.archon_source == "vyrel"
        assert w.lore.origin == WeaponOrigin.archon

    def test_iron_dominion_data(self):
        w = ARCHON_FRAGMENT_WEAPONS["iron_dominion"]
        assert w.grade == WeaponGrade.archon_fragment
        assert w.primary_principle == "matter"
        assert w.secondary_principle == "void"
        assert w.tertiary_principle == "order"
        assert w.is_archon_fragment is True
        assert w.archon_source == "dominar"

    def test_fragment_properties_lookup(self):
        assert "veil_unbound" in FRAGMENT_PROPERTIES
        assert "iron_dominion" in FRAGMENT_PROPERTIES
        assert FRAGMENT_PROPERTIES["veil_unbound"]["divine_ability_name"] == "Freedom Cascade"
        assert FRAGMENT_PROPERTIES["iron_dominion"]["divine_ability_name"] == "Sovereign Command"

    def test_get_fragment_weapon_copy(self):
        """get_fragment_weapon should return a deep copy, not reference."""
        w1 = get_fragment_weapon("veil_unbound")
        w2 = get_fragment_weapon("veil_unbound")
        assert w1 is not w2
        assert w1.name == w2.name == "Veil Unbound"

    def test_get_fragment_weapon_invalid(self):
        assert get_fragment_weapon("nonexistent") is None


# ═══════════════════════════════════════════════
# Dominant Archon Tests
# ═══════════════════════════════════════════════

class TestDominantArchon:
    def test_single_archon(self):
        assert get_dominant_archon({"vyrel": 3}) == "vyrel"

    def test_multiple_archons(self):
        result = get_dominant_archon({"vyrel": 2, "dominar": 4, "aethis": 1})
        assert result == "dominar"

    def test_empty_returns_none(self):
        assert get_dominant_archon({}) is None

    def test_zero_values_returns_none(self):
        assert get_dominant_archon({"vyrel": 0}) is None

    def test_invalid_keys_ignored(self):
        result = get_dominant_archon({"invalid": 5, "vyrel": 1})
        assert result == "vyrel"


# ═══════════════════════════════════════════════
# Model Field Tests
# ═══════════════════════════════════════════════

class TestModelFields:
    def test_player_state_archon_affinity_default(self):
        ps = PlayerState()
        assert ps.archon_affinity == {}

    def test_narrative_state_dominant_archon_default(self):
        ns = NarrativeState()
        assert ns.dominant_archon == ""

    def test_affinity_thresholds_values(self):
        """Spec §12: vyrel=3, dominar=2."""
        assert AFFINITY_THRESHOLDS["vyrel"] == 3
        assert AFFINITY_THRESHOLDS["dominar"] == 2
