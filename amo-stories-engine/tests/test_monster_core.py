"""Tests for Phase 1B — Monster Core Drop, Imbue, and Crafting.

Covers: Drop tables, Soul Crystal chain, imbue validation/effects, crafting.
Ref: WEAPON_SYSTEM_SPEC v1.0 §6.1, §6.3
"""

from app.models.weapon import (
    CraftingMaterial,
    MonsterCore,
    MonsterCoreTier,
    SoulCrystalTier,
    Weapon,
    WeaponGrade,
    WeaponLore,
    WeaponOrigin,
)
from app.engine.monster_core import (
    DROP_RATE_CORE,
    DROP_RATE_HEART,
    DROP_RATE_SHARD,
    apply_imbue,
    build_soul_crystal_imbue_context,
    can_imbue,
    create_crafted_weapon,
    get_max_craft_grade,
    roll_core_drop,
    roll_soul_crystal,
)


# ═══════════════════════════════════════════════
# Helper factories
# ═══════════════════════════════════════════════

def _weapon(
    grade: str = "resonant",
    principle: str = "entropy",
    origin: WeaponOrigin = WeaponOrigin.crafting,
) -> Weapon:
    return Weapon(
        id="test_w",
        name="Test Weapon",
        weapon_type="sword",
        grade=WeaponGrade(grade),
        primary_principle=principle,
        lore=WeaponLore(origin=origin, history_summary="Test"),
    )


def _core(
    tier: str = "shard",
    principle: str = "order",
    monster: str = "Test Monster",
) -> MonsterCore:
    return MonsterCore(
        tier=MonsterCoreTier(tier),
        principle=principle,
        source_monster=monster,
        source_chapter=5,
    )


# ═══════════════════════════════════════════════
# Drop Tests
# ═══════════════════════════════════════════════

class TestCoreDrop:
    def test_common_monster_shard_drop(self):
        """Common monsters drop Shards at 30%."""
        core = roll_core_drop("common", "entropy", "Goblin", crng_roll=0.20)
        assert core is not None
        assert core.tier == MonsterCoreTier.shard
        assert core.principle == "entropy"

    def test_common_monster_no_drop(self):
        """Common monsters fail drop at >30%."""
        core = roll_core_drop("common", "entropy", "Goblin", crng_roll=0.50)
        assert core is None

    def test_elite_monster_core_drop(self):
        """Elite monsters drop Cores at 10%."""
        core = roll_core_drop("elite", "matter", "Dragon Knight", crng_roll=0.05)
        assert core is not None
        assert core.tier == MonsterCoreTier.core

    def test_elite_monster_no_drop(self):
        core = roll_core_drop("elite", "matter", "Dragon Knight", crng_roll=0.15)
        assert core is None

    def test_mini_boss_heart_drop(self):
        """Mini-bosses drop Hearts at 3%."""
        core = roll_core_drop("mini_boss", "void", "Shadow Serpent", crng_roll=0.02)
        assert core is not None
        assert core.tier == MonsterCoreTier.heart

    def test_mini_boss_no_drop(self):
        core = roll_core_drop("mini_boss", "void", "Shadow Serpent", crng_roll=0.10)
        assert core is None

    def test_unknown_monster_tier(self):
        core = roll_core_drop("unknown", "order", "???", crng_roll=0.01)
        assert core is None

    def test_drop_rates_constants(self):
        """Drop rates must match spec §6.1."""
        assert DROP_RATE_SHARD == 0.30
        assert DROP_RATE_CORE == 0.10
        assert DROP_RATE_HEART == 0.03


# ═══════════════════════════════════════════════
# Soul Crystal Tests
# ═══════════════════════════════════════════════

class TestSoulCrystal:
    def test_pale_crystal_base(self):
        """Base tier: always Pale when weapon equipped."""
        tier = roll_soul_crystal(crng_favorable=False, coherence=50.0)
        assert tier == SoulCrystalTier.pale

    def test_true_crystal_crng_favorable(self):
        """CRNG favorable → True Crystal."""
        tier = roll_soul_crystal(crng_favorable=True, coherence=50.0)
        assert tier == SoulCrystalTier.true_crystal

    def test_sovereign_crystal_crng_plus_coherence(self):
        """CRNG favorable + coherence ≥ 75 → Sovereign."""
        tier = roll_soul_crystal(crng_favorable=True, coherence=75.0)
        assert tier == SoulCrystalTier.sovereign

    def test_no_crystal_without_weapon(self):
        """No weapon equipped → no crystal."""
        tier = roll_soul_crystal(crng_favorable=True, coherence=90.0, weapon_equipped=False)
        assert tier is None

    def test_high_coherence_no_crng(self):
        """High coherence but no CRNG → still Pale (CRNG required for upgrade)."""
        tier = roll_soul_crystal(crng_favorable=False, coherence=90.0)
        assert tier == SoulCrystalTier.pale


# ═══════════════════════════════════════════════
# Imbue Validation Tests
# ═══════════════════════════════════════════════

class TestImbueValidation:
    def test_can_imbue_resonant_weapon(self):
        w = _weapon(grade="resonant")
        valid, _ = can_imbue(w, _core())
        assert valid is True

    def test_can_imbue_mundane_weapon(self):
        w = _weapon(grade="mundane", principle="")
        valid, _ = can_imbue(w, _core())
        assert valid is True

    def test_cannot_imbue_soul_linked(self):
        """Soul-Linked+ weapons reject imbue."""
        w = _weapon(grade="soul_linked")
        valid, reason = can_imbue(w, _core())
        assert valid is False
        assert "Mundane hoặc Resonant" in reason

    def test_cannot_imbue_inheritance(self):
        """Inheritance weapons refuse foreign essence."""
        w = _weapon(origin=WeaponOrigin.inheritance)
        valid, reason = can_imbue(w, _core())
        assert valid is False
        assert "thừa kế" in reason

    def test_cannot_double_imbue_heart(self):
        """Cannot imbue Heart on top of existing Heart."""
        w = _weapon()
        w.imbued_core = _core(tier="heart", principle="void")
        valid, reason = can_imbue(w, _core(tier="heart", principle="energy"))
        assert valid is False

    def test_shard_on_existing_heart_ok(self):
        """Shards can still accumulate even with Heart imbued."""
        w = _weapon()
        w.imbued_core = _core(tier="heart", principle="void")
        valid, _ = can_imbue(w, _core(tier="shard"))
        assert valid is True


# ═══════════════════════════════════════════════
# Imbue Effect Tests
# ═══════════════════════════════════════════════

class TestImbueEffects:
    def test_shard_increments_count(self):
        w = _weapon()
        result = apply_imbue(w, _core(tier="shard"))
        assert result["success"] is True
        assert w.shard_count == 1
        # Second shard
        apply_imbue(w, _core(tier="shard"))
        assert w.shard_count == 2

    def test_shard_on_mundane_upgrades_to_resonant(self):
        """Shard on Mundane weapon with no principle → gains principle + upgrades."""
        w = _weapon(grade="mundane", principle="")
        result = apply_imbue(w, _core(tier="shard", principle="order"))
        assert result["success"] is True
        assert w.primary_principle == "order"
        assert w.grade == WeaponGrade.resonant

    def test_core_sets_imbued_and_lore(self):
        w = _weapon()
        core = _core(tier="core", principle="matter", monster="Iron Golem")
        result = apply_imbue(w, core)
        assert result["success"] is True
        assert w.imbued_core == core
        assert result["lore_fragment"] != ""
        assert "Iron Golem" in result["lore_fragment"]

    def test_heart_unlocks_secondary_principle(self):
        w = _weapon(principle="entropy")
        assert w.secondary_principle == ""
        result = apply_imbue(w, _core(tier="heart", principle="void"))
        assert result["success"] is True
        assert w.secondary_principle == "void"

    def test_imbue_rejected_returns_failure(self):
        w = _weapon(grade="soul_linked")
        result = apply_imbue(w, _core())
        assert result["success"] is False

    def test_heart_clears_shard_count(self):
        """m3 fix: Heart imbue should reset shard_count to 0."""
        w = _weapon()
        # Accumulate some shards first
        apply_imbue(w, _core(tier="shard", principle="order"))
        apply_imbue(w, _core(tier="shard", principle="order"))
        assert w.shard_count == 2
        # Heart should clear shards
        apply_imbue(w, _core(tier="heart", principle="void"))
        assert w.shard_count == 0
        assert w.secondary_principle == "void"


# ═══════════════════════════════════════════════
# Crafting Tests
# ═══════════════════════════════════════════════

class TestCrafting:
    def test_common_material_mundane_grade(self):
        assert get_max_craft_grade("common") == WeaponGrade.mundane

    def test_uncommon_material_resonant_grade(self):
        assert get_max_craft_grade("uncommon") == WeaponGrade.resonant

    def test_rare_material_resonant_in_phase1(self):
        """Phase 1: rare caps at Resonant."""
        assert get_max_craft_grade("rare", phase=1) == WeaponGrade.resonant

    def test_masterwork_capped_in_phase1(self):
        """Phase 1: masterwork also caps at Resonant."""
        assert get_max_craft_grade("masterwork", phase=1) == WeaponGrade.resonant

    def test_masterwork_awakened_in_phase2(self):
        """Phase 2: masterwork reaches Awakened."""
        assert get_max_craft_grade("masterwork", phase=2) == WeaponGrade.awakened

    def test_create_crafted_weapon(self):
        weapon, ctx = create_crafted_weapon(
            weapon_type="sword",
            principle="order",
            material_tier="uncommon",
            player_archetype="vanguard",
            craftsman_name="Torvak",
            crafting_intent="Kiếm đại diện cho kỷ luật",
        )
        assert weapon.grade == WeaponGrade.resonant
        assert weapon.primary_principle == "order"
        assert weapon.lore.origin == WeaponOrigin.crafting
        assert weapon.id.startswith("crafted_sword_order_")
        assert ctx["craftsman_name"] == "Torvak"
        assert ctx["crafting_intent"] == "Kiếm đại diện cho kỷ luật"

    def test_create_mundane_weapon_no_principle(self):
        """Common material crafts Mundane → no principle set."""
        weapon, _ = create_crafted_weapon(
            weapon_type="axe",
            principle="matter",
            material_tier="common",
        )
        assert weapon.grade == WeaponGrade.mundane
        assert weapon.primary_principle == ""  # Mundane has no principle

    def test_crafted_weapon_unique_ids(self):
        """Two crafted weapons with same params should get different IDs."""
        w1, _ = create_crafted_weapon("sword", "order", "uncommon")
        w2, _ = create_crafted_weapon("sword", "order", "uncommon")
        assert w1.id != w2.id


# ═══════════════════════════════════════════════
# Soul Crystal Context Tests
# ═══════════════════════════════════════════════

class TestSoulCrystalContext:
    def test_build_context(self):
        w = _weapon()
        ctx = build_soul_crystal_imbue_context(
            w, SoulCrystalTier.true_crystal,
            monster_name="Shadow Serpent", monster_principle="void",
        )
        assert ctx["crystal_tier"] == "true_crystal"
        assert ctx["weapon_name"] == "Test Weapon"
        assert ctx["monster_source"] == "Shadow Serpent"
        assert ctx["lore_depth"] == "1 đoạn văn đầy đủ"

    def test_sovereign_context_depth(self):
        w = _weapon()
        ctx = build_soul_crystal_imbue_context(
            w, SoulCrystalTier.sovereign,
            monster_name="Elder Dragon",
        )
        assert ctx["lore_depth"] == "Full lore chapter reveal"
