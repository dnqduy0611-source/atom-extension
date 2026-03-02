"""Amoisekai — Fate Buffer: early-game protection system.

New players get a "Fate Buffer" that:
1. Softens negative consequences in early chapters
2. Provides bonus narrative protection (no permadeath, no total loss)
3. Gradually decays, removing training wheels naturally

The buffer gives AI instructions to be gentler in early game.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.player import PlayerState


@dataclass
class FateBufferStatus:
    """Current state of the Fate Buffer for a player."""
    active: bool
    strength: float             # 0-100
    protection_level: str       # "full" | "partial" | "minimal" | "none"
    narrative_instruction: str  # Instruction for the Writer agent


class FateBuffer:
    """Early-game protection system.

    - Chapters 1-10: Full protection (Fate Buffer 100→75)
    - Chapters 11-20: Partial protection (75→40)
    - Chapters 21-30: Minimal protection (40→10)
    - Chapters 31+: No protection (decays to 0)

    Decay is applied per chapter by the Identity Agent.
    High-risk choices can accelerate decay.
    """

    def __init__(
        self,
        start_decay_chapter: int = 15,
        decay_rate: float = 2.5,
        full_threshold: float = 70.0,
        partial_threshold: float = 30.0,
        minimal_threshold: float = 5.0,
    ) -> None:
        self.start_decay_chapter = start_decay_chapter
        self.decay_rate = decay_rate
        self.full_threshold = full_threshold
        self.partial_threshold = partial_threshold
        self.minimal_threshold = minimal_threshold

    def get_status(self, player: PlayerState) -> FateBufferStatus:
        """Get current Fate Buffer status and narrative instructions."""
        strength = player.fate_buffer

        if strength >= self.full_threshold:
            return FateBufferStatus(
                active=True,
                strength=strength,
                protection_level="full",
                narrative_instruction=(
                    "FATE BUFFER: FULL — Player mới bắt đầu. "
                    "Các hậu quả tiêu cực phải được giảm nhẹ. "
                    "Không có permadeath hoặc mất mát vĩnh viễn. "
                    "Nếu player chọn lựa chọn rủi ro, luôn có lối thoát. "
                    "Mentor NPC có thể can thiệp ở khoảnh khắc nguy hiểm."
                ),
            )

        if strength >= self.partial_threshold:
            return FateBufferStatus(
                active=True,
                strength=strength,
                protection_level="partial",
                narrative_instruction=(
                    "FATE BUFFER: PARTIAL — Player đã có kinh nghiệm. "
                    "Hậu quả tiêu cực tồn tại nhưng không quá khắc nghiệt. "
                    "Mất mát tạm thời OK, mất mát vĩnh viễn chỉ khi player "
                    "liên tục chọn rủi ro cao. Mentor NPC xuất hiện ít hơn."
                ),
            )

        if strength >= self.minimal_threshold:
            return FateBufferStatus(
                active=True,
                strength=strength,
                protection_level="minimal",
                narrative_instruction=(
                    "FATE BUFFER: MINIMAL — Player gần hết bảo vệ. "
                    "Hậu quả hoàn toàn tương xứng với hành động. "
                    "Chỉ bảo vệ khỏi những kết cục cực kỳ bất công "
                    "(do RNG, không phải do lựa chọn player)."
                ),
            )

        return FateBufferStatus(
            active=False,
            strength=0.0,
            protection_level="none",
            narrative_instruction=(
                "FATE BUFFER: NONE — Thế giới phản ứng hoàn toàn thực tế. "
                "Mọi hậu quả tương xứng với hành động. "
                "Permadeath (narrative death) có thể xảy ra nếu player "
                "liên tục chọn đấu với kẻ mạnh hơn mà không chuẩn bị."
            ),
        )

    def calculate_decay(self, player: PlayerState, risk_level: int = 0) -> float:
        """Calculate how much Fate Buffer should decay this chapter.

        Args:
            player: Current player state
            risk_level: 0-5, choice risk level (higher = more decay)

        Returns:
            Negative float to apply as fate_buffer_change
        """
        if player.total_chapters < self.start_decay_chapter:
            # No decay before chapter 15
            if risk_level >= 4:
                return -1.0  # Tiny decay for very risky early choices
            return 0.0

        # Base decay per chapter after start_decay_chapter
        base = self.decay_rate

        # Risk acceleration: high-risk choices speed up decay
        risk_multiplier = 1.0 + (risk_level * 0.2)

        return -(base * risk_multiplier)
