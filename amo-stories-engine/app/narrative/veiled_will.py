"""Veiled Will — Background cosmic threat seed system.

Implements VILLAIN_SYSTEM_SPEC §7: The Veiled Will (Ý Chí Ẩn Mình).
The Veiled Will is not a character but the cosmos itself pushing toward
a specific outcome. It manifests through background anomalies that
gradually reveal a pattern across the player's journey.

Phases:
    0: Hidden    — no signals, no awareness
    1: Calamity  — background anomalies begin (NPC déjà vu, weather glitches,
                   Fate Buffer activation hints)
    2: Pattern   — player recognizes: "these aren't random"
    3: Revelation — the system behind reality becomes clear

Phase advance triggers:
    0→1: Any General defeated OR tower floor ≥ 3
    1→2: 2+ Generals defeated AND empire_resonance + identity_anchor ≥ 80
    2→3: All 4 Generals encountered AND veiled_will_phase == 2 for 3+ chapters

Functions:
    check_phase_advance    — evaluate triggers and advance phase
    get_anomaly_seeds      — return anomaly hint strings for current phase
    get_veiled_will_context — build LLM context block
"""

from __future__ import annotations

import logging
import random
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.world_state import WorldState

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Phase Definitions
# ──────────────────────────────────────────────

PHASE_NAMES: dict[int, str] = {
    0: "Hidden",
    1: "Calamity Seeds",
    2: "Pattern Recognition",
    3: "Revelation",
}


# ──────────────────────────────────────────────
# Anomaly seed pools (per phase)
# ──────────────────────────────────────────────

# Phase 1: subtle background anomalies — AI picks 1-2 per chapter
_PHASE_1_SEEDS: list[str] = [
    "Một NPC vô tình nhắc lại chính xác câu nói từ 3 chương trước — nhưng không có lý do.",
    "Thời tiết thay đổi đột ngột giữa paragraph — nắng → mưa → nắng, không ai nhận ra.",
    "Protagonist thoáng thấy một bóng người giống mình ở góc phố — nhìn lại thì biến mất.",
    "Chim bay theo pattern hình tròn — hai lần trong một ngày, cùng hướng.",
    "Một đứa trẻ trong phố vẽ symbol mà protagonist chưa từng dạy — nhưng giống seal trên Unique Skill.",
    "Lúc Fate Buffer activate: 'Trong khoảnh khắc đó, cái gì đó nhìn lại từ phía bên kia.'",
    "Giọng nói trong đám đông — 'Cháu à, đừng bao giờ hỏi tại sao bầu trời có màu xanh.'",
    "Clock tower đổ chuông lệch 1 phút — chỉ protagonist nhận ra.",
]

# Phase 2: pattern becomes recognizable — AI acknowledges the pattern
_PHASE_2_SEEDS: list[str] = [
    "Protagonist nhận ra: những chi tiết kỳ lạ không phải coincidence. Có pattern.",
    "NPC bị déjà vu giờ xuất hiện CÓ HỆ THỐNG — luôn liên quan đến moments of choice.",
    "Thời tiết anomalies correlate với identity instability — weather = mirror of inner state?",
    "Symbols giống Unique Skill seal xuất hiện ở 3 locations khác nhau — too many to be random.",
    "Fate Buffer activations để lại 'afterimage' — mỗi lần gợi ý ai đó đang observe.",
    "Protagonist bắt đầu dream fragments: những scene chưa xảy ra, nhưng feel familiar.",
]

# Phase 3: the revelation — AI can reveal the cosmic architecture
_PHASE_3_SEEDS: list[str] = [
    "Hệ thống đằng sau reality trở nên rõ ràng: không phải chaos, mà là DESIGN.",
    "Anomalies dừng lại — không phải vì biến mất, mà vì protagonist giờ THẤY RÕ.",
    "'Ý Chí Ẩn Mình' không phải kẻ thù. Nó là gravitational pull của cosmos toward order.",
    "Câu hỏi không còn is 'ai đứng sau?' mà là 'tôi chọn gì, biết rằng cosmos đang nhìn?'",
]

_ANOMALY_POOLS: dict[int, list[str]] = {
    1: _PHASE_1_SEEDS,
    2: _PHASE_2_SEEDS,
    3: _PHASE_3_SEEDS,
}


# ──────────────────────────────────────────────
# Phase advance logic
# ──────────────────────────────────────────────


def check_phase_advance(ws: WorldState, chapter: int = 0) -> int:
    """Evaluate triggers and advance veiled_will_phase if conditions met.

    Trigger conditions:
        0→1: Any General defeated OR tower floor ≥ 3
        1→2: 2+ Generals defeated AND (empire_resonance + identity_anchor) ≥ 80
        2→3: All 4 Generals encountered AND phase == 2 for 3+ chapters
             (approximated: chapter >= chapter_entered_phase_2 + 3)

    Args:
        ws: WorldState to evaluate and mutate
        chapter: current chapter number

    Returns:
        New phase (0-3), unchanged if no advance
    """
    current = ws.veiled_will_phase

    if current >= 3:
        return 3  # already at max

    generals_defeated = sum(
        1 for g in ws.general_status.values()
        if g.status == "defeated" or g.resolution == "victory"
    )
    generals_encountered = sum(
        1 for g in ws.general_status.values()
        if g.encounter_phase > 0 or g.status != "shadow"
    )

    if current == 0:
        # 0→1: Any General defeated OR tower floor ≥ 3
        if generals_defeated >= 1 or ws.tower.highest_floor_reached >= 3:
            ws.veiled_will_phase = 1
            ws.world_flags["veiled_will_signal_detected"] = True
            logger.info(
                f"VeiledWill: phase 0→1 (Calamity Seeds) at ch.{chapter} "
                f"(generals_defeated={generals_defeated}, tower={ws.tower.highest_floor_reached})"
            )

    elif current == 1:
        # 1→2: 2+ Generals defeated AND combined resonance+anchor ≥ 80
        combined = ws.empire_resonance + ws.identity_anchor
        if generals_defeated >= 2 and combined >= 80:
            ws.veiled_will_phase = 2
            ws.world_flags["veiled_will_phase_2_chapter"] = True  # mark entry
            logger.info(
                f"VeiledWill: phase 1→2 (Pattern Recognition) at ch.{chapter} "
                f"(generals_defeated={generals_defeated}, combined={combined})"
            )

    elif current == 2:
        # 2→3: All 4 Generals encountered AND spent 3+ chapters in phase 2
        # We approximate "3+ chapters" by checking if enough story has progressed
        # Since we can't perfectly track chapter_entered_phase2, we use general count
        if generals_encountered >= 4 and chapter >= 15:
            ws.veiled_will_phase = 3
            logger.info(
                f"VeiledWill: phase 2→3 (Revelation) at ch.{chapter} "
                f"(all {generals_encountered} generals encountered, "
                f"{generals_defeated} defeated)"
            )

    return ws.veiled_will_phase


# ──────────────────────────────────────────────
# Anomaly seeds
# ──────────────────────────────────────────────


def get_anomaly_seeds(ws: WorldState, count: int = 2) -> list[str]:
    """Return anomaly hint strings for the current phase.

    The AI should weave 1-2 of these into the chapter prose as background
    details — not plot-critical, just atmospheric.

    Args:
        ws: WorldState to read phase from
        count: max number of seeds to return

    Returns:
        List of anomaly seed strings (may be empty for phase 0)
    """
    pool = _ANOMALY_POOLS.get(ws.veiled_will_phase, [])
    if not pool:
        return []

    # Deterministic-ish selection: use empire_resonance + identity_anchor as seed
    # This ensures consistency within a chapter but variety across chapters
    rng = random.Random(ws.empire_resonance * 100 + ws.identity_anchor + ws.veiled_will_phase + len(ws.narrative_events))
    selected = rng.sample(pool, min(count, len(pool)))

    return selected


# ──────────────────────────────────────────────
# LLM Context
# ──────────────────────────────────────────────


def get_veiled_will_context(ws: WorldState) -> str:
    """Build Veiled Will context for LLM prompt.

    Returns empty string for phase 0 (hidden — no signals).
    """
    phase = ws.veiled_will_phase

    if phase == 0:
        return ""

    parts: list[str] = []

    phase_name = PHASE_NAMES.get(phase, "?")
    parts.append(f"## THE VEILED WILL — Phase {phase}: {phase_name}")

    if phase == 1:
        parts.append(
            "- Background anomalies PHẢI xuất hiện subtle trong prose."
        )
        parts.append(
            "- KHÔNG giải thích anomalies. KHÔNG để protagonist comment trực tiếp."
        )
        parts.append("- Đây là atmospheric detail, không phải plot point.")
        parts.append("- Weave 1-2 anomaly seeds vào prose tự nhiên:")
    elif phase == 2:
        parts.append(
            "- Protagonist BẮT ĐẦU nhận ra pattern — nhưng không hiểu fully."
        )
        parts.append(
            "- Anomalies có thể được protagonist reference: 'Lại cái này nữa...'"
        )
        parts.append("- Tone chuyển từ subtle → unsettling.")
        parts.append("- Weave 1-2 pattern recognition seeds:")
    elif phase == 3:
        parts.append(
            "- REVELATION: hệ thống đằng sau reality có thể được discuss openly."
        )
        parts.append(
            "- Protagonist đã biết: cosmos có ý chí. Câu hỏi là: chọn gì?"
        )
        parts.append("- Tone: existential clarity, not horror.")
        parts.append("- Revelation seeds:")

    # Add anomaly seeds
    seeds = get_anomaly_seeds(ws)
    for seed in seeds:
        parts.append(f"  → \"{seed}\"")

    return "\n".join(parts)
