"""Agent 0: Input Parser — converts free-text player input to structured choice."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage

from app.models.pipeline import NarrativeState
from app.models.story import Choice
from app.narrative.world_context import get_world_context
from app.security.prompt_guard import sanitize_free_input

logger = logging.getLogger(__name__)

# Load system prompt
_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "input_parser.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""
_FULL_SYSTEM_PROMPT = get_world_context() + "\n\n---\n\n" + _SYSTEM_PROMPT

_USER_TEMPLATE = """Free input: {free_input}
Context: {context}
Protagonist: {protagonist_name}"""


async def run_input_parser(state: NarrativeState, llm: object) -> dict:
    """Parse free text input into a structured Choice.

    If state.free_input is empty (player used a predefined choice),
    this is a no-op and returns empty dict.
    """
    if not state.free_input:
        return {}

    # Sanitize before sending to LLM — blocks prompt injection attempts
    try:
        free_input = sanitize_free_input(state.free_input)
    except ValueError as exc:
        logger.warning(f"Prompt injection blocked in input_parser: {exc}")
        return {
            "chosen_choice": Choice(
                text="[Hành động không hợp lệ]",
                risk_level=1,
                consequence_hint="Hành động bị từ chối do vi phạm quy tắc.",
            )
        }

    logger.info(f"Parsing free input: {free_input[:80]}...")

    messages = [
        SystemMessage(content=_FULL_SYSTEM_PROMPT),
        HumanMessage(content=_USER_TEMPLATE.format(
            free_input=free_input,
            context=state.previous_summary or "Bắt đầu câu chuyện",
            protagonist_name=state.protagonist_name or "Nhân vật chính",
        )),
    ]

    response = await llm.ainvoke(messages)
    content = _extract_json(response.content)

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        logger.warning(f"Failed to parse input_parser response, using raw input")
        return {
            "chosen_choice": Choice(
                text=state.free_input,
                risk_level=3,
                consequence_hint="Hành động tự do của player",
            )
        }

    # If action is impossible, modify it
    action_text = result.get("parsed_action", state.free_input)
    if result.get("feasibility") == "impossible" and result.get("requires_modification"):
        action_text = f"{action_text} ({result.get('modified_reason', '')})"

    return {
        "chosen_choice": Choice(
            text=action_text,
            risk_level=result.get("risk_level", 3),
            consequence_hint=result.get("consequence_hint", ""),
        )
    }


def _extract_json(text: str) -> str:
    """Strip markdown fences from LLM response."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text
