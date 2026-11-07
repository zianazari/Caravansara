"""Migrations go down and up cleanly, on a database of their own."""

import asyncio
from collections.abc import AsyncIterator
from datetime import date
from decimal import Decimal
from uuid import uuid4

import asyncpg
import pytest
from alembic import command
from alembic.config import Config

from caravansara.cli import ALEMBIC_INI, migrate
from caravansara.core.config import Settings

# Our tables only: PostGIS owns spatial_ref_sys, Alembic owns alembic_version.
TABLES = (
    "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' "
    "AND tablename NOT IN ('alembic_version', 'spatial_ref_sys')"
)


async def test_downgrade_and_upgrade_again(prepared: Settings) -> None:
    admin = prepared.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = await asyncpg.connect(admin)
    await conn.execute("DROP DATABASE IF EXISTS migration_check")
    await conn.execute("CREATE DATABASE migration_check")
    await conn.close()
    url = prepared.database_url.rsplit("/", 1)[0] + "/migration_check"
    plain = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    settings = prepared.model_copy(update={"database_url": url})

    def downgrade() -> None:
        config = Config(str(ALEMBIC_INI))
        config.attributes["database_url"] = url
        command.downgrade(config, "base")

    async def table_count() -> int:
        c = await asyncpg.connect(plain)
        try:
            return int(await c.fetchval(TABLES))
        finally:
            await c.close()

    try:
        await asyncio.to_thread(migrate, settings)
        assert await table_count() == 14  # 12 from 0001, two from 0006
        await asyncio.to_thread(downgrade)
        assert await table_count() == 0
        await asyncio.to_thread(migrate, settings)  # and back up, as on a fresh deploy
        assert await table_count() == 14
    finally:
        conn = await asyncpg.connect(admin)
        await conn.execute("DROP DATABASE IF EXISTS migration_check WITH (FORCE)")
        await conn.close()


# specs/002-rial-price-columns: the five money columns and their width after 0002.
PRICE_COLUMNS = (
    ("listings", "price_per_night"),
    ("listings", "cleaning_fee"),
    ("bookings", "nightly_price"),
    ("bookings", "cleaning_fee"),
    ("bookings", "total_price"),
)
WIDTH = (
    "SELECT table_name, column_name, numeric_precision, numeric_scale FROM information_schema.columns "
    "WHERE table_schema = 'public' AND (table_name, column_name) IN "
    "(('listings', 'price_per_night'), ('listings', 'cleaning_fee'), "
    "('bookings', 'nightly_price'), ('bookings', 'cleaning_fee'), ('bookings', 'total_price'))"
)
# A minimal catalog, user, listing and booking: the scratch database has no seed data.
ROWS = (
    "INSERT INTO countries (code, name) VALUES ('IR', 'Iran')",
    "INSERT INTO cities (country_id, name, timezone) SELECT id, 'Tehran', 'Asia/Tehran' FROM countries",
    "INSERT INTO users (email, password_hash, full_name) VALUES ('host@example.com', 'x', 'Host')",
    """INSERT INTO listings (host_id, title, property_type, city_id, address, latitude, longitude,
                             public_location, max_guests, price_per_night, cleaning_fee, currency)
       SELECT u.id, 'Old flat', 'entire_place', c.id, 'Street 1', 35.7, 51.4,
              ST_SetSRID(ST_MakePoint(51.4, 35.7), 4326)::geography, 2, 99999999.99, 12.34, 'IRR'
       FROM users u, cities c""",
)
BOOKING = """INSERT INTO bookings (listing_id, guest_id, check_in, check_out, adults, nightly_price, cleaning_fee,
                                  total_price, currency, status, idempotency_key)
             SELECT l.id, l.host_id, $1::date, $2::date, 1, $3, $4, $5, 'IRR', 'confirmed', $6 FROM listings l"""
AMOUNTS = (
    "SELECT l.price_per_night, l.cleaning_fee, b.nightly_price, b.cleaning_fee, b.total_price "
    "FROM bookings b JOIN listings l ON l.id = b.listing_id ORDER BY b.id"
)


class Scratch:
    """A database of its own, moved between Alembic revisions by the test."""

    def __init__(self, url: str) -> None:
        self.url = url
        self.plain = url.replace("postgresql+asyncpg://", "postgresql://", 1)

    def _config(self) -> Config:
        config = Config(str(ALEMBIC_INI))
        config.attributes["database_url"] = self.url
        return config

    async def upgrade(self, revision: str) -> None:
        await asyncio.to_thread(command.upgrade, self._config(), revision)

    async def downgrade(self, revision: str) -> None:
        await asyncio.to_thread(command.downgrade, self._config(), revision)

    async def fetch(self, query: str, *args: object) -> list[asyncpg.Record]:
        c = await asyncpg.connect(self.plain)
        try:
            rows: list[asyncpg.Record] = await c.fetch(query, *args)
            return rows
        finally:
            await c.close()

    async def execute(self, *queries: str) -> None:
        c = await asyncpg.connect(self.plain)
        try:
            for q in queries:
                await c.execute(q)
        finally:
            await c.close()

    async def add_booking(self, total: Decimal) -> None:
        c = await asyncpg.connect(self.plain)
        try:
            await c.execute(
                BOOKING, date(2026, 1, 1), date(2026, 1, 3), Decimal("99999999.99"), Decimal("12.34"), total, uuid4()
            )
        finally:
            await c.close()

    async def widths(self) -> set[tuple[str, str, int, int]]:
        return {(r[0], r[1], r[2], r[3]) for r in await self.fetch(WIDTH)}


@pytest.fixture
async def scratch(prepared: Settings) -> AsyncIterator[Scratch]:
    admin = prepared.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = await asyncpg.connect(admin)
    await conn.execute("DROP DATABASE IF EXISTS price_migration_check")
    await conn.execute("CREATE DATABASE price_migration_check")
    await conn.close()
    try:
        yield Scratch(prepared.database_url.rsplit("/", 1)[0] + "/price_migration_check")
    finally:
        conn = await asyncpg.connect(admin)
        await conn.execute("DROP DATABASE IF EXISTS price_migration_check WITH (FORCE)")
        await conn.close()


def _all(precision: int) -> set[tuple[str, str, int, int]]:
    return {(t, c, precision, 2) for t, c in PRICE_COLUMNS}


async def test_0002_widens_price_columns_and_keeps_values(scratch: Scratch) -> None:
    await scratch.upgrade("0001")
    await scratch.execute(*ROWS)
    await scratch.add_booking(Decimal("99999999.99"))
    assert await scratch.widths() == _all(10)
    before = [tuple(r) for r in await scratch.fetch(AMOUNTS)]

    await scratch.upgrade("head")
    assert await scratch.widths() == _all(14)
    assert [tuple(r) for r in await scratch.fetch(AMOUNTS)] == before

    await scratch.downgrade("0001")  # every amount fits the old width
    assert await scratch.widths() == _all(10)
    assert [tuple(r) for r in await scratch.fetch(AMOUNTS)] == before


async def test_downgrade_stops_when_an_amount_no_longer_fits(scratch: Scratch) -> None:
    await scratch.upgrade("head")
    await scratch.execute(*ROWS)
    await scratch.add_booking(Decimal("36505000000.00"))
    before = [tuple(r) for r in await scratch.fetch(AMOUNTS)]

    # PostgreSQL 22003; Alembic passes the driver's error on unchanged.
    with pytest.raises(Exception, match="numeric field overflow"):
        await scratch.downgrade("0001")

    # Nothing changed: same width, same revision, same amounts.
    assert await scratch.widths() == _all(14)
    assert [r[0] for r in await scratch.fetch("SELECT version_num FROM alembic_version")] == ["0002"]
    assert [tuple(r) for r in await scratch.fetch(AMOUNTS)] == before


async def test_0003_adds_pg_stat_statements_and_downgrade_keeps_the_data(scratch: Scratch) -> None:
    """specs/003-index-review: the extension the Grafana query panel reads (FR-003)."""
    await scratch.upgrade("head")
    extensions = "SELECT extname FROM pg_extension WHERE extname = 'pg_stat_statements'"
    assert [r[0] for r in await scratch.fetch(extensions)] == ["pg_stat_statements"]
    await scratch.execute(*ROWS)
    before = [tuple(r) for r in await scratch.fetch("SELECT id, price_per_night FROM listings")]

    await scratch.downgrade("0002")
    assert [r[0] for r in await scratch.fetch("SELECT version_num FROM alembic_version")] == ["0002"]
    assert [tuple(r) for r in await scratch.fetch("SELECT id, price_per_night FROM listings")] == before
    # On purpose the extension stays: dropping it would only lose the statistics (0003's docstring).
    assert [r[0] for r in await scratch.fetch(extensions)] == ["pg_stat_statements"]


INDEXES = "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bookings' ORDER BY indexname"


@pytest.mark.parametrize(
    ("revision", "previous", "added"),
    [
        ("0004", "0003", {"bookings_listing_check_in_idx", "bookings_active_stay_idx"}),  # US2
        ("0005", "0004", {"bookings_confirmed_check_out_idx"}),  # US3
    ],
)
async def test_index_migrations_add_valid_indexes_and_downgrade_removes_only_those(
    scratch: Scratch, revision: str, previous: str, added: set[str]
) -> None:
    """specs/003-index-review: indexes only; no row or other index changes either way."""
    await scratch.upgrade(previous)
    await scratch.execute(*ROWS)
    await scratch.add_booking(Decimal("200000024.32"))
    before_indexes = {r[0]: r[1] for r in await scratch.fetch(INDEXES)}
    before_rows = [tuple(r) for r in await scratch.fetch(AMOUNTS)]

    await scratch.upgrade(revision)
    after = {r[0]: r[1] for r in await scratch.fetch(INDEXES)}
    assert set(after) - set(before_indexes) == added
    assert {k: v for k, v in after.items() if k not in added} == before_indexes
    invalid = "SELECT indexrelid::regclass::text FROM pg_index WHERE NOT indisvalid"
    assert await scratch.fetch(invalid) == []  # CONCURRENTLY finished every build
    assert [tuple(r) for r in await scratch.fetch(AMOUNTS)] == before_rows

    await scratch.downgrade(previous)
    assert {r[0]: r[1] for r in await scratch.fetch(INDEXES)} == before_indexes
    assert [tuple(r) for r in await scratch.fetch(AMOUNTS)] == before_rows


# ---- 0006: listing review (specs/004-listing-approval) --------------------------------

REVIEW = "SELECT review_status::text, submitted_at, rejection_reason, review_version FROM listings ORDER BY id"
COUNTS = "SELECT (SELECT count(*) FROM listings), (SELECT count(*) FROM bookings), (SELECT count(*) FROM reviews)"
SECOND_LISTING = ROWS[3].replace("'Old flat'", "'Hidden flat'")


async def test_0006_upgrade_approves_every_existing_listing(scratch: Scratch) -> None:
    """FR-013, US5/AC1: active and inactive listings alike stay as public as they were."""
    await scratch.upgrade("0005")
    await scratch.execute(*ROWS, SECOND_LISTING, "UPDATE listings SET is_active = false WHERE title = 'Hidden flat'")

    await scratch.upgrade("0006")
    assert [tuple(r) for r in await scratch.fetch(REVIEW)] == [("approved", None, None, 0)] * 2
    # The planner knows the new column at once: without statistics the city searches change plans.
    stats = "SELECT 1 FROM pg_stats WHERE tablename = 'listings' AND attname = 'review_status'"
    assert len(await scratch.fetch(stats)) == 1
    kinds = await scratch.fetch("SELECT kind::text FROM users")
    assert [r[0] for r in kinds] == ["member"]


async def test_0006_new_rows_get_the_new_defaults(scratch: Scratch) -> None:
    """A listing inserted without a review state waits in the queue, even if code forgets it."""
    await scratch.upgrade("0006")
    await scratch.execute(*ROWS)
    rows = await scratch.fetch(REVIEW)
    assert rows[0][0] == "pending"
    assert rows[0][1] is not None
    assert rows[0][2] is None
    assert rows[0][3] == 0
    assert [r[0] for r in await scratch.fetch("SELECT kind::text FROM users")] == ["member"]


@pytest.mark.parametrize(
    "change",
    [
        "UPDATE listings SET submitted_at = NULL",  # pending needs a queue time
        "UPDATE listings SET review_status = 'rejected'",  # rejected needs a reason
        "UPDATE listings SET review_status = 'approved', rejection_reason = 'x'",  # reason only when rejected
        "UPDATE listings SET review_status = 'rejected', rejection_reason = '   '",  # blank
        "UPDATE listings SET review_status = 'rejected', rejection_reason = repeat('x', 1001)",  # too long
    ],
)
async def test_0006_checks_refuse_impossible_review_states(scratch: Scratch, change: str) -> None:
    await scratch.upgrade("0006")
    await scratch.execute(*ROWS)
    with pytest.raises(asyncpg.CheckViolationError):
        await scratch.execute(change)


async def test_0006_review_history_is_append_only(scratch: Scratch) -> None:
    await scratch.upgrade("0006")
    await scratch.execute(
        *ROWS,
        """INSERT INTO listing_review_events (listing_id, action, actor_id, review_version)
           SELECT l.id, 'submitted', l.host_id, 0 FROM listings l""",
    )
    for change in ("UPDATE listing_review_events SET review_version = 1", "DELETE FROM listing_review_events"):
        with pytest.raises(asyncpg.RaiseError, match="append-only"):
            await scratch.execute(change)
    with pytest.raises(asyncpg.CheckViolationError):  # a rejection always has its reason
        await scratch.execute(
            """INSERT INTO listing_review_events (listing_id, action, actor_id, review_version)
               SELECT l.id, 'rejected', l.host_id, 0 FROM listings l"""
        )


async def test_0006_downgrade_hides_unapproved_listings_and_keeps_every_row(scratch: Scratch) -> None:
    """R16: nothing unreviewed becomes public; listings, bookings and reviews all stay."""
    await scratch.upgrade("0006")
    await scratch.execute(*ROWS)
    await scratch.add_booking(Decimal("200000024.32"))  # on the pending "Old flat"
    await scratch.execute(
        SECOND_LISTING,
        ROWS[3].replace("'Old flat'", "'Approved flat'"),
        "UPDATE listings SET review_status = 'rejected', rejection_reason = 'Photos are not this flat.' "
        "WHERE title = 'Hidden flat'",
        "UPDATE listings SET review_status = 'approved' WHERE title = 'Approved flat'",
        "INSERT INTO users (email, password_hash, full_name, kind) VALUES ('admin@example.com', 'x', 'Admin', 'admin')",
        "INSERT INTO auth_attempts (action, identifier, succeeded) VALUES ('admin_login', 'admin@example.com', true)",
        """INSERT INTO listing_review_events (listing_id, action, actor_id, review_version, reason)
           SELECT l.id, 'rejected', u.id, 0, 'Photos are not this flat.'
           FROM listings l, users u WHERE l.title = 'Hidden flat' AND u.kind = 'admin'""",
        """INSERT INTO admin_address_views (admin_id, listing_id)
           SELECT u.id, l.id FROM listings l, users u WHERE l.title = 'Hidden flat' AND u.kind = 'admin'""",
    )
    counts = tuple((await scratch.fetch(COUNTS))[0])

    await scratch.downgrade("0005")
    active = await scratch.fetch("SELECT title, is_active FROM listings ORDER BY id")
    assert [tuple(r) for r in active] == [("Old flat", False), ("Hidden flat", False), ("Approved flat", True)]
    assert [r[0] for r in await scratch.fetch("SELECT email FROM users ORDER BY id")] == ["host@example.com"]
    assert tuple((await scratch.fetch(COUNTS))[0]) == counts

    await scratch.upgrade("0006")  # and back up again
