"""Search SQL, adapted from ``db/search_query.sql``.

Every fragment below is a fixed string; user input only ever travels as bind parameters.
Only ``public_location`` is used: filtering, distance and the pin never touch the real point.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class Criteria:
    city_id: int | None = None
    lat: float | None = None
    lng: float | None = None
    radius_km: float | None = None
    check_in: date | None = None
    check_out: date | None = None
    guests: int = 1
    pets: int = 0
    amenity_ids: list[int] = field(default_factory=list)

    @property
    def radial(self) -> bool:
        return self.lat is not None


def _where(c: Criteria, *, with_amenities: bool) -> tuple[list[str], dict[str, Any]]:
    clauses = ["l.is_active", "l.max_guests >= :guests"]
    params: dict[str, Any] = {"guests": c.guests}
    if c.radial:
        clauses.append("ST_DWithin(l.public_location, p.center, :radius_m)")
        params["radius_m"] = float(c.radius_km or 0) * 1000
    else:
        clauses.append("l.city_id = :city_id")
        params["city_id"] = c.city_id
    if c.pets:
        clauses.append("l.pets_allowed AND l.max_pets >= :pets")
        params["pets"] = c.pets
    if c.check_in and c.check_out:
        clauses.append(
            """NOT EXISTS (
                 SELECT 1 FROM bookings b
                 WHERE  b.listing_id = l.id
                   AND  b.status IN ('pending', 'confirmed', 'completed')
                   AND  b.stay && daterange(CAST(:check_in AS date), CAST(:check_out AS date), '[)'))"""
        )
        params |= {"check_in": c.check_in, "check_out": c.check_out}
    if with_amenities and c.amenity_ids:
        # AND logic: the listing must have every requested amenity.
        clauses.append(
            """(SELECT count(*) FROM listing_amenities la
                WHERE la.listing_id = l.id AND la.amenity_id = ANY(CAST(:amenity_ids AS smallint[])))
               = :amenity_count"""
        )
        params |= {"amenity_ids": c.amenity_ids, "amenity_count": len(c.amenity_ids)}
    return clauses, params


def _center(c: Criteria, params: dict[str, Any]) -> str:
    if not c.radial:
        return "(SELECT NULL::geography AS center) p"
    params |= {"lat": c.lat, "lng": c.lng}
    # ST_MakePoint takes longitude first.
    return "(SELECT ST_MakePoint(CAST(:lng AS float8), CAST(:lat AS float8))::geography AS center) p"


async def search(
    session: AsyncSession, c: Criteria, sort: str, limit: int, offset: int
) -> tuple[list[dict[str, Any]], int]:
    clauses, params = _where(c, with_amenities=True)
    source = _center(c, params)
    nights = "(CAST(:check_out AS date) - CAST(:check_in AS date))" if c.check_in else "NULL"
    order = (
        "ST_Distance(l.public_location, p.center), l.id"
        if sort == "distance"
        else "l.avg_rating DESC NULLS LAST, l.review_count DESC, l.id"
    )
    sql = f"""
        SELECT l.id, l.title, l.property_type::text AS property_type,
               c.name AS city, co.code AS country_code,
               ST_Y(l.public_location::geometry) AS pin_lat,
               ST_X(l.public_location::geometry) AS pin_lng,
               ROUND((ST_Distance(l.public_location, p.center) / 1000)::numeric, 1) AS distance_km,
               l.avg_rating, l.review_count, l.max_guests,
               l.price_per_night, l.cleaning_fee, l.currency,
               {nights} * l.price_per_night + l.cleaning_fee AS total_price,
               (SELECT ph.storage_key FROM listing_photos ph
                WHERE ph.listing_id = l.id ORDER BY ph.sort_order LIMIT 1) AS cover_key,
               count(*) OVER () AS total
        FROM   {source}
        JOIN   listings  l  ON true
        JOIN   cities    c  ON c.id = l.city_id
        JOIN   countries co ON co.id = c.country_id
        WHERE  {" AND ".join(clauses)}
        ORDER  BY {order}
        LIMIT  :limit OFFSET :offset
    """  # noqa: S608 (fixed fragments; values are bind parameters)
    params |= {"limit": limit, "offset": offset}
    rows = [dict(r) for r in (await session.execute(text(sql), params)).mappings()]
    total = int(rows[0]["total"]) if rows else await _count(session, c)
    return rows, total


async def _count(session: AsyncSession, c: Criteria) -> int:
    clauses, params = _where(c, with_amenities=True)
    source = _center(c, params)
    sql = f"SELECT count(*) FROM {source} JOIN listings l ON true WHERE {' AND '.join(clauses)}"  # noqa: S608
    return int((await session.execute(text(sql), params)).scalar_one())


async def amenity_counts(session: AsyncSession, c: Criteria) -> tuple[int, list[dict[str, Any]]]:
    """Counts for the filter panel, e.g. "Wifi (120)", over listings matching everything but amenities."""
    clauses, params = _where(c, with_amenities=False)
    source = _center(c, params)
    where = " AND ".join(clauses)
    counts_sql = f"""
        WITH matching AS (SELECT l.id FROM {source} JOIN listings l ON true WHERE {where})
        SELECT a.id, a.name, ac.name AS category, count(*) AS listings
        FROM   matching m
        JOIN   listing_amenities la ON la.listing_id = m.id
        JOIN   amenities a ON a.id = la.amenity_id
        JOIN   amenity_categories ac ON ac.id = a.category_id
        GROUP  BY a.id, a.name, ac.name, ac.sort_order
        ORDER  BY listings DESC, a.name
    """  # noqa: S608
    total_sql = f"SELECT count(*) FROM {source} JOIN listings l ON true WHERE {where}"  # noqa: S608
    total = int((await session.execute(text(total_sql), params)).scalar_one())
    rows = [dict(r) for r in (await session.execute(text(counts_sql), params)).mappings()]
    return total, rows
