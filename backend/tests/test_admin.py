"""Admin accounts (specs/backend (004), US4): made only by a command, logged in apart from
members, and never able to act as a member. The queue and decisions are in test_listing_review.py."""

from typing import Any

import jwt
import pytest
from httpx import AsyncClient
from prometheus_client import REGISTRY
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from caravansara.core.config import Settings
from caravansara.identity import service as identity
from tests.factories import Factory
from tests.helpers import PASSWORD, create_listing, days, register, sql


def sample(name: str, **labels: str) -> float:
    return REGISTRY.get_sample_value(name, labels) or 0.0


async def _create(engine: AsyncEngine, email: str, password: str = PASSWORD) -> int:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        return await identity.create_admin(session, email=email, password=password, full_name="Reviewer")


async def _disable(engine: AsyncEngine, email: str) -> int:
    async with AsyncSession(engine, expire_on_commit=False) as session:
        return await identity.disable_admin(session, email=email)


async def _admin_login(client: AsyncClient, email: str, password: str = PASSWORD) -> tuple[int, dict[str, Any]]:
    r = await client.post("/admin/auth/login", json={"email": email, "password": password})
    return r.status_code, r.json()


async def test_create_admin_and_log_in(client: AsyncClient, db: AsyncEngine, prepared: Settings) -> None:
    """US4/AC1: a short admin token with its own type; since feature 011 a refresh token too, for 8 hours."""
    admin_id = await _create(db, "reviewer@example.com")
    assert (await sql(db, "SELECT kind::text FROM users WHERE id = :id", id=admin_id))[0][0] == "admin"

    status, body = await _admin_login(client, "Reviewer@Example.com")
    assert status == 200, body
    assert body["expires_in"] == 900
    assert body["token_type"] == "bearer"
    assert body["refresh_token"]
    assert 8 * 3600 - 60 <= body["session_expires_in"] <= 8 * 3600
    payload = jwt.decode(str(body["access_token"]), prepared.jwt_secret, algorithms=[prepared.jwt_algorithm])
    assert payload["type"] == "admin"
    assert payload["sub"] == str(admin_id)


@pytest.mark.parametrize("taken", ["member", "admin", "upper-case"])
async def test_create_admin_refuses_any_existing_email(client: AsyncClient, db: AsyncEngine, taken: str) -> None:
    """US4/AC2: never promotes a member, never makes a second account for one email."""
    member = await register(client, "member")
    email = member.email
    if taken == "admin":
        email = "reviewer@example.com"
        await _create(db, email)
    before = await sql(db, "SELECT id, email, kind::text, password_hash FROM users ORDER BY id")

    with pytest.raises(identity.AdminRefused, match="an account with this email already exists"):
        await _create(db, email.upper() if taken == "upper-case" else email, password="another-password")
    assert await sql(db, "SELECT id, email, kind::text, password_hash FROM users ORDER BY id") == before


async def test_disabled_admin_is_refused_at_once_and_keeps_its_history(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    """US4/AC3: the next request with a still-valid token fails; nothing is deleted."""
    admin = await factory.admin()
    listing = await factory.listing(approved=False)
    assert (await client.get(f"/admin/listings/{listing['id']}", headers=admin.auth)).status_code == 200

    await _disable(db, admin.email)
    r = await client.get("/admin/listings/pending", headers=admin.auth)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_token"
    status, body = await _admin_login(client, admin.email)
    assert status == 401
    assert body["error"]["code"] == "invalid_credentials"
    rows = await sql(db, "SELECT count(*) FROM admin_address_views WHERE admin_id = :id", id=admin.id)
    assert rows[0][0] == 1
    with pytest.raises(identity.AdminRefused, match="already disabled"):
        await _disable(db, admin.email)


async def test_disable_admin_refuses_a_member_or_an_unknown_email(client: AsyncClient, db: AsyncEngine) -> None:
    member = await register(client, "member")
    for email in (member.email, "nobody@example.com"):
        with pytest.raises(identity.AdminRefused, match="no admin account with this email"):
            await _disable(db, email)


async def test_no_public_path_makes_an_admin(client: AsyncClient, db: AsyncEngine) -> None:
    """US4/AC4, SC-005: registration and profile edits ignore `kind`."""
    r = await client.post(
        "/auth/register",
        json={"email": "sneaky@example.com", "password": PASSWORD, "full_name": "Sneaky", "kind": "admin"},
    )
    assert r.status_code == 201
    token = r.json()["tokens"]["access_token"]
    patched = await client.patch("/me", json={"kind": "admin"}, headers={"Authorization": f"Bearer {token}"})
    assert patched.status_code == 200
    assert (await sql(db, "SELECT kind::text FROM users"))[0][0] == "member"
    status, _ = await _admin_login(client, "sneaky@example.com")
    assert status == 401


async def test_an_admin_token_works_on_no_member_path(client: AsyncClient, factory: Factory) -> None:
    """US4/AC5, SC-005: an admin cannot list a place, book or use a member profile."""
    admin = await factory.admin()
    listing = await factory.listing()
    attempts = [
        client.post("/listings", json={"title": "x"}, headers=admin.auth),
        client.get("/me", headers=admin.auth),
        client.get("/me/listings", headers=admin.auth),
        client.get("/me/bookings", headers=admin.auth),
        client.patch(f"/listings/{listing['id']}", json={"title": "x"}, headers=admin.auth),
        client.post(
            "/bookings",
            json={"listing_id": listing["id"], "check_in": days(10), "check_out": days(12), "adults": 1},
            headers=admin.auth | {"Idempotency-Key": "8f9d1c4e-2f3a-4b5c-9d8e-7f6a5b4c3d2e"},
        ),
    ]
    for attempt in attempts:
        r = await attempt
        assert r.status_code == 401, r.text
        assert r.json()["error"]["code"] == "invalid_token"


async def test_member_login_refuses_an_admin(client: AsyncClient, db: AsyncEngine) -> None:
    await _create(db, "reviewer@example.com")
    r = await client.post("/auth/login", json={"email": "reviewer@example.com", "password": PASSWORD})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"


async def test_a_member_token_is_not_an_admin_token(client: AsyncClient) -> None:
    member = await register(client, "member")
    r = await client.get("/admin/listings/pending", headers=member.auth)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_token"
    status, _ = await _admin_login(client, member.email)
    assert status == 401


async def test_admin_login_is_rate_limited_on_its_own(client: AsyncClient, db: AsyncEngine, prepared: Settings) -> None:
    """Same limits as member login (research R3), counted apart in both directions."""
    await _create(db, "reviewer@example.com")
    for _ in range(prepared.login_max_failures):  # failed member logins with the same email
        await client.post("/auth/login", json={"email": "reviewer@example.com", "password": "wrong-password"})
    status, _ = await _admin_login(client, "reviewer@example.com")
    assert status == 200

    before = sample("caravansara_rate_limited_total", action="admin_login")
    for _ in range(prepared.login_max_failures):
        status, _ = await _admin_login(client, "reviewer@example.com", "wrong-password")
        assert status == 401
    status, body = await _admin_login(client, "reviewer@example.com")
    assert status == 429
    assert body["error"]["code"] == "too_many_attempts"
    assert sample("caravansara_rate_limited_total", action="admin_login") == before + 1

    member = await register(client, "member")
    host_listing = await create_listing(client, member)
    assert host_listing["id"]  # the member side still works


# ---- admin refresh (feature 011) ----------------------------------------------------


async def _admin_tokens(client: AsyncClient, db: AsyncEngine, email: str = "reviewer@example.com") -> dict[str, Any]:
    await _create(db, email)
    status, body = await _admin_login(client, email)
    assert status == 200, body
    return body


async def test_admin_refresh_rotates_and_keeps_the_session_end(client: AsyncClient, db: AsyncEngine) -> None:
    first = await _admin_tokens(client, db)
    await sql(
        db,
        "UPDATE refresh_tokens SET expires_at = now() + interval '2 hours' WHERE user_id = "
        "(SELECT id FROM users WHERE email = 'reviewer@example.com')",
    )
    r = await client.post("/admin/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert r.status_code == 200, r.text
    second = r.json()
    assert second["refresh_token"] != first["refresh_token"]
    assert 2 * 3600 - 60 <= second["session_expires_in"] <= 2 * 3600  # not extended to 8 hours again
    queue = await client.get("/admin/listings/pending", headers={"Authorization": f"Bearer {second['access_token']}"})
    assert queue.status_code == 200


async def test_a_reused_admin_refresh_token_ends_every_session(client: AsyncClient, db: AsyncEngine) -> None:
    first = await _admin_tokens(client, db)
    second = (await client.post("/admin/auth/refresh", json={"refresh_token": first["refresh_token"]})).json()
    reused = await client.post("/admin/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert reused.status_code == 401
    assert reused.json()["error"]["code"] == "invalid_token"
    after = await client.post("/admin/auth/refresh", json={"refresh_token": second["refresh_token"]})
    assert after.status_code == 401


async def test_an_ended_admin_session_cannot_be_refreshed(client: AsyncClient, db: AsyncEngine) -> None:
    tokens = await _admin_tokens(client, db)
    await sql(
        db,
        "UPDATE refresh_tokens SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 second'",
    )
    r = await client.post("/admin/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 401


async def test_admin_and_member_refresh_tokens_never_cross(client: AsyncClient, db: AsyncEngine) -> None:
    tokens = await _admin_tokens(client, db)
    as_member = await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert as_member.status_code == 401
    member = await register(client, "member")
    as_admin = await client.post("/admin/auth/refresh", json={"refresh_token": member.refresh})
    assert as_admin.status_code == 401
    # Refused, not reused: both tokens still work on their own endpoint.
    assert (
        await client.post("/admin/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    ).status_code == 200
    assert (await client.post("/auth/refresh", json={"refresh_token": member.refresh})).status_code == 200


async def test_disabling_an_admin_ends_its_refresh_tokens(client: AsyncClient, db: AsyncEngine) -> None:
    tokens = await _admin_tokens(client, db)
    async with AsyncSession(db, expire_on_commit=False) as session:
        await identity.disable_admin(session, email="reviewer@example.com")
    r = await client.post("/admin/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 401


async def test_admin_logout_ends_the_refresh_token(client: AsyncClient, db: AsyncEngine) -> None:
    tokens = await _admin_tokens(client, db)
    assert (await client.post("/admin/auth/logout", json={"refresh_token": tokens["refresh_token"]})).status_code == 204
    r = await client.post("/admin/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 401
