"""Tests for identity system — apply_delta and boundary checking."""

from app.models.identity import IdentityDelta, apply_delta
from app.models.player import (
    CurrentIdentity, LatentIdentity, PlayerState, SeedIdentity,
)


def _make_player(**overrides) -> PlayerState:
    defaults = dict(
        user_id="test", name="Test",
        seed_identity=SeedIdentity(
            core_values=["courage"], personality_traits=["bold"],
            motivation="m", fear="f",
        ),
        current_identity=CurrentIdentity(),
        latent_identity=LatentIdentity(),
        archetype="vanguard",
        identity_coherence=80.0,
        instability=20.0,
        decision_quality_score=50.0,
        breakthrough_meter=30.0,
        fate_buffer=60.0,
    )
    defaults.update(overrides)
    return PlayerState(**defaults)


class TestApplyDelta:
    def test_positive_changes(self):
        player = _make_player()
        delta = IdentityDelta(
            coherence_change=5.0,
            dqs_change=3.0,
            breakthrough_change=10.0,
        )
        updated = apply_delta(player, delta)
        assert updated.identity_coherence == 85.0
        assert updated.decision_quality_score == 53.0
        assert updated.breakthrough_meter == 40.0

    def test_negative_changes(self):
        player = _make_player()
        delta = IdentityDelta(
            coherence_change=-10.0,
            instability_change=15.0,
        )
        updated = apply_delta(player, delta)
        assert updated.identity_coherence == 70.0
        assert updated.instability == 35.0

    def test_clamping_upper(self):
        player = _make_player(identity_coherence=95.0)
        delta = IdentityDelta(coherence_change=20.0)
        updated = apply_delta(player, delta)
        assert updated.identity_coherence <= 100.0

    def test_clamping_lower(self):
        player = _make_player(instability=5.0)
        delta = IdentityDelta(instability_change=-20.0)
        updated = apply_delta(player, delta)
        assert updated.instability >= 0.0

    def test_fate_buffer_decay(self):
        player = _make_player(fate_buffer=60.0)
        delta = IdentityDelta(fate_buffer_change=-15.0)
        updated = apply_delta(player, delta)
        assert updated.fate_buffer == 45.0

    def test_zero_delta_no_change(self):
        player = _make_player()
        delta = IdentityDelta()
        updated = apply_delta(player, delta)
        assert updated.identity_coherence == player.identity_coherence
        assert updated.instability == player.instability
        assert updated.decision_quality_score == player.decision_quality_score

    def test_alignment_and_notoriety(self):
        player = _make_player(alignment=0.0, notoriety=0.0)
        delta = IdentityDelta(alignment_change=5.0, notoriety_change=10.0)
        updated = apply_delta(player, delta)
        assert updated.alignment == 5.0
        assert updated.notoriety == 10.0

    def test_original_not_mutated(self):
        player = _make_player()
        original_coh = player.identity_coherence
        delta = IdentityDelta(coherence_change=-20.0)
        apply_delta(player, delta)
        # Pydantic model_copy ensures original is not mutated
        assert player.identity_coherence == original_coh
