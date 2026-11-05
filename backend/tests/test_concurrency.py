"""Races: many guests, one listing; one key twice at once; payment against expiry."""

import asyncio
import uuid
from datetime import date, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.bookings import repository as bookings_repo
from caravansara.identity import repository as identity_repo
from caravansara.jobs.runner import run_once
from caravansara.reviews import repository as reviews_repo
from tests.factories import Factory
from tests.helpers import PASSWORD, User, create_listing, register, reserve, sql


async def test_twenty_concurrent_requests_give_exactly_one_booking(client: AsyncClient, db: AsyncEngine) -> None:
    host = await register(client, "host")
    listing = await create_listing(client, host)
    guests = [await register(client, f"g{i}") for i in range(20)]
    results = await asyncio.gather(*(reserve(client, g, listing["id"], 30, 33) for g in guests))
    codes = sorted(r.status_code for r in results)
    assert codes == [201] + [409] * 19
    assert all(r.json()["error"]["code"] == "dates_unavailable" for r in results if r.status_code == 409)
    rows = await sql(db, "SELECT count(*) FROM bookings WHERE status = 'pending'")
    assert rows[0][0] == 1


async def test_the_same_key_twice_at_once_books_once(client: AsyncClient, db: AsyncEngine) -> None:
    host = await register(client, "host")
    listing = await create_listing(client, host)
    guest = await register(client, "guest")
    key = uuid.uuid4()
    results = await asyncio.gather(*(reserve(client, guest, listing["id"], key=key) for _ in range(5)))
    assert sorted(r.status_code for r in results).count(201) == 1
    assert {r.json()["id"] for r in results} == {results[0].json()["id"]}
    assert (await sql(db, "SELECT count(*) FROM bookings"))[0][0] == 1


async def test_payment_racing_expiry_has_one_winner(
    client: AsyncClient, app: object, db: AsyncEngine, factory: Factory
) -> None:
    host = await register(client, "host")
    listing = await create_listing(client, host)
    guest = await register(client, "guest")
    booking = (await reserve(client, guest, listing["id"])).json()
    # Hold ends right now: payment and the worker reach the row together.
    await factory.expire_hold(booking["id"], -timedelta(milliseconds=50))
    await asyncio.sleep(0.05)
    pay, _jobs = await asyncio.gather(
        client.post(f"/bookings/{booking['id']}/pay", headers=guest.auth),
        run_once(app.state.sessionmaker),  # type: ignore[attr-defined]
    )
    status = (await sql(db, "SELECT status FROM bookings WHERE id = :id", id=booking["id"]))[0][0]
    if pay.status_code == 200:
        assert status == "confirmed"
    else:
        assert pay.json()["error"]["code"] == "hold_expired"
        assert status == "expired"


# ---- the code paths taken by the loser of a race --------------------------------------
# A plain concurrent test rarely reaches them, because the pre-check usually catches the
# duplicate first. Each test below recreates the exact moment of the race: the pre-check
# sees nothing, and the database constraint stops the second write.


async def test_registration_losing_the_email_race(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    first = await register(client, "first")
    monkeypatch.setattr(identity_repo, "get_user_by_email", _returns(None))  # the pre-check missed it
    r = await client.post("/auth/register", json={"email": first.email, "password": PASSWORD, "full_name": "Twin"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_taken"


async def test_same_email_at_once_creates_one_account(client: AsyncClient, db: AsyncEngine) -> None:
    body = {"email": "race@example.com", "password": PASSWORD, "full_name": "Racer"}
    results = await asyncio.gather(*(client.post("/auth/register", json=body) for _ in range(5)))
    assert sorted(r.status_code for r in results) == [201, 409, 409, 409, 409]
    assert (await sql(db, "SELECT count(*) FROM users WHERE lower(email) = 'race@example.com'"))[0][0] == 1


async def test_review_losing_the_race(
    client: AsyncClient, db: AsyncEngine, monkeypatch: pytest.MonkeyPatch, factory: Factory
) -> None:
    guest, booking = await _completed_stay(client, factory)
    review = {"rating": 5, "comment": "Lovely."}
    assert (await client.post(f"/bookings/{booking}/review", json=review, headers=guest.auth)).status_code == 201
    monkeypatch.setattr(reviews_repo, "exists_for_booking", _returns(False))  # the pre-check missed it
    r = await client.post(f"/bookings/{booking}/review", json=review, headers=guest.auth)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "already_reviewed"
    assert (await sql(db, "SELECT count(*) FROM reviews"))[0][0] == 1


async def test_two_reviews_at_once_keep_one(client: AsyncClient, db: AsyncEngine, factory: Factory) -> None:
    guest, booking = await _completed_stay(client, factory)
    review = {"rating": 4, "comment": "Fine."}
    results = await asyncio.gather(
        *(client.post(f"/bookings/{booking}/review", json=review, headers=guest.auth) for _ in range(4))
    )
    assert sorted(r.status_code for r in results) == [201, 409, 409, 409]
    rows = await sql(db, "SELECT review_count FROM listings")
    assert rows[0][0] == 1


async def test_cancel_losing_to_a_concurrent_change(
    client: AsyncClient, db: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    booking = (await reserve(client, guest, listing["id"])).json()

    real_get = bookings_repo.get

    async def get_then_expire(session: Any, booking_id: int, **kw: Any) -> Any:
        row = await real_get(session, booking_id, **kw)
        # Another transaction (the worker) expires the hold right after we read it.
        await sql(db, "UPDATE bookings SET status = 'expired', hold_expires_at = NULL WHERE id = :id", id=booking_id)
        return row

    monkeypatch.setattr(bookings_repo, "get", get_then_expire)
    r = await client.post(f"/bookings/{booking['id']}/cancel", headers=guest.auth)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "invalid_booking_state"
    status = (await sql(db, "SELECT status::text FROM bookings WHERE id = :id", id=booking["id"]))[0][0]
    assert status == "expired"  # the other change stands; cancel did not overwrite it


async def test_idempotency_key_losing_the_race(
    client: AsyncClient, db: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    key = uuid.uuid4()
    winner = (await reserve(client, guest, listing["id"], key=key)).json()

    real_lookup = bookings_repo.by_idempotency_key
    calls = 0

    async def miss_once(session: Any, k: Any) -> Any:
        nonlocal calls
        calls += 1
        return None if calls == 1 else await real_lookup(session, k)  # first lookup ran before the winner committed

    monkeypatch.setattr(bookings_repo, "by_idempotency_key", miss_once)
    r = await reserve(client, guest, listing["id"], key=key)
    assert r.status_code == 200
    assert r.json()["id"] == winner["id"]
    assert calls == 2
    assert (await sql(db, "SELECT count(*) FROM bookings"))[0][0] == 1


async def test_cancel_racing_payment_never_corrupts_the_booking(client: AsyncClient, db: AsyncEngine) -> None:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    for _ in range(5):
        booking = (await reserve(client, guest, listing["id"], 40, 42)).json()
        pay, cancel = await asyncio.gather(
            client.post(f"/bookings/{booking['id']}/pay", headers=guest.auth),
            client.post(f"/bookings/{booking['id']}/cancel", headers=guest.auth),
        )
        status = (await sql(db, "SELECT status::text FROM bookings WHERE id = :id", id=booking["id"]))[0][0]
        # Either order is legal: cancel first (pay then fails), or pay first and then cancel.
        assert cancel.status_code == 200
        assert status == "cancelled"
        assert pay.status_code in (200, 409)
        if pay.status_code == 409:
            assert pay.json()["error"]["code"] == "invalid_booking_state"


def _returns(value: Any) -> Any:
    async def fake(*_: Any, **__: Any) -> Any:
        return value

    return fake


async def _completed_stay(client: AsyncClient, factory: Factory) -> tuple[User, int]:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    today = date.today()
    booking = (
        await factory.booking(
            listing=listing["id"],
            guest=guest.id,
            check_in=today - timedelta(days=3),
            check_out=today - timedelta(days=1),
            status="completed",
        )
    ).id
    return guest, booking
