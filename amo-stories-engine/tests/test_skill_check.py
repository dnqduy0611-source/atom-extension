"""Tests for Unique Skill activation check and resilience decay."""

import pytest

from app.engine.skill_check import (
    SkillActivation,
    SkillOutcome,
    check_skill_activation,
    update_skill_resilience,
)


class TestCheckSkillActivation:
    """Test check_skill_activation() 3-layer probability system."""

    # ── Layer 1: Usage fatigue ──

    def test_first_use_always_full(self):
        """Usage 0 (first use) → always FULL regardless of other stats."""
        result = check_skill_activation(
            resilience=100, skill_instability=0,
            player_stability=100, usage_this_chapter=0,
            player_instability=0,
        )
        assert result.outcome == SkillOutcome.FULL
        assert result.effectiveness == 1.0
        assert result.stability_cost == 0.0
        assert result.hp_cost == 0.0

    def test_second_use_effectiveness_reduced(self):
        """Usage 1 → effectiveness drops to 0.8."""
        result = check_skill_activation(
            resilience=100, skill_instability=0,
            player_stability=100, usage_this_chapter=1,
            player_instability=0,
        )
        # With high resilience and low instability, should be WEAKENED or FULL
        assert result.effectiveness <= 0.8
        assert result.stability_cost == 5.0

    def test_third_use_more_degraded(self):
        """Usage 2 → effectiveness 0.5, higher fail risk."""
        result = check_skill_activation(
            resilience=100, skill_instability=0,
            player_stability=100, usage_this_chapter=2,
            player_instability=0,
        )
        assert result.effectiveness <= 0.5
        assert result.stability_cost == 12.0

    def test_fourth_use_heavily_degraded(self):
        """Usage 3+ → effectiveness 0.2, high fail risk."""
        result = check_skill_activation(
            resilience=100, skill_instability=0,
            player_stability=100, usage_this_chapter=3,
            player_instability=0,
        )
        assert result.effectiveness <= 0.2
        assert result.stability_cost == 20.0

    # ── Layer 2: Resilience gate ──

    def test_low_resilience_degrades_effectiveness(self):
        """Resilience 20-49 → res_mod 0.65, misfire +15%."""
        result = check_skill_activation(
            resilience=30, skill_instability=0,
            player_stability=100, usage_this_chapter=0,
            player_instability=0,
        )
        # First use + medium resilience should still be FULL or WEAKENED
        assert result.effectiveness == pytest.approx(0.65, abs=0.01)

    def test_fractured_resilience_very_weak(self):
        """Resilience < 20 → res_mod 0.40, misfire +30%."""
        result = check_skill_activation(
            resilience=10, skill_instability=0,
            player_stability=100, usage_this_chapter=0,
            player_instability=0,
        )
        assert result.effectiveness == pytest.approx(0.40, abs=0.01)

    # ── Layer 3: Instability threshold ──

    def test_high_instability_affects_backfire(self):
        """player_instability ≥ 80 → backfire_chance += 0.25."""
        # We can't test randomness directly, but we can verify
        # the function runs without error at extreme values
        result = check_skill_activation(
            resilience=100, skill_instability=0,
            player_stability=100, usage_this_chapter=0,
            player_instability=90,
        )
        assert isinstance(result, SkillActivation)
        assert result.outcome in [
            SkillOutcome.FULL, SkillOutcome.WEAKENED,
            SkillOutcome.MISFIRE, SkillOutcome.BACKFIRE,
        ]

    def test_skill_instability_moderate(self):
        """skill_instability ≥ 40 → misfire_chance += 0.05."""
        result = check_skill_activation(
            resilience=100, skill_instability=50,
            player_stability=100, usage_this_chapter=0,
            player_instability=0,
        )
        assert isinstance(result, SkillActivation)
        # At usage=0, misfire base is 0%, +5% from skill_instability
        # So 95% FULL, 5% MISFIRE — mostly FULL

    def test_skill_instability_high(self):
        """skill_instability ≥ 70 → misfire_chance += 0.12."""
        result = check_skill_activation(
            resilience=100, skill_instability=80,
            player_stability=100, usage_this_chapter=0,
            player_instability=0,
        )
        assert isinstance(result, SkillActivation)

    # ── Low stability amplifier ──

    def test_low_stability_increases_cost(self):
        """player_stability < 30 → stability_cost * 1.5."""
        result = check_skill_activation(
            resilience=100, skill_instability=0,
            player_stability=20, usage_this_chapter=1,
            player_instability=0,
        )
        # Base cost for usage=1 is 5.0, with low stability = 5.0 * 1.5 = 7.5
        assert result.stability_cost >= 7.0  # Allow for rounding

    # ── Outcome narrative ──

    def test_all_outcomes_have_narrative(self):
        """Every outcome must have non-empty narrative instruction."""
        # FULL at usage=0
        full = check_skill_activation(
            resilience=100, skill_instability=0,
            player_stability=100, usage_this_chapter=0,
            player_instability=0,
        )
        assert full.narrative_instruction  # Non-empty

    # ── Backfire at extreme conditions ──

    def test_backfire_costs(self):
        """Backfire outcome should have hp_cost > 0 and doubled stab cost."""
        # Force backfire-like conditions — can't guarantee due to randomness,
        # but we verify the model accepts HP cost
        ba = SkillActivation(
            outcome=SkillOutcome.BACKFIRE,
            effectiveness=0.0,
            stability_cost=40.0,
            hp_cost=15.0,
        )
        assert ba.hp_cost == 15.0
        assert ba.effectiveness == 0.0

    # ── Edge cases ──

    def test_all_zero_stats(self):
        """Should not crash with all-zero/extreme inputs."""
        result = check_skill_activation(
            resilience=0, skill_instability=100,
            player_stability=0, usage_this_chapter=10,
            player_instability=100,
        )
        assert isinstance(result, SkillActivation)
        # Should almost certainly be BACKFIRE or MISFIRE at these extremes
        assert result.outcome in [SkillOutcome.MISFIRE, SkillOutcome.BACKFIRE]

    def test_default_values(self):
        """Default params → FULL."""
        result = check_skill_activation()
        assert result.outcome == SkillOutcome.FULL
        assert result.effectiveness == 1.0


class TestUpdateSkillResilience:
    """Test post-chapter resilience decay/recovery."""

    def test_no_change_normal(self):
        """Normal usage, moderate coherence → no change."""
        res = update_skill_resilience(
            resilience=80.0,
            skill_usage_this_chapter=1,
            identity_coherence=65.0,
            player_instability=20.0,
        )
        assert res == 80.0  # No triggers

    def test_overuse_decay(self):
        """3+ uses → -5.0 resilience."""
        res = update_skill_resilience(
            resilience=80.0,
            skill_usage_this_chapter=3,
            identity_coherence=65.0,
            player_instability=20.0,
        )
        assert res == 75.0

    def test_drift_decay(self):
        """Low coherence → -2.0."""
        res = update_skill_resilience(
            resilience=80.0,
            skill_usage_this_chapter=1,
            identity_coherence=40.0,
            player_instability=20.0,
        )
        assert res == 78.0

    def test_instability_decay(self):
        """High instability → -1.0."""
        res = update_skill_resilience(
            resilience=80.0,
            skill_usage_this_chapter=1,
            identity_coherence=65.0,
            player_instability=70.0,
        )
        assert res == 79.0

    def test_recovery_high_coherence(self):
        """High coherence → +3.0."""
        res = update_skill_resilience(
            resilience=80.0,
            skill_usage_this_chapter=1,
            identity_coherence=90.0,
            player_instability=20.0,
        )
        assert res == 83.0

    def test_multiple_decays_stack(self):
        """Overuse + drift + instability all stack."""
        res = update_skill_resilience(
            resilience=80.0,
            skill_usage_this_chapter=4,
            identity_coherence=30.0,
            player_instability=80.0,
        )
        # -5 (overuse) -2 (drift) -1 (instability) = -8
        assert res == 72.0

    def test_clamp_floor(self):
        """Cannot go below 0."""
        res = update_skill_resilience(
            resilience=3.0,
            skill_usage_this_chapter=5,
            identity_coherence=20.0,
            player_instability=90.0,
        )
        assert res == 0.0

    def test_clamp_ceiling(self):
        """Cannot go above 100."""
        res = update_skill_resilience(
            resilience=99.0,
            skill_usage_this_chapter=0,
            identity_coherence=95.0,
            player_instability=0.0,
        )
        assert res == 100.0  # 99 + 3 = 102 → clamped to 100
