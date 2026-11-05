"""Logs, metrics and traces: ids on every request, safe log content, counters that move."""

import json
import logging
import time
from collections.abc import Iterator
from datetime import timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from prometheus_client import REGISTRY
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara import cli
from caravansara.core.config import Settings
from caravansara.core.db import create_engine, create_sessionmaker
from caravansara.core.logs import JsonFormatter, TextFormatter, configure_logging, redact
from caravansara.core.observability import RequestMiddleware
from caravansara.core.telemetry import tracer_provider
from caravansara.core.timeutil import utcnow
from caravansara.jobs.runner import run_measured
from caravansara.main import create_app
from tests.factories import Factory
from tests.helpers import PASSWORD, create_listing, register, reserve


def sample(name: str, **labels: str) -> float:
    return REGISTRY.get_sample_value(name, labels) or 0.0


def booking_event(event: str) -> float:
    return sample("caravansara_booking_events_total", event=event)


@pytest.fixture
def spans() -> Iterator[tuple[TracerProvider, InMemorySpanExporter]]:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    yield provider, exporter
    provider.shutdown()


# ---- request id, request log and HTTP metrics ---------------------------------------


async def test_every_response_has_a_request_id(client: AsyncClient) -> None:
    r = await client.get("/countries")
    assert len(r.headers["X-Request-ID"]) == 32

    mine = await client.get("/countries", headers={"X-Request-ID": "lb-7f3a9c21"})
    assert mine.headers["X-Request-ID"] == "lb-7f3a9c21"  # a proxy's id is kept, so logs join up

    for unsafe in ("short", "has spaces in it", "x" * 65, "line\nbreak-injection"):
        r = await client.get("/countries", headers={"X-Request-ID": unsafe})
        assert r.headers["X-Request-ID"] != unsafe


async def test_one_log_line_per_request_without_the_query(
    client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO, logger="caravansara.http")
    r = await client.get("/cities?q=Amst", headers={"X-Request-ID": "req-12345678"})
    record = next(rec for rec in caplog.records if rec.name == "caravansara.http")
    entry = json.loads(JsonFormatter().format(record))
    assert entry == entry | {
        "level": "info",
        "message": "GET /api/v1/cities 200",
        "method": "GET",
        "route": "/api/v1/cities",
        "path": "/api/v1/cities",
        "status": 200,
        "request_id": r.headers["X-Request-ID"],
    }
    assert "Amst" not in json.dumps(entry)
    assert entry["duration_ms"] >= 0


async def test_health_is_counted_but_not_logged(client: AsyncClient, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="caravansara.http")
    before = sample("caravansara_http_requests_total", method="GET", route="/health", status="200")
    await client.get("http://test/health")
    assert sample("caravansara_http_requests_total", method="GET", route="/health", status="200") == before + 1
    assert not [rec for rec in caplog.records if rec.name == "caravansara.http"]


async def test_metrics_use_the_route_template_not_the_path(client: AsyncClient) -> None:
    await client.get("/listings/987654321")
    await client.get("/no/such/path/42")
    text = (await client.get("http://test/metrics")).text
    assert 'caravansara_http_requests_total{method="GET",route="/api/v1/listings/{listing_id}",status="404"}' in text
    assert 'route="unmatched",status="404"' in text
    assert "987654321" not in text
    assert "/no/such/path" not in text
    route = 'route="/api/v1/listings/{listing_id}"'
    bucket = f'caravansara_http_request_duration_seconds_bucket{{le="0.1",method="GET",{route}}}'
    assert bucket in text
    assert 'route="/metrics"' not in text  # scrapes don't count themselves
    assert 'caravansara_booking_events_total{event="expired"}' in text  # present at 0 before any event


async def test_metrics_can_be_turned_off(prepared: Settings) -> None:
    app = create_app(prepared.model_copy(update={"metrics_enabled": False}))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        assert (await c.get("/metrics")).status_code == 404


async def test_an_unhandled_error_is_logged_and_counted_as_500(caplog: pytest.LogCaptureFixture) -> None:
    app = FastAPI()

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("database melted for guest@example.com")

    app.add_middleware(RequestMiddleware)
    before = sample("caravansara_http_requests_total", method="GET", route="/boom", status="500")
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        assert (await c.get("/boom")).status_code == 500
    assert sample("caravansara_http_requests_total", method="GET", route="/boom", status="500") == before + 1
    error = next(rec for rec in caplog.records if rec.getMessage() == "unhandled error")
    entry = json.loads(JsonFormatter().format(error))
    assert "RuntimeError" in entry["exception"]
    assert "guest@example.com" not in entry["exception"]
    assert any(rec.levelno == logging.ERROR and rec.getMessage() == "GET /boom 500" for rec in caplog.records)


# ---- log content ----------------------------------------------------------------------


def test_logs_never_carry_tokens_emails_or_secrets(spans: tuple[TracerProvider, InMemorySpanExporter]) -> None:
    provider, _ = spans
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlLXNpZ25hdHVyZQ"
    with provider.get_tracer("test").start_as_current_span("work") as span:
        record = logging.getLogger("caravansara.test").makeRecord(
            "caravansara.test",
            logging.WARNING,
            __file__,
            1,
            "login failed for %s with Authorization: Bearer abc.def-123 and token %s",
            ("guest@example.com", jwt),
            None,
            extra={"password": "hunter2", "email": "guest@example.com", "listing_id": 7, "note": "sent to a@b.io"},
        )
    entry = json.loads(JsonFormatter().format(record))
    assert entry["message"] == "login failed for [email] with Authorization: Bearer [redacted] and token [token]"
    assert entry["password"] == "[redacted]"
    assert entry["email"] == "[redacted]"
    assert entry["note"] == "sent to [email]"
    assert entry["listing_id"] == 7
    assert entry["trace_id"] == format(span.get_span_context().trace_id, "032x")
    assert "hunter2" not in json.dumps(entry)


def test_text_format_and_redact() -> None:
    record = logging.makeLogRecord({"name": "x", "levelname": "INFO", "msg": "hi a@b.co", "request_id": "req-1"})
    line = TextFormatter().format(record)
    assert line.endswith("x: hi [email] [request_id=req-1]")
    assert redact("Bearer xyz") == "Bearer [redacted]"


def test_configure_logging_routes_everything_through_one_handler() -> None:
    root = logging.getLogger()
    saved, level = root.handlers[:], root.level
    try:
        configure_logging("warning", "json")
        assert isinstance(root.handlers[0].formatter, JsonFormatter)
        assert root.level == logging.WARNING
        assert logging.getLogger("uvicorn.access").disabled
        configure_logging("info", "text")
        assert isinstance(root.handlers[0].formatter, TextFormatter)
    finally:
        root.handlers[:] = saved
        root.setLevel(level)
        logging.getLogger("uvicorn.access").disabled = False


# ---- business metrics -------------------------------------------------------------------


async def test_booking_events_and_conflicts_are_counted(client: AsyncClient, db: AsyncEngine, factory: Factory) -> None:
    host = await register(client, "host")
    guest = await register(client, "guest")
    other = await register(client, "other")
    listing = await create_listing(client, host)
    before = {e: booking_event(e) for e in ("created", "confirmed", "cancelled", "expired")}
    conflicts = sample("caravansara_booking_conflicts_total")

    paid = (await reserve(client, guest, listing["id"], 10, 13)).json()
    assert (await reserve(client, other, listing["id"], 11, 12)).status_code == 409
    assert (await client.post(f"/bookings/{paid['id']}/pay", headers=guest.auth)).status_code == 200
    assert (await client.post(f"/bookings/{paid['id']}/cancel", headers=guest.auth)).status_code == 200

    late = (await reserve(client, guest, listing["id"], 20, 22)).json()
    await factory.expire_hold(late["id"])
    assert (await client.post(f"/bookings/{late['id']}/pay", headers=guest.auth)).status_code == 409

    assert booking_event("created") == before["created"] + 2
    assert booking_event("confirmed") == before["confirmed"] + 1
    assert booking_event("cancelled") == before["cancelled"] + 1
    assert booking_event("expired") == before["expired"] + 1
    assert sample("caravansara_booking_conflicts_total") == conflicts + 1


async def test_rate_limit_and_reviews_are_counted(
    client: AsyncClient, db: AsyncEngine, prepared: Settings, factory: Factory
) -> None:
    user = await register(client, "limited")
    limited = sample("caravansara_rate_limited_total", action="login")
    for _ in range(prepared.login_max_failures):
        await client.post("/auth/login", json={"email": user.email, "password": "Wrong-Pass-1"})
    r = await client.post("/auth/login", json={"email": user.email, "password": PASSWORD})
    assert r.status_code == 429
    assert sample("caravansara_rate_limited_total", action="login") == limited + 1

    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    today = utcnow().date()
    stay = (
        await factory.booking(
            listing=listing["id"],
            guest=guest.id,
            check_in=today - timedelta(days=4),
            check_out=today - timedelta(days=1),
            status="completed",
        )
    ).id
    reviews = sample("caravansara_reviews_total")
    r = await client.post(f"/bookings/{stay}/review", json={"rating": 5, "comment": "Great"}, headers=guest.auth)
    assert r.status_code == 201
    assert sample("caravansara_reviews_total") == reviews + 1


# ---- worker -------------------------------------------------------------------------------


async def test_a_worker_run_is_measured_and_traced(
    app: Any, client: AsyncClient, db: AsyncEngine, spans: tuple[TracerProvider, InMemorySpanExporter], factory: Factory
) -> None:
    provider, exporter = spans
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    hold = (await reserve(client, guest, listing["id"])).json()
    await factory.expire_hold(hold["id"])
    ok, expired = sample("caravansara_worker_runs_total", result="ok"), booking_event("expired")

    result = await run_measured(app.state.sessionmaker, provider.get_tracer("worker"))

    assert result is not None
    assert result.expired == 1
    assert sample("caravansara_worker_runs_total", result="ok") == ok + 1
    assert booking_event("expired") == expired + 1
    assert time.time() - sample("caravansara_worker_last_success_timestamp_seconds") < 5
    (span,) = exporter.get_finished_spans()
    assert span.name == "worker.run"
    assert span.attributes == {"caravansara.expired": 1, "caravansara.completed": 0}


async def test_a_failed_worker_run_is_counted_not_raised(
    prepared: Settings, spans: tuple[TracerProvider, InMemorySpanExporter]
) -> None:
    provider, _ = spans
    broken = create_engine(prepared.model_copy(update={"database_url": "postgresql+asyncpg://x:y@127.0.0.1:1/none"}))
    errors, last = (
        sample("caravansara_worker_runs_total", result="error"),
        sample("caravansara_worker_last_success_timestamp_seconds"),
    )
    assert await run_measured(create_sessionmaker(broken), provider.get_tracer("worker")) is None
    await broken.dispose()
    assert sample("caravansara_worker_runs_total", result="error") == errors + 1
    assert sample("caravansara_worker_last_success_timestamp_seconds") == last  # stale: the alert's signal


def test_the_worker_command_serves_metrics_and_traces(monkeypatch: pytest.MonkeyPatch, prepared: Settings) -> None:
    started: list[int] = []
    ran: list[Any] = []

    async def fake_run_forever(settings: Settings, provider: Any = None) -> None:
        ran.append(provider)

    monkeypatch.setattr(
        cli, "get_settings", lambda: prepared.model_copy(update={"otel_endpoint": "http://collector:4318"})
    )
    monkeypatch.setattr("prometheus_client.start_http_server", started.append)
    monkeypatch.setattr("caravansara.jobs.runner.run_forever", fake_run_forever)
    root = logging.getLogger()
    saved = root.handlers[:]
    try:
        cli.main(["worker"])
    finally:
        root.handlers[:] = saved
    assert started == [9100]
    assert isinstance(ran[0], TracerProvider)
    ran[0].shutdown()


# ---- traces ---------------------------------------------------------------------------------


def test_tracing_is_off_without_a_collector(prepared: Settings) -> None:
    assert tracer_provider(prepared, "api") is None
    provider = tracer_provider(prepared.model_copy(update={"otel_endpoint": "http://collector:4318"}), "api")
    assert provider is not None
    assert provider.resource.attributes["service.name"] == "api"
    provider.shutdown()


async def test_a_request_becomes_a_trace_with_sql_spans(prepared: Settings, caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO, logger="caravansara.http")
    exporter = InMemorySpanExporter()
    app = create_app(prepared, span_exporter=exporter)
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/v1/cities", params={"q": "Amst"})
            await c.get("/health")  # excluded: health checks would drown the real traces
        app.state.tracer_provider.force_flush()
        finished = exporter.get_finished_spans()

    assert r.status_code == 200
    server = next(s for s in finished if s.kind.name == "SERVER")
    assert server.attributes is not None
    assert server.attributes["http.route"] == "/api/v1/cities"
    sql_spans = [s for s in finished if s.attributes and "db.statement" in s.attributes]
    assert sql_spans
    assert all(s.context.trace_id == server.context.trace_id for s in sql_spans)
    assert {s.context.trace_id for s in finished} == {server.context.trace_id}  # nothing from /health

    record = next(rec for rec in caplog.records if rec.name == "caravansara.http" and rec.getMessage().endswith("200"))
    assert json.loads(JsonFormatter().format(record))["trace_id"] == format(server.context.trace_id, "032x")
