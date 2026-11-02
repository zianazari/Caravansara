"""Races: many guests, one listing; one key twice at once; payment against expiry."""

import asyncio
import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.jobs.runner import run_once
from tests.helpers import create_listing, register, reserve, sql


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


async def test_payment_racing_expiry_has_one_winner(client: AsyncClient, app: object, db: AsyncEngine) -> None:
    host = await register(client, "host")
    listing = await create_listing(client, host)
    guest = await register(client, "guest")
    booking = (await reserve(client, guest, listing["id"])).json()
    # Hold ends right now: payment and the worker reach the row together.
    await sql(
        db, "UPDATE bookings SET hold_expires_at = now() + interval '50 milliseconds' WHERE id = :id", id=booking["id"]
    )
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
