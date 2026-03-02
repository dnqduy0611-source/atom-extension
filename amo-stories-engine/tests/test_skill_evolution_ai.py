"""Tests for AI Skill Evolution Generation.

Uses mocked LLM to test prompt construction, JSON parsing, and fallbacks.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.engine.skill_evolution_ai import (
    generate_mutated_skill,
    generate_hybrid_skill,
    generate_integrated_skill,
    _parse_json_response,
    _fallback_mutation,
    _fallback_hybrid,
    _fallback_integration,
)


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture
def energy_skill():
    return {
        "id": "energy_off_01",
        "name": "Energy Burst",
        "primary_principle": "energy",
        "tier": 1,
        "mechanic": "Ranged energy projectile",
        "limitation": "2 turn cooldown",
        "weakness": "Weak against void barriers",
    }


@pytest.fixture
def order_skill():
    return {
        "id": "order_def_01",
        "name": "Structure Shield",
        "primary_principle": "order",
        "tier": 1,
        "mechanic": "Creates a defensive barrier",
        "limitation": "Requires concentration",
        "weakness": "Shattered by entropy attacks",
    }


@pytest.fixture
def mock_llm():
    """Mock LLM that returns valid JSON."""
    llm = MagicMock()
    llm.ainvoke = AsyncMock()
    return llm


def _set_llm_response(mock_llm, data: dict):
    """Set mock LLM to return a specific JSON response."""
    response = MagicMock()
    response.content = json.dumps(data, ensure_ascii=False)
    mock_llm.ainvoke.return_value = response


# ──────────────────────────────────────────────
# JSON Parsing Tests
# ──────────────────────────────────────────────

class TestParseJsonResponse:
    """Test JSON response parsing with various formats."""

    def test_plain_json(self):
        result = _parse_json_response('{"name": "Test"}')
        assert result["name"] == "Test"

    def test_json_with_markdown_fences(self):
        raw = '```json\n{"name": "Test"}\n```'
        result = _parse_json_response(raw)
        assert result["name"] == "Test"

    def test_json_with_whitespace(self):
        raw = '  \n  {"name": "Test"}  \n  '
        result = _parse_json_response(raw)
        assert result["name"] == "Test"


# ──────────────────────────────────────────────
# Mutation Generation Tests
# ──────────────────────────────────────────────

class TestGenerateMutatedSkill:
    """Test AI mutation skill generation."""

    @pytest.mark.asyncio
    async def test_successful_mutation(self, energy_skill, mock_llm):
        """Successful LLM call → returns generated skill."""
        _set_llm_response(mock_llm, {
            "name": "Void Pulse",
            "primary_principle": "void",
            "mechanic": "Drains energy from target",
            "limitation": "3 turn cooldown",
            "weakness": "Self-damage on miss",
            "mutation_narrative": "Energy inverted to void through identity drift",
        })

        result = await generate_mutated_skill(
            original_skill=energy_skill,
            mutation_type="inversion",
            current_resonance={"void": 0.8, "energy": 0.2},
            llm=mock_llm,
        )

        assert result["name"] == "Void Pulse"
        assert result["tier"] == 1  # Same tier enforced
        assert result["evolution_type"] == "mutation"
        assert result["mutation_type"] == "inversion"
        mock_llm.ainvoke.assert_called_once()

    @pytest.mark.asyncio
    async def test_mutation_fallback_on_error(self, energy_skill, mock_llm):
        """LLM error → deterministic fallback."""
        mock_llm.ainvoke.side_effect = Exception("API error")

        result = await generate_mutated_skill(
            original_skill=energy_skill,
            mutation_type="corruption",
            current_resonance={"energy": 0.3},
            llm=mock_llm,
        )

        assert "Unstable" in result["name"]
        assert result["evolution_type"] == "mutation"
        assert result["tier"] == 1


# ──────────────────────────────────────────────
# Hybrid Generation Tests
# ──────────────────────────────────────────────

class TestGenerateHybridSkill:
    """Test AI hybrid skill generation."""

    @pytest.mark.asyncio
    async def test_successful_hybrid(self, energy_skill, mock_llm):
        """Successful LLM call → returns hybrid skill."""
        _set_llm_response(mock_llm, {
            "name": "Energy-Void Rift",
            "primary_principle": "energy",
            "secondary_principle": "void",
            "mechanic": "Dual-phase attack: energy then void drain",
            "limitation": "Requires instability > 30",
            "weakness": "Internal conflict causes random misfires",
            "hybrid_narrative": "Two opposing forces coexist in one skill",
        })

        result = await generate_hybrid_skill(
            original_skill=energy_skill,
            current_identity="energy-dominant warrior",
            latent_identity="void-touched wanderer",
            llm=mock_llm,
        )

        assert result["name"] == "Energy-Void Rift"
        assert result["tier"] == 1
        assert result["evolution_type"] == "hybrid"

    @pytest.mark.asyncio
    async def test_hybrid_fallback(self, energy_skill, mock_llm):
        """LLM error → deterministic fallback."""
        mock_llm.ainvoke.side_effect = Exception("Timeout")

        result = await generate_hybrid_skill(
            original_skill=energy_skill,
            current_identity="energy",
            latent_identity="void",
            llm=mock_llm,
        )

        assert "Hybrid" in result["name"]
        assert result["secondary_principle"] == "void"


# ──────────────────────────────────────────────
# Integration Generation Tests
# ──────────────────────────────────────────────

class TestGenerateIntegratedSkill:
    """Test AI integration skill generation."""

    @pytest.mark.asyncio
    async def test_successful_integration(self, energy_skill, order_skill, mock_llm):
        """Successful LLM call → returns integrated skill."""
        _set_llm_response(mock_llm, {
            "name": "Kinetic Barrier",
            "primary_principle": "energy",
            "secondary_principle": "order",
            "tier": 2,
            "mechanic": "Energy-infused structural defense",
            "limitation": "3 turn setup time",
            "weakness": "Entropy disruption",
            "integration_narrative": "Energy and Order merged into kinetic defense",
        })

        result = await generate_integrated_skill(
            skill_a=energy_skill,
            skill_b=order_skill,
            output_tier=2,
            merged_principles=["energy", "order"],
            llm=mock_llm,
        )

        assert result["name"] == "Kinetic Barrier"
        assert result["tier"] == 2  # Output tier enforced
        assert result["evolution_type"] == "integration"

    @pytest.mark.asyncio
    async def test_integration_fallback(self, energy_skill, order_skill, mock_llm):
        """LLM error → deterministic fallback."""
        mock_llm.ainvoke.side_effect = Exception("Rate limit")

        result = await generate_integrated_skill(
            skill_a=energy_skill,
            skill_b=order_skill,
            output_tier=2,
            merged_principles=["energy", "order"],
            llm=mock_llm,
        )

        assert "Fusion" in result["name"]
        assert result["tier"] == 2


# ──────────────────────────────────────────────
# Fallback Tests
# ──────────────────────────────────────────────

class TestFallbacks:
    """Test deterministic fallback functions."""

    def test_mutation_fallback_inversion(self, energy_skill):
        result = _fallback_mutation(energy_skill, "inversion")
        assert result["name"] == "Inverted Energy Burst"
        assert result["tier"] == 1

    def test_mutation_fallback_corruption(self, energy_skill):
        result = _fallback_mutation(energy_skill, "corruption")
        assert result["name"] == "Unstable Energy Burst"

    def test_mutation_fallback_purification(self, energy_skill):
        result = _fallback_mutation(energy_skill, "purification")
        assert result["name"] == "Purified Energy Burst"

    def test_hybrid_fallback(self, energy_skill):
        result = _fallback_hybrid(energy_skill, "void")
        assert "Hybrid" in result["name"]
        assert result["secondary_principle"] == "void"

    def test_integration_fallback(self, energy_skill, order_skill):
        result = _fallback_integration(
            energy_skill, order_skill, 2, ["energy", "order"],
        )
        assert "Fusion" in result["name"]
        assert result["tier"] == 2
        assert result["primary_principle"] == "energy"
        assert result["secondary_principle"] == "order"
