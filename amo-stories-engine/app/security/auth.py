"""Supabase JWT authentication — FastAPI dependency.

Every protected route adds:

    current_user: str = Depends(get_current_user)

The dependency decodes the Supabase access-token from the Authorization header
and returns the user's UUID (the `sub` claim).  The UUID is then used by
ownership guards to verify that the requester owns the requested resource.

Supabase signs its JWTs with HS256 using the project's JWT Secret
(Settings → API → JWT Secret in the Supabase dashboard).
Set SUPABASE_JWT_SECRET in .env to enable verification.
"""

from __future__ import annotations

import logging

import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)

# auto_error=False → không throw 401/403 nếu không có header.
# Dùng cho cả get_current_user (để dev sentinel hoạt động) và SSE.
_bearer_optional = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_optional),
) -> str:
    """Verify the Supabase JWT Bearer token and return the caller's user_id.

    Uses _bearer_optional so that the dev-mode sentinel is reachable even
    when no Authorization header is present (HTTPBearer(auto_error=True)
    would reject the request before this function is called).

    Raises:
        HTTP 401 — token missing (production only), malformed, expired, or bad signature.
        HTTP 401 — token has no `sub` claim.
    """
    if not settings.supabase_jwt_secret:
        # Development convenience: if no JWT secret is configured, auth is
        # disabled.  Log a loud warning so this is never silently skipped in
        # production.
        logger.warning(
            "[amo-guardian] SUPABASE_JWT_SECRET not set — auth is DISABLED. "
            "Set it in .env before deploying to production."
        )
        # Return a sentinel so ownership guards are skipped gracefully.
        return "__dev_no_auth__"

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            # Supabase issues tokens with audience "authenticated" for all
            # authenticated users across all projects.
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        logger.warning(f"[amo-guardian] JWT validation failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing the subject (sub) claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id


def _decode_token(raw_token: str) -> str:
    """Decode and validate a raw JWT string. Returns user_id (sub)."""
    try:
        payload = jwt.decode(
            raw_token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        logger.warning(f"[amo-guardian] JWT validation failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing the subject (sub) claim",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


async def get_guest_or_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_optional),
) -> str:
    """Like get_current_user but allows unauthenticated (guest) access.

    Used for Soul Forge endpoints — users go through onboarding BEFORE they
    have an auth token, so requiring auth would block new user registration.

    Returns:
        - "__dev_no_auth__"  if JWT secret not configured (dev mode)
        - user_id (sub)      if a valid JWT Bearer token is present
        - "__guest__"        if no token (guest / unauthenticated)
    """
    if not settings.supabase_jwt_secret:
        logger.warning(
            "[amo-guardian] SUPABASE_JWT_SECRET not set — auth is DISABLED. "
            "Set it in .env before deploying to production."
        )
        return "__dev_no_auth__"

    if not credentials:
        return "__guest__"

    return _decode_token(credentials.credentials)


async def get_current_user_sse(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_optional),
    token: str = Query(default=""),
) -> str:
    """Auth dependency cho SSE endpoints — requires authentication.

    EventSource (Web API) không thể gửi custom headers, nên token được
    truyền qua query param ?token=<jwt>.
    """
    if not settings.supabase_jwt_secret:
        logger.warning(
            "[amo-guardian] SUPABASE_JWT_SECRET not set — auth is DISABLED. "
            "Set it in .env before deploying to production."
        )
        return "__dev_no_auth__"

    raw_token = ""
    if credentials:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _decode_token(raw_token)


async def get_guest_or_user_sse(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_optional),
    token: str = Query(default=""),
) -> str:
    """Like get_current_user_sse but allows unauthenticated (guest) access.

    Used for story/scene SSE streaming — guests can stream without auth.
    Token is passed via ?token= query param since EventSource can't set headers.
    """
    if not settings.supabase_jwt_secret:
        logger.warning(
            "[amo-guardian] SUPABASE_JWT_SECRET not set — auth is DISABLED. "
            "Set it in .env before deploying to production."
        )
        return "__dev_no_auth__"

    raw_token = ""
    if credentials:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if not raw_token:
        return "__guest__"

    return _decode_token(raw_token)
