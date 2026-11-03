"""Reviews: completed stays only, once, within 14 days, by the guest; the rating cache follows."""

from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.timeutil import today_in
from tests.helpers import User, create_listing, insert_booking, register, reserve

REVIEW = {"rating": 4, "cleanliness_rating": 5, "comment": "Great stay."}


@pytest.fixture
async def stay(client: AsyncClient, db: AsyncEngine) -> tuple[User, User, int, int]:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    today = date.today()
    booking = await insert_booking(db, listing["id"], guest.id, today - timedelta(days=4), today - timedelta(days=2))
    return host, guest, int(listing["id"]), booking


async def test_review_a_completed_stay(client: AsyncClient, stay: tuple[User, User, int, int]) -> None:
    _, guest, lid, booking = stay
    r = await client.post(f"/bookings/{booking}/review", json=REVIEW, headers=guest.auth)
    assert r.status_code == 201
    assert r.json()["author"]["full_name"] == "Guest"
    listing = (await client.get(f"/listings/{lid}")).json()
    assert (listing["avg_rating"], listing["review_count"]) == ("4.00", 1)

    again = await client.post(f"/bookings/{booking}/review", json=REVIEW, headers=guest.auth)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "already_reviewed"

    page = (await client.get(f"/listings/{lid}/reviews")).json()
    assert page["total"] == 1
    assert page["items"][0]["comment"] == "Great stay."


async def test_only_the_guest_reviews(client: AsyncClient, stay: tuple[User, User, int, int]) -> None:
    host, _, _, booking = stay
    r = await client.post(f"/bookings/{booking}/review", json=REVIEW, headers=host.auth)
    assert r.status_code == 404


async def test_a_pending_stay_cannot_be_reviewed(client: AsyncClient, stay: tuple[User, User, int, int]) -> None:
    _, guest, lid, _ = stay
    booking = (await reserve(client, guest, lid)).json()
    r = await client.post(f"/bookings/{booking['id']}/review", json=REVIEW, headers=guest.auth)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "invalid_booking_state"


async def test_review_window(client: AsyncClient, db: AsyncEngine, stay: tuple[User, User, int, int]) -> None:
    _, guest, lid, _ = stay
    today = date.today()
    old = await insert_booking(db, lid, guest.id, today - timedelta(days=20), today - timedelta(days=16))
    r = await client.post(f"/bookings/{old}/review", json=REVIEW, headers=guest.auth)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "review_window_closed"
    edge = await insert_booking(db, lid, guest.id, today - timedelta(days=15), today - timedelta(days=13))
    assert (await client.post(f"/bookings/{edge}/review", json=REVIEW, headers=guest.auth)).status_code == 201


async def test_review_validation_and_unknowns(client: AsyncClient, stay: tuple[User, User, int, int]) -> None:
    _, guest, _, booking = stay
    bad = await client.post(f"/bookings/{booking}/review", json={"rating": 6, "comment": ""}, headers=guest.auth)
    assert bad.status_code == 422
    assert (await client.post("/bookings/999/review", json=REVIEW, headers=guest.auth)).status_code == 404
    assert (await client.get("/listings/999/reviews")).status_code == 404


async def test_review_window_is_14_days_in_city_time(
    client: AsyncClient, db: AsyncEngine, stay: tuple[User, User, int, int]
) -> None:
    _, guest, lid, _ = stay
    today = today_in("Europe/Amsterdam")  # the listing's city decides "today"
    last_day = await insert_booking(db, lid, guest.id, today - timedelta(days=15), today - timedelta(days=14))
    too_late = await insert_booking(db, lid, guest.id, today - timedelta(days=17), today - timedelta(days=15))
    assert (await client.post(f"/bookings/{last_day}/review", json=REVIEW, headers=guest.auth)).status_code == 201
    late = await client.post(f"/bookings/{too_late}/review", json=REVIEW, headers=guest.auth)
    assert late.status_code == 403
    assert late.json()["error"]["code"] == "review_window_closed"
