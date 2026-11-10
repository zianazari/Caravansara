"""Wishlists (feature 012): a member saves public listings and sees them, newest first."""

import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.wishlists import service
from tests.factories import Factory
from tests.helpers import sql


async def test_save_list_and_remove(client: AsyncClient, factory: Factory) -> None:
    guest = await factory.user("guest")
    first = await factory.listing(title="First")
    second = await factory.listing(title="Second")
    for listing in (first, second):
        assert (await client.put(f"/me/wishlist/{listing['id']}", headers=guest.auth)).status_code == 204
    assert (await client.put(f"/me/wishlist/{first['id']}", headers=guest.auth)).status_code == 204  # again: no-op

    page = (await client.get("/me/wishlist", headers=guest.auth)).json()
    assert page["total"] == 2
    assert [i["listing"]["title"] for i in page["items"]] == ["Second", "First"]  # newest first
    assert page["items"][0]["available"] is True
    assert set(page["items"][0]["listing"]) == {
        "id",
        "title",
        "city",
        "price_per_night",
        "currency",
        "avg_rating",
        "review_count",
        "cover_url",
    }
    ids = (await client.get("/me/wishlist/ids", headers=guest.auth)).json()
    assert ids == {"listing_ids": [second["id"], first["id"]]}

    assert (await client.delete(f"/me/wishlist/{first['id']}", headers=guest.auth)).status_code == 204
    assert (await client.delete(f"/me/wishlist/{first['id']}", headers=guest.auth)).status_code == 204  # again
    assert (await client.get("/me/wishlist/ids", headers=guest.auth)).json() == {"listing_ids": [second["id"]]}


async def test_only_a_public_listing_can_be_saved(client: AsyncClient, factory: Factory) -> None:
    guest = await factory.user("guest")
    waiting = await factory.listing(approved=False)
    r = await client.put(f"/me/wishlist/{waiting['id']}", headers=guest.auth)
    assert r.status_code == 404
    assert (await client.put("/me/wishlist/999999999", headers=guest.auth)).status_code == 404


async def test_a_listing_that_goes_off_stays_as_unavailable(client: AsyncClient, factory: Factory) -> None:
    host = await factory.user("host")
    guest = await factory.user("guest")
    listing = await factory.listing(host)
    await client.put(f"/me/wishlist/{listing['id']}", headers=guest.auth)
    await client.patch(f"/listings/{listing['id']}", json={"is_active": False}, headers=host.auth)
    item = (await client.get("/me/wishlist", headers=guest.auth)).json()["items"][0]
    assert item == {"listing_id": listing["id"], "saved_at": item["saved_at"], "available": False, "listing": None}


async def test_wishlists_are_private_and_need_an_account(client: AsyncClient, factory: Factory) -> None:
    alice = await factory.user("alice")
    bob = await factory.user("bob")
    listing = await factory.listing()
    await client.put(f"/me/wishlist/{listing['id']}", headers=alice.auth)
    assert (await client.get("/me/wishlist", headers=bob.auth)).json() == {"items": [], "total": 0}
    assert (await client.get("/me/wishlist")).status_code == 401
    assert (await client.put(f"/me/wishlist/{listing['id']}")).status_code == 401


async def test_a_full_wishlist_refuses_one_more(
    client: AsyncClient, db: AsyncEngine, factory: Factory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(service, "MAX_ITEMS", 2)
    guest = await factory.user("guest")
    listings = [await factory.listing() for _ in range(3)]
    for listing in listings[:2]:
        assert (await client.put(f"/me/wishlist/{listing['id']}", headers=guest.auth)).status_code == 204
    full = await client.put(f"/me/wishlist/{listings[2]['id']}", headers=guest.auth)
    assert full.status_code == 409
    assert full.json()["error"]["code"] == "wishlist_full"
    # Saving one already saved is still fine at the limit.
    assert (await client.put(f"/me/wishlist/{listings[0]['id']}", headers=guest.auth)).status_code == 204


async def test_saves_at_once_never_pass_the_limit(
    client: AsyncClient, db: AsyncEngine, factory: Factory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(service, "MAX_ITEMS", 1)
    guest = await factory.user("guest")
    listings = [await factory.listing() for _ in range(3)]
    results = await asyncio.gather(
        *(client.put(f"/me/wishlist/{listing['id']}", headers=guest.auth) for listing in listings)
    )
    assert sorted(r.status_code for r in results) == [204, 409, 409]
    rows = await sql(db, "SELECT count(*) FROM wishlist_items WHERE user_id = :u", u=guest.id)
    assert rows[0][0] == 1
