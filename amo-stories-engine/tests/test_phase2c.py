"""Tests for Phase 2C — Completion & Polish.

Covers: Masterwork crafting, Dormant recovery beat, Awakening beat,
        weapon cosmetics directives.
Ref: WEAPON_SYSTEM_SPEC v1.0 §5, §6.3, §7, §12
"""

from app.models.weapon import (
    Weapon,
    WeaponGrade,
    WeaponLore,
    WeaponOrigin,
)
from app.models.pipeline import NarrativeState
from app.engine.monster_core import (
    MATERIAL_GRADE_MAP,
    create_crafted_weapon,
    get_max_craft_grade,
)
from app.narrative.planner import (
    _inject_dormant_recovery_beat,
    _inject_awakening_beat,
)


# ═══════════════════════════════════════════════
# Masterwork Crafting Tests
# ═══════════════════════════════════════════════

class TestMasterworkCrafting:
    def test_masterwork_in_material_map(self):
        assert "masterwork" in MATERIAL_GRADE_MAP
        assert MATERIAL_GRADE_MAP["masterwork"] == WeaponGrade.awakened

    def test_phase1_caps_masterwork_at_resonant(self):
        grade = get_max_craft_grade("masterwork", phase=1)
        assert grade == WeaponGrade.resonant

    def test_phase2_unlocks_masterwork_awakened(self):
        grade = get_max_craft_grade("masterwork", phase=2)
        assert grade == WeaponGrade.awakened

    def test_phase2_rare_still_resonant(self):
        grade = get_max_craft_grade("rare", phase=2)
        assert grade == WeaponGrade.resonant

    def test_create_crafted_weapon_phase2_masterwork(self):
        weapon, ctx = create_crafted_weapon(
            weapon_type="sword",
            principle="order",
            material_tier="masterwork",
            phase=2,
        )
        assert weapon.grade == WeaponGrade.awakened
        assert ctx["weapon_grade"] == "awakened"

    def test_create_crafted_weapon_phase1_masterwork_capped(self):
        weapon, ctx = create_crafted_weapon(
            weapon_type="sword",
            principle="order",
            material_tier="masterwork",
            phase=1,
        )
        assert weapon.grade == WeaponGrade.resonant

    def test_create_crafted_weapon_default_phase(self):
        """Default phase should be 1 for backward compat."""
        weapon, _ = create_crafted_weapon(
            weapon_type="spear",
            principle="energy",
            material_tier="masterwork",
        )
        assert weapon.grade == WeaponGrade.resonant


# ═══════════════════════════════════════════════
# Dormant Recovery Beat Tests
# ═══════════════════════════════════════════════

class TestDormantRecoveryBeat:
    def test_injects_beat(self):
        from app.models.pipeline import Beat
        beats = [
            Beat(description="Opening", tension=3, purpose="setup"),
            Beat(description="Ending", tension=5, purpose="resolution"),
        ]
        _inject_dormant_recovery_beat(beats, None)
        assert len(beats) == 3
        assert "DORMANT RECOVERY" in beats[1].description

    def test_beat_mood_melancholy(self):
        from app.models.pipeline import Beat
        beats = [Beat(description="Ending", tension=5, purpose="resolution")]
        _inject_dormant_recovery_beat(beats, None)
        recovery = [b for b in beats if "DORMANT" in b.description][0]
        assert recovery.mood == "melancholy"
        assert recovery.tension == 7

    def test_uses_weapon_name(self):
        from app.models.pipeline import Beat
        player = {"equipped_weapons": {"primary": {"name": "Vô Hồi Đao"}}}
        beats = [Beat(description="End", tension=3, purpose="resolution")]
        _inject_dormant_recovery_beat(beats, player)
        assert "Vô Hồi Đao" in beats[0].description


# ═══════════════════════════════════════════════
# Awakening Beat Tests
# ═══════════════════════════════════════════════

class TestAwakeningBeat:
    def test_injects_beat(self):
        from app.models.pipeline import Beat
        beats = [
            Beat(description="Opening", tension=3, purpose="setup"),
            Beat(description="Ending", tension=5, purpose="resolution"),
        ]
        _inject_awakening_beat(beats, None)
        assert len(beats) == 3
        assert "AWAKENING MOMENT" in beats[1].description

    def test_beat_is_climax(self):
        from app.models.pipeline import Beat
        beats = [Beat(description="Ending", tension=5, purpose="resolution")]
        _inject_awakening_beat(beats, None)
        awakening = [b for b in beats if "AWAKENING" in b.description][0]
        assert awakening.purpose == "climax"
        assert awakening.tension == 9
        assert awakening.mood == "wonder"

    def test_uses_weapon_name(self):
        from app.models.pipeline import Beat
        player = {"equipped_weapons": {"primary": {"name": "Thần Vệ Thuẫn"}}}
        beats = [Beat(description="End", tension=3, purpose="resolution")]
        _inject_awakening_beat(beats, player)
        assert "Thần Vệ Thuẫn" in beats[0].description


# ═══════════════════════════════════════════════
# Pipeline Flag Tests
# ═══════════════════════════════════════════════

class TestPipelineFlags:
    def test_weapon_evolution_pending_default(self):
        ns = NarrativeState()
        assert ns.weapon_evolution_pending == ""
