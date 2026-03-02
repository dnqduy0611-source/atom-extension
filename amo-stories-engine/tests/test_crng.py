"""Tests for CRNG engine — pity timer, breakthrough, rogue events, DNA bias."""

from app.engine.crng import CRNGEngine, CRNGResult
from app.models.player import (
    Archetype, CurrentIdentity, DNAAffinityTag,
    LatentIdentity, PlayerState, SeedIdentity,
)


def _make_player(**overrides) -> PlayerState:
    """Create a test player with sensible defaults."""
    defaults = dict(
        user_id="test",
        name="Test",
        seed_identity=SeedIdentity(
            core_values=["courage"], personality_traits=["bold"],
            motivation="test", fear="test",
        ),
        current_identity=CurrentIdentity(),
        latent_identity=LatentIdentity(),
        archetype="vanguard",
        dna_affinity=[DNAAffinityTag.SHADOW, DNAAffinityTag.OATH],
    )
    defaults.update(overrides)
    return PlayerState(**defaults)


class TestCRNGDefaults:
    def test_result_default(self):
        r = CRNGResult()
        assert r.triggered is False
        assert r.event_type == ""

    def test_engine_creation(self):
        engine = CRNGEngine()
        assert engine.pity_base_chance > 0


class TestPityTimer:
    def test_no_pity_at_zero(self):
        engine = CRNGEngine()
        player = _make_player(pity_counter=0)
        assert not engine.should_trigger_major_event(player)

    def test_pity_guaranteed_at_high_counter(self):
        engine = CRNGEngine(pity_base_chance=0.05, pity_increment=0.05, pity_max_bonus=1.0)
        player = _make_player(pity_counter=25)
        # With 25 * 0.05 + 0.05 = 1.3 → capped at 1.0 → always triggers
        assert engine.should_trigger_major_event(player)


class TestBreakthrough:
    def test_no_breakthrough_below_threshold(self):
        engine = CRNGEngine(breakthrough_threshold=80.0)
        player = _make_player(breakthrough_meter=50.0)
        assert not engine.should_trigger_breakthrough(player)

    def test_breakthrough_at_threshold(self):
        engine = CRNGEngine(breakthrough_threshold=80.0)
        player = _make_player(breakthrough_meter=85.0)
        assert engine.should_trigger_breakthrough(player)


class TestRogueEvent:
    def test_no_rogue_late_game(self):
        engine = CRNGEngine()
        player = _make_player(is_early_game=False)
        assert not engine.should_trigger_rogue_event(player)

    def test_rogue_possible_early_game(self):
        engine = CRNGEngine()
        player = _make_player(is_early_game=True)
        # Rogue is probabilistic, just verify it doesn't crash
        result = engine.should_trigger_rogue_event(player)
        assert isinstance(result, bool)


class TestDNABias:
    def test_roll_affinity_returns_valid_tag(self):
        engine = CRNGEngine()
        player = _make_player()
        tag = engine.roll_affinity(player)
        assert isinstance(tag, DNAAffinityTag)

    def test_roll_affinity_no_dna(self):
        engine = CRNGEngine()
        player = _make_player(dna_affinity=[])
        tag = engine.roll_affinity(player)
        assert isinstance(tag, DNAAffinityTag)


class TestFullRoll:
    def test_roll_returns_result(self):
        engine = CRNGEngine()
        player = _make_player()
        result = engine.roll_chapter_events(player)
        assert isinstance(result, CRNGResult)

    def test_breakthrough_priority(self):
        """Breakthrough should take priority over other events."""
        engine = CRNGEngine(breakthrough_threshold=50.0)
        player = _make_player(breakthrough_meter=90.0, pity_counter=100)
        result = engine.roll_chapter_events(player)
        assert result.triggered
        assert result.event_type == "breakthrough"
