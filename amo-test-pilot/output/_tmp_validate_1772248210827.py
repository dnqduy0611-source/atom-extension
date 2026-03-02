import pytest
from unittest.mock import AsyncMock
import json
from pathlib import Path
from langchain_core.messages import AIMessage

from app.models.pipeline import NarrativeState, Beat, PlannerOutput

@pytest.fixture
def make_state():
    """Create a minimal NarrativeState for testing."""
    def _make_state(**kwargs):
        defaults = {
            "story_id": "test_story",
            "chapter_number": 1,
            "protagonist_name": "Thiên Vũ",
            "previous_summary": "Chapter đầu tiên.",
            "free_input": "",
            "preference_tags": ["action", "adventure"],
            "tone": "epic",
            "player_state": {
                "archetype": "warrior",
                "current_identity": {
                    "active_values": ["honor", "justice"],
                    "active_traits": ["brave", "stubborn"],
                    "current_motivation": "protect the village"
                },
                "instability": 30,
                "breakthrough_meter": 20,
                "unique_skill": {
                    "name": "Dragon Strike",
                    "description": "Powerful melee attack",
                    "category": "fire"
                },
                "equipped_skills": [
                    {"catalog_name": "Sword Mastery", "principle": "combat"}
                ]
            }
        }
        defaults.update(kwargs)
        return NarrativeState(**defaults)
    return _make_state

@pytest.mark.asyncio
async def test_run_planner_happy_path(make_state):
    """Test successful planner execution with valid JSON response."""
    state = make_state()
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content=json.dumps({
        "beats": [{
            "description": "Test beat",
            "tension": 5,
            "purpose": "rising",
            "scene_type": "combat",
            "mood": "tense"
        }],
        "chapter_tension": 5,
        "pacing": "medium",
        "emotional_arc": "growth",
        "new_characters": [],
        "world_changes": []
    }))

    result = await run_planner(state, mock_llm)

    assert "planner_output" in result
    assert isinstance(result["planner_output"], PlannerOutput)
    assert len(result["planner_output"].beats) > 0
    mock_llm.ainvoke.assert_called_once()

@pytest.mark.asyncio
async def test_run_planner_json_parse_failure(make_state):
    """Test fallback behavior when LLM returns invalid JSON."""
    state = make_state()
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content="invalid json {")

    result = await run_planner(state, mock_llm)

    assert "planner_output" in result
    assert len(result["planner_output"].beats) > 0  # Should have fallback beats
    assert result["planner_output"].chapter_tension == 5  # Default value

@pytest.mark.asyncio
async def test_run_planner_with_skill_reward(make_state):
    """Test skill reward beat injection."""
    state = make_state(skill_reward_plan={
        "should_reward": True,
        "source": "quest",
        "narrative_hint": "Find the ancient scroll"
    })
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content=json.dumps({
        "beats": [{"description": "Test beat", "tension": 5, "purpose": "rising"}],
        "chapter_tension": 5,
        "pacing": "medium"
    }))

    result = await run_planner(state, mock_llm)

    assert any(b.scene_type == "discovery" for b in result["planner_output"].beats)
    assert any(b.skill_reward is not None for b in result["planner_output"].beats)

@pytest.mark.asyncio
async def test_run_planner_with_empty_player_state(make_state):
    """Test behavior when player_state is None."""
    state = make_state(player_state=None)
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content=json.dumps({
        "beats": [{"description": "Test beat", "tension": 5, "purpose": "rising"}],
        "chapter_tension": 5,
        "pacing": "medium"
    }))

    result = await run_planner(state, mock_llm)

    assert "planner_output" in result
    assert len(result["planner_output"].beats) > 0

@pytest.mark.asyncio
async def test_run_planner_with_dict_player_state(make_state):
    """Test behavior when player_state is a dict."""
    state = make_state(player_state={
        "archetype": "mage",
        "current_identity": {
            "active_values": ["knowledge"],
            "active_traits": ["curious"],
            "current_motivation": "learn magic"
        },
        "unique_skill": {
            "name": "Fireball",
            "description": "Ranged fire attack"
        }
    })
    mock_llm = AsyncMock()
    mock_llm.ainvoke.return_value = AIMessage(content=json.dumps({
        "beats": [{"description": "Test beat", "tension": 5, "purpose": "rising"}],
        "chapter_tension": 5,
        "pacing": "medium"
    }))

    result = await run_planner(state, mock_llm)

    assert "planner_output" in result
    assert len(result["planner_output"].beats) > 0

def test_extract_json_with_markdown():
    """Test JSON extraction from markdown fence."""
    input_text = "