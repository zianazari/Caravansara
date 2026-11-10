"""Emails through the outbox (feature 013): written with the decision, sent by the worker, never lost."""

import logging
from typing import Any

import pytest
from httpx import AsyncClient
from prometheus_client import REGISTRY
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.config import Settings
from caravansara.core.email import MemorySender, sender_from_settings
from caravansara.jobs.runner import run_once
from caravansara.notifications import service
from tests.factories import Factory
from tests.helpers import sql


def sample(result: str, kind: str = "listing_approved") -> float:
    return REGISTRY.get_sample_value("caravansara_emails_total", {"kind": kind, "result": result}) or 0.0


async def _decide(client: AsyncClient, factory: Factory, approve: bool) -> tuple[dict[str, Any], Any]:
    admin = await factory.admin()
    host = await factory.user("host")
    listing = await factory.listing(host, approved=False, title="Courtyard house")
    detail = (await client.get(f"/admin/listings/{listing['id']}", headers=admin.auth)).json()
    path = f"/admin/listings/{listing['id']}/{'approve' if approve else 'reject'}"
    body: dict[str, Any] = {"review_version": detail["review_version"]}
    if not approve:
        body["reason"] = "The photos are blurry."
    r = await client.post(path, json=body, headers=admin.auth)
    assert r.status_code == 200, r.text
    return listing, host


async def test_a_decision_writes_the_hosts_email_in_the_same_transaction(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    listing, host = await _decide(client, factory, approve=False)
    rows = await sql(db, "SELECT kind, user_id, subject, body, sent_at FROM email_outbox")
    assert len(rows) == 1
    kind, user_id, subject, body, sent_at = rows[0]
    assert (kind, user_id, sent_at) == ("listing_rejected", host.id, None)
    assert "رد شد" in subject
    assert "not approved" in subject
    assert "The photos are blurry." in body
    assert "Courtyard house" in body
    assert f"/fa/host/listings/{listing['id']}" in body
    assert host.email not in body  # the address is read at sending time, never copied


async def test_a_refused_decision_writes_no_email(client: AsyncClient, db: AsyncEngine, factory: Factory) -> None:
    admin = await factory.admin()
    listing = await factory.listing(approved=False, photos=2)  # too few photos: 409
    detail = (await client.get(f"/admin/listings/{listing['id']}", headers=admin.auth)).json()
    r = await client.post(
        f"/admin/listings/{listing['id']}/approve",
        json={"review_version": detail["review_version"]},
        headers=admin.auth,
    )
    assert r.status_code == 409
    assert (await sql(db, "SELECT count(*) FROM email_outbox"))[0][0] == 0


async def test_the_worker_sends_it_to_the_host(
    app: Any, client: AsyncClient, db: AsyncEngine, factory: Factory, prepared: Settings
) -> None:
    _, host = await _decide(client, factory, approve=True)
    sender = MemorySender()
    before = sample("sent")
    result = await run_once(app.state.sessionmaker, sender, prepared)
    assert result.emails_sent == 1
    (email,) = sender.sent
    assert email.to == host.email
    assert "تأیید شد" in email.subject
    assert sample("sent") == before + 1
    assert (await sql(db, "SELECT attempts, sent_at IS NOT NULL FROM email_outbox"))[0] == (1, True)
    assert (await run_once(app.state.sessionmaker, sender, prepared)).emails_sent == 0  # sent once only


async def test_a_mail_server_failure_waits_longer_each_time_then_gives_up(
    app: Any,
    client: AsyncClient,
    db: AsyncEngine,
    factory: Factory,
    prepared: Settings,
    caplog: pytest.LogCaptureFixture,
) -> None:
    _, host = await _decide(client, factory, approve=True)
    settings = prepared.model_copy(update={"email_max_attempts": 3})
    sender = MemorySender(fail_with=ConnectionRefusedError(f"cannot reach the server for {host.email}"))
    caplog.set_level(logging.INFO)

    await run_once(app.state.sessionmaker, sender, settings)
    attempts, wait, last_error = (
        await sql(db, "SELECT attempts, next_attempt_at - now(), last_error FROM email_outbox")
    )[0]
    assert attempts == 1
    assert 50 < wait.total_seconds() <= 60  # the first wait is a minute
    assert host.email not in last_error
    assert "<to>" in last_error
    assert host.email not in caplog.text

    for _ in range(2):  # due again at once, as if the waits had passed
        await sql(db, "UPDATE email_outbox SET next_attempt_at = now()")
        result = await run_once(app.state.sessionmaker, sender, settings)
    assert result.emails_failed == 1
    attempts, failed = (await sql(db, "SELECT attempts, failed_at IS NOT NULL FROM email_outbox"))[0]
    assert (attempts, failed) == (3, True)
    assert sender.sent == []


async def test_without_an_smtp_host_emails_wait_and_the_gauges_say_so(
    app: Any, client: AsyncClient, factory: Factory, prepared: Settings
) -> None:
    assert sender_from_settings(prepared.model_copy(update={"smtp_host": ""})) is None
    await _decide(client, factory, approve=True)
    await run_once(app.state.sessionmaker, None, prepared)
    assert REGISTRY.get_sample_value("caravansara_email_outbox_queue") == 1


def test_the_review_email_has_persian_then_english() -> None:
    subject, body = service.review_result_email(title="Bagh", approved=False, reason="No", link="http://x/l")
    assert subject.index("رد شد") < subject.index("not approved")
    assert body.index("دلیل: No") < body.index("Reason: No")
    assert body.count("http://x/l") == 2
