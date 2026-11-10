from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.core.errors import Conflict
from caravansara.core.storage import Storage
from caravansara.identity import service as identity
from caravansara.listings import service as listings
from caravansara.wishlists import repository as repo
from caravansara.wishlists.schemas import WishlistIds, WishlistItemOut, WishlistPage

# A wishlist holds at most this many listings (feature 012): the hearts on every card come from one list of
# ids, which must stay small, and no real person saves more. Saving one more is 409 wishlist_full.
MAX_ITEMS = 500


async def save(session: AsyncSession, user_id: int, listing_id: int) -> None:
    """Only a public listing can be saved (404 otherwise, as for its page). The user's row is locked, so two
    saves at once cannot both pass the limit."""
    await listings.require_visible_listing(session, listing_id, None)
    await identity.lock_user(session, user_id)
    if listing_id not in await repo.listing_ids(session, user_id) and await repo.count(session, user_id) >= MAX_ITEMS:
        await session.rollback()
        raise Conflict("wishlist_full", f"A wishlist holds at most {MAX_ITEMS} listings. Remove one first.")
    await repo.add(session, user_id, listing_id)
    await session.commit()


async def unsave(session: AsyncSession, user_id: int, listing_id: int) -> None:
    """Removing a listing that is not saved is not an error: the result is the same."""
    await repo.remove(session, user_id, listing_id)
    await session.commit()


async def page(session: AsyncSession, storage: Storage, user_id: int, limit: int, offset: int) -> WishlistPage:
    """A saved listing that is no longer public stays in the list as unavailable, without its details, so the
    pages stay stable and the member sees why it is gone."""
    rows = await repo.page(session, user_id, limit, offset)
    cards = await listings.public_cards(session, storage, [listing_id for listing_id, _ in rows])
    items = [
        WishlistItemOut(
            listing_id=listing_id,
            saved_at=saved_at,
            available=listing_id in cards,
            listing=cards.get(listing_id),
        )
        for listing_id, saved_at in rows
    ]
    return WishlistPage(items=items, total=await repo.count(session, user_id))


async def ids(session: AsyncSession, user_id: int) -> WishlistIds:
    return WishlistIds(listing_ids=await repo.listing_ids(session, user_id))
