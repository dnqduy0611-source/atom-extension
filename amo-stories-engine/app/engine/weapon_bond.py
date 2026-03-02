"""Amoisekai — Weapon Bond Engine.

Tracks Bond Score between player and weapon. Detects thresholds
for Soul-Link (≥80) and Awakening (≥85).

Ref: WEAPON_SYSTEM_SPEC v1.0 §5
"""

from __future__ import annotations

from app.models.weapon import Weapon, WeaponBondEvent, WeaponGrade


# ──────────────────────────────────────────────
# Bond Score Deltas (Spec §5)
# ──────────────────────────────────────────────

BOND_DELTAS: dict[str, tuple[float, float]] = {
    # event_type → (min_delta, max_delta)
    "combat_encounter": (3.0, 5.0),
    "near_death": (8.0, 8.0),
    "narrative_reference": (5.0, 5.0),
    "theft_attempt_failed": (4.0, 4.0),
    "soul_choice": (6.0, 6.0),
    "turning_point": (10.0, 10.0),
}

BOND_DECAY_UNUSED: float = -5.0     # per chapter of non-use (after 3 chapters)
BOND_DECAY_MISALIGN: float = -3.0   # per chapter of principle misalignment

# Bond caps
BOND_CAP_PRE_AWAKENED: float = 100.0
BOND_CAP_POST_AWAKENED: float = 150.0

# Thresholds
SOUL_LINK_THRESHOLD: float = 80.0
AWAKENING_THRESHOLD: float = 85.0


# ──────────────────────────────────────────────
# Core Functions
# ──────────────────────────────────────────────

def get_bond_delta(event_type: str) -> float:
    """Get the bond score delta for a given event type.

    For events with a range (e.g., combat_encounter: 3-5),
    returns the midpoint. Callers can use the range from BOND_DELTAS
    directly if they need randomization.
    """
    entry = BOND_DELTAS.get(event_type)
    if entry is None:
        return 0.0
    min_d, max_d = entry
    return (min_d + max_d) / 2.0


def get_bond_cap(weapon: Weapon) -> float:
    """Get the current bond score cap based on weapon grade."""
    if weapon.grade in (WeaponGrade.awakened, WeaponGrade.archon_fragment):
        return BOND_CAP_POST_AWAKENED
    return BOND_CAP_PRE_AWAKENED


def update_bond_score(
    weapon: Weapon,
    event_type: str,
    chapter: int = 0,
    description: str = "",
) -> float:
    """Update weapon bond score for a bond event.

    Records the event and applies the delta. Returns new bond_score.
    Only tracks from Resonant grade onwards.
    """
    if weapon.grade == WeaponGrade.mundane:
        return weapon.bond_score

    delta = get_bond_delta(event_type)
    if delta == 0.0:
        return weapon.bond_score

    cap = get_bond_cap(weapon)
    weapon.bond_score = min(cap, max(0.0, weapon.bond_score + delta))

    # Record the bond event
    weapon.bond_events.append(WeaponBondEvent(
        chapter=chapter,
        event_type=event_type,
        description=description,
        bond_delta=delta,
    ))

    return weapon.bond_score


def apply_bond_decay(
    weapon: Weapon,
    chapters_unused: int = 0,
    principle_misaligned: bool = False,
) -> float:
    """Apply bond score decay from disuse or misalignment.

    Returns new bond_score.
    """
    if weapon.grade == WeaponGrade.mundane:
        return weapon.bond_score

    total_decay = 0.0

    # Decay from non-use (only after 3+ chapters unused)
    if chapters_unused >= 3:
        total_decay += BOND_DECAY_UNUSED

    # Decay from principle misalignment
    if principle_misaligned:
        total_decay += BOND_DECAY_MISALIGN

    if total_decay < 0:
        weapon.bond_score = max(0.0, weapon.bond_score + total_decay)

    return weapon.bond_score


# ──────────────────────────────────────────────
# Threshold Checks
# ──────────────────────────────────────────────

def check_soul_link_threshold(weapon: Weapon) -> bool:
    """Check if weapon is ready for Soul-Link event.

    Requires: bond_score ≥ 80 AND grade == resonant.
    """
    return (
        weapon.grade == WeaponGrade.resonant
        and weapon.bond_score >= SOUL_LINK_THRESHOLD
        and not weapon.soul_linked
    )


def check_awakening_threshold(weapon: Weapon) -> bool:
    """Check if weapon is ready for Awakening.

    Requires: bond_score ≥ 85 AND grade == soul_linked.
    """
    return (
        weapon.grade == WeaponGrade.soul_linked
        and weapon.bond_score >= AWAKENING_THRESHOLD
        and weapon.soul_linked
    )


# ──────────────────────────────────────────────
# State Transitions
# ──────────────────────────────────────────────

def apply_soul_link(weapon: Weapon) -> Weapon:
    """Upgrade weapon from Resonant to Soul-Linked.

    Sets soul_linked=True, upgrades grade, preserves bond events.
    Returns the same weapon (mutated in place).
    """
    if weapon.grade != WeaponGrade.resonant:
        return weapon

    weapon.grade = WeaponGrade.soul_linked
    weapon.soul_linked = True
    return weapon


def apply_dormant(weapon: Weapon) -> Weapon:
    """Set weapon to dormant state (narrative punishment)."""
    if not weapon.soul_linked:
        return weapon   # Only soul-linked+ can go dormant
    weapon.dormant = True
    return weapon


def recover_from_dormant(weapon: Weapon) -> Weapon:
    """Recover weapon from dormant state."""
    weapon.dormant = False
    return weapon


# ──────────────────────────────────────────────
# Awakened Passives (Spec §3)
# ──────────────────────────────────────────────

# Only same-cluster / thematic pairs generate passives.
# Cross-cluster combos (e.g., Order+Entropy) → None.
AWAKENED_PASSIVES: dict[frozenset[str], tuple[str, str]] = {
    # (passive_name, effect_description)
    frozenset({"order", "matter"}): ("Iron Discipline", "+5% stability recovery per phase"),
    frozenset({"order", "energy"}): ("Law of Force", "+3% damage khi HP > 70%"),
    frozenset({"entropy", "void"}): ("Abyssal Hunger", "+5% stability drain to opponent"),
    frozenset({"entropy", "flux"}): ("Liquid Chaos", "Counter-strike +10% khi bị hit"),
    frozenset({"matter", "energy"}): ("Forged Fire", "Overdrive cost -5%"),
    frozenset({"flux", "void"}): ("Shadow Step", "Environment modifier +0.05"),
}


def get_awakened_passive(primary: str, secondary: str) -> tuple[str, str] | None:
    """Get awakened passive for a principle combination.

    Returns (passive_name, effect_description) or None for cross-cluster combos.
    """
    if not primary or not secondary:
        return None
    combo = frozenset({primary, secondary})
    return AWAKENED_PASSIVES.get(combo)


def apply_awakening(weapon: Weapon) -> Weapon:
    """Upgrade weapon from Soul-Linked to Awakened (Grade 4).

    Sets grade, assigns passive from principle combo, preserves all state.
    Returns the same weapon (mutated in place).

    Prereqs: grade == soul_linked, bond_score >= 85.
    """
    if weapon.grade != WeaponGrade.soul_linked:
        return weapon

    weapon.grade = WeaponGrade.awakened

    # Assign passive from principle combo
    passive = get_awakened_passive(
        weapon.primary_principle, weapon.secondary_principle,
    )
    if passive:
        weapon.awakened_passive = passive[0]

    return weapon
