"""Registration, login, rate limits, token rotation and profiles."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.config import Settings
from tests.helpers import PASSWORD, register, sql


async def test_register_logs_in(client: AsyncClient) -> None:
    user = await register(client, "omar")
    me = await client.get("/me", headers=user.auth)
    assert me.status_code == 200
    assert me.json()["email"] == user.email
    assert me.json()["full_name"] == "Omar"


async def test_email_is_unique_ignoring_case(client: AsyncClient) -> None:
    user = await register(client)
    r = await client.post(
        "/auth/register", json={"email": user.email.upper(), "password": PASSWORD, "full_name": "Twin"}
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_taken"


async def test_register_validation_uses_the_error_shape(client: AsyncClient) -> None:
    r = await client.post("/auth/register", json={"email": "not-an-email", "password": "short", "full_name": ""})
    assert r.status_code == 422
    error = r.json()["error"]
    assert error["code"] == "validation_error"
    assert {tuple(d["loc"])[-1] for d in error["details"]} == {"email", "password", "full_name"}


async def test_login(client: AsyncClient) -> None:
    user = await register(client)
    ok = await client.post("/auth/login", json={"email": user.email.upper(), "password": PASSWORD})
    assert ok.status_code == 200
    assert ok.json()["token_type"] == "bearer"
    bad = await client.post("/auth/login", json={"email": user.email, "password": "wrong-password"})
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "invalid_credentials"
    unknown = await client.post("/auth/login", json={"email": "nobody@example.com", "password": "whatever"})
    assert unknown.json()["error"]["code"] == "invalid_credentials"


async def test_login_is_rate_limited_per_email(client: AsyncClient) -> None:
    user = await register(client)
    for _ in range(5):
        r = await client.post("/auth/login", json={"email": user.email, "password": "wrong-password"})
        assert r.status_code == 401
    blocked = await client.post("/auth/login", json={"email": user.email, "password": PASSWORD})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "too_many_attempts"


async def test_register_is_rate_limited_per_ip(client: AsyncClient, db: AsyncEngine, settings: Settings) -> None:
    await sql(
        db,
        "INSERT INTO auth_attempts (action, identifier, succeeded) SELECT 'register', '127.0.0.1', true "
        "FROM generate_series(1, :n)",
        n=settings.register_max_per_ip,
    )
    r = await client.post("/auth/register", json={"email": "late@example.com", "password": PASSWORD, "full_name": "L"})
    assert r.status_code == 429


async def test_refresh_rotates_and_detects_reuse(client: AsyncClient) -> None:
    user = await register(client)
    first = await client.post("/auth/refresh", json={"refresh_token": user.refresh})
    assert first.status_code == 200
    new_refresh = first.json()["refresh_token"]
    assert new_refresh != user.refresh

    # The old token was rotated away; using it again revokes every session of the user.
    replay = await client.post("/auth/refresh", json={"refresh_token": user.refresh})
    assert replay.status_code == 401
    after = await client.post("/auth/refresh", json={"refresh_token": new_refresh})
    assert after.status_code == 401


async def test_unknown_refresh_token(client: AsyncClient) -> None:
    r = await client.post("/auth/refresh", json={"refresh_token": "nope"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_token"


async def test_expired_refresh_token(client: AsyncClient, db: AsyncEngine) -> None:
    user = await register(client)
    await sql(
        db, "UPDATE refresh_tokens SET created_at = now() - interval '2 days', expires_at = now() - interval '1 day'"
    )
    r = await client.post("/auth/refresh", json={"refresh_token": user.refresh})
    assert r.status_code == 401


async def test_logout_revokes(client: AsyncClient) -> None:
    user = await register(client)
    assert (await client.post("/auth/logout", json={"refresh_token": user.refresh})).status_code == 204
    assert (await client.post("/auth/logout", json={"refresh_token": user.refresh})).status_code == 204
    r = await client.post("/auth/refresh", json={"refresh_token": user.refresh})
    assert r.status_code == 401


async def test_update_profile(client: AsyncClient) -> None:
    user = await register(client)
    r = await client.patch(
        "/me", json={"full_name": "  New Name ", "avatar_url": "https://img.example.com/a.png"}, headers=user.auth
    )
    assert r.status_code == 200
    assert r.json()["full_name"] == "New Name"
    assert r.json()["avatar_url"] == "https://img.example.com/a.png"
    cleared = await client.patch("/me", json={"avatar_url": None}, headers=user.auth)
    assert cleared.json()["avatar_url"] is None


async def test_me_needs_a_valid_token(client: AsyncClient, db: AsyncEngine) -> None:
    assert (await client.get("/me")).status_code == 401
    bad = await client.get("/me", headers={"Authorization": "Bearer garbage"})
    assert bad.json()["error"]["code"] == "invalid_token"
    user = await register(client)
    await sql(db, "TRUNCATE users CASCADE")
    gone = await client.get("/me", headers=user.auth)
    assert gone.status_code == 401
