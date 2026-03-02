"""Story Ledger — per-story accumulated narrative facts.

Tracks entities and facts that AI has introduced during a player's story.
These must remain consistent across all future chapters for that story.

Separate from NeuralMemory (semantic recall) and Entity Registry (world canon).
Story Ledger = "what AI invented specifically for THIS player's story."
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field


class IntroducedEntity(BaseModel):
    """A named entity introduced by AI — not in canonical Entity Registry."""

    entity_id: str                          # slugified: "korath_landing"
    entity_type: Literal["npc", "location", "object", "group", "event"]
    name: str                               # canonical name as first introduced
    first_appeared_chapter: int
    description_anchor: str                 # 1-2 sentence fixed description
    current_status: str = "active"          # active | destroyed | unknown | departed
    relationships: dict[str, str] = Field(default_factory=dict)
    # e.g. {"player": "ally", "merchant_sel": "rival"}


class EstablishedFact(BaseModel):
    """A world fact established during this player's story."""

    fact_id: str
    statement: str
    # e.g. "Korath's Landing was burned by Empire 20 years ago"
    chapter_established: int
    source: Literal["ai_generated", "player_action", "world_event"] = "ai_generated"
    entity_ids_involved: list[str] = Field(default_factory=list)
    superseded: bool = False    # True if a later fact logically replaces this


class StoryLedger(BaseModel):
    """Complete per-story accumulated narrative ledger."""

    story_id: str
    last_updated_chapter: int = 0
    introduced_entities: list[IntroducedEntity] = Field(default_factory=list)
    established_facts: list[EstablishedFact] = Field(default_factory=list)

    # ── Mutation helpers ──

    def add_entity(self, entity: IntroducedEntity) -> bool:
        """Add entity if not already present. Returns True if added."""
        existing_ids = {e.entity_id for e in self.introduced_entities}
        if entity.entity_id in existing_ids:
            return False
        self.introduced_entities.append(entity)
        return True

    def add_fact(self, fact: EstablishedFact) -> None:
        self.established_facts.append(fact)

    def update_entity_status(self, entity_id: str, new_status: str) -> None:
        for entity in self.introduced_entities:
            if entity.entity_id == entity_id:
                entity.current_status = new_status
                return

    # ── Prompt formatting ──

    def to_prompt_string(self, max_chars: int = 1500) -> str:
        """Format ledger as injection-ready prompt block for writer/critic.

        Only includes active entities and non-superseded facts.
        Truncates gracefully if too long, keeping most recent entries.
        """
        if not self.introduced_entities and not self.established_facts:
            return ""

        lines: list[str] = [
            "## STORY LEDGER (facts bạn đã establish — KHÔNG ĐƯỢC contradict):"
        ]

        # Active entities first
        active_entities = [
            e for e in self.introduced_entities
            if e.current_status == "active"
        ]
        departed = [
            e for e in self.introduced_entities
            if e.current_status in ("destroyed", "departed", "unknown")
        ]

        for entity in active_entities:
            lines.append(
                f"- [{entity.entity_type.upper()}] {entity.name}: "
                f"{entity.description_anchor} (ch.{entity.first_appeared_chapter})"
            )

        for entity in departed:
            lines.append(
                f"- [{entity.entity_type.upper()}] {entity.name} [{entity.current_status.upper()}]: "
                f"{entity.description_anchor} (ch.{entity.first_appeared_chapter})"
            )

        # Active facts
        active_facts = [f for f in self.established_facts if not f.superseded]
        for fact in active_facts:
            lines.append(f"- FACT: {fact.statement} (ch.{fact.chapter_established})")

        result = "\n".join(lines)

        # Graceful truncation — keep header + most recent entries
        if len(result) > max_chars:
            # Rebuild with fewer entries (drop oldest facts first)
            lines_trimmed = [lines[0]]  # always keep header
            all_entries = lines[1:]
            # Keep from the end (most recent chapter entries tend to be last)
            budget = max_chars - len(lines[0]) - 50
            kept: list[str] = []
            for entry in reversed(all_entries):
                if len(entry) + sum(len(k) for k in kept) + len(kept) < budget:
                    kept.insert(0, entry)
                else:
                    break
            lines_trimmed.extend(kept)
            lines_trimmed.append("[...lịch sử cũ hơn đã được nén]")
            result = "\n".join(lines_trimmed)

        return result

    # ── Utility ──

    def entity_count(self) -> int:
        return len(self.introduced_entities)

    def fact_count(self) -> int:
        return len([f for f in self.established_facts if not f.superseded])

    @staticmethod
    def make_slug(name: str) -> str:
        """Convert a name to a stable slug ID."""
        slug = re.sub(r"[^\w\s]", "", name.lower())
        slug = re.sub(r"\s+", "_", slug.strip())
        return slug[:40]
