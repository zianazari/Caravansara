"""Command line: ``caravansara <command>``.

migrate, seed, seed-demo, init-storage, worker, run-jobs, serve and export-openapi.
"""

import argparse
import asyncio
import json
import logging
from pathlib import Path

import asyncpg

from caravansara.core.config import Settings, get_settings

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


async def _run_sql_files(
    settings: Settings, files: list[Path], *, skip_if: str | None = None, wrap: bool = True
) -> bool:
    """Run SQL scripts, in one transaction when ``wrap``. Returns False when ``skip_if`` finds rows."""
    conn = await asyncpg.connect(_dsn(settings))
    try:
        if skip_if and await conn.fetchval(skip_if):
            return False
        # No parameters, so asyncpg uses the simple protocol and runs each whole script.
        if wrap:
            async with conn.transaction():
                for path in files:
                    await conn.execute(path.read_text(encoding="utf-8"))
        else:
            for path in files:
                await conn.execute(path.read_text(encoding="utf-8"))
        return True
    finally:
        await conn.close()


async def seed_catalog(settings: Settings) -> bool:
    """Countries, cities and amenities. Skipped when the catalog already has rows."""
    return await _run_sql_files(
        settings,
        [settings.seed_dir / name for name in CATALOG_SEEDS],
        skip_if="SELECT EXISTS (SELECT 1 FROM amenities) OR EXISTS (SELECT 1 FROM countries)",
    )


async def seed_demo(settings: Settings) -> None:
    """Demo users, listings, bookings and reviews. Needs the catalog and empty users/listings."""
    # The file has its own BEGIN/COMMIT and refuses to run on a non-empty database.
    await _run_sql_files(settings, [settings.seed_dir / DEMO_SEED], wrap=False)


def openapi_document() -> str:
    """The OpenAPI document as stable, diff-friendly JSON."""
    from caravansara.main import create_app

    return json.dumps(create_app(Settings()).openapi(), indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="caravansara")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("migrate", help="apply database migrations (alembic upgrade head)")
    sub.add_parser("seed", help="load countries, cities and amenities (skipped if present)")
    sub.add_parser("seed-demo", help="load demo data built from Inside Airbnb (empty database only)")
    storage = sub.add_parser("init-storage", help="create the photo bucket if missing")
    storage.add_argument("--public-read", action="store_true", help="let browsers read photos (development)")
    sub.add_parser("worker", help="run the booking jobs every minute")
    sub.add_parser("run-jobs", help="run the booking jobs once and exit")
    serve = sub.add_parser("serve", help="run the API with uvicorn")
    serve.add_argument("--host", default="0.0.0.0")  # noqa: S104 (container default)
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--reload", action="store_true")
    export = sub.add_parser("export-openapi", help="write the API contract (openapi.json) after an intended API change")
    export.add_argument("--output", type=Path, default=OPENAPI_FILE)
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    settings = get_settings()

    if args.command == "migrate":
        migrate(settings)
    elif args.command == "seed":
        loaded = asyncio.run(seed_catalog(settings))
        print("catalog loaded" if loaded else "catalog already present, skipped")
    elif args.command == "seed-demo":
        asyncio.run(seed_demo(settings))
        print("demo data loaded")
    elif args.command == "init-storage":
        from caravansara.core.storage import Storage

        asyncio.run(Storage(settings).ensure_bucket(public_read=args.public_read))
        print(f"bucket {settings.s3_bucket} ready")
    elif args.command == "worker":
        from caravansara.jobs.runner import run_forever

        asyncio.run(run_forever(settings))
    elif args.command == "run-jobs":
        from caravansara.core.db import create_engine, create_sessionmaker
        from caravansara.jobs.runner import run_once

        async def _once() -> None:
            engine = create_engine(settings)
            result = await run_once(create_sessionmaker(engine))
            await engine.dispose()
            print(f"expired {result.expired} holds, completed {result.completed} stays")

        asyncio.run(_once())
    elif args.command == "export-openapi":
        args.output.write_text(openapi_document(), encoding="utf-8")
        print(f"wrote {args.output}")
    elif args.command == "serve":
        import uvicorn

        uvicorn.run("caravansara.main:create_app", factory=True, host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
