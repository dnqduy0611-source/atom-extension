"""Tests for Vanguard dual-wield combat formula.

Spec §4: primary_grade_bonus × 0.70 + secondary_grade_bonus × 0.50.
"""

from app.models.weapon import (
    Weapon,
    WeaponGrade,
    VANGUARD_PRIMARY_MULTIPLIER,
    VANGUARD_SECONDARY_MULTIPLIER,
    WEAPON_GRADE_BONUS,
    compute_vanguard_dual_wield,
)


def _make_weapon(grade: WeaponGrade, principle: str = "order") -> Weapon:
    return Weapon(
        name="Test",
        grade=grade,
        primary_principle=principle,
    )


class TestDualWieldConstants:
    def test_primary_multiplier(self):
        assert VANGUARD_PRIMARY_MULTIPLIER == 0.70

    def test_secondary_multiplier(self):
        assert VANGUARD_SECONDARY_MULTIPLIER == 0.50


class TestDualWieldFormula:
    def test_two_resonant_spec_example(self):
        """Spec example: 2× Resonant → 0.05×0.70 + 0.05×0.50 = 0.060.
        No skill_principle → no synergy bonus contamination."""
        primary = _make_weapon(WeaponGrade.resonant)
        secondary = _make_weapon(WeaponGrade.resonant, "entropy")
        result = compute_vanguard_dual_wield(primary, secondary)
        # No skill_principle → synergy = "weak" → -0.01
        # But we want the pure formula test, so use explicit empty
        expected = round(0.05 * 0.70 + 0.05 * 0.50 - 0.01, 4)
        assert result["buildfit_bonus"] == expected

    def test_two_resonant_no_synergy(self):
        """Pure formula: no skill → synergy type = 'weak' → -0.01."""
        primary = _make_weapon(WeaponGrade.resonant)
        secondary = _make_weapon(WeaponGrade.resonant, "entropy")
        result = compute_vanguard_dual_wield(primary, secondary, skill_principle="")
        # synergy("order", "") = "weak" → -0.01
        expected = round(0.05 * 0.70 + 0.05 * 0.50 - 0.01, 4)
        assert result["buildfit_bonus"] == expected

    def test_two_resonant_identical_synergy(self):
        """With matching skill: +0.03 synergy on top of formula."""
        primary = _make_weapon(WeaponGrade.resonant, "order")
        secondary = _make_weapon(WeaponGrade.resonant, "entropy")
        result = compute_vanguard_dual_wield(
            primary, secondary, skill_principle="order",
        )
        # 0.05×0.70 + 0.05×0.50 + 0.03 = 0.090
        expected = round(0.05 * 0.70 + 0.05 * 0.50 + 0.03, 4)
        assert result["buildfit_bonus"] == expected

    def test_soul_linked_primary_resonant_secondary(self):
        primary = _make_weapon(WeaponGrade.soul_linked, "order")
        secondary = _make_weapon(WeaponGrade.resonant, "entropy")
        result = compute_vanguard_dual_wield(
            primary, secondary, skill_principle="order",
        )
        # 0.10×0.70 + 0.05×0.50 + 0.03 synergy = 0.125
        expected = round(0.10 * 0.70 + 0.05 * 0.50 + 0.03, 4)
        assert result["buildfit_bonus"] == expected

    def test_mundane_secondary_ignored(self):
        """Mundane secondary contributes 0."""
        primary = _make_weapon(WeaponGrade.resonant, "order")
        secondary = _make_weapon(WeaponGrade.mundane)
        result = compute_vanguard_dual_wield(
            primary, secondary, skill_principle="order",
        )
        # Only primary: 0.05 × 0.70 + 0.03 synergy = 0.065
        expected = round(0.05 * 0.70 + 0.03, 4)
        assert result["buildfit_bonus"] == expected

    def test_no_secondary(self):
        primary = _make_weapon(WeaponGrade.resonant, "order")
        result = compute_vanguard_dual_wield(
            primary, None, skill_principle="order",
        )
        # 0.05×0.70 + 0.03 = 0.065
        expected = round(0.05 * 0.70 + 0.03, 4)
        assert result["buildfit_bonus"] == expected

    def test_no_primary_returns_zero(self):
        result = compute_vanguard_dual_wield(None, None)
        assert result["effective_total"] == 0.0

    def test_dormant_primary_returns_zero(self):
        primary = _make_weapon(WeaponGrade.soul_linked)
        primary.dormant = True
        result = compute_vanguard_dual_wield(primary, None)
        assert result["effective_total"] == 0.0

    def test_dormant_secondary_ignored(self):
        primary = _make_weapon(WeaponGrade.resonant, "order")
        secondary = _make_weapon(WeaponGrade.resonant, "entropy")
        secondary.dormant = True
        result = compute_vanguard_dual_wield(
            primary, secondary, skill_principle="order",
        )
        # Only primary: 0.05 × 0.70 + 0.03 synergy
        expected = round(0.05 * 0.70 + 0.03, 4)
        assert result["buildfit_bonus"] == expected

    def test_playerskill_from_primary_only(self):
        primary = _make_weapon(WeaponGrade.soul_linked)
        secondary = _make_weapon(WeaponGrade.soul_linked)
        result = compute_vanguard_dual_wield(primary, secondary)
        # PlayerSkill from primary only (soul_linked = 0.02)
        assert result["playerskill_bonus"] == 0.02

    def test_opponent_advantage_from_primary(self):
        """Primary Order vs enemy Entropy = +0.03 advantage."""
        primary = _make_weapon(WeaponGrade.resonant, "order")
        secondary = _make_weapon(WeaponGrade.resonant, "matter")
        result = compute_vanguard_dual_wield(
            primary, secondary,
            skill_principle="order",
            enemy_principle="entropy",
        )
        # (0.05 + 0.03) × 0.70 + 0.05 × 0.50 + 0.03 synergy = 0.111
        expected = round((0.05 + 0.03) * 0.70 + 0.05 * 0.50 + 0.03, 4)
        assert result["buildfit_bonus"] == expected

    def test_cap_respected(self):
        """Even with high-grade dual-wield, BuildFit cap = 0.20."""
        primary = _make_weapon(WeaponGrade.awakened, "order")
        secondary = _make_weapon(WeaponGrade.awakened, "matter")
        result = compute_vanguard_dual_wield(
            primary, secondary,
            skill_principle="order",
            enemy_principle="entropy",
        )
        assert result["buildfit_bonus"] <= 0.20

    def test_dual_higher_than_single_resonant(self):
        """Dual-wield with two Resonant + synergy > single Resonant base."""
        primary = _make_weapon(WeaponGrade.resonant, "order")
        secondary = _make_weapon(WeaponGrade.resonant, "entropy")
        dual = compute_vanguard_dual_wield(
            primary, secondary, skill_principle="order",
        )
        # dual = 0.035 + 0.025 + 0.03 synergy = 0.090
        # single base = 0.05
        assert dual["buildfit_bonus"] > WEAPON_GRADE_BONUS["resonant"]
