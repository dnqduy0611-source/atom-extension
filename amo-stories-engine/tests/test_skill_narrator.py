"""Tests for the Skill Narrative Wrapping Service.

Uses mocked LLM to test:
- Prompt building
- JSON parsing (clean + with fences)
- Fallback behavior
- Player context builder
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.engine.skill_narrator import (
    NarrativeSkin,
    _fallback_skin,
    build_player_context,
    wrap_skill_narrative,
    wrap_skill_narrative_sync,
)
from app.models.skill_catalog import SKILL_CATALOG


# ════════════════════════════════════════════
# Fixtures
# ════════════════════════════════════════════

@pytest.fixture
def matter_shield():
    """matter_def_01 skeleton."""
    return SKILL_CATALOG["matter_def_01"]


@pytest.fixture
def player_ctx():
    return build_player_context(
        narrative_principle="Order",
        current_arc="Protecting the village from raiders",
        traits=["protective", "analytical"],
        source="floor_boss",
    )


@pytest.fixture
def good_json_response():
    """Clean JSON from LLM."""
    return '{"display_name": "Oath Wall", "description": "A barrier born from promise.", "discovery_line": "It appeared when you thought of her."}'


@pytest.fixture
def fenced_json_response():
    """JSON wrapped in markdown fences."""
    return '```json\n{"display_name": "Iron Will", "description": "Stubborn defense.", "discovery_line": "The ground hardened."}\n```'


# ════════════════════════════════════════════
# Async wrap_skill_narrative
# ════════════════════════════════════════════

class TestWrapSkillNarrative:

    @pytest.mark.asyncio
    async def test_clean_json_response(self, matter_shield, player_ctx, good_json_response):
        llm = AsyncMock()
        llm.ainvoke.return_value = MagicMock(content=good_json_response)

        skin = await wrap_skill_narrative(matter_shield, player_ctx, llm)

        assert skin.display_name == "Oath Wall"
        assert skin.description == "A barrier born from promise."
        assert skin.discovery_line == "It appeared when you thought of her."
        llm.ainvoke.assert_called_once()

    @pytest.mark.asyncio
    async def test_fenced_json_response(self, matter_shield, player_ctx, fenced_json_response):
        llm = AsyncMock()
        llm.ainvoke.return_value = MagicMock(content=fenced_json_response)

        skin = await wrap_skill_narrative(matter_shield, player_ctx, llm)

        assert skin.display_name == "Iron Will"

    @pytest.mark.asyncio
    async def test_garbage_response_falls_back(self, matter_shield, player_ctx):
        llm = AsyncMock()
        llm.ainvoke.return_value = MagicMock(content="This is not JSON at all!")

        skin = await wrap_skill_narrative(matter_shield, player_ctx, llm)

        # Should use fallback
        assert skin.display_name == matter_shield.catalog_name
        assert "matter" in skin.description

    @pytest.mark.asyncio
    async def test_llm_exception_falls_back(self, matter_shield, player_ctx):
        llm = AsyncMock()
        llm.ainvoke.side_effect = RuntimeError("API down")

        skin = await wrap_skill_narrative(matter_shield, player_ctx, llm)

        assert skin.display_name == matter_shield.catalog_name


# ════════════════════════════════════════════
# Sync wrap_skill_narrative_sync
# ════════════════════════════════════════════

class TestWrapSkillNarrativeSync:

    def test_sync_clean_json(self, matter_shield, player_ctx, good_json_response):
        llm = MagicMock()
        llm.invoke.return_value = MagicMock(content=good_json_response)

        skin = wrap_skill_narrative_sync(matter_shield, player_ctx, llm)

        assert skin.display_name == "Oath Wall"
        llm.invoke.assert_called_once()

    def test_sync_fallback_on_error(self, matter_shield, player_ctx):
        llm = MagicMock()
        llm.invoke.side_effect = Exception("Network error")

        skin = wrap_skill_narrative_sync(matter_shield, player_ctx, llm)

        assert skin.display_name == matter_shield.catalog_name


# ════════════════════════════════════════════
# Fallback
# ════════════════════════════════════════════

class TestFallbackSkin:

    def test_fallback_uses_catalog_name(self, matter_shield):
        ctx = {"source": "tower_exploration"}
        skin = _fallback_skin(matter_shield, ctx)
        assert skin.display_name == "Matter Shield"
        assert "tower_exploration" in skin.description
        assert "matter" in skin.discovery_line

    def test_fallback_unknown_source(self, matter_shield):
        skin = _fallback_skin(matter_shield, {})
        assert "unknown moment" in skin.description


# ════════════════════════════════════════════
# Player Context Builder
# ════════════════════════════════════════════

class TestBuildPlayerContext:

    def test_basic_context(self):
        ctx = build_player_context(
            narrative_principle="Freedom",
            current_arc="Escaping the first floor",
            traits=["brave", "reckless"],
            source="npc_encounter",
        )
        assert ctx["narrative_principle"] == "Freedom"
        assert ctx["traits"] == "brave, reckless"
        assert ctx["source"] == "npc_encounter"

    def test_empty_traits(self):
        ctx = build_player_context()
        assert ctx["traits"] == "unknown"
        assert ctx["narrative_principle"] == ""

    def test_none_traits(self):
        ctx = build_player_context(traits=None)
        assert ctx["traits"] == "unknown"


# ════════════════════════════════════════════
# Prompt Content Verification
# ════════════════════════════════════════════

class TestPromptContent:

    @pytest.mark.asyncio
    async def test_prompt_contains_skeleton_info(self, matter_shield, player_ctx, good_json_response):
        """Verify the prompt sent to LLM contains skeleton data."""
        llm = AsyncMock()
        llm.ainvoke.return_value = MagicMock(content=good_json_response)

        await wrap_skill_narrative(matter_shield, player_ctx, llm)

        call_args = llm.ainvoke.call_args[0][0]  # messages list
        user_msg = call_args[1].content  # HumanMessage

        assert "Matter Shield" in user_msg
        assert "matter" in user_msg
        assert "defensive" in user_msg
        assert "Order" in user_msg
        assert "floor_boss" in user_msg

    @pytest.mark.asyncio
    async def test_system_prompt_has_rules(self, matter_shield, player_ctx, good_json_response):
        """System prompt should contain wrapping rules."""
        llm = AsyncMock()
        llm.ainvoke.return_value = MagicMock(content=good_json_response)

        await wrap_skill_narrative(matter_shield, player_ctx, llm)

        call_args = llm.ainvoke.call_args[0][0]
        system_msg = call_args[0].content  # SystemMessage

        assert "display_name" in system_msg
        assert "discovery_line" in system_msg
        assert "Do NOT invent new mechanical effects" in system_msg
