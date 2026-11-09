"""Admin endpoints under ``/api/v1/admin`` (specs/backend (004), contracts.md).

Order of the checks, on every route: the Host guard first (when ``admin_host`` is set, any other
Host gets 404, as if the routes were not there), then the admin token, then the account in the
database. Only after all three does a route look at a listing, so without an admin login nothing
about any listing comes back, not even whether it exists (FR-020, research R13).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from caravansara.core.db import SessionDep
from caravansara.core.deps import ClientIp, StorageDep
from caravansara.core.errors import NotFound, error_responses
from caravansara.core.pagination import PageDep
from caravansara.core.security import CurrentAdminId, SettingsDep
from caravansara.identity import service as identity
from caravansara.identity.schemas import AdminTokenOut
from caravansara.listings.schemas import AdminListingOut, AdminQueuePage
from caravansara.moderation import service
from caravansara.moderation.schemas import AdminLoginIn, DecisionIn, RejectIn


async def admin_host_guard(request: Request, settings: SettingsDep) -> None:
    """Keeps the admin routes on their own subdomain when one is configured (research R12)."""
    if settings.admin_host and request.url.hostname != settings.admin_host:
        raise NotFound()


async def _admin_id(admin_id: CurrentAdminId, session: SessionDep) -> int:
    await identity.require_active_admin(session, admin_id)
    return admin_id


AdminId = Annotated[int, Depends(_admin_id)]

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(admin_host_guard)])


@router.post(
    "/auth/login",
    summary="Admin log in",
    description=(
        "Admin accounts are made only with `caravansara create-admin` on the server. The token lasts "
        "15 minutes and has no refresh token. Member accounts cannot log in here, and an admin token "
        "works on no member endpoint."
    ),
    responses=error_responses(401, 422, 429),
)
async def admin_login(body: AdminLoginIn, session: SessionDep, settings: SettingsDep, ip: ClientIp) -> AdminTokenOut:
    return await service.login(session, settings, email=body.email, password=body.password, ip=ip)


@router.get(
    "/listings/pending",
    summary="Review queue",
    description="Listings waiting for review, oldest first. Each has the `review_version` to decide on.",
    responses=error_responses(401),
)
async def review_queue(admin_id: AdminId, session: SessionDep, storage: StorageDep, page: PageDep) -> AdminQueuePage:
    return await service.queue(session, storage, page.limit, page.offset)


@router.get(
    "/listings/{listing_id}",
    summary="Listing for review",
    description=(
        "Any listing in any state, with its exact address. Every call is recorded: which admin, which listing, when."
    ),
    responses=error_responses(401, 404),
)
async def review_detail(
    listing_id: int, admin_id: AdminId, session: SessionDep, storage: StorageDep
) -> AdminListingOut:
    return await service.detail(session, storage, listing_id, admin_id)


@router.post(
    "/listings/{listing_id}/approve",
    summary="Approve a listing",
    description=(
        "Makes a pending listing public (if the host keeps it active). `409 listing_not_pending`: it is "
        "no longer pending, e.g. another admin decided first. `409 listing_changed`: the host edited it "
        "after you opened it; open it again."
    ),
    responses=error_responses(401, 404, 409, 422),
)
async def approve(
    listing_id: int, body: DecisionIn, admin_id: AdminId, session: SessionDep, storage: StorageDep
) -> AdminListingOut:
    return await service.approve(session, storage, listing_id, admin_id, body.review_version)


@router.post(
    "/listings/{listing_id}/reject",
    summary="Reject a listing",
    description=("Keeps it hidden and shows the host your reason, 1 to 1000 characters. The same 409s as approve."),
    responses=error_responses(401, 404, 409, 422),
)
async def reject(
    listing_id: int, body: RejectIn, admin_id: AdminId, session: SessionDep, storage: StorageDep
) -> AdminListingOut:
    return await service.reject(session, storage, listing_id, admin_id, body.review_version, body.reason)
