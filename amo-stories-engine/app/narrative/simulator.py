"""Agent 2: Simulator — predicts consequences of player's choice."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage

from app.models.pipeline import NarrativeState, SimulatorOutput
from app.narrative.world_context import get_world_context

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "simulator.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""
_FULL_SYSTEM_PROMPT = get_world_context() + "\n\n---\n\n" + _SYSTEM_PROMPT

_USER_TEMPLATE = """## Lựa chọn player:
{choice_text} (risk level: {risk_level})

## Dàn ý chương (từ Planner):
- Beats: {beats}
- Tension: {chapter_tension}
- Emotional arc: {emotional_arc}

## Tóm tắt trước đó:
{previous_summary}

## Player Identity:
- Values: {values}
- Traits: {traits}
- Archetype: {archetype}"""


def _get_player_values(player) -> str:
    if not player:
        return ""
    if isinstance(player, dict):
        ci = player.get("current_identity", {})
        return ", ".join(ci.get("active_values", [])) if isinstance(ci, dict) else ""
    ci = getattr(player, "current_identity", None)
    return ", ".join(getattr(ci, "active_values", [])) if ci else ""


def _get_player_traits(player) -> str:
    if not player:
        return ""
    if isinstance(player, dict):
        ci = player.get("current_identity", {})
        return ", ".join(ci.get("active_traits", [])) if isinstance(ci, dict) else ""
    ci = getattr(player, "current_identity", None)
    return ", ".join(getattr(ci, "active_traits", [])) if ci else ""


def _get_player_archetype(player) -> str:
    if not player:
        return ""
    if isinstance(player, dict):
        return player.get("archetype", "")
    return getattr(player, "archetype", "")


async def run_simulator(state: NarrativeState, llm: object) -> dict:
    """Predict consequences and relationship changes."""

    player = state.player_state
    choice = state.chosen_choice
    planner = state.planner_output

    beats_text = ""
    if planner:
        beats_text = "; ".join(b.description for b in planner.beats)

    messages = [
        SystemMessage(content=_FULL_SYSTEM_PROMPT),
        HumanMessage(content=_USER_TEMPLATE.format(
            choice_text=choice.text if choice else "Bắt đầu",
            risk_level=choice.risk_level if choice else 1,
            beats=beats_text or "Chưa xác định",
            chapter_tension=planner.chapter_tension if planner else 5,
            emotional_arc=planner.emotional_arc if planner else "growth",
            previous_summary=state.previous_summary or "Đây là chương đầu tiên.",
            values=_get_player_values(player),
            traits=_get_player_traits(player),
            archetype=_get_player_archetype(player),
        )),
    ]

    logger.info(f"Simulator: predicting consequences for chapter {state.chapter_number}")
    response = await llm.ainvoke(messages)
    content = _extract_json(response.content)

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        logger.error(f"Simulator JSON parse failed: {content[:200]}")
        result = {
            "consequences": [{"description": "Hành động tạo ra thay đổi", "severity": "moderate", "timeframe": "immediate", "reversible": True}],
            "relationship_changes": [],
            "world_impact": "",
            "foreshadowing": [],
            "identity_alignment": {"aligns_with_seed": True, "drift_indicator": "none", "note": ""},
        }

    simulator_output = SimulatorOutput(
        consequences=result.get("consequences") or [],
        relationship_changes=result.get("relationship_changes") or [],
        world_impact=result.get("world_impact") or "",
        foreshadowing=result.get("foreshadowing") or [],
        identity_alignment=result.get("identity_alignment") or {},
    )

    return {"simulator_output": simulator_output}


def _extract_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text
