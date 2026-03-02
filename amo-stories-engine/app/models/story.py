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
# Preference Tags (replaces Genre)
# ──────────────────────────────────────────────

class PreferenceTag(str, Enum):
    """Content preference tags — bias chapter tone, NOT change the world.

    Players select up to 3 tags during onboarding.
    AI uses these to weight narrative elements in chapter generation.
    """

    COMBAT = "combat"
    POLITICS = "politics"
    ROMANCE = "romance"
    MYSTERY = "mystery"
    HORROR = "horror"
    CULTIVATION = "cultivation"
    ADVENTURE = "adventure"
    STRATEGY = "strategy"

    @property
    def display_name(self) -> str:
        names = {
            "combat": "Chiến đấu",
            "politics": "Chính trị",
            "romance": "Lãng mạn",
            "mystery": "Bí ẩn",
            "horror": "Kinh dị",
            "cultivation": "Tu luyện",
            "adventure": "Phiêu lưu",
            "strategy": "Mưu lược",
        }
        return names.get(self.value, self.value)


# ──────────────────────────────────────────────
# Core Models
# ──────────────────────────────────────────────

class Choice(BaseModel):
    """A single choice presented to the player at the end of a chapter.

    For combat decisions (choice_type="combat_decision"), the combat_meta
    dict enables richer frontend rendering: action icons, risk colors,
    stability preview, and boss tells.
    """

    id: str = Field(default_factory=_choice_id)
    text: str = ""                      # Display text: "Bước vào hang động bí ẩn"
    consequence_hint: str = ""          # Internal hint for planner (hidden from player)
    risk_level: int = Field(default=1, ge=1, le=5)

    # Combat decision support (§11 — Decision Point as Choice)
    choice_type: str = "narrative"      # "narrative" | "combat_decision"
    combat_meta: dict | None = None     # {action, intensity, stability_preview, boss_tell}


class Chapter(BaseModel):
    """A single chapter in a story."""

    id: str = Field(default_factory=_short_id)
    story_id: str = ""
    chapter_number: int = 1
    number: int = 0                     # Alias — deprecated, use chapter_number
    title: str = ""
    prose: str = ""                     # Full chapter text (1000-3000 words)
    summary: str = ""                   # 2-3 sentence summary for memory
    choices: list[Choice] = Field(default_factory=list)
    chosen_choice: Choice | None = None
    chosen_choice_id: str | None = None
    free_input: str = ""                # Player's custom action text

    # Pipeline metadata
    planner_outline: str | None = None
    planner_output_json: str = "{}"     # Full planner beats (for scene architecture)
    total_scenes: int = 0               # Number of scenes in this chapter
    critic_score: float | None = None
    rewrite_count: int = 0
    identity_delta_json: str = ""

    created_at: datetime = Field(default_factory=_utcnow)


class Scene(BaseModel):
    """A single scene within a chapter (sub-chapter)."""

    id: str = Field(default_factory=_short_id)
    chapter_id: str = ""
    scene_number: int = 1               # 1, 2, 3, ... within chapter
    beat_index: int = 0                 # Index into planner_output.beats

    # Content
    title: str = ""                     # Scene title (optional)
    prose: str = ""                     # 300-500 words per scene

    # Player action
    choices: list[Choice] = Field(default_factory=list)  # 3 choices (all scenes)
    scene_type: str = "exploration"     # exploration | combat | dialogue | discovery | rest
    chosen_choice_id: str | None = None
    free_input: str = ""                # Player's custom action text

    # Metadata
    is_chapter_end: bool = False        # True → next scene starts new chapter
    tension: int = 5                    # 1-10
    mood: str = "neutral"               # tense | romantic | action | mystery | calm

    # Pipeline metadata
    critic_score: float | None = None
    critic_feedback: str = ""               # Per-scene critic notes (for next scene)
    rewrite_count: int = 0
    identity_delta_json: str = ""       # Per-scene identity delta

    created_at: datetime = Field(default_factory=_utcnow)


class Story(BaseModel):
    """Top-level story container."""

    id: str = Field(default_factory=_short_id)
    user_id: str
    preference_tags: list[str] = Field(default_factory=list)  # Up to 3 PreferenceTag values
    title: str = ""                     # AI-generated title
    backstory: str = ""                 # Player's personal backstory (pre-isekai life)
    tone: str = ""                      # Narrative tone: epic, dark, comedy, slice_of_life, mysterious
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
    preference_tags: list[str] = Field(default_factory=list)  # Up to 3 tag values
    backstory: str = ""                 # Player's personal backstory
    protagonist_name: str = ""
    quiz_answers: dict | None = None    # Optional: onboard during start


class ContinueRequest(BaseModel):
    story_id: str
    chapter_id: str = ""                # ID of the chapter with chosen choice
    choice_id: str = ""                 # Empty if using free input
    free_input: str = ""                # Player's custom action text


class ChoiceResponse(BaseModel):
    id: str
    text: str
    risk_level: int
    consequence_hint: str = ""
    choice_type: str = "narrative"          # "narrative" | "combat_decision"
    combat_meta: dict | None = None        # {action, intensity, stability_preview, boss_tell}


class ChapterResponse(BaseModel):
    id: str
    number: int
    title: str = ""
    prose: str
    summary: str = ""
    choices: list[ChoiceResponse]
    critic_score: float | None = None
    rewrite_count: int = 0


class SceneResponse(BaseModel):
    """API response for a single scene."""
    id: str
    chapter_id: str
    scene_number: int
    title: str = ""
    prose: str
    scene_type: str = "exploration"
    choices: list[ChoiceResponse]
    chosen_choice_id: str | None = None
    is_chapter_end: bool = False
    tension: int = 5
    mood: str = "neutral"
    critic_score: float | None = None
    rewrite_count: int = 0


class StartResponse(BaseModel):
    story_id: str
    title: str
    preference_tags: list[str] = Field(default_factory=list)
    chapter: ChapterResponse


class ContinueResponse(BaseModel):
    story_id: str
    chapter: ChapterResponse
    identity_update: dict | None = None   # Delta summary for frontend


class StoryStateResponse(BaseModel):
    story: Story
    chapters: list[ChapterResponse]


class SceneChapterResponse(BaseModel):
    """API response for a chapter with its scenes."""
    chapter_id: str
    chapter_number: int
    chapter_title: str = ""
    total_scenes: int = 0
    scenes: list[SceneResponse]


class SceneStartResponse(BaseModel):
    """API response for starting a story with scene-based generation."""
    story_id: str
    title: str
    preference_tags: list[str] = Field(default_factory=list)
    chapter: SceneChapterResponse
    identity_update: dict | None = None


class SceneContinueResponse(BaseModel):
    """API response for continuing a story scene-by-scene."""
    story_id: str
    chapter: SceneChapterResponse
    identity_update: dict | None = None


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

