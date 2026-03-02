"""Amoisekai — Archetype Evolution Engine.

Handles archetype transmutation check, form determination,
and state application.  Phase 1 covers Origin → Transmuted only.

Cross-reference:
  - ARCHETYPE_EVOLUTION_SPEC v1.0  §4 (Transmutation)
  - PHASE1_ADAPTIVE_ENGINE §Archetype Evolution Integration
"""

from __future__ import annotations

from app.models.adaptive import (
    ArchetypeEvolutionState,
    ArchetypeTier,
)
from app.models.adaptive_constants import (
    ARCHETYPE_TIER_TO_EMPIRE_THREAT,
    TRANSMUTATION_MAP,
    TRANSMUTED_DISPLAY_NAMES,
)


# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

# Transmutation eligibility thresholds (ARCHETYPE_EVOLUTION_SPEC §4.2)
TRANSMUTATION_MIN_RANK: int = 2          # ProgressionRank.RESONANT
TRANSMUTATION_MIN_DQS: float = 45.0
TRANSMUTATION_MIN_CHAPTERS: int = 12

# Identity crystallization thresholds
ALIGNMENT_COHERENCE_MIN: float = 65.0    # Path 1: high coherence
ALIGNMENT_ECHO_TRACE_MIN: float = 50.0
DIVERGENCE_COHERENCE_MAX: float = 35.0   # Path 2: dramatic drift
DIVERGENCE_DRIFT_MIN: float = 0.6


# ──────────────────────────────────────────────
# Transmutation Check
# ──────────────────────────────────────────────

def check_transmutation_ready(
    current_rank: int,
    total_chapters: int,
    dqs: float,
    identity_coherence: float,
    echo_trace: float,
    seed_identity_values: list[str],
    current_identity_values: list[str],
    already_transmuted: bool,
) -> dict | None:
    """Check if a player is eligible for archetype transmutation.

    Returns None if not ready, or a dict with path info if ready.
    No LLM needed — pure deterministic check.

    Args:
        current_rank: ProgressionRank int value (1-5).
        total_chapters: Total chapters played.
        dqs: Decision Quality Score (0-100).
        identity_coherence: Current identity coherence (0-100).
        echo_trace: Echo trace from seed identity (0-100).
        seed_identity_values: Core values from SeedIdentity.
        current_identity_values: Active values from CurrentIdentity.
        already_transmuted: Whether player already transmuted.

    Returns:
        None if not ready, or {"path": "alignment"|"divergence"}.
    """
    if already_transmuted:
        return None

    if current_rank < TRANSMUTATION_MIN_RANK:
        return None

    if total_chapters < TRANSMUTATION_MIN_CHAPTERS:
        return None

    if dqs < TRANSMUTATION_MIN_DQS:
        return None

    # Check identity crystallization — two valid paths
    path = _check_identity_crystallized(
        identity_coherence=identity_coherence,
        echo_trace=echo_trace,
        seed_values=seed_identity_values,
        current_values=current_identity_values,
    )

    if path is None:
        return None

    return {"path": path}


def _check_identity_crystallized(
    identity_coherence: float,
    echo_trace: float,
    seed_values: list[str],
    current_values: list[str],
) -> str | None:
    """Check if identity is crystallized enough for transmutation.

    Returns:
        "alignment" — if high coherence (stayed true to origin)
        "divergence" — if dramatic drift (became someone new)
        None — if neither path is met
    """
    # Path 1: Alignment — high coherence + echo trace
    if (identity_coherence >= ALIGNMENT_COHERENCE_MIN
            and echo_trace >= ALIGNMENT_ECHO_TRACE_MIN):
        return "alignment"

    # Path 2: Divergence — low coherence + significant drift
    if identity_coherence < DIVERGENCE_COHERENCE_MAX:
        drift = _calculate_drift_distance(seed_values, current_values)
        if drift >= DIVERGENCE_DRIFT_MIN:
            return "divergence"

    return None


def _calculate_drift_distance(
    seed_values: list[str],
    current_values: list[str],
) -> float:
    """Calculate identity drift distance between seed and current.

    Simple set-based measurement: what fraction of identity values
    have changed from the original seed.

    Returns:
        0.0 (identical) to 1.0 (completely different).
    """
    if not seed_values:
        return 0.0

    seed_set = set(v.lower().strip() for v in seed_values)
    current_set = set(v.lower().strip() for v in current_values)

    if not seed_set:
        return 0.0

    # Jaccard distance: 1 - (intersection / union)
    intersection = seed_set & current_set
    union = seed_set | current_set

    if not union:
        return 0.0

    return 1.0 - (len(intersection) / len(union))


# ──────────────────────────────────────────────
# Transmuted Form Determination
# ──────────────────────────────────────────────

# Identity axis keywords for matching against TRANSMUTATION_MAP branch keys
_BRANCH_KEYWORDS: dict[str, list[str]] = {
    # Vanguard branches
    "devotion_order": ["loyalty", "protection", "devotion", "duty", "order",
                       "shield", "defend", "sacrifice"],
    "freedom_entropy": ["freedom", "destruction", "chaos", "rage", "entropy",
                        "independence", "reckless", "power"],
    "control_strategic": ["control", "strategy", "discipline", "calm",
                          "tactical", "watchful", "vigilant", "precision"],
    # Catalyst branches
    "order_evolution": ["order", "structure", "evolution", "rebuild", "design",
                        "architect", "improve", "construct"],
    "freedom_chaos": ["freedom", "chaos", "liberation", "storm", "unleash",
                      "wild", "unpredictable", "explosive"],
    "devotion_evolution": ["devotion", "healing", "connection", "weave",
                           "empathy", "nurture", "mend", "bond"],
    # Sovereign branches
    "order_control": ["justice", "law", "fairness", "judge", "arbiter",
                      "balance", "order", "rule"],
    "control_extreme": ["domination", "control", "fear", "power", "ruthless",
                        "tyranny", "authority", "absolute"],
    "devotion_sacrifice": ["sacrifice", "service", "devotion", "shepherd",
                           "guide", "humble", "protect", "lead"],
    # Seeker branches
    "knowledge_perception": ["knowledge", "wisdom", "truth", "vision",
                             "insight", "foresight", "oracle", "prophecy"],
    "freedom_questioning": ["questioning", "heresy", "rebellion", "doubt",
                            "challenge", "freedom", "iconoclast", "break"],
    "order_systematic": ["archive", "record", "systematic", "preserve",
                         "order", "catalogue", "library", "knowledge"],
    # Tactician branches
    "order_planning": ["strategy", "planning", "command", "leadership",
                       "order", "organize", "marshal", "direct"],
    "control_manipulation": ["manipulation", "shadow", "secrecy", "control",
                             "intelligence", "hidden", "broker", "stealth"],
    "devotion_negotiation": ["diplomacy", "negotiation", "bridge", "peace",
                             "devotion", "mediate", "connect", "alliance"],
    # Wanderer branches
    "freedom_allies": ["freedom", "community", "caravan", "king", "allies",
                       "nomad", "family", "tribe"],
    "void_loner": ["void", "solitude", "phantom", "invisible", "ghost",
                   "disappear", "alone", "shadow"],
    "evolution_explorer": ["explorer", "discovery", "frontier", "path",
                           "evolution", "pioneer", "first", "uncharted"],
}


def determine_transmuted_form(
    origin_archetype: str,
    current_identity_values: list[str],
    current_identity_traits: list[str],
    reputation_tags: list[str],
) -> str:
    """Determine which transmuted form the player evolves into.

    Scores each branch key against the player's full identity
    (values + traits + reputation) and picks the highest match.

    Args:
        origin_archetype: Origin archetype value (e.g. "vanguard").
        current_identity_values: Player's current active values.
        current_identity_traits: Player's current active traits.
        reputation_tags: Player's current reputation tags.

    Returns:
        TransmutedArchetype value string (e.g. "bulwark").
    """
    branches = TRANSMUTATION_MAP.get(origin_archetype, {})
    if not branches:
        return ""

    # Build full identity word set
    identity_words = set()
    for item in current_identity_values + current_identity_traits + reputation_tags:
        for word in item.lower().strip().split():
            identity_words.add(word)

    # Score each branch
    best_branch_key = ""
    best_score = -1

    for branch_key in branches:
        keywords = _BRANCH_KEYWORDS.get(branch_key, [])
        score = sum(1 for kw in keywords if kw in identity_words)
        if score > best_score:
            best_score = score
            best_branch_key = branch_key

    if not best_branch_key:
        # Fallback: pick first branch
        best_branch_key = next(iter(branches))

    return branches[best_branch_key]


# ──────────────────────────────────────────────
# Apply Transmutation
# ──────────────────────────────────────────────

def apply_transmutation(
    evolution_state: ArchetypeEvolutionState,
    transmuted_form: str,
    transmutation_path: str,
    chapter: int,
) -> ArchetypeEvolutionState:
    """Apply transmutation to an ArchetypeEvolutionState.

    Returns a new state instance (does not mutate input).

    Args:
        evolution_state: Current ArchetypeEvolutionState.
        transmuted_form: TransmutedArchetype value.
        transmutation_path: "alignment" or "divergence".
        chapter: Chapter number when transmutation occurs.

    Returns:
        Updated ArchetypeEvolutionState.
    """
    display_name = TRANSMUTED_DISPLAY_NAMES.get(transmuted_form, transmuted_form)

    return ArchetypeEvolutionState(
        current_tier=ArchetypeTier.TRANSMUTED,
        transmuted_form=transmuted_form,
        transmutation_path=transmutation_path,
        archetype_title=display_name,
        transmutation_chapter=chapter,
        # Preserve Tier 3 stubs
        ascendant_form=evolution_state.ascendant_form,
        ascendant_title=evolution_state.ascendant_title,
        ascension_chapter=evolution_state.ascension_chapter,
    )


# ──────────────────────────────────────────────
# Empire Threat Escalation
# ──────────────────────────────────────────────

def get_empire_threat_tier(archetype_tier: int) -> str:
    """Map archetype tier to empire threat level.

    Args:
        archetype_tier: ArchetypeTier int value (1-4).

    Returns:
        EmpireThreatTier value string.
    """
    return ARCHETYPE_TIER_TO_EMPIRE_THREAT.get(archetype_tier, "watcher")
