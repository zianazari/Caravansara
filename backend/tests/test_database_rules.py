"""The guarantees that live in the database itself, checked with raw SQL."""

import uuid
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.db import sqlstate
from tests.factories import Factory
from tests.helpers import create_listing, register, sql

D = date(2030, 5, 1)


@pytest.fixture
async def setup(client: AsyncClient, db: AsyncEngine) -> tuple[int, int]:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    return listing["id"], guest.id


async def test_overlapping_active_bookings_are_refused(
    db: AsyncEngine, setup: tuple[int, int], factory: Factory
) -> None:
    listing_id, guest_id = setup
    await factory.booking(
        listing=listing_id,
        guest=guest_id,
        check_in=date(2030, 5, 1),
        check_out=date(2030, 5, 5),
        status="confirmed",
    )
    with pytest.raises(IntegrityError) as err:
        await factory.booking(
            listing=listing_id,
            guest=guest_id,
            check_in=date(2030, 5, 4),
            check_out=date(2030, 5, 6),
            status="pending",
        )
    assert sqlstate(err.value) == "23P01"


async def test_same_day_turnover_is_allowed(db: AsyncEngine, setup: tuple[int, int], factory: Factory) -> None:
    listing_id, guest_id = setup
    await factory.booking(
        listing=listing_id,
        guest=guest_id,
        check_in=date(2030, 5, 1),
        check_out=date(2030, 5, 5),
        status="confirmed",
    )
    await factory.booking(
        listing=listing_id,
        guest=guest_id,
        check_in=date(2030, 5, 5),
        check_out=date(2030, 5, 7),
        status="confirmed",
    )


@pytest.mark.parametrize("freed_by", ["cancelled", "expired"])
async def test_cancelled_and_expired_free_the_dates(
    db: AsyncEngine, setup: tuple[int, int], freed_by: str, factory: Factory
) -> None:
    listing_id, guest_id = setup
    await factory.booking(
        listing=listing_id, guest=guest_id, check_in=date(2030, 5, 1), check_out=date(2030, 5, 5), status=freed_by
    )
    await factory.booking(
        listing=listing_id,
        guest=guest_id,
        check_in=date(2030, 5, 1),
        check_out=date(2030, 5, 5),
        status="confirmed",
    )


async def test_idempotency_key_is_unique(db: AsyncEngine, setup: tuple[int, int]) -> None:
    listing_id, guest_id = setup
    key = uuid.uuid4()
    statement = """INSERT INTO bookings (listing_id, guest_id, check_in, check_out, adults, nightly_price,
                     total_price, currency, idempotency_key)
                   VALUES (:l, :g, :ci, :co, 1, 1, 1, 'EUR', :k)"""
    await sql(db, statement, l=listing_id, g=guest_id, ci=date(2030, 1, 1), co=date(2030, 1, 2), k=key)
    with pytest.raises(IntegrityError) as err:
        await sql(db, statement, l=listing_id, g=guest_id, ci=date(2030, 2, 1), co=date(2030, 2, 2), k=key)
    assert sqlstate(err.value) == "23505"


REVIEW = "INSERT INTO reviews (booking_id, listing_id, guest_id, rating, comment) VALUES (:b, :l, :g, :r, 'ok')"


async def test_review_needs_a_completed_booking(db: AsyncEngine, setup: tuple[int, int], factory: Factory) -> None:
    listing_id, guest_id = setup
    booking = (
        await factory.booking(
            listing=listing_id, guest=guest_id, check_in=D, check_out=date(2030, 5, 3), status="confirmed"
        )
    ).id
    with pytest.raises(DBAPIError, match="not completed"):
        await sql(db, REVIEW, b=booking, l=listing_id, g=guest_id, r=5)


async def test_review_must_match_its_booking(
    client: AsyncClient, db: AsyncEngine, setup: tuple[int, int], factory: Factory
) -> None:
    listing_id, guest_id = setup
    other = await register(client, "other")
    booking = (
        await factory.booking(
            listing=listing_id, guest=guest_id, check_in=D, check_out=date(2030, 5, 3), status="completed"
        )
    ).id
    with pytest.raises(IntegrityError):
        await sql(db, REVIEW, b=booking, l=listing_id, g=other.id, r=5)


async def test_rating_cache_follows_reviews(db: AsyncEngine, setup: tuple[int, int], factory: Factory) -> None:
    listing_id, guest_id = setup
    for i, rating in enumerate((5, 4)):
        booking = (
            await factory.booking(
                listing=listing_id,
                guest=guest_id,
                check_in=date(2030, 6, 1 + 2 * i),
                check_out=date(2030, 6, 2 + 2 * i),
                status="completed",
            )
        ).id
        await sql(db, REVIEW, b=booking, l=listing_id, g=guest_id, r=rating)
    rows = await sql(db, "SELECT avg_rating, review_count FROM listings WHERE id = :id", id=listing_id)
    assert (float(rows[0][0]), rows[0][1]) == (4.5, 2)
    with pytest.raises(IntegrityError):  # one review per booking
        await sql(db, REVIEW, b=booking, l=listing_id, g=guest_id, r=3)


async def test_pets_need_pets_allowed(db: AsyncEngine, setup: tuple[int, int]) -> None:
    listing_id, _ = setup
    with pytest.raises(IntegrityError):
        await sql(db, "UPDATE listings SET pets_allowed = false, max_pets = 2 WHERE id = :id", id=listing_id)


async def test_email_is_unique_ignoring_case(db: AsyncEngine, setup: tuple[int, int]) -> None:
    statement = "INSERT INTO users (email, password_hash, full_name) VALUES (:e, 'x', 'X')"
    await sql(db, statement, e="Case@Example.com")
    with pytest.raises(IntegrityError):
        await sql(db, statement, e="case@example.com")


async def test_photo_order_is_checked_at_commit(db: AsyncEngine, setup: tuple[int, int]) -> None:
    listing_id, _ = setup
    for i in range(2):
        await sql(
            db,
            "INSERT INTO listing_photos (listing_id, storage_key, width, height, sort_order) VALUES (:l, :k, 1, 1, :o)",
            l=listing_id,
            k=f"k{i}",
            o=i,
        )
    async with db.begin() as conn:  # swapping the cover in one transaction works
        await conn.execute(text("UPDATE listing_photos SET sort_order = 1 WHERE storage_key = 'k0'"))
        await conn.execute(text("UPDATE listing_photos SET sort_order = 0 WHERE storage_key = 'k1'"))
    with pytest.raises(IntegrityError):
        await sql(db, "UPDATE listing_photos SET sort_order = 0 WHERE listing_id = :l", l=listing_id)
