"""Search SQL, adapted from ``db/search_query.sql``.

Every fragment below is a fixed string; user input only ever travels as bind parameters.
Only ``public_location`` is used: filtering, distance and the pin never touch the real point.
Only public listings are found: active and approved by an admin (specs/backend (004), FR-002).
"""

from dataclasses import dataclass, field
from datetime import date, datetime
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
    property_type: str | None = None

    @property
    def radial(self) -> bool:
        return self.lat is not None


# Bookings that block the requested dates. An unpaid hold past its deadline no longer blocks, even
# before the worker runs.
_BLOCKING = """b.status IN ('pending', 'confirmed', 'completed')
                   AND  (b.status <> 'pending' OR b.hold_expires_at > now())
                   AND  b.stay && daterange(CAST(:check_in AS date), CAST(:check_out AS date), '[)')"""

# Up to this many nights a radius search tests the listings against one hashed list of the blocking
# bookings instead of looking them up per listing (specs/backend (003), measurements.md). The
# planner guesses a radius holds a handful of listings (London 5 km: 10 guessed, 16,155 real), so it
# looks the bookings up once per listing: 325 ms for three nights. The hashed list takes 52 ms, but it
# grows with the window, and past a week it loses on small areas (1 km, 14 nights: 16 ms per listing,
# 64 ms hashed). NOT IN, not a join: the planner hashes it by the list's own size, while any join
# would trust the bad guess (a join to a CTE ran 1 s). listing_id is NOT NULL, so NOT IN means
# NOT EXISTS. A city search needs neither: its estimate is right.
_HASHED_MAX_NIGHTS = 7


def _where(c: Criteria, *, with_amenities: bool) -> tuple[list[str], dict[str, Any]]:
    # The partial indexes (WHERE is_active) still serve these queries; the review condition is one
    # more Filter on rows they return, so the plans stay the same (specs/backend (004) research R9).
    clauses = ["l.is_active", "l.review_status = 'approved'", "l.max_guests >= :guests"]
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
    if c.property_type:
        # One more filter on rows the partial indexes return (feature 015); the plans stay the same.
        clauses.append("l.property_type = CAST(:property_type AS property_type)")
        params["property_type"] = c.property_type
    if c.check_in and c.check_out:
        if c.radial and (c.check_out - c.check_in).days <= _HASHED_MAX_NIGHTS:
            clauses.append(f"l.id NOT IN (SELECT b.listing_id FROM bookings b WHERE {_BLOCKING})")  # noqa: S608
        else:
            clauses.append(f"NOT EXISTS (SELECT 1 FROM bookings b WHERE b.listing_id = l.id AND {_BLOCKING})")  # noqa: S608
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
    distance = "ST_Distance(l.public_location, p.center)" if sort == "distance" else "NULL::float8"

    def order(alias: str) -> str:
        if sort == "distance":
            return f"{alias}.distance_m, {alias}.id"
        return f"{alias}.avg_rating DESC NULLS LAST, {alias}.review_count DESC, {alias}.id"

    # Two steps on purpose (specs/backend (003), measurements.md): "matching" holds every match but
    # only what counting and sorting need, so the planner sees it must read them all and picks a hash
    # anti-join against the bookings for the dates. With LIMIT on the outer query it guessed a few rows
    # would do and probed the bookings once per listing (London with dates: 919 ms, now 67 ms). The
    # card columns (pin, cover photo, ...) are then built for the one page only.
    matching = f"""matching AS MATERIALIZED (
            SELECT l.id, l.avg_rating, l.review_count, {distance} AS distance_m
            FROM   {source}
            JOIN   listings l ON true
            WHERE  {" AND ".join(clauses)}
        )"""  # noqa: S608
    page = f"page AS (SELECT m.* FROM matching m ORDER BY {order('m')} LIMIT :limit OFFSET :offset)"  # noqa: S608
    sql = f"""
        WITH {matching},
        {page}
        SELECT l.id, l.title, l.property_type::text AS property_type,
               c.name AS city, co.code AS country_code,
               ST_Y(l.public_location::geometry) AS pin_lat,
               ST_X(l.public_location::geometry) AS pin_lng,
               ROUND((ST_Distance(l.public_location, p.center) / 1000)::numeric, 1) AS distance_km,
               l.avg_rating, l.review_count, l.max_guests,
               l.price_per_night, l.cleaning_fee, l.currency, l.pricing_policy,
               {nights} * l.price_per_night + l.cleaning_fee AS total_price,
               (SELECT ph.storage_key FROM listing_photos ph
                WHERE ph.listing_id = l.id ORDER BY ph.sort_order LIMIT 1) AS cover_key,
               (SELECT count(*) FROM matching) AS total
        FROM   page pg
        JOIN   {source} ON true
        JOIN   listings  l  ON l.id = pg.id
        JOIN   cities    c  ON c.id = l.city_id
        JOIN   countries co ON co.id = c.country_id
        ORDER  BY {order("pg")}
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


_COUNTS = """counts AS (
            SELECT la.amenity_id, count(*) AS listings
            FROM   matching m
            JOIN   listing_amenities la ON la.listing_id = m.id
            GROUP  BY la.amenity_id
        )"""


async def amenity_counts(session: AsyncSession, c: Criteria) -> tuple[int, list[dict[str, Any]]]:
    """Counts for the filter panel, e.g. "Wifi (120)", over listings matching everything but amenities."""
    clauses, params = _where(c, with_amenities=False)
    source = _center(c, params)
    where = " AND ".join(clauses)
    # Count per amenity id first, then name the ~30 groups: joining names to every (listing, amenity)
    # row first made a big city cost a third more (specs/backend (003), measurements.md).
    counts_sql = f"""
        WITH matching AS (SELECT l.id FROM {source} JOIN listings l ON true WHERE {where}),
        {_COUNTS}
        SELECT a.id, a.name, ac.name AS category, n.listings
        FROM   counts n
        JOIN   amenities a ON a.id = n.amenity_id
        JOIN   amenity_categories ac ON ac.id = a.category_id
        ORDER  BY n.listings DESC, a.name
    """  # noqa: S608
    total_sql = f"SELECT count(*) FROM {source} JOIN listings l ON true WHERE {where}"  # noqa: S608
    total = int((await session.execute(text(total_sql), params)).scalar_one())
    rows = [dict(r) for r in (await session.execute(text(counts_sql), params)).mappings()]
    return total, rows


async def bookings_per_city(session: AsyncSession, since: datetime) -> dict[int, int]:
    """Confirmed and completed bookings made since ``since`` on public listings, per city (feature 030)."""
    sql = """SELECT l.city_id, count(*)
             FROM   bookings b JOIN listings l ON l.id = b.listing_id
             WHERE  b.status IN ('confirmed', 'completed') AND b.created_at >= :since
               AND  l.is_active AND l.review_status = 'approved'
             GROUP  BY l.city_id"""
    return {int(city): int(count) for city, count in (await session.execute(text(sql), {"since": since})).all()}
