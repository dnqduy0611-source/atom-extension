"""Tests for combat engine."""

import random

from app.engine.combat import (
    CombatOutcome,
    EnemyProfile,
    build_combat_brief,
    check_backlash,
    compute_combat_score,
    resolve_combat,
    apply_combat_results,
    STABILITY_COST,
    HP_COST,
    RESONANCE_GROWTH,
)
from app.models.power import (
    CombatMetrics,
    Intensity,
    NormalSkill,
    Principle,
    ResonanceState,
)


# ═══════════════════════════════════════════════
# Helper: create standard test fixtures
# ═══════════════════════════════════════════════

def _player_skill(
    principle: str = "energy",
    tier: int = 1,
    name: str = "Energy Burst",
) -> NormalSkill:
    return NormalSkill(
        id="test_skill",
        name=name,
        primary_principle=principle,
        tier=tier,
        mechanic="Releases concentrated energy",
    )


def _enemy(
    principle: str = "void",
    threat: float = 0.5,
) -> EnemyProfile:
    return EnemyProfile(
        name="Shadow Beast",
        principle=principle,
        threat_level=threat,
        description="A creature of void energy",
    )


# ═══════════════════════════════════════════════
# Combat Score Tests
# ═══════════════════════════════════════════════

class TestComputeCombatScore:
    def test_returns_float_in_range(self):
        r = ResonanceState(energy=0.5)
        m = CombatMetrics()
        score = compute_combat_score(
            r, m, _player_skill(), _enemy(), floor=1,
        )
        assert 0.0 <= score <= 1.0

    def test_high_resonance_high_dqs_gives_better_score(self):
        """Strong player should score higher."""
        strong_res = ResonanceState(energy=0.9)
        strong_met = CombatMetrics(dqs=90, stability=90)

        weak_res = ResonanceState(energy=0.1)
        weak_met = CombatMetrics(dqs=20, stability=30)

        enemy = _enemy(threat=0.5)
        skill = _player_skill()

        strong_score = compute_combat_score(
            strong_res, strong_met, skill, enemy,
        )
        weak_score = compute_combat_score(
            weak_res, weak_met, skill, enemy,
        )
        assert strong_score > weak_score

    def test_principle_advantage_helps(self):
        """Energy vs Void (strong) should beat Energy vs Energy (neutral)."""
        res = ResonanceState(energy=0.5)
        met = CombatMetrics(dqs=50)

        # Energy vs Void → strong advantage
        score_strong = compute_combat_score(
            res, met, _player_skill("energy"), _enemy("void"),
        )
        # Energy vs Energy → neutral
        score_neutral = compute_combat_score(
            res, met, _player_skill("energy"), _enemy("energy"),
        )
        assert score_strong > score_neutral

    def test_higher_threat_lowers_score(self):
        """Tougher enemy should give lower score."""
        res = ResonanceState(energy=0.5)
        met = CombatMetrics(dqs=50)
        skill = _player_skill()

        easy = compute_combat_score(
            res, met, skill, _enemy(threat=0.2),
        )
        hard = compute_combat_score(
            res, met, skill, _enemy(threat=0.8),
        )
        assert easy > hard

    def test_overdrive_intensity_helps(self):
        """Overdrive should give slightly better score."""
        res = ResonanceState(energy=0.5)
        met = CombatMetrics(dqs=50)
        skill = _player_skill()
        enemy = _enemy()

        safe_score = compute_combat_score(
            res, met, skill, enemy, intensity=Intensity.SAFE,
        )
        od_score = compute_combat_score(
            res, met, skill, enemy, intensity=Intensity.OVERDRIVE,
        )
        assert od_score > safe_score

    def test_crng_roll_affects_score(self):
        """Higher CRNG roll → higher score."""
        res = ResonanceState(energy=0.5)
        met = CombatMetrics(dqs=50)
        skill = _player_skill()
        enemy = _enemy()

        low_crng = compute_combat_score(
            res, met, skill, enemy, crng_roll=0.0,
        )
        high_crng = compute_combat_score(
            res, met, skill, enemy, crng_roll=1.0,
        )
        assert high_crng > low_crng

    def test_unique_skill_bonus(self):
        """Unique skill bonus should help."""
        res = ResonanceState(energy=0.5)
        met = CombatMetrics(dqs=50)
        skill = _player_skill()
        enemy = _enemy()

        no_unique = compute_combat_score(
            res, met, skill, enemy,
        )
        with_unique = compute_combat_score(
            res, met, skill, enemy, unique_skill_bonus=0.05,
        )
        assert with_unique > no_unique


# ═══════════════════════════════════════════════
# Resolve Combat Tests
# ═══════════════════════════════════════════════

class TestResolveCombat:
    def test_favorable(self):
        assert resolve_combat(0.75) == CombatOutcome.FAVORABLE
        assert resolve_combat(0.60) == CombatOutcome.FAVORABLE

    def test_mixed(self):
        assert resolve_combat(0.50) == CombatOutcome.MIXED
        assert resolve_combat(0.40) == CombatOutcome.MIXED
        assert resolve_combat(0.59) == CombatOutcome.MIXED

    def test_unfavorable(self):
        assert resolve_combat(0.20) == CombatOutcome.UNFAVORABLE
        assert resolve_combat(0.39) == CombatOutcome.UNFAVORABLE
        assert resolve_combat(0.0) == CombatOutcome.UNFAVORABLE

    def test_boundary_favorable(self):
        assert resolve_combat(0.60) == CombatOutcome.FAVORABLE

    def test_boundary_unfavorable(self):
        assert resolve_combat(0.399) == CombatOutcome.UNFAVORABLE

    def test_narrative_instruction(self):
        for o in CombatOutcome:
            assert o.narrative_instruction  # Non-empty


# ═══════════════════════════════════════════════
# Apply Combat Results Tests
# ═══════════════════════════════════════════════

class TestApplyCombatResults:
    def test_favorable_no_hp_loss(self):
        met = CombatMetrics(hp=100, stability=100)
        res = ResonanceState(energy=0.3)
        effects = apply_combat_results(
            met, res, CombatOutcome.FAVORABLE,
            Intensity.SAFE, _player_skill(),
        )
        assert met.hp == 100.0  # No HP loss on favorable
        assert effects["hp_cost"] == 0.0

    def test_unfavorable_hp_loss(self):
        met = CombatMetrics(hp=100, stability=100)
        res = ResonanceState(energy=0.3)
        apply_combat_results(
            met, res, CombatOutcome.UNFAVORABLE,
            Intensity.SAFE, _player_skill(),
        )
        assert met.hp == 75.0  # 25 HP loss

    def test_stability_cost_by_intensity(self):
        for intensity_val in ["safe", "push", "overdrive"]:
            met = CombatMetrics(stability=100)
            res = ResonanceState()
            intensity = Intensity(intensity_val)
            apply_combat_results(
                met, res, CombatOutcome.MIXED,
                intensity, _player_skill(),
            )
            expected = 100.0 - STABILITY_COST[intensity_val]
            assert met.stability == expected

    def test_backlash_extra_costs(self):
        met = CombatMetrics(hp=100, stability=100)
        res = ResonanceState(energy=0.3)
        apply_combat_results(
            met, res, CombatOutcome.MIXED,
            Intensity.OVERDRIVE, _player_skill(),
            backlash=True,
        )
        # Backlash: 30 * 1.5 = 45 stability + 10+10 = 20 HP
        assert met.stability == 55.0
        assert met.hp == 80.0

    def test_resonance_growth(self):
        met = CombatMetrics()
        res = ResonanceState(energy=0.3)
        effects = apply_combat_results(
            met, res, CombatOutcome.FAVORABLE,
            Intensity.SAFE, _player_skill("energy"),
        )
        assert abs(res.get("energy") - 0.33) < 0.001  # 0.3 + 0.03
        assert effects["resonance_principle"] == "energy"

    def test_resonance_growth_respects_cap(self):
        """Floor 1 cap = 0.50, should not exceed."""
        met = CombatMetrics()
        res = ResonanceState(energy=0.49)
        apply_combat_results(
            met, res, CombatOutcome.FAVORABLE,
            Intensity.SAFE, _player_skill("energy"),
            floor=1,
        )
        assert res.get("energy") == 0.50

    def test_instability_decrease_on_favorable(self):
        met = CombatMetrics(instability=10.0)
        res = ResonanceState()
        apply_combat_results(
            met, res, CombatOutcome.FAVORABLE,
            Intensity.SAFE, _player_skill(),
        )
        assert met.instability == 9.0

    def test_instability_increase_on_unfavorable(self):
        met = CombatMetrics(instability=10.0)
        res = ResonanceState()
        apply_combat_results(
            met, res, CombatOutcome.UNFAVORABLE,
            Intensity.SAFE, _player_skill(),
        )
        assert met.instability == 13.0

    def test_hp_cannot_go_below_zero(self):
        met = CombatMetrics(hp=5.0)
        res = ResonanceState()
        apply_combat_results(
            met, res, CombatOutcome.UNFAVORABLE,
            Intensity.SAFE, _player_skill(),
        )
        assert met.hp == 0.0


# ═══════════════════════════════════════════════
# Backlash Tests
# ═══════════════════════════════════════════════

class TestBacklash:
    def test_safe_never_backlash(self):
        results = [check_backlash(Intensity.SAFE) for _ in range(100)]
        assert all(r is False for r in results)

    def test_overdrive_sometimes_backlash(self):
        random.seed(42)
        results = [check_backlash(Intensity.OVERDRIVE) for _ in range(1000)]
        # With 20% chance and 1000 rolls, should get some True
        assert any(r is True for r in results)
        # Should be roughly ~200 (±50)
        count = sum(results)
        assert 120 < count < 300


# ═══════════════════════════════════════════════
# Build Combat Brief Tests
# ═══════════════════════════════════════════════

class TestBuildCombatBrief:
    def test_returns_combat_brief(self):
        res = ResonanceState(energy=0.5)
        met = CombatMetrics(dqs=60, stability=80)
        skill = _player_skill()
        enemy = _enemy()

        # Fix seed to avoid backlash in this test
        random.seed(0)
        brief = build_combat_brief(
            resonance=res, metrics=met,
            skill=skill, enemy=enemy,
            floor=2, intensity=Intensity.PUSH,
        )

        assert brief.player_skill_name == "Energy Burst"
        assert brief.enemy_name == "Shadow Beast"
        assert 0.0 <= brief.combat_score <= 1.0
        assert brief.outcome in ["favorable", "mixed", "unfavorable"]
        assert brief.outcome_instruction  # Non-empty
        assert brief.intensity == "push"

    def test_unique_skill_fields(self):
        res = ResonanceState(energy=0.5)
        met = CombatMetrics()
        random.seed(0)
        brief = build_combat_brief(
            resonance=res, metrics=met,
            skill=_player_skill(), enemy=_enemy(),
            unique_skill_bonus=0.05,
            unique_skill_name="Vết Nứt Sự Thật",
            unique_skill_mechanic="Sees cracks in lies",
        )
        assert brief.unique_skill_active is True
        assert brief.unique_skill_name == "Vết Nứt Sự Thật"

    def test_principle_advantage_description(self):
        res = ResonanceState(energy=0.5)
        met = CombatMetrics()
        random.seed(0)
        # Energy vs Void = strong
        brief = build_combat_brief(
            resonance=res, metrics=met,
            skill=_player_skill("energy"), enemy=_enemy("void"),
        )
        assert brief.principle_advantage == "strong"
        assert "Năng Lượng" in brief.advantage_description
