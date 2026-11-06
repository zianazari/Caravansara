"""Load bulk data into its own database (``caravansara_bulk`` by default) with COPY, in one transaction.

Safety locks, checked before anything is written:
- never in production;
- never the database the app is configured to use (the everyday development data);
- ``replace`` drops only a database whose name ends with ``_bulk``;
- a target that already has users or listings is left alone unless ``replace`` is given.
All constraints and triggers stay on while loading (FR-006): the database checks the generator.
"""

import logging
import re
import time
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import asyncpg

from caravansara.core.config import Settings
from caravansara.devdata import bulk, profiles

log = logging.getLogger("caravansara.devdata")

DEFAULT_DATABASE = "caravansara_bulk"
_NAME = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")
_CHUNK_ROWS = 5_000
_SEQUENCES = ("users", "listings", "bookings")


class BulkRefused(Exception):
    """A safety lock stopped the load; nothing was changed."""


@dataclass(frozen=True)
class BulkResult:
    database: str
    listings: int
    users: int
    bookings: int
    reviews: int
    seconds: float

    def summary(self) -> str:
        minutes, seconds = divmod(round(self.seconds), 60)
        return (
            f"bulk data loaded into {self.database}: {self.listings} listings, {self.bookings} bookings, "
            f"{self.reviews} reviews in {minutes}m{seconds:02d}s"
        )


def _plain(url: str) -> str:
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


def database_name(url: str) -> str:
    return url.rsplit("/", 1)[1].split("?", 1)[0]


def with_database(url: str, name: str) -> str:
    base, _, rest = url.rpartition("/")
    query = rest.partition("?")[2]
    return f"{base}/{name}" + (f"?{query}" if query else "")


def _field(value: object) -> str:
    """One value in COPY text format."""
    if value is None:
        return "\\N"
    if isinstance(value, bool):
        return "t" if value else "f"
    if isinstance(value, date):
        return value.isoformat()
    text = str(value)
    if any(c in text for c in "\\\t\n\r"):
        text = text.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")
    return text


class _Counter:
    def __init__(self) -> None:
        self.rows = 0


async def _encoded(rows: Iterable[bulk.Row], counter: _Counter) -> AsyncIterator[bytes]:
    chunk: list[str] = []
    for row in rows:
        chunk.append("\t".join(map(_field, row)))
        if len(chunk) >= _CHUNK_ROWS:
            counter.rows += len(chunk)
            yield ("\n".join(chunk) + "\n").encode()
            chunk = []
    if chunk:
        counter.rows += len(chunk)
        yield ("\n".join(chunk) + "\n").encode()


def _check_locks(settings: Settings, database: str, replace: bool) -> None:
    if settings.environment == "production":
        raise BulkRefused("seed-bulk is for development and measurement only")
    if not _NAME.match(database):
        raise BulkRefused(f"invalid database name {database!r}: use lowercase letters, digits and _")
    if database == database_name(settings.database_url):
        raise BulkRefused(f"refusing to load bulk data into the configured database '{database}'")
    if replace and not database.endswith("_bulk"):
        raise BulkRefused("--replace only drops databases whose name ends with _bulk")


async def _create_database(settings: Settings, database: str, replace: bool) -> None:
    admin = await asyncpg.connect(_plain(with_database(settings.database_url, "postgres")))
    try:
        if replace:
            await admin.execute(f'DROP DATABASE IF EXISTS "{database}" WITH (FORCE)')
        if not await admin.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", database):
            await admin.execute(f'CREATE DATABASE "{database}"')
    finally:
        await admin.close()


async def seed_bulk(
    settings: Settings,
    *,
    profiles_path: Path,
    prepare: Callable[[Settings], Awaitable[None]],
    listings: int,
    seed: int,
    today: date,
    database: str = DEFAULT_DATABASE,
    replace: bool = False,
) -> BulkResult:
    """Create (or rebuild) the bulk database, run ``prepare`` (migrations + catalog), then load."""
    _check_locks(settings, database, replace)
    loaded = profiles.load(profiles_path)  # fail on a broken file before creating anything
    started = time.monotonic()
    await _create_database(settings, database, replace)
    target = settings.model_copy(update={"database_url": with_database(settings.database_url, database)})
    await prepare(target)

    conn = await asyncpg.connect(_plain(target.database_url))
    try:
        if await conn.fetchval("SELECT EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM listings)"):
            raise BulkRefused(f"{database} already has users or listings; use --replace to rebuild it")
        city_ids = {r["name"]: r["id"] for r in await conn.fetch("SELECT name, id FROM cities")}
        amenity_ids = {r["name"]: r["id"] for r in await conn.fetch("SELECT name, id FROM amenities")}
        loaded = profiles.load(profiles_path, amenity_names=amenity_ids)
        missing = sorted(set(loaded.cities) - set(city_ids))
        if missing:
            raise profiles.ProfileError(f"invalid city profile: {missing[0]}: city is not in the catalog")
        data = bulk.generate(
            loaded, listings=listings, seed=seed, today=today, city_ids=city_ids, amenity_ids=amenity_ids
        )
        counts: dict[str, int] = {}
        async with conn.transaction():
            for table in bulk.TABLES:
                counter, t0 = _Counter(), time.monotonic()
                rows = getattr(data, table)()
                await conn.copy_to_table(
                    table, source=_encoded(rows, counter), columns=list(bulk.COLUMNS[table]), format="text"
                )
                counts[table] = counter.rows
                log.info("loaded %s: %d rows in %.1fs", table, counter.rows, time.monotonic() - t0)
            for table in _SEQUENCES:
                # table names come from the fixed _SEQUENCES tuple, not from input
                await conn.execute(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), (SELECT max(id) FROM {table}))"  # noqa: S608
                )
        # Each review's trigger rewrote its listing, all in one transaction: 1.16 million dead rows made
        # listings 386 MB for 30 MB of data, and every scan of it 12 times slower than in real use,
        # where reviews arrive one by one and vacuum keeps up (specs/003-index-review measurements.md).
        await conn.execute("VACUUM (FULL) listings")
        await conn.execute("ANALYZE")
    finally:
        await conn.close()
    return BulkResult(
        database=database,
        listings=counts["listings"],
        users=counts["users"],
        bookings=counts["bookings"],
        reviews=counts["reviews"],
        seconds=time.monotonic() - started,
    )
