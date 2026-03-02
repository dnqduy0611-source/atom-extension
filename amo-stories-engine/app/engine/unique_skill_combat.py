"""Unique Skill V2 Combat Integration.

Extends the combat engine with V2 Unique Skill mechanics:
- unique_skill_combat_bonus_v2():  0.0-0.08 (upgraded from 0.05 cap)
- evaluate_sub_skills():           0.0-0.03 bonus from sub-skill applicability
- check_unique_clause_applicable(): +5% when unique clause conditions match
- build_unique_skill_context():    Rich context dict for CombatBrief/SceneWriter

Ref: SEASON_1_UNIQUE_SKILL_SPEC §4.1-4.4
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.engine.domain import apply_domain_bonus, get_domain_scaling
from app.models.unique_skill_growth import ScarType

if TYPE_CHECKING:
    from app.models.player import PlayerState, SubSkill, UniqueSkill
    from app.models.unique_skill_growth import UniqueSkillGrowthState

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════
# V2 COMBAT BONUS (upgraded cap: 8%)
# ══════════════════════════════════════════════

V2_BONUS_CAP = 0.08
UNIQUE_EXISTS_BONUS = 0.01
BLOOM_BONUS = 0.01
SCAR_DEFENSIVE_BONUS = 0.01
ASPECT_BONUS = 0.02
ULTIMATE_BONUS = 0.08  # Auto-max
SUB_SKILL_CAP = 0.03
UNIQUE_CLAUSE_BONUS = 0.05


def unique_skill_combat_bonus_v2(
    player: PlayerState,
    enemy_skills: list[dict] | None = None,
) -> float:
    """Compute V2 unique skill combat bonus (0.0-0.08).

    Formula:
        base      = 0.01  (Unique exists)
        + domain  = 0.03  (if matchup)
        + bloom   = 0.01  (if bloom completed)
        + scar    = 0.01  (if scar defensive)
        + aspect  = 0.02  (if aspect forged)
        = max 0.08 (if ultimate → auto-max)

    Args:
        player: Player with unique_skill + unique_skill_growth
        enemy_skills: List of enemy skill dicts with 'category' and 'tier'

    Returns:
        float bonus clamped to [0.0, 0.08]
    """
    skill = player.unique_skill
    growth = player.unique_skill_growth

    if not skill:
        return 0.0

    base = UNIQUE_EXISTS_BONUS  # 1% for having a unique skill

    # Domain matchup bonus
    if skill.domain_category and enemy_skills:
        stage = growth.current_stage if growth else "seed"
        domain_bonus = apply_domain_bonus(
            skill.domain_category, enemy_skills, player_stage=stage,
        )
        base += domain_bonus  # +0-3%

    if growth:
        # Ultimate = auto-max, skip all other checks
        if growth.ultimate_forged:
            return ULTIMATE_BONUS

        # Bloom bonus
        if growth.bloom_completed:
            base += BLOOM_BONUS  # +1%

        # Scar defensive bonus (extra survivability)
        if growth.scar_adapted and growth.scar_type == ScarType.DEFENSIVE:
            base += SCAR_DEFENSIVE_BONUS  # +1%

        # Aspect bonus
        if growth.aspect_forged:
            base += ASPECT_BONUS  # +2%

    return min(V2_BONUS_CAP, base)


# ══════════════════════════════════════════════
# SUB-SKILL EVALUATION
# ══════════════════════════════════════════════

def evaluate_sub_skills(
    player: PlayerState,
    scene_type: str = "",
    is_combat: bool = False,
    enemy_category: str = "",
) -> float:
    """Evaluate sub-skill applicability for bonus (0.0-0.03).

    Each unlocked sub-skill can contribute 0.01 if applicable.
    Max 3 sub-skills can contribute = 0.03 cap.

    Args:
        player: Player with unique_skill
        scene_type: Current scene type (combat, social, exploration)
        is_combat: Whether currently in combat
        enemy_category: Enemy's skill category if in combat

    Returns:
        float bonus clamped to [0.0, 0.03]
    """
    skill = player.unique_skill
    if not skill or not skill.sub_skills:
        return 0.0

    bonus = 0.0

    for ss in skill.sub_skills:
        if not ss.name:
            continue

        applicable = False

        # Passive sub-skills: always active
        if ss.type == "passive":
            applicable = True

        # Active sub-skills: applicable in combat
        elif ss.type == "active" and is_combat:
            applicable = True

        # Reactive sub-skills: applicable in combat
        elif ss.type == "reactive" and is_combat:
            applicable = True

        if applicable:
            bonus += 0.01

    return min(SUB_SKILL_CAP, bonus)


# ══════════════════════════════════════════════
# UNIQUE CLAUSE CHECK
# ══════════════════════════════════════════════

# Keywords in unique_clause that map to conditions
CLAUSE_KEYWORDS = {
    "stability": "low_stability",
    "hp": "low_hp",
    "instability": "high_instability",
    "coherence": "high_coherence",
    "breakthrough": "breakthrough",
    "combat": "combat",
    "defeat": "after_defeat",
}


def check_unique_clause_applicable(
    player: PlayerState,
    scene_type: str = "",
    is_combat: bool = False,
) -> bool:
    """Check if unique clause condition is met.

    When applicable: +5% significant bonus.
    Unique clause examples: "Stability < 30% → skill mạnh hơn"

    Uses keyword matching against player state to determine
    if the narrative condition of the clause is satisfied.
    """
    skill = player.unique_skill
    if not skill or not skill.unique_clause:
        return False

    clause = skill.unique_clause.lower()

    # Check Stability-based clauses (e.g., "Stability < 30%" or "low stability")
    if any(kw in clause for kw in ("stability", "ổn định")):
        if "<" in clause or "thấp" in clause or "yếu" in clause:
            return player.stability < 30.0
        elif ">" in clause or "cao" in clause:
            return player.stability > 70.0

    # Check HP-based clauses
    if any(kw in clause for kw in ("hp", "máu")):
        if "<" in clause or "thấp" in clause:
            return player.hp < player.hp_max * 0.3
        elif ">" in clause or "cao" in clause:
            return player.hp > player.hp_max * 0.7

    # Check instability-based clauses
    if any(kw in clause for kw in ("instability", "bất ổn")):
        return player.instability > 50.0

    # Check combat-specific clauses
    if any(kw in clause for kw in ("combat", "chiến đấu")):
        return is_combat

    # Check defeat-based clauses
    if any(kw in clause for kw in ("defeat", "thất bại", "thua")):
        return getattr(player, "defeat_count", 0) > 0

    # Check coherence-based clauses
    if any(kw in clause for kw in ("coherence", "bản sắc")):
        return player.identity_coherence > 80.0

    # Default: not applicable
    return False


# ══════════════════════════════════════════════
# COMBAT BRIEF — UNIQUE SKILL CONTEXT
# ══════════════════════════════════════════════

def build_unique_skill_context(
    player: PlayerState,
    scene_type: str = "",
    is_combat: bool = False,
    enemy_category: str = "",
    enemy_skills: list[dict] | None = None,
    suppression_result: dict | None = None,
) -> dict:
    """Build rich unique_skill_context for CombatBrief.

    Provides SceneWriter with full context about the unique skill's
    current state, active sub-skills, domain, weakness, and clause status.

    Args:
        suppression_result: Optional dict from SuppressionResult.model_dump()

    Returns empty dict if player has no unique skill.
    """
    skill = player.unique_skill
    growth = player.unique_skill_growth

    if not skill:
        return {}

    # Compute all bonuses
    combat_bonus = unique_skill_combat_bonus_v2(player, enemy_skills)
    sub_skill_bonus = evaluate_sub_skills(player, scene_type, is_combat, enemy_category)
    clause_active = check_unique_clause_applicable(player, scene_type, is_combat)

    # Apply suppression modifier to bonuses
    supp_modifier = 1.0
    supp_level = "none"
    supp_narrative = ""
    if suppression_result:
        supp_modifier = suppression_result.get("effectiveness_modifier", 1.0)
        supp_level = suppression_result.get("level", "none")
        supp_narrative = suppression_result.get("narrative_instruction", "")

    effective_combat_bonus = combat_bonus * supp_modifier
    effective_sub_bonus = sub_skill_bonus * supp_modifier

    # Active sub-skills for writer
    active_sub_skills = []
    for ss in skill.sub_skills:
        if ss.name:
            active_sub_skills.append({
                "name": ss.name,
                "type": ss.type,
                "mechanic": ss.mechanic,
                "unlocked_at": ss.unlocked_at,
            })

    # Ultimate ability status
    can_use_ultimate = False
    if growth and growth.ultimate_forged:
        ultimate = growth.ultimate_form
        if ultimate and not ultimate.ultimate_ability_used_this_season:
            can_use_ultimate = True

    # If SEALED or NULLIFIED, ultimate ability is blocked
    if supp_level in ("sealed", "nullified"):
        can_use_ultimate = False

    return {
        "name": skill.name,
        "stage": growth.current_stage if growth else "seed",
        "category": skill.category,
        "mechanic": skill.mechanic,
        "active_sub_skills": active_sub_skills if supp_level != "nullified" else [],
        "domain": skill.domain_passive_name,
        "domain_mechanic": skill.domain_passive_mechanic,
        "weakness": skill.weakness,
        "weakness_type": skill.weakness_type,
        "unique_clause": skill.unique_clause,
        "unique_clause_active": clause_active and supp_level not in ("sealed", "nullified"),
        "axis_blind_spot": skill.axis_blind_spot,
        "combat_bonus": round(effective_combat_bonus, 3),
        "sub_skill_bonus": round(effective_sub_bonus, 3),
        "clause_bonus": UNIQUE_CLAUSE_BONUS if (clause_active and supp_level not in ("sealed", "nullified")) else 0.0,
        "total_bonus": round(
            effective_combat_bonus + effective_sub_bonus
            + (UNIQUE_CLAUSE_BONUS if (clause_active and supp_level not in ("sealed", "nullified")) else 0.0),
            3,
        ),
        "can_use_ultimate_ability": can_use_ultimate,
        "bloom_path": growth.bloom_path if growth else "",
        # Suppression state
        "suppression_level": supp_level,
        "suppression_modifier": supp_modifier,
        "suppression_narrative": supp_narrative,
    }

