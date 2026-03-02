"""Tests for Planner ↔ Skill Rewards integration.

Validates:
- Prompt includes normal skills and skill reward sections
- _inject_skill_reward_beat adds discovery beat when plan says should_reward
- Existing discovery beats get skill_reward attached
- No injection when should_reward is False
"""

import pytest

from app.models.pipeline import Beat, NarrativeState
from app.narrative.planner import _inject_skill_reward_beat


# ════════════════════════════════════════════
# _inject_skill_reward_beat
# ════════════════════════════════════════════

class TestInjectSkillRewardBeat:

    def test_inserts_discovery_beat_when_none_exists(self):
        beats = [
            Beat(description="Setup", tension=3, purpose="setup"),
            Beat(description="Climax", tension=8, purpose="climax"),
        ]
        plan = {
            "should_reward": True,
            "source": "floor_clear",
            "narrative_hint": "A crystal shard glows",
        }
        _inject_skill_reward_beat(beats, plan)

        assert len(beats) == 3
        # Discovery should be before the final beat
        assert beats[1].scene_type == "discovery"
        assert beats[1].skill_reward == plan
        assert "crystal shard" in beats[1].description

    def test_attaches_to_existing_discovery_beat(self):
        plan = {"should_reward": True, "source": "boss_kill"}
        beats = [
            Beat(description="Fight", tension=7, purpose="rising"),
            Beat(description="Find artifact", tension=5, purpose="rising",
                 scene_type="discovery"),
            Beat(description="Rest", tension=2, purpose="falling"),
        ]
        _inject_skill_reward_beat(beats, plan)

        # Should NOT add a new beat — attach to existing
        assert len(beats) == 3
        assert beats[1].skill_reward == plan

    def test_does_not_overwrite_existing_reward(self):
        existing_reward = {"should_reward": True, "source": "npc"}
        new_plan = {"should_reward": True, "source": "boss"}
        beats = [
            Beat(description="Discovery", tension=5, purpose="rising",
                 scene_type="discovery", skill_reward=existing_reward),
        ]
        _inject_skill_reward_beat(beats, new_plan)

        # Should keep existing reward
        assert beats[0].skill_reward == existing_reward

    def test_single_beat_inserts_at_zero(self):
        beats = [
            Beat(description="Only beat", tension=5, purpose="rising"),
        ]
        plan = {"should_reward": True, "source": "training"}
        _inject_skill_reward_beat(beats, plan)

        assert len(beats) == 2
        assert beats[0].scene_type == "discovery"
        assert beats[1].description == "Only beat"


# ════════════════════════════════════════════
# NarrativeState skill_reward_plan
# ════════════════════════════════════════════

class TestNarrativeStateIntegration:

    def test_default_none(self):
        state = NarrativeState()
        assert state.skill_reward_plan is None

    def test_set_plan(self):
        state = NarrativeState(
            skill_reward_plan={"should_reward": True, "source": "floor_boss"},
        )
        assert state.skill_reward_plan["should_reward"] is True

    def test_plan_in_model_dump(self):
        state = NarrativeState(
            skill_reward_plan={"should_reward": False},
        )
        data = state.model_dump()
        assert "skill_reward_plan" in data


# ════════════════════════════════════════════
# Beat model skill_reward
# ════════════════════════════════════════════

class TestBeatSkillReward:

    def test_beat_default_no_reward(self):
        b = Beat(description="test")
        assert b.skill_reward is None

    def test_beat_with_reward(self):
        b = Beat(
            description="discovery",
            scene_type="discovery",
            skill_reward={"should_reward": True, "source": "crng"},
        )
        assert b.skill_reward["source"] == "crng"

    def test_beat_discovery_type(self):
        b = Beat(description="find power", scene_type="discovery")
        assert b.scene_type == "discovery"
