"""Canon Guard — detect violations of Aelvyndor world canon in generated prose.

Runs as a fast, pre-LLM check in the critic node.
Critical violations force a rewrite without consuming a full LLM critic call.
Medium violations are appended to critic instructions as warnings.

Pattern rules are in Vietnamese and English to match bilingual prose.
"""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger(__name__)


@dataclass
class CanonViolation:
    rule_id: str
    message: str
    severity: Literal["critical", "high", "medium"]
    matched_text: str


# ──────────────────────────────────────────────
# Canon Rules
# Format: (rule_id, pattern, message, severity)
# ──────────────────────────────────────────────

_RULES: list[tuple[str, str, str, str]] = [

    # ── Archon rules ──
    (
        "archon_direct_appearance",
        r"\b(Aethis|Vyrel|Morphael|Dominar|Seraphine)\b.{0,50}"
        r"(xuất hiện|nói chuyện|gặp|đến|appeared|spoke|arrived|said)",
        "Archon KHÔNG BAO GIỜ xuất hiện trực tiếp — chỉ biểu hiện qua hiện tượng, không phải NPC",
        "critical",
    ),
    (
        "archon_as_npc",
        r"(Aethis|Vyrel|Morphael|Dominar|Seraphine)\s+(nói|hỏi|trả lời|ra lệnh|cười|nhìn)",
        "Archon không có dialogue trực tiếp — không được viết như NPC",
        "critical",
    ),

    # ── Veiled Will rules ──
    (
        "veiled_will_reveal",
        r"Veiled Will\s+(là|chính là|tên thật|thực chất|revealed|is actually)",
        "Veiled Will KHÔNG được reveal identity Season 1",
        "critical",
    ),
    (
        "veiled_will_confirm",
        r"(The Veiled Will|Ý Chí Ẩn)\s+(có ý thức|conscious|is aware|biết mọi|knows all)",
        "Không confirm Veiled Will có ý thức Season 1 — giữ ambiguous",
        "high",
    ),

    # ── General physical appearance Phase 1 ──
    (
        "general_physical_phase1",
        r"\b(Vorn|Kha|Mireth|Azen)\b.{0,30}"
        r"(xuất hiện|bước vào|đứng trước|tấn công|appeared|stepped|stood before|attacked)",
        "General KHÔNG xuất hiện vật lý Phase 1 — chỉ shadow voice (tối đa 2-3 câu)",
        "critical",
    ),

    # ── Game terminology ──
    (
        "game_terminology_hp",
        r"\b(HP|hit point|health point|máu còn|lượng máu)\b",
        "Không dùng HP/health point — dùng lore terms (thương thế, sức sống, v.v.)",
        "medium",
    ),
    (
        "game_terminology_xp",
        r"\b(XP|EXP|experience point|nhận được\s+\d+\s*điểm|level up|lên cấp)\b",
        "Không dùng XP/level up — progression thể hiện qua narrative, không số liệu",
        "medium",
    ),
    (
        "game_terminology_mp",
        r"\b(MP|mana point|mana bar)\b",
        "Không dùng MP/mana — dùng lore terms",
        "medium",
    ),
    (
        "game_terminology_stat",
        r"\b(STR|DEX|INT|VIT|AGI|stat\s+\+\d+|chỉ số tăng)\b",
        "Không dùng stat numbers — progression là narrative, không số",
        "medium",
    ),

    # ── Location rules ──
    (
        "grand_gate_city_sea",
        r"Grand Gate City.{0,100}(biển|cảng|tàu thuyền|sea|port|harbor|ship)",
        "Grand Gate City KHÔNG có biển hay cảng — nằm nội địa",
        "high",
    ),
    (
        "tower_floor_fixed_layout",
        r"(Tower|Tháp).{0,50}(map|layout|cấu trúc cố định|fixed|same floor|tầng giống nhau)",
        "Tower KHÔNG có layout cố định — thay đổi theo người vào",
        "medium",
    ),

    # ── World rules ──
    (
        "player_omnipotent",
        r"(không có gì có thể|không ai có thể chống lại|unstoppable|invincible|bất khả chiến bại)",
        "Không cho player omnipotent — sức mạnh luôn có giá và giới hạn",
        "high",
    ),
    (
        "easy_all_good_choices",
        r"(mọi lựa chọn đều tốt|không có hậu quả|không mất gì|all choices are safe|no downside)",
        "Không tạo tình huống mà mọi lựa chọn đều tốt — phải có sacrifice",
        "high",
    ),
    (
        "lore_info_dump",
        r"(Để giải thích|Như bạn đã biết|As you know|Let me explain the history|"
        r"Lịch sử của thế giới này là|Thế giới Aelvyndor được tạo ra khi)",
        "Không info dump lore trực tiếp — tiết lộ qua NPC, artifact, tình huống",
        "medium",
    ),
]

# Compile patterns once
_COMPILED_RULES: list[tuple[str, re.Pattern, str, str]] = [
    (rule_id, re.compile(pattern, re.IGNORECASE | re.DOTALL), message, severity)
    for rule_id, pattern, message, severity in _RULES
]


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def check_canon(prose: str) -> list[CanonViolation]:
    """Check prose for canon violations.

    Returns list of CanonViolation (empty = clean).
    Only checks the first 5000 characters to keep latency low.
    """
    if not prose:
        return []

    sample = prose[:5000]
    violations: list[CanonViolation] = []

    for rule_id, pattern, message, severity in _COMPILED_RULES:
        match = pattern.search(sample)
        if match:
            violations.append(CanonViolation(
                rule_id=rule_id,
                message=message,
                severity=severity,
                matched_text=match.group(0)[:80],  # cap for logging
            ))

    if violations:
        critical = [v for v in violations if v.severity == "critical"]
        high = [v for v in violations if v.severity == "high"]
        medium = [v for v in violations if v.severity == "medium"]
        logger.warning(
            f"Canon Guard: {len(violations)} violations "
            f"(critical={len(critical)}, high={len(high)}, medium={len(medium)})"
        )

    return violations


def has_critical_violation(violations: list[CanonViolation]) -> bool:
    return any(v.severity == "critical" for v in violations)


def format_for_rewrite(violations: list[CanonViolation]) -> str:
    """Format violations as instruction block for rewrite prompt."""
    if not violations:
        return ""

    lines = ["⚠️ CANON VIOLATIONS — BẮT BUỘC SỬA TRONG BẢN REWRITE:"]
    for v in violations:
        lines.append(f"[{v.severity.upper()}] {v.message}")
        lines.append(f"  → Triggered by: \"{v.matched_text}\"")
    return "\n".join(lines)


def format_as_warnings(violations: list[CanonViolation]) -> str:
    """Format non-critical violations as warnings (appended to critic notes)."""
    non_critical = [v for v in violations if v.severity != "critical"]
    if not non_critical:
        return ""
    lines = ["⚠️ Canon warnings (xem xét trong lần rewrite nếu cần):"]
    for v in non_critical:
        lines.append(f"- {v.message}")
    return "\n".join(lines)
