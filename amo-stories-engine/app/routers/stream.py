"""SSE streaming endpoint for chapter prose delivery."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/story", tags=["stream"])


@router.get("/stream/{chapter_id}")
async def stream_chapter(chapter_id: str):
    """Stream chapter prose via Server-Sent Events.

    SSE event types:
      - status:   {"message": "planning..."}
      - prose:    {"text": "Ánh trăng chiếu..."}  (incremental chunks)
      - choices:  {"choices": [...]}                (at the end)
      - metadata: {"critic_score": 8.5, ...}
      - done:     {}

    Implementation will be connected in Phase 1c when the Writer agent
    supports streaming callbacks.
    """
    # Phase 1c: will wire up SSE streaming here
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=501,
        content={"detail": "SSE streaming not yet implemented — coming in Phase 1c"},
    )
