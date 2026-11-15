"""Host deletion preserves history and serializes with booking creation."""

import asyncio
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.timeutil import utcnow
from tests.factories import Factory
from tests.helpers import reserve, sql


async def test_owner_deletion_hides_listing_and_is_idempotent(
    client: AsyncClient, factory: Factory, db: AsyncEngine
) -> None:
    host, stranger = await factory.user(), await factory.user()
    listing = await factory.listing(host)
    endpoint = f"/listings/{listing['id']}"
    assert (await client.delete(endpoint)).status_code == 401
    assert (await client.delete(endpoint, headers=stranger.auth)).status_code == 403
    for _ in range(2):
        assert (await client.delete(endpoint, headers=host.auth)).status_code == 204
    state = await sql(db, "SELECT is_active, deleted_at FROM listings WHERE id = :id", id=listing["id"])
    assert state[0][0] is False
    assert state[0][1] is not None
    mine = (await client.get("/me/listings", headers=host.auth)).json()
    assert mine["total"] == 0
    assert mine["items"] == []
    for headers in ({}, host.auth):
        assert (await client.get(endpoint, headers=headers)).status_code == 404
    assert (await client.patch(endpoint, headers=host.auth, json={"is_active": True})).status_code == 404
    search = (await client.get("/search/listings", params={"city_id": listing["city"]["id"]})).json()
    assert listing["id"] not in [item["id"] for item in search["items"]]


@pytest.mark.parametrize("status", ["pending", "confirmed"])
async def test_unfinished_reservations_block_deletion(client: AsyncClient, factory: Factory, status: str) -> None:
    host = await factory.user()
    listing = await factory.listing(host)
    await factory.booking(status=status, listing=listing)
    response = await client.delete(f"/listings/{listing['id']}", headers=host.auth)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "listing_has_bookings"
    assert (await client.get("/me/listings", headers=host.auth)).json()["total"] == 1


async def test_history_survives_and_expired_holds_do_not_block(
    client: AsyncClient, factory: Factory, db: AsyncEngine
) -> None:
    host, guest = await factory.user(), await factory.user()
    listing = await factory.listing(host)
    booking = await factory.booking(status="completed", listing=listing, guest=guest, check_in=-5, check_out=-2)
    await factory.booking(status="pending", listing=listing, hold_expires_at=utcnow() - timedelta(minutes=1))
    assert (await client.delete(f"/listings/{listing['id']}", headers=host.auth)).status_code == 204
    trip = await client.get(f"/bookings/{booking.id}", headers=guest.auth)
    assert trip.status_code == 200
    assert trip.json()["status"] == "completed"
    assert (await client.get(f"/listings/{listing['id']}", headers=guest.auth)).status_code == 200
    assert (await sql(db, "SELECT count(*) FROM bookings WHERE listing_id = :id", id=listing["id"]))[0][0] == 2


async def test_archived_pending_listing_leaves_queue_and_cannot_be_approved(
    client: AsyncClient, factory: Factory
) -> None:
    host = await factory.user()
    listing = await factory.listing(host, approved=False)
    admin = await factory.admin()
    assert (await client.delete(f"/listings/{listing['id']}", headers=host.auth)).status_code == 204
    for sort in ["submitted_at", "title", "city", "host"]:
        queue = await client.get("/admin/listings/pending", params={"sort_by": sort}, headers=admin.auth)
        assert queue.json()["total"] == 0
        assert queue.json()["items"] == []
    assert (await client.get("/admin/summary", headers=admin.auth)).json()["pending_listings"] == 0
    approved = await client.post(
        f"/admin/listings/{listing['id']}/approve",
        headers=admin.auth,
        json={"review_version": 0},
    )
    assert approved.status_code == 409


async def test_reservation_and_deletion_serialize(client: AsyncClient, factory: Factory) -> None:
    host, guest = await factory.user(), await factory.user()
    listing = await factory.listing(host)
    removed, booked = await asyncio.gather(
        client.delete(f"/listings/{listing['id']}", headers=host.auth), reserve(client, guest, listing["id"])
    )
    assert (removed.status_code, booked.status_code) in [(204, 404), (409, 201)]
