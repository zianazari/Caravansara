"""Tests run against real PostgreSQL 16 + PostGIS and MinIO containers.

The database rules (EXCLUDE, triggers, PostGIS) can't be tested with mocks or SQLite.
One database per test session; every test starts from the seeded catalog with no users.
"""

import asyncio
import time
import urllib.request
from collections.abc import AsyncIterator, Iterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from testcontainers.community.postgres import PostgresContainer
from testcontainers.core.container import DockerContainer

from caravansara.cli import migrate, seed_catalog
from caravansara.core.config import Settings
from caravansara.core.storage import Storage
from caravansara.main import create_app
from tests.factories import Factory
from tests.helpers import use_engine

POSTGIS_IMAGE = "postgis/postgis:16-3.4"
MINIO_IMAGE = "bitnamilegacy/minio:2025.4.22"  # MinIO no longer publishes images
MINIO_USER = "caravansara"
MINIO_PASSWORD = "caravansara-secret"
_MINIO_READY_LINE = b"MinIO setup finished"  # logged by the bitnami image before its final start

DATA_TABLES = (
    "holidays, admin_address_views, listing_review_events, reviews, bookings, "
    "listing_amenities, listing_photos, listings, "
    "auth_attempts, refresh_tokens, users"
)


@pytest.fixture(scope="session")
def postgres() -> Iterator[PostgresContainer]:
    with PostgresContainer(POSTGIS_IMAGE, driver="asyncpg") as pg:
        yield pg


@pytest.fixture(scope="session")
def minio_url() -> Iterator[str]:
    container = (
        DockerContainer(MINIO_IMAGE)
        .with_env("MINIO_ROOT_USER", MINIO_USER)
        .with_env("MINIO_ROOT_PASSWORD", MINIO_PASSWORD)
        .with_exposed_ports(9000)
    )
    with container:
        url = f"http://{container.get_container_host_ip()}:{container.get_exposed_port(9000)}"
        deadline = time.monotonic() + 60
        # The image first runs MinIO in the background for its own setup, then stops it and starts it again.
        # The health check already answers during setup, so a test could reach the setup instance and lose
        # its connection when it stops (httpx.ReadError in CI, 2026-11-08 and 09). Wait for the final start.
        while _MINIO_READY_LINE not in b"".join(container.get_logs()):
            if time.monotonic() > deadline:
                raise TimeoutError("MinIO did not finish its setup")
            time.sleep(0.25)
        while True:
            try:
                urllib.request.urlopen(f"{url}/minio/health/live", timeout=2)  # noqa: S310 (local container)
                break
            except OSError:
                if time.monotonic() > deadline:
                    raise
                time.sleep(0.5)
        yield url


@pytest.fixture(scope="session")
def settings(postgres: PostgresContainer, minio_url: str) -> Settings:
    return Settings(
        environment="test",
        database_url=postgres.get_connection_url(),
        jwt_secret="test-secret-test-secret-test-secret-42",
        s3_endpoint_url=minio_url,
        s3_public_endpoint_url=minio_url,
        s3_access_key=MINIO_USER,
        s3_secret_key=MINIO_PASSWORD,
        s3_bucket="test-media",
        media_base_url=f"{minio_url}/test-media",
        db_pool_size=25,
        register_max_per_ip=100,  # tests register many users from one "IP"
    )


@pytest.fixture(scope="session")
async def prepared(settings: Settings) -> Settings:
    await asyncio.to_thread(migrate, settings)  # Alembic runs its own event loop
    assert await seed_catalog(settings)
    await Storage(settings).ensure_bucket(public_read=True)
    return settings


@pytest.fixture(scope="session")
async def engine(prepared: Settings) -> AsyncIterator[AsyncEngine]:
    eng = create_async_engine(prepared.database_url)
    yield eng
    await eng.dispose()


@pytest.fixture(scope="session")
async def app(prepared: Settings) -> AsyncIterator[Any]:
    application = create_app(prepared)
    async with application.router.lifespan_context(application):
        yield application


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "keep_data: the module loads shared data once and cleans it up itself")


@pytest.fixture(autouse=True)
async def _clean(request: pytest.FixtureRequest) -> AsyncIterator[None]:
    yield
    if "engine" in request.fixturenames and not request.node.get_closest_marker("keep_data"):
        eng: AsyncEngine = request.getfixturevalue("engine")
        async with eng.begin() as conn:
            await conn.execute(text(f"TRUNCATE {DATA_TABLES} RESTART IDENTITY CASCADE"))


@pytest.fixture
async def client(app: Any, engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    use_engine(engine)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test/api/v1") as c:
        yield c


@pytest.fixture
async def db(engine: AsyncEngine) -> AsyncEngine:
    return engine


@pytest.fixture
async def factory(client: AsyncClient, engine: AsyncEngine) -> Factory:
    """Users, listings and bookings in any state (tests/factories.py)."""
    return Factory(client, engine)
