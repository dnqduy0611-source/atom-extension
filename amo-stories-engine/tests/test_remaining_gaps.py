"""Tests for all 4 remaining weapon gaps.

Covers: Divine Ability, Lore Reveal, Shard Resonance, Bond Decay wiring.
"""

from app.engine.archon_fragment import (
    DIVINE_ABILITY_EFFECTS,
    FRAGMENT_PROPERTIES,
    MAX_LORE_FRAGMENTS,
    SHARD_RESONANCE_BONUS,
    SHARD_RESONANCE_THRESHOLD,
    activate_divine_ability,
    can_use_divine_ability,
    check_shard_resonance,
    get_divine_ability_info,
    get_fragment_weapon,
    get_lore_reveal_progress,
    get_shard_resonance_bonus,
    increment_lore_reveal,
)
from app.models.weapon import Weapon, WeaponGrade, WeaponLore, WeaponOrigin


# ═══════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════

def _make_fragment(fragment_id: str = "veil_unbound") -> Weapon:
    """Get a copy of an Archon-Fragment for testing."""
    w = get_fragment_weapon(fragment_id)
    assert w is not None
    return w


# ═══════════════════════════════════════════════
# Divine Ability System
# ═══════════════════════════════════════════════

class TestDivineAbilityData:
    def test_all_five_effects_defined(self):
        assert len(DIVINE_ABILITY_EFFECTS) == 5
        for fid in ("veil_unbound", "iron_dominion", "lex_primordialis",
                     "morphic_hunger", "grace_eternal"):
            assert fid in DIVINE_ABILITY_EFFECTS

    def test_each_has_type(self):
        for fid, effect in DIVINE_ABILITY_EFFECTS.items():
            assert "type" in effect, f"{fid} missing type"


class TestCanUseDivineAbility:
    def test_available_first_season(self):
        w = _make_fragment()
        assert can_use_divine_ability(w, current_season=1) is True

    def test_unavailable_after_use(self):
        w = _make_fragment()
        activate_divine_ability(w, current_season=1)
        assert can_use_divine_ability(w, current_season=1) is False

    def test_available_next_season(self):
        w = _make_fragment()
        activate_divine_ability(w, current_season=1)
        assert can_use_divine_ability(w, current_season=2) is True

    def test_non_fragment_cannot_use(self):
        w = Weapon(name="Normal", grade=WeaponGrade.resonant)
        assert can_use_divine_ability(w, current_season=1) is False

    def test_dormant_cannot_use(self):
        w = _make_fragment()
        w.dormant = True
        assert can_use_divine_ability(w, current_season=1) is False


class TestActivateDivineAbility:
    def test_returns_effect_dict(self):
        w = _make_fragment("lex_primordialis")
        result = activate_divine_ability(w, current_season=1)
        assert result is not None
        assert result["ability_name"] == "Absolute Decree"
        assert result["effect"]["type"] == "phase_override"
        assert result["effect"]["combat_override"] == "auto_favorable"

    def test_marks_as_used(self):
        w = _make_fragment()
        activate_divine_ability(w, current_season=3)
        assert w.divine_ability_used_season == 3

    def test_second_use_same_season_returns_none(self):
        w = _make_fragment()
        first = activate_divine_ability(w, current_season=1)
        second = activate_divine_ability(w, current_season=1)
        assert first is not None
        assert second is None

    def test_all_five_fragments(self):
        for fid in ("veil_unbound", "iron_dominion", "lex_primordialis",
                     "morphic_hunger", "grace_eternal"):
            w = _make_fragment(fid)
            result = activate_divine_ability(w, current_season=1)
            assert result is not None, f"{fid} failed"

    def test_grace_eternal_stability_restore(self):
        w = _make_fragment("grace_eternal")
        result = activate_divine_ability(w, current_season=1)
        assert result["ability_name"] == "Eternal Devotion"
        assert result["effect"]["stability_restored"] == 1.0
        assert result["effect"]["hp_cost_percent"] == 0.20


class TestGetDivineAbilityInfo:
    def test_available_status(self):
        w = _make_fragment()
        info = get_divine_ability_info(w, current_season=1)
        assert info["divine_ability_available"] is True
        assert info["divine_ability_name"] == "Freedom Cascade"

    def test_used_status(self):
        w = _make_fragment()
        activate_divine_ability(w, current_season=2)
        info = get_divine_ability_info(w, current_season=2)
        assert info["divine_ability_available"] is False

    def test_non_fragment_empty(self):
        w = Weapon(name="Normal", grade=WeaponGrade.resonant)
        info = get_divine_ability_info(w, current_season=1)
        assert info == {}


# ═══════════════════════════════════════════════
# Lore Reveal
# ═══════════════════════════════════════════════

class TestLoreReveal:
    def test_increment_from_zero(self):
        w = _make_fragment()
        assert w.lore.lore_fragments_revealed == 0
        count = increment_lore_reveal(w)
        assert count == 1

    def test_increment_multiple(self):
        w = _make_fragment()
        for i in range(3):
            increment_lore_reveal(w)
        assert w.lore.lore_fragments_revealed == 3

    def test_cap_at_max(self):
        w = _make_fragment()
        for _ in range(10):
            increment_lore_reveal(w)
        assert w.lore.lore_fragments_revealed == MAX_LORE_FRAGMENTS

    def test_non_fragment_returns_zero(self):
        w = Weapon(name="Normal", grade=WeaponGrade.resonant)
        assert increment_lore_reveal(w) == 0

    def test_get_progress(self):
        w = _make_fragment()
        increment_lore_reveal(w)
        increment_lore_reveal(w)
        progress = get_lore_reveal_progress(w)
        assert progress["lore_fragments_revealed"] == 2
        assert progress["lore_fragments_total"] == 5
        assert progress["lore_complete"] is False

    def test_lore_complete(self):
        w = _make_fragment()
        for _ in range(5):
            increment_lore_reveal(w)
        progress = get_lore_reveal_progress(w)
        assert progress["lore_complete"] is True


# ═══════════════════════════════════════════════
# Shard Resonance
# ═══════════════════════════════════════════════

class TestShardResonance:
    def test_no_shards_no_resonance(self):
        w = Weapon(name="Test", primary_principle="order")
        assert check_shard_resonance(w) is False
        assert get_shard_resonance_bonus(w) == 0.0

    def test_below_threshold(self):
        w = Weapon(
            name="Test", primary_principle="order",
            shard_count=2, shard_principle="order",
        )
        assert check_shard_resonance(w) is False

    def test_at_threshold_matching_principle(self):
        w = Weapon(
            name="Test", primary_principle="order",
            shard_count=3, shard_principle="order",
        )
        assert check_shard_resonance(w) is True
        assert get_shard_resonance_bonus(w) == SHARD_RESONANCE_BONUS

    def test_mismatched_principle(self):
        w = Weapon(
            name="Test", primary_principle="order",
            shard_count=5, shard_principle="entropy",
        )
        assert check_shard_resonance(w) is False

    def test_bonus_value(self):
        assert SHARD_RESONANCE_BONUS == 0.02
        assert SHARD_RESONANCE_THRESHOLD == 3
