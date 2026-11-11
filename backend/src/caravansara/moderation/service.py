"""Admin review of listings (specs/backend (004)). Uses other modules through their service only.

The review state lives in ``listings``; this module adds the admin's side: login, the queue, the
details with the exact address (recorded), and decisions.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.core.config import Settings
from caravansara.core.storage import Storage
from caravansara.identity import service as identity
from caravansara.identity.schemas import AdminTokenOut
from caravansara.listings import service as listings
from caravansara.listings.schemas import AdminListingOut, AdminQueuePage
from caravansara.moderation import repository as repo


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
