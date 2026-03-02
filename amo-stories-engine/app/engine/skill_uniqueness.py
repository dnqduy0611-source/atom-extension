"""Embedding-based skill uniqueness verification.

Uses Google's text-embedding-004 to embed skill descriptions and check
cosine similarity against existing skills in the database.

Spec reference: SOUL_FORGE_SPEC §7.1
"""

from __future__ import annotations

import json
import logging
import math
import sqlite3
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.memory.state import StoryStateDB

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Schema for skill_embeddings table
# ──────────────────────────────────────────────

SKILL_EMBEDDINGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS skill_embeddings (
    player_id TEXT PRIMARY KEY,
    skill_name TEXT NOT NULL DEFAULT '',
    skill_text TEXT NOT NULL DEFAULT '',
    embedding_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
);
"""


# ──────────────────────────────────────────────
# Embedding
# ──────────────────────────────────────────────

async def embed_text(text: str) -> list[float]:
    """Embed text using Google's text-embedding-004 model.

    Returns a 768-dimensional float vector.
    Falls back to a simple hash-based pseudo-embedding if API fails.
    """
    try:
        import google.generativeai as genai

        result = await _embed_with_genai(text)
        return result
    except Exception as e:
        logger.warning(f"Embedding API failed, using hash fallback: {e}")
        return _hash_embedding(text)


async def _embed_with_genai(text: str) -> list[float]:
    """Call Google GenAI embedding API."""
    import google.generativeai as genai
    import asyncio

    # genai.embed_content is synchronous, run in executor
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="semantic_similarity",
        ),
    )
    return result["embedding"]


def _hash_embedding(text: str, dims: int = 768) -> list[float]:
    """Deterministic pseudo-embedding from text hash.

    This is a fallback when the API is unavailable. It produces a
    consistent vector from the text, but similarity results will be
    less accurate than real embeddings.
    """
    import hashlib

    # Create a seed from the text
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()
    # Split hex into chunks and normalize to [-1, 1]
    vec: list[float] = []
    for i in range(dims):
        byte_idx = (i * 2) % len(h)
        val = int(h[byte_idx : byte_idx + 2], 16)
        vec.append((val / 127.5) - 1.0)
    # Normalize to unit vector
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


# ──────────────────────────────────────────────
# Cosine Similarity
# ──────────────────────────────────────────────

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ──────────────────────────────────────────────
# DB Operations
# ──────────────────────────────────────────────

def ensure_embeddings_table(db: StoryStateDB) -> None:
    """Create skill_embeddings table if it doesn't exist."""
    db.conn.executescript(SKILL_EMBEDDINGS_SCHEMA)


def save_skill_embedding(
    db: StoryStateDB,
    player_id: str,
    skill_name: str,
    skill_text: str,
    embedding: list[float],
) -> None:
    """Save a skill embedding to the database."""
    ensure_embeddings_table(db)
    db.conn.execute(
        """INSERT OR REPLACE INTO skill_embeddings
           (player_id, skill_name, skill_text, embedding_json)
           VALUES (?, ?, ?, ?)""",
        (player_id, skill_name, skill_text, json.dumps(embedding)),
    )
    db.conn.commit()


def get_all_skill_embeddings(
    db: StoryStateDB,
) -> list[tuple[str, str, list[float]]]:
    """Return all existing skill embeddings as (name, text, vector) tuples."""
    ensure_embeddings_table(db)
    rows = db.conn.execute(
        "SELECT skill_name, skill_text, embedding_json FROM skill_embeddings"
    ).fetchall()
    results: list[tuple[str, str, list[float]]] = []
    for r in rows:
        try:
            emb = json.loads(r["embedding_json"] or "[]")
            results.append((r["skill_name"], r["skill_text"], emb))
        except (json.JSONDecodeError, KeyError):
            continue
    return results


# ──────────────────────────────────────────────
# Uniqueness Check
# ──────────────────────────────────────────────

async def check_skill_uniqueness(
    skill_name: str,
    skill_mechanic: str,
    skill_description: str,
    db: StoryStateDB | None = None,
) -> tuple[float, str | None]:
    """Check if a skill is unique against existing skills.

    Returns:
        (uniqueness_score, most_similar_name)
        uniqueness_score: 1.0 = fully unique, 0.0 = exact duplicate
        most_similar_name: name of the most similar existing skill, or None
    """
    if db is None:
        return 1.0, None

    existing = get_all_skill_embeddings(db)
    if not existing:
        return 1.0, None

    # Embed the new skill
    skill_text = f"{skill_name}: {skill_description}. {skill_mechanic}"
    new_embedding = await embed_text(skill_text)

    max_sim = 0.0
    most_similar: str | None = None

    for name, _, emb in existing:
        sim = cosine_similarity(new_embedding, emb)
        if sim > max_sim:
            max_sim = sim
            most_similar = name

    uniqueness_score = max(0.0, 1.0 - max_sim)

    if max_sim > 0.85:
        logger.warning(
            f"Skill '{skill_name}' too similar to '{most_similar}' "
            f"(similarity={max_sim:.3f}, uniqueness={uniqueness_score:.3f})"
        )

    return uniqueness_score, most_similar if max_sim > 0.5 else None
