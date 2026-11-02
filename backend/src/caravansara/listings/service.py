"""Listings, photos and amenities. Other modules may call this file only."""

import uuid
from dataclasses import dataclass
from datetime import time
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.catalog import service as catalog
from caravansara.catalog.schemas import AmenityCategoryOut, CityOut
from caravansara.core.config import Settings
from caravansara.core.errors import Forbidden, NotFound, Unprocessable
from caravansara.core.storage import Storage
from caravansara.identity import service as identity
from caravansara.listings import geo
from caravansara.listings import repository as repo
from caravansara.listings.models import Listing, ListingPhoto, PropertyType
from caravansara.listings.schemas import (
    HostOut,
    ListingCreate,
    ListingOut,
    ListingPage,
    ListingSummary,
    ListingUpdate,
    PhotoCreate,
    PhotoOut,
    PhotoUpdate,
    Pin,
    PrivateLocation,
    UploadUrlOut,
)

__all__ = ["ListingInfo", "PropertyType"]

_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
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
    )


def _set_location(listing: Listing, lat: float, lng: float) -> None:
    listing.latitude = Decimal(f"{lat:.6f}")
    listing.longitude = Decimal(f"{lng:.6f}")
    listing.public_location = geo.point_wkt(*geo.fuzz(lat, lng))


# ---- listings -------------------------------------------------------------------------


async def create_listing(session: AsyncSession, storage: Storage, host_id: int, data: ListingCreate) -> ListingOut:
    await catalog.require_city(session, data.city_id)
    amenity_ids = set(data.amenity_ids)
    await catalog.require_amenities(session, amenity_ids)
    fields = data.model_dump(exclude={"amenity_ids", "latitude", "longitude"})
    listing = Listing(host_id=host_id, **fields)
    _set_location(listing, data.latitude, data.longitude)
    session.add(listing)
    await session.flush()
    await repo.set_amenities(session, listing.id, amenity_ids)
    await session.commit()
    return await _detail(session, storage, listing, host_id)


async def get_listing(session: AsyncSession, storage: Storage, listing_id: int, viewer_id: int | None) -> ListingOut:
    listing = await _get(session, listing_id)
    if not listing.is_active and listing.host_id != viewer_id:
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
    lat, lng = changes.pop("latitude", None), changes.pop("longitude", None)
    for key, value in changes.items():
        setattr(listing, key, value)
    if not listing.pets_allowed and listing.max_pets:
        raise Unprocessable("validation_error", "max_pets must be 0 when pets are not allowed.")
    if lat is not None and lng is not None:
        _set_location(listing, lat, lng)  # a new real point gets a new public pin
    await session.commit()
    return await _detail(session, storage, listing, user_id)


async def set_amenities(
    session: AsyncSession, storage: Storage, listing_id: int, user_id: int, ids: list[int]
) -> ListingOut:
    listing = await _get_owned(session, listing_id, user_id)
    wanted = set(ids)
    await catalog.require_amenities(session, wanted)
    await repo.set_amenities(session, listing.id, wanted)
    await session.commit()
    return await _detail(session, storage, listing, user_id)


async def my_listings(session: AsyncSession, storage: Storage, host_id: int, limit: int, offset: int) -> ListingPage:
    listings, total = await repo.host_listings(session, host_id, limit, offset)
    covers = await repo.cover_keys(session, [listing.id for listing in listings])
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
            )
        )
    return ListingPage(items=items, total=total)


# ---- photos ---------------------------------------------------------------------------


async def photo_upload_url(
    session: AsyncSession, storage: Storage, settings: Settings, listing_id: int, user_id: int, content_type: str
) -> UploadUrlOut:
    await _get_owned(session, listing_id, user_id)
    await session.rollback()  # release the row lock; nothing changes here
    key = f"listings/{listing_id}/{uuid.uuid4().hex}.{_EXTENSIONS[content_type]}"
    signed = storage.presigned_upload(key, content_type)
    return UploadUrlOut(
        storage_key=key,
        url=signed["url"],
        fields={k: str(v) for k, v in signed["fields"].items()},
        expires_in=settings.upload_url_seconds,
    )


async def add_photo(
    session: AsyncSession, storage: Storage, listing_id: int, user_id: int, data: PhotoCreate
) -> PhotoOut:
    await _get_owned(session, listing_id, user_id)  # the row lock serialises sort_order
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
    await session.commit()
    return _photo_out(storage, photo)


async def update_photo(
    session: AsyncSession, storage: Storage, listing_id: int, photo_id: int, user_id: int, data: PhotoUpdate
) -> PhotoOut:
    await _get_owned(session, listing_id, user_id)
    photo = await repo.get_photo(session, listing_id, photo_id)
    if photo is None:
        raise NotFound("Photo not found.")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(photo, key, value)
    await session.commit()
    return _photo_out(storage, photo)


async def delete_photo(session: AsyncSession, storage: Storage, listing_id: int, photo_id: int, user_id: int) -> None:
    await _get_owned(session, listing_id, user_id)
    photo = await repo.get_photo(session, listing_id, photo_id)
    if photo is None:
        raise NotFound("Photo not found.")
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


async def cover_urls(session: AsyncSession, storage: Storage, listing_ids: list[int]) -> dict[int, str]:
    return {lid: storage.public_url(key) for lid, key in (await repo.cover_keys(session, listing_ids)).items()}


async def require_host(session: AsyncSession, listing_id: int, user_id: int) -> None:
    listing = await _get(session, listing_id)
    if listing.host_id != user_id:
        raise Forbidden("Only the host of this listing can do this.", code="not_listing_host")
