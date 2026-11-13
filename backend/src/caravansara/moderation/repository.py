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
) -> tuple[list[int], bool]:
    """Admin-only cross-module read; sort before LIMIT and render through the bookings service."""
    direction = "ASC" if order == "asc" else "DESC"
    expressions = (*_BOOKING_ORDER[sort_by], "b.id")
    ordering = ", ".join(f"{expression} {direction}" for expression in expressions)
    join = (
        " JOIN listings l ON l.id = b.listing_id"
        if sort_by == "listing"
        else " JOIN users u ON u.id = b.guest_id"
        if sort_by == "guest"
        else ""
    )
    where = " WHERE b.status = :status" if status else ""
    query = text(f"SELECT b.id FROM bookings b{join}{where} ORDER BY {ordering} LIMIT :limit OFFSET :offset")  # noqa: S608 -- fixed allowlisted identifiers; values are bound
    rows = await session.execute(query, {"status": status, "limit": limit + 1, "offset": offset})
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
        f"SELECT l.id FROM listings l{join} WHERE l.review_status = 'pending' "  # noqa: S608 -- fixed allowlisted expressions; values are bound
        f"ORDER BY {expression} {direction}, l.id {direction} LIMIT :limit OFFSET :offset"
    )
    return list((await session.execute(query, {"limit": limit, "offset": offset})).scalars())
