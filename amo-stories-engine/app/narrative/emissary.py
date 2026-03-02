"""Emissary Layer — Emissary NPC definitions, sympathy tracking, and reveal logic.

Implements VILLAIN_SYSTEM_SPEC §3: Emissary (Sứ giả Đế chế).
Each Emissary appears as an ally/advisor for 3-5 chapters, then may reveal
as an Empire agent based on accumulated sympathy_score.

Emissaries:
    Kaen  — merchant/detective, philosophy: peace through strength
    Sira  — healer/sage, philosophy: power needs control
    Thol  — neutral warrior, philosophy: survival over allegiance

Functions:
    score_interaction      — update sympathy + resonance from player response
    check_reveal_state     — determine reveal level from sympathy score
    get_emissary_context   — build LLM context for active emissary interactions
    detect_emissary_in_prose — heuristic keyword detection from prose
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.world_state import WorldState

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Emissary Definitions
# ──────────────────────────────────────────────


@dataclass(frozen=True)
class EmissaryProfile:
    """Static Emissary NPC definition."""
    id: str
    name: str
    cover_role: str
    true_role: str
    philosophy: str
    sympathy_trigger: str
    personality_tone: str


EMISSARY_PROFILES: dict[str, EmissaryProfile] = {
    "kaen": EmissaryProfile(
        id="kaen",
        name="Kaen",
        cover_role="thương nhân / thám tử tìm artifact",
        true_role="tình báo Empire",
        philosophy="Hòa bình thật sự cần một kẻ đủ mạnh để áp đặt nó.",
        sympathy_trigger="player chứng kiến chaos từ faction wars",
        personality_tone="Warm, relatable, practical. Never reveals ideology until forced.",
    ),
    "sira": EmissaryProfile(
        id="sira",
        name="Sira",
        cover_role="healer / sage",
        true_role="nhà nghiên cứu Unique Skills cho Empire",
        philosophy="Năng lực mà không được kiểm soát sẽ hủy hoại người sở hữu nó.",
        sympathy_trigger="player gặp Instability từ identity drift",
        personality_tone="Warm, relatable, caring. Never reveals ideology until forced.",
    ),
    "thol": EmissaryProfile(
        id="thol",
        name="Thol",
        cover_role="chiến binh trung lập",
        true_role="người bảo vệ Inner Circle, đang quan sát player",
        philosophy="Một kẻ đủ mạnh không cần phải chọn phe — chỉ cần chọn survival.",
        sympathy_trigger="player thất bại nặng nề hoặc mất đồng minh",
        personality_tone="Warm, relatable, stoic. Never reveals ideology until forced.",
    ),
}


# ──────────────────────────────────────────────
# Interaction scoring
# ──────────────────────────────────────────────

# Interaction type → (sympathy_delta, empire_resonance_delta, identity_anchor_delta)
_INTERACTION_DELTAS: dict[str, tuple[int, int, int]] = {
    "agreed_with_logic":    (+15, +5,   0),
    "showed_understanding": (+8,  +2,   0),
    "neutral_response":     (0,    0,   0),
    "mild_disagreement":    (-5,   0,  +3),
    "strong_rejection":     (-15, -5, +10),
}


def score_interaction(
    ws: WorldState,
    emissary_id: str,
    interaction_type: str,
    chapter: int = 0,
) -> int:
    """Score a player interaction with an Emissary.

    Updates EmissaryStatus.sympathy_score, WorldState.empire_resonance,
    WorldState.identity_anchor, and logs an EmissaryInteraction record.

    Args:
        ws: WorldState to mutate
        emissary_id: one of "kaen", "sira", "thol"
        interaction_type: one of the keys in _INTERACTION_DELTAS
        chapter: current chapter number

    Returns:
        New sympathy_score for this emissary
    """
    from app.models.world_state import EmissaryInteraction
    from app.narrative.villain_tracker import track_empire_resonance, track_identity_anchor

    deltas = _INTERACTION_DELTAS.get(interaction_type, (0, 0, 0))
    sympathy_delta, resonance_delta, anchor_delta = deltas

    # Update EmissaryStatus
    estatus = ws.emissary_status.get(emissary_id)
    if not estatus:
        logger.warning(f"Emissary: unknown emissary_id '{emissary_id}'")
        return 0

    old_sympathy = estatus.sympathy_score
    estatus.sympathy_score = max(0, min(100, old_sympathy + sympathy_delta))

    # Update resonance/anchor via villain_tracker
    if resonance_delta:
        track_empire_resonance(ws, resonance_delta, reason=f"emissary_{emissary_id}_{interaction_type}")
    if anchor_delta:
        track_identity_anchor(ws, anchor_delta, reason=f"emissary_{emissary_id}_{interaction_type}")

    # Log interaction
    ws.emissary_interactions.append(EmissaryInteraction(
        emissary_id=emissary_id,
        chapter=chapter,
        sympathy_delta=sympathy_delta,
        empire_resonance_delta=resonance_delta,
        identity_anchor_delta=anchor_delta,
        interaction_type=interaction_type,
    ))

    logger.info(
        f"Emissary: {emissary_id} interaction '{interaction_type}' → "
        f"sympathy {old_sympathy} → {estatus.sympathy_score}, "
        f"resonance {resonance_delta:+d}, anchor {anchor_delta:+d}"
    )

    return estatus.sympathy_score


# ──────────────────────────────────────────────
# Reveal logic
# ──────────────────────────────────────────────

# Spec §3 reveal threshold table
_REVEAL_LEVELS: list[tuple[int, str, str]] = [
    (80, "full_reveal",     "Emissary chủ động mời player gia nhập Empire, giải thích mục tiêu"),
    (50, "crisis_reveal",   "Emissary reveal thân phận trong crisis, đề nghị hợp tác"),
    (20, "subtle_hints",    "Emissary gửi tín hiệu mơ hồ — 'có vẻ như biết nhiều hơn'"),
    (0,  "hidden",          "Emissary giữ role bình thường, không reveal"),
]


def check_reveal_state(ws: WorldState, emissary_id: str) -> tuple[str, str]:
    """Determine reveal level for an Emissary based on sympathy score.

    Returns:
        Tuple of (reveal_level, description) e.g. ("crisis_reveal", "Emissary reveal...")
    """
    estatus = ws.emissary_status.get(emissary_id)
    if not estatus:
        return ("hidden", "Unknown emissary")

    score = estatus.sympathy_score
    for threshold, level, desc in _REVEAL_LEVELS:
        if score >= threshold:
            return (level, desc)

    return ("hidden", "Emissary giữ role bình thường")


# ──────────────────────────────────────────────
# LLM Context
# ──────────────────────────────────────────────


def get_emissary_context(ws: WorldState) -> str:
    """Build Emissary-specific context for LLM prompt.

    Only includes emissaries with sympathy_score >= 10 (meaningful interaction).
    Returns empty string if no notable emissary state.
    """
    parts: list[str] = []

    for eid, estatus in ws.emissary_status.items():
        if estatus.sympathy_score < 10 and not estatus.revealed_to_player:
            continue

        profile = EMISSARY_PROFILES.get(eid)
        if not profile:
            continue

        reveal_level, reveal_desc = check_reveal_state(ws, eid)

        if estatus.revealed_to_player:
            # Post-reveal: show true identity
            parts.append(
                f"- Emissary {profile.name} (REVEALED — {profile.true_role}): "
                f"sympathy {estatus.sympathy_score}/100"
            )
            if estatus.allegiance_offered:
                parts.append(f"  → Đã đề nghị Empire allegiance cho player")
        elif reveal_level in ("crisis_reveal", "full_reveal"):
            # Near reveal threshold — give AI subtle cues
            parts.append(
                f"- {profile.name} ({profile.cover_role}): "
                f"khả năng cao sắp reveal. "
                f"Philosophy ẩn: \"{profile.philosophy}\""
            )
        elif reveal_level == "subtle_hints":
            # Subtle hints only
            parts.append(
                f"- {profile.name} ({profile.cover_role}): "
                f"có dấu hiệu biết nhiều hơn vẻ ngoài"
            )

    if not parts:
        return ""

    return "## EMISSARY TRACKING:\n" + "\n".join(parts)


# ──────────────────────────────────────────────
# Heuristic prose detection
# ──────────────────────────────────────────────

# Keywords that indicate positive/negative emissary interaction
_EMISSARY_POSITIVE_KW: dict[str, list[str]] = {
    "kaen": ["đồng ý với kaen", "kaen có lý", "kaen nói đúng", "agreed with kaen"],
    "sira": ["cảm ơn sira", "sira giúp", "sira chữa", "sira nói đúng", "agreed with sira"],
    "thol": ["tin tưởng thol", "thol nói đúng", "agreed with thol", "thol có lý"],
}

_EMISSARY_NEGATIVE_KW: dict[str, list[str]] = {
    "kaen": ["không tin kaen", "từ chối kaen", "rejected kaen", "phản đối kaen"],
    "sira": ["không tin sira", "từ chối sira", "rejected sira", "nghi ngờ sira"],
    "thol": ["không tin thol", "từ chối thol", "rejected thol", "phản đối thol"],
}


def detect_emissary_in_prose(ws: WorldState, prose: str, chapter: int = 0) -> None:
    """Heuristic detection of emissary interactions from prose.

    Scans for positive/negative keywords and auto-scores small interactions.
    This supplements explicit score_interaction calls from encounter resolution.
    """
    if not prose:
        return

    lower = prose.lower()

    for eid in ("kaen", "sira", "thol"):
        pos_kws = _EMISSARY_POSITIVE_KW.get(eid, [])
        neg_kws = _EMISSARY_NEGATIVE_KW.get(eid, [])

        if any(kw in lower for kw in pos_kws):
            score_interaction(ws, eid, "showed_understanding", chapter=chapter)
        elif any(kw in lower for kw in neg_kws):
            score_interaction(ws, eid, "mild_disagreement", chapter=chapter)
