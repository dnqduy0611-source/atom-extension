"""Amoisekai — Unique Skill Activation Check.

Code-enforced failure mechanic for unique skills.
4-tier outcome: FULL → WEAKENED → MISFIRE → BACKFIRE.

3 layers of failure probability:
1. Usage fatigue   — repeated use in same chapter
2. Resilience gate — long-term skill health (identity alignment)
3. Instability threshold — player instability amplifies backfire

Ref: UNIQUE_SKILL_FAILURE_SPEC v1.0
"""

from __future__ import annotations

import random
from enum import Enum

from pydantic import BaseModel


# ──────────────────────────────────────────────
# Outcome Types
# ──────────────────────────────────────────────

class SkillOutcome(str, Enum):
    """4-tier skill activation result."""

    FULL = "full"            # 100% effectiveness
    WEAKENED = "weakened"    # Reduced effectiveness
    MISFIRE = "misfire"      # No effect, costs stability
    BACKFIRE = "backfire"    # Hurts player, costs HP + stability


# ──────────────────────────────────────────────
# Activation Result
# ──────────────────────────────────────────────

class SkillActivation(BaseModel):
    """Result of skill activation check.

    Consumed by CombatBrief (combat scenes)
    and SceneWriter (non-combat scenes).
    """

    outcome: SkillOutcome = SkillOutcome.FULL
    effectiveness: float = 1.0       # 0.0-1.0, multiplied with bonus
    stability_cost: float = 0.0      # Extra stability drain
    hp_cost: float = 0.0             # HP damage (backfire only)
    narrative_instruction: str = ""  # Prose guidance for Writer
    reason: str = ""                 # Debug/log info


# ──────────────────────────────────────────────
# Usage Fatigue Table (Layer 1)
# ──────────────────────────────────────────────

# Key = usage_this_chapter (0-indexed: 0 = first use)
_USAGE_TABLE: dict[int, dict] = {
    0: {"eff": 1.0, "stab_cost": 0.0,  "misfire": 0.00, "backfire": 0.00},
    1: {"eff": 0.8, "stab_cost": 5.0,  "misfire": 0.05, "backfire": 0.00},
    2: {"eff": 0.5, "stab_cost": 12.0, "misfire": 0.20, "backfire": 0.05},
}
_USAGE_DEFAULT = {"eff": 0.2, "stab_cost": 20.0, "misfire": 0.40, "backfire": 0.15}


# ──────────────────────────────────────────────
# Narrative Instructions
# ──────────────────────────────────────────────

_NARRATIVE = {
    SkillOutcome.FULL: (
        "Skill kích hoạt thành công — mô tả sức mạnh đầy đủ, "
        "thể hiện sự kết nối giữa player và bản sắc."
    ),
    SkillOutcome.WEAKENED: (
        "Skill yếu hơn bình thường. "
        "Mô tả skill kích hoạt nhưng không đạt sức mạnh tối đa — "
        "run rẩy, chậm hơn, hoặc tác dụng ngắn hơn dự kiến."
    ),
    SkillOutcome.MISFIRE: (
        "Unique skill THẤT BẠI — kích hoạt nhưng không có hiệu quả. "
        "Mô tả skill chớp lóe rồi tắt, hoặc phóng sai hướng. "
        "Player mất stability nhưng không gây damage. Tạo khoảnh khắc bất lực."
    ),
    SkillOutcome.BACKFIRE: (
        "Unique skill PHẢN TÁC DỤNG! Sức mạnh phóng ngược lại. "
        "Player chịu damage, stability crash. Mô tả nỗi đau và sự mất kiểm soát. "
        "Skill tạm thời không dùng được trong scene tiếp theo."
    ),
}


# ──────────────────────────────────────────────
# Main Check Function
# ──────────────────────────────────────────────

def check_skill_activation(
    resilience: float = 100.0,
    skill_instability: float = 0.0,
    player_stability: float = 100.0,
    usage_this_chapter: int = 0,
    player_instability: float = 0.0,
) -> SkillActivation:
    """Check unique skill activation outcome.

    Three-layer probability:
    1. Usage fatigue   — per-chapter usage count
    2. Resilience gate — skill health (0-100, decays with drift)
    3. Instability threshold — high player instability → backfire

    Args:
        resilience: UniqueSkill.resilience (0-100). Decays over chapters.
        skill_instability: UniqueSkill.instability (0-100).
        player_stability: PlayerState.stability (0-100).
        usage_this_chapter: How many times skill was activated this chapter.
        player_instability: PlayerState.instability (0-100).

    Returns:
        SkillActivation with outcome, effectiveness, costs, and
        narrative instruction for Writer.
    """
    # ── Layer 1: Usage fatigue ──
    usage_data = _USAGE_TABLE.get(usage_this_chapter, _USAGE_DEFAULT)
    effectiveness = usage_data["eff"]
    stability_cost = usage_data["stab_cost"]
    misfire_chance = usage_data["misfire"]
    backfire_chance = usage_data["backfire"]

    # ── Layer 2: Resilience modifier ──
    if resilience >= 80:
        res_mod = 1.0
    elif resilience >= 50:
        res_mod = 0.85
        misfire_chance += 0.05
    elif resilience >= 20:
        res_mod = 0.65
        misfire_chance += 0.15
    else:
        res_mod = 0.40
        misfire_chance += 0.30

    effectiveness *= res_mod

    # ── Layer 3: Instability threshold ──
    # 3a. Skill-level instability → misfire risk
    if skill_instability >= 70:
        misfire_chance += 0.12
    elif skill_instability >= 40:
        misfire_chance += 0.05

    # 3b. Player-level instability → backfire risk
    if player_instability >= 80:
        backfire_chance += 0.25
    elif player_instability >= 60:
        backfire_chance += 0.10

    # ── Low stability amplifier ──
    if player_stability < 30:
        misfire_chance += 0.10
        stability_cost *= 1.5

    # ── Roll ──
    roll = random.random()

    # Backfire check (worst outcome first)
    if roll < backfire_chance:
        return SkillActivation(
            outcome=SkillOutcome.BACKFIRE,
            effectiveness=0.0,
            stability_cost=stability_cost * 2,
            hp_cost=15.0,
            narrative_instruction=_NARRATIVE[SkillOutcome.BACKFIRE],
            reason=f"Backfire: roll {roll:.3f} < {backfire_chance:.3f}",
        )

    # Misfire check
    if roll < backfire_chance + misfire_chance:
        return SkillActivation(
            outcome=SkillOutcome.MISFIRE,
            effectiveness=0.0,
            stability_cost=stability_cost,
            hp_cost=0.0,
            narrative_instruction=_NARRATIVE[SkillOutcome.MISFIRE],
            reason=f"Misfire: roll {roll:.3f} < {backfire_chance + misfire_chance:.3f}",
        )

    # Weakened if effectiveness dropped below 0.8
    if effectiveness < 0.8:
        instruction = (
            f"Skill yếu hơn bình thường (hiệu quả {effectiveness:.0%}). "
            "Mô tả skill kích hoạt nhưng không đạt sức mạnh tối đa — "
            "run rẩy, chậm hơn, hoặc tác dụng ngắn hơn dự kiến."
        )
        return SkillActivation(
            outcome=SkillOutcome.WEAKENED,
            effectiveness=effectiveness,
            stability_cost=stability_cost,
            hp_cost=0.0,
            narrative_instruction=instruction,
            reason=f"Weakened: eff={effectiveness:.2f}",
        )

    # Full success
    return SkillActivation(
        outcome=SkillOutcome.FULL,
        effectiveness=effectiveness,
        stability_cost=stability_cost,
        hp_cost=0.0,
        narrative_instruction=_NARRATIVE[SkillOutcome.FULL],
        reason=f"Full: eff={effectiveness:.2f}",
    )


# ──────────────────────────────────────────────
# Resilience Decay (post-chapter)
# ──────────────────────────────────────────────

def update_skill_resilience(
    resilience: float,
    skill_usage_this_chapter: int,
    identity_coherence: float,
    player_instability: float,
) -> float:
    """Update UniqueSkill.resilience after chapter completion.

    Decay sources:
    - Overuse (≥3 uses in chapter): -5.0
    - Low identity coherence (<50): -2.0
    - High player instability (≥60): -1.0

    Recovery:
    - High identity coherence (≥80): +3.0

    Args:
        resilience: Current UniqueSkill.resilience (0-100).
        skill_usage_this_chapter: Times skill was used this chapter.
        identity_coherence: PlayerState.identity_coherence (0-100).
        player_instability: PlayerState.instability (0-100).

    Returns:
        Updated resilience value, clamped to [0, 100].
    """
    delta = 0.0

    # Decay from overuse
    if skill_usage_this_chapter >= 3:
        delta -= 5.0

    # Decay from identity drift
    if identity_coherence < 50:
        delta -= 2.0

    # Decay from sustained instability
    if player_instability >= 60:
        delta -= 1.0

    # Recovery from aligned behavior
    if identity_coherence >= 80:
        delta += 3.0

    return max(0.0, min(100.0, resilience + delta))


# ──────────────────────────────────────────────
# Mutation Lock Check
# ──────────────────────────────────────────────

def check_mutation_allowed(
    growth_stage: str = "seed",
    mutation_locked: bool = False,
    aspect_forged: bool = False,
) -> tuple[bool, str]:
    """Check if Unique Skill mutation is allowed.

    Mutation rules (GROWTH_SPEC §9):
    - Seed stage: mutation allowed (identity still forming)
    - Bloom stage: mutation allowed with warning
    - Aspect+: mutation LOCKED permanently (choice was made)
    - If mutation_locked flag is set: always blocked

    Args:
        growth_stage: Current growth stage (seed/bloom/aspect/ultimate)
        mutation_locked: Explicit lock flag from growth state
        aspect_forged: Whether aspect has been chosen

    Returns:
        (allowed: bool, reason: str)
    """
    if mutation_locked:
        return False, "Mutation locked: Aspect Forge sealed your growth path"

    if aspect_forged or growth_stage in ("aspect", "ultimate"):
        return False, (
            f"Mutation blocked at {growth_stage} stage: "
            "Unique Skill identity is permanent after Aspect Forge"
        )

    if growth_stage == "bloom":
        return True, (
            "Mutation allowed but risky: Bloom may be affected. "
            "Consider carefully — next growth stage locks mutation permanently."
        )

    # Seed stage: fully allowed
    return True, "Mutation allowed: skill identity still forming"
