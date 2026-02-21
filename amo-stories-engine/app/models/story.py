"""Amo Stories — Data models for story, chapters, choices, and genres."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _short_id() -> str:
    return uuid4().hex[:12]


def _choice_id() -> str:
    return uuid4().hex[:8]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ──────────────────────────────────────────────
# Genre
# ──────────────────────────────────────────────

class Genre(str, Enum):
    TIEN_HIEP = "tien_hiep"
    HUYEN_HUYEN = "huyen_huyen"
    VO_HIEP = "vo_hiep"
    ROMANCE = "romance"
    ANIME = "anime"
    HORROR = "horror"
    DO_THI = "do_thi"
    SCI_FI = "sci_fi"
    FANTASY = "fantasy"

    @property
    def display_name(self) -> str:
        names = {
            "tien_hiep": "Tiên Hiệp",
            "huyen_huyen": "Huyền Huyễn",
            "vo_hiep": "Võ Hiệp",
            "romance": "Romance",
            "anime": "Anime",
            "horror": "Horror",
            "do_thi": "Đô Thị",
            "sci_fi": "Sci-Fi",
            "fantasy": "Fantasy",
        }
        return names.get(self.value, self.value)


# ──────────────────────────────────────────────
# Core Models
# ──────────────────────────────────────────────

class Choice(BaseModel):
    """A single choice presented to the player at the end of a chapter."""

    id: str = Field(default_factory=_choice_id)
    text: str                           # Display text: "Bước vào hang động bí ẩn"
    consequence_hint: str = ""          # Internal hint for planner (hidden from player)
    risk_level: int = Field(default=1, ge=1, le=5)


class Chapter(BaseModel):
    """A single chapter in a story."""

    id: str = Field(default_factory=_short_id)
    story_id: str
    number: int
    prose: str = ""                     # Full chapter text (1000-3000 words)
    choices: list[Choice] = Field(default_factory=list)
    chosen_choice_id: str | None = None

    # Pipeline metadata
    planner_outline: str | None = None
    critic_score: float | None = None
    rewrite_count: int = 0
    created_at: datetime = Field(default_factory=_utcnow)


class Story(BaseModel):
    """Top-level story container."""

    id: str = Field(default_factory=_short_id)
    user_id: str
    genre: Genre
    title: str = ""                     # AI-generated title
    world_desc: str = ""                # User's world description
    protagonist_name: str = ""          # Optional, AI generates if empty
    chapter_count: int = 0
    is_active: bool = True
    brain_id: str = ""                  # NeuralMemory brain ID
    created_at: datetime = Field(default_factory=_utcnow)


# ──────────────────────────────────────────────
# API Request / Response Models
# ──────────────────────────────────────────────

class StartRequest(BaseModel):
    user_id: str
    genre: Genre
    world_desc: str = ""
    protagonist_name: str = ""


class ContinueRequest(BaseModel):
    story_id: str
    chapter_id: str
    choice_id: str


class ChoiceResponse(BaseModel):
    id: str
    text: str
    risk_level: int


class ChapterResponse(BaseModel):
    id: str
    number: int
    prose: str
    choices: list[ChoiceResponse]
    critic_score: float | None = None
    rewrite_count: int = 0


class StartResponse(BaseModel):
    story_id: str
    title: str
    genre: str
    chapter: ChapterResponse


class StoryStateResponse(BaseModel):
    story: Story
    chapters: list[ChapterResponse]


class CharacterInfo(BaseModel):
    name: str
    role: str = ""
    traits: list[str] = Field(default_factory=list)
    alive: bool = True
    cultivation_level: str | None = None


class RelationshipInfo(BaseModel):
    from_char: str
    to_char: str
    relation_type: str
    note: str = ""
