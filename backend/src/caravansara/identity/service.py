"""Registration, login, token rotation and profiles. Other modules may call this file only."""

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.core.config import Settings
from caravansara.core.errors import AppError, Conflict, NotFound, Unauthorized
from caravansara.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from caravansara.core.timeutil import utcnow
from caravansara.identity import repository as repo
from caravansara.identity.models import User
from caravansara.identity.schemas import ProfileUpdate, TokensOut


class TooManyAttempts(AppError):
    def __init__(self) -> None:
        super().__init__(429, "too_many_attempts", "Too many attempts. Try again later.")


@dataclass(frozen=True)
class PublicUser:
    """What other modules may show about a user: never the email."""

    id: int
    full_name: str
    avatar_url: str | None


async def _issue_tokens(session: AsyncSession, settings: Settings, user_id: int) -> TokensOut:
    access, expires_in = create_access_token(settings, user_id)
    refresh = new_refresh_token()
    expires_at = utcnow() + timedelta(days=settings.refresh_token_days)
    await repo.add_refresh_token(session, user_id, hash_refresh_token(refresh), expires_at)
    return TokensOut(access_token=access, refresh_token=refresh, expires_in=expires_in)


async def register(
    session: AsyncSession, settings: Settings, *, email: str, password: str, full_name: str, ip: str
) -> tuple[User, TokensOut]:
    since = repo.window_start(utcnow(), settings.register_window_minutes)
    if await repo.count_attempts(session, "register", ip, since) >= settings.register_max_per_ip:
        raise TooManyAttempts()

    attempt = await repo.record_attempt(session, "register", ip, succeeded=False)
    await session.commit()  # the attempt counts even if registration fails below

    if await repo.get_user_by_email(session, email) is not None:
        raise Conflict("email_taken", "An account with this email already exists.")
    user = User(email=email, password_hash=hash_password(password), full_name=full_name.strip())
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:  # two registrations with the same email at once
        await session.rollback()
        raise Conflict("email_taken", "An account with this email already exists.") from exc
    tokens = await _issue_tokens(session, settings, user.id)
    attempt.succeeded = True
    await session.commit()
    return user, tokens


async def login(session: AsyncSession, settings: Settings, *, email: str, password: str, ip: str) -> TokensOut:
    email_key = email.lower()
    now = utcnow()
    since = repo.window_start(now, settings.login_window_minutes)
    failures = await repo.count_attempts(session, "login", email_key, since, failed_only=True)
    per_ip = await repo.count_attempts(session, "login", ip, since)
    if failures >= settings.login_max_failures or per_ip >= settings.login_max_per_ip:
        raise TooManyAttempts()

    user = await repo.get_user_by_email(session, email)
    ok = verify_password(user.password_hash if user else None, password)
    await repo.record_attempt(session, "login", email_key, succeeded=ok)
    await repo.record_attempt(session, "login", ip, succeeded=ok)
    if not ok or user is None:
        await session.commit()
        raise Unauthorized("Email or password is wrong.", code="invalid_credentials")
    tokens = await _issue_tokens(session, settings, user.id)
    await session.commit()
    return tokens


async def refresh(session: AsyncSession, settings: Settings, refresh_token: str) -> TokensOut:
    """Rotate: the presented token is revoked and a new pair is issued.

    A revoked token presented again means it was stolen or replayed, so every session of
    that user is revoked.
    """
    now = utcnow()
    row = await repo.get_refresh_token_for_update(session, hash_refresh_token(refresh_token))
    if row is None or row.expires_at <= now:
        raise Unauthorized("The refresh token is not valid.", code="invalid_token")
    if row.revoked_at is not None:
        await repo.revoke_all_tokens(session, row.user_id, now)
        await session.commit()
        raise Unauthorized("The refresh token is not valid.", code="invalid_token")
    row.revoked_at = now
    tokens = await _issue_tokens(session, settings, row.user_id)
    await session.commit()
    return tokens


async def logout(session: AsyncSession, refresh_token: str) -> None:
    row = await repo.get_refresh_token_for_update(session, hash_refresh_token(refresh_token))
    if row is not None and row.revoked_at is None:
        row.revoked_at = utcnow()
    await session.commit()


async def get_me(session: AsyncSession, user_id: int) -> User:
    user = await repo.get_user(session, user_id)
    if user is None:
        raise Unauthorized("The account no longer exists.", code="invalid_token")
    return user


async def update_me(session: AsyncSession, user_id: int, changes: ProfileUpdate) -> User:
    user = await get_me(session, user_id)
    data = changes.model_dump(exclude_unset=True)
    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"].strip()
    if "avatar_url" in data:
        user.avatar_url = str(data["avatar_url"]) if data["avatar_url"] is not None else None
    await session.commit()
    return user


async def get_public_user(session: AsyncSession, user_id: int) -> PublicUser:
    user = await repo.get_user(session, user_id)
    if user is None:
        raise NotFound("User not found.")
    return PublicUser(user.id, user.full_name, user.avatar_url)


async def get_public_users(session: AsyncSession, user_ids: set[int]) -> dict[int, PublicUser]:
    users = await repo.get_users(session, user_ids)
    return {uid: PublicUser(u.id, u.full_name, u.avatar_url) for uid, u in users.items()}
