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
    assert tuple(counts) == (2044, 790, 9523)  # 2044: the demo admin (specs/backend (004))

    login = await client.post("/auth/login", json={"email": "guest@example.com", "password": "caravansara-demo"})
    assert login.status_code == 200
    search = await client.get("/search/listings", params={"lat": 52.37, "lng": 4.89, "radius_km": 5, "limit": 3})
    assert search.json()["total"] > 10

    # New rows get ids after the demo's explicit ones.
    r = await client.post(
        "/auth/register", json={"email": "new@example.com", "password": "long-enough", "full_name": "N"}
    )
    assert r.status_code == 201
    assert r.json()["user"]["id"] == 2045

    await asyncio.to_thread(cli.main, ["run-jobs"])
    assert "expired" in capsys.readouterr().out
    with pytest.raises(Exception, match="expects empty"):  # refuses a second load
        await cli.seed_demo(use_test_settings)


# ---- admin accounts (specs/backend (004), contracts.md) --------------------


async def test_create_admin_with_the_password_variable(
    use_test_settings: Settings, db: AsyncEngine, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("CARAVANSARA_ADMIN_PASSWORD", "admin-pass-123")
    await asyncio.to_thread(cli.main, ["create-admin", "--email", "reviewer@example.com", "--name", "Reviewer"])
    out = capsys.readouterr().out
    admin_id = (await sql(db, "SELECT id FROM users WHERE kind = 'admin'"))[0][0]
    assert out.strip() == f"admin created: {admin_id}"
    assert "reviewer@example.com" not in out  # no email in the output (constitution V)

    with pytest.raises(SystemExit) as exit_:
        await asyncio.to_thread(cli.main, ["create-admin", "--email", "reviewer@example.com", "--name", "Again"])
    assert exit_.value.code == 1
    assert (
        "refused: an account with this email already exists; admin accounts are always new" in capsys.readouterr().err
    )


async def test_create_admin_refuses_a_short_password(
    use_test_settings: Settings, db: AsyncEngine, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("CARAVANSARA_ADMIN_PASSWORD", "short")
    with pytest.raises(SystemExit) as exit_:
        await asyncio.to_thread(cli.main, ["create-admin", "--email", "reviewer@example.com", "--name", "Reviewer"])
    assert exit_.value.code == 1
    assert "8 to 128" in capsys.readouterr().err
    assert await sql(db, "SELECT id FROM users") == []


@pytest.mark.parametrize(
    ("answers", "created"), [(["admin-pass-123", "admin-pass-123"], True), (["a" * 9, "b" * 9], False)]
)
async def test_create_admin_asks_twice_without_the_variable(
    use_test_settings: Settings,
    db: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    answers: list[str],
    created: bool,
) -> None:
    monkeypatch.delenv("CARAVANSARA_ADMIN_PASSWORD", raising=False)
    asked = iter(answers)
    monkeypatch.setattr("getpass.getpass", lambda prompt="": next(asked))
    if created:
        await asyncio.to_thread(cli.main, ["create-admin", "--email", "reviewer@example.com", "--name", "Reviewer"])
    else:
        with pytest.raises(SystemExit) as exit_:
            await asyncio.to_thread(cli.main, ["create-admin", "--email", "reviewer@example.com", "--name", "Reviewer"])
        assert exit_.value.code == 1
        assert "do not match" in capsys.readouterr().err
    assert len(await sql(db, "SELECT id FROM users WHERE kind = 'admin'")) == int(created)


async def test_disable_admin(
    use_test_settings: Settings,
    client: AsyncClient,
    db: AsyncEngine,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("CARAVANSARA_ADMIN_PASSWORD", "admin-pass-123")
    await asyncio.to_thread(cli.main, ["create-admin", "--email", "reviewer@example.com", "--name", "Reviewer"])
    member = await register(client, "member")
    capsys.readouterr()

    await asyncio.to_thread(cli.main, ["disable-admin", "--email", "reviewer@example.com"])
    admin_id = (await sql(db, "SELECT id FROM users WHERE kind = 'admin' AND disabled_at IS NOT NULL"))[0][0]
    assert capsys.readouterr().out.strip() == f"admin disabled: {admin_id}"

    for email, message in (
        (member.email, "refused: no admin account with this email"),
        ("nobody@example.com", "refused: no admin account with this email"),
        ("reviewer@example.com", "refused: this admin account is already disabled"),
    ):
        with pytest.raises(SystemExit) as exit_:
            await asyncio.to_thread(cli.main, ["disable-admin", "--email", email])
        assert exit_.value.code == 1
        assert message in capsys.readouterr().err


async def test_seed_demo_is_refused_in_production(
    prepared: Settings, db: AsyncEngine, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """Demo accounts, the admin among them, have a known password (research R15)."""
    monkeypatch.setattr(cli, "get_settings", lambda: prepared.model_copy(update={"environment": "production"}))
    with pytest.raises(SystemExit) as exit_:
        await asyncio.to_thread(cli.main, ["seed-demo", "--skip-photos"])
    assert exit_.value.code == 1
    assert "refused: demo data is for development only" in capsys.readouterr().err
    assert await sql(db, "SELECT id FROM users") == []
