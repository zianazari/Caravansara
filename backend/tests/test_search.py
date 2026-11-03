"""Search: city or radius, dates, guests, pets, amenities (AND), sorting, paging, privacy."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.listings.geo import haversine_m
from tests.helpers import amenity_ids, city_id, create_listing, days, register, reserve, sql

CENTER = {"lat": 52.3731, "lng": 4.8838}


@pytest.fixture
async def listings(client: AsyncClient) -> dict[str, Any]:
    host = await register(client, "host")
    wifi, kitchen = await amenity_ids(client, "Wifi", "Kitchen")
    near = await create_listing(client, host, title="Near", amenity_ids=[wifi, kitchen])
    far = await create_listing(
        client,
        host,
        title="Far",
        latitude=52.30,
        longitude=4.95,
        max_guests=6,
        pets_allowed=False,
        max_pets=0,
        amenity_ids=[wifi],
    )  # ~9 km away
    lisbon = await create_listing(
        client, host, title="Lisbon", city=await city_id(client, "Lisbon"), latitude=38.72, longitude=-9.14
    )
    return {"host": host, "near": near, "far": far, "lisbon": lisbon, "wifi": wifi, "kitchen": kitchen}


def titles(r: Any) -> list[str]:
    assert r.status_code == 200, r.text
    return [i["title"] for i in r.json()["items"]]


async def test_city_mode(client: AsyncClient, listings: dict[str, Any]) -> None:
    r = await client.get("/search/listings", params={"city_id": await city_id(client)})
    assert sorted(titles(r)) == ["Far", "Near"]
    item = r.json()["items"][0]
    assert item["distance_km"] is None
    assert item["total_price"] is None


async def test_radial_mode_and_distance_sort(client: AsyncClient, listings: dict[str, Any]) -> None:
    small = await client.get("/search/listings", params={**CENTER, "radius_km": 3})
    assert titles(small) == ["Near"]
    wide = await client.get("/search/listings", params={**CENTER, "radius_km": 20, "sort": "distance"})
    assert titles(wide) == ["Near", "Far"]
    near, far = wide.json()["items"]
    assert near["distance_km"] <= 0.6
    assert 7 < far["distance_km"] < 11


async def test_only_the_public_pin_is_exposed(client: AsyncClient, listings: dict[str, Any]) -> None:
    r = await client.get("/search/listings", params={**CENTER, "radius_km": 3})
    item = r.json()["items"][0]
    assert item["pin"] == listings["near"]["pin"]
    assert haversine_m(CENTER["lat"], CENTER["lng"], item["pin"]["lat"], item["pin"]["lng"]) >= 99
    assert "address" not in item
    assert "latitude" not in item


async def test_dates_exclude_booked_listings(client: AsyncClient, listings: dict[str, Any]) -> None:
    guest = await register(client, "guest")
    await reserve(client, guest, listings["near"]["id"], 10, 13)
    base = {**CENTER, "radius_km": 20}
    clash = await client.get("/search/listings", params={**base, "check_in": days(11), "check_out": days(12)})
    assert titles(clash) == ["Far"]
    assert clash.json()["items"][0]["total_price"] == "125.00"  # 1 night + cleaning
    after = await client.get("/search/listings", params={**base, "check_in": days(13), "check_out": days(14)})
    assert sorted(titles(after)) == ["Far", "Near"]


async def test_guests_pets_and_amenities(client: AsyncClient, listings: dict[str, Any]) -> None:
    base = {**CENTER, "radius_km": 20}
    assert titles(await client.get("/search/listings", params={**base, "adults": 4})) == ["Far"]
    assert titles(await client.get("/search/listings", params={**base, "adults": 3, "infants": 2})) != ["Far"]
    assert titles(await client.get("/search/listings", params={**base, "pets": 1})) == ["Near"]
    both = {"amenity_ids": [listings["wifi"], listings["kitchen"]]}
    assert titles(await client.get("/search/listings", params={**base, **both})) == ["Near"]
    one = {"amenity_ids": [listings["wifi"]]}
    assert sorted(titles(await client.get("/search/listings", params={**base, **one}))) == ["Far", "Near"]


async def test_inactive_listings_are_hidden(client: AsyncClient, listings: dict[str, Any]) -> None:
    host = listings["host"]
    await client.patch(f"/listings/{listings['near']['id']}", json={"is_active": False}, headers=host.auth)
    assert titles(await client.get("/search/listings", params={**CENTER, "radius_km": 20})) == ["Far"]


async def test_paging_and_rating_order(client: AsyncClient, db: AsyncEngine, listings: dict[str, Any]) -> None:
    await sql(db, "UPDATE listings SET avg_rating = 4.9, review_count = 3 WHERE title = 'Far'")
    params = {"city_id": await city_id(client), "limit": 1}
    first = await client.get("/search/listings", params=params)
    assert titles(first) == ["Far"]
    assert first.json()["total"] == 2
    second = await client.get("/search/listings", params={**params, "offset": 1})
    assert titles(second) == ["Near"]
    beyond = await client.get("/search/listings", params={**params, "offset": 5})
    assert beyond.json() == {"items": [], "total": 2, "limit": 1, "offset": 5}


@pytest.mark.parametrize(
    ("params", "code"),
    [
        ({}, "invalid_search_area"),
        ({"lat": 52.0, "lng": 4.0}, "invalid_search_area"),
        ({"city_id": 1, **CENTER, "radius_km": 5}, "invalid_search_area"),
        ({**CENTER, "radius_km": 0.5}, "invalid_search_area"),
        ({**CENTER, "radius_km": 150}, "invalid_search_area"),
        ({"city_id": 1, "sort": "distance"}, "invalid_search_area"),
        ({"city_id": 1, "check_in": "2030-01-01"}, "invalid_dates"),
        ({"city_id": 1, "check_in": "2030-01-02", "check_out": "2030-01-01"}, "invalid_dates"),
        ({"city_id": 1, "sort": "price"}, "validation_error"),
    ],
)
async def test_invalid_requests(client: AsyncClient, params: dict[str, Any], code: str) -> None:
    r = await client.get("/search/listings", params=params)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == code


async def test_filter_counts(client: AsyncClient, listings: dict[str, Any]) -> None:
    r = await client.get("/search/filters", params={**CENTER, "radius_km": 20, "amenity_ids": [listings["kitchen"]]})
    body = r.json()
    assert body["total"] == 2  # amenity filters don't narrow the counts
    counts = {a["name"]: a["listings"] for a in body["amenities"]}
    assert counts == {"Wifi": 2, "Kitchen": 1}
    city = await client.get("/search/filters", params={"city_id": await city_id(client, "Lisbon")})
    assert city.json() == {"total": 1, "amenities": []}


async def test_radial_search_across_the_180_meridian(client: AsyncClient, db: AsyncEngine) -> None:
    await sql(db, "INSERT INTO countries (code, name) VALUES ('FJ', 'Fiji')")
    await sql(
        db,
        "INSERT INTO cities (country_id, name, timezone) "
        "SELECT id, 'Taveuni', 'Pacific/Fiji' FROM countries WHERE code = 'FJ'",
    )
    try:
        host = await register(client, "host")
        city = (await sql(db, "SELECT id FROM cities WHERE name = 'Taveuni'"))[0][0]
        await create_listing(
            client, host, title="Dateline", city=city, latitude=-16.8, longitude=179.995, currency="FJD"
        )
        r = await client.get("/search/listings", params={"lat": -16.8, "lng": -179.995, "radius_km": 5})
        assert titles(r) == ["Dateline"]
        assert r.json()["items"][0]["distance_km"] < 2
    finally:
        await sql(db, "DELETE FROM listings WHERE city_id IN (SELECT id FROM cities WHERE name = 'Taveuni')")
        await sql(db, "DELETE FROM cities WHERE name = 'Taveuni'")
        await sql(db, "DELETE FROM countries WHERE code = 'FJ'")


async def test_an_overdue_hold_does_not_hide_a_listing(
    client: AsyncClient, db: AsyncEngine, listings: dict[str, Any]
) -> None:
    guest = await register(client, "guest")
    hold = (await reserve(client, guest, listings["near"]["id"], 10, 13)).json()
    params: dict[str, Any] = {**CENTER, "radius_km": 3, "check_in": days(11), "check_out": days(12)}
    assert titles(await client.get("/search/listings", params=params)) == []  # a live hold blocks
    await sql(db, "UPDATE bookings SET hold_expires_at = now() - interval '1 second' WHERE id = :id", id=hold["id"])
    assert titles(await client.get("/search/listings", params=params)) == ["Near"]  # before the worker runs
    filters = await client.get("/search/filters", params=params)
    assert filters.json()["total"] == 1
