from fastapi import APIRouter, status

from caravansara.core.db import SessionDep
from caravansara.core.deps import StorageDep
from caravansara.core.errors import error_responses
from caravansara.core.pagination import PageDep
from caravansara.core.security import CurrentUserId, OptionalUserId, SettingsDep
from caravansara.listings import service
from caravansara.listings.schemas import (
    AmenitiesIn,
    ListingCreate,
    ListingOut,
    ListingPage,
    ListingUpdate,
    PhotoCreate,
    PhotoOrderIn,
    PhotoOut,
    PhotoUpdate,
    UploadUrlIn,
    UploadUrlOut,
)

router = APIRouter(tags=["Listings"])
photos = APIRouter(tags=["Listing photos"])


@router.post(
    "/listings",
    status_code=status.HTTP_201_CREATED,
    summary="Create a listing",
    description=(
        "The caller becomes its host. The public map pin is the real point moved 100–500 m. A new listing "
        "waits for an admin's review (`review.status = pending`) and is not public until approved."
    ),
    responses=error_responses(401, 422),
)
async def create_listing(
    body: ListingCreate, user_id: CurrentUserId, session: SessionDep, storage: StorageDep
) -> ListingOut:
    return await service.create_listing(session, storage, user_id, body)


@router.get(
    "/me/listings",
    summary="My listings",
    description="Active and inactive, each with its review state and, when rejected, the admin's reason.",
    responses=error_responses(401),
)
async def my_listings(user_id: CurrentUserId, session: SessionDep, storage: StorageDep, page: PageDep) -> ListingPage:
    return await service.my_listings(session, storage, user_id, page.limit, page.offset)


@router.get(
    "/listings/{listing_id}",
    summary="Listing details",
    description=(
        "Public when the listing is active and approved. Otherwise only its host and a guest with a "
        "booking there see it; everyone else gets 404. `private_location` and `review` are only for the host."
    ),
    responses=error_responses(401, 404),
)
async def get_listing(
    listing_id: int, viewer_id: OptionalUserId, session: SessionDep, storage: StorageDep
) -> ListingOut:
    return await service.get_listing(session, storage, listing_id, viewer_id)


@router.patch(
    "/listings/{listing_id}",
    summary="Edit or deactivate a listing",
    description=(
        "Listings are never deleted: `is_active: false` hides them and keeps their bookings. Changing what "
        "guests read (title, description, type, city, neighbourhood, address, location) sends an approved "
        "listing back to review; price, capacity, times, pets and `is_active` do not."
    ),
    responses=error_responses(401, 403, 404, 422),
)
async def update_listing(
    listing_id: int, body: ListingUpdate, user_id: CurrentUserId, session: SessionDep, storage: StorageDep
) -> ListingOut:
    return await service.update_listing(session, storage, listing_id, user_id, body)


@router.post(
    "/listings/{listing_id}/resubmit",
    summary="Send a rejected listing again",
    description=(
        "After fixing what the admin's reason asked for. The listing waits for review again, at the end "
        "of the queue, and the old reason is cleared. Only for a `rejected` listing."
    ),
    responses=error_responses(401, 403, 404, 409),
)
async def resubmit_listing(
    listing_id: int, user_id: CurrentUserId, session: SessionDep, storage: StorageDep
) -> ListingOut:
    return await service.resubmit_listing(session, storage, listing_id, user_id)


@router.put(
    "/listings/{listing_id}/amenities",
    summary="Set amenities",
    description="Replaces the whole set with these catalog ids.",
    responses=error_responses(401, 403, 404, 422),
)
async def set_amenities(
    listing_id: int, body: AmenitiesIn, user_id: CurrentUserId, session: SessionDep, storage: StorageDep
) -> ListingOut:
    return await service.set_amenities(session, storage, listing_id, user_id, body.amenity_ids)


@photos.post(
    "/listings/{listing_id}/photos/upload-url",
    summary="1. Get an upload URL",
    description=(
        "Returns a presigned POST. Upload the file straight to storage as multipart/form-data with "
        "the returned `fields` and then a `file` field (max 10 MB), then call `POST /listings/{id}/photos`."
    ),
    responses=error_responses(401, 403, 404, 422),
)
async def upload_url(
    listing_id: int,
    body: UploadUrlIn,
    user_id: CurrentUserId,
    session: SessionDep,
    storage: StorageDep,
    settings: SettingsDep,
) -> UploadUrlOut:
    return await service.photo_upload_url(session, storage, settings, listing_id, user_id, body.content_type)


@photos.post(
    "/listings/{listing_id}/photos",
    status_code=status.HTTP_201_CREATED,
    summary="2. Register an uploaded photo",
    description="Checks that the file exists in storage. The new photo goes last; the first photo is the cover.",
    responses=error_responses(401, 403, 404, 422),
)
async def add_photo(
    listing_id: int, body: PhotoCreate, user_id: CurrentUserId, session: SessionDep, storage: StorageDep
) -> PhotoOut:
    return await service.add_photo(session, storage, listing_id, user_id, body)


@photos.patch(
    "/listings/{listing_id}/photos/{photo_id}",
    summary="Edit caption or room tag",
    responses=error_responses(401, 403, 404, 422),
)
async def update_photo(
    listing_id: int,
    photo_id: int,
    body: PhotoUpdate,
    user_id: CurrentUserId,
    session: SessionDep,
    storage: StorageDep,
) -> PhotoOut:
    return await service.update_photo(session, storage, listing_id, photo_id, user_id, body)


@photos.delete(
    "/listings/{listing_id}/photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a photo",
    description="A listing keeps at least 3 photos: removing one of the last 3 is 409 too_few_photos.",
    responses=error_responses(401, 403, 404, 409),
)
async def delete_photo(
    listing_id: int, photo_id: int, user_id: CurrentUserId, session: SessionDep, storage: StorageDep
) -> None:
    await service.delete_photo(session, storage, listing_id, photo_id, user_id)


@photos.put(
    "/listings/{listing_id}/photos/order",
    summary="Reorder photos and pick the cover",
    description="Send every photo id once; the first becomes the cover.",
    responses=error_responses(401, 403, 404, 422),
)
async def reorder_photos(
    listing_id: int, body: PhotoOrderIn, user_id: CurrentUserId, session: SessionDep, storage: StorageDep
) -> list[PhotoOut]:
    return await service.reorder_photos(session, storage, listing_id, user_id, body.photo_ids)
