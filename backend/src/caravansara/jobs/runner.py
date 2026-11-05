"""The worker: a separate process that runs the two booking jobs every minute.

Running two workers at once is safe: each job is a single conditional ``UPDATE``.
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
from caravansara.core.metrics import WORKER_DURATION, WORKER_LAST_SUCCESS, WORKER_RUNS
from caravansara.core.telemetry import instrument_clients, shutdown

log = logging.getLogger("caravansara.worker")


@dataclass
class JobResult:
    expired: int
    completed: int


async def run_once(sessionmaker: async_sessionmaker[AsyncSession]) -> JobResult:
    async with sessionmaker() as session:
        expired = await bookings.expire_overdue_holds(session)
    async with sessionmaker() as session:
        completed = await bookings.complete_finished_stays(session)
    return JobResult(expired=expired, completed=completed)


async def run_measured(sessionmaker: async_sessionmaker[AsyncSession], tracer: trace.Tracer) -> JobResult | None:
    """One run inside its own trace, counted in the worker metrics. Errors are logged, not raised."""
    start = time.perf_counter()
    with tracer.start_as_current_span("worker.run") as span:
        try:
            result = await run_once(sessionmaker)
        except Exception:  # keep the worker alive; the next tick retries
            WORKER_RUNS.labels("error").inc()
            log.exception("job run failed")
            return None
        finally:
            WORKER_DURATION.observe(time.perf_counter() - start)
        span.set_attributes({"caravansara.expired": result.expired, "caravansara.completed": result.completed})
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
    log.info("worker started, interval %ss", settings.worker_interval_seconds)
    try:
        while not stop.is_set():
            await run_measured(sessionmaker, tracer)
            with contextlib.suppress(TimeoutError):  # timeout = time for the next tick
                await asyncio.wait_for(stop.wait(), timeout=settings.worker_interval_seconds)
    finally:
        await engine.dispose()
        if provider:
            shutdown(provider)
