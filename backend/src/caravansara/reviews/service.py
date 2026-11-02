"""Reviews: one per completed stay, by its guest, within the review window. Never edited."""

from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.bookings import service as bookings
from caravansara.core.config import Settings
from caravansara.core.errors import Conflict, Forbidden, NotFound
from caravansara.core.timeutil import today_in
from caravansara.identity import service as identity
from caravansara.identity.service import PublicUser
from caravansara.listings import service as listings
from caravansara.reviews import repository as repo
from caravansara.reviews.models import Review
from caravansara.reviews.schemas import ReviewAuthor, ReviewCreate, ReviewOut, ReviewPage


def _out(review: Review, author: PublicUser) -> ReviewOut:
    return ReviewOut(
        id=review.id,
        booking_id=review.booking_id,
        listing_id=review.listing_id,
        author=ReviewAuthor(id=author.id, full_name=author.full_name, avatar_url=author.avatar_url),
        rating=review.rating,
        cleanliness_rating=review.cleanliness_rating,
        accuracy_rating=review.accuracy_rating,
        check_in_rating=review.check_in_rating,
        communication_rating=review.communication_rating,
        location_rating=review.location_rating,
        value_rating=review.value_rating,
        comment=review.comment,
        created_at=review.created_at,
    )


async def create_review(
    session: AsyncSession, settings: Settings, booking_id: int, user_id: int, data: ReviewCreate
) -> ReviewOut:
    booking = await bookings.get_booking_info(session, booking_id)
    if booking.guest_id != user_id:
        raise NotFound("Booking not found.")
    if booking.status != bookings.BookingStatus.completed:
        raise Conflict("invalid_booking_state", "Only a completed stay can be reviewed.")
    if await repo.exists_for_booking(session, booking.id):
        raise Conflict("already_reviewed", "This stay already has a review.")
    deadline = booking.check_out + timedelta(days=settings.review_window_days)
    if today_in(booking.timezone) > deadline:
        raise Forbidden(
            f"Reviews close {settings.review_window_days} days after check-out.", code="review_window_closed"
        )
    review = Review(booking_id=booking.id, listing_id=booking.listing_id, guest_id=user_id, **data.model_dump())
    session.add(review)
    try:
        await session.commit()  # the trigger refreshes the listing's avg_rating and review_count
    except IntegrityError as exc:  # a second review raced us
        await session.rollback()
        raise Conflict("already_reviewed", "This stay already has a review.") from exc
    return _out(review, await identity.get_public_user(session, user_id))


async def listing_reviews(session: AsyncSession, listing_id: int, limit: int, offset: int) -> ReviewPage:
    await listings.get_listing_info(session, listing_id)  # 404 for an unknown listing
    reviews, total = await repo.listing_reviews(session, listing_id, limit, offset)
    authors = await identity.get_public_users(session, {r.guest_id for r in reviews})
    return ReviewPage(items=[_out(r, authors[r.guest_id]) for r in reviews], total=total)
