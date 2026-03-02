"""World Context Loader — loads WORLD_CONTEXT_PROMPT.md for injection into agent system prompts.

This module loads the Aelvyndor world context once at import time and provides
it to all narrative agents via get_world_context().
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# File lookup paths (in priority order)
# ──────────────────────────────────────────────

_PROJECT_ROOT = Path(__file__).parent.parent.parent  # amo-stories-engine/
_PATHS = [
    _PROJECT_ROOT.parent / "Amoisekai" / "WORLD_CONTEXT_PROMPT.md",  # Source of truth
    _PROJECT_ROOT / "app" / "prompts" / "world_context.md",           # Fallback copy
]


def _load_world_context() -> str:
    """Load world context from the first available path."""
    for path in _PATHS:
        if path.exists():
            content = path.read_text(encoding="utf-8")
            logger.info(f"World context loaded from {path} ({len(content)} chars)")
            return content
    logger.warning("World context file not found at any path — using empty context")
    return ""


# Load once at import time
_WORLD_CONTEXT: str = _load_world_context()


def get_world_context() -> str:
    """Return the cached world context string."""
    return _WORLD_CONTEXT
