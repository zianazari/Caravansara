from datetime import datetime, timedelta

from sqlalchemy import func, literal_column, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.identity.models import AccountKind, AuthAttempt, RefreshToken, User


async def get_user(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def get_user_for_update(session: AsyncSession, user_id: int) -> User | None:
    """The user's row, locked until the commit. Changing a profile picture reads the old picture and sets the
    new one under this lock, so two changes at once run one after the other: the second sees the first's
    picture as "old" and deletes its file, and no file is left without an owner (specs/006-avatar-upload-via-api,
    research R6). The lock is taken only for that short commit, never while a file is being sent."""
    query = select(User).where(User.id == user_id).with_for_update().execution_options(populate_existing=True)
    return (await session.execute(query)).scalar_one_or_none()


async def get_user_by_email(session: AsyncSession, email: str, kind: AccountKind | None = None) -> User | None:
    query = select(User).where(func.lower(User.email) == email.lower())
    if kind is not None:
        query = query.where(User.kind == kind)
    return (await session.execute(query)).scalar_one_or_none()


async def get_users(session: AsyncSession, user_ids: set[int]) -> dict[int, User]:
    if not user_ids:
        return {}
    result = await session.execute(select(User).where(User.id.in_(user_ids)))
    return {u.id: u for u in result.scalars()}


# The exact expression of users_search_trgm_idx (migration 0011): Postgres uses the index only for this text.
_SEARCH_TEXT = func.lower(User.email).concat(literal_column("' '")).concat(func.lower(User.full_name))


def _like_pattern(q: str) -> str:
    """``q`` anywhere in the text; its own % and _ are plain characters, not wildcards."""
    escaped = q.lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


async def admin_users(session: AsyncSession, q: str | None, limit: int, offset: int) -> tuple[list[User], int]:
    """Newest accounts first, on the primary key; with ``q``, on users_search_trgm_idx (feature 051)."""
    where = [_SEARCH_TEXT.like(_like_pattern(q))] if q else []
    total = (await session.execute(select(func.count()).select_from(User).where(*where))).scalar_one()
    rows = await session.execute(select(User).where(*where).order_by(User.id.desc()).limit(limit).offset(offset))
    return list(rows.scalars()), int(total)


async def add_refresh_token(session: AsyncSession, user_id: int, token_hash: str, expires_at: datetime) -> None:
    session.add(RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at))


async def get_refresh_token_for_update(session: AsyncSession, token_hash: str) -> RefreshToken | None:
    result = await session.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update())
    return result.scalar_one_or_none()


async def revoke_all_tokens(session: AsyncSession, user_id: int, now: datetime) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


async def record_attempt(session: AsyncSession, action: str, identifier: str, succeeded: bool) -> AuthAttempt:
    attempt = AuthAttempt(action=action, identifier=identifier, succeeded=succeeded)
    session.add(attempt)
    return attempt


async def count_attempts(
    session: AsyncSession,
    action: str,
    identifier: str,
    since: datetime,
    *,
    failed_only: bool = False,
) -> int:
    query = select(func.count()).where(
        AuthAttempt.action == action,
        AuthAttempt.identifier == identifier,
        AuthAttempt.attempted_at >= since,
    )
    if failed_only:
        query = query.where(AuthAttempt.succeeded.is_(False))
    return int((await session.execute(query)).scalar_one())


def window_start(now: datetime, minutes: int) -> datetime:
    return now - timedelta(minutes=minutes)
