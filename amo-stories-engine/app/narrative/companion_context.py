"""Companion Context builder — Phase 1.

Converts active CompanionProfile list into a structured prompt block
for injection into the pipeline context (context.py).

Also provides tag/tone guidance helpers aligned with
COMPANION_VILLAIN_GENDER_SPEC §1.1b.

DB access pattern: lazy singleton (matches world_state_store.py / ledger_store.py)
so pipeline nodes can call load_companion_context() without a db argument.
"""

from __future__ import annotations

import logging

from app.models.companion import AFFINITY_TIER_DESC, CompanionProfile

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Lazy DB singleton (pipeline-safe, no circular import)
# ──────────────────────────────────────────────

_db = None  # module-level singleton


def _get_db():
    """Return a connected StoryStateDB singleton (lazy-init)."""
    global _db
    if _db is None:
        from app.config import settings
        from app.memory.state import StoryStateDB
        _db = StoryStateDB(settings.db_file)
        _db.connect()
    return _db


# ──────────────────────────────────────────────
# Tag → companion role guidance
# ──────────────────────────────────────────────

_TAG_COMPANION_GUIDANCE: dict[str, str] = {
    "combat": (
        "Companion sát cánh trong mọi combat — có moment nguy hiểm riêng. "
        "KHÔNG để companion chỉ đứng xem."
    ),
    "romance": (
        "Cho phép romantic subtext tự nhiên khi affinity ≥ ally — "
        "khoảnh khắc nhỏ (ánh mắt, chần chừ, không nói thẳng). KHÔNG force romance."
    ),
    "mystery": (
        "Companion biết nhiều hơn nói. Hint qua hành động, không phải lời. "
        "Secret leak 1 mảnh nhỏ mỗi 3-4 scenes."
    ),
    "horror": (
        "Companion dễ bị tổn thương. Đặt companion vào tình huống nguy hiểm để tạo stakes. "
        "Player PHẢI chọn giữa companion và mục tiêu."
    ),
    "strategy": (
        "Companion phân tích trước player. Companion có thể SAI — "
        "tạo tension khi player chọn nghe hay không nghe."
    ),
    "politics": (
        "Companion đọc được subtext chính trị, biết ai đang dối. "
        "Cho companion bình luận ngầm về các cuộc nói chuyện."
    ),
    "cultivation": (
        "Companion có con đường tu luyện riêng — không giống player. "
        "Đôi khi hai con đường bổ trợ, đôi khi mâu thuẫn."
    ),
    "adventure": (
        "Companion là guide — biết thế giới hơn player ở nhiều khía cạnh. "
        "Dùng companion để world-build tự nhiên qua hành trình."
    ),
    "slice_of_life": (
        "Affinity tăng qua bữa ăn, trò chuyện bình thường. "
        "Khai thác moment mundane để build bond — không cần crisis."
    ),
}


# ──────────────────────────────────────────────
# Tone → affinity multiplier
# ──────────────────────────────────────────────

TONE_AFFINITY_MULTIPLIER: dict[str, float] = {
    "epic":        1.0,
    "dark":        0.75,
    "comedy":      1.2,
    "slice_of_life": 1.0,
    "mysterious":  0.9,
}


def get_tone_multiplier(tone: str) -> float:
    """Return the affinity delta multiplier for the given tone."""
    return TONE_AFFINITY_MULTIPLIER.get(tone, 1.0)


# ──────────────────────────────────────────────
# Context block builder
# ──────────────────────────────────────────────

def build_companion_context(
    companions: list[CompanionProfile],
    preference_tags: list[str] | None = None,
    tone: str = "",
    player_gender: str = "neutral",
) -> str:
    """Build the companion prompt block to inject into context.

    Args:
        companions: Active companions for this story.
        preference_tags: Story preference tags (for tag-specific guidance).
        tone: Story tone ("dark", "comedy", etc.)
        player_gender: Player gender for response_to_player_* selection.

    Returns:
        Formatted prompt string, or "" if no companions.
    """
    if not companions:
        return ""

    parts: list[str] = ["## Nhân vật đồng hành (Active Companions):"]

    for cp in companions:
        section = _format_companion_block(cp, player_gender=player_gender)
        parts.append(section)

    # Tag-specific guidance
    tag_guidance = _get_tag_guidance(preference_tags or [])
    if tag_guidance:
        parts.append("### Companion Behavior Guidance (Tags):")
        parts.extend(f"- {g}" for g in tag_guidance)

    # Tone reminder
    if tone in TONE_AFFINITY_MULTIPLIER:
        tone_note = _get_tone_note(tone)
        if tone_note:
            parts.append(f"### Tone ({tone}): {tone_note}")

    return "\n\n".join(parts)


def _format_companion_block(cp: CompanionProfile, player_gender: str = "neutral") -> str:
    """Format a single companion's block for the prompt."""
    lines: list[str] = []

    header = f"### {cp.name} — {cp.role.upper()} | Affinity: {cp.affinity_tier} ({cp.affinity})"
    lines.append(header)
    lines.append(f"- Tính cách: {cp.personality_core}")
    lines.append(f"- Trạng thái: {cp.status} | Cảm xúc: {cp.last_emotional_state}")

    if cp.ability and cp.ability.name:
        lines.append(
            f"- Ability: {cp.ability.name} — {cp.ability.description} "
            f"(kích hoạt: {cp.ability.activation_condition})"
        )
        if cp.ability.synergy_with_player:
            lines.append(f"- Synergy với player skill: {cp.ability.synergy_with_player}")

    # Tier warning
    tier_desc = AFFINITY_TIER_DESC.get(cp.affinity_tier, "")
    lines.append(f"⚠️ Tier [{cp.affinity_tier}]: {tier_desc}")

    # Unlock tiered backstory/secret
    if cp.affinity_tier in ("close", "bonded", "sworn") and cp.backstory_hidden:
        lines.append(f"[Backstory đã reveal]: {cp.backstory_hidden}")
    if cp.affinity_tier in ("bonded", "sworn") and cp.secret:
        lines.append(f"[Secret]: {cp.secret}")

    # Gender-specific response note
    if player_gender == "male" and cp.response_to_player_male:
        lines.append(f"[Phản ứng với player nam]: {cp.response_to_player_male}")
    elif player_gender == "female" and cp.response_to_player_female:
        lines.append(f"[Phản ứng với player nữ]: {cp.response_to_player_female}")

    return "\n".join(lines)


def _get_tag_guidance(tags: list[str]) -> list[str]:
    """Return tag-specific companion instructions for the Writer."""
    guidance: list[str] = []
    for tag in tags:
        note = _TAG_COMPANION_GUIDANCE.get(tag)
        if note:
            guidance.append(f"[{tag}] {note}")
    return guidance


def _get_tone_note(tone: str) -> str:
    notes = {
        "dark": "Trust khó earn, companion bộc lộ cảm xúc ít hơn. Affinity thay đổi chậm hơn.",
        "comedy": "Companion hài hước, affinity tăng dễ hơn. Failure không gây giảm affinity.",
        "slice_of_life": "Bond xây qua moment bình thường. Crisis không phải cách duy nhất.",
        "mysterious": "Companion không confirm tăng thân thiết. Tier ẩn với player.",
        "epic": "Companion cảm thấy như nhân vật của vận mệnh — sacrifice lớn, lời nói nặng.",
    }
    return notes.get(tone, "")


# ──────────────────────────────────────────────
# Loader helper (used by context.py)
# ──────────────────────────────────────────────

def load_companion_context(
    story_id: str,
    preference_tags: list[str] | None = None,
    tone: str = "",
    player_gender: str = "neutral",
) -> str:
    """Load active companions from DB and build context block.

    Uses the module-level lazy DB singleton — no db argument needed.
    Never raises; returns "" on any failure.

    Args:
        story_id: The current story id.
        preference_tags: Story preference tags.
        tone: Story tone.
        player_gender: Player gender for response profile selection.

    Returns:
        Formatted companion context string, or "" if no companions / on failure.
    """
    try:
        db = _get_db()
        companions = db.get_story_companions(story_id, active_only=True)
        if not companions:
            return ""
        ctx = build_companion_context(
            companions,
            preference_tags=preference_tags,
            tone=tone,
            player_gender=player_gender,
        )
        logger.info(
            f"CompanionContext: built block for {len(companions)} companion(s) "
            f"in story {story_id}"
        )
        return ctx
    except Exception as exc:
        logger.warning(f"CompanionContext: failed to build context ({exc}) — skipping")
        return ""
