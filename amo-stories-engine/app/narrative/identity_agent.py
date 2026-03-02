"""Agent 7: Identity Update — deterministic identity calculations (no AI call).

This agent computes how the player's identity metrics change after each
chapter based on their choice, the simulator's assessment, and the
current player state.
"""

from __future__ import annotations

import logging

from app.models.identity import IdentityDelta
from app.models.pipeline import NarrativeState

logger = logging.getLogger(__name__)


async def run_identity_update(state: NarrativeState) -> dict:
    """Calculate identity deltas based on choice and simulation results.

    This is DETERMINISTIC — no AI call. Fast, reproducible, free.
    """
    _player = state.player_state
    # player_state may be a dict or Pydantic model
    if isinstance(_player, dict):
        player = type('P', (), {**_player, 'get': _player.get})()  # dict-as-obj
    else:
        player = _player
    choice = state.chosen_choice
    sim = state.simulator_output

    delta = IdentityDelta()

    if not player or not choice:
        return {"identity_delta": delta}

    risk = choice.risk_level if hasattr(choice, "risk_level") else 3

    # ── 1. Decision Quality Score (DQS) ──
    # Higher if choice aligns with identity, lower if contradicts
    if sim and isinstance(sim.identity_alignment, dict):
        aligns = sim.identity_alignment.get("aligns_with_seed", True)
        if aligns:
            delta.dqs_change = 1.0 + (risk * 0.5)  # +1.5 to +3.5
        else:
            delta.dqs_change = -(1.0 + risk * 0.3)  # -1.3 to -2.5
    else:
        delta.dqs_change = 0.5  # Neutral

    # ── 2. Coherence ──
    # Drops when behavior contradicts seed identity
    if sim and isinstance(sim.identity_alignment, dict):
        drift = sim.identity_alignment.get("drift_indicator", "none")
        if drift == "critical":
            delta.coherence_change = -8.0
            delta.drift_detected = "critical"
            delta.drift_description = sim.identity_alignment.get("note", "")
        elif drift == "significant":
            delta.coherence_change = -5.0
            delta.drift_detected = "major"
            delta.drift_description = sim.identity_alignment.get("note", "")
        elif drift == "minor":
            delta.coherence_change = -2.0
            delta.drift_detected = "minor"
        else:
            delta.coherence_change = 1.0  # Slight recovery when aligned

    # ── 3. Instability ──
    # Rises when coherence drops significantly
    if delta.coherence_change < -2:
        delta.instability_change = abs(delta.coherence_change) * 0.8
    elif delta.coherence_change > 0:
        delta.instability_change = -1.5  # Steady recovery when aligned

    # Bonus recovery from high coherence
    current_coherence = getattr(player, 'identity_coherence', 50) if player else 50
    if current_coherence >= 80 and delta.coherence_change >= 0:
        delta.instability_change -= 2.0  # Strong recovery when deeply aligned

    # ── 4. Breakthrough Meter ──
    if risk >= 4:
        delta.breakthrough_change = 5.0
    elif risk >= 3:
        delta.breakthrough_change = 2.0
    else:
        delta.breakthrough_change = 0.5

    # Check CRNG breakthrough trigger
    if state.crng_event and state.crng_event.get("event_type") == "breakthrough":
        delta.breakthrough_triggered = True

    # ── 5. Notoriety ──
    # Flashy or high-impact actions increase visibility
    if risk >= 4:
        delta.notoriety_change = 3.0
    elif risk >= 3:
        delta.notoriety_change = 1.0

    # World impact boosts notoriety
    if sim and sim.world_impact:
        delta.notoriety_change += 2.0

    # ── 6. Alignment ──
    # Positive = light/heroic, Negative = dark/ruthless
    # This is a rough heuristic; will be refined with more data
    if sim and isinstance(sim.identity_alignment, dict):
        aligns = sim.identity_alignment.get("aligns_with_seed", True)
        if aligns and risk <= 2:
            delta.alignment_change = 1.0  # Cautious + aligned = slightly heroic
        elif not aligns and risk >= 4:
            delta.alignment_change = -2.0  # Risky + contradicting = slightly dark

    # ── 7. Pity Counter ──
    # Reset if major event occurred
    if state.crng_event and state.crng_event.get("triggered"):
        delta.pity_reset = True

    # ── 8. Fate Buffer: Identity-Driven Accumulation + Decay ──
    # Player gains buffer by staying true to identity (coherence/DQS)
    # Buffer decays naturally after chapter 15
    # Net: aligned player ≈ +3~5/chapter; drifting ≈ -3~5/chapter
    total_chapters = getattr(player, 'total_chapters', 0) if player else 0

    fate_gain = 0.0
    fate_loss = 0.0

    # GAIN: Coherence alignment — staying true to identity
    if delta.coherence_change >= 0:
        fate_gain += 2.0  # Aligned with identity
        if current_coherence >= 80:
            fate_gain += 3.0  # Deep alignment bonus

    # GAIN: DQS alignment — smart decisions
    if delta.dqs_change > 0:
        fate_gain += 1.5

    # GAIN: Combat victory (if combat happened this chapter)
    combat_result = getattr(state, 'combat_result', None)
    if combat_result and isinstance(combat_result, dict):
        if combat_result.get('final_outcome') == 'player_wins':
            fate_gain += 2.0

    # LOSS: Drift penalties
    if delta.drift_detected == "minor":
        fate_loss += 1.0
    elif delta.drift_detected == "major":
        fate_loss += 3.0

    # LOSS: Natural decay after chapter 15
    if total_chapters >= 15:
        base_decay = 2.5
        risk_mult = 1.0 + (risk * 0.2)
        fate_loss += base_decay * risk_mult

    delta.fate_buffer_change = fate_gain - fate_loss

    # ── 9. Rogue Event ──
    if state.crng_event and state.crng_event.get("event_type") == "rogue_event":
        delta.rogue_event_triggered = True

    # ── 10. Confrontation Check ──
    current_instability = getattr(player, 'instability', 0) if player else 0
    new_instability = current_instability + delta.instability_change
    if new_instability >= 70 and current_instability < 70:
        delta.confrontation_triggered = True
        logger.info(f"Identity: CONFRONTATION triggered! "
                     f"Instability: {current_instability} → {new_instability}")

    # ── 11. New flags from consequences ──
    if sim and sim.consequences:
        for c in sim.consequences:
            if isinstance(c, dict) and c.get("severity") in ("major", "critical"):
                flag = c.get("description", "unknown_event")[:50].replace(" ", "_").lower()
                delta.new_flags.append(flag)

    logger.info(
        f"Identity delta: DQS={delta.dqs_change:+.1f} "
        f"Coh={delta.coherence_change:+.1f} "
        f"Inst={delta.instability_change:+.1f} "
        f"BT={delta.breakthrough_change:+.1f}"
    )

    return {"identity_delta": delta}
