"""Bulk data (caravansara seed-bulk): generation without a database, then loading on the test container."""

import asyncio
import hashlib
import itertools
import json
import statistics
from collections import defaultdict
from collections.abc import AsyncIterator, Iterator
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import asyncpg
import pytest
from httpx import ASGITransport, AsyncClient

from caravansara import cli
from caravansara.core.config import Settings
from caravansara.devdata import bulk, profiles
from caravansara.main import create_app
from tests.helpers import days, register, reserve

PROFILES = Path(__file__).resolve().parents[2] / "db" / "bulk" / "city_profiles.json"
TODAY = date(2026, 11, 5)
CITY_IDS = {"Amsterdam": 1, "Lisbon": 2, "Copenhagen": 3, "Stockholm": 4, "London": 5, "New York City": 6}
AMENITIES = json.loads(PROFILES.read_text(encoding="utf-8"))["cities"]["London"]["amenity_probability"]
AMENITY_IDS = {name: i for i, name in enumerate(sorted(AMENITIES), start=1)}
ACTIVE = {"pending", "confirmed", "completed"}


def _generate(n: int, seed: int = 7, today: date = TODAY) -> bulk.BulkData:
    return bulk.generate(
        profiles.load(PROFILES), listings=n, seed=seed, today=today, city_ids=CITY_IDS, amenity_ids=AMENITY_IDS
    )


def _digest(data: bulk.BulkData) -> str:
    h = hashlib.sha256()
    for table in bulk.TABLES:
        for row in getattr(data, table)():
            h.update(repr(row).encode())
    return h.hexdigest()


@pytest.fixture(scope="module")
def sample() -> bulk.BulkData:
    return _generate(20_000)


# ---------- generation, no database -------------------------------------


def test_profiles_file_is_valid() -> None:
    loaded = profiles.load(PROFILES, amenity_names=AMENITIES)
    assert set(loaded.cities) == set(CITY_IDS)


@pytest.mark.parametrize(
    ("change", "rule"),
    [
        (lambda c: c["room_type_share"].update(entire_place=0.9), "room_type_share must sum to 1"),
        (lambda c: c["price_percentiles"]["entire_place"].reverse(), "price_percentiles.entire_place must rise"),
        (lambda c: c["amenity_probability"].update(Teleporter=0.5), "unknown amenity Teleporter"),
    ],
)
def test_invalid_profile_is_rejected(tmp_path: Path, change: Any, rule: str) -> None:
    doc = json.loads(PROFILES.read_text(encoding="utf-8"))
    change(doc["cities"]["Amsterdam"])
    broken = tmp_path / "profiles.json"
    broken.write_text(json.dumps(doc), encoding="utf-8")
    with pytest.raises(profiles.ProfileError, match=f"invalid city profile: Amsterdam: {rule}"):
        profiles.load(broken, amenity_names=AMENITIES)


def test_generation_is_deterministic() -> None:
    assert _digest(_generate(500)) == _digest(_generate(500))
    assert _digest(_generate(500)) != _digest(_generate(500, seed=8))


def test_distribution_matches_profile(sample: bulk.BulkData) -> None:
    loaded = profiles.load(PROFILES)
    city_of = {v: k for k, v in CITY_IDS.items()}
    prices: dict[tuple[str, str], list[float]] = defaultdict(list)
    types: dict[str, list[str]] = defaultdict(list)
    for row in sample.listings():
        r: dict[str, Any] = dict(zip(bulk.COLUMNS["listings"], row, strict=True))
        city = city_of[r["city_id"]]
        prices[city, r["property_type"]].append(float(r["price_per_night"]))
        types[city].append(r["property_type"])
    for city, profile in loaded.cities.items():
        for rt, share in profile.room_type_share.items():
            got = types[city].count(rt) / len(types[city])
            assert abs(got - share) < 0.05, (city, rt, got, share)
            if len(prices[city, rt]) >= 200:  # SC-003: median within 10 %
                real = profile.price_percentiles[rt][50]
                assert abs(statistics.median(prices[city, rt]) - real) / real < 0.10, (city, rt)


def test_default_size_reaches_targets(sample: bulk.BulkData) -> None:
    parser_default = cli.build_parser().parse_args(["seed-bulk"]).listings
    assert parser_default == 100_000
    bookings = sum(1 for _ in sample.bookings())
    assert bookings / sample.listing_count >= 20  # so the default size gives >= 2,000,000 (FR-002)
    assert sample.guests == 3 * sample.listing_count
    assert sum(1 for _ in sample.listing_photos()) == 3 * sample.listing_count


def test_active_bookings_never_overlap_in_memory() -> None:
    data = _generate(2_000)
    cols = bulk.COLUMNS["bookings"]
    stays: dict[int, list[tuple[date, date]]] = defaultdict(list)
    status_of: dict[int, str] = {}
    check_out_of: dict[int, date] = {}
    for row in data.bookings():
        b: dict[str, Any] = dict(zip(cols, row, strict=True))
        status_of[b["id"]] = b["status"]
        check_out_of[b["id"]] = b["check_out"]
        assert b["check_out"] > b["check_in"]
        assert b["check_in"] <= TODAY + timedelta(days=365)
        if b["status"] in ACTIVE:
            stays[b["listing_id"]].append((b["check_in"], b["check_out"]))
        if b["status"] == "completed":
            assert b["check_out"] <= TODAY
    for ranges in stays.values():
        ranges.sort()
        assert all(a[1] <= b[0] for a, b in itertools.pairwise(ranges))
    reviews = 0
    for row in data.reviews():
        r: dict[str, Any] = dict(zip(bulk.COLUMNS["reviews"], row, strict=True))
        assert status_of[r["booking_id"]] == "completed"
        written = datetime.fromisoformat(r["created_at"]).date()
        assert check_out_of[r["booking_id"]] <= written <= check_out_of[r["booking_id"]] + timedelta(days=14)
        reviews += 1
    assert reviews > 0


def test_near_zero_occupancy_gives_few_bookings_and_no_overflow(tmp_path: Path) -> None:
    doc = json.loads(PROFILES.read_text(encoding="utf-8"))
    for city in doc["cities"].values():
        city["occupancy_l365d"] = [0.001] * 101  # a few hours a year: gaps of about a million days
    quiet = tmp_path / "quiet.json"
    quiet.write_text(json.dumps(doc), encoding="utf-8")
    data = bulk.generate(
        profiles.load(quiet), listings=300, seed=1, today=TODAY, city_ids=CITY_IDS, amenity_ids=AMENITY_IDS
    )
    assert sum(1 for _ in data.bookings()) < 30


# ---------- loading on the test container ---------------------------------

BULK_DB = "test_bulk"


def _url(settings: Settings, database: str) -> str:
    return settings.database_url.rsplit("/", 1)[0] + "/" + database


async def _fetch(settings: Settings, database: str, query: str) -> Any:
    conn = await asyncpg.connect(_url(settings, database).replace("+asyncpg", "", 1))
    try:
        return await conn.fetch(query)
    finally:
        await conn.close()


@pytest.fixture
async def bulk_settings(prepared: Settings, monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[Settings]:
    """CLI runs against the test container; the bulk database is dropped afterwards."""
    monkeypatch.setattr(cli, "get_settings", lambda: prepared)
    yield prepared
    conn = await asyncpg.connect(prepared.database_url.replace("+asyncpg", "", 1))
    try:
        await conn.execute(f"DROP DATABASE IF EXISTS {BULK_DB} WITH (FORCE)")
    finally:
        await conn.close()


def _run(*args: str) -> None:
    cli.main(["seed-bulk", "--listings", "200", "--database", BULK_DB, *args])


async def _checksum(settings: Settings) -> str:
    rows = await _fetch(settings, BULK_DB, "SELECT md5(string_agg(b::text, ',' ORDER BY id)) FROM bookings b")
    return str(rows[0][0])


async def test_seed_bulk_loads_and_keeps_rules(bulk_settings: Settings, capsys: pytest.CaptureFixture[str]) -> None:
    today = date.today()
    await asyncio.to_thread(_run, "--today", today.isoformat())
    assert f"bulk data loaded into {BULK_DB}: 200 listings" in capsys.readouterr().out

    (counts,) = await _fetch(
        bulk_settings,
        BULK_DB,
        "SELECT (SELECT count(*) FROM listings), (SELECT count(*) FROM listing_photos),"
        " (SELECT count(*) FROM bookings), (SELECT count(*) FROM reviews), (SELECT count(*) FROM cities)",
    )
    listings, photos, bookings, reviews, cities = counts
    assert (listings, photos, cities) == (200, 600, 9)
    assert bookings >= 4_000  # about 30 per listing
    assert reviews > 0
    (wrong,) = await _fetch(
        bulk_settings,
        BULK_DB,
        "SELECT count(*) FROM listings l"
        " WHERE review_count <> (SELECT count(*) FROM reviews r WHERE r.listing_id = l.id)"
        " OR avg_rating IS DISTINCT FROM (SELECT round(avg(rating), 2) FROM reviews r WHERE r.listing_id = l.id)",
    )
    assert wrong[0] == 0
    # The rating trigger rewrote each listing once per review; the load compacts the table afterwards.
    ((pages, rows),) = await _fetch(
        bulk_settings, BULK_DB, "SELECT pg_relation_size('listings') / 8192, (SELECT count(*) FROM listings)"
    )
    assert rows / pages >= 10, (rows, pages)  # about 25 listings fit a page; bloated, about 2 did

    # The app works on the bulk database: search, then a new guest books and pays.
    app = create_app(bulk_settings.model_copy(update={"database_url": _url(bulk_settings, BULK_DB)}))
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test/api/v1") as client,
    ):
        found = await client.get("/search/listings", params={"lat": 51.507, "lng": -0.128, "radius_km": 30})
        assert found.status_code == 200
        assert found.json()["total"] > 0
        (free,) = await _fetch(
            bulk_settings,
            BULK_DB,
            f"SELECT l.id FROM listings l WHERE l.is_active AND NOT EXISTS (SELECT 1 FROM bookings b"  # noqa: S608
            f" WHERE b.listing_id = l.id AND b.status IN ('pending', 'confirmed', 'completed')"
            f" AND b.stay && daterange('{days(300)}', '{days(303)}')) ORDER BY l.id LIMIT 1",
        )
        guest = await register(client, "bulk-guest")
        booking = await reserve(client, guest, free[0], check_in=300, check_out=303, adults=1)
        assert booking.status_code == 201, booking.text
        paid = await client.post(f"/bookings/{booking.json()['id']}/pay", headers=guest.auth)
        assert paid.json()["status"] == "confirmed"


async def test_seed_bulk_refuses_configured_database(
    bulk_settings: Settings, capsys: pytest.CaptureFixture[str]
) -> None:
    configured = bulk_settings.database_url.rsplit("/", 1)[1]
    with pytest.raises(SystemExit) as stop:
        await asyncio.to_thread(cli.main, ["seed-bulk", "--listings", "200", "--database", configured])
    assert stop.value.code == 1
    assert f"refusing to load bulk data into the configured database '{configured}'" in capsys.readouterr().err


async def test_seed_bulk_refuses_non_empty_target(bulk_settings: Settings, capsys: pytest.CaptureFixture[str]) -> None:
    await asyncio.to_thread(_run, "--today", "2026-11-05")
    first = await _checksum(bulk_settings)
    with pytest.raises(SystemExit):
        await asyncio.to_thread(_run, "--today", "2026-11-05")
    assert "use --replace to rebuild it" in capsys.readouterr().err
    await asyncio.to_thread(_run, "--today", "2026-11-05", "--replace")
    assert await _checksum(bulk_settings) == first  # same seed, same data (FR-004)


async def test_replace_only_drops_bulk_databases(bulk_settings: Settings, capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit):
        await asyncio.to_thread(cli.main, ["seed-bulk", "--database", "other", "--replace"])
    assert "--replace only drops databases whose name ends with _bulk" in capsys.readouterr().err


async def test_seed_bulk_is_atomic(bulk_settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
    real = bulk.BulkData.reviews

    def broken(self: bulk.BulkData) -> Iterator[tuple[Any, ...]]:
        rows = real(self)
        yield next(rows)
        raise RuntimeError("connection lost")

    monkeypatch.setattr(bulk.BulkData, "reviews", broken)
    with pytest.raises(RuntimeError, match="connection lost"):
        await asyncio.to_thread(_run)
    (counts,) = await _fetch(
        bulk_settings,
        BULK_DB,
        "SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM listings), (SELECT count(*) FROM bookings)",
    )
    assert tuple(counts) == (0, 0, 0)  # FR-007: all or nothing


async def test_seed_bulk_refuses_production(
    prepared: Settings, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(cli, "get_settings", lambda: prepared.model_copy(update={"environment": "production"}))
    with pytest.raises(SystemExit):
        await asyncio.to_thread(_run)
    assert "seed-bulk is for development and measurement only" in capsys.readouterr().err
