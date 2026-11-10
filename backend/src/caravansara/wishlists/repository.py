from datetime import datetime

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.wishlists.models import WishlistItem


async def count(session: AsyncSession, user_id: int) -> int:
    rows = await session.execute(select(func.count()).select_from(WishlistItem).where(WishlistItem.user_id == user_id))
    return int(rows.scalar_one())


async def add(session: AsyncSession, user_id: int, listing_id: int) -> None:
    """Saving twice keeps the first save and its time (the primary key)."""
    await session.execute(insert(WishlistItem).values(user_id=user_id, listing_id=listing_id).on_conflict_do_nothing())


async def remove(session: AsyncSession, user_id: int, listing_id: int) -> None:
    await session.execute(
        delete(WishlistItem).where(WishlistItem.user_id == user_id, WishlistItem.listing_id == listing_id)
    )


async def page(session: AsyncSession, user_id: int, limit: int, offset: int) -> list[tuple[int, datetime]]:
    rows = await session.execute(
        select(WishlistItem.listing_id, WishlistItem.saved_at)
        .where(WishlistItem.user_id == user_id)
        .order_by(WishlistItem.saved_at.desc(), WishlistItem.listing_id.desc())
        .limit(limit)
        .offset(offset)
    )
    return [(int(listing_id), saved_at) for listing_id, saved_at in rows]


async def listing_ids(session: AsyncSession, user_id: int) -> list[int]:
    rows = await session.execute(
        select(WishlistItem.listing_id)
        .where(WishlistItem.user_id == user_id)
        .order_by(WishlistItem.saved_at.desc(), WishlistItem.listing_id.desc())
    )
    return [int(listing_id) for listing_id in rows.scalars()]
