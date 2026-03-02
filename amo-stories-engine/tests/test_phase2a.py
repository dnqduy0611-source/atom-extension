"""Tests for Phase 2A — Awakened Grade + Signature Move v1.

Covers: Awakening state transition, passives, Signature Move agent,
        combat bonus, pipeline flag.
Ref: WEAPON_SYSTEM_SPEC v1.0 §2 (Grade 4), §3 (Passives), §7 (Sig Move)
"""

from app.models.weapon import (
    SignatureMove,
    Weapon,
    WeaponBondEvent,
    WeaponGrade,
    WeaponLore,
    WeaponOrigin,
)
from app.models.pipeline import NarrativeState
from app.engine.weapon_bond import (
    AWAKENED_PASSIVES,
    AWAKENING_THRESHOLD,
    apply_awakening,
    check_awakening_threshold,
    get_awakened_passive,
)
from app.narrative.signature_move_agent import (
    SIGNATURE_MOVE_BONUS,
    build_signature_move_context,
    create_fallback_signature_move,
    get_signature_combat_bonus,
    parse_signature_move_response,
)
from app.engine.combat import compute_combat_score
from app.models.power import CombatMetrics, NormalSkill, ResonanceState
from app.engine.combat import EnemyProfile


# ═══════════════════════════════════════════════
# Helper
# ═══════════════════════════════════════════════

def _soul_linked_weapon(
    primary: str = "entropy",
    secondary: str = "flux",
) -> Weapon:
    return Weapon(
        id="test_sl",
        name="Test Soul-Linked",
        weapon_type="sword",
        grade=WeaponGrade.soul_linked,
        primary_principle=primary,
        secondary_principle=secondary,
        soul_linked=True,
        bond_score=90.0,
        lore=WeaponLore(origin=WeaponOrigin.crafting, history_summary="Test lore"),
        bond_events=[
            WeaponBondEvent(chapter=3, event_type="near_death", description="Survived ambush", bond_delta=8.0),
            WeaponBondEvent(chapter=5, event_type="soul_choice", description="Chose weapon path", bond_delta=6.0),
        ],
    )


# ═══════════════════════════════════════════════
# Awakening Threshold Tests
# ═══════════════════════════════════════════════

class TestAwakeningThreshold:
    def test_threshold_value(self):
        assert AWAKENING_THRESHOLD == 85.0

    def test_threshold_met(self):
        w = _soul_linked_weapon()
        w.bond_score = 85.0
        assert check_awakening_threshold(w) is True

    def test_threshold_not_met_score(self):
        w = _soul_linked_weapon()
        w.bond_score = 84.0
        assert check_awakening_threshold(w) is False

    def test_threshold_wrong_grade(self):
        w = _soul_linked_weapon()
        w.grade = WeaponGrade.resonant
        assert check_awakening_threshold(w) is False


# ═══════════════════════════════════════════════
# Awakening State Transition Tests
# ═══════════════════════════════════════════════

class TestApplyAwakening:
    def test_upgrades_to_awakened(self):
        w = _soul_linked_weapon()
        apply_awakening(w)
        assert w.grade == WeaponGrade.awakened

    def test_assigns_passive_entropy_flux(self):
        w = _soul_linked_weapon(primary="entropy", secondary="flux")
        apply_awakening(w)
        assert w.awakened_passive == "Liquid Chaos"

    def test_assigns_passive_order_matter(self):
        w = _soul_linked_weapon(primary="order", secondary="matter")
        apply_awakening(w)
        assert w.awakened_passive == "Iron Discipline"

    def test_assigns_passive_energy_void(self):
        """Note: Energy+Void is cross-cluster, no passive (not in same-cluster pairs)."""
        w = _soul_linked_weapon(primary="energy", secondary="void")
        apply_awakening(w)
        # Energy+Void is NOT on the passives table (cross-cluster)
        assert w.awakened_passive == ""

    def test_no_upgrade_from_resonant(self):
        w = _soul_linked_weapon()
        w.grade = WeaponGrade.resonant
        apply_awakening(w)
        assert w.grade == WeaponGrade.resonant  # No change

    def test_preserves_bond_events(self):
        w = _soul_linked_weapon()
        events_before = len(w.bond_events)
        apply_awakening(w)
        assert len(w.bond_events) == events_before

    def test_preserves_soul_linked(self):
        w = _soul_linked_weapon()
        apply_awakening(w)
        assert w.soul_linked is True


# ═══════════════════════════════════════════════
# Awakened Passives Table Tests
# ═══════════════════════════════════════════════

class TestAwakenedPassives:
    def test_six_passives_defined(self):
        """Spec §3: 6 same-cluster/thematic pairs."""
        assert len(AWAKENED_PASSIVES) == 6

    def test_all_passives_match_spec(self):
        expected = {
            frozenset({"order", "matter"}): "Iron Discipline",
            frozenset({"order", "energy"}): "Law of Force",
            frozenset({"entropy", "void"}): "Abyssal Hunger",
            frozenset({"entropy", "flux"}): "Liquid Chaos",
            frozenset({"matter", "energy"}): "Forged Fire",
            frozenset({"flux", "void"}): "Shadow Step",
        }
        for combo, name in expected.items():
            assert AWAKENED_PASSIVES[combo][0] == name

    def test_cross_cluster_returns_none(self):
        """Order+Entropy is cross-cluster → no passive."""
        assert get_awakened_passive("order", "entropy") is None

    def test_empty_principles_returns_none(self):
        assert get_awakened_passive("", "matter") is None


# ═══════════════════════════════════════════════
# Signature Move Context Tests
# ═══════════════════════════════════════════════

class TestSignatureMoveContext:
    def test_context_structure(self):
        w = _soul_linked_weapon()
        ctx = build_signature_move_context(
            w,
            player_archetype="vanguard",
            unique_skill_stage="bloom",
            player_identity_summary="Alignment +10, Coherence 80",
        )
        assert ctx["evolution_tier"] == 1
        assert ctx["weapon_name"] == "Test Soul-Linked"
        assert ctx["weapon_principles"] == ["entropy", "flux"]
        assert ctx["player_archetype"] == "vanguard"
        assert len(ctx["player_key_moments"]) == 2  # From bond_events

    def test_context_custom_moments(self):
        w = _soul_linked_weapon()
        ctx = build_signature_move_context(
            w,
            player_key_moments=["Custom moment 1", "Custom moment 2"],
        )
        assert ctx["player_key_moments"] == ["Custom moment 1", "Custom moment 2"]


# ═══════════════════════════════════════════════
# Signature Move Parse Tests
# ═══════════════════════════════════════════════

class TestSignatureMoveParse:
    def test_parse_valid_json(self):
        raw = '{"name": "Phong Liệt", "description": "Chiêu thức test", "mechanical_effect": "damage_amplify", "mechanical_value": 0.05, "narrative_note": "Note", "activation_cue": "Khi HP dưới 30%"}'
        move = parse_signature_move_response(raw)
        assert move is not None
        assert move.name == "Phong Liệt"
        assert move.mechanical_effect == "damage_amplify"
        assert move.evolution_tier == 1
        assert move.v1_name == "Phong Liệt"

    def test_parse_json_in_code_block(self):
        raw = '```json\n{"name": "Tuyệt Kỹ", "description": "Test"}\n```'
        move = parse_signature_move_response(raw)
        assert move is not None
        assert move.name == "Tuyệt Kỹ"

    def test_parse_invalid_returns_none(self):
        move = parse_signature_move_response("not json at all")
        assert move is None


# ═══════════════════════════════════════════════
# Signature Move Fallback Tests
# ═══════════════════════════════════════════════

class TestSignatureMoveFallback:
    def test_fallback_entropy(self):
        w = _soul_linked_weapon(primary="entropy")
        move = create_fallback_signature_move(w)
        assert move.name == "Hư Vô Trảm"
        assert move.mechanical_effect == "drain_enhance"
        assert move.mechanical_value == 0.05

    def test_fallback_order(self):
        w = _soul_linked_weapon(primary="order")
        move = create_fallback_signature_move(w)
        assert move.name == "Luật Thiên"

    def test_fallback_preserves_v1(self):
        w = _soul_linked_weapon()
        move = create_fallback_signature_move(w)
        assert move.v1_name == move.name


# ═══════════════════════════════════════════════
# Combat Bonus Tests
# ═══════════════════════════════════════════════

class TestSignatureCombat:
    def test_bonus_values(self):
        """Spec §7: v1=0.05, v2=0.07, v3=0.10."""
        assert get_signature_combat_bonus(1) == 0.05
        assert get_signature_combat_bonus(2) == 0.07
        assert get_signature_combat_bonus(3) == 0.10

    def test_invalid_tier_zero(self):
        assert get_signature_combat_bonus(0) == 0.0

    def test_signature_bonus_increases_score(self):
        """Signature Move +0.05 should increase combat score."""
        resonance = ResonanceState(order=0.5)
        metrics = CombatMetrics(dqs_ratio=0.5, stability_ratio=0.7, hp_ratio=1.0)
        skill = NormalSkill(name="Test", primary_principle="order", principles=["order"])
        enemy = EnemyProfile(name="Test", principle="entropy", threat_level=0.5)

        score_without = compute_combat_score(
            resonance=resonance, metrics=metrics, skill=skill,
            enemy=enemy, signature_move_bonus=0.0,
        )
        score_with = compute_combat_score(
            resonance=resonance, metrics=metrics, skill=skill,
            enemy=enemy, signature_move_bonus=0.05,
        )
        assert score_with > score_without


# ═══════════════════════════════════════════════
# Pipeline Flag Tests
# ═══════════════════════════════════════════════

class TestPipelineFlags:
    def test_awakening_pending_default(self):
        ns = NarrativeState()
        assert ns.weapon_awakening_pending is False
