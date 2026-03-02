"""Unique Skill Growth Engine — Seed → Bloom → Aspect → Ultimate.

Tracks per-scene growth metrics, detects bloom triggers,
and generates AI prompts for growth events.

Phase 3:
- update_growth_per_scene(): Track coherence + trauma per scene
- check_bloom_trigger(): Detect Echo/Scar bloom readiness
- build_bloom_prompt(): AI prompt for SS1 generation + weakness loosening
- apply_bloom(): Apply bloom results to player state

Phase 4:
- check_aspect_trigger() / check_ultimate_trigger(): Gate checks
- build_aspect_prompt() / apply_aspect(): Aspect branching
- build_ultimate_prompt() / apply_ultimate(): Final transcendence
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.models.unique_skill_growth import (
    GrowthType,
    ScarType,
    TraumaEvent,
    UniqueSkillGrowthState,
)
from app.engine.suppression_check import get_stage_resistance

if TYPE_CHECKING:
    from app.models.player import PlayerState, SubSkill, UniqueSkill

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════

ECHO_STREAK_THRESHOLD = 10     # Scenes with coherence ≥ 70
SCAR_TRAUMA_THRESHOLD = 3      # Survive 3 traumas
COHERENCE_THRESHOLD = 70.0     # Min coherence for echo bloom
ECHO_RESET_THRESHOLD = 50.0    # Coherence below this = reset streak

ASPECT_RANK_REQ = 4            # Min rank for Aspect
ASPECT_USE_COUNT = 20          # Min skill usage for Aspect

ULTIMATE_RANK_REQ = 5          # Min rank for Ultimate


# ══════════════════════════════════════════════
# PER-SCENE GROWTH UPDATE
# ══════════════════════════════════════════════

def update_growth_per_scene(
    player: PlayerState,
    scene_type: str = "",
    is_combat: bool = False,
    combat_outcome: str = "",
    defeat_severity: str = "",
    skill_was_used: bool = False,
) -> dict:
    """Track growth metrics after each scene.

    Called after every scene in the orchestrator.
    Updates coherence streak and trauma log.

    Returns dict of growth events for logging/SSE.
    """
    growth = player.unique_skill_growth
    if not growth:
        return {}

    events: dict = {}

    # ── Echo tracking: coherence streak ──
    if player.identity_coherence >= COHERENCE_THRESHOLD:
        growth.echo_coherence_streak += 1
        events["echo_streak"] = growth.echo_coherence_streak
    elif player.identity_coherence < ECHO_RESET_THRESHOLD:
        # Streak broken — Echo Bloom can be lost
        if growth.echo_coherence_streak > 0 and growth.echo_can_lose:
            prev_streak = growth.echo_coherence_streak
            growth.echo_coherence_streak = max(0, growth.echo_coherence_streak - 2)
            events["echo_streak_broken"] = {
                "from": prev_streak,
                "to": growth.echo_coherence_streak,
            }
            logger.info(
                f"Echo streak broken: {prev_streak} → {growth.echo_coherence_streak}"
            )

    # ── Echo Bloom Revert: sustained low coherence ──
    # If bloom was via echo AND coherence < 50 sustained → revert bloom
    ECHO_REVERT_COHERENCE = 50.0
    ECHO_REVERT_STREAK = 5  # Consecutive low-coherence scenes to trigger revert
    if (growth.bloom_completed
            and growth.bloom_path == "echo"
            and not growth.aspect_forged  # Can't revert after Aspect
            and growth.echo_can_lose):
        if player.identity_coherence < ECHO_REVERT_COHERENCE:
            # Track low coherence streak
            low_streak = getattr(growth, "_low_coherence_streak", 0) + 1
            growth._low_coherence_streak = low_streak  # type: ignore[attr-defined]
            if low_streak >= ECHO_REVERT_STREAK:
                # REVERT echo bloom
                growth.bloom_completed = False
                growth.bloom_path = ""
                growth.current_stage = "seed"
                growth.active_growth = GrowthType.BASE
                growth.echo_coherence_streak = 0
                growth._low_coherence_streak = 0  # type: ignore[attr-defined]
                if player.unique_skill:
                    player.unique_skill.current_stage = "seed"
                    player.unique_skill.suppression_resistance = get_stage_resistance("seed")
                events["echo_bloom_reverted"] = True
                logger.warning(
                    f"Echo Bloom REVERTED! Coherence < {ECHO_REVERT_COHERENCE} for "
                    f"{ECHO_REVERT_STREAK} consecutive scenes."
                )
        else:
            growth._low_coherence_streak = 0  # type: ignore[attr-defined]

    # ── Scar tracking: trauma events ──
    if is_combat and combat_outcome == "enemy_wins":
        # Player was defeated — track trauma
        trauma = TraumaEvent(
            chapter=player.total_chapters,
            description=f"Defeated in {scene_type} combat",
            severity=defeat_severity or "defeat",
        )
        growth.trauma_log.append(trauma)
        growth.scar_trauma_count = len(growth.trauma_log)
        events["trauma_logged"] = {
            "count": growth.scar_trauma_count,
            "severity": trauma.severity,
        }
        logger.info(
            f"Trauma #{growth.scar_trauma_count}: {trauma.severity} "
            f"at chapter {trauma.chapter}"
        )

    # Near-death from combat (not full defeat)
    elif is_combat and player.hp <= player.hp_max * 0.15:
        trauma = TraumaEvent(
            chapter=player.total_chapters,
            description="Near-death survival",
            severity="near_death",
        )
        growth.trauma_log.append(trauma)
        growth.scar_trauma_count = len(growth.trauma_log)
        events["trauma_logged"] = {
            "count": growth.scar_trauma_count,
            "severity": "near_death",
        }

    # ── Combat bonus tracking ──
    if skill_was_used and is_combat:
        growth.combat_bonus = min(0.08, growth.combat_bonus + 0.001)

    return events


# ══════════════════════════════════════════════
# BLOOM TRIGGER DETECTION
# ══════════════════════════════════════════════

def check_bloom_trigger(player: PlayerState) -> str | None:
    """Check if player meets bloom requirements.

    Returns:
        'echo' — sustained coherence ≥ 70 for 10 scenes
        'scar' — survived 3+ traumas
        None — not ready
    """
    growth = player.unique_skill_growth
    if not growth:
        return None

    # Already bloomed
    if growth.bloom_completed:
        return None

    # Echo Bloom: consistency path
    if growth.echo_coherence_streak >= ECHO_STREAK_THRESHOLD:
        logger.info(
            f"Echo Bloom triggered! Streak={growth.echo_coherence_streak}"
        )
        return "echo"

    # Scar Bloom: trauma path
    if growth.scar_trauma_count >= SCAR_TRAUMA_THRESHOLD and not growth.scar_adapted:
        logger.info(
            f"Scar Bloom triggered! Traumas={growth.scar_trauma_count}"
        )
        return "scar"

    return None


# ══════════════════════════════════════════════
# BLOOM APPLICATION
# ══════════════════════════════════════════════

def apply_bloom(
    player: PlayerState,
    bloom_path: str,
    ss1_data: dict | None = None,
    weakness_update: str = "",
) -> dict:
    """Apply bloom results to player state.

    Args:
        player: Player with unique_skill_growth
        bloom_path: 'echo' or 'scar'
        ss1_data: Dict with sub-skill 1 info from AI forge
        weakness_update: Updated weakness text (loosened)

    Returns:
        Summary dict for logging
    """
    from app.models.player import SubSkill

    growth = player.unique_skill_growth
    skill = player.unique_skill

    if not growth or not skill:
        return {"error": "No growth state or unique skill"}

    # Mark bloom
    growth.bloom_completed = True
    growth.bloom_path = bloom_path
    growth.current_stage = "bloom"
    skill.current_stage = "bloom"
    skill.suppression_resistance = get_stage_resistance("bloom")  # 65.0

    if bloom_path == "echo":
        growth.active_growth = GrowthType.ECHO
        growth.echo_can_lose = False  # Once bloomed, can't lose
    elif bloom_path == "scar":
        growth.active_growth = GrowthType.SCAR
        growth.scar_adapted = True
        # Determine scar type from trauma patterns
        growth.scar_type = _derive_scar_type(growth)

    # Add SS1 (Sub-skill 1)
    if ss1_data:
        ss1 = SubSkill(
            name=ss1_data.get("name", ""),
            type=ss1_data.get("type", "reactive" if bloom_path == "scar" else "active"),
            mechanic=ss1_data.get("mechanic", ""),
            cost=ss1_data.get("cost", ""),
            trigger=ss1_data.get("trigger", ""),
            unlocked_at="bloom",
        )
        skill.sub_skills.append(ss1)
        growth.sub_skills_unlocked.append(ss1.name)

    # Update weakness (loosened)
    if weakness_update:
        skill.weakness = weakness_update

    # Mutation locks at Aspect, not Bloom
    growth.mutation_count += 1

    logger.info(
        f"Bloom applied: path={bloom_path}, SS1={ss1_data.get('name') if ss1_data else 'none'}"
    )

    return {
        "bloom_path": bloom_path,
        "ss1": ss1_data,
        "weakness_updated": bool(weakness_update),
        "stage": "bloom",
    }


def _derive_scar_type(growth: UniqueSkillGrowthState) -> ScarType:
    """Derive scar type from trauma pattern.

    Mapping (GROWTH_SPEC §5.3):
      ≥2 near_death → DEFENSIVE (almost died → shield instinct)
      ≥2 defeat     → COUNTER   (lost fights → fight-back instinct)
      mixed         → WARNING   (varied trauma → danger sense)
    """
    severities = [t.severity for t in growth.trauma_log]

    near_death_count = severities.count("near_death")
    defeat_count = severities.count("defeat")

    if near_death_count >= 2:
        return ScarType.DEFENSIVE   # Almost died → auto-shield
    elif defeat_count >= 2:
        return ScarType.COUNTER     # Lost fights → counterattack
    else:
        return ScarType.WARNING     # Mixed → danger detection


# ══════════════════════════════════════════════
# AI BLOOM PROMPT
# ══════════════════════════════════════════════

def build_bloom_prompt(
    skill: UniqueSkill,
    bloom_path: str,
    growth: UniqueSkillGrowthState,
    player_coherence: float = 100.0,
) -> str:
    """Build AI prompt for Bloom Forge — generates SS1 + weakness update.

    This is called when check_bloom_trigger() returns non-None.
    AI generates:
    - Enhanced core mechanic description
    - Sub-skill 1 (SS1)
    - Loosened weakness
    """
    scar_context = ""
    if bloom_path == "scar":
        trauma_list = "\n".join(
            f"  - Ch.{t.chapter}: {t.description} ({t.severity})"
            for t in growth.trauma_log[-5:]  # Last 5 traumas
        )
        scar_type = _derive_scar_type(growth)
        scar_context = f"""
Bloom Path: SCAR — Player survived {growth.scar_trauma_count} traumas.
Scar Type: {scar_type.value}
Trauma Log:
{trauma_list}

SS1 PHẢI là REACTIVE — auto-trigger khi gặp nguy hiểm tương tự.
VD: "Phản Xạ Thép" — phản damage khi bị tấn công giống trauma trước.
SS1 PHẢN ÁNH adaptation từ trauma pattern."""

    echo_context = ""
    if bloom_path == "echo":
        echo_context = f"""
Bloom Path: ECHO — Player maintained coherence ≥ 70 for {growth.echo_coherence_streak} scenes.
Player Coherence: {player_coherence:.1f}

SS1 PHẢI là ACTIVE — player chủ động kích hoạt.
VD: "Trực Giác Sắc" — 1 lần/combat, phát hiện weakness.
SS1 PHẢN ÁNH stability và consistency."""

    return f"""BẠN LÀ GROWTH FORGE — hệ thống tiến hóa Unique Skill.

## Skill hiện tại (SEED stage):
- Tên: {skill.name}
- Category: {skill.category}
- Core Mechanic: {skill.mechanic}
- Domain Passive (SS0): {skill.domain_passive_name} — {skill.domain_passive_mechanic}
- Weakness hiện tại: {skill.weakness}
- Weakness Type: {skill.weakness_type}
- Unique Clause: {skill.unique_clause}
{echo_context}{scar_context}

## Nhiệm vụ BLOOM FORGE:

1. **Enhanced Core**: Nâng cấp core mechanic (mạnh hơn một chút, CÙNG concept)
   - VD Seed: "cứng hóa 1 vùng" → Bloom: "cứng hóa nhanh hơn, 2 vùng"
   - KHÔNG thay đổi bản chất — chỉ NÂNG CẤP

2. **SS1 (Sub-skill 1)**: Tạo sub-skill mới
   - Type: {"reactive" if bloom_path == "scar" else "active"}
   - Liên quan trực tiếp đến core mechanic
   - Cost: stability cụ thể hoặc trigger condition
   - Unlocked at: bloom

3. **Weakness Loosened**: Nới lỏng weakness 1 bậc
   - Seed: "mất xúc giác 30 giây" → Bloom: "mất xúc giác 15 giây"
   - KHÔNG xóa weakness — chỉ GIẢM severity
   - Weakness type giữ nguyên: {skill.weakness_type}

Return ONLY JSON (no markdown):
{{
  "enhanced_core": "Core mechanic nâng cấp 2-3 câu",
  "ss1": {{
    "name": "Tên SS1 tiếng Việt",
    "type": "{"reactive" if bloom_path == "scar" else "active"}",
    "mechanic": "Cơ chế SS1 2-3 câu",
    "cost": "Chi phí stability hoặc trigger condition",
    "trigger": "{"Auto-trigger condition" if bloom_path == "scar" else ""}"
  }},
  "weakness_update": "Weakness nới lỏng — giảm severity nhưng giữ type"
}}"""


# ══════════════════════════════════════════════
# ASPECT & ULTIMATE TRIGGERS
# ══════════════════════════════════════════════

def check_aspect_trigger(player: PlayerState) -> bool:
    """Check if player meets Aspect Forge requirements.

    Requires: Rank 4+, Bloom completed, 20+ skill uses.
    """
    growth = player.unique_skill_growth
    if not growth or not growth.bloom_completed:
        return False
    if growth.aspect_forged:
        return False

    rank = getattr(player.progression, "current_rank", 1)
    if rank < ASPECT_RANK_REQ:
        return False

    # Check skill usage count
    skill_name = player.unique_skill.name if player.unique_skill else ""
    uses = player.progression.skill_usage.get(skill_name, 0)
    if uses < ASPECT_USE_COUNT:
        return False

    return True


def check_ultimate_trigger(player: PlayerState) -> bool:
    """Check if player meets Ultimate Synthesis requirements.

    Requires: Rank 5, Aspect forged, mastered Normal Skill.
    """
    growth = player.unique_skill_growth
    if not growth or not growth.aspect_forged:
        return False
    if growth.ultimate_forged:
        return False

    rank = getattr(player.progression, "current_rank", 1)
    if rank < ULTIMATE_RANK_REQ:
        return False

    return True


# ══════════════════════════════════════════════
# ASPECT FORGE — AI PROMPT + APPLICATION
# ══════════════════════════════════════════════

def build_aspect_prompt(
    skill: UniqueSkill,
    growth: UniqueSkillGrowthState,
) -> str:
    """Build AI prompt for Aspect Forge — generates 2 aspect options.

    Each aspect unlocks SS2 (active) + SS3 (passive).
    Player chooses 1 of 2 aspects = permanent branch.

    Aspect Forge Flow (3 scenes injected into narrative):
      Scene 1 — "Skill Run": Skill activates abnormally
      Scene 2 — "The Fork": 2 visions → DECISION POINT (A or B)
      Scene 3 — "Reborn": Skill completes transformation
    """
    ss_list = "\n".join(
        f"  - {ss.name} ({ss.type}, unlocked: {ss.unlocked_at}): {ss.mechanic}"
        for ss in skill.sub_skills if ss.name
    )

    return f"""BẠN LÀ ASPECT FORGE — hệ thống phân nhánh Unique Skill.

## Skill hiện tại (BLOOM stage):
- Tên: {skill.name}
- Category: {skill.category}
- Core Mechanic: {skill.mechanic}
- Bloom Path: {growth.bloom_path}
- Weakness: {skill.weakness} (type: {skill.weakness_type})
- Unique Clause: {skill.unique_clause}
- Sub-skills hiện có:
{ss_list}

## Nhiệm vụ ASPECT FORGE:

Tạo 2 ASPECT OPTIONS (A và B). Player sẽ chọn 1.

Mỗi aspect gồm:
1. Tên Aspect (Vietnamese, powerful)
2. Core mechanic NÂNG CẤP mạnh (theo hướng aspect)
3. SS2 (active): Sub-skill chủ động mới, unlocked_at: aspect
4. SS3 (passive): Sub-skill passive mới, unlocked_at: aspect
5. Weakness TRANSFORM (vẫn tồn tại nhưng thay đổi dạng)

## QUY TẮC:
- 2 aspects PHẢI KHÁC NHAU rõ ràng (VD: offensive vs defensive)
- SS2 PHẢI là ACTIVE, SS3 PHẢI là PASSIVE
- Weakness KHÔNG xóa — chỉ TRANSFORM dạng
- Mutation bị KHÓA sau Aspect (mutation_locked = True)
- Mỗi aspect FIT với core mechanic + bloom path

Return ONLY JSON (no markdown):
{{
  "aspect_a": {{
    "name": "Tên Aspect A",
    "description": "Mô tả 2-3 câu",
    "enhanced_core": "Core upgrade theo hướng A",
    "ss2": {{
      "name": "Tên SS2-A",
      "type": "active",
      "mechanic": "Cơ chế",
      "cost": "Chi phí"
    }},
    "ss3": {{
      "name": "Tên SS3-A",
      "type": "passive",
      "mechanic": "Cơ chế"
    }},
    "weakness_transform": "Weakness dạng mới"
  }},
  "aspect_b": {{
    "name": "Tên Aspect B",
    "description": "Mô tả 2-3 câu",
    "enhanced_core": "Core upgrade theo hướng B",
    "ss2": {{
      "name": "Tên SS2-B",
      "type": "active",
      "mechanic": "Cơ chế",
      "cost": "Chi phí"
    }},
    "ss3": {{
      "name": "Tên SS3-B",
      "type": "passive",
      "mechanic": "Cơ chế"
    }},
    "weakness_transform": "Weakness dạng mới"
  }}
}}"""


def apply_aspect(
    player: PlayerState,
    chosen_aspect: dict,
    aspect_name: str,
) -> dict:
    """Apply chosen aspect to player state.

    Args:
        player: Player with unique_skill + growth
        chosen_aspect: The "aspect_a" or "aspect_b" dict from AI
        aspect_name: "a" or "b"
    """
    from app.models.player import SubSkill
    from app.models.unique_skill_growth import AspectOption

    growth = player.unique_skill_growth
    skill = player.unique_skill

    if not growth or not skill:
        return {"error": "No growth state or unique skill"}

    # Mark aspect forged
    growth.aspect_forged = True
    growth.current_stage = "aspect"
    growth.aspect_chosen = chosen_aspect.get("name", f"Aspect {aspect_name.upper()}")
    growth.mutation_locked = True  # No more mutations after Aspect
    growth.active_growth = GrowthType.ASPECT
    skill.current_stage = "aspect"
    skill.suppression_resistance = get_stage_resistance("aspect")  # 80.0

    # Update core mechanic
    if chosen_aspect.get("enhanced_core"):
        skill.mechanic = chosen_aspect["enhanced_core"]

    # Add SS2 (active)
    ss2_data = chosen_aspect.get("ss2", {})
    if ss2_data:
        ss2 = SubSkill(
            name=ss2_data.get("name", ""),
            type="active",
            mechanic=ss2_data.get("mechanic", ""),
            cost=ss2_data.get("cost", ""),
            unlocked_at="aspect",
        )
        skill.sub_skills.append(ss2)
        growth.sub_skills_unlocked.append(ss2.name)

    # Add SS3 (passive)
    ss3_data = chosen_aspect.get("ss3", {})
    if ss3_data:
        ss3 = SubSkill(
            name=ss3_data.get("name", ""),
            type="passive",
            mechanic=ss3_data.get("mechanic", ""),
            unlocked_at="aspect",
        )
        skill.sub_skills.append(ss3)
        growth.sub_skills_unlocked.append(ss3.name)

    # Update weakness (transform)
    if chosen_aspect.get("weakness_transform"):
        skill.weakness = chosen_aspect["weakness_transform"]

    logger.info(
        f"Aspect applied: {growth.aspect_chosen}, "
        f"SS2={ss2_data.get('name')}, SS3={ss3_data.get('name')}"
    )

    return {
        "aspect_name": growth.aspect_chosen,
        "ss2": ss2_data,
        "ss3": ss3_data,
        "stage": "aspect",
    }


# ══════════════════════════════════════════════
# ULTIMATE SYNTHESIS — AI PROMPT + APPLICATION
# ══════════════════════════════════════════════

def build_ultimate_prompt(
    skill: UniqueSkill,
    growth: UniqueSkillGrowthState,
    absorbed_skill_name: str = "",
    absorbed_skill_mechanic: str = "",
) -> str:
    """Build AI prompt for Ultimate Synthesis.

    Ultimate Synthesis Flow (3 scenes):
      Scene 1 — "Giới Hạn": Boss pushes both skills to max
      Scene 2 — "Cộng Hưởng": Skills RESONATE. Normal ABSORB → NAMING EVENT
      Scene 3 — "Tái Sinh": Ultimate activates for first time

    Unlocks:
    - All SS merged + transcended
    - Normal Skill absorbed (removed from equipped)
    - Ultimate Ability: God-tier, 1/season, 80% stability cost
    - Naming Event: "[Tên] — [Danh xưng]"
    """
    ss_list = "\n".join(
        f"  - {ss.name} ({ss.type}): {ss.mechanic}"
        for ss in skill.sub_skills if ss.name
    )

    return f"""BẠN LÀ ULTIMATE FORGE — giai đoạn cuối Unique Skill.

## Skill hiện tại (ASPECT stage):
- Tên: {skill.name}
- Category: {skill.category}
- Core Mechanic: {skill.mechanic}
- Aspect: {growth.aspect_chosen}
- Weakness: {skill.weakness} (type: {skill.weakness_type})
- Sub-skills:
{ss_list}

## Normal Skill được hấp thụ:
- Tên: {absorbed_skill_name}
- Mechanic: {absorbed_skill_mechanic}

## Nhiệm vụ ULTIMATE SYNTHESIS:

1. **Ultimate Name**: Tên mới dạng "[Tên Skill] — [Danh Xưng]"
   VD: "Thiết Thệ Bất Hoại — Chúa Tể Kim Cương"

2. **Title (Danh Xưng)**: Danh xưng cho player, VD: "Chúa Tể Kim Cương"

3. **Core Transcend**: Core mechanic VƯỢT GIỚI HẠN gốc
   VD: "Cứng hóa 1 vùng" → "Cứng hóa BẤT KỲ VẬT THỂ cơ thể chạm vào"

4. **Ultimate Ability**: God-tier, 1/season, cost 80% stability
   - TÊN tiếng Việt (VD: "Thiết Thệ Tuyệt Đối")
   - Hiệu ứng CỰC MẠNH nhưng có giá
   - Weakness CUỐI: sau UA → penalty nặng 1 scene

5. **Merged Sub-skills**: All SS hợp nhất + transcend
   - TỔNG HỢP nghĩa + mechanic thành bản mới

Return ONLY JSON (no markdown):
{{
  "ultimate_name": "Tên — Danh Xưng",
  "title": "Danh Xưng",
  "core_transcend": "Core mechanic vượt giới hạn",
  "ultimate_ability": {{
    "name": "Tên UA tiếng Việt",
    "mechanic": "Hiệu ứng UA",
    "cost": "80% stability",
    "cooldown": "1/season"
  }},
  "merged_sub_skills": [
    {{"name": "SS merged", "type": "active/passive", "mechanic": "..."}}
  ],
  "weakness_final": "Weakness sau UA — penalty nặng"
}}"""


def apply_ultimate(
    player: PlayerState,
    ultimate_data: dict,
    absorbed_skill_id: str = "",
) -> dict:
    """Apply Ultimate Synthesis to player state.

    - Merges all sub-skills
    - Absorbs Normal Skill (removes from equipped)
    - Creates Ultimate Ability
    - Triggers Naming Event
    """
    from app.models.player import SubSkill
    from app.models.unique_skill_growth import UltimateSkillForm

    growth = player.unique_skill_growth
    skill = player.unique_skill

    if not growth or not skill:
        return {"error": "No growth state or unique skill"}

    # Mark ultimate
    growth.ultimate_forged = True
    growth.current_stage = "ultimate"
    growth.active_growth = GrowthType.ULTIMATE
    skill.current_stage = "ultimate"
    skill.suppression_resistance = get_stage_resistance("ultimate")  # 95.0

    # Update skill name with naming event
    if ultimate_data.get("ultimate_name"):
        growth.current_skill_name = ultimate_data["ultimate_name"]
        skill.name = ultimate_data["ultimate_name"]

    # Update core mechanic
    if ultimate_data.get("core_transcend"):
        skill.mechanic = ultimate_data["core_transcend"]

    # Create Ultimate Form
    merged_dicts = []
    merged_sub_skills = []
    for ss_data in ultimate_data.get("merged_sub_skills", []):
        merged_dicts.append(ss_data)
        merged_sub_skills.append(SubSkill(
            name=ss_data.get("name", ""),
            type=ss_data.get("type", "active"),
            mechanic=ss_data.get("mechanic", ""),
            unlocked_at="ultimate",
        ))

    ua_data = ultimate_data.get("ultimate_ability", {})
    ultimate_form = UltimateSkillForm(
        name=ultimate_data.get("ultimate_name", ""),
        title=ultimate_data.get("title", ""),
        merged_sub_skills=merged_dicts,
        absorbed_skill_name=absorbed_skill_id,
        ultimate_ability_name=ua_data.get("name", ""),
        ultimate_ability_description=ua_data.get("mechanic", ""),
        ultimate_ability_used_this_season=False,
    )
    growth.ultimate_form = ultimate_form
    growth.naming_event_completed = True

    # Replace sub-skills with merged versions
    skill.sub_skills = merged_sub_skills

    # Absorb Normal Skill (remove from equipped)
    if absorbed_skill_id:
        growth.absorbed_skill_id = absorbed_skill_id
        player.equipped_skills = [
            s for s in player.equipped_skills
            if s.get("name") != absorbed_skill_id
        ]

    # Update weakness
    if ultimate_data.get("weakness_final"):
        skill.weakness = ultimate_data["weakness_final"]

    # Update sub_skills_unlocked
    growth.sub_skills_unlocked = [ss.name for ss in merged_sub_skills if ss.name]

    logger.info(
        f"Ultimate applied: {growth.current_skill_name}, "
        f"title={ultimate_data.get('title')}, "
        f"absorbed={absorbed_skill_id}"
    )

    return {
        "ultimate_name": growth.current_skill_name,
        "title": ultimate_data.get("title", ""),
        "stage": "ultimate",
        "absorbed": absorbed_skill_id,
    }


# ══════════════════════════════════════════════
# GROWTH STATE INITIALIZATION
# ══════════════════════════════════════════════

def init_growth_state(skill: UniqueSkill) -> UniqueSkillGrowthState:
    """Initialize growth state after Soul Forge.

    Called once when a Unique Skill is first created.
    """
    return UniqueSkillGrowthState(
        skill_id=skill.name,  # Use name as ID for now
        original_skill_name=skill.name,
        current_skill_name=skill.name,
        current_stage="seed",
        active_growth=GrowthType.BASE,
        sub_skills_unlocked=[
            ss.name for ss in skill.sub_skills if ss.name
        ],
    )

