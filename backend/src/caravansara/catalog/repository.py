from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.catalog.models import Amenity, AmenityCategory, City, Country, Holiday


async def holidays(session: AsyncSession, country: str, start: date, end: date) -> list[Holiday]:
    return list(
        (
            await session.execute(
                select(Holiday)
                .where(Holiday.country_code == country, Holiday.day >= start, Holiday.day < end)
                .order_by(Holiday.day)
            )
        ).scalars()
    )


async def save_holiday(session: AsyncSession, country: str, day: date, name: str) -> None:
    await session.execute(
        insert(Holiday)
        .values(country_code=country, day=day, name=name)
        .on_conflict_do_update(index_elements=[Holiday.country_code, Holiday.day], set_={"name": name})
    )


async def delete_holiday(session: AsyncSession, country: str, day: date) -> None:
    await session.execute(delete(Holiday).where(Holiday.country_code == country, Holiday.day == day))


async def country_exists(session: AsyncSession, code: str) -> bool:
    return (await session.execute(select(Country.id).where(Country.code == code))).scalar_one_or_none() is not None


async def list_countries(session: AsyncSession) -> list[Country]:
    return list((await session.execute(select(Country).order_by(Country.name))).scalars())


async def search_cities(
    session: AsyncSession, q: str | None, country_code: str | None, limit: int | None
) -> list[tuple[City, Country]]:
    query = select(City, Country).join(Country, Country.id == City.country_id)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(City.name.ilike(f"{escaped}%", escape="\\"))
    if country_code:
        query = query.where(Country.code == country_code.upper())
    query = query.order_by(City.name)
    if limit is not None:
        query = query.limit(limit)
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
