"""Phase 4 tests — Aspect Forge, Ultimate Synthesis, & Combat Integration.

Tests V2 combat bonus, sub-skill evaluation, unique clause check,
unique_skill_context for CombatBrief, Aspect prompts/application,
Ultimate prompts/application, and full regression.
"""

import pytest

from app.engine.unique_skill_combat import (
    V2_BONUS_CAP,
    UNIQUE_EXISTS_BONUS,
    BLOOM_BONUS,
    SCAR_DEFENSIVE_BONUS,
    ASPECT_BONUS,
    ULTIMATE_BONUS,
    SUB_SKILL_CAP,
    UNIQUE_CLAUSE_BONUS,
    unique_skill_combat_bonus_v2,
    evaluate_sub_skills,
    check_unique_clause_applicable,
    build_unique_skill_context,
)
from app.engine.unique_skill_growth import (
    build_aspect_prompt,
    apply_aspect,
    build_ultimate_prompt,
    apply_ultimate,
)
from app.models.player import PlayerState, SubSkill, UniqueSkill, PlayerProgression
from app.models.unique_skill_growth import (
    GrowthType,
    ScarType,
    UniqueSkillGrowthState,
    UltimateSkillForm,
)


def _make_player(**overrides) -> PlayerState:
    """Create test player with V2 skill and growth state."""
    defaults = {
        "name": "TestPlayer",
        "identity_coherence": 80.0,
        "instability": 10.0,
        "stability": 70.0,
        "hp": 100.0,
        "hp_max": 100.0,
        "total_chapters": 10,
        "unique_skill": UniqueSkill(
            name="Thệ Ước Thép",
            category="manifestation",
            domain_category="manifestation",
            mechanic="Cứng hóa phần cơ thể đang bị va chạm",
            weakness="Mất xúc giác 30 giây",
            weakness_type="sensory_tax",
            domain_passive_name="Thân Thép",
            domain_passive_mechanic="Immune Normal defensive",
            unique_clause="Stability < 30% → skill mạnh hơn",
            sub_skills=[
                SubSkill(name="Thân Thép", type="passive", unlocked_at="seed"),
            ],
        ),
        "unique_skill_growth": UniqueSkillGrowthState(
            skill_id="Thệ Ước Thép",
            original_skill_name="Thệ Ước Thép",
            current_skill_name="Thệ Ước Thép",
        ),
    }
    defaults.update(overrides)
    return PlayerState(**defaults)


# ══════════════════════════════════════════════
# V2 COMBAT BONUS
# ══════════════════════════════════════════════

class TestUniqueSkillCombatBonusV2:
    """V2 combat bonus calculation tests."""

    def test_base_bonus_exists(self):
        player = _make_player()
        bonus = unique_skill_combat_bonus_v2(player)
        assert bonus == UNIQUE_EXISTS_BONUS  # 0.01

    def test_no_skill_no_bonus(self):
        player = _make_player(unique_skill=None)
        assert unique_skill_combat_bonus_v2(player) == 0.0

    def test_domain_matchup_bonus(self):
        player = _make_player()
        enemy_skills = [{"category": "manifestation", "tier": 2}]
        bonus = unique_skill_combat_bonus_v2(player, enemy_skills)
        assert bonus == UNIQUE_EXISTS_BONUS + 0.03  # 0.04

    def test_bloom_bonus(self):
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        bonus = unique_skill_combat_bonus_v2(player)
        assert bonus == UNIQUE_EXISTS_BONUS + BLOOM_BONUS  # 0.02

    def test_scar_defensive_bonus(self):
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        player.unique_skill_growth.scar_adapted = True
        player.unique_skill_growth.scar_type = ScarType.DEFENSIVE
        bonus = unique_skill_combat_bonus_v2(player)
        assert bonus == UNIQUE_EXISTS_BONUS + BLOOM_BONUS + SCAR_DEFENSIVE_BONUS  # 0.03

    def test_scar_counter_no_extra(self):
        """Non-defensive scar type doesn't get extra bonus."""
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        player.unique_skill_growth.scar_adapted = True
        player.unique_skill_growth.scar_type = ScarType.COUNTER
        bonus = unique_skill_combat_bonus_v2(player)
        assert bonus == UNIQUE_EXISTS_BONUS + BLOOM_BONUS  # No scar bonus

    def test_aspect_bonus(self):
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        player.unique_skill_growth.aspect_forged = True
        bonus = unique_skill_combat_bonus_v2(player)
        assert bonus == UNIQUE_EXISTS_BONUS + BLOOM_BONUS + ASPECT_BONUS  # 0.04

    def test_ultimate_automax(self):
        player = _make_player()
        player.unique_skill_growth.ultimate_forged = True
        bonus = unique_skill_combat_bonus_v2(player)
        assert bonus == ULTIMATE_BONUS  # 0.08

    def test_cap_at_008(self):
        """Even with all bonuses + domain, cap at 0.08."""
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        player.unique_skill_growth.scar_adapted = True
        player.unique_skill_growth.scar_type = ScarType.DEFENSIVE
        player.unique_skill_growth.aspect_forged = True
        enemy_skills = [{"category": "manifestation", "tier": 2}]
        bonus = unique_skill_combat_bonus_v2(player, enemy_skills)
        assert bonus <= V2_BONUS_CAP

    def test_no_growth_state(self):
        player = _make_player(unique_skill_growth=None)
        bonus = unique_skill_combat_bonus_v2(player)
        assert bonus == UNIQUE_EXISTS_BONUS


# ══════════════════════════════════════════════
# SUB-SKILL EVALUATION
# ══════════════════════════════════════════════

class TestEvaluateSubSkills:
    """Sub-skill evaluation bonus tests."""

    def test_passive_always_active(self):
        player = _make_player()
        bonus = evaluate_sub_skills(player, is_combat=False)
        assert bonus == 0.01  # 1 passive sub-skill

    def test_active_in_combat(self):
        player = _make_player()
        player.unique_skill.sub_skills.append(
            SubSkill(name="Strike", type="active", unlocked_at="bloom")
        )
        bonus = evaluate_sub_skills(player, is_combat=True)
        assert bonus == 0.02  # passive + active

    def test_reactive_in_combat(self):
        player = _make_player()
        player.unique_skill.sub_skills.append(
            SubSkill(name="Counter", type="reactive", unlocked_at="bloom")
        )
        bonus = evaluate_sub_skills(player, is_combat=True)
        assert bonus == 0.02

    def test_active_not_in_combat(self):
        """Active sub-skills don't count outside combat."""
        player = _make_player()
        player.unique_skill.sub_skills.append(
            SubSkill(name="Strike", type="active", unlocked_at="bloom")
        )
        bonus = evaluate_sub_skills(player, is_combat=False)
        assert bonus == 0.01  # Only passive counts

    def test_cap_at_003(self):
        player = _make_player()
        for i in range(5):
            player.unique_skill.sub_skills.append(
                SubSkill(name=f"SS{i}", type="passive", unlocked_at="seed")
            )
        bonus = evaluate_sub_skills(player, is_combat=True)
        assert bonus == SUB_SKILL_CAP  # 0.03

    def test_no_skill(self):
        player = _make_player(unique_skill=None)
        assert evaluate_sub_skills(player) == 0.0


# ══════════════════════════════════════════════
# UNIQUE CLAUSE CHECK
# ══════════════════════════════════════════════

class TestCheckUniqueClause:
    """Unique clause applicability tests."""

    def test_stability_low_clause_active(self):
        player = _make_player(stability=20.0)
        assert check_unique_clause_applicable(player) is True

    def test_stability_low_clause_inactive(self):
        player = _make_player(stability=50.0)
        assert check_unique_clause_applicable(player) is False

    def test_no_clause(self):
        player = _make_player()
        player.unique_skill.unique_clause = ""
        assert check_unique_clause_applicable(player) is False

    def test_hp_low_clause(self):
        player = _make_player()
        player.unique_skill.unique_clause = "HP < 30% → activate"
        player.hp = 20.0
        assert check_unique_clause_applicable(player) is True

    def test_defeat_clause_inactive(self):
        """Defeat clause not active when no defeats tracked."""
        player = _make_player()
        player.unique_skill.unique_clause = "Sau mỗi thất bại → mạnh hơn"
        # defeat_count doesn't exist on PlayerState, so getattr returns 0
        assert check_unique_clause_applicable(player) is False

    def test_combat_clause(self):
        player = _make_player()
        player.unique_skill.unique_clause = "Chỉ trong combat → bonus"
        assert check_unique_clause_applicable(player, is_combat=True) is True

    def test_no_skill(self):
        player = _make_player(unique_skill=None)
        assert check_unique_clause_applicable(player) is False


# ══════════════════════════════════════════════
# COMBAT BRIEF — UNIQUE SKILL CONTEXT
# ══════════════════════════════════════════════

class TestBuildUniqueSkillContext:
    """CombatBrief unique_skill_context tests."""

    def test_basic_context(self):
        player = _make_player()
        ctx = build_unique_skill_context(player, is_combat=True)
        assert ctx["name"] == "Thệ Ước Thép"
        assert ctx["stage"] == "seed"
        assert ctx["category"] == "manifestation"
        assert ctx["domain"] == "Thân Thép"
        assert ctx["weakness_type"] == "sensory_tax"
        assert ctx["unique_clause"] == "Stability < 30% → skill mạnh hơn"
        assert ctx["can_use_ultimate_ability"] is False

    def test_context_with_bonuses(self):
        player = _make_player(stability=20.0)  # Triggers clause
        ctx = build_unique_skill_context(player, is_combat=True)
        assert ctx["unique_clause_active"] is True
        assert ctx["clause_bonus"] == UNIQUE_CLAUSE_BONUS

    def test_context_sub_skills(self):
        player = _make_player()
        ctx = build_unique_skill_context(player, is_combat=True)
        assert len(ctx["active_sub_skills"]) == 1
        assert ctx["active_sub_skills"][0]["name"] == "Thân Thép"

    def test_no_unique_skill(self):
        player = _make_player(unique_skill=None)
        ctx = build_unique_skill_context(player)
        assert ctx == {}

    def test_total_bonus_sum(self):
        player = _make_player()
        ctx = build_unique_skill_context(player, is_combat=True)
        expected = ctx["combat_bonus"] + ctx["sub_skill_bonus"] + ctx["clause_bonus"]
        assert abs(ctx["total_bonus"] - expected) < 0.001


# ══════════════════════════════════════════════
# ASPECT FORGE
# ══════════════════════════════════════════════

class TestAspectForge:
    """Aspect Forge prompt and application tests."""

    def test_aspect_prompt_structure(self):
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        player.unique_skill_growth.bloom_path = "echo"
        prompt = build_aspect_prompt(player.unique_skill, player.unique_skill_growth)
        assert "ASPECT FORGE" in prompt
        assert "aspect_a" in prompt
        assert "aspect_b" in prompt
        assert "SS2" in prompt
        assert "SS3" in prompt
        assert "Thệ Ước Thép" in prompt

    def test_apply_aspect(self):
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        chosen = {
            "name": "Nộ Cương",
            "enhanced_core": "Cứng hóa TOÀN THÂN khi stability < 30%",
            "ss2": {
                "name": "Nộ Cương",
                "type": "active",
                "mechanic": "Full-body harden 3s",
                "cost": "25 stability",
            },
            "ss3": {
                "name": "Ký Ức Thép",
                "type": "passive",
                "mechanic": "Same attack 2x+ faster",
            },
            "weakness_transform": "Xúc giác delay 5 giây",
        }
        result = apply_aspect(player, chosen, "b")

        assert player.unique_skill_growth.aspect_forged is True
        assert player.unique_skill_growth.mutation_locked is True
        assert player.unique_skill.current_stage == "aspect"
        assert len(player.unique_skill.sub_skills) == 3  # SS0 + SS2 + SS3
        assert player.unique_skill.weakness == "Xúc giác delay 5 giây"
        assert result["aspect_name"] == "Nộ Cương"

    def test_apply_aspect_no_growth(self):
        player = _make_player(unique_skill_growth=None)
        result = apply_aspect(player, {}, "a")
        assert "error" in result


# ══════════════════════════════════════════════
# ULTIMATE SYNTHESIS
# ══════════════════════════════════════════════

class TestUltimateSynthesis:
    """Ultimate Synthesis prompt and application tests."""

    def test_ultimate_prompt_structure(self):
        player = _make_player()
        player.unique_skill_growth.aspect_forged = True
        player.unique_skill_growth.aspect_chosen = "Nộ Cương"
        prompt = build_ultimate_prompt(
            player.unique_skill,
            player.unique_skill_growth,
            absorbed_skill_name="Matter Shield",
            absorbed_skill_mechanic="Tạo khiên phòng thủ",
        )
        assert "ULTIMATE FORGE" in prompt
        assert "ultimate_name" in prompt
        assert "Danh Xưng" in prompt
        assert "Matter Shield" in prompt

    def test_apply_ultimate(self):
        player = _make_player()
        player.unique_skill_growth.aspect_forged = True
        player.equipped_skills = [
            {"name": "Matter Shield", "tier": 2},
            {"name": "Fire Bolt", "tier": 1},
        ]

        ultimate_data = {
            "ultimate_name": "Thiết Thệ Bất Hoại — Chúa Tể Kim Cương",
            "title": "Chúa Tể Kim Cương",
            "core_transcend": "Cứng hóa BẤT KỲ VẬT THỂ",
            "ultimate_ability": {
                "name": "Thiết Thệ Tuyệt Đối",
                "mechanic": "Reality cứng hóa bán kính 10m",
                "cost": "80% stability",
            },
            "merged_sub_skills": [
                {"name": "Thiên Kim Thể", "type": "passive", "mechanic": "Full body harden"},
                {"name": "Kim Cương Phản Xạ", "type": "reactive", "mechanic": "Auto counter"},
            ],
            "weakness_final": "Sau UA → toàn thân mềm 1 scene → 2× damage",
        }

        result = apply_ultimate(player, ultimate_data, absorbed_skill_id="Matter Shield")

        # Growth state
        assert player.unique_skill_growth.ultimate_forged is True
        assert player.unique_skill_growth.naming_event_completed is True
        assert player.unique_skill_growth.current_stage == "ultimate"

        # Skill updated
        assert player.unique_skill.name == "Thiết Thệ Bất Hoại — Chúa Tể Kim Cương"
        assert player.unique_skill.current_stage == "ultimate"
        assert player.unique_skill.mechanic == "Cứng hóa BẤT KỲ VẬT THỂ"

        # Sub-skills replaced with merged
        assert len(player.unique_skill.sub_skills) == 2
        assert player.unique_skill.sub_skills[0].unlocked_at == "ultimate"

        # Normal skill absorbed
        assert len(player.equipped_skills) == 1
        assert player.equipped_skills[0]["name"] == "Fire Bolt"

        # Ultimate form
        assert player.unique_skill_growth.ultimate_form is not None
        assert player.unique_skill_growth.ultimate_form.title == "Chúa Tể Kim Cương"

        # Result
        assert result["title"] == "Chúa Tể Kim Cương"
        assert result["absorbed"] == "Matter Shield"

    def test_apply_ultimate_no_growth(self):
        player = _make_player(unique_skill_growth=None)
        result = apply_ultimate(player, {})
        assert "error" in result


# ══════════════════════════════════════════════
# WEAKNESS EVOLUTION
# ══════════════════════════════════════════════

class TestWeaknessEvolution:
    """Weakness never deleted, only transformed at each stage."""

    def test_weakness_persists_through_stages(self):
        player = _make_player()
        original_type = player.unique_skill.weakness_type

        # Bloom — loosened
        from app.engine.unique_skill_growth import apply_bloom
        apply_bloom(player, "echo", weakness_update="Mất xúc giác 15 giây")
        assert player.unique_skill.weakness != ""
        assert player.unique_skill.weakness_type == original_type

        # Aspect — transformed
        apply_aspect(player, {
            "name": "TestAspect",
            "weakness_transform": "Xúc giác delay 5 giây",
        }, "a")
        assert player.unique_skill.weakness != ""

        # Ultimate — still present (bypassed 1x by UA)
        apply_ultimate(player, {
            "weakness_final": "Sau UA → toàn thân mềm 1 scene",
        })
        assert player.unique_skill.weakness != ""


# ══════════════════════════════════════════════
# BONUS CAP VERIFICATION
# ══════════════════════════════════════════════

class TestBonusCap:
    """V2 bonus cap at 8% verification."""

    def test_max_possible_bonus(self):
        """Max without ultimate: 1% + 3% + 1% + 1% + 2% = 8%."""
        player = _make_player()
        player.unique_skill_growth.bloom_completed = True
        player.unique_skill_growth.scar_adapted = True
        player.unique_skill_growth.scar_type = ScarType.DEFENSIVE
        player.unique_skill_growth.aspect_forged = True
        enemy_skills = [{"category": "manifestation", "tier": 2}]
        bonus = unique_skill_combat_bonus_v2(player, enemy_skills)
        assert bonus == V2_BONUS_CAP

    def test_ultimate_exactly_008(self):
        player = _make_player()
        player.unique_skill_growth.ultimate_forged = True
        bonus = unique_skill_combat_bonus_v2(player)
        assert bonus == 0.08
