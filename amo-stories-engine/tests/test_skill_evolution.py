"""Tests for Skill Evolution data models and engine.

Covers: SkillEvolutionState, calc_skill_identity_alignment, check_refinement,
check_skill_evolution, track_skill_usage, apply_refinement, sync helper.

Ref: SKILL_EVOLUTION_SPEC v1.1
"""

import pytest

from app.models.skill_evolution import (
    EvolutionType,
    MutationType,
    MutationChoice,
    SkillEvolutionState,
    ResonanceMasteryState,
    SkillEvolutionEvent,
)
from app.engine.skill_evolution import (
    calc_skill_identity_alignment,
    check_refinement,
    check_skill_mutation,
    track_skill_usage,
    check_skill_evolution,
    apply_refinement,
    sync_evolution_to_progression,
)


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture
def evolution():
    """Fresh SkillEvolutionState for testing."""
    return SkillEvolutionState(player_id="test_player")


@pytest.fixture
def resonance():
    """Standard player resonance dict with decent energy alignment."""
    return {
        "energy": 0.7,
        "order": 0.3,
        "entropy": 0.1,
        "matter": 0.2,
        "flux": 0.1,
        "void": 0.1,
    }


@pytest.fixture
def energy_skill():
    """A simple energy skill dict."""
    return {
        "id": "energy_off_01",
        "primary_principle": "energy",
        "name": "Energy Burst",
        "tier": 1,
    }


@pytest.fixture
def order_skill():
    """A simple order skill dict."""
    return {
        "id": "order_def_01",
        "primary_principle": "order",
        "name": "Structure Shield",
        "tier": 1,
    }


# ──────────────────────────────────────────────
# Model Tests
# ──────────────────────────────────────────────

class TestSkillEvolutionModels:
    """Test data model instantiation and defaults."""

    def test_evolution_state_defaults(self):
        state = SkillEvolutionState()
        assert state.refinement_trackers == {}
        assert state.refinements_done == []
        assert state.mutations_done == 0
        assert state.mutation_in_progress is None
        assert state.mutation_arc_scene == 0
        assert state.integrations_done == 0
        assert state.awakened_skills == []

    def test_resonance_mastery_defaults(self):
        state = ResonanceMasteryState()
        assert state.personal_cap_bonus == 0.0
        assert state.stability_trials_passed == 0
        assert state.overdrive_successes == 0
        assert state.floor_attunements == []
        assert state.dual_masteries == []

    def test_evolution_event_creation(self):
        event = SkillEvolutionEvent(
            event_type=EvolutionType.REFINEMENT,
            skill_id="energy_off_01",
            chapter=8,
            scene=3,
            constraint_changed="cooldown",
        )
        assert event.event_type == EvolutionType.REFINEMENT
        assert event.skill_id == "energy_off_01"
        assert event.chapter == 8
        assert event.constraint_changed == "cooldown"

    def test_evolution_enums(self):
        assert EvolutionType.REFINEMENT.value == "refinement"
        assert MutationType.INVERSION.value == "inversion"
        assert MutationChoice.HYBRID.value == "hybrid"


# ──────────────────────────────────────────────
# Alignment Tests
# ──────────────────────────────────────────────

class TestCalcSkillIdentityAlignment:
    """Test _calc_skill_identity_alignment (spec §3.2)."""

    def test_high_alignment(self, resonance):
        assert calc_skill_identity_alignment("energy", resonance) == 0.7

    def test_low_alignment(self, resonance):
        assert calc_skill_identity_alignment("entropy", resonance) == 0.1

    def test_missing_principle(self):
        assert calc_skill_identity_alignment("void", {}) == 0.0

    def test_exact_threshold(self, resonance):
        # order = 0.3, below 0.6 threshold
        assert calc_skill_identity_alignment("order", resonance) == 0.3


# ──────────────────────────────────────────────
# Refinement Check Tests
# ──────────────────────────────────────────────

class TestCheckRefinement:
    """Test check_refinement guard conditions (spec §3.2)."""

    def test_basic_pass(self, evolution, resonance):
        """8 uses + 0.7 alignment → eligible."""
        assert check_refinement(
            evolution=evolution,
            skill_id="energy_off_01",
            skill_primary_principle="energy",
            successful_uses=8,
            identity_resonance=resonance,
        ) is True

    def test_low_uses(self, evolution, resonance):
        """7 uses → NOT eligible."""
        assert check_refinement(
            evolution=evolution,
            skill_id="energy_off_01",
            skill_primary_principle="energy",
            successful_uses=7,
            identity_resonance=resonance,
        ) is False

    def test_low_alignment(self, evolution, resonance):
        """Order has 0.3 alignment, below 0.6 → NOT eligible."""
        assert check_refinement(
            evolution=evolution,
            skill_id="order_def_01",
            skill_primary_principle="order",
            successful_uses=10,
            identity_resonance=resonance,
        ) is False

    def test_already_refined(self, evolution, resonance):
        """Skill already refined → blocked."""
        evolution.refinements_done = ["energy_off_01"]
        assert check_refinement(
            evolution=evolution,
            skill_id="energy_off_01",
            skill_primary_principle="energy",
            successful_uses=10,
            identity_resonance=resonance,
        ) is False

    def test_max_refinements_reached(self, evolution, resonance):
        """2 refinements done → blocked (even for different skill)."""
        evolution.refinements_done = ["other_skill_1", "other_skill_2"]
        assert check_refinement(
            evolution=evolution,
            skill_id="energy_off_01",
            skill_primary_principle="energy",
            successful_uses=10,
            identity_resonance=resonance,
        ) is False

    def test_one_refinement_done_different_skill(self, evolution, resonance):
        """1 refinement done on different skill → eligible."""
        evolution.refinements_done = ["other_skill_1"]
        assert check_refinement(
            evolution=evolution,
            skill_id="energy_off_01",
            skill_primary_principle="energy",
            successful_uses=8,
            identity_resonance=resonance,
        ) is True

    def test_exactly_threshold_alignment(self, evolution):
        """Exactly 0.6 alignment → eligible."""
        resonance = {"energy": 0.6}
        assert check_refinement(
            evolution=evolution,
            skill_id="energy_off_01",
            skill_primary_principle="energy",
            successful_uses=8,
            identity_resonance=resonance,
        ) is True

    def test_just_below_threshold_alignment(self, evolution):
        """0.59 alignment → NOT eligible."""
        resonance = {"energy": 0.59}
        assert check_refinement(
            evolution=evolution,
            skill_id="energy_off_01",
            skill_primary_principle="energy",
            successful_uses=8,
            identity_resonance=resonance,
        ) is False


# ──────────────────────────────────────────────
# Mutation Check Tests
# ──────────────────────────────────────────────

class TestCheckSkillMutation:
    """Test check_skill_mutation (spec §4.2)."""

    def test_mutation_triggers(self, resonance):
        """Low coherence + high instability + misaligned skill → triggers."""
        skills = [
            {"id": "order_def_01", "primary_principle": "order"},  # 0.3 alignment → 0.7 misalignment
        ]
        result = check_skill_mutation(
            coherence=20, instability=80,
            mutations_done=0, equipped_skills=skills,
            identity_resonance=resonance,
        )
        assert result == "order_def_01"

    def test_mutation_blocked_by_coherence(self, resonance):
        """Coherence ≥ 30 → no mutation."""
        skills = [
            {"id": "order_def_01", "primary_principle": "order"},
        ]
        result = check_skill_mutation(
            coherence=30, instability=80,
            mutations_done=0, equipped_skills=skills,
            identity_resonance=resonance,
        )
        assert result is None

    def test_mutation_blocked_by_instability(self, resonance):
        """Instability ≤ 70 → no mutation."""
        skills = [
            {"id": "order_def_01", "primary_principle": "order"},
        ]
        result = check_skill_mutation(
            coherence=20, instability=70,
            mutations_done=0, equipped_skills=skills,
            identity_resonance=resonance,
        )
        assert result is None

    def test_mutation_max_reached(self, resonance):
        """3 mutations done → blocked."""
        skills = [
            {"id": "order_def_01", "primary_principle": "order"},
        ]
        result = check_skill_mutation(
            coherence=20, instability=80,
            mutations_done=3, equipped_skills=skills,
            identity_resonance=resonance,
        )
        assert result is None

    def test_mutation_skips_unique_skills(self, resonance):
        """Unique skills are excluded from mutation candidate selection."""
        skills = [
            {"id": "unique_01", "primary_principle": "order", "is_unique": True},
        ]
        result = check_skill_mutation(
            coherence=20, instability=80,
            mutations_done=0, equipped_skills=skills,
            identity_resonance=resonance,
        )
        assert result is None


# ──────────────────────────────────────────────
# Usage Tracking Tests
# ──────────────────────────────────────────────

class TestTrackSkillUsage:
    """Test per-phase and per-scene usage tracking (spec §10.1)."""

    def test_single_scene_tracking(self, evolution):
        """Single skill used in a scene → count +1."""
        scene_result = {"skill_used": "energy_off_01", "outcome": "favorable"}
        track_skill_usage(evolution, scene_result)
        assert evolution.refinement_trackers["energy_off_01"] == 1

    def test_phase_tracking(self, evolution):
        """Multiple phases in combat → count each phase."""
        scene_result = {
            "combat_phases": [
                {"skill_used": "energy_off_01", "outcome": "favorable"},
                {"skill_used": "energy_off_01", "outcome": "mixed"},
                {"skill_used": "order_def_01", "outcome": "favorable"},
            ]
        }
        track_skill_usage(evolution, scene_result)
        assert evolution.refinement_trackers["energy_off_01"] == 2
        assert evolution.refinement_trackers["order_def_01"] == 1

    def test_unfavorable_not_counted(self, evolution):
        """Unfavorable outcomes are NOT counted."""
        scene_result = {"skill_used": "energy_off_01", "outcome": "unfavorable"}
        track_skill_usage(evolution, scene_result)
        assert evolution.refinement_trackers.get("energy_off_01", 0) == 0

    def test_phase_unfavorable_not_counted(self, evolution):
        """Unfavorable phase outcomes are NOT counted."""
        scene_result = {
            "combat_phases": [
                {"skill_used": "energy_off_01", "outcome": "favorable"},
                {"skill_used": "energy_off_01", "outcome": "unfavorable"},
            ]
        }
        track_skill_usage(evolution, scene_result)
        assert evolution.refinement_trackers["energy_off_01"] == 1

    def test_cumulative_tracking(self, evolution):
        """Multiple scenes accumulate counts."""
        for _ in range(3):
            track_skill_usage(
                evolution,
                {"skill_used": "energy_off_01", "outcome": "favorable"},
            )
        assert evolution.refinement_trackers["energy_off_01"] == 3

    def test_no_skill_used(self, evolution):
        """Scene with no skill used → no tracking."""
        scene_result = {"outcome": "favorable"}
        track_skill_usage(evolution, scene_result)
        assert evolution.refinement_trackers == {}


# ──────────────────────────────────────────────
# Full Evolution Check Tests
# ──────────────────────────────────────────────

class TestCheckSkillEvolution:
    """Test check_skill_evolution per-scene flow (spec §10.1)."""

    def test_mutation_arc_blocks_all(self, evolution, resonance, energy_skill):
        """Mutation in progress → blocks refinement."""
        evolution.mutation_in_progress = "some_skill"
        evolution.refinement_trackers["energy_off_01"] = 10

        result = check_skill_evolution(
            evolution=evolution,
            equipped_skills=[energy_skill],
            identity_resonance=resonance,
            coherence=80, instability=10,
            chapter=8, scene=3,
            scene_result={},
        )
        assert result is None

    def test_refinement_triggers(self, evolution, resonance, energy_skill):
        """8 uses + high alignment → refinement event."""
        evolution.refinement_trackers["energy_off_01"] = 8

        result = check_skill_evolution(
            evolution=evolution,
            equipped_skills=[energy_skill],
            identity_resonance=resonance,
            coherence=80, instability=10,
            chapter=8, scene=3,
            scene_result={},
        )
        assert result is not None
        assert result.event_type == EvolutionType.REFINEMENT
        assert result.skill_id == "energy_off_01"
        assert result.chapter == 8
        assert result.scene == 3

    def test_mutation_priority_over_refinement(self, evolution, resonance, order_skill):
        """Mutation triggers before refinement check."""
        evolution.refinement_trackers["order_def_01"] = 10

        result = check_skill_evolution(
            evolution=evolution,
            equipped_skills=[order_skill],
            identity_resonance=resonance,
            coherence=20, instability=80,
            chapter=20, scene=1,
            scene_result={},
        )
        assert result is not None
        assert result.event_type == EvolutionType.MUTATION
        assert result.skill_id == "order_def_01"
        assert evolution.mutation_in_progress == "order_def_01"
        assert evolution.mutation_arc_scene == 1

    def test_no_evolution(self, evolution, resonance, energy_skill):
        """No conditions met → None."""
        evolution.refinement_trackers["energy_off_01"] = 3

        result = check_skill_evolution(
            evolution=evolution,
            equipped_skills=[energy_skill],
            identity_resonance=resonance,
            coherence=80, instability=10,
            chapter=3, scene=1,
            scene_result={},
        )
        assert result is None

    def test_usage_tracked_before_check(self, evolution, resonance, energy_skill):
        """Usage tracking happens before evolution check."""
        # Start at 7 uses, scene adds 1 → should trigger at 8
        evolution.refinement_trackers["energy_off_01"] = 7

        result = check_skill_evolution(
            evolution=evolution,
            equipped_skills=[energy_skill],
            identity_resonance=resonance,
            coherence=80, instability=10,
            chapter=10, scene=2,
            scene_result={"skill_used": "energy_off_01", "outcome": "favorable"},
        )
        assert evolution.refinement_trackers["energy_off_01"] == 8
        assert result is not None
        assert result.event_type == EvolutionType.REFINEMENT

    def test_per_chapter_limit_blocks(self, evolution, resonance, energy_skill):
        """Second evolution in same chapter is blocked."""
        evolution.refinement_trackers["energy_off_01"] = 10
        evolution.last_evolution_chapter = 8  # Already evolved this chapter

        result = check_skill_evolution(
            evolution=evolution,
            equipped_skills=[energy_skill],
            identity_resonance=resonance,
            coherence=80, instability=10,
            chapter=8, scene=5,
            scene_result={},
        )
        assert result is None

    def test_different_chapter_allows_evolution(self, evolution, resonance, energy_skill):
        """Next chapter allows evolution again."""
        evolution.refinement_trackers["energy_off_01"] = 10
        evolution.last_evolution_chapter = 7  # Evolved last chapter

        result = check_skill_evolution(
            evolution=evolution,
            equipped_skills=[energy_skill],
            identity_resonance=resonance,
            coherence=80, instability=10,
            chapter=8, scene=1,
            scene_result={},
        )
        assert result is not None
        assert result.event_type == EvolutionType.REFINEMENT
        assert evolution.last_evolution_chapter == 8

    def test_evolution_updates_last_chapter(self, evolution, resonance, energy_skill):
        """Evolution sets last_evolution_chapter."""
        evolution.refinement_trackers["energy_off_01"] = 10

        result = check_skill_evolution(
            evolution=evolution,
            equipped_skills=[energy_skill],
            identity_resonance=resonance,
            coherence=80, instability=10,
            chapter=15, scene=2,
            scene_result={},
        )
        assert result is not None
        assert evolution.last_evolution_chapter == 15


# ──────────────────────────────────────────────
# Apply Refinement Tests
# ──────────────────────────────────────────────

class TestApplyRefinement:
    """Test apply_refinement state updates."""

    def test_marks_skill_refined(self, evolution):
        apply_refinement(evolution, "energy_off_01")
        assert "energy_off_01" in evolution.refinements_done

    def test_idempotent(self, evolution):
        """Calling twice doesn't duplicate."""
        apply_refinement(evolution, "energy_off_01")
        apply_refinement(evolution, "energy_off_01")
        assert evolution.refinements_done.count("energy_off_01") == 1


# ──────────────────────────────────────────────
# Sync Helper Tests
# ──────────────────────────────────────────────

class TestSyncEvolutionToProgression:
    """Test backward compatibility sync."""

    def test_syncs_all_fields(self, evolution):
        evolution.refinements_done = ["skill_a"]
        evolution.mutations_done = 2
        evolution.integrations_done = 1

        class FakeProgression:
            refinements_done = []
            mutations_done = 0
            integrations_done = 0

        prog = FakeProgression()
        sync_evolution_to_progression(evolution, prog)

        assert prog.refinements_done == ["skill_a"]
        assert prog.mutations_done == 2
        assert prog.integrations_done == 1


# ══════════════════════════════════════════════
# PHASE 2 TESTS
# ══════════════════════════════════════════════

from app.engine.skill_evolution import (
    determine_mutation_type,
    advance_mutation_arc,
    resolve_mutation_choice,
    check_integration_eligible,
    calculate_integration_tier,
    perform_integration,
    get_awakening_candidates,
    apply_awakening,
)


# ──────────────────────────────────────────────
# Mutation Type Determination Tests
# ──────────────────────────────────────────────

class TestDetermineMutationType:
    """Test mutation type selection from identity patterns (§4.3)."""

    def test_corruption_high_instability(self):
        """Instability > 85 → Corruption."""
        result = determine_mutation_type(
            coherence=20, instability=90,
            echo_trace=30, latent_drift_direction="",
        )
        assert result == MutationType.CORRUPTION

    def test_purification_echo_trace_high(self):
        """Echo trace > 60 + coherence < 30 → Purification."""
        result = determine_mutation_type(
            coherence=25, instability=75,
            echo_trace=65, latent_drift_direction="",
        )
        assert result == MutationType.PURIFICATION

    def test_hybridization_latent_drift(self):
        """Latent drift direction present → Hybridization."""
        result = determine_mutation_type(
            coherence=25, instability=75,
            echo_trace=40, latent_drift_direction="entropy",
        )
        assert result == MutationType.HYBRIDIZATION

    def test_inversion_default(self):
        """No special conditions → Inversion (default)."""
        result = determine_mutation_type(
            coherence=25, instability=75,
            echo_trace=40, latent_drift_direction="",
        )
        assert result == MutationType.INVERSION

    def test_corruption_takes_priority(self):
        """Corruption (instability > 85) overrides other conditions."""
        result = determine_mutation_type(
            coherence=20, instability=90,
            echo_trace=70, latent_drift_direction="flux",
        )
        assert result == MutationType.CORRUPTION


# ──────────────────────────────────────────────
# Mutation Arc Tests
# ──────────────────────────────────────────────

class TestAdvanceMutationArc:
    """Test mutation arc state machine (§4.4)."""

    def test_no_mutation(self, evolution):
        """No mutation in progress → no_mutation status."""
        result = advance_mutation_arc(evolution, scene_number=1)
        assert result["status"] == "no_mutation"

    def test_scene_1_discovery(self, evolution):
        """Scene 1 → discovery phase."""
        evolution.mutation_in_progress = "order_def_01"
        result = advance_mutation_arc(evolution, scene_number=1)

        assert result["status"] == "discovery"
        assert result["skill_id"] == "order_def_01"
        assert evolution.mutation_arc_scene == 1

    def test_scene_2_decision(self, evolution):
        """Scene 2 → decision point with 3 choices."""
        evolution.mutation_in_progress = "order_def_01"
        result = advance_mutation_arc(evolution, scene_number=2)

        assert result["status"] == "decision_point"
        assert len(result["choices"]) == 3
        choice_ids = [c["id"] for c in result["choices"]]
        assert "accept" in choice_ids
        assert "resist" in choice_ids
        assert "hybrid" in choice_ids

    def test_scene_3_resolution(self, evolution):
        """Scene 3 → resolution."""
        evolution.mutation_in_progress = "order_def_01"
        result = advance_mutation_arc(evolution, scene_number=3)

        assert result["status"] == "resolution"
        assert evolution.mutation_arc_scene == 3


# ──────────────────────────────────────────────
# Mutation Choice Resolution Tests
# ──────────────────────────────────────────────

class TestResolveMutationChoice:
    """Test mutation choice outcomes (§4.5)."""

    def test_accept(self, evolution):
        """Accept → mutations_done +1, arc cleared."""
        evolution.mutation_in_progress = "order_def_01"
        result = resolve_mutation_choice(evolution, "accept", instability=75)

        assert result["outcome"] == "mutated"
        assert result["needs_ai_skill_generation"] is True
        assert evolution.mutations_done == 1
        assert evolution.mutation_in_progress is None
        assert evolution.mutation_arc_scene == 0

    def test_resist(self, evolution):
        """Resist → instability -20, coherence +10."""
        evolution.mutation_in_progress = "order_def_01"
        result = resolve_mutation_choice(evolution, "resist", instability=75)

        assert result["outcome"] == "resisted"
        assert result["identity_changes"]["instability_change"] == -20
        assert result["identity_changes"]["coherence_change"] == +10
        assert evolution.mutations_done == 0  # NOT counted
        assert evolution.mutation_in_progress is None

    def test_hybrid_success(self, evolution):
        """Hybrid with stable enough → dual-nature skill."""
        evolution.mutation_in_progress = "order_def_01"
        result = resolve_mutation_choice(evolution, "hybrid", instability=60)

        assert result["outcome"] == "hybrid"
        assert result["identity_changes"]["instability_change"] == +15
        assert evolution.mutations_done == 1
        assert evolution.mutation_in_progress is None

    def test_hybrid_too_unstable(self, evolution):
        """Hybrid with instability + 15 > 100 → forced mutation."""
        evolution.mutation_in_progress = "order_def_01"
        result = resolve_mutation_choice(evolution, "hybrid", instability=90)

        assert result["outcome"] == "forced_mutation"
        assert evolution.mutations_done == 1

    def test_no_mutation_in_progress(self, evolution):
        """No mutation → error."""
        result = resolve_mutation_choice(evolution, "accept", instability=50)
        assert "error" in result

    def test_invalid_choice(self, evolution):
        """Invalid choice → error."""
        evolution.mutation_in_progress = "order_def_01"
        result = resolve_mutation_choice(evolution, "invalid", instability=50)
        assert "error" in result


# ──────────────────────────────────────────────
# Integration Eligibility Tests
# ──────────────────────────────────────────────

class TestCheckIntegrationEligible:
    """Test integration pair finding (§5.2)."""

    def test_eligible_pair(self):
        """Two energy skills with 5+ uses → eligible."""
        skills = [
            {"id": "energy_01", "primary_principle": "energy", "tier": 1},
            {"id": "energy_02", "primary_principle": "energy", "tier": 1},
        ]
        usage = {"energy_01": 6, "energy_02": 5}
        pairs = check_integration_eligible(skills, usage, current_rank=3, integrations_done=0)
        assert len(pairs) == 1
        assert pairs[0] == ("energy_01", "energy_02")

    def test_rank_too_low(self):
        """Rank < 3 → no pairs."""
        skills = [
            {"id": "energy_01", "primary_principle": "energy"},
            {"id": "energy_02", "primary_principle": "energy"},
        ]
        usage = {"energy_01": 10, "energy_02": 10}
        pairs = check_integration_eligible(skills, usage, current_rank=2, integrations_done=0)
        assert pairs == []

    def test_max_integrations(self):
        """2 integrations done → no pairs."""
        skills = [
            {"id": "energy_01", "primary_principle": "energy"},
            {"id": "energy_02", "primary_principle": "energy"},
        ]
        usage = {"energy_01": 10, "energy_02": 10}
        pairs = check_integration_eligible(skills, usage, current_rank=3, integrations_done=2)
        assert pairs == []

    def test_low_usage(self):
        """Skill with < 5 uses → not eligible."""
        skills = [
            {"id": "energy_01", "primary_principle": "energy"},
            {"id": "energy_02", "primary_principle": "energy"},
        ]
        usage = {"energy_01": 10, "energy_02": 4}
        pairs = check_integration_eligible(skills, usage, current_rank=3, integrations_done=0)
        assert pairs == []

    def test_no_shared_principle(self):
        """No shared principle → not eligible."""
        skills = [
            {"id": "energy_01", "primary_principle": "energy"},
            {"id": "order_01", "primary_principle": "order"},
        ]
        usage = {"energy_01": 10, "order_01": 10}
        pairs = check_integration_eligible(skills, usage, current_rank=3, integrations_done=0)
        assert pairs == []

    def test_unique_skills_excluded(self):
        """Unique skills are not eligible for integration."""
        skills = [
            {"id": "unique_01", "primary_principle": "energy", "is_unique": True},
            {"id": "energy_02", "primary_principle": "energy"},
        ]
        usage = {"unique_01": 10, "energy_02": 10}
        pairs = check_integration_eligible(skills, usage, current_rank=3, integrations_done=0)
        assert pairs == []

    def test_shared_secondary_principle(self):
        """Skills sharing secondary principle → eligible."""
        skills = [
            {"id": "s1", "primary_principle": "energy", "secondary_principle": "flux"},
            {"id": "s2", "primary_principle": "order", "secondary_principle": "flux"},
        ]
        usage = {"s1": 5, "s2": 5}
        pairs = check_integration_eligible(skills, usage, current_rank=3, integrations_done=0)
        assert len(pairs) == 1


# ──────────────────────────────────────────────
# Integration Tier Tests
# ──────────────────────────────────────────────

class TestCalculateIntegrationTier:
    """Test tier calculation rules (§5.3)."""

    def test_t1_t1_to_t2(self):
        assert calculate_integration_tier(1, 1, current_rank=3) == 2

    def test_t1_t2_to_t2(self):
        assert calculate_integration_tier(1, 2, current_rank=3) == 2

    def test_t2_t1_to_t2(self):
        assert calculate_integration_tier(2, 1, current_rank=3) == 2

    def test_t2_t2_to_t3_rank4(self):
        """T2+T2 at Rank 4 → T3."""
        assert calculate_integration_tier(2, 2, current_rank=4) == 3

    def test_t2_t2_blocked_rank3(self):
        """T2+T2 at Rank 3 → blocked (needs Rank 4)."""
        assert calculate_integration_tier(2, 2, current_rank=3) is None


# ──────────────────────────────────────────────
# Perform Integration Tests
# ──────────────────────────────────────────────

class TestPerformIntegration:
    """Test integration execution (§5.4)."""

    def test_basic_integration(self, evolution):
        """T1 + T1 → T2 integration result."""
        skill_a = {"id": "energy_01", "primary_principle": "energy", "tier": 1}
        skill_b = {"id": "energy_02", "primary_principle": "energy", "tier": 1}

        result = perform_integration(evolution, skill_a, skill_b, current_rank=3)

        assert result is not None
        assert result["output_tier"] == 2
        assert "energy" in result["merged_principles"]
        assert result["needs_ai_skill_generation"] is True
        assert evolution.integrations_done == 1

    def test_dual_principle_merge(self, evolution):
        """Skills with different principles → merged principles list."""
        skill_a = {"id": "s1", "primary_principle": "energy", "secondary_principle": "flux", "tier": 1}
        skill_b = {"id": "s2", "primary_principle": "flux", "tier": 1}

        result = perform_integration(evolution, skill_a, skill_b, current_rank=3)

        assert result is not None
        assert set(result["merged_principles"]) == {"energy", "flux"}

    def test_blocked_by_rank(self, evolution):
        """T2+T2 at Rank 3 → blocked."""
        skill_a = {"id": "s1", "primary_principle": "energy", "tier": 2}
        skill_b = {"id": "s2", "primary_principle": "energy", "tier": 2}

        result = perform_integration(evolution, skill_a, skill_b, current_rank=3)
        assert result is None
        assert evolution.integrations_done == 0


# ──────────────────────────────────────────────
# Awakening Candidates Tests
# ──────────────────────────────────────────────

class TestGetAwakeningCandidates:
    """Test awakening compatibility (§6.3)."""

    def test_adjacent_principle_compatible(self):
        """Energy skill + Matter awakening → compatible (adjacent)."""
        skills = [
            {"id": "energy_01", "primary_principle": "energy", "tier": 1},
        ]
        candidates = get_awakening_candidates(skills, "matter", [])
        assert "energy_01" in candidates

    def test_opposite_principle_incompatible(self):
        """Energy skill + Void awakening → incompatible (opposite)."""
        skills = [
            {"id": "energy_01", "primary_principle": "energy", "tier": 1},
        ]
        candidates = get_awakening_candidates(skills, "void", [])
        assert candidates == []

    def test_already_awakened_excluded(self):
        """Already awakened skill → excluded."""
        skills = [
            {"id": "energy_01", "primary_principle": "energy", "tier": 1},
        ]
        candidates = get_awakening_candidates(skills, "matter", ["energy_01"])
        assert candidates == []

    def test_tier3_excluded(self):
        """Tier 3 skills → excluded (already complex)."""
        skills = [
            {"id": "energy_01", "primary_principle": "energy", "tier": 3},
        ]
        candidates = get_awakening_candidates(skills, "matter", [])
        assert candidates == []

    def test_unique_skills_excluded(self):
        """Unique skills → excluded."""
        skills = [
            {"id": "unique_01", "primary_principle": "energy", "tier": 1, "is_unique": True},
        ]
        candidates = get_awakening_candidates(skills, "matter", [])
        assert candidates == []

    def test_multiple_candidates(self):
        """Multiple compatible skills → all returned."""
        skills = [
            {"id": "energy_01", "primary_principle": "energy", "tier": 1},
            {"id": "order_01", "primary_principle": "order", "tier": 1},
            {"id": "void_01", "primary_principle": "void", "tier": 1},
        ]
        # Matter is adjacent to: energy, order (synergy)
        # Not adjacent to void (non-adjacent/weak)
        candidates = get_awakening_candidates(skills, "matter", [])
        assert "energy_01" in candidates
        assert "order_01" in candidates
        # void is NOT adjacent to matter
        assert "void_01" not in candidates


# ──────────────────────────────────────────────
# Apply Awakening Tests
# ──────────────────────────────────────────────

class TestApplyAwakening:
    """Test awakening application (§6.5)."""

    def test_tier1_gains_secondary(self, evolution):
        """Tier 1 → gains secondary principle."""
        skill = {"id": "energy_01", "primary_principle": "energy", "tier": 1}
        result = apply_awakening(evolution, "energy_01", "matter", skill)

        assert skill["secondary_principle"] == "matter"
        assert result["effect"] == "secondary_principle_added"
        assert "energy_01" in evolution.awakened_skills

    def test_tier2_gains_tertiary(self, evolution):
        """Tier 2 → gains tertiary principle."""
        skill = {
            "id": "dual_01", "primary_principle": "energy",
            "secondary_principle": "order", "tier": 2,
        }
        result = apply_awakening(evolution, "dual_01", "matter", skill)

        assert skill["tertiary_principle"] == "matter"
        assert result["effect"] == "tertiary_principle_added"

    def test_tier3_no_change(self, evolution):
        """Tier 3 → no change (already complex)."""
        skill = {"id": "complex_01", "tier": 3}
        result = apply_awakening(evolution, "complex_01", "matter", skill)

        assert result["effect"] == "no_change"
        assert "complex_01" in evolution.awakened_skills

    def test_idempotent(self, evolution):
        """Calling twice doesn't duplicate in awakened_skills."""
        skill = {"id": "energy_01", "tier": 1}
        apply_awakening(evolution, "energy_01", "matter", skill)
        apply_awakening(evolution, "energy_01", "matter", skill)
        assert evolution.awakened_skills.count("energy_01") == 1
