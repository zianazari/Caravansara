"""Listings: create, privacy of the real point, edits, amenities and photo uploads to MinIO."""

from typing import Any

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.config import Settings
from caravansara.listings.geo import haversine_m
from tests.helpers import AMSTERDAM, amenity_ids, approve, city_id, create_listing, listing_body, register, sql


async def test_create_and_view(client: AsyncClient) -> None:
    host = await register(client, "host")
    listing = await create_listing(client, host, amenity_ids=await amenity_ids(client, "Wifi", "Kitchen"))
    assert listing["host"]["full_name"] == "Host"
    names = {c["name"]: [a["name"] for a in c["amenities"]] for c in listing["amenities"]}
    assert names == {"Internet and office": ["Wifi"], "Kitchen and dining": ["Kitchen"]}

    # The host sees the real point; the public pin is 100–500 m away.
    private = listing["private_location"]
    assert (private["latitude"], private["longitude"]) == AMSTERDAM
    moved = haversine_m(*AMSTERDAM, listing["pin"]["lat"], listing["pin"]["lng"])
    assert 99 <= moved <= 501

    public = (await client.get(f"/listings/{listing['id']}")).json()
    assert public["private_location"] is None
    assert public["pin"] == listing["pin"]  # stored, not recomputed per request
    assert "address" not in str(public)


async def test_create_validation(client: AsyncClient) -> None:
    host = await register(client)
    city = await city_id(client)
    cases = {
        "validation_error": listing_body(city, pets_allowed=False, max_pets=2),
        "unknown_city": listing_body(999),
        "unknown_amenity": listing_body(city, amenity_ids=[999]),
    }
    for code, body in cases.items():
        r = await client.post("/listings", json=body, headers=host.auth)
        assert r.status_code == 422, code
        assert r.json()["error"]["code"] == code
    anonymous = await client.post("/listings", json=listing_body(city))
    assert anonymous.status_code == 401


async def test_only_the_host_edits(client: AsyncClient) -> None:
    host = await register(client, "host")
    other = await register(client, "other")
    listing = await create_listing(client, host)
    path = f"/listings/{listing['id']}"
    denied = await client.patch(path, json={"title": "Mine now"}, headers=other.auth)
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "not_listing_host"
    assert (await client.patch("/listings/999", json={"title": "x"}, headers=host.auth)).status_code == 404

    r = await client.patch(path, json={"title": "Renamed", "price_per_night": "120.50"}, headers=host.auth)
    assert r.json()["title"] == "Renamed"
    assert r.json()["price_per_night"] == "120.50"


async def test_edit_rules(client: AsyncClient) -> None:
    host = await register(client)
    listing = await create_listing(client, host)
    path = f"/listings/{listing['id']}"
    null = await client.patch(path, json={"title": None}, headers=host.auth)
    assert null.status_code == 422
    assert null.json()["error"]["details"] == {"fields": ["title"]}
    pets = await client.patch(path, json={"pets_allowed": False}, headers=host.auth)  # max_pets is still 1
    assert pets.status_code == 422
    half = await client.patch(path, json={"latitude": 52.0}, headers=host.auth)
    assert half.status_code == 422
    bad_city = await client.patch(path, json={"city_id": 999}, headers=host.auth)
    assert bad_city.json()["error"]["code"] == "unknown_city"


async def test_moving_the_real_point_moves_the_pin(client: AsyncClient) -> None:
    host = await register(client)
    listing = await create_listing(client, host)
    r = await client.patch(f"/listings/{listing['id']}", json={"latitude": 52.3, "longitude": 4.9}, headers=host.auth)
    moved = r.json()
    assert moved["private_location"]["latitude"] == 52.3
    assert 99 <= haversine_m(52.3, 4.9, moved["pin"]["lat"], moved["pin"]["lng"]) <= 501


async def test_inactive_listing_is_hidden_from_others(client: AsyncClient) -> None:
    host = await register(client)
    listing = await create_listing(client, host)
    path = f"/listings/{listing['id']}"
    await client.patch(path, json={"is_active": False}, headers=host.auth)
    assert (await client.get(path)).status_code == 404
    assert (await client.get(path, headers=host.auth)).json()["is_active"] is False


async def test_set_amenities_replaces_the_set(client: AsyncClient) -> None:
    host = await register(client)
    wifi, kitchen, sauna = await amenity_ids(client, "Wifi", "Kitchen", "Sauna")
    listing = await create_listing(client, host, amenity_ids=[wifi])
    path = f"/listings/{listing['id']}/amenities"
    r = await client.put(path, json={"amenity_ids": [kitchen, sauna, sauna]}, headers=host.auth)
    assert sorted(a["id"] for c in r.json()["amenities"] for a in c["amenities"]) == sorted([kitchen, sauna])
    bad = await client.put(path, json={"amenity_ids": [wifi, 500]}, headers=host.auth)
    assert bad.json()["error"]["details"] == {"amenity_ids": [500]}


async def test_my_listings(client: AsyncClient) -> None:
    host = await register(client)
    first = await create_listing(client, host, title="First")
    await create_listing(client, host, title="Second")
    await client.patch(f"/listings/{first['id']}", json={"is_active": False}, headers=host.auth)
    page = (await client.get("/me/listings", headers=host.auth)).json()
    assert page["total"] == 2
    assert [i["title"] for i in page["items"]] == ["Second", "First"]
    assert page["items"][0]["cover_url"] is None


async def _upload(client: AsyncClient, host_auth: dict[str, str], listing_id: int, content: bytes) -> str:
    r = await client.post(
        f"/listings/{listing_id}/photos/upload-url", json={"content_type": "image/jpeg"}, headers=host_auth
    )
    assert r.status_code == 200, r.text
    signed = r.json()
    async with httpx.AsyncClient() as storage:  # straight to MinIO, like a browser
        up = await storage.post(signed["url"], data=signed["fields"], files={"file": ("p.jpg", content, "image/jpeg")})
    assert up.status_code == 204, up.text
    return str(signed["storage_key"])


async def test_photo_upload_flow(client: AsyncClient, db: AsyncEngine) -> None:
    host = await register(client, "host")
    listing = await create_listing(client, host)
    lid = listing["id"]
    keys = [await _upload(client, host.auth, lid, f"image-{i}".encode()) for i in range(3)]
    photos = []
    for i, key in enumerate(keys):
        r = await client.post(
            f"/listings/{lid}/photos",
            json={"storage_key": key, "width": 1200, "height": 800, "room_tag": f"Room {i}"},
            headers=host.auth,
        )
        assert r.status_code == 201, r.text
        photos.append(r.json())
    assert [p["sort_order"] for p in photos] == [0, 1, 2]
    async with httpx.AsyncClient() as public:
        assert (await public.get(photos[0]["url"])).content == b"image-0"

    duplicate = await client.post(
        f"/listings/{lid}/photos", json={"storage_key": keys[0], "width": 1, "height": 1}, headers=host.auth
    )
    assert duplicate.json()["error"]["code"] == "invalid_storage_key"

    ids = [p["id"] for p in photos]
    order = await client.put(f"/listings/{lid}/photos/order", json={"photo_ids": ids[::-1]}, headers=host.auth)
    assert [p["id"] for p in order.json()] == ids[::-1]
    bad_order = await client.put(f"/listings/{lid}/photos/order", json={"photo_ids": ids[:2]}, headers=host.auth)
    assert bad_order.json()["error"]["code"] == "invalid_photo_order"

    edited = await client.patch(f"/listings/{lid}/photos/{ids[1]}", json={"caption": "Sunny"}, headers=host.auth)
    assert edited.json()["caption"] == "Sunny"

    assert (await client.delete(f"/listings/{lid}/photos/{ids[2]}", headers=host.auth)).status_code == 204
    await approve(db, lid)  # new photos and a new caption sent it back to review (specs/004-listing-approval)
    detail = (await client.get(f"/listings/{lid}")).json()
    assert [(p["id"], p["sort_order"]) for p in detail["photos"]] == [(ids[1], 0), (ids[0], 1)]
    cover = (await client.get("/me/listings", headers=host.auth)).json()["items"][0]["cover_url"]
    assert cover.endswith(keys[1])
    async with httpx.AsyncClient() as public:
        assert (await public.get(photos[2]["url"])).status_code == 404  # file removed from storage

    for missing in ("patch", "delete"):
        r = await client.request(missing, f"/listings/{lid}/photos/999", json={}, headers=host.auth)
        assert r.status_code == 404


async def test_photo_must_be_uploaded_to_its_own_listing(client: AsyncClient) -> None:
    host = await register(client)
    listing = await create_listing(client, host)
    lid = listing["id"]
    foreign = await client.post(
        f"/listings/{lid}/photos",
        json={"storage_key": "listings/999/x.jpg", "width": 1, "height": 1},
        headers=host.auth,
    )
    assert foreign.json()["error"]["code"] == "invalid_storage_key"
    missing = await client.post(
        f"/listings/{lid}/photos",
        json={"storage_key": f"listings/{lid}/nothing.jpg", "width": 1, "height": 1},
        headers=host.auth,
    )
    assert missing.json()["error"]["code"] == "upload_missing"
    other = await register(client, "other")
    denied = await client.post(
        f"/listings/{lid}/photos/upload-url", json={"content_type": "image/png"}, headers=other.auth
    )
    assert denied.status_code == 403
    gif = await client.post(f"/listings/{lid}/photos/upload-url", json={"content_type": "image/gif"}, headers=host.auth)
    assert gif.status_code == 422


async def test_upload_over_the_size_limit_is_refused(client: AsyncClient, settings: Settings) -> None:
    host = await register(client)
    listing = await create_listing(client, host)
    r = await client.post(
        f"/listings/{listing['id']}/photos/upload-url", json={"content_type": "image/jpeg"}, headers=host.auth
    )
    signed = r.json()
    too_big = b"x" * (settings.max_photo_bytes + 1)
    async with httpx.AsyncClient() as storage:
        up = await storage.post(
            signed["url"], data=signed["fields"], files={"file": ("big.jpg", too_big, "image/jpeg")}
        )
    assert up.status_code == 400
    assert "EntityTooLarge" in up.text
    wrong_type = await _post_file(signed, b"tiny", "image/png")  # the policy pins the content type too
    assert wrong_type.status_code == 403


async def _post_file(signed: dict[str, Any], content: bytes, content_type: str) -> httpx.Response:
    fields = dict(signed["fields"]) | {"Content-Type": content_type}
    async with httpx.AsyncClient() as storage:
        return await storage.post(signed["url"], data=fields, files={"file": ("f", content, content_type)})


# specs/002-rial-price-columns: one limit of 1,000,000,000.00 for every currency.
@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("price_per_night", "1000000000.01"),  # over the limit
        ("cleaning_fee", "1000000000.01"),
        ("price_per_night", "100.001"),  # more than two decimals
        ("price_per_night", "0"),  # must be positive
        ("cleaning_fee", "-1"),  # zero or more
    ],
)
async def test_price_rules_on_create_and_edit(client: AsyncClient, engine: AsyncEngine, field: str, value: str) -> None:
    host = await register(client, "host")
    body = listing_body(await city_id(client), **{field: value})
    refused = await client.post("/listings", json=body, headers=host.auth)
    assert refused.status_code == 422, refused.text
    error = refused.json()["error"]
    assert error["code"] == "validation_error"
    assert [d["loc"] for d in error["details"]] == [["body", field]]
    assert await sql(engine, "SELECT count(*) FROM listings") == [(0,)]

    listing = await create_listing(client, host)
    path = f"/listings/{listing['id']}"
    edit = await client.patch(path, json={field: value}, headers=host.auth)
    assert edit.status_code == 422, edit.text
    assert edit.json()["error"]["code"] == "validation_error"
    assert (await client.get(path)).json()[field] == listing[field]  # the old price stays


async def test_the_price_limit_itself_is_allowed(client: AsyncClient) -> None:
    host = await register(client, "host")
    top = {"price_per_night": "1000000000.00", "cleaning_fee": "1000000000.00", "currency": "IRR"}
    listing = await create_listing(client, host, **top)
    assert (listing["price_per_night"], listing["cleaning_fee"]) == ("1000000000.00", "1000000000.00")
