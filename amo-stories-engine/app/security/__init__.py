"""Amoisekai — Security layer.

Exports:
    get_current_user   — FastAPI dependency: verify Supabase JWT → user_id
    assert_owns_user   — raise 403 if path user_id ≠ authenticated user
    assert_owns_story  — raise 403 if story owner ≠ authenticated user
    sanitize_free_input — strip prompt-injection attempts from player input
"""

from app.security.auth import get_current_user, get_current_user_sse, get_guest_or_user, get_guest_or_user_sse
from app.security.ownership import assert_owns_story, assert_owns_user
from app.security.prompt_guard import sanitize_free_input

__all__ = [
    "get_current_user",
    "get_current_user_sse",
    "get_guest_or_user",
    "get_guest_or_user_sse",
    "assert_owns_user",
    "assert_owns_story",
    "sanitize_free_input",
]
