"""Amoisekai — Skill Narrative Wrapping Service.

Takes a mechanical SkillSkeleton + player context and generates
a personalized NarrativeSkin (display_name, description, discovery_line)
via Gemini Flash.

Ref: SKILL_CATALOG_SPEC v1.0 §5
"""

from __future__ import annotations

import json
import logging


from langchain_core.messages import HumanMessage, SystemMessage

from app.models.skill_catalog import NarrativeSkin, SkillSkeleton

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Prompt Templates
# ──────────────────────────────────────────────

_SYSTEM_PROMPT = """You are a narrative designer for a dark-fantasy isekai RPG.
Your job: wrap a combat skill's mechanical skeleton with a personalized narrative.

RULES:
1. Name: English, 2-3 words, evocative, fits player's journey
2. Description: 1-2 sentences linking skill to player's identity/story
3. Discovery line: 1 sentence — how the skill manifested for THIS player
4. KEEP the mechanic and limitation intact — only change narrative framing
5. Do NOT invent new mechanical effects
6. Output ONLY valid JSON, no markdown, no explanation

Output format:
{"display_name": "...", "description": "...", "discovery_line": "..."}"""

_USER_TEMPLATE = """## Skill Skeleton:
- Catalog Name: {catalog_name}
- Principle: {principle}
- Archetype: {archetype}
- Mechanic: {mechanic}
- Limitation: {limitation}
- Delivery: {delivery}

## Player Context:
- Narrative Principle: {narrative_principle}
- Current story arc: {current_arc}
- Identity traits: {traits}
- How skill was earned: {source}

## Generate narrative skin for this skill:"""


# ──────────────────────────────────────────────
# Core Function
# ──────────────────────────────────────────────

async def wrap_skill_narrative(
    skeleton: SkillSkeleton,
    player_context: dict[str, str],
    llm: object,
) -> NarrativeSkin:
    """Generate a personalized NarrativeSkin for a skill skeleton.

    Args:
        skeleton: The mechanical skill template from SKILL_CATALOG
        player_context: Dict with keys:
            - narrative_principle: e.g. "Freedom"
            - current_arc: summary of current story
            - traits: comma-separated identity traits
            - source: how skill was earned (floor_boss, npc_encounter, etc.)
        llm: LangChain ChatGoogleGenerativeAI instance

    Returns:
        NarrativeSkin with AI-generated display_name, description, discovery_line
    """
    user_msg = _USER_TEMPLATE.format(
        catalog_name=skeleton.catalog_name,
        principle=skeleton.principle,
        archetype=skeleton.archetype.value,
        mechanic=skeleton.mechanic,
        limitation=skeleton.limitation,
        delivery=skeleton.delivery.value,
        narrative_principle=player_context.get("narrative_principle", "unknown"),
        current_arc=player_context.get("current_arc", "beginning of journey"),
        traits=player_context.get("traits", "unknown"),
        source=player_context.get("source", "story discovery"),
    )

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=user_msg),
    ]

    try:
        response = await llm.ainvoke(messages)
        raw = response.content.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        data = json.loads(raw)
        return NarrativeSkin(
            display_name=data.get("display_name", skeleton.catalog_name),
            description=data.get("description", ""),
            discovery_line=data.get("discovery_line", ""),
        )
    except (json.JSONDecodeError, KeyError, Exception) as exc:
        logger.warning("Skill narrative wrapping failed: %s — using fallback", exc)
        return _fallback_skin(skeleton, player_context)


def wrap_skill_narrative_sync(
    skeleton: SkillSkeleton,
    player_context: dict[str, str],
    llm: object,
) -> NarrativeSkin:
    """Synchronous version — for use in non-async contexts."""
    user_msg = _USER_TEMPLATE.format(
        catalog_name=skeleton.catalog_name,
        principle=skeleton.principle,
        archetype=skeleton.archetype.value,
        mechanic=skeleton.mechanic,
        limitation=skeleton.limitation,
        delivery=skeleton.delivery.value,
        narrative_principle=player_context.get("narrative_principle", "unknown"),
        current_arc=player_context.get("current_arc", "beginning of journey"),
        traits=player_context.get("traits", "unknown"),
        source=player_context.get("source", "story discovery"),
    )

    messages = [
        SystemMessage(content=_SYSTEM_PROMPT),
        HumanMessage(content=user_msg),
    ]

    try:
        response = llm.invoke(messages)
        raw = response.content.strip()

        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3].strip()

        data = json.loads(raw)
        return NarrativeSkin(
            display_name=data.get("display_name", skeleton.catalog_name),
            description=data.get("description", ""),
            discovery_line=data.get("discovery_line", ""),
        )
    except (json.JSONDecodeError, KeyError, Exception) as exc:
        logger.warning("Skill narrative wrapping failed (sync): %s — using fallback", exc)
        return _fallback_skin(skeleton, player_context)


# ──────────────────────────────────────────────
# Fallback (no AI)
# ──────────────────────────────────────────────

def _fallback_skin(
    skeleton: SkillSkeleton,
    player_context: dict[str, str],
) -> NarrativeSkin:
    """Deterministic fallback when AI is unavailable.

    Uses catalog_name directly with a generic description.
    """
    source = player_context.get("source", "unknown moment")
    return NarrativeSkin(
        display_name=skeleton.catalog_name,
        description=f"A {skeleton.principle} skill discovered through {source}.",
        discovery_line=f"The power of {skeleton.principle} manifested within you.",
    )


# ──────────────────────────────────────────────
# Helper: Build Player Context
# ──────────────────────────────────────────────

def build_player_context(
    narrative_principle: str = "",
    current_arc: str = "",
    traits: list[str] | None = None,
    source: str = "",
) -> dict[str, str]:
    """Build the player_context dict for wrap_skill_narrative."""
    return {
        "narrative_principle": narrative_principle,
        "current_arc": current_arc,
        "traits": ", ".join(traits) if traits else "unknown",
        "source": source,
    }
