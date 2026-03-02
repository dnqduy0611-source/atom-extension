"""Tests for chapter → scene migration script."""

import json
import pytest
from datetime import datetime, timezone

from app.memory.state import StoryStateDB
from app.migration.migrate_chapters_to_scenes import migrate_chapters_to_scenes
from app.models.story import Choice


@pytest.fixture
def db(tmp_path):
    """Create a fresh in-memory DB with schema."""
    db = StoryStateDB(tmp_path / "test.db")
    db.connect()
    yield db
    db.close()


def _insert_chapter(db, chapter_id, story_id="s1", number=1, prose="Once upon a time...",
                    choices=None, chosen_choice_id=None, critic_score=8.0):
    """Helper to insert a raw chapter row."""
    choices = choices or [{"id": "c1", "text": "Option A", "risk_level": 1, "consequence_hint": ""}]
    # First ensure story exists
    db.conn.execute(
        "INSERT OR IGNORE INTO stories (id, user_id) VALUES (?, ?)",
        (story_id, "test_user"),
    )
    db.conn.execute(
        """INSERT INTO chapters
           (id, story_id, number, prose, choices_json,
            chosen_choice_id, planner_outline, critic_score, rewrite_count,
            identity_delta_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            chapter_id, story_id, number, prose,
            json.dumps(choices),
            chosen_choice_id, "Outline", critic_score, 0,
            "{}", datetime.now(timezone.utc).isoformat(),
        ),
    )
    db.conn.commit()


def test_migrate_basic(db):
    """Should wrap a chapter as a single scene."""
    _insert_chapter(db, "ch_1")
    stats = migrate_chapters_to_scenes(db)

    assert stats["migrated"] == 1
    assert stats["skipped"] == 0
    assert stats["errors"] == 0

    # Verify scene was created
    scenes = db.get_chapter_scenes("ch_1")
    assert len(scenes) == 1
    s = scenes[0]
    assert s.scene_number == 1
    assert s.is_chapter_end is True
    assert s.scene_type == "exploration"
    assert s.prose == "Once upon a time..."
    assert len(s.choices) == 1


def test_migrate_idempotent(db):
    """Running migration twice should skip already-migrated chapters."""
    _insert_chapter(db, "ch_2")

    stats1 = migrate_chapters_to_scenes(db)
    assert stats1["migrated"] == 1

    stats2 = migrate_chapters_to_scenes(db)
    assert stats2["migrated"] == 0
    assert stats2["skipped"] == 1


def test_migrate_multiple_chapters(db):
    """Should handle multiple chapters across stories."""
    _insert_chapter(db, "ch_a", story_id="s1", number=1)
    _insert_chapter(db, "ch_b", story_id="s1", number=2)
    _insert_chapter(db, "ch_c", story_id="s2", number=1)

    stats = migrate_chapters_to_scenes(db)
    assert stats["migrated"] == 3

    # Each chapter should have exactly 1 scene
    assert len(db.get_chapter_scenes("ch_a")) == 1
    assert len(db.get_chapter_scenes("ch_b")) == 1
    assert len(db.get_chapter_scenes("ch_c")) == 1


def test_migrate_preserves_choices(db):
    """Migrated scene should preserve all original choices."""
    choices = [
        {"id": "c1", "text": "Fight", "risk_level": 3, "consequence_hint": "Danger!"},
        {"id": "c2", "text": "Flee", "risk_level": 1, "consequence_hint": "Safe"},
    ]
    _insert_chapter(db, "ch_3", choices=choices)
    migrate_chapters_to_scenes(db)

    scenes = db.get_chapter_scenes("ch_3")
    assert len(scenes[0].choices) == 2
    assert scenes[0].choices[0].text == "Fight"
    assert scenes[0].choices[1].risk_level == 1


def test_migrate_updates_total_scenes(db):
    """Chapter should have total_scenes = 1 after migration."""
    _insert_chapter(db, "ch_4")
    migrate_chapters_to_scenes(db)

    row = db.conn.execute(
        "SELECT total_scenes FROM chapters WHERE id = ?", ("ch_4",)
    ).fetchone()
    assert row[0] == 1


def test_migrate_empty_db(db):
    """Migration should handle empty database gracefully."""
    stats = migrate_chapters_to_scenes(db)
    assert stats["migrated"] == 0
    assert stats["skipped"] == 0
    assert stats["errors"] == 0
