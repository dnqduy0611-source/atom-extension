"""Tests for Weapon System — Phase 1A Foundation.

Covers: Models, Bond System, Combat Integration, Pipeline Fields.
Ref: WEAPON_SYSTEM_SPEC v1.0 (audited)
"""

import random

from app.models.weapon import (
    INHERITANCE_WEAPONS,
    WEAPON_BUILDFIT_CAP,
    WEAPON_GRADE_BONUS,
    WEAPON_TOTAL_EFFECTIVE_CAP,
    PlayerWeaponSlots,
    SignatureMove,
    Weapon,
    WeaponBondEvent,
    WeaponGrade,
    WeaponLore,
    WeaponOrigin,
    build_weapon_context,
    check_opponent_advantage,
    compute_weapon_combat_contribution,
    get_synergy_type,
)
from app.engine.weapon_bond import (
    SOUL_LINK_THRESHOLD,
    AWAKENING_THRESHOLD,
    apply_bond_decay,
    apply_dormant,
    apply_soul_link,
    check_awakening_threshold,
    check_soul_link_threshold,
    recover_from_dormant,
    update_bond_score,
)
from app.engine.combat import (
    CombatBrief,
    EnemyProfile,
    build_combat_brief,
    compute_combat_score,
)
from app.models.power import (
    CombatMetrics,
    Intensity,
    NormalSkill,
    ResonanceState,
)
from app.models.pipeline import NarrativeState
from app.models.player import PlayerState


# ═══════════════════════════════════════════════
# Helper factories
# ═══════════════════════════════════════════════

def _weapon(
    grade: str = "resonant",
    principle: str = "entropy",
    name: str = "Test Weapon",
    bond: float = 0.0,
) -> Weapon:
    return Weapon(
        id="test_w",
        name=name,
        weapon_type="sword",
        grade=WeaponGrade(grade),
        primary_principle=principle,
        bond_score=bond,
        lore=WeaponLore(origin=WeaponOrigin.crafting, history_summary="Test"),
    )


def _skill(principle: str = "entropy") -> NormalSkill:
    return NormalSkill(
        id="test_s",
        name="Test Skill",
        primary_principle=principle,
        tier=1,
        mechanic="Test mechanic",
    )


def _enemy(principle: str = "order") -> EnemyProfile:
    return EnemyProfile(name="Test Enemy", principle=principle, threat_level=0.5)


# ═══════════════════════════════════════════════
# Model Tests
# ═══════════════════════════════════════════════

class TestWeaponModels:
    def test_weapon_model_defaults(self):
        w = Weapon()
        assert w.grade == WeaponGrade.mundane
        assert w.bond_score == 0.0
        assert w.soul_linked is False
        assert w.dormant is False
        assert w.principles == []

    def test_weapon_grade_bonus_mapping(self):
        """Each grade must map to a known BuildFit bonus."""
        for grade in WeaponGrade:
            assert grade.value in WEAPON_GRADE_BONUS
        # Archon > Awakened > Soul-Linked > Resonant > Mundane
        assert WEAPON_GRADE_BONUS["archon_fragment"] > WEAPON_GRADE_BONUS["awakened"]
        assert WEAPON_GRADE_BONUS["awakened"] > WEAPON_GRADE_BONUS["soul_linked"]
        assert WEAPON_GRADE_BONUS["soul_linked"] > WEAPON_GRADE_BONUS["resonant"]
        assert WEAPON_GRADE_BONUS["resonant"] > WEAPON_GRADE_BONUS["mundane"]

    def test_player_weapon_slots(self):
        slots = PlayerWeaponSlots()
        assert slots.primary is None
        assert slots.secondary is None
        assert slots.utility is None

        w = _weapon()
        slots.primary = w
        assert slots.primary.name == "Test Weapon"

    def test_weapon_principles_property(self):
        w = Weapon(
            primary_principle="order",
            secondary_principle="matter",
            tertiary_principle="energy",
        )
        assert w.principles == ["order", "matter", "energy"]

        w2 = Weapon(primary_principle="entropy")
        assert w2.principles == ["entropy"]

    def test_inheritance_weapons_valid(self):
        """Pre-written weapons must parse correctly."""
        assert len(INHERITANCE_WEAPONS) == 2
        for key, w in INHERITANCE_WEAPONS.items():
            assert w.id == key
            assert w.name
            assert w.grade in (WeaponGrade.resonant, WeaponGrade.soul_linked)
            assert w.primary_principle
            assert w.lore.origin == WeaponOrigin.inheritance


# ═══════════════════════════════════════════════
# Bond System Tests
# ═══════════════════════════════════════════════

class TestBondSystem:
    def test_bond_update_combat_encounter(self):
        w = _weapon(bond=10.0)
        new_bond = update_bond_score(w, "combat_encounter", chapter=3)
        assert new_bond > 10.0
        assert 13.0 <= new_bond <= 15.0  # 3-5 range, midpoint 4.0
        assert len(w.bond_events) == 1
        assert w.bond_events[0].event_type == "combat_encounter"

    def test_bond_soul_link_threshold(self):
        w = _weapon(grade="resonant", bond=79.0)
        assert check_soul_link_threshold(w) is False

        w.bond_score = 80.0
        assert check_soul_link_threshold(w) is True

    def test_bond_cannot_exceed_cap_pre_awakened(self):
        w = _weapon(grade="resonant", bond=98.0)
        update_bond_score(w, "turning_point", chapter=10)  # +10
        assert w.bond_score <= 100.0

    def test_apply_soul_link_upgrades_grade(self):
        w = _weapon(grade="resonant", bond=85.0)
        assert w.grade == WeaponGrade.resonant
        assert w.soul_linked is False

        apply_soul_link(w)
        assert w.grade == WeaponGrade.soul_linked
        assert w.soul_linked is True

    def test_mundane_weapon_no_bond_tracking(self):
        w = _weapon(grade="mundane", bond=0.0)
        update_bond_score(w, "combat_encounter")
        assert w.bond_score == 0.0
        assert len(w.bond_events) == 0

    def test_bond_decay_unused(self):
        w = _weapon(bond=50.0)
        apply_bond_decay(w, chapters_unused=3)
        assert w.bond_score == 45.0  # -5

    def test_dormant_and_recovery(self):
        w = _weapon(grade="soul_linked", bond=80.0)
        w.soul_linked = True
        apply_dormant(w)
        assert w.dormant is True

        recover_from_dormant(w)
        assert w.dormant is False


# ═══════════════════════════════════════════════
# Combat Integration Tests
# ═══════════════════════════════════════════════

class TestWeaponCombatIntegration:
    def test_weapon_bonus_increases_score(self):
        """Weapon with bonus should produce higher combat score."""
        res = ResonanceState(entropy=0.5)
        met = CombatMetrics(dqs=50, stability=70)
        skill = _skill("entropy")
        enemy = _enemy("order")

        score_no_weapon = compute_combat_score(
            res, met, skill, enemy,
        )
        score_with_weapon = compute_combat_score(
            res, met, skill, enemy,
            weapon_bonus=0.10,  # Soul-Linked grade
        )
        assert score_with_weapon > score_no_weapon

    def test_weapon_contribution_capped_at_buildfit_cap(self):
        """BuildFit contribution must not exceed 0.20."""
        w = _weapon(grade="archon_fragment", principle="entropy")
        contrib = compute_weapon_combat_contribution(
            w, skill_principle="entropy", enemy_principle="order",
        )
        assert contrib["buildfit_bonus"] <= WEAPON_BUILDFIT_CAP

    def test_weapon_effective_cap(self):
        """Total effective on final score must not exceed 0.10."""
        w = _weapon(grade="archon_fragment", principle="entropy")
        contrib = compute_weapon_combat_contribution(
            w, skill_principle="entropy", enemy_principle="order",
        )
        assert contrib["effective_total"] <= WEAPON_TOTAL_EFFECTIVE_CAP

    def test_archon_stronger_than_mundane(self):
        """Archon-Fragment should give more combat bonus than Mundane."""
        mundane = _weapon(grade="mundane")
        archon = _weapon(grade="archon_fragment", principle="entropy")

        m_contrib = compute_weapon_combat_contribution(mundane)
        a_contrib = compute_weapon_combat_contribution(archon)

        assert a_contrib["effective_total"] > m_contrib["effective_total"]

    def test_combat_brief_contains_weapon_context(self):
        """CombatBrief should contain weapon_context dict when provided."""
        res = ResonanceState(entropy=0.5)
        met = CombatMetrics(dqs=50)
        random.seed(0)

        w = _weapon(grade="soul_linked", principle="entropy", bond=85.0)
        w.soul_linked = True
        ctx = build_weapon_context(w)

        brief = build_combat_brief(
            resonance=res, metrics=met,
            skill=_skill("entropy"), enemy=_enemy("order"),
            weapon_bonus=0.10,
            weapon_context=ctx,
        )
        assert brief.weapon_context["weapon_name"] == "Test Weapon"
        assert brief.weapon_context["weapon_grade"] == "soul_linked"
        assert brief.weapon_context["soul_linked"] is True

    def test_dormant_weapon_no_contribution(self):
        """Dormant weapon should not contribute to combat."""
        w = _weapon(grade="soul_linked", principle="entropy")
        w.dormant = True
        contrib = compute_weapon_combat_contribution(w)
        assert contrib["effective_total"] == 0.0

    def test_weapon_playerskill_bonus_increases_score(self):
        """C1 fix: weapon_playerskill_bonus must actually increase combat score."""
        res = ResonanceState(entropy=0.5)
        met = CombatMetrics(dqs=50, stability=70)
        skill = _skill("entropy")
        enemy = _enemy("order")

        score_without = compute_combat_score(
            res, met, skill, enemy,
            weapon_playerskill_bonus=0.0,
        )
        score_with = compute_combat_score(
            res, met, skill, enemy,
            weapon_playerskill_bonus=0.02,  # Soul-Linked bonus
        )
        assert score_with > score_without

    def test_synergy_included_in_effective(self):
        """M1 fix: synergy_bonus must be included in effective_total."""
        # Identical synergy (+0.03) should give higher effective than weak (-0.01)
        w = _weapon(grade="resonant", principle="entropy")
        contrib_identical = compute_weapon_combat_contribution(
            w, skill_principle="entropy",   # identical match
        )
        contrib_weak = compute_weapon_combat_contribution(
            w, skill_principle="order",      # weak (cross-cluster)
        )
        assert contrib_identical["effective_total"] > contrib_weak["effective_total"]
        # Also verify synergy is in buildfit
        assert contrib_identical["buildfit_bonus"] > contrib_weak["buildfit_bonus"]


# ═══════════════════════════════════════════════
# Synergy & Advantage Tests
# ═══════════════════════════════════════════════

class TestSynergyAndAdvantage:
    def test_identical_synergy(self):
        assert get_synergy_type("entropy", "entropy") == "identical"

    def test_adjacent_synergy(self):
        # Same cluster: order + matter = constructive
        assert get_synergy_type("order", "matter") == "adjacent"
        # entropy + flux = deconstructive
        assert get_synergy_type("entropy", "flux") == "adjacent"

    def test_opposing_synergy(self):
        assert get_synergy_type("order", "entropy") == "opposing"
        assert get_synergy_type("energy", "void") == "opposing"

    def test_weak_synergy(self):
        # Cross-cluster non-opposing: order vs flux
        assert get_synergy_type("order", "flux") == "weak"

    def test_opponent_advantage(self):
        assert check_opponent_advantage("order", "entropy") is True
        assert check_opponent_advantage("energy", "void") is True
        assert check_opponent_advantage("order", "matter") is False


# ═══════════════════════════════════════════════
# Pipeline Field Tests
# ═══════════════════════════════════════════════

class TestPipelineFields:
    def test_narrative_state_weapon_fields(self):
        state = NarrativeState()
        assert state.weapon_soul_link_pending is False
        assert state.weapon_bond_updates == []
        assert state.weapon_signature_used is False
        assert state.weapon_dormant is False

    def test_player_state_weapon_fields(self):
        ps = PlayerState()
        assert ps.equipped_weapons is not None
        assert ps.equipped_weapons.primary is None
        assert ps.weapon_history == []

        w = _weapon()
        ps.equipped_weapons.primary = w
        assert ps.equipped_weapons.primary.name == "Test Weapon"
