"""Context Weight Agent — AI-aware identity delta calculation.

Replaces the fixed-formula identity_agent.py with context-sensitive AI reasoning.
Receives the full player state + chapter context, produces a calibrated IdentityDelta.
Falls back to deterministic identity_agent.py on any failure.

Design:
  - Context Envelope: full PlayerState snapshot passed as JSON (future-proof)
  - Hard caps enforced in Python regardless of AI output
  - CRNG events (breakthrough, rogue, pity) always overlaid deterministically
  - Confrontation threshold (instability >= 70) enforced in Python
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.models.identity import IdentityDelta
from app.models.pipeline import NarrativeState

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "context_weight_agent.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""

# ──────────────────────────────────────────────────────────────────────────────
# Hard caps — Python-enforced. AI controls values; Python controls bounds.
# ──────────────────────────────────────────────────────────────────────────────

_CAPS: dict[str, tuple[float, float]] = {
    "dqs_change":          (-5.0,  5.0),
    "coherence_change":    (-10.0, 3.0),
    "instability_change":  (-5.0,  8.0),
    "breakthrough_change": (0.0,   10.0),
    "notoriety_change":    (-2.0,  10.0),
    "alignment_change":    (-5.0,  5.0),
    "fate_buffer_change":  (-10.0, 8.0),
}


# ──────────────────────────────────────────────────────────────────────────────
# Context envelope builder
# ──────────────────────────────────────────────────────────────────────────────

def _attr(player: Any, key: str, default: Any = None) -> Any:
    """Safely get an attribute from dict or Pydantic player object."""
    if isinstance(player, dict):
        return player.get(key, default)
    return getattr(player, key, default)


def _nested(player: Any, key: str) -> dict:
    """Safely extract a nested object as plain dict."""
    raw = _attr(player, key, None)
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if hasattr(raw, "model_dump"):
        return raw.model_dump()
    return {}


def _to_list(items: Any, limit: int) -> list:
    """Safely convert a list of dict-or-Pydantic items, capped at limit."""
    if not items:
        return []
    result = []
    for item in items:
        if isinstance(item, dict):
            result.append(item)
        elif hasattr(item, "model_dump"):
            result.append(item.model_dump())
        else:
            result.append(str(item))
        if len(result) >= limit:
            break
    return result


def _build_context_envelope(state: NarrativeState) -> dict:
    """Produce a clean, JSON-serialisable context dict from pipeline state.

    Designed to be future-proof: new PlayerState fields (e.g. equipped_weapon)
    automatically appear inside 'player' without code changes here.
    """
    player = state.player_state

    # ── Unique skill growth ──
    growth_raw = _attr(player, "unique_skill_growth", None)
    if growth_raw is None:
        growth: dict = {}
    elif isinstance(growth_raw, dict):
        growth = growth_raw
    elif hasattr(growth_raw, "model_dump"):
        growth = growth_raw.model_dump()
    else:
        growth = {}

    # ── Choice ──
    choice = state.chosen_choice
    if choice is None:
        choice_dict: dict = {"text": "", "risk_level": 3, "consequence_hint": ""}
    elif isinstance(choice, dict):
        choice_dict = {
            "text": choice.get("text", ""),
            "risk_level": choice.get("risk_level", 3),
            "consequence_hint": choice.get("consequence_hint", ""),
        }
    else:
        choice_dict = {
            "text": getattr(choice, "text", ""),
            "risk_level": getattr(choice, "risk_level", 3),
            "consequence_hint": getattr(choice, "consequence_hint", ""),
        }

    # ── Simulator output ──
    sim = state.simulator_output

    if sim is None:
        sim_dict: dict = {}
    elif isinstance(sim, dict):
        sim_dict = {
            "identity_alignment": sim.get("identity_alignment", {}),
            "consequences": sim.get("consequences", [])[:5],
            "world_impact": sim.get("world_impact", ""),
            "character_reactions": sim.get("character_reactions", [])[:3],
        }
    else:
        sim_dict = {
            "identity_alignment": getattr(sim, "identity_alignment", {}),
            "consequences": _to_list(getattr(sim, "consequences", []), 5),
            "world_impact": getattr(sim, "world_impact", ""),
            "character_reactions": _to_list(getattr(sim, "character_reactions", []), 3),
        }

    return {
        "chapter_number": state.chapter_number,
        "player": {
            # ── Identity ──
            "archetype": _attr(player, "archetype", ""),
            "dna_affinity": _attr(player, "dna_affinity", []),
            "seed_identity": _nested(player, "seed_identity"),
            "current_identity": _nested(player, "current_identity"),
            "latent_identity": _nested(player, "latent_identity"),
            # ── Scores ──
            "echo_trace": _attr(player, "echo_trace", 100.0),
            "identity_coherence": _attr(player, "identity_coherence", 100.0),
            "instability": _attr(player, "instability", 0.0),
            "decision_quality_score": _attr(player, "decision_quality_score", 50.0),
            "breakthrough_meter": _attr(player, "breakthrough_meter", 0.0),
            "notoriety": _attr(player, "notoriety", 0.0),
            "alignment": _attr(player, "alignment", 0.0),
            "total_chapters": _attr(player, "total_chapters", 0),
            # ── Unique skill growth (already in PlayerState, future-proof) ──
            "unique_skill_stage": growth.get("current_stage", "seed"),
            "unique_skill_bloom_path": growth.get("bloom_path", ""),
            "echo_coherence_streak": growth.get("echo_coherence_streak", 0),
            "scar_trauma_count": growth.get("scar_trauma_count", 0),
            "aspect_chosen": growth.get("aspect_chosen", ""),
        },
        "choice": choice_dict,
        "simulator_assessment": sim_dict,
        "crng_event": state.crng_event or {},
    }


# ──────────────────────────────────────────────────────────────────────────────
# Response parsing & clamping
# ──────────────────────────────────────────────────────────────────────────────

def _extract_json(text: str) -> str:
    """Strip markdown code fences if present."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text


def _clamp_delta(delta: IdentityDelta) -> IdentityDelta:
    """Enforce hard caps. AI picks the value; Python picks the bounds."""
    for field, (lo, hi) in _CAPS.items():
        current = getattr(delta, field, 0.0)
        setattr(delta, field, max(lo, min(hi, float(current))))
    return delta


def _parse_ai_response(raw: str) -> IdentityDelta | None:
    """Parse AI JSON into IdentityDelta. Returns None on any failure."""
    try:
        data = json.loads(_extract_json(raw))

        delta = IdentityDelta(
            dqs_change=float(data.get("dqs_change", 0.0)),
            coherence_change=float(data.get("coherence_change", 0.0)),
            instability_change=float(data.get("instability_change", 0.0)),
            # echo_trace_change intentionally omitted — only changes on mutation
            breakthrough_change=float(data.get("breakthrough_change", 0.5)),
            notoriety_change=float(data.get("notoriety_change", 0.0)),
            alignment_change=float(data.get("alignment_change", 0.0)),
            fate_buffer_change=float(data.get("fate_buffer_change", 0.0)),
            drift_detected=str(data.get("drift_detected", "")),
            drift_description=str(data.get("drift_description", "")),
            # confrontation_triggered and pity_reset are NOT parsed from AI —
            # they are Python-controlled and set in the overlay section below.
            new_flags=[str(f) for f in data.get("new_flags", [])],
        )

        reasoning = str(data.get("weight_reasoning", ""))
        if reasoning:
            logger.info(f"[CWA] {reasoning[:300]}")

        return _clamp_delta(delta)

    except Exception as exc:
        logger.warning(f"[CWA] Parse failed: {exc!r} | raw[:200]={raw[:200]!r}")
        return None


# ──────────────────────────────────────────────────────────────────────────────
# Main entry point
# ──────────────────────────────────────────────────────────────────────────────

async def run_context_weight_agent(state: NarrativeState, llm: Any) -> dict:
    """Compute identity delta with AI context-awareness.

    Flow:
      1. Build full context envelope from pipeline state.
      2. Call Gemini Flash to reason about identity delta values.
      3. Parse + clamp response into IdentityDelta.
      4. Overlay CRNG events deterministically.
      5. Enforce confrontation threshold (instability >= 70).
      6. Fall back to deterministic identity_agent.py on any failure.
    """
    from app.narrative.identity_agent import run_identity_update as _fallback

    if not _SYSTEM_PROMPT:
        logger.error("[CWA] Prompt file missing — deterministic fallback")
        return await _fallback(state)

    context = _build_context_envelope(state)

    # ── CRNG: always deterministic, extracted before AI call ──
    crng = state.crng_event or {}
    crng_breakthrough = crng.get("event_type") == "breakthrough"
    crng_rogue = crng.get("event_type") == "rogue_event"
    crng_pity_reset = bool(crng.get("triggered"))

    try:
        messages = [
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=(
                "<context>\n"
                f"{json.dumps(context, ensure_ascii=False, indent=2)}\n"
                "</context>"
            )),
        ]

        response = await llm.ainvoke(messages)
        raw: str = response.content if hasattr(response, "content") else str(response)

        delta = _parse_ai_response(raw)
        if delta is None:
            logger.warning("[CWA] Parse failed — deterministic fallback")
            return await _fallback(state)

        # ── Overlay CRNG: deterministic values always win over AI ──
        # pity_reset and breakthrough/rogue flags are CRNG-only; AI has no authority here.
        delta.pity_reset = crng_pity_reset
        delta.breakthrough_triggered = crng_breakthrough
        delta.rogue_event_triggered = crng_rogue

        # ── Enforce confrontation threshold — Python is sole authority ──
        # Reset AI's value first, then apply Python rule.
        delta.confrontation_triggered = False
        current_inst = context["player"]["instability"]
        new_inst = current_inst + delta.instability_change
        if new_inst >= 70.0 and current_inst < 70.0:
            delta.confrontation_triggered = True
            logger.info(
                f"[CWA] CONFRONTATION triggered: "
                f"{current_inst:.1f} → {new_inst:.1f}"
            )

        logger.info(
            f"[CWA] Δ DQS={delta.dqs_change:+.1f} "
            f"Coh={delta.coherence_change:+.1f} "
            f"Inst={delta.instability_change:+.1f} "
            f"BT={delta.breakthrough_change:+.1f} "
            f"Notoriety={delta.notoriety_change:+.1f}"
        )

        return {"identity_delta": delta}

    except Exception as exc:
        logger.error(f"[CWA] AI call failed ({exc!r}) — deterministic fallback")
        return await _fallback(state)
