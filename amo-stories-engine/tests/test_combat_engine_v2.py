"""Tests for Phase B — Multi-Phase Combat Engine.

Covers:
- Action handlers (Strike, Shift, Stabilize)
- Stability tier effects
- Floor modifiers
- resolve_combat_phase() with all 3 actions × 3 intensities
- generate_decision_point() context-awareness
- run_resolution_combat() for Minor/Duel/Boss encounters
- build_combat_result() identity impact mapping
"""

import pytest

from app.engine.combat import (
    # Existing
    CombatOutcome,
    EnemyProfile,
    Intensity,
    # Phase B
    get_stability_tier,
    apply_stability_tier_effects,
    apply_floor_modifier,
    compute_strike_effects,
    compute_shift_effects,
    compute_stabilize_effects,
    resolve_combat_phase,
    generate_decision_point,
    run_resolution_combat,
    build_combat_result,
    ACTION_SCORE_MODIFIER,
    STABILIZE_RECOVERY,
)
from app.models.combat import (
    BossPhase,
    BossTemplate,
    CombatAction,
    CombatApproach,
    EncounterType,
    FloorModifier,
    StabilityTier,
)
from app.models.power import CombatMetrics, NormalSkill, ResonanceState


# ═══════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════

@pytest.fixture
def default_resonance():
    return ResonanceState(order=0.5, entropy=0.5, matter=0.5, flux=0.5, energy=0.5, void=0.5)

@pytest.fixture
def default_metrics():
    return CombatMetrics(hp=100.0, stability=80.0, dqs_ratio=0.6, instability=10.0)

@pytest.fixture
def default_skill():
    return NormalSkill(
        name="Test Strike",
        primary_principle="energy",
        mechanic="Launches energy bolt",
        tier=1,
    )

@pytest.fixture
def default_enemy():
    return EnemyProfile(
        name="Shadow Beast",
        principle="matter",
        threat_level=0.5,
        description="A lurking shadow creature",
    )

@pytest.fixture
def boss_template():
    return BossTemplate(
        boss_id="test_boss",
        name="Test Guardian",
        floor=1,
        primary_principle="matter",
        enemy_type="structural",
        base_hp=100.0,
        base_stability=80.0,
        phases=[
            BossPhase(phase_number=1, name="Shield", hp_threshold=1.0,
                      dominant_principle="matter", stability_pressure="low",
                      tell_pattern="Shields glow"),
            BossPhase(phase_number=2, name="Fury", hp_threshold=0.5,
                      dominant_principle="energy", stability_pressure="high",
                      tell_pattern="Ground trembles",
                      special_mechanic="AoE tremor"),
        ],
    )


# ═══════════════════════════════════════════════
# Stability Tier Tests
# ═══════════════════════════════════════════════

class TestApplyStabilityTierEffects:
    def test_normal_no_penalties(self):
        effects = apply_stability_tier_effects(StabilityTier.NORMAL, Intensity.OVERDRIVE, 0.5)
        assert effects["score_modifier"] == 0.0
        assert effects["overdrive_blocked"] is False
        assert effects["misfire"] is False
        assert effects["effective_intensity"] == Intensity.OVERDRIVE

    def test_critical_blocks_overdrive(self):
        effects = apply_stability_tier_effects(StabilityTier.CRITICAL, Intensity.OVERDRIVE, 0.5)
        assert effects["overdrive_blocked"] is True
        assert effects["effective_intensity"] == Intensity.PUSH  # Downgraded

    def test_broken_high_misfire(self):
        # misfire_chance = 0.50, crng_roll = 0.3 → misfire occurs
        effects = apply_stability_tier_effects(StabilityTier.BROKEN, Intensity.SAFE, 0.3)
        assert effects["misfire"] is True

    def test_normal_no_misfire(self):
        # misfire_chance = 0.0, any crng_roll → no misfire
        effects = apply_stability_tier_effects(StabilityTier.NORMAL, Intensity.SAFE, 0.0)
        assert effects["misfire"] is False


# ═══════════════════════════════════════════════
# Floor Modifier Tests
# ═══════════════════════════════════════════════

class TestApplyFloorModifier:
    def test_no_modifier(self, default_skill):
        result = apply_floor_modifier(0.5, default_skill, "matter", None)
        assert result == 0.5

    def test_with_buff(self, default_skill):
        fm = FloorModifier(floor=1, principle_buffs={"energy": 0.1})
        result = apply_floor_modifier(0.5, default_skill, "matter", fm)
        assert result == pytest.approx(0.6, abs=0.01)

    def test_enemy_nerf(self, default_skill):
        fm = FloorModifier(floor=1, principle_nerfs={"matter": -0.1})
        result = apply_floor_modifier(0.5, default_skill, "matter", fm)
        # Gives player a bonus because enemy is nerfed here
        assert result == pytest.approx(0.6, abs=0.01)


# ═══════════════════════════════════════════════
# Action Handler Tests
# ═══════════════════════════════════════════════

class TestComputeStrikeEffects:
    def test_favorable_full_damage(self):
        effects = compute_strike_effects(
            combat_score=0.7, outcome=CombatOutcome.FAVORABLE,
            intensity=Intensity.PUSH, enemy_hp=100, enemy_stability=80,
        )
        assert effects["structural_damage"] > 0
        assert effects["stability_damage"] > 0
        assert effects["enemy_hp_after"] < 100

    def test_unfavorable_reduced_damage(self):
        fav = compute_strike_effects(
            combat_score=0.7, outcome=CombatOutcome.FAVORABLE,
            intensity=Intensity.PUSH, enemy_hp=100, enemy_stability=80,
        )
        unfav = compute_strike_effects(
            combat_score=0.7, outcome=CombatOutcome.UNFAVORABLE,
            intensity=Intensity.PUSH, enemy_hp=100, enemy_stability=80,
        )
        assert unfav["structural_damage"] < fav["structural_damage"]

    def test_overdrive_more_damage(self):
        safe = compute_strike_effects(
            combat_score=0.5, outcome=CombatOutcome.MIXED,
            intensity=Intensity.SAFE, enemy_hp=100, enemy_stability=80,
        )
        od = compute_strike_effects(
            combat_score=0.5, outcome=CombatOutcome.MIXED,
            intensity=Intensity.OVERDRIVE, enemy_hp=100, enemy_stability=80,
        )
        assert od["structural_damage"] > safe["structural_damage"]


class TestComputeShiftEffects:
    def test_less_damage_than_strike(self):
        strike = compute_strike_effects(
            combat_score=0.5, outcome=CombatOutcome.MIXED,
            intensity=Intensity.PUSH, enemy_hp=100, enemy_stability=80,
        )
        shift = compute_shift_effects(
            combat_score=0.5, outcome=CombatOutcome.MIXED,
            intensity=Intensity.PUSH, enemy_hp=100, enemy_stability=80,
        )
        assert shift["structural_damage"] < strike["structural_damage"]

    def test_adapt_bonus_base(self):
        effects = compute_shift_effects(
            combat_score=0.5, outcome=CombatOutcome.MIXED,
            intensity=Intensity.SAFE, enemy_hp=100, enemy_stability=80,
        )
        assert effects["adapt_bonus_next_phase"] == 0.05

    def test_adapt_bonus_phase_shift(self):
        phase2 = BossPhase(
            phase_number=2, name="Fury", hp_threshold=0.5,
            dominant_principle="energy",
        )
        effects = compute_shift_effects(
            combat_score=0.5, outcome=CombatOutcome.MIXED,
            intensity=Intensity.SAFE, enemy_hp=100, enemy_stability=80,
            boss_phase=phase2,
        )
        assert effects["adapt_bonus_next_phase"] == 0.10  # Double for phase shift


class TestComputeStabilizeEffects:
    def test_recovers_stability(self):
        effects = compute_stabilize_effects(
            intensity=Intensity.SAFE,
            player_stability=50.0,
            player_instability=20.0,
        )
        assert effects["stability_recovered"] == 15.0
        assert effects["player_stability_after"] == 65.0
        assert effects["structural_damage"] == 0.0

    def test_reduces_instability(self):
        effects = compute_stabilize_effects(
            intensity=Intensity.SAFE,
            player_stability=50.0,
            player_instability=20.0,
        )
        assert effects["instability_reduction"] == 2.0
        assert effects["player_instability_after"] == 18.0

    def test_overdrive_less_recovery(self):
        safe = compute_stabilize_effects(Intensity.SAFE, 50.0, 10.0)
        od = compute_stabilize_effects(Intensity.OVERDRIVE, 50.0, 10.0)
        assert od["stability_recovered"] < safe["stability_recovered"]


# ═══════════════════════════════════════════════
# resolve_combat_phase Tests
# ═══════════════════════════════════════════════

class TestResolveCombatPhase:
    def test_basic_strike_phase(self, default_resonance, default_metrics, default_skill, default_enemy):
        result = resolve_combat_phase(
            resonance=default_resonance,
            metrics=default_metrics,
            skill=default_skill,
            enemy=default_enemy,
            action=CombatAction.STRIKE,
            intensity=Intensity.PUSH,
            phase_number=1,
        )
        assert result.phase_number == 1
        assert result.action_taken == "strike"
        assert result.intensity_used == "push"
        assert result.combat_score > 0
        assert result.enemy_hp_remaining < 100

    def test_stabilize_recovers_stability(self, default_resonance, default_metrics, default_skill, default_enemy):
        initial_stability = default_metrics.stability
        result = resolve_combat_phase(
            resonance=default_resonance,
            metrics=default_metrics,
            skill=default_skill,
            enemy=default_enemy,
            action=CombatAction.STABILIZE,
            intensity=Intensity.SAFE,
            phase_number=1,
            enemy_hp=100,
            enemy_stability=80,
        )
        assert result.action_taken == "stabilize"
        # Enemy HP unchanged for stabilize
        assert result.enemy_hp_remaining == 100
        assert "Stabilize" in " ".join(result.narrative_cues)

    def test_overdrive_blocked_at_critical_stability(self, default_resonance, default_skill, default_enemy):
        metrics = CombatMetrics(hp=100.0, stability=20.0, dqs_ratio=0.5)
        result = resolve_combat_phase(
            resonance=default_resonance,
            metrics=metrics,
            skill=default_skill,
            enemy=default_enemy,
            action=CombatAction.STRIKE,
            intensity=Intensity.OVERDRIVE,
            phase_number=1,
        )
        # Overdrive should be downgraded to push
        assert result.intensity_used == "push"
        cues = " ".join(result.narrative_cues)
        assert "khóa" in cues.lower() or "overdrive" in cues.lower()

    def test_shift_generates_adapt_bonus_narrative(self, default_resonance, default_metrics, default_skill, default_enemy):
        result = resolve_combat_phase(
            resonance=default_resonance,
            metrics=default_metrics,
            skill=default_skill,
            enemy=default_enemy,
            action=CombatAction.SHIFT,
            intensity=Intensity.SAFE,
            phase_number=1,
        )
        assert result.action_taken == "shift"
        assert any("Shift" in cue for cue in result.narrative_cues)


# ═══════════════════════════════════════════════
# Decision Point Generation Tests
# ═══════════════════════════════════════════════

class TestGenerateDecisionPoint:
    def test_generates_3_choices(self):
        dp = generate_decision_point(
            phase_after=2, player_stability=70, enemy_hp=60, enemy_stability=50,
        )
        assert len(dp.choices) == 3
        assert dp.phase_after == 2

    def test_one_per_action_type(self):
        dp = generate_decision_point(
            phase_after=2, player_stability=70, enemy_hp=60, enemy_stability=50,
        )
        actions = {c.action for c in dp.choices}
        assert CombatAction.STRIKE in actions
        assert CombatAction.SHIFT in actions
        assert CombatAction.STABILIZE in actions

    def test_critical_stability_warns(self):
        dp = generate_decision_point(
            phase_after=2, player_stability=15, enemy_hp=60, enemy_stability=50,
        )
        assert "Stability" in dp.context

    def test_enemy_low_hp_hint(self):
        dp = generate_decision_point(
            phase_after=2, player_stability=70, enemy_hp=20, enemy_stability=50,
        )
        assert "yếu" in dp.context.lower() or "kết thúc" in dp.context.lower()

    def test_boss_phase_context(self):
        phase = BossPhase(
            phase_number=2, name="Fury", hp_threshold=0.5,
            dominant_principle="energy", special_mechanic="AoE tremor",
        )
        dp = generate_decision_point(
            phase_after=2, player_stability=70, enemy_hp=60, enemy_stability=50,
            boss_phase=phase,
        )
        assert "Fury" in dp.context
        assert "AoE tremor" in dp.context

    def test_stability_preview_present(self):
        dp = generate_decision_point(
            phase_after=2, player_stability=70, enemy_hp=60, enemy_stability=50,
        )
        for choice in dp.choices:
            assert "Stability:" in choice.stability_preview


# ═══════════════════════════════════════════════
# Full Encounter Tests
# ═══════════════════════════════════════════════

class TestRunResolutionCombat:
    def test_minor_auto_resolve(self, default_resonance, default_metrics, default_skill, default_enemy):
        brief = run_resolution_combat(
            resonance=default_resonance,
            metrics=default_metrics,
            skill=default_skill,
            enemy=default_enemy,
            encounter_type=EncounterType.MINOR,
        )
        assert brief.encounter_type == "minor"
        assert len(brief.phases) == 1
        assert len(brief.decision_points) == 0
        assert brief.is_complete is True
        assert brief.final_outcome in ("player_wins", "enemy_wins", "draw")

    def test_duel_2_phases(self, default_resonance, default_metrics, default_skill, default_enemy):
        decisions = [
            CombatApproach(action=CombatAction.STRIKE, intensity="push"),
            CombatApproach(action=CombatAction.STRIKE, intensity="safe"),
        ]
        brief = run_resolution_combat(
            resonance=default_resonance,
            metrics=default_metrics,
            skill=default_skill,
            enemy=default_enemy,
            encounter_type=EncounterType.DUEL,
            player_decisions=decisions,
        )
        assert brief.encounter_type == "duel"
        assert len(brief.phases) == 2
        assert len(brief.decision_points) == 1  # Between phase 1 and 2
        assert brief.is_complete is True

    def test_boss_3_phases(self, default_resonance, default_metrics, default_skill, default_enemy, boss_template):
        decisions = [
            CombatApproach(action=CombatAction.STRIKE, intensity="push"),
            CombatApproach(action=CombatAction.SHIFT, intensity="safe"),
            CombatApproach(action=CombatAction.STRIKE, intensity="overdrive"),
        ]
        enemy = EnemyProfile(
            name="Test Guardian",
            principle="matter",
            threat_level=0.5,
        )
        brief = run_resolution_combat(
            resonance=default_resonance,
            metrics=default_metrics,
            skill=default_skill,
            enemy=enemy,
            encounter_type=EncounterType.BOSS,
            boss_template=boss_template,
            player_decisions=decisions,
        )
        assert brief.encounter_type == "boss"
        # Boss might end early if enemy HP hits 0
        assert len(brief.phases) >= 2
        assert brief.decision_points is not None
        assert brief.boss_id == "test_boss"

    def test_auto_fill_decisions(self, default_resonance, default_metrics, default_skill, default_enemy):
        # No decisions provided → auto-fill with Strike/Safe
        brief = run_resolution_combat(
            resonance=default_resonance,
            metrics=default_metrics,
            skill=default_skill,
            enemy=default_enemy,
            encounter_type=EncounterType.DUEL,
        )
        assert len(brief.phases) == 2
        for phase in brief.phases:
            assert phase.action_taken == "strike"

    def test_player_state_mutated(self, default_resonance, default_metrics, default_skill, default_enemy):
        initial_hp = default_metrics.hp
        run_resolution_combat(
            resonance=default_resonance,
            metrics=default_metrics,
            skill=default_skill,
            enemy=default_enemy,
            encounter_type=EncounterType.DUEL,
        )
        # State should have changed after combat
        assert default_metrics.hp <= initial_hp or default_metrics.stability < 80.0

    def test_floor_progress_on_boss_win(self, default_resonance, default_skill, boss_template):
        # Give player very high stats to ensure win
        metrics = CombatMetrics(hp=100.0, stability=100.0, dqs_ratio=0.9)
        resonance = ResonanceState(order=0.9, entropy=0.9, matter=0.9, flux=0.9, energy=0.9, void=0.9)
        enemy = EnemyProfile(name="Test Guardian", principle="matter", threat_level=0.2)
        decisions = [
            CombatApproach(action=CombatAction.STRIKE, intensity="overdrive"),
            CombatApproach(action=CombatAction.STRIKE, intensity="overdrive"),
            CombatApproach(action=CombatAction.STRIKE, intensity="overdrive"),
        ]
        brief = run_resolution_combat(
            resonance=resonance,
            metrics=metrics,
            skill=default_skill,
            enemy=enemy,
            encounter_type=EncounterType.BOSS,
            boss_template=boss_template,
            player_decisions=decisions,
        )
        if brief.final_outcome == "player_wins":
            assert brief.floor_progress is True


# ═══════════════════════════════════════════════
# build_combat_result Tests
# ═══════════════════════════════════════════════

class TestBuildCombatResult:
    def test_player_wins(self, default_resonance, default_metrics, default_skill, default_enemy):
        brief = run_resolution_combat(
            resonance=default_resonance,
            metrics=default_metrics,
            skill=default_skill,
            enemy=default_enemy,
            encounter_type=EncounterType.MINOR,
        )
        result = build_combat_result(brief)
        assert result.encounter_type == "minor"
        assert result.decision_count == 0
        assert isinstance(result.dqs_change, float)
        assert isinstance(result.breakthrough_change, float)

    def test_dqs_increases_on_favorable(self):
        """Favorable outcomes should increase DQS."""
        from app.models.combat import CombatBriefV2, PhaseResult
        brief = CombatBriefV2(
            encounter_type="duel",
            final_outcome="player_wins",
            phases=[
                PhaseResult(phase_number=1, outcome="favorable", intensity_used="push"),
                PhaseResult(phase_number=2, outcome="favorable", intensity_used="push"),
            ],
            player_state_after={"hp": 80.0, "stability": 60.0},
        )
        result = build_combat_result(brief)
        assert result.dqs_change > 0

    def test_breakthrough_from_overdrive(self):
        """Overdrive usage should increase breakthrough meter."""
        from app.models.combat import CombatBriefV2, PhaseResult
        brief = CombatBriefV2(
            encounter_type="boss",
            final_outcome="player_wins",
            phases=[
                PhaseResult(phase_number=1, outcome="mixed", intensity_used="overdrive"),
            ],
            player_state_after={"hp": 50.0, "stability": 30.0},
        )
        result = build_combat_result(brief)
        assert result.breakthrough_change == 5.0
