"""Tests for memory encoding — chapter encoding and rolling summaries."""

from app.memory.encoding import (
    build_rolling_summary,
    encode_chapter_from_state,
    encode_summary_for_context,
)
from app.models.pipeline import NarrativeState, WriterOutput
from app.models.story import Chapter, Choice


class TestEncodeChapterFromState:
    def test_basic_encoding(self):
        state = NarrativeState(
            story_id="s1",
            chapter_number=3,
            writer_output=WriterOutput(
                chapter_title="Test Title",
                prose="Test prose content",
                summary="Brief summary",
                choices=[Choice(text="Option A")],
            ),
            final_prose="Test prose content",
        )
        ch = encode_chapter_from_state(state)
        assert ch.story_id == "s1"
        assert ch.chapter_number == 3
        assert ch.title == "Test Title"
        assert ch.prose == "Test prose content"
        assert ch.summary == "Brief summary"

    def test_no_writer_output(self):
        state = NarrativeState(story_id="s1", chapter_number=1)
        ch = encode_chapter_from_state(state)
        assert ch.title == "Chương 1"
        assert ch.prose == ""


class TestEncodeSummaryForContext:
    def test_with_summary(self):
        ch = Chapter(
            story_id="s1", chapter_number=2,
            title="Khởi đầu", summary="MC meets mentor",
        )
        result = encode_summary_for_context(ch)
        assert "Chương 2" in result
        assert "Khởi đầu" in result
        assert "MC meets mentor" in result

    def test_with_choice(self):
        ch = Chapter(
            story_id="s1", chapter_number=1,
            title="Test", summary="Summary",
            chosen_choice=Choice(text="Go left"),
        )
        result = encode_summary_for_context(ch)
        assert "Go left" in result


class TestRollingSummary:
    def test_empty(self):
        assert build_rolling_summary([]) == ""

    def test_single_chapter(self):
        chapters = [
            Chapter(story_id="s1", chapter_number=1, title="Ch1", summary="First chapter"),
        ]
        result = build_rolling_summary(chapters)
        assert "Chương 1" in result

    def test_max_chapters_limit(self):
        chapters = [
            Chapter(story_id="s1", chapter_number=i, title=f"Ch{i}", summary=f"Summary {i}")
            for i in range(1, 10)
        ]
        result = build_rolling_summary(chapters, max_chapters=3)
        # Should only include last 3 chapters
        assert "Chương 9" in result
        assert "Chương 7" in result
        # Chapters earlier than the window should not appear in full detail
        assert "Summary 1" not in result

    def test_recent_chapters_get_full_treatment(self):
        chapters = [
            Chapter(story_id="s1", chapter_number=i, title=f"Ch{i}", summary=f"Summary {i}")
            for i in range(1, 4)
        ]
        result = build_rolling_summary(chapters, max_chapters=5)
        assert "Summary 3" in result
        assert "Summary 2" in result
