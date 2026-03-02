import pytest
from unittest.mock import AsyncMock
import json
from langchain_core.messages import AIMessage
from app.models.pipeline import NarrativeState, Beat, PlannerOutput

@pytest.fixture
def mock_llm():
    return AsyncMock()

@pytest.fixture
def make_state():
    def _make_state(**kwargs):
        defaults = {
            "story_id": "test_story",
            "chapter_number": 1,
            "protagonist_name": "Thiên Vũ",
            "previous_summary": "Chapter đầu tiên.",
            "free_input": "",
            "preference_tags": ["action", "adventure"],
            "chosen_choice": {"text": "Bắt đầu câu chuyện"},
            "player_state": {
                "archetype": "hero",
                "current_identity": {
                    "active_values": ["courage", "honor"],
                    "active_traits": ["brave", "determined"],
                    "current_motivation": "protect the innocent"
                },
                "instability": 30,
                "breakthrough_meter": 50,
                "unique_skill": {
                    "name": "Dragon Strike",
                    "description": "Powerful melee attack",
                    "mechanic": "Deals 3x damage",
                    "activation_condition": "When HP < 30%",
                    "limitation": "Once per battle",
                    "category": "combat"
                },
                "equipped_skills": [
                    {"catalog_name": "Fireball", "principle": "elemental"},
                    {"catalog_name": "Shield", "principle": "defense"}
                ]
            },
            "skill_reward_plan": {
                "should_reward": True,
                "source": "story",
                "narrative_hint": "A hidden power awakens"
            },
            "crng_event": {
                "triggered": True,
                "event_type": "random_encounter",
                "affinity_tag": "neutral",
                "details": "A mysterious stranger appears"
            },
            "fate_instruction": "Follow your destiny",
            "backstory": "Once a simple farmer",
            "tone": "epic"
        }
        defaults.update(kwargs)
        return NarrativeState(**defaults)
    return _make_state

@pytest.mark.asyncio
async def test_run_planner_happy_path(mock_llm, make_state):
    state = make_state()
    mock_llm.ainvoke.return_value = AIMessage(content=json.dumps({
        "beats": [{"description": "Test beat", "tension": 5, "purpose": "rising"}],
        "chapter_tension": 5,
        "pacing": "medium",
        "new_characters": [],
        "world_changes": [],
        "emotional_arc": "growth"
    }))

    result = await run_planner(state, mock_llm)

    assert "planner_output" in result
    assert isinstance(result["planner_output"], PlannerOutput)
    assert len(result["planner_output"].beats) > 0
    mock_llm.ainvoke.assert_called_once()

@pytest.mark.asyncio
async def test_run_planner_json_parse_failure(mock_llm, make_state):
    state = make_state()
    mock_llm.ainvoke.return_value = AIMessage(content="invalid json {{{")

    result = await run_planner(state, mock_llm)

    assert "planner_output" in result
    assert isinstance(result["planner_output"], PlannerOutput)
    assert len(result["planner_output"].beats) > 0

@pytest.mark.asyncio
async def test_run_planner_empty_player_state(mock_llm, make_state):
    state = make_state(player_state=None)
    mock_llm.ainvoke.return_value = AIMessage(content=json.dumps({
        "beats": [{"description": "Test beat", "tension": 5, "purpose": "rising"}],
        "chapter_tension": 5,
        "pacing": "medium",
        "new_characters": [],
        "world_changes": [],
        "emotional_arc": "growth"
    }))

    result = await run_planner(state, mock_llm)

    assert "planner_output" in result
    assert isinstance(result["planner_output"], PlannerOutput)

@pytest.mark.asyncio
async def test_run_planner_with_skill_reward(mock_llm, make_state):
    state = make_state()
    mock_llm.ainvoke.return_value = AIMessage(content=json.dumps({
        "beats": [{"description": "Test beat", "tension": 5, "purpose": "rising"}],
        "chapter_tension": 5,
        "pacing": "medium",
        "new_characters": [],
        "world_changes": [],
        "emotional_arc": "growth"
    }))

    result = await run_planner(state, mock_llm)

    assert "planner_output" in result
    assert any(beat.scene_type == "discovery" for beat in result["planner_output"].beats)

def test_extract_json_strips_markdown_fence():
    raw = "