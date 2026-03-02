"""SQLite persistence for story state (stories + chapters + players).

This is separate from NeuralMemory — NeuralMemory handles the narrative
graph (characters, events, relationships), while this module handles
game-state CRUD (which story is active, chapter order, chosen choices,
player identity state).
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from app.models.story import Chapter, Choice, Scene, Story
from app.models.progression import PlayerProgression
from app.models.player import (
    CurrentIdentity,
    DNAAffinityTag,
    LatentIdentity,
    PlayerState,
    SeedIdentity,
    UniqueSkill,
)
from app.models.identity import (
    IdentityDelta,
    IdentityEvent,
    IdentityEventType,
    PlayerFlag,
)
from app.models.story_ledger import EstablishedFact, IntroducedEntity, StoryLedger
from app.models.world_state import WorldState


# ──────────────────────────────────────────────
# Schema
# ──────────────────────────────────────────────

_SCHEMA = """
CREATE TABLE IF NOT EXISTS stories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    preference_tags TEXT DEFAULT '[]',
    title TEXT NOT NULL DEFAULT '',
    backstory TEXT DEFAULT '',
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
    free_input TEXT DEFAULT '',
    planner_outline TEXT,
    critic_score REAL,
    rewrite_count INTEGER DEFAULT 0,
    identity_delta_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',

    -- Identity JSON blobs
    seed_identity_json TEXT NOT NULL DEFAULT '{}',
    current_identity_json TEXT DEFAULT '{}',
    latent_identity_json TEXT DEFAULT '{}',
    archetype TEXT DEFAULT '',
    dna_affinity_json TEXT DEFAULT '[]',

    -- Scores
    echo_trace REAL DEFAULT 100.0,
    identity_coherence REAL DEFAULT 100.0,
    instability REAL DEFAULT 0.0,
    decision_quality_score REAL DEFAULT 50.0,
    breakthrough_meter REAL DEFAULT 0.0,
    notoriety REAL DEFAULT 0.0,
    pity_counter INTEGER DEFAULT 0,

    -- Progress
    total_chapters INTEGER DEFAULT 0,
    fate_buffer REAL DEFAULT 100.0,
    alignment REAL DEFAULT 0.0,
    turns_today INTEGER DEFAULT 0,
    turns_reset_date TEXT DEFAULT '',

    -- Unique Skill
    unique_skill_json TEXT DEFAULT NULL,

    -- Progression (skill usage, rank tracking, evolution counters)
    progression_json TEXT DEFAULT '{}',

    -- Meta
    brain_id TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS player_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    flag_key TEXT NOT NULL,
    flag_value TEXT DEFAULT '',
    chapter_number INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(player_id, flag_key)
);

CREATE TABLE IF NOT EXISTS identity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    event_type TEXT NOT NULL,
    chapter_number INTEGER DEFAULT 0,
    description TEXT DEFAULT '',
    before_json TEXT DEFAULT '{}',
    after_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chapters_story ON chapters(story_id, number);
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_players_user ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_player_flags ON player_flags(player_id);
CREATE INDEX IF NOT EXISTS idx_identity_events ON identity_events(player_id, event_type);

CREATE TABLE IF NOT EXISTS scenes (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id),
    scene_number INTEGER NOT NULL,
    beat_index INTEGER DEFAULT 0,

    -- Content
    title TEXT DEFAULT '',
    prose TEXT NOT NULL DEFAULT '',

    -- Player action
    choices_json TEXT DEFAULT '[]',
    scene_type TEXT DEFAULT 'exploration',
    chosen_choice_id TEXT DEFAULT NULL,
    free_input TEXT DEFAULT '',

    -- Metadata
    is_chapter_end INTEGER DEFAULT 0,
    tension INTEGER DEFAULT 5,
    mood TEXT DEFAULT 'neutral',

    -- Pipeline
    critic_score REAL,
    critic_feedback TEXT DEFAULT '',
    rewrite_count INTEGER DEFAULT 0,
    identity_delta_json TEXT DEFAULT '{}',

    created_at TEXT DEFAULT (datetime('now')),

    UNIQUE(chapter_id, scene_number)
);

CREATE INDEX IF NOT EXISTS idx_scenes_chapter ON scenes(chapter_id, scene_number);

CREATE TABLE IF NOT EXISTS story_ledger (
    story_id    TEXT PRIMARY KEY,
    ledger_json TEXT NOT NULL DEFAULT '{}',
    chapter     INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS world_state (
    story_id    TEXT PRIMARY KEY,
    state_json  TEXT NOT NULL DEFAULT '{}',
    chapter     INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companions (
    id                      TEXT PRIMARY KEY,
    story_id                TEXT NOT NULL,
    name                    TEXT NOT NULL,
    gender                  TEXT DEFAULT 'neutral',
    role                    TEXT DEFAULT 'fighter',
    personality_core        TEXT DEFAULT '',
    appearance_anchor       TEXT DEFAULT '',
    backstory_surface       TEXT DEFAULT '',
    backstory_hidden        TEXT DEFAULT '',
    secret                  TEXT DEFAULT '',
    secret_reveal_trigger   TEXT DEFAULT '',
    companion_archetype_type TEXT DEFAULT '',
    first_appeared_chapter  INTEGER DEFAULT 1,
    status                  TEXT DEFAULT 'active',
    departure_reason        TEXT DEFAULT '',
    affinity                INTEGER DEFAULT 20,
    affinity_tier           TEXT DEFAULT 'acquaintance',
    ability_json            TEXT DEFAULT '{}',
    affinity_history_json   TEXT DEFAULT '[]',
    notable_quotes_json     TEXT DEFAULT '[]',
    last_emotional_state    TEXT DEFAULT 'neutral',
    response_to_player_male TEXT DEFAULT '',
    response_to_player_female TEXT DEFAULT '',
    created_at              TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (story_id) REFERENCES stories(id)
);

CREATE INDEX IF NOT EXISTS idx_companions_story ON companions(story_id, status);
"""


# ──────────────────────────────────────────────
# StoryStateDB
# ──────────────────────────────────────────────

class StoryStateDB:
    """SQLite-backed CRUD for story, chapter, and player persistence."""

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
        # Migration: add unique_skill_json column if missing
        cols = {r[1] for r in self._conn.execute("PRAGMA table_info(players)").fetchall()}
        if "unique_skill_json" not in cols:
            self._conn.execute("ALTER TABLE players ADD COLUMN unique_skill_json TEXT DEFAULT NULL")
            self._conn.commit()
        # Migration: add planner_output_json and total_scenes to chapters
        ch_cols = {r[1] for r in self._conn.execute("PRAGMA table_info(chapters)").fetchall()}
        if "planner_output_json" not in ch_cols:
            self._conn.execute("ALTER TABLE chapters ADD COLUMN planner_output_json TEXT DEFAULT '{}'")
            self._conn.commit()
        if "total_scenes" not in ch_cols:
            self._conn.execute("ALTER TABLE chapters ADD COLUMN total_scenes INTEGER DEFAULT 0")
            self._conn.commit()
        # Migration: add progression_json to players
        if "progression_json" not in cols:
            self._conn.execute("ALTER TABLE players ADD COLUMN progression_json TEXT DEFAULT '{}'")
            self._conn.commit()
        # Migration: add critic_feedback to scenes
        sc_cols = {r[1] for r in self._conn.execute("PRAGMA table_info(scenes)").fetchall()}
        if "critic_feedback" not in sc_cols:
            self._conn.execute("ALTER TABLE scenes ADD COLUMN critic_feedback TEXT DEFAULT ''")
            self._conn.commit()
        # Migration: story_ledger — recreate without FK if created with REFERENCES stories(id)
        ledger_meta = self._conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='story_ledger'"
        ).fetchone()
        if ledger_meta and "REFERENCES" in (ledger_meta["sql"] or ""):
            self._conn.executescript("""
                ALTER TABLE story_ledger RENAME TO story_ledger_old;
                CREATE TABLE story_ledger (
                    story_id    TEXT PRIMARY KEY,
                    ledger_json TEXT NOT NULL DEFAULT '{}',
                    chapter     INTEGER NOT NULL DEFAULT 0,
                    updated_at  TEXT DEFAULT (datetime('now'))
                );
                INSERT INTO story_ledger SELECT * FROM story_ledger_old;
                DROP TABLE story_ledger_old;
            """)
            self._conn.commit()
        # Migration: world_state table (created by _SCHEMA if not exists — idempotent)
        # No ALTER needed — new table, no legacy rows to migrate.

        # Migration: companions table (idempotent via CREATE IF NOT EXISTS in schema)
        # Add any new columns that may not exist in older DBs
        comp_cols = {r[1] for r in self._conn.execute("PRAGMA table_info(companions)").fetchall()}
        if "companion_archetype_type" not in comp_cols and comp_cols:
            self._conn.execute(
                "ALTER TABLE companions ADD COLUMN companion_archetype_type TEXT DEFAULT ''"
            )
            self._conn.commit()

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

    # ══════════════════════════════════════════
    # Stories
    # ══════════════════════════════════════════

    def create_story(self, story: Story) -> Story:
        self.conn.execute(
            """INSERT INTO stories (id, user_id, preference_tags, title, backstory,
               protagonist_name, chapter_count, is_active, brain_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                story.id,
                story.user_id,
                json.dumps(story.preference_tags, ensure_ascii=False),
                story.title,
                story.backstory,
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

    # ══════════════════════════════════════════
    # Chapters
    # ══════════════════════════════════════════

    def save_chapter(self, chapter: Chapter) -> Chapter:
        choices_json = json.dumps(
            [c.model_dump() for c in chapter.choices], ensure_ascii=False
        )
        self.conn.execute(
            """INSERT OR REPLACE INTO chapters
               (id, story_id, number, prose, choices_json, chosen_choice_id,
                free_input, planner_outline, planner_output_json, total_scenes,
                critic_score, rewrite_count,
                identity_delta_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                chapter.id,
                chapter.story_id,
                chapter.number,
                chapter.prose,
                choices_json,
                chapter.chosen_choice_id,
                getattr(chapter, "free_input", ""),
                chapter.planner_outline,
                chapter.planner_output_json or "{}",
                chapter.total_scenes or 0,
                chapter.critic_score,
                chapter.rewrite_count,
                getattr(chapter, "identity_delta_json", "{}"),
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

    # ══════════════════════════════════════════
    # Scenes
    # ══════════════════════════════════════════

    def save_scene(self, scene: Scene) -> Scene:
        """Insert or update a scene."""
        choices_json = json.dumps(
            [c.model_dump() for c in scene.choices], ensure_ascii=False
        )
        self.conn.execute(
            """INSERT OR REPLACE INTO scenes
               (id, chapter_id, scene_number, beat_index,
                title, prose, choices_json, scene_type,
                chosen_choice_id, free_input,
                is_chapter_end, tension, mood,
                critic_score, critic_feedback, rewrite_count, identity_delta_json,
                created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                scene.id,
                scene.chapter_id,
                scene.scene_number,
                scene.beat_index,
                scene.title,
                scene.prose,
                choices_json,
                scene.scene_type,
                scene.chosen_choice_id,
                scene.free_input,
                int(scene.is_chapter_end),
                scene.tension,
                scene.mood,
                scene.critic_score,
                scene.critic_feedback,
                scene.rewrite_count,
                scene.identity_delta_json,
                scene.created_at.isoformat(),
            ),
        )
        self.conn.commit()

        # Update chapter total_scenes count
        self.conn.execute(
            """UPDATE chapters SET total_scenes = (
                SELECT COUNT(*) FROM scenes WHERE chapter_id = ?
            ) WHERE id = ?""",
            (scene.chapter_id, scene.chapter_id),
        )
        self.conn.commit()
        return scene

    def get_scene(self, scene_id: str) -> Scene | None:
        """Get a scene by its ID."""
        row = self.conn.execute(
            "SELECT * FROM scenes WHERE id = ?", (scene_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_scene(row)

    def get_chapter_scenes(self, chapter_id: str) -> list[Scene]:
        """Get all scenes for a chapter, ordered by scene_number."""
        rows = self.conn.execute(
            "SELECT * FROM scenes WHERE chapter_id = ? ORDER BY scene_number ASC",
            (chapter_id,),
        ).fetchall()
        return [self._row_to_scene(r) for r in rows]

    def get_latest_scene(self, chapter_id: str) -> Scene | None:
        """Get the latest scene in a chapter."""
        row = self.conn.execute(
            "SELECT * FROM scenes WHERE chapter_id = ? ORDER BY scene_number DESC LIMIT 1",
            (chapter_id,),
        ).fetchone()
        if not row:
            return None
        return self._row_to_scene(row)

    def mark_scene_choice(self, scene_id: str, choice_id: str) -> None:
        """Mark the chosen choice for a scene."""
        self.conn.execute(
            "UPDATE scenes SET chosen_choice_id = ? WHERE id = ?",
            (choice_id, scene_id),
        )
        self.conn.commit()

    # ══════════════════════════════════════════
    # Players
    # ══════════════════════════════════════════

    def create_player(self, player: PlayerState) -> PlayerState:
        """Create a new player record."""
        self.conn.execute(
            """INSERT INTO players
               (id, user_id, name, seed_identity_json, current_identity_json,
                latent_identity_json, archetype, dna_affinity_json,
                unique_skill_json, progression_json,
                echo_trace, identity_coherence, instability,
                decision_quality_score, breakthrough_meter, notoriety,
                pity_counter, total_chapters, fate_buffer, alignment,
                turns_today, turns_reset_date, brain_id, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                player.id,
                player.user_id,
                player.name,
                player.seed_identity.model_dump_json(),
                player.current_identity.model_dump_json(),
                player.latent_identity.model_dump_json(),
                player.archetype,
                json.dumps([t.value for t in player.dna_affinity]),
                player.unique_skill.model_dump_json() if player.unique_skill else None,
                player.progression.model_dump_json(),
                player.echo_trace,
                player.identity_coherence,
                player.instability,
                player.decision_quality_score,
                player.breakthrough_meter,
                player.notoriety,
                player.pity_counter,
                player.total_chapters,
                player.fate_buffer,
                player.alignment,
                player.turns_today,
                player.turns_reset_date,
                player.brain_id,
                player.created_at.isoformat(),
                player.updated_at.isoformat(),
            ),
        )
        self.conn.commit()
        return player

    def get_player(self, player_id: str) -> PlayerState | None:
        """Get player by player ID."""
        row = self.conn.execute(
            "SELECT * FROM players WHERE id = ?", (player_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_player(row)

    def get_player_by_user(self, user_id: str) -> PlayerState | None:
        """Get player by external user ID."""
        row = self.conn.execute(
            "SELECT * FROM players WHERE user_id = ?", (user_id,)
        ).fetchone()
        if not row:
            return None
        return self._row_to_player(row)

    def update_player(self, player: PlayerState) -> None:
        """Full update of player state."""
        self.conn.execute(
            """UPDATE players SET
                name = ?, current_identity_json = ?, latent_identity_json = ?,
                archetype = ?, unique_skill_json = ?, progression_json = ?,
                echo_trace = ?, identity_coherence = ?,
                instability = ?, decision_quality_score = ?,
                breakthrough_meter = ?, notoriety = ?, pity_counter = ?,
                total_chapters = ?, fate_buffer = ?, alignment = ?,
                turns_today = ?, turns_reset_date = ?, brain_id = ?,
                updated_at = ?
               WHERE id = ?""",
            (
                player.name,
                player.current_identity.model_dump_json(),
                player.latent_identity.model_dump_json(),
                player.archetype,
                player.unique_skill.model_dump_json() if player.unique_skill else None,
                player.progression.model_dump_json(),
                player.echo_trace,
                player.identity_coherence,
                player.instability,
                player.decision_quality_score,
                player.breakthrough_meter,
                player.notoriety,
                player.pity_counter,
                player.total_chapters,
                player.fate_buffer,
                player.alignment,
                player.turns_today,
                player.turns_reset_date,
                player.brain_id,
                player.updated_at.isoformat(),
                player.id,
            ),
        )
        self.conn.commit()

    def reset_daily_turns(self, player_id: str, today: str) -> None:
        """Reset daily turn counter."""
        self.conn.execute(
            "UPDATE players SET turns_today = 0, turns_reset_date = ? WHERE id = ?",
            (today, player_id),
        )
        self.conn.commit()

    def increment_turns(self, player_id: str) -> None:
        """Increment daily turn counter."""
        self.conn.execute(
            "UPDATE players SET turns_today = turns_today + 1 WHERE id = ?",
            (player_id,),
        )
        self.conn.commit()

    # ══════════════════════════════════════════
    # Player Flags
    # ══════════════════════════════════════════

    def set_flag(self, flag: PlayerFlag) -> None:
        """Set a player flag (upsert)."""
        self.conn.execute(
            """INSERT OR REPLACE INTO player_flags
               (player_id, flag_key, flag_value, chapter_number)
               VALUES (?, ?, ?, ?)""",
            (flag.player_id, flag.flag_key, flag.flag_value, flag.chapter_number),
        )
        self.conn.commit()

    def get_flags(self, player_id: str) -> list[PlayerFlag]:
        """Get all flags for a player."""
        rows = self.conn.execute(
            "SELECT * FROM player_flags WHERE player_id = ? ORDER BY created_at",
            (player_id,),
        ).fetchall()
        return [
            PlayerFlag(
                id=r["id"],
                player_id=r["player_id"],
                flag_key=r["flag_key"],
                flag_value=r["flag_value"],
                chapter_number=r["chapter_number"],
                created_at=r["created_at"],
            )
            for r in rows
        ]

    def set_player_flag(
        self, player_id: str, flag_key: str, chapter_number: int = 0, flag_value: str = ""
    ) -> None:
        """Set or update a player flag."""
        self.conn.execute(
            """INSERT OR REPLACE INTO player_flags
               (player_id, flag_key, flag_value, chapter_number)
               VALUES (?, ?, ?, ?)""",
            (player_id, flag_key, flag_value, chapter_number),
        )
        self.conn.commit()

    def has_flag(self, player_id: str, flag_key: str) -> bool:
        """Check if a player has a specific flag."""
        row = self.conn.execute(
            "SELECT 1 FROM player_flags WHERE player_id = ? AND flag_key = ?",
            (player_id, flag_key),
        ).fetchone()
        return row is not None

    # ══════════════════════════════════════════
    # Identity Events
    # ══════════════════════════════════════════

    def log_identity_event(self, event: IdentityEvent) -> None:
        """Log an identity event."""
        self.conn.execute(
            """INSERT INTO identity_events
               (player_id, event_type, chapter_number, description,
                before_json, after_json)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                event.player_id,
                event.event_type.value,
                event.chapter_number,
                event.description,
                json.dumps(event.before_snapshot, ensure_ascii=False),
                json.dumps(event.after_snapshot, ensure_ascii=False),
            ),
        )
        self.conn.commit()

    def get_identity_events(
        self,
        player_id: str,
        event_type: IdentityEventType | None = None,
        limit: int = 50,
    ) -> list[IdentityEvent]:
        """Get identity events for a player."""
        query = "SELECT * FROM identity_events WHERE player_id = ?"
        params: list = [player_id]
        if event_type:
            query += " AND event_type = ?"
            params.append(event_type.value)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        rows = self.conn.execute(query, params).fetchall()
        return [
            IdentityEvent(
                id=r["id"],
                player_id=r["player_id"],
                event_type=IdentityEventType(r["event_type"]),
                chapter_number=r["chapter_number"],
                description=r["description"],
                before_snapshot=json.loads(r["before_json"] or "{}"),
                after_snapshot=json.loads(r["after_json"] or "{}"),
                created_at=r["created_at"],
            )
            for r in rows
        ]

    # ══════════════════════════════════════════
    # Soul Forge Helpers
    # ══════════════════════════════════════════

    def get_all_skill_names(self) -> list[str]:
        """Return all existing unique skill names from players table."""
        rows = self.conn.execute(
            "SELECT unique_skill_json FROM players WHERE unique_skill_json IS NOT NULL"
        ).fetchall()
        names: list[str] = []
        for r in rows:
            try:
                skill = json.loads(r["unique_skill_json"] or "{}")
                name = skill.get("name", "")
                if name:
                    names.append(name)
            except (json.JSONDecodeError, AttributeError):
                continue
        return names

    # ══════════════════════════════════════════
    # Story Ledger
    # ══════════════════════════════════════════

    def get_story_ledger(self, story_id: str) -> StoryLedger:
        """Load Story Ledger for a story. Returns empty ledger if none exists."""
        row = self.conn.execute(
            "SELECT ledger_json, chapter FROM story_ledger WHERE story_id = ?",
            (story_id,),
        ).fetchone()
        if not row:
            return StoryLedger(story_id=story_id)
        try:
            data = json.loads(row["ledger_json"] or "{}")
            ledger = StoryLedger(story_id=story_id, **data)
            ledger.last_updated_chapter = row["chapter"] or 0
            return ledger
        except Exception:
            return StoryLedger(story_id=story_id)

    def save_story_ledger(self, ledger: StoryLedger) -> None:
        """Upsert Story Ledger."""
        payload = {
            "introduced_entities": [e.model_dump() for e in ledger.introduced_entities],
            "established_facts": [f.model_dump() for f in ledger.established_facts],
        }
        self.conn.execute(
            """INSERT INTO story_ledger (story_id, ledger_json, chapter, updated_at)
               VALUES (?, ?, ?, datetime('now'))
               ON CONFLICT(story_id) DO UPDATE SET
                   ledger_json = excluded.ledger_json,
                   chapter = excluded.chapter,
                   updated_at = excluded.updated_at""",
            (ledger.story_id, json.dumps(payload, ensure_ascii=False), ledger.last_updated_chapter),
        )
        self.conn.commit()

    # ══════════════════════════════════════════
    # World State
    # ══════════════════════════════════════════

    def get_world_state(self, story_id: str) -> WorldState:
        """Load WorldState for a story. Returns fresh default if none exists."""
        row = self.conn.execute(
            "SELECT state_json, chapter FROM world_state WHERE story_id = ?",
            (story_id,),
        ).fetchone()
        if not row:
            return WorldState()
        try:
            data = json.loads(row["state_json"] or "{}")
            return WorldState.model_validate(data)
        except Exception:
            return WorldState()

    def save_world_state(self, story_id: str, world_state: WorldState, chapter: int = 0) -> None:
        """Upsert WorldState for a story."""
        payload = world_state.model_dump_json()
        self.conn.execute(
            """INSERT INTO world_state (story_id, state_json, chapter, updated_at)
               VALUES (?, ?, ?, datetime('now'))
               ON CONFLICT(story_id) DO UPDATE SET
                   state_json = excluded.state_json,
                   chapter = excluded.chapter,
                   updated_at = excluded.updated_at""",
            (story_id, payload, chapter),
        )
        self.conn.commit()

    # ══════════════════════════════════════════
    # Companions
    # ══════════════════════════════════════════

    def save_companion(self, companion) -> None:
        """Upsert a CompanionProfile. Delegates to companion_store."""
        from app.memory.companion_store import save_companion as _save
        _save(self, companion)

    def get_story_companions(self, story_id: str, active_only: bool = True) -> list:
        """Load companions for a story. Delegates to companion_store."""
        from app.memory.companion_store import get_story_companions as _get
        return _get(self, story_id, active_only=active_only)

    def get_companion(self, companion_id: str):
        """Load a single companion by id. Delegates to companion_store."""
        from app.memory.companion_store import get_companion as _get
        return _get(self, companion_id)

    # ══════════════════════════════════════════
    # Delete
    # ══════════════════════════════════════════

    def delete_story(self, story_id: str) -> None:
        self.conn.execute("DELETE FROM companions WHERE story_id = ?", (story_id,))
        self.conn.execute("DELETE FROM chapters WHERE story_id = ?", (story_id,))
        self.conn.execute("DELETE FROM stories WHERE id = ?", (story_id,))
        self.conn.commit()

    def delete_player(self, player_id: str) -> None:
        """Delete player and all associated data."""
        self.conn.execute("DELETE FROM identity_events WHERE player_id = ?", (player_id,))
        self.conn.execute("DELETE FROM player_flags WHERE player_id = ?", (player_id,))
        self.conn.execute("DELETE FROM players WHERE id = ?", (player_id,))
        self.conn.commit()

    # ══════════════════════════════════════════
    # Row Mappers
    # ══════════════════════════════════════════

    @staticmethod
    def _row_to_story(row: sqlite3.Row) -> Story:
        tags_raw = json.loads(row["preference_tags"] or "[]")
        return Story(
            id=row["id"],
            user_id=row["user_id"],
            preference_tags=tags_raw if isinstance(tags_raw, list) else [],
            title=row["title"] or "",
            backstory=row["backstory"] or "",
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
        # Handle optional new columns gracefully
        planner_output_json = row["planner_output_json"] if "planner_output_json" in row.keys() else "{}"
        total_scenes = row["total_scenes"] if "total_scenes" in row.keys() else 0
        return Chapter(
            id=row["id"],
            story_id=row["story_id"],
            number=row["number"],
            prose=row["prose"] or "",
            choices=choices,
            chosen_choice_id=row["chosen_choice_id"],
            planner_outline=row["planner_outline"],
            planner_output_json=planner_output_json or "{}",
            total_scenes=total_scenes or 0,
            critic_score=row["critic_score"],
            rewrite_count=row["rewrite_count"] or 0,
            created_at=row["created_at"],
        )

    @staticmethod
    def _row_to_scene(row: sqlite3.Row) -> Scene:
        choices_raw = json.loads(row["choices_json"] or "[]")
        choices = [Choice(**c) for c in choices_raw]
        return Scene(
            id=row["id"],
            chapter_id=row["chapter_id"],
            scene_number=row["scene_number"],
            beat_index=row["beat_index"] or 0,
            title=row["title"] or "",
            prose=row["prose"] or "",
            choices=choices,
            scene_type=row["scene_type"] or "exploration",
            chosen_choice_id=row["chosen_choice_id"],
            free_input=row["free_input"] or "",
            is_chapter_end=bool(row["is_chapter_end"]),
            tension=row["tension"] or 5,
            mood=row["mood"] or "neutral",
            critic_score=row["critic_score"],
            critic_feedback=row["critic_feedback"] if "critic_feedback" in row.keys() else "",
            rewrite_count=row["rewrite_count"] or 0,
            identity_delta_json=row["identity_delta_json"] or "",
            created_at=row["created_at"],
        )

    @staticmethod
    def _row_to_player(row: sqlite3.Row) -> PlayerState:
        seed_raw = json.loads(row["seed_identity_json"] or "{}")
        current_raw = json.loads(row["current_identity_json"] or "{}")
        latent_raw = json.loads(row["latent_identity_json"] or "{}")
        dna_raw = json.loads(row["dna_affinity_json"] or "[]")

        # Parse unique_skill
        skill = None
        skill_json = row["unique_skill_json"] if "unique_skill_json" in row.keys() else None
        if skill_json:
            try:
                skill = UniqueSkill(**json.loads(skill_json))
            except Exception:
                skill = None

        # Parse progression
        progression = PlayerProgression()
        prog_json = row["progression_json"] if "progression_json" in row.keys() else None
        if prog_json:
            try:
                progression = PlayerProgression(**json.loads(prog_json))
            except Exception:
                progression = PlayerProgression()

        return PlayerState(
            id=row["id"],
            user_id=row["user_id"],
            name=row["name"] or "",
            seed_identity=SeedIdentity(**seed_raw) if seed_raw else SeedIdentity(),
            current_identity=CurrentIdentity(**current_raw) if current_raw else CurrentIdentity(),
            latent_identity=LatentIdentity(**latent_raw) if latent_raw else LatentIdentity(),
            archetype=row["archetype"] or "",
            dna_affinity=[DNAAffinityTag(t) for t in dna_raw if t in DNAAffinityTag.__members__.values()],
            unique_skill=skill,
            progression=progression,
            echo_trace=row["echo_trace"] or 100.0,
            identity_coherence=row["identity_coherence"] or 100.0,
            instability=row["instability"] or 0.0,
            decision_quality_score=row["decision_quality_score"] or 50.0,
            breakthrough_meter=row["breakthrough_meter"] or 0.0,
            notoriety=row["notoriety"] or 0.0,
            pity_counter=row["pity_counter"] or 0,
            total_chapters=row["total_chapters"] or 0,
            fate_buffer=row["fate_buffer"] or 100.0,
            alignment=row["alignment"] or 0.0,
            turns_today=row["turns_today"] or 0,
            turns_reset_date=row["turns_reset_date"] or "",
            brain_id=row["brain_id"] or "",
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

