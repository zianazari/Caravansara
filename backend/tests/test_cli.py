"""CLI commands: migrate, seed, seed-demo, init-storage and run-jobs, against the test containers."""

import asyncio

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara import cli
from caravansara.core.config import Settings
from tests.helpers import create_listing, register, sql


@pytest.fixture
def use_test_settings(prepared: Settings, monkeypatch: pytest.MonkeyPatch) -> Settings:
    monkeypatch.setattr(cli, "get_settings", lambda: prepared)
    return prepared


async def test_seed_adds_only_missing_rows(
    use_test_settings: Settings, db: AsyncEngine, capsys: pytest.CaptureFixture[str]
) -> None:
    await asyncio.to_thread(cli.main, ["seed"])
    assert "catalog up to date: nothing new" in capsys.readouterr().out

    before = dict(await sql(db, "SELECT name, id FROM cities WHERE name <> 'London'"))
    await sql(db, "DELETE FROM cities WHERE name = 'London'")
    await asyncio.to_thread(cli.main, ["seed"])
    assert "0 new countries, 1 new cities, 0 new amenities" in capsys.readouterr().out

    after = dict(await sql(db, "SELECT name, id FROM cities"))
    assert len(after) == 9
    assert {name: after[name] for name in before} == before  # existing rows keep their ids


async def test_seed_keeps_existing_data(
    use_test_settings: Settings, client: AsyncClient, db: AsyncEngine, capsys: pytest.CaptureFixture[str]
) -> None:
    host = await register(client, "host")
    listing = await create_listing(client, host)
    await asyncio.to_thread(cli.main, ["seed"])
    assert "nothing new" in capsys.readouterr().out
    rows = await sql(
        db, "SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM listings WHERE id = :id)", id=listing["id"]
    )
    assert tuple(rows[0]) == (1, 1)


async def test_migrate_is_idempotent_and_storage_init(
    use_test_settings: Settings, capsys: pytest.CaptureFixture[str]
) -> None:
    await asyncio.to_thread(cli.main, ["migrate"])
    await asyncio.to_thread(cli.main, ["init-storage", "--public-read"])
    assert "bucket test-media ready" in capsys.readouterr().out


async def test_demo_data_loads_and_logs_in(
    use_test_settings: Settings, client: AsyncClient, db: AsyncEngine, capsys: pytest.CaptureFixture[str]
) -> None:
    await asyncio.to_thread(cli.main, ["seed-demo", "--skip-photos"])
    counts = (
        await sql(
            db, "SELECT (SELECT count(*) FROM users), (SELECT count(*) FROM listings), (SELECT count(*) FROM reviews)"
        )
    )[0]
    assert tuple(counts) == (2043, 790, 9523)

    login = await client.post("/auth/login", json={"email": "guest@example.com", "password": "caravansara-demo"})
    assert login.status_code == 200
    search = await client.get("/search/listings", params={"lat": 52.37, "lng": 4.89, "radius_km": 5, "limit": 3})
    assert search.json()["total"] > 10

    # New rows get ids after the demo's explicit ones.
    r = await client.post(
        "/auth/register", json={"email": "new@example.com", "password": "long-enough", "full_name": "N"}
    )
    assert r.status_code == 201
    assert r.json()["user"]["id"] == 2044

    await asyncio.to_thread(cli.main, ["run-jobs"])
    assert "expired" in capsys.readouterr().out
    with pytest.raises(Exception, match="expects empty"):  # refuses a second load
        await cli.seed_demo(use_test_settings)
