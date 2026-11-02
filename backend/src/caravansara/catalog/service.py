"""Read-only catalog of destinations and amenities. It changes only through the seed command."""

from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.catalog import repository as repo
from caravansara.catalog.models import City, Country
from caravansara.catalog.schemas import AmenityCategoryOut, AmenityOut, CityOut, CountryOut
from caravansara.core.errors import Unprocessable


async def list_countries(session: AsyncSession) -> list[CountryOut]:
    return [CountryOut(id=c.id, code=c.code, name=c.name) for c in await repo.list_countries(session)]


def _city_out(city: City, country: Country) -> CityOut:
    return CityOut(
        id=city.id,
        name=city.name,
        timezone=city.timezone,
        country=CountryOut(id=country.id, code=country.code, name=country.name),
    )


async def search_cities(session: AsyncSession, q: str | None, country_code: str | None, limit: int) -> list[CityOut]:
    return [_city_out(c, co) for c, co in await repo.search_cities(session, q, country_code, limit)]


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
