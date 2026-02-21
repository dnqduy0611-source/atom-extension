"""SQLite persistence for story state (stories + chapters).

This is separate from NeuralMemory — NeuralMemory handles the narrative
graph (characters, events, relationships), while this module handles
game-state CRUD (which story is active, chapter order, chosen choices).
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from app.models.story import Chapter, Choice, Genre, Story


# ──────────────────────────────────────────────
# Schema
# ──────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    genre TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    world_desc TEXT DEFAULT '',
    protagonist_name TEXT DEFAULT '',
    chapter_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    brain_id TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    story_id TEXT NOT NULL REFERENCES stories(id),
    number INTEGER NOT NULL,
    prose TEXT NOT NULL DEFAULT '',
    choices_json TEXT DEFAULT '[]',
    chosen_choice_id TEXT,
    planner_outline TEXT,
    critic_score REAL,
    rewrite_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chapters_story ON chapters(story_id, number);
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, is_active);
"""


# ──────────────────────────────────────────────
# StoryStateDB
# ──────────────────────────────────────────────

class StoryStateDB:
    """SQLite-backed CRUD for story and chapter persistence."""

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = str(db_path)
        self._conn: sqlite3.Connection | None = None

    # ── Connection ──

    def connect(self) -> None:
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.executescript(_SCHEMA)

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self.connect()
        assert self._conn is not None
        return self._conn

    # ── Stories ──

    def create_story(self, story: Story) -> Story:
        self.conn.execute(
            """INSERT INTO stories (id, user_id, genre, title, world_desc,
               protagonist_name, chapter_count, is_active, brain_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                story.id,
                story.user_id,
                story.genre.value,
                story.title,
                story.world_desc,
                story.protagonist_name,
                story.chapter_count,
                int(story.is_active),
                story.brain_id,
                story.created_at.isoformat(),
            ),
        )
        self.conn.commit()
        return story

    def get_story(self, story_id: str) -> Story | None:
        row = self.conn.execute(
            "SELECT * FROM stories WHERE id = ?", (story_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_story(row)

    def get_user_stories(self, user_id: str, active_only: bool = True) -> list[Story]:
        query = "SELECT * FROM stories WHERE user_id = ?"
        params: list = [user_id]
        if active_only:
            query += " AND is_active = 1"
        query += " ORDER BY created_at DESC"
        rows = self.conn.execute(query, params).fetchall()
        return [self._row_to_story(r) for r in rows]

    def update_story(self, story_id: str, **kwargs: object) -> None:
        allowed = {"title", "chapter_count", "is_active", "brain_id"}
        parts, vals = [], []
        for k, v in kwargs.items():
            if k not in allowed:
                continue
            parts.append(f"{k} = ?")
            vals.append(int(v) if isinstance(v, bool) else v)
        if not parts:
            return
        vals.append(story_id)
        self.conn.execute(
            f"UPDATE stories SET {', '.join(parts)} WHERE id = ?", vals  # noqa: S608
        )
        self.conn.commit()

    # ── Chapters ──

    def save_chapter(self, chapter: Chapter) -> Chapter:
        choices_json = json.dumps(
            [c.model_dump() for c in chapter.choices], ensure_ascii=False
        )
        self.conn.execute(
            """INSERT OR REPLACE INTO chapters
               (id, story_id, number, prose, choices_json, chosen_choice_id,
                planner_outline, critic_score, rewrite_count, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                chapter.id,
                chapter.story_id,
                chapter.number,
                chapter.prose,
                choices_json,
                chapter.chosen_choice_id,
                chapter.planner_outline,
                chapter.critic_score,
                chapter.rewrite_count,
                chapter.created_at.isoformat(),
            ),
        )
        self.conn.commit()

        # Update story chapter count
        self.conn.execute(
            """UPDATE stories SET chapter_count = (
                SELECT COUNT(*) FROM chapters WHERE story_id = ?
            ) WHERE id = ?""",
            (chapter.story_id, chapter.story_id),
        )
        self.conn.commit()
        return chapter

    def get_chapter(self, chapter_id: str) -> Chapter | None:
        row = self.conn.execute(
            "SELECT * FROM chapters WHERE id = ?", (chapter_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_chapter(row)

    def get_story_chapters(self, story_id: str) -> list[Chapter]:
        rows = self.conn.execute(
            "SELECT * FROM chapters WHERE story_id = ? ORDER BY number ASC",
            (story_id,),
        ).fetchall()
        return [self._row_to_chapter(r) for r in rows]

    def get_latest_chapter(self, story_id: str) -> Chapter | None:
        row = self.conn.execute(
            "SELECT * FROM chapters WHERE story_id = ? ORDER BY number DESC LIMIT 1",
            (story_id,),
        ).fetchone()
        if not row:
            return None
        return self._row_to_chapter(row)

    def mark_choice(self, chapter_id: str, choice_id: str) -> None:
        self.conn.execute(
            "UPDATE chapters SET chosen_choice_id = ? WHERE id = ?",
            (choice_id, chapter_id),
        )
        self.conn.commit()

    # ── Delete ──

    def delete_story(self, story_id: str) -> None:
        self.conn.execute("DELETE FROM chapters WHERE story_id = ?", (story_id,))
        self.conn.execute("DELETE FROM stories WHERE id = ?", (story_id,))
        self.conn.commit()

    # ── Row Mappers ──

    @staticmethod
    def _row_to_story(row: sqlite3.Row) -> Story:
        return Story(
            id=row["id"],
            user_id=row["user_id"],
            genre=Genre(row["genre"]),
            title=row["title"] or "",
            world_desc=row["world_desc"] or "",
            protagonist_name=row["protagonist_name"] or "",
            chapter_count=row["chapter_count"] or 0,
            is_active=bool(row["is_active"]),
            brain_id=row["brain_id"] or "",
            created_at=row["created_at"],
        )

    @staticmethod
    def _row_to_chapter(row: sqlite3.Row) -> Chapter:
        choices_raw = json.loads(row["choices_json"] or "[]")
        choices = [Choice(**c) for c in choices_raw]
        return Chapter(
            id=row["id"],
            story_id=row["story_id"],
            number=row["number"],
            prose=row["prose"] or "",
            choices=choices,
            chosen_choice_id=row["chosen_choice_id"],
            planner_outline=row["planner_outline"],
            critic_score=row["critic_score"],
            rewrite_count=row["rewrite_count"] or 0,
            created_at=row["created_at"],
        )
