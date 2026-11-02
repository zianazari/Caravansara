from geoalchemy2 import Geometry
from sqlalchemy import cast, delete, func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.listings.models import Listing, ListingAmenity, ListingPhoto


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


async def photos(session: AsyncSession, listing_id: int) -> list[ListingPhoto]:
    rows = await session.execute(
        select(ListingPhoto).where(ListingPhoto.listing_id == listing_id).order_by(ListingPhoto.sort_order)
    )
    return list(rows.scalars())


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
