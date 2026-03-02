"""Phase 1 Triggers — NCE, Emissary, and Floor context directives.

Provides hard trigger functions that translate player state numbers
into ACTIONABLE directives for the Planner prompt. Philosophy:
  - STRUCTURE is hard (trigger conditions, branch count, choice types)
  - CONTENT is soft (planner/writer decide how to tell it)

Used by: adaptive_context_builder.format_adaptive_prompt()
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.adaptive import AdaptiveContext


# ──────────────────────────────────────────────
# Floor Hints
# ──────────────────────────────────────────────

FLOOR_HINTS = {
    1: (
        "Floor 1 — Luật cơ bản.\n"
        "LAW MODIFIER: Không có. Skill hoạt động bình thường.\n"
        "MÔI TRƯỜNG: Ổn định, giới thiệu thế giới.\n"
        "PROSE: Mô tả cảnh vật rõ ràng, màu sắc đúng, bóng đổ tự nhiên."
    ),
    2: (
        "Floor 2 — Môi trường bắt đầu phản ứng.\n"
        "LAW MODIFIER: Element shifts nhẹ — đôi khi skill có side effect bất ngờ.\n"
        "MÔI TRƯỜNG: Cảnh vật phản ứng với cảm xúc player (subtle).\n"
        "PROSE: Hints nhẹ — 'gió đổi chiều khi anh bước qua', "
        "'ánh sáng lung linh như đáp lại nỗi lo'."
    ),
    3: (
        "Floor 3 — ⚠️ NCE ZONE.\n"
        "LAW MODIFIER: skill_power = base_power × (identity_coherence / 100)\n"
        "→ Nếu coherence = 60 thì skill chỉ mạnh 60% —  PHẢI thể hiện trong prose.\n"
        "MÔI TRƯỜNG: Phản chiếu identity — cảnh vật lệch, màu sắc sai, "
        "bóng đổ ngược, reflection không khớp.\n"
        "PROSE: 'Bóng của anh di chuyển chậm hơn... hay nhanh hơn?', "
        "'Mặt nước phản chiếu khuôn mặt không hoàn toàn là anh'.\n"
        "⚠️ Đây là trigger zone cho NCE — Narrative Confrontation Event."
    ),
    4: (
        "Floor 4 — Laws of reality bend.\n"
        "LAW MODIFIER: Unique Skill evolution pressure — skill có thể "
        "tự biến đổi ngoài ý muốn nếu identity_coherence < 50.\n"
        "MÔI TRƯỜNG: Không gian phi Euclid. Thời gian không tuyến tính.\n"
        "PROSE: 'Bước chân đưa anh đến nơi anh đã ở — hay sẽ ở?', "
        "'Skill kích hoạt trước khi anh nghĩ đến nó'."
    ),
    5: (
        "Floor 5 — Final floor. Everything converges.\n"
        "LAW MODIFIER: Tất cả modifier trước cộng dồn. "
        "Sacrifice có thể được yêu cầu để tiến tiếp.\n"
        "MÔI TRƯỜNG: Phản ánh toàn bộ journey — echoes từ mọi floor trước.\n"
        "PROSE: 'Mỗi bước là một ký ức. Mỗi breath là một lựa chọn đã qua.'"
    ),
}


def get_floor_hint(floor: int) -> str:
    """Return tower floor context hint for planner."""
    return FLOOR_HINTS.get(floor, f"Floor {floor} — Unknown territory.")


# ──────────────────────────────────────────────
# General Shadow Voice (per archetype)
# ──────────────────────────────────────────────

GENERAL_SHADOW = {
    "vanguard": {
        "general": "Vorn",
        "voice": (
            "Vorn thì thầm: 'Ngươi phá vỡ vì muốn bảo vệ. "
            "Nhưng đã bao nhiêu thứ đổ vỡ vì ngươi?' "
            "— giọng đau đớn, không ác ý."
        ),
    },
    "catalyst": {
        "general": "Vorn",
        "voice": (
            "Vorn nhìn thẳng: 'Ngươi tạo ra bão, nhưng không bao giờ "
            "sống trong bão đó. Ai gánh hậu quả?' "
            "— giọng kiên quyết nhưng hiểu biết."
        ),
    },
    "sovereign": {
        "general": "Azen",
        "voice": (
            "Azen nhẹ nhàng: 'Ngươi hy sinh họ vì lý tưởng. "
            "Nhưng lý tưởng của ngươi CÓ THẬT KHÔNG, hay chỉ là cái cớ?' "
            "— giọng cha mẹ giải thích sự thật khó."
        ),
    },
    "seeker": {
        "general": "Mireth",
        "voice": (
            "Mireth lạnh lùng: 'Ngươi tìm sự thật. "
            "Nhưng ngươi ĐÃ SẴN SÀNG cho cái giá của nó chưa?' "
            "— giọng clinical, như bác sĩ chẩn đoán."
        ),
    },
    "tactician": {
        "general": "Kha",
        "voice": (
            "Kha chính xác: 'Ngươi tính toán tất cả. "
            "Nhưng tự do lựa chọn của ngươi — ngươi dùng nó "
            "để cướp tự do của ai?' — giọng lạnh, không cảm xúc."
        ),
    },
    "wanderer": {
        "general": "Kha",
        "voice": (
            "Kha bình thản: 'Ngươi gọi đó là tự do. "
            "Ta gọi đó là trốn chạy. Kết quả giống nhau.' "
            "— giọng không phán xét, chỉ nêu sự thật."
        ),
    },
}


# ──────────────────────────────────────────────
# Emissary Philosophy
# ──────────────────────────────────────────────

EMISSARY_PHILOSOPHY = {
    "kaen": "Hoà bình thật sự cần kẻ đủ mạnh để áp đặt nó.",
    "sira": "Năng lực không được kiểm soát sẽ huỷ hoại người sở hữu.",
    "thol": "Kẻ đủ mạnh không cần chọn phe — chỉ cần chọn survival.",
}


# ──────────────────────────────────────────────
# NCE Hard Trigger
# ──────────────────────────────────────────────

def check_nce_trigger(ctx: AdaptiveContext) -> str | None:
    """Check if NCE should be triggered.

    Trigger: instability >= 60 AND current_floor >= 3 AND not completed yet.
    Returns formatted NCE directive for planner, or None.
    """
    # Guard: NCE only happens once per story
    if getattr(ctx, 'nce_completed', False):
        return None

    if ctx.identity_instability < 60 or ctx.current_floor < 3:
        return None

    # Urgency level — both axes matter
    if ctx.identity_instability >= 80 or ctx.identity_coherence <= 30:
        urgency = "CRITICAL"
    elif ctx.identity_instability >= 70 or ctx.identity_coherence <= 45:
        urgency = "HIGH"
    else:
        urgency = "STANDARD"

    # General shadow voice
    archetype = ctx.archetype.lower() if ctx.archetype else "vanguard"
    shadow = GENERAL_SHADOW.get(archetype, GENERAL_SHADOW["vanguard"])
    general_name = ctx.assigned_general or shadow["general"]

    # Third path availability
    if ctx.identity_anchor >= 40:
        third_path = (
            "  Choice 3 — CON ĐƯỜNG THỨ BA (UNLOCKED — identity_anchor đủ):\n"
            "    'Không chấp nhận hoàn toàn, không từ chối hoàn toàn — "
            "tìm cách tích hợp cũ và mới'\n"
            "    → Player giữ core identity nhưng ABSORB bài học từ drift\n"
            "    → Unique Skill hybrid: gốc + element mới\n"
            "    → Khó nhất nhưng reward cao nhất"
        )
    else:
        third_path = (
            "  Choice 3 — CON ĐƯỜNG THỨ BA (LOCKED — cần identity_anchor >= 40):\n"
            "    Nếu player cố chọn → thất bại, rơi về Choice 1 hoặc 2"
        )

    # Form C: Seeker/Tactician get quiet introspection, not forced entity
    if archetype in ("seeker", "tactician"):
        opening_form = (
            "   - Hình thức: khoảnh khắc tịch lặng / một mình / "
            "câu hỏi tự nảy sinh — KHÔNG bắt buộc có entity xuất hiện\n"
            "   - Player tự đối diện bản thân qua suy tư, không qua ảo ảnh\n"
            "     — PLANNER TỰ CHỌN cách thực hiện"
        )
    else:
        opening_form = (
            "   - Hình thức: giấc mơ / gương phản chiếu / ảo ảnh / ritual\n"
            "     — PLANNER TỰ CHỌN hình thức\n"
            "   - Player đối diện 'phiên bản drift' của chính mình"
        )

    return (
        f"⚠️ NCE TRIGGER — NARRATIVE CONFRONTATION EVENT (Urgency: {urgency})\n\n"
        f"CHAPTER NÀY LÀ NCE. PHẢI tuân theo cấu trúc sau:\n\n"
        f"## KHUNG BẮT BUỘC:\n\n"
        f"1. OPENING (2-3 beats):\n"
        f"{opening_form}\n\n"
        f"2. GENERAL SHADOW (1-2 beats):\n"
        f"   - Hình bóng/tiếng nói của General {general_name} xuất hiện\n"
        f"   - General KHÔNG tấn công — chỉ đặt câu hỏi\n"
        f"   - {shadow['voice']}\n\n"
        f"3. CONFRONTATION PEAK (2-3 beats):\n"
        f"   - Player đối mặt: 'Mình đang trở thành ai?'\n"
        f"   - Tension: 8-10\n"
        f"   - Đây là emotional peak — không phải combat peak\n\n"
        f"4. THE CHOICE (beat cuối — BẮT BUỘC 3 choices):\n"
        f"  Choice 1 — ACCEPT DRIFT:\n"
        f"    'Chấp nhận sự thay đổi trong bản thân'\n"
        f"    → identity mutation, instability giảm nhưng coherence shift\n"
        f"    → Unique Skill có thể transform\n\n"
        f"  Choice 2 — REJECT:\n"
        f"    'Từ chối thay đổi, giữ vững bản ngã ban đầu'\n"
        f"    → identity_anchor tăng mạnh (+15-20)\n"
        f"    → instability giảm, coherence phục hồi\n"
        f"    → General sẽ coi player là MỐI ĐE DỌA\n\n"
        f"{third_path}\n\n"
        f"## NỘI DUNG TỰ DO:\n"
        f"Hình thức confrontation, dialogue, visual, setting, "
        f"companion có mặt hay không — planner/writer tự quyết."
    )


# ──────────────────────────────────────────────
# Emissary Actionable Triggers
# ──────────────────────────────────────────────

def check_emissary_trigger(ctx: AdaptiveContext) -> str | None:
    """Check emissary sympathy level and return actionable directive.

    Tiers:
      < 20  → None (no action)
      20-49 → Hints (subtle tells)
      50-79 → Reveal zone (crisis + reveal)
      >= 80 → Recruitment (full invitation)
    """
    sympathy = ctx.emissary_sympathy
    if sympathy < 20:
        return None

    emissary = ctx.assigned_emissary or "Emissary"
    emissary_key = emissary.lower()
    philosophy = EMISSARY_PHILOSOPHY.get(emissary_key, "")

    if sympathy >= 80:
        return _emissary_recruitment(emissary, sympathy, philosophy)
    if sympathy >= 50:
        return _emissary_reveal(emissary, sympathy, philosophy)
    return _emissary_hints(emissary, sympathy)


def _emissary_hints(name: str, sympathy: int) -> str:
    return (
        f"📡 EMISSARY HINT MODE — {name} (sympathy: {sympathy})\n"
        f"{name} vẫn đóng vai NPC bình thường nhưng:\n"
        f"- Đôi khi biết điều KHÔNG NÊN BIẾT\n"
        f"- Prose hint: 'dường như biết trước đường đi' / "
        f"'ánh mắt lướt qua như đã thấy cảnh này'\n"
        f"- KHÔNG reveal thân phận. Chỉ gieo nghi ngờ cho player tinh ý."
    )


def _emissary_reveal(name: str, sympathy: int, philosophy: str) -> str:
    return (
        f"⚠️ EMISSARY REVEAL ZONE — {name} (sympathy: {sympathy}/80)\n\n"
        f"Trong 1-2 chapter tới, TẠO TÌNH HUỐNG CRISIS trong đó {name} "
        f"BUỘC PHẢI reveal thân phận Empire.\n"
        f"Planner tự chọn crisis: combat / betrayal / rescue.\n\n"
        f"SAU REVEAL — beat cuối PHẢI có 3 choices:\n"
        f"  1. TỪ CHỐI / PHẢN BỘI → Combat mini-boss + identity_anchor +10\n"
        f"  2. CHẤP NHẬN HỢP TÁC → Empire route partial + empire_resonance +20\n"
        f"  3. GIẢ VỜ ĐỒNG Ý → Double-agent path + unresolved_allegiance flag\n\n"
        f"NỘI DUNG TỰ DO: crisis nào, {name} nói gì, setting — planner/writer quyết.\n"
        f"KHUNG BẮT BUỘC: reveal PHẢI xảy ra, 3 choices PHẢI có."
    )


def _emissary_recruitment(name: str, sympathy: int, philosophy: str) -> str:
    return (
        f"🔴 EMISSARY RECRUITMENT — {name} (sympathy: {sympathy})\n\n"
        f"{name} CHÍNH THỨC mời player gia nhập Empire.\n"
        f"- {name} giải thích TẠI SAO Empire tồn tại (không phải evil monologue)\n"
        f"- Empire philosophy: \"{philosophy}\"\n"
        f"- Cho thấy BENEFIT cụ thể player sẽ nhận\n\n"
        f"3 choices — stakes CAO:\n"
        f"  1. TỪ CHỐI → {name} trở thành enemy, combat khó\n"
        f"  2. GIA NHẬP → Empire Route full unlock, empire_resonance +30\n"
        f"  3. GIẢ VỜ → Double-agent, rủi ro cực cao (General sẽ test)"
    )
