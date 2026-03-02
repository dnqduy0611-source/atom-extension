"""Tests for combat models (Phase A) and boss data loader.

Covers:
- Combat enums (CombatAction, EncounterType, StabilityTier, EnemyType)
- Boss system models (BossPhase, BossTemplate)
- Decision point models (DecisionPointChoice, DecisionPoint, CombatApproach)
- Phase result and CombatBriefV2
- CombatResult and FloorModifier
- Boss data loader (JSON files)
"""

import pytest

from app.models.combat import (
    CombatAction,
    CombatApproach,
    CombatBriefV2,
    CombatResult,
    DecisionPoint,
    DecisionPointChoice,
    EncounterType,
    EnemyType,
    FloorModifier,
    BossPhase,
    BossTemplate,
    PhaseResult,
    StabilityTier,
)


# ═══════════════════════════════════════════════
# Enum Tests
# ═══════════════════════════════════════════════

class TestCombatAction:
    def test_values(self):
        assert CombatAction.STRIKE == "strike"
        assert CombatAction.SHIFT == "shift"
        assert CombatAction.STABILIZE == "stabilize"

    def test_all_three(self):
        assert len(CombatAction) == 3


class TestEncounterType:
    def test_values(self):
        assert EncounterType.MINOR == "minor"
        assert EncounterType.DUEL == "duel"
        assert EncounterType.BOSS == "boss"
        assert EncounterType.CLIMAX == "climax"

    def test_decision_point_count(self):
        assert EncounterType.MINOR.decision_point_count == 0
        assert EncounterType.DUEL.decision_point_count == 1
        assert EncounterType.BOSS.decision_point_count == 2
        assert EncounterType.CLIMAX.decision_point_count == 3

    def test_phase_count(self):
        assert EncounterType.MINOR.phase_count == 1
        assert EncounterType.DUEL.phase_count == 2
        assert EncounterType.BOSS.phase_count == 3
        assert EncounterType.CLIMAX.phase_count == 4

    def test_display_name(self):
        assert EncounterType.BOSS.display_name == "Boss"
        assert EncounterType.MINOR.display_name == "Giao Tranh Nhỏ"


class TestStabilityTier:
    def test_from_value_normal(self):
        assert StabilityTier.from_value(100) == StabilityTier.NORMAL
        assert StabilityTier.from_value(75) == StabilityTier.NORMAL
        assert StabilityTier.from_value(60) == StabilityTier.NORMAL

    def test_from_value_unstable(self):
        assert StabilityTier.from_value(59) == StabilityTier.UNSTABLE
        assert StabilityTier.from_value(45) == StabilityTier.UNSTABLE
        assert StabilityTier.from_value(30) == StabilityTier.UNSTABLE

    def test_from_value_critical(self):
        assert StabilityTier.from_value(29) == StabilityTier.CRITICAL
        assert StabilityTier.from_value(15) == StabilityTier.CRITICAL
        assert StabilityTier.from_value(10) == StabilityTier.CRITICAL

    def test_from_value_broken(self):
        assert StabilityTier.from_value(9) == StabilityTier.BROKEN
        assert StabilityTier.from_value(5) == StabilityTier.BROKEN
        assert StabilityTier.from_value(0) == StabilityTier.BROKEN

    def test_effects_overdrive_disabled_at_critical(self):
        assert StabilityTier.NORMAL.effects["overdrive_available"] is True
        assert StabilityTier.UNSTABLE.effects["overdrive_available"] is True
        assert StabilityTier.CRITICAL.effects["overdrive_available"] is False
        assert StabilityTier.BROKEN.effects["overdrive_available"] is False

    def test_effects_misfire_chance_increases(self):
        normal = StabilityTier.NORMAL.effects["misfire_chance"]
        unstable = StabilityTier.UNSTABLE.effects["misfire_chance"]
        critical = StabilityTier.CRITICAL.effects["misfire_chance"]
        broken = StabilityTier.BROKEN.effects["misfire_chance"]
        assert normal < unstable < critical < broken


class TestEnemyType:
    def test_values(self):
        assert EnemyType.STRUCTURAL == "structural"
        assert EnemyType.INSTABILITY == "instability"
        assert EnemyType.PERCEPTION == "perception"


# ═══════════════════════════════════════════════
# Boss System Tests
# ═══════════════════════════════════════════════

class TestBossPhase:
    def test_create_phase(self):
        phase = BossPhase(
            phase_number=1,
            name="Stone Shield",
            hp_threshold=1.0,
            dominant_principle="matter",
            stability_pressure="low",
            tell_pattern="Đá dày lên trên người boss",
        )
        assert phase.phase_number == 1
        assert phase.dominant_principle == "matter"
        assert phase.tell_pattern != ""


class TestBossTemplate:
    def _make_boss(self) -> BossTemplate:
        return BossTemplate(
            boss_id="test_boss",
            name="Test Guardian",
            floor=1,
            primary_principle="matter",
            phases=[
                BossPhase(phase_number=1, name="P1", hp_threshold=1.0, dominant_principle="matter"),
                BossPhase(phase_number=2, name="P2", hp_threshold=0.5, dominant_principle="energy"),
            ],
        )

    def test_get_phase(self):
        boss = self._make_boss()
        p1 = boss.get_phase(1)
        assert p1 is not None
        assert p1.name == "P1"
        p2 = boss.get_phase(2)
        assert p2 is not None
        assert p2.dominant_principle == "energy"

    def test_get_phase_not_found(self):
        boss = self._make_boss()
        assert boss.get_phase(99) is None

    def test_resistances_and_weaknesses(self):
        boss = BossTemplate(
            boss_id="test",
            name="T",
            floor=1,
            primary_principle="matter",
            resistances={"matter": 0.5},
            weaknesses={"entropy": 1.3},
        )
        assert boss.resistances["matter"] == 0.5
        assert boss.weaknesses["entropy"] == 1.3


# ═══════════════════════════════════════════════
# Decision Point Tests
# ═══════════════════════════════════════════════

class TestDecisionPointChoice:
    def test_to_choice_text_strike(self):
        c = DecisionPointChoice(
            action=CombatAction.STRIKE,
            intensity="overdrive",
            risk_level=5,
        )
        text = c.to_choice_text()
        assert "⚔️" in text
        assert "Toàn Lực" in text

    def test_to_choice_text_stabilize(self):
        c = DecisionPointChoice(
            action=CombatAction.STABILIZE,
            intensity="safe",
            risk_level=1,
        )
        text = c.to_choice_text()
        assert "🛡️" in text
        assert "Thận Trọng" in text

    def test_to_choice_text_shift(self):
        c = DecisionPointChoice(
            action=CombatAction.SHIFT,
            intensity="push",
            risk_level=3,
        )
        text = c.to_choice_text()
        assert "🔄" in text
        assert "Dồn Sức" in text


class TestDecisionPoint:
    def test_create_decision_point(self):
        dp = DecisionPoint(
            phase_after=2,
            context="Boss đang tích năng lượng",
            choices=[
                DecisionPointChoice(action=CombatAction.STRIKE, intensity="push", risk_level=3),
                DecisionPointChoice(action=CombatAction.SHIFT, intensity="safe", risk_level=2),
                DecisionPointChoice(action=CombatAction.STABILIZE, intensity="safe", risk_level=1),
            ],
        )
        assert dp.phase_after == 2
        assert len(dp.choices) == 3


# ═══════════════════════════════════════════════
# Phase Result & CombatBriefV2 Tests
# ═══════════════════════════════════════════════

class TestPhaseResult:
    def test_create_phase_result(self):
        r = PhaseResult(
            phase_number=1,
            outcome="favorable",
            combat_score=0.72,
            action_taken="strike",
            intensity_used="push",
            player_hp_remaining=85.0,
            player_stability_remaining=70.0,
            enemy_hp_remaining=50.0,
            narrative_cues=["Player dominated the phase"],
        )
        assert r.outcome == "favorable"
        assert r.combat_score == 0.72
        assert len(r.narrative_cues) == 1


class TestCombatBriefV2:
    def test_create_minor(self):
        brief = CombatBriefV2(
            encounter_type="minor",
            enemy_name="Shadow Beast",
            phases=[PhaseResult(phase_number=1, outcome="mixed")],
            is_complete=True,
            final_outcome="player_wins",
        )
        assert brief.encounter_type == "minor"
        assert brief.is_complete is True
        assert len(brief.phases) == 1
        assert len(brief.decision_points) == 0

    def test_create_boss(self):
        brief = CombatBriefV2(
            encounter_type="boss",
            enemy_name="Trấn Giới Hộ Pháp",
            boss_id="floor_2_guardian",
            total_phases=3,
            phases=[
                PhaseResult(phase_number=1, outcome="favorable"),
                PhaseResult(phase_number=2, outcome="mixed"),
                PhaseResult(phase_number=3, outcome="favorable"),
            ],
            decision_points=[
                DecisionPoint(phase_after=2, context="Phase shift"),
                DecisionPoint(phase_after=3, context="Final push"),
            ],
            is_complete=True,
            final_outcome="player_wins",
        )
        assert brief.encounter_type == "boss"
        assert len(brief.phases) == 3
        assert len(brief.decision_points) == 2


class TestCombatResult:
    def test_identity_impact(self):
        r = CombatResult(
            winner="player",
            encounter_type="boss",
            decision_count=2,
            dqs_change=5.0,
            coherence_change=2.0,
            breakthrough_change=8.0,
            floor_progress=True,
        )
        assert r.winner == "player"
        assert r.floor_progress is True
        assert r.dqs_change == 5.0


# ═══════════════════════════════════════════════
# Floor Modifier Tests
# ═══════════════════════════════════════════════

class TestFloorModifier:
    def test_get_modifier(self):
        fm = FloorModifier(
            floor=1,
            location_name="Rừng Thạch",
            principle_buffs={"matter": 0.1},
            principle_nerfs={"void": -0.1},
        )
        assert fm.get_modifier("matter") == 0.1
        assert fm.get_modifier("void") == -0.1
        assert fm.get_modifier("energy") == 0.0  # No modifier


# ═══════════════════════════════════════════════
# Boss Data Loader Tests
# ═══════════════════════════════════════════════

class TestBossDataLoader:
    def test_load_floor_1_boss(self):
        from app.engine.boss_data import load_floor_boss
        boss = load_floor_boss(1)
        assert boss is not None
        assert boss.boss_id == "floor_1_guardian"
        assert boss.name == "Thạch Linh Canh Cửa"
        assert boss.primary_principle == "matter"
        assert len(boss.phases) == 2
        assert boss.phases[0].name == "Lá Chắn Đá"
        assert boss.phases[1].dominant_principle == "energy"

    def test_load_floor_2_boss(self):
        from app.engine.boss_data import load_floor_boss
        boss = load_floor_boss(2)
        assert boss is not None
        assert boss.boss_id == "floor_2_guardian"
        assert boss.name == "Trấn Giới Hộ Pháp"
        assert boss.enemy_type == "perception"
        assert len(boss.phases) == 3
        # Phase 2 changes to void
        assert boss.phases[1].dominant_principle == "void"

    def test_load_nonexistent_boss(self):
        from app.engine.boss_data import load_floor_boss
        boss = load_floor_boss(99)
        assert boss is None

    def test_list_available_bosses(self):
        from app.engine.boss_data import list_available_bosses
        bosses = list_available_bosses()
        assert "floor_1_guardian" in bosses
        assert "floor_2_guardian" in bosses

    def test_boss_resistances(self):
        from app.engine.boss_data import load_floor_boss
        boss = load_floor_boss(1)
        assert boss.resistances.get("matter") == 0.5
        assert boss.weaknesses.get("entropy") == 1.3

    def test_boss_tell_patterns(self):
        from app.engine.boss_data import load_floor_boss
        boss = load_floor_boss(2)
        # Each phase should have a tell pattern
        for phase in boss.phases:
            assert phase.tell_pattern != "", f"Phase {phase.phase_number} missing tell"
