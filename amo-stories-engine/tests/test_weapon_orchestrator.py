"""Tests for Weapon Orchestrator — pipeline glue layer.

Covers: extract_bond_events, compute_pre_combat_bonus,
        apply_post_combat_drops, post_chapter_weapon_update.
"""

from __future__ import annotations
from unittest.mock import MagicMock

from app.engine.weapon_orchestrator import (
    apply_post_combat_drops,
    compute_pre_combat_bonus,
    extract_bond_events,
    post_chapter_weapon_update,
)
from app.models.weapon import (
    PlayerWeaponSlots,
    Weapon,
    WeaponGrade,
    WeaponLore,
    SignatureMove,
)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _make_player(
    grade: WeaponGrade = WeaponGrade.resonant,
    principle: str = "order",
    archetype: str = "vanguard",
    bond_score: float = 50.0,
    archon_affinity: dict | None = None,
) -> MagicMock:
    weapon = Weapon(
        name="Test Weapon",
        grade=grade,
        primary_principle=principle,
        bond_score=bond_score,
        soul_linked=grade in (
            WeaponGrade.soul_linked,
            WeaponGrade.awakened,
            WeaponGrade.archon_fragment,
        ),
    )
    slots = PlayerWeaponSlots(primary=weapon)

    player = MagicMock()
    player.equipped_weapons = slots
    player.archetype = archetype
    player.archon_affinity = archon_affinity or {}
    player.unique_skill = None
    player.total_chapters = 0
    return player


def _make_identity_delta(
    alignment_change: float = 0.0,
    coherence_change: float = 0.0,
    notoriety_change: float = 0.0,
    drift_detected: str = "",
) -> dict:
    return {
        "alignment_change": alignment_change,
        "coherence_change": coherence_change,
        "notoriety_change": notoriety_change,
        "drift_detected": drift_detected,
    }


# ═══════════════════════════════════════════════
# extract_bond_events
# ═══════════════════════════════════════════════

class TestExtractBondEvents:
    def test_combat_action(self):
        events = extract_bond_events(action_category="combat")
        assert "combat_encounter" in events

    def test_soul_choice_action(self):
        events = extract_bond_events(action_category="soul_choice")
        assert "soul_choice" in events

    def test_exploration_action(self):
        events = extract_bond_events(action_category="exploration")
        assert "narrative_reference" in events

    def test_turning_point(self):
        events = extract_bond_events(is_turning_point=True)
        assert "turning_point" in events

    def test_near_death(self):
        events = extract_bond_events(near_death=True)
        assert "near_death" in events

    def test_theft_attempt(self):
        events = extract_bond_events(theft_attempt=True)
        assert "theft_attempt_failed" in events

    def test_multiple_events(self):
        events = extract_bond_events(
            action_category="combat",
            is_turning_point=True,
            near_death=True,
        )
        assert len(events) == 3

    def test_no_duplicate_combat(self):
        events = extract_bond_events(
            action_category="combat",
            has_combat=True,
        )
        assert events.count("combat_encounter") == 1

    def test_empty(self):
        events = extract_bond_events()
        assert events == []


# ═══════════════════════════════════════════════
# compute_pre_combat_bonus
# ═══════════════════════════════════════════════

class TestPreCombatBonus:
    def test_no_player(self):
        result = compute_pre_combat_bonus(None)
        assert result["effective_total"] == 0.0

    def test_no_weapon(self):
        player = MagicMock()
        player.equipped_weapons = PlayerWeaponSlots()
        result = compute_pre_combat_bonus(player)
        assert result["effective_total"] == 0.0

    def test_resonant_weapon(self):
        player = _make_player(WeaponGrade.resonant, archetype="sovereign")
        result = compute_pre_combat_bonus(player)
        assert result["buildfit_bonus"] > 0

    def test_sovereign_amplified(self):
        player_sovereign = _make_player(WeaponGrade.resonant, archetype="sovereign")
        player_normal = _make_player(WeaponGrade.resonant, archetype="wanderer")
        r_sov = compute_pre_combat_bonus(player_sovereign)
        r_norm = compute_pre_combat_bonus(player_normal)
        assert r_sov["buildfit_bonus"] > r_norm["buildfit_bonus"]

    def test_vanguard_dual_wield(self):
        secondary = Weapon(
            name="Off-hand", grade=WeaponGrade.resonant,
            primary_principle="entropy",
        )
        player = _make_player(WeaponGrade.resonant, archetype="vanguard")
        player.equipped_weapons.secondary = secondary
        result = compute_pre_combat_bonus(player)
        assert result["buildfit_bonus"] > 0


# ═══════════════════════════════════════════════
# apply_post_combat_drops
# ═══════════════════════════════════════════════

class TestPostCombatDrops:
    def test_no_monster(self):
        result = apply_post_combat_drops()
        assert result["dropped_core"] is None
        assert result["dropped_crystal"] is None

    def test_boss_can_drop_crystal(self):
        """Boss + crng favorable → soul crystal drops (deterministic)."""
        result = apply_post_combat_drops(
            monster_tier="boss",
            is_boss=True,
            coherence=80.0,
            crng_favorable=True,
        )
        assert result["dropped_crystal"] is not None

    def test_non_boss_no_crystal(self):
        result = apply_post_combat_drops(monster_tier="common")
        assert result["dropped_crystal"] is None


# ═══════════════════════════════════════════════
# post_chapter_weapon_update
# ═══════════════════════════════════════════════

class TestPostChapterUpdate:
    def test_no_player_returns_empty(self):
        result = post_chapter_weapon_update(player_state=None)
        assert result == {}

    def test_bond_increases_on_combat(self):
        player = _make_player(bond_score=50.0)
        initial_bond = player.equipped_weapons.primary.bond_score
        post_chapter_weapon_update(
            player_state=player,
            action_category="combat",
            has_combat=True,
        )
        assert player.equipped_weapons.primary.bond_score > initial_bond

    def test_soul_link_threshold_detected(self):
        player = _make_player(
            grade=WeaponGrade.resonant,
            bond_score=78.0,
        )
        # soul_choice gives +6, pushing from 78 to 84 (≥80)
        result = post_chapter_weapon_update(
            player_state=player,
            action_category="soul_choice",
        )
        assert result.get("weapon_soul_link_pending") is True

    def test_awakening_threshold_detected(self):
        player = _make_player(
            grade=WeaponGrade.soul_linked,
            bond_score=82.0,
        )
        # soul_choice +6 → 88 (≥85)
        result = post_chapter_weapon_update(
            player_state=player,
            action_category="soul_choice",
        )
        assert result.get("weapon_awakening_pending") is True

    def test_archon_affinity_tracked(self):
        player = _make_player()
        delta = _make_identity_delta(alignment_change=-2.0)
        result = post_chapter_weapon_update(
            player_state=player,
            identity_delta=delta,
            action_category="stealth",
        )
        # alignment_change < -1.5 + stealth → vyrel signal
        affinity = result.get("archon_affinity_update", {})
        assert affinity.get("vyrel", 0) >= 1

    def test_dominant_archon_set(self):
        player = _make_player(archon_affinity={"vyrel": 3, "dominar": 1})
        result = post_chapter_weapon_update(player_state=player)
        assert result.get("dominant_archon") == "vyrel"

    def test_weapon_combat_bonus_computed(self):
        player = _make_player(WeaponGrade.soul_linked)
        result = post_chapter_weapon_update(player_state=player)
        bonus = result.get("weapon_combat_bonus", {})
        assert bonus["buildfit_bonus"] > 0

    def test_weapon_context_built(self):
        player = _make_player(WeaponGrade.resonant)
        result = post_chapter_weapon_update(player_state=player)
        ctx = result.get("weapon_context", {})
        assert ctx.get("weapon_name") == "Test Weapon"
        assert ctx.get("weapon_grade") == "resonant"

    def test_dormant_weapon_skips_bond(self):
        player = _make_player(bond_score=50.0)
        player.equipped_weapons.primary.dormant = True
        result = post_chapter_weapon_update(
            player_state=player,
            action_category="combat",
        )
        # Bond should NOT change
        assert player.equipped_weapons.primary.bond_score == 50.0

    def test_no_evolution_for_non_awakened(self):
        player = _make_player(WeaponGrade.resonant)
        result = post_chapter_weapon_update(player_state=player)
        assert "weapon_evolution_pending" not in result
