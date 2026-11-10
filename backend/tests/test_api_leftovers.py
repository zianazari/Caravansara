"""Three small API additions the site waited for (feature 015)."""

from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from tests.factories import Factory
from tests.helpers import city_id


async def test_search_filters_by_property_type(client: AsyncClient, factory: Factory) -> None:
    city = await city_id(client, "Amsterdam")
    room = await factory.listing(property_type="private_room", title="A room")
    whole = await factory.listing(property_type="entire_place", title="A whole flat")

    def ids(page: dict[str, Any]) -> set[int]:
        return {i["id"] for i in page["items"]}

    rooms = (
        await client.get("/search/listings", params={"city_id": city, "property_type": "private_room", "limit": 100})
    ).json()
    assert room["id"] in ids(rooms)
    assert whole["id"] not in ids(rooms)
    assert {i["property_type"] for i in rooms["items"]} == {"private_room"}

    counts = (await client.get("/search/filters", params={"city_id": city, "property_type": "shared_room"})).json()
    assert counts["total"] == 0
    bad = await client.get("/search/listings", params={"city_id": city, "property_type": "castle"})
    assert bad.status_code == 422


async def test_a_booking_says_whether_it_has_a_review(client: AsyncClient, factory: Factory) -> None:
    stay = await factory.stay()
    before = (await client.get(f"/bookings/{stay.booking_id}", headers=stay.guest.auth)).json()
    assert before["has_review"] is False
    r = await client.post(
        f"/bookings/{stay.booking_id}/review", json={"rating": 5, "comment": "Lovely."}, headers=stay.guest.auth
    )
    assert r.status_code == 201, r.text
    after = (await client.get(f"/bookings/{stay.booking_id}", headers=stay.guest.auth)).json()
    assert after["has_review"] is True
    trips = (await client.get("/me/bookings", headers=stay.guest.auth)).json()["items"]
    assert [t["has_review"] for t in trips if t["id"] == stay.booking_id] == [True]
    hosted = (await client.get(f"/listings/{stay.listing['id']}/bookings", headers=stay.host.auth)).json()["items"]
    assert [b["has_review"] for b in hosted if b["id"] == stay.booking_id] == [True]


async def test_my_listings_count_their_photos(client: AsyncClient, db: AsyncEngine, factory: Factory) -> None:
    host = await factory.user("host")
    await factory.listing(host, approved=False, photos=3, title="With photos")
    await factory.listing(host, title="Without")
    items = (await client.get("/me/listings", headers=host.auth)).json()["items"]
    assert {i["title"]: i["photo_count"] for i in items} == {"With photos": 3, "Without": 0}
