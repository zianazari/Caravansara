from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.identity.models import AuthAttempt, RefreshToken, User


async def get_user(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(func.lower(User.email) == email.lower()))
    return result.scalar_one_or_none()


async def get_users(session: AsyncSession, user_ids: set[int]) -> dict[int, User]:
    if not user_ids:
        return {}
    result = await session.execute(select(User).where(User.id.in_(user_ids)))
    return {u.id: u for u in result.scalars()}


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
