"""Agent 6: Critic — quality gate that scores prose and approves/rejects."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage

from app.models.pipeline import CriticOutput, NarrativeState
from app.narrative.world_context import get_world_context

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "critic.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""
_FULL_SYSTEM_PROMPT = get_world_context() + "\n\n---\n\n" + _SYSTEM_PROMPT

_USER_TEMPLATE = """## Writer Output:
### Title: {chapter_title}

### Full Prose:
{prose_preview}

### Prose length: {prose_length} characters

### Choices:
{choices_text}

### Summary: {summary}

## Planner Outline:
- Beats: {beats}
- Tension: {chapter_tension}
- Pacing: {pacing}

## Preference Tags: {preference_tags}
## Narrative Tone: {tone}
## Rewrite count: {rewrite_count}

{canon_warnings}"""


async def run_critic(state: NarrativeState, llm: object) -> dict:
    """Score the writer's output and approve or request rewrite.

    Pre-LLM step: Canon Guard checks for critical world violations.
    Critical violations → immediate reject without LLM call.
    Non-critical violations → appended to LLM critic instructions.
    """
    from app.world.canon_guard import (
        check_canon,
        has_critical_violation,
        format_for_rewrite,
        format_as_warnings,
    )

    writer = state.writer_output
    planner = state.planner_output

    if not writer:
        logger.warning("Critic: no writer output to review")
        return {
            "critic_output": CriticOutput(
                score=0, approved=False,
                issues=["No writer output"],
                rewrite_instructions="Writer must generate prose first.",
            )
        }

    # ── Canon Guard pre-check ──
    prose = writer.prose or ""
    violations = check_canon(prose)
    if has_critical_violation(violations):
        rewrite_instructions = format_for_rewrite(violations)
        logger.warning(f"Critic: Canon Guard CRITICAL violation — forcing rewrite")
        return {
            "critic_output": CriticOutput(
                score=0,
                approved=False,
                issues=[v.message for v in violations if v.severity == "critical"],
                rewrite_instructions=rewrite_instructions,
                feedback={"canon_violations": len(violations)},
            )
        }

    # Non-critical violations: append as warnings to LLM prompt
    canon_warnings = format_as_warnings(violations)

    # Format choices for review
    choices_text = "\n".join(
        f"  {i+1}. [{c.risk_level}] {c.text} — {c.consequence_hint}"
        for i, c in enumerate(writer.choices)
    )

    # Format beats
    beats_text = "N/A"
    if planner:
        beats_text = "; ".join(b.description for b in planner.beats)

    messages = [
        SystemMessage(content=_FULL_SYSTEM_PROMPT),
        HumanMessage(content=_USER_TEMPLATE.format(
            chapter_title=writer.chapter_title,
            prose_preview=writer.prose,  # Full prose — critic must evaluate complete text
            prose_length=len(writer.prose),
            choices_text=choices_text,
            summary=writer.summary,
            beats=beats_text,
            chapter_tension=planner.chapter_tension if planner else "N/A",
            pacing=planner.pacing if planner else "N/A",
            preference_tags=", ".join(state.preference_tags) if state.preference_tags else "general",
            tone=state.tone or "Tự do",
            rewrite_count=state.rewrite_count,
            canon_warnings=canon_warnings,
        )),
    ]

    logger.info(f"Critic: reviewing chapter {state.chapter_number} (rewrite {state.rewrite_count})")
    response = await llm.ainvoke(messages)
    content = _extract_json(response.content)

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        logger.error(f"Critic JSON parse failed: {content[:200]}")
        # Fallback: auto-approve if we can't parse
        return {
            "critic_output": CriticOutput(
                score=7.0,
                approved=True,
                feedback={},
                issues=["Critic response parse failed — auto-approved"],
                rewrite_instructions="",
            )
        }

    score = float(result.get("score", 7.0))
    approved = result.get("approved", score >= 7.0)

    # Force approve on 3rd rewrite only if score is at least "passable +"
    # Raised from 5.0 → 6.5 to avoid accepting genuinely poor prose
    if state.rewrite_count >= 2 and score >= 6.5:
        approved = True
        logger.info(f"Critic: force-approved after {state.rewrite_count} rewrites (score: {score})")

    critic_output = CriticOutput(
        score=score,
        approved=approved,
        feedback=result.get("feedback", {}),
        issues=result.get("issues", []),
        rewrite_instructions=result.get("rewrite_instructions", ""),
    )

    return {"critic_output": critic_output}


def _extract_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text
