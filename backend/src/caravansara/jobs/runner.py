"""The worker: a separate process that runs the two booking jobs every minute.

Running two workers at once is safe: each job is a single conditional ``UPDATE``.
"""

import asyncio
import contextlib
import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from caravansara.bookings import service as bookings
from caravansara.core.config import Settings
from caravansara.core.db import create_engine, create_sessionmaker

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


async def run_forever(settings: Settings, stop: asyncio.Event | None = None) -> None:
    engine = create_engine(settings)
    sessionmaker = create_sessionmaker(engine)
    stop = stop or asyncio.Event()
    log.info("worker started, interval %ss", settings.worker_interval_seconds)
    try:
        while not stop.is_set():
            try:
                result = await run_once(sessionmaker)
                if result.expired or result.completed:
                    log.info("expired %d holds, completed %d stays", result.expired, result.completed)
            except Exception:  # keep the worker alive; the next tick retries
                log.exception("job run failed")
            with contextlib.suppress(TimeoutError):  # timeout = time for the next tick
                await asyncio.wait_for(stop.wait(), timeout=settings.worker_interval_seconds)
    finally:
        await engine.dispose()
