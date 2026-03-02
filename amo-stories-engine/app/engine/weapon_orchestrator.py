"""Amoisekai — Weapon Orchestrator.

Glue layer that connects all weapon engine functions to the pipeline.
Called as a pure-Python LangGraph node after identity_update.

No LLM calls — all logic is deterministic rule-based.

Ref: WEAPON_SYSTEM_SPEC v1.0 §5, §8, §9, §10
"""

from __future__ import annotations

import logging
from typing import Any

from app.engine.weapon_bond import (
    update_bond_score,
    apply_bond_decay,
    check_awakening_threshold,
    check_soul_link_threshold,
    get_bond_cap,
)
from app.engine.archon_fragment import (
    classify_archon_affinity,
    get_dominant_archon,
    increment_archon_affinity,
    get_divine_ability_info,
    increment_lore_reveal,
    get_lore_reveal_progress,
    get_shard_resonance_bonus,
)
from app.engine.signature_move_evolution import (
    can_evolve_v2,
    can_evolve_v3,
)
from app.engine.monster_core import (
    roll_core_drop,
    roll_soul_crystal,
)
from app.models.weapon import (
    Weapon,
    WeaponGrade,
    build_weapon_context,
    compute_weapon_combat_contribution,
    compute_vanguard_dual_wield,
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Bond Event Extraction
# ──────────────────────────────────────────────

# Map action_category → bond event type (spec §5)
_ACTION_TO_BOND_EVENT: dict[str, str] = {
    "combat": "combat_encounter",
    "soul_choice": "soul_choice",
    "exploration": "narrative_reference",
    "social": "narrative_reference",
}


def extract_bond_events(
    action_category: str = "",
    has_combat: bool = False,
    is_turning_point: bool = False,
    near_death: bool = False,
    theft_attempt: bool = False,
) -> list[str]:
    """Infer weapon bond events from chapter metadata.

    Returns list of event types to apply (may be multiple per chapter).
    """
    events: list[str] = []

    # From action_category
    bond_event = _ACTION_TO_BOND_EVENT.get(action_category)
    if bond_event:
        events.append(bond_event)

    # Direct combat (may overlap with action_category="combat")
    if has_combat and "combat_encounter" not in events:
        events.append("combat_encounter")

    # Special events
    if is_turning_point:
        events.append("turning_point")
    if near_death:
        events.append("near_death")
    if theft_attempt:
        events.append("theft_attempt_failed")

    return events


# ──────────────────────────────────────────────
# Pre-Combat Bonus
# ──────────────────────────────────────────────

def compute_pre_combat_bonus(player_state: Any) -> dict:
    """Compute weapon combat contribution from current weapon state.

    Returns dict with weapon_bonus, playerskill_bonus, env_bonus,
    synergy_bonus, effective_total — ready to pass into combat formula.
    """
    if player_state is None:
        return _empty_combat_bonus()

    weapons = getattr(player_state, "equipped_weapons", None)
    if weapons is None:
        return _empty_combat_bonus()

    primary = getattr(weapons, "primary", None)
    if primary is None:
        return _empty_combat_bonus()

    archetype = getattr(player_state, "archetype", "")
    secondary = getattr(weapons, "secondary", None)

    # Get skill principle for synergy check
    skill_principle = _get_player_skill_principle(player_state)

    # Vanguard dual-wield
    if archetype == "vanguard" and secondary is not None:
        return compute_vanguard_dual_wield(
            primary=primary,
            secondary=secondary,
            skill_principle=skill_principle,
        )

    # Normal single weapon
    return compute_weapon_combat_contribution(
        weapon=primary,
        skill_principle=skill_principle,
        archetype=archetype,
    )


def _get_player_skill_principle(player_state: Any) -> str:
    """Extract primary principle from player's equipped unique skill."""
    skill = getattr(player_state, "unique_skill", None)
    if skill is None:
        return ""
    return getattr(skill, "principle", "")


def _empty_combat_bonus() -> dict:
    return {
        "buildfit_bonus": 0.0,
        "playerskill_bonus": 0.0,
        "env_bonus": 0.0,
        "synergy_bonus": 0.0,
        "effective_total": 0.0,
    }


# ──────────────────────────────────────────────
# Post-Combat Drops
# ──────────────────────────────────────────────

def apply_post_combat_drops(
    monster_tier: str = "",
    is_boss: bool = False,
    coherence: float = 0.0,
    crng_favorable: bool = False,
) -> dict:
    """Roll monster core / soul crystal drops after combat.

    Returns dict with dropped_core and dropped_crystal (or None).
    """
    result: dict[str, Any] = {"dropped_core": None, "dropped_crystal": None}

    if not monster_tier:
        return result

    # Roll core drop
    core = roll_core_drop(monster_tier)
    if core:
        result["dropped_core"] = core
        logger.info(f"Weapon: monster core dropped — tier={core}")

    # Roll soul crystal (boss only)
    if is_boss:
        crystal = roll_soul_crystal(
            crng_favorable=crng_favorable,
            coherence=coherence,
        )
        if crystal:
            result["dropped_crystal"] = crystal
            logger.info(f"Weapon: soul crystal dropped — tier={crystal}")

    return result


# ──────────────────────────────────────────────
# Master Post-Chapter Update
# ──────────────────────────────────────────────

def post_chapter_weapon_update(
    player_state: Any,
    identity_delta: Any = None,
    action_category: str = "",
    planner_output: Any = None,
    has_combat: bool = False,
) -> dict:
    """Master function: update all weapon state after a chapter.

    Called by the weapon_update LangGraph node.
    Returns dict of NarrativeState field updates.

    Pure Python — no LLM calls.
    """
    updates: dict[str, Any] = {}

    if player_state is None:
        return updates

    weapons = getattr(player_state, "equipped_weapons", None)
    primary: Weapon | None = getattr(weapons, "primary", None) if weapons else None

    # ── 1. Bond Update ──
    if primary is not None and not getattr(primary, "dormant", False):
        is_turning_point = _check_turning_point(planner_output)
        events = extract_bond_events(
            action_category=action_category,
            has_combat=has_combat,
            is_turning_point=is_turning_point,
        )

        for event_type in events:
            update_bond_score(primary, event_type)
            logger.info(
                f"Weapon bond: {event_type} → bond={primary.bond_score:.1f}"
            )

        # ── 2. Threshold Detection ──
        if primary.grade == WeaponGrade.resonant:
            if check_soul_link_threshold(primary):
                updates["weapon_soul_link_pending"] = True
                logger.info("Weapon: Soul-Link threshold reached!")

        elif primary.grade == WeaponGrade.soul_linked:
            if check_awakening_threshold(primary):
                updates["weapon_awakening_pending"] = True
                logger.info("Weapon: Awakening threshold reached!")

    # ── 3. Archon Affinity ──
    if identity_delta is not None:
        alignment_change = _safe_float(identity_delta, "alignment_change")
        coherence_change = _safe_float(identity_delta, "coherence_change")
        notoriety_change = _safe_float(identity_delta, "notoriety_change")
        drift_detected = _safe_str(identity_delta, "drift_detected")

        archon_signal = classify_archon_affinity(
            alignment_change=alignment_change,
            coherence_change=coherence_change,
            notoriety_change=notoriety_change,
            drift_detected=drift_detected,
            action_category=action_category,
        )

        if archon_signal:
            current_affinity = getattr(player_state, "archon_affinity", {})
            updated_affinity = increment_archon_affinity(
                current_affinity, archon_signal,
            )
            # Store updated affinity for persistence
            updates["archon_affinity_update"] = updated_affinity
            logger.info(
                f"Weapon: archon signal '{archon_signal}' → "
                f"affinity={updated_affinity.get(archon_signal, 0)}"
            )

    # ── 4. Dominant Archon ──
    current_affinity = updates.get(
        "archon_affinity_update",
        getattr(player_state, "archon_affinity", {}),
    )
    dominant = get_dominant_archon(current_affinity)
    if dominant:
        updates["dominant_archon"] = dominant

    # ── 5. Signature Move Evolution Check ──
    if primary is not None and primary.grade == WeaponGrade.awakened:
        if primary.signature_move is not None:
            tier = primary.signature_move.evolution_tier
            if tier == 1 and can_evolve_v2(primary, player_state):
                updates["weapon_evolution_pending"] = "v2"
                logger.info("Weapon: Signature Move v2 evolution conditions met!")
            elif tier == 2 and can_evolve_v3(primary, player_state):
                updates["weapon_evolution_pending"] = "v3"
                logger.info("Weapon: Signature Move v3 evolution conditions met!")

    # ── 6. Pre-compute Combat Bonus ──
    combat_bonus = compute_pre_combat_bonus(player_state)
    updates["weapon_combat_bonus"] = combat_bonus

    # ── 7. Weapon Context for Writer ──
    updates["weapon_context"] = build_weapon_context(primary)

    # ── 8. Bond Decay (unused weapon penalty) ──
    if primary is not None and not getattr(primary, "dormant", False):
        chapters_unused = _get_chapters_unused(primary, player_state)
        if chapters_unused >= 3:
            old_bond = primary.bond_score
            apply_bond_decay(primary, chapters_unused=chapters_unused)
            if primary.bond_score < old_bond:
                logger.info(
                    f"Weapon bond decay: {chapters_unused} chapters unused → "
                    f"bond {old_bond:.1f} → {primary.bond_score:.1f}"
                )

    # ── 9. Divine Ability Status (for Writer context) ──
    if primary is not None and primary.is_archon_fragment:
        current_season = _get_current_season(player_state)
        divine_info = get_divine_ability_info(primary, current_season)
        updates["divine_ability_info"] = divine_info

    # ── 10. Lore Reveal (after archon affinity increment) ──
    if primary is not None and primary.is_archon_fragment:
        archon_signal = updates.get("archon_affinity_update") is not None
        if archon_signal and primary.archon_source == _get_latest_archon_signal(updates):
            new_count = increment_lore_reveal(primary)
            logger.info(
                f"Weapon lore reveal: {primary.name} → {new_count}/{5} fragments"
            )
        # Always include lore progress in context
        updates["lore_progress"] = get_lore_reveal_progress(primary)

    # ── 11. Shard Resonance Bonus ──
    if primary is not None:
        resonance_bonus = get_shard_resonance_bonus(primary)
        if resonance_bonus > 0:
            updates["shard_resonance_bonus"] = resonance_bonus
            logger.info(
                f"Weapon shard resonance active: +{resonance_bonus} BuildFit"
            )

    return updates


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _check_turning_point(planner_output: Any) -> bool:
    """Check if planner flagged this chapter as a turning point."""
    if planner_output is None:
        return False
    # Check beats for turning_point flag
    beats = getattr(planner_output, "beats", [])
    for beat in beats:
        if getattr(beat, "is_turning_point", False):
            return True
    return False


def _safe_float(obj: Any, attr: str) -> float:
    """Safely get float attribute from object or dict."""
    if isinstance(obj, dict):
        return float(obj.get(attr, 0.0))
    return float(getattr(obj, attr, 0.0))


def _safe_str(obj: Any, attr: str) -> str:
    """Safely get str attribute from object or dict."""
    if isinstance(obj, dict):
        return str(obj.get(attr, ""))
    return str(getattr(obj, attr, ""))


def _get_chapters_unused(weapon: Weapon, player_state: Any) -> int:
    """Estimate how many chapters weapon hasn't been actively used.

    Uses total_chapters - last bond event chapter as proxy.
    """
    total_chapters = getattr(player_state, "total_chapters", 0)
    if not weapon.bond_events:
        return total_chapters  # never used = all chapters unused
    last_event_chapter = max(e.chapter for e in weapon.bond_events)
    return max(0, total_chapters - last_event_chapter)


def _get_current_season(player_state: Any) -> int:
    """Get current game season (1-indexed). Season = ceil(total_chapters / 20)."""
    total_chapters = getattr(player_state, "total_chapters", 0)
    if total_chapters <= 0:
        return 1
    return (total_chapters - 1) // 20 + 1


def _get_latest_archon_signal(updates: dict) -> str:
    """Extract the archon key from the latest affinity update."""
    affinity_update = updates.get("archon_affinity_update")
    if not affinity_update or not isinstance(affinity_update, dict):
        return ""
    # The archon with highest affinity is likely the most recent signal
    if not affinity_update:
        return ""
    return max(affinity_update, key=affinity_update.get)

