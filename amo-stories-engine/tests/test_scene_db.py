"""Tests for Scene CRUD operations in StoryStateDB."""

import pytest

from app.memory.state import StoryStateDB
from app.models.story import Chapter, Choice, Scene, Story


@pytest.fixture
def db(tmp_path):
    """Create a fresh in-memory-like DB."""
    db = StoryStateDB(tmp_path / "test.db")
    db.connect()
    yield db
    db.close()


@pytest.fixture
def story_and_chapter(db):
    """Create a story + chapter to attach scenes to."""
    story = Story(user_id="user1", title="Test Story")
    db.create_story(story)
    chapter = Chapter(story_id=story.id, number=1)
    chapter = db.save_chapter(chapter)
    return story, chapter


# ── save_scene + get_scene ──


def test_save_and_get_scene(db, story_and_chapter):
    _, chapter = story_and_chapter
    scene = Scene(
        chapter_id=chapter.id,
        scene_number=1,
        beat_index=0,
        title="Thức Tỉnh",
        prose="Devold mở mắt. Ánh sáng chói chang...",
        scene_type="discovery",
        tension=3,
        mood="mysterious",
        choices=[
            Choice(text="Đứng dậy", risk_level=1),
            Choice(text="Nằm im", risk_level=2),
            Choice(text="La hét", risk_level=4),
        ],
    )
    saved = db.save_scene(scene)
    assert saved.id == scene.id

    loaded = db.get_scene(scene.id)
    assert loaded is not None
    assert loaded.chapter_id == chapter.id
    assert loaded.scene_number == 1
    assert loaded.title == "Thức Tỉnh"
    assert loaded.prose == "Devold mở mắt. Ánh sáng chói chang..."
    assert loaded.scene_type == "discovery"
    assert loaded.tension == 3
    assert loaded.mood == "mysterious"
    assert len(loaded.choices) == 3
    assert loaded.choices[0].text == "Đứng dậy"
    assert loaded.is_chapter_end is False


def test_get_scene_not_found(db):
    assert db.get_scene("nonexistent") is None


# ── get_chapter_scenes ──


def test_get_chapter_scenes_ordered(db, story_and_chapter):
    _, chapter = story_and_chapter
    for i in range(1, 5):
        scene = Scene(
            chapter_id=chapter.id,
            scene_number=i,
            beat_index=i - 1,
            prose=f"Scene {i} content",
            scene_type="exploration" if i < 3 else "combat",
            tension=i * 2,
            is_chapter_end=(i == 4),
        )
        db.save_scene(scene)

    scenes = db.get_chapter_scenes(chapter.id)
    assert len(scenes) == 4
    assert [s.scene_number for s in scenes] == [1, 2, 3, 4]
    assert scenes[0].scene_type == "exploration"
    assert scenes[2].scene_type == "combat"
    assert scenes[3].is_chapter_end is True


def test_get_chapter_scenes_empty(db, story_and_chapter):
    _, chapter = story_and_chapter
    assert db.get_chapter_scenes(chapter.id) == []


# ── get_latest_scene ──


def test_get_latest_scene(db, story_and_chapter):
    _, chapter = story_and_chapter
    for i in range(1, 4):
        db.save_scene(Scene(
            chapter_id=chapter.id,
            scene_number=i,
            prose=f"Scene {i}",
        ))
    latest = db.get_latest_scene(chapter.id)
    assert latest is not None
    assert latest.scene_number == 3


def test_get_latest_scene_empty(db, story_and_chapter):
    _, chapter = story_and_chapter
    assert db.get_latest_scene(chapter.id) is None


# ── mark_scene_choice ──


def test_mark_scene_choice(db, story_and_chapter):
    _, chapter = story_and_chapter
    choices = [Choice(text="Option A"), Choice(text="Option B")]
    scene = Scene(
        chapter_id=chapter.id,
        scene_number=1,
        choices=choices,
    )
    db.save_scene(scene)

    db.mark_scene_choice(scene.id, choices[1].id)
    loaded = db.get_scene(scene.id)
    assert loaded.chosen_choice_id == choices[1].id


# ── total_scenes update ──


def test_total_scenes_updates_on_chapter(db, story_and_chapter):
    _, chapter = story_and_chapter
    for i in range(1, 4):
        db.save_scene(Scene(
            chapter_id=chapter.id,
            scene_number=i,
            prose=f"Scene {i}",
        ))
    reloaded = db.get_chapter(chapter.id)
    assert reloaded.total_scenes == 3


# ── Scene with identity_delta ──


def test_scene_identity_delta(db, story_and_chapter):
    _, chapter = story_and_chapter
    scene = Scene(
        chapter_id=chapter.id,
        scene_number=1,
        prose="Combat scene",
        scene_type="combat",
        identity_delta_json='{"dqs_change": +5, "flags": ["brave"]}',
        critic_score=8.5,
        rewrite_count=1,
    )
    db.save_scene(scene)
    loaded = db.get_scene(scene.id)
    assert loaded.identity_delta_json == '{"dqs_change": +5, "flags": ["brave"]}'
    assert loaded.critic_score == 8.5
    assert loaded.rewrite_count == 1


# ── Scene upsert ──


def test_scene_upsert(db, story_and_chapter):
    _, chapter = story_and_chapter
    scene = Scene(
        chapter_id=chapter.id,
        scene_number=1,
        prose="Original prose",
    )
    db.save_scene(scene)

    # Update same scene
    scene.prose = "Updated prose after rewrite"
    scene.rewrite_count = 1
    db.save_scene(scene)

    loaded = db.get_scene(scene.id)
    assert loaded.prose == "Updated prose after rewrite"
    assert loaded.rewrite_count == 1

    # Should still be 1 scene, not 2
    scenes = db.get_chapter_scenes(chapter.id)
    assert len(scenes) == 1
