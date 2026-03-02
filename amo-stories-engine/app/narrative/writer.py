"""Agent 5: Writer — generates chapter prose and 3 player choices."""

from __future__ import annotations

import json
import logging
from pathlib import Path

from langchain_core.messages import HumanMessage, SystemMessage

from app.models.pipeline import NarrativeState, WriterOutput
from app.models.story import Choice
from app.narrative.world_context import get_world_context

logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "writer.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8") if _PROMPT_PATH.exists() else ""
_FULL_SYSTEM_PROMPT = get_world_context() + "\n\n---\n\n" + _SYSTEM_PROMPT

_USER_TEMPLATE = """## Chapter {chapter_number} — Tags: {preference_tags}
Protagonist: {protagonist_name}

{entity_context}

## Dàn ý (Planner):
{planner_info}

## Hậu quả (Simulator):
{simulator_info}

## Context (NeuralMemory):
{context}

## Player Identity:
- Values: {values}
- Traits: {traits}
- Motivation: {motivation}
- Power Style: {power_style}

## Unique Skill:
{skill_info}

## Fate Buffer:
{fate_instruction}

## Weapon:
{weapon_info}

## Player Intent:
{player_intent_info}

## Narrative Tone:
{tone_context}

## Tag Guidance:
{tag_guidance}

## Adaptive Context:
{adaptive_context}

{critic_feedback}"""


_TAG_GUIDANCE = {
    "combat": "⚔️ COMBAT: Ưu tiên cảnh chiến đấu, đối đầu. Câu ngắn, nhịp nhanh, chiến thuật chi tiết. Mô tả đòn đánh cụ thể, không tóm tắt.",
    "politics": "👑 POLITICS: Ưu tiên âm mưu, liên minh, quyền lực. Subtext trong dialogue, mỗi NPC có agenda ẩn. Lời nói hai nghĩa, tension qua lời nói.",
    "romance": "💕 ROMANCE: Ưu tiên kết nối cảm xúc, tension lãng mạn. Chi tiết ánh mắt, khoảng lặng ý nghĩa, cảm xúc tinh tế. Không rushing, để relationship phát triển tự nhiên.",
    "mystery": "🔍 MYSTERY: Ưu tiên bí ẩn, manh mối. Foreshadowing, chi tiết ẩn giấu mà reader có thể ghép lại. Câu hỏi nhiều hơn câu trả lời, mỗi scene reveal 1 chi tiết mới.",
    "horror": "👻 HORROR: Ưu tiên sự sợ hãi, atmosphere đe dọa. POV hẹp, mô tả cảm giác (lạnh gáy, tim đập), threat không rõ ràng. Ít ánh sáng, nhiều âm thanh lạ.",
    "cultivation": "🏋️ CULTIVATION: Ưu tiên tu luyện, đột phá, hiểu Nguyên Tắc. Mô tả quá trình nội tại (năng lượng chảy, cảnh giới mở). Cảm nhận sâu sắc, không chỉ power-up số.",
    "adventure": "🗺️ ADVENTURE: Ưu tiên khám phá thế giới, travel. Mô tả cảnh vật chi tiết, wonderment, scale. Mỗi nơi mới phải có đặc trưng riêng (mùi, ánh sáng, âm thanh).",
    "strategy": "🧠 STRATEGY: Ưu tiên mưu kế, tính toán. Suy nghĩ nhiều bước, đánh giá rủi ro, outsmart. Nhân vật chính dùng trí tuệ, không dùng sức mạnh brute force.",
}


def _build_tag_guidance(tags: list[str] | None) -> str:
    """Build writing guidance based on selected preference tags."""
    if not tags:
        return "Tự do — viết cân bằng giữa các yếu tố."
    parts = []
    for tag in tags:
        desc = _TAG_GUIDANCE.get(tag)
        if desc:
            parts.append(desc)
    return "\n".join(parts) if parts else "Tự do — viết cân bằng giữa các yếu tố."


async def run_writer(state: NarrativeState, llm: object) -> dict:
    """Generate chapter prose and 3 choices."""

    player = state.player_state
    planner = state.planner_output

    # Build planner info
    planner_info = "Chưa có dàn ý"
    if planner:
        beats_text = "\n".join(
            f"  {i+1}. [{b.purpose}] {b.description} (tension: {b.tension})"
            for i, b in enumerate(planner.beats)
        )
        planner_info = (
            f"Pacing: {planner.pacing}\n"
            f"Tension: {planner.chapter_tension}/10\n"
            f"Emotional Arc: {planner.emotional_arc}\n"
            f"Beats:\n{beats_text}"
        )

    # Build simulator info
    simulator_info = "Chưa có hậu quả"
    if state.simulator_output:
        sim = state.simulator_output
        parts = []
        # Causal chains (Consequence Router)
        causal_chains = getattr(sim, "causal_chains", [])
        if causal_chains:
            for chain in causal_chains[:3]:
                trigger = getattr(chain, "trigger", "") if hasattr(chain, "trigger") else chain.get("trigger", "") if isinstance(chain, dict) else ""
                links = getattr(chain, "links", []) if hasattr(chain, "links") else chain.get("links", []) if isinstance(chain, dict) else []
                if trigger:
                    chain_text = f"- [{trigger}]"
                    if links:
                        chain_text += " → " + " → ".join(links[:3])
                    parts.append(chain_text)
        # Flat consequences (backward compat)
        if sim.consequences:
            for c in sim.consequences:
                if isinstance(c, dict):
                    parts.append(f"- {c.get('description', '')} ({c.get('severity', 'moderate')})")
        if sim.world_impact:
            parts.append(f"- World: {sim.world_impact}")
        simulator_info = "\n".join(parts) if parts else simulator_info

    # Critic feedback (for rewrites)
    critic_feedback = ""
    if state.critic_output and not state.critic_output.approved:
        critic_feedback = (
            f"## ⚠️ Critic Feedback (rewrite #{state.rewrite_count}):\n"
            f"Score: {state.critic_output.score}/10\n"
            f"Instructions: {state.critic_output.rewrite_instructions}\n"
            f"Issues: {', '.join(state.critic_output.issues)}"
        )

    # Extract player identity fields safely (player may be dict or Pydantic model)
    values = ""
    traits = ""
    motivation = ""
    power_style = ""
    if player:
        if isinstance(player, dict):
            ci = player.get("current_identity", {})
            if isinstance(ci, dict):
                values = ", ".join(ci.get("active_values", []))
                traits = ", ".join(ci.get("active_traits", []))
                motivation = ci.get("current_motivation", "")
                power_style = ci.get("power_style", "")
        else:
            ci = getattr(player, "current_identity", None)
            if ci:
                values = ", ".join(getattr(ci, "active_values", []))
                traits = ", ".join(getattr(ci, "active_traits", []))
                motivation = getattr(ci, "current_motivation", "")
                power_style = getattr(ci, "power_style", "")

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
            if s.get("weakness"):
                parts.append(f"Điểm yếu: {s['weakness']}")
            if parts:
                skill_info = "\n".join(f"- {p}" for p in parts)

    # Extract weapon info
    weapon_info = "Không có weapon"
    if player:
        weapons = None
        if isinstance(player, dict):
            weapons = player.get("equipped_weapons", {})
        else:
            weapons = getattr(player, "equipped_weapons", None)
        if weapons:
            primary = weapons.get("primary") if isinstance(weapons, dict) else getattr(weapons, "primary", None)
            if primary:
                w = primary if isinstance(primary, dict) else (primary.model_dump() if hasattr(primary, 'model_dump') else {})
                w_parts = []
                if w.get("name"):
                    w_parts.append(f"Tên: {w['name']}")
                grade = w.get("grade", "")
                if hasattr(grade, "value"):
                    grade = grade.value
                if grade:
                    w_parts.append(f"Grade: {grade}")
                if w.get("primary_principle"):
                    w_parts.append(f"Principle: {w['primary_principle']}")
                if w.get("soul_linked"):
                    w_parts.append("⚡ Soul-Linked")
                if w.get("dormant"):
                    w_parts.append("🔇 DORMANT")
                lore = w.get("lore", {})
                if isinstance(lore, dict) and lore.get("history_summary"):
                    w_parts.append(f"Lore: {lore['history_summary']}")
                if w_parts:
                    weapon_info = "\n".join(f"- {p}" for p in w_parts)

                # Weapon cosmetics directives (Phase 2C)
                w_grade_val = w.get("grade", "")
                if hasattr(w_grade_val, "value"):
                    w_grade_val = w_grade_val.value
                if w_grade_val in ("awakened", "archon_fragment"):
                    weapon_info += "\n- 🎨 VŨ KHÍ AWAKENED — mô tả vũ khí phát sáng nhẹ, rung động theo cảm xúc player. Năng lượng principle tỏa ra trong prose."
                if w.get("signature_move"):
                    sig = w["signature_move"]
                    sig_tier = sig.get("evolution_tier", 1) if isinstance(sig, dict) else getattr(sig, "evolution_tier", 1)
                    if sig_tier >= 2:
                        weapon_info += "\n- ⚔️ SIGNATURE MOVE EVOLVED — khi mô tả Signature Move, prose phải epic hơn, chi tiết hơn. Tier càng cao = prose càng hoành tráng."
                if w.get("dormant"):
                    weapon_info += "\n- 💀 VŨ KHÍ DORMANT — vũ khí trở nên xám xịt, nặng nề. Player cảm thấy weight, silence, loss. Mô tả sự trống rỗng."

    # ── Entity Registry context (world consistency) ──
    entity_context = ""
    try:
        from app.world.entity_registry import build_entity_context, build_tower_context

        # Get archetype from player state
        archetype = ""
        if player:
            archetype = (
                player.get("archetype", "") if isinstance(player, dict)
                else getattr(player, "archetype", "")
            )

        # Build base entity context for this archetype
        if archetype:
            entity_context = build_entity_context(archetype)

        # Add Tower context if planner beats reference Tower
        if planner:
            beats = getattr(planner, "beats", [])
            for beat in beats:
                desc = (
                    beat.get("description", "") if isinstance(beat, dict)
                    else getattr(beat, "description", "")
                ).lower()
                if "tower" in desc or "tháp" in desc or "tầng" in desc:
                    # Infer floor from chapter number (rough heuristic for Phase 1)
                    chapter = state.chapter_number or 1
                    floor = 1 if chapter <= 8 else (2 if chapter <= 16 else 3)
                    tower_ctx = build_tower_context(floor)
                    if tower_ctx:
                        entity_context = (entity_context + "\n\n" + tower_ctx).strip()
                    break
    except Exception as e:
        logger.warning(f"Writer: entity context build failed ({e}) — continuing without")
        entity_context = ""

    # Archon soft-hint (Phase 1C): subtle ambient cue, Writer can ignore
    dominant_archon = ""
    if hasattr(state, "dominant_archon"):
        dominant_archon = state.dominant_archon or ""
    elif isinstance(state, dict):
        dominant_archon = state.get("dominant_archon", "")
    if dominant_archon:
        archon_hints = {
            "vyrel": "Không khí thoáng đãng, tự do — như thể gông xiềng vô hình đang lỏng dần.",
            "dominar": "Quyền uy tỏa ra — mặt đất như nhận ra kẻ xứng đáng thống trị.",
            "aethis": "Trật tự tinh tế — mọi thứ như đang xếp vào đúng vị trí.",
            "morphael": "Sự biến đổi trong không khí — như thể thế giới đang thở theo nhịp khác.",
            "seraphine": "Ánh sáng dịu dàng — sự tận tâm tỏa ra như hơi ấm.",
        }
        hint = archon_hints.get(dominant_archon, "")
        if hint:
            weapon_info += f"\n- 🌟 Ambient: {hint}"

    # ── Build player intent context ──
    player_intent_info = "Không có dữ liệu intent"
    intent_parts = []
    if state.player_intent:
        intent_parts.append(f"Ý định: {state.player_intent}")
    if state.action_category and state.action_category != "other":
        intent_parts.append(f"Loại: {state.action_category}")
    if state.skill_reference:
        intent_parts.append(f"Skill: {state.skill_reference} → mô tả đúng mechanic của skill này trong prose")
    if intent_parts:
        player_intent_info = "\n- ".join([""] + intent_parts).strip("- ")

    # ── Build tone context ──
    _TONE_DESC = {
        "epic": "Viết theo phong cách SỬ THI — ngôn ngữ trang trọng, hùng tráng. Câu dài hùng vĩ xen câu ngắn quyết liệt. Nhấn mạnh vận mệnh, sự hy sinh, và khoảnh khắc anh hùng.",
        "dark": "Viết theo phong cách DARK FANTASY — tàn khốc, bi kịch, không ai an toàn. Ngôn ngữ ảm đạm, chi tiết bạo lực thật (không glorify). Chiến thắng có giá đắt, mất mát thấm vào từng đoạn.",
        "comedy": "Viết theo phong cách HÀI HƯỚC — nhẹ nhàng, timing comedy tốt. Tình huống dở khóc dở cười, nhân vật phản ứng ngộ nghĩnh. Dialogue chiếm nhiều, witty repartee.",
        "slice_of_life": "Viết theo phong cách SLICE OF LIFE — chậm rãi, chi tiết đời thường tinh tế. Cảm xúc nhẹ nhàng nhưng sâu. Tả cảnh vật, ẩm thực, sinh hoạt nhiều hơn action.",
        "mysterious": "Viết theo phong cách HUYỀN BÍ — câu hỏi nhiều hơn câu trả lời. Foreshadowing, chi tiết ẩn giấu. Kết mỗi đoạn để lại cảm giác không yên. Atmosphere > action.",
    }
    tone_context = _TONE_DESC.get(state.tone, "Tự do — cân bằng giữa các tone, ưu tiên phù hợp với preference tags.") if state.tone else "Tự do — cân bằng giữa các tone, ưu tiên phù hợp với preference tags."

    # ── Build per-tag guidance ──
    tag_guidance = _build_tag_guidance(state.preference_tags)

    messages = [
        SystemMessage(content=_FULL_SYSTEM_PROMPT),
        HumanMessage(content=_USER_TEMPLATE.format(
            chapter_number=state.chapter_number,
            preference_tags=", ".join(state.preference_tags) if state.preference_tags else "general",
            protagonist_name=state.protagonist_name or "Nhân vật chính",
            entity_context=entity_context,
            planner_info=planner_info,
            simulator_info=simulator_info,
            context=state.context or "Không có context bổ sung",
            values=values,
            traits=traits,
            motivation=motivation,
            power_style=power_style,
            skill_info=skill_info,
            weapon_info=weapon_info,
            fate_instruction=state.fate_instruction or "Không có chỉ dẫn",
            critic_feedback=critic_feedback,
            player_intent_info=player_intent_info,
            adaptive_context=state.writer_adaptive_context or state.adaptive_context or "Không có adaptive context.",
            tone_context=tone_context,
            tag_guidance=tag_guidance,
        )),
    ]

    logger.info(f"Writer: generating prose for chapter {state.chapter_number} (rewrite: {state.rewrite_count})")
    response = await llm.ainvoke(messages)
    raw_content = response.content
    result = _parse_writer_json(raw_content, state.chapter_number)

    # Parse choices
    choices = []
    for c in result.get("choices", []):
        if isinstance(c, dict):
            choices.append(Choice(
                id=c.get("id", ""),
                text=c.get("text", ""),
                risk_level=c.get("risk_level", 3),
                consequence_hint=c.get("consequence_hint", ""),
            ))

    # Ensure exactly 3 choices
    while len(choices) < 3:
        choices.append(Choice(
            text="Chờ đợi và quan sát",
            risk_level=1,
            consequence_hint="An toàn nhưng có thể bỏ lỡ cơ hội",
        ))

    writer_output = WriterOutput(
        chapter_title=result.get("chapter_title", f"Chương {state.chapter_number}"),
        prose=result.get("prose", ""),
        summary=result.get("summary", ""),
        choices=choices[:3],
    )

    return {
        "writer_output": writer_output,
        "rewrite_count": state.rewrite_count + (1 if state.critic_output and not state.critic_output.approved else 0),
    }


# ──────────────────────────────────────────────
# JSON parsing utilities
# ──────────────────────────────────────────────

def _parse_writer_json(raw: str, chapter_number: int) -> dict:
    """Parse writer LLM output with multiple fallback strategies.

    Strategy 1: Direct json.loads after stripping markdown fences
    Strategy 2: Fix unescaped newlines in JSON string values
    Strategy 3: Find balanced JSON block via brace counting
    Strategy 4: Field-by-field regex extraction (last resort)
    """
    import re

    text = _extract_json(raw)

    # ── Strategy 1: Direct parse ──
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.debug("Writer parse strategy 1 (direct) failed")

    # ── Strategy 2: Fix common LLM JSON issues ──
    try:
        fixed = _fix_json_string_values(text)
        return json.loads(fixed)
    except (json.JSONDecodeError, Exception):
        logger.debug("Writer parse strategy 2 (fix newlines) failed")

    # ── Strategy 3: Find balanced { ... } block ──
    try:
        balanced = _extract_balanced_json(text)
        if balanced:
            fixed2 = _fix_json_string_values(balanced)
            return json.loads(fixed2)
    except (json.JSONDecodeError, Exception):
        logger.debug("Writer parse strategy 3 (balanced braces) failed")

    # ── Strategy 4: Field-by-field regex extraction ──
    logger.warning("Writer JSON: all direct parse strategies failed, using field extraction")
    return _extract_fields_by_regex(text, chapter_number)


def _fix_json_string_values(text: str) -> str:
    """Fix unescaped newlines and control chars inside JSON string values."""
    import re

    result = []
    i = 0
    in_string = False
    escape_next = False

    for i, ch in enumerate(text):
        if escape_next:
            result.append(ch)
            escape_next = False
            continue

        if ch == '\\' and in_string:
            result.append(ch)
            escape_next = True
            continue

        if ch == '"':
            in_string = not in_string
            result.append(ch)
            continue

        if in_string:
            if ch == '\n':
                result.append('\\n')
            elif ch == '\r':
                result.append('\\r')
            elif ch == '\t':
                result.append('\\t')
            else:
                result.append(ch)
        else:
            result.append(ch)

    return ''.join(result)


def _extract_balanced_json(text: str) -> str | None:
    """Extract the first balanced { ... } block from text."""
    start = text.find('{')
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape_next = False

    for i in range(start, len(text)):
        ch = text[i]

        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"' and not escape_next:
            in_string = not in_string
            continue
        if in_string:
            continue

        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return text[start:i + 1]

    return None


def _extract_fields_by_regex(text: str, chapter_number: int) -> dict:
    """Extract individual fields from malformed JSON using regex.

    This is the last resort when json.loads completely fails.
    It extracts prose, title, summary, and choices individually.
    """
    import re

    result = {}

    # Extract chapter_title
    title_match = re.search(r'"chapter_title"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
    result["chapter_title"] = title_match.group(1) if title_match else f"Chương {chapter_number}"

    # Extract summary
    summary_match = re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)"', text)
    result["summary"] = summary_match.group(1).replace('\\n', ' ') if summary_match else ""

    # Extract prose — this is the hardest because it can be very long with newlines
    # Strategy: find "prose": " then scan forward for the closing quote
    prose_start = re.search(r'"prose"\s*:\s*"', text)
    if prose_start:
        start_pos = prose_start.end()
        prose_chars = []
        escape_next = False
        for i in range(start_pos, len(text)):
            ch = text[i]
            if escape_next:
                if ch == 'n':
                    prose_chars.append('\n')
                elif ch == '"':
                    prose_chars.append('"')
                elif ch == '\\':
                    prose_chars.append('\\')
                elif ch == 't':
                    prose_chars.append('\t')
                else:
                    prose_chars.append(ch)
                escape_next = False
                continue
            if ch == '\\':
                escape_next = True
                continue
            if ch == '"':
                break  # End of prose string
            prose_chars.append(ch)
        result["prose"] = ''.join(prose_chars)
    else:
        # Absolute last resort: strip obvious JSON artifacts from raw text
        cleaned = text
        # Remove JSON keys and structure
        cleaned = re.sub(r'^\s*\{?\s*$', '', cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r'^\s*\}?\s*$', '', cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r'"(chapter_title|summary|choices|prose|id|text|risk_level|consequence_hint)"\s*:', '', cleaned)
        cleaned = re.sub(r'[\[\]{},]', '', cleaned)
        cleaned = cleaned.strip().strip('"')
        result["prose"] = cleaned
        logger.error("Writer: could not extract prose field, using cleaned raw text")

    # Extract choices
    choices = []
    choices_block = re.search(r'"choices"\s*:\s*\[(.*?)\]', text, re.DOTALL)
    if choices_block:
        choice_pattern = re.finditer(
            r'\{\s*'
            r'"id"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
            r'"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
            r'"risk_level"\s*:\s*(\d+)\s*,\s*'
            r'"consequence_hint"\s*:\s*"((?:[^"\\]|\\.)*)"',
            choices_block.group(1)
        )
        for m in choice_pattern:
            choices.append({
                "id": m.group(1),
                "text": m.group(2),
                "risk_level": int(m.group(3)),
                "consequence_hint": m.group(4),
            })

    # Also try a more lenient choice pattern (keys in any order)
    if not choices and choices_block:
        choice_objects = re.finditer(r'\{([^}]+)\}', choices_block.group(1))
        for obj_match in choice_objects:
            obj_text = obj_match.group(1)
            c = {}
            for key in ["id", "text", "consequence_hint"]:
                val_match = re.search(rf'"{key}"\s*:\s*"((?:[^"\\]|\\.)*)"', obj_text)
                if val_match:
                    c[key] = val_match.group(1)
            risk_match = re.search(r'"risk_level"\s*:\s*(\d+)', obj_text)
            if risk_match:
                c["risk_level"] = int(risk_match.group(1))
            if c.get("text"):
                choices.append(c)

    result["choices"] = choices
    logger.info(f"Writer regex extraction: title={bool(title_match)}, prose={len(result.get('prose',''))} chars, "
                f"summary={bool(summary_match)}, choices={len(choices)}")

    return result


def _extract_json(text: str) -> str:
    """Extract JSON from LLM response, handling various wrapping formats."""
    import re

    text = text.strip()

    # Strip markdown code fences: ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    # If still not starting with {, try to find the first { ... } block
    if not text.startswith("{"):
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            text = match.group(0)

    return text

