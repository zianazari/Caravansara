from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.core.pagination import SortOrder
from caravansara.moderation.models import AdminAddressView
from caravansara.moderation.schemas import AdminBookingSort, AdminQueueSort


async def record_address_view(session: AsyncSession, admin_id: int, listing_id: int) -> None:
    session.add(AdminAddressView(admin_id=admin_id, listing_id=listing_id))


# Fixed SQL expressions only; client strings never become identifiers or SQL fragments.
_BOOKING_ORDER: dict[AdminBookingSort, tuple[str, ...]] = {
    "id": ("b.id",),
    "listing": ("lower(l.title)",),
    "guest": ("lower(u.full_name)", "lower(u.email)"),
    "dates": ("b.check_in", "b.check_out"),
    "total_price": ("b.currency", "b.total_price"),
    "status": (
        "CASE b.status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 "
        "WHEN 'completed' THEN 2 WHEN 'cancelled' THEN 3 ELSE 4 END",
    ),
    "created_at": ("b.created_at",),
}


async def sorted_booking_ids(
    session: AsyncSession,
    status: str | None,
    limit: int,
    offset: int,
    *,
    sort_by: AdminBookingSort,
    order: SortOrder,
    user_id: int | None = None,
) -> tuple[list[int], bool]:
    """Admin-only cross-module read; sort before LIMIT and render through the bookings service."""
    direction = "ASC" if order == "asc" else "DESC"
    expressions = (*_BOOKING_ORDER[sort_by], "b.id")
    ordering = ", ".join(f"{expression} {direction}" for expression in expressions)
    join = " JOIN listings l ON l.id = b.listing_id JOIN users u ON u.id = b.guest_id"
    conditions = []
    if status:
        conditions.append("b.status = :status")
    if user_id is not None:
        conditions.append("(b.guest_id = :user_id OR l.host_id = :user_id)")
    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    query = text(f"SELECT b.id FROM bookings b{join}{where} ORDER BY {ordering} LIMIT :limit OFFSET :offset")  # noqa: S608 -- fixed allowlisted identifiers; values are bound
    rows = await session.execute(query, {"status": status, "user_id": user_id, "limit": limit + 1, "offset": offset})
    ids = list(rows.scalars())
    return ids[:limit], len(ids) > limit


async def sorted_queue_ids(
    session: AsyncSession, limit: int, offset: int, *, sort_by: AdminQueueSort, order: SortOrder
) -> list[int]:
    """Global queue ordering on fixed expressions, before pagination."""
    expression, join = {
        "submitted_at": ("l.submitted_at", ""),
        "title": ("lower(l.title)", ""),
        "city": ("lower(c.name)", " JOIN cities c ON c.id = l.city_id"),
        "host": ("lower(u.full_name)", " JOIN users u ON u.id = l.host_id"),
    }[sort_by]
    direction = "ASC" if order == "asc" else "DESC"
    query = text(
        f"SELECT l.id FROM listings l{join} WHERE l.review_status = 'pending' AND l.deleted_at IS NULL "  # noqa: S608 -- fixed allowlisted expressions; values are bound
        f"ORDER BY {expression} {direction}, l.id {direction} LIMIT :limit OFFSET :offset"
    )
    return list((await session.execute(query, {"limit": limit, "offset": offset})).scalars())


async def user_listings(
    session: AsyncSession, user_id: int, limit: int, offset: int, *, sort_by: str, order: SortOrder
) -> tuple[list[dict[str, Any]], int]:
    column = {
        "id": "l.id",
        "title": "lower(l.title)",
        "city": "lower(c.name)",
        "price_per_night": "l.currency, l.price_per_night",
        "review_status": "l.review_status",
        "created_at": "l.created_at",
    }[sort_by]
    direction = "ASC" if order == "asc" else "DESC"
    ordering = ", ".join(f"{part} {direction}" for part in column.split(", "))
    rows = await session.execute(
        text(
            "SELECT l.id, l.title, c.name AS city, l.price_per_night::text, l.currency, "  # noqa: S608 -- fixed allowlisted SQL expressions; values are bound
            "l.review_status::text, l.is_active, l.deleted_at::text, l.created_at::text "
            "FROM listings l JOIN cities c ON c.id = l.city_id WHERE l.host_id = :user_id "
            f"ORDER BY {ordering}, l.id {direction} LIMIT :limit OFFSET :offset"
        ),
        {"user_id": user_id, "limit": limit, "offset": offset},
    )
    total = await session.scalar(text("SELECT count(*) FROM listings WHERE host_id = :id"), {"id": user_id})
    return [dict(row) for row in rows.mappings()], int(total or 0)
