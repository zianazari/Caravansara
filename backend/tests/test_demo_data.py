"""The demo data (db/seed_demo.sql): edge cases, variety, photos and Persian content, through the API.

The demo is loaded once for the whole module (``keep_data``) because it is 6 MB of SQL; tests here
only read it, except the last one, which changes one hold on purpose.
"""

import asyncio
import itertools
import json
import re
from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara import cli
from caravansara.core.config import Settings
from caravansara.core.storage import Storage
from caravansara.jobs.runner import run_once
from tests.conftest import DATA_TABLES
from tests.factories import Factory
from tests.helpers import register, reserve, sql

pytestmark = pytest.mark.keep_data

DEMO = Path(__file__).resolve().parents[2] / "db" / "demo"
EDGE: dict[str, Any] = json.loads((DEMO / "edge_cases.json").read_text(encoding="utf-8"))
MANIFEST: dict[str, Any] = json.loads((DEMO / "photos" / "manifest.json").read_text(encoding="utf-8"))
PASSWORD = "caravansara-demo"
PERSIAN = re.compile(r"[؀-ۿ]")
INSIDE_AIRBNB = ("Amsterdam", "Lisbon", "Copenhagen", "Stockholm", "London", "New York City")


@pytest.fixture(scope="module")
async def demo(prepared: Settings, engine: AsyncEngine) -> AsyncIterator[cli.DemoResult]:
    result = await cli.seed_demo(prepared, photos=False)
    yield result
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {DATA_TABLES} RESTART IDENTITY CASCADE"))


async def _login(client: AsyncClient, email: str) -> dict[str, str]:
    r = await client.post("/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def _host_auth(client: AsyncClient, db: AsyncEngine, listing_id: int) -> dict[str, str]:
    ((email,),) = await sql(
        db, "SELECT u.email FROM listings l JOIN users u ON u.id = l.host_id WHERE l.id = :id", id=listing_id
    )
    return await _login(client, email)


def _city_today(city: str) -> date:
    timezone = {
        "Amsterdam": "Europe/Amsterdam",
        "Lisbon": "Europe/Lisbon",
        "Copenhagen": "Europe/Copenhagen",
        "Stockholm": "Europe/Stockholm",
        "London": "Europe/London",
        "New York City": "America/New_York",
    }
    return datetime.now(UTC).astimezone(ZoneInfo(timezone[city])).date()  # fmt: skip


async def _listing_bookings(client: AsyncClient, db: AsyncEngine, key: str) -> list[dict[str, Any]]:
    lid = EDGE[key]["listing_id"]
    r = await client.get(f"/listings/{lid}/bookings", params={"limit": 100}, headers=await _host_auth(client, db, lid))
    assert r.status_code == 200, r.text
    items: list[dict[str, Any]] = r.json()["items"]
    return items


# ---------- US2: edge cases --------------------------------------------------


async def test_hold_about_to_expire_and_expired_hold(demo: cli.DemoResult, client: AsyncClient) -> None:
    r = await client.get("/me/bookings", params={"limit": 100}, headers=await _login(client, "guest@example.com"))
    trips = {b["id"]: b for b in r.json()["items"]}
    hold = trips[EDGE["hold_about_to_expire"]["booking_ids"][0]]
    left = datetime.fromisoformat(hold["hold_expires_at"]) - datetime.now(UTC)
    assert hold["status"] == "pending"
    assert timedelta(0) < left < timedelta(minutes=5)
    assert trips[EDGE["expired_hold"]["booking_ids"][0]]["status"] == "expired"
    assert {"confirmed", "completed"} <= {b["status"] for b in trips.values()}  # FR-015: the older demo trips stay


async def test_same_day_turnover(demo: cli.DemoResult, client: AsyncClient, db: AsyncEngine) -> None:
    stays = sorted(
        (b for b in await _listing_bookings(client, db, "same_day_turnover") if b["status"] == "confirmed"),
        key=lambda b: b["check_in"],
    )
    assert any(a["check_out"] == b["check_in"] for a, b in itertools.pairwise(stays))


async def test_year_long_stay_and_last_bookable_day(demo: cli.DemoResult, client: AsyncClient, db: AsyncEngine) -> None:
    long = await _listing_bookings(client, db, "year_long_stay")
    assert any(b["nights"] == 365 and b["status"] == "confirmed" for b in long)
    last = await _listing_bookings(client, db, "last_bookable_day")
    limit = _city_today(EDGE["last_bookable_day"]["city"]) + timedelta(days=365)
    assert any(date.fromisoformat(b["check_in"]) == limit for b in last)


# ---------- specs/004-listing-approval: review state of the demo ------------------------


async def test_every_demo_listing_is_approved_except_the_two_review_cases(
    demo: cli.DemoResult, db: AsyncEngine
) -> None:
    """US5/AC2, FR-014."""
    rows = await sql(db, "SELECT id, review_status::text FROM listings WHERE review_status <> 'approved' ORDER BY id")
    expected = sorted(
        [(EDGE["pending_listing"]["listing_id"], "pending"), (EDGE["rejected_listing"]["listing_id"], "rejected")]
    )
    assert [tuple(r) for r in rows] == expected
    # SC-002: 789 public before 004 (790 listings, one inactive); the two review edge cases are new.
    public = await sql(db, "SELECT count(*) FROM listings WHERE is_active AND review_status = 'approved'")
    assert public[0][0] == 789 - 2


async def test_the_rejected_demo_listing_has_its_reason_and_history(
    demo: cli.DemoResult, client: AsyncClient, db: AsyncEngine
) -> None:
    rejected = EDGE["rejected_listing"]["listing_id"]
    mine = await client.get("/me/listings", params={"limit": 100}, headers=await _host_auth(client, db, rejected))
    review = {i["id"]: i["review"] for i in mine.json()["items"]}[rejected]
    assert review["status"] == "rejected"
    assert PERSIAN.search(review["rejection_reason"])
    rows = await sql(
        db,
        "SELECT e.action::text, u.email FROM listing_review_events e JOIN users u ON u.id = e.actor_id "
        "WHERE e.listing_id = :id ORDER BY e.id",
        id=rejected,
    )
    assert [r[0] for r in rows] == ["submitted", "rejected"]
    assert rows[1][1] == "admin@example.com"


async def test_the_demo_admin_logs_in_and_sees_the_pending_listing_first(
    demo: cli.DemoResult, client: AsyncClient, db: AsyncEngine
) -> None:
    kind = await sql(db, "SELECT kind::text FROM users WHERE email = 'admin@example.com'")
    assert kind[0][0] == "admin"
    r = await client.post("/admin/auth/login", json={"email": "admin@example.com", "password": PASSWORD})
    assert r.status_code == 200, r.text
    queue = await client.get("/admin/listings/pending", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert [i["id"] for i in queue.json()["items"]] == [EDGE["pending_listing"]["listing_id"]]
    member = await client.post("/auth/login", json={"email": "admin@example.com", "password": PASSWORD})
    assert member.status_code == 401


async def test_inactive_listing_hidden_from_search_but_visible_to_host(
    demo: cli.DemoResult, client: AsyncClient, db: AsyncEngine
) -> None:
    inactive = EDGE["inactive_listing"]["listing_id"]
    found = await client.get("/search/listings", params={"lat": 51.507, "lng": -0.128, "radius_km": 100, "limit": 100})
    assert inactive not in {item["id"] for item in found.json()["items"]}
    mine = await client.get("/me/listings", params={"limit": 100}, headers=await _host_auth(client, db, inactive))
    own = {item["id"]: item for item in mine.json()["items"]}
    assert own[inactive]["is_active"] is False
    statuses = {b["status"] for b in await _listing_bookings(client, db, "inactive_listing")}
    assert {"completed", "confirmed"} <= statuses

    quiet = await client.get(f"/listings/{EDGE['listing_without_reviews']['listing_id']}")
    assert quiet.json()["is_active"] is True
    assert quiet.json()["review_count"] == 0
    assert quiet.json()["avg_rating"] is None


# ---------- US3: variety and photos ------------------------------------------


async def test_catalog_variety(demo: cli.DemoResult, db: AsyncEngine) -> None:
    ((cities, countries, currencies, offsets),) = await sql(
        db,
        """SELECT count(DISTINCT c.id), count(DISTINCT c.country_id), count(DISTINCT l.currency),
                  count(DISTINCT tz.utc_offset)
           FROM listings l JOIN cities c ON c.id = l.city_id JOIN pg_timezone_names tz ON tz.name = c.timezone""",
    )
    assert cities >= 8
    assert countries >= 6
    assert currencies >= 4
    assert offsets >= 3


async def test_listing_counts_per_city(demo: cli.DemoResult, db: AsyncEngine) -> None:
    per_city = dict(
        await sql(db, "SELECT c.name, count(*) FROM listings l JOIN cities c ON c.id = l.city_id GROUP BY c.name")
    )
    assert all(per_city[city] >= 125 for city in INSIDE_AIRBNB)
    ((most,),) = await sql(db, "SELECT max(review_count) FROM listings WHERE currency <> 'IRR'")
    assert most <= 15


async def test_photos_per_listing(demo: cli.DemoResult, db: AsyncEngine, client: AsyncClient) -> None:
    rows = await sql(
        db,
        """SELECT listing_id, array_agg(sort_order ORDER BY sort_order), array_agg(room_tag ORDER BY sort_order)
           FROM listing_photos GROUP BY listing_id""",
    )
    ((listings,),) = await sql(db, "SELECT count(*) FROM listings")
    assert len(rows) == listings  # every listing has photos (SC-006)
    for _, orders, tags in rows:
        assert 3 <= len(orders) <= 8
        assert orders == list(range(len(orders)))
        assert len(set(tags)) == len(tags)
        assert all(tags)
        assert tags[0] in ("Living room", "Bedroom")
    detail = (await client.get(f"/listings/{rows[0][0]}")).json()
    assert [p["sort_order"] for p in detail["photos"]] == list(range(len(detail["photos"])))


async def test_reviews_use_only_fake_people(demo: cli.DemoResult, db: AsyncEngine) -> None:
    ((outside,),) = await sql(db, "SELECT count(*) FROM users WHERE email NOT LIKE '%@example.com'")
    assert outside == 0
    # Real names are not in the repo, so CI cannot look for them: build_demo_seed.py checks every
    # review against the real host and reviewer names and stops before writing if one is left (FR-016).


async def test_listing_with_missing_photo_file_still_shows(
    demo: cli.DemoResult, client: AsyncClient, db: AsyncEngine
) -> None:
    ((lid,),) = await sql(db, "SELECT min(id) FROM listings WHERE is_active")
    r = await client.get(f"/listings/{lid}")  # no photo files are uploaded yet in this module
    assert r.status_code == 200
    assert r.json()["photos"]


async def test_demo_photos_are_in_storage(demo: cli.DemoResult, prepared: Settings, db: AsyncEngine) -> None:
    uploaded = await cli.seed_demo(prepared, photos_only=True)
    assert uploaded.photo_error is None
    rows = await sql(db, "SELECT storage_key, width, height, room_tag FROM listing_photos ORDER BY id")
    assert uploaded.photos == len(rows)
    by_tag = {v["room_tag"]: v for v in MANIFEST.values()}
    storage = Storage(prepared)
    for _key, width, height, tag in rows:
        expected = by_tag["Bedroom" if tag.startswith("Bedroom") else tag]
        assert (width, height) == (expected["width"], expected["height"])
    gate = asyncio.Semaphore(8)

    async def present(key: str) -> bool:
        async with gate:
            return await storage.exists(key)

    found = await asyncio.gather(*(present(key) for key, *_ in rows))
    assert all(found)  # SC-006: every photo row has its file


async def test_photo_failure_keeps_the_data(demo: cli.DemoResult, prepared: Settings) -> None:
    broken = prepared.model_copy(update={"s3_endpoint_url": "http://127.0.0.1:9"})  # nothing listens on port 9
    result = await cli.seed_demo(broken, photos_only=True)
    assert result.photo_error is not None
    assert result.listings == demo.listings
    assert "--photos-only" in result.summary()


# ---------- US4: Persian content ---------------------------------------------


async def test_persian_listings_in_iranian_cities(demo: cli.DemoResult, client: AsyncClient, db: AsyncEngine) -> None:
    ((count, cities),) = await sql(
        db,
        """SELECT count(*), count(DISTINCT l.city_id) FROM listings l JOIN cities c ON c.id = l.city_id
           JOIN countries co ON co.id = c.country_id WHERE co.code = 'IR' AND l.currency = 'IRR'""",
    )
    assert count >= 40
    assert cities >= 3
    found = await client.get("/search/listings", params={"lat": 35.70, "lng": 51.40, "radius_km": 25, "limit": 50})
    assert found.json()["total"] > 0
    assert all(PERSIAN.search(item["title"]) for item in found.json()["items"])


async def test_persian_listing_detail_and_reviews(demo: cli.DemoResult, client: AsyncClient, db: AsyncEngine) -> None:
    ((lid,),) = await sql(db, "SELECT min(id) FROM listings WHERE currency = 'IRR'")
    detail = (await client.get(f"/listings/{lid}")).json()
    assert detail["currency"] == "IRR"
    assert PERSIAN.search(detail["description"])
    reviews = (await client.get(f"/listings/{lid}/reviews")).json()["items"]
    assert len(reviews) >= 2
    assert all(PERSIAN.search(r["comment"]) for r in reviews)


async def test_persian_text_variety(demo: cli.DemoResult, db: AsyncEngine) -> None:
    texts = [
        t
        for (t,) in await sql(
            db,
            """SELECT description FROM listings WHERE currency = 'IRR'
               UNION ALL SELECT r.comment FROM reviews r JOIN listings l ON l.id = r.listing_id
               WHERE l.currency = 'IRR'""",
        )
    ]
    assert any(len(t) > 1000 for t in texts)
    assert any(len(t) < 20 for t in texts)
    assert any(PERSIAN.search(t) and re.search(r"[0-9A-Za-z]", t) for t in texts)
    assert any("‌" in t for t in texts)  # zero-width non-joiner, as in می‌شود


async def test_rial_prices_are_market_prices(demo: cli.DemoResult, db: AsyncEngine) -> None:
    """specs/002-rial-price-columns US3: real Iranian prices, now that the columns hold them."""
    rows = await sql(
        db,
        "SELECT property_type::text, min(price_per_night), max(price_per_night) FROM listings "
        "WHERE currency = 'IRR' GROUP BY 1",
    )
    ranges = {kind: (low, high) for kind, low, high in rows}
    assert ranges["entire_place"][0] >= 10_000_000
    assert ranges["entire_place"][1] == 100_000_000
    for room in ("private_room", "shared_room"):
        assert ranges[room][0] >= 2_500_000
        assert ranges[room][1] <= 10_000_000

    ((top_total, longest),) = await sql(
        db, "SELECT max(total_price), max(check_out - check_in) FROM bookings WHERE currency = 'IRR'"
    )
    assert 99_999_999.99 < top_total <= 999_999_999_999.99  # over the old column, inside the new one
    assert longest > 4


# ---------- US2-2: last, because it changes a demo hold ----------------------


async def test_overdue_hold_frees_dates(
    demo: cli.DemoResult, client: AsyncClient, db: AsyncEngine, app: Any, factory: Factory
) -> None:
    case = EDGE["hold_about_to_expire"]
    ((check_in, check_out),) = await sql(
        db, "SELECT check_in, check_out FROM bookings WHERE id = :id", id=case["booking_ids"][0]
    )
    await factory.expire_hold(case["booking_ids"][0])
    result = await run_once(app.state.sessionmaker)
    assert result.expired >= 1
    ((status,),) = await sql(db, "SELECT status::text FROM bookings WHERE id = :id", id=case["booking_ids"][0])
    assert status == "expired"
    today = datetime.now(UTC).date()
    pin = (await client.get(f"/listings/{case['listing_id']}")).json()["pin"]
    window = {
        "lat": pin["lat"],
        "lng": pin["lng"],
        "radius_km": 1,
        "check_in": str(check_in),
        "check_out": str(check_out),
    }
    free = await client.get("/search/listings", params={**window, "limit": 100})
    assert case["listing_id"] in {item["id"] for item in free.json()["items"]}  # US2/AC2: free again in search
    guest = await register(client, "late-guest")
    again = await reserve(
        client,
        guest,
        case["listing_id"],
        check_in=(check_in - today).days,
        check_out=(check_out - today).days,
        adults=1,
    )
    assert again.status_code == 201, again.text  # the dates are free again
