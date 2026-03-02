"""Villain Tracker — Empire Resonance + Identity Anchor tracking engine.

Provides deterministic tracking and threshold logic for the Villain System
(VILLAIN_SYSTEM_SPEC §5, §6). All functions operate on WorldState directly.

Functions:
    track_empire_resonance   — adjust + clamp empire_resonance
    track_identity_anchor    — adjust + clamp identity_anchor
    check_threshold_events   — return list of newly triggered narrative events
    get_villain_context      — build LLM prompt block from villain state
    update_villain_from_prose — heuristic keyword detection (fire-and-forget)
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.world_state import WorldState

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Resonance / Anchor tracking
# ──────────────────────────────────────────────


def track_empire_resonance(ws: WorldState, delta: int, reason: str = "") -> int:
    """Adjust empire_resonance by delta, clamp 0-100.

    Args:
        ws: WorldState to mutate
        delta: positive = more aligned with Empire, negative = less
        reason: freeform reason for logging

    Returns:
        New empire_resonance value
    """
    old = ws.empire_resonance
    ws.empire_resonance = max(0, min(100, old + delta))
    if ws.empire_resonance != old:
        logger.info(
            f"VillainTracker: empire_resonance {old} → {ws.empire_resonance} "
            f"(delta={delta:+d}, reason={reason})"
        )
    _check_empire_allegiance(ws)
    return ws.empire_resonance


def track_identity_anchor(ws: WorldState, delta: int, reason: str = "") -> int:
    """Adjust identity_anchor by delta, clamp 0-100.

    Args:
        ws: WorldState to mutate
        delta: positive = more steadfast, negative = less
        reason: freeform reason for logging

    Returns:
        New identity_anchor value
    """
    old = ws.identity_anchor
    ws.identity_anchor = max(0, min(100, old + delta))
    if ws.identity_anchor != old:
        logger.info(
            f"VillainTracker: identity_anchor {old} → {ws.identity_anchor} "
            f"(delta={delta:+d}, reason={reason})"
        )
    return ws.identity_anchor


def _check_empire_allegiance(ws: WorldState) -> None:
    """Update empire_allegiance based on empire_resonance thresholds.

    Spec §5 thresholds:
        ≥ 80 → empire_route_unlocked
        ≥ 90 → agent (irreversible without defector arc)

    IMPORTANT: defector status is NEVER auto-reverted by resonance increase.
    Only explicit narrative events can change defector status.
    """
    r = ws.empire_resonance

    # Defector status is permanent — cannot be auto-reverted by resonance
    if ws.empire_allegiance == "defector":
        return

    if r >= 90:
        if ws.empire_allegiance != "agent":
            ws.empire_allegiance = "agent"
            ws.empire_route_unlocked = True
    elif r >= 80:
        if ws.empire_allegiance in ("none", "sympathizer"):
            ws.empire_allegiance = "sympathizer"
            ws.empire_route_unlocked = True
    # Note: resonance 50 only triggers narrative event (general_alliance_offer_early),
    # NOT allegiance change. Allegiance requires explicit interaction.


# ──────────────────────────────────────────────
# Threshold events
# ──────────────────────────────────────────────

# Empire resonance thresholds (spec §5 table)
_RESONANCE_THRESHOLDS: list[tuple[int, str]] = [
    (20, "narrator_empire_terminology"),
    (30, "empire_npcs_respect"),
    (50, "general_alliance_offer_early"),
    (60, "non_empire_factions_doubt"),
    (70, "unique_skill_empire_aesthetic"),
    (80, "empire_route_unlock"),
    (90, "empire_agent_status"),
]

# Identity anchor thresholds (spec §5 table)
_ANCHOR_THRESHOLDS: list[tuple[int, str]] = [
    (30, "absolute_conviction_dialogue"),
    (50, "generals_priority_target"),
    (70, "identity_crystallized"),
    (90, "the_unbending_title"),
]


def check_threshold_events(ws: WorldState) -> list[str]:
    """Return list of villain threshold event IDs that are currently active.

    Checks both empire_resonance and identity_anchor against their
    respective threshold tables. Returns ALL currently active events
    (not just newly triggered ones — caller is responsible for diff).

    Returns:
        List of event ID strings, e.g. ["narrator_empire_terminology", "empire_npcs_respect"]
    """
    events: list[str] = []

    for threshold, event_id in _RESONANCE_THRESHOLDS:
        if ws.empire_resonance >= threshold:
            events.append(event_id)

    for threshold, event_id in _ANCHOR_THRESHOLDS:
        if ws.identity_anchor >= threshold:
            events.append(event_id)

    # Gray Zone detection (spec §5: resonance 40-60 + anchor 40-60)
    if 40 <= ws.empire_resonance <= 60 and 40 <= ws.identity_anchor <= 60:
        events.append("gray_zone_active")

    return events


# ──────────────────────────────────────────────
# Villain context for LLM
# ──────────────────────────────────────────────


def get_villain_context(ws: WorldState) -> str:
    """Build villain context block for LLM prompt injection.

    Returns empty string if no villain activity is notable.
    Used by context.py to inject into writer/planner prompts.
    """
    parts: list[str] = []

    # Empire resonance level
    if ws.empire_resonance >= 20:
        if ws.empire_resonance >= 80:
            parts.append(
                f"- Empire resonance: RẤT CAO ({ws.empire_resonance}/100) "
                f"— player gần như đồng thuận với triết lý Empire"
            )
        elif ws.empire_resonance >= 50:
            parts.append(
                f"- Empire resonance: CAO ({ws.empire_resonance}/100) "
                f"— player đang bị ảnh hưởng bởi Empire"
            )
        else:
            parts.append(
                f"- Empire resonance: nhẹ ({ws.empire_resonance}/100) "
                f"— dấu hiệu đồng tình đầu tiên"
            )

    # Identity anchor
    if ws.identity_anchor >= 30:
        if ws.identity_anchor >= 70:
            parts.append(
                f"- Identity anchor: RẤT VỮNG ({ws.identity_anchor}/100) "
                f"— player kiên định tuyệt đối, không bị lay chuyển"
            )
        elif ws.identity_anchor >= 50:
            parts.append(
                f"- Identity anchor: vững ({ws.identity_anchor}/100) "
                f"— villain arguments không còn hiệu quả"
            )
        else:
            parts.append(
                f"- Identity anchor: đang hình thành ({ws.identity_anchor}/100)"
            )

    # Gray Zone
    if 40 <= ws.empire_resonance <= 60 and 40 <= ws.identity_anchor <= 60:
        parts.append(
            "- ⚠ GRAY ZONE: player đang vật lộn giữa Empire và Identity gốc "
            "— đây là lúc Narrative Confrontation Events hiệu quả nhất"
        )

    # Active General
    if ws.active_general:
        general_data = ws.general_status.get(ws.active_general)
        phase_desc = {0: "chưa bắt đầu", 1: "Confrontation", 2: "Demonstration", 3: "Resolution"}
        phase = general_data.encounter_phase if general_data else 0
        parts.append(
            f"- General active: {ws.active_general} "
            f"(phase {phase}: {phase_desc.get(phase, '?')})"
        )

    # Unresolved tensions
    if ws.unresolved_tensions:
        parts.append(
            f"- Unresolved tensions với: {', '.join(ws.unresolved_tensions)} "
            f"— General này sẽ quay lại với argument mới"
        )

    # Empire allegiance
    if ws.empire_allegiance != "none":
        allegiance_desc = {
            "sympathizer": "đang nghiêng về Empire",
            "agent": "đã gia nhập Empire — narrative fork",
            "defector": "đã phản bội Empire — đang bị truy sát",
        }
        parts.append(
            f"- Empire allegiance: {allegiance_desc.get(ws.empire_allegiance, ws.empire_allegiance)}"
        )

    # Emissary sympathy (any high sympathy)
    for eid, estatus in ws.emissary_status.items():
        if estatus.sympathy_score >= 50:
            reveal_hint = " (đã reveal)" if estatus.revealed_to_player else " (chưa reveal)"
            parts.append(
                f"- Emissary {eid}: sympathy CAO ({estatus.sympathy_score}/100){reveal_hint}"
            )

    # Veiled Will phase
    vw_desc = {1: "Calamity seeds — anomaly hints", 2: "Pattern Recognition — player thấy pattern", 3: "Revelation"}
    if ws.veiled_will_phase >= 1:
        parts.append(f"- Veiled Will: Phase {ws.veiled_will_phase} — {vw_desc.get(ws.veiled_will_phase, '?')}")

    if not parts:
        return ""

    header = "## VILLAIN STATE:\n" + "\n".join(parts)

    # Append emissary context if any
    try:
        from app.narrative.emissary import get_emissary_context
        emissary_block = get_emissary_context(ws)
        if emissary_block:
            header += "\n\n" + emissary_block
    except Exception:
        pass  # best-effort

    # Append General encounter context if any
    try:
        from app.narrative.villain_encounter import get_encounter_context
        encounter_block = get_encounter_context(ws)
        if encounter_block:
            header += "\n\n" + encounter_block
    except Exception:
        pass  # best-effort

    # Append mutation + Empire Route context if any
    try:
        from app.narrative.identity_mutation import get_mutation_context
        mutation_block = get_mutation_context(ws)
        if mutation_block:
            header += "\n\n" + mutation_block
    except Exception:
        pass  # best-effort

    # Append Veiled Will context if any
    try:
        from app.narrative.veiled_will import get_veiled_will_context
        vw_block = get_veiled_will_context(ws)
        if vw_block:
            header += "\n\n" + vw_block
    except Exception:
        pass  # best-effort

    # ── Villain Power Profile context (Phase 2) ──
    # Inject power profile for the active villain (general or emissary encountered)
    try:
        from app.memory.villain_power_store import get_power_context_block
        # Determine active villain_id: active_general takes priority, else check encountered emissaries
        _active_id = ws.active_general or ""
        if not _active_id:
            # Use first emissary that's been revealed and has encounters
            for eid, estatus in ws.emissary_status.items():
                if estatus.revealed_to_player and estatus.encounter_count > 0:
                    _active_id = eid
                    break
        if _active_id:
            power_block = get_power_context_block(ws, _active_id)
            if power_block:
                header += "\n\n" + power_block
    except Exception as exc:
        logger.debug(f"VillainTracker: power profile inject failed ({exc}) — skipping")

    return header


# ──────────────────────────────────────────────
# Heuristic prose detection
# ──────────────────────────────────────────────

# Keyword → (empire_resonance_delta, identity_anchor_delta)
_PROSE_KEYWORDS: list[tuple[list[str], int, int]] = [
    # Empire sympathy signals
    (["empire has a point", "đế chế có lý", "they're not wrong", "họ không sai"], +5, 0),
    (["joined empire", "gia nhập đế chế", "empire alliance"], +15, -5),

    # Identity anchor signals
    (["rejected the offer", "từ chối lời mời", "will not surrender", "không đầu hàng"], 0, +10),
    (["stood firm", "kiên định", "unwavering", "không lay chuyển"], 0, +5),

    # General encounter signals
    (["general vorn", "người xây lại"], +3, 0),
    (["general kha", "bàn tay trật tự"], +3, 0),
    (["general mireth", "người lạnh"], +3, 0),
    (["general azen", "kẻ hy sinh"], +3, 0),
]


def update_villain_from_prose(ws: WorldState, prose: str) -> None:
    """Heuristic keyword detection from chapter prose.

    Scans for villain-related keywords and applies small resonance/anchor
    deltas. This is a fire-and-forget supplement — the main tracking
    happens through explicit track_empire_resonance/track_identity_anchor
    calls from encounter resolution.

    Best-effort: failures are logged, never raised.
    """
    if not prose:
        return

    lower = prose.lower()

    for keywords, res_delta, anc_delta in _PROSE_KEYWORDS:
        if any(kw in lower for kw in keywords):
            if res_delta:
                track_empire_resonance(ws, res_delta, reason=f"prose_keyword:{keywords[0]}")
            if anc_delta:
                track_identity_anchor(ws, anc_delta, reason=f"prose_keyword:{keywords[0]}")

    # Emissary encounter detection
    for eid in ("kaen", "sira", "thol"):
        if eid in lower:
            ws.had_empire_encounter = True
            # Increment villain power encounter_count once per chapter prose
            try:
                from app.memory.villain_power_store import increment_encounter_count
                increment_encounter_count(ws, eid)
            except Exception:
                pass
            break

    # General encounter detection
    for gid in ("vorn", "kha", "mireth", "azen"):
        if f"general {gid}" in lower or f"tướng {gid}" in lower:
            ws.had_empire_encounter = True
            break
