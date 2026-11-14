"""Real database login codes: delivery, single use, retries, rate limits and concurrency."""

import asyncio
import re
from collections.abc import Iterator
from datetime import timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.email import MemorySender
from caravansara.core.timeutil import utcnow
from caravansara.identity import service
from caravansara.identity.router import email_login_sender
from tests.helpers import register, sql


@pytest.fixture
def sender(app: Any) -> Iterator[MemorySender]:
    memory = MemorySender()
    app.dependency_overrides[email_login_sender] = lambda: memory
    yield memory
    app.dependency_overrides.pop(email_login_sender, None)


async def request_code(client: AsyncClient, email: str, **extra: Any) -> dict[str, Any]:
    response = await client.post("/auth/email-code/request", json={"email": email, **extra})
    assert response.status_code == 200, response.text
    assert set(response.json()) == {"challenge_id", "expires_in", "resend_after"}
    return response.json()


def last_code(sender: MemorySender) -> str:
    found = re.search(r"\b[0-9]{5}\b", sender.sent[-1].body)
    assert found
    return found[0]


async def verify(client: AsyncClient, challenge: dict[str, Any], code: str) -> Any:
    return await client.post("/auth/email-code/verify", json={"challenge_id": challenge["challenge_id"], "code": code})


async def test_email_delivery_issues_the_existing_session(
    client: AsyncClient, db: AsyncEngine, sender: MemorySender, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await register(client)
    monkeypatch.setattr(service.secrets, "randbelow", lambda _: 7)
    challenge = await request_code(client, user.email.upper(), locale="en")
    assert challenge["expires_in"] == 300
    assert challenge["resend_after"] == 60
    assert sender.sent[0].to == user.email
    assert sender.sent[0].subject == "Your Caravansara sign-in code"
    assert last_code(sender) == "00007"
    digest, code_hash = (await sql(db, "SELECT email_digest, code_hash FROM email_login_codes"))[0]
    assert len(digest) == len(code_hash) == 64
    assert user.email not in digest
    assert code_hash != "00007"
    assert (await sql(db, "SELECT count(*) FROM email_outbox"))[0][0] == 0
    response = await verify(client, challenge, "00007")
    assert response.status_code == 200, response.text
    tokens = response.json()
    me = await client.get("/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert me.json()["id"] == user.id
    assert (await client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})).status_code == 200
    assert (await verify(client, challenge, "00007")).status_code == 401


async def test_unknown_and_admin_addresses_do_not_receive_member_codes(
    client: AsyncClient, db: AsyncEngine, sender: MemorySender
) -> None:
    admin = await register(client)
    await sql(db, "UPDATE users SET kind = 'admin' WHERE id = :id", id=admin.id)
    for email in ("unknown@example.com", admin.email):
        challenge = await request_code(client, email)
        assert (await verify(client, challenge, "12345")).json()["error"]["code"] == "invalid_email_code"
    assert sender.sent == []
    assert (await sql(db, "SELECT count(*) FROM users"))[0][0] == 1


async def test_expired_code_and_wrong_challenge_are_refused(
    client: AsyncClient, db: AsyncEngine, sender: MemorySender
) -> None:
    user = await register(client)
    challenge = await request_code(client, user.email)
    assert sender.sent[0].subject == "کد ورود به کاروانسرا"
    code = last_code(sender)
    wrong = {"challenge_id": str(uuid4())}
    assert (await verify(client, wrong, code)).status_code == 401
    await sql(
        db,
        "UPDATE email_login_codes SET created_at = now() - interval '10 minutes', "
        "expires_at = now() - interval '1 second'",
    )
    assert (await verify(client, challenge, code)).status_code == 401
    assert (await sql(db, "SELECT count(*) FROM refresh_tokens"))[0][0] == 1  # registration only


async def test_resending_invalidates_the_previous_code_without_resetting_failed_attempts(
    client: AsyncClient, sender: MemorySender, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = await register(client)
    now = utcnow()
    monkeypatch.setattr(service, "utcnow", lambda: now)
    first = await request_code(client, user.email)
    old_code = last_code(sender)
    assert (await client.post("/auth/email-code/request", json={"email": user.email})).status_code == 429
    for _ in range(4):
        wrong = "00000" if old_code != "00000" else "99999"
        assert (await verify(client, first, wrong)).status_code == 401
    monkeypatch.setattr(service, "utcnow", lambda: now + timedelta(seconds=61))
    second = await request_code(client, user.email)
    code = last_code(sender)
    assert second["challenge_id"] != first["challenge_id"]
    assert (await verify(client, first, old_code)).status_code == 401
    blocked = await verify(client, second, code)
    assert blocked.status_code == 429


async def test_one_code_cannot_be_redeemed_twice_concurrently(client: AsyncClient, sender: MemorySender) -> None:
    user = await register(client)
    challenge = await request_code(client, user.email)
    code = last_code(sender)
    replies = await asyncio.gather(verify(client, challenge, code), verify(client, challenge, code))
    assert sorted(response.status_code for response in replies) == [200, 401]


async def test_request_limits_apply_to_unknown_email_and_ip(
    client: AsyncClient, sender: MemorySender, monkeypatch: pytest.MonkeyPatch
) -> None:
    now = utcnow()
    for offset in (0, 61, 122):
        monkeypatch.setattr(service, "utcnow", lambda offset=offset: now + timedelta(seconds=offset))
        await request_code(client, "absent@example.com")
    monkeypatch.setattr(service, "utcnow", lambda: now + timedelta(seconds=183))
    blocked = await client.post("/auth/email-code/request", json={"email": "absent@example.com"})
    assert blocked.status_code == 429
    for index in range(7):
        await request_code(client, f"absent{index}@example.com")
    assert (await client.post("/auth/email-code/request", json={"email": "another@example.com"})).status_code == 429
    assert sender.sent == []


async def test_smtp_failure_does_not_change_the_generic_response_or_log_secrets(
    client: AsyncClient, sender: MemorySender, caplog: pytest.LogCaptureFixture
) -> None:
    user = await register(client)
    sender.fail_with = RuntimeError(f"failure containing {user.email} and private message")
    await request_code(client, user.email)
    assert "login code delivery failed" in caplog.text
    assert user.email not in caplog.text
    assert "private message" not in caplog.text


async def test_missing_smtp_is_explicit_for_all_addresses(client: AsyncClient, app: Any) -> None:
    app.dependency_overrides[email_login_sender] = lambda: None
    try:
        response = await client.post("/auth/email-code/request", json={"email": "nobody@example.com"})
        assert response.status_code == 503
    finally:
        app.dependency_overrides.pop(email_login_sender, None)


async def test_worker_removes_only_old_challenges(
    client: AsyncClient, db: AsyncEngine, sender: MemorySender, app: Any
) -> None:
    from caravansara.jobs.runner import run_once

    await request_code(client, "old@example.com")
    await sql(
        db,
        "UPDATE email_login_codes SET created_at = now() - interval '3 days', expires_at = now() - interval '2 days'",
    )
    current = await request_code(client, "current@example.com")
    await run_once(app.state.sessionmaker)
    rows = await sql(db, "SELECT id FROM email_login_codes")
    assert [str(row[0]) for row in rows] == [current["challenge_id"]]


@pytest.mark.parametrize("code", ["1234", "123456", "１２３４５", "۱۲۳۴۵", "12x45", "", 12345])
async def test_code_shape_validation(client: AsyncClient, code: Any) -> None:
    response = await client.post("/auth/email-code/verify", json={"challenge_id": str(uuid4()), "code": code})
    assert response.status_code == 422
