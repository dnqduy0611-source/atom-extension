"""Amoisekai — Onboarding: Quiz answers → Seed Identity + Archetype + DNA.

This module maps quiz results deterministically to archetypes and DNA tags,
then uses Gemini to generate a narrative origin story.
"""

from __future__ import annotations

from app.models.player import (
    Archetype,
    CurrentIdentity,
    DNAAffinityTag,
    PlayerState,
    SeedIdentity,
    SkillCategory,
    UniqueSkill,
)
from app.models.identity import IdentityEvent, IdentityEventType
from app.narrative.world_context import get_world_context


# ──────────────────────────────────────────────
# Quiz Question Keys (7 everyday-life questions)
# ──────────────────────────────────────────────

# q1_pressure:   face_it | analyze | ask_help | adapt
# q2_injustice:  intervene | help_quietly | observe_first | avoid
# q3_conflict:   mediate | side_right | stay_neutral | manipulate
# q4_sacrifice:  take_it | decline | negotiate | defer
# q5_secret:     keep_it | tell_affected | investigate | use_it
# q6_failure:    try_again | reflect | seek_comfort | move_on
# q7_freedom:    challenge | create | connect | wander


# ──────────────────────────────────────────────
# Archetype Mapping
# ──────────────────────────────────────────────

# Score matrix: each answer contributes points to archetypes
_ARCHETYPE_SCORES: dict[str, dict[str, dict[str, int]]] = {
    "q1_pressure": {
        "face_it":  {"vanguard": 3, "catalyst": 0, "sovereign": 1, "seeker": 0, "tactician": 0, "wanderer": 1},
        "analyze":  {"vanguard": 0, "catalyst": 0, "sovereign": 0, "seeker": 2, "tactician": 3, "wanderer": 0},
        "ask_help": {"vanguard": 0, "catalyst": 3, "sovereign": 1, "seeker": 0, "tactician": 0, "wanderer": 0},
        "adapt":    {"vanguard": 0, "catalyst": 0, "sovereign": 0, "seeker": 1, "tactician": 1, "wanderer": 3},
    },
    "q2_injustice": {
        "intervene":    {"vanguard": 3, "catalyst": 2, "sovereign": 1, "seeker": 0, "tactician": 0, "wanderer": 0},
        "help_quietly": {"vanguard": 0, "catalyst": 3, "sovereign": 0, "seeker": 0, "tactician": 2, "wanderer": 0},
        "observe_first":{"vanguard": 0, "catalyst": 0, "sovereign": 0, "seeker": 3, "tactician": 1, "wanderer": 1},
        "avoid":        {"vanguard": 0, "catalyst": 0, "sovereign": 0, "seeker": 1, "tactician": 0, "wanderer": 3},
    },
    "q3_conflict": {
        "mediate":      {"vanguard": 0, "catalyst": 1, "sovereign": 3, "seeker": 0, "tactician": 1, "wanderer": 0},
        "side_right":   {"vanguard": 1, "catalyst": 0, "sovereign": 0, "seeker": 3, "tactician": 0, "wanderer": 0},
        "stay_neutral": {"vanguard": 0, "catalyst": 0, "sovereign": 0, "seeker": 1, "tactician": 0, "wanderer": 3},
        "manipulate":   {"vanguard": 0, "catalyst": 0, "sovereign": 1, "seeker": 0, "tactician": 3, "wanderer": 0},
    },
    "q4_sacrifice": {
        "take_it":   {"vanguard": 2, "catalyst": 0, "sovereign": 1, "seeker": 0, "tactician": 1, "wanderer": 1},
        "decline":   {"vanguard": 0, "catalyst": 3, "sovereign": 0, "seeker": 0, "tactician": 0, "wanderer": 0},
        "negotiate": {"vanguard": 0, "catalyst": 0, "sovereign": 3, "seeker": 1, "tactician": 2, "wanderer": 0},
        "defer":     {"vanguard": 0, "catalyst": 0, "sovereign": 0, "seeker": 2, "tactician": 0, "wanderer": 3},
    },
    "q5_secret": {
        "keep_it":       {"vanguard": 1, "catalyst": 0, "sovereign": 0, "seeker": 0, "tactician": 0, "wanderer": 2},
        "tell_affected": {"vanguard": 1, "catalyst": 3, "sovereign": 2, "seeker": 0, "tactician": 0, "wanderer": 0},
        "investigate":   {"vanguard": 0, "catalyst": 0, "sovereign": 0, "seeker": 3, "tactician": 1, "wanderer": 0},
        "use_it":        {"vanguard": 0, "catalyst": 0, "sovereign": 1, "seeker": 0, "tactician": 3, "wanderer": 0},
    },
    "q6_failure": {
        "try_again":    {"vanguard": 3, "catalyst": 1, "sovereign": 1, "seeker": 0, "tactician": 0, "wanderer": 0},
        "reflect":      {"vanguard": 0, "catalyst": 0, "sovereign": 0, "seeker": 3, "tactician": 2, "wanderer": 0},
        "seek_comfort": {"vanguard": 0, "catalyst": 2, "sovereign": 0, "seeker": 0, "tactician": 0, "wanderer": 1},
        "move_on":      {"vanguard": 0, "catalyst": 0, "sovereign": 0, "seeker": 0, "tactician": 1, "wanderer": 3},
    },
    "q7_freedom": {
        "challenge": {"vanguard": 3, "catalyst": 0, "sovereign": 1, "seeker": 1, "tactician": 0, "wanderer": 0},
        "create":    {"vanguard": 0, "catalyst": 1, "sovereign": 0, "seeker": 2, "tactician": 0, "wanderer": 1},
        "connect":   {"vanguard": 0, "catalyst": 3, "sovereign": 2, "seeker": 0, "tactician": 0, "wanderer": 0},
        "wander":    {"vanguard": 0, "catalyst": 0, "sovereign": 0, "seeker": 0, "tactician": 0, "wanderer": 3},
    },
}

# DNA mapping: each answer contributes to DNA tag affinities
_DNA_SCORES: dict[str, dict[str, list[str]]] = {
    "q1_pressure": {
        "face_it":  ["bloodline", "chaos"],
        "analyze":  ["mind", "tech"],
        "ask_help": ["charm", "oath"],
        "adapt":    ["shadow", "relic"],
    },
    "q2_injustice": {
        "intervene":    ["oath", "bloodline"],
        "help_quietly": ["charm", "tech"],
        "observe_first":["mind", "relic"],
        "avoid":        ["shadow", "tech"],
    },
    "q3_conflict": {
        "mediate":      ["charm", "oath"],
        "side_right":   ["mind", "relic"],
        "stay_neutral": ["shadow", "relic"],
        "manipulate":   ["mind", "charm"],
    },
    "q4_sacrifice": {
        "take_it":   ["chaos", "bloodline"],
        "decline":   ["oath", "charm"],
        "negotiate": ["mind", "charm"],
        "defer":     ["shadow", "relic"],
    },
    "q5_secret": {
        "keep_it":       ["oath", "shadow"],
        "tell_affected": ["oath", "chaos"],
        "investigate":   ["mind", "relic"],
        "use_it":        ["shadow", "mind"],
    },
    "q6_failure": {
        "try_again":    ["bloodline", "chaos"],
        "reflect":      ["mind", "tech"],
        "seek_comfort": ["charm", "oath"],
        "move_on":      ["shadow", "relic"],
    },
    "q7_freedom": {
        "challenge": ["bloodline", "tech"],
        "create":    ["relic", "mind"],
        "connect":   ["charm", "oath"],
        "wander":    ["shadow", "chaos"],
    },
}


def map_quiz_to_archetype(quiz_answers: dict) -> Archetype:
    """Deterministic: quiz answers → archetype with highest total score."""
    totals: dict[str, int] = {a.value: 0 for a in Archetype}

    for question_key, answer_map in _ARCHETYPE_SCORES.items():
        answer = quiz_answers.get(question_key, "")
        if answer in answer_map:
            for archetype, score in answer_map[answer].items():
                totals[archetype] += score

    # Highest score wins; tie-break: first in enum order
    best = max(totals, key=lambda k: totals[k])
    return Archetype(best)


def map_quiz_to_dna(quiz_answers: dict) -> list[DNAAffinityTag]:
    """Deterministic: quiz answers → top 3 DNA tags."""
    totals: dict[str, int] = {t.value: 0 for t in DNAAffinityTag}

    for question_key, answer_map in _DNA_SCORES.items():
        answer = quiz_answers.get(question_key, "")
        if answer in answer_map:
            for tag in answer_map[answer]:
                totals[tag] += 1

    # Top 3 tags by score
    sorted_tags = sorted(totals.items(), key=lambda x: x[1], reverse=True)
    return [DNAAffinityTag(tag) for tag, _score in sorted_tags[:3]]


def map_archetype_to_skill_category(archetype: Archetype) -> SkillCategory:
    """Deterministic: archetype → primary skill category."""
    mapping = {
        Archetype.VANGUARD: SkillCategory.MANIFESTATION,
        Archetype.CATALYST: SkillCategory.CONTRACT,
        Archetype.SOVEREIGN: SkillCategory.MANIPULATION,
        Archetype.SEEKER: SkillCategory.PERCEPTION,
        Archetype.TACTICIAN: SkillCategory.OBFUSCATION,
        Archetype.WANDERER: SkillCategory.MANIFESTATION,  # Wanderer gets random-ish
    }
    return mapping.get(archetype, SkillCategory.MANIFESTATION)


# GDD balance triangle: each category is countered by others
_SKILL_COUNTERS: dict[str, list[str]] = {
    "manifestation": ["obfuscation", "perception"],
    "manipulation": ["perception", "contract"],
    "contract": ["manifestation", "obfuscation"],
    "perception": ["obfuscation", "manipulation"],
    "obfuscation": ["contract", "manifestation"],
}


def _build_unique_skill(
    category: SkillCategory,
    dna: list[DNAAffinityTag],
    name: str = "",
    description: str = "",
    activation_cost: str = "",
) -> UniqueSkill:
    """Build a UniqueSkill with deterministic balance fields + AI-generated flavor."""
    return UniqueSkill(
        name=name,
        description=description,
        category=category.value,
        trait_tags=[t.value for t in dna[:2]],  # Top 2 DNA tags
        countered_by=_SKILL_COUNTERS.get(category.value, []),
        resilience=100.0,
        instability=0.0,
        is_revealed=False,  # Secret by default (GDD 3.5)
        activation_cost=activation_cost,
    )


# ──────────────────────────────────────────────
# Onboarding Prompt (for Gemini)
# ──────────────────────────────────────────────

ONBOARDING_SYSTEM_PROMPT = """Bạn là một AI tạo nhân vật cho game Isekai.
Dựa trên câu trả lời quiz và archetype đã xác định, hãy tạo:

1. core_values: 3 giá trị cốt lõi (tiếng Anh, lowercase)
2. personality_traits: 3 tính cách (tiếng Anh, lowercase)
3. motivation: 1 câu tiếng Việt — động lực sống
4. fear: 1 câu tiếng Việt — nỗi sợ lớn nhất
5. origin_story: 2-3 câu tiếng Việt — câu chuyện nguồn gốc isekai
6. unique_skill: Kỹ năng độc nhất — BẠN quyết định toàn bộ

QUAN TRỌNG:
- Trả lời dạng JSON thuần, không markdown
- core_values và personality_traits phải phù hợp với quiz answers
- Nếu có backstory (tiểu sử nhân vật trước khi bị isekai), hãy:
  + Dùng backstory để làm giàu core_values và personality_traits (giữ hướng từ quiz)
  + Kết hợp backstory vào origin_story một cách tự nhiên
  + Motivation và fear nên phản ánh chi tiết từ backstory
- Nếu KHÔNG có backstory, tạo origin_story chung chung gợi mở
- unique_skill: BẠN quyết định TOÀN BỘ dựa trên nhân vật này:
  + category: chọn 1 trong 5 hệ (manifestation, manipulation, contract, perception, obfuscation)
    - manifestation: Hiện Thực Hóa — sức mạnh trực tiếp, biến ý chí thành hiện thực
    - manipulation: Thao Túng — thay đổi môi trường, con người, quy luật
    - contract: Khế Ước — lời thề, ràng buộc, đổi ngang
    - perception: Linh Giác — nhận biết, phân tích, phát hiện ẩn giấu
    - obfuscation: Ẩn Giấu — che dấu, lừa dối, ảo ảnh
  + trait_tags: chọn 2 trong 8 DNA tags phù hợp nhất (shadow, oath, bloodline, tech, chaos, mind, charm, relic)
  + countered_by: chọn 2 category có thể khắc chế skill này
  + name: tên tiếng Việt, ngắn gọn (đặt tên như võ công/pháp thuật tiên hiệp)
  + description: 1-2 câu tiếng Việt, thần bí và gợi mở
  + activation_cost: một cái giá phải trả khi dùng skill (tiếng Việt, mang tính narrative)
  + Dựa trên backstory nếu có để tạo skill độc đáo hơn

JSON format:
{{
    "core_values": ["value1", "value2", "value3"],
    "personality_traits": ["trait1", "trait2", "trait3"],
    "motivation": "...",
    "fear": "...",
    "origin_story": "...",
    "unique_skill": {{
        "category": "manifestation|manipulation|contract|perception|obfuscation",
        "trait_tags": ["tag1", "tag2"],
        "countered_by": ["category1", "category2"],
        "name": "Tên kỹ năng tiếng Việt",
        "description": "Mô tả 1-2 câu",
        "activation_cost": "Chi phí kích hoạt"
    }}
}}"""

ONBOARDING_USER_PROMPT = """Quiz answers:
{quiz_json}

Archetype: {archetype} ({archetype_display})
DNA Affinity: {dna_tags}

Backstory: {backstory}

Hãy tạo seed identity và unique skill cho nhân vật này.
Lưu ý: unique skill phải phản ánh con người thật của nhân vật, không nhất thiết phải theo archetype."""


async def create_seed_from_quiz(
    quiz_answers: dict,
    llm: object,  # ChatGoogleGenerativeAI or compatible
    backstory: str = "",
) -> tuple[SeedIdentity, Archetype, list[DNAAffinityTag], UniqueSkill]:
    """Quiz (5 questions) + optional backstory → SeedIdentity + Archetype + DNA + UniqueSkill.

    Steps:
    1. Deterministic: quiz → archetype (highest score)
    2. Deterministic: quiz → DNA tags (top 3)
    3. Deterministic: archetype → skill category
    4. AI (Gemini): Generate origin story + personality + unique skill

    Returns:
        Tuple of (SeedIdentity, Archetype, DNA tags, UniqueSkill)
    """
    import json

    # 1. Deterministic mapping
    archetype = map_quiz_to_archetype(quiz_answers)
    dna = map_quiz_to_dna(quiz_answers)

    # 2. AI-generated narrative elements + unique skill (AI decides everything)
    from langchain_core.messages import HumanMessage, SystemMessage

    messages = [
        SystemMessage(content=get_world_context() + "\n\n---\n\n" + ONBOARDING_SYSTEM_PROMPT),
        HumanMessage(content=ONBOARDING_USER_PROMPT.format(
            quiz_json=json.dumps(quiz_answers, ensure_ascii=False, indent=2),
            archetype=archetype.value,
            archetype_display=archetype.display_name,
            dna_tags=", ".join(t.value for t in dna),
            backstory=backstory or "Không có backstory",
        )),
    ]

    response = await llm.ainvoke(messages)
    content = response.content.strip()

    # Parse JSON response (strip markdown fences if present)
    if content.startswith("```"):
        content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    result = json.loads(content)

    seed = SeedIdentity(
        core_values=result.get("core_values", []),
        personality_traits=result.get("personality_traits", []),
        motivation=result.get("motivation", ""),
        fear=result.get("fear", ""),
        origin_story=result.get("origin_story", ""),
    )

    # Build unique skill entirely from AI response
    skill_data = result.get("unique_skill", {})
    ai_category = skill_data.get("category", "")
    # Validate category, fallback to archetype mapping
    valid_categories = {c.value for c in SkillCategory}
    if ai_category not in valid_categories:
        ai_category = map_archetype_to_skill_category(archetype).value

    skill = UniqueSkill(
        name=skill_data.get("name", ""),
        description=skill_data.get("description", ""),
        category=ai_category,
        trait_tags=skill_data.get("trait_tags", [t.value for t in dna[:2]]),
        countered_by=skill_data.get("countered_by", _SKILL_COUNTERS.get(ai_category, [])),
        resilience=100.0,
        instability=0.0,
        is_revealed=False,
        activation_cost=skill_data.get("activation_cost", ""),
    )

    return seed, archetype, dna, skill


def create_seed_from_quiz_sync(
    quiz_answers: dict,
    backstory: str = "",
) -> tuple[SeedIdentity, Archetype, list[DNAAffinityTag], UniqueSkill]:
    """Synchronous fallback — deterministic only, no AI call.

    Useful for testing and offline mode.
    If backstory is provided, it is appended to the origin_story.
    """
    archetype = map_quiz_to_archetype(quiz_answers)
    dna = map_quiz_to_dna(quiz_answers)
    skill_category = map_archetype_to_skill_category(archetype)

    # Pre-defined traits per archetype
    archetype_seeds: dict[str, dict] = {
        "vanguard": {
            "core_values": ["courage", "justice", "strength"],
            "personality_traits": ["bold", "protective", "direct"],
            "motivation": "Đối diện mọi thử thách, không lùi bước",
            "fear": "Quá yếu đuối để bảo vệ người quan trọng",
        },
        "catalyst": {
            "core_values": ["compassion", "sacrifice", "change"],
            "personality_traits": ["empathetic", "selfless", "inspiring"],
            "motivation": "Thay đổi thế giới trở nên tốt đẹp hơn",
            "fear": "Sự hy sinh của mình trở nên vô nghĩa",
        },
        "sovereign": {
            "core_values": ["leadership", "loyalty", "order"],
            "personality_traits": ["charismatic", "strategic", "decisive"],
            "motivation": "Xây dựng một thế lực mạnh mẽ và công bằng",
            "fear": "Bị phản bội bởi những người tin tưởng",
        },
        "seeker": {
            "core_values": ["knowledge", "truth", "discovery"],
            "personality_traits": ["analytical", "curious", "patient"],
            "motivation": "Khám phá bí mật ẩn giấu của thế giới",
            "fear": "Sự thiếu hiểu biết dẫn đến bi kịch",
        },
        "tactician": {
            "core_values": ["intelligence", "control", "efficiency"],
            "personality_traits": ["calculating", "adaptable", "perceptive"],
            "motivation": "Nắm bắt mọi biến số, kiểm soát cục diện",
            "fear": "Một biến số ngoài tầm kiểm soát phá hủy mọi kế hoạch",
        },
        "wanderer": {
            "core_values": ["freedom", "independence", "experience"],
            "personality_traits": ["free-spirited", "resourceful", "elusive"],
            "motivation": "Sống theo cách riêng, không bị ràng buộc",
            "fear": "Bị giam cầm hoặc bắt buộc phục tùng",
        },
    }

    defaults = archetype_seeds.get(archetype.value, archetype_seeds["wanderer"])

    default_origin = (
        "Một linh hồn từ thế giới khác, bất ngờ bị cuốn vào vòng xoáy "
        "của vũ trụ tu tiên. Ký ức trước đây mờ nhạt, chỉ còn lại "
        "bản năng và trực giác dẫn lối."
    )
    origin = f"{backstory} {default_origin}" if backstory else default_origin

    seed = SeedIdentity(
        core_values=defaults["core_values"],
        personality_traits=defaults["personality_traits"],
        motivation=defaults["motivation"],
        fear=defaults["fear"],
        origin_story=origin,
    )

    # Fallback unique skills per archetype
    _fallback_skills: dict[str, dict] = {
        "vanguard": {
            "name": "Bá Vương Quân",
            "description": "Sức mạnh bùng nổ khi đối diện kẻ thù mạnh hơn, y tính hóa thành công phá.",
            "activation_cost": "Mỗi lần sử dụng, một phần ký ức về người yêu thương sẽ mờ nhạt.",
        },
        "catalyst": {
            "name": "Thiên Địa Khế",
            "description": "Tạo khế ước với trời đất, đổi đau khổ lấy phép tắc cho người khác.",
            "activation_cost": "Phải chịu đựng nỗi đau của đối phương được chữa lành.",
        },
        "sovereign": {
            "name": "Vạn Nhân Tâm",
            "description": "Cảm nhận và ảnh hưởng cảm xúc người khác trong phạm vi rộng.",
            "activation_cost": "Cảm xúc của chính mình bị áp chế trong thời gian sử dụng.",
        },
        "seeker": {
            "name": "Thiên Nhãn Thông",
            "description": "Nhìn thấu bản chất của vạn vật, phát hiện ẩn giấu và dối trá.",
            "activation_cost": "Mỗi lần nhìn quá sâu, thị lực bình thường giảm trong 1 ngày.",
        },
        "tactician": {
            "name": "Vô Hình Chi Lưới",
            "description": "Tạo một màng lưới ảo ảnh che giấu hành động và ý định thực sự.",
            "activation_cost": "Phải giữ tâm trí hoàn toàn tập trung, mất khả năng cảm nhận nguy hiểm.",
        },
        "wanderer": {
            "name": "Phong Lai Vô Tích",
            "description": "Tồn tại giữa thế giới như gió, không ai có thể truy dấu hay trói buộc.",
            "activation_cost": "Mỗi lần biến mất, một mối liên kết với người khác sẽ yếu đi.",
        },
    }

    skill_defaults = _fallback_skills.get(archetype.value, _fallback_skills["wanderer"])
    skill = _build_unique_skill(
        category=skill_category,
        dna=dna,
        name=skill_defaults["name"],
        description=skill_defaults["description"],
        activation_cost=skill_defaults["activation_cost"],
    )

    return seed, archetype, dna, skill


def create_initial_player(
    user_id: str,
    name: str,
    seed: SeedIdentity,
    archetype: Archetype,
    dna: list[DNAAffinityTag],
    skill: UniqueSkill | None = None,
    play_style: "PlayStyleState | None" = None,
    gender: str = "neutral",
) -> PlayerState:
    """Create a fully initialized PlayerState after onboarding."""
    from app.models.adaptive import PlayStyleState as _PSS

    return PlayerState(
        user_id=user_id,
        name=name,
        gender=gender,
        seed_identity=seed,
        current_identity=CurrentIdentity(
            active_values=seed.core_values.copy(),
            active_traits=seed.personality_traits.copy(),
            current_motivation=seed.motivation,
        ),
        archetype=archetype.value,
        dna_affinity=dna,
        unique_skill=skill,
        play_style=play_style or _PSS(),
    )


def create_seed_event(player: PlayerState) -> IdentityEvent:
    """Create the SEED_CREATED identity event for logging."""
    return IdentityEvent(
        player_id=player.id,
        event_type=IdentityEventType.SEED_CREATED,
        chapter_number=0,
        description=f"Player {player.name} onboarded as {player.archetype}",
        after_snapshot=player.seed_identity.model_dump(),
    )
