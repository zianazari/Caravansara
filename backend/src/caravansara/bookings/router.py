import uuid
from typing import Annotated

from fastapi import APIRouter, Header, Query, Response, status

from caravansara.bookings import service
from caravansara.bookings.models import BookingStatus
from caravansara.bookings.schemas import BookingCreate, BookingOut, BookingPage
from caravansara.core.db import SessionDep
from caravansara.core.deps import StorageDep
from caravansara.core.errors import error_responses
from caravansara.core.pagination import PageDep
from caravansara.core.security import CurrentUserId, SettingsDep
from caravansara.reviews import service as reviews


async def _with_reviews(session: SessionDep, page: BookingPage) -> BookingPage:
    """Marks the reviewed stays. In the router, not the bookings service, because reviews already depends on
    bookings; the other way round would make the two modules import each other (feature 015)."""
    done = await reviews.reviewed(session, [b.id for b in page.items])
    return page.model_copy(update={"items": [b.model_copy(update={"has_review": b.id in done}) for b in page.items]})


async def _one(session: SessionDep, booking: BookingOut) -> BookingOut:
    return booking.model_copy(update={"has_review": bool(await reviews.reviewed(session, [booking.id]))})


router = APIRouter(tags=["Bookings"])

StatusFilter = Annotated[BookingStatus | None, Query(description="Only bookings in this status.")]


@router.post(
    "/bookings",
    status_code=status.HTTP_201_CREATED,
    summary="Reserve (start a 15-minute hold)",
    description=(
        "Creates a `pending` booking that holds the dates until `hold_expires_at`; then call "
        "`POST /bookings/{id}/pay`.\n\n"
        "Send a new UUID in `Idempotency-Key` for every reservation. Retrying with the same key and "
        "body returns the same booking with **200** instead of creating a second one.\n\n"
        "Two guests can never hold overlapping nights: the loser of a race gets **409 dates_unavailable**."
    ),
    responses={
        200: {"model": BookingOut, "description": "Replay of an earlier request with the same key"},
        **error_responses(401, 403, 404, 409, 422),
    },
)
async def create_booking(
    body: BookingCreate,
    response: Response,
    user_id: CurrentUserId,
    session: SessionDep,
    settings: SettingsDep,
    storage: StorageDep,
    idempotency_key: Annotated[uuid.UUID, Header(alias="Idempotency-Key", description="A new UUID per reservation.")],
) -> BookingOut:
    booking, created = await service.create_booking(session, settings, user_id, idempotency_key, body)
    if not created:
        response.status_code = status.HTTP_200_OK
    booking, info = await service.get_booking(session, booking.id, user_id)
    return await _one(session, await service.render(session, storage, booking, info, user_id))


@router.get(
    "/me/bookings", summary="My trips", description="Bookings where I am the guest.", responses=error_responses(401)
)
async def my_bookings(
    user_id: CurrentUserId, session: SessionDep, storage: StorageDep, page: PageDep, status: StatusFilter = None
) -> BookingPage:
    return await _with_reviews(
        session, await service.my_bookings(session, storage, user_id, status, page.limit, page.offset)
    )


@router.get(
    "/bookings/{booking_id}",
    summary="Booking details",
    description="For the guest or the host. The exact address appears once the booking is confirmed.",
    responses=error_responses(401, 404),
)
async def get_booking(booking_id: int, user_id: CurrentUserId, session: SessionDep, storage: StorageDep) -> BookingOut:
    booking, info = await service.get_booking(session, booking_id, user_id)
    return await _one(session, await service.render(session, storage, booking, info, user_id))


@router.post(
    "/bookings/{booking_id}/pay",
    summary="Pay (simulated)",
    description="Confirms a pending hold. After `hold_expires_at` it fails with **409 hold_expired**.",
    responses=error_responses(401, 403, 404, 409),
)
async def pay(
    booking_id: int, user_id: CurrentUserId, session: SessionDep, storage: StorageDep, settings: SettingsDep
) -> BookingOut:
    booking, info = await service.pay(session, settings, booking_id, user_id)
    return await _one(session, await service.render(session, storage, booking, info, user_id))


@router.post(
    "/bookings/{booking_id}/cancel",
    summary="Cancel",
    description="Guest or host, before the check-in day (city time). No fee and no refund.",
    responses=error_responses(401, 404, 409),
)
async def cancel(booking_id: int, user_id: CurrentUserId, session: SessionDep, storage: StorageDep) -> BookingOut:
    booking, info = await service.cancel(session, booking_id, user_id)
    return await _one(session, await service.render(session, storage, booking, info, user_id))


@router.get(
    "/listings/{listing_id}/bookings",
    summary="Bookings of my listing",
    tags=["Listings"],
    responses=error_responses(401, 403, 404),
)
async def listing_bookings(
    listing_id: int,
    user_id: CurrentUserId,
    session: SessionDep,
    storage: StorageDep,
    page: PageDep,
    status: StatusFilter = None,
) -> BookingPage:
    return await _with_reviews(
        session, await service.listing_bookings(session, storage, listing_id, user_id, status, page.limit, page.offset)
    )
