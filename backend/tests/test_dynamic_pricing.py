"""Real quotes, host permissions, holiday precedence and immutable reservation totals."""

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from httpx import AsyncClient

from tests.factories import Factory


async def test_quotes_search_and_booking_use_the_same_daily_prices(client: AsyncClient, factory: Factory) -> None:
    host, guest, admin = await factory.user("host"), await factory.user("guest"), await factory.admin()
    start = datetime.now(UTC).date() + timedelta(days=20)
    end = start + timedelta(days=4)
    custom = start + timedelta(days=2)
    policy = {
        "weekend_enabled": True,
        "weekend_days": list(range(7)),
        "weekend_percent": "30",
        "holiday_enabled": True,
        "holiday_percent": "100",
        "ranges": [
            {"id": "offer", "name": "Special offer", "start": str(custom), "end": str(custom), "percent": "-20"}
        ],
    }
    listing = await factory.listing(host, price_per_night="100.00", cleaning_fee="15.00", pricing_policy=policy)
    lid = listing["id"]
    path = f"/listings/{lid}/pricing"
    for day in (start + timedelta(days=1), custom):
        r = await client.put(f"/admin/holidays/NL/{day}", json={"name": "Shared holiday"}, headers=admin.auth)
        assert r.status_code == 200, r.text
    quote_path = f"{path}/quote"
    dates = {"check_in": str(start), "check_out": str(end)}
    quote = await client.get(quote_path, params=dates)
    assert quote.status_code == 200, quote.text
    body = quote.json()
    assert [n["source"] for n in body["nights"]] == ["weekend", "holiday", "custom", "weekend"]
    assert [Decimal(n["amount"]) for n in body["nights"]] == [Decimal(130), Decimal(200), Decimal(80), Decimal(130)]
    assert Decimal(body["total_price"]) == Decimal(555)
    search = await client.get("/search/listings", params={"city_id": 1, **dates})
    assert search.status_code == 200, search.text
    result = next(i for i in search.json()["items"] if i["id"] == lid)
    assert Decimal(result["total_price"]) == Decimal(555)
    headers = {**guest.auth, "Idempotency-Key": str(uuid.uuid4())}
    request = {"listing_id": lid, **dates, "expected_total": "555.00"}
    booked = await client.post("/bookings", json=request, headers=headers)
    assert booked.status_code == 201, booked.text
    assert booked.json()["nightly_prices"] == body["nights"]
    changed = await client.put(path, json={}, headers=host.auth)
    assert changed.status_code == 200, changed.text
    replay = await client.post("/bookings", json=request, headers=headers)
    assert replay.status_code == 200, replay.text
    assert Decimal(replay.json()["total_price"]) == Decimal(555)
    assert replay.json()["nightly_prices"] == body["nights"]
    fresh = await client.get(quote_path, params=dates)
    assert Decimal(fresh.json()["total_price"]) == Decimal(415)


async def test_ownership_validation_and_changed_price_cannot_be_bypassed(client: AsyncClient, factory: Factory) -> None:
    host, stranger, admin = await factory.user("host"), await factory.user("stranger"), await factory.admin()
    listing = await factory.listing(host)
    path = f"/listings/{listing['id']}/pricing"
    assert (await client.put(path, json={}, headers=stranger.auth)).status_code == 403
    assert (await client.get(path, headers=stranger.auth)).status_code == 403
    assert (await client.put(path, json={})).status_code == 401
    assert (await client.put(path, json={"weekend_percent": -100}, headers=host.auth)).status_code == 422
    rule = {"name": "Range", "start": "2027-01-01", "end": "2027-01-03", "percent": 10}
    assert (await client.put(path, json={"ranges": [rule, rule]}, headers=host.auth)).status_code == 422
    assert (
        await client.put(path, json={"weekend_enabled": True, "weekend_days": []}, headers=host.auth)
    ).status_code == 422
    assert (
        await client.put("/admin/holidays/NL/2027-01-01", json={"name": "Holiday"}, headers=host.auth)
    ).status_code == 401
    assert (
        await client.put("/admin/holidays/XX/2027-01-01", json={"name": "Holiday"}, headers=admin.auth)
    ).status_code == 422
    start = datetime.now(UTC).date() + timedelta(days=20)
    body = {
        "listing_id": listing["id"],
        "check_in": str(start),
        "check_out": str(start + timedelta(days=2)),
        "expected_total": "0",
    }
    r = await client.post("/bookings", json=body, headers={**stranger.auth, "Idempotency-Key": str(uuid.uuid4())})
    assert r.status_code == 409, r.text
    assert r.json()["error"]["code"] == "price_changed"


async def test_private_quotes_disabled_rules_rounding_and_holiday_deletion(
    client: AsyncClient, factory: Factory
) -> None:
    host, admin = await factory.user("host"), await factory.admin()
    start = datetime.now(UTC).date() + timedelta(days=20)
    listing = await factory.listing(
        host,
        approved=False,
        price_per_night="0.05",
        pricing_policy={
            "weekend_enabled": True,
            "weekend_days": list(range(7)),
            "weekend_percent": "10",
            "ranges": [{"name": "Disabled", "start": str(start), "end": str(start), "percent": 100, "enabled": False}],
        },
    )
    path = f"/listings/{listing['id']}/pricing/quote"
    dates = {"check_in": str(start), "check_out": str(start + timedelta(days=1))}
    assert (await client.get(path, params=dates)).status_code == 404
    r = await client.get(path, params=dates, headers=host.auth)
    assert r.status_code == 200, r.text
    assert Decimal(r.json()["nights"][0]["amount"]) == Decimal("0.06")
    await client.put(f"/admin/holidays/NL/{start}", json={"name": "Holiday"}, headers=admin.auth)
    assert (await client.delete(f"/admin/holidays/NL/{start}", headers=admin.auth)).status_code == 204
    calendar = await client.get(
        "/holidays", params={"country": "NL", "start": str(start), "end": str(start + timedelta(days=1))}
    )
    assert calendar.json() == []
