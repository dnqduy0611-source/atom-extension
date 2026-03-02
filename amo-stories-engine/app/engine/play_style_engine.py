"""Amoisekai — Play Style Engine.

Seeds initial PlayStyleState from Soul Forge BehavioralFingerprint,
then updates it after each chapter based on player choices.

Cross-reference: PHASE1_ADAPTIVE_ENGINE §PlayStyle Update Mechanics
"""

from __future__ import annotations

from app.models.adaptive import PlayStyleState
from app.models.adaptive_constants import seed_play_style_from_fingerprint


# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

# Base delta per choice signal (small, gradual shift)
BASE_DELTA: int = 3

# Minimum axis value
AXIS_MIN: int = 0

# Maximum axis value
AXIS_MAX: int = 100


# ──────────────────────────────────────────────
# Seed from Soul Forge
# ──────────────────────────────────────────────

def seed_play_style(
    decisiveness: float = 0.5,
    deliberation: float = 0.5,
    expressiveness: float = 0.5,
    confidence: float = 0.5,
    patience: float = 0.5,
    consistency: float = 0.5,
    impulsivity: float = 0.5,
    revision_tendency: float = 0.5,
) -> PlayStyleState:
    """Convert BehavioralFingerprint → initial PlayStyleState.

    Called once after Soul Forge Phase 3 completes.

    Args:
        All 8 BehavioralFingerprint dimensions (0.0–1.0).

    Returns:
        PlayStyleState with seeded initial axis values.
    """
    raw = seed_play_style_from_fingerprint(
        decisiveness=decisiveness,
        deliberation=deliberation,
        expressiveness=expressiveness,
        confidence=confidence,
        patience=patience,
        consistency=consistency,
        impulsivity=impulsivity,
        revision_tendency=revision_tendency,
    )

    return PlayStyleState(
        risk_appetite=raw["risk_appetite"],
        alliance_tendency=raw["alliance_tendency"],
        curiosity_depth=raw["curiosity_depth"],
        moral_axis=raw["moral_axis"],
        combat_preference=raw["combat_preference"],
    )


def seed_play_style_from_fingerprint_model(fingerprint) -> PlayStyleState:
    """Convenience: seed from a BehavioralFingerprint model instance.

    Args:
        fingerprint: BehavioralFingerprint model with 8 float fields.

    Returns:
        PlayStyleState with seeded initial axis values.
    """
    return seed_play_style(
        decisiveness=fingerprint.decisiveness,
        deliberation=fingerprint.deliberation,
        expressiveness=fingerprint.expressiveness,
        confidence=fingerprint.confidence,
        patience=fingerprint.patience,
        consistency=fingerprint.consistency,
        impulsivity=fingerprint.impulsivity,
        revision_tendency=fingerprint.revision_tendency,
    )


# ──────────────────────────────────────────────
# Per-Chapter Update
# ──────────────────────────────────────────────

def update_play_style(
    play_style: PlayStyleState,
    chosen_risk_level: int = 1,
    choice_type: str = "narrative",
    consequence_tags: list[str] | None = None,
) -> PlayStyleState:
    """Update PlayStyleState after a chapter based on observed behavior.

    Called once per chapter with the player's actual choice data.
    Shifts axes by ±BASE_DELTA per signal. No decay — axes only
    shift when there's new behavioral input.

    Args:
        play_style: Current PlayStyleState to update.
        chosen_risk_level: Risk level (1-5) of the choice the player made.
        choice_type: "narrative" or "combat_decision".
        consequence_tags: Tags from the choice consequence_hint / chapter
            result. Examples: "combat", "trust", "explore", "risky",
            "principled", "pragmatic", "solo", "ally", "diplomatic".

    Returns:
        Updated PlayStyleState (new instance, original not mutated).
    """
    tags = set(t.lower() for t in (consequence_tags or []))

    # Start with copies of current values
    risk = play_style.risk_appetite
    alliance = play_style.alliance_tendency
    curiosity = play_style.curiosity_depth
    moral = play_style.moral_axis
    combat = play_style.combat_preference

    # ── Risk Appetite ──
    if chosen_risk_level >= 4 or "risky" in tags:
        risk += BASE_DELTA
    elif chosen_risk_level <= 2 or "cautious" in tags or "safe" in tags:
        risk -= BASE_DELTA

    # ── Combat Preference ──
    if choice_type == "combat_decision" or "combat" in tags:
        combat += BASE_DELTA
    elif "diplomatic" in tags or "negotiation" in tags or "avoid" in tags:
        combat -= BASE_DELTA

    # ── Alliance Tendency ──
    if "trust" in tags or "ally" in tags or "cooperation" in tags:
        alliance += BASE_DELTA
    elif "solo" in tags or "betray" in tags or "distrust" in tags:
        alliance -= BASE_DELTA

    # ── Moral Axis ──
    if "principled" in tags or "sacrifice" in tags or "protect" in tags:
        moral += BASE_DELTA
    elif "pragmatic" in tags or "ruthless" in tags or "manipulate" in tags:
        moral -= BASE_DELTA

    # ── Curiosity Depth ──
    if "explore" in tags or "investigate" in tags or "lore" in tags:
        curiosity += BASE_DELTA
    elif "rush" in tags or "skip" in tags or "direct" in tags:
        curiosity -= BASE_DELTA

    # ── Clamp all axes to [0, 100] ──
    return PlayStyleState(
        risk_appetite=_clamp(risk),
        alliance_tendency=_clamp(alliance),
        curiosity_depth=_clamp(curiosity),
        moral_axis=_clamp(moral),
        combat_preference=_clamp(combat),
    )


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _clamp(value: int, lo: int = AXIS_MIN, hi: int = AXIS_MAX) -> int:
    """Clamp value to [lo, hi]."""
    return max(lo, min(hi, value))


def get_dominant_style(play_style: PlayStyleState) -> str:
    """Return the axis label that is most extreme (furthest from 50).

    Useful for AI prompt injection: "This player is primarily a risk-taker."
    """
    axes = {
        "risk_taker" if play_style.risk_appetite > 50 else "cautious":
            abs(play_style.risk_appetite - 50),
        "community_builder" if play_style.alliance_tendency > 50 else "lone_wolf":
            abs(play_style.alliance_tendency - 50),
        "deep_explorer" if play_style.curiosity_depth > 50 else "focused":
            abs(play_style.curiosity_depth - 50),
        "idealist" if play_style.moral_axis > 50 else "pragmatist":
            abs(play_style.moral_axis - 50),
        "combat_first" if play_style.combat_preference > 50 else "diplomatic":
            abs(play_style.combat_preference - 50),
    }
    return max(axes, key=axes.get)  # type: ignore[arg-type]


def format_play_style_prompt(play_style: PlayStyleState) -> str:
    """Format PlayStyleState into a concise prompt injection string.

    Returns something like:
        "Risk: high (78), Alliance: neutral (52), Curiosity: low (25),
         Moral: high (85), Combat: neutral (55)"
    """
    def label(val: int) -> str:
        if val >= 70:
            return "high"
        if val <= 30:
            return "low"
        return "neutral"

    return (
        f"Risk: {label(play_style.risk_appetite)} ({play_style.risk_appetite}), "
        f"Alliance: {label(play_style.alliance_tendency)} ({play_style.alliance_tendency}), "
        f"Curiosity: {label(play_style.curiosity_depth)} ({play_style.curiosity_depth}), "
        f"Moral: {label(play_style.moral_axis)} ({play_style.moral_axis}), "
        f"Combat: {label(play_style.combat_preference)} ({play_style.combat_preference})"
    )
