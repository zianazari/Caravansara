"""Registration, login, token rotation, profiles and admin accounts. Other modules may call this file only."""

import logging
import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.core.config import Settings
from caravansara.core.errors import AppError, Conflict, NotFound, Unauthorized, Unprocessable
from caravansara.core.metrics import RATE_LIMITED
from caravansara.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from caravansara.core.storage import Storage
from caravansara.core.timeutil import utcnow
from caravansara.identity import repository as repo
from caravansara.identity.models import AccountKind, User
from caravansara.identity.schemas import AdminTokenOut, AvatarUploadUrlOut, ProfileUpdate, TokensOut

__all__ = ["AdminRefused", "PublicUser", "TooManyAttempts"]

log = logging.getLogger(__name__)


class TooManyAttempts(AppError):
    def __init__(self, action: str) -> None:
        RATE_LIMITED.labels(action).inc()
        super().__init__(429, "too_many_attempts", "Too many attempts. Try again later.")


class AdminRefused(Exception):
    """create-admin or disable-admin refused; the message is shown to the operator as is."""


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
        raise TooManyAttempts("register")

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
        raise TooManyAttempts("login")

    # Members only: an admin account gets the same answer as a wrong password (research R1).
    user = await repo.get_user_by_email(session, email, AccountKind.member)
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


async def update_me(
    session: AsyncSession, storage: Storage, settings: Settings, user_id: int, changes: ProfileUpdate
) -> User:
    """Name and picture. A picture address goes through the same checks as PUT /me/avatar (FR-041), and all
    checks run before anything changes, so a refused request changes nothing, the name included."""
    user = await get_me(session, user_id)
    data = changes.model_dump(exclude_unset=True)
    new_key: str | None = None
    if data.get("avatar_url") is not None:
        new_key = storage.key_from_url(str(data["avatar_url"]))
        if new_key is None or not new_key.startswith(_avatar_prefix(user_id)):
            raise Unprocessable("invalid_avatar_url", "Only a picture uploaded here for this account can be used.")
        await _check_avatar_file(storage, settings, new_key)
    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"].strip()
    if "avatar_url" in data:
        return await _replace_avatar(session, storage, user, new_key)
    await session.commit()
    return user


# ---- profile pictures (specs/005-frontend-guest, FR-037 to FR-041, research R20) --------------------------

_AVATAR_EXTENSIONS = {"image/png": "png", "image/jpeg": "jpg"}
_PNG = b"\x89PNG\r\n\x1a\n"
_JPEG = b"\xff\xd8\xff"


def _avatar_prefix(user_id: int) -> str:
    return f"avatars/{user_id}/"


def avatar_upload_url(storage: Storage, settings: Settings, user_id: int, content_type: str) -> AvatarUploadUrlOut:
    """A presigned POST for a new picture. The policy pins the type and refuses more than max_avatar_bytes,
    so storage itself never keeps a bigger file."""
    key = f"{_avatar_prefix(user_id)}{uuid.uuid4().hex}.{_AVATAR_EXTENSIONS[content_type]}"
    signed = storage.presigned_upload(key, content_type, settings.max_avatar_bytes)
    return AvatarUploadUrlOut(
        storage_key=key,
        url=signed["url"],
        fields={k: str(v) for k, v in signed["fields"].items()},
        expires_in=settings.upload_url_seconds,
    )


async def _check_avatar_file(storage: Storage, settings: Settings, key: str) -> None:
    """The stored file's real size and first bytes, not what the browser declared (FR-038). A refused file
    is deleted, so nothing unchecked stays in storage."""
    size = await storage.size(key)
    if size is None:
        raise Unprocessable("upload_missing", "No uploaded file was found for this key.")
    if size > settings.max_avatar_bytes:
        await storage.delete(key)
        raise Unprocessable(
            "image_too_large", "The picture is larger than allowed.", details={"max_bytes": settings.max_avatar_bytes}
        )
    head = await storage.read_head(key, 8)
    if not (head.startswith(_PNG) or head.startswith(_JPEG)):
        await storage.delete(key)
        raise Unprocessable("invalid_image", "The file is not a PNG or JPEG picture.")


async def _replace_avatar(session: AsyncSession, storage: Storage, user: User, new_key: str | None) -> User:
    """Points the account at the new picture (or none) and then deletes the old file (FR-039). The old file
    goes only after the commit: if the commit fails, the account still points at a file that exists. A failed
    delete is only logged; the picture is already replaced."""
    old_url = user.avatar_url
    user.avatar_url = f"{storage.public_url(new_key)}" if new_key else None
    await session.commit()
    old_key = storage.key_from_url(old_url) if old_url else None
    if old_key and old_key != new_key and old_key.startswith(_avatar_prefix(user.id)):
        try:
            await storage.delete(old_key)
        except Exception:  # the new picture is saved; a leftover file is harmless
            log.warning("avatar_delete_failed", extra={"user_id": user.id})
    return user


async def set_avatar(
    session: AsyncSession, storage: Storage, settings: Settings, user_id: int, storage_key: str
) -> User:
    user = await get_me(session, user_id)
    if not storage_key.startswith(_avatar_prefix(user_id)) or ".." in storage_key:
        raise Unprocessable("invalid_storage_key", "This key does not belong to your account.")
    await _check_avatar_file(storage, settings, storage_key)
    return await _replace_avatar(session, storage, user, storage_key)


async def remove_avatar(session: AsyncSession, storage: Storage, user_id: int) -> User:
    user = await get_me(session, user_id)
    return await _replace_avatar(session, storage, user, None)


async def get_public_user(session: AsyncSession, user_id: int) -> PublicUser:
    user = await repo.get_user(session, user_id)
    if user is None:
        raise NotFound("User not found.")
    return PublicUser(user.id, user.full_name, user.avatar_url)


async def get_public_users(session: AsyncSession, user_ids: set[int]) -> dict[int, PublicUser]:
    users = await repo.get_users(session, user_ids)
    return {uid: PublicUser(u.id, u.full_name, u.avatar_url) for uid, u in users.items()}


# ---- admin accounts (specs/004-listing-approval) --------------------------------------


async def admin_login(
    session: AsyncSession, settings: Settings, *, email: str, password: str, ip: str
) -> AdminTokenOut:
    """Same limits as member login, counted apart (action ``admin_login``), so failed member logins
    never lock an admin out and the other way round (research R3)."""
    email_key = email.lower()
    since = repo.window_start(utcnow(), settings.login_window_minutes)
    failures = await repo.count_attempts(session, "admin_login", email_key, since, failed_only=True)
    per_ip = await repo.count_attempts(session, "admin_login", ip, since)
    if failures >= settings.login_max_failures or per_ip >= settings.login_max_per_ip:
        raise TooManyAttempts("admin_login")

    user = await repo.get_user_by_email(session, email, AccountKind.admin)
    ok = verify_password(user.password_hash if user else None, password)
    ok = ok and user is not None and user.disabled_at is None
    await repo.record_attempt(session, "admin_login", email_key, succeeded=ok)
    await repo.record_attempt(session, "admin_login", ip, succeeded=ok)
    await session.commit()
    if not ok or user is None:
        raise Unauthorized("Email or password is wrong.", code="invalid_credentials")
    token, expires_in = create_access_token(settings, user.id, "admin")
    return AdminTokenOut(access_token=token, expires_in=expires_in)


async def require_active_admin(session: AsyncSession, admin_id: int) -> None:
    """Runs on every admin request, not only at login, so disable-admin takes effect at once,
    even for a token that has not expired yet (research R2)."""
    user = await repo.get_user(session, admin_id)
    if user is None or user.kind != AccountKind.admin or user.disabled_at is not None:
        raise Unauthorized("The access token is not valid.", code="invalid_token")


_EMAIL_TAKEN = "an account with this email already exists; admin accounts are always new"


async def create_admin(session: AsyncSession, *, email: str, password: str, full_name: str) -> int:
    """Only a command on the server calls this (FR-012). An existing account is never promoted:
    a member's password was chosen for a member account."""
    if await repo.get_user_by_email(session, email) is not None:
        raise AdminRefused(_EMAIL_TAKEN)
    user = User(email=email, password_hash=hash_password(password), full_name=full_name.strip(), kind=AccountKind.admin)
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:  # someone registered the same email at the same moment
        await session.rollback()
        raise AdminRefused(_EMAIL_TAKEN) from exc
    return user.id


async def disable_admin(session: AsyncSession, *, email: str) -> int:
    """The account and its history stay; it only stops working. Returns its id."""
    user = await repo.get_user_by_email(session, email, AccountKind.admin)
    if user is None:
        raise AdminRefused("no admin account with this email")
    if user.disabled_at is not None:
        raise AdminRefused("this admin account is already disabled")
    user.disabled_at = utcnow()
    await session.commit()
    return user.id
