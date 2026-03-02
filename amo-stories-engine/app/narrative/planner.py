"""Agent 1: Planner — generates chapter outline with beats, tension, pacing."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage

from app.models.pipeline import Beat, NarrativeState, PlannerOutput
from app.narrative.world_context import get_world_context
from app.narrative.arc_blueprint import get_arc_guidance

logger = logging.getLogger(__name__)

# ── Archetype Starting Zones ──
# Source of truth: world_context.md Section 9
# Must stay in sync with that section.
_ARCHETYPE_STARTING_ZONES: dict[str, str] = {
    "vanguard": "Outer Corruption — rìa chiến trường, mùi máu và đất cháy, sinh vật dị biến gần đó",
    "catalyst": "Rừng biến dị gần Minor Gate #1 — thực tại méo mó, môi trường phản ứng với cảm xúc",
    "sovereign": "Grand Gate City — trung tâm quyền lực, đường phố đông đúc, chính trị và âm mưu ngay bước đầu",
    "seeker": "Ancient Ruins gần Minor Gate #1 — di tích cổ đại, im lặng nặng nề, dấu vết của kỷ nguyên cũ",
    "tactician": "Vùng Minor Gate #1 — tiền tuyến tranh chấp faction, ba phe đang giành quyền kiểm soát vùng này",
    "wanderer": "Hoang dã xa Gate — hoàn toàn một mình, không có dấu hiệu con người gần đây, chỉ có bầu trời và đất",
}

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "planner.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""
_FULL_SYSTEM_PROMPT = get_world_context() + "\n\n---\n\n" + _SYSTEM_PROMPT

_USER_TEMPLATE = """## Thông tin chương:
- Preference Tags: {preference_tags}
- Protagonist: {protagonist_name}
- Chapter: {chapter_number}

{arc_guidance}

## Lựa chọn player:
{choice_text}

## Tóm tắt trước đó:
{previous_summary}

## Cảnh kết chương trước (Continuity Anchor):
{previous_chapter_ending}

## Player Identity:
- Archetype: {archetype}
- Values: {values}
- Traits: {traits}
- Motivation: {motivation}
- Instability: {instability}/100
- Breakthrough Meter: {breakthrough}/100

## Unique Skill:
{skill_info}

## CRNG Event:
{crng_event}

## Fate Buffer:
{fate_instruction}

## Backstory:
{backstory}

{starting_zone_block}## Soul Forge — Sacrifice Choice:
{sacrifice_context}

## Narrative Tone:
{tone_context}

## Normal Skills (Equipped):
{normal_skills_info}

## Skill Reward:
{skill_reward_info}

## Skill Evolution:
{evolution_beat_info}

## Weapon:
{weapon_info}

## Intent Classifier:
{intent_info}

## Adaptive Context:
{adaptive_context}"""


async def run_planner(state: NarrativeState, llm: object) -> dict:
    """Generate chapter outline."""

    # Extract player info (player may be dict or Pydantic model)
    player = state.player_state
    archetype = ""
    values = ""
    traits = ""
    motivation = ""
    instability = 0
    breakthrough = 0
    if player:
        if isinstance(player, dict):
            archetype = player.get("archetype", "")
            ci = player.get("current_identity", {})
            if isinstance(ci, dict):
                values = ", ".join(ci.get("active_values", []))
                traits = ", ".join(ci.get("active_traits", []))
                motivation = ci.get("current_motivation", "")
            instability = player.get("instability", 0)
            breakthrough = player.get("breakthrough_meter", 0)
        else:
            archetype = getattr(player, "archetype", "")
            ci = getattr(player, "current_identity", None)
            if ci:
                values = ", ".join(getattr(ci, "active_values", []))
                traits = ", ".join(getattr(ci, "active_traits", []))
                motivation = getattr(ci, "current_motivation", "")
            instability = getattr(player, "instability", 0)
            breakthrough = getattr(player, "breakthrough_meter", 0)

    # Extract unique skill info
    skill_info = "Chưa có skill"
    if player:
        skill = None
        if isinstance(player, dict):
            skill = player.get("unique_skill")
        else:
            skill = getattr(player, "unique_skill", None)
        if skill:
            s = skill if isinstance(skill, dict) else skill.model_dump() if hasattr(skill, 'model_dump') else {}
            parts = []
            if s.get("name"):
                parts.append(f"Tên: {s['name']}")
            if s.get("description"):
                parts.append(f"Mô tả: {s['description']}")
            if s.get("mechanic"):
                parts.append(f"Cơ chế: {s['mechanic']}")
            if s.get("activation_condition"):
                parts.append(f"Kích hoạt: {s['activation_condition']}")
            if s.get("limitation"):
                parts.append(f"Giới hạn: {s['limitation']}")
            if s.get("category"):
                parts.append(f"Hệ: {s['category']}")
            if parts:
                skill_info = "\n".join(f"- {p}" for p in parts)
                skill_info += "\n→ TẠO TÌNH HUỐNG phù hợp để player CÓ THỂ sử dụng skill này trong chương."

    # Extract normal skills info
    normal_skills_info = "Chưa có normal skill"
    if player:
        equipped = []
        if isinstance(player, dict):
            equipped = player.get("equipped_skills", [])
        else:
            equipped = getattr(player, "equipped_skills", [])
        if equipped:
            parts = []
            for sk in equipped:
                if isinstance(sk, dict):
                    sk_data = sk
                elif hasattr(sk, "model_dump"):
                    sk_data = sk.model_dump()
                else:
                    sk_data = {}
                sk_name = sk_data.get("catalog_name", sk_data.get("skeleton_id", "unknown"))
                sk_principle = sk_data.get("principle", "")
                parts.append(f"- {sk_name} ({sk_principle})")
            normal_skills_info = "\n".join(parts)

    # Extract skill reward plan
    skill_reward_info = "Không có skill reward trong chương này"
    skill_reward_plan = None
    if hasattr(state, "skill_reward_plan") and state.skill_reward_plan:
        skill_reward_plan = state.skill_reward_plan
        if isinstance(skill_reward_plan, dict) and skill_reward_plan.get("should_reward"):
            source = skill_reward_plan.get("source", "story")
            hint = skill_reward_plan.get("narrative_hint", "")
            skill_reward_info = (
                f"CÓ — Player sẽ nhận skill mới trong chương này.\n"
                f"- Nguồn: {source}\n"
                f"- Gợi ý: {hint}\n"

                f"→ TẠO MỘT SCENE 'discovery' trong beats — player tìm thấy/nhận được skill mới."
            )

    # ── Build evolution beat info ──
    evolution_beat_info = _build_evolution_beat_info(player)

    # ── Build weapon context for prompt ──
    weapon_info = _build_weapon_info(player)

    choice_text = state.chosen_choice.text if state.chosen_choice else "Bắt đầu câu chuyện"

    crng_text = "Không có sự kiện đặc biệt"
    if state.crng_event and state.crng_event.get("triggered"):
        crng_text = (
            f"SỰ KIỆN: {state.crng_event['event_type']} — "
            f"Affinity: {state.crng_event.get('affinity_tag', '')} — "
            f"{state.crng_event.get('details', '')}"
        )

    # Build sacrifice context from soul forge signals
    sacrifice_context = "Không có thông tin"
    if player:
        _SACRIFICE_DESC = {
            "courage": "Player chọn ĐỐI MẶT TRỰC TIẾP — viết narrative với nhiều thử thách, đau đớn, nhưng player KHÔNG LÙI BƯỚC. Tone: mạnh mẽ, quyết liệt.",
            "cleverness": "Player chọn TÌM CÁCH KHÁC — viết narrative với nhiều puzzle, mưu kế, giải pháp sáng tạo. Player dùng TRÍ TUỆ thay vì sức mạnh. Tone: thông minh, chiến lược.",
            "defiance": "Player chọn NỔI LOẠN — viết narrative với player CHỐNG LẠI authority, phá vỡ luật lệ, tự tạo con đường riêng. Tone: bất khuất, tự do.",
        }
        # Check personality_traits for the signal
        cvc = ""
        if isinstance(player, dict):
            seed = player.get("seed_identity", {})
            p_traits = seed.get("personality_traits", []) if isinstance(seed, dict) else []
        else:
            seed = getattr(player, "seed_identity", None)
            p_traits = getattr(seed, "personality_traits", []) if seed else []
        for t in p_traits:
            if t in _SACRIFICE_DESC:
                cvc = t
                break
        if cvc:
            sacrifice_context = _SACRIFICE_DESC[cvc]

    # Build tone context
    _TONE_DESC = {
        "epic": "Viết theo phong cách SỬ THI — vận mệnh thế giới, chiến tranh, anh hùng. Ngôn ngữ trang trọng, hùng tráng, gợi cảm hứng lớn lao.",
        "dark": "Viết theo phong cách DARK FANTASY — tàn khốc, bi kịch, không ai an toàn. Ngôn ngữ ảm đạm, căng thẳng, bất ngờ đau đớn.",
        "comedy": "Viết theo phong cách HÀI HƯỚC — nhẹ nhàng, vui vẻ, dở khóc dở cười. Ngôn ngữ dí dỏm, tình huống hài, nhân vật phản ứng ngộ nghĩnh.",
        "slice_of_life": "Viết theo phong cách SLICE OF LIFE — chậm rãi, cảm xúc, khám phá thế giới. Ngôn ngữ tinh tế, chi tiết đời thường, cảm xúc nhẹ nhàng.",
        "mysterious": "Viết theo phong cách HUYỀN BÍ — bí ẩn dần mở, plot twist, khám phá. Ngôn ngữ gợi tò mò, chi tiết ẩn giấu, câu hỏi chưa lời đáp.",
    }
    tone_context = _TONE_DESC.get(state.tone, "Tự do — cân bằng giữa các tone, ưu tiên phù hợp với preference tags.") if state.tone else "Tự do — cân bằng giữa các tone, ưu tiên phù hợp với preference tags."

    # ── Build intent classifier context ──
    intent_parts = []
    if state.action_category and state.action_category != "other":
        intent_parts.append(f"- Loại hành động: {state.action_category}")
    if state.skill_reference:
        intent_parts.append(f"- Skill được invoke: {state.skill_reference}")
    if state.player_intent:
        intent_parts.append(f"- Ý định player: {state.player_intent}")
    if state.action_category == "soul_choice":
        intent_parts.append("\u2192 ĐÂY LÀ SOUL CHOICE — plan narrative confrontation arc, không phải normal beat. Player đang đưa ra quyết định về identity/mutation.")
    elif state.action_category == "skill_use" and state.skill_reference:
        intent_parts.append(f"\u2192 Player muốn dùng skill [{state.skill_reference}] — TẠO TÌNH HUỐNG phù hợp để skill này được thể hiện trong prose.")
    intent_info = "\n".join(intent_parts) if intent_parts else "Không có dữ liệu intent classifier"

    # ── Starting zone block (Chapter 1 only) ──
    starting_zone_block = ""
    if state.chapter_number == 1 and archetype:
        zone = _ARCHETYPE_STARTING_ZONES.get(archetype.lower(), "")
        if zone:
            starting_zone_block = (
                f"## Vị trí bắt đầu — Chapter 1 (BẮT BUỘC):\n"
                f"{zone}\n"
                f"→ Player TỈNH DẬY tại đây. Cảnh mở đầu PHẢI đặt ở vùng này. KHÔNG được tự ý thay đổi location cho Chapter 1.\n\n"
            )

    messages = [
        SystemMessage(content=_FULL_SYSTEM_PROMPT),
        HumanMessage(content=_USER_TEMPLATE.format(
            preference_tags=", ".join(state.preference_tags) if state.preference_tags else "general",
            protagonist_name=state.protagonist_name or "Nhân vật chính",
            chapter_number=state.chapter_number,
            choice_text=choice_text,
            previous_summary=state.previous_summary or "Đây là chương đầu tiên.",
            previous_chapter_ending=(
                (getattr(state, "previous_chapter_ending", "") or "")[-400:] or "Đây là chương đầu tiên."
            ),
            archetype=archetype,
            starting_zone_block=starting_zone_block,
            values=values,
            traits=traits,
            motivation=motivation,
            instability=instability,
            breakthrough=breakthrough,
            skill_info=skill_info,
            crng_event=crng_text,
            fate_instruction=state.fate_instruction or "Không có chỉ dẫn",
            backstory=state.backstory or "Không có backstory",
            sacrifice_context=sacrifice_context,
            tone_context=tone_context,
            normal_skills_info=normal_skills_info,
            skill_reward_info=skill_reward_info,
            evolution_beat_info=evolution_beat_info,
            weapon_info=weapon_info,
            intent_info=intent_info,
            adaptive_context=state.adaptive_context or "Không có adaptive context.",
            arc_guidance=get_arc_guidance(state.chapter_number),
        )),
    ]

    logger.info(f"Planner: generating outline for chapter {state.chapter_number}")
    response = await llm.ainvoke(messages)
    content = _extract_json(response.content)

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        logger.error(f"Planner JSON parse failed: {content[:200]}")
        # Fallback: create basic outline
        result = {
            "beats": [{"description": "Tiếp tục hành trình", "tension": 5, "purpose": "rising"}],
            "chapter_tension": 5,
            "pacing": "medium",
            "new_characters": [],
            "world_changes": [],
            "emotional_arc": "growth",
        }

    # Parse beats
    beats = []
    for b in result.get("beats", []):
        beats.append(Beat(
            description=b.get("description", ""),
            tension=b.get("tension", 5),
            purpose=b.get("purpose", "rising"),
        ))

    if not beats:
        beats.append(Beat(description="Tiếp tục hành trình", tension=5, purpose="rising"))

    # ── Inject skill reward beat if planned ──
    if skill_reward_plan and isinstance(skill_reward_plan, dict) and skill_reward_plan.get("should_reward"):
        _inject_skill_reward_beat(beats, skill_reward_plan)

    # ── Inject evolution beat if triggered ──
    _inject_evolution_beat(beats, player)

    # ── Inject Soul-Link beat if weapon threshold met ──
    soul_link_pending = False
    if state.weapon_soul_link_pending:
        _inject_soul_link_beat(beats, player)
        soul_link_pending = True

    # ── Inject Awakening beat if weapon ready (Phase 2A) ──
    if hasattr(state, "weapon_awakening_pending") and state.weapon_awakening_pending:
        _inject_awakening_beat(beats, player)

    # ── Inject Dormant Recovery beat if weapon dormant (Phase 2C) ──
    if state.weapon_dormant:
        _inject_dormant_recovery_beat(beats, player)

    planner_output = PlannerOutput(
        beats=beats,
        chapter_tension=result.get("chapter_tension", 5),
        pacing=result.get("pacing", "medium"),
        new_characters=result.get("new_characters", []),
        world_changes=result.get("world_changes", []),
        emotional_arc=result.get("emotional_arc", "growth"),
    )

    return {"planner_output": planner_output, "weapon_soul_link_pending": soul_link_pending}


def _inject_skill_reward_beat(
    beats: list[Beat],
    skill_reward_plan: dict,
) -> None:
    """Ensure at least one discovery beat with skill_reward exists.

    If the LLM already produced a discovery scene_type, attach the
    reward to it.  Otherwise, insert a new discovery beat before
    the final beat.
    """
    # Check if LLM already included a discovery beat
    for beat in beats:
        if beat.scene_type == "discovery":
            if beat.skill_reward is None:
                beat.skill_reward = skill_reward_plan
            return

    # Insert a discovery beat before the last beat
    source = skill_reward_plan.get("source", "story")
    hint = skill_reward_plan.get("narrative_hint", "A new power reveals itself")
    discovery_beat = Beat(
        description=f"Skill Discovery — {hint}",
        tension=6,
        purpose="rising",
        scene_type="discovery",
        mood="mystery",
        skill_reward=skill_reward_plan,
    )
    insert_pos = max(0, len(beats) - 1)  # Before final beat
    beats.insert(insert_pos, discovery_beat)


def _build_evolution_beat_info(player) -> str:
    """Build evolution context info for the planner prompt.

    Tells the LLM about pending evolution events so it can schedule
    appropriate scenes (mutation arcs, rest scenes for refinement, etc).

    Ref: SKILL_EVOLUTION_SPEC v1.1 §10.2
    """
    if not player:
        return "Không có sự kiện evolution."

    parts = []

    # Extract evolution state
    evo = None
    if isinstance(player, dict):
        evo = player.get("skill_evolution", {})
    else:
        evo_obj = getattr(player, "skill_evolution", None)
        evo = evo_obj.model_dump() if hasattr(evo_obj, "model_dump") else {}

    if not evo:
        return "Không có sự kiện evolution."

    # Mutation arc in progress
    mutation_skill = evo.get("mutation_in_progress")
    if mutation_skill:
        arc_scene = evo.get("mutation_arc_scene", 0)
        parts.append(
            f"⚡ MUTATION ARC đang diễn ra — Skill [{mutation_skill}] đang biến đổi.\n"
            f"  Arc scene: {arc_scene}/3\n"
            f"  → TẠO SCENE cho mutation arc (skill hành xử bất thường)."
        )
        if arc_scene == 2:
            parts.append(
                "  → Scene này là DECISION POINT — player phải chọn: "
                "chấp nhận / chống lại / ép hybrid."
            )

    # Resonance context (prose, not numbers)
    resonance = None
    if isinstance(player, dict):
        resonance = player.get("resonance", {})
    else:
        resonance = getattr(player, "resonance", {})
    if resonance:
        from app.engine.resonance_mastery import build_resonance_context
        descriptors = build_resonance_context(resonance)
        if descriptors:
            lines = [f"  - {p}: {desc}" for p, desc in descriptors.items()]
            parts.append("Resonance hiện tại:\n" + "\n".join(lines))

    if not parts:
        return "Không có sự kiện evolution."

    return "\n\n".join(parts)


def _build_weapon_info(player) -> str:
    """Build weapon context info for the planner prompt.

    Tells the LLM about equipped weapons so it can weave weapon
    references into narrative beats.

    Ref: WEAPON_SYSTEM_SPEC v1.0 §9
    """
    if not player:
        return "Không có weapon."

    # Extract equipped_weapons (dict or Pydantic)
    weapons = None
    if isinstance(player, dict):
        weapons = player.get("equipped_weapons", {})
    else:
        weapons = getattr(player, "equipped_weapons", None)

    if not weapons:
        return "Không có weapon."

    # Get primary weapon
    primary = None
    if isinstance(weapons, dict):
        primary = weapons.get("primary")
    else:
        primary = getattr(weapons, "primary", None)

    if not primary:
        return "Không có weapon equipped."

    # Extract weapon data
    if isinstance(primary, dict):
        w_name = primary.get("name", "Unknown")
        w_grade = primary.get("grade", "mundane")
        w_principle = primary.get("primary_principle", "")
        w_soul_linked = primary.get("soul_linked", False)
        w_dormant = primary.get("dormant", False)
        w_bond = primary.get("bond_score", 0)
        w_lore = primary.get("lore", {})
        w_history = w_lore.get("history_summary", "") if isinstance(w_lore, dict) else ""
        w_sig = primary.get("signature_move")
    else:
        w_name = getattr(primary, "name", "Unknown")
        w_grade = getattr(primary, "grade", "mundane")
        if hasattr(w_grade, "value"):
            w_grade = w_grade.value
        w_principle = getattr(primary, "primary_principle", "")
        w_soul_linked = getattr(primary, "soul_linked", False)
        w_dormant = getattr(primary, "dormant", False)
        w_bond = getattr(primary, "bond_score", 0)
        w_lore_obj = getattr(primary, "lore", None)
        w_history = getattr(w_lore_obj, "history_summary", "") if w_lore_obj else ""
        w_sig = getattr(primary, "signature_move", None)

    parts = [
        f"- Tên: {w_name}",
        f"- Grade: {w_grade}",
        f"- Principle: {w_principle}",
    ]
    if w_soul_linked:
        parts.append("- ⚡ Soul-Linked — weapon phản ứng với cảm xúc/hành động của player")
    if w_dormant:
        parts.append("- 🔇 DORMANT — weapon im lặng, không phản hồi. Player cảm thấy mất mát.")
    if w_history:
        parts.append(f"- Lore: {w_history}")
    if w_sig:
        sig_name = w_sig.get("name", "") if isinstance(w_sig, dict) else getattr(w_sig, "name", "")
        if sig_name:
            parts.append(f"- Signature Move: {sig_name}")

    parts.append("→ TÍCH HỢP weapon vào narrative — weapon phản ứng khi combat, thể hiện tính cách qua bond.")

    return "\n".join(parts)


def _inject_soul_link_beat(
    beats: list[Beat],
    player,
) -> None:
    """Inject a Soul-Link scene when weapon bond threshold is met.

    Soul-Link is a pivotal narrative moment — the weapon chooses the player.
    Insert as a climax-level beat.

    Ref: WEAPON_SYSTEM_SPEC v1.0 §5
    """
    # Get weapon name
    w_name = "weapon"
    if player:
        weapons = None
        if isinstance(player, dict):
            weapons = player.get("equipped_weapons", {})
        else:
            weapons = getattr(player, "equipped_weapons", None)
        if weapons:
            primary = weapons.get("primary") if isinstance(weapons, dict) else getattr(weapons, "primary", None)
            if primary:
                w_name = primary.get("name", "weapon") if isinstance(primary, dict) else getattr(primary, "name", "weapon")

    soul_link_beat = Beat(
        description=(
            f"SOUL-LINK MOMENT — {w_name} phản ứng mạnh mẽ với player. "
            f"Đây không phải combat scene — đây là khoảnh khắc covenant. "
            f"Weapon 'chọn' player. Mô tả sự kết nối sâu sắc, không chỉ vật lý."
        ),
        tension=8,
        purpose="climax",
        scene_type="discovery",
        mood="mystery",
    )
    # Insert before final beat
    insert_pos = max(0, len(beats) - 1)
    beats.insert(insert_pos, soul_link_beat)


def _inject_dormant_recovery_beat(
    beats: list[Beat],
    player,
) -> None:
    """Inject a Dormant Recovery opportunity when weapon is dormant.

    Dormant weapon = narrative punishment. Recovery requires player to
    demonstrate renewed commitment. Planner weaves a scene where player
    can reconnect with the weapon.

    Ref: WEAPON_SYSTEM_SPEC v1.0 §5 (Dormant state), Phase 2C
    """
    w_name = "weapon"
    if player:
        weapons = None
        if isinstance(player, dict):
            weapons = player.get("equipped_weapons", {})
        else:
            weapons = getattr(player, "equipped_weapons", None)
        if weapons:
            primary = weapons.get("primary") if isinstance(weapons, dict) else getattr(weapons, "primary", None)
            if primary:
                w_name = primary.get("name", "weapon") if isinstance(primary, dict) else getattr(primary, "name", "weapon")

    recovery_beat = Beat(
        description=(
            f"DORMANT RECOVERY — {w_name} im lặng, không phản hồi. "
            f"Player phải chứng minh sự cam kết. Tạo tình huống thử thách "
            f"(near-death, sacrifice, hoặc soul_choice) liên quan đến weapon. "
            f"Nếu player vượt qua — weapon có cơ hội thức tỉnh lại."
        ),
        tension=7,
        purpose="development",
        scene_type="discovery",
        mood="melancholy",
    )
    insert_pos = max(0, len(beats) - 1)
    beats.insert(insert_pos, recovery_beat)


def _inject_awakening_beat(
    beats: list[Beat],
    player,
) -> None:
    """Inject an Awakening Scene when weapon bond meets threshold.

    Awakening = weapon gains consciousness, Signature Move v1 unlocked.
    This is a pivotal narrative moment, even more significant than Soul-Link.

    Ref: WEAPON_SYSTEM_SPEC v1.0 §7 (Awakening trigger), Phase 2A
    """
    w_name = "weapon"
    if player:
        weapons = None
        if isinstance(player, dict):
            weapons = player.get("equipped_weapons", {})
        else:
            weapons = getattr(player, "equipped_weapons", None)
        if weapons:
            primary = weapons.get("primary") if isinstance(weapons, dict) else getattr(weapons, "primary", None)
            if primary:
                w_name = primary.get("name", "weapon") if isinstance(primary, dict) else getattr(primary, "name", "weapon")

    awakening_beat = Beat(
        description=(
            f"AWAKENING MOMENT — {w_name} thức tỉnh hoàn toàn. "
            f"Đây là khoảnh khắc vũ khí đạt Grade 4: Awakened. "
            f"Signature Move v1 xuất hiện lần đầu. Mô tả sự kết nối "
            f"sâu sắc, vũ khí phát sáng, năng lượng bùng phát. "
            f"Đây phải là cao trào narrative — không chỉ buff, mà transformation."
        ),
        tension=9,
        purpose="climax",
        scene_type="discovery",
        mood="wonder",
    )
    insert_pos = max(0, len(beats) - 1)
    beats.insert(insert_pos, awakening_beat)


def _inject_evolution_beat(
    beats: list[Beat],
    player,
) -> None:
    """Inject evolution-specific beats if mutation arc in progress.

    For mutation arcs: ensure the beat has the right mood and hints.
    For refinement: already handled per-scene (no beat injection needed).

    Ref: SKILL_EVOLUTION_SPEC v1.1 §10.2
    """
    if not player:
        return

    evo = None
    if isinstance(player, dict):
        evo = player.get("skill_evolution", {})
    else:
        evo_obj = getattr(player, "skill_evolution", None)
        evo = evo_obj.model_dump() if hasattr(evo_obj, "model_dump") else {}

    if not evo:
        return

    mutation_skill = evo.get("mutation_in_progress")
    if not mutation_skill:
        return

    arc_scene = evo.get("mutation_arc_scene", 0)

    # Scene 1: Discovery — skill behaves abnormally
    if arc_scene == 1:
        mutation_beat = Beat(
            description=(
                f"Skill [{mutation_skill}] bất ổn — hành xử bất thường, "
                f"misfire hoặc phản ứng ngược. Player nhận ra skill đang thay đổi."
            ),
            tension=7,
            purpose="rising",
            scene_type="discovery",
            mood="mystery",
        )
        # Insert at beginning
        beats.insert(0, mutation_beat)

    # Scene 2: Climax — decision point
    elif arc_scene == 2:
        mutation_beat = Beat(
            description=(
                f"DECISION POINT — Skill [{mutation_skill}] không hoạt động đúng. "
                f"Player phải chọn: chấp nhận mutation, chống lại, hoặc ép hybrid."
            ),
            tension=8,
            purpose="climax",
            scene_type="combat",
            mood="tense",
        )
        beats.insert(0, mutation_beat)

    # Scene 3: Resolution — transformation completes
    elif arc_scene == 3:
        mutation_beat = Beat(
            description=(
                f"Skill [{mutation_skill}] hoàn thành mutation — tên mới, mechanic mới. "
                f"Player cảm nhận evolution, không phải mất mát."
            ),
            tension=6,
            purpose="resolution",
            scene_type="rest",
            mood="calm",
        )
        beats.insert(0, mutation_beat)


def _extract_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text
