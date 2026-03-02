"""Identity Mutation — Villain-triggered identity transformations + Empire Route.

Implements VILLAIN_SYSTEM_SPEC §6 (Mutations) and §10 (Empire Route).

3 Mutations:
    mirror_crack  — Player won but understood villain logic. Core value questioned.
    conversion    — Player chose Empire. Identity transforms, not destroyed.
    resistant     — Player rejected all. Identity crystallizes, unbending.

Empire Route:
    Unlocked at empire_resonance >= 80. Alternative story branch with
    transformed Unique Skill, new faction quests, and changed world perception.

Defector Arc:
    If agent player makes 3+ anti-Empire choices, trigger Crisis of Faith.
    Costly exit: resonance -40, active_general becomes Hunter, scars remain.

Functions:
    apply_mutation      — apply mutation effects to WorldState
    check_empire_route  — determine Empire Route eligibility and status
    initiate_defector_arc — switch from agent to defector
    get_mutation_context — build LLM context for active mutations/route
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.world_state import WorldState

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Mutation Definitions
# ──────────────────────────────────────────────


@dataclass(frozen=True)
class MutationEffect:
    """Describes the narrative effects of an identity mutation."""
    id: str
    name: str
    trigger_description: str
    narrative_signal: str
    reversible: bool
    reversal_method: str


MUTATIONS: dict[str, MutationEffect] = {
    "mirror_crack": MutationEffect(
        id="mirror_crack",
        name="The Mirror Crack",
        trigger_description=(
            "Đánh bại General nhưng empire_resonance tăng — "
            "player hiểu logic General dù từ chối"
        ),
        narrative_signal=(
            "Một core value bị 'questioned'. Future choices liên quan value đó "
            "xuất hiện với undertone khác. Narrator plant doubt nhẹ nhàng."
        ),
        reversible=True,
        reversal_method="Re-alignment Arc — đối diện sai lầm, giữ lời hứa lớn",
    ),
    "conversion": MutationEffect(
        id="conversion",
        name="The Conversion",
        trigger_description=(
            "empire_resonance >= 80, player chọn Empire Alliance"
        ),
        narrative_signal=(
            "Protagonist title thay đổi subtle. Unique Skill transform về Empire alignment. "
            "Old faction memories thành 'regret echoes'. Narrator dùng title mới tự nhiên."
        ),
        reversible=False,  # very hard, needs Defector Arc
        reversal_method="Defector Arc — betray Empire, bear consequences",
    ),
    "resistant": MutationEffect(
        id="resistant",
        name="The Resistant",
        trigger_description=(
            "identity_anchor >= 70, reject tất cả General encounters"
        ),
        narrative_signal=(
            "Identity crystallizes — coherence floor tăng. "
            "Prose mô tả hành động với certainty cao hơn, determination rõ ràng. "
            "Generals coi player là core threat."
        ),
        reversible=False,  # not a disadvantage, just a path
        reversal_method="Không — đây là con đường cụ thể, không phải bất lợi",
    ),
}


# ──────────────────────────────────────────────
# Mutation application
# ──────────────────────────────────────────────


def apply_mutation(ws: WorldState, mutation_type: str) -> bool:
    """Apply an identity mutation to WorldState.

    Args:
        ws: WorldState to mutate
        mutation_type: one of "mirror_crack", "conversion", "resistant"

    Returns:
        True if mutation was applied, False if invalid or already active
    """
    mutation = MUTATIONS.get(mutation_type)
    if not mutation:
        logger.warning(f"Mutation: unknown type '{mutation_type}'")
        return False

    # Check if already applied (avoid double application)
    existing = [
        e.mutation_triggered for e in ws.general_encounters
        if e.mutation_triggered == mutation_type
    ]
    if len(existing) > 1:
        # > 1 because resolve_encounter logs the current encounter BEFORE calling
        # apply_mutation. So existing count 1 = current encounter (OK to apply).
        # Count > 1 = mutation was already triggered in a previous encounter.
        logger.info(f"Mutation: '{mutation_type}' already applied multiple times, skipping")
        return False

    if mutation_type == "mirror_crack":
        _apply_mirror_crack(ws)
    elif mutation_type == "conversion":
        _apply_conversion(ws)
    elif mutation_type == "resistant":
        _apply_resistant(ws)

    logger.info(f"Mutation: applied '{mutation_type}' — {mutation.name}")
    return True


def _apply_mirror_crack(ws: WorldState) -> None:
    """Mirror Crack: a core value is now questioned.

    Effects:
    - Adds 'value_questioned' flag
    - Does NOT reduce identity_anchor — the doubt is narrative, not mechanical
    """
    ws.world_flags["mutation_mirror_crack_active"] = True


def _apply_conversion(ws: WorldState) -> None:
    """Conversion: player has been absorbed into Empire.

    Effects:
    - Empire allegiance → agent
    - Empire route unlocked
    - Adds conversion marker flags for narrative tracking
    """
    ws.empire_allegiance = "agent"
    ws.empire_route_unlocked = True
    ws.world_flags["mutation_conversion_active"] = True
    ws.world_flags["empire_route_active"] = True


def _apply_resistant(ws: WorldState) -> None:
    """Resistant: identity has crystallized.

    Effects:
    - Adds resistant flag
    - Identity anchor gets a floor boost
    """
    ws.world_flags["mutation_resistant_active"] = True
    # Ensure anchor doesn't drop below 50 from this point
    if ws.identity_anchor < 50:
        ws.identity_anchor = 50


# ──────────────────────────────────────────────
# Empire Route
# ──────────────────────────────────────────────


def check_empire_route(ws: WorldState) -> dict:
    """Determine Empire Route eligibility and current status.

    Returns:
        Dict with keys: eligible, active, allegiance, can_defect, status_description
    """
    result = {
        "eligible": ws.empire_resonance >= 80 or ws.empire_route_unlocked,
        "active": ws.world_flags.get("empire_route_active", False),
        "allegiance": ws.empire_allegiance,
        "can_defect": ws.empire_allegiance == "agent",
        "status_description": "",
    }

    if result["active"]:
        if ws.empire_allegiance == "agent":
            result["status_description"] = (
                "Empire Agent — narrative fork active. "
                "Protagonist title đã thay đổi. Generals là optional ally. "
                "Old faction quests vẫn available nhưng với 'compromised agent' framing."
            )
        elif ws.empire_allegiance == "defector":
            result["status_description"] = (
                "Defector — đang bị Empire truy sát. "
                "Unique Skill có 'fracture mark'. Empire resonance bị giảm mạnh."
            )
    elif result["eligible"]:
        result["status_description"] = (
            "Empire Route sẵn sàng — chờ General Alliance hoặc explicit choice."
        )

    return result


def initiate_defector_arc(ws: WorldState) -> bool:
    """Switch from Empire Agent to Defector.

    Conditions: empire_allegiance must be "agent"

    Effects:
    - empire_allegiance → defector
    - empire_resonance -= 40 (scars remain, doesn't go to 0)
    - active_general switches to Hunter mode (next General becomes pursuer)
    - world flags updated

    Returns:
        True if defector arc initiated, False if conditions not met
    """
    from app.narrative.villain_tracker import track_empire_resonance

    if ws.empire_allegiance != "agent":
        logger.warning(
            f"Defector: cannot initiate — allegiance is '{ws.empire_allegiance}', not 'agent'"
        )
        return False

    # Apply defection costs
    ws.empire_allegiance = "defector"
    track_empire_resonance(ws, -40, reason="defector_arc_initiated")

    # Unique Skill fracture mark
    ws.world_flags["defector_fracture_mark"] = True
    ws.world_flags["mutation_conversion_active"] = False  # conversion undone (partially)

    # Next available General becomes Hunter
    for gid, gstatus in ws.general_status.items():
        if gstatus.status not in ("defeated",) and gstatus.resolution != "alliance":
            ws.active_general = gid
            break

    logger.info(
        f"Defector: arc initiated — resonance now {ws.empire_resonance}, "
        f"hunter={ws.active_general}"
    )
    return True


# ──────────────────────────────────────────────
# LLM Context
# ──────────────────────────────────────────────


def get_mutation_context(ws: WorldState) -> str:
    """Build mutation + Empire Route context for LLM prompt.

    Returns empty string if no mutations or route active.
    """
    parts: list[str] = []

    # Active mutations
    if ws.world_flags.get("mutation_mirror_crack_active"):
        parts.append(
            "- MUTATION — Mirror Crack: một core value đang bị questioned. "
            "Khi choice liên quan value đó, prose phản ánh uncertainty nhẹ. "
            "Narrator plant doubt nhưng không explicit."
        )

    if ws.world_flags.get("mutation_conversion_active"):
        parts.append(
            "- MUTATION — Conversion: player đã chọn Empire. "
            "Dùng title mới tự nhiên (không announce). "
            "Old memories xuất hiện như 'regret echoes'. "
            "Unique Skill có Empire aesthetic."
        )

    if ws.world_flags.get("mutation_resistant_active"):
        parts.append(
            "- MUTATION — Resistant: identity đã crystallize. "
            "Prose mô tả hành động với certainty cao, determination rõ ràng. "
            "Không còn lưỡng lự, không còn câu hỏi. Villain arguments bị bác confident."
        )

    # Empire Route status
    if ws.world_flags.get("empire_route_active"):
        if ws.empire_allegiance == "agent":
            parts.append(
                "- EMPIRE ROUTE ACTIVE: player là Empire Agent. "
                "World descriptions phản ánh góc nhìn Empire. "
                "NPCs cũ react khác — một số xa lánh, một số respectful. "
                "Generals là optional ally, không phải enemy."
            )
        elif ws.empire_allegiance == "defector":
            parts.append(
                "- DEFECTOR ARC: player phản bội Empire, đang bị truy sát. "
                "Narrative arc 'The Hunted'. Unique Skill có 'fracture mark' — "
                "vết của conversion. Empire resonance giảm nhưng scars remain."
            )

    # Defector fracture
    if ws.world_flags.get("defector_fracture_mark"):
        parts.append(
            "- Unique Skill mang 'fracture mark' — hybrid giữa Empire alignment "
            "và original seed echo. Prose có thể reference vết nứt này."
        )

    if not parts:
        return ""

    return "## IDENTITY MUTATIONS:\n" + "\n".join(parts)
