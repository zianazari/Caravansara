"""Where / When / Who search over active listings, by city or by centre and radius."""

import time
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.catalog import service as catalog
from caravansara.core.config import Settings
from caravansara.core.errors import Unprocessable
from caravansara.core.storage import Storage
from caravansara.core.timeutil import utcnow
from caravansara.listings import service as listings
from caravansara.listings.schemas import PricingPolicy
from caravansara.search import repository as repo
from caravansara.search.repository import Criteria
from caravansara.search.schemas import AmenityCount, FilterCounts, SearchPage, SearchPin, SearchResult


def build_criteria(
    settings: Settings,
    *,
    city_id: int | None,
    lat: float | None,
    lng: float | None,
    radius_km: float | None,
    check_in: date | None,
    check_out: date | None,
    adults: int,
    children: int,
    pets: int,
    amenity_ids: list[int],
    property_type: str | None = None,
) -> Criteria:
    radial_parts = (lat, lng, radius_km)
    radial = all(v is not None for v in radial_parts)
    if any(v is not None for v in radial_parts) and not radial:
        raise Unprocessable("invalid_search_area", "Send lat, lng and radius_km together.")
    if radial == (city_id is not None):
        raise Unprocessable("invalid_search_area", "Send either city_id or lat, lng and radius_km.")
    if radial and radius_km is not None and not settings.min_radius_km <= radius_km <= settings.max_radius_km:
        raise Unprocessable(
            "invalid_search_area",
            f"radius_km must be between {settings.min_radius_km:g} and {settings.max_radius_km:g}.",
        )
    if (check_in is None) != (check_out is None):
        raise Unprocessable("invalid_dates", "Send check_in and check_out together.")
    if check_in and check_out and check_out <= check_in:
        raise Unprocessable("invalid_dates", "check_out must be after check_in.")
    return Criteria(
        city_id=city_id,
        lat=lat,
        lng=lng,
        radius_km=radius_km,
        check_in=check_in,
        check_out=check_out,
        guests=adults + children,  # infants don't count
        pets=pets,
        amenity_ids=sorted(set(amenity_ids)),
        property_type=property_type,
    )


async def search(
    session: AsyncSession, storage: Storage, criteria: Criteria, sort: str, limit: int, offset: int
) -> SearchPage:
    if sort == "distance" and not criteria.radial:
        raise Unprocessable("invalid_search_area", "sort=distance needs lat, lng and radius_km.")
    rows, total = await repo.search(session, criteria, sort, limit, offset)
    if criteria.check_in and criteria.check_out:
        calendars = {
            country: {
                h.day: h.name for h in await catalog.holidays(session, country, criteria.check_in, criteria.check_out)
            }
            for country in {r["country_code"] for r in rows}
        }
        for row in rows:
            row["total_price"] = listings.calculate_quote(
                row["id"],
                row["price_per_night"],
                row["cleaning_fee"],
                row["currency"],
                PricingPolicy.model_validate(row["pricing_policy"]),
                criteria.check_in,
                criteria.check_out,
                calendars[row["country_code"]],
            ).total_price
    items = [
        SearchResult(
            id=r["id"],
            title=r["title"],
            property_type=r["property_type"],
            city=r["city"],
            country_code=r["country_code"],
            pin=SearchPin(lat=r["pin_lat"], lng=r["pin_lng"]),
            distance_km=float(r["distance_km"]) if r["distance_km"] is not None else None,
            avg_rating=r["avg_rating"],
            review_count=r["review_count"],
            max_guests=r["max_guests"],
            price_per_night=r["price_per_night"],
            cleaning_fee=r["cleaning_fee"],
            currency=r["currency"],
            total_price=r["total_price"],
            cover_url=storage.public_url(r["cover_key"]) if r["cover_key"] else None,
        )
        for r in rows
    ]
    return SearchPage(items=items, total=total, limit=limit, offset=offset)


async def filter_counts(session: AsyncSession, criteria: Criteria) -> FilterCounts:
    total, rows = await repo.amenity_counts(session, criteria)
    return FilterCounts(
        total=total,
        amenities=[
            AmenityCount(id=r["id"], name=r["name"], category=r["category"], listings=r["listings"]) for r in rows
        ],
    )


# Popular cities (feature 030): bookings made in the last 90 days, so the order follows what guests book now.
# Counting reads every recent booking (median 166 ms on the 3-million-booking bulk data, `measure-queries`
# popular_cities; an index does not help when a fifth of the rows are recent), and the field asks on every
# focus, so each API process keeps the counts for 10 minutes. A city's place
# may lag by that much, which does not matter for suggestions.
POPULAR_WINDOW = timedelta(days=90)
POPULAR_CACHE_SECONDS = 600
_popular: tuple[float, dict[int, int]] | None = None


def forget_popularity() -> None:
    """Drop the kept counts, so the next request counts again (tests)."""
    global _popular
    _popular = None


async def bookings_per_city(session: AsyncSession) -> dict[int, int]:
    """Recent bookings per city id, for GET /cities?sort=popular."""
    global _popular
    if _popular is None or time.monotonic() - _popular[0] > POPULAR_CACHE_SECONDS:
        _popular = (time.monotonic(), await repo.bookings_per_city(session, utcnow() - POPULAR_WINDOW))
    return _popular[1]
