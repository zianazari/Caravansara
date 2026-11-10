from fastapi import APIRouter, status

from caravansara.core.db import SessionDep
from caravansara.core.deps import StorageDep
from caravansara.core.errors import error_responses
from caravansara.core.pagination import PageDep
from caravansara.core.security import CurrentUserId
from caravansara.wishlists import service
from caravansara.wishlists.schemas import WishlistIds, WishlistPage

router = APIRouter(prefix="/me/wishlist", tags=["Wishlist"])


@router.get(
    "",
    summary="My wishlist",
    description=(
        "Saved listings, newest first. One that is no longer public stays as `available: false`, without its details."
    ),
    responses=error_responses(401),
)
async def my_wishlist(user_id: CurrentUserId, session: SessionDep, storage: StorageDep, page: PageDep) -> WishlistPage:
    return await service.page(session, storage, user_id, page.limit, page.offset)


@router.get(
    "/ids",
    summary="Ids of my saved listings",
    description="Every saved listing id, newest first (at most 500), to show which cards are saved.",
    responses=error_responses(401),
)
async def my_wishlist_ids(user_id: CurrentUserId, session: SessionDep) -> WishlistIds:
    return await service.ids(session, user_id)


@router.put(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Save a listing",
    description=(
        "Saving twice keeps the first save. Only a public listing can be saved (404 otherwise). "
        "`409 wishlist_full`: the wishlist already holds 500 listings."
    ),
    responses=error_responses(401, 404, 409),
)
async def save(listing_id: int, user_id: CurrentUserId, session: SessionDep) -> None:
    await service.save(session, user_id, listing_id)


@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a saved listing",
    description="Removing one that is not saved is not an error.",
    responses=error_responses(401),
)
async def unsave(listing_id: int, user_id: CurrentUserId, session: SessionDep) -> None:
    await service.unsave(session, user_id, listing_id)
