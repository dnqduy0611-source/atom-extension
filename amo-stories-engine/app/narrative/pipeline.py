"""LangGraph pipeline — wires all agents into a directed graph.

Flow:
    ┌─────────────┐
    │ input_parser │ ← (only if free_input)
    └──────┬──────┘
           ▼
    ┌──────────┐    ┌───────────┐
    │ planner  │───→│ simulator │
    └──────────┘    └─────┬─────┘
                          ▼
                    ┌──────────┐
                    │ context  │
                    └─────┬────┘
                          ▼
                    ┌──────────┐
                    │  writer  │◄──┐
                    └─────┬────┘   │
                          ▼        │
                    ┌──────────┐   │
                    │  critic  │───┘ (rewrite loop, max 3)
                    └─────┬────┘
                          ▼
                    ┌───────────────┐
                    │identity_update│
                    └───────┬───────┘
                            ▼
                       ┌─────────┐
                       │  output │
                       └─────────┘
"""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, StateGraph

from app.config import settings
from app.models.pipeline import NarrativeState

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# TypedDict state for LangGraph (enables proper state accumulation)
# ──────────────────────────────────────────────

class PipelineState(TypedDict, total=False):
    """State schema for LangGraph.
    
    Using TypedDict instead of plain dict ensures LangGraph accumulates
    all node outputs across the pipeline, rather than only keeping the
    most recent node's output.
    """
    # Input fields
    story_id: str
    chapter_number: int
    preference_tags: list
    backstory: str
    protagonist_name: str
    chosen_choice: Any
    previous_summary: str
    previous_chapter_ending: str
    free_input: str
    player_state: Any
    crng_event: dict
    fate_instruction: str
    skill_reward_plan: dict

    # Pipeline outputs
    planner_output: Any
    simulator_output: Any
    consequence_output: Any  # ConsequenceRouterOutput (replaces simulator)
    context: str
    writer_output: Any

    # Critic loop
    critic_output: Any
    rewrite_count: int

    # Identity
    identity_delta: Any

    # Enhanced Intent Classifier outputs
    action_category: str
    skill_reference: str
    player_intent: str
    choice_confidence: float
    archetype_note: str

    # Final
    final_prose: str
    final_choices: list

    # Weapon orchestrator output
    weapon_update_output: Any

    # World State
    world_state: Any

    # Companion System (Phase 1)
    companion_context: str
    companion_affinity_deltas: dict

    # Villain System
    active_villain: str
    villain_context: str

    # Adaptive Engine
    adaptive_context: str
    writer_adaptive_context: str


# ──────────────────────────────────────────────
# LLM Factory
# ──────────────────────────────────────────────

def _make_llm(model: str, temperature: float = 0.8) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=model,
        temperature=temperature,
        google_api_key=settings.google_api_key,
    )


# ──────────────────────────────────────────────
# Safe state helper
# ──────────────────────────────────────────────

def _to_narrative_state(state: dict) -> NarrativeState:
    """Construct NarrativeState from state dict, tolerating Pydantic objects.
    
    Uses object.__setattr__ to bypass Pydantic field validation.
    """
    ns = NarrativeState()
    for key, value in state.items():
        if hasattr(ns, key) and value is not None:
            try:
                object.__setattr__(ns, key, value)
            except Exception:
                pass
    return ns


# ──────────────────────────────────────────────
# Node wrappers
# ──────────────────────────────────────────────

async def _node_input_parser(state: dict) -> dict:
    """Parse free text input → structured choice + intent metadata.

    Tries Enhanced Intent Classifier first (context-aware, typed categories).
    Falls back to basic input_parser.py if classifier fails or returns empty.
    Spec: Amoisekai/ENHANCED_INTENT_CLASSIFIER_SPEC.md
    """
    from app.narrative.enhanced_intent_classifier import run_enhanced_intent_classifier
    from app.narrative.input_parser import run_input_parser

    ns = _to_narrative_state(state)
    if not ns.free_input:
        return {}

    # Try Enhanced Intent Classifier (temperature 0.25 — classification task)
    llm_classify = _make_llm(settings.planner_model, 0.25)
    result = await run_enhanced_intent_classifier(ns, llm_classify)

    if result:
        logger.info(
            f"Enhanced classifier succeeded: category={result.get('action_category')}, "
            f"skill_ref={result.get('skill_reference')!r}"
        )
        return result

    # Fallback: basic input_parser
    logger.info("Enhanced classifier returned empty — falling back to input_parser")
    llm_basic = _make_llm(settings.planner_model, 0.3)
    basic_result = await run_input_parser(ns, llm_basic)
    # Ensure intent fields are present (with defaults) when using fallback
    basic_result.setdefault("action_category", "other")
    basic_result.setdefault("skill_reference", "")
    basic_result.setdefault("player_intent", "")
    basic_result.setdefault("choice_confidence", 0.5)
    return basic_result


async def _node_planner(state: dict) -> dict:
    """Generate chapter outline."""
    from app.narrative.planner import run_planner
    ns = _to_narrative_state(state)
    llm = _make_llm(settings.planner_model, 0.7)
    return await run_planner(ns, llm)


async def _node_simulator(state: dict) -> dict:
    """Predict consequences with causal chain reasoning.

    Uses Consequence Router (replaces flat simulator).
    Falls back to original simulator if consequence routing fails.
    """
    from app.narrative.consequence_router import run_consequence_router
    ns = _to_narrative_state(state)
    llm = _make_llm(settings.simulator_model, 0.5)  # Lower temp for logic-consistent chains
    return await run_consequence_router(ns, llm)


async def _node_context(state: dict) -> dict:
    """Build NeuralMemory context."""
    from app.narrative.context import run_context
    ns = _to_narrative_state(state)
    return await run_context(ns)


async def _node_writer(state: dict) -> dict:
    """Generate prose and choices."""
    from app.narrative.writer import run_writer
    ns = _to_narrative_state(state)
    llm = _make_llm(
        settings.writer_model,
        settings.writer_temperature,
    )
    result = await run_writer(ns, llm)
    wo = result.get("writer_output")
    if wo:
        prose_len = len(getattr(wo, "prose", "")) if not isinstance(wo, dict) else len(wo.get("prose", ""))
        logger.info(f"Writer node: prose length = {prose_len}")
    return result


async def _node_critic(state: dict) -> dict:
    """Score and approve/reject."""
    from app.narrative.critic import run_critic
    ns = _to_narrative_state(state)
    llm = _make_llm(settings.critic_model, 0.3)
    return await run_critic(ns, llm)


async def _node_identity(state: dict) -> dict:
    """Calculate identity deltas with AI context-awareness."""
    from app.narrative.context_weight_agent import run_context_weight_agent
    ns = _to_narrative_state(state)
    llm = _make_llm(settings.identity_model, 0.3)
    return await run_context_weight_agent(ns, llm)


async def _node_weapon_update(state: dict) -> dict:
    """Update weapon state after chapter — pure Python, no LLM.

    Runs: bond update, threshold detection, archon affinity,
    evolution check, combat bonus pre-computation.
    """
    from app.engine.weapon_orchestrator import post_chapter_weapon_update

    ns = _to_narrative_state(state)
    player = ns.player_state
    identity_delta = state.get("identity_delta")
    action_category = state.get("action_category", "")
    planner_output = state.get("planner_output")

    # Detect combat from planner beats
    has_combat = False
    if planner_output:
        beats = getattr(planner_output, "beats", [])
        for beat in beats:
            desc = getattr(beat, "description", "")
            if any(kw in desc.lower() for kw in ("combat", "chiến đấu", "đánh", "fight")):
                has_combat = True
                break

    result = post_chapter_weapon_update(
        player_state=player,
        identity_delta=identity_delta,
        action_category=action_category,
        planner_output=planner_output,
        has_combat=has_combat,
    )

    logger.info(f"Weapon update: {len(result)} state updates applied")
    return {"weapon_update_output": result}


async def _node_ledger(state: dict) -> dict:
    """Post-generation: persist chapter across all three memory layers.

    1. NeuralMemory store — semantic recall for future chapters (blocking, ~50ms)
    2. Story Ledger extraction — LLM entity/fact extraction (fire-and-forget)
    3. World State update — absorb simulator updates + Tower detection (blocking, fast)

    All operations are best-effort: failures are logged and never raise.
    """
    import asyncio

    story_id = state.get("story_id")
    if not story_id:
        return {}

    prose = state.get("final_prose", "")
    chapter = state.get("chapter_number", 0)
    if not prose:
        return {}

    # ── 1. NeuralMemory store (blocking, fast ~50ms) ──
    try:
        from app.memory.story_brain import get_or_create_brain
        brain = await get_or_create_brain(story_id)
        if brain.available:
            chosen_choice = state.get("chosen_choice")
            choice_text = ""
            if isinstance(chosen_choice, dict):
                choice_text = chosen_choice.get("text", "")
            elif chosen_choice is not None:
                choice_text = getattr(chosen_choice, "text", "")

            planner_output = state.get("planner_output")
            npcs: list[str] = []
            if planner_output:
                new_chars = getattr(planner_output, "new_characters", [])
                npcs = [c for c in new_chars if isinstance(c, str)][:5]

            await brain.store_scene(
                scene_number=1,
                chapter_number=chapter,
                prose=prose,
                choice_text=choice_text,
                npcs=npcs or None,
            )
            logger.info(f"Ledger: NeuralMemory stored ch.{chapter} ({len(prose)} chars)")
    except Exception as e:
        logger.warning(f"Ledger: NeuralMemory store failed ({e}) — continuing")

    # ── 2. Story Ledger extraction (fire-and-forget, non-blocking) ──
    try:
        asyncio.create_task(
            _run_ledger_extraction(story_id=story_id, prose=prose, chapter=chapter),
            name=f"ledger_extract_ch{chapter}",
        )
    except Exception as e:
        logger.warning(f"Ledger: could not schedule extraction task ({e})")

    # ── 3. World State update (blocking, fast — pure Python) ──
    try:
        from app.memory.world_state_store import load_world_state, save_world_state

        world_state = load_world_state(story_id)

        # Absorb simulator world_state_updates
        simulator_output = state.get("simulator_output")
        if simulator_output:
            updates = (
                simulator_output.get("world_state_updates", [])
                if isinstance(simulator_output, dict)
                else getattr(simulator_output, "world_state_updates", [])
            )
            if updates:
                world_state.absorb_simulator_updates(updates)

        # Update Tower floor if planner beats mention Tower entry
        planner_output = state.get("planner_output")
        if planner_output:
            beats = getattr(planner_output, "beats", [])
            for beat in beats:
                desc = (
                    beat.get("description", "") if isinstance(beat, dict)
                    else getattr(beat, "description", "")
                )
                desc_lower = desc.lower()
                for floor in (1, 2, 3):
                    if f"floor {floor}" in desc_lower or f"tầng {floor}" in desc_lower:
                        world_state.update_tower(floor)

        # ── Force Taxonomy: auto-trigger + decay ──
        # Extract player metrics for trigger evaluation
        player_state = state.get("player_state")
        notoriety = 0.0
        identity_coherence = 100.0
        if player_state:
            if isinstance(player_state, dict):
                notoriety = float(player_state.get("notoriety", 0.0))
                identity_coherence = float(player_state.get("identity_coherence", 100.0))
            else:
                notoriety = float(getattr(player_state, "notoriety", 0.0))
                identity_coherence = float(getattr(player_state, "identity_coherence", 100.0))

        # Derive act from chapter (rough mapping: 1-8=Act1, 9-16=Act2, 17-24=Act3, 25+=Act4)
        act = min(4, max(1, (chapter - 1) // 8 + 1))

        world_state.update_threat_triggers(
            notoriety=notoriety,
            identity_coherence=identity_coherence,
            act=act,
        )
        world_state.apply_chapter_decay()

        # ── Villain Tracker: heuristic prose detection ──
        try:
            from app.narrative.villain_tracker import update_villain_from_prose
            update_villain_from_prose(world_state, prose)
        except Exception as vte:
            logger.warning(f"Ledger: villain prose scan failed ({vte}) — continuing")

        # ── Emissary: heuristic prose detection ──
        try:
            from app.narrative.emissary import detect_emissary_in_prose
            detect_emissary_in_prose(world_state, prose, chapter=chapter)
        except Exception as ete:
            logger.warning(f"Ledger: emissary prose scan failed ({ete}) — continuing")

        # ── General Encounter: heuristic prose detection ──
        try:
            from app.narrative.villain_encounter import detect_general_in_prose
            detect_general_in_prose(world_state, prose, chapter=chapter)
        except Exception as gte:
            logger.warning(f"Ledger: general prose scan failed ({gte}) — continuing")

        # ── Veiled Will: phase advance check ──
        try:
            from app.narrative.veiled_will import check_phase_advance
            check_phase_advance(world_state, chapter=chapter)
        except Exception as vwe:
            logger.warning(f"Ledger: veiled will phase check failed ({vwe}) — continuing")

        # ── Consequence Router: faction implications → villain tracker ──
        try:
            consequence_output = state.get("consequence_output")
            if consequence_output:
                from app.narrative.villain_tracker import track_empire_resonance, track_identity_anchor

                # Process faction implications
                factions = (
                    consequence_output.get("faction_implications", [])
                    if isinstance(consequence_output, dict)
                    else getattr(consequence_output, "faction_implications", [])
                )
                for fi in factions:
                    fi_dict = fi if isinstance(fi, dict) else fi.__dict__ if hasattr(fi, "__dict__") else {}
                    res_delta = fi_dict.get("empire_resonance_delta", 0) if isinstance(fi_dict, dict) else getattr(fi, "empire_resonance_delta", 0)
                    anc_delta = fi_dict.get("identity_anchor_delta", 0) if isinstance(fi_dict, dict) else getattr(fi, "identity_anchor_delta", 0)
                    faction_name = fi_dict.get("faction", "?") if isinstance(fi_dict, dict) else getattr(fi, "faction", "?")
                    if res_delta:
                        track_empire_resonance(world_state, res_delta, reason=f"consequence_{faction_name}")
                    if anc_delta:
                        track_identity_anchor(world_state, anc_delta, reason=f"consequence_{faction_name}")

                # Process identity_alignment.drift_indicator → identity_anchor
                identity_alignment = (
                    consequence_output.get("identity_alignment", {})
                    if isinstance(consequence_output, dict)
                    else getattr(consequence_output, "identity_alignment", {})
                )
                drift = identity_alignment.get("drift_indicator", "none") if isinstance(identity_alignment, dict) else "none"
                drift_deltas = {"none": 0, "minor": -3, "significant": -8, "critical": -15}
                drift_delta = drift_deltas.get(drift, 0)
                if drift_delta:
                    track_identity_anchor(world_state, drift_delta, reason=f"identity_drift_{drift}")
                    logger.info(f"Ledger: identity drift '{drift}' → anchor delta {drift_delta}")

        except Exception as fie:
            logger.warning(f"Ledger: faction implications processing failed ({fie}) — continuing")

        save_world_state(story_id, world_state, chapter)
        logger.info(
            f"Ledger: WorldState updated ch.{chapter} "
            f"(pressure={world_state.get_threat_pressure()}, "
            f"events={len(world_state.narrative_events)})"
        )
    except Exception as e:
        logger.warning(f"Ledger: WorldState update failed ({e}) — continuing")

    return {}


async def _run_ledger_extraction(story_id: str, prose: str, chapter: int) -> None:
    """Background task: extract named entities/facts from prose → Story Ledger.

    Uses planner_model at temperature 0.1 for structured extraction.
    Loads current ledger, merges new data, saves back.
    """
    try:
        from app.memory.ledger_store import load_ledger, save_ledger
        from app.world.ledger_extractor import extract_from_chapter

        ledger = load_ledger(story_id)
        llm = _make_llm(settings.planner_model, 0.1)
        new_entities, new_facts = await extract_from_chapter(prose, chapter, ledger, llm)

        added = sum(1 for e in new_entities if ledger.add_entity(e))
        for fact in new_facts:
            ledger.add_fact(fact)

        ledger.last_updated_chapter = chapter
        save_ledger(ledger)

        logger.info(
            f"Ledger extraction done: ch.{chapter} story={story_id} "
            f"+{added} entities, +{len(new_facts)} facts"
        )
    except Exception as e:
        logger.warning(f"Ledger background extraction failed (ch.{chapter}): {e}")


async def _node_output(state: dict) -> dict:
    """Finalize output — extract prose and choices from writer output."""
    writer_output = state.get("writer_output")
    logger.info(f"Output node: writer_output type={type(writer_output).__name__}")

    if writer_output:
        if isinstance(writer_output, dict):
            prose = writer_output.get("prose", "")
            choices = writer_output.get("choices", [])
        else:
            prose = getattr(writer_output, "prose", "")
            choices = getattr(writer_output, "choices", [])
        logger.info(f"Output node: prose={len(prose)} chars, choices={len(choices)}")
        return {
            "final_prose": prose,
            "final_choices": choices,
        }

    logger.warning("Output node: no writer_output found!")
    return {}


# ──────────────────────────────────────────────
# Conditional edge
# ──────────────────────────────────────────────

def _should_rewrite(state: dict) -> str:
    """Critic routing: rewrite or proceed to identity."""
    critic_output = state.get("critic_output")
    rewrite_count = state.get("rewrite_count", 0)

    if critic_output:
        if isinstance(critic_output, dict):
            approved = critic_output.get("approved", False)
            score = critic_output.get("score", 0)
        else:
            approved = getattr(critic_output, "approved", False)
            score = getattr(critic_output, "score", 0)

        if approved:
            logger.info(f"Critic APPROVED (score: {score})")
            return "approved"

    if rewrite_count >= settings.max_rewrite_attempts:
        logger.warning(f"Max rewrites ({settings.max_rewrite_attempts}) reached — forcing approval")
        return "approved"

    logger.info(f"Critic REJECTED — rewrite #{rewrite_count + 1}")
    return "rewrite"


# ──────────────────────────────────────────────
# Build Graph
# ──────────────────────────────────────────────

def build_pipeline() -> StateGraph:
    """Build and compile the narrative pipeline graph."""

    graph = StateGraph(PipelineState)  # TypedDict for proper state accumulation

    # Add nodes
    graph.add_node("input_parser", _node_input_parser)
    graph.add_node("planner", _node_planner)
    graph.add_node("simulator", _node_simulator)
    graph.add_node("context", _node_context)
    graph.add_node("writer", _node_writer)
    graph.add_node("critic", _node_critic)
    graph.add_node("identity", _node_identity)
    graph.add_node("weapon_update", _node_weapon_update)
    graph.add_node("output", _node_output)
    graph.add_node("ledger", _node_ledger)

    # Linear flow
    graph.set_entry_point("input_parser")
    graph.add_edge("input_parser", "planner")
    graph.add_edge("planner", "simulator")
    graph.add_edge("simulator", "context")
    graph.add_edge("context", "writer")
    graph.add_edge("writer", "critic")

    # Critic → conditional
    graph.add_conditional_edges(
        "critic",
        _should_rewrite,
        {
            "rewrite": "writer",
            "approved": "identity",
        },
    )

    graph.add_edge("identity", "weapon_update")
    graph.add_edge("weapon_update", "output")
    graph.add_edge("output", "ledger")
    graph.add_edge("ledger", END)

    return graph


# ──────────────────────────────────────────────
# Run Pipeline
# ──────────────────────────────────────────────

_compiled: Any = None


def get_compiled_pipeline():
    """Get or build the compiled pipeline (singleton)."""
    global _compiled
    if _compiled is None:
        graph = build_pipeline()
        _compiled = graph.compile()
        logger.info("Narrative pipeline compiled ✓")
    return _compiled


async def run_pipeline(initial_state: dict) -> NarrativeState:
    """Run the full narrative pipeline.

    Args:
        initial_state: Dict with story_id, chapter_number, preference_tags, etc.
                       Should also include player_state, crng_event, fate_instruction.

    Returns:
        NarrativeState with final_prose + final_choices + identity_delta populated.
    """
    pipeline = get_compiled_pipeline()

    logger.info(f"Pipeline: starting chapter {initial_state.get('chapter_number', '?')}")

    # Run the graph
    result = await pipeline.ainvoke(initial_state)

    # Parse back to NarrativeState
    final = _to_narrative_state(result)

    logger.info(
        f"Pipeline: completed — prose length: {len(final.final_prose)}, "
        f"choices: {len(final.final_choices)}"
    )

    return final
