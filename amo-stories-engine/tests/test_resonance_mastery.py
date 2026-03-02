"""Tests for Resonance Mastery engine.

Covers: update_resonance_after_combat, check_stability_trial,
check_floor_attunement, resonance_to_prose, build_resonance_context.

Ref: SKILL_EVOLUTION_SPEC v1.1 §7
"""

import pytest

from app.models.skill_evolution import ResonanceMasteryState
from app.engine.resonance_mastery import (
    update_resonance_after_combat,
    is_conflicting_use,
    check_stability_trial,
    check_floor_attunement,
    resonance_to_prose,
    build_resonance_context,
    OUTCOME_DELTAS,
    DECAY_AMOUNT,
    DECAY_MIN_FLOOR,
)


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture
def resonance():
    """Standard resonance dict."""
    return {
        "energy": 0.40,
        "order": 0.30,
        "entropy": 0.15,
        "matter": 0.20,
        "flux": 0.10,
        "void": 0.10,
    }


@pytest.fixture
def mastery():
    """Fresh ResonanceMasteryState."""
    return ResonanceMasteryState(player_id="test")


# ──────────────────────────────────────────────
# Resonance Growth / Decay
# ──────────────────────────────────────────────

class TestUpdateResonanceAfterCombat:
    """Test resonance growth from combat outcomes (spec §7.2)."""

    def test_favorable_grows_003(self, resonance):
        """Favorable outcome → +0.03 to used principle."""
        update_resonance_after_combat(
            resonance, "energy", "favorable", current_floor=1,
        )
        assert resonance["energy"] == pytest.approx(0.43, abs=0.001)

    def test_mixed_grows_002(self, resonance):
        """Mixed outcome → +0.02."""
        update_resonance_after_combat(
            resonance, "energy", "mixed", current_floor=1,
        )
        assert resonance["energy"] == pytest.approx(0.42, abs=0.001)

    def test_unfavorable_grows_001(self, resonance):
        """Unfavorable outcome → +0.01."""
        update_resonance_after_combat(
            resonance, "energy", "unfavorable", current_floor=1,
        )
        assert resonance["energy"] == pytest.approx(0.41, abs=0.001)

    def test_floor_cap(self, resonance):
        """Growth capped by floor (Floor 1 = 0.5)."""
        resonance["energy"] = 0.49
        update_resonance_after_combat(
            resonance, "energy", "favorable", current_floor=1,
        )
        assert resonance["energy"] == pytest.approx(0.50, abs=0.001)

    def test_floor_3_cap(self, resonance):
        """Floor 3 cap = 0.85."""
        resonance["energy"] = 0.83
        update_resonance_after_combat(
            resonance, "energy", "favorable", current_floor=3,
        )
        assert resonance["energy"] == pytest.approx(0.85, abs=0.001)

    def test_personal_cap_bonus(self, resonance):
        """Personal cap bonus extends effective cap."""
        resonance["energy"] = 0.49
        update_resonance_after_combat(
            resonance, "energy", "favorable",
            current_floor=1, personal_cap_bonus=0.1,
        )
        # Floor 1 cap = 0.5 + 0.1 bonus = 0.6 effective
        assert resonance["energy"] == pytest.approx(0.52, abs=0.001)

    def test_decay_unused_principles(self, resonance):
        """Unused principles decay by 0.005."""
        original_order = resonance["order"]
        update_resonance_after_combat(
            resonance, "energy", "favorable", current_floor=1,
        )
        assert resonance["order"] == pytest.approx(
            original_order - DECAY_AMOUNT, abs=0.001,
        )

    def test_decay_min_floor(self, resonance):
        """Decay doesn't go below 0.1."""
        resonance["void"] = 0.10
        update_resonance_after_combat(
            resonance, "energy", "favorable", current_floor=1,
        )
        assert resonance["void"] == pytest.approx(DECAY_MIN_FLOOR, abs=0.001)

    def test_used_principle_not_decayed(self, resonance):
        """The used principle should NOT be decayed."""
        original = resonance["energy"]
        update_resonance_after_combat(
            resonance, "energy", "favorable", current_floor=1,
        )
        # Energy should go UP, not down
        assert resonance["energy"] > original


# ──────────────────────────────────────────────
# Conflicting Use Detection
# ──────────────────────────────────────────────

class TestIsConflictingUse:
    """Test opposing principle detection."""

    def test_opposing_with_both_high(self):
        """Energy + Void both high → conflicting."""
        resonance = {"energy": 0.5, "void": 0.3}
        assert is_conflicting_use("energy", resonance) is True

    def test_opposing_one_low(self):
        """Energy high but Void low → not conflicting."""
        resonance = {"energy": 0.5, "void": 0.1}
        assert is_conflicting_use("energy", resonance) is False

    def test_non_opposing_both_high(self):
        """Energy + Order both high → not conflicting (not opposing)."""
        resonance = {"energy": 0.5, "order": 0.5}
        # Order.opposite = entropy, not energy
        assert is_conflicting_use("order", resonance) is False

    def test_invalid_principle(self):
        """Invalid principle → not conflicting."""
        assert is_conflicting_use("invalid", {}) is False


# ──────────────────────────────────────────────
# Stability Trial
# ──────────────────────────────────────────────

class TestCheckStabilityTrial:
    """Test stability trial milestone (spec §7.3.1)."""

    def test_trial_completes_at_5(self, mastery):
        """5 conflicting uses without backlash → trial passes."""
        # Both energy and void have sufficient resonance
        resonance = {"energy": 0.5, "void": 0.3}
        for _ in range(4):
            assert check_stability_trial(mastery, "energy", resonance, False) is False

        # 5th time → trial passes!
        assert check_stability_trial(mastery, "energy", resonance, False) is True
        assert mastery.personal_cap_bonus == pytest.approx(0.1)
        assert mastery.stability_trials_passed == 1
        assert mastery.stability_trial_tracker == 0  # Reset

    def test_backlash_reduces_progress(self, mastery):
        """Backlash reduces tracker by 1."""
        resonance = {"energy": 0.5, "void": 0.3}
        # 3 successful conflicting uses
        for _ in range(3):
            check_stability_trial(mastery, "energy", resonance, False)
        assert mastery.stability_trial_tracker == 3

        # Backlash → tracker -1
        check_stability_trial(mastery, "energy", resonance, True)
        assert mastery.stability_trial_tracker == 2

    def test_max_3_trials(self, mastery):
        """After 3 trials, no more cap increases."""
        mastery.stability_trials_passed = 3
        mastery.personal_cap_bonus = 0.3
        resonance = {"energy": 0.5, "void": 0.3}

        for _ in range(10):
            check_stability_trial(mastery, "energy", resonance, False)

        assert mastery.personal_cap_bonus == pytest.approx(0.3)
        assert mastery.stability_trials_passed == 3

    def test_non_conflicting_use_not_tracked(self, mastery):
        """Non-conflicting use doesn't increment tracker."""
        resonance = {"energy": 0.5, "void": 0.05}  # void too low
        check_stability_trial(mastery, "energy", resonance, False)
        assert mastery.stability_trial_tracker == 0


# ──────────────────────────────────────────────
# Floor Attunement
# ──────────────────────────────────────────────

class TestCheckFloorAttunement:
    """Test floor boss attunement (spec §7.3)."""

    def test_first_clear(self, mastery, resonance):
        """First boss clear → attunement + resonance +0.1."""
        result = check_floor_attunement(
            mastery, floor=2, boss_cleared=True,
            resonance=resonance, dominant_principle="energy",
        )
        assert result is True
        assert 2 in mastery.floor_attunements
        assert resonance["energy"] == pytest.approx(0.50, abs=0.001)

    def test_duplicate_clear(self, mastery, resonance):
        """Same floor cleared again → no bonus."""
        mastery.floor_attunements = [2]
        result = check_floor_attunement(
            mastery, floor=2, boss_cleared=True,
            resonance=resonance, dominant_principle="energy",
        )
        assert result is False
        assert resonance["energy"] == pytest.approx(0.40, abs=0.001)

    def test_no_boss_cleared(self, mastery, resonance):
        """No boss cleared → no attunement."""
        result = check_floor_attunement(
            mastery, floor=2, boss_cleared=False,
            resonance=resonance, dominant_principle="energy",
        )
        assert result is False

    def test_resonance_capped_at_1(self, mastery, resonance):
        """Attunement bonus capped at 1.0."""
        resonance["energy"] = 0.95
        check_floor_attunement(
            mastery, floor=5, boss_cleared=True,
            resonance=resonance, dominant_principle="energy",
        )
        assert resonance["energy"] == pytest.approx(1.0, abs=0.001)


# ──────────────────────────────────────────────
# Prose Descriptors
# ──────────────────────────────────────────────

class TestResonanceToProse:
    """Test prose conversion (spec §7.4, §10.3)."""

    def test_strong(self):
        assert resonance_to_prose(0.85) == "cộng hưởng mạnh mẽ"

    def test_moderate(self):
        assert resonance_to_prose(0.45) == "cộng hưởng vừa phải"

    def test_weak(self):
        assert resonance_to_prose(0.25) == "cộng hưởng yếu"

    def test_minimal(self):
        assert resonance_to_prose(0.05) == "hầu như không cộng hưởng"

    def test_build_context(self):
        """build_resonance_context returns only non-zero principles."""
        resonance = {"energy": 0.7, "void": 0.0, "order": 0.3}
        ctx = build_resonance_context(resonance)
        assert "energy" in ctx
        assert "order" in ctx
        assert "void" not in ctx
        assert ctx["energy"] == "cộng hưởng rõ rệt"


# ──────────────────────────────────────────────
# Overdrive Control
# ──────────────────────────────────────────────

from app.engine.resonance_mastery import check_overdrive_control

class TestCheckOverdriveControl:
    """Test overdrive control milestone (spec §7.3 table)."""

    def test_3_successes_triggers(self, mastery):
        """3 successful overdrives → milestone."""
        for _ in range(2):
            assert check_overdrive_control(mastery, overdrive_used=True, overdrive_misfire=False) is False

        assert check_overdrive_control(mastery, overdrive_used=True, overdrive_misfire=False) is True
        assert mastery.overdrive_risk_reduction == pytest.approx(-0.05)
        assert mastery.overdrive_successes == 0  # Reset

    def test_misfire_reduces_streak(self, mastery):
        """Misfire reduces overdrive_successes by 1."""
        # 2 successes
        check_overdrive_control(mastery, True, False)
        check_overdrive_control(mastery, True, False)
        assert mastery.overdrive_successes == 2

        # Misfire → 1
        check_overdrive_control(mastery, True, True)
        assert mastery.overdrive_successes == 1

    def test_max_2_milestones(self, mastery):
        """After 2 milestones (-10%), no more reductions."""
        mastery.overdrive_risk_reduction = -0.10

        for _ in range(5):
            check_overdrive_control(mastery, True, False)

        assert mastery.overdrive_risk_reduction == pytest.approx(-0.10)

    def test_not_used_no_effect(self, mastery):
        """Overdrive not used → no effect."""
        assert check_overdrive_control(mastery, False, False) is False
        assert mastery.overdrive_successes == 0

    def test_second_milestone_at_6_total(self, mastery):
        """Second milestone at 6 total successes."""
        # First milestone
        for _ in range(3):
            check_overdrive_control(mastery, True, False)
        assert mastery.overdrive_risk_reduction == pytest.approx(-0.05)

        # Second milestone
        for _ in range(3):
            check_overdrive_control(mastery, True, False)
        assert mastery.overdrive_risk_reduction == pytest.approx(-0.10)


# ──────────────────────────────────────────────
# Dual Mastery
# ──────────────────────────────────────────────

from app.engine.resonance_mastery import check_dual_mastery

class TestCheckDualMastery:
    """Test dual mastery milestone (spec §7.3 table)."""

    def test_dual_mastery_triggers(self, mastery):
        """Both principles ≥ 0.5 after boss clear → mastery."""
        resonance = {"energy": 0.6, "order": 0.5, "void": 0.1}
        result = check_dual_mastery(
            mastery, resonance, boss_cleared=True,
            principles_used=["energy", "order"],
        )
        assert result is True
        assert mastery.dual_mastery_count == 1
        assert "energy-order" in mastery.dual_masteries
        # Both get +0.05 boost
        assert resonance["energy"] == pytest.approx(0.65)
        assert resonance["order"] == pytest.approx(0.55)

    def test_no_boss_cleared(self, mastery):
        """No boss clear → no mastery."""
        resonance = {"energy": 0.6, "order": 0.6}
        result = check_dual_mastery(
            mastery, resonance, boss_cleared=False,
            principles_used=["energy", "order"],
        )
        assert result is False

    def test_one_too_low(self, mastery):
        """One principle below 0.5 → no mastery."""
        resonance = {"energy": 0.6, "order": 0.4}
        result = check_dual_mastery(
            mastery, resonance, boss_cleared=True,
            principles_used=["energy", "order"],
        )
        assert result is False

    def test_single_principle(self, mastery):
        """Only 1 principle used → no mastery."""
        resonance = {"energy": 0.6}
        result = check_dual_mastery(
            mastery, resonance, boss_cleared=True,
            principles_used=["energy"],
        )
        assert result is False

    def test_max_2_masteries(self, mastery):
        """After 2 masteries, no more allowed."""
        mastery.dual_mastery_count = 2
        resonance = {"energy": 0.6, "order": 0.6}
        result = check_dual_mastery(
            mastery, resonance, boss_cleared=True,
            principles_used=["energy", "order"],
        )
        assert result is False

    def test_duplicate_pair_blocked(self, mastery):
        """Same pair cannot be mastered twice."""
        mastery.dual_masteries = ["energy-order"]
        resonance = {"energy": 0.6, "order": 0.6}
        result = check_dual_mastery(
            mastery, resonance, boss_cleared=True,
            principles_used=["energy", "order"],
        )
        assert result is False


# ──────────────────────────────────────────────
# EVOLUTION_BEATS Integration
# ──────────────────────────────────────────────

from app.engine.skill_evolution import EVOLUTION_BEATS
from app.models.skill_evolution import EvolutionType

class TestEvolutionBeats:
    """Test EVOLUTION_BEATS planner dict (spec §10.2)."""

    def test_all_types_present(self):
        """All 4 evolution types have a beat entry."""
        for et in EvolutionType:
            assert et in EVOLUTION_BEATS

    def test_mutation_is_critical(self):
        assert EVOLUTION_BEATS[EvolutionType.MUTATION]["priority"] == "critical"

    def test_mutation_3_scenes(self):
        assert EVOLUTION_BEATS[EvolutionType.MUTATION]["scenes_needed"] == 3

    def test_awakening_low_priority(self):
        assert EVOLUTION_BEATS[EvolutionType.AWAKENING]["priority"] == "low"
        assert EVOLUTION_BEATS[EvolutionType.AWAKENING]["scenes_needed"] == 0

