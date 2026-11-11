from fastapi import APIRouter, status

from caravansara.core.db import SessionDep
from caravansara.core.errors import error_responses
from caravansara.core.pagination import PageDep
from caravansara.core.security import CurrentUserId, OptionalUserId, SettingsDep
from caravansara.reviews import service
from caravansara.reviews.schemas import ReviewCreate, ReviewOut, ReviewPage, ReviewSummary

router = APIRouter(tags=["Reviews"])


@router.post(
    "/bookings/{booking_id}/review",
    status_code=status.HTTP_201_CREATED,
    summary="Review a stay",
    description=(
        "Only the guest, only for a `completed` booking, at most once, and within 14 days of "
        "check-out. Reviews cannot be edited or deleted."
    ),
    responses=error_responses(401, 403, 404, 409, 422),
)
async def create_review(
    booking_id: int, body: ReviewCreate, user_id: CurrentUserId, session: SessionDep, settings: SettingsDep
) -> ReviewOut:
    return await service.create_review(session, settings, booking_id, user_id, body)


@router.get(
    "/listings/{listing_id}/reviews",
    summary="Reviews of a listing",
    description=(
        "Newest first. Whoever can open the listing can read its reviews: everyone for a public listing; "
        "for one that is not public, only its host and a guest with a booking there."
    ),
    responses=error_responses(401, 404),
)
async def listing_reviews(listing_id: int, viewer_id: OptionalUserId, session: SessionDep, page: PageDep) -> ReviewPage:
    return await service.listing_reviews(session, listing_id, viewer_id, page.limit, page.offset)


@router.get(
    "/listings/{listing_id}/reviews/summary",
    summary="Review summary of a listing",
    description=(
        "All of the listing's reviews in numbers: how many gave each star (5 down to 1) and the average of "
        "each category over the reviews that rated it; a category nobody rated is null. The same access "
        "rule as the reviews themselves."
    ),
    responses=error_responses(401, 404),
)
async def review_summary(listing_id: int, viewer_id: OptionalUserId, session: SessionDep) -> ReviewSummary:
    return await service.review_summary(session, listing_id, viewer_id)
