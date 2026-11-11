from decimal import Decimal

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


CATEGORIES = ("cleanliness", "accuracy", "check_in", "communication", "location", "value")


async def review_summary(session: AsyncSession, listing_id: int) -> tuple[int, list[int], dict[str, Decimal | None]]:
    """Feature 032: every review of a listing in one pass. Returns the total, how many gave 5, 4, 3, 2 and
    1 stars, and each category's average over the reviews that rated it (avg skips nulls), rounded like
    listings.avg_rating."""
    stars = [func.count().filter(Review.rating == n) for n in range(5, 0, -1)]
    averages = [func.round(func.avg(getattr(Review, f"{name}_rating")), 2) for name in CATEGORIES]
    row = (await session.execute(select(func.count(), *stars, *averages).where(Review.listing_id == listing_id))).one()
    total, counts, means = int(row[0]), [int(c) for c in row[1:6]], row[6:]
    return total, counts, dict(zip(CATEGORIES, means, strict=True))
