"""Tests for power system models and progression."""

from app.models.power import (
    Principle,
    ALL_PRINCIPLES,
    InteractionType,
    PrincipleInteraction,
    get_principle_interaction,
    NormalSkill,
    ResonanceState,
    CombatMetrics,
    Intensity,
    FLOOR_RESONANCE_CAPS,
    get_floor_resonance_cap,
)
from app.models.progression import (
    ProgressionRank,
    PlayerProgression,
    check_rank_up,
    RANK_CONDITIONS,
)
from app.models.player import PlayerState


# ═══════════════════════════════════════════════
# Principle Tests
# ═══════════════════════════════════════════════

class TestPrinciple:
    def test_six_principles(self):
        assert len(ALL_PRINCIPLES) == 6

    def test_display_names(self):
        for p in Principle:
            assert p.display_name, f"{p.value} missing display_name"

    def test_opposites(self):
        assert Principle.ORDER.opposite == Principle.ENTROPY
        assert Principle.ENTROPY.opposite == Principle.ORDER
        assert Principle.MATTER.opposite == Principle.FLUX
        assert Principle.FLUX.opposite == Principle.MATTER
        assert Principle.ENERGY.opposite == Principle.VOID
        assert Principle.VOID.opposite == Principle.ENERGY

    def test_opposite_symmetry(self):
        for p in Principle:
            assert p.opposite.opposite == p

    def test_adjacency(self):
        adj = Principle.ORDER.adjacent
        assert Principle.MATTER in adj
        assert Principle.ENERGY in adj
        assert Principle.ENTROPY not in adj  # opposite, not adjacent
        assert len(adj) == 2

    def test_adjacency_excludes_self_and_opposite(self):
        for p in Principle:
            adj = p.adjacent
            assert p not in adj
            assert p.opposite not in adj


# ═══════════════════════════════════════════════
# Principle Interaction Tests
# ═══════════════════════════════════════════════

class TestPrincipleInteraction:
    def test_same_principle_neutral(self):
        result = get_principle_interaction("order", "order")
        assert result.interaction == InteractionType.NEUTRAL
        assert result.advantage_mod == 0.0

    def test_opposite_strong(self):
        result = get_principle_interaction("order", "entropy")
        assert result.interaction == InteractionType.STRONG
        assert result.advantage_mod == 0.15

    def test_adjacent_synergy(self):
        result = get_principle_interaction("order", "matter")
        assert result.interaction == InteractionType.SYNERGY
        assert result.advantage_mod == 0.05

    def test_non_adjacent_weak(self):
        # Order vs Flux: not opposite, not adjacent → weak
        result = get_principle_interaction("order", "flux")
        assert result.interaction == InteractionType.WEAK
        assert result.advantage_mod == -0.10

    def test_enum_input(self):
        result = get_principle_interaction(Principle.ENERGY, Principle.VOID)
        assert result.interaction == InteractionType.STRONG

    def test_all_pairs_have_result(self):
        for a in Principle:
            for d in Principle:
                result = get_principle_interaction(a, d)
                assert isinstance(result, PrincipleInteraction)
                assert result.advantage_mod >= -0.10
                assert result.advantage_mod <= 0.15


# ═══════════════════════════════════════════════
# NormalSkill Tests
# ═══════════════════════════════════════════════

class TestNormalSkill:
    def test_tier1_single_principle(self):
        s = NormalSkill(
            id="s1", name="Energy Burst",
            primary_principle="energy", tier=1,
        )
        assert s.principles == ["energy"]
        assert s.tier == 1

    def test_tier2_dual_principle(self):
        s = NormalSkill(
            id="s2", name="Kinetic Barrier",
            primary_principle="matter",
            secondary_principle="energy",
            tier=2,
        )
        assert s.principles == ["matter", "energy"]

    def test_tier3_triple_principle(self):
        s = NormalSkill(
            id="s3", name="Reality Anchor",
            primary_principle="order",
            secondary_principle="void",
            tertiary_principle="matter",
            tier=3,
        )
        assert len(s.principles) == 3

    def test_empty_principles(self):
        s = NormalSkill()
        assert s.principles == []


# ═══════════════════════════════════════════════
# ResonanceState Tests
# ═══════════════════════════════════════════════

class TestResonanceState:
    def test_defaults_zero(self):
        r = ResonanceState()
        assert r.get("energy") == 0.0
        assert r.get(Principle.ORDER) == 0.0

    def test_set_and_get(self):
        r = ResonanceState()
        r.set("energy", 0.5)
        assert r.get("energy") == 0.5

    def test_clamp_high(self):
        r = ResonanceState()
        r.set("energy", 1.5)
        assert r.get("energy") == 1.0

    def test_clamp_low(self):
        r = ResonanceState()
        r.set("energy", -0.3)
        assert r.get("energy") == 0.0

    def test_grow_respects_floor_cap(self):
        r = ResonanceState()
        r.set("energy", 0.45)
        # Floor 1 cap = 0.50
        result = r.grow("energy", 0.10, floor=1)
        assert result == 0.50  # Capped at floor 1

    def test_grow_with_personal_bonus(self):
        r = ResonanceState()
        r.set("energy", 0.45)
        # Floor 1 cap = 0.50 + 0.1 personal = 0.60
        result = r.grow("energy", 0.10, floor=1, personal_cap_bonus=0.1)
        assert result == 0.55

    def test_decay_minimum(self):
        r = ResonanceState()
        r.set("energy", 0.12)
        result = r.decay("energy", amount=0.05)
        assert result == 0.10  # Minimum threshold

    def test_to_dict(self):
        r = ResonanceState(energy=0.5, order=0.3)
        d = r.to_dict()
        assert d["energy"] == 0.5
        assert d["order"] == 0.3
        assert len(d) == 6  # All 6 principles

    def test_dominant_principle(self):
        r = ResonanceState(energy=0.7, order=0.3, entropy=0.5)
        assert r.dominant_principle() == "energy"


# ═══════════════════════════════════════════════
# Floor Resonance Cap Tests
# ═══════════════════════════════════════════════

class TestFloorCaps:
    def test_known_floors(self):
        assert get_floor_resonance_cap(1) == 0.50
        assert get_floor_resonance_cap(2) == 0.70
        assert get_floor_resonance_cap(3) == 0.85
        assert get_floor_resonance_cap(4) == 0.95
        assert get_floor_resonance_cap(5) == 1.00

    def test_floor_zero(self):
        assert get_floor_resonance_cap(0) == 0.50

    def test_floor_beyond(self):
        assert get_floor_resonance_cap(6) == 1.0


# ═══════════════════════════════════════════════
# CombatMetrics Tests
# ═══════════════════════════════════════════════

class TestCombatMetrics:
    def test_defaults(self):
        m = CombatMetrics()
        assert m.hp == 100.0
        assert m.stability == 100.0
        assert m.stability_ratio == 1.0
        assert m.dqs_ratio == 0.5  # Default DQS = 50

    def test_ratios(self):
        m = CombatMetrics(stability=75, dqs=80)
        assert m.stability_ratio == 0.75
        assert m.dqs_ratio == 0.8


# ═══════════════════════════════════════════════
# Intensity Tests
# ═══════════════════════════════════════════════

class TestIntensity:
    def test_bonuses(self):
        assert Intensity.SAFE.bonus == 0.0
        assert Intensity.PUSH.bonus == 0.02
        assert Intensity.OVERDRIVE.bonus == 0.05

    def test_backlash_risk(self):
        assert Intensity.SAFE.backlash_risk == 0.0
        assert Intensity.PUSH.backlash_risk == 0.05
        assert Intensity.OVERDRIVE.backlash_risk == 0.20


# ═══════════════════════════════════════════════
# Progression Tests
# ═══════════════════════════════════════════════

class TestProgressionRank:
    def test_five_ranks(self):
        assert len(ProgressionRank) == 5

    def test_display_names(self):
        for r in ProgressionRank:
            assert r.display_name
            assert "(" in r.display_name  # Has both VN and EN

    def test_skill_slots(self):
        assert ProgressionRank.AWAKENED.skill_slots == 3
        assert ProgressionRank.RESONANT.skill_slots == 4
        assert ProgressionRank.STABILIZED.skill_slots == 4

    def test_ordering(self):
        assert ProgressionRank.AWAKENED < ProgressionRank.RESONANT
        assert ProgressionRank.SOVEREIGN > ProgressionRank.TRANSCENDENT


class TestRankUp:
    def test_rank1_to_2(self):
        prog = PlayerProgression(total_scenes=15)
        assert check_rank_up(
            player_dqs=45, player_coherence=55, progression=prog
        ) is True

    def test_rank1_to_2_fail_dqs(self):
        prog = PlayerProgression(total_scenes=15)
        assert check_rank_up(
            player_dqs=30, player_coherence=55, progression=prog
        ) is False

    def test_rank1_to_2_fail_coherence(self):
        prog = PlayerProgression(total_scenes=15)
        assert check_rank_up(
            player_dqs=45, player_coherence=40, progression=prog
        ) is False

    def test_rank1_to_2_fail_scenes(self):
        prog = PlayerProgression(total_scenes=5)
        assert check_rank_up(
            player_dqs=45, player_coherence=55, progression=prog
        ) is False

    def test_rank2_to_3(self):
        prog = PlayerProgression(
            current_rank=ProgressionRank.RESONANT,
            stability_trials_passed=1,
            floor_bosses_cleared=[1, 2],
        )
        assert check_rank_up(
            player_dqs=65, player_coherence=70, progression=prog
        ) is True

    def test_rank4_to_5(self):
        prog = PlayerProgression(
            current_rank=ProgressionRank.TRANSCENDENT,
            season_climax_cleared=True,
        )
        assert check_rank_up(
            player_dqs=90, player_coherence=80, progression=prog
        ) is True

    def test_max_rank_no_upgrade(self):
        prog = PlayerProgression(
            current_rank=ProgressionRank.SOVEREIGN,
        )
        assert check_rank_up(
            player_dqs=100, player_coherence=100, progression=prog
        ) is False


# ═══════════════════════════════════════════════
# PlayerState Backward Compatibility
# ═══════════════════════════════════════════════

class TestPlayerStatePowerFields:
    def test_new_fields_default(self):
        """New power fields should have safe defaults."""
        p = PlayerState(user_id="u1", name="Test")
        assert p.resonance == {}
        assert p.stability == 100.0
        assert p.hp == 100.0
        assert p.current_floor == 1
        assert p.equipped_skills == []
        assert p.current_rank == 1

    def test_existing_fields_unchanged(self):
        """Existing identity fields should still work."""
        p = PlayerState(
            user_id="u1", name="Test",
            identity_coherence=80.0,
            instability=15.0,
            decision_quality_score=65.0,
        )
        assert p.identity_coherence == 80.0
        assert p.instability == 15.0
        assert p.decision_quality_score == 65.0
