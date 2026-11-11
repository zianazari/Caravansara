from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import cast, delete, func, select, text, update
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.listings.models import (
    Listing,
    ListingAmenity,
    ListingPhoto,
    ListingReviewEvent,
    ReviewAction,
    ReviewStatus,
)


async def get_listing(session: AsyncSession, listing_id: int, *, for_update: bool = False) -> Listing | None:
    query = select(Listing).where(Listing.id == listing_id)
    if for_update:
        query = query.with_for_update()
    return (await session.execute(query)).scalar_one_or_none()


async def pins(session: AsyncSession, listing_ids: list[int]) -> dict[int, tuple[float, float]]:
    """Public pin (lat, lng) per listing."""
    if not listing_ids:
        return {}
    point = cast(Listing.public_location, Geometry)
    rows = await session.execute(
        select(Listing.id, func.ST_Y(point), func.ST_X(point)).where(Listing.id.in_(listing_ids))
    )
    return {lid: (float(lat), float(lng)) for lid, lat, lng in rows.all()}


async def host_listings(session: AsyncSession, host_id: int, limit: int, offset: int) -> tuple[list[Listing], int]:
    total = (
        await session.execute(select(func.count()).select_from(Listing).where(Listing.host_id == host_id))
    ).scalar_one()
    rows = await session.execute(
        select(Listing).where(Listing.host_id == host_id).order_by(Listing.id.desc()).limit(limit).offset(offset)
    )
    return list(rows.scalars()), int(total)


async def public_by_ids(session: AsyncSession, listing_ids: list[int]) -> list[Listing]:
    """The public ones among these listings (active and approved), for cards in another module's list."""
    if not listing_ids:
        return []
    rows = await session.execute(
        select(Listing).where(
            Listing.id.in_(listing_ids), Listing.is_active.is_(True), Listing.review_status == ReviewStatus.approved
        )
    )
    return list(rows.scalars())


async def photos(session: AsyncSession, listing_id: int) -> list[ListingPhoto]:
    rows = await session.execute(
        select(ListingPhoto).where(ListingPhoto.listing_id == listing_id).order_by(ListingPhoto.sort_order)
    )
    return list(rows.scalars())


async def photo_counts(session: AsyncSession, listing_ids: list[int]) -> dict[int, int]:
    """Photos per listing, one GROUP BY for a page of cards (feature 015)."""
    if not listing_ids:
        return {}
    rows = await session.execute(
        select(ListingPhoto.listing_id, func.count())
        .where(ListingPhoto.listing_id.in_(listing_ids))
        .group_by(ListingPhoto.listing_id)
    )
    return {int(listing_id): int(count) for listing_id, count in rows.all()}


async def cover_keys(session: AsyncSession, listing_ids: list[int]) -> dict[int, str]:
    if not listing_ids:
        return {}
    rows = await session.execute(
        select(ListingPhoto.listing_id, ListingPhoto.storage_key)
        .where(ListingPhoto.listing_id.in_(listing_ids))
        .ext(distinct_on(ListingPhoto.listing_id))
        .order_by(ListingPhoto.listing_id, ListingPhoto.sort_order)
    )
    return {lid: key for lid, key in rows.all()}


async def get_photo(session: AsyncSession, listing_id: int, photo_id: int) -> ListingPhoto | None:
    return (
        await session.execute(
            select(ListingPhoto).where(ListingPhoto.id == photo_id, ListingPhoto.listing_id == listing_id)
        )
    ).scalar_one_or_none()


async def next_sort_order(session: AsyncSession, listing_id: int) -> int:
    value = (
        await session.execute(
            select(func.coalesce(func.max(ListingPhoto.sort_order) + 1, 0)).where(ListingPhoto.listing_id == listing_id)
        )
    ).scalar_one()
    return int(value)


async def photo_key_exists(session: AsyncSession, storage_key: str) -> bool:
    found = await session.execute(select(ListingPhoto.id).where(ListingPhoto.storage_key == storage_key))
    return found.first() is not None


async def amenity_ids(session: AsyncSession, listing_id: int) -> set[int]:
    rows = await session.execute(select(ListingAmenity.amenity_id).where(ListingAmenity.listing_id == listing_id))
    return set(rows.scalars())


async def set_amenities(session: AsyncSession, listing_id: int, ids: set[int]) -> None:
    await session.execute(delete(ListingAmenity).where(ListingAmenity.listing_id == listing_id))
    session.add_all(ListingAmenity(listing_id=listing_id, amenity_id=i) for i in sorted(ids))


# ---- review (specs/backend (004)) ----------------------------------------------

# Plain SQL on bookings, not bookings.service: bookings already imports listings.service, so the
# other way round would be an import cycle (research R8). The live-booking rule is the same one
# search uses for blocked dates: an unpaid hold counts only until its deadline.
_LIVE_BOOKING = text(
    """SELECT EXISTS (SELECT 1 FROM bookings b
                      WHERE b.listing_id = :listing_id AND b.guest_id = :guest_id
                        AND b.status IN ('pending', 'confirmed', 'completed')
                        AND (b.status <> 'pending' OR b.hold_expires_at > now()))"""
)


async def has_live_booking(session: AsyncSession, listing_id: int, guest_id: int) -> bool:
    """FR-019: a guest with a live booking still sees a listing that is no longer public."""
    return bool((await session.execute(_LIVE_BOOKING, {"listing_id": listing_id, "guest_id": guest_id})).scalar())


async def add_review_event(
    session: AsyncSession, listing_id: int, action: ReviewAction, actor_id: int, version: int, reason: str | None = None
) -> None:
    session.add(
        ListingReviewEvent(
            listing_id=listing_id, action=action, actor_id=actor_id, review_version=version, reason=reason
        )
    )


async def decide(
    session: AsyncSession, listing_id: int, version: int, status: ReviewStatus, reason: str | None
) -> bool:
    """Approve or reject in one conditional UPDATE: of two admins deciding at once, exactly one
    changes the row; and a version the admin did not see is never decided (research R6)."""
    result = await session.execute(
        update(Listing)
        .where(
            Listing.id == listing_id,
            Listing.review_status == ReviewStatus.pending,
            Listing.review_version == version,
        )
        .values(review_status=status, rejection_reason=reason)
        .returning(Listing.id)
    )
    return result.first() is not None


async def resubmit(session: AsyncSession, listing_id: int, host_id: int, now: datetime) -> int | None:
    """Back to the end of the queue; only from rejected and only by the host. Returns the version."""
    result = await session.execute(
        update(Listing)
        .where(Listing.id == listing_id, Listing.host_id == host_id, Listing.review_status == ReviewStatus.rejected)
        .values(review_status=ReviewStatus.pending, submitted_at=now, rejection_reason=None)
        .returning(Listing.review_version)
    )
    row = result.first()
    return int(row[0]) if row else None


async def review_queue(
    session: AsyncSession, limit: int, offset: int, *, newest_first: bool = False
) -> tuple[list[Listing], int]:
    """Oldest first (FR-004), or newest first (feature 025), both on listings_review_queue_idx.

    Newest first reverses both keys, so Postgres reads the same (submitted_at, id) index backwards
    and no second index is needed.
    """
    pending = Listing.review_status == ReviewStatus.pending
    total = (await session.execute(select(func.count()).select_from(Listing).where(pending))).scalar_one()
    order = (Listing.submitted_at.desc(), Listing.id.desc()) if newest_first else (Listing.submitted_at, Listing.id)
    rows = await session.execute(select(Listing).where(pending).order_by(*order).limit(limit).offset(offset))
    return list(rows.scalars()), int(total)


async def review_queue_stats(session: AsyncSession) -> tuple[int, datetime | None]:
    """Size of the queue and its oldest entry, for the worker's gauges (research R10)."""
    row = (
        await session.execute(
            select(func.count(), func.min(Listing.submitted_at)).where(Listing.review_status == ReviewStatus.pending)
        )
    ).one()
    return int(row[0]), row[1]
