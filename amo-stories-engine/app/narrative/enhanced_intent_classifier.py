"""Agent 0 (Enhanced): Intent Classifier — context-aware free-text parser.

Replaces the basic input_parser.py with a full context-aware classifier that:
- Understands player's archetype, DNA affinity, equipped skills, and unique skill stage
- Classifies action into typed categories (skill_use, combat, social, equipment, ...)
- Validates feasibility (not_unlocked if skill/stage not available)
- Resolves skill references by matching input text to equipped_skills
- Falls back to input_parser.py on failure

Spec: Amoisekai/ENHANCED_INTENT_CLASSIFIER_SPEC.md
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.models.pipeline import NarrativeState
from app.models.story import Choice
from app.narrative.world_context import get_world_context
from app.security.prompt_guard import sanitize_free_input

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "enhanced_intent_classifier.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""
_FULL_SYSTEM_PROMPT = get_world_context() + "\n\n---\n\n" + _SYSTEM_PROMPT


# ──────────────────────────────────────────────
# Context Envelope Builder
# ──────────────────────────────────────────────

def _build_player_context(player: Any) -> dict:
    """Extract relevant player context for the classifier.

    Handles both dict (from API/storage) and Pydantic PlayerState objects.
    Returns a minimal, safe context envelope.
    """
    if not player:
        return {}

    def _get(obj, *keys, default=None):
        """Safe nested getter for dict or Pydantic objects."""
        for key in keys:
            if obj is None:
                return default
            if isinstance(obj, dict):
                obj = obj.get(key)
            else:
                obj = getattr(obj, key, None)
        return obj if obj is not None else default

    # Archetype
    archetype = _get(player, "archetype", default="")

    # DNA Affinity — list of tag strings
    dna_raw = _get(player, "dna_affinity", default=[])
    dna_affinity = [
        (t.value if hasattr(t, "value") else str(t))
        for t in (dna_raw if isinstance(dna_raw, list) else [])
    ]

    # Unique Skill fields
    unique_skill = _get(player, "unique_skill")
    us_name = _get(unique_skill, "name", default="")
    us_category = _get(unique_skill, "category", default="")

    # Unique Skill Growth Stage
    us_growth = _get(player, "unique_skill_growth")
    us_stage = _get(us_growth, "current_stage", default="seed")
    # Fallback: check unique_skill.current_stage (older schema)
    if not us_stage or us_stage == "seed":
        us_stage = _get(unique_skill, "current_stage", default="seed")

    # Equipped skills — simplified representation
    equipped_raw = _get(player, "equipped_skills", default=[])
    equipped_skills = []
    for s in (equipped_raw if isinstance(equipped_raw, list) else []):
        if not s:
            continue
        if isinstance(s, dict):
            equipped_skills.append({
                "name": s.get("name", ""),
                "principle": s.get("principle", ""),
                "mechanic": s.get("mechanic", s.get("description", "")),
            })
        else:
            equipped_skills.append({
                "name": getattr(s, "name", ""),
                "principle": getattr(s, "principle", ""),
                "mechanic": getattr(s, "mechanic", getattr(s, "description", "")),
            })

    # Identity coherence — for drift detection hint to planner
    identity_coherence = _get(player, "identity_coherence", default=100.0)

    # Weapon context — for equipment-related intent classification
    equipped_weapons = _get(player, "equipped_weapons")
    weapon_name = ""
    weapon_soul_linked = False
    if equipped_weapons:
        primary = _get(equipped_weapons, "primary")
        if primary:
            weapon_name = _get(primary, "name", default="")
            weapon_soul_linked = bool(_get(primary, "soul_linked", default=False))

    # Villain context — for soul_choice classification during encounters
    villain_context = {}
    villain_state = _get(player, "villain_state")
    if villain_state:
        active_villain = _get(villain_state, "active_villain", default="")
        encounter_phase = _get(villain_state, "encounter_phase", default=0)
        empire_resonance = _get(villain_state, "empire_resonance", default=0)
        identity_anchor = _get(villain_state, "identity_anchor", default=0)
        if active_villain:
            villain_context = {
                "active_villain": active_villain,
                "encounter_phase": int(encounter_phase),
                "empire_resonance": int(empire_resonance),
                "identity_anchor": int(identity_anchor),
            }

    return {
        "archetype": archetype,
        "dna_affinity": dna_affinity,
        "unique_skill_stage": us_stage,
        "unique_skill_name": us_name,
        "unique_skill_category": us_category,
        "equipped_skills": equipped_skills,
        "identity_coherence": float(identity_coherence),
        "weapon_name": weapon_name,
        "weapon_soul_linked": weapon_soul_linked,
        "villain_context": villain_context,
    }


# ──────────────────────────────────────────────
# Main Agent
# ──────────────────────────────────────────────

_USER_TEMPLATE = """Free input: {free_input}
Protagonist: {protagonist_name}
Previous summary: {previous_summary}

Player context:
{player_context_json}

Villain context:
{villain_context_json}"""


async def run_enhanced_intent_classifier(state: NarrativeState, llm: object) -> dict:
    """Classify free-text player input with full player context.

    Returns dict with:
    - chosen_choice: Choice (parsed_action + risk_level + consequence_hint)
    - action_category: str
    - skill_reference: str
    - player_intent: str
    - choice_confidence: float

    If free_input is empty (player used a predefined choice), returns empty dict (no-op).
    If classification fails, returns empty dict so pipeline falls back to input_parser.py.
    """
    if not state.free_input:
        return {}

    # Sanitize to block prompt injection
    try:
        free_input = sanitize_free_input(state.free_input)
    except ValueError as exc:
        logger.warning(f"Prompt injection blocked in enhanced_intent_classifier: {exc}")
        return {
            "chosen_choice": Choice(
                text="[Hành động không hợp lệ]",
                risk_level=1,
                consequence_hint="Hành động bị từ chối do vi phạm quy tắc.",
            ),
            "action_category": "other",
            "skill_reference": "",
            "player_intent": "",
            "choice_confidence": 0.0,
        }

    logger.info(f"Enhanced classifier: analyzing '{free_input[:80]}...'")

    # Build player context envelope
    player_context = _build_player_context(state.player_state)

    # Build separate villain context (for soul_choice detection)
    villain_context = player_context.pop("villain_context", {})

    messages = [
        SystemMessage(content=_FULL_SYSTEM_PROMPT),
        HumanMessage(content=_USER_TEMPLATE.format(
            free_input=free_input,
            protagonist_name=state.protagonist_name or "Nhân vật chính",
            previous_summary=state.previous_summary or "Bắt đầu câu chuyện",
            player_context_json=json.dumps(player_context, ensure_ascii=False, indent=2),
            villain_context_json=json.dumps(villain_context, ensure_ascii=False, indent=2) if villain_context else "Không có villain encounter",
        )),
    ]

    try:
        response = await llm.ainvoke(messages)
        content = _extract_json(response.content)
        result = json.loads(content)
    except Exception as exc:
        logger.warning(f"Enhanced classifier failed ({type(exc).__name__}: {exc}) — will fallback")
        return {}

    # Parse action text — respect feasibility
    action_text = result.get("parsed_action", free_input)
    feasibility = result.get("feasibility", "possible")

    if feasibility == "impossible" and result.get("requires_modification"):
        modified = result.get("modified_action", "")
        if modified:
            action_text = modified
    elif feasibility == "not_unlocked":
        # Player tried to use something not yet available — keep action but note it
        feasibility_note = result.get("feasibility_note", "")
        if feasibility_note:
            action_text = f"{action_text} ({feasibility_note})"

    action_category = result.get("action_category", "other")
    skill_reference = result.get("skill_reference", "")
    player_intent = result.get("player_intent", "")
    confidence = float(result.get("confidence", 0.8))

    logger.info(
        f"Enhanced classifier: category={action_category}, "
        f"skill_ref={skill_reference!r}, feasibility={feasibility}, confidence={confidence}"
    )

    return {
        "chosen_choice": Choice(
            text=action_text,
            risk_level=int(result.get("risk_level", 3)),
            consequence_hint=result.get("consequence_hint", ""),
        ),
        "action_category": action_category,
        "skill_reference": skill_reference,
        "player_intent": player_intent,
        "choice_confidence": confidence,
        "archetype_note": result.get("archetype_note", ""),
    }


def _extract_json(text: str) -> str:
    """Strip markdown fences from LLM response."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text
