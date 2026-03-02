"""Combat Failure Engine — Permanent Scars + Hidden Fate Buffer.

Fate Buffer (HIDDEN from player — §FATE BUFFER SYSTEM spec):
    - Starts at 100, decays over chapters (via FateBuffer.calculate_decay)
    - When HP → 0 mid-combat: if buffer ≥ threshold, death converts to arc
    - Narrative explains via lore: "linh hồn chưa hoàn chỉnh", "thực thể can thiệp"
    - Player NEVER knows buffer exists — all explanations are in-world
    - Buffer consumed per-use: cost = FATE_SAVE_COST (deducted from buffer)
    - Multiple saves possible as long as buffer ≥ threshold

Defeat escalation (when Fate Buffer can't save):
    1st defeat: "Scar"           — hp_max -10%, recovery 60%, resonance -15%
    2nd defeat: "Fracture"       — hp_max -10%, recovery 50%, instability +15, skill eff -20%
    3rd defeat: "Breaking Point" — hp_max -15%, recovery 40%, instability +25, resonance -20%, skill eff -30%
    4th defeat: "Soul Death"     — story enters ending arc
"""

from __future__ import annotations

import logging
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Fate Buffer Constants ──

FATE_SAVE_THRESHOLD = 30.0    # Minimum fate_buffer to trigger save
FATE_SAVE_COST = 40.0         # How much buffer is consumed per save
FATE_SAVE_ADAPT_BONUS = 0.30  # Combat bonus for the phase after fate fires
FATE_BURST_HP_RESTORE_PCT = 0.25   # Restore HP to 25% of max
FATE_BURST_STABILITY_RESTORE = 20.0  # Stability restored on burst

# Lore-based narrative cues for fate save (player never sees "Fate Buffer")
FATE_SAVE_NARRATIVES = [
    (
        "Bóng tối bao trùm… nhưng có điều gì đó giữ bạn lại. "
        "Linh hồn chưa hoàn chỉnh — thế giới này chưa cho phép bạn ra đi."
    ),
    (
        "Lưỡi kiếm xuyên qua, nhưng vết thương đóng lại bất thường. "
        "Một thực thể vô hình can thiệp — bạn chưa được phép chết ở đây."
    ),
    (
        "Ký ức từ kiếp trước ập đến, kéo bạn khỏi bờ vực. "
        "Unique Skill bùng lên một cách bản năng, cứu mạng chủ nhân."
    ),
    (
        "Mặt đất rung chuyển. Kẻ thù dừng lại — "
        "thế giới can thiệp, chưa muốn câu chuyện này kết thúc sớm."
    ),
]

# Narrative directives for the scene writer when Fate fires
# These instruct AI to create a dramatic unique skill burst moment
FATE_BURST_DIRECTIVES = [
    (
        "FATE BURST — Unique Skill tạm thời đột phá ~70% tiềm năng tiến hóa: "
        "Vũ khí/skill sáng lên rực rỡ, biến đổi hình dáng trong khoảnh khắc. "
        "Sức mạnh bùng nổ mạnh mẽ nhưng KHÔNG ỔN ĐỊNH — "
        "sau 1-2 đòn, sức mạnh rút đi, để lại player kiệt sức nhưng sống sót."
    ),
    (
        "FATE BURST — Ký ức từ kiếp trước ập đến, giải phóng ~70% tiềm năng: "
        "Unique Skill biến đổi tạm thời — mạnh hơn bất cứ lúc nào trước đó. "
        "Nhưng cơ thể chưa chịu nổi sức mạnh này — "
        "viết cảnh sức mạnh tan biến, player gục xuống nhưng kẻ thù lùi lại."
    ),
    (
        "FATE BURST — Linh hồn cộng hưởng với thế giới, đột phá ~70%: "
        "Nguyên tố bùng lên xung quanh, skill tiến hóa tạm thời. "
        "Một đòn duy nhất — mạnh đến mức làm thay đổi cục diện. "
        "Sau đó, sức mạnh rút đi hoàn toàn. Player hiểu: 'đây là giới hạn hiện tại'."
    ),
]

# ── Scar Escalation Config ──

SCAR_CONFIG = {
    1: {
        "type": "scar",
        "label": "Vết Sẹo",
        "hp_max_loss_pct": 0.10,
        "recovery_pct": 0.60,
        "instability_gain": 0.0,
        "resonance_damage_pct": 0.15,
        "skill_effectiveness_loss": 0.0,
        "narrative": (
            "Trận đấu để lại vết sẹo sâu — thể xác và tâm hồn đều mang thương. "
            "Viết cảnh nhân vật tỉnh dậy với vết thương không lành hẳn."
        ),
    },
    2: {
        "type": "fracture",
        "label": "Rạn Nứt",
        "hp_max_loss_pct": 0.10,
        "recovery_pct": 0.50,
        "instability_gain": 15.0,
        "resonance_damage_pct": 0.0,
        "skill_effectiveness_loss": 0.20,
        "narrative": (
            "Sức mạnh bắt đầu suy yếu. Kỹ năng lung lay, bản ngã rạn nứt. "
            "Viết cảnh kỹ năng hoạt động không ổn định, nhân vật nghi ngờ bản thân."
        ),
    },
    3: {
        "type": "breaking_point",
        "label": "Điểm Gãy",
        "hp_max_loss_pct": 0.15,
        "recovery_pct": 0.40,
        "instability_gain": 25.0,
        "resonance_damage_pct": 0.20,
        "skill_effectiveness_loss": 0.30,
        "narrative": (
            "Linh hồn đứng trước bờ vực. "
            "Sức mạnh biến đổi không kiểm soát — một phần của bạn đã mất đi vĩnh viễn. "
            "Viết cảnh nhân vật gần như tan rã, phải lựa chọn: bám víu hay buông."
        ),
    },
}


# ── Models ──

class DefeatResult(BaseModel):
    """Result of applying a defeat to a player."""

    defeat_number: int                      # Which defeat this is (1-4+)
    scar_type: str = ""                     # scar / fracture / breaking_point / soul_death
    scar_label: str = ""                    # Vietnamese display name
    is_soul_death: bool = False             # True if this is the final defeat

    # Penalties applied
    hp_max_before: float = 100.0
    hp_max_after: float = 100.0
    hp_recovered_to: float = 0.0
    instability_gained: float = 0.0
    resonance_principle_damaged: str = ""
    resonance_damage_pct: float = 0.0
    skill_effectiveness_loss: float = 0.0

    # For scene writer
    narrative_instruction: str = ""


# ── Core Functions ──

def can_fate_save(fate_buffer: float) -> bool:
    """Check if Fate Buffer can save the player mid-combat.

    Hidden from player — uses lore narrative, never system terminology.
    Buffer decays naturally over chapters (managed by player state).
    """
    return fate_buffer >= FATE_SAVE_THRESHOLD


def consume_fate_buffer(player) -> float:
    """Consume fate buffer after a save. Returns new buffer value.

    Deducts FATE_SAVE_COST from player's fate_buffer.
    """
    player.fate_buffer = max(0.0, player.fate_buffer - FATE_SAVE_COST)
    logger.info(
        f"Fate buffer consumed: -{FATE_SAVE_COST}, "
        f"remaining={player.fate_buffer:.1f}"
    )
    return player.fate_buffer


def get_fate_save_narrative(defeat_count: int = 0) -> str:
    """Get a lore-appropriate narrative for fate save.

    Rotates through narratives to avoid repetition.
    Player never sees 'Fate Buffer' — all explanations are in-world.
    """
    idx = defeat_count % len(FATE_SAVE_NARRATIVES)
    return FATE_SAVE_NARRATIVES[idx]


def get_fate_burst_directive(defeat_count: int = 0) -> str:
    """Get directive for scene writer to create dramatic skill burst.

    Returns instruction for AI to write ~70% potential breakthrough.
    """
    idx = defeat_count % len(FATE_BURST_DIRECTIVES)
    return FATE_BURST_DIRECTIVES[idx]


def apply_defeat(
    player,  # PlayerState — avoid circular import
    enemy_name: str = "Unknown",
    chapter_number: int = 0,
) -> DefeatResult:
    """Apply escalating defeat penalties to the player.

    Must be called AFTER combat resolves with enemy_wins
    AND fate buffer cannot save.
    Mutates player state in place.
    """
    player.defeat_count += 1
    defeat_num = player.defeat_count

    # ── Soul Death: 4th defeat ──
    if defeat_num >= 4:
        logger.warning(
            f"SOUL DEATH for player {player.id} — "
            f"defeat #{defeat_num} by {enemy_name}"
        )
        return DefeatResult(
            defeat_number=defeat_num,
            scar_type="soul_death",
            scar_label="Linh Hồn Tan Rã",
            is_soul_death=True,
            hp_max_before=player.hp_max,
            hp_max_after=0.0,
            hp_recovered_to=0.0,
            narrative_instruction=(
                "SOUL DEATH — Linh hồn nhân vật tan rã hoàn toàn. "
                "Viết cảnh kết thúc bi tráng: nhân vật gục ngã lần cuối, "
                "thế giới mờ dần, mọi liên kết đứt gãy. "
                "Đây là ENDING của câu chuyện này."
            ),
        )

    # ── Get scar config ──
    config = SCAR_CONFIG.get(defeat_num, SCAR_CONFIG[3])  # Cap at breaking_point

    hp_max_before = player.hp_max
    hp_max_loss = player.hp_max * config["hp_max_loss_pct"]
    player.hp_max = max(10.0, player.hp_max - hp_max_loss)  # Floor at 10 HP

    # Recovery
    recovery_hp = player.hp_max * config["recovery_pct"]
    player.hp = recovery_hp

    # Instability
    instability_gain = config["instability_gain"]
    player.instability = min(100.0, player.instability + instability_gain)

    # Resonance damage — damage the highest principle
    resonance_principle = ""
    resonance_dmg = config["resonance_damage_pct"]
    if resonance_dmg > 0 and player.resonance:
        max_principle = max(player.resonance, key=player.resonance.get)
        old_val = player.resonance[max_principle]
        player.resonance[max_principle] = max(0.0, old_val * (1 - resonance_dmg))
        resonance_principle = max_principle
        logger.info(
            f"Scar resonance damage: {max_principle} "
            f"{old_val:.2f} → {player.resonance[max_principle]:.2f}"
        )

    # Skill effectiveness loss
    skill_eff_loss = config["skill_effectiveness_loss"]
    if skill_eff_loss > 0 and player.unique_skill:
        player.unique_skill.resilience = max(
            10.0,
            player.unique_skill.resilience * (1 - skill_eff_loss),
        )

    # Record scar
    scar_record = {
        "type": config["type"],
        "label": config["label"],
        "defeat_number": defeat_num,
        "hp_max_loss": round(hp_max_loss, 1),
        "source_enemy": enemy_name,
        "chapter": chapter_number,
        "instability_gained": instability_gain,
        "resonance_damaged": resonance_principle,
    }
    player.scars.append(scar_record)

    logger.info(
        f"Defeat #{defeat_num} ({config['type']}) applied to {player.id}: "
        f"hp_max {hp_max_before:.0f} → {player.hp_max:.0f}, "
        f"hp recovered to {recovery_hp:.0f}"
    )

    return DefeatResult(
        defeat_number=defeat_num,
        scar_type=config["type"],
        scar_label=config["label"],
        is_soul_death=False,
        hp_max_before=hp_max_before,
        hp_max_after=player.hp_max,
        hp_recovered_to=recovery_hp,
        instability_gained=instability_gain,
        resonance_principle_damaged=resonance_principle,
        resonance_damage_pct=resonance_dmg,
        skill_effectiveness_loss=skill_eff_loss,
        narrative_instruction=config["narrative"],
    )
