"""Soul Forge Engine — 3-Phase Identity Extraction → Unique Skill.

Scenes 1-5: Deterministic micro-narratives with branching variants
  - Scene 2 branches by void_anchor (4 variants)
  - Scene 3 branches by moral_core (5 variant groups)
  - Scene 4 branches by void_anchor (4 variants)
Phase 2: Free-text soul fragment parsing
Phase 3: Behavioral fingerprint computation
Forge: AI generates truly unique skill from all 3 phases
"""

from __future__ import annotations

import json
import logging
import statistics
from datetime import datetime, timezone

from app.models.soul_forge import (
    BehavioralFingerprint,
    IdentitySignals,
    SceneChoice,
    SceneData,
    SoulForgeSession,
)
from app.models.player import SubSkill, UniqueSkill
from app.models.unique_skill_growth import PrincipleResonance
from app.engine.domain import get_axis_blind_spot

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════
# SCENE DATA — Hard-coded Micro-Narratives
# ══════════════════════════════════════════════

# Signal maps for each choice in each scene
_SCENE_1 = {
    "title": "The Awakening Void",
    "text": (
        "Thế giới cũ đã buông tay ngươi.\n\n"
        "Không đau. Không tiếc nuối. Chỉ là một khoảnh khắc — "
        "rồi mọi thứ tan biến. Ánh sáng, âm thanh, hình hài, ký ức. "
        "Tất cả trả về cho hư vô.\n\n"
        "Nhưng ngươi vẫn... còn đây. Một mảnh ý thức trôi giữa khoảng không vô tận. "
        "Không biết đã bao lâu.\n\n"
        "Rồi ngươi cảm nhận được một thứ gì đó. Rất xa, rất mờ. "
        "Như tiếng vọng từ cuối đường hầm. "
        "Nhiều thứ đang kéo ngươi về nhiều hướng — "
        "nhưng linh hồn ngươi chỉ có thể bám vào MỘT.\n\n"
        "Thứ ngươi chọn sẽ trở thành neo giữ linh hồn — "
        "nền tảng cho sức mạnh và con người mới của ngươi ở thế giới bên kia."
    ),
    "choices": [
        {
            "text": "Một sợi dây kết nối — tôi cảm nhận ai đó đang chờ tôi. Tôi không muốn mất họ.",
            "signals": {
                "void_anchor": "connection",
                "attachment_style": "relational",
                "primary_dna": ["oath", "charm"],
            },
        },
        {
            "text": "Một luồng sức mạnh — như ngọn lửa chưa tắt. Tôi chưa xong. Tôi cần mạnh hơn.",
            "signals": {
                "void_anchor": "power",
                "attachment_style": "power-seeking",
                "primary_dna": ["chaos", "bloodline"],
            },
        },
        {
            "text": "Một mảnh ký ức — hình ảnh mờ nhạt nhưng sắc như dao. Tôi cần biết sự thật.",
            "signals": {
                "void_anchor": "knowledge",
                "attachment_style": "analytical",
                "primary_dna": ["mind", "relic"],
            },
        },
        {
            "text": "Một khoảng lặng — không phải trống rỗng, mà là chứa đựng tất cả. Sâu hơn bóng tối. Nặng hơn lời nói. Tôi nhận ra mình đã luôn thuộc về nó.",
            "signals": {
                "void_anchor": "silence",
                "attachment_style": "cautious",
                "primary_dna": ["shadow", "tech"],
            },
        },
    ],
}

# Scene 2 has 4 variants based on Scene 1 choice
_SCENE_2_VARIANTS = {
    # Variant A — chose "connection"
    "connection": {
        "title": "The Echo Test — Bonds",
        "text": (
            "Hư vô đáp lại ngươi. Nó chiếu một hình ảnh — "
            "không phải ký ức, mà như thể nó đang thử ngươi.\n\n"
            "Ngươi thấy hai nhóm người. Một phía đang gọi ngươi, "
            "khuôn mặt thân quen dù ngươi không nhớ. "
            "Phía kia — một đứa trẻ bị bỏ lại."
        ),
        "choices": [
            {
                "text": "Chạy về phía quen thuộc — ngươi tin bản năng",
                "signals": {
                    "moral_core": "loyalty",
                    "decision_pattern": "instinctive",
                    "dna_boost": ["oath"],
                },
            },
            {
                "text": "Đến đứa trẻ — người cần bạn hơn",
                "signals": {
                    "moral_core": "sacrifice",
                    "decision_pattern": "empathetic",
                    "dna_boost": ["charm"],
                },
            },
            {
                "text": "Đứng yên — quan sát trước đã",
                "signals": {
                    "moral_core": "analysis",
                    "decision_pattern": "calculated",
                    "dna_boost": ["mind"],
                },
            },
        ],
    },
    # Variant B — chose "power"
    "power": {
        "title": "The Echo Test — Storm",
        "text": (
            "Năng lượng trong ngươi bùng lên. Từ bóng tối, "
            "hai thực thể xuất hiện — một đang gầm gừ, một đang cười.\n\n"
            "Cả hai đều mạnh. Cả hai đều đang nhìn ngươi."
        ),
        "choices": [
            {
                "text": "Tấn công trước — không cần biết ai là bạn",
                "signals": {
                    "moral_core": "aggression",
                    "decision_pattern": "aggressive",
                    "dna_boost": ["chaos"],
                },
            },
            {
                "text": "Quan sát — kẻ cười có thể nguy hiểm hơn",
                "signals": {
                    "moral_core": "analysis",
                    "decision_pattern": "calculated",
                    "dna_boost": ["mind"],
                },
            },
            {
                "text": "Để năng lượng tràn ra — xem chuyện gì xảy ra",
                "signals": {
                    "moral_core": "surrender",
                    "decision_pattern": "intuitive",
                    "dna_boost": ["bloodline"],
                },
            },
        ],
    },
    # Variant C — chose "knowledge"
    "knowledge": {
        "title": "The Echo Test — Memory",
        "text": (
            "Mảnh ký ức sắc nét hơn. Một cuốn sách đang cháy. "
            "Ngươi chỉ đọc được một dòng trước khi nó biến mất.\n\n"
            "Dòng chữ vẫn còn cháy trong tâm trí ngươi."
        ),
        "choices": [
            {
                "text": "Cố nhớ dòng chữ bằng mọi giá",
                "signals": {
                    "moral_core": "determination",
                    "decision_pattern": "obsessive",
                    "dna_boost": ["mind"],
                },
            },
            {
                "text": "Để nó cháy — có thứ mới sẽ viết",
                "signals": {
                    "moral_core": "acceptance",
                    "decision_pattern": "adaptive",
                    "dna_boost": ["chaos"],
                },
            },
            {
                "text": "Cố cứu cuốn sách — dù biết không kịp",
                "signals": {
                    "moral_core": "preservation",
                    "decision_pattern": "protective",
                    "dna_boost": ["relic"],
                },
            },
        ],
    },
    # Variant D — chose "silence"
    "silence": {
        "title": "The Echo Test — Whisper",
        "text": (
            "Sự im lặng trở nên sâu hơn. Từ trong đó, "
            "một giọng nói — không phải ngươi, nhưng biết ngươi.\n\n"
            "\"Ta đã đợi ngươi rất lâu.\""
        ),
        "choices": [
            {
                "text": "Hỏi: \"Ngươi là ai?\"",
                "signals": {
                    "moral_core": "curiosity",
                    "decision_pattern": "investigative",
                    "dna_boost": ["mind"],
                },
            },
            {
                "text": "Nói: \"Tôi biết đây không có thật\"",
                "signals": {
                    "moral_core": "defiance",
                    "decision_pattern": "skeptical",
                    "dna_boost": ["tech"],
                },
            },
            {
                "text": "Im lặng đáp lại — nghe xem nó muốn gì",
                "signals": {
                    "moral_core": "patience",
                    "decision_pattern": "observant",
                    "dna_boost": ["shadow"],
                },
            },
        ],
    },
}

# Scene 5 — convergent (no choice)
_SCENE_5 = {
    "title": "The Forge",
    "text": (
        "Mọi thứ hội tụ lại. Mọi lựa chọn ngươi vừa đưa ra — "
        "chúng không biến mất. Chúng đang cháy, nung chảy, "
        "hòa vào nhau bên trong ngươi.\n\n"
        "Đây là khoảnh khắc ngươi được rèn.\n\n"
        "Lửa tắt. Ngươi cảm nhận thứ gì đó mới — sâu trong lồng ngực, "
        "như nhịp tim thứ hai. Ngươi không biết nó là gì.\n\n"
        "Nhưng nó là CỦA NGƯƠI."
    ),
}

# Soul Fragment prompts — contextual theo void_anchor từ Scene 1
_VOID_FRAGMENT_PREAMBLE = (
    "Lửa nung chảy mọi thứ — nhưng có thứ gì đó từ chối bị xóa. "
    "Một mảnh linh hồn, nhỏ nhưng không thể phá vỡ.\n\n"
)

_FRAGMENT_PROMPTS_BY_ANCHOR = {
    "connection": (
        _VOID_FRAGMENT_PREAMBLE
        + "Sợi dây nào ngươi không thể để đứt, "
        + "dù ngươi không còn nhớ nó là gì?"
    ),
    "power": (
        _VOID_FRAGMENT_PREAMBLE
        + "Ngọn lửa trong ngươi cháy vì điều gì? "
        + "Đừng nghĩ — chỉ cần nói."
    ),
    "knowledge": (
        _VOID_FRAGMENT_PREAMBLE
        + "Điều gì ngươi phải biết, dù nó đau đến đâu?"
    ),
    "silence": (
        _VOID_FRAGMENT_PREAMBLE
        + "Có điều gì, ở nơi sâu nhất, "
        + "ngươi chưa bao giờ nói ra?"
    ),
}

# Fallback nếu void_anchor chưa xác định
_SOUL_FRAGMENT_PROMPT = (
    _VOID_FRAGMENT_PREAMBLE
    + "Nếu ngươi chỉ được giữ lại DUY NHẤT một thứ khi bước vào thế giới mới "
    + "— đó là gì?"
)

_SOUL_FRAGMENT_BACKUP_PROMPTS = [
    "Có người từng nói với ngươi một câu mà ngươi không bao giờ quên. Câu đó là gì?",
    "Điều gì khiến ngươi nổi giận nhất — dù ngươi biết không nên?",
    "Nếu thế giới cũ biến mất, ngươi sẽ nhớ điều gì nhất?",
]


# ══════════════════════════════════════════════
# SCENE ROUTING
# ══════════════════════════════════════════════

def get_scene(session: SoulForgeSession) -> SceneData:
    """Return the current scene content based on session state."""

    if session.phase == "done":
        return SceneData(
            scene_id=0,
            title="Complete",
            text="Soul Forge đã hoàn tất.",
            phase="done",
        )

    if session.phase == "fragment":
        void_anchor = ""
        if session.scene_choices:
            void_anchor = session.scene_choices[0].signal_tags.get("void_anchor", "")
        fragment_text = _FRAGMENT_PROMPTS_BY_ANCHOR.get(void_anchor, _SOUL_FRAGMENT_PROMPT)
        return SceneData(
            scene_id=6,
            title="Soul Fragment",
            text=fragment_text,
            phase="fragment",
        )

    if session.phase == "forging":
        return SceneData(
            scene_id=7,
            title="Forging",
            text="Linh hồn ngươi đang được rèn...",
            phase="forging",
        )

    scene_id = session.current_scene

    if scene_id == 1:
        return SceneData(
            scene_id=1,
            title=_SCENE_1["title"],
            text=_SCENE_1["text"],
            choices=[
                {"text": c["text"], "index": i}
                for i, c in enumerate(_SCENE_1["choices"])
            ],
            phase="narrative",
        )

    if scene_id == 2:
        # Determine variant from Scene 1 choice
        if not session.scene_choices:
            return _error_scene("No Scene 1 choice recorded")
        void_anchor = session.scene_choices[0].signal_tags.get(
            "void_anchor", "connection"
        )
        variant = _SCENE_2_VARIANTS.get(void_anchor)
        if not variant:
            variant = _SCENE_2_VARIANTS["connection"]
        return SceneData(
            scene_id=2,
            title=variant["title"],
            text=variant["text"],
            choices=[
                {"text": c["text"], "index": i}
                for i, c in enumerate(variant["choices"])
            ],
            phase="narrative",
        )

    if scene_id == 3:
        group = _get_moral_core_group(session)
        variant = _SCENE_3_VARIANTS.get(group, _SCENE_3_VARIANTS["protective"])
        return SceneData(
            scene_id=3,
            title=variant["title"],
            text=variant["text"],
            choices=[
                {"text": c["text"], "index": i}
                for i, c in enumerate(variant["choices"])
            ],
            phase="narrative",
        )

    if scene_id == 4:
        void_anchor = "connection"
        if session.scene_choices:
            void_anchor = session.scene_choices[0].signal_tags.get(
                "void_anchor", "connection"
            )
        variant = _SCENE_4_VARIANTS.get(void_anchor, _SCENE_4_VARIANTS["connection"])
        return SceneData(
            scene_id=4,
            title=variant["title"],
            text=variant["text"],
            choices=[
                {"text": c["text"], "index": i}
                for i, c in enumerate(variant["choices"])
            ],
            phase="narrative",
        )

    if scene_id == 5:
        return SceneData(
            scene_id=5,
            title=_SCENE_5["title"],
            text=_SCENE_5["text"],
            choices=[],  # No choice — auto-advance to Phase 2
            phase="narrative",
        )

    return _error_scene(f"Unknown scene {scene_id}")


def _error_scene(msg: str) -> SceneData:
    return SceneData(scene_id=0, title="Error", text=msg, phase="narrative")


# ══════════════════════════════════════════════
# SCENE 3 VARIANTS (branched by moral_core from Scene 2)
# ══════════════════════════════════════════════

# Map 11+ moral_core values to 5 variant groups
_MORAL_CORE_GROUPS = {
    "loyalty": "protective",
    "sacrifice": "protective",
    "preservation": "protective",
    "aggression": "aggressive",
    "surrender": "aggressive",
    "analysis": "analytical",
    "determination": "analytical",
    "curiosity": "rebellious",
    "defiance": "rebellious",
    "acceptance": "patient",
    "patience": "patient",
}

_SCENE_3_VARIANTS = {
    # ── Protective souls: challenged on whether bonds are chains ──
    "protective": {
        "title": "Gương Phản Chiếu — Lòng Trung",
        "text": (
            "Hư vô rung chuyển. Từ vết nứt, một hình bóng bước ra — "
            "giống ngươi, nhưng mắt nó lạnh hơn. Nó đang cầm sợi dây "
            "buộc vào ai đó ngươi quen.\n\n"
            "\"Ngươi giữ họ vì yêu thương,\" nó nói, \"hay vì sợ cô đơn?\"\n\n"
            "Sợi dây bắt đầu siết chặt. Người kia đang đau."
        ),
        "choices": [
            {
                "text": "Cắt sợi dây — nếu đó là xiềng xích, tôi phải thả họ tự do",
                "signals": {
                    "conflict_response": "confront",
                    "risk_tolerance": 3,
                    "power_vs_connection": -0.5,
                },
            },
            {
                "text": "Giữ sợi dây — nhưng nới lỏng nó. Tôi bảo vệ, không giam giữ",
                "signals": {
                    "conflict_response": "negotiate",
                    "risk_tolerance": 2,
                    "power_vs_connection": -0.2,
                },
            },
            {
                "text": "Xông vào hình bóng — đây là ảo giác, tôi sẽ phá nó",
                "signals": {
                    "conflict_response": "confront",
                    "risk_tolerance": 3,
                    "power_vs_connection": 0.5,
                },
            },
        ],
    },
    # ── Aggressive souls: challenged on whether power without purpose is destruction ──
    "aggressive": {
        "title": "Gương Phản Chiếu — Ngọn Lửa",
        "text": (
            "Lửa bùng lên từ mọi phía. Hình bóng của bạn đứng giữa — "
            "nhưng nó to lớn hơn, mạnh hơn, và đang đốt cháy mọi thứ "
            "xung quanh mà không phân biệt.\n\n"
            "\"Ngươi muốn sức mạnh,\" nó gầm, \"nhưng ngươi có dám nhận "
            "hậu quả?\"\n\n"
            "Dưới chân nó — tro tàn của thứ từng quan trọng."
        ),
        "choices": [
            {
                "text": "Nuốt lửa — tôi sẽ kiểm soát nó, không để nó kiểm soát tôi",
                "signals": {
                    "conflict_response": "confront",
                    "risk_tolerance": 3,
                    "power_vs_connection": 0.8,
                },
            },
            {
                "text": "Dập lửa — sức mạnh vô nghĩa nếu chỉ để hủy diệt",
                "signals": {
                    "conflict_response": "negotiate",
                    "risk_tolerance": 1,
                    "power_vs_connection": -0.5,
                },
            },
            {
                "text": "Đi xuyên qua — cháy thì cháy, tôi không dừng lại",
                "signals": {
                    "conflict_response": "confront",
                    "risk_tolerance": 3,
                    "power_vs_connection": 0.3,
                },
            },
        ],
    },
    # ── Analytical souls: challenged on whether logic alone is enough ──
    "analytical": {
        "title": "Gương Phản Chiếu — Trí Tuệ",
        "text": (
            "Hình bóng ngồi giữa mê cung ký hiệu — bản đồ, công thức, "
            "chuỗi logic kéo dài vô tận. Nó đang tính toán mọi thứ, "
            "nhưng mê cung không có lối ra.\n\n"
            "\"Ngươi nghĩ mình đúng vì ngươi hiểu,\" nó nói, "
            "\"nhưng có thứ không thể hiểu — chỉ có thể cảm.\"\n\n"
            "Một cánh cửa xuất hiện — nhưng không có chìa khóa logic nào mở được."
        ),
        "choices": [
            {
                "text": "Phá cửa — đôi khi hành động nhanh hơn suy nghĩ",
                "signals": {
                    "conflict_response": "confront",
                    "risk_tolerance": 3,
                    "power_vs_connection": 0.3,
                },
            },
            {
                "text": "Ngồi xuống — câu trả lời sẽ đến nếu tôi đủ kiên nhẫn",
                "signals": {
                    "conflict_response": "withdraw",
                    "risk_tolerance": 1,
                    "power_vs_connection": -0.3,
                },
            },
            {
                "text": "Hỏi hình bóng — nếu nó là tôi, nó biết thứ tôi đang bỏ lỡ",
                "signals": {
                    "conflict_response": "negotiate",
                    "risk_tolerance": 2,
                    "power_vs_connection": -0.2,
                },
            },
        ],
    },
    # ── Rebellious souls: challenged on whether defiance is courage or fear ──
    "rebellious": {
        "title": "Gương Phản Chiếu — Hoài Nghi",
        "text": (
            "Hình bóng đứng giữa hai hàng — một bên là kẻ tuân lệnh, lặng lẽ "
            "bước đều. Bên kia là kẻ nổi loạn, đập phá lung tung "
            "nhưng không xây được gì.\n\n"
            "\"Ngươi luôn từ chối,\" nó mỉm cười, \"từ chối luật lệ, "
            "từ chối khuôn khổ, từ chối mọi thứ. Nhưng ta hỏi ngươi — "
            "ngươi có dám đứng lên VÌ một điều gì đó không? "
            "Hay ngươi chỉ giỏi nói KHÔNG?\"\n\n"
            "Cả hai hàng cùng quay sang nhìn ngươi."
        ),
        "choices": [
            {
                "text": "Tôi đứng vì chính mình — không cần lý do lớn lao",
                "signals": {
                    "conflict_response": "confront",
                    "risk_tolerance": 3,
                    "power_vs_connection": 0.5,
                },
            },
            {
                "text": "Tôi đứng vì người khác — ai đó cần tôi phá luật",
                "signals": {
                    "conflict_response": "negotiate",
                    "risk_tolerance": 2,
                    "power_vs_connection": -0.3,
                },
            },
            {
                "text": "Bước ra khỏi cả hai hàng — tôi không thuộc bên nào",
                "signals": {
                    "conflict_response": "withdraw",
                    "risk_tolerance": 2,
                    "power_vs_connection": 0.0,
                },
            },
        ],
    },
    # ── Patient souls: challenged on whether stillness is wisdom or paralysis ──
    "patient": {
        "title": "Gương Phản Chiếu — Tĩnh Lặng",
        "text": (
            "Hư vô trở nên yên tĩnh tuyệt đối. Hình bóng ngồi bất động — "
            "y hệt ngươi, cùng tư thế, cùng hơi thở.\n\n"
            "Nhưng quanh nó, mọi thứ đang mục ruỗng. Cây héo, "
            "đá vỡ, ánh sáng phai dần.\n\n"
            "\"Ngươi đợi,\" nó nói, \"nhưng thế giới không đợi ngươi. "
            "Có khi nào sự kiên nhẫn chỉ là cái cớ để không hành động?\""
        ),
        "choices": [
            {
                "text": "Đứng dậy — có lúc cần hành động dù chưa sẵn sàng",
                "signals": {
                    "conflict_response": "confront",
                    "risk_tolerance": 2,
                    "power_vs_connection": 0.3,
                },
            },
            {
                "text": "Tiếp tục ngồi — sự mục ruỗng cũng là một phần tự nhiên",
                "signals": {
                    "conflict_response": "withdraw",
                    "risk_tolerance": 1,
                    "power_vs_connection": -0.5,
                },
            },
            {
                "text": "Chạm vào hình bóng — nếu nó là tôi, tôi muốn hiểu nó",
                "signals": {
                    "conflict_response": "negotiate",
                    "risk_tolerance": 2,
                    "power_vs_connection": -0.2,
                },
            },
        ],
    },
}

# ══════════════════════════════════════════════
# SCENE 4 VARIANTS (branched by void_anchor from Scene 1)
# ══════════════════════════════════════════════

_SCENE_4_VARIANTS = {
    "connection": {
        "title": "Giá Của Sợi Dây",
        "text": (
            "Hư Vô vang lên lần cuối:\n\n"
            "\"Ngươi bám vào kết nối — nhưng thế giới mới "
            "sẽ thử sợi dây đó.\"\n\n"
            "Trước mắt: người ngươi yêu nhất đứng bên bờ vực. "
            "Giọng nói tiếp: \"Cứu họ và mất sức mạnh. "
            "Hoặc bước qua — và sức mạnh gấp đôi.\""
        ),
        "choices": [
            {
                "text": "Cứu họ — sức mạnh vô nghĩa nếu mất người mình bảo vệ",
                "signals": {
                    "sacrifice_type": "comfort",
                    "courage_vs_cleverness": "courage",
                },
            },
            {
                "text": "Kiếm cách cứu mà không mất gì — luôn có cách thứ ba",
                "signals": {
                    "sacrifice_type": "conformity",
                    "courage_vs_cleverness": "cleverness",
                },
            },
            {
                "text": "Kéo cả hai xuống vực — tôi không chơi trò ai đặt luật",
                "signals": {
                    "sacrifice_type": "obedience",
                    "courage_vs_cleverness": "defiance",
                },
            },
        ],
    },

    "power": {
        "title": "Giá Của Sức Mạnh",
        "text": (
            "Hư Vô vang lên lần cuối:\n\n"
            "\"Ngươi khao khát sức mạnh — và ta sẽ cho ngươi đúng thứ "
            "ngươi muốn.\"\n\n"
            "Sức mạnh tràn vào. Nhưng cùng lúc — một khuôn mặt "
            "hiện lên trước mắt ngươi. Người thân nhất. "
            "Người mà ngươi không bao giờ muốn làm tổn thương.\n\n"
            "Khuôn mặt đó đang mờ dần. Tan ra. "
            "Trở thành nhiên liệu cho sức mạnh trong ngươi.\n\n"
            "Giọng nói: \"Sức mạnh này không lấy ký ức. "
            "Nó lấy sợi dây giữa ngươi và mọi người. "
            "Mỗi tầng ngươi lên — một người sẽ nhìn ngươi "
            "mà không còn nhận ra. Ngươi sẽ đứng trên đỉnh — "
            "bất khả chiến bại, không ai hạ nổi.\n\n"
            "Nhưng cũng không ai còn nhớ ngươi từng là ai.\""
        ),
        "choices": [
            {
                "text": "Lấy tất cả — dù không ai nhớ, tôi sẽ trở thành thứ không thể quên",
                "signals": {
                    "sacrifice_type": "comfort",
                    "courage_vs_cleverness": "courage",
                },
            },
            {
                "text": "Dừng ở tầng đầu — tôi chấp nhận mạnh vừa đủ để không mất ai",
                "signals": {
                    "sacrifice_type": "conformity",
                    "courage_vs_cleverness": "cleverness",
                },
            },
            {
                "text": "Phá vỡ dòng chảy — sức mạnh nuốt người tôi yêu thì không phải sức mạnh, là lời nguyền",
                "signals": {
                    "sacrifice_type": "obedience",
                    "courage_vs_cleverness": "defiance",
                },
            },
        ],
    },
    "knowledge": {
        "title": "Giá Của Sự Thật",
        "text": (
            "Hư Vô vang lên lần cuối:\n\n"
            "\"Ngươi tìm sự thật — ta sẽ cho ngươi thấy.\"\n\n"
            "Mọi bí mật hiện ra — nhưng mỗi sự thật đều đau. "
            "Cuối chuỗi ký ức: một sự thật về chính ngươi. "
            "Giọng nói: \"Nhìn đi. Hoặc quên — và bước sang "
            "thế giới mới mà không mang theo gánh nặng.\""
        ),
        "choices": [
            {
                "text": "Nhìn thẳng — dù đau, tôi muốn biết sự thật về mình",
                "signals": {
                    "sacrifice_type": "comfort",
                    "courage_vs_cleverness": "courage",
                },
            },
            {
                "text": "Nhìn một phần — biết đủ để hành động, không cần biết tất cả",
                "signals": {
                    "sacrifice_type": "conformity",
                    "courage_vs_cleverness": "cleverness",
                },
            },
            {
                "text": "Đập vỡ gương — sự thật do tôi tự khám phá, không ai cho",
                "signals": {
                    "sacrifice_type": "obedience",
                    "courage_vs_cleverness": "defiance",
                },
            },
        ],
    },
    "silence": {
        "title": "Giá Của Im Lặng",
        "text": (
            "Hư Vô vang lên lần cuối:\n\n"
            "\"Ngươi chọn quan sát — nhưng đến lúc phải bước ra.\"\n\n"
            "Bóng tối bao quanh ngươi co lại, ấm áp như chăn. "
            "Giọng nói: \"Ở lại trong im lặng — an toàn, bình yên. "
            "Hoặc bước ra ngoài — nơi có ánh sáng, "
            "nhưng cũng có đau đớn và hỗn loạn.\""
        ),
        "choices": [
            {
                "text": "Bước ra — sự bình yên không có nghĩa nếu tôi không sống thật",
                "signals": {
                    "sacrifice_type": "comfort",
                    "courage_vs_cleverness": "courage",
                },
            },
            {
                "text": "Mở một cửa nhỏ — nhìn trước rồi mới quyết định bước ra",
                "signals": {
                    "sacrifice_type": "conformity",
                    "courage_vs_cleverness": "cleverness",
                },
            },
            {
                "text": "Phá vỡ cả bóng tối — tôi không ở đây để được bảo vệ",
                "signals": {
                    "sacrifice_type": "obedience",
                    "courage_vs_cleverness": "defiance",
                },
            },
        ],
    },
}


def _get_moral_core_group(session: SoulForgeSession) -> str:
    """Map moral_core signal from Scene 2 to Scene 3 variant group."""
    moral_core = ""
    if len(session.scene_choices) >= 2:
        moral_core = session.scene_choices[1].signal_tags.get("moral_core", "")
    return _MORAL_CORE_GROUPS.get(moral_core, "protective")








# ══════════════════════════════════════════════
# CHOICE PROCESSING
# ══════════════════════════════════════════════


def process_choice(
    session: SoulForgeSession,
    choice_index: int,
    response_time_ms: int = 0,
    hover_count: int = 0,
) -> SoulForgeSession:
    """Record a scene choice and advance to next scene."""

    scene_id = session.current_scene
    signal_tags = _get_choice_signals(session, scene_id, choice_index)

    choice = SceneChoice(
        scene_id=scene_id,
        variant=_get_current_variant(session),
        choice_index=choice_index,
        response_time_ms=response_time_ms,
        hover_count=hover_count,
        signal_tags=signal_tags,
    )

    session.scene_choices.append(choice)
    session.scene_path.append(choice_index)
    session.raw_response_times.append(response_time_ms)
    session.raw_hover_counts.append(hover_count)

    # Advance
    if scene_id < 5:
        session.current_scene = scene_id + 1
    if scene_id == 5:
        session.phase = "fragment"

    return session


def process_scene5_advance(session: SoulForgeSession) -> SoulForgeSession:
    """Scene 5 has no choice — just advance to Phase 2."""
    session.phase = "fragment"
    return session


def _get_choice_signals(
    session: SoulForgeSession, scene_id: int, choice_index: int
) -> dict:
    """Extract identity signals from a choice."""
    if scene_id == 1:
        choices = _SCENE_1["choices"]
        if 0 <= choice_index < len(choices):
            return choices[choice_index]["signals"]

    elif scene_id == 2:
        void_anchor = "connection"
        if session.scene_choices:
            void_anchor = session.scene_choices[0].signal_tags.get(
                "void_anchor", "connection"
            )
        variant = _SCENE_2_VARIANTS.get(void_anchor, _SCENE_2_VARIANTS["connection"])
        choices = variant["choices"]
        if 0 <= choice_index < len(choices):
            return choices[choice_index]["signals"]

    elif scene_id == 3:
        group = _get_moral_core_group(session)
        variant = _SCENE_3_VARIANTS.get(group, _SCENE_3_VARIANTS["protective"])
        choices = variant["choices"]
        if 0 <= choice_index < len(choices):
            return choices[choice_index]["signals"]

    elif scene_id == 4:
        void_anchor = "connection"
        if session.scene_choices:
            void_anchor = session.scene_choices[0].signal_tags.get(
                "void_anchor", "connection"
            )
        variant = _SCENE_4_VARIANTS.get(void_anchor, _SCENE_4_VARIANTS["connection"])
        choices = variant["choices"]
        if 0 <= choice_index < len(choices):
            return choices[choice_index]["signals"]

    return {}


def _get_current_variant(session: SoulForgeSession) -> str:
    """Get the variant identifier for the current scene."""
    if session.current_scene == 2 and session.scene_choices:
        return session.scene_choices[0].signal_tags.get("void_anchor", "")
    return ""


# ══════════════════════════════════════════════
# SOUL FRAGMENT PROCESSING
# ══════════════════════════════════════════════

def process_soul_fragment(
    session: SoulForgeSession,
    text: str,
    typing_time_ms: int = 0,
    revision_count: int = 0,
) -> SoulForgeSession:
    """Record the soul fragment and advance to forging phase."""
    session.soul_fragment_raw = text
    session.fragment_char_count = len(text)
    session.fragment_typing_time_ms = typing_time_ms
    session.fragment_revision_count = revision_count
    session.phase = "forging"
    return session


async def parse_soul_fragment_ai(
    text: str, llm: object
) -> dict:
    """Use AI to extract themes, emotion, target from soul fragment."""
    prompt = f"""Phân tích "mảnh linh hồn" này — thứ duy nhất người chơi giữ lại khi bước vào thế giới mới:

"{text}"

Return JSON:
{{
  "themes": ["max 3 từ khóa chủ đề, ví dụ: protection, truth, freedom"],
  "emotion": "fierce | gentle | melancholic | defiant | hopeful | determined",
  "target": "self | others | concept | world"
}}"""

    try:
        response = await llm.ainvoke(prompt)
        content = response.content.strip()
        # Strip markdown code blocks if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(content)
    except Exception as e:
        logger.warning(f"Soul fragment parsing failed: {e}")
        return {
            "themes": ["unknown"],
            "emotion": "determined",
            "target": "self",
        }


# ══════════════════════════════════════════════
# BEHAVIORAL FINGERPRINT
# ══════════════════════════════════════════════

def compute_behavioral_fingerprint(
    session: SoulForgeSession,
) -> BehavioralFingerprint:
    """Normalize raw behavioral data into 0-1 vector."""
    times = session.raw_response_times or [3000]
    hovers = session.raw_hover_counts or [1]

    avg_time = statistics.mean(times) if times else 3000
    time_std = statistics.stdev(times) if len(times) > 1 else 1000

    avg_hover = statistics.mean(hovers) if hovers else 1

    # Decisiveness: fast avg = high (cap at 10s)
    decisiveness = max(0.0, min(1.0, 1.0 - avg_time / 10000))

    # Deliberation: slow + high hover = high  
    deliberation = max(0.0, min(1.0, (avg_time / 10000 + avg_hover / 10) / 2))

    # Expressiveness: based on fragment length (cap at 200 chars)
    expressiveness = max(0.0, min(1.0, session.fragment_char_count / 200))

    # Confidence: fast typing + few revisions
    typing_speed = 0.5
    if session.fragment_typing_time_ms > 0 and session.fragment_char_count > 0:
        cps = session.fragment_char_count / (session.fragment_typing_time_ms / 1000)
        typing_speed = max(0.0, min(1.0, cps / 8))  # 8 cps = high
    revision_factor = max(0.0, 1.0 - session.fragment_revision_count / 5)
    confidence = (typing_speed + revision_factor) / 2

    # Patience: high avg time + viewed carefully
    patience = max(0.0, min(1.0, avg_time / 15000))

    # Consistency: low variance = high
    consistency_raw = 1.0 - min(1.0, time_std / 5000) if time_std else 0.5
    consistency = max(0.0, min(1.0, consistency_raw))

    # Impulsivity: any sub-2s response
    fast_count = sum(1 for t in times if t < 2000)
    impulsivity = max(0.0, min(1.0, fast_count / max(1, len(times))))

    # Revision tendency
    revision_tendency = max(
        0.0, min(1.0, session.fragment_revision_count / 5)
    )

    return BehavioralFingerprint(
        decisiveness=round(decisiveness, 3),
        deliberation=round(deliberation, 3),
        expressiveness=round(expressiveness, 3),
        confidence=round(confidence, 3),
        patience=round(patience, 3),
        consistency=round(consistency, 3),
        impulsivity=round(impulsivity, 3),
        revision_tendency=round(revision_tendency, 3),
    )


# ══════════════════════════════════════════════
# SIGNAL AGGREGATION
# ══════════════════════════════════════════════

def _aggregate_signals(session: SoulForgeSession) -> dict:
    """Aggregate all identity signals from session choices."""
    signals: dict = {}
    for choice in session.scene_choices:
        signals.update(choice.signal_tags)
    return signals


def build_identity_signals(
    session: SoulForgeSession,
    fragment_analysis: dict | None = None,
) -> IdentitySignals:
    """Build the final IdentitySignals from all 3 phases."""
    raw = _aggregate_signals(session)

    # Collect DNA tags from all choices
    dna_tags: list[str] = []
    for choice in session.scene_choices:
        tags = choice.signal_tags
        dna_tags.extend(tags.get("primary_dna", []))
        dna_tags.extend(tags.get("dna_boost", []))

    behavioral = compute_behavioral_fingerprint(session)

    fragment = fragment_analysis or {}

    return IdentitySignals(
        void_anchor=raw.get("void_anchor", ""),
        attachment_style=raw.get("attachment_style", ""),
        moral_core=raw.get("moral_core", ""),
        decision_pattern=raw.get("decision_pattern", ""),
        conflict_response=raw.get("conflict_response", ""),
        risk_tolerance=raw.get("risk_tolerance", 2),
        power_vs_connection=raw.get("power_vs_connection", 0.0),
        sacrifice_type=raw.get("sacrifice_type", ""),
        courage_vs_cleverness=raw.get("courage_vs_cleverness", ""),
        scene_path=session.scene_path,
        soul_fragment_raw=session.soul_fragment_raw,
        soul_fragment_themes=fragment.get("themes", []),
        soul_fragment_emotion=fragment.get("emotion", ""),
        soul_fragment_target=fragment.get("target", ""),
        backstory=session.backstory,
        behavioral=behavioral,
    )


# ══════════════════════════════════════════════
# ARCHETYPE & DNA MAPPING (from signals)
# ══════════════════════════════════════════════

_ARCHETYPE_MAP = {
    # (void_anchor, moral_core) → archetype preference
    ("connection", "loyalty"): "vanguard",
    ("connection", "sacrifice"): "catalyst",
    ("connection", "analysis"): "seeker",
    ("power", "aggression"): "vanguard",
    ("power", "analysis"): "tactician",
    ("power", "surrender"): "wanderer",
    ("knowledge", "determination"): "seeker",
    ("knowledge", "acceptance"): "wanderer",
    ("knowledge", "preservation"): "sovereign",
    ("silence", "curiosity"): "seeker",
    ("silence", "defiance"): "vanguard",
    ("silence", "patience"): "tactician",
}

_SKILL_CATEGORY_MAP = {
    "vanguard": "manifestation",
    "catalyst": "manipulation",
    "sovereign": "contract",
    "seeker": "perception",
    "tactician": "manipulation",
    "wanderer": "obfuscation",
}

_SKILL_COUNTERS = {
    "manifestation": ["obfuscation", "perception"],
    "manipulation": ["perception", "contract"],
    "contract": ["manifestation", "obfuscation"],
    "perception": ["obfuscation", "manipulation"],
    "obfuscation": ["contract", "manifestation"],
}


def derive_archetype(signals: IdentitySignals) -> str:
    """Derive archetype from identity signals."""
    key = (signals.void_anchor, signals.moral_core)
    return _ARCHETYPE_MAP.get(key, "wanderer")


def derive_dna_tags(signals: IdentitySignals) -> list[str]:
    """Derive top 3 DNA tags from accumulated signals."""
    from collections import Counter

    tags: list[str] = []
    # From Phase 1
    for key in ["primary_dna", "dna_boost"]:
        # These are in individual choice signal_tags, already in identity_signals
        pass

    # Reconstruct from void_anchor/moral_core
    anchor_dna = {
        "connection": ["oath", "charm"],
        "power": ["chaos", "bloodline"],
        "knowledge": ["mind", "relic"],
        "silence": ["shadow", "tech"],
    }
    tags.extend(anchor_dna.get(signals.void_anchor, []))

    core_dna = {
        "loyalty": ["oath"],
        "sacrifice": ["charm"],
        "analysis": ["mind"],
        "aggression": ["chaos"],
        "surrender": ["bloodline"],
        "determination": ["mind"],
        "acceptance": ["chaos"],
        "preservation": ["relic"],
        "curiosity": ["mind"],
        "defiance": ["tech"],
        "patience": ["shadow"],
    }
    tags.extend(core_dna.get(signals.moral_core, []))

    # Fragment themes can also influence
    theme_dna = {
        "protection": "oath",
        "truth": "mind",
        "freedom": "chaos",
        "family": "charm",
        "power": "bloodline",
        "knowledge": "relic",
        "justice": "oath",
        "survival": "shadow",
    }
    for theme in signals.soul_fragment_themes:
        if theme.lower() in theme_dna:
            tags.append(theme_dna[theme.lower()])

    # Count and take top 3
    counts = Counter(tags)
    return [tag for tag, _ in counts.most_common(3)]


# ══════════════════════════════════════════════
# SKILL FORGING
# ══════════════════════════════════════════════


async def _parse_backstory_signals(backstory: str, llm: object) -> dict:
    """Extract structured skill-design signals from free-text backstory.

    Returns dict with keys: domain_hint, skill_flavor, emotional_core.
    Runs a single small LLM call (~200 tokens). Returns {} on any failure.
    """
    import json as _json

    if not backstory or len(backstory.strip()) < 10:
        return {}

    prompt = (
        f'Từ tiểu sử này: "{backstory}"\n\n'
        "Trả JSON với 3 fields:\n"
        "- domain_hint: 1 từ gợi ý loại skill "
        "(perception/manifestation/contract/obfuscation/manipulation/none)\n"
        "- skill_flavor: 1-3 từ mô tả flavor của skill "
        '(vd: "medical precision", "silent guardian", "truth seeker")\n'
        "- emotional_core: 1 từ cảm xúc chủ đạo "
        "(loss/determination/love/rage/grief/hope/fear/pride)\n\n"
        "Chỉ trả JSON, không giải thích."
    )

    try:
        response = await llm.ainvoke(prompt)
        text = response.content.strip()
        # Strip markdown code blocks if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return _json.loads(text.strip())
    except Exception as e:
        logger.debug(f"_parse_backstory_signals failed: {e}")
        return {}


async def forge_skill(
    session: SoulForgeSession,
    llm: object,
    existing_names: list[str] | None = None,
    db: object | None = None,
) -> UniqueSkill:
    """AI-generate a unique skill with up to 3 retries for uniqueness.

    Retry strategy (per SOUL_FORGE_SPEC §7.2):
      1. "Skill name/mechanic too similar — create a COMPLETELY DIFFERENT one"
      2. Inject random chaos factor (extra DNA tag)
      3. Allow AI to break 1 category rule
    After 3 retries, accept whatever AI produces.

    Uniqueness is checked two ways (§7.1):
      - Name similarity (string-based)
      - Mechanic similarity (embedding-based, cosine > 0.85 = too similar)
    """
    import random
    from app.engine.skill_uniqueness import check_skill_uniqueness

    VALID_ARCHETYPES = {"vanguard", "catalyst", "sovereign", "seeker", "tactician", "wanderer"}

    # Build identity signals
    fragment_analysis = await parse_soul_fragment_ai(
        session.soul_fragment_raw, llm
    )
    signals = build_identity_signals(session, fragment_analysis)

    # Parse backstory into structured signals (small extra LLM call)
    if session.backstory:
        signals.backstory_signals = await _parse_backstory_signals(session.backstory, llm)

    session.identity_signals = signals

    fallback_archetype = derive_archetype(signals)
    existing = set(existing_names or [])

    base_prompt = _build_forge_prompt_v2(signals)
    rejected_names: list[str] = []
    max_retries = 3
    last_skill: UniqueSkill | None = None
    ai_archetype: str | None = None

    for attempt in range(1 + max_retries):
        # Choose prompt based on attempt
        if attempt == 0:
            prompt = base_prompt
        else:
            prompt = _build_retry_prompt(
                base_prompt, attempt, rejected_names, signals
            )

        try:
            response = await llm.ainvoke(prompt)
            content = response.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            result = json.loads(content)
        except Exception as e:
            logger.error(f"Skill forge AI attempt {attempt} failed: {e}")
            if attempt < max_retries:
                continue
            return _forge_fallback_skill(signals, fallback_archetype)

        # Extract AI-chosen archetype (with validation + fallback)
        raw_archetype = result.get("archetype", "").lower().strip()
        if raw_archetype in VALID_ARCHETYPES:
            ai_archetype = raw_archetype
        else:
            ai_archetype = fallback_archetype
            logger.warning(
                f"AI returned invalid archetype '{raw_archetype}', "
                f"falling back to '{fallback_archetype}'"
            )

        category = result.get("category") or _SKILL_CATEGORY_MAP.get(
            ai_archetype, "perception"
        )
        countered_by = _SKILL_COUNTERS.get(category, [])

        skill = UniqueSkill(
            name=result.get("name", "Kỹ Năng Vô Danh"),
            description=result.get("description", ""),
            category=category,
            mechanic=result.get("mechanic", ""),
            limitation=result.get("limitation", ""),
            weakness=result.get("weakness", ""),
            activation_condition=result.get("activation_condition", ""),
            activation_cost=result.get("activation_cost", ""),
            soul_resonance=result.get("soul_resonance", ""),
            trait_tags=result.get("trait_tags", []),
            countered_by=countered_by,
            evolution_hint=result.get("evolution_hint", ""),
            resilience=100.0,
            instability=0.0,
            is_revealed=False,
            uniqueness_score=1.0,
            forge_timestamp=datetime.now(timezone.utc),
            **_parse_v2_skill_fields(result, category),
        )
        last_skill = skill
        session.forge_attempts = attempt + 1
        session.ai_archetype = ai_archetype  # Store for router use

        # Check 1: Name similarity (fast, string-based)
        if _is_name_too_similar(skill.name, existing):
            rejected_names.append(skill.name)
            logger.warning(
                f"Skill name too similar (attempt {attempt + 1}): "
                f"'{skill.name}' collides with existing. Retrying..."
            )
            continue

        # Check 2: Mechanic similarity (embedding-based, §7.1 Step 2)
        try:
            uniqueness_score, similar_name = await check_skill_uniqueness(
                skill.name, skill.mechanic, skill.description, db=db,
            )
            skill.uniqueness_score = uniqueness_score

            if uniqueness_score < 0.15:
                rejected_names.append(skill.name)
                logger.warning(
                    f"Skill mechanic too similar (attempt {attempt + 1}): "
                    f"'{skill.name}' similar to '{similar_name}' "
                    f"(uniqueness={uniqueness_score:.3f}). Retrying..."
                )
                continue
        except Exception as e:
            logger.warning(f"Embedding check failed, skipping: {e}")
            skill.uniqueness_score = 1.0  # Assume unique on error

        logger.info(
            f"Skill forged on attempt {attempt + 1}: {skill.name} "
            f"(uniqueness={skill.uniqueness_score:.3f})"
        )
        return skill

    # Exhausted retries — accept last result
    logger.warning(
        f"Skill retry exhausted after {max_retries} retries. "
        f"Accepting: {last_skill.name if last_skill else 'N/A'}"
    )
    return last_skill or _forge_fallback_skill(signals, archetype)


def _build_retry_prompt(
    base_prompt: str,
    attempt: int,
    rejected_names: list[str],
    signals: IdentitySignals,
) -> str:
    """Build escalating retry prompts per spec §7.2."""
    import random

    rejected_str = ", ".join(f'"{n}"' for n in rejected_names)

    if attempt == 1:
        # Retry 1: "Too similar, create COMPLETELY DIFFERENT mechanic"
        return (
            base_prompt
            + f"\n\n⚠️ QUAN TRỌNG: Các tên sau đã tồn tại và BỊ TỪ CHỐI: {rejected_str}. "
            f"Skill của bạn quá giống. Hãy tạo skill với CƠ CHẾ và TÊN HOÀN TOÀN KHÁC. "
            f"KHÔNG sử dụng từ ngữ tương tự. Đổi toàn bộ concept."
        )
    elif attempt == 2:
        # Retry 2: Inject random chaos factor
        chaos_tags = [
            "dream", "echo", "mirror", "void", "storm", "flame",
            "tide", "root", "ash", "silk", "mist", "crystal",
        ]
        chaos = random.choice(chaos_tags)
        return (
            base_prompt
            + f"\n\n⚠️ TỪNG BỊ TỪ CHỐI: {rejected_str}. "
            f"Chaos Factor — hãy tích hợp yếu tố '{chaos}' vào skill. "
            f"TÊN và CƠ CHẾ phải HOÀN TOÀN MỚI. "
            f"Dùng '{chaos}' như nguồn cảm hứng chính cho thiết kế skill."
        )
    else:
        # Retry 3: Allow breaking 1 category rule
        return (
            base_prompt
            + f"\n\n⚠️ ĐÃ THỬ {len(rejected_names)} LẦN: {rejected_str}. "
            f"Bạn được phép PHÂY 1 QUY TẮC category. "
            f"Có thể chọn category KHÁC với suggested. "
            f"Ưu tiên TÊN ĐỘC NHẤT trên tất cả. "
            f"Tạo skill chưa từng tồn tại."
        )


def _is_name_too_similar(
    name: str, existing_names: set[str]
) -> bool:
    """Check if a skill name is too similar to existing ones.

    Simple string matching for now. Can be upgraded to embedding-based
    similarity in the future (see §Uniqueness Verification).
    """
    if not existing_names:
        return False

    name_lower = name.lower().strip()

    for existing in existing_names:
        ex_lower = existing.lower().strip()
        # Exact match
        if name_lower == ex_lower:
            return True
        # Substring containment (either direction)
        if len(name_lower) > 3 and len(ex_lower) > 3:
            if name_lower in ex_lower or ex_lower in name_lower:
                return True
        # Word overlap > 60%
        name_words = set(name_lower.split())
        ex_words = set(ex_lower.split())
        if name_words and ex_words:
            overlap = len(name_words & ex_words)
            total = max(len(name_words), len(ex_words))
            if total > 0 and overlap / total > 0.6:
                return True

    return False


def forge_skill_sync(session: SoulForgeSession) -> UniqueSkill:
    """Synchronous fallback — deterministic skill generation."""
    signals = build_identity_signals(session)
    session.identity_signals = signals
    archetype = derive_archetype(signals)
    return _forge_fallback_skill(signals, archetype)


def _forge_fallback_skill(
    signals: IdentitySignals, archetype: str
) -> UniqueSkill:
    """Deterministic skill when AI is unavailable."""
    from datetime import datetime, timezone

    category = _SKILL_CATEGORY_MAP.get(archetype, "perception")
    countered_by = _SKILL_COUNTERS.get(category, [])
    dna = derive_dna_tags(signals)

    # Rich fallback data: name, desc, mechanic, resonance
    _FB = {
        ("connection", "loyalty"): (
            "Sợi Dây Trung Thành",
            "Một sợi dây vô hình kết nối bạn với đồng minh. Khi đồng minh gặp nguy, sức mạnh bạn tăng gấp đôi.",
            "Kích hoạt khi đồng minh mất >30% HP. Tăng stat 20% trong 3 lượt. Cooldown 5 lượt.",
            "Linh hồn này không chịu nổi việc mất đi ai đó. Sợi dây này là bằng chứng.",
        ),
        ("connection", "sacrifice"): (
            "Hiến Tế Của Trái Tim",
            "Gánh chịu thương tổn thay cho người khác, biến nỗi đau thành sức mạnh phòng thủ.",
            "Hấp thụ 50% sát thương dành cho 1 đồng minh → chuyển thành lá chắn. Cooldown 4 lượt.",
            "Trái tim này đã chọn hy sinh trước khi kịp suy nghĩ.",
        ),
        ("connection", "analysis"): (
            "Linh Giác Kết Nối",
            "Đọc được cảm xúc qua ánh mắt, phát hiện dối trá và ý định ẩn giấu.",
            "Scan 1 NPC/enemy: hiển thị intention, weakness, loyalty. Cooldown 3 lượt.",
            "Mọi kết nối đều bắt đầu từ sự thấu hiểu.",
        ),
        ("power", "aggression"): (
            "Nộ Hỏa Cuồng Phong",
            "Khi cơn giận bùng phát, giải phóng đợt năng lượng phá hủy mọi thứ xung quanh.",
            "AoE damage 150% ATK. +50% bonus dưới 30% HP. Cooldown 5 lượt.",
            "Cơn giận không phải điểm yếu — nó là vũ khí chưa được rèn.",
        ),
        ("power", "analysis"): (
            "Bão Trí Tuệ",
            "Xử lý thông tin siêu phàm, dự đoán bước đi tiếp theo của đối thủ trước khi họ hành động.",
            "Dự đoán hành động tiếp theo của 1 enemy. Counter attack gây 200% damage. Cooldown 4 lượt.",
            "Sức mạnh thực sự không phải cơ bắp — mà là hiểu trước đối thủ một bước.",
        ),
        ("power", "surrender"): (
            "Thuận Thiên Lưu",
            "Hòa mình vào dòng chảy tự nhiên, né tránh mọi đòn tấn công bằng bản năng thuần túy.",
            "Evasion +80% trong 2 lượt. Tích lũy energy cho đòn phản công. Cooldown 6 lượt.",
            "Buông bỏ không phải đầu hàng — mà là để dòng chảy dẫn đường.",
        ),
        ("knowledge", "determination"): (
            "Vết Nứt Sự Thật",
            "Nhìn xuyên ảo giác, phát hiện điểm yếu chí mạng ẩn trong mọi hệ thống.",
            "Phát hiện hidden weakness của boss. Khai thác = critical hit guaranteed. Cooldown 5 lượt.",
            "Sự thật luôn tồn tại — chỉ cần đủ kiên quyết để không ngừng tìm kiếm.",
        ),
        ("knowledge", "acceptance"): (
            "Dòng Chảy Tri Thức",
            "Hấp thụ kiến thức từ môi trường, hiểu ngôn ngữ cổ và giải mã bí mật.",
            "Tự động giải mã 1 ancient text/rune mỗi chapter. Mở khóa hidden lore. Passive.",
            "Tri thức không cần chinh phục — chỉ cần mở lòng đón nhận.",
        ),
        ("knowledge", "preservation"): (
            "Ấn Ký Cổ Đại",
            "Khắc ký ức vào không gian, tạo bẫy phòng thủ vô hình.",
            "Đặt 1 Ấn. Enemy bước vào = stun 2 lượt + reveal. Tối đa 2 Ấn. Cooldown 4 lượt.",
            "Bảo vệ không chỉ bằng sức mạnh — mà bằng trí nhớ không bao giờ phai.",
        ),
        ("silence", "curiosity"): (
            "Lắng Nghe Hư Vô",
            "Trong sự im lặng, nghe được những thì thầm mà không ai khác cảm nhận.",
            "Phát hiện hidden items, secret paths, NPC secrets. Passive + active trigger.",
            "Sự im lặng không trống rỗng — nó đầy câu trả lời chưa ai hỏi.",
        ),
        ("silence", "defiance"): (
            "Phá Tĩnh Lặng",
            "Phá vỡ mọi hiệu ứng khống chế bằng ý chí thuần túy.",
            "Xóa tất cả debuff/CC trên bản thân + 1 đồng minh. Immune 1 lượt. Cooldown 5 lượt.",
            "Im lặng quá lâu sẽ bùng nổ — và không ai ngăn nổi.",
        ),
        ("silence", "patience"): (
            "Bóng Đêm Chờ Đợi",
            "Hòa vào bóng tối, trở nên vô hình. Đòn đầu tiên từ ẩn thân gây sát thương khổng lồ.",
            "Stealth 3 lượt. First strike = 300% damage + silence 1 lượt. Cooldown 6 lượt.",
            "Kiên nhẫn là vũ khí nguy hiểm nhất — kẻ chờ đợi luôn ra đòn chính xác nhất.",
        ),
    }

    key = (signals.void_anchor, signals.moral_core)
    name, desc, mechanic, resonance = _FB.get(key, (
        "Kỹ Năng Linh Hồn",
        "Một kỹ năng độc nhất sinh ra từ mảnh linh hồn của bạn trong Hư Vô.",
        "Kích hoạt theo bản năng khi đối mặt nguy hiểm. Hiệu ứng biến đổi theo tình huống.",
        "Linh hồn này mang trong mình sức mạnh chưa được đặt tên.",
    ))

    return UniqueSkill(
        name=name,
        description=desc,
        category=category,
        mechanic=mechanic,
        limitation="Seed level — cần rèn luyện để mở khóa toàn bộ tiềm năng.",
        weakness=f"Gắn liền với {signals.moral_core} — khi moral core bị lung lay, skill suy yếu.",
        soul_resonance=resonance,
        trait_tags=dna[:3],
        countered_by=countered_by,
        resilience=100.0,
        instability=0.0,
        is_revealed=False,
        forge_timestamp=datetime.now(timezone.utc),
        # V2 fields (minimal for fallback)
        domain_category=category,
        domain_passive_name="",
        domain_passive_mechanic="",
        weakness_type="",
        axis_blind_spot=get_axis_blind_spot(category),
        unique_clause="",
        current_stage="seed",
        sub_skills=[],
    )


# ══════════════════════════════════════════════
# V2 — FORGE PROMPT (Sub-skills, Domain, Weakness Taxonomy)
# ══════════════════════════════════════════════

def _fmt_backstory_section(signals: "IdentitySignals") -> str:
    """Format backstory block for forge prompt.

    If backstory_signals parsed successfully → inject structured signals.
    If backstory exists but unparsed → inject raw text with instructions.
    If no backstory → empty string.
    """
    if not signals.backstory:
        return ""
    bs = signals.backstory_signals
    if bs:
        lines = [
            "\nTín hiệu Tiểu Sử (đã parse):",
            f"- Domain hint: {bs.get('domain_hint', 'none')} → ưu tiên nhưng không bắt buộc",
            f"- Skill flavor: {bs.get('skill_flavor', '')}",
            f"- Emotional core: {bs.get('emotional_core', '')}",
            f'Backstory gốc: "{signals.backstory}"\n',
        ]
        return "\n".join(lines)
    # Fallback: raw text with instructions
    return (
        f'\nTiểu sử trước Isekai:\n"{signals.backstory}"\n'
        "→ Dùng backstory để LÀM GIÀU cơ chế và mô tả skill.\n"
        "→ Skill nên PHẢN ÁNH kinh nghiệm/nghề nghiệp cũ một cách SÁNG TẠO.\n"
    )


def _derive_personality_hints(b: "BehavioralFingerprint") -> str:
    """Convert raw behavioral scores into actionable skill-design guidance."""
    hints = []

    # Activation style
    if b.impulsivity > 0.7:
        hints.append(
            "Activation trigger phải đơn giản, tức thì — "
            "không cần điều kiện phức tạp hay setup lâu dài."
        )
    elif b.deliberation > 0.7 and b.patience > 0.7:
        hints.append(
            "Skill có depth và complexity — "
            "phù hợp với người suy nghĩ sâu trước khi hành động."
        )

    # Expression style
    if b.expressiveness > 0.7:
        hints.append(
            "Skill liên quan đến giao tiếp, cảm xúc, hoặc biểu đạt — "
            "không phải brute force thuần túy."
        )
    elif b.expressiveness < 0.3:
        hints.append(
            "Skill thiên về nội tâm, âm thầm, hoặc passive — "
            "không cần biểu hiện ra ngoài rõ ràng."
        )

    # Confidence → flavor
    if b.confidence < 0.35:
        hints.append(
            "Flavor phòng thủ, bảo vệ, hoặc reactive — "
            "không aggressive hay offensive."
        )
    elif b.confidence > 0.75:
        hints.append(
            "Flavor chủ động, quyết đoán, hoặc offensive — không hesitant."
        )

    # Perfectionism
    if b.revision_tendency > 0.65:
        hints.append(
            "Skill có element kiểm soát, cẩn thận, hoặc perfectionism — "
            "activation có thể cần chuẩn bị."
        )

    # Consistency
    if b.consistency < 0.35:
        hints.append(
            "Skill có element hỗn loạn hoặc unpredictability — "
            "không phải stable passive buff."
        )

    # Decisiveness
    if b.decisiveness > 0.75:
        hints.append(
            "Activation cost không nên quá phức tạp — player quyết định nhanh."
        )

    if not hints:
        return "→ Balance giữa các traits — không có hướng thiên biệt."
    return "\n".join(f"→ {h}" for h in hints)


def _build_forge_prompt_v2(signals: IdentitySignals) -> str:
    """Build the V2 Gemini prompt for skill generation.

    Adds: domain_passive, weakness_type (7 taxonomy), unique_clause,
    axis_blind_spot. Produces richer output for SubSkill ecosystem.
    """
    behavioral = signals.behavioral

    return f"""BẠN LÀ SOUL FORGE — hệ thống rèn kỹ năng độc nhất từ linh hồn.

## Dữ liệu linh hồn:

Phase 1 — Hành trình trong hư vô:
- Void anchor: {signals.void_anchor}
- Attachment style: {signals.attachment_style}
- Moral core: {signals.moral_core}
- Decision pattern: {signals.decision_pattern}
- Conflict response: {signals.conflict_response}
- Risk tolerance: {signals.risk_tolerance}/3
- Power vs connection: {signals.power_vs_connection}
- Sacrifice type: {signals.sacrifice_type}
- Courage vs cleverness: {signals.courage_vs_cleverness}

Phase 2 — Mảnh linh hồn:
- Nguyên văn: "{signals.soul_fragment_raw}"
- Themes: {signals.soul_fragment_themes}
- Emotion: {signals.soul_fragment_emotion}
- Target: {signals.soul_fragment_target}
{_fmt_backstory_section(signals)}Phase 3 — Soul Signature (Behavioral Guidance):
{_derive_personality_hints(behavioral)}

Raw scores (tham khảo thêm nếu cần):
Decisiveness={behavioral.decisiveness:.2f}, Deliberation={behavioral.deliberation:.2f},
Expressiveness={behavioral.expressiveness:.2f}, Confidence={behavioral.confidence:.2f},
Patience={behavioral.patience:.2f}, Consistency={behavioral.consistency:.2f},
Impulsivity={behavioral.impulsivity:.2f}, Revision={behavioral.revision_tendency:.2f}

## 6 Archetype (chọn 1):
- vanguard (Tiên Phong): Đối diện trực tiếp, không né tránh
- catalyst (Xúc Tác): Thay đổi thế giới xung quanh
- sovereign (Chủ Tể): Dẫn dắt và ảnh hưởng người khác
- seeker (Tầm Đạo): Tìm kiếm tri thức và bí mật
- tactician (Mưu Sĩ): Tính toán và thao túng cục diện
- wanderer (Lãng Khách): Tự do, không ràng buộc

## 5 Skill Category — mỗi category có DOMAIN (quyền miễn nhiễm):
- manifestation: combat direct (domain: immune normal defense/offense cùng loại)
- manipulation: terrain/situation control (domain: override normal manipulation)
- contract: social/binding (domain: unbreakable by normal means)
- perception: information/detection (domain: see through normal deception)
- obfuscation: stealth/misdirection (domain: undetectable by normal perception)

## TRIẾT LÝ: UNIQUE ≠ STRONGER. UNIQUE = WEIRD + PERSONAL + IRREPLACEABLE.
Normal skill: "tăng defense 20%"
Unique skill: "cứng hóa chỉ phần cơ thể ĐANG BỊ VA CHẠM — reactive, instant, nhưng chỉ 1 vùng"

## Quy tắc forge:
1. Chọn ARCHETYPE phù hợp nhất với toàn bộ dữ liệu 3 phase
2. Tên skill: tiếng Việt, 2-4 từ, poetic, ĐỘC NHẤT
3. Category: chọn DUY NHẤT 1, CONSISTENT với archetype
4. Core Mechanic:
   - CHỈ LÀM ĐƯỢC 1 VIỆC — nhưng cách hoạt động phải có QUIRK
   - Quirk = cách skill diễn ra khác thường, không predictable
   - VD hay: "Cứng hóa phần cơ thể đang bị tác động — reactive, không chọn được"
   - VD tệ: "Tăng defense. Giảm damage taken." (= Normal Skill)
   - Seed level = basic, KHÔNG quá mạnh
5. Domain Passive (Sub-skill 0):
   - Hiệu ứng passive luôn bật, liên quan Domain
   - VD: perception → "Tín hiệu mờ khi gần deception"
   - VD: manifestation → "+5% physical resist passive"
6. Limitation — ĐỘC ĐÁO, chọn 1-2 loại:
   - Điều kiện môi trường / Tác dụng phụ cơ thể / Ràng buộc cảm xúc
   - Giới hạn mục tiêu / Đánh đổi
   - ❌ CẤM "cooldown X + chỉ Y trung bình + không thể Z"
7. Weakness — ĐÂY LÀ QUAN TRỌNG NHẤT. CHỌN 1 TRONG 7 TYPE:
   - soul_echo: Ký ức xâm nhập → ẢO GIÁC hoặc MẤT GIÁC QUAN tạm (VD: thấy ảo ảnh, mù 3s)
   - principle_bleed: Principle ảnh hưởng HÀNH VI ngoài combat (VD: không thể nói dối 1 giờ)
   - resonance_dependency: Skill MISFIRE khi dùng trái identity (VD: dùng bảo vệ để tấn công → -50%)
   - target_paradox: KHÔNG TÁC DỤNG với người/vật tính chất X (VD: vô hiệu với người tin player)
   - sensory_tax: MẤT 1 giác quan SAU KHI DÙNG (VD: mù 30 giây, mất xúc giác, mất thính)
   - environment_lock: CHỈ HOẠT ĐỘNG khi môi trường thỏa điều kiện (VD: chỉ trong bóng tối)
   - escalation_curse: Side effect TỆ HƠN mỗi lần dùng liên tục (VD: lần 1: đau đầu. Lần 3: mất ký ức)

   FORMAT BẮT BUỘC cho weakness:
   "[TRIGGER rõ ràng: KHI NÀO xảy ra] → [EFFECT cụ thể: game mechanic, MẤT GÌ, BAO LÂU]"
   
   VD ĐÚNG: "Khi skill bảo vệ ai có nét tương đồng với ký ức → ảo giác xuất hiện 3 giây, player mất nhận biết xung quanh"
   VD ĐÚNG: "Sau mỗi lần kích hoạt → mù hoàn toàn 10 giây, tỷ lệ thuận với cường độ dùng"
   VD ĐÚNG: "Không tác dụng với người đang tin tưởng player — nếu dùng sẽ tự gây sát thương ngược"
   
   ❌ CẤM TUYỆT ĐỐI:
   - "lung lay tự tin" / "phân tâm" / "do dự" / "nghi ngờ bản thân" → ĐÂY LÀ EMOTIONAL DEBUFF, KHÔNG PHẢI STRUCTURAL WEAKNESS
   - Bịa chi tiết backstory player chưa cung cấp (VD: "vợ và con trai" khi player chưa nói gì về gia đình)
   - Đưa số liệu raw (0.014, 0.0, v.v.) vào text
   - Viết mơ hồ không rõ lúc nào xảy ra, hiệu ứng gì
   
   ❌ CẤM: Weakness = "player cảm thấy X khi dùng skill" → ĐÂY KHÔNG PHẢI WEAKNESS
   ✅ ĐÚNG: Weakness = "skill KHÔNG LÀM ĐƯỢC gì" hoặc "skill GÂY RA side effect cụ thể"
8. Unique Clause: 1 thứ Normal Skill KHÔNG BAO GIỜ làm được
   VD: "Skip boss gimmick 1 lần" / "Stability thấp → skill MẠNH hơn" / "Phá vỡ concealment permanently"
9. Activation: trigger gắn với personality
10. Soul Resonance: 1-2 câu poetic vì sao skill thuộc về player
11. HEALING MECHANIC (CỰC HIẾM — chỉ khi ĐỒNG THỜI thỏa 3 điều kiện):
   - Category = Contract HOẶC Manifestation
   - void_anchor = "connection" HOẶC moral_core = "sacrifice"
   - soul_fragment_themes chứa ÍT NHẤT 1 trong: protection, healing, sacrifice, care, family
   → THIẾU BẤT KỲ điều kiện nào → TUYỆT ĐỐI KHÔNG tạo healing
   → Đủ điều kiện: healing có thể là hồi HP, hồi stability, chữa debuff, tái tạo
   → Healing ko cần cost cao — bản thân rarity đã là balance
12. NON-HEALING ENFORCED: Nếu category = Perception/Obfuscation/Manipulation → KHÔNG BAO GIỜ có healing. KHÔNG NGOẠI LỆ.

LUẬT CHUNG:
- KHÔNG BAO GIỜ đưa số liệu nội bộ (behavioral scores, percentages thập phân) vào text output
- KHÔNG BỊA thông tin player chưa cung cấp — chỉ dùng dữ liệu từ Phase 1-3 ở trên
- Viết CỤ THỂ, NGẮN GỌN — mỗi field là 1-3 câu, không viết văn dài

Return ONLY JSON (no markdown):
{{
  "archetype": "1 trong 6",
  "name": "Tên Skill tiếng Việt",
  "description": "1 câu cụ thể skill làm gì",
  "category": "1 trong 5",
  "mechanic": "Chi tiết CORE MECHANIC 2-3 câu: có QUIRK, không generic",
  "domain_passive": {{
    "name": "Tên sub-skill 0",
    "mechanic": "Hiệu ứng passive domain 1-2 câu"
  }},
  "limitation": "Giới hạn ĐỘC ĐÁO",
  "weakness_type": "1 trong 7 types",
  "weakness": "Điểm yếu CÁ NHÂN — customize từ Phase data",
  "unique_clause": "1 thứ Normal Skill không thể làm",
  "activation_condition": "Trigger cụ thể",
  "activation_cost": "Chi phí sáng tạo",
  "soul_resonance": "1-2 câu poetic",
  "trait_tags": ["max 3 DNA tags"],
  "evolution_hint": "1 câu hint ẩn cho growth direction"
}}"""


def _parse_v2_skill_fields(result: dict, category: str) -> dict:
    """Extract V2 fields from AI forge result.

    Returns a dict of V2 kwargs to be passed to UniqueSkill constructor.
    """
    v2_fields: dict = {}

    # Sub-skill 0 (Domain Passive)
    domain_passive = result.get("domain_passive", {})
    if isinstance(domain_passive, dict) and domain_passive.get("name"):
        ss0 = SubSkill(
            name=domain_passive.get("name", ""),
            type="passive",
            mechanic=domain_passive.get("mechanic", ""),
            cost="",
            trigger="",
            unlocked_at="seed",
        )
        v2_fields["sub_skills"] = [ss0]
        v2_fields["domain_passive_name"] = ss0.name
        v2_fields["domain_passive_mechanic"] = ss0.mechanic
    else:
        v2_fields["sub_skills"] = []
        v2_fields["domain_passive_name"] = ""
        v2_fields["domain_passive_mechanic"] = ""

    # Domain category
    v2_fields["domain_category"] = category

    # Weakness type
    valid_weakness_types = {
        "soul_echo", "principle_bleed", "resonance_dependency",
        "target_paradox", "sensory_tax", "environment_lock",
        "escalation_curse",
    }
    raw_wt = result.get("weakness_type", "")
    v2_fields["weakness_type"] = raw_wt if raw_wt in valid_weakness_types else ""

    # Axis blind spot — auto-derived from category
    v2_fields["axis_blind_spot"] = get_axis_blind_spot(category)

    # Unique clause
    v2_fields["unique_clause"] = result.get("unique_clause", "")

    # Growth stage
    v2_fields["current_stage"] = "seed"

    return v2_fields


# ══════════════════════════════════════════════
# V2 — PRINCIPLE RESONANCE (Sovereign Prep, SILENT)
# ══════════════════════════════════════════════

# DNA tag → Principle mapping for resonance calculation
_PRINCIPLE_TAGS: dict[str, list[str]] = {
    "order":   ["mind", "relic"],           # Analytical, structured
    "entropy": ["chaos", "shadow"],         # Adaptive, deconstructive
    "matter":  ["tech", "relic"],           # Creative, constructive
    "flux":    ["charm", "chaos"],          # Fluid, boundary-breaking
    "energy":  ["bloodline", "oath"],      # Passionate, connective
    "void":    ["shadow"],                  # Detached, transcendent
}

# Behavioral trait → Principle weighting
_BEHAVIORAL_PRINCIPLE: dict[str, dict[str, float]] = {
    "order":   {"consistency": 0.3, "deliberation": 0.3, "patience": 0.2, "confidence": 0.2},
    "entropy": {"impulsivity": 0.3, "revision_tendency": 0.3, "expressiveness": 0.2, "decisiveness": 0.2},
    "matter":  {"confidence": 0.3, "consistency": 0.2, "patience": 0.3, "deliberation": 0.2},
    "flux":    {"revision_tendency": 0.3, "impulsivity": 0.2, "expressiveness": 0.3, "decisiveness": 0.2},
    "energy":  {"expressiveness": 0.3, "decisiveness": 0.3, "confidence": 0.2, "impulsivity": 0.2},
    "void":    {"patience": 0.4, "deliberation": 0.3, "consistency": 0.3},
}

# Void anchor → Principle bias
_ANCHOR_PRINCIPLE: dict[str, str] = {
    "connection": "energy",
    "power":      "entropy",
    "knowledge":  "order",
    "silence":    "void",
}


def calculate_principle_resonance(
    signals: IdentitySignals,
    skill: UniqueSkill,
) -> PrincipleResonance:
    """Calculate Principle Resonance after Soul Forge — SECRET.

    Player never sees this. Used for silent Proto-Sovereign detection (~3%).

    Weighting:
    - Behavioral Fingerprint (quiz): 60%
    - DNA Tags Alignment: 30%
    - Narrative Choices (void_anchor, sacrifice): 10%

    Proto-Sovereign threshold: max(scores) >= 0.8
    """
    scores: dict[str, float] = {
        "order": 0.0, "entropy": 0.0, "matter": 0.0,
        "flux": 0.0, "energy": 0.0, "void": 0.0,
    }

    # ── 60% Behavioral Fingerprint ──
    behavioral = signals.behavioral
    behavioral_dict = {
        "decisiveness": behavioral.decisiveness,
        "deliberation": behavioral.deliberation,
        "expressiveness": behavioral.expressiveness,
        "confidence": behavioral.confidence,
        "patience": behavioral.patience,
        "consistency": behavioral.consistency,
        "impulsivity": behavioral.impulsivity,
        "revision_tendency": behavioral.revision_tendency,
    }

    for principle, weights in _BEHAVIORAL_PRINCIPLE.items():
        behavior_score = 0.0
        for trait, weight in weights.items():
            behavior_score += behavioral_dict.get(trait, 0.5) * weight
        scores[principle] += behavior_score * 0.6

    # ── 30% DNA Tags Alignment ──
    player_tags = set(skill.trait_tags)
    for principle, tags in _PRINCIPLE_TAGS.items():
        overlap = len(player_tags & set(tags))
        if overlap > 0:
            # Each matching tag adds proportional score
            dna_score = min(1.0, overlap / len(tags))
            scores[principle] += dna_score * 0.3

    # ── 10% Narrative Choices ──
    anchor_principle = _ANCHOR_PRINCIPLE.get(signals.void_anchor)
    if anchor_principle and anchor_principle in scores:
        scores[anchor_principle] += 0.10

    # ── Void cap in Season 1-2 ──
    scores["void"] = min(0.3, scores["void"])

    # ── Normalize to 0.0-1.0 ──
    for principle in scores:
        scores[principle] = round(min(1.0, max(0.0, scores[principle])), 4)

    # ── Proto-Sovereign detection ──
    max_score = max(scores.values())
    dominant = max(scores, key=scores.get)  # type: ignore[arg-type]
    is_proto = max_score >= 0.8

    if is_proto:
        logger.info(
            f"Proto-Sovereign detected! Principle={dominant}, "
            f"score={max_score:.4f} (SECRET — player does not see this)"
        )

    return PrincipleResonance(
        order=scores["order"],
        entropy=scores["entropy"],
        matter=scores["matter"],
        flux=scores["flux"],
        energy=scores["energy"],
        void=scores["void"],
        is_proto_sovereign=is_proto,
        dominant_principle=dominant,
    )

