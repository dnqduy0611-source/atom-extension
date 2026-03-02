"""Amoisekai — Archetype Evolution Agent.

Lightweight per-scene check that runs after every scene.
Returns evolution event signals for the Planner to schedule
narrative arcs (3-scene Transmutation Arc).

No LLM calls — pure deterministic logic.

Cross-reference:
  - ARCHETYPE_EVOLUTION_SPEC v1.0  §9.1
  - PHASE1_ADAPTIVE_ENGINE §Archetype Evolution Integration
"""

from __future__ import annotations

from app.models.adaptive import ArchetypeTier
from app.models.player import PlayerState
from app.engine.archetype_evolution_engine import (
    check_transmutation_ready,
    determine_transmuted_form,
)


# ──────────────────────────────────────────────
# Per-Scene Check
# ──────────────────────────────────────────────

def check_archetype_evolution(player: PlayerState) -> dict | None:
    """Check if the player's archetype should evolve.

    Called after every scene by the orchestrator.
    Returns None if no evolution event, or a dict describing
    the event for the Planner to schedule.

    Phase 1 scope: only Tier 1 → Tier 2 (Transmutation).

    Args:
        player: Current PlayerState.

    Returns:
        None — no event needed.
        {"event": "transmutation_ready", "target_form": str,
         "path": str, "display_name": str} — ready to transmute.
    """
    evo = player.archetype_evolution

    # Phase 1: only check Tier 1 → Tier 2
    if evo.current_tier != ArchetypeTier.ORIGIN:
        return None

    already_transmuted = evo.current_tier.value >= ArchetypeTier.TRANSMUTED.value

    result = check_transmutation_ready(
        current_rank=player.current_rank,
        total_chapters=player.total_chapters,
        dqs=player.decision_quality_score,
        identity_coherence=player.identity_coherence,
        echo_trace=player.echo_trace,
        seed_identity_values=player.seed_identity.core_values,
        current_identity_values=player.current_identity.active_values,
        already_transmuted=already_transmuted,
    )

    if result is None:
        return None

    # Determine which transmuted form
    target_form = determine_transmuted_form(
        origin_archetype=player.archetype,
        current_identity_values=player.current_identity.active_values,
        current_identity_traits=player.current_identity.active_traits,
        reputation_tags=player.current_identity.reputation_tags,
    )

    if not target_form:
        return None

    from app.models.adaptive_constants import TRANSMUTED_DISPLAY_NAMES

    return {
        "event": "transmutation_ready",
        "target_form": target_form,
        "path": result["path"],
        "display_name": TRANSMUTED_DISPLAY_NAMES.get(target_form, target_form),
    }


# ──────────────────────────────────────────────
# Planner Beat Definitions
# ──────────────────────────────────────────────

ARCHETYPE_BEATS: dict[str, dict] = {
    "transmutation_ready": {
        "beat_type": "discovery",
        "description": "Archetype Transmutation arc (3 scenes)",
        "priority": "critical",
        "scenes_needed": 3,
        "scene_sequence": [
            {
                "scene": 1,
                "name": "Sóng Ngầm",
                "beat_type": "discovery",
                "description": (
                    "Foreshadowing: NPC/environment reacts differently. "
                    "Gate energy fluctuates. Player senses change."
                ),
            },
            {
                "scene": 2,
                "name": "Lò Biến Đổi",
                "beat_type": "discovery",
                "description": (
                    "Narrative trial: situation forces player to show "
                    "full identity. Principle Resonance flare."
                ),
            },
            {
                "scene": 3,
                "name": "Danh Xưng Mới",
                "beat_type": "discovery",
                "description": (
                    "Naming Event: NPCs call player by new title. "
                    "Transmuted archetype effects begin."
                ),
            },
        ],
    },
}
