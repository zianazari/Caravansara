"""The worker: a separate process that runs the two booking jobs every minute, sends the emails waiting in
the outbox (feature 013), and reads the size of the listing review queue and the outbox for the dashboard.

Running two workers at once is safe: each job is a single conditional ``UPDATE``, and the queue
numbers are only read. The queue gauges are set here and not by the API, because every API copy
would report its own number and Prometheus would add them up; one reader a minute is enough for a
queue that moves in hours (specs/backend (004), research R10).
"""

import asyncio
import contextlib
import logging
import time
from dataclasses import dataclass

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from caravansara.bookings import service as bookings
from caravansara.core.config import Settings
from caravansara.core.db import create_engine, create_sessionmaker
from caravansara.core.email import EmailSender, sender_from_settings
from caravansara.core.metrics import (
    EMAIL_OUTBOX_OLDEST_WAIT,
    EMAIL_OUTBOX_QUEUE,
    LISTING_REVIEW_OLDEST_WAIT,
    LISTING_REVIEW_QUEUE,
    WORKER_DURATION,
    WORKER_LAST_SUCCESS,
    WORKER_RUNS,
)
from caravansara.core.telemetry import instrument_clients, shutdown
from caravansara.core.timeutil import utcnow
from caravansara.listings import service as listings
from caravansara.notifications import service as notifications

log = logging.getLogger("caravansara.worker")


@dataclass
class JobResult:
    expired: int
    completed: int
    review_queue: int = 0
    emails_sent: int = 0
    emails_failed: int = 0


async def run_once(
    sessionmaker: async_sessionmaker[AsyncSession],
    sender: EmailSender | None = None,
    settings: Settings | None = None,
) -> JobResult:
    async with sessionmaker() as session:
        expired = await bookings.expire_overdue_holds(session)
    async with sessionmaker() as session:
        completed = await bookings.complete_finished_stays(session)
    async with sessionmaker() as session:
        queued, oldest = await listings.review_queue_stats(session)
    LISTING_REVIEW_QUEUE.set(queued)
    LISTING_REVIEW_OLDEST_WAIT.set(max(0.0, (utcnow() - oldest).total_seconds()) if oldest else 0)
    # Emails from the outbox (feature 013). Without a sender (no SMTP host) they wait, and the gauges show it.
    sent = failed = 0
    if sender is not None and settings is not None:
        sent, failed = await notifications.send_due(sessionmaker, sender, settings)
    async with sessionmaker() as session:
        waiting, oldest_email = await notifications.queue_stats(session)
    EMAIL_OUTBOX_QUEUE.set(waiting)
    EMAIL_OUTBOX_OLDEST_WAIT.set(max(0.0, (utcnow() - oldest_email).total_seconds()) if oldest_email else 0)
    return JobResult(expired=expired, completed=completed, review_queue=queued, emails_sent=sent, emails_failed=failed)


async def run_measured(
    sessionmaker: async_sessionmaker[AsyncSession],
    tracer: trace.Tracer,
    sender: EmailSender | None = None,
    settings: Settings | None = None,
) -> JobResult | None:
    """One run inside its own trace, counted in the worker metrics. Errors are logged, not raised."""
    start = time.perf_counter()
    with tracer.start_as_current_span("worker.run") as span:
        try:
            result = await run_once(sessionmaker, sender, settings)
        except Exception:  # keep the worker alive; the next tick retries
            WORKER_RUNS.labels("error").inc()
            log.exception("job run failed")
            return None
        finally:
            WORKER_DURATION.observe(time.perf_counter() - start)
        span.set_attributes(
            {
                "caravansara.expired": result.expired,
                "caravansara.completed": result.completed,
                "caravansara.review_queue": result.review_queue,
                "caravansara.emails_sent": result.emails_sent,
            }
        )
    WORKER_RUNS.labels("ok").inc()
    WORKER_LAST_SUCCESS.set(time.time())
    if result.expired or result.completed:
        log.info(
            "expired %d holds, completed %d stays",
            result.expired,
            result.completed,
            extra={"expired": result.expired, "completed": result.completed},
        )
    return result


async def run_forever(
    settings: Settings, stop: asyncio.Event | None = None, provider: TracerProvider | None = None
) -> None:
    engine = create_engine(settings)
    sessionmaker = create_sessionmaker(engine)
    if provider:
        instrument_clients(provider, engine)
    tracer = trace.get_tracer("caravansara.worker", tracer_provider=provider)
    stop = stop or asyncio.Event()
    sender = sender_from_settings(settings)
    log.info("worker started, interval %ss, email %s", settings.worker_interval_seconds, "on" if sender else "off")
    try:
        while not stop.is_set():
            await run_measured(sessionmaker, tracer, sender, settings)
            with contextlib.suppress(TimeoutError):  # timeout = time for the next tick
                await asyncio.wait_for(stop.wait(), timeout=settings.worker_interval_seconds)
    finally:
        await engine.dispose()
        if provider:
            shutdown(provider)
