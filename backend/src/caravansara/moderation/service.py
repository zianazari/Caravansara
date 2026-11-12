"""Admin review of listings (specs/backend (004)). Uses other modules through their service only.

The review state lives in ``listings``; this module adds the admin's side: login, the queue, the
details with the exact address (recorded), and decisions.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.bookings import service as bookings
from caravansara.bookings.service import BookingStatus
from caravansara.core.config import Settings
from caravansara.core.storage import Storage
from caravansara.identity import service as identity
from caravansara.identity.schemas import AdminTokenOut, AdminUserPage
from caravansara.listings import service as listings
from caravansara.listings.schemas import AdminListingOut, AdminQueuePage
from caravansara.moderation import repository as repo
from caravansara.moderation.schemas import AdminBookingOut, AdminBookingPage, AdminSummary, BookingCounts


async def login(session: AsyncSession, settings: Settings, *, email: str, password: str, ip: str) -> AdminTokenOut:
    return await identity.admin_login(session, settings, email=email, password=password, ip=ip)


async def refresh(session: AsyncSession, settings: Settings, refresh_token: str) -> AdminTokenOut:
    return await identity.admin_refresh(session, settings, refresh_token)


async def logout(session: AsyncSession, refresh_token: str) -> None:
    await identity.logout(session, refresh_token)


async def queue(
    session: AsyncSession, storage: Storage, limit: int, offset: int, *, newest_first: bool = False
) -> AdminQueuePage:
    return await listings.review_queue(session, storage, limit, offset, newest_first=newest_first)


async def detail(session: AsyncSession, storage: Storage, listing_id: int, admin_id: int) -> AdminListingOut:
    """The answer and its address-view row commit together (FR-018)."""
    out = await listings.review_detail(session, storage, listing_id)
    await repo.record_address_view(session, admin_id, listing_id)
    await session.commit()
    return out


async def approve(
    session: AsyncSession, storage: Storage, settings: Settings, listing_id: int, admin_id: int, version: int
) -> AdminListingOut:
    return await listings.approve(session, storage, settings, listing_id, admin_id, version)


async def reject(
    session: AsyncSession,
    storage: Storage,
    settings: Settings,
    listing_id: int,
    admin_id: int,
    version: int,
    reason: str,
) -> AdminListingOut:
    return await listings.reject(session, storage, settings, listing_id, admin_id, version, reason)


# ---- the panel's lists (feature 051) ---------------------------------------------


async def users(session: AsyncSession, q: str | None, limit: int, offset: int) -> AdminUserPage:
    return await identity.admin_users(session, q, limit, offset)


async def all_bookings(
    session: AsyncSession, storage: Storage, status: BookingStatus | None, limit: int, offset: int
) -> AdminBookingPage:
    items, has_more = await bookings.admin_bookings(session, storage, status, limit, offset)
    guests = await identity.user_contacts(session, {b.guest_id for b in items})
    return AdminBookingPage(
        items=[
            AdminBookingOut(
                **b.model_dump(), guest_name=guests[b.guest_id].full_name, guest_email=guests[b.guest_id].email
            )
            for b in items
        ],
        has_more=has_more,
    )


async def summary(session: AsyncSession) -> AdminSummary:
    pending, _ = await listings.review_queue_stats(session)
    accounts = await identity.admin_users(session, None, 1, 0)
    counts = await bookings.status_counts(session)
    return AdminSummary(
        pending_listings=pending,
        users=accounts.total,
        bookings=BookingCounts(**{status.value: n for status, n in counts.items()}),
    )
