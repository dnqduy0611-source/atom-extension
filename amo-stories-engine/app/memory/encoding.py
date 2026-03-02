"""Memory encoding — converts chapter data into storable representations.

Transforms pipeline output (NarrativeState) into compact text
for both SQLite persistence and NeuralMemory semantic storage.
"""

from __future__ import annotations

from app.models.pipeline import NarrativeState
from app.models.story import Chapter, Choice


def encode_chapter_from_state(state: NarrativeState) -> Chapter:
    """Convert pipeline output to a Chapter model for DB storage.

    Extracts prose, choices, summary from the completed pipeline state.
    """
    writer = state.writer_output
    choices = state.final_choices or (writer.choices if writer else [])

    identity_delta_json = ""
    if state.identity_delta:
        import json
        identity_delta_json = json.dumps(
            state.identity_delta.model_dump(),
            ensure_ascii=False,
        )

    chapter = Chapter(
        story_id=state.story_id,
        chapter_number=state.chapter_number,
        title=writer.chapter_title if writer else f"Chương {state.chapter_number}",
        prose=state.final_prose or (writer.prose if writer else ""),
        summary=writer.summary if writer else "",
        choices=choices[:3],
        chosen_choice=state.chosen_choice,
        free_input=state.free_input,
        identity_delta_json=identity_delta_json,
    )

    return chapter


def encode_summary_for_context(chapter: Chapter) -> str:
    """Create a compact summary string for pipeline context injection.

    Used when building the 'previous_summary' field for next chapter.
    """
    lines = [f"## Chương {chapter.chapter_number}: {chapter.title}"]

    if chapter.summary:
        lines.append(chapter.summary)
    elif chapter.prose:
        lines.append(chapter.prose[:300] + "...")

    if chapter.chosen_choice:
        lines.append(f"→ Player chọn: {chapter.chosen_choice.text}")

    return "\n".join(lines)


def build_rolling_summary(chapters: list[Chapter], max_chapters: int = 5) -> str:
    """Build a rolling summary from the last N chapters.

    Provides context for the pipeline without overwhelming the prompt.
    Recent chapters get full summaries, older ones get condensed.
    """
    if not chapters:
        return ""

    recent = chapters[-max_chapters:]
    parts = []

    for i, ch in enumerate(recent):
        # Most recent chapters get full treatment
        if i >= len(recent) - 2:
            parts.append(encode_summary_for_context(ch))
        else:
            # Older chapters get 1-line summaries
            title = ch.title or f"Chương {ch.chapter_number}"
            summary = ch.summary or (ch.prose[:100] + "..." if ch.prose else "")
            parts.append(f"Chương {ch.chapter_number} ({title}): {summary}")

    return "\n\n---\n\n".join(parts)
