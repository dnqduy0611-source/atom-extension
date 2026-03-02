"""Companion System models — Phase 1.

CompanionProfile, CompanionAbility, AffinityEvent for the companion
character system (Amoisekai COMPANION_VILLAIN_GENDER_SPEC v1.0).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Affinity Tier constants
# ──────────────────────────────────────────────

AFFINITY_TIERS: dict[str, tuple[int, int]] = {
    "stranger":      (-20, 19),
    "acquaintance":  (20,  39),
    "ally":          (40,  59),
    "close":         (60,  79),
    "bonded":        (80,  99),
    "sworn":         (100, 100),
}

AFFINITY_TIER_DESC: dict[str, str] = {
    "stranger":      "Companion lạnh lùng, hợp tác tối thiểu, có thể từ chối yêu cầu",
    "acquaintance":  "Banter bề mặt, ability khả dụng ở mức cơ bản",
    "ally":          "Companion chia sẻ thông tin quan trọng, ability fully usable",
    "close":         "Backstory hidden đã reveal, ability có upgrade",
    "bonded":        "Secret revealed, companion sẵn sàng hy sinh để bảo vệ player",
    "sworn":         "Sự kiện narrative đặc biệt, ability legendary upgrade, unbreakable",
}


def affinity_to_tier(affinity: int) -> str:
    """Map numeric affinity score to tier name."""
    if affinity >= 100:
        return "sworn"
    if affinity >= 80:
        return "bonded"
    if affinity >= 60:
        return "close"
    if affinity >= 40:
        return "ally"
    if affinity >= 20:
        return "acquaintance"
    return "stranger"


# ──────────────────────────────────────────────
# Affinity Delta rules (used by simulator output)
# ──────────────────────────────────────────────

AFFINITY_DELTA_RULES: dict[str, int] = {
    # TĂNG
    "follow_companion_suggestion":     +3,
    "support_companion_unprompted":    +5,
    "trust_companion_high_risk":       +8,
    "companion_bond_scene":            +10,
    "player_vulnerable_disclosure":    +5,
    "rescue_companion":                +15,
    # GIẢM
    "ignore_companion_in_need":        -5,
    "choose_action_companion_opposed": -10,
    "instrumental_betrayal":           -15,
    "betray_companion_clear":          -20,
    "betray_companion_high_stakes":    -30,
    "remove_companion_intentionally":  -40,
}


# ──────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────

class CompanionAbility(BaseModel):
    """Companion's unique narrative ability."""

    name: str = ""
    description: str = ""
    mechanic: str = ""
    activation_condition: str = ""
    limitation: str = ""
    synergy_with_player: str = ""
    cost: str = ""


class AffinityEvent(BaseModel):
    """Log entry for an affinity change."""

    chapter: int = 0
    scene: int = 0
    delta: int = 0
    reason: str = ""
    trigger_type: Literal["choice", "free_input", "consequence", "inaction"] = "consequence"


class CompanionProfile(BaseModel):
    """Full profile of a companion character."""

    # ── Identity ──
    id: str = ""
    name: str = ""
    gender: Literal["male", "female", "neutral"] = "neutral"
    role: Literal[
        "fighter", "strategist", "scout", "healer", "mage", "diplomat", "wanderer"
    ] = "fighter"
    personality_core: str = ""
    appearance_anchor: str = ""

    # ── Backstory (tiered unlock) ──
    backstory_surface: str = ""
    backstory_hidden: str = ""       # unlock at affinity ≥ 60 (close)
    secret: str = ""                 # unlock at affinity ≥ 80 (bonded)
    secret_reveal_trigger: str = ""  # circumstance / condition for reveal

    # ── Story tracking ──
    story_id: str = ""
    companion_archetype_type: str = ""  # "conscience", "anchor", "ward", etc.
    first_appeared_chapter: int = 1
    status: Literal["active", "departed", "dead", "unknown"] = "active"
    departure_reason: str = ""

    # ── Affinity system ──
    affinity: int = Field(default=20, ge=-20, le=100)
    affinity_tier: str = "acquaintance"
    affinity_history: list[AffinityEvent] = Field(default_factory=list)

    # ── Ability ──
    ability: CompanionAbility = Field(default_factory=CompanionAbility)

    # ── Dialogue memory ──
    notable_quotes: list[str] = Field(default_factory=list)
    last_emotional_state: str = "neutral"

    # ── Gender-aware response profile ──
    response_to_player_male: str = ""
    response_to_player_female: str = ""

    def update_tier(self) -> None:
        """Recompute affinity_tier from current affinity score."""
        self.affinity_tier = affinity_to_tier(self.affinity)

    def apply_delta(
        self,
        delta: int,
        reason: str,
        chapter: int = 0,
        scene: int = 0,
        trigger_type: str = "consequence",
        tone_multiplier: float = 1.0,
    ) -> int:
        """Apply affinity delta (with optional tone multiplier) and log the event.

        Returns the actual delta applied.
        """
        scaled = int(round(delta * tone_multiplier))
        old = self.affinity
        self.affinity = max(-20, min(100, self.affinity + scaled))
        actual = self.affinity - old
        if actual != 0:
            self.affinity_history.append(
                AffinityEvent(
                    chapter=chapter,
                    scene=scene,
                    delta=actual,
                    reason=reason,
                    trigger_type=trigger_type,  # type: ignore[arg-type]
                )
            )
            self.update_tier()
        return actual

    def departed_permanently(self) -> bool:
        """True when companion has left and won't return."""
        return self.status == "departed" and self.affinity < -10

    def is_adversary(self) -> bool:
        """True when companion affinity drops to adversary threshold."""
        return self.affinity <= -20
