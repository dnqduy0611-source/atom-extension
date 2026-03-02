"""Tests for scene_writer JSON parsing and SceneWriterInput validation."""

import pytest

from app.narrative.scene_writer import (
    _parse_scene_json,
    _extract_player_context,
    _extract_skill_info,
    SceneWriterInput,
)
from app.models.pipeline import Beat


# ── JSON Parsing ──


def test_parse_clean_json():
    raw = '{"scene_title": "Ánh Sáng", "prose": "Devold mở mắt.", "choices": [{"id": "c1", "text": "Chạy", "risk_level": 2, "consequence_hint": "Nhanh thôi"}]}'
    result = _parse_scene_json(raw)
    assert result["scene_title"] == "Ánh Sáng"
    assert result["prose"] == "Devold mở mắt."
    assert len(result["choices"]) == 1


def test_parse_markdown_fenced():
    raw = '```json\n{"scene_title": "Test", "prose": "Hello", "choices": []}\n```'
    result = _parse_scene_json(raw)
    assert result["scene_title"] == "Test"


def test_parse_with_newlines_in_prose():
    raw = '{"scene_title": "X", "prose": "Line 1\\nLine 2\\nLine 3", "choices": []}'
    result = _parse_scene_json(raw)
    assert "Line 1" in result["prose"]


def test_parse_unescaped_newlines():
    raw = '{"scene_title": "X", "prose": "Dòng 1\nDòng 2", "choices": []}'
    result = _parse_scene_json(raw)
    assert "Dòng 1" in result["prose"]


def test_parse_with_extra_text():
    raw = 'Here is the scene:\n{"scene_title": "Y", "prose": "Content", "choices": []}\nDone!'
    result = _parse_scene_json(raw)
    assert result["scene_title"] == "Y"


def test_parse_regex_fallback():
    raw = '{"scene_title": "Z", "prose": "Some broken JSON content'
    result = _parse_scene_json(raw)
    # Should have at least extracted scene_title via regex
    assert result.get("scene_title") == "Z" or result.get("prose", "") != ""


# ── Player Context Extraction ──


def test_extract_player_context_dict():
    player = {
        "current_identity": {
            "active_values": ["courage", "loyalty"],
            "active_traits": ["brave", "smart"],
            "current_motivation": "protect friends",
            "power_style": "tactical",
        }
    }
    result = _extract_player_context(player)
    assert "courage" in result["values"]
    assert "brave" in result["traits"]
    assert result["motivation"] == "protect friends"


def test_extract_player_context_none():
    result = _extract_player_context(None)
    assert result["values"] == "Chưa xác định"


# ── Skill Info Extraction ──


def test_extract_skill_info():
    skill = {
        "name": "Ý Chí Vượt Trội",
        "description": "Tăng cường ý chí",
        "mechanic": "Tập trung",
        "limitation": "Mệt mỏi sau khi dùng",
    }
    info = _extract_skill_info(skill)
    assert "Ý Chí Vượt Trội" in info
    assert "Mệt mỏi" in info


def test_extract_skill_info_none():
    assert _extract_skill_info(None) == "Chưa có skill"


# ── SceneWriterInput ──


def test_scene_writer_input_creation():
    beat = Beat(
        description="Phát hiện hang tối",
        tension=3,
        purpose="setup",
        scene_type="exploration",
    )
    input = SceneWriterInput(
        chapter_number=1,
        scene_number=1,
        total_scenes=4,
        beat=beat,
        all_beats=[beat],
        protagonist_name="Thiên Vũ",
        previous_scene_prose="",
        previous_scene_prose_2="",
        chosen_choice=None,
        is_chapter_end=False,
    )
    assert input.chapter_number == 1
    assert input.beat.scene_type == "exploration"
    assert input.is_chapter_end is False
