"""Amoisekai — Signature Move Agent.

AI agent that generates Signature Move v1/v2/v3 for weapons.
Uses LLM with structured prompt + JSON output.

Ref: WEAPON_SYSTEM_SPEC v1.0 §7
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from app.models.weapon import SignatureMove, Weapon

logger = logging.getLogger(__name__)

# Load system prompt
_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "signature_move.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""

# Signature Move combat bonus per tier (Spec §7)
SIGNATURE_MOVE_BONUS: dict[int, float] = {
    1: 0.05,    # v1: Hạt Giống (Phase 2A)
    2: 0.07,    # v2: Trưởng Thành (Phase 2B)
    3: 0.10,    # v3: Hợp Nhất (Phase 2B)
}


# ──────────────────────────────────────────────
# Context Builders
# ──────────────────────────────────────────────

def build_signature_move_context(
    weapon: Weapon,
    player_archetype: str = "",
    player_key_moments: list[str] | None = None,
    unique_skill_stage: str = "seed",
    player_identity_summary: str = "",
) -> dict:
    """Build context dict for Signature Move v1 AI generation.

    Input follows spec §7 AI Generation Input format.
    """
    # Extract top bond moments from weapon events
    moments = player_key_moments or []
    if not moments and weapon.bond_events:
        moments = [
            f"Chapter {e.chapter}: {e.description or e.event_type}"
            for e in weapon.bond_events[-3:]  # Last 3 events
        ]

    return {
        "evolution_tier": 1,
        "weapon_name": weapon.name,
        "weapon_principles": weapon.principles,
        "weapon_lore_summary": weapon.lore.history_summary,
        "player_archetype": player_archetype,
        "player_key_moments": moments,
        "unique_skill_stage": unique_skill_stage,
        "player_identity_summary": player_identity_summary,
    }


def build_signature_move_v2_context(
    weapon: Weapon,
    bond_moments_since_v1: list[str] | None = None,
    unique_skill_stage: str = "seed",
) -> dict:
    """Build context dict for Signature Move v2 AI generation.

    Chains from v1: AI receives v1 name + description to evolve from.
    Spec §7: "v2 phải cảm giác là evolution của v1, không phải replacement"
    """
    move = weapon.signature_move
    moments = bond_moments_since_v1 or []
    if not moments and weapon.bond_events:
        moments = [
            f"Chapter {e.chapter}: {e.description or e.event_type}"
            for e in weapon.bond_events[-5:]
        ]

    return {
        "evolution_tier": 2,
        "weapon_name": weapon.name,
        "weapon_principles": weapon.principles,
        "weapon_lore_summary": weapon.lore.history_summary,
        "v1_move_name": move.v1_name if move else "",
        "v1_move_description": move.v1_description if move else "",
        "bond_moments_since_v1": moments,
        "unique_skill_stage": unique_skill_stage,
    }


def build_signature_move_v3_context(
    weapon: Weapon,
    unique_skill_name: str = "",
    unique_skill_aspect: str = "",
    climax_chapter_summary: str = "",
) -> dict:
    """Build context dict for Signature Move v3 AI generation.

    Chains from v1+v2. Synthesizes weapon identity with Unique Skill.
    Spec §7: "v3 phải hợp nhất weapon identity và Unique Skill identity"
    """
    move = weapon.signature_move

    return {
        "evolution_tier": 3,
        "weapon_name": weapon.name,
        "weapon_principles": weapon.principles,
        "weapon_lore_summary": weapon.lore.history_summary,
        "v1_move_name": move.v1_name if move else "",
        "v2_move_name": move.v2_name if move else "",
        "unique_skill_name": unique_skill_name,
        "unique_skill_aspect": unique_skill_aspect,
        "climax_chapter_summary": climax_chapter_summary,
    }


# ──────────────────────────────────────────────
# Response Parser
# ──────────────────────────────────────────────

def parse_signature_move_response(
    raw_response: str,
    tier: int = 1,
    existing_move: SignatureMove | None = None,
) -> SignatureMove | None:
    """Parse LLM JSON response into a SignatureMove model.

    Supports all tiers. Preserves v1/v2 context from existing_move.
    Returns None if parsing fails.
    """
    try:
        # Try to extract JSON from response
        text = raw_response.strip()
        # Handle markdown code blocks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        data = json.loads(text)

        # Mechanical values per tier
        tier_values = {1: 0.05, 2: 0.07, 3: 0.10}

        move = SignatureMove(
            evolution_tier=tier,
            name=data.get("name", ""),
            description=data.get("description", ""),
            mechanical_effect=data.get("mechanical_effect", ""),
            mechanical_value=data.get("mechanical_value", tier_values.get(tier, 0.05)),
            secondary_effect=data.get("secondary_effect", ""),
            narrative_note=data.get("narrative_note", ""),
            activation_cue=data.get("activation_cue", ""),
        )

        # Preserve context chain from existing move
        if existing_move:
            move.v1_name = existing_move.v1_name
            move.v1_description = existing_move.v1_description
            if tier == 3:
                move.v2_name = existing_move.name  # Current (v2) becomes v2_name
                move.v2_description = existing_move.description
        else:
            # v1: self-reference
            move.v1_name = data.get("name", "")
            move.v1_description = data.get("description", "")

        return move
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.error(f"Failed to parse Signature Move response: {e}")
        return None


def create_fallback_signature_move(weapon: Weapon) -> SignatureMove:
    """Create a deterministic fallback Signature Move when LLM fails.

    Uses weapon principles to generate a reasonable default.
    """
    principle = weapon.primary_principle or "unknown"
    effect_map = {
        "order": ("stability_burst", "Luật Thiên"),
        "entropy": ("drain_enhance", "Hư Vô Trảm"),
        "matter": ("damage_amplify", "Trọng Kích"),
        "flux": ("counter_strike", "Lưu Phong"),
        "energy": ("overdrive_burst", "Phong Lôi"),
        "void": ("drain_enhance", "Tịch Diệt"),
    }

    effect, name = effect_map.get(principle, ("damage_amplify", "Tuyệt Kỹ"))

    return SignatureMove(
        evolution_tier=1,
        name=name,
        description=f"Chiêu thức của {weapon.name} thức tỉnh. Nguyên lý {principle} bùng phát.",
        mechanical_effect=effect,
        mechanical_value=0.05,
        narrative_note=f"Vũ khí phát quang khi {name} kích hoạt.",
        activation_cue="Khi player trong tình huống nguy hiểm hoặc cao trào.",
        v1_name=name,
        v1_description=f"Chiêu thức của {weapon.name} thức tỉnh. Nguyên lý {principle} bùng phát.",
    )


def get_signature_combat_bonus(tier: int) -> float:
    """Get flat combat bonus for Signature Move tier.

    v1: +0.05, v2: +0.07, v3: +0.10
    """
    return SIGNATURE_MOVE_BONUS.get(tier, 0.0)
