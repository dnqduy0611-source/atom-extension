"""Unit tests for formal Hebbian learning rule with saturation and novelty."""

from __future__ import annotations

from datetime import datetime

import pytest

from neural_memory.core.synapse import Synapse, SynapseType
from neural_memory.engine.learning_rule import (
    LearningConfig,
    anti_hebbian_update,
    compute_effective_rate,
    hebbian_update,
    normalize_outgoing_weights,
)


class TestEffectiveRate:
    """Tests for novelty-adjusted learning rate."""

    def test_novel_synapse_gets_boost(self) -> None:
        """New synapse (freq=0) should have highest effective rate."""
        rate = compute_effective_rate(0.05, reinforced_count=0)
        # η_eff = 0.05 * (1 + 3.0 * e^0) = 0.05 * 4.0 = 0.20
        assert rate == pytest.approx(0.20, abs=0.01)

    def test_familiar_synapse_converges(self) -> None:
        """Frequently reinforced synapse should converge toward base rate."""
        rate_0 = compute_effective_rate(0.05, reinforced_count=0)
        rate_50 = compute_effective_rate(0.05, reinforced_count=50)
        rate_100 = compute_effective_rate(0.05, reinforced_count=100)

        assert rate_0 > rate_50 > rate_100
        # At freq=100, novelty should be nearly gone
        assert rate_100 == pytest.approx(0.05, abs=0.01)

    def test_monotonic_decay(self) -> None:
        """Effective rate should monotonically decrease with reinforcement count."""
        rates = [compute_effective_rate(0.05, i) for i in range(50)]
        for i in range(len(rates) - 1):
            assert rates[i] >= rates[i + 1]

    def test_custom_novelty_params(self) -> None:
        """Custom novelty boost and decay are respected."""
        high_boost = compute_effective_rate(
            0.05,
            reinforced_count=0,
            novelty_boost_max=5.0,
        )
        low_boost = compute_effective_rate(
            0.05,
            reinforced_count=0,
            novelty_boost_max=1.0,
        )
        assert high_boost > low_boost

    def test_zero_base_rate(self) -> None:
        """Zero base rate should always produce zero effective rate."""
        rate = compute_effective_rate(0.0, reinforced_count=0)
        assert rate == 0.0


class TestHebbianUpdate:
    """Tests for Hebbian weight update with saturation."""

    def test_basic_update(self) -> None:
        """Basic Hebbian update should increase weight."""
        result = hebbian_update(
            current_weight=0.5,
            pre_activation=0.8,
            post_activation=0.7,
            reinforced_count=0,
        )
        assert result.new_weight > 0.5
        assert result.delta > 0.0

    def test_zero_pre_activation_no_change(self) -> None:
        """Zero pre-synaptic activation should produce no weight change."""
        result = hebbian_update(
            current_weight=0.5,
            pre_activation=0.0,
            post_activation=0.9,
            reinforced_count=0,
        )
        assert result.new_weight == 0.5
        assert result.delta == 0.0

    def test_zero_post_activation_no_change(self) -> None:
        """Zero post-synaptic activation should produce no weight change."""
        result = hebbian_update(
            current_weight=0.5,
            pre_activation=0.9,
            post_activation=0.0,
            reinforced_count=0,
        )
        assert result.new_weight == 0.5
        assert result.delta == 0.0

    def test_saturation_near_ceiling(self) -> None:
        """Weights near ceiling should barely change (saturation)."""
        result = hebbian_update(
            current_weight=0.98,
            pre_activation=1.0,
            post_activation=1.0,
            reinforced_count=0,
        )
        assert result.delta < 0.01
        assert result.saturated

    def test_weight_never_exceeds_max(self) -> None:
        """Weight should never exceed w_max."""
        result = hebbian_update(
            current_weight=0.99,
            pre_activation=1.0,
            post_activation=1.0,
            reinforced_count=0,
        )
        assert result.new_weight <= 1.0

    def test_low_weight_high_headroom(self) -> None:
        """Low weight should have large delta (more headroom)."""
        low = hebbian_update(
            current_weight=0.1,
            pre_activation=0.8,
            post_activation=0.8,
            reinforced_count=0,
        )
        high = hebbian_update(
            current_weight=0.9,
            pre_activation=0.8,
            post_activation=0.8,
            reinforced_count=0,
        )
        assert low.delta > high.delta

    def test_novelty_affects_update(self) -> None:
        """Novel synapse should get larger update than familiar one."""
        novel = hebbian_update(
            current_weight=0.5,
            pre_activation=0.7,
            post_activation=0.7,
            reinforced_count=0,
        )
        familiar = hebbian_update(
            current_weight=0.5,
            pre_activation=0.7,
            post_activation=0.7,
            reinforced_count=50,
        )
        assert novel.delta > familiar.delta

    def test_higher_activation_larger_delta(self) -> None:
        """Higher pre/post activations should produce larger delta."""
        strong = hebbian_update(
            current_weight=0.5,
            pre_activation=0.9,
            post_activation=0.9,
            reinforced_count=10,
        )
        weak = hebbian_update(
            current_weight=0.5,
            pre_activation=0.3,
            post_activation=0.3,
            reinforced_count=10,
        )
        assert strong.delta > weak.delta

    def test_custom_config(self) -> None:
        """Custom LearningConfig is respected."""
        config = LearningConfig(
            learning_rate=0.1,
            weight_max=0.8,
            novelty_boost_max=0.0,
        )
        result = hebbian_update(
            current_weight=0.5,
            pre_activation=0.8,
            post_activation=0.8,
            reinforced_count=0,
            config=config,
        )
        assert result.new_weight <= 0.8

    def test_weight_never_negative(self) -> None:
        """Weight should never go negative."""
        result = hebbian_update(
            current_weight=0.0,
            pre_activation=0.5,
            post_activation=0.5,
            reinforced_count=0,
        )
        assert result.new_weight >= 0.0

    def test_negative_activation_no_change(self) -> None:
        """Negative activation should be treated as zero (no change)."""
        result = hebbian_update(
            current_weight=0.5,
            pre_activation=-0.5,
            post_activation=0.8,
            reinforced_count=0,
        )
        assert result.delta == 0.0


class TestAntiHebbianUpdate:
    """Tests for anti-Hebbian weight reduction."""

    def test_reduces_weight(self) -> None:
        """Anti-Hebbian should reduce weight."""
        result = anti_hebbian_update(current_weight=0.8, strength=0.5)
        assert result.new_weight < 0.8
        assert result.delta < 0.0

    def test_zero_strength_no_change(self) -> None:
        """Zero conflict strength should produce no change."""
        result = anti_hebbian_update(current_weight=0.8, strength=0.0)
        assert result.new_weight == 0.8

    def test_weight_floor_at_zero(self) -> None:
        """Weight should never go below zero."""
        result = anti_hebbian_update(current_weight=0.01, strength=1.0)
        assert result.new_weight >= 0.0

    def test_stronger_conflict_larger_reduction(self) -> None:
        """Stronger conflict should produce larger weight reduction."""
        mild = anti_hebbian_update(current_weight=0.8, strength=0.2)
        strong = anti_hebbian_update(current_weight=0.8, strength=0.9)
        assert abs(strong.delta) > abs(mild.delta)


class TestCompetitiveNormalization:
    """Tests for outgoing weight normalization."""

    def _make_synapse(
        self,
        source_id: str,
        target_id: str,
        weight: float,
    ) -> Synapse:
        """Create a test synapse (bypasses create() clamping for weights > 1)."""
        return Synapse(
            id=f"{source_id}-{target_id}",
            source_id=source_id,
            target_id=target_id,
            type=SynapseType.RELATED_TO,
            weight=weight,
        )

    def test_within_budget_unchanged(self) -> None:
        """Synapses within budget should not be modified."""
        synapses = [
            self._make_synapse("n1", "n2", 0.5),
            self._make_synapse("n1", "n3", 0.5),
        ]
        result = normalize_outgoing_weights(synapses, "n1", budget=5.0)
        assert len(result) == 2
        for s in result:
            if s.source_id == "n1":
                assert s.weight == 0.5

    def test_over_budget_scaled(self) -> None:
        """Synapses over budget should be scaled proportionally."""
        synapses = [
            self._make_synapse("n1", "n2", 3.0),
            self._make_synapse("n1", "n3", 4.0),
            self._make_synapse("n1", "n4", 3.0),
        ]
        # Total = 10.0, budget = 5.0 → scale by 0.5
        result = normalize_outgoing_weights(synapses, "n1", budget=5.0)

        outgoing = [s for s in result if s.source_id == "n1"]
        total = sum(s.weight for s in outgoing)
        assert total == pytest.approx(5.0, abs=0.01)

    def test_proportional_scaling(self) -> None:
        """Weights should be scaled proportionally (relative ranking preserved)."""
        synapses = [
            self._make_synapse("n1", "n2", 2.0),
            self._make_synapse("n1", "n3", 8.0),
        ]
        # Total = 10.0, budget = 5.0
        result = normalize_outgoing_weights(synapses, "n1", budget=5.0)

        weights = {s.target_id: s.weight for s in result if s.source_id == "n1"}
        assert weights["n3"] > weights["n2"]
        assert weights["n2"] == pytest.approx(1.0, abs=0.01)
        assert weights["n3"] == pytest.approx(4.0, abs=0.01)

    def test_non_outgoing_unchanged(self) -> None:
        """Synapses from other neurons should not be affected."""
        synapses = [
            self._make_synapse("n1", "n2", 4.0),
            self._make_synapse("n1", "n3", 4.0),
            self._make_synapse("n2", "n3", 0.5),  # different source
        ]
        result = normalize_outgoing_weights(synapses, "n1", budget=5.0)

        n2_synapse = next(s for s in result if s.source_id == "n2")
        assert n2_synapse.weight == 0.5

    def test_empty_synapses(self) -> None:
        """Empty synapse list should return empty list."""
        result = normalize_outgoing_weights([], "n1", budget=5.0)
        assert result == []

    def test_no_outgoing_unchanged(self) -> None:
        """No outgoing synapses for source should return unchanged list."""
        synapses = [self._make_synapse("n2", "n3", 0.5)]
        result = normalize_outgoing_weights(synapses, "n1", budget=5.0)
        assert len(result) == 1
        assert result[0].weight == 0.5

    def test_immutability(self) -> None:
        """Original synapses should not be mutated."""
        original = self._make_synapse("n1", "n2", 8.0)
        synapses = [original, self._make_synapse("n1", "n3", 8.0)]
        normalize_outgoing_weights(synapses, "n1", budget=5.0)
        assert original.weight == 8.0  # unchanged


class TestSynapseReinforceWithLearningRule:
    """Tests for Synapse.reinforce() with formal learning rule."""

    def test_backward_compatible_delta(self) -> None:
        """reinforce(delta) without activations should use direct addition."""
        synapse = Synapse.create("n1", "n2", SynapseType.RELATED_TO, weight=0.5)
        reinforced = synapse.reinforce(delta=0.1)
        assert reinforced.weight == pytest.approx(0.6, abs=0.001)
        assert reinforced.reinforced_count == 1

    def test_hebbian_with_activations(self) -> None:
        """reinforce() with pre/post activations should use Hebbian rule."""
        synapse = Synapse.create("n1", "n2", SynapseType.RELATED_TO, weight=0.5)
        reinforced = synapse.reinforce(
            delta=0.05,
            pre_activation=0.8,
            post_activation=0.7,
        )
        # Should increase weight but by Hebbian formula, not direct delta
        assert reinforced.weight > 0.5
        assert reinforced.reinforced_count == 1

    def test_hebbian_zero_activation_no_change(self) -> None:
        """Hebbian with zero activation should not change weight."""
        synapse = Synapse.create("n1", "n2", SynapseType.RELATED_TO, weight=0.5)
        reinforced = synapse.reinforce(
            delta=0.05,
            pre_activation=0.0,
            post_activation=0.8,
        )
        assert reinforced.weight == 0.5
        # Still increments count (attempt was made)
        assert reinforced.reinforced_count == 1

    def test_immutability(self) -> None:
        """Original synapse should not be mutated."""
        original = Synapse.create("n1", "n2", SynapseType.RELATED_TO, weight=0.5)
        reinforced = original.reinforce(
            delta=0.05,
            pre_activation=0.8,
            post_activation=0.7,
        )
        assert original.weight == 0.5
        assert reinforced.weight != original.weight

    def test_capped_at_one(self) -> None:
        """Weight should not exceed 1.0 even with Hebbian rule."""
        synapse = Synapse.create("n1", "n2", SynapseType.RELATED_TO, weight=0.99)
        reinforced = synapse.reinforce(
            delta=0.1,
            pre_activation=1.0,
            post_activation=1.0,
        )
        assert reinforced.weight <= 1.0

    def test_now_parameter(self) -> None:
        """Custom 'now' timestamp should be used for last_activated."""
        synapse = Synapse.create("n1", "n2", SynapseType.RELATED_TO, weight=0.5)
        custom_time = datetime(2026, 6, 15, 12, 0, 0)
        reinforced = synapse.reinforce(delta=0.1, now=custom_time)
        assert reinforced.last_activated == custom_time
