from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.notifications.models import OutboxEmail


async def add(session: AsyncSession, email: OutboxEmail) -> None:
    session.add(email)
    await session.flush()


async def next_due(session: AsyncSession, now: datetime) -> OutboxEmail | None:
    """The oldest due email, locked; SKIP LOCKED lets two workers send different emails at once."""
    rows = await session.execute(
        select(OutboxEmail)
        .where(OutboxEmail.sent_at.is_(None), OutboxEmail.failed_at.is_(None), OutboxEmail.next_attempt_at <= now)
        .order_by(OutboxEmail.next_attempt_at, OutboxEmail.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    return rows.scalar_one_or_none()


async def queue_stats(session: AsyncSession) -> tuple[int, datetime | None]:
    """Unsent emails and the oldest one's creation time."""
    rows = await session.execute(
        select(func.count(), func.min(OutboxEmail.created_at)).where(
            OutboxEmail.sent_at.is_(None), OutboxEmail.failed_at.is_(None)
        )
    )
    count, oldest = rows.one()
    return int(count), oldest
