"""Booking lifecycle: hold -> simulated payment -> stay -> completed. Other modules call this file only.

The overlap guarantee lives in the database (``EXCLUDE``); this layer adds the rules the
database can't check: capacity, dates in city time, own listing and legal transitions.
"""

import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.bookings import repository as repo
from caravansara.bookings import rules
from caravansara.bookings.models import Booking, BookingStatus
from caravansara.bookings.schemas import (
    BookingAddress,
    BookingCreate,
    BookingListing,
    BookingOut,
    BookingPage,
    ListingAvailability,
)
from caravansara.core.config import Settings
from caravansara.core.db import constraint_name, sqlstate
from caravansara.core.errors import Conflict, Forbidden, NotFound, Unprocessable
from caravansara.core.metrics import BOOKING_CONFLICTS, BOOKING_EVENTS
from caravansara.core.pagination import SortOrder
from caravansara.core.storage import Storage
from caravansara.core.timeutil import today_in, utcnow
from caravansara.listings import service as listings
from caravansara.listings.service import ListingInfo
from caravansara.notifications import service as notifications

__all__ = ["BookingInfo", "BookingStatus"]

S = BookingStatus
EXCLUSION_VIOLATION = "23P01"
UNIQUE_VIOLATION = "23505"


@dataclass(frozen=True)
class BookingInfo:
    """What the reviews module needs about a booking."""

    id: int
    listing_id: int
    guest_id: int
    status: BookingStatus
    check_out: date
    timezone: str


def _same_request(booking: Booking, user_id: int, data: BookingCreate) -> bool:
    return (
        booking.guest_id == user_id
        and booking.listing_id == data.listing_id
        and booking.check_in == data.check_in
        and booking.check_out == data.check_out
        and (booking.adults, booking.children, booking.infants, booking.pets)
        == (data.adults, data.children, data.infants, data.pets)
    )


def _replay(booking: Booking, user_id: int, data: BookingCreate) -> Booking:
    if not _same_request(booking, user_id, data):
        raise Unprocessable("idempotency_key_reused", "This Idempotency-Key was already used for a different request.")
    return booking


async def create_booking(
    session: AsyncSession, settings: Settings, user_id: int, key: uuid.UUID, data: BookingCreate
) -> tuple[Booking, bool]:
    """Return the booking and whether it was created now (False: a replay of the same key)."""
    existing = await repo.by_idempotency_key(session, key)
    if existing is not None:
        return _replay(existing, user_id, data), False

    info = await listings.get_listing_info(session, data.listing_id, lock=True)
    # Only a public listing (active and approved) takes new bookings. Existing bookings of a listing
    # that becomes hidden keep working: pay, cancel and the jobs do not look at this (FR-011).
    if not info.is_public:
        raise NotFound("Listing not found.")
    if info.host_id == user_id:
        raise Forbidden("Hosts cannot book their own listing.", code="own_listing")
    rules.check_capacity(
        adults=data.adults,
        children=data.children,
        pets=data.pets,
        max_guests=info.max_guests,
        pets_allowed=info.pets_allowed,
        max_pets=info.max_pets,
    )
    rules.check_dates(
        data.check_in,
        data.check_out,
        today_in(info.city.timezone),
        max_nights=settings.max_nights,
        max_days_ahead=settings.max_days_ahead,
    )

    quote = await listings.quote_info(session, info, data.check_in, data.check_out, max_nights=settings.max_nights)
    total = quote.total_price
    rules.check_total(total)
    if (data.expected_total is not None and data.expected_total != total) or (
        data.expected_currency is not None and data.expected_currency != info.currency
    ):
        raise Conflict("price_changed", "The price changed. Review the updated quote before reserving.")

    now = utcnow()
    # Same transaction: an overdue hold must not block these dates until the worker runs.
    await repo.expire_listing_holds(session, info.id, now)
    booking = Booking(
        listing_id=info.id,
        guest_id=user_id,
        check_in=data.check_in,
        check_out=data.check_out,
        adults=data.adults,
        children=data.children,
        infants=data.infants,
        pets=data.pets,
        nightly_price=info.price_per_night,
        cleaning_fee=info.cleaning_fee,
        total_price=total,
        nightly_prices=[night.model_dump(mode="json") for night in quote.nights],
        currency=info.currency,
        status=S.pending,
        hold_expires_at=now + timedelta(minutes=settings.hold_minutes),
        idempotency_key=key,
    )
    session.add(booking)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        code = sqlstate(exc)
        if code == EXCLUSION_VIOLATION:
            BOOKING_CONFLICTS.inc()
            raise Conflict("dates_unavailable", "These dates were just booked.") from exc
        if code == UNIQUE_VIOLATION and constraint_name(exc) in (None, "bookings_idempotency_key_key"):
            # The same key raced us; the winner's row is now visible.
            winner = await repo.by_idempotency_key(session, key)
            if winner is not None:
                return _replay(winner, user_id, data), False
        raise
    BOOKING_EVENTS.labels("created").inc()
    return booking, True


async def _participant_booking(session: AsyncSession, booking_id: int, user_id: int) -> tuple[Booking, ListingInfo]:
    booking = await repo.get(session, booking_id)
    if booking is None:
        raise NotFound("Booking not found.")
    info = await listings.get_listing_info(session, booking.listing_id)
    if user_id not in (booking.guest_id, info.host_id):
        raise NotFound("Booking not found.")  # don't reveal that it exists
    return booking, info


async def pay(session: AsyncSession, settings: Settings, booking_id: int, user_id: int) -> tuple[Booking, ListingInfo]:
    """Simulated payment. A real gateway would replace only this function's caller."""
    booking, info = await _participant_booking(session, booking_id, user_id)
    if booking.guest_id != user_id:
        raise Forbidden("Only the guest of this booking can pay.")
    now = utcnow()
    if await repo.confirm_if_payable(session, booking.id, user_id, now):
        # Both confirmation emails commit with the payment (feature 016): they exist exactly when the
        # booking is confirmed, and the worker sends them, so a mail server never touches the payment.
        await notifications.queue_booking_confirmed(
            session,
            settings,
            booking_id=booking.id,
            guest_id=booking.guest_id,
            host_id=info.host_id,
            listing_id=info.id,
            title=info.title,
            check_in=booking.check_in,
            check_out=booking.check_out,
            guests=booking.adults + booking.children,
            total=booking.total_price,
            currency=booking.currency,
        )
        await session.commit()
        BOOKING_EVENTS.labels("confirmed").inc()
        await session.refresh(booking)
        return booking, info

    await session.refresh(booking)
    if booking.status == S.pending:  # the hold ran out but the worker hasn't run yet
        if await repo.set_status_if(session, booking.id, {S.pending}, S.expired):
            BOOKING_EVENTS.labels("expired").inc()
        await session.commit()
        raise Conflict("hold_expired", "The hold expired before payment. Book again.")
    if booking.status == S.expired:
        raise Conflict("hold_expired", "The hold expired before payment. Book again.")
    raise Conflict("invalid_booking_state", f"A {booking.status.value} booking cannot be paid.")


async def cancel(session: AsyncSession, booking_id: int, user_id: int) -> tuple[Booking, ListingInfo]:
    """Guest or host, before the check-in day in the listing's city. No fee and no refund."""
    booking, info = await _participant_booking(session, booking_id, user_id)
    if not rules.can_transition(booking.status, S.cancelled):
        raise Conflict("invalid_booking_state", f"A {booking.status.value} booking cannot be cancelled.")
    if today_in(info.city.timezone) >= booking.check_in:
        raise Conflict("invalid_booking_state", "Bookings can be cancelled only before the check-in day.")
    if not await repo.set_status_if(session, booking.id, {S.pending, S.confirmed}, S.cancelled):
        await session.rollback()
        raise Conflict("invalid_booking_state", "The booking changed meanwhile. Reload it.")
    await session.commit()
    BOOKING_EVENTS.labels("cancelled").inc()
    await session.refresh(booking)
    return booking, info


async def get_booking(session: AsyncSession, booking_id: int, user_id: int) -> tuple[Booking, ListingInfo]:
    return await _participant_booking(session, booking_id, user_id)


# ---- output ---------------------------------------------------------------------------


def to_out(booking: Booking, info: ListingInfo, cover_url: str | None, viewer_id: int) -> BookingOut:
    show_address = booking.status in (S.confirmed, S.completed) and viewer_id in (booking.guest_id, info.host_id)
    return BookingOut(
        id=booking.id,
        status=booking.status,
        listing=BookingListing(
            id=info.id,
            title=info.title,
            city=info.city.name,
            country_code=info.city.country.code,
            timezone=info.city.timezone,
            cover_url=cover_url,
        ),
        guest_id=booking.guest_id,
        host_id=info.host_id,
        check_in=booking.check_in,
        check_out=booking.check_out,
        nights=rules.nights(booking.check_in, booking.check_out),
        adults=booking.adults,
        children=booking.children,
        infants=booking.infants,
        pets=booking.pets,
        nightly_price=booking.nightly_price,
        cleaning_fee=booking.cleaning_fee,
        total_price=booking.total_price,
        nightly_prices=booking.nightly_prices,
        currency=booking.currency,
        hold_expires_at=booking.hold_expires_at,
        created_at=booking.created_at,
        paid_at=booking.paid_at,
        address=(
            BookingAddress(
                address=info.address,
                latitude=info.latitude,
                longitude=info.longitude,
                check_in_time=info.check_in_time.strftime("%H:%M"),
                check_out_time=info.check_out_time.strftime("%H:%M"),
            )
            if show_address
            else None
        ),
    )


async def render(
    session: AsyncSession, storage: Storage, booking: Booking, info: ListingInfo, viewer_id: int
) -> BookingOut:
    covers = await listings.cover_urls(session, storage, [info.id])
    return to_out(booking, info, covers.get(info.id), viewer_id)


async def _render_page(
    session: AsyncSession, storage: Storage, bookings: list[Booking], total: int, viewer_id: int
) -> BookingPage:
    listing_ids = sorted({b.listing_id for b in bookings})
    infos = {lid: await listings.get_listing_info(session, lid) for lid in listing_ids}
    covers = await listings.cover_urls(session, storage, listing_ids)
    items = [to_out(b, infos[b.listing_id], covers.get(b.listing_id), viewer_id) for b in bookings]
    return BookingPage(items=items, total=total)


async def my_bookings(
    session: AsyncSession, storage: Storage, user_id: int, status: BookingStatus | None, limit: int, offset: int
) -> BookingPage:
    bookings, total = await repo.guest_bookings(session, user_id, status, limit, offset)
    return await _render_page(session, storage, bookings, total, user_id)


async def listing_bookings(
    session: AsyncSession,
    storage: Storage,
    listing_id: int,
    user_id: int,
    status: BookingStatus | None,
    limit: int,
    offset: int,
) -> BookingPage:
    await listings.require_host(session, listing_id, user_id)
    bookings, total = await repo.listing_bookings(session, listing_id, status, limit, offset)
    return await _render_page(session, storage, bookings, total, user_id)


async def admin_bookings(
    session: AsyncSession,
    storage: Storage,
    status: BookingStatus | None,
    limit: int,
    offset: int,
    *,
    order: SortOrder = "desc",
) -> tuple[list[BookingOut], bool]:
    """Every booking, newest first, as the admin sees it (feature 051): no address, since the admin is
    neither the guest nor the host. Also returns whether a next page exists."""
    bookings, has_more = await repo.admin_bookings(session, status, limit, offset, order=order)
    page = await _render_page(session, storage, bookings, 0, viewer_id=0)
    return page.items, has_more


async def status_counts(session: AsyncSession) -> dict[BookingStatus, int]:
    return await repo.status_counts(session)


# A year and a bit: enough for the calendar's furthest month, small enough to answer quickly.
MAX_AVAILABILITY_DAYS = 400


async def availability(
    session: AsyncSession, listing_id: int, viewer_id: int | None, start: date | None, end: date | None
) -> ListingAvailability:
    """The listing's taken nights (feature 019), for whoever may see its page."""
    await listings.require_visible_listing(session, listing_id, viewer_id)
    info = await listings.get_listing_info(session, listing_id)
    start = start or today_in(info.city.timezone)
    end = end or start + timedelta(days=365)
    if end <= start or (end - start).days > MAX_AVAILABILITY_DAYS:
        raise Unprocessable("invalid_dates", f"end must be after start, at most {MAX_AVAILABILITY_DAYS} days later.")
    nights: set[date] = set()
    for check_in, check_out in await repo.booked_ranges(session, listing_id, start, end, utcnow()):
        day = max(check_in, start)
        while day < min(check_out, end):
            nights.add(day)
            day += timedelta(days=1)
    return ListingAvailability(start=start, end=end, booked_nights=sorted(nights))


# ---- for other modules ----------------------------------------------------------------


async def get_booking_info(session: AsyncSession, booking_id: int) -> BookingInfo:
    booking = await repo.get(session, booking_id)
    if booking is None:
        raise NotFound("Booking not found.")
    info = await listings.get_listing_info(session, booking.listing_id)
    return BookingInfo(
        id=booking.id,
        listing_id=booking.listing_id,
        guest_id=booking.guest_id,
        status=booking.status,
        check_out=booking.check_out,
        timezone=info.city.timezone,
    )


# ---- worker jobs ----------------------------------------------------------------------


async def expire_overdue_holds(session: AsyncSession) -> int:
    count = await repo.expire_overdue_holds(session, utcnow())
    await session.commit()
    BOOKING_EVENTS.labels("expired").inc(count)
    return count


async def complete_finished_stays(session: AsyncSession) -> int:
    count = await repo.complete_finished_stays(session, utcnow())
    await session.commit()
    BOOKING_EVENTS.labels("completed").inc(count)
    return count


async def admin_bookings_by_ids(session: AsyncSession, storage: Storage, ids: list[int]) -> list[BookingOut]:
    """Render an already ordered admin page without exposing exact addresses."""
    rows = await repo.get_many(session, ids)
    return (await _render_page(session, storage, rows, 0, viewer_id=0)).items
