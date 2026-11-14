"""Admin email sign-in keeps role boundaries and the existing short admin session."""

import asyncio
from collections.abc import Iterator
from datetime import timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.deps import email_login_sender
from caravansara.core.email import MemorySender
from caravansara.core.timeutil import utcnow
from caravansara.identity import service
from tests.factories import Factory
from tests.helpers import sql
from tests.test_email_login import last_code


@pytest.fixture
def sender(app: Any) -> Iterator[MemorySender]:
    memory = MemorySender()
    app.dependency_overrides[email_login_sender] = lambda: memory
    yield memory
    app.dependency_overrides.pop(email_login_sender, None)


async def request_code(client: AsyncClient, email: str, locale: str = "fa") -> dict[str, Any]:
    response = await client.post("/admin/auth/email-code/request", json={"email": email, "locale": locale})
    assert response.status_code == 200, response.text
    assert set(response.json()) == {"challenge_id", "expires_in", "resend_after"}
    return dict(response.json())


async def verify(client: AsyncClient, challenge: dict[str, Any], code: str, admin: bool = True) -> Any:
    prefix = "/admin" if admin else ""
    return await client.post(
        f"{prefix}/auth/email-code/verify", json={"challenge_id": challenge["challenge_id"], "code": code}
    )


@pytest.mark.parametrize("locale", ["fa", "en"])
async def test_admin_email_code_issues_only_admin_session(
    client: AsyncClient, factory: Factory, sender: MemorySender, locale: str
) -> None:
    admin = await factory.admin()
    challenge = await request_code(client, admin.email.upper(), locale)
    assert sender.sent[-1].to == admin.email
    assert sender.sent[-1].subject == (
        "کد ورود به مدیریت کاروانسرا" if locale == "fa" else "Your Caravansara admin sign-in code"
    )
    code = last_code(sender)
    # A correct admin code cannot be used to get a member token, nor is it consumed by that failure.
    assert (await verify(client, challenge, code, admin=False)).status_code == 401
    response = await verify(client, challenge, code)
    assert response.status_code == 200, response.text
    tokens = response.json()
    assert tokens["expires_in"] == 900
    assert 8 * 3600 - 60 <= tokens["session_expires_in"] <= 8 * 3600
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert (await client.get("/admin/listings/pending", headers=headers)).status_code == 200
    assert (await client.get("/me", headers=headers)).status_code == 401
    assert (await verify(client, challenge, code)).status_code == 401
    assert (await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})).status_code == 401
    rotated = await client.post("/admin/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert rotated.status_code == 200
    assert rotated.json()["session_expires_in"] <= tokens["session_expires_in"]


async def test_member_code_cannot_enter_admin_panel(
    client: AsyncClient, factory: Factory, sender: MemorySender
) -> None:
    member = await factory.user()
    response = await client.post("/auth/email-code/request", json={"email": member.email})
    challenge, code = response.json(), last_code(sender)
    assert (await verify(client, challenge, code)).status_code == 401
    assert (await verify(client, challenge, code, admin=False)).status_code == 200


async def test_unknown_member_and_disabled_admin_get_no_admin_email(
    client: AsyncClient, factory: Factory, db: AsyncEngine, sender: MemorySender
) -> None:
    member, admin = await factory.user(), await factory.admin()
    await sql(db, "UPDATE users SET disabled_at = now() WHERE id = :id", id=admin.id)
    for address in ("unknown@example.com", member.email, admin.email):
        challenge = await request_code(client, address)
        assert (await verify(client, challenge, "12345")).status_code == 401
    assert sender.sent == []


@pytest.mark.parametrize("change", ["disabled", "expired", "member"])
async def test_admin_account_and_expiry_checked_at_redemption(
    client: AsyncClient, factory: Factory, db: AsyncEngine, sender: MemorySender, change: str
) -> None:
    admin = await factory.admin()
    challenge = await request_code(client, admin.email)
    code = last_code(sender)
    before = (await sql(db, "SELECT count(*) FROM refresh_tokens"))[0][0]
    if change == "disabled":
        await sql(db, "UPDATE users SET disabled_at = now() WHERE id = :id", id=admin.id)
    elif change == "member":
        await sql(db, "UPDATE users SET kind = 'member' WHERE id = :id", id=admin.id)
    else:
        await sql(
            db,
            "UPDATE email_login_codes SET created_at = now() - interval '10 minutes', "
            "expires_at = now() - interval '1 second'",
        )
    assert (await verify(client, challenge, code)).status_code == 401
    assert (await sql(db, "SELECT count(*) FROM refresh_tokens"))[0][0] == before


async def test_admin_code_redemption_is_single_use_under_concurrency(
    client: AsyncClient, factory: Factory, sender: MemorySender
) -> None:
    admin = await factory.admin()
    challenge = await request_code(client, admin.email)
    code = last_code(sender)
    replies = await asyncio.gather(verify(client, challenge, code), verify(client, challenge, code))
    assert sorted(reply.status_code for reply in replies) == [200, 401]


async def test_admin_resend_preserves_failure_limit(
    client: AsyncClient, factory: Factory, sender: MemorySender, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = await factory.admin()
    now = utcnow()
    monkeypatch.setattr(service, "utcnow", lambda: now)
    first = await request_code(client, admin.email)
    old_code = last_code(sender)
    assert (await client.post("/admin/auth/email-code/request", json={"email": admin.email})).status_code == 429
    wrong = "00000" if old_code != "00000" else "99999"
    for _ in range(4):
        assert (await verify(client, first, wrong)).status_code == 401
    monkeypatch.setattr(service, "utcnow", lambda: now + timedelta(seconds=61))
    second = await request_code(client, admin.email)
    assert (await verify(client, first, old_code)).status_code == 401
    assert (await verify(client, second, last_code(sender))).status_code == 429


async def test_admin_email_routes_obey_admin_host_guard(
    client: AsyncClient, app: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(app.state.settings, "admin_host", "admin.example.com")
    for path in ("request", "verify"):
        response = await client.post(f"/admin/auth/email-code/{path}", json={})
        assert response.status_code == 404


async def test_missing_smtp_is_explicit_for_admin(client: AsyncClient, app: Any) -> None:
    app.dependency_overrides[email_login_sender] = lambda: None
    try:
        response = await client.post("/admin/auth/email-code/request", json={"email": "absent@example.com"})
        assert response.status_code == 503
    finally:
        app.dependency_overrides.pop(email_login_sender, None)
