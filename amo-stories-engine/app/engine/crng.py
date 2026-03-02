"""Amoisekai — Controlled RNG (CRNG) Engine.

RNG that's biased by player DNA — feels random but respects identity.
Used by the Planner agent to decide event types and rewards.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from app.models.player import DNAAffinityTag, PlayerState


@dataclass
class CRNGResult:
    """Result of a CRNG roll."""
    triggered: bool = False
    event_type: str = ""        # "rogue_event" | "breakthrough" | "skill_drop"
    affinity_tag: str = ""      # Which DNA tag was activated
    details: str = ""


class CRNGEngine:
    """Controlled RNG — biased randomness tuned by player DNA.

    Key mechanics:
    - Pity Timer: increases chance of major events the longer player waits
    - DNA Affinity: 70% synergistic, 30% outlier for variety
    - Breakthrough: triggered when high-risk play is sustained
    """

    def __init__(
        self,
        pity_base_chance: float = 0.05,
        pity_increment: float = 0.02,
        pity_max_bonus: float = 0.20,
        breakthrough_threshold: float = 90.0,
    ) -> None:
        self.pity_base_chance = pity_base_chance
        self.pity_increment = pity_increment
        self.pity_max_bonus = pity_max_bonus
        self.breakthrough_threshold = breakthrough_threshold

    # ── Pity Timer ──

    def pity_chance(self, pity_counter: int) -> float:
        """Calculate current chance of major event.

        Starts at base_chance (5%), increases by increment (2%) per chapter
        without a major event, capped at base + max_bonus (25%).
        """
        bonus = min(pity_counter * self.pity_increment, self.pity_max_bonus)
        return self.pity_base_chance + bonus

    def should_trigger_major_event(self, player: PlayerState) -> bool:
        """Check if pity timer triggers a major narrative event.

        Major events: powerful NPC encounter, relic discovery,
        sect recruitment, cultivation breakthrough (narrative).
        """
        chance = self.pity_chance(player.pity_counter)
        return random.random() < chance

    # ── DNA Affinity ──

    def roll_affinity(self, player: PlayerState) -> DNAAffinityTag:
        """Roll a DNA-biased affinity tag.

        70% chance: synergistic with player's 3 DNA tags
        30% chance: outlier from the remaining tags (surprise!)
        """
        all_tags = list(DNAAffinityTag)

        if not player.dna_affinity:
            return random.choice(all_tags)

        if random.random() < 0.7:
            # Synergistic — pick from player's DNA
            return random.choice(player.dna_affinity)
        else:
            # Outlier — pick from others
            outliers = [t for t in all_tags if t not in player.dna_affinity]
            return random.choice(outliers) if outliers else random.choice(all_tags)

    def generate_skill_affinity(self, player: PlayerState) -> dict:
        """Generate skill/item affinity biased by DNA.

        Returns dict for Planner agent to use in chapter planning.
        """
        tag = self.roll_affinity(player)
        is_synergistic = tag in player.dna_affinity

        return {
            "affinity_tag": tag.value,
            "synergistic": is_synergistic,
            "flavor": _AFFINITY_FLAVORS.get(tag.value, "mysterious power"),
        }

    # ── Breakthrough Check ──

    def should_trigger_breakthrough(self, player: PlayerState) -> bool:
        """Check if player's breakthrough meter is full.

        Breakthrough = major narrative turning point:
        - Cultivation rank up (not usual grind)
        - Identity awakening / transformation
        - Major world impact moment
        """
        return player.breakthrough_meter >= self.breakthrough_threshold

    # ── Rogue Event ──

    def should_trigger_rogue_event(self, player: PlayerState) -> bool:
        """Check for early-game rogue event (mentor/relic/awakening).

        Only in first 30 chapters. Pity-boosted chance.
        """
        if player.total_chapters > 30:
            return False
        return self.should_trigger_major_event(player)

    # ── Combined Roll ──

    def roll_chapter_events(self, player: PlayerState) -> CRNGResult:
        """Full CRNG roll for a chapter — checks all triggers.

        Priority: breakthrough > rogue_event > pity_event > none
        """
        # 1. Breakthrough (deterministic threshold)
        if self.should_trigger_breakthrough(player):
            tag = self.roll_affinity(player)
            return CRNGResult(
                triggered=True,
                event_type="breakthrough",
                affinity_tag=tag.value,
                details="Breakthrough meter full — major turning point",
            )

        # 2. Rogue event (early game)
        if self.should_trigger_rogue_event(player):
            tag = self.roll_affinity(player)
            return CRNGResult(
                triggered=True,
                event_type="rogue_event",
                affinity_tag=tag.value,
                details="Early-game rogue event triggered",
            )

        # 3. Pity timer
        if self.should_trigger_major_event(player):
            tag = self.roll_affinity(player)
            return CRNGResult(
                triggered=True,
                event_type="major_event",
                affinity_tag=tag.value,
                details=f"Pity timer triggered (counter: {player.pity_counter})",
            )

        return CRNGResult(triggered=False)


# ──────────────────────────────────────────────
# Flavor text per affinity
# ──────────────────────────────────────────────

_AFFINITY_FLAVORS: dict[str, str] = {
    "shadow": "bóng tối, ẩn mình, hư không",
    "oath": "lời thề, khế ước, ràng buộc",
    "bloodline": "huyết thống, tu luyện thể chất, di sản",
    "tech": "cơ quan thuật, trận pháp, logic",
    "chaos": "hỗn loạn, phá hủy, bất ngờ",
    "mind": "tinh thần lực, phân tích, tâm linh",
    "charm": "mị lực, giao tiếp, thao túng",
    "relic": "cổ vật, tri thức cấm, sức mạnh cổ đại",
}
