"""Password hashing, access tokens and the current-user dependency.

The dependency only decodes the JWT; it needs no database, so every module can use it
without importing ``identity``.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from caravansara.core.config import Settings
from caravansara.core.errors import Unauthorized

_hasher = PasswordHasher()  # argon2id with the library's defaults (m=64 MiB, t=3, p=4)

# Used by verify_password when the user does not exist, so timing doesn't reveal it.
_DUMMY_HASH = _hasher.hash("caravansara-dummy-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(settings: Settings, user_id: int) -> tuple[str, int]:
    """Return the token and its lifetime in seconds."""
    lifetime = timedelta(minutes=settings.access_token_minutes)
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "type": "access", "iat": now, "exp": now + lifetime}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, int(lifetime.total_seconds())


def decode_access_token(settings: Settings, token: str) -> int:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise Unauthorized("The access token has expired.", code="token_expired") from exc
    except jwt.PyJWTError as exc:
        raise Unauthorized("The access token is not valid.", code="invalid_token") from exc
    if payload.get("type") != "access":
        raise Unauthorized("The access token is not valid.", code="invalid_token")
    try:
        return int(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise Unauthorized("The access token is not valid.", code="invalid_token") from exc


def new_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    """Refresh tokens are long random strings, so a fast SHA-256 is enough."""
    return hashlib.sha256(token.encode()).hexdigest()


_bearer = HTTPBearer(auto_error=False, description="Access token from `POST /api/v1/auth/login`.")


def _settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


async def current_user_id(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> int:
    if credentials is None:
        raise Unauthorized()
    return decode_access_token(_settings(request), credentials.credentials)


async def optional_user_id(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> int | None:
    if credentials is None:
        return None
    return decode_access_token(_settings(request), credentials.credentials)


CurrentUserId = Annotated[int, Depends(current_user_id)]
OptionalUserId = Annotated[int | None, Depends(optional_user_id)]
SettingsDep = Annotated[Settings, Depends(_settings)]
