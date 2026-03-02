"""Per-Scene Critic — dual-layer quality gate.

Layer 1: Heuristic Critic (sync, instant) — structural checks
Layer 2: Async LLM Critic (background) — quality scoring, feeds next scene
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

from langchain_core.messages import HumanMessage, SystemMessage

if TYPE_CHECKING:
    from app.models.story import Scene

from app.narrative.world_context import get_world_context

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Layer 1: Heuristic Critic (sync, zero latency)
# ──────────────────────────────────────────────

class HeuristicResult:
    """Result of heuristic checks."""
    __slots__ = ("score", "issues", "auto_fixes")

    def __init__(self):
        self.score: float = 10.0       # Start perfect, deduct for issues
        self.issues: list[str] = []
        self.auto_fixes: list[str] = []


def heuristic_scene_critic(
    scene: "Scene",
    skill_name: str = "",
) -> HeuristicResult:
    """Run instant structural checks on a generated scene.

    Returns a HeuristicResult with score, issues found, and auto-fixes applied.
    Zero latency — no LLM calls.
    """
    result = HeuristicResult()
    prose = scene.prose or ""
    choices = scene.choices or []

    # ── 1. Prose length check ──
    prose_len = len(prose)
    if prose_len < 200:
        result.score -= 3.0
        result.issues.append(f"Prose quá ngắn ({prose_len} chars, cần ≥200)")
    elif prose_len < 400:
        result.score -= 1.0
        result.issues.append(f"Prose hơi ngắn ({prose_len} chars)")
    elif prose_len > 3000:
        result.score -= 1.5
        result.issues.append(f"Prose quá dài ({prose_len} chars, nên ≤2000)")

    # ── 2. Choice count ──
    if len(choices) < 3:
        result.score -= 2.0
        result.issues.append(f"Chỉ có {len(choices)} choices (cần 3)")
    elif len(choices) > 3:
        result.score -= 0.5
        result.issues.append(f"Có {len(choices)} choices (chỉ nên 3)")

    # ── 3. Duplicate choices ──
    choice_texts = [c.text.strip().lower() for c in choices if c.text]
    if len(choice_texts) != len(set(choice_texts)):
        result.score -= 2.0
        result.issues.append("Có choices trùng nội dung")

    # ── 4. Risk level range ──
    for c in choices:
        if c.risk_level < 1 or c.risk_level > 5:
            result.score -= 1.0
            result.issues.append(f"Choice '{c.text[:30]}' có risk={c.risk_level} ngoài [1-5]")
            # Auto-fix
            c.risk_level = max(1, min(5, c.risk_level))
            result.auto_fixes.append(f"Clamped risk to {c.risk_level}")

    # ── 5. Skill consistency check ──
    if skill_name:
        skill_in_prose = f"[{skill_name}]" in prose or skill_name.lower() in prose.lower()
        skill_in_choices = any(f"[{skill_name}]" in c.text for c in choices)

        # Prose mentions skill but no skill choice → minor issue
        if skill_in_prose and not skill_in_choices and scene.scene_type == "combat":
            result.score -= 1.0
            result.issues.append(
                f"Prose nhắc đến {skill_name} nhưng không có skill choice trong combat scene"
            )

    # ── 6. Empty consequence hints ──
    empty_hints = sum(1 for c in choices if not c.consequence_hint)
    if empty_hints > 0:
        result.score -= 0.5 * empty_hints
        result.issues.append(f"{empty_hints} choices thiếu consequence_hint")

    # ── 7. Prose has content (not just whitespace) ──
    if not prose.strip():
        result.score -= 5.0
        result.issues.append("Prose trống!")

    # Clamp score
    result.score = max(0.0, min(10.0, result.score))

    if result.issues:
        logger.info(
            f"HeuristicCritic: score={result.score:.1f}, "
            f"issues={len(result.issues)}, fixes={len(result.auto_fixes)}"
        )

    return result


# ──────────────────────────────────────────────
# Layer 2: Async LLM Critic (background, zero UX latency)
# ──────────────────────────────────────────────

_SCENE_CRITIC_PROMPT = """Bạn là Scene Critic trong hệ thống Isekai Narrative Engine.
Đánh giá NHANH chất lượng 1 scene (không phải toàn chapter).

## Tiêu chí (1-10):
- Prose quality: mượt mà, sinh động, có cảm xúc
- Beat adherence: scene có follow beat outline không
- Choice quality: 3 choices đa dạng, có ý nghĩa, tạo ra câu chuyện khác biệt
- Skill consistency: nếu có kỹ năng, prose phải tôn trọng mechanic/constraint
- Tone match: mood của scene phải khớp với beat mood

## Output JSON (KHÔNG markdown):
{
    "score": 8.0,
    "feedback": "1-2 câu nhận xét chính",
    "suggestion": "1 gợi ý cải thiện cho scene TIẾP THEO (không phải scene này)"
}

## Quy tắc:
1. Score >= 7 là tốt, không cần sửa
2. Feedback phải CỤ THỂ — "prose tốt" là KHÔNG chấp nhận được
3. Suggestion hướng về scene TIẾP THEO — giúp Writer cải thiện liên tục
4. NGẮN GỌN — tối đa 3 câu total"""

_SCENE_CRITIC_USER = """## Scene {scene_number}/{total_scenes}:
### Beat: {beat_description}
### Mood: {mood} | Tension: {tension}/10 | Type: {scene_type}

### Prose ({prose_length} chars):
{prose_preview}

### Choices:
{choices_text}

### Skill: {skill_info}"""


async def run_scene_critic_async(
    scene: "Scene",
    beat_description: str,
    total_scenes: int,
    skill_name: str,
    llm: object,
) -> dict | None:
    """Run LLM critic in background. Returns score + feedback dict.

    This is fire-and-forget — result stored in scene record
    and injected into next scene's prompt.
    """
    try:
        choices_text = "\n".join(
            f"  {i+1}. [{c.risk_level}] {c.text} — {c.consequence_hint}"
            for i, c in enumerate(scene.choices)
        )

        messages = [
            SystemMessage(content=get_world_context() + "\n\n---\n\n" + _SCENE_CRITIC_PROMPT),
            HumanMessage(content=_SCENE_CRITIC_USER.format(
                scene_number=scene.scene_number,
                total_scenes=total_scenes,
                beat_description=beat_description,
                mood=scene.mood,
                tension=scene.tension,
                scene_type=scene.scene_type,
                prose_length=len(scene.prose),
                prose_preview=scene.prose[:600],
                choices_text=choices_text,
                skill_info=skill_name or "Không có",
            )),
        ]

        logger.info(f"SceneCritic[async]: reviewing scene {scene.scene_number}")
        response = await llm.ainvoke(messages)
        content = response.content.strip()

        # Strip markdown fences
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        result = json.loads(content)

        score = float(result.get("score", 7.0))
        feedback = result.get("feedback", "")
        suggestion = result.get("suggestion", "")

        logger.info(
            f"SceneCritic[async]: scene {scene.scene_number} scored {score:.1f}"
        )

        return {
            "score": score,
            "feedback": feedback,
            "suggestion": suggestion,
        }

    except Exception as e:
        logger.warning(f"SceneCritic[async] failed: {e}")
        return None


def format_critic_for_next_scene(critic_result: dict | None) -> str:
    """Format critic output as a feedback string for the next scene's prompt."""
    if not critic_result:
        return ""

    parts = []
    score = critic_result.get("score", 0)
    feedback = critic_result.get("feedback", "")
    suggestion = critic_result.get("suggestion", "")

    if feedback:
        parts.append(f"Scene trước (score {score:.0f}/10): {feedback}")
    if suggestion:
        parts.append(f"Gợi ý: {suggestion}")

    return "\n".join(parts)
