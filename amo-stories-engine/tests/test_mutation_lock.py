"""Tests for Phase D — Mutation Lock + Echo Reversibility + Polish.

Tests:
- check_mutation_allowed: all stages + lock flag
- Echo Bloom revert: sustained low coherence → revert to seed
- Echo revert not possible after Aspect
- Scar bloom NOT reversible
- weakness exploit already tested in Phase A
"""

from __future__ import annotations

import pytest

from app.engine.skill_check import check_mutation_allowed
from app.engine.unique_skill_growth import (
    update_growth_per_scene,
    apply_bloom,
    GrowthType,
)
from app.models.unique_skill_growth import UniqueSkillGrowthState


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture
def player_seed():
    """Player at Seed stage."""
    from app.models.player import PlayerState, UniqueSkill

    return PlayerState(
        name="TestPlayer",
        identity_coherence=80.0,
        unique_skill=UniqueSkill(
            name="TestSkill",
            category="manifestation",
            suppression_resistance=50.0,
        ),
        unique_skill_growth=UniqueSkillGrowthState(
            skill_id="test",
            original_skill_name="TestSkill",
            current_skill_name="TestSkill",
            current_stage="seed",
        ),
    )


@pytest.fixture
def player_echo_bloom(player_seed):
    """Player who bloomed via Echo path."""
    growth = player_seed.unique_skill_growth
    growth.bloom_completed = True
    growth.bloom_path = "echo"
    growth.current_stage = "bloom"
    growth.active_growth = GrowthType.ECHO
    growth.echo_can_lose = True  # Echo bloom is losable before aspect
    player_seed.unique_skill.current_stage = "bloom"
    return player_seed


@pytest.fixture
def player_scar_bloom(player_seed):
    """Player who bloomed via Scar path."""
    growth = player_seed.unique_skill_growth
    growth.bloom_completed = True
    growth.bloom_path = "scar"
    growth.current_stage = "bloom"
    growth.active_growth = GrowthType.SCAR
    growth.scar_adapted = True
    player_seed.unique_skill.current_stage = "bloom"
    return player_seed


@pytest.fixture
def player_aspect(player_echo_bloom):
    """Player who has forged Aspect."""
    growth = player_echo_bloom.unique_skill_growth
    growth.aspect_forged = True
    growth.aspect_chosen = "Aspect A"
    growth.current_stage = "aspect"
    growth.mutation_locked = True
    growth.echo_can_lose = False
    return player_echo_bloom


# ──────────────────────────────────────────────
# MUTATION LOCK TESTS
# ──────────────────────────────────────────────

class TestMutationLock:
    """check_mutation_allowed at various stages."""

    def test_seed_allows_mutation(self):
        allowed, reason = check_mutation_allowed(growth_stage="seed")
        assert allowed is True
        assert "forming" in reason.lower()

    def test_bloom_allows_with_warning(self):
        allowed, reason = check_mutation_allowed(growth_stage="bloom")
        assert allowed is True
        assert "risky" in reason.lower()

    def test_aspect_blocks_mutation(self):
        allowed, reason = check_mutation_allowed(
            growth_stage="aspect", aspect_forged=True,
        )
        assert allowed is False
        assert "permanent" in reason.lower()

    def test_ultimate_blocks_mutation(self):
        allowed, reason = check_mutation_allowed(growth_stage="ultimate")
        assert allowed is False

    def test_mutation_locked_flag_blocks(self):
        allowed, reason = check_mutation_allowed(
            growth_stage="bloom", mutation_locked=True,
        )
        assert allowed is False
        assert "locked" in reason.lower()

    def test_seed_with_lock_flag_blocks(self):
        """Even seed is blocked if explicit lock flag."""
        allowed, _ = check_mutation_allowed(
            growth_stage="seed", mutation_locked=True,
        )
        assert allowed is False


# ──────────────────────────────────────────────
# ECHO BLOOM REVERT TESTS
# ──────────────────────────────────────────────

class TestEchoBloomRevert:
    """Echo bloom revert on sustained low coherence."""

    def test_echo_reverts_after_5_low_scenes(self, player_echo_bloom):
        """Coherence < 50 for 5 consecutive scenes → revert."""
        player_echo_bloom.identity_coherence = 40.0  # Below 50

        for i in range(4):
            events = update_growth_per_scene(player_echo_bloom)
            assert "echo_bloom_reverted" not in events  # Not yet

        # 5th scene triggers revert
        events = update_growth_per_scene(player_echo_bloom)
        assert events.get("echo_bloom_reverted") is True
        assert player_echo_bloom.unique_skill_growth.current_stage == "seed"
        assert player_echo_bloom.unique_skill_growth.bloom_completed is False

    def test_echo_revert_resets_resistance(self, player_echo_bloom):
        """Revert also resets suppression_resistance to seed level."""
        player_echo_bloom.identity_coherence = 40.0
        for _ in range(5):
            update_growth_per_scene(player_echo_bloom)

        assert player_echo_bloom.unique_skill.suppression_resistance == 50.0  # Seed

    def test_coherence_recovery_resets_streak(self, player_echo_bloom):
        """If coherence recovers, low streak resets."""
        player_echo_bloom.identity_coherence = 40.0
        for _ in range(3):
            update_growth_per_scene(player_echo_bloom)

        # Recover coherence
        player_echo_bloom.identity_coherence = 60.0
        update_growth_per_scene(player_echo_bloom)

        # Go low again — counter should reset
        player_echo_bloom.identity_coherence = 40.0
        for _ in range(4):
            events = update_growth_per_scene(player_echo_bloom)
            assert "echo_bloom_reverted" not in events  # Still not 5

    def test_scar_bloom_cannot_revert(self, player_scar_bloom):
        """Scar bloom is NOT reversible."""
        player_scar_bloom.identity_coherence = 20.0  # Very low
        for _ in range(10):
            events = update_growth_per_scene(player_scar_bloom)
            assert "echo_bloom_reverted" not in events

        assert player_scar_bloom.unique_skill_growth.bloom_completed is True

    def test_aspect_blocks_echo_revert(self, player_aspect):
        """Can't revert echo bloom once Aspect is forged."""
        player_aspect.identity_coherence = 20.0
        for _ in range(10):
            events = update_growth_per_scene(player_aspect)
            assert "echo_bloom_reverted" not in events

    def test_no_revert_when_echo_can_lose_false(self, player_echo_bloom):
        """If echo_can_lose is False (post-first-bloom in spec), no revert."""
        player_echo_bloom.unique_skill_growth.echo_can_lose = False
        player_echo_bloom.identity_coherence = 30.0
        for _ in range(10):
            events = update_growth_per_scene(player_echo_bloom)
            assert "echo_bloom_reverted" not in events


# ──────────────────────────────────────────────
# INTEGRATION TESTS
# ──────────────────────────────────────────────

class TestPhaseD_Integration:
    """Combined tests verifying all Phase D mechanics."""

    def test_mutation_check_with_player_state(self, player_seed):
        """Full integration: check mutation from player state."""
        growth = player_seed.unique_skill_growth
        allowed, _ = check_mutation_allowed(
            growth_stage=growth.current_stage,
            mutation_locked=growth.mutation_locked,
            aspect_forged=growth.aspect_forged,
        )
        assert allowed is True  # Seed allows

    def test_mutation_after_aspect_denied(self, player_aspect):
        """Full integration: Aspect player can't mutate."""
        growth = player_aspect.unique_skill_growth
        allowed, _ = check_mutation_allowed(
            growth_stage=growth.current_stage,
            mutation_locked=growth.mutation_locked,
            aspect_forged=growth.aspect_forged,
        )
        assert allowed is False

    def test_echo_bloom_then_low_coherence_reverts(self, player_seed):
        """Full flow: seed → echo bloom setup → sustained low → revert."""
        growth = player_seed.unique_skill_growth

        # Simulate echo bloom (manually, since apply_bloom needs LLM data)
        growth.bloom_completed = True
        growth.bloom_path = "echo"
        growth.current_stage = "bloom"
        growth.active_growth = GrowthType.ECHO
        growth.echo_can_lose = True
        player_seed.unique_skill.current_stage = "bloom"

        # Sustained low coherence
        player_seed.identity_coherence = 30.0
        for _ in range(5):
            events = update_growth_per_scene(player_seed)

        assert growth.current_stage == "seed"
        assert growth.bloom_completed is False
