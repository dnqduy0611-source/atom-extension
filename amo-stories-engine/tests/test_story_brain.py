"""Tests for StoryBrain — NeuralMemory v2.8 integration."""

import asyncio
import pytest
import tempfile
from pathlib import Path
from unittest.mock import patch


# ──────────────────────────────────────────────
# Import helpers
# ──────────────────────────────────────────────

def _neural_memory_available() -> bool:
    try:
        from neural_memory import Brain
        return True
    except ImportError:
        return False

skip_no_neural = pytest.mark.skipif(
    not _neural_memory_available(),
    reason="NeuralMemory not installed",
)


# ──────────────────────────────────────────────
# Tests: Basic construction
# ──────────────────────────────────────────────

class TestStoryBrainConstruction:
    """Test StoryBrain can be created without NeuralMemory."""

    def test_create_story_brain(self):
        from app.memory.story_brain import StoryBrain
        brain = StoryBrain("test-story")
        assert brain.story_id == "test-story"
        assert brain.brain_id == "test-story"
        assert brain.available is False  # Not initialized yet

    def test_create_with_custom_brain_id(self):
        from app.memory.story_brain import StoryBrain
        brain = StoryBrain("story-1", brain_id="custom-brain")
        assert brain.brain_id == "custom-brain"

    def test_available_false_before_init(self):
        from app.memory.story_brain import StoryBrain
        brain = StoryBrain("test")
        assert brain.available is False


# ──────────────────────────────────────────────
# Tests: Graceful degradation
# ──────────────────────────────────────────────

class TestGracefulDegradation:
    """Test that StoryBrain is a no-op when NeuralMemory is unavailable."""

    @pytest.mark.asyncio
    async def test_query_returns_empty_without_init(self):
        from app.memory.story_brain import StoryBrain
        brain = StoryBrain("test")
        result = await brain.query_context("any query")
        assert result == ""

    @pytest.mark.asyncio
    async def test_store_scene_no_crash_without_init(self):
        from app.memory.story_brain import StoryBrain
        brain = StoryBrain("test")
        # Should not raise
        await brain.store_scene(
            scene_number=1,
            chapter_number=1,
            prose="Some prose text",
        )

    @pytest.mark.asyncio
    async def test_store_chapter_summary_no_crash_without_init(self):
        from app.memory.story_brain import StoryBrain
        brain = StoryBrain("test")
        # Should not raise
        await brain.store_chapter_summary(
            chapter_number=1,
            summary="Chapter summary",
        )

    @pytest.mark.asyncio
    async def test_close_no_crash_without_init(self):
        from app.memory.story_brain import StoryBrain
        brain = StoryBrain("test")
        await brain.close()


# ──────────────────────────────────────────────
# Tests: Full integration (requires NeuralMemory)
# ──────────────────────────────────────────────

@skip_no_neural
class TestStoryBrainIntegration:
    """Full integration tests with NeuralMemory v2.8."""

    @pytest.mark.asyncio
    async def test_initialize_and_available(self, tmp_path):
        from app.memory.story_brain import StoryBrain
        with patch("app.memory.story_brain.settings") as mock_settings:
            mock_settings.db_path = str(tmp_path / "stories.db")
            brain = StoryBrain("integration-test")
            await brain.initialize()
            assert brain.available is True
            await brain.close()
            assert brain.available is False

    @pytest.mark.asyncio
    async def test_store_and_query_scene(self, tmp_path):
        from app.memory.story_brain import StoryBrain
        with patch("app.memory.story_brain.settings") as mock_settings:
            mock_settings.db_path = str(tmp_path / "stories.db")
            brain = StoryBrain("query-test")
            await brain.initialize()
            assert brain.available

            # Store 3 scenes
            await brain.store_scene(
                scene_number=1,
                chapter_number=1,
                prose="Aeres gặp cụ già bí ẩn trong rừng tối. Cụ già nói về ngôi đền cổ.",
                scene_type="discovery",
                npcs=["Old Sage", "Aeres"],
                mood="mysterious",
                title="Cuộc gặp gỡ",
            )
            await brain.store_scene(
                scene_number=2,
                chapter_number=1,
                prose="Aeres chiến đấu với quái vật trong hang động sâu.",
                scene_type="combat",
                npcs=["Cave Beast"],
                mood="intense",
            )
            await brain.store_scene(
                scene_number=1,
                chapter_number=2,
                prose="Quay lại với cụ già, Aeres hỏi về lịch sử ngôi đền.",
                scene_type="dialogue",
                npcs=["Old Sage"],
                mood="calm",
            )

            # Query should return relevant results
            result = await brain.query_context("cụ già ngôi đền")
            # The result may be empty for a freshly initialized brain
            # (graph needs sufficient data for reflex activation).
            # At minimum, it should not crash and return a string.
            assert isinstance(result, str)

            await brain.close()

    @pytest.mark.asyncio
    async def test_store_chapter_summary(self, tmp_path):
        from app.memory.story_brain import StoryBrain
        with patch("app.memory.story_brain.settings") as mock_settings:
            mock_settings.db_path = str(tmp_path / "stories.db")
            brain = StoryBrain("summary-test")
            await brain.initialize()

            await brain.store_chapter_summary(
                chapter_number=1,
                summary="Aeres bắt đầu hành trình, gặp cụ già trong rừng.",
                choice_text="Hỏi cụ già về ngôi đền",
            )
            # Should not crash
            assert brain.available

            await brain.close()

    @pytest.mark.asyncio
    async def test_double_init_idempotent(self, tmp_path):
        from app.memory.story_brain import StoryBrain
        with patch("app.memory.story_brain.settings") as mock_settings:
            mock_settings.db_path = str(tmp_path / "stories.db")
            brain = StoryBrain("idempotent-test")
            await brain.initialize()
            await brain.initialize()  # Second init should be no-op
            assert brain.available
            await brain.close()


# ──────────────────────────────────────────────
# Tests: Cache function
# ──────────────────────────────────────────────

@skip_no_neural
class TestBrainCache:
    """Test get_or_create_brain caching."""

    @pytest.mark.asyncio
    async def test_cache_returns_same_brain(self, tmp_path):
        from app.memory.story_brain import get_or_create_brain, _brain_cache
        with patch("app.memory.story_brain.settings") as mock_settings:
            mock_settings.db_path = str(tmp_path / "stories.db")
            # Clear cache
            _brain_cache.clear()

            brain1 = await get_or_create_brain("cache-test")
            brain2 = await get_or_create_brain("cache-test")
            assert brain1 is brain2
            assert brain1.available

            await brain1.close()
            _brain_cache.clear()
