"""Tests for Seal System (Phase B).

Tests:
- SealState model: tick, expire, release
- Seal validation: ritual/zone/contract/faction requirements
- apply_seal: cost, suppression check, duration
- tick_seal_phase / tick_seal_scene: auto-expiry
- Anti-Unique Field: no duration limit, all off
- is_sealed / is_in_anti_unique_field queries
"""

from __future__ import annotations

import pytest

from app.models.seal import SealState, SealType
from app.engine.seal_system import (
    apply_seal,
    is_in_anti_unique_field,
    is_sealed,
    release_seal,
    tick_seal_phase,
    tick_seal_scene,
    validate_seal_requirements,
    RITUAL_STABILITY_COST,
    FACTION_MIN_RANK,
)


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture
def player_with_unique():
    """Player with unique skill for seal testing."""
    from app.models.player import PlayerState, UniqueSkill
    from app.models.unique_skill_growth import UniqueSkillGrowthState

    return PlayerState(
        name="SealTarget",
        stability=100.0,
        unique_skill=UniqueSkill(
            name="Thiết Thệ",
            category="manifestation",
            suppression_resistance=50.0,  # Seed level
        ),
        unique_skill_growth=UniqueSkillGrowthState(
            skill_id="thiet_the",
            original_skill_name="Thiết Thệ",
            current_skill_name="Thiết Thệ",
            current_stage="seed",
        ),
    )


# ──────────────────────────────────────────────
# SEAL STATE MODEL TESTS
# ──────────────────────────────────────────────

class TestSealState:
    """SealState model behavior."""

    def test_default_inactive(self):
        seal = SealState()
        assert seal.active is False
        assert seal.is_expired() is True

    def test_active_seal_not_expired(self):
        seal = SealState(active=True, remaining_phases=3, remaining_scenes=1)
        assert seal.is_expired() is False

    def test_tick_phase_decrements(self):
        seal = SealState(active=True, remaining_phases=2, remaining_scenes=0)
        expired = seal.tick_phase()
        assert seal.remaining_phases == 1
        assert expired is False

    def test_tick_phase_expires(self):
        seal = SealState(active=True, remaining_phases=1, remaining_scenes=0)
        expired = seal.tick_phase()
        assert expired is True
        assert seal.active is False

    def test_tick_scene_expires(self):
        seal = SealState(active=True, remaining_phases=0, remaining_scenes=1)
        expired = seal.tick_scene()
        assert expired is True
        assert seal.active is False

    def test_anti_unique_field_never_expires_on_tick(self):
        seal = SealState(active=True, is_anti_unique_field=True)
        expired = seal.tick_phase()
        assert expired is False
        assert seal.active is True

    def test_release_deactivates(self):
        seal = SealState(active=True, remaining_phases=5, remaining_scenes=1)
        seal.release()
        assert seal.active is False
        assert seal.remaining_phases == 0


# ──────────────────────────────────────────────
# VALIDATE REQUIREMENTS TESTS
# ──────────────────────────────────────────────

class TestValidateSealRequirements:
    """Seal creation validation."""

    def test_ritual_blocked_in_combat(self):
        valid, reason = validate_seal_requirements("ritual", in_combat=True)
        assert valid is False
        assert "combat" in reason.lower()

    def test_ritual_needs_stability(self, player_with_unique):
        player_with_unique.stability = 10.0
        valid, reason = validate_seal_requirements("ritual", player=player_with_unique)
        assert valid is False
        assert "stability" in reason.lower()

    def test_ritual_succeeds_with_stability(self, player_with_unique):
        player_with_unique.stability = 50.0
        valid, reason = validate_seal_requirements("ritual", player=player_with_unique)
        assert valid is True

    def test_zone_needs_property(self):
        valid, _ = validate_seal_requirements("zone", zone_has_seal_property=False)
        assert valid is False

    def test_zone_succeeds_with_property(self):
        valid, _ = validate_seal_requirements("zone", zone_has_seal_property=True)
        assert valid is True

    def test_contract_needs_consent(self):
        valid, _ = validate_seal_requirements("contract", mutual_consent=False)
        assert valid is False

    def test_contract_succeeds_with_consent(self):
        valid, _ = validate_seal_requirements("contract", mutual_consent=True)
        assert valid is True

    def test_faction_needs_rank(self):
        valid, _ = validate_seal_requirements("faction", faction_rank=1)
        assert valid is False

    def test_faction_succeeds_with_rank(self):
        valid, _ = validate_seal_requirements("faction", faction_rank=3)
        assert valid is True

    def test_field_needs_zone_property(self):
        valid, _ = validate_seal_requirements("field", zone_has_seal_property=False)
        assert valid is False


# ──────────────────────────────────────────────
# APPLY SEAL TESTS
# ──────────────────────────────────────────────

class TestApplySeal:
    """Seal application with costs and suppression check."""

    def test_apply_ritual_seal_costs_stability(self, player_with_unique):
        initial_stab = player_with_unique.stability
        result = apply_seal(player_with_unique, "ritual", source="Ancient Ritual")
        if result["success"]:
            assert player_with_unique.stability == initial_stab - RITUAL_STABILITY_COST

    def test_seal_creates_active_seal_state(self, player_with_unique):
        # High power to ensure success
        result = apply_seal(
            player_with_unique, "zone",
            source="Tower Floor 4 Seal Zone",
            suppression_power=90.0,
        )
        assert result["success"] is True
        seal = player_with_unique.active_seal
        assert seal is not None
        assert seal.active is True
        assert seal.seal_type == SealType.ZONE

    def test_seal_fails_if_resistance_too_strong(self, player_with_unique):
        # Low power vs resistance = can't achieve SEALED
        player_with_unique.unique_skill.suppression_resistance = 95.0
        result = apply_seal(
            player_with_unique, "ritual",
            suppression_power=30.0,
        )
        assert result["success"] is False

    def test_no_unique_skill_returns_error(self):
        from app.models.player import PlayerState
        player = PlayerState(name="NoSkill")
        result = apply_seal(player, "ritual")
        assert result["success"] is False

    def test_anti_unique_field_sets_zero_sub_modifier(self, player_with_unique):
        result = apply_seal(
            player_with_unique, "field",
            source="Ancient Ruin",
            suppression_power=100.0,
        )
        if result["success"]:
            seal = player_with_unique.active_seal
            assert seal.is_anti_unique_field is True
            assert seal.sub_skill_modifier == 0.0


# ──────────────────────────────────────────────
# TICK / EXPIRE TESTS
# ──────────────────────────────────────────────

class TestTickSeal:
    """Seal duration ticking."""

    def test_tick_phase_returns_none_if_no_seal(self, player_with_unique):
        result = tick_seal_phase(player_with_unique)
        assert result is None

    def test_tick_phase_decrements(self, player_with_unique):
        player_with_unique.active_seal = SealState(
            active=True, remaining_phases=3, remaining_scenes=0,
        )
        result = tick_seal_phase(player_with_unique)
        assert result["seal_expired"] is False
        assert result["remaining_phases"] == 2

    def test_tick_phase_expires_seal(self, player_with_unique):
        player_with_unique.active_seal = SealState(
            active=True, remaining_phases=1, remaining_scenes=0,
        )
        result = tick_seal_phase(player_with_unique)
        assert result["seal_expired"] is True
        assert "narrative" in result

    def test_tick_scene_expires_seal(self, player_with_unique):
        player_with_unique.active_seal = SealState(
            active=True, remaining_phases=0, remaining_scenes=1,
        )
        result = tick_seal_scene(player_with_unique)
        assert result["seal_expired"] is True

    def test_tick_scene_decrements(self, player_with_unique):
        player_with_unique.active_seal = SealState(
            active=True, remaining_phases=3, remaining_scenes=2,
        )
        result = tick_seal_scene(player_with_unique)
        assert result["seal_expired"] is False


# ──────────────────────────────────────────────
# QUERY TESTS
# ──────────────────────────────────────────────

class TestSealQueries:
    """is_sealed, is_in_anti_unique_field."""

    def test_is_sealed_false_by_default(self, player_with_unique):
        assert is_sealed(player_with_unique) is False

    def test_is_sealed_true_when_active(self, player_with_unique):
        player_with_unique.active_seal = SealState(
            active=True, remaining_phases=3, remaining_scenes=1,
        )
        assert is_sealed(player_with_unique) is True

    def test_is_in_anti_unique_field(self, player_with_unique):
        player_with_unique.active_seal = SealState(
            active=True, is_anti_unique_field=True,
        )
        assert is_in_anti_unique_field(player_with_unique) is True


# ──────────────────────────────────────────────
# RELEASE TESTS
# ──────────────────────────────────────────────

class TestReleaseSeal:
    """Manual seal release."""

    def test_release_deactivates(self, player_with_unique):
        player_with_unique.active_seal = SealState(
            active=True, remaining_phases=3, source="Test",
        )
        result = release_seal(player_with_unique)
        assert result["released"] is True
        assert player_with_unique.active_seal.active is False

    def test_release_inactive_returns_false(self, player_with_unique):
        result = release_seal(player_with_unique)
        assert result["released"] is False
