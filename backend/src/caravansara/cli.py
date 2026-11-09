"""Command line: ``caravansara <command>``.

migrate, seed, seed-demo, seed-bulk, measure-queries, init-storage, worker, run-jobs, serve, export-openapi,
create-admin and disable-admin.

Admin accounts exist only through create-admin, run by whoever can reach the server: no API path
makes one (specs/backend (004), FR-012, constitution V).
"""

import argparse
import asyncio
import getpass
import json
import os
import sys
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path

import asyncpg

from caravansara.core.config import Settings, get_settings
from caravansara.core.logs import configure_logging

CATALOG_SEEDS = ("seed_amenities.sql", "seed_locations.sql")
DEMO_SEED = "seed_demo.sql"
ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"
# The API contract the frontend builds against. A test fails when it no longer matches the code.
OPENAPI_FILE = Path(__file__).resolve().parents[2] / "openapi.json"


def _dsn(settings: Settings) -> str:
    return settings.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


def migrate(settings: Settings, revision: str = "head") -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(str(ALEMBIC_INI))
    config.attributes["database_url"] = settings.database_url
    command.upgrade(config, revision)


async def _run_sql_file(settings: Settings, path: Path) -> None:
    """Run one SQL script as-is (it brings its own BEGIN/COMMIT)."""
    script = path.read_text(encoding="utf-8")  # noqa: ASYNC240 (small local file, read once)
    conn = await asyncpg.connect(_dsn(settings))
    try:
        # No parameters, so asyncpg uses the simple protocol and runs the whole script.
        await conn.execute(script)
    finally:
        await conn.close()


@dataclass(frozen=True)
class CatalogResult:
    """New rows added by one ``seed`` run; ``was_empty`` when the catalog had no rows before."""

    countries: int
    cities: int
    amenities: int
    was_empty: bool

    def __bool__(self) -> bool:
        return self.was_empty

    def summary(self) -> str:
        counts = f"{self.countries} new countries, {self.cities} new cities, {self.amenities} new amenities"
        if self.was_empty:
            return f"catalog loaded: {self.countries} countries, {self.cities} cities, {self.amenities} amenities"
        if not (self.countries or self.cities or self.amenities):
            return "catalog up to date: nothing new"
        return f"catalog up to date: {counts}"


_CATALOG_COUNTS = (
    "SELECT (SELECT count(*) FROM countries), (SELECT count(*) FROM cities), (SELECT count(*) FROM amenities)"
)


async def seed_catalog(settings: Settings) -> CatalogResult:
    """Countries, cities and amenities. Adds only missing rows, so it is safe on a database with data."""
    conn = await asyncpg.connect(_dsn(settings))
    try:
        before = await conn.fetchrow(_CATALOG_COUNTS)
        async with conn.transaction():
            for name in CATALOG_SEEDS:
                await conn.execute((settings.seed_dir / name).read_text(encoding="utf-8"))
        after = await conn.fetchrow(_CATALOG_COUNTS)
    finally:
        await conn.close()
    return CatalogResult(
        countries=after[0] - before[0],
        cities=after[1] - before[1],
        amenities=after[2] - before[2],
        was_empty=before[0] == 0 and before[2] == 0,
    )


@dataclass(frozen=True)
class DemoResult:
    listings: int = 0
    reviews: int = 0
    photos: int = 0
    photo_error: str | None = None

    def summary(self) -> str:
        loaded = f"demo data loaded: {self.listings} listings, {self.reviews} reviews"
        if self.photo_error:
            return f"{loaded}; photos not uploaded: {self.photo_error}; run: caravansara seed-demo --photos-only"
        return f"{loaded}; {self.photos} photos uploaded"


class Refused(Exception):
    """A command that will not run; the message is printed as ``refused: ...`` with exit code 1."""


async def seed_demo(settings: Settings, *, photos: bool = True, photos_only: bool = False) -> DemoResult:
    """Demo data, then its photos. Needs the catalog and empty users/listings.

    A storage failure does not undo the data: the listings still show, and
    ``seed-demo --photos-only`` uploads the photos later.
    """
    from caravansara.devdata.photos import upload_demo_photos

    # Every demo account, the admin among them, has a password printed in the README (research R15).
    if settings.environment == "production":
        raise Refused("demo data is for development only")
    if not photos_only:
        # The file has its own BEGIN/COMMIT and refuses to run on a non-empty database.
        await _run_sql_file(settings, settings.seed_dir / DEMO_SEED)
    conn = await asyncpg.connect(_dsn(settings))
    try:
        listings = await conn.fetchval("SELECT count(*) FROM listings")
        reviews = await conn.fetchval("SELECT count(*) FROM reviews")
        keys = [
            r[0]
            for r in await conn.fetch(
                "SELECT storage_key FROM listing_photos WHERE storage_key LIKE 'demo/%' ORDER BY id"
            )
        ]
    finally:
        await conn.close()
    if not photos:
        return DemoResult(listings, reviews)
    try:
        uploaded = await upload_demo_photos(settings, keys)
    except Exception as exc:  # any storage or network error leaves the data in place
        return DemoResult(listings, reviews, photo_error=f"{type(exc).__name__}: {exc}")
    return DemoResult(listings, reviews, uploaded)


def openapi_document() -> str:
    """The OpenAPI document as stable, diff-friendly JSON."""
    from caravansara.main import create_app

    return json.dumps(create_app(Settings()).openapi(), indent=2, ensure_ascii=False) + "\n"


ADMIN_PASSWORD_ENV = "CARAVANSARA_ADMIN_PASSWORD"  # noqa: S105 (the variable name, not a password)


def _admin_password() -> str:
    """From the environment, or asked twice; never a command argument, which shell history and the
    process list would keep (research R14). Same length rule as member registration."""
    password = os.environ.get(ADMIN_PASSWORD_ENV) or ""
    if not password:
        password = getpass.getpass("Password: ")
        if getpass.getpass("Password again: ") != password:
            raise Refused("the two passwords do not match")
    if not 8 <= len(password) <= 128:
        raise Refused("the password must be 8 to 128 characters")
    return password


async def _admin_command(settings: Settings, args: argparse.Namespace) -> str:
    from caravansara.core.db import create_engine, create_sessionmaker
    from caravansara.identity import service as identity

    password = _admin_password() if args.command == "create-admin" else ""
    engine = create_engine(settings)
    try:
        async with create_sessionmaker(engine)() as session:
            try:
                if args.command == "create-admin":
                    admin_id = await identity.create_admin(
                        session, email=args.email, password=password, full_name=args.name
                    )
                    return f"admin created: {admin_id}"
                return f"admin disabled: {await identity.disable_admin(session, email=args.email)}"
            except identity.AdminRefused as refused:
                raise Refused(str(refused)) from None
    finally:
        await engine.dispose()


def _at_least_100(text: str) -> int:
    value = int(text)
    if value < 100:
        raise argparse.ArgumentTypeError("must be at least 100")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="caravansara")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("migrate", help="apply database migrations (alembic upgrade head)")
    sub.add_parser("seed", help="load countries, cities and amenities (adds only missing rows)")
    demo = sub.add_parser("seed-demo", help="load demo data and its photos (empty database only)")
    only = demo.add_mutually_exclusive_group()
    only.add_argument("--skip-photos", action="store_true", help="load the data only")
    only.add_argument("--photos-only", action="store_true", help="upload the photos of already loaded demo data")
    storage = sub.add_parser("init-storage", help="create the photo bucket if missing")
    storage.add_argument("--public-read", action="store_true", help="let browsers read photos (development)")
    sub.add_parser("worker", help="run the booking jobs every minute")
    sub.add_parser("run-jobs", help="run the booking jobs once and exit")
    serve = sub.add_parser("serve", help="run the API with uvicorn")
    serve.add_argument("--host", default="0.0.0.0")  # noqa: S104 (container default)
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--reload", action="store_true")
    admin = sub.add_parser("create-admin", help="create an admin account (password from CARAVANSARA_ADMIN_PASSWORD)")
    admin.add_argument("--email", required=True)
    admin.add_argument("--name", required=True, help="full name")
    disable = sub.add_parser("disable-admin", help="stop an admin account at once; its history stays")
    disable.add_argument("--email", required=True)
    export = sub.add_parser("export-openapi", help="write the API contract (openapi.json) after an intended API change")
    export.add_argument("--output", type=Path, default=OPENAPI_FILE)
    bulk = sub.add_parser("seed-bulk", help="generate and load bulk data into its own database (development only)")
    bulk.add_argument("--listings", type=_at_least_100, default=100_000, help="number of listings (default 100000)")
    bulk.add_argument("--seed", type=int, default=42)
    bulk.add_argument("--today", type=date.fromisoformat, default=None, help="reference date (default: today, UTC)")
    bulk.add_argument("--database", default="caravansara_bulk", help="target database on the same server")
    bulk.add_argument("--replace", action="store_true", help="drop and rebuild the target (*_bulk only)")
    m = sub.add_parser("measure-queries", help="measure the important queries on the bulk data (development only)")
    m.add_argument("--database", default="caravansara_bulk", help="target database on the same server")
    m.add_argument("--catalog", type=Path, default=None, help="query catalog directory (default: db/bulk/queries)")
    m.add_argument("--runs", type=int, default=5, help="measured runs after one warm-up (default 5)")
    m.add_argument("--only", nargs="+", default=None, metavar="NAME", help="measure only these queries")
    m.add_argument("--out", type=Path, default=None, help="also write the results as JSON")
    return parser


def _measure_queries(settings: Settings, args: argparse.Namespace) -> None:
    from caravansara.devdata.measure import MeasureRefused, measure

    try:
        report = asyncio.run(
            measure(
                settings,
                database=args.database,
                catalog_dir=args.catalog or settings.seed_dir / "bulk" / "queries",
                runs=args.runs,
                only=args.only,
            )
        )
    except MeasureRefused as refused:
        print(refused, file=sys.stderr)
        raise SystemExit(1) from None
    print(report.markdown())
    if args.out:
        args.out.write_text(report.to_json(), encoding="utf-8")
        print(f"wrote {args.out}")
    if report.failed:
        for r in report.results:
            if r.error is not None:
                print(f"{r.name}: {r.error}", file=sys.stderr)
        raise SystemExit(1)


def _seed_bulk(settings: Settings, args: argparse.Namespace) -> None:
    from caravansara.devdata.load import BulkRefused, seed_bulk
    from caravansara.devdata.profiles import ProfileError

    async def prepare(target: Settings) -> None:
        await asyncio.to_thread(migrate, target)  # Alembic runs its own event loop
        configure_logging(settings.log_level, settings.log_format)  # alembic.ini lowered the root logger to WARN
        await seed_catalog(target)

    try:
        result = asyncio.run(
            seed_bulk(
                settings,
                profiles_path=settings.seed_dir / "bulk" / "city_profiles.json",
                prepare=prepare,
                listings=args.listings,
                seed=args.seed,
                today=args.today or datetime.now(UTC).date(),
                database=args.database,
                replace=args.replace,
            )
        )
    except (BulkRefused, ProfileError) as refused:
        print(refused, file=sys.stderr)
        raise SystemExit(1) from None
    print(result.summary())


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)

    settings = get_settings()
    configure_logging(settings.log_level, settings.log_format)
    try:
        _run(settings, args)
    except Refused as refused:
        print(f"refused: {refused}", file=sys.stderr)
        raise SystemExit(1) from None


def _run(settings: Settings, args: argparse.Namespace) -> None:
    if args.command in ("create-admin", "disable-admin"):
        print(asyncio.run(_admin_command(settings, args)))
    elif args.command == "migrate":
        migrate(settings)
    elif args.command == "seed":
        print(asyncio.run(seed_catalog(settings)).summary())
    elif args.command == "seed-demo":
        result = asyncio.run(seed_demo(settings, photos=not args.skip_photos, photos_only=args.photos_only))
        print(result.summary())
    elif args.command == "init-storage":
        from caravansara.core.storage import Storage

        asyncio.run(Storage(settings).ensure_bucket(public_read=args.public_read))
        print(f"bucket {settings.s3_bucket} ready")
    elif args.command == "worker":
        from prometheus_client import start_http_server

        from caravansara.core.telemetry import tracer_provider
        from caravansara.jobs.runner import run_forever

        if settings.worker_metrics_port:
            start_http_server(settings.worker_metrics_port)
        asyncio.run(run_forever(settings, provider=tracer_provider(settings, "caravansara-worker")))
    elif args.command == "run-jobs":
        from caravansara.core.db import create_engine, create_sessionmaker
        from caravansara.jobs.runner import run_once

        async def _once() -> None:
            engine = create_engine(settings)
            result = await run_once(create_sessionmaker(engine))
            await engine.dispose()
            print(f"expired {result.expired} holds, completed {result.completed} stays")

        asyncio.run(_once())
    elif args.command == "seed-bulk":
        _seed_bulk(settings, args)
    elif args.command == "measure-queries":
        _measure_queries(settings, args)
    elif args.command == "export-openapi":
        args.output.write_text(openapi_document(), encoding="utf-8")
        print(f"wrote {args.output}")
    elif args.command == "serve":
        import uvicorn

        uvicorn.run(
            "caravansara.main:create_app",
            factory=True,
            host=args.host,
            port=args.port,
            reload=args.reload,
            log_config=None,  # keep configure_logging's JSON handler
            access_log=False,  # the request middleware logs each request once
        )


if __name__ == "__main__":
    main()
