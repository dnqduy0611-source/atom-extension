"""Amoisekai — Resonance Mastery engine.

Automatic resonance growth/decay after combat and Personal Cap Training
milestone tracking.

Ref: SKILL_EVOLUTION_SPEC v1.1 §7
"""

from __future__ import annotations

import logging

from app.models.power import ALL_PRINCIPLES, Principle, get_floor_resonance_cap
from app.models.skill_evolution import ResonanceMasteryState

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Resonance Growth Deltas (spec §7.2)
# ──────────────────────────────────────────────

OUTCOME_DELTAS: dict[str, float] = {
    "favorable": 0.03,
    "mixed": 0.02,
    "unfavorable": 0.01,
}

DECAY_AMOUNT = 0.005
DECAY_MIN_FLOOR = 0.1


# ──────────────────────────────────────────────
# Resonance Growth / Decay
# ──────────────────────────────────────────────

def update_resonance_after_combat(
    resonance: dict[str, float],
    skill_principle: str,
    outcome: str,
    current_floor: int,
    personal_cap_bonus: float = 0.0,
) -> dict[str, float]:
    """Update resonance after a combat phase.

    - Grows resonance for the used principle (capped by floor + personal bonus)
    - Decays all OTHER principles by 0.005 (min 0.1)

    Ref: SKILL_EVOLUTION_SPEC v1.1 §7.2

    Args:
        resonance: Player's resonance dict {principle: float}. Modified in-place.
        skill_principle: The principle of the skill used in this phase.
        outcome: "favorable" | "mixed" | "unfavorable"
        current_floor: Player's current tower floor (1-5).
        personal_cap_bonus: From ResonanceMasteryState.personal_cap_bonus.

    Returns:
        The (mutated) resonance dict.
    """
    delta = OUTCOME_DELTAS.get(outcome, 0.01)

    # Floor cap + personal bonus
    floor_cap = get_floor_resonance_cap(current_floor)
    effective_cap = min(1.0, floor_cap + personal_cap_bonus)

    # Grow used principle
    current = resonance.get(skill_principle, 0.0)
    resonance[skill_principle] = min(effective_cap, current + delta)

    # Decay unused principles
    for p in ALL_PRINCIPLES:
        p_name = p.value
        if p_name != skill_principle:
            resonance[p_name] = max(
                DECAY_MIN_FLOOR,
                resonance.get(p_name, 0.0) - DECAY_AMOUNT,
            )

    return resonance


# ──────────────────────────────────────────────
# Stability Trial Check (spec §7.3.1)
# ──────────────────────────────────────────────

def is_conflicting_use(
    skill_principle: str,
    resonance: dict[str, float],
) -> bool:
    """Check if skill uses an opposing (low-resonance) principle.

    A conflicting use = using a skill whose principle is the OPPOSITE
    of the player's dominant principle.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §7.3.1
    """
    try:
        principle = Principle(skill_principle)
    except ValueError:
        return False

    opposite = principle.opposite
    # It's conflicting if the player has significant resonance with the
    # opposite principle (meaning they're using both opposing forces)
    player_opposite_resonance = resonance.get(opposite.value, 0.0)
    player_used_resonance = resonance.get(skill_principle, 0.0)

    # Both principles have non-trivial resonance = conflicting dual use
    return player_opposite_resonance >= 0.2 and player_used_resonance >= 0.2


def check_stability_trial(
    mastery: ResonanceMasteryState,
    skill_principle: str,
    resonance: dict[str, float],
    had_backlash: bool,
) -> bool:
    """Check if a stability trial milestone is reached.

    Condition: Use 2 opposing principles 5 times without backlash.
    Reward: personal_cap_bonus +0.1 (max 3 times = +0.3 total).

    Ref: SKILL_EVOLUTION_SPEC v1.1 §7.3.1

    Args:
        mastery: Player's ResonanceMasteryState (updated in-place).
        skill_principle: Principle used in this combat phase.
        resonance: Player's resonance dict.
        had_backlash: Whether backlash occurred in this phase.

    Returns:
        True if a stability trial was completed this call.
    """
    # Max 3 trials
    if mastery.stability_trials_passed >= 3:
        return False

    # Track conflicting use without backlash
    if is_conflicting_use(skill_principle, resonance) and not had_backlash:
        mastery.stability_trial_tracker += 1
    elif had_backlash:
        # Backlash resets progress (optional: can keep partial)
        mastery.stability_trial_tracker = max(0, mastery.stability_trial_tracker - 1)

    # Check threshold
    if mastery.stability_trial_tracker >= 5:
        mastery.personal_cap_bonus = min(0.3, mastery.personal_cap_bonus + 0.1)
        mastery.stability_trials_passed += 1
        mastery.stability_trial_tracker = 0  # Reset for next trial
        logger.info(
            "Stability trial passed! Cap bonus now %.1f (%d/3)",
            mastery.personal_cap_bonus, mastery.stability_trials_passed,
        )
        return True

    return False


# ──────────────────────────────────────────────
# Floor Attunement (spec §7.3 table)
# ──────────────────────────────────────────────

def check_floor_attunement(
    mastery: ResonanceMasteryState,
    floor: int,
    boss_cleared: bool,
    resonance: dict[str, float],
    dominant_principle: str,
) -> bool:
    """Check if floor attunement is achieved.

    Condition: Clear floor boss for the first time.
    Reward: dominant principle resonance +0.1.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §7.3 table

    Args:
        mastery: Player's ResonanceMasteryState (updated in-place).
        floor: The floor where the boss was cleared.
        boss_cleared: Whether a floor boss was just cleared.
        resonance: Player's resonance dict (modified in-place).
        dominant_principle: Player's dominant principle (highest resonance).

    Returns:
        True if attunement was achieved.
    """
    if not boss_cleared:
        return False

    if floor in mastery.floor_attunements:
        return False  # Already attuned to this floor

    mastery.floor_attunements.append(floor)

    # Boost dominant principle resonance by 0.1
    current = resonance.get(dominant_principle, 0.0)
    resonance[dominant_principle] = min(1.0, current + 0.1)

    logger.info(
        "Floor %d attunement! %s resonance +0.1 (now %.2f)",
        floor, dominant_principle, resonance[dominant_principle],
    )
    return True


# ──────────────────────────────────────────────
# Overdrive Control (spec §7.3 table)
# ──────────────────────────────────────────────

def check_overdrive_control(
    mastery: ResonanceMasteryState,
    overdrive_used: bool,
    overdrive_misfire: bool,
) -> bool:
    """Check if Overdrive Control milestone is reached.

    Condition: Use Overdrive 3 times successfully (no misfire).
    Reward: overdrive_risk_reduction -5% (max 2 times = -10%).

    Ref: SKILL_EVOLUTION_SPEC v1.1 §7.3 table

    Args:
        mastery: Player's ResonanceMasteryState (updated in-place).
        overdrive_used: Whether player used Overdrive this phase.
        overdrive_misfire: Whether the Overdrive misfired.

    Returns:
        True if a control milestone was completed.
    """
    # Max 2 milestones (total -10%)
    if mastery.overdrive_risk_reduction <= -0.10:
        return False

    if not overdrive_used:
        return False

    if overdrive_misfire:
        # Misfire resets streak (penalty)
        mastery.overdrive_successes = max(0, mastery.overdrive_successes - 1)
        return False

    mastery.overdrive_successes += 1

    if mastery.overdrive_successes >= 3:
        mastery.overdrive_risk_reduction = max(
            -0.10, mastery.overdrive_risk_reduction - 0.05,
        )
        mastery.overdrive_successes = 0  # Reset for next milestone
        logger.info(
            "Overdrive control milestone! Risk reduction now %.0f%%",
            mastery.overdrive_risk_reduction * 100,
        )
        return True

    return False


# ──────────────────────────────────────────────
# Dual Mastery (spec §7.3 table)
# ──────────────────────────────────────────────

DUAL_MASTERY_THRESHOLD = 0.5   # Both principles must be ≥ this
DUAL_MASTERY_BONUS = 0.05      # Min threshold boost per mastery

def check_dual_mastery(
    mastery: ResonanceMasteryState,
    resonance: dict[str, float],
    boss_cleared: bool,
    principles_used: list[str],
) -> bool:
    """Check if Dual Mastery milestone is reached.

    Condition: Maintain dual-principle stable (both ≥ 0.5) through boss fight.
    Reward: resonance min threshold +0.05 for both principles.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §7.3 table

    Args:
        mastery: Player's ResonanceMasteryState (updated in-place).
        resonance: Player's resonance dict (modified in-place).
        boss_cleared: Whether a boss was just cleared (trigger).
        principles_used: List of principles used during the boss fight.

    Returns:
        True if a dual mastery was achieved.
    """
    # Max 2 dual masteries
    if mastery.dual_mastery_count >= 2:
        return False

    if not boss_cleared:
        return False

    # Need at least 2 different principles used
    unique_principles = list(set(principles_used))
    if len(unique_principles) < 2:
        return False

    # Find pairs where both principles have resonance ≥ threshold
    for i, p1 in enumerate(unique_principles):
        for p2 in unique_principles[i + 1:]:
            r1 = resonance.get(p1, 0.0)
            r2 = resonance.get(p2, 0.0)

            if r1 >= DUAL_MASTERY_THRESHOLD and r2 >= DUAL_MASTERY_THRESHOLD:
                pair_key = "-".join(sorted([p1, p2]))

                if pair_key in mastery.dual_masteries:
                    continue  # Already mastered this pair

                mastery.dual_masteries.append(pair_key)
                mastery.dual_mastery_count += 1

                # Boost min threshold for both principles
                resonance[p1] = max(resonance.get(p1, 0.0), r1 + DUAL_MASTERY_BONUS)
                resonance[p2] = max(resonance.get(p2, 0.0), r2 + DUAL_MASTERY_BONUS)

                logger.info(
                    "Dual mastery achieved: %s! +%.2f min threshold for both",
                    pair_key, DUAL_MASTERY_BONUS,
                )
                return True

    return False


# ──────────────────────────────────────────────
# Resonance-to-Prose (for Writer context)
# ──────────────────────────────────────────────

def resonance_to_prose(value: float) -> str:
    """Convert resonance float to natural-language prose descriptor.

    Player NEVER sees raw numbers — only prose descriptions.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §7.4, §10.3
    """
    if value >= 0.8:
        return "cộng hưởng mạnh mẽ"
    elif value >= 0.6:
        return "cộng hưởng rõ rệt"
    elif value >= 0.4:
        return "cộng hưởng vừa phải"
    elif value >= 0.2:
        return "cộng hưởng yếu"
    else:
        return "hầu như không cộng hưởng"


def build_resonance_context(
    resonance: dict[str, float],
) -> dict[str, str]:
    """Build resonance descriptors for writer context.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §10.3
    """
    return {
        principle: resonance_to_prose(value)
        for principle, value in resonance.items()
        if value > 0.0
    }

