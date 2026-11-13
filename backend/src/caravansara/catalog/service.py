"""Read-only catalog of destinations and amenities. It changes only through the seed command."""

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.catalog import repository as repo
from caravansara.catalog.models import City, Country
from caravansara.catalog.schemas import AmenityCategoryOut, AmenityOut, CityOut, CountryOut, HolidayOut
from caravansara.core.errors import Unprocessable


async def holidays(session: AsyncSession, country: str, start: date, end: date) -> list[HolidayOut]:
    if end <= start or (end - start).days > 732:
        raise Unprocessable("invalid_dates", "Choose a holiday calendar window of up to two years.")
    return [
        HolidayOut(country_code=h.country_code, day=h.day, name=h.name)
        for h in await repo.holidays(session, country.upper(), start, end)
    ]


async def save_holiday(session: AsyncSession, country: str, day: date, name: str) -> HolidayOut:
    country, name = country.upper(), name.strip()
    if not await repo.country_exists(session, country):
        raise Unprocessable("unknown_country", "Choose a country from the catalog.")
    if not name:
        raise Unprocessable("validation_error", "Write the holiday name.")
    await repo.save_holiday(session, country, day, name)
    await session.commit()
    return HolidayOut(country_code=country, day=day, name=name)


async def delete_holiday(session: AsyncSession, country: str, day: date) -> None:
    await repo.delete_holiday(session, country.upper(), day)
    await session.commit()


async def list_countries(session: AsyncSession) -> list[CountryOut]:
    return [CountryOut(id=c.id, code=c.code, name=c.name) for c in await repo.list_countries(session)]


def _city_out(city: City, country: Country) -> CityOut:
    return CityOut(
        id=city.id,
        name=city.name,
        timezone=city.timezone,
        country=CountryOut(id=country.id, code=country.code, name=country.name),
    )


async def search_cities(
    session: AsyncSession,
    q: str | None,
    country_code: str | None,
    limit: int,
    bookings_per_city: dict[int, int] | None = None,
) -> list[CityOut]:
    """By name; with ``bookings_per_city`` (feature 030), the most booked first and then by name."""
    if bookings_per_city is None:
        return [_city_out(c, co) for c, co in await repo.search_cities(session, q, country_code, limit)]
    # Every matching city is read and sorted here, which is fine for a catalog of cities.
    rows = await repo.search_cities(session, q, country_code, None)
    rows.sort(key=lambda row: -bookings_per_city.get(row[0].id, 0))  # stable: equal counts keep the name order
    return [_city_out(c, co) for c, co in rows[:limit]]


async def get_city(session: AsyncSession, city_id: int) -> CityOut | None:
    row = await repo.get_city(session, city_id)
    return _city_out(*row) if row else None


async def require_city(session: AsyncSession, city_id: int) -> CityOut:
    city = await get_city(session, city_id)
    if city is None:
        raise Unprocessable("unknown_city", f"City {city_id} does not exist.")
    return city


async def list_amenities(session: AsyncSession) -> list[AmenityCategoryOut]:
    categories: dict[int, AmenityCategoryOut] = {}
    for category, amenity in await repo.list_amenities(session):
        out = categories.setdefault(category.id, AmenityCategoryOut(id=category.id, name=category.name, amenities=[]))
        out.amenities.append(AmenityOut(id=amenity.id, name=amenity.name, icon=amenity.icon))
    return list(categories.values())


async def require_amenities(session: AsyncSession, ids: set[int]) -> None:
    missing = ids - await repo.existing_amenity_ids(session, ids)
    if missing:
        raise Unprocessable("unknown_amenity", "Some amenities do not exist.", details={"amenity_ids": sorted(missing)})
