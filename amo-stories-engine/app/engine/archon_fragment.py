"""Amoisekai — Archon-Fragment System.

Rule-based classifier for archon affinity tracking.
Condition checker for Fragment weapon acquisition.
Pre-written Fragment weapon data.

Ref: WEAPON_SYSTEM_SPEC v1.0 §8, §12
"""

from __future__ import annotations

from app.models.weapon import (
    Weapon,
    WeaponGrade,
    WeaponLore,
    WeaponOrigin,
)


# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

# 5 Archon keys (bounded, never more than 5)
ARCHON_KEYS: list[str] = ["aethis", "vyrel", "morphael", "dominar", "seraphine"]

# Affinity thresholds for Fragment acquisition (spec §8, §12)
AFFINITY_THRESHOLDS: dict[str, int] = {
    "vyrel": 3,
    "dominar": 2,
    "aethis": 3,
    "morphael": 2,
    "seraphine": 3,
}

# ──────────────────────────────────────────────
# 5 Archon-Fragment Weapons (spec §8)
# ──────────────────────────────────────────────

ARCHON_FRAGMENT_WEAPONS: dict[str, Weapon] = {
    "veil_unbound": Weapon(
        id="veil_unbound",
        name="Veil Unbound",
        weapon_type="chain_whip",
        grade=WeaponGrade.archon_fragment,
        primary_principle="entropy",
        secondary_principle="flux",
        tertiary_principle="void",
        lore=WeaponLore(
            origin=WeaponOrigin.archon,
            history_summary=(
                "Khi Vyrel — Archon Tự Do — đổ năng lượng vào thế giới "
                "trong The First Fracture, một phần ý chí của ngài kết tinh "
                "thành sợi xích không bao giờ bị trói buộc. Veil Unbound "
                "không phải vũ khí được forge — nó tự hình thành từ ý niệm "
                "về sự tự do tuyệt đối. Ai cầm nó không thể bị giam cầm, "
                "nhưng cũng không thể giam cầm ai khác."
            ),
            key_event="The First Fracture — 3000 năm trước",
        ),
        bond_score=100.0,           # Archon-Fragment = Soul-Linked from start
        soul_linked=True,
        is_archon_fragment=True,
        archon_source="vyrel",
    ),
    "iron_dominion": Weapon(
        id="iron_dominion",
        name="Iron Dominion",
        weapon_type="war_hammer",
        grade=WeaponGrade.archon_fragment,
        primary_principle="matter",
        secondary_principle="void",
        tertiary_principle="order",
        lore=WeaponLore(
            origin=WeaponOrigin.archon,
            history_summary=(
                "Dominar — Archon Thống Trị — không tin vào sự tự do. "
                "Ngài tin rằng thế giới cần bàn tay sắt để tồn tại. "
                "Khi năng lượng của ngài kết tinh trong The First Fracture, "
                "Iron Dominion ra đời — chiếc búa chiến mà mặt đất run rẩy "
                "khi chạm xuống. Nó không phục vụ ai — nó chọn kẻ "
                "xứng đáng thống trị."
            ),
            key_event="The First Fracture — 3000 năm trước",
        ),
        bond_score=100.0,
        soul_linked=True,
        is_archon_fragment=True,
        archon_source="dominar",
    ),
    "lex_primordialis": Weapon(
        id="lex_primordialis",
        name="Lex Primordialis",
        weapon_type="greatsword",
        grade=WeaponGrade.archon_fragment,
        primary_principle="order",
        secondary_principle="matter",
        tertiary_principle="energy",
        lore=WeaponLore(
            origin=WeaponOrigin.archon,
            history_summary=(
                "Aethis — Archon Trật Tự — tin rằng vạn vật cần luật lệ. "
                "Khi The First Fracture xé toạc thế giới, ý chí bất diệt "
                "của ngài kết tinh thành thanh đại kiếm Lex Primordialis. "
                "Nó không cắt — nó phán xét. Mỗi nhát chém là một lời "
                "tuyên án, và thế giới tuân theo."
            ),
            key_event="The First Fracture — 3000 năm trước",
        ),
        bond_score=100.0,
        soul_linked=True,
        is_archon_fragment=True,
        archon_source="aethis",
    ),
    "morphic_hunger": Weapon(
        id="morphic_hunger",
        name="Morphic Hunger",
        weapon_type="living_gauntlet",
        grade=WeaponGrade.archon_fragment,
        primary_principle="flux",
        secondary_principle="energy",
        tertiary_principle="matter",
        lore=WeaponLore(
            origin=WeaponOrigin.archon,
            history_summary=(
                "Morphael — Archon Tiến Hóa — không bao giờ giữ nguyên "
                "hình dạng. Khi năng lượng của ngài kết tinh, nó từ chối "
                "trở thành vật cố định. Morphic Hunger là găng tay sống, "
                "liên tục biến đổi theo người cầm. Nó học. Nó thích nghi. "
                "Nó đói không phải máu — mà đói sự thay đổi."
            ),
            key_event="The First Fracture — 3000 năm trước",
        ),
        bond_score=100.0,
        soul_linked=True,
        is_archon_fragment=True,
        archon_source="morphael",
    ),
    "grace_eternal": Weapon(
        id="grace_eternal",
        name="Grace Eternal",
        weapon_type="staff",
        grade=WeaponGrade.archon_fragment,
        primary_principle="energy",
        secondary_principle="matter",
        tertiary_principle="order",
        lore=WeaponLore(
            origin=WeaponOrigin.archon,
            history_summary=(
                "Seraphine — Archon Tận Tâm — đã hy sinh nhiều nhất "
                "trong The First Fracture. Grace Eternal mang dấu ấn "
                "của sự cống hiến vô điều kiện. Cây trượng không tấn công "
                "— nó bảo vệ, hồi phục, và ban phước. Nhưng sức mạnh "
                "của nó chỉ thức tỉnh khi người cầm thật sự tận tâm."
            ),
            key_event="The First Fracture — 3000 năm trước",
        ),
        bond_score=100.0,
        soul_linked=True,
        is_archon_fragment=True,
        archon_source="seraphine",
    ),
}

# Fragment properties lookup (spec §8 Five Fragments table)
FRAGMENT_PROPERTIES: dict[str, dict] = {
    "veil_unbound": {
        "archon": "Vyrel (Freedom)",
        "global_passive": "Cannot be slowed/bound by environmental penalties",
        "divine_ability_name": "Freedom Cascade",
        "divine_ability_desc": "Negate next 2 debuffs + bonus phase",
    },
    "iron_dominion": {
        "archon": "Dominar (Control)",
        "global_passive": "+0.03 Environment modifier always",
        "divine_ability_name": "Sovereign Command",
        "divine_ability_desc": "Force opponent into Stabilize action next decision point",
    },
    "lex_primordialis": {
        "archon": "Aethis (Order)",
        "global_passive": "Opponent stability drain 2% per phase",
        "divine_ability_name": "Absolute Decree",
        "divine_ability_desc": "1 combat phase outcome forced Favorable regardless of score",
    },
    "morphic_hunger": {
        "archon": "Morphael (Evolution)",
        "global_passive": "+1% combat bonus per chapter used (max +5%)",
        "divine_ability_name": "Adaptive Apex",
        "divine_ability_desc": "Copy opponent's principle strength for 1 phase",
    },
    "grace_eternal": {
        "archon": "Seraphine (Devotion)",
        "global_passive": "Fate Buffer charges +1 when coherence >= 80",
        "divine_ability_name": "Eternal Devotion",
        "divine_ability_desc": "Fully restore stability at cost of 20% HP",
    },
}


# ──────────────────────────────────────────────
# Classifier (rule-based, no LLM)
# ──────────────────────────────────────────────

def classify_archon_affinity(
    alignment_change: float = 0.0,
    coherence_change: float = 0.0,
    notoriety_change: float = 0.0,
    drift_detected: str = "",
    action_category: str = "",
) -> str | None:
    """Classify chapter for archon affinity signal.

    Rule-based — reuses Identity Delta from CWA + action_category
    from Intent Classifier. No LLM call.

    Thresholds are intentionally high to avoid false-positives.
    Most chapters return None.

    Args:
        alignment_change: from IdentityDelta
        coherence_change: from IdentityDelta
        notoriety_change: from IdentityDelta
        drift_detected: "" | "minor" | "major" from IdentityDelta
        action_category: from Intent Classifier

    Returns:
        Archon key ("vyrel", "dominar", etc.) or None.
    """
    # Vyrel (Freedom): strong freedom assertion
    if alignment_change < -1.5 and action_category in ("stealth", "exploration", "soul_choice"):
        return "vyrel"

    # Dominar (Control): dominance/authority display
    if notoriety_change > 1.0 and action_category in ("social", "combat"):
        return "dominar"

    # Aethis (Order): strong coherence + purposeful action
    if coherence_change > 1.0 and action_category in ("soul_choice", "exploration"):
        return "aethis"

    # Morphael (Evolution): identity drift + discovery
    if drift_detected in ("minor", "major") and action_category in ("exploration", "stealth"):
        return "morphael"

    # Seraphine (Devotion): strong positive alignment + social/soul
    if alignment_change > 1.5 and action_category in ("social", "soul_choice"):
        return "seraphine"

    return None


def increment_archon_affinity(
    archon_affinity: dict[str, int],
    archon_key: str,
) -> dict[str, int]:
    """Increment affinity for a specific archon. Returns updated dict.

    Safe: only accepts valid archon keys, values only go up.
    """
    if archon_key not in ARCHON_KEYS:
        return archon_affinity

    updated = dict(archon_affinity)
    updated[archon_key] = updated.get(archon_key, 0) + 1
    return updated


# ──────────────────────────────────────────────
# Fragment Condition Checker
# ──────────────────────────────────────────────

def check_fragment_conditions(
    archon_affinity: dict[str, int],
    alignment: float = 0.0,
    notoriety: float = 0.0,
    coherence: float = 0.0,
    had_drift: bool = False,
) -> str | None:
    """Check if player meets conditions for an Archon-Fragment.

    Pure Python gate — no LLM call.

    Returns Fragment weapon ID if conditions met, None otherwise.
    """
    # Veil Unbound: vyrel affinity >= 3 + alignment < -20
    if archon_affinity.get("vyrel", 0) >= AFFINITY_THRESHOLDS["vyrel"]:
        if alignment < -20:
            return "veil_unbound"

    # Iron Dominion: dominar affinity >= 2 + notoriety >= 30
    if archon_affinity.get("dominar", 0) >= AFFINITY_THRESHOLDS["dominar"]:
        if notoriety >= 30:
            return "iron_dominion"

    # Lex Primordialis: aethis affinity >= 3 + coherence >= 70
    if archon_affinity.get("aethis", 0) >= AFFINITY_THRESHOLDS["aethis"]:
        if coherence >= 70:
            return "lex_primordialis"

    # Morphic Hunger: morphael affinity >= 2 + had identity drift
    if archon_affinity.get("morphael", 0) >= AFFINITY_THRESHOLDS["morphael"]:
        if had_drift:
            return "morphic_hunger"

    # Grace Eternal: seraphine affinity >= 3 + alignment > 20
    if archon_affinity.get("seraphine", 0) >= AFFINITY_THRESHOLDS["seraphine"]:
        if alignment > 20:
            return "grace_eternal"

    return None


def get_dominant_archon(archon_affinity: dict[str, int]) -> str | None:
    """Get the archon with highest affinity. For soft-hint to Writer.

    Returns None if no affinity tracked yet.
    """
    if not archon_affinity:
        return None

    # Filter to valid keys only
    valid = {k: v for k, v in archon_affinity.items() if k in ARCHON_KEYS and v > 0}
    if not valid:
        return None

    return max(valid, key=valid.get)


def get_fragment_weapon(fragment_id: str) -> Weapon | None:
    """Get a copy of an Archon-Fragment weapon by ID."""
    weapon = ARCHON_FRAGMENT_WEAPONS.get(fragment_id)
    if weapon is None:
        return None
    return weapon.model_copy(deep=True)


# ──────────────────────────────────────────────
# Divine Ability System (spec §8 — 1/season)
# ──────────────────────────────────────────────

# Combat override effects per divine ability
DIVINE_ABILITY_EFFECTS: dict[str, dict] = {
    "veil_unbound": {
        "type": "debuff_negate",
        "debuffs_negated": 2,
        "bonus_phase": True,
        "combat_override": None,  # No score override; tactical advantage
    },
    "iron_dominion": {
        "type": "force_action",
        "forced_action": "stabilize",
        "combat_override": None,  # Opponent locked into stabilize
    },
    "lex_primordialis": {
        "type": "phase_override",
        "forced_outcome": "favorable",
        "phases_affected": 1,
        "combat_override": "auto_favorable",  # 1 phase auto-win
    },
    "morphic_hunger": {
        "type": "principle_copy",
        "duration_phases": 1,
        "combat_override": "copy_strength",  # Match opponent's principle bonus
    },
    "grace_eternal": {
        "type": "stability_restore",
        "stability_restored": 1.0,  # full restore
        "hp_cost_percent": 0.20,
        "combat_override": "full_stability",
    },
}


def can_use_divine_ability(weapon: Weapon, current_season: int) -> bool:
    """Check if divine ability is available (1/season cooldown).

    Args:
        weapon: must be is_archon_fragment=True
        current_season: current game season number (1-indexed)

    Returns:
        True if ability hasn't been used this season.
    """
    if not weapon.is_archon_fragment:
        return False
    if weapon.dormant:
        return False
    # 0 = never used; different season = available
    return weapon.divine_ability_used_season != current_season


def activate_divine_ability(weapon: Weapon, current_season: int) -> dict | None:
    """Activate divine ability for combat override.

    Marks as used for this season. Returns effect dict or None if unavailable.
    """
    if not can_use_divine_ability(weapon, current_season):
        return None

    fragment_id = weapon.id
    props = FRAGMENT_PROPERTIES.get(fragment_id)
    effect = DIVINE_ABILITY_EFFECTS.get(fragment_id)

    if props is None or effect is None:
        return None

    # Mark as used
    weapon.divine_ability_used_season = current_season

    return {
        "ability_name": props["divine_ability_name"],
        "ability_desc": props["divine_ability_desc"],
        "archon": props["archon"],
        "effect": effect,
    }


def get_divine_ability_info(weapon: Weapon, current_season: int) -> dict:
    """Get divine ability info for Writer context (available/used status)."""
    if not weapon.is_archon_fragment:
        return {}

    fragment_id = weapon.id
    props = FRAGMENT_PROPERTIES.get(fragment_id, {})
    available = can_use_divine_ability(weapon, current_season)

    return {
        "divine_ability_name": props.get("divine_ability_name", ""),
        "divine_ability_desc": props.get("divine_ability_desc", ""),
        "divine_ability_available": available,
        "divine_ability_used_season": weapon.divine_ability_used_season,
    }


# ──────────────────────────────────────────────
# Lore Reveal System (progressive counter)
# ──────────────────────────────────────────────

# Max lore fragments per Archon-Fragment
MAX_LORE_FRAGMENTS: int = 5


def increment_lore_reveal(weapon: Weapon) -> int:
    """Increment lore fragments revealed for an Archon-Fragment.

    Called when archon affinity is incremented (player aligns with archon).
    Returns new count (capped at MAX_LORE_FRAGMENTS).
    """
    if not weapon.is_archon_fragment:
        return 0

    current = weapon.lore.lore_fragments_revealed
    if current >= MAX_LORE_FRAGMENTS:
        return current

    weapon.lore.lore_fragments_revealed = current + 1
    return weapon.lore.lore_fragments_revealed


def get_lore_reveal_progress(weapon: Weapon) -> dict:
    """Get lore reveal status for Writer context."""
    if not weapon.is_archon_fragment:
        return {}

    revealed = weapon.lore.lore_fragments_revealed
    return {
        "lore_fragments_revealed": revealed,
        "lore_fragments_total": MAX_LORE_FRAGMENTS,
        "lore_complete": revealed >= MAX_LORE_FRAGMENTS,
    }


# ──────────────────────────────────────────────
# Shard Resonance (bonus from 3+ same-principle)
# ──────────────────────────────────────────────

SHARD_RESONANCE_THRESHOLD: int = 3
SHARD_RESONANCE_BONUS: float = 0.02  # +0.02 BuildFit when resonance active


def check_shard_resonance(weapon: Weapon) -> bool:
    """Check if weapon has shard resonance (3+ shards of same principle).

    Returns True if resonance bonus should apply.
    """
    return (
        weapon.shard_count >= SHARD_RESONANCE_THRESHOLD
        and weapon.shard_principle != ""
        and weapon.shard_principle == weapon.primary_principle
    )


def get_shard_resonance_bonus(weapon: Weapon) -> float:
    """Get shard resonance BuildFit bonus (0.0 or 0.02)."""
    if check_shard_resonance(weapon):
        return SHARD_RESONANCE_BONUS
    return 0.0

