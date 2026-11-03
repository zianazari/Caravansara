"""Booking lifecycle through the API: hold, idempotency, rules, payment, cancellation, privacy."""

import uuid
from datetime import date, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from tests.helpers import User, create_listing, days, insert_booking, register, reserve, sql


@pytest.fixture
async def world(client: AsyncClient) -> tuple[User, User, int]:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    return host, guest, int(listing["id"])


async def test_reserve_creates_a_hold(client: AsyncClient, world: tuple[User, User, int]) -> None:
    host, guest, lid = world
    r = await reserve(client, guest, lid, 10, 13)
    assert r.status_code == 201
    b = r.json()
    assert (b["status"], b["nights"], b["total_price"], b["currency"]) == ("pending", 3, "325.00", "EUR")
    assert b["hold_expires_at"] is not None
    assert b["address"] is None  # only after payment
    assert (b["guest_id"], b["host_id"]) == (guest.id, host.id)


async def test_idempotency_key(client: AsyncClient, world: tuple[User, User, int]) -> None:
    _host, guest, lid = world
    key = uuid.uuid4()
    first = await reserve(client, guest, lid, key=key)
    again = await reserve(client, guest, lid, key=key)
    assert (first.status_code, again.status_code) == (201, 200)
    assert again.json()["id"] == first.json()["id"]

    changed = await reserve(client, guest, lid, 20, 22, key=key)
    assert changed.status_code == 422
    assert changed.json()["error"]["code"] == "idempotency_key_reused"
    stranger = await register(client, "stranger")
    stolen = await reserve(client, stranger, lid, key=key)
    assert stolen.json()["error"]["code"] == "idempotency_key_reused"

    missing = await client.post("/bookings", json={"listing_id": lid}, headers=guest.auth)
    assert missing.status_code == 422


async def test_overlap_is_refused_but_turnover_is_fine(client: AsyncClient, world: tuple[User, User, int]) -> None:
    _, guest, lid = world
    other = await register(client, "other")
    assert (await reserve(client, guest, lid, 10, 13)).status_code == 201
    clash = await reserve(client, other, lid, 12, 15)
    assert clash.status_code == 409
    assert clash.json()["error"]["code"] == "dates_unavailable"
    assert (await reserve(client, other, lid, 13, 15)).status_code == 201  # arrives the day the first leaves


@pytest.mark.parametrize(
    ("extra", "code", "status"),
    [
        ({"adults": 3, "children": 1}, "capacity_exceeded", 422),
        ({"pets": 2}, "capacity_exceeded", 422),
        ({"adults": 2, "children": 1, "infants": 3}, None, 201),  # infants don't count
    ],
)
async def test_capacity(
    client: AsyncClient, world: tuple[User, User, int], extra: dict[str, Any], code: str | None, status: int
) -> None:
    _, guest, lid = world
    r = await reserve(client, guest, lid, **extra)
    assert r.status_code == status, r.text
    if code:
        assert r.json()["error"]["code"] == code


@pytest.mark.parametrize(("check_in", "check_out"), [(-1, 2), (5, 5), (1, 367), (366, 368)])
async def test_date_rules(client: AsyncClient, world: tuple[User, User, int], check_in: int, check_out: int) -> None:
    _, guest, lid = world
    r = await reserve(client, guest, lid, check_in, check_out)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_dates"


async def test_host_cannot_book_own_listing(client: AsyncClient, world: tuple[User, User, int]) -> None:
    host, _, lid = world
    r = await reserve(client, host, lid)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "own_listing"


async def test_inactive_or_unknown_listing(client: AsyncClient, world: tuple[User, User, int]) -> None:
    host, guest, lid = world
    assert (await reserve(client, guest, 999)).status_code == 404
    await client.patch(f"/listings/{lid}", json={"is_active": False}, headers=host.auth)
    assert (await reserve(client, guest, lid)).status_code == 404


async def test_pay_confirms_and_reveals_the_address(client: AsyncClient, world: tuple[User, User, int]) -> None:
    host, guest, lid = world
    booking = (await reserve(client, guest, lid)).json()
    paid = await client.post(f"/bookings/{booking['id']}/pay", headers=guest.auth)
    assert paid.status_code == 200
    body = paid.json()
    assert (body["status"], body["hold_expires_at"]) == ("confirmed", None)
    assert body["address"]["address"] == "12 Test Street, Amsterdam"
    assert body["address"]["check_in_time"] == "15:00"
    as_host = await client.get(f"/bookings/{booking['id']}", headers=host.auth)
    assert as_host.json()["address"] is not None

    twice = await client.post(f"/bookings/{booking['id']}/pay", headers=guest.auth)
    assert twice.status_code == 409
    assert twice.json()["error"]["code"] == "invalid_booking_state"
    by_host = await client.post(f"/bookings/{booking['id']}/pay", headers=host.auth)
    assert by_host.status_code == 403


async def test_pay_after_the_hold_expired(client: AsyncClient, db: AsyncEngine, world: tuple[User, User, int]) -> None:
    _, guest, lid = world
    booking = (await reserve(client, guest, lid)).json()
    await sql(db, "UPDATE bookings SET hold_expires_at = now() - interval '1 second' WHERE id = :id", id=booking["id"])
    late = await client.post(f"/bookings/{booking['id']}/pay", headers=guest.auth)
    assert late.status_code == 409
    assert late.json()["error"]["code"] == "hold_expired"
    status = (await client.get(f"/bookings/{booking['id']}", headers=guest.auth)).json()["status"]
    assert status == "expired"
    again = await client.post(f"/bookings/{booking['id']}/pay", headers=guest.auth)
    assert again.json()["error"]["code"] == "hold_expired"


async def test_an_overdue_hold_does_not_block_new_bookings(
    client: AsyncClient, db: AsyncEngine, world: tuple[User, User, int]
) -> None:
    _, guest, lid = world
    other = await register(client, "other")
    first = (await reserve(client, guest, lid)).json()
    await sql(db, "UPDATE bookings SET hold_expires_at = now() - interval '1 second' WHERE id = :id", id=first["id"])
    # The worker hasn't run, yet the same transaction expires the stale hold first.
    assert (await reserve(client, other, lid)).status_code == 201


async def test_cancel(client: AsyncClient, world: tuple[User, User, int]) -> None:
    host, guest, lid = world
    by_guest = (await reserve(client, guest, lid, 10, 12)).json()
    r = await client.post(f"/bookings/{by_guest['id']}/cancel", headers=guest.auth)
    assert r.json()["status"] == "cancelled"
    again = await client.post(f"/bookings/{by_guest['id']}/cancel", headers=guest.auth)
    assert again.json()["error"]["code"] == "invalid_booking_state"

    by_host = (await reserve(client, guest, lid, 10, 12)).json()  # the dates were freed
    await client.post(f"/bookings/{by_host['id']}/pay", headers=guest.auth)
    r = await client.post(f"/bookings/{by_host['id']}/cancel", headers=host.auth)
    assert r.json()["status"] == "cancelled"


async def test_cancel_on_the_check_in_day_is_refused(
    client: AsyncClient, db: AsyncEngine, world: tuple[User, User, int]
) -> None:
    _, guest, lid = world
    today = date.today()
    booking_id = await insert_booking(
        db, lid, guest.id, today - timedelta(days=1), today + timedelta(days=2), "confirmed"
    )
    r = await client.post(f"/bookings/{booking_id}/cancel", headers=guest.auth)
    assert r.status_code == 409
    assert "before the check-in day" in r.json()["error"]["message"]


async def test_strangers_cannot_see_a_booking(client: AsyncClient, world: tuple[User, User, int]) -> None:
    _, guest, lid = world
    stranger = await register(client, "stranger")
    booking = (await reserve(client, guest, lid)).json()
    for method, path in [("GET", ""), ("POST", "/pay"), ("POST", "/cancel")]:
        r = await client.request(method, f"/bookings/{booking['id']}{path}", headers=stranger.auth)
        assert r.status_code == 404
    assert (await client.get("/bookings/999", headers=guest.auth)).status_code == 404


async def test_trip_and_host_lists(client: AsyncClient, world: tuple[User, User, int]) -> None:
    host, guest, lid = world
    a = (await reserve(client, guest, lid, 10, 12)).json()
    b = (await reserve(client, guest, lid, 20, 22)).json()
    await client.post(f"/bookings/{a['id']}/pay", headers=guest.auth)

    trips = (await client.get("/me/bookings", headers=guest.auth)).json()
    assert [t["id"] for t in trips["items"]] == [b["id"], a["id"]]  # latest check-in first
    confirmed = (await client.get("/me/bookings", params={"status": "confirmed"}, headers=guest.auth)).json()
    assert [t["id"] for t in confirmed["items"]] == [a["id"]]
    assert confirmed["items"][0]["listing"]["city"] == "Amsterdam"

    listing_view = (await client.get(f"/listings/{lid}/bookings", headers=host.auth)).json()
    assert listing_view["total"] == 2
    denied = await client.get(f"/listings/{lid}/bookings", headers=guest.auth)
    assert denied.status_code == 403
    assert days(10) == listing_view["items"][0]["check_in"]


async def test_deactivating_a_listing_keeps_its_bookings(
    client: AsyncClient, db: AsyncEngine, world: tuple[User, User, int]
) -> None:
    host, guest, lid = world
    booking = (await reserve(client, guest, lid)).json()
    await client.post(f"/bookings/{booking['id']}/pay", headers=guest.auth)
    await client.patch(f"/listings/{lid}", json={"is_active": False}, headers=host.auth)

    trip = (await client.get(f"/bookings/{booking['id']}", headers=guest.auth)).json()
    assert trip["status"] == "confirmed"
    assert trip["address"] is not None  # the guest can still find the place
    assert (await client.get("/me/bookings", headers=guest.auth)).json()["total"] == 1
    assert (await client.get(f"/listings/{lid}/bookings", headers=host.auth)).json()["total"] == 1
    assert (await reserve(client, guest, lid, 30, 32)).status_code == 404  # but no new bookings
    cancel = await client.post(f"/bookings/{booking['id']}/cancel", headers=host.auth)
    assert cancel.json()["status"] == "cancelled"
