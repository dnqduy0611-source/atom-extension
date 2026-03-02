"""Tests for Fate Buffer — levels, decay, and narrative instructions."""

from app.engine.fate_buffer import FateBuffer, FateBufferStatus
from app.models.player import (
    CurrentIdentity, LatentIdentity, PlayerState, SeedIdentity,
)


def _make_player(**overrides) -> PlayerState:
    defaults = dict(
        user_id="test", name="Test",
        seed_identity=SeedIdentity(
            core_values=["a"], personality_traits=["b"],
            motivation="m", fear="f",
        ),
        current_identity=CurrentIdentity(),
        latent_identity=LatentIdentity(),
        archetype="vanguard",
    )
    defaults.update(overrides)
    return PlayerState(**defaults)


class TestFateStatus:
    def test_full_protection(self):
        fb = FateBuffer()
        player = _make_player(fate_buffer=100.0)
        status = fb.get_status(player)
        assert status.protection_level == "full"
        assert status.narrative_instruction

    def test_partial_protection(self):
        fb = FateBuffer()
        player = _make_player(fate_buffer=55.0)
        status = fb.get_status(player)
        assert status.protection_level == "partial"

    def test_minimal_protection(self):
        fb = FateBuffer()
        player = _make_player(fate_buffer=15.0)
        status = fb.get_status(player)
        assert status.protection_level == "minimal"

    def test_no_protection(self):
        fb = FateBuffer()
        player = _make_player(fate_buffer=2.0)
        status = fb.get_status(player)
        assert status.protection_level == "none"


class TestFateDecay:
    def test_no_decay_early(self):
        fb = FateBuffer(start_decay_chapter=5, decay_rate=5.0)
        player = _make_player(total_chapters=3)
        decay = fb.calculate_decay(player)
        assert decay == 0.0

    def test_decay_after_start(self):
        fb = FateBuffer(start_decay_chapter=5, decay_rate=5.0)
        player = _make_player(total_chapters=8)
        decay = fb.calculate_decay(player)
        assert decay < 0.0  # Should be negative

    def test_high_risk_accelerates_decay(self):
        fb = FateBuffer(start_decay_chapter=5, decay_rate=5.0)
        player = _make_player(total_chapters=10)
        low_risk = fb.calculate_decay(player, risk_level=0)
        high_risk = fb.calculate_decay(player, risk_level=5)
        assert high_risk < low_risk  # More negative = more decay


class TestFateLevels:
    def test_all_levels_have_instructions(self):
        fb = FateBuffer()
        for val in [100.0, 55.0, 15.0, 2.0]:
            player = _make_player(fate_buffer=val)
            status = fb.get_status(player)
            assert isinstance(status, FateBufferStatus)
            assert isinstance(status.narrative_instruction, str)
            assert len(status.narrative_instruction) > 0
