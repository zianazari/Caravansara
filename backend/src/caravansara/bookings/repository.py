from datetime import datetime

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.bookings.models import Booking, BookingStatus

S = BookingStatus


async def get(session: AsyncSession, booking_id: int, *, for_update: bool = False) -> Booking | None:
    query = select(Booking).where(Booking.id == booking_id)
    if for_update:
        query = query.with_for_update()
    return (await session.execute(query)).scalar_one_or_none()


async def by_idempotency_key(session: AsyncSession, key: object) -> Booking | None:
    return (await session.execute(select(Booking).where(Booking.idempotency_key == key))).scalar_one_or_none()


async def expire_listing_holds(session: AsyncSession, listing_id: int, now: datetime) -> None:
    """Free dates held by unpaid, overdue holds before trying to book them."""
    await session.execute(
        update(Booking)
        .where(Booking.listing_id == listing_id, Booking.status == S.pending, Booking.hold_expires_at <= now)
        .values(status=S.expired, hold_expires_at=None)
    )


async def confirm_if_payable(session: AsyncSession, booking_id: int, guest_id: int, now: datetime) -> bool:
    """Conditional update: when payment and expiry race, exactly one wins."""
    result = await session.execute(
        update(Booking)
        .where(
            Booking.id == booking_id,
            Booking.guest_id == guest_id,
            Booking.status == S.pending,
            Booking.hold_expires_at > now,
        )
        .values(status=S.confirmed, hold_expires_at=None)
        .returning(Booking.id)
        .execution_options(synchronize_session=False)
    )
    return result.first() is not None


async def set_status_if(
    session: AsyncSession, booking_id: int, current: set[BookingStatus], target: BookingStatus
) -> bool:
    result = await session.execute(
        update(Booking)
        .where(Booking.id == booking_id, Booking.status.in_(current))
        .values(status=target, hold_expires_at=None)
        .returning(Booking.id)
        .execution_options(synchronize_session=False)
    )
    return result.first() is not None


async def expire_overdue_holds(session: AsyncSession, now: datetime) -> int:
    """Worker job. Uses the partial index on pending ``hold_expires_at``."""
    result = await session.execute(
        update(Booking)
        .where(Booking.status == S.pending, Booking.hold_expires_at <= now)
        .values(status=S.expired, hold_expires_at=None)
        .returning(Booking.id)
        .execution_options(synchronize_session=False)
    )
    return len(result.all())


_COMPLETE_FINISHED = text(
    """
    UPDATE bookings b
    SET    status = 'completed'
    FROM   listings l
    JOIN   cities c ON c.id = l.city_id
    WHERE  b.listing_id = l.id
      AND  b.status = 'confirmed'
      -- No time zone is more than 14 hours ahead of UTC, so a stay whose check-out has passed in its
      -- city checks out on this date at the latest. The bound lets an index skip every later stay
      -- (specs/backend (003) research R5); the exact test is the next line.
      AND  b.check_out <= ((CAST(:now AS timestamptz) AT TIME ZONE 'UTC') + interval '14 hours')::date
      -- check-out day and time are local to the city
      AND  (b.check_out + l.check_out_time) AT TIME ZONE c.timezone <= :now
    RETURNING b.id
    """
)


async def complete_finished_stays(session: AsyncSession, now: datetime) -> int:
    """Worker job: a confirmed stay becomes completed once check-out time passes in its city."""
    result = await session.execute(_COMPLETE_FINISHED, {"now": now})
    return len(result.all())


async def guest_bookings(
    session: AsyncSession, guest_id: int, status: BookingStatus | None, limit: int, offset: int
) -> tuple[list[Booking], int]:
    where = [Booking.guest_id == guest_id]
    if status is not None:
        where.append(Booking.status == status)
    total = (await session.execute(select(func.count()).select_from(Booking).where(*where))).scalar_one()
    rows = await session.execute(
        select(Booking).where(*where).order_by(Booking.check_in.desc(), Booking.id.desc()).limit(limit).offset(offset)
    )
    return list(rows.scalars()), int(total)


async def listing_bookings(
    session: AsyncSession, listing_id: int, status: BookingStatus | None, limit: int, offset: int
) -> tuple[list[Booking], int]:
    where = [Booking.listing_id == listing_id]
    if status is not None:
        where.append(Booking.status == status)
    total = (await session.execute(select(func.count()).select_from(Booking).where(*where))).scalar_one()
    rows = await session.execute(
        select(Booking).where(*where).order_by(Booking.check_in, Booking.id).limit(limit).offset(offset)
    )
    return list(rows.scalars()), int(total)
