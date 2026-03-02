"""Tests for NarrativePrinciple mapping and RarePrinciple stubs.

Ref: POWER_SYSTEM_SPEC v1.1 §2.1-2.4
"""

import pytest

from app.models.power import (
    ALL_NARRATIVE_PRINCIPLES,
    ALL_PRINCIPLES,
    NARRATIVE_TO_MECHANICAL,
    NarrativePrinciple,
    Principle,
    RarePrinciple,
    narrative_to_resonance_weights,
)


# ──────────────────────────────────────────────
# NarrativePrinciple enum
# ──────────────────────────────────────────────

class TestNarrativePrinciple:
    def test_has_5_members(self):
        assert len(NarrativePrinciple) == 5

    def test_all_values(self):
        expected = {"order", "freedom", "evolution", "control", "devotion"}
        assert {p.value for p in NarrativePrinciple} == expected

    def test_all_narrative_principles_list(self):
        assert len(ALL_NARRATIVE_PRINCIPLES) == 5
        assert all(isinstance(p, NarrativePrinciple) for p in ALL_NARRATIVE_PRINCIPLES)


# ──────────────────────────────────────────────
# NARRATIVE_TO_MECHANICAL mapping
# ──────────────────────────────────────────────

class TestNarrativeMapping:
    def test_all_5_principles_have_mapping(self):
        for np in NarrativePrinciple:
            assert np.value in NARRATIVE_TO_MECHANICAL, f"Missing mapping for {np}"

    def test_weights_sum_to_1(self):
        for key, weights in NARRATIVE_TO_MECHANICAL.items():
            total = sum(weights.values())
            assert abs(total - 1.0) < 1e-9, (
                f"Weights for {key} sum to {total}, expected 1.0"
            )

    def test_all_targets_are_valid_mechanical_principles(self):
        valid = {p.value for p in Principle}
        for key, weights in NARRATIVE_TO_MECHANICAL.items():
            for principle_name in weights:
                assert principle_name in valid, (
                    f"Mapping {key} references unknown principle '{principle_name}'"
                )

    def test_each_mapping_has_at_least_2_principles(self):
        for key, weights in NARRATIVE_TO_MECHANICAL.items():
            assert len(weights) >= 2, (
                f"Mapping {key} maps to {len(weights)} principles; expected ≥2"
            )


# ──────────────────────────────────────────────
# narrative_to_resonance_weights()
# ──────────────────────────────────────────────

class TestNarrativeToResonanceWeights:
    def test_order_default_base(self):
        result = narrative_to_resonance_weights("order")
        assert result["order"] == pytest.approx(0.4, abs=1e-4)   # 0.5 * 0.8
        assert result["matter"] == pytest.approx(0.05, abs=1e-4)  # 0.5 * 0.1
        assert result["energy"] == pytest.approx(0.05, abs=1e-4)  # 0.5 * 0.1

    def test_custom_base_resonance(self):
        result = narrative_to_resonance_weights("freedom", base_resonance=1.0)
        assert result["entropy"] == pytest.approx(0.6, abs=1e-4)
        assert result["flux"] == pytest.approx(0.3, abs=1e-4)
        assert result["void"] == pytest.approx(0.1, abs=1e-4)

    def test_accepts_enum_value(self):
        result = narrative_to_resonance_weights(NarrativePrinciple.DEVOTION)
        assert "energy" in result
        assert "matter" in result
        assert "order" in result

    def test_unknown_returns_empty(self):
        result = narrative_to_resonance_weights("nonexistent")
        assert result == {}

    def test_all_principles_produce_nonempty(self):
        for np in NarrativePrinciple:
            result = narrative_to_resonance_weights(np)
            assert len(result) >= 2, f"{np} produced empty mapping"


# ──────────────────────────────────────────────
# RarePrinciple enum
# ──────────────────────────────────────────────

class TestRarePrinciple:
    def test_has_3_members(self):
        assert len(RarePrinciple) == 3

    def test_all_values(self):
        expected = {"causality", "continuum", "resonance_meta"}
        assert {p.value for p in RarePrinciple} == expected

    def test_rare_not_in_core_principles(self):
        """Rare principles must be distinct from core 6."""
        core_values = {p.value for p in Principle}
        for rp in RarePrinciple:
            assert rp.value not in core_values, (
                f"Rare principle {rp} clashes with core principle"
            )
