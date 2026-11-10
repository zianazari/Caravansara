"""Listing review by an admin (specs/backend (004)): US1, US2 and US3.

A listing is public only when it is active and approved. Every public path is tested once with a
listing that is not (SC-001); every descriptive and non-descriptive field once (SC-003).
"""

from datetime import timedelta
from typing import Any

import httpx
import pytest
from httpx import AsyncClient
from prometheus_client import REGISTRY
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.db import create_sessionmaker as app_sessionmaker
from caravansara.jobs.runner import run_once
from tests.factories import Factory
from tests.helpers import User, city_id, reserve, sql

CENTER = {"lat": 52.3731, "lng": 4.8838, "radius_km": 5}


def sample(name: str, **labels: str) -> float:
    return REGISTRY.get_sample_value(name, labels) or 0.0


def events(event: str) -> float:
    return sample("caravansara_listing_review_events_total", event=event)


async def history(db: AsyncEngine, listing_id: int) -> list[tuple[Any, ...]]:
    rows = await sql(
        db,
        "SELECT action::text, actor_id, review_version, reason FROM listing_review_events "
        "WHERE listing_id = :id ORDER BY id",
        id=listing_id,
    )
    return [tuple(r) for r in rows]


async def state(db: AsyncEngine, listing_id: int) -> tuple[Any, ...]:
    rows = await sql(
        db,
        "SELECT review_status::text, submitted_at, rejection_reason, review_version FROM listings WHERE id = :id",
        id=listing_id,
    )
    return tuple(rows[0])


async def search_ids(client: AsyncClient, **params: Any) -> set[int]:
    r = await client.get("/search/listings", params={"city_id": await city_id(client), **params})
    assert r.status_code == 200, r.text
    return {i["id"] for i in r.json()["items"]}


async def detail(client: AsyncClient, admin: User, listing_id: int) -> dict[str, Any]:
    r = await client.get(f"/admin/listings/{listing_id}", headers=admin.auth)
    assert r.status_code == 200, r.text
    body: dict[str, Any] = r.json()
    return body


async def approve(client: AsyncClient, admin: User, listing_id: int, version: int | None = None) -> Any:
    if version is None:
        version = (await detail(client, admin, listing_id))["review_version"]
    return await client.post(
        f"/admin/listings/{listing_id}/approve", json={"review_version": version}, headers=admin.auth
    )


async def reject(client: AsyncClient, admin: User, listing_id: int, reason: str = "Photos are not this flat.") -> Any:
    version = (await detail(client, admin, listing_id))["review_version"]
    return await client.post(
        f"/admin/listings/{listing_id}/reject", json={"review_version": version, "reason": reason}, headers=admin.auth
    )


@pytest.fixture
async def pending(factory: Factory) -> dict[str, Any]:
    """A new listing as its host just made it, and the host."""
    host = await factory.user("host")
    listing = await factory.listing(host, approved=False)
    return {"host": host, "listing": listing, "id": int(listing["id"])}


# ---- US1: a new listing is public only after approval ---------------------------------


async def test_a_new_listing_waits_with_a_history_row(client: AsyncClient, db: AsyncEngine, factory: Factory) -> None:
    """FR-001, FR-015: pending from the start, recorded as submitted by its host."""
    before = events("submitted")
    host = await factory.user("host")
    listing = await factory.listing(host, approved=False)
    status, submitted_at, reason, version = await state(db, listing["id"])
    assert (status, reason, version) == ("pending", None, 0)
    assert submitted_at is not None
    assert await history(db, listing["id"]) == [("submitted", host.id, 0, None)]
    assert events("submitted") == before + 1
    assert listing["review"]["status"] == "pending"


async def test_a_pending_listing_is_not_in_city_or_radius_search(client: AsyncClient, pending: dict[str, Any]) -> None:
    assert pending["id"] not in await search_ids(client)
    r = await client.get("/search/listings", params=CENTER)
    assert pending["id"] not in {i["id"] for i in r.json()["items"]}


async def test_a_pending_listing_is_not_in_the_filter_counts(client: AsyncClient, pending: dict[str, Any]) -> None:
    for params in ({"city_id": await city_id(client)}, CENTER):
        r = await client.get("/search/filters", params=params)
        assert r.json()["total"] == 0


@pytest.mark.parametrize("viewer", ["anonymous", "other member"])
async def test_a_pending_listing_page_is_not_found(
    client: AsyncClient, factory: Factory, pending: dict[str, Any], viewer: str
) -> None:
    headers = (await factory.user("other")).auth if viewer == "other member" else {}
    r = await client.get(f"/listings/{pending['id']}", headers=headers)
    assert r.status_code == 404
    reviews = await client.get(f"/listings/{pending['id']}/reviews", headers=headers)
    assert reviews.status_code == 404


async def test_a_pending_listing_cannot_be_booked(
    client: AsyncClient, db: AsyncEngine, factory: Factory, pending: dict[str, Any]
) -> None:
    """US1/AC1, AC3: the same 404 an inactive listing gets, and no booking."""
    r = await reserve(client, await factory.user("guest"), pending["id"])
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"
    assert await sql(db, "SELECT id FROM bookings") == []


async def test_the_host_sees_the_review_state_and_others_do_not(
    client: AsyncClient, factory: Factory, pending: dict[str, Any]
) -> None:
    """US1/AC2."""
    host = pending["host"]
    mine = (await client.get("/me/listings", headers=host.auth)).json()["items"]
    assert [i["review"]["status"] for i in mine] == ["pending"]
    page = (await client.get(f"/listings/{pending['id']}", headers=host.auth)).json()
    assert page["review"]["status"] == "pending"
    assert page["review"]["submitted_at"] is not None

    public = await factory.listing()
    seen = (await client.get(f"/listings/{public['id']}", headers=(await factory.user("x")).auth)).json()
    assert seen["review"] is None
    assert seen["private_location"] is None


async def test_the_queue_is_oldest_first(client: AsyncClient, db: AsyncEngine, factory: Factory) -> None:
    """US1/AC4."""
    admin = await factory.admin()
    host = await factory.user("host")
    ids = [int((await factory.listing(host, approved=False, title=t))["id"]) for t in ("A", "B", "C")]
    await factory.listing(host, title="Approved")
    # B waited longest, then C, then A.
    for listing_id, hours in zip(ids, (1, 3, 2), strict=True):
        await sql(
            db,
            "UPDATE listings SET submitted_at = now() - make_interval(hours => :h) WHERE id = :id",
            h=hours,
            id=listing_id,
        )
    r = await client.get("/admin/listings/pending", headers=admin.auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert [i["title"] for i in body["items"]] == ["B", "C", "A"]
    assert body["total"] == 3
    item = body["items"][0]
    assert item["review_version"] == 0
    assert item["host"]["id"] == host.id
    assert item["city"]["name"] == "Amsterdam"

    page = await client.get("/admin/listings/pending", params={"limit": 1, "offset": 1}, headers=admin.auth)
    assert [i["title"] for i in page.json()["items"]] == ["C"]


async def test_admin_details_show_the_address_and_record_each_view(
    client: AsyncClient, db: AsyncEngine, factory: Factory, pending: dict[str, Any]
) -> None:
    """FR-018, SC-009: one row per answer, with admin, listing and time."""
    admin = await factory.admin()
    for _ in range(2):
        body = await detail(client, admin, pending["id"])
    assert body["private_location"]["address"] == "12 Test Street, Amsterdam"
    assert body["review"]["status"] == "pending"
    assert body["review_version"] == 0
    rows = await sql(db, "SELECT admin_id, listing_id, viewed_at FROM admin_address_views ORDER BY id")
    assert [(r[0], r[1]) for r in rows] == [(admin.id, pending["id"])] * 2
    assert all(r[2] is not None for r in rows)

    missing = await client.get("/admin/listings/999999", headers=admin.auth)
    assert missing.status_code == 404
    assert len(await sql(db, "SELECT id FROM admin_address_views")) == 2


async def test_approval_makes_the_listing_public_and_bookable(
    client: AsyncClient, db: AsyncEngine, factory: Factory, pending: dict[str, Any]
) -> None:
    """US1/AC5."""
    admin = await factory.admin()
    before = events("approved")
    r = await approve(client, admin, pending["id"])
    assert r.status_code == 200, r.text
    assert r.json()["review"]["status"] == "approved"
    assert (await state(db, pending["id"]))[0] == "approved"
    assert (await client.get("/admin/listings/pending", headers=admin.auth)).json()["total"] == 0
    assert pending["id"] in await search_ids(client)
    assert (await client.get(f"/listings/{pending['id']}")).status_code == 200
    booked = await reserve(client, await factory.user("guest"), pending["id"])
    assert booked.status_code == 201, booked.text
    assert (await history(db, pending["id"]))[-1] == ("approved", admin.id, 0, None)
    assert events("approved") == before + 1

    again = await approve(client, admin, pending["id"], version=0)
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "listing_not_pending"
    assert len(await history(db, pending["id"])) == 2


async def test_an_approved_listing_that_is_inactive_stays_hidden_until_active(
    client: AsyncClient, factory: Factory, pending: dict[str, Any]
) -> None:
    """US1/AC6: active again means public again, without a new review."""
    host = pending["host"]
    await client.patch(f"/listings/{pending['id']}", json={"is_active": False}, headers=host.auth)
    assert (await approve(client, await factory.admin(), pending["id"])).status_code == 200
    assert pending["id"] not in await search_ids(client)
    assert (await client.get(f"/listings/{pending['id']}")).status_code == 404

    await client.patch(f"/listings/{pending['id']}", json={"is_active": True}, headers=host.auth)
    assert pending["id"] in await search_ids(client)


@pytest.mark.parametrize("who", ["nobody", "member", "disabled admin"])
async def test_admin_endpoints_need_an_active_admin_before_anything_else(
    client: AsyncClient, db: AsyncEngine, factory: Factory, pending: dict[str, Any], who: str
) -> None:
    """US1/AC7, FR-020: 401 on every admin route, even for a listing that does not exist."""
    headers: dict[str, str] = {}
    if who == "member":
        headers = pending["host"].auth
    elif who == "disabled admin":
        admin = await factory.admin()
        await sql(db, "UPDATE users SET disabled_at = now() WHERE id = :id", id=admin.id)
        headers = admin.auth
    for listing_id in (pending["id"], 999999):
        for method, path, body in (
            ("GET", "/admin/listings/pending", None),
            ("GET", f"/admin/listings/{listing_id}", None),
            ("POST", f"/admin/listings/{listing_id}/approve", {"review_version": 0}),
            ("POST", f"/admin/listings/{listing_id}/reject", {"review_version": 0, "reason": "No."}),
        ):
            r = await client.request(method, path, json=body, headers=headers)
            assert r.status_code == 401, (method, path, r.text)
    assert (await state(db, pending["id"]))[0] == "pending"
    assert await sql(db, "SELECT id FROM admin_address_views") == []


async def test_admin_host_keeps_the_admin_routes_on_their_subdomain(
    client: AsyncClient, app: Any, factory: Factory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Research R12: with admin_host set, other hosts see no admin routes at all."""
    admin = await factory.admin()
    monkeypatch.setattr(app.state.settings, "admin_host", "admin.example.com")
    elsewhere = await client.get("/admin/listings/pending", headers=admin.auth)
    assert elsewhere.status_code == 404
    login = await client.post("/admin/auth/login", json={"email": admin.email, "password": "x"})
    assert login.status_code == 404
    there = await client.get("/admin/listings/pending", headers=admin.auth | {"Host": "admin.example.com"})
    assert there.status_code == 200
    assert (await client.get("/search/filters", params=CENTER)).status_code == 200  # the public site is untouched


@pytest.mark.parametrize(
    ("status", "visible"),
    [("confirmed", True), ("completed", True), ("pending", True), ("cancelled", False), ("expired", False)],
)
async def test_a_guest_with_a_live_booking_still_sees_a_hidden_listing(
    client: AsyncClient, db: AsyncEngine, factory: Factory, status: str, visible: bool
) -> None:
    """FR-019. The page shows no exact address to the guest; the booking view does, as before."""
    guest = await factory.user("guest")
    listing = await factory.listing()
    check_in = -5 if status == "completed" else 10
    await factory.booking(status=status, listing=listing, guest=guest, check_in=check_in, check_out=check_in + 2)
    await sql(db, "UPDATE listings SET review_status = 'pending' WHERE id = :id", id=listing["id"])

    r = await client.get(f"/listings/{listing['id']}", headers=guest.auth)
    assert r.status_code == (200 if visible else 404)
    if visible:
        assert r.json()["private_location"] is None
        assert r.json()["review"] is None
        assert (await client.get(f"/listings/{listing['id']}/reviews", headers=guest.auth)).status_code == 200
    assert (await client.get(f"/listings/{listing['id']}")).status_code == 404


async def test_a_hold_past_its_deadline_no_longer_shows_a_hidden_listing(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    guest = await factory.user("guest")
    listing = await factory.listing()
    booking = await factory.booking(status="pending", listing=listing, guest=guest)
    await factory.expire_hold(booking.id, timedelta(minutes=1))
    await sql(db, "UPDATE listings SET review_status = 'pending' WHERE id = :id", id=listing["id"])
    assert (await client.get(f"/listings/{listing['id']}", headers=guest.auth)).status_code == 404


# ---- US2: rejection with a reason, fix and resubmit -----------------------------------


@pytest.mark.parametrize("reason", ["", "   ", "x" * 1001])
async def test_a_rejection_needs_a_written_reason(
    client: AsyncClient, db: AsyncEngine, factory: Factory, pending: dict[str, Any], reason: str
) -> None:
    """US2/AC1, FR-005."""
    r = await reject(client, await factory.admin(), pending["id"], reason)
    assert r.status_code == 422
    assert (await state(db, pending["id"]))[0] == "pending"


async def test_rejection_keeps_the_listing_hidden_and_tells_the_host_why(
    client: AsyncClient, db: AsyncEngine, factory: Factory, pending: dict[str, Any]
) -> None:
    """US2/AC2, FR-003."""
    admin = await factory.admin()
    before = events("rejected")
    r = await reject(client, admin, pending["id"], "  Photos are not this flat.  ")
    assert r.status_code == 200, r.text
    assert r.json()["review"]["rejection_reason"] == "Photos are not this flat."
    assert (await client.get("/admin/listings/pending", headers=admin.auth)).json()["total"] == 0
    assert pending["id"] not in await search_ids(client)
    mine = (await client.get("/me/listings", headers=pending["host"].auth)).json()["items"][0]["review"]
    assert (mine["status"], mine["rejection_reason"]) == ("rejected", "Photos are not this flat.")
    assert (await history(db, pending["id"]))[-1] == ("rejected", admin.id, 0, "Photos are not this flat.")
    assert events("rejected") == before + 1


async def test_a_rejected_listing_can_be_fixed_and_sent_again(
    client: AsyncClient, db: AsyncEngine, factory: Factory, pending: dict[str, Any]
) -> None:
    """US2/AC3, AC4: the edit is saved, the listing stays rejected until resubmitted, then goes last."""
    admin, host = await factory.admin(), pending["host"]
    await reject(client, admin, pending["id"])
    edited = await client.patch(f"/listings/{pending['id']}", json={"title": "Real photos now"}, headers=host.auth)
    assert edited.status_code == 200
    assert edited.json()["review"]["status"] == "rejected"
    other = await factory.listing(approved=False)  # entered the queue before the resubmission

    before = events("submitted")
    r = await client.post(f"/listings/{pending['id']}/resubmit", headers=host.auth)
    assert r.status_code == 200, r.text
    assert r.json()["review"] == {
        "status": "pending",
        "rejection_reason": None,
        "submitted_at": r.json()["review"]["submitted_at"],
    }
    queue = (await client.get("/admin/listings/pending", headers=admin.auth)).json()["items"]
    assert [i["id"] for i in queue] == [other["id"], pending["id"]]
    version = (await state(db, pending["id"]))[3]
    assert (await history(db, pending["id"]))[-1] == ("resubmitted", host.id, version, None)
    assert events("submitted") == before + 1

    assert (await approve(client, admin, pending["id"])).status_code == 200
    assert pending["id"] in await search_ids(client)


@pytest.mark.parametrize("status", ["pending", "approved"])
async def test_only_a_rejected_listing_can_be_resubmitted(
    client: AsyncClient, factory: Factory, pending: dict[str, Any], status: str
) -> None:
    """US2/AC5."""
    if status == "approved":
        await approve(client, await factory.admin(), pending["id"])
    r = await client.post(f"/listings/{pending['id']}/resubmit", headers=pending["host"].auth)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "listing_not_rejected"


async def test_only_the_host_resubmits(client: AsyncClient, factory: Factory, pending: dict[str, Any]) -> None:
    await reject(client, await factory.admin(), pending["id"])
    r = await client.post(f"/listings/{pending['id']}/resubmit", headers=(await factory.user("other")).auth)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "not_listing_host"
    assert (await client.post("/listings/999999/resubmit", headers=pending["host"].auth)).status_code == 404
    assert (await client.post(f"/listings/{pending['id']}/resubmit")).status_code == 401


async def test_an_inactive_rejected_listing_is_approved_but_stays_hidden(
    client: AsyncClient, factory: Factory, pending: dict[str, Any]
) -> None:
    """Edge case: approval does not switch a listing on; the host does."""
    admin, host = await factory.admin(), pending["host"]
    await reject(client, admin, pending["id"])
    await client.patch(f"/listings/{pending['id']}", json={"is_active": False}, headers=host.auth)
    assert (await client.post(f"/listings/{pending['id']}/resubmit", headers=host.auth)).status_code == 200
    assert (await approve(client, admin, pending["id"])).status_code == 200
    assert pending["id"] not in await search_ids(client)


# ---- US3: a descriptive edit of an approved listing needs a new review ----------------


async def _photos(db: AsyncEngine, listing_id: int, n: int = 6) -> list[int]:
    """Photo rows straight in the database: their content does not matter here."""
    ids = []
    for i in range(n):
        rows = await sql(
            db,
            "INSERT INTO listing_photos (listing_id, storage_key, width, height, caption, room_tag, sort_order) "
            "VALUES (:l, :k, 10, 10, 'Old caption', 'Kitchen', :i) RETURNING id",
            l=listing_id,
            k=f"listings/{listing_id}/{i}.jpg",
            i=i,
        )
        ids.append(int(rows[0][0]))
    return ids


async def _upload(client: AsyncClient, host: User, listing_id: int) -> str:
    r = await client.post(
        f"/listings/{listing_id}/photos/upload-url", json={"content_type": "image/jpeg"}, headers=host.auth
    )
    signed = r.json()
    async with httpx.AsyncClient() as storage:
        up = await storage.post(signed["url"], data=signed["fields"], files={"file": ("p.jpg", b"img", "image/jpeg")})
    assert up.status_code == 204, up.text
    return str(signed["storage_key"])


@pytest.fixture
async def approved(client: AsyncClient, db: AsyncEngine, factory: Factory) -> dict[str, Any]:
    """An approved, active listing with six photos (one can be removed, features 010, 021) and one amenity."""
    host = await factory.user("host")
    wifi = (await client.get("/amenities")).json()[0]["amenities"][0]["id"]
    listing = await factory.listing(host, amenity_ids=[wifi])
    photos = await _photos(db, int(listing["id"]))
    return {"host": host, "id": int(listing["id"]), "photos": photos, "wifi": wifi}


async def _edit(client: AsyncClient, db: AsyncEngine, listing: dict[str, Any], how: str) -> None:
    lid, host = listing["id"], listing["host"]
    if how == "amenities":
        other = (await client.get("/amenities")).json()[0]["amenities"][1]["id"]
        r = await client.put(f"/listings/{lid}/amenities", json={"amenity_ids": [other]}, headers=host.auth)
    elif how == "new photo":
        key = await _upload(client, host, lid)
        r = await client.post(
            f"/listings/{lid}/photos", json={"storage_key": key, "width": 1, "height": 1}, headers=host.auth
        )
    elif how in ("caption", "room_tag"):
        r = await client.patch(f"/listings/{lid}/photos/{listing['photos'][0]}", json={how: "New"}, headers=host.auth)
    elif how == "photo order":
        r = await client.put(
            f"/listings/{lid}/photos/order", json={"photo_ids": listing["photos"][::-1]}, headers=host.auth
        )
    elif how == "delete photo":
        r = await client.delete(f"/listings/{lid}/photos/{listing['photos'][1]}", headers=host.auth)
    else:
        r = await client.patch(f"/listings/{lid}", json=EDITS[how], headers=host.auth)
    assert r.status_code in (200, 201, 204), r.text


EDITS: dict[str, dict[str, Any]] = {
    # FR-009: what a guest reads
    "title": {"title": "A different title"},
    "description": {"description": "A new description."},
    "city_id": {},  # filled in the test: needs a real id
    "neighborhood": {"neighborhood": "De Pijp"},
    "address": {"address": "1 Other Street, Amsterdam"},
    "location": {"latitude": 52.36, "longitude": 4.90},
    "property_type": {"property_type": "private_room"},
    # FR-010: what does not need a review
    "price_per_night": {"price_per_night": "150.00"},
    "cleaning_fee": {"cleaning_fee": "40.00"},
    "currency": {"currency": "USD"},
    "is_active": {"is_active": False},
    "check_in_time": {"check_in_time": "14:00:00"},
    "check_out_time": {"check_out_time": "10:00:00"},
    "max_guests": {"max_guests": 5},
    "bedrooms": {"bedrooms": 3},
    "beds": {"beds": 4},
    "bathrooms": {"bathrooms": "2.5"},
    "pets": {"pets_allowed": False, "max_pets": 0},
}
DESCRIPTIVE = [
    "title", "description", "city_id", "neighborhood", "address", "location", "property_type",
    "amenities", "new photo", "caption", "room_tag",
]  # fmt: skip
OPERATIONAL = [
    "price_per_night", "cleaning_fee", "currency", "is_active", "check_in_time", "check_out_time",
    "max_guests", "bedrooms", "beds", "bathrooms", "pets", "photo order", "delete photo",
]  # fmt: skip


@pytest.mark.parametrize("how", DESCRIPTIVE)
async def test_a_descriptive_edit_sends_an_approved_listing_back_to_review(
    client: AsyncClient, db: AsyncEngine, approved: dict[str, Any], how: str
) -> None:
    """US3/AC1, FR-009, SC-003: one test per field."""
    if how == "city_id":
        EDITS["city_id"] = {"city_id": await city_id(client, "Lisbon"), "latitude": 38.72, "longitude": -9.14}
    before_submitted = events("submitted")
    await _edit(client, db, approved, how)
    status, submitted_at, _, version = await state(db, approved["id"])
    assert (status, version) == ("pending", 1)
    assert submitted_at is not None
    assert (await history(db, approved["id"]))[-1] == ("edited", approved["host"].id, 1, None)
    assert events("submitted") == before_submitted + 1
    assert (await client.get(f"/listings/{approved['id']}")).status_code == 404


@pytest.mark.parametrize("how", OPERATIONAL)
async def test_an_operational_edit_keeps_the_listing_approved(
    client: AsyncClient, db: AsyncEngine, approved: dict[str, Any], how: str
) -> None:
    """US3/AC2, FR-010, SC-003."""
    await _edit(client, db, approved, how)
    status, _, _, version = await state(db, approved["id"])
    assert (status, version) == ("approved", 0)
    assert [h[0] for h in await history(db, approved["id"])] == ["submitted"]  # no "edited"


@pytest.mark.parametrize(
    "same",
    [
        {"title": "Canal-side loft"},
        {"latitude": 52.3731000001, "longitude": 4.8838},  # equal to 6 decimals (R7)
        "amenities",
        "caption",
    ],
)
async def test_sending_the_same_value_again_is_no_change(
    client: AsyncClient, db: AsyncEngine, approved: dict[str, Any], same: Any
) -> None:
    """US3/AC5."""
    lid, host = approved["id"], approved["host"]
    if same == "amenities":
        r = await client.put(f"/listings/{lid}/amenities", json={"amenity_ids": [approved["wifi"]]}, headers=host.auth)
    elif same == "caption":
        r = await client.patch(
            f"/listings/{lid}/photos/{approved['photos'][0]}", json={"caption": "Old caption"}, headers=host.auth
        )
    else:
        r = await client.patch(f"/listings/{lid}", json=same, headers=host.auth)
    assert r.status_code == 200, r.text
    assert (await state(db, lid))[0::3] == ("approved", 0)


async def test_one_edit_with_price_and_title_saves_both_and_needs_a_review(
    client: AsyncClient, db: AsyncEngine, approved: dict[str, Any]
) -> None:
    """US3/AC4."""
    r = await client.patch(
        f"/listings/{approved['id']}", json={"price_per_night": "120.00", "title": "New"}, headers=approved["host"].auth
    )
    assert (r.json()["price_per_night"], r.json()["title"]) == ("120.00", "New")
    assert (await state(db, approved["id"]))[0] == "pending"


async def test_a_booking_survives_its_listing_going_back_to_review(
    client: AsyncClient, db: AsyncEngine, factory: Factory, approved: dict[str, Any]
) -> None:
    """US3/AC3, SC-004, FR-011: the booking, its guest's view, payment and cancellation are unchanged."""
    guest = await factory.user("guest")
    hold = (await reserve(client, guest, approved["id"])).json()  # a hold open when the listing is hidden
    confirmed = (await reserve(client, guest, approved["id"], check_in=30, check_out=32)).json()
    assert (await client.post(f"/bookings/{confirmed['id']}/pay", headers=guest.auth)).status_code == 200
    await _edit(client, db, approved, "title")

    mine = {b["id"]: b for b in (await client.get("/me/bookings", headers=guest.auth)).json()["items"]}
    assert mine[confirmed["id"]]["status"] == "confirmed"
    assert mine[confirmed["id"]]["total_price"] == confirmed["total_price"]
    assert (await client.get(f"/listings/{approved['id']}", headers=guest.auth)).status_code == 200
    paid = await client.post(f"/bookings/{hold['id']}/pay", headers=guest.auth)
    assert paid.status_code == 200, paid.text
    cancelled = await client.post(f"/bookings/{confirmed['id']}/cancel", headers=guest.auth)
    assert cancelled.status_code == 200, cancelled.text
    # A new booking waits for the review, like any guest's.
    assert (await reserve(client, guest, approved["id"], check_in=60, check_out=62)).status_code == 404


async def test_a_stay_on_a_hidden_listing_completes_and_can_be_reviewed(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    """FR-011: the worker and reviews do not look at the review state."""
    stay = await factory.stay()
    await sql(db, "UPDATE listings SET review_status = 'pending' WHERE id = :id", id=stay.listing["id"])
    finished = await factory.booking(
        status="confirmed", listing=stay.listing, guest=stay.guest, check_in=-8, check_out=-6
    )
    await run_once(app_sessionmaker(db))
    rows = await sql(db, "SELECT status::text FROM bookings WHERE id = :id", id=finished.id)
    assert rows[0][0] == "completed"
    r = await client.post(
        f"/bookings/{stay.booking_id}/review", json={"rating": 5, "comment": "Lovely."}, headers=stay.guest.auth
    )
    assert r.status_code == 201, r.text


async def test_a_descriptive_edit_of_a_pending_listing_keeps_its_place(
    client: AsyncClient, db: AsyncEngine, pending: dict[str, Any]
) -> None:
    """US3/AC6: still pending, same queue time, a new version."""
    _, submitted_at, _, _ = await state(db, pending["id"])
    await client.patch(f"/listings/{pending['id']}", json={"title": "Better"}, headers=pending["host"].auth)
    assert await state(db, pending["id"]) == ("pending", submitted_at, None, 1)
    assert [h[0] for h in await history(db, pending["id"])] == ["submitted"]


async def test_an_admin_cannot_approve_a_version_they_did_not_see(
    client: AsyncClient, db: AsyncEngine, factory: Factory, pending: dict[str, Any]
) -> None:
    """Research R6: 409 listing_changed, then approving the version seen again works."""
    admin = await factory.admin()
    seen = (await detail(client, admin, pending["id"]))["review_version"]
    await client.patch(f"/listings/{pending['id']}", json={"title": "Changed after"}, headers=pending["host"].auth)
    r = await approve(client, admin, pending["id"], version=seen)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "listing_changed"
    assert (await state(db, pending["id"]))[0] == "pending"
    assert (await approve(client, admin, pending["id"])).status_code == 200


async def test_an_inactive_approved_listing_edited_stays_hidden_when_switched_on(
    client: AsyncClient, db: AsyncEngine, approved: dict[str, Any]
) -> None:
    """Edge case: switching on after a descriptive edit does not skip the review."""
    host = approved["host"]
    await client.patch(f"/listings/{approved['id']}", json={"is_active": False}, headers=host.auth)
    await _edit(client, db, approved, "title")
    await client.patch(f"/listings/{approved['id']}", json={"is_active": True}, headers=host.auth)
    assert (await state(db, approved["id"]))[0] == "pending"
    assert approved["id"] not in await search_ids(client)


async def test_reviews_come_back_with_the_listing(client: AsyncClient, db: AsyncEngine, factory: Factory) -> None:
    stay = await factory.stay()
    await client.post(
        f"/bookings/{stay.booking_id}/review", json={"rating": 4, "comment": "Fine."}, headers=stay.guest.auth
    )
    await _photos(db, int(stay.listing["id"]), 5)  # an admin approves only with 5 photos (features 010, 021)
    await client.patch(f"/listings/{stay.listing['id']}", json={"title": "Renamed"}, headers=stay.host.auth)
    assert (await client.get(f"/listings/{stay.listing['id']}/reviews")).status_code == 404
    assert (await approve(client, await factory.admin(), stay.listing["id"])).status_code == 200
    assert (await client.get(f"/listings/{stay.listing['id']}/reviews")).json()["total"] == 1


async def test_an_admin_cannot_approve_a_listing_with_fewer_than_5_photos(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    """Features 010 and 021: the API keeps the site's rule, 5 photos since 021. Rejecting stays possible."""
    admin = await factory.admin()
    listing = await factory.listing(approved=False, photos=4)
    r = await approve(client, admin, int(listing["id"]))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "too_few_photos"
    assert (await state(db, int(listing["id"])))[0] == "pending"
    assert (await reject(client, admin, int(listing["id"]))).status_code == 200


async def test_a_host_cannot_remove_one_of_the_last_5_photos(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    host = await factory.user("host")
    listing = await factory.listing(host, approved=False)  # 5 photos
    ids = [row[0] for row in await sql(db, "SELECT id FROM listing_photos WHERE listing_id = :l", l=int(listing["id"]))]
    r = await client.delete(f"/listings/{listing['id']}/photos/{ids[0]}", headers=host.auth)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "too_few_photos"
    assert len(ids) == 5
