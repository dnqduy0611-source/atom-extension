"""Phase 3 tests — Growth Engine (Bloom).

Tests per-scene growth tracking, bloom trigger detection,
bloom application, bloom prompt generation,
aspect/ultimate trigger stubs, and growth state init.
"""

import pytest

from app.engine.unique_skill_growth import (
    ECHO_STREAK_THRESHOLD,
    SCAR_TRAUMA_THRESHOLD,
    COHERENCE_THRESHOLD,
    ECHO_RESET_THRESHOLD,
    ASPECT_RANK_REQ,
    ASPECT_USE_COUNT,
    update_growth_per_scene,
    check_bloom_trigger,
    apply_bloom,
    build_bloom_prompt,
    check_aspect_trigger,
    check_ultimate_trigger,
    init_growth_state,
)
from app.models.player import PlayerState, SubSkill, UniqueSkill, PlayerProgression
from app.models.unique_skill_growth import (
    GrowthType,
    ScarType,
    TraumaEvent,
    UniqueSkillGrowthState,
)


def _make_player(**overrides) -> PlayerState:
    """Create test player with growth state."""
    defaults = {
        "name": "TestPlayer",
        "identity_coherence": 80.0,
        "instability": 10.0,
        "hp": 100.0,
        "hp_max": 100.0,
        "total_chapters": 5,
        "unique_skill": UniqueSkill(
            name="Thệ Ước Thép",
            category="manifestation",
            mechanic="Cứng hóa phần cơ thể đang bị va chạm",
            weakness="Mất xúc giác 30 giây",
            weakness_type="sensory_tax",
            domain_passive_name="Thân Thép",
            domain_passive_mechanic="Immune Normal defensive",
            unique_clause="Stability < 30% → mạnh hơn",
            sub_skills=[
                SubSkill(name="Thân Thép", type="passive", unlocked_at="seed"),
            ],
        ),
        "unique_skill_growth": UniqueSkillGrowthState(
            skill_id="Thệ Ước Thép",
            original_skill_name="Thệ Ước Thép",
            current_skill_name="Thệ Ước Thép",
        ),
    }
    defaults.update(overrides)
    return PlayerState(**defaults)


# ──────────────────────────────────────────────
# Per-Scene Growth Update
# ──────────────────────────────────────────────

class TestUpdateGrowthPerScene:
    """Per-scene growth tracking tests."""

    def test_echo_streak_increments(self):
        player = _make_player(identity_coherence=80.0)
        events = update_growth_per_scene(player)
        assert player.unique_skill_growth.echo_coherence_streak == 1
        assert "echo_streak" in events

    def test_echo_streak_accumulates(self):
        player = _make_player(identity_coherence=75.0)
        player.unique_skill_growth.echo_coherence_streak = 5
        events = update_growth_per_scene(player)
        assert player.unique_skill_growth.echo_coherence_streak == 6

    def test_echo_streak_broken_below_threshold(self):
        player = _make_player(identity_coherence=40.0)
        player.unique_skill_growth.echo_coherence_streak = 5
        events = update_growth_per_scene(player)
        assert player.unique_skill_growth.echo_coherence_streak == 3  # -2
        assert "echo_streak_broken" in events

    def test_echo_streak_not_broken_in_between(self):
        """Coherence between ECHO_RESET and COHERENCE thresholds = no change."""
        player = _make_player(identity_coherence=60.0)
        player.unique_skill_growth.echo_coherence_streak = 5
        events = update_growth_per_scene(player)
        assert player.unique_skill_growth.echo_coherence_streak == 5

    def test_trauma_logged_on_defeat(self):
        player = _make_player()
        events = update_growth_per_scene(
            player,
            is_combat=True,
            combat_outcome="enemy_wins",
            defeat_severity="defeat",
        )
        assert player.unique_skill_growth.scar_trauma_count == 1
        assert len(player.unique_skill_growth.trauma_log) == 1
        assert "trauma_logged" in events

    def test_near_death_trauma(self):
        player = _make_player(hp=10.0, hp_max=100.0)
        events = update_growth_per_scene(
            player,
            is_combat=True,
            combat_outcome="player_wins",
        )
        assert player.unique_skill_growth.scar_trauma_count == 1
        assert player.unique_skill_growth.trauma_log[0].severity == "near_death"

    def test_no_growth_without_growth_state(self):
        player = _make_player(unique_skill_growth=None)
        events = update_growth_per_scene(player)
        assert events == {}

    def test_combat_bonus_tracked(self):
        player = _make_player()
        update_growth_per_scene(
            player, is_combat=True, skill_was_used=True,
        )
        assert player.unique_skill_growth.combat_bonus > 0.0


# ──────────────────────────────────────────────
# Bloom Trigger Detection
# ──────────────────────────────────────────────

class TestCheckBloomTrigger:
    """Bloom trigger detection tests."""

    def test_echo_bloom_at_threshold(self):
        player = _make_player()
        player.unique_skill_growth.echo_coherence_streak = ECHO_STREAK_THRESHOLD
        assert check_bloom_trigger(player) == "echo"

    def test_echo_bloom_above_threshold(self):
        player = _make_player()
        player.unique_skill_growth.echo_coherence_streak = 15
        assert check_bloom_trigger(player) == "echo"

    def test_scar_bloom_at_threshold(self):
        player = _make_player()
        player.unique_skill_growth.scar_trauma_count = SCAR_TRAUMA_THRESHOLD
        assert check_bloom_trigger(player) == "scar"

    def test_no_bloom_under_threshold(self):
        player = _make_player()
        player.unique_skill_growth.echo_coherence_streak = 5
        player.unique_skill_growth.scar_trauma_count = 1
        assert check_bloom_trigger(player) is None

    def test_no_bloom_already_completed(self):
        player = _make_player()
        player.unique_skill_growth.echo_coherence_streak = 15
        player.unique_skill_growth.bloom_completed = True
        assert check_bloom_trigger(player) is None

    def test_no_bloom_without_growth_state(self):
        player = _make_player(unique_skill_growth=None)
        assert check_bloom_trigger(player) is None

    def test_echo_priority_over_scar(self):
        """When both are met, echo wins (checked first)."""
        player = _make_player()
        player.unique_skill_growth.echo_coherence_streak = ECHO_STREAK_THRESHOLD
        player.unique_skill_growth.scar_trauma_count = SCAR_TRAUMA_THRESHOLD
        assert check_bloom_trigger(player) == "echo"

    def test_scar_not_readapted(self):
        """Scar bloom only if not already adapted."""
        player = _make_player()
        player.unique_skill_growth.scar_trauma_count = 5
        player.unique_skill_growth.scar_adapted = True
        assert check_bloom_trigger(player) is None


# ──────────────────────────────────────────────
# Bloom Application
# ──────────────────────────────────────────────

class TestApplyBloom:
    """Bloom application tests."""

    def test_echo_bloom_applied(self):
        player = _make_player()
        ss1_data = {
            "name": "Trực Giác Sắc",
            "type": "active",
            "mechanic": "Detect enemy weakness once/combat",
            "cost": "15 stability",
        }
        result = apply_bloom(player, "echo", ss1_data=ss1_data)

        assert player.unique_skill_growth.bloom_completed is True
        assert player.unique_skill_growth.bloom_path == "echo"
        assert player.unique_skill_growth.active_growth == GrowthType.ECHO
        assert player.unique_skill_growth.current_stage == "bloom"
        assert player.unique_skill.current_stage == "bloom"
        assert len(player.unique_skill.sub_skills) == 2  # SS0 + SS1
        assert player.unique_skill.sub_skills[1].name == "Trực Giác Sắc"
        assert player.unique_skill.sub_skills[1].unlocked_at == "bloom"

    def test_scar_bloom_applied(self):
        player = _make_player()
        # Add traumas
        player.unique_skill_growth.trauma_log = [
            TraumaEvent(chapter=1, severity="defeat"),
            TraumaEvent(chapter=3, severity="defeat"),
            TraumaEvent(chapter=5, severity="near_death"),
        ]
        ss1_data = {
            "name": "Phản Xạ Thép",
            "type": "reactive",
            "mechanic": "reflect 20% damage",
            "trigger": "When hit by same attack type",
        }
        result = apply_bloom(player, "scar", ss1_data=ss1_data)

        assert player.unique_skill_growth.bloom_completed is True
        assert player.unique_skill_growth.scar_adapted is True
        assert player.unique_skill_growth.scar_type is not None
        assert player.unique_skill.sub_skills[1].type == "reactive"

    def test_weakness_update(self):
        player = _make_player()
        apply_bloom(
            player, "echo",
            weakness_update="Mất xúc giác 15 giây (nới lỏng)",
        )
        assert player.unique_skill.weakness == "Mất xúc giác 15 giây (nới lỏng)"

    def test_no_growth_state_returns_error(self):
        player = _make_player(unique_skill_growth=None)
        result = apply_bloom(player, "echo")
        assert "error" in result


# ──────────────────────────────────────────────
# Bloom AI Prompt
# ──────────────────────────────────────────────

class TestBuildBloomPrompt:
    """Bloom prompt generation tests."""

    def test_echo_prompt_structure(self):
        player = _make_player()
        player.unique_skill_growth.echo_coherence_streak = 12
        prompt = build_bloom_prompt(
            skill=player.unique_skill,
            bloom_path="echo",
            growth=player.unique_skill_growth,
            player_coherence=85.0,
        )
        assert "ECHO" in prompt
        assert "ACTIVE" in prompt
        assert "Thệ Ước Thép" in prompt
        assert "enhanced_core" in prompt
        assert "ss1" in prompt
        assert "weakness_update" in prompt

    def test_scar_prompt_structure(self):
        player = _make_player()
        player.unique_skill_growth.trauma_log = [
            TraumaEvent(chapter=2, description="Boss hit", severity="defeat"),
            TraumaEvent(chapter=4, description="Ambush", severity="near_death"),
            TraumaEvent(chapter=6, description="Trap", severity="defeat"),
        ]
        player.unique_skill_growth.scar_trauma_count = 3
        prompt = build_bloom_prompt(
            skill=player.unique_skill,
            bloom_path="scar",
            growth=player.unique_skill_growth,
        )
        assert "SCAR" in prompt
        assert "REACTIVE" in prompt
        assert "survived 3 trauma" in prompt
        assert "Trauma Log" in prompt

    def test_prompt_contains_current_skill_info(self):
        player = _make_player()
        prompt = build_bloom_prompt(
            skill=player.unique_skill,
            bloom_path="echo",
            growth=player.unique_skill_growth,
        )
        assert "Cứng hóa phần cơ thể" in prompt  # mechanic
        assert "sensory_tax" in prompt  # weakness_type
        assert "Stability < 30%" in prompt  # unique_clause


# ──────────────────────────────────────────────
# Aspect & Ultimate Trigger Stubs
# ──────────────────────────────────────────────

class TestAspectTrigger:
    """Aspect trigger stub tests."""

    def test_aspect_requires_bloom(self):
        player = _make_player()
        player.unique_skill_growth.bloom_completed = False
        assert check_aspect_trigger(player) is False

    def test_aspect_requires_rank_4(self):
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        player.progression = PlayerProgression(current_rank=3)
        assert check_aspect_trigger(player) is False

    def test_aspect_requires_usage(self):
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        player.progression = PlayerProgression(
            current_rank=4,
            skill_usage={"Thệ Ước Thép": 10},  # Under 20
        )
        assert check_aspect_trigger(player) is False

    def test_aspect_triggers_when_ready(self):
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        player.progression = PlayerProgression(
            current_rank=4,
            skill_usage={"Thệ Ước Thép": 25},
        )
        assert check_aspect_trigger(player) is True

    def test_aspect_not_retriggered(self):
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        player.unique_skill_growth.aspect_forged = True
        player.progression = PlayerProgression(
            current_rank=4,
            skill_usage={"Thệ Ước Thép": 30},
        )
        assert check_aspect_trigger(player) is False


class TestUltimateTrigger:
    """Ultimate trigger stub tests."""

    def test_ultimate_requires_aspect(self):
        player = _make_player()
        player.unique_skill_growth.aspect_forged = False
        assert check_ultimate_trigger(player) is False

    def test_ultimate_requires_rank_5(self):
        player = _make_player()
        player.unique_skill_growth.aspect_forged = True
        player.progression = PlayerProgression(current_rank=4)
        assert check_ultimate_trigger(player) is False

    def test_ultimate_triggers_when_ready(self):
        player = _make_player()
        player.unique_skill_growth.aspect_forged = True
        player.progression = PlayerProgression(current_rank=5)
        assert check_ultimate_trigger(player) is True


# ──────────────────────────────────────────────
# Growth State Init
# ──────────────────────────────────────────────

class TestInitGrowthState:
    """Growth state initialization tests."""

    def test_init_creates_seed_state(self):
        skill = UniqueSkill(
            name="Vết Nứt Sự Thật",
            sub_skills=[
                SubSkill(name="Trực Giác Nứt", type="passive", unlocked_at="seed"),
            ],
        )
        growth = init_growth_state(skill)
        assert growth.skill_id == "Vết Nứt Sự Thật"
        assert growth.current_stage == "seed"
        assert growth.active_growth == GrowthType.BASE
        assert "Trực Giác Nứt" in growth.sub_skills_unlocked

    def test_init_empty_skill(self):
        skill = UniqueSkill(name="Empty Skill")
        growth = init_growth_state(skill)
        assert growth.sub_skills_unlocked == []
        assert growth.bloom_completed is False
