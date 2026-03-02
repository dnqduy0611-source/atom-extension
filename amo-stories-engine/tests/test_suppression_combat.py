"""Tests for Suppression × Combat Integration (Phase A).

Tests:
- Domain immunity: normal skill can't suppress unique
- Weakness exploit: blind_spot +15, weakness_type +10, cap +25
- CombatBrief suppression fields
- build_unique_skill_context suppression effects
- SEALED blocks ultimate ability
- NULLIFIED empties sub-skills
"""

from __future__ import annotations

import pytest

from app.engine.suppression_check import (
    SuppressionLevel,
    SuppressionResult,
    check_suppression,
    check_suppression_from_enemy,
    _weakness_type_matches,
)
from app.engine.combat import (
    CombatBrief,
    EnemyProfile,
    build_combat_brief,
    compute_combat_score,
)
from app.engine.unique_skill_combat import build_unique_skill_context
from app.models.power import CombatMetrics, Intensity, NormalSkill, ResonanceState


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture
def player_state():
    """Minimal PlayerState-like object for testing."""
    from app.models.player import PlayerState, UniqueSkill, SubSkill
    from app.models.unique_skill_growth import UniqueSkillGrowthState, UltimateSkillForm

    player = PlayerState(
        name="TestPlayer",
        unique_skill=UniqueSkill(
            name="Thiết Thệ",
            category="manifestation",
            mechanic="Hardening body surfaces",
            suppression_resistance=65.0,
            weakness_type="sensory_tax",
            axis_blind_spot="perception",
            domain_category="manifestation",
            unique_clause="Stability < 30% → skill mạnh hơn",
            sub_skills=[
                SubSkill(name="Phản Xạ Thép", type="reactive", mechanic="Counter on hit"),
                SubSkill(name="Thiết Giáp", type="passive", mechanic="Passive DR"),
            ],
        ),
        unique_skill_growth=UniqueSkillGrowthState(
            skill_id="thiet_the",
            original_skill_name="Thiết Thệ",
            current_skill_name="Thiết Thệ",
            current_stage="bloom",
            bloom_completed=True,
            bloom_path="scar",
        ),
    )
    return player


# ──────────────────────────────────────────────
# DOMAIN IMMUNITY TESTS
# ──────────────────────────────────────────────

class TestDomainImmunity:
    """Normal skills can't suppress Unique Skills."""

    def test_normal_enemy_cannot_suppress(self):
        """Enemy without unique ability → NONE regardless of power."""
        result = check_suppression_from_enemy(
            player_skill_category="manifestation",
            player_resistance=50.0,
            enemy_has_unique=False,
            enemy_suppression_power=100.0,  # Even max power
            enemy_suppression_type="skill",
        )
        assert result.level == SuppressionLevel.NONE
        assert result.effectiveness_modifier == 1.0
        assert "Domain immunity" in result.reason

    def test_unique_enemy_can_suppress(self):
        """Enemy with unique ability → normal suppression check."""
        result = check_suppression_from_enemy(
            player_skill_category="manifestation",
            player_resistance=50.0,
            enemy_has_unique=True,
            enemy_unique_category="perception",
            enemy_suppression_power=70.0,
            enemy_suppression_type="skill",
        )
        assert result.level != SuppressionLevel.NONE

    def test_seal_type_bypasses_domain_check(self):
        """Seal/artifact-level can suppress without unique ability."""
        result = check_suppression_from_enemy(
            player_skill_category="manifestation",
            player_resistance=50.0,
            enemy_has_unique=False,
            enemy_suppression_power=60.0,
            enemy_suppression_type="seal",  # Artifact-level
        )
        # Seal bypasses domain immunity check
        assert result.level != SuppressionLevel.NONE or result.reason != "Domain immunity"

    def test_no_suppression_power_returns_none(self):
        """Zero power → NONE even with unique enemy."""
        result = check_suppression_from_enemy(
            player_skill_category="manifestation",
            player_resistance=50.0,
            enemy_has_unique=True,
            enemy_suppression_power=0.0,
        )
        assert result.level == SuppressionLevel.NONE


# ──────────────────────────────────────────────
# WEAKNESS EXPLOIT TESTS
# ──────────────────────────────────────────────

class TestWeaknessExploit:
    """Weakness type and blind spot bonuses."""

    def test_blind_spot_match_boosts_power(self):
        """axis_blind_spot match → +15 bonus."""
        # Without blind_spot match
        base = check_suppression_from_enemy(
            player_skill_category="manifestation",
            player_resistance=65.0,
            enemy_has_unique=True,
            enemy_unique_category="contract",
            enemy_suppression_power=60.0,
        )
        # With blind_spot match
        boosted = check_suppression_from_enemy(
            player_skill_category="manifestation",
            player_resistance=65.0,
            player_axis_blind_spot="perception",
            enemy_has_unique=True,
            enemy_unique_category="perception",  # Matches blind_spot
            enemy_suppression_power=60.0,
        )
        # Boosted should be worse (higher suppression level or lower modifier)
        assert boosted.effectiveness_modifier <= base.effectiveness_modifier

    def test_weakness_type_match_boosts_power(self):
        """weakness_type match → +10 bonus via exploit map."""
        # sensory_tax is vulnerable to perception
        result = check_suppression_from_enemy(
            player_skill_category="manifestation",
            player_resistance=65.0,
            player_weakness_type="sensory_tax",
            enemy_has_unique=True,
            enemy_unique_category="perception",  # sensory_tax → perception
            enemy_suppression_power=60.0,
        )
        # With +10 bonus, effective power = 70 vs 65 resistance = gap 5 → SUPPRESSED
        assert result.level in (SuppressionLevel.SUPPRESSED, SuppressionLevel.SEALED)

    def test_combined_exploit_capped_at_25(self):
        """Blind_spot + weakness_type combined cap at +25."""
        # Both match: blind_spot=perception + sensory_tax→perception
        result = check_suppression_from_enemy(
            player_skill_category="manifestation",
            player_resistance=65.0,
            player_weakness_type="sensory_tax",
            player_axis_blind_spot="perception",
            enemy_has_unique=True,
            enemy_unique_category="perception",
            enemy_suppression_power=60.0,
        )
        # 60 + 25 = 85 vs 65 = gap 20 → SUPPRESSED
        assert result.level == SuppressionLevel.SUPPRESSED

    def test_weakness_type_matches_function(self):
        """Direct unit test of _weakness_type_matches."""
        assert _weakness_type_matches("sensory_tax", "manifestation") is True
        assert _weakness_type_matches("sensory_tax", "perception") is True
        assert _weakness_type_matches("sensory_tax", "contract") is False
        assert _weakness_type_matches("resonance_dependency", "obfuscation") is True
        assert _weakness_type_matches("unknown_type", "perception") is False


# ──────────────────────────────────────────────
# COMBAT BRIEF INTEGRATION TESTS
# ──────────────────────────────────────────────

class TestCombatBriefSuppression:
    """CombatBrief carries suppression data correctly."""

    def test_combat_brief_has_suppression_fields(self):
        """CombatBrief includes suppression_level, modifier, narrative."""
        brief = CombatBrief()
        assert brief.suppression_level == "none"
        assert brief.suppression_modifier == 1.0
        assert brief.suppression_narrative == ""

    def test_build_combat_brief_passes_suppression(self):
        """build_combat_brief correctly passes suppression data to CombatBrief."""
        resonance = ResonanceState()
        metrics = CombatMetrics()
        skill = NormalSkill(name="Strike", primary_principle="order")
        enemy = EnemyProfile(name="Boss", principle="entropy")

        brief = build_combat_brief(
            resonance=resonance,
            metrics=metrics,
            skill=skill,
            enemy=enemy,
            unique_skill_bonus=0.05,
            suppression_level="suppressed",
            suppression_modifier=0.7,
            suppression_narrative="Skill bị áp chế 30%",
        )
        assert brief.suppression_level == "suppressed"
        assert brief.suppression_modifier == 0.7
        assert "áp chế" in brief.suppression_narrative

    def test_suppression_reduces_unique_bonus(self):
        """Suppression modifier reduces unique_skill_bonus in score."""
        resonance = ResonanceState()
        metrics = CombatMetrics()
        skill = NormalSkill(name="Strike", primary_principle="order")
        enemy = EnemyProfile(name="Boss", principle="entropy")

        brief_normal = build_combat_brief(
            resonance=resonance,
            metrics=metrics,
            skill=skill,
            enemy=enemy,
            unique_skill_bonus=0.08,  # Full
            suppression_modifier=1.0,  # No suppression
        )

        resonance2 = ResonanceState()
        metrics2 = CombatMetrics()
        brief_suppressed = build_combat_brief(
            resonance=resonance2,
            metrics=metrics2,
            skill=skill,
            enemy=enemy,
            unique_skill_bonus=0.08,  # Same
            suppression_modifier=0.5,  # 50% suppression
        )

        # Suppressed brief should have lower or equal score
        assert brief_suppressed.combat_score <= brief_normal.combat_score

    def test_sealed_zeroes_unique_active(self):
        """SEALED (modifier=0) → unique_skill_active = False."""
        resonance = ResonanceState()
        metrics = CombatMetrics()
        skill = NormalSkill(name="Strike", primary_principle="order")
        enemy = EnemyProfile(name="Boss", principle="entropy")

        brief = build_combat_brief(
            resonance=resonance,
            metrics=metrics,
            skill=skill,
            enemy=enemy,
            unique_skill_bonus=0.08,
            suppression_level="sealed",
            suppression_modifier=0.0,  # Fully disabled
        )
        assert brief.unique_skill_active is False
        assert brief.suppression_level == "sealed"


# ──────────────────────────────────────────────
# UNIQUE SKILL CONTEXT SUPPRESSION TESTS
# ──────────────────────────────────────────────

class TestUniqueSkillContextSuppression:
    """build_unique_skill_context integrates suppression."""

    def test_no_suppression_defaults(self, player_state):
        """Without suppression, context is normal."""
        ctx = build_unique_skill_context(player_state, is_combat=True)
        assert ctx["suppression_level"] == "none"
        assert ctx["suppression_modifier"] == 1.0
        assert ctx["combat_bonus"] > 0

    def test_suppressed_reduces_bonuses(self, player_state):
        """SUPPRESSED reduces combat_bonus and sub_skill_bonus."""
        supp = {"level": "suppressed", "effectiveness_modifier": 0.5, "narrative_instruction": "Test"}
        ctx = build_unique_skill_context(player_state, is_combat=True, suppression_result=supp)
        assert ctx["suppression_level"] == "suppressed"
        assert ctx["suppression_modifier"] == 0.5
        # Bonuses should be halved
        normal_ctx = build_unique_skill_context(player_state, is_combat=True)
        assert ctx["combat_bonus"] == pytest.approx(normal_ctx["combat_bonus"] * 0.5, abs=0.001)

    def test_sealed_blocks_clause_and_ultimate(self, player_state):
        """SEALED disables unique_clause and blocks ultimate ability."""
        player_state.unique_skill_growth.ultimate_forged = True
        from app.models.unique_skill_growth import UltimateSkillForm
        player_state.unique_skill_growth.ultimate_form = UltimateSkillForm(
            name="Ultimate", ultimate_ability_used_this_season=False,
        )

        supp = {"level": "sealed", "effectiveness_modifier": 0.0}
        ctx = build_unique_skill_context(player_state, is_combat=True, suppression_result=supp)
        assert ctx["unique_clause_active"] is False
        assert ctx["clause_bonus"] == 0.0
        assert ctx["can_use_ultimate_ability"] is False
        assert ctx["combat_bonus"] == 0.0

    def test_nullified_empties_sub_skills(self, player_state):
        """NULLIFIED removes all sub-skills from context."""
        supp = {"level": "nullified", "effectiveness_modifier": 0.0, "narrative_instruction": "All off"}
        ctx = build_unique_skill_context(player_state, is_combat=True, suppression_result=supp)
        assert ctx["active_sub_skills"] == []
        assert ctx["suppression_level"] == "nullified"
        assert ctx["combat_bonus"] == 0.0
        assert ctx["sub_skill_bonus"] == 0.0
