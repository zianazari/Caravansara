from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.catalog.models import Amenity, AmenityCategory, City, Country


async def list_countries(session: AsyncSession) -> list[Country]:
    return list((await session.execute(select(Country).order_by(Country.name))).scalars())


async def search_cities(
    session: AsyncSession, q: str | None, country_code: str | None, limit: int
) -> list[tuple[City, Country]]:
    query = select(City, Country).join(Country, Country.id == City.country_id)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(City.name.ilike(f"{escaped}%", escape="\\"))
    if country_code:
        query = query.where(Country.code == country_code.upper())
    query = query.order_by(City.name).limit(limit)
    return [(row[0], row[1]) for row in (await session.execute(query)).all()]


async def get_city(session: AsyncSession, city_id: int) -> tuple[City, Country] | None:
    row = (
        await session.execute(
            select(City, Country).join(Country, Country.id == City.country_id).where(City.id == city_id)
        )
    ).first()
    return (row[0], row[1]) if row else None


async def list_amenities(session: AsyncSession) -> list[tuple[AmenityCategory, Amenity]]:
    query = (
        select(AmenityCategory, Amenity)
        .join(Amenity, Amenity.category_id == AmenityCategory.id)
        .order_by(AmenityCategory.sort_order, AmenityCategory.name, Amenity.name)
    )
    return [(row[0], row[1]) for row in (await session.execute(query)).all()]


async def existing_amenity_ids(session: AsyncSession, ids: set[int]) -> set[int]:
    if not ids:
        return set()
    return set((await session.execute(select(Amenity.id).where(Amenity.id.in_(ids)))).scalars())
