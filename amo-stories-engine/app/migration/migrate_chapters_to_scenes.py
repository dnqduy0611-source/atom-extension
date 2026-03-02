"""Migration: wrap existing chapters as single scenes.

Idempotent — skips chapters that already have scene records.
Run via:  python -m app.migration.migrate_chapters_to_scenes
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone

from app.config import settings
from app.memory.state import StoryStateDB
from app.models.story import Choice, Scene

logger = logging.getLogger(__name__)


def migrate_chapters_to_scenes(db: StoryStateDB) -> dict:
    """Wrap each existing chapter as a single scene.

    Returns migration stats:
        { migrated: int, skipped: int, errors: int }
    """
    stats = {"migrated": 0, "skipped": 0, "errors": 0}

    # Get all chapters
    rows = db.conn.execute(
        "SELECT id, story_id, number, prose, choices_json, "
        "chosen_choice_id, critic_score, rewrite_count, "
        "identity_delta_json, created_at FROM chapters ORDER BY story_id, number"
    ).fetchall()

    for row in rows:
        chapter_id = row[0]

        # Check if scene already exists for this chapter
        existing = db.conn.execute(
            "SELECT COUNT(*) FROM scenes WHERE chapter_id = ?",
            (chapter_id,),
        ).fetchone()[0]

        if existing > 0:
            stats["skipped"] += 1
            continue

        try:
            # Parse choices
            choices_raw = json.loads(row[4] or "[]")
            choices = [Choice(**c) for c in choices_raw]

            # Create a single scene wrapping the entire chapter
            scene = Scene(
                chapter_id=chapter_id,
                scene_number=1,
                beat_index=0,
                title="",
                prose=row[3] or "",
                choices=choices,
                scene_type="exploration",  # Default for migrated chapters
                chosen_choice_id=row[5],
                is_chapter_end=True,
                tension=5,
                mood="neutral",
                critic_score=row[6],
                rewrite_count=row[7] or 0,
                identity_delta_json=row[8] or "{}",
                created_at=row[9] if isinstance(row[9], str) else datetime.now(timezone.utc).isoformat(),
            )

            db.save_scene(scene)

            # Update chapter's total_scenes
            db.conn.execute(
                "UPDATE chapters SET total_scenes = 1 WHERE id = ?",
                (chapter_id,),
            )
            db.conn.commit()

            stats["migrated"] += 1
            logger.info(f"Migrated chapter {chapter_id} → scene {scene.id}")

        except Exception as e:
            stats["errors"] += 1
            logger.error(f"Failed to migrate chapter {chapter_id}: {e}")

    return stats


def main():
    """CLI entry point."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    db = StoryStateDB(settings.db_file)
    db.connect()

    print(f"Migration: chapters → scenes ({settings.db_path})")
    print("=" * 50)

    stats = migrate_chapters_to_scenes(db)

    print(f"\nResults:")
    print(f"  Migrated: {stats['migrated']}")
    print(f"  Skipped:  {stats['skipped']} (already have scenes)")
    print(f"  Errors:   {stats['errors']}")

    db.close()
    return 0 if stats["errors"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
