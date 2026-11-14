"""Budget discovery agrees with checkout and never invents availability or savings."""

from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from tests.helpers import city_id, create_listing, days, register, reserve, sql


def query(**extra: Any) -> dict[str, Any]:
    return {
        "budget": "1000",
        "currency": "EUR",
        "country": "NL",
        "preferred_check_in": days(10),
        "nights": 3,
        "flex_days": 3,
        **extra,
    }


async def discover(client: AsyncClient, **extra: Any) -> dict[str, Any]:
    response = await client.get("/search/opportunities", params=query(**extra))
    assert response.status_code == 200, response.text
    return response.json()


async def test_distinct_rankings_and_exact_totals(client: AsyncClient, db: AsyncEngine) -> None:
    host = await register(client, "host")
    cheap = await create_listing(client, host, title="Budget", price_per_night="50.01", cleaning_fee="9.99")
    rated = await create_listing(client, host, title="Loved", price_per_night="100")
    flexible = await create_listing(
        client,
        host,
        title="Flexible",
        price_per_night="120",
        pricing_policy={"ranges": [{"name": "Early deal", "start": days(7), "end": days(9), "percent": -50}]},
    )
    await sql(db, "UPDATE listings SET avg_rating = 4.95, review_count = 20 WHERE id = :id", id=rated["id"])
    page = await discover(client)
    items = page["items"]
    assert page["matched_listings"] == 3
    assert [item["listing"]["id"] for item in items] == [cheap["id"], rated["id"], flexible["id"]]
    assert [item["kind"] for item in items] == ["economical", "experience", "flexible"]
    assert items[0]["total_price"] == "160.02"
    assert items[2]["shift_days"] == -3
    assert items[2]["total_price"] == "205.00"
    assert items[2]["reference_total"] == "385.00"
    assert items[2]["savings"] == "180.00"
    for item in items:
        listing = item["listing"]
        assert listing["pin"]
        assert "address" not in listing
        assert "latitude" not in listing
        quote = await client.get(
            f"/listings/{listing['id']}/pricing/quote",
            params={"check_in": item["check_in"], "check_out": item["check_out"]},
        )
        assert quote.status_code == 200, quote.text
        assert item["total_price"] == quote.json()["total_price"]
        assert item["stay_total"] == quote.json()["stay_total"]
    assert (await discover(client, budget="160.01", flex_days=0))["items"] == []
    assert len((await discover(client, budget="160.02", flex_days=0))["items"]) == 1


async def test_capacity_currency_country_city_and_visibility(client: AsyncClient, db: AsyncEngine) -> None:
    host = await register(client)
    matching = await create_listing(client, host)
    await create_listing(client, host, currency="USD")
    await create_listing(client, host, city=await city_id(client, "Lisbon"), latitude=38.72, longitude=-9.14)
    await create_listing(client, host, approved=False)
    inactive = await create_listing(client, host)
    await sql(db, "UPDATE listings SET is_active = false WHERE id = :id", id=inactive["id"])
    await create_listing(client, host, pets_allowed=False, max_pets=0)
    page = await discover(client, adults=2, children=1, infants=10, pets=1, city_id=await city_id(client))
    assert [x["listing"]["id"] for x in page["items"]] == [matching["id"]]
    assert (await discover(client, adults=4))["items"] == []
    assert (await discover(client, country="IR"))["items"] == []
    assert (await discover(client, city_id=await city_id(client, "Lisbon")))["items"] == []


async def test_full_stay_blocks_expired_holds_and_no_false_savings(client: AsyncClient, db: AsyncEngine) -> None:
    host, guest = await register(client, "host"), await register(client, "guest")
    listing = await create_listing(
        client, host, pricing_policy={"ranges": [{"name": "Deal", "start": days(7), "end": days(9), "percent": -30}]}
    )
    hold = await reserve(client, guest, listing["id"], 10, 13)
    assert hold.status_code == 201, hold.text
    page = await discover(client)
    assert len(page["items"]) == 1
    assert page["items"][0]["check_in"] == days(7)
    assert page["items"][0]["reference_total"] is None
    assert page["items"][0]["savings"] is None
    assert (await discover(client, flex_days=0))["items"] == []
    await sql(
        db, "UPDATE bookings SET hold_expires_at = now() - interval '1 second' WHERE id = :id", id=hold.json()["id"]
    )
    assert len((await discover(client, flex_days=0))["items"]) == 1
    await sql(db, "UPDATE bookings SET status = 'confirmed' WHERE id = :id", id=hold.json()["id"])
    assert (await discover(client, flex_days=0))["items"] == []
    assert len((await discover(client, preferred_check_in=days(13), flex_days=0))["items"]) == 1


async def test_dynamic_prices_match_booking(client: AsyncClient, db: AsyncEngine) -> None:
    host, guest = await register(client, "host"), await register(client, "guest")
    anchor = date.fromisoformat(days(10))
    listing = await create_listing(
        client,
        host,
        price_per_night="100.01",
        cleaning_fee="12.34",
        pricing_policy={
            "weekend_enabled": True,
            "weekend_days": list(range(7)),
            "weekend_percent": 30,
            "holiday_enabled": True,
            "holiday_percent": 100,
            "ranges": [{"name": "Custom", "start": days(12), "end": days(12), "percent": -20}],
        },
    )
    await sql(
        db,
        "INSERT INTO holidays (country_code, day, name) VALUES ('NL', :day, 'Holiday')",
        day=anchor + timedelta(days=1),
    )
    item = (await discover(client, flex_days=0))["items"][0]
    assert item["total_price"] == "422.38"  # 130.01 + 200.02 + 80.01 + 12.34
    booking = await reserve(client, guest, listing["id"], expected_total=item["total_price"], expected_currency="EUR")
    assert booking.status_code == 201, booking.text
    assert booking.json()["total_price"] == item["total_price"]
    assert (await discover(client, flex_days=0))["items"] == []


async def test_no_duplicates_and_honest_unrated_alternatives(client: AsyncClient) -> None:
    host = await register(client)
    for price in (100, 101, 102, 103):
        await create_listing(client, host, price_per_night=str(price))
    page = await discover(client, flex_days=0)
    assert page["matched_listings"] == 4
    assert len(page["items"]) == len({item["listing"]["id"] for item in page["items"]}) == 3
    assert [item["kind"] for item in page["items"]] == ["economical", "alternative", "alternative"]
    assert all(item["savings"] is None for item in page["items"])
    assert all(item["check_in"] == days(10) for item in page["items"])


async def test_arrival_uses_each_city_local_date(
    client: AsyncClient, db: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> None:
    from caravansara.search import opportunities

    host = await register(client)
    await create_listing(client, host)
    monkeypatch.setattr(opportunities, "utcnow", lambda: datetime(2027, 1, 2, 0, 30, tzinfo=UTC))
    city = await city_id(client)
    original = (await sql(db, "SELECT timezone FROM cities WHERE id = :id", id=city))[0][0]
    try:
        await sql(db, "UPDATE cities SET timezone = 'America/Los_Angeles' WHERE id = :id", id=city)
        assert len((await discover(client, preferred_check_in="2027-01-01", flex_days=0))["items"]) == 1
        await sql(db, "UPDATE cities SET timezone = 'Asia/Tokyo' WHERE id = :id", id=city)
        assert (await discover(client, preferred_check_in="2027-01-01", flex_days=0))["items"] == []
        item = (await discover(client, preferred_check_in="2027-01-01", flex_days=3))["items"][0]
        assert item["check_in"] == "2027-01-02"
        assert item["savings"] is None
    finally:
        await sql(db, "UPDATE cities SET timezone = :timezone WHERE id = :id", timezone=original, id=city)


@pytest.mark.parametrize(
    "extra",
    [
        {"budget": "0"},
        {"budget": "NaN"},
        {"budget": "1000000000000"},
        {"budget": "1.001"},
        {"nights": 0},
        {"nights": 31},
        {"flex_days": 8},
        {"adults": 0},
        {"pets": 11},
        {"currency": "eur"},
        {"country": "Iran"},
        {"preferred_check_in": days(-10)},
        {"preferred_check_in": "9999-12-31"},
    ],
)
async def test_query_validation(client: AsyncClient, extra: dict[str, Any]) -> None:
    response = await client.get("/search/opportunities", params=query(**extra))
    assert response.status_code == 422, response.text
