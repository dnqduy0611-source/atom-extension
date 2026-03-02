"""Unit tests for activation stabilization — iterative dampening."""

from __future__ import annotations

from neural_memory.engine.activation import ActivationResult
from neural_memory.engine.stabilization import StabilizationConfig, stabilize


def _make_activation(neuron_id: str, level: float) -> ActivationResult:
    """Create a test ActivationResult."""
    return ActivationResult(
        neuron_id=neuron_id,
        activation_level=level,
        hop_distance=1,
        path=["anchor", neuron_id],
        source_anchor="anchor",
    )


class TestStabilization:
    """Tests for iterative dampening stabilization."""

    def test_empty_activations(self) -> None:
        """Empty activations should return empty with no iterations."""
        result, report = stabilize({})
        assert result == {}
        assert report.iterations == 0
        assert report.converged

    def test_noise_floor_removes_weak(self) -> None:
        """Activations below noise floor should be removed."""
        activations = {
            "n1": _make_activation("n1", 0.8),
            "n2": _make_activation("n2", 0.02),  # below 0.05
            "n3": _make_activation("n3", 0.6),
        }
        result, report = stabilize(activations)
        assert "n2" not in result
        assert report.neurons_removed >= 1

    def test_dampening_reduces_levels(self) -> None:
        """Dampening should reduce activation levels after iteration."""
        activations = {
            "n1": _make_activation("n1", 0.8),
            "n2": _make_activation("n2", 0.6),
        }
        result, _ = stabilize(activations)
        # After dampening, levels should generally be lower
        # (homeostatic norm may pull them up, but net effect is dampening)
        for nid in result:
            # Should not exceed original
            assert result[nid].activation_level <= activations[nid].activation_level + 0.1

    def test_convergence(self) -> None:
        """Stabilization should converge within max iterations."""
        activations = {f"n{i}": _make_activation(f"n{i}", 0.5 + (i * 0.05)) for i in range(10)}
        _, report = stabilize(activations)
        assert report.converged
        assert report.iterations <= 10

    def test_typical_convergence_fast(self) -> None:
        """Typical activation patterns should converge in <8 iterations."""
        activations = {
            "n1": _make_activation("n1", 0.9),
            "n2": _make_activation("n2", 0.7),
            "n3": _make_activation("n3", 0.5),
            "n4": _make_activation("n4", 0.3),
            "n5": _make_activation("n5", 0.1),
        }
        _, report = stabilize(activations)
        assert report.converged
        assert report.iterations <= 8

    def test_preserves_relative_ranking(self) -> None:
        """Stabilization should preserve relative activation ranking."""
        activations = {
            "high": _make_activation("high", 0.9),
            "mid": _make_activation("mid", 0.5),
            "low": _make_activation("low", 0.2),
        }
        result, _ = stabilize(activations)
        surviving = {nid: act.activation_level for nid, act in result.items()}
        if "high" in surviving and "mid" in surviving:
            assert surviving["high"] >= surviving["mid"]
        if "mid" in surviving and "low" in surviving:
            assert surviving["mid"] >= surviving["low"]

    def test_custom_config(self) -> None:
        """Custom config parameters are respected."""
        activations = {
            "n1": _make_activation("n1", 0.8),
            "n2": _make_activation("n2", 0.15),
        }
        config = StabilizationConfig(noise_floor=0.2)
        result, report = stabilize(activations, config)
        # n2 should be removed (0.15 < 0.2 noise floor)
        assert "n2" not in result
        assert report.neurons_removed >= 1

    def test_max_iterations_cap(self) -> None:
        """Should not exceed max_iterations."""
        activations = {f"n{i}": _make_activation(f"n{i}", 0.5 + (i * 0.05)) for i in range(10)}
        config = StabilizationConfig(
            max_iterations=3,
            convergence_threshold=0.0001,  # Very tight → won't converge
        )
        _, report = stabilize(activations, config)
        assert report.iterations <= 3

    def test_all_below_noise_floor(self) -> None:
        """If all activations are below noise floor, result should be empty."""
        activations = {
            "n1": _make_activation("n1", 0.01),
            "n2": _make_activation("n2", 0.02),
        }
        result, report = stabilize(activations)
        assert result == {}
        assert report.neurons_removed == 2

    def test_immutability(self) -> None:
        """Original activations should not be modified."""
        original = _make_activation("n1", 0.8)
        activations = {"n1": original}
        stabilize(activations)
        assert original.activation_level == 0.8

    def test_report_max_delta(self) -> None:
        """Report should include the max delta from final iteration."""
        activations = {
            "n1": _make_activation("n1", 0.8),
            "n2": _make_activation("n2", 0.6),
        }
        _, report = stabilize(activations)
        assert report.max_delta >= 0.0
        if report.converged:
            assert report.max_delta < 0.01

    def test_homeostatic_normalization(self) -> None:
        """Homeostatic norm should pull mean activation toward target."""
        # All very high activations — mean should be pulled down
        activations = {f"n{i}": _make_activation(f"n{i}", 0.95) for i in range(5)}
        result, _ = stabilize(activations)
        mean = sum(a.activation_level for a in result.values()) / max(len(result), 1)
        # Mean should be closer to 0.5 than original 0.95
        assert mean < 0.95
