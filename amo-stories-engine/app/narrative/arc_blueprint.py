"""Story Arc Blueprint — defines the macro narrative structure for Phase 1.

Injects arc-specific guidance into the Planner prompt so that each chapter
knows WHERE it sits in the overall 5-act structure.

KEY DESIGN DECISIONS:
  - PERCENTAGE-BASED arcs, not fixed chapter ranges → adapts to any story length
  - DIRECTION-ONLY events → tells planner WHAT must happen, not WHEN/HOW
  - Planner retains full creative freedom within structural guardrails

No API calls — pure lookup based on chapter_number / estimated_total.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Arc:
    """One act in the story's macro structure."""
    name: str
    name_en: str
    progress_start: float   # 0.0 – 1.0
    progress_end: float     # 0.0 – 1.0
    tension_min: int
    tension_max: int
    pacing: str
    focus: str
    # DIRECTION: WHAT must happen (planner decides WHEN and HOW)
    narrative_directions: list[str] = field(default_factory=list)
    forbidden: list[str] = field(default_factory=list)
    scene_type_weights: str = ""
    companion_directive: str = ""
    chapter_type_default: str = "normal"  # normal / important / climax


# ── Phase 1: 5-Act Arc Blueprint ──
# estimated ~25 chapters, but adapts to any length via percentage

ARC_BLUEPRINT: list[Arc] = [
    # ━━━━━━━━━━━ ARC 1: 0-20% ━━━━━━━━━━━
    Arc(
        name="Thức Tỉnh",
        name_en="Awakening",
        progress_start=0.0,
        progress_end=0.20,
        tension_min=2,
        tension_max=5,
        pacing="slow → medium",
        focus=(
            "Khám phá thế giới mới, sinh tồn cơ bản, unique skill thức tỉnh. "
            "Player đang choáng ngợp — mọi thứ đều mới và đáng sợ. "
            "Xây dựng wonder + vulnerability. Cho player thời gian HỌC cách sống sót."
        ),
        narrative_directions=[
            "Player phải TỈNH DẬY ở thế giới lạ và đối mặt sinh tồn ngay lập tức",
            "Unique Skill phải THỨC TỈNH — player khám phá sức mạnh bản thân lần đầu",
            "Player phải GẶP COMPANION đầu tiên — người dẫn đường trong thế giới mới",
            "Phải có MỐI NGUY ĐẦU TIÊN thực sự — buộc player cam kết với thế giới mới",
        ],
        forbidden=[
            "Faction war", "Major betrayal", "Arc boss fight",
            "Political intrigue phức tạp", "Player bị gán vai anh hùng cứu thế",
        ],
        scene_type_weights="exploration 40%, discovery 25%, dialogue 20%, rest 10%, combat 5%",
        companion_directive="Companion xuất hiện lần đầu — mysterious, giữ khoảng cách, lore guide nhẹ",
        chapter_type_default="normal",
    ),

    # ━━━━━━━━━━━ ARC 2: 20-40% ━━━━━━━━━━━
    Arc(
        name="Rèn Luyện",
        name_en="Forging",
        progress_start=0.20,
        progress_end=0.40,
        tension_min=4,
        tension_max=6,
        pacing="medium",
        focus=(
            "Training, skill development, liên minh sơ bộ. "
            "Player bắt đầu hiểu politics & factions của thế giới. "
            "Companion bond deepens. Player có mục tiêu rõ hơn. "
            "Xây dựng nền tảng cho conflict ở arc sau."
        ),
        narrative_directions=[
            "Player phải có SKILL MASTERY MOMENT — bắt đầu kiểm soát unique skill",
            "Phải có FIRST FACTION CONTACT — biết đến các thế lực trong thế giới",
            "Companion phải HINT BÍ MẬT — 1-2 moment lộ backstory/bí mật nhẹ",
            "Phải có FIRST MORAL DILEMMA — lựa chọn không có đáp án hoàn toàn đúng",
        ],
        forbidden=[
            "Final boss", "World-ending threat", "Companion death",
        ],
        scene_type_weights="combat 25%, dialogue 25%, exploration 20%, discovery 15%, rest 15%",
        companion_directive="Companion trở thành ally thực sự — banter tăng, tin tưởng xây dần",
        chapter_type_default="normal",
    ),

    # ━━━━━━━━━━━ ARC 3: 40-65% ━━━━━━━━━━━
    Arc(
        name="Thử Lửa",
        name_en="Trial by Fire",
        progress_start=0.40,
        progress_end=0.65,
        tension_min=5,
        tension_max=8,
        pacing="medium → fast",
        focus=(
            "Conflict chính bùng nổ. Stakes tăng đáng kể. "
            "Player đối mặt moral dilemmas nghiêm trọng, identity bị thử thách. "
            "PHẢI có MIDPOINT TWIST: reveal bí mật lớn về thế giới hoặc bản thân. "
            "Ít nhất 1 chapter khiến player DỰA lưng vào tường."
        ),
        narrative_directions=[
            "Phải có MIDPOINT TWIST — reveal bí mật lớn (thế giới, thân thế, hoặc companion)",
            "Phải có MAJOR CONFRONTATION — forces player dùng MỌI THỨ đã học",
            "FACTION CONFLICT phải leo thang — player bị kéo vào politics dù muốn hay không",
            "Phải có IDENTITY CRISIS — player đối mặt với câu hỏi: mình THỰC SỰ là ai?",
        ],
        forbidden=[
            "Easy victory", "Deus ex machina", "Final resolution của toàn bộ conflict",
        ],
        scene_type_weights="combat 30%, dialogue 25%, exploration 15%, discovery 15%, rest 15%",
        companion_directive="Companion bị đặt trong nguy hiểm hoặc conflict lợi ích — test player loyalty",
        chapter_type_default="important",
    ),

    # ━━━━━━━━━━━ ARC 4: 65-85% ━━━━━━━━━━━
    Arc(
        name="Sụp Đổ & Tái Sinh",
        name_en="Fall and Rise",
        progress_start=0.65,
        progress_end=0.85,
        tension_min=3,
        tension_max=7,
        pacing="slow → medium (DIP rồi rebuild)",
        focus=(
            "LOWEST POINT → RECOVERY. Player mất thứ gì đó quan trọng. "
            "Phát triển nhân vật sâu — TẠI SAO player tiếp tục dù mọi thứ tệ? "
            "Motivation questioned. Companion crisis (có thể tạm mất companion). "
            "Phải có ÍT NHẤT 2 chapter slow pacing (rest + character development)."
        ),
        narrative_directions=[
            "Phải có DEVASTATING LOSS — pyrrhic victory hoặc thất bại thực sự",
            "COMPANION CRISIS — companion bị bắt/bị thương/bỏ đi/phản bội tạm",
            "Phải có RECOVERY ARC — player tìm lại lý do chiến đấu, không phải power-up",
            "POWER EVOLUTION — player đạt level mới qua PAIN, không qua luck",
        ],
        forbidden=[
            "Easy comeback", "Instant power-up", "Villain giải thích tất cả qua monologue",
        ],
        scene_type_weights="rest 25%, dialogue 25%, combat 20%, discovery 15%, exploration 15%",
        companion_directive="Companion absence hoặc strained relationship — reunion nếu có phải EARNED",
        chapter_type_default="normal",
    ),

    # ━━━━━━━━━━━ ARC 5: 85-100% ━━━━━━━━━━━
    Arc(
        name="Cao Trào",
        name_en="Climax",
        progress_start=0.85,
        progress_end=1.0,
        tension_min=7,
        tension_max=10,
        pacing="fast → climax",
        focus=(
            "TẤT CẢ THREADS HỘI TỤ. Final confrontation. "
            "Skill mastery showcase — player dùng mọi thứ đã học. "
            "Sacrifice required — chiến thắng có GIÁ THẬT. "
            "Resolution mở ra câu hỏi cho Phase 2 — không giải quyết HẾT."
        ),
        narrative_directions=[
            "ALL ALLIES GATHER — đồng minh tập hợp, chuẩn bị cuối cùng",
            "CLIMAX BATTLE — arc boss / final conflict, mọi thứ at stake",
            "SKILL MASTERY — player dùng unique skill ở level chỉ họ mới có thể",
            "SACRIFICE — companion, power, relationships, hoặc part of identity",
            "RESOLUTION — aftermath, seeds cho Phase 2, mixed emotions (không happy ending sạch)",
        ],
        forbidden=[
            "Clean happy ending", "All problems solved", "No consequences",
        ],
        scene_type_weights="combat 35%, dialogue 20%, discovery 20%, exploration 10%, rest 15%",
        companion_directive="Companion ở đỉnh loyalty — sẵn sàng sacrifice hoặc đã sacrifice",
        chapter_type_default="climax",
    ),
]

# Default estimated total chapters for Phase 1
ESTIMATED_TOTAL_CHAPTERS = 25


def get_current_arc(chapter_number: int, total_chapters: int = ESTIMATED_TOTAL_CHAPTERS) -> Arc | None:
    """Return the Arc for the given chapter, based on story progress percentage."""
    progress = chapter_number / total_chapters  # e.g. ch5/25 = 0.20

    for arc in ARC_BLUEPRINT:
        if arc.progress_start <= progress < arc.progress_end:
            return arc

    # At 100% or beyond — return last arc
    if progress >= 1.0:
        return ARC_BLUEPRINT[-1]

    return None


def get_arc_guidance(chapter_number: int, total_chapters: int = ESTIMATED_TOTAL_CHAPTERS) -> str:
    """Build arc-specific guidance text to inject into the Planner prompt.

    Uses percentage-based arc detection:
      progress = chapter_number / total_chapters

    Returns formatted guidance with:
    - Current arc name and position
    - Progress percentage in overall story
    - Tension bounds and pacing
    - Narrative directions (WHAT, not WHEN/HOW)
    - Forbidden patterns
    - Scene type weights and companion directive
    """
    arc = get_current_arc(chapter_number, total_chapters)
    if not arc:
        return (
            "⚠️ Ngoài Phase 1 Blueprint — tự do sáng tạo, "
            "giữ tension ổn định và tôn trọng story đã xây."
        )

    # Story-level progress
    story_progress = chapter_number / total_chapters
    story_pct = int(story_progress * 100)

    # Position within arc
    arc_span = arc.progress_end - arc.progress_start
    arc_progress = (story_progress - arc.progress_start) / arc_span if arc_span > 0 else 0
    arc_pct = min(int(arc_progress * 100), 100)

    # Position description
    if arc_pct <= 15:
        position_desc = "ĐẦU ARC — setup và giới thiệu"
    elif arc_pct >= 85:
        position_desc = "CUỐI ARC — climax/transition sang arc tiếp"
    elif arc_pct < 45:
        position_desc = "Đầu arc — đang build up"
    elif arc_pct < 65:
        position_desc = "Giữa arc — rising action"
    else:
        position_desc = "Cuối arc — build toward arc climax"

    # Format narrative directions
    directions_text = "\n".join(f"  → {d}" for d in arc.narrative_directions)

    # Forbidden
    forbidden_text = ", ".join(arc.forbidden) if arc.forbidden else "Không có"

    # Progress bar visualization
    filled = int(story_pct / 5)  # 20 chars total
    bar = "█" * filled + "░" * (20 - filled)

    # Arc transition hint at arc boundary
    transition_hint = ""
    if arc_pct >= 85:
        arc_idx = ARC_BLUEPRINT.index(arc)
        if arc_idx < len(ARC_BLUEPRINT) - 1:
            next_arc = ARC_BLUEPRINT[arc_idx + 1]
            transition_hint = (
                f"\n\n🔄 **SẮP CHUYỂN ARC:** Arc tiếp theo là "
                f"**{next_arc.name}** ({next_arc.name_en}) — "
                f"tension {next_arc.tension_min}–{next_arc.tension_max}, "
                f"pacing {next_arc.pacing}. "
                f"Kết chapter này nên TẠO CẦU NỐI tự nhiên."
            )
        else:
            transition_hint = (
                "\n\n🏁 **GẦN KẾT THÚC PHASE 1.** Resolution phải vừa "
                "GIẢI QUYẾT conflict chính vừa MỞ RA câu hỏi cho Phase 2. "
                "Mixed emotions, không happy ending sạch."
            )

    # Check uncompleted directions hint
    directions_note = (
        "\n\n💡 **Lưu ý:** Các direction trên là WHAT phải xảy ra trong arc này. "
        "Planner TỰ QUYẾT ĐỊNH khi nào và bằng cách nào. "
        "Nếu direction nào chưa xảy ra và arc gần kết thúc → ưu tiên nó."
    )

    return (
        f"## 📖 STORY ARC BLUEPRINT — ARC {ARC_BLUEPRINT.index(arc) + 1}/5: "
        f"{arc.name} ({arc.name_en})\n\n"
        f"**Tiến trình:** [{bar}] {story_pct}% câu chuyện "
        f"(Chapter {chapter_number}/{total_chapters})\n"
        f"**Vị trí trong arc:** {arc_pct}% — {position_desc}\n"
        f"**Pacing:** {arc.pacing}\n"
        f"**Tension range:** {arc.tension_min}–{arc.tension_max}\n"
        f"**Chapter type mặc định:** {arc.chapter_type_default}\n\n"
        f"**Focus:** {arc.focus}\n\n"
        f"**Narrative Directions (WHAT phải xảy ra, planner quyết WHEN/HOW):**\n"
        f"{directions_text}{directions_note}\n\n"
        f"**CẤM:** {forbidden_text}\n\n"
        f"**Scene type weights gợi ý:** {arc.scene_type_weights}\n"
        f"**Companion:** {arc.companion_directive}"
        f"{transition_hint}\n\n"
        f"⚠️ PHẢI tôn trọng tension range. "
        f"NỘI DUNG tự do sáng tạo, STRUCTURE theo blueprint."
    )
