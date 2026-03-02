"""Ownership validation helpers.

Usage pattern in a router:

    @router.get("/{user_id}")
    async def get_player(
        user_id: str,
        current_user: str = Depends(get_current_user),
    ):
        assert_owns_user(user_id, current_user)
        ...

The `__dev_no_auth__` sentinel (returned by get_current_user when
SUPABASE_JWT_SECRET is not configured) bypasses all ownership checks so
development workflows are unaffected.
"""

from __future__ import annotations

from fastapi import HTTPException, status

_DEV_SENTINEL = "__dev_no_auth__"
_GUEST_SENTINEL = "__guest__"


def _is_bypass(current_user: str) -> bool:
    """True for sentinels that bypass ownership checks."""
    return current_user in (_DEV_SENTINEL, _GUEST_SENTINEL)


def assert_owns_user(path_user_id: str, current_user: str) -> None:
    """Raise 403 if the authenticated user is not the same as path_user_id."""
    if _is_bypass(current_user):
        return  # dev mode or guest — no ownership enforcement
    if path_user_id != current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )


def assert_owns_story(story_user_id: str, current_user: str) -> None:
    """Raise 403 if the authenticated user does not own the story."""
    if _is_bypass(current_user):
        return
    if story_user_id != current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )


def assert_owns_session(session_user_id: str, current_user: str) -> None:
    """Raise 403 if the authenticated user does not own the Soul Forge session."""
    if _is_bypass(current_user):
        return
    if session_user_id != current_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
