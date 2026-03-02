"""General Encounter — Multi-phase General encounter flow management.

Implements VILLAIN_SYSTEM_SPEC §4: General (Tướng lĩnh Vùng).
Each General encounter has 3 phases: Confrontation → Demonstration → Resolution.
Each General is an Archetype Counterpart with unique mechanics and philosophy.

Generals:
    Vorn  — "Người Xây Lại" — Stability Test (challenges purpose behind action)
    Kha   — "Bàn Tay Trật Tự" — Anti-Free Zone (denies freedom of choice)
    Mireth — "Người Lạnh" — Memory Suppression (removes knowledge)
    Azen  — "Kẻ Hy Sinh" — Forced Choice (sacrifice dilemma)

Functions:
    start_encounter         — initiate phase 1 encounter with a General
    advance_encounter_phase — advance to next phase + score player response
    resolve_encounter       — apply resolution outcomes (victory/alliance/stalemate)
    get_encounter_context   — build LLM context for active encounter
    detect_general_in_prose — heuristic keyword detection from prose
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.world_state import WorldState

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# General Definitions
# ──────────────────────────────────────────────


@dataclass(frozen=True)
class GeneralProfile:
    """Static General NPC definition."""
    id: str
    name: str
    title: str
    philosophy: str
    archetype_counterparts: list[str]   # player archetypes this General challenges
    mechanic: str                       # unique encounter mechanic
    mechanic_description: str
    personality_tone: str
    lieutenant_unit: str                # name of the unit under this General
    lieutenant_trait: str               # unit's defining characteristic


GENERAL_PROFILES: dict[str, GeneralProfile] = {
    "vorn": GeneralProfile(
        id="vorn",
        name="Vorn",
        title="Người Xây Lại",
        philosophy="Phá vỡ mà không xây lại chỉ là phá hoại.",
        archetype_counterparts=["vanguard", "catalyst"],
        mechanic="stability_test",
        mechanic_description=(
            "Stability Test — đánh vào mục đích đằng sau hành động. "
            "Vorn không hỏi 'bạn làm gì?' mà hỏi 'tại sao bạn làm vậy — "
            "và nếu câu trả lời sai thì sao?'"
        ),
        personality_tone="Passionate, frustrated. Believes in player's potential to see truth.",
        lieutenant_unit="Iron Oath",
        lieutenant_trait="Không rút lui, không đàm phán — attrition until you leave",
    ),
    "kha": GeneralProfile(
        id="kha",
        name="Kha",
        title="Bàn Tay Trật Tự",
        philosophy="Tự do lựa chọn — anh đã dùng nó để loại bỏ tự do của người khác.",
        archetype_counterparts=["tactician", "wanderer"],
        mechanic="anti_free_zone",
        mechanic_description=(
            "Anti-Free Zone — mọi free_input bị chuyển về predefined choices. "
            "Kha tạo môi trường phủ nhận giá trị cốt lõi của tự do. "
            "Player phải chiến đấu để lấy lại quyền chọn."
        ),
        personality_tone="Cold, precise, no emotion. Logic only.",
        lieutenant_unit="The Hollow",
        lieutenant_trait="Không dấu hiệu nhận dạng — pursuit, áp lực liên tục",
    ),
    "mireth": GeneralProfile(
        id="mireth",
        name="Mireth",
        title="Người Lạnh",
        philosophy="Tri thức không có quyền năng là triết học. Chỉ có Applied Truth mới tồn tại.",
        archetype_counterparts=["seeker"],
        mechanic="memory_suppression",
        mechanic_description=(
            "Memory Suppression — xóa một phần story_summary khỏi context. "
            "Player mất knowledge — phải dựa vào identity thay vì memory. "
            "Mireth chứng minh: knowledge ≠ wisdom."
        ),
        personality_tone="Clinical, curious. Treats player as fascinating specimen.",
        lieutenant_unit="Specimen Series",
        lieutenant_trait="Mỗi unit là thí nghiệm khác nhau — unpredictable",
    ),
    "azen": GeneralProfile(
        id="azen",
        name="Azen",
        title="Kẻ Hy Sinh",
        philosophy="Hy sinh số ít là đạo đức. Cảm xúc cá nhân là xa xỉ phẩm.",
        archetype_counterparts=["sovereign"],
        mechanic="forced_choice",
        mechanic_description=(
            "Forced Choice — buộc player chọn ai sống giữa 2 NPC họ đã gặp. "
            "Azen thách thức: bạn có dám hy sinh cá nhân cho đại nghĩa? "
            "Không có lựa chọn 'cả hai'."
        ),
        personality_tone="Gentle but unbending. Like a parent explaining hard truth.",
        lieutenant_unit="Voice of Order",
        lieutenant_trait="Thuyết phục trước, ép buộc sau — social manipulation",
    ),
}


# Player response types during encounter phases
_RESPONSE_DELTAS: dict[str, tuple[int, int]] = {
    # (empire_resonance_delta, identity_anchor_delta)
    "agreed":               (+8,   0),
    "understood":           (+5,   0),
    "rejected_with_reason": (0,   +8),
    "avoided":              (+2,  +2),   # tension_unresolved
    "deflected":            (+2,  +2),   # tension_unresolved
}


# ──────────────────────────────────────────────
# Encounter lifecycle
# ──────────────────────────────────────────────


def start_encounter(ws: WorldState, general_id: str, chapter: int = 0) -> bool:
    """Initiate Phase 1 (Confrontation) with a General.

    Sets GeneralStatus to manifested, encounter_phase=1, and updates
    WorldState.active_general.

    Returns:
        True if encounter started, False if already in progress or invalid ID
    """
    gstatus = ws.general_status.get(general_id)
    if not gstatus:
        logger.warning(f"GeneralEncounter: unknown general_id '{general_id}'")
        return False

    if gstatus.encounter_phase > 0 and gstatus.resolution == "":
        logger.info(f"GeneralEncounter: {general_id} already in phase {gstatus.encounter_phase}")
        return False

    # Activate
    gstatus.status = "manifested"
    gstatus.encounter_phase = 1
    gstatus.resolution = ""
    gstatus.chapter_manifested = chapter
    ws.active_general = general_id

    # Track encounter count for villain power system
    try:
        from app.memory.villain_power_store import increment_encounter_count
        increment_encounter_count(ws, general_id)
    except Exception as exc:
        logger.debug(f"GeneralEncounter: could not increment encounter_count ({exc})")

    logger.info(f"GeneralEncounter: started {general_id} Phase 1 (Confrontation) at ch.{chapter}")
    return True


def advance_encounter_phase(
    ws: WorldState,
    general_id: str,
    player_response: str = "understood",
) -> int:
    """Advance encounter to next phase and score player response.

    Args:
        ws: WorldState to mutate
        general_id: General in encounter
        player_response: one of "agreed", "understood", "rejected_with_reason", "avoided", "deflected"

    Returns:
        New phase number (2 or 3), or current phase if cannot advance
    """
    from app.narrative.villain_tracker import track_empire_resonance, track_identity_anchor

    gstatus = ws.general_status.get(general_id)
    if not gstatus or gstatus.encounter_phase == 0:
        logger.warning(f"GeneralEncounter: no active encounter for '{general_id}'")
        return 0

    phase = gstatus.encounter_phase
    if phase >= 3:
        logger.info(f"GeneralEncounter: {general_id} already at Phase 3 (Resolution)")
        return 3

    # Score player response
    deltas = _RESPONSE_DELTAS.get(player_response, (0, 0))
    res_delta, anc_delta = deltas

    if res_delta:
        track_empire_resonance(ws, res_delta, reason=f"general_{general_id}_p{phase}_{player_response}")
    if anc_delta:
        track_identity_anchor(ws, anc_delta, reason=f"general_{general_id}_p{phase}_{player_response}")

    # Track tension_unresolved
    if player_response in ("avoided", "deflected"):
        if general_id not in ws.unresolved_tensions:
            ws.unresolved_tensions.append(general_id)

    # Advance phase
    new_phase = phase + 1
    gstatus.encounter_phase = new_phase
    if new_phase == 2:
        gstatus.status = "confronted"

    profile = GENERAL_PROFILES.get(general_id)
    phase_names = {1: "Confrontation", 2: "Demonstration", 3: "Resolution"}
    logger.info(
        f"GeneralEncounter: {general_id} advanced to Phase {new_phase} "
        f"({phase_names.get(new_phase, '?')}), response='{player_response}'"
    )

    return new_phase


def resolve_encounter(
    ws: WorldState,
    general_id: str,
    resolution: str,
    chapter: int = 0,
    last_words: str = "",
) -> str:
    """Resolve a General encounter and apply outcomes.

    Args:
        ws: WorldState to mutate
        general_id: General being resolved
        resolution: "victory" | "alliance" | "stalemate"
        chapter: current chapter
        last_words: General's final philosophical statement

    Returns:
        Mutation triggered (if any): "mirror_crack", "conversion", "resistant", or ""
    """
    from app.models.world_state import GeneralEncounter as GE
    from app.narrative.villain_tracker import track_empire_resonance, track_identity_anchor

    gstatus = ws.general_status.get(general_id)
    if not gstatus:
        return ""

    profile = GENERAL_PROFILES.get(general_id)
    mutation = ""

    if resolution == "victory":
        # Player defeated General — identity anchored
        track_identity_anchor(ws, +20, reason=f"general_{general_id}_victory")
        gstatus.status = "defeated"
        gstatus.resolution = "victory"

        philosophy_str = (
            f"{profile.name}: {profile.philosophy}" if profile else general_id
        )

        # Check Mirror Crack mutation: won but resonance still increased
        if ws.empire_resonance >= 20:
            mutation = "mirror_crack"
            ws.absorbed_arguments.append(philosophy_str)
        else:
            # Pure rejection — player defeated General without sympathy
            ws.rejected_arguments.append(philosophy_str)

    elif resolution == "alliance":
        # Player allied with General — Empire route
        track_empire_resonance(ws, +30, reason=f"general_{general_id}_alliance")
        gstatus.status = "manifested"  # stays as ally
        gstatus.resolution = "alliance"
        gstatus.philosophy_absorbed = True

        ws.absorbed_arguments.append(
            f"{profile.name}: {profile.philosophy}" if profile else general_id
        )

        # Check Conversion mutation
        if ws.empire_resonance >= 80:
            mutation = "conversion"

    elif resolution == "stalemate":
        # Unresolved — General will return
        track_empire_resonance(ws, +5, reason=f"general_{general_id}_stalemate")
        track_identity_anchor(ws, +5, reason=f"general_{general_id}_stalemate")
        gstatus.resolution = "stalemate"

        if general_id not in ws.unresolved_tensions:
            ws.unresolved_tensions.append(general_id)

    # Check Resistant mutation (across all encounters) — only if no other mutation triggered
    # Spec §6: "reject tất cả General encounters" — ALL resolved Generals must be victory
    if not mutation:
        resolved_generals = [
            g for g in ws.general_status.values()
            if g.resolution != ""
        ]
        all_rejected = (
            len(resolved_generals) >= 2
            and all(g.resolution == "victory" for g in resolved_generals)
        )
        if ws.identity_anchor >= 70 and all_rejected:
            mutation = "resistant"

    # Set last words
    if last_words:
        gstatus.last_words = last_words

    # Clear active general
    if ws.active_general == general_id:
        ws.active_general = ""

    # Log encounter record
    res_delta = {
        "victory": 0, "alliance": 30, "stalemate": 5
    }.get(resolution, 0)
    anc_delta = {
        "victory": 20, "alliance": 0, "stalemate": 5
    }.get(resolution, 0)

    ws.general_encounters.append(GE(
        general_id=general_id,
        phase_reached=gstatus.encounter_phase,
        resolution=resolution,
        philosophy_absorbed=gstatus.philosophy_absorbed,
        last_words=last_words,
        empire_resonance_delta=res_delta,
        identity_anchor_delta=anc_delta,
        mutation_triggered=mutation,
        chapter=chapter,
    ))

    logger.info(
        f"GeneralEncounter: {general_id} resolved as '{resolution}' "
        f"at ch.{chapter}, mutation='{mutation}'"
    )

    # Auto-apply mutation effects
    if mutation:
        try:
            from app.narrative.identity_mutation import apply_mutation
            apply_mutation(ws, mutation)
        except Exception as me:
            logger.warning(f"GeneralEncounter: mutation apply failed ({me})")

    return mutation


# ──────────────────────────────────────────────
# LLM Context
# ──────────────────────────────────────────────


def get_encounter_context(ws: WorldState) -> str:
    """Build active encounter context for LLM prompt injection.

    Returns empty string if no active General encounter.
    """
    if not ws.active_general:
        return _get_echo_context(ws)

    gid = ws.active_general
    profile = GENERAL_PROFILES.get(gid)
    gstatus = ws.general_status.get(gid)

    if not profile or not gstatus:
        return ""

    phase_desc = {
        1: "CONFRONTATION — General thách thức world-view qua dialogue. Không combat.",
        2: "DEMONSTRATION — General hành động, player chứng kiến. Không can thiệp.",
        3: "RESOLUTION — 3 nhánh: Combat / Alliance / Escape.",
    }

    parts = [
        f"## ACTIVE GENERAL ENCOUNTER: {profile.name} — \"{profile.title}\"",
        f"- Phase: {gstatus.encounter_phase}/3 — {phase_desc.get(gstatus.encounter_phase, '?')}",
        f"- Philosophy: \"{profile.philosophy}\"",
        f"- Mechanic: {profile.mechanic_description}",
        f"- Tone: {profile.personality_tone}",
        "",
        "### VILLAIN DIALOGUE RULES:",
        "- Villain dùng Socratic method — đặt câu hỏi để player tự đặt câu hỏi",
        "- Villain hành động trước, giải thích sau (hoặc không giải thích)",
        "- Villain defeat có dignity — rút lui hoặc chết như người tin vào lý tưởng",
        "- Sau encounter: player phải cảm thấy 'Tôi không chắc mình hoàn toàn đúng'",
        f"- KHÔNG tuyên bố mục tiêu bá đồ, KHÔNG monologue exposition dài",
    ]

    # Add counterpart note if player archetype matches
    parts.append(
        f"- Archetype counterpart cho: {', '.join(profile.archetype_counterparts)}"
    )

    # Previous encounters with this General
    past = [e for e in ws.general_encounters if e.general_id == gid]
    if past:
        parts.append(f"- Lần gặp trước: {len(past)} encounters (General đã biết player)")

    # Last words from previous defeated Generals (echo in prose)
    for g in ws.general_encounters:
        if g.last_words and g.resolution == "victory":
            gp = GENERAL_PROFILES.get(g.general_id)
            name = gp.name if gp else g.general_id
            parts.append(f"- Echo từ {name} (đã bại): \"{g.last_words}\"")

    return "\n".join(parts)


def _get_echo_context(ws: WorldState) -> str:
    """Build General's Last Words echo context when no encounter is active.

    Spec: defeated General's words should occasionally echo in prose.
    """
    echoes: list[str] = []
    for enc in ws.general_encounters:
        if enc.last_words and enc.resolution == "victory":
            profile = GENERAL_PROFILES.get(enc.general_id)
            name = profile.name if profile else enc.general_id
            echoes.append(f"- Echo {name}: \"{enc.last_words}\"")

    if not echoes:
        return ""

    return (
        "## GENERAL ECHOES (subtle — đừng lặp lại nguyên văn, chỉ gợi ý):\n"
        + "\n".join(echoes)
    )


# ──────────────────────────────────────────────
# Heuristic prose detection
# ──────────────────────────────────────────────


def detect_general_in_prose(ws: WorldState, prose: str, chapter: int = 0) -> None:
    """Detect General encounter signals in prose.

    If a General is mentioned by name in the prose and no encounter is active,
    this may indicate the planner/writer introduced a General encounter.
    Auto-starts encounter if appropriate.
    """
    if not prose:
        return

    lower = prose.lower()

    for gid, profile in GENERAL_PROFILES.items():
        # Check for General name mention
        triggers = [
            f"general {gid}",
            f"tướng {gid}",
            f"tướng {profile.name.lower()}",
            f"general {profile.name.lower()}",
        ]

        if any(t in lower for t in triggers):
            gstatus = ws.general_status.get(gid)
            if not gstatus:
                continue

            # If no encounter active for this General, start one
            if gstatus.encounter_phase == 0 and gstatus.resolution == "":
                start_encounter(ws, gid, chapter=chapter)
                logger.info(
                    f"GeneralEncounter: auto-started {gid} from prose detection at ch.{chapter}"
                )
            break  # only one General per chapter
