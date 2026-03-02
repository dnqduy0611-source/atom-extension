"""Tests for Growth × Narrative Integration (Phase C).

Tests:
- GrowthBeat model structure
- Echo bloom → 1 beat injection
- Scar bloom → 2 beat injection
- Aspect Forge → 3 beats with decision point
- Ultimate Synthesis → 3 beats (combat)
- Aspect defer → respects 5-chapter wait
- build_growth_writer_context output
- check_and_inject_growth_beats routing
"""

from __future__ import annotations

import pytest

from app.engine.growth_orchestration import (
    GrowthArcType,
    GrowthBeat,
    build_aspect_forge_beats,
    build_bloom_beats,
    build_growth_writer_context,
    build_ultimate_beats,
    check_and_inject_growth_beats,
    handle_aspect_defer,
    is_aspect_defer_expired,
    DEFER_CHAPTERS,
)


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture
def player_seed():
    """Player at Seed stage."""
    from app.models.player import PlayerState, UniqueSkill
    from app.models.unique_skill_growth import UniqueSkillGrowthState

    return PlayerState(
        name="TestPlayer",
        total_chapters=10,
        unique_skill=UniqueSkill(
            name="Vết Nứt Sự Thật",
            category="perception",
            mechanic="Sees truth through cracks",
        ),
        unique_skill_growth=UniqueSkillGrowthState(
            skill_id="vet_nut",
            original_skill_name="Vết Nứt Sự Thật",
            current_skill_name="Vết Nứt Sự Thật",
            current_stage="seed",
        ),
    )


@pytest.fixture
def player_bloom(player_seed):
    """Player at Bloom stage."""
    player_seed.unique_skill_growth.current_stage = "bloom"
    player_seed.unique_skill_growth.bloom_completed = True
    player_seed.unique_skill_growth.bloom_path = "echo"
    return player_seed


@pytest.fixture
def player_aspect(player_bloom):
    """Player at Aspect stage."""
    player_bloom.unique_skill_growth.current_stage = "aspect"
    player_bloom.unique_skill_growth.aspect_forged = True
    player_bloom.unique_skill_growth.aspect_chosen = "Tường Minh"
    player_bloom.total_chapters = 20
    return player_bloom


# ──────────────────────────────────────────────
# GROWTH BEAT MODEL TESTS
# ──────────────────────────────────────────────

class TestGrowthBeat:
    """GrowthBeat model structure."""

    def test_default_values(self):
        beat = GrowthBeat()
        assert beat.arc_type == ""
        assert beat.beat_number == 1
        assert beat.is_decision_point is False
        assert beat.decision_choices == []

    def test_decision_point_beat(self):
        beat = GrowthBeat(
            is_decision_point=True,
            decision_choices=[{"id": "a", "text": "Choose A"}],
        )
        assert beat.is_decision_point is True
        assert len(beat.decision_choices) == 1


# ──────────────────────────────────────────────
# ECHO BLOOM TESTS (1 beat)
# ──────────────────────────────────────────────

class TestEchoBloom:
    """Echo Deepening → 1 beat."""

    def test_echo_produces_one_beat(self, player_seed):
        beats = build_bloom_beats(player_seed, {"bloom_path": "echo"})
        assert len(beats) == 1
        assert beats[0].arc_type == GrowthArcType.ECHO
        assert beats[0].scene_type == "rest"
        assert beats[0].priority == "medium"

    def test_echo_contains_skill_name(self, player_seed):
        beats = build_bloom_beats(player_seed, {"bloom_path": "echo"})
        assert "Vết Nứt Sự Thật" in beats[0].description

    def test_echo_growth_context(self, player_seed):
        beats = build_bloom_beats(player_seed, {"bloom_path": "echo"})
        ctx = beats[0].growth_context
        assert ctx["event"] == "echo_bloom"
        assert ctx["bloom_path"] == "echo"


# ──────────────────────────────────────────────
# SCAR BLOOM TESTS (2 beats)
# ──────────────────────────────────────────────

class TestScarBloom:
    """Scar Adaptation → 2 beats."""

    def test_scar_produces_two_beats(self, player_seed):
        beats = build_bloom_beats(player_seed, {"bloom_path": "scar"})
        assert len(beats) == 2
        assert beats[0].arc_type == GrowthArcType.SCAR
        assert beats[1].arc_type == GrowthArcType.SCAR

    def test_scar_beat_ordering(self, player_seed):
        beats = build_bloom_beats(player_seed, {"bloom_path": "scar"})
        assert beats[0].beat_number == 1
        assert beats[1].beat_number == 2
        assert beats[0].total_beats == 2

    def test_scar_priority_high(self, player_seed):
        beats = build_bloom_beats(player_seed, {"bloom_path": "scar"})
        assert all(b.priority == "high" for b in beats)


# ──────────────────────────────────────────────
# ASPECT FORGE TESTS (3 beats)
# ──────────────────────────────────────────────

class TestAspectForge:
    """Aspect Forge → 3-beat arc with decision point."""

    def test_produces_three_beats(self, player_bloom):
        beats = build_aspect_forge_beats(player_bloom)
        assert len(beats) == 3

    def test_beat_titles(self, player_bloom):
        beats = build_aspect_forge_beats(player_bloom)
        assert beats[0].title == "Skill Run"
        assert beats[1].title == "The Fork"
        assert beats[2].title == "Reborn"

    def test_fork_is_decision_point(self, player_bloom):
        beats = build_aspect_forge_beats(player_bloom)
        fork = beats[1]
        assert fork.is_decision_point is True
        assert len(fork.decision_choices) == 3  # A, B, Defer

    def test_fork_choices_contain_defer(self, player_bloom):
        beats = build_aspect_forge_beats(player_bloom)
        choices = beats[1].decision_choices
        defer = [c for c in choices if c["id"] == "aspect_defer"]
        assert len(defer) == 1

    def test_all_critical_priority(self, player_bloom):
        beats = build_aspect_forge_beats(player_bloom)
        assert all(b.priority == "critical" for b in beats)

    def test_custom_aspect_names(self, player_bloom):
        beats = build_aspect_forge_beats(
            player_bloom,
            aspect_a_name="Minh Sát",
            aspect_b_name="Phá Chấp",
        )
        fork_choices = beats[1].decision_choices
        assert "Minh Sát" in fork_choices[0]["text"]
        assert "Phá Chấp" in fork_choices[1]["text"]


# ──────────────────────────────────────────────
# ULTIMATE SYNTHESIS TESTS (3 beats)
# ──────────────────────────────────────────────

class TestUltimateSynthesis:
    """Ultimate Synthesis → 3-beat Season Climax."""

    def test_produces_three_beats(self, player_aspect):
        beats = build_ultimate_beats(player_aspect, absorbed_skill_name="Iron Strike")
        assert len(beats) == 3

    def test_beat_titles(self, player_aspect):
        beats = build_ultimate_beats(player_aspect)
        assert beats[0].title == "Giới Hạn"
        assert beats[1].title == "Cộng Hưởng Tuyệt Đối"
        assert beats[2].title == "Tái Sinh"

    def test_all_combat_scenes(self, player_aspect):
        beats = build_ultimate_beats(player_aspect)
        assert all(b.scene_type == "combat" for b in beats)

    def test_absorbed_skill_in_context(self, player_aspect):
        beats = build_ultimate_beats(player_aspect, absorbed_skill_name="Thiết Quyền")
        assert "Thiết Quyền" in beats[1].description
        assert beats[1].growth_context["absorbed_skill"] == "Thiết Quyền"


# ──────────────────────────────────────────────
# ASPECT DEFER TESTS
# ──────────────────────────────────────────────

class TestAspectDefer:
    """Aspect defer tracking."""

    def test_defer_sets_fields(self, player_bloom):
        handle_aspect_defer(player_bloom)
        growth = player_bloom.unique_skill_growth
        assert growth.aspect_deferred is True
        assert growth.aspect_defer_chapter == player_bloom.total_chapters

    def test_defer_not_expired_immediately(self, player_bloom):
        handle_aspect_defer(player_bloom)
        assert is_aspect_defer_expired(player_bloom) is False

    def test_defer_expires_after_chapters(self, player_bloom):
        handle_aspect_defer(player_bloom)
        player_bloom.total_chapters += DEFER_CHAPTERS
        assert is_aspect_defer_expired(player_bloom) is True

    def test_not_deferred_returns_false(self, player_bloom):
        assert is_aspect_defer_expired(player_bloom) is False


# ──────────────────────────────────────────────
# CHECK AND INJECT TESTS
# ──────────────────────────────────────────────

class TestCheckAndInject:
    """Main entry point routing."""

    def test_no_events_returns_empty(self, player_seed):
        beats = check_and_inject_growth_beats(player_seed, {})
        assert beats == []

    def test_bloom_injects_beats(self, player_seed):
        events = {"bloom_ready": {"bloom_path": "echo"}}
        beats = check_and_inject_growth_beats(player_seed, events)
        assert len(beats) == 1
        assert beats[0].arc_type == GrowthArcType.ECHO

    def test_scar_bloom_injects_two(self, player_seed):
        events = {"bloom_ready": {"bloom_path": "scar"}}
        beats = check_and_inject_growth_beats(player_seed, events)
        assert len(beats) == 2

    def test_aspect_injects_three(self, player_bloom):
        events = {"aspect_ready": True}
        beats = check_and_inject_growth_beats(player_bloom, events)
        assert len(beats) == 3
        assert beats[0].arc_type == GrowthArcType.ASPECT_FORGE

    def test_ultimate_injects_three(self, player_aspect):
        events = {"ultimate_ready": True}
        beats = check_and_inject_growth_beats(player_aspect, events)
        assert len(beats) == 3
        assert beats[0].arc_type == GrowthArcType.ULTIMATE

    def test_ultimate_takes_priority_over_aspect(self, player_aspect):
        """Ultimate overrides aspect if both triggered."""
        events = {"aspect_ready": True, "ultimate_ready": True}
        beats = check_and_inject_growth_beats(player_aspect, events)
        assert beats[0].arc_type == GrowthArcType.ULTIMATE

    def test_deferred_aspect_skipped(self, player_bloom):
        """Deferred aspect doesn't inject until expire."""
        handle_aspect_defer(player_bloom)
        events = {"aspect_ready": True}
        beats = check_and_inject_growth_beats(player_bloom, events)
        assert beats == []

    def test_deferred_aspect_retriggers(self, player_bloom):
        """Deferred aspect re-triggers after 5 chapters."""
        handle_aspect_defer(player_bloom)
        player_bloom.total_chapters += DEFER_CHAPTERS
        events = {"aspect_ready": True}
        beats = check_and_inject_growth_beats(player_bloom, events)
        assert len(beats) == 3


# ──────────────────────────────────────────────
# WRITER CONTEXT TESTS
# ──────────────────────────────────────────────

class TestWriterContext:
    """build_growth_writer_context output."""

    def test_returns_empty_without_skill(self):
        from app.models.player import PlayerState
        player = PlayerState(name="NoSkill")
        ctx = build_growth_writer_context(player)
        assert ctx == {}

    def test_contains_skill_info(self, player_seed):
        ctx = build_growth_writer_context(player_seed)
        assert ctx["unique_skill"]["name"] == "Vết Nứt Sự Thật"
        assert ctx["growth_state"]["current_stage"] == "seed"

    def test_instruction_includes_stage(self, player_bloom):
        ctx = build_growth_writer_context(player_bloom)
        assert "bloom" in ctx["instruction"]

    def test_aspect_info_when_forged(self, player_aspect):
        ctx = build_growth_writer_context(player_aspect)
        assert ctx["growth_state"]["aspect"] == "Tường Minh"
