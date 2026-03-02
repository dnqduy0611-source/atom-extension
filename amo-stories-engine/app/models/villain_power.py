"""Villain Power System models — Phase 2.

VillainPowerProfile và VillainAbility cho hệ thống villain power
(COMPANION_VILLAIN_GENDER_SPEC §2, v1.0).

Villain power phải:
1. Có thể counter bởi player skill hoặc companion ability
2. Có philosophy cost — mỗi ability phản ánh sự hy sinh của villain
3. Reveal dần — player không biết toàn bộ ability ngay từ đầu
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# VillainAbility
# ──────────────────────────────────────────────


class VillainAbility(BaseModel):
    """Một ability của villain — có thể counter được và có philosophy cost."""

    name: str = ""                    # "Luật Bất Di Dịch"
    description: str = ""            # Mô tả narrative
    mechanic: str = ""               # Cách hoạt động cụ thể trong narrative
    reveal_condition: str = ""       # Khi nào player biết ability này tồn tại
    counter: str = ""                # Cái gì counter được (player skill / companion / strategy)
    philosophy_source: str = ""      # Principle nào tạo ra power này
    cost_to_villain: str = ""        # Villain hy sinh gì để dùng ability này


# ──────────────────────────────────────────────
# Villain Power Tiers
# ──────────────────────────────────────────────

VILLAIN_POWER_TIERS: dict[int, str] = {
    1: "enforcer",       # Emissary sơ cấp, mid-boss
    2: "emissary",       # 3 Emissary chính (Kaen, Sira, Thol)
    3: "general",        # 4 Generals
    4: "veiled_fragment",  # Veiled Will fragment hints
    5: "veiled_will",    # End-game — narrative confrontation
}

VILLAIN_CLASS_THREAT: dict[str, str] = {
    "enforcer":       "Player có thể thắng nếu dùng skill đúng",
    "emissary":       "Khó, cần companion hoặc strategy",
    "general":        "Cần multi-chapter buildup, companion synergy",
    "veiled_fragment": "Chỉ encounter, không thể thắng conventionally",
    "veiled_will":    "Narrative confrontation, không combat thuần",
}


# ──────────────────────────────────────────────
# VillainPowerProfile
# ──────────────────────────────────────────────


class VillainPowerProfile(BaseModel):
    """Full power profile của một villain — loaded từ static seed JSON."""

    # ── Identity ──
    villain_id: str = ""             # "kaen" | "general_vorn" | ...
    villain_name: str = ""
    villain_class: Literal[
        "enforcer", "emissary", "general", "veiled_fragment", "veiled_will"
    ] = "enforcer"
    power_tier: int = Field(default=1, ge=1, le=5)
    faction: str = ""

    # ── Principles ──
    dominant_principle: str = ""     # Order / Entropy / Flux / Matter / Energy / Void
    secondary_principle: str = ""

    # ── Combat profile ──
    abilities: list[VillainAbility] = Field(default_factory=list)  # 2-4 abilities
    weaknesses: list[str] = Field(default_factory=list)            # 1-2 explicit weaknesses
    encounter_style: Literal[
        "direct_combat",        # Đánh trực tiếp
        "psychological",        # Thao túng tâm lý
        "proxy",                # Dùng subordinate
        "revelation",           # Reveal sự thật → identity crisis
        "philosophical_debate", # Tranh luận ideology
    ] = "direct_combat"

    # ── Narrative profile ──
    motivation_core: str = ""        # Lý do thực sự
    argument_to_player: str = ""     # Villain muốn thuyết phục player điều gì
    what_villain_fears: str = ""     # Điểm yếu tâm lý

    # ── Companion synergy weakness ──
    # Companion archetype type (e.g. "conscience") + tier ("bonded") để bypass weakness
    companion_weakness_bypass: str = ""   # e.g. "bonded companion → shield psychological ability"
