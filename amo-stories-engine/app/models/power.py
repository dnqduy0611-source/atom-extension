"""Amoisekai — Power System foundation models.

Principle enum, NormalSkill, ResonanceState, and combat metrics.
These models are the backbone for combat resolution, skill evolution,
and resonance mastery.

Ref: POWER_SYSTEM_SPEC, COMBAT_SYSTEM_SPEC v1.1, PROGRESSION_SYSTEM_SPEC
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Principles
# ──────────────────────────────────────────────

class Principle(str, Enum):
    """6 fundamental principles governing the world's power.

    Opposing pairs:
        ORDER  ←→ ENTROPY
        MATTER ←→ FLUX
        ENERGY ←→ VOID
    """

    ORDER = "order"
    ENTROPY = "entropy"
    MATTER = "matter"
    FLUX = "flux"
    ENERGY = "energy"
    VOID = "void"

    @property
    def display_name(self) -> str:
        names = {
            "order": "Trật Tự",
            "entropy": "Hỗn Loạn",
            "matter": "Vật Chất",
            "flux": "Linh Hoạt",
            "energy": "Năng Lượng",
            "void": "Hư Không",
        }
        return names.get(self.value, self.value)

    @property
    def opposite(self) -> Principle:
        """Return the opposing principle."""
        opposites = {
            "order": "entropy",
            "entropy": "order",
            "matter": "flux",
            "flux": "matter",
            "energy": "void",
            "void": "energy",
        }
        return Principle(opposites[self.value])

    @property
    def adjacent(self) -> list[Principle]:
        """Return adjacent/compatible principles."""
        adjacency = {
            "order": ["matter", "energy"],
            "entropy": ["flux", "void"],
            "matter": ["order", "energy"],
            "flux": ["entropy", "void"],
            "energy": ["order", "matter"],
            "void": ["entropy", "flux"],
        }
        return [Principle(p) for p in adjacency[self.value]]


ALL_PRINCIPLES = list(Principle)


# ──────────────────────────────────────────────
# Narrative Principles (World Bible §2.4)
# ──────────────────────────────────────────────

class NarrativePrinciple(str, Enum):
    """5 philosophical principles from the World Bible.

    These define the *meaning* layer (identity, narrative, religion).
    Mapped to mechanical Principles for combat/resonance via
    NARRATIVE_TO_MECHANICAL.

    Ref: WORLD_BIBLE §2.4, POWER_SYSTEM_SPEC v1.1 §2.1-2.2
    """

    ORDER = "order"           # Trật Tự — cấu trúc, quy luật
    FREEDOM = "freedom"       # Tự Do — phá vỡ, sáng tạo
    EVOLUTION = "evolution"   # Tiến Hóa — thích nghi, biến đổi
    CONTROL = "control"       # Kiểm Soát — ý chí, áp đặt
    DEVOTION = "devotion"     # Tận Hiến — gắn bó, hy sinh


# Weighted mapping: narrative principle → mechanical resonance distribution.
# Each row sums to 1.0.  Used when initialising resonance from quiz results.
NARRATIVE_TO_MECHANICAL: dict[str, dict[str, float]] = {
    "order":     {"order": 0.8, "matter": 0.1, "energy": 0.1},
    "freedom":   {"entropy": 0.6, "flux": 0.3, "void": 0.1},
    "evolution": {"flux": 0.5, "energy": 0.3, "entropy": 0.2},
    "control":   {"matter": 0.5, "void": 0.3, "order": 0.2},
    "devotion":  {"energy": 0.5, "matter": 0.3, "order": 0.2},
}


def narrative_to_resonance_weights(
    narrative: str | NarrativePrinciple,
    base_resonance: float = 0.5,
) -> dict[str, float]:
    """Convert a narrative principle into weighted resonance deltas.

    Returns a dict of {mechanical_principle: resonance_value} where each
    value is ``base_resonance * weight``.  Useful for seeding a player's
    initial ResonanceState from their Soul Forge quiz.

    Args:
        narrative: A NarrativePrinciple enum value or its string key.
        base_resonance: The total resonance budget to distribute (default 0.5).

    Returns:
        Dict mapping mechanical principle names to resonance values.
    """
    key = narrative.value if isinstance(narrative, NarrativePrinciple) else narrative
    weights = NARRATIVE_TO_MECHANICAL.get(key, {})
    return {p: round(base_resonance * w, 4) for p, w in weights.items()}


ALL_NARRATIVE_PRINCIPLES = list(NarrativePrinciple)


# ──────────────────────────────────────────────
# Rare Principles (Phase 2+ — Floor 3+)
# ──────────────────────────────────────────────

class RarePrinciple(str, Enum):
    """3 rare principles, unlocked via narrative events at Floor 3+.

    These are NOT part of the standard 6-principle interaction graph.
    They always have NEUTRAL interaction with core principles.
    Only used in Tier 3 skills (2 core + 1 rare).

    Ref: POWER_SYSTEM_SPEC v1.1 §2.4
    """

    CAUSALITY = "causality"           # Nhân Quả — delay effects, chain combos
    CONTINUUM = "continuum"           # Liên Tục — persistence, time extension
    RESONANCE_META = "resonance_meta" # Cộng Hưởng — self-amplification


# ──────────────────────────────────────────────
# Principle Interactions
# ──────────────────────────────────────────────

class InteractionType(str, Enum):
    STRONG = "strong"         # Attacker has advantage (+0.15)
    WEAK = "weak"             # Attacker has disadvantage (-0.10)
    NEUTRAL = "neutral"       # No modifier (0.0)
    SYNERGY = "synergy"       # Adjacent — good for dual skills (+0.05)


class PrincipleInteraction(BaseModel):
    """Result of checking interaction between two principles."""

    attacker: str
    defender: str
    interaction: InteractionType = InteractionType.NEUTRAL
    advantage_mod: float = 0.0  # -0.10 to +0.15


def get_principle_interaction(
    attacker: str | Principle,
    defender: str | Principle,
) -> PrincipleInteraction:
    """Get interaction between attacker's principle and defender's.

    - Opposite principle → STRONG (+0.15 advantage to attacker)
    - Same principle → NEUTRAL (0.0)
    - Adjacent → SYNERGY (+0.05)
    - Non-adjacent, non-opposite → WEAK (-0.10)
    """
    att = Principle(attacker) if isinstance(attacker, str) else attacker
    dfd = Principle(defender) if isinstance(defender, str) else defender

    if att == dfd:
        return PrincipleInteraction(
            attacker=att.value,
            defender=dfd.value,
            interaction=InteractionType.NEUTRAL,
            advantage_mod=0.0,
        )

    if dfd == att.opposite:
        return PrincipleInteraction(
            attacker=att.value,
            defender=dfd.value,
            interaction=InteractionType.STRONG,
            advantage_mod=0.15,
        )

    if dfd in att.adjacent:
        return PrincipleInteraction(
            attacker=att.value,
            defender=dfd.value,
            interaction=InteractionType.SYNERGY,
            advantage_mod=0.05,
        )

    # Non-adjacent, non-opposite → disadvantage
    return PrincipleInteraction(
        attacker=att.value,
        defender=dfd.value,
        interaction=InteractionType.WEAK,
        advantage_mod=-0.10,
    )


# ──────────────────────────────────────────────
# Normal Skills
# ──────────────────────────────────────────────

class NormalSkill(BaseModel):
    """A normal (non-unique) combat skill.

    Skills have 1-3 principles and a tier level.
    Higher tiers require higher rank and have more principles.
    """

    id: str = ""
    name: str = ""
    description: str = ""
    primary_principle: str = ""        # Principle enum value
    secondary_principle: str = ""      # For Tier 2+ dual-principle skills
    tertiary_principle: str = ""       # For Tier 3 rare/augmented skills
    tier: int = 1                      # 1, 2, or 3
    mechanic: str = ""                 # How the skill works
    limitation: str = ""               # Constraint (range, cooldown, cost, etc.)
    weakness: str = ""                 # Vulnerability
    source: str = ""                   # "story" | "floor_reward" | "integration" | "lore"

    @property
    def principles(self) -> list[str]:
        """All active principles for this skill."""
        result = []
        if self.primary_principle:
            result.append(self.primary_principle)
        if self.secondary_principle:
            result.append(self.secondary_principle)
        if self.tertiary_principle:
            result.append(self.tertiary_principle)
        return result


# ──────────────────────────────────────────────
# Resonance State
# ──────────────────────────────────────────────

# Floor resonance caps (soft ceiling per floor)
FLOOR_RESONANCE_CAPS: dict[int, float] = {
    1: 0.50,
    2: 0.70,
    3: 0.85,
    4: 0.95,
    5: 1.00,
}


def get_floor_resonance_cap(floor: int) -> float:
    """Get the resonance soft cap for a given floor."""
    if floor < 1:
        return 0.50
    return FLOOR_RESONANCE_CAPS.get(floor, 1.0)


class ResonanceState(BaseModel):
    """Per-principle resonance tracking.

    All values clamped 0.0-1.0.
    Higher resonance = more effective with that principle.
    """

    order: float = 0.0
    entropy: float = 0.0
    matter: float = 0.0
    flux: float = 0.0
    energy: float = 0.0
    void: float = 0.0

    def get(self, principle: str | Principle) -> float:
        """Get resonance for a specific principle."""
        key = principle.value if isinstance(principle, Principle) else principle
        return getattr(self, key, 0.0)

    def set(self, principle: str | Principle, value: float) -> None:
        """Set resonance for a specific principle, clamped 0.0-1.0."""
        key = principle.value if isinstance(principle, Principle) else principle
        setattr(self, key, max(0.0, min(1.0, value)))

    def grow(
        self,
        principle: str | Principle,
        delta: float,
        floor: int = 1,
        personal_cap_bonus: float = 0.0,
    ) -> float:
        """Grow resonance by delta, respecting floor cap + personal bonus.

        Returns the new resonance value.
        """
        cap = min(1.0, get_floor_resonance_cap(floor) + personal_cap_bonus)
        current = self.get(principle)
        new_val = min(cap, current + delta)
        self.set(principle, new_val)
        return new_val

    def decay(self, principle: str | Principle, amount: float = 0.005) -> float:
        """Decay resonance for unused principle (minimum 0.1)."""
        current = self.get(principle)
        new_val = max(0.1, current - amount)
        self.set(principle, new_val)
        return new_val

    def to_dict(self) -> dict[str, float]:
        """Return all resonance values as dict."""
        return {p.value: self.get(p) for p in Principle}

    def dominant_principle(self) -> str:
        """Return principle with highest resonance."""
        d = self.to_dict()
        return max(d, key=d.get)  # type: ignore[arg-type]


# ──────────────────────────────────────────────
# Combat Metrics
# ──────────────────────────────────────────────

class CombatMetrics(BaseModel):
    """Runtime combat state, derived from PlayerState."""

    hp: float = 100.0              # 0-100, depletes in combat
    stability: float = 100.0       # 0-100, resource pool + defense + sanity
    instability: float = 0.0       # 0-100, risk meter
    dqs: float = 50.0              # Decision Quality Score 0-100
    breakthrough: float = 0.0      # 0-100, controlled randomness influence

    @property
    def stability_ratio(self) -> float:
        """0.0-1.0 ratio for combat score calculation."""
        return self.stability / 100.0

    @property
    def dqs_ratio(self) -> float:
        """0.0-1.0 ratio for combat score calculation."""
        return self.dqs / 100.0


# ──────────────────────────────────────────────
# Intensity Levels
# ──────────────────────────────────────────────

class Intensity(str, Enum):
    """Combat intensity chosen by player or context."""

    SAFE = "safe"          # Low risk, low reward
    PUSH = "push"          # Moderate risk/reward
    OVERDRIVE = "overdrive"  # High risk, high reward, backlash possible

    @property
    def bonus(self) -> float:
        """Combat score bonus for this intensity."""
        return {"safe": 0.0, "push": 0.02, "overdrive": 0.05}[self.value]

    @property
    def backlash_risk(self) -> float:
        """Probability of backlash at this intensity."""
        return {"safe": 0.0, "push": 0.05, "overdrive": 0.20}[self.value]
