from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.reviews.models import Review


async def exists_for_booking(session: AsyncSession, booking_id: int) -> bool:
    return (await session.execute(select(Review.id).where(Review.booking_id == booking_id))).first() is not None


async def reviewed_booking_ids(session: AsyncSession, booking_ids: list[int]) -> set[int]:
    if not booking_ids:
        return set()
    rows = await session.execute(select(Review.booking_id).where(Review.booking_id.in_(booking_ids)))
    return {int(booking_id) for booking_id in rows.scalars()}


async def listing_reviews(session: AsyncSession, listing_id: int, limit: int, offset: int) -> tuple[list[Review], int]:
    total = (
        await session.execute(select(func.count()).select_from(Review).where(Review.listing_id == listing_id))
    ).scalar_one()
    rows = await session.execute(
        select(Review)
        .where(Review.listing_id == listing_id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(rows.scalars()), int(total)
