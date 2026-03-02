"""Tests for Unique Skill suppression check system.

Covers: 3-level suppression (SUPPRESSED/SEALED/NULLIFIED),
category matching, stage resistance, and edge cases.
"""

import pytest

from app.engine.suppression_check import (
    SuppressionLevel,
    SuppressionResult,
    check_suppression,
    get_stage_resistance,
    STAGE_RESISTANCE,
)


class TestCheckSuppression:
    """Test check_suppression() gap-based formula."""

    # ── NONE: resistance wins ──

    def test_resistance_wins_low_power(self):
        """Power too low → NONE."""
        result = check_suppression(
            suppression_power=20,
            suppression_type="skill",
            target_resistance=50,
        )
        assert result.level == SuppressionLevel.NONE
        assert result.effectiveness_modifier == 1.0
        assert result.duration_phases == 0

    def test_resistance_wins_equal(self):
        """Power × multiplier == resistance - 1 → still NONE."""
        result = check_suppression(
            suppression_power=49,
            suppression_type="skill",   # multiplier 1.0
            target_resistance=50,
        )
        assert result.level == SuppressionLevel.NONE

    def test_none_has_narrative(self):
        """NONE outcome has non-empty narrative."""
        result = check_suppression(suppression_power=10, target_resistance=80)
        assert result.narrative_instruction
        assert result.reason

    # ── SUPPRESSED: gap 0-29 ──

    def test_suppressed_small_gap(self):
        """Gap = 5 → SUPPRESSED, high effectiveness."""
        result = check_suppression(
            suppression_power=55,
            suppression_type="skill",
            target_resistance=50,
        )
        assert result.level == SuppressionLevel.SUPPRESSED
        assert 0.9 <= result.effectiveness_modifier <= 1.0  # 1 - 5/100 = 0.95
        assert result.duration_phases == 2

    def test_suppressed_medium_gap(self):
        """Gap = 25 → SUPPRESSED, lower effectiveness."""
        result = check_suppression(
            suppression_power=75,
            suppression_type="skill",
            target_resistance=50,
        )
        assert result.level == SuppressionLevel.SUPPRESSED
        # effectiveness = 1 - 25/100 = 0.75
        assert 0.7 <= result.effectiveness_modifier <= 0.8
        assert result.duration_phases == 3  # gap >= 15

    def test_suppressed_minimum_modifier(self):
        """Effectiveness modifier floors at 0.2."""
        result = check_suppression(
            suppression_power=79,
            suppression_type="skill",
            target_resistance=50,
        )
        assert result.level == SuppressionLevel.SUPPRESSED
        assert result.effectiveness_modifier >= 0.2

    # ── SEALED: gap 30-59 ──

    def test_sealed_threshold(self):
        """Gap = 30 → exactly SEALED."""
        result = check_suppression(
            suppression_power=80,
            suppression_type="skill",
            target_resistance=50,
        )
        assert result.level == SuppressionLevel.SEALED
        assert result.effectiveness_modifier == 0.0
        assert result.duration_phases == 3  # gap < 45

    def test_sealed_high_gap(self):
        """Gap = 55 → SEALED, longer duration."""
        result = check_suppression(
            suppression_power=55,
            suppression_type="seal",    # multiplier 1.5 → effective = 82.5
            target_resistance=28,       # gap = 82.5 - 28 = 54.5
        )
        assert result.level == SuppressionLevel.SEALED
        assert result.duration_phases == 5  # gap >= 45

    # ── NULLIFIED: gap 60+ ──

    def test_nullified_field(self):
        """Anti-Unique Field → NULLIFIED."""
        result = check_suppression(
            suppression_power=60,
            suppression_type="field",   # multiplier 2.0 → effective = 120
            target_resistance=50,       # gap = 70
        )
        assert result.level == SuppressionLevel.NULLIFIED
        assert result.effectiveness_modifier == 0.0
        assert result.duration_phases == 0  # Lasts while field active

    def test_nullified_high_power_skill(self):
        """Overwhelming skill power → NULLIFIED."""
        result = check_suppression(
            suppression_power=100,
            suppression_type="seal",    # multiplier 1.5 → 150
            target_resistance=50,       # gap = 100
        )
        assert result.level == SuppressionLevel.NULLIFIED

    # ── Category matching ──

    def test_category_match_bonus(self):
        """Same category → +10 power bonus."""
        # Without match: power=45 vs resist=50 → gap=-5 → NONE
        result_no_match = check_suppression(
            suppression_power=45,
            suppression_type="skill",
            target_resistance=50,
            target_category="perception",
            suppression_category="manifestation",
        )
        assert result_no_match.level == SuppressionLevel.NONE

        # With match: power=45+10=55 vs resist=50 → gap=5 → SUPPRESSED
        result_match = check_suppression(
            suppression_power=45,
            suppression_type="skill",
            target_resistance=50,
            target_category="perception",
            suppression_category="perception",
        )
        assert result_match.level == SuppressionLevel.SUPPRESSED

    def test_category_match_empty_no_bonus(self):
        """Empty suppression_category → no bonus."""
        result = check_suppression(
            suppression_power=45,
            suppression_type="skill",
            target_resistance=50,
            target_category="perception",
            suppression_category="",
        )
        assert result.level == SuppressionLevel.NONE

    # ── Type multipliers ──

    def test_seal_multiplier(self):
        """Seal type has 1.5× multiplier."""
        # power=40 × 1.5 = 60 vs resist=50 → gap=10 → SUPPRESSED
        result = check_suppression(
            suppression_power=40,
            suppression_type="seal",
            target_resistance=50,
        )
        assert result.level == SuppressionLevel.SUPPRESSED

    def test_field_multiplier(self):
        """Field type has 2.0× multiplier."""
        # power=40 × 2.0 = 80 vs resist=50 → gap=30 → SEALED
        result = check_suppression(
            suppression_power=40,
            suppression_type="field",
            target_resistance=50,
        )
        assert result.level == SuppressionLevel.SEALED

    def test_unknown_type_defaults_to_1(self):
        """Unknown suppression type → multiplier 1.0."""
        result = check_suppression(
            suppression_power=30,
            suppression_type="unknown_type",
            target_resistance=50,
        )
        assert result.level == SuppressionLevel.NONE

    # ── Edge cases ──

    def test_zero_power(self):
        """Power 0 → always NONE."""
        result = check_suppression(suppression_power=0, target_resistance=50)
        assert result.level == SuppressionLevel.NONE

    def test_zero_resistance(self):
        """Resistance 0 → even weak power suppresses."""
        result = check_suppression(suppression_power=10, target_resistance=0)
        assert result.level == SuppressionLevel.SUPPRESSED

    def test_max_values(self):
        """Extreme max values → no crash."""
        result = check_suppression(
            suppression_power=100,
            suppression_type="field",
            target_resistance=0,
        )
        assert result.level == SuppressionLevel.NULLIFIED
        assert isinstance(result, SuppressionResult)

    def test_ultimate_resists_normal_skill(self):
        """Ultimate stage (resist=95) resists normal skill power."""
        result = check_suppression(
            suppression_power=80,
            suppression_type="skill",    # × 1.0 = 80
            target_resistance=95,        # gap = -15
        )
        assert result.level == SuppressionLevel.NONE

    def test_ultimate_vulnerable_to_field(self):
        """Even Ultimate stage can be nullified by Anti-Unique Field."""
        result = check_suppression(
            suppression_power=80,
            suppression_type="field",    # × 2.0 = 160
            target_resistance=95,        # gap = 65
        )
        assert result.level == SuppressionLevel.NULLIFIED

    def test_all_results_have_reason(self):
        """Every outcome has non-empty reason."""
        for power in [10, 55, 80, 100]:
            result = check_suppression(
                suppression_power=power, target_resistance=50
            )
            assert result.reason


class TestGetStageResistance:
    """Test growth stage → default resistance mapping."""

    def test_seed(self):
        assert get_stage_resistance("seed") == 50.0

    def test_bloom(self):
        assert get_stage_resistance("bloom") == 65.0

    def test_aspect(self):
        assert get_stage_resistance("aspect") == 80.0

    def test_ultimate(self):
        assert get_stage_resistance("ultimate") == 95.0

    def test_unknown_defaults_to_seed(self):
        assert get_stage_resistance("unknown") == 50.0

    def test_stage_resistance_dict_complete(self):
        """All 4 stages present in STAGE_RESISTANCE."""
        assert set(STAGE_RESISTANCE.keys()) == {"seed", "bloom", "aspect", "ultimate"}
