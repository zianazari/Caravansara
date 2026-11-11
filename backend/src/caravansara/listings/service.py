"""Listings, photos and amenities. Other modules may call this file only."""

import uuid
from dataclasses import dataclass
from datetime import datetime, time
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.catalog import service as catalog
from caravansara.catalog.schemas import AmenityCategoryOut, CityOut
from caravansara.core.config import Settings
from caravansara.core.errors import Conflict, Forbidden, NotFound, Unprocessable
from caravansara.core.metrics import LISTING_REVIEW_EVENTS
from caravansara.core.storage import Storage
from caravansara.core.timeutil import utcnow
from caravansara.identity import service as identity
from caravansara.listings import geo
from caravansara.listings import repository as repo
from caravansara.listings.models import Listing, ListingPhoto, PropertyType, ReviewAction, ReviewStatus
from caravansara.listings.schemas import (
    AdminListingOut,
    AdminQueueItem,
    AdminQueuePage,
    HostOut,
    ListingCard,
    ListingCreate,
    ListingOut,
    ListingPage,
    ListingReview,
    ListingSummary,
    ListingUpdate,
    PhotoCreate,
    PhotoOut,
    PhotoUpdate,
    Pin,
    PrivateLocation,
    UploadUrlOut,
)
from caravansara.notifications import service as notifications

__all__ = ["ListingInfo", "PropertyType", "ReviewStatus"]

# AVIF since feature 023 (owner's request): smaller files than JPEG at the same quality.
_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif"}
_REQUIRED = {
    "title", "property_type", "city_id", "address", "max_guests", "pets_allowed", "max_pets",
    "bedrooms", "beds", "bathrooms", "price_per_night", "cleaning_fee", "currency",
    "check_in_time", "check_out_time", "is_active",
}  # fmt: skip


@dataclass(frozen=True)
class ListingInfo:
    """What the bookings module needs about a listing."""

    id: int
    host_id: int
    title: str
    is_active: bool
    review_status: ReviewStatus
    is_public: bool  # active and approved: what search shows and guests may book (FR-002)
    max_guests: int
    pets_allowed: bool
    max_pets: int
    price_per_night: Decimal
    cleaning_fee: Decimal
    currency: str
    check_in_time: time
    check_out_time: time
    address: str
    latitude: float
    longitude: float
    city: CityOut


async def _get(session: AsyncSession, listing_id: int, *, for_update: bool = False) -> Listing:
    listing = await repo.get_listing(session, listing_id, for_update=for_update)
    if listing is None:
        raise NotFound("Listing not found.")
    return listing


async def _get_owned(session: AsyncSession, listing_id: int, user_id: int) -> Listing:
    listing = await _get(session, listing_id, for_update=True)
    if listing.host_id != user_id:
        raise Forbidden("Only the host of this listing can do this.", code="not_listing_host")
    return listing


def _is_public(listing: Listing) -> bool:
    """Public means active *and* approved by an admin (FR-002). Not a stored column (research R8)."""
    return listing.is_active and listing.review_status == ReviewStatus.approved


async def _visible_to(session: AsyncSession, listing: Listing, viewer_id: int | None) -> bool:
    """Who may open a listing's page: everyone if it is public, else its host, and a guest with a
    live booking, who must still find the place they paid for (FR-002, FR-019)."""
    if _is_public(listing) or (viewer_id is not None and viewer_id == listing.host_id):
        return True
    return viewer_id is not None and await repo.has_live_booking(session, listing.id, viewer_id)


def _review_out(listing: Listing) -> ListingReview:
    return ListingReview(
        status=listing.review_status, rejection_reason=listing.rejection_reason, submitted_at=listing.submitted_at
    )


def _photo_out(storage: Storage, photo: ListingPhoto) -> PhotoOut:
    return PhotoOut(
        id=photo.id,
        url=storage.public_url(photo.storage_key),
        storage_key=photo.storage_key,
        width=photo.width,
        height=photo.height,
        caption=photo.caption,
        room_tag=photo.room_tag,
        sort_order=photo.sort_order,
    )


async def _amenities_out(session: AsyncSession, listing_id: int) -> list[AmenityCategoryOut]:
    have = await repo.amenity_ids(session, listing_id)
    out: list[AmenityCategoryOut] = []
    for category in await catalog.list_amenities(session):
        items = [a for a in category.amenities if a.id in have]
        if items:
            out.append(AmenityCategoryOut(id=category.id, name=category.name, amenities=items))
    return out


async def _detail(session: AsyncSession, storage: Storage, listing: Listing, viewer_id: int | None) -> ListingOut:
    city = await catalog.require_city(session, listing.city_id)
    host = await identity.get_public_user(session, listing.host_id)
    lat, lng = (await repo.pins(session, [listing.id]))[listing.id]
    is_host = viewer_id == listing.host_id
    return ListingOut(
        id=listing.id,
        title=listing.title,
        description=listing.description,
        property_type=listing.property_type,
        city=city,
        neighborhood=listing.neighborhood,
        pin=Pin(lat=lat, lng=lng),
        max_guests=listing.max_guests,
        pets_allowed=listing.pets_allowed,
        max_pets=listing.max_pets,
        bedrooms=listing.bedrooms,
        beds=listing.beds,
        bathrooms=listing.bathrooms,
        price_per_night=listing.price_per_night,
        cleaning_fee=listing.cleaning_fee,
        currency=listing.currency,
        check_in_time=listing.check_in_time,
        check_out_time=listing.check_out_time,
        avg_rating=listing.avg_rating,
        review_count=listing.review_count,
        is_active=listing.is_active,
        host=HostOut(id=host.id, full_name=host.full_name, avatar_url=host.avatar_url),
        photos=[_photo_out(storage, p) for p in await repo.photos(session, listing.id)],
        amenities=await _amenities_out(session, listing.id),
        private_location=(
            PrivateLocation(
                address=listing.address, latitude=float(listing.latitude), longitude=float(listing.longitude)
            )
            if is_host
            else None
        ),
        review=_review_out(listing) if is_host else None,
    )


def _set_location(listing: Listing, lat: float, lng: float) -> None:
    listing.latitude = Decimal(f"{lat:.6f}")
    listing.longitude = Decimal(f"{lng:.6f}")
    listing.public_location = geo.point_wkt(*geo.fuzz(lat, lng))


# What a guest reads to decide where to stay. Changing any of it sends an approved listing back to
# review; the rest (price, capacity, times, pets, is_active) does not. The owner's list
# (specs/backend (004) FR-009, FR-010); amenities and photos are checked where they change.
_DESCRIPTIVE = {"title", "description", "property_type", "city_id", "neighborhood", "address", "latitude", "longitude"}


def _same(key: str, old: object, new: object) -> bool:
    if key in ("latitude", "longitude") and old is not None and new is not None:
        return f"{float(old):.6f}" == f"{float(new):.6f}"  # type: ignore[arg-type]  # stored with 6 decimals (R7)
    return old == new


def _descriptive_changed(listing: Listing, changes: dict[str, object]) -> bool:
    """Only a real change counts: sending the same title again keeps the listing approved (US3/AC5)."""
    return any(not _same(k, getattr(listing, k), v) for k, v in changes.items() if k in _DESCRIPTIVE)


async def _after_descriptive_edit(session: AsyncSession, listing: Listing, user_id: int) -> bool:
    """Every descriptive edit is a new version, whatever the status, so an admin who opened the old
    one cannot approve it (R6). An approved listing goes back to the end of the queue (FR-009); a
    pending one keeps its place, and a rejected one waits for the host's resubmission.
    Runs under the row lock of _get_owned. Returns whether a ``submitted`` event must be counted."""
    listing.review_version += 1
    if listing.review_status != ReviewStatus.approved:
        return False
    listing.review_status = ReviewStatus.pending
    listing.submitted_at = utcnow()
    await repo.add_review_event(session, listing.id, ReviewAction.edited, user_id, listing.review_version)
    return True


def _count_submitted(back_in_queue: bool) -> None:
    if back_in_queue:
        LISTING_REVIEW_EVENTS.labels("submitted").inc()


# ---- listings -------------------------------------------------------------------------


async def create_listing(session: AsyncSession, storage: Storage, host_id: int, data: ListingCreate) -> ListingOut:
    await catalog.require_city(session, data.city_id)
    amenity_ids = set(data.amenity_ids)
    await catalog.require_amenities(session, amenity_ids)
    fields = data.model_dump(exclude={"amenity_ids", "latitude", "longitude"})
    # review_status and submitted_at come from the database defaults: pending, now (FR-001).
    listing = Listing(host_id=host_id, **fields)
    _set_location(listing, data.latitude, data.longitude)
    session.add(listing)
    await session.flush()
    await repo.set_amenities(session, listing.id, amenity_ids)
    await repo.add_review_event(session, listing.id, ReviewAction.submitted, host_id, 0)
    await session.commit()
    LISTING_REVIEW_EVENTS.labels("submitted").inc()
    return await _detail(session, storage, listing, host_id)


async def get_listing(session: AsyncSession, storage: Storage, listing_id: int, viewer_id: int | None) -> ListingOut:
    listing = await _get(session, listing_id)
    if not await _visible_to(session, listing, viewer_id):
        raise NotFound("Listing not found.")
    return await _detail(session, storage, listing, viewer_id)


async def update_listing(
    session: AsyncSession, storage: Storage, listing_id: int, user_id: int, data: ListingUpdate
) -> ListingOut:
    listing = await _get_owned(session, listing_id, user_id)
    changes = data.model_dump(exclude_unset=True)
    nulls = sorted(k for k, v in changes.items() if v is None and k in _REQUIRED | {"latitude", "longitude"})
    if nulls:
        raise Unprocessable("validation_error", "These fields cannot be null.", details={"fields": nulls})
    if "city_id" in changes:
        await catalog.require_city(session, changes["city_id"])
    descriptive = _descriptive_changed(listing, changes)
    lat, lng = changes.pop("latitude", None), changes.pop("longitude", None)
    for key, value in changes.items():
        setattr(listing, key, value)
    if not listing.pets_allowed and listing.max_pets:
        raise Unprocessable("validation_error", "max_pets must be 0 when pets are not allowed.")
    if lat is not None and lng is not None:
        _set_location(listing, lat, lng)  # a new real point gets a new public pin
    back = descriptive and await _after_descriptive_edit(session, listing, user_id)
    await session.commit()
    _count_submitted(back)
    return await _detail(session, storage, listing, user_id)


async def set_amenities(
    session: AsyncSession, storage: Storage, listing_id: int, user_id: int, ids: list[int]
) -> ListingOut:
    listing = await _get_owned(session, listing_id, user_id)
    wanted = set(ids)
    await catalog.require_amenities(session, wanted)
    back = False
    if wanted != await repo.amenity_ids(session, listing.id):  # the same set is no change (US3/AC5)
        await repo.set_amenities(session, listing.id, wanted)
        back = await _after_descriptive_edit(session, listing, user_id)
    await session.commit()
    _count_submitted(back)
    return await _detail(session, storage, listing, user_id)


async def my_listings(session: AsyncSession, storage: Storage, host_id: int, limit: int, offset: int) -> ListingPage:
    listings, total = await repo.host_listings(session, host_id, limit, offset)
    covers = await repo.cover_keys(session, [listing.id for listing in listings])
    counts = await repo.photo_counts(session, [listing.id for listing in listings])
    items = []
    for listing in listings:
        city = await catalog.require_city(session, listing.city_id)
        cover = covers.get(listing.id)
        items.append(
            ListingSummary(
                id=listing.id,
                title=listing.title,
                city=city,
                price_per_night=listing.price_per_night,
                currency=listing.currency,
                avg_rating=listing.avg_rating,
                review_count=listing.review_count,
                is_active=listing.is_active,
                cover_url=storage.public_url(cover) if cover else None,
                review=_review_out(listing),
                photo_count=counts.get(listing.id, 0),
            )
        )
    return ListingPage(items=items, total=total)


async def resubmit_listing(session: AsyncSession, storage: Storage, listing_id: int, user_id: int) -> ListingOut:
    """A rejected listing goes back to the end of the queue, with the reason cleared (FR-008)."""
    version = await repo.resubmit(session, listing_id, user_id, utcnow())
    if version is None:
        listing = await _get(session, listing_id)  # 404 for an unknown listing
        if listing.host_id != user_id:
            raise Forbidden("Only the host of this listing can do this.", code="not_listing_host")
        raise Conflict("listing_not_rejected", "Only a rejected listing can be sent again.")
    await repo.add_review_event(session, listing_id, ReviewAction.resubmitted, user_id, version)
    await session.commit()
    LISTING_REVIEW_EVENTS.labels("submitted").inc()
    listing = await _get(session, listing_id)
    await session.refresh(listing)
    return await _detail(session, storage, listing, user_id)


# ---- photos ---------------------------------------------------------------------------


async def photo_upload_url(
    session: AsyncSession, storage: Storage, settings: Settings, listing_id: int, user_id: int, content_type: str
) -> UploadUrlOut:
    await _get_owned(session, listing_id, user_id)
    await session.rollback()  # release the row lock; nothing changes here
    key = f"listings/{listing_id}/{uuid.uuid4().hex}.{_EXTENSIONS[content_type]}"
    signed = storage.presigned_upload(key, content_type, settings.max_photo_bytes)
    return UploadUrlOut(
        storage_key=key,
        url=signed["url"],
        fields={k: str(v) for k, v in signed["fields"].items()},
        expires_in=settings.upload_url_seconds,
    )


async def add_photo(
    session: AsyncSession, storage: Storage, listing_id: int, user_id: int, data: PhotoCreate
) -> PhotoOut:
    listing = await _get_owned(session, listing_id, user_id)  # the row lock serialises sort_order
    if not data.storage_key.startswith(f"listings/{listing_id}/"):
        raise Unprocessable("invalid_storage_key", "This key does not belong to this listing.")
    if await repo.photo_key_exists(session, data.storage_key):
        raise Unprocessable("invalid_storage_key", "This photo is already registered.")
    if not await storage.exists(data.storage_key):
        raise Unprocessable("upload_missing", "No uploaded file was found for this key.")
    photo = ListingPhoto(
        listing_id=listing_id,
        storage_key=data.storage_key,
        width=data.width,
        height=data.height,
        caption=data.caption,
        room_tag=data.room_tag,
        sort_order=await repo.next_sort_order(session, listing_id),
    )
    session.add(photo)
    back = await _after_descriptive_edit(session, listing, user_id)  # a new photo is new content (FR-009)
    await session.commit()
    _count_submitted(back)
    return _photo_out(storage, photo)


async def update_photo(
    session: AsyncSession, storage: Storage, listing_id: int, photo_id: int, user_id: int, data: PhotoUpdate
) -> PhotoOut:
    listing = await _get_owned(session, listing_id, user_id)
    photo = await repo.get_photo(session, listing_id, photo_id)
    if photo is None:
        raise NotFound("Photo not found.")
    changes = {k: v for k, v in data.model_dump(exclude_unset=True).items() if getattr(photo, k) != v}
    for key, value in changes.items():
        setattr(photo, key, value)
    back = bool(changes) and await _after_descriptive_edit(session, listing, user_id)  # caption, room tag
    await session.commit()
    _count_submitted(back)
    return _photo_out(storage, photo)


# A listing needs at least this many photos (owner decision Q1 of feature 008, in the API since feature 010;
# raised from 3 to 5 in feature 021, owner's request, 2026-11-10, so the listing page's gallery of one large
# and four small photos is always full): an admin cannot approve one with fewer, and a host cannot remove a
# photo that would leave fewer. Guests decide from the photos.
MIN_PHOTOS = 5


async def delete_photo(session: AsyncSession, storage: Storage, listing_id: int, photo_id: int, user_id: int) -> None:
    # Removing a photo or reordering them shows nothing new, so neither needs a review (FR-010).
    # _get_owned locks the listing row, so two removals at once cannot both pass the count below.
    await _get_owned(session, listing_id, user_id)
    photo = await repo.get_photo(session, listing_id, photo_id)
    if photo is None:
        raise NotFound("Photo not found.")
    if len(await repo.photos(session, listing_id)) <= MIN_PHOTOS:
        raise Conflict("too_few_photos", f"A listing keeps at least {MIN_PHOTOS} photos. Add another one first.")
    key = photo.storage_key
    await session.delete(photo)
    await session.flush()
    for index, remaining in enumerate(await repo.photos(session, listing_id)):
        remaining.sort_order = index  # keep 0..n-1; the deferred unique check runs at commit
    await session.commit()
    await storage.delete(key)


async def reorder_photos(
    session: AsyncSession, storage: Storage, listing_id: int, user_id: int, photo_ids: list[int]
) -> list[PhotoOut]:
    await _get_owned(session, listing_id, user_id)
    photos = {p.id: p for p in await repo.photos(session, listing_id)}
    if len(photo_ids) != len(set(photo_ids)) or set(photo_ids) != set(photos):
        raise Unprocessable("invalid_photo_order", "Send every photo id of this listing exactly once.")
    for index, photo_id in enumerate(photo_ids):
        photos[photo_id].sort_order = index
    await session.commit()
    return [_photo_out(storage, photos[i]) for i in photo_ids]


# ---- for other modules ----------------------------------------------------------------


async def get_listing_info(session: AsyncSession, listing_id: int) -> ListingInfo:
    listing = await _get(session, listing_id)
    city = await catalog.require_city(session, listing.city_id)
    return ListingInfo(
        id=listing.id,
        host_id=listing.host_id,
        title=listing.title,
        is_active=listing.is_active,
        review_status=listing.review_status,
        is_public=_is_public(listing),
        max_guests=listing.max_guests,
        pets_allowed=listing.pets_allowed,
        max_pets=listing.max_pets,
        price_per_night=listing.price_per_night,
        cleaning_fee=listing.cleaning_fee,
        currency=listing.currency,
        check_in_time=listing.check_in_time,
        check_out_time=listing.check_out_time,
        address=listing.address,
        latitude=float(listing.latitude),
        longitude=float(listing.longitude),
        city=city,
    )


async def require_visible_listing(session: AsyncSession, listing_id: int, viewer_id: int | None) -> None:
    """For other modules showing a listing's content (its reviews): the same rule as its page."""
    listing = await _get(session, listing_id)
    if not await _visible_to(session, listing, viewer_id):
        raise NotFound("Listing not found.")


async def public_cards(session: AsyncSession, storage: Storage, listing_ids: list[int]) -> dict[int, ListingCard]:
    """Cards for the public listings among these ids; a listing that is not public is simply missing."""
    found = await repo.public_by_ids(session, listing_ids)
    covers = await repo.cover_keys(session, [listing.id for listing in found])
    cards = {}
    for listing in found:
        cover = covers.get(listing.id)
        cards[listing.id] = ListingCard(
            id=listing.id,
            title=listing.title,
            city=await catalog.require_city(session, listing.city_id),
            price_per_night=listing.price_per_night,
            currency=listing.currency,
            avg_rating=listing.avg_rating,
            review_count=listing.review_count,
            cover_url=storage.public_url(cover) if cover else None,
        )
    return cards


async def cover_urls(session: AsyncSession, storage: Storage, listing_ids: list[int]) -> dict[int, str]:
    return {lid: storage.public_url(key) for lid, key in (await repo.cover_keys(session, listing_ids)).items()}


async def require_host(session: AsyncSession, listing_id: int, user_id: int) -> None:
    listing = await _get(session, listing_id)
    if listing.host_id != user_id:
        raise Forbidden("Only the host of this listing can do this.", code="not_listing_host")


# ---- admin review (specs/backend (004)); called by the moderation module ----------


async def review_queue(
    session: AsyncSession, storage: Storage, limit: int, offset: int, *, newest_first: bool = False
) -> AdminQueuePage:
    listings, total = await repo.review_queue(session, limit, offset, newest_first=newest_first)
    covers = await repo.cover_keys(session, [listing.id for listing in listings])
    hosts = await identity.get_public_users(session, {listing.host_id for listing in listings})
    items = []
    for listing in listings:
        host = hosts[listing.host_id]
        cover = covers.get(listing.id)
        items.append(
            AdminQueueItem(
                id=listing.id,
                title=listing.title,
                city=await catalog.require_city(session, listing.city_id),
                host=HostOut(id=host.id, full_name=host.full_name, avatar_url=host.avatar_url),
                submitted_at=listing.submitted_at or listing.created_at,
                cover_url=storage.public_url(cover) if cover else None,
                review_version=listing.review_version,
            )
        )
    return AdminQueuePage(items=items, total=total)


async def _admin_detail(session: AsyncSession, storage: Storage, listing: Listing) -> AdminListingOut:
    """What the host sees (exact address, review state), plus the version to decide on."""
    out = await _detail(session, storage, listing, listing.host_id)
    return AdminListingOut.model_validate(out.model_dump() | {"review_version": listing.review_version})


async def review_detail(session: AsyncSession, storage: Storage, listing_id: int) -> AdminListingOut:
    """The caller records the address view in the same transaction (moderation.service.detail)."""
    return await _admin_detail(session, storage, await _get(session, listing_id))


async def _decide(
    session: AsyncSession,
    storage: Storage,
    settings: Settings,
    listing_id: int,
    admin_id: int,
    version: int,
    status: ReviewStatus,
    reason: str | None,
) -> AdminListingOut:
    """One conditional UPDATE, not read-then-write: of two admins deciding at once exactly one wins,
    and a decision on a version the admin did not see (the host edited since) changes nothing (R6)."""
    if status == ReviewStatus.approved:
        # Photos cannot drop below the limit meanwhile: removal is refused at MIN_PHOTOS (delete_photo).
        count = len(await repo.photos(session, listing_id))
        if count < MIN_PHOTOS:
            await _get(session, listing_id)  # 404 first for an unknown listing
            raise Conflict("too_few_photos", f"A listing needs at least {MIN_PHOTOS} photos to be approved.")
    if not await repo.decide(session, listing_id, version, status, reason):
        current = (await _get(session, listing_id)).review_status  # 404 for an unknown listing
        await session.rollback()
        if current != ReviewStatus.pending:
            raise Conflict("listing_not_pending", "This listing is no longer waiting for review.")
        raise Conflict("listing_changed", "The host changed this listing after you opened it. Open it again.")
    action = ReviewAction.approved if status == ReviewStatus.approved else ReviewAction.rejected
    await repo.add_review_event(session, listing_id, action, admin_id, version, reason)
    decided = await _get(session, listing_id)
    # The host's email is written in this same transaction (feature 013): it exists exactly when the
    # decision does, and the worker sends it later, so a mail server problem never touches the decision.
    await notifications.queue_review_result(
        session,
        settings,
        host_id=decided.host_id,
        listing_id=listing_id,
        title=decided.title,
        currency=decided.currency,
        approved=status == ReviewStatus.approved,
        reason=reason,
    )
    await session.commit()
    LISTING_REVIEW_EVENTS.labels(action.value).inc()
    listing = await _get(session, listing_id)
    await session.refresh(listing)
    return await _admin_detail(session, storage, listing)


async def approve(
    session: AsyncSession, storage: Storage, settings: Settings, listing_id: int, admin_id: int, version: int
) -> AdminListingOut:
    return await _decide(session, storage, settings, listing_id, admin_id, version, ReviewStatus.approved, None)


async def reject(
    session: AsyncSession,
    storage: Storage,
    settings: Settings,
    listing_id: int,
    admin_id: int,
    version: int,
    reason: str,
) -> AdminListingOut:
    return await _decide(session, storage, settings, listing_id, admin_id, version, ReviewStatus.rejected, reason)


async def review_queue_stats(session: AsyncSession) -> tuple[int, datetime | None]:
    """Queue size and oldest entry, for the worker's gauges (research R10)."""
    return await repo.review_queue_stats(session)
