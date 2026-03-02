"""Agent 2: Consequence Router — causal chain consequence prediction.

Replaces simulator.py with causal chain reasoning, faction implications,
and writer guidance. Backward-compatible: still produces consequences,
relationship_changes, foreshadowing, identity_alignment.

Spec: Amoisekai/CONSEQUENCE_ROUTER_SPEC.md §1-§8
Phase 1A: causal_chains + backward compat consequences + fallback to simulator.

Functions:
    run_consequence_router — main agent entry point
    _build_context_envelope — assemble input for LLM
    _extract_json — strip markdown fences from LLM output
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage

from app.models.pipeline import ConsequenceRouterOutput, NarrativeState
from app.narrative.world_context import get_world_context

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "consequence_router.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""
_FULL_SYSTEM_PROMPT = get_world_context() + "\n\n---\n\n" + _SYSTEM_PROMPT


# ──────────────────────────────────────────────
# Context envelope builder
# ──────────────────────────────────────────────

def _build_context_envelope(state: NarrativeState) -> str:
    """Build the context envelope (user message) for the LLM.

    Assembles choice, planner beats, chapter context, player identity,
    and world context into a structured prompt.
    """
    player = state.player_state
    choice = state.chosen_choice
    planner = state.planner_output

    # Choice
    choice_text = choice.text if choice else "Bắt đầu"
    risk_level = choice.risk_level if choice else 1

    # Planner beats
    beats_text = ""
    chapter_tension = 5
    emotional_arc = "growth"
    if planner:
        beats_text = "; ".join(b.description for b in planner.beats)
        chapter_tension = planner.chapter_tension
        emotional_arc = planner.emotional_arc

    # Player identity
    values = _get_player_field(player, "current_identity", "active_values")
    traits = _get_player_field(player, "current_identity", "active_traits")
    archetype = _get_player_simple(player, "archetype")
    notoriety = _get_player_simple(player, "notoriety", "0")
    alignment = _get_player_simple(player, "alignment", "0")
    dna_affinity = _get_dna_affinity(player)

    # Enhanced Intent Classifier outputs
    action_category = state.action_category or "other"
    skill_reference = state.skill_reference or ""
    player_intent = state.player_intent or ""

    # Villain context (from villain_tracker if available)
    villain_block = ""
    if state.villain_context:
        villain_block = f"\n## Villain Context:\n{state.villain_context}"

    # Unique skill info
    skill_name = _get_player_simple(player, "unique_skill_name", "")
    skill_category = _get_player_simple(player, "unique_skill_category", "")
    skill_block = ""
    if skill_name:
        skill_block = (
            f"\n## Unique Skill:\n"
            f"- Name: {skill_name}\n"
            f"- Category: {skill_category}\n"
            f"- Stage: {_get_player_simple(player, 'unique_skill_stage', 'seed')}"
        )

    # World context: known factions from WorldState
    world_block = ""
    try:
        if state.story_id:
            from app.memory.world_state_store import load_world_state
            ws = load_world_state(state.story_id)
            factions = []
            # Emissary NPCs
            emissary_status = getattr(ws, "emissary_status", {})
            if emissary_status:
                for name, info in emissary_status.items():
                    status = info.get("status", "unknown") if isinstance(info, dict) else getattr(info, "status", "unknown")
                    factions.append(f"{name} ({status})")
            # General status
            general_status = getattr(ws, "general_status", {})
            if general_status:
                for name, info in general_status.items():
                    status = info.get("status", "active") if isinstance(info, dict) else getattr(info, "status", "active")
                    factions.append(f"General {name} ({status})")
            # Empire allegiance
            allegiance = getattr(ws, "empire_allegiance", "")
            resonance = getattr(ws, "empire_resonance", 0)
            anchor = getattr(ws, "identity_anchor", 50)
            # Active threats
            threats = []
            threat_pressure = ws.get_threat_pressure() if hasattr(ws, "get_threat_pressure") else 0
            if threat_pressure > 0:
                threats.append(f"Threat pressure: {threat_pressure}")

            world_parts = []
            if factions:
                world_parts.append(f"- Known factions/NPCs: {', '.join(factions)}")
            if allegiance:
                world_parts.append(f"- Empire allegiance: {allegiance}")
            world_parts.append(f"- Empire resonance: {resonance}")
            world_parts.append(f"- Identity anchor: {anchor}")
            if threats:
                world_parts.append(f"- Active threats: {', '.join(threats)}")
            if world_parts:
                world_block = "\n## World Context:\n" + "\n".join(world_parts)
    except Exception as we:
        logger.debug(f"ConsequenceRouter: WorldState load failed ({we}) — continuing without")

    # Arc Blueprint context
    arc_block = ""
    try:
        from app.narrative.arc_blueprint import get_current_arc
        arc = get_current_arc(state.chapter_number)
        if arc:
            arc_block = (
                f"\n## Story Arc: {arc.name} ({arc.name_en})"
                f"\n- Tension range: {arc.tension_min}–{arc.tension_max}"
                f"\n- Pacing: {arc.pacing}"
                f"\n- CẤM: {', '.join(arc.forbidden)}"
            )
    except Exception:
        pass

    parts = [
        f"## Lựa chọn player:",
        f"{choice_text} (risk level: {risk_level})",
        f"- Action category: {action_category}",
        f"- Skill reference: {skill_reference}" if skill_reference else "",
        f"- Player intent: {player_intent}" if player_intent else "",
        "",
        f"## Dàn ý chương (từ Planner):",
        f"- Chapter: {state.chapter_number}",
        f"- Beats: {beats_text or 'Chưa xác định'}",
        f"- Tension: {chapter_tension}",
        f"- Emotional arc: {emotional_arc}",
        "",
        f"## Tóm tắt trước đó:",
        state.previous_summary or "Đây là chương đầu tiên.",
        "",
        f"## Player Identity:",
        f"- Values: {values}",
        f"- Traits: {traits}",
        f"- Archetype: {archetype}",
        f"- DNA Affinity: {dna_affinity}",
        f"- Notoriety: {notoriety}",
        f"- Alignment: {alignment}",
        f"- Identity coherence: {_get_player_simple(player, 'identity_coherence', '100')}",
    ]

    if skill_block:
        parts.append(skill_block)

    if villain_block:
        parts.append(villain_block)

    if world_block:
        parts.append(world_block)

    if arc_block:
        parts.append(arc_block)

    return "\n".join(p for p in parts if p is not None)


def _get_player_field(player, parent_attr: str, child_attr: str) -> str:
    """Extract nested player field (e.g. current_identity.active_values)."""
    if not player:
        return ""
    if isinstance(player, dict):
        parent = player.get(parent_attr, {})
        return ", ".join(parent.get(child_attr, [])) if isinstance(parent, dict) else ""
    parent = getattr(player, parent_attr, None)
    return ", ".join(getattr(parent, child_attr, [])) if parent else ""


def _get_player_simple(player, attr: str, default: str = "") -> str:
    """Extract simple player field."""
    if not player:
        return default
    if isinstance(player, dict):
        return str(player.get(attr, default))
    return str(getattr(player, attr, default))


def _get_dna_affinity(player) -> str:
    """Extract dna_affinity as comma-separated string from list[DNAAffinityTag|str]."""
    if not player:
        return ""
    if isinstance(player, dict):
        raw = player.get("dna_affinity", [])
    else:
        raw = getattr(player, "dna_affinity", [])
    if not raw:
        return ""
    # Handle DNAAffinityTag (has .value) or plain str
    items = []
    for tag in raw:
        if hasattr(tag, "value"):
            items.append(str(tag.value))
        else:
            items.append(str(tag))
    return ", ".join(items)


# ──────────────────────────────────────────────
# Main agent
# ──────────────────────────────────────────────

async def run_consequence_router(state: NarrativeState, llm: object) -> dict:
    """Predict consequences with causal chain reasoning.

    Returns dict with both 'consequence_output' (new) and 'simulator_output'
    (backward compat alias) keys.

    Falls back to run_simulator() if consequence routing fails.
    """
    context_envelope = _build_context_envelope(state)

    messages = [
        SystemMessage(content=_FULL_SYSTEM_PROMPT),
        HumanMessage(content=context_envelope),
    ]

    logger.info(f"ConsequenceRouter: predicting for chapter {state.chapter_number}")

    try:
        response = await llm.ainvoke(messages)
        content = _extract_json(response.content)
        result = json.loads(content)
    except json.JSONDecodeError as e:
        logger.error(f"ConsequenceRouter: JSON parse failed ({e}) — falling back to simulator")
        return await _fallback_simulator(state, llm)
    except Exception as e:
        logger.error(f"ConsequenceRouter: LLM call failed ({e}) — falling back to simulator")
        return await _fallback_simulator(state, llm)

    # Build ConsequenceRouterOutput
    try:
        output = ConsequenceRouterOutput(
            # New fields
            causal_chains=result.get("causal_chains") or [],
            faction_implications=result.get("faction_implications") or [],
            writer_guidance=result.get("writer_guidance") or {},
            # Backward compat fields
            consequences=result.get("consequences") or [],
            relationship_changes=result.get("relationship_changes") or [],
            world_state_updates=result.get("world_state_updates") or [],
            world_impact=result.get("world_impact") or "",
            character_reactions=result.get("character_reactions") or [],
            foreshadowing=result.get("foreshadowing") or [],
            identity_alignment=result.get("identity_alignment") or {},
        )
    except Exception as e:
        logger.error(f"ConsequenceRouter: output parse failed ({e}) — falling back")
        return await _fallback_simulator(state, llm)

    logger.info(
        f"ConsequenceRouter: {len(output.causal_chains)} chains, "
        f"{len(output.consequences)} consequences, "
        f"{len(output.faction_implications)} faction implications"
    )

    # Return both keys for backward compat during migration
    return {
        "consequence_output": output,
        "simulator_output": output,  # backward compat alias
    }


async def _fallback_simulator(state: NarrativeState, llm: object) -> dict:
    """Fallback to original simulator if consequence routing fails."""
    try:
        from app.narrative.simulator import run_simulator
        logger.warning("ConsequenceRouter: using fallback simulator")
        return await run_simulator(state, llm)
    except Exception as e:
        logger.error(f"ConsequenceRouter: fallback simulator also failed ({e})")
        from app.models.pipeline import SimulatorOutput
        fallback = SimulatorOutput(
            consequences=[{
                "description": "Hành động tạo ra thay đổi",
                "severity": "moderate",
                "timeframe": "immediate",
                "reversible": True,
            }],
            identity_alignment={
                "aligns_with_seed": True,
                "drift_indicator": "none",
                "note": "",
            },
        )
        return {"simulator_output": fallback}


def _extract_json(text: str) -> str:
    """Strip markdown fences from LLM output."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text
