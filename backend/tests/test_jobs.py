"""Worker jobs: expire overdue holds, complete stays at check-out time in the city."""

import asyncio
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.bookings import repository as bookings_repo
from caravansara.core.config import Settings
from caravansara.jobs.runner import run_forever, run_once
from tests.factories import Factory
from tests.helpers import create_listing, register, reserve, sql


async def test_expires_only_overdue_holds(client: AsyncClient, app: Any, db: AsyncEngine, factory: Factory) -> None:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    overdue = (await reserve(client, guest, listing["id"], 10, 12)).json()
    fresh = (await reserve(client, guest, listing["id"], 20, 22)).json()
    await factory.expire_hold(overdue["id"])

    result = await run_once(app.state.sessionmaker)
    assert result.expired == 1
    rows = dict(await sql(db, "SELECT id, status::text FROM bookings"))
    assert rows == {overdue["id"]: "expired", fresh["id"]: "pending"}


async def test_completes_after_check_out_time_in_city_time(
    client: AsyncClient, app: Any, db: AsyncEngine, factory: Factory
) -> None:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)  # Amsterdam, check-out 11:00
    local_now = datetime.now(UTC).astimezone(ZoneInfo("Europe/Amsterdam"))
    today = local_now.date()
    finished = (
        await factory.booking(
            listing=listing["id"],
            guest=guest.id,
            check_in=today - timedelta(days=5),
            check_out=today - timedelta(days=1),
            status="confirmed",
        )
    ).id
    ongoing = (
        await factory.booking(
            listing=listing["id"],
            guest=guest.id,
            check_in=today,
            check_out=today + timedelta(days=2),
            status="confirmed",
        )
    ).id
    # Leaving today: completed only if 11:00 local has passed.
    leaving = (
        await factory.booking(
            listing=listing["id"],
            guest=guest.id,
            check_in=today - timedelta(days=1),
            check_out=today,
            status="confirmed",
        )
    ).id

    result = await run_once(app.state.sessionmaker)
    rows = dict(await sql(db, "SELECT id, status::text FROM bookings"))
    assert rows[finished] == "completed"
    assert rows[ongoing] == "confirmed"
    assert rows[leaving] == ("completed" if local_now.hour >= 11 else "confirmed")
    assert result.completed == (2 if local_now.hour >= 11 else 1)


async def test_two_workers_at_once_are_safe(client: AsyncClient, app: Any, db: AsyncEngine, factory: Factory) -> None:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    for i in range(5):
        start = date(2020, 1, 1) + timedelta(days=3 * i)
        await factory.booking(
            listing=listing["id"],
            guest=guest.id,
            check_in=start,
            check_out=start + timedelta(days=2),
            status="confirmed",
        )
    a, b = await asyncio.gather(run_once(app.state.sessionmaker), run_once(app.state.sessionmaker))
    assert a.completed + b.completed == 5
    assert (await sql(db, "SELECT count(*) FROM bookings WHERE status = 'completed'"))[0][0] == 5


async def test_worker_loop_runs_and_stops(
    prepared: Settings, client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)
    booking = (await reserve(client, guest, listing["id"])).json()
    await factory.expire_hold(booking["id"])

    stop = asyncio.Event()
    task = asyncio.create_task(run_forever(prepared.model_copy(update={"worker_interval_seconds": 1}), stop))
    for _ in range(50):
        status = (await sql(db, "SELECT status::text FROM bookings WHERE id = :id", id=booking["id"]))[0][0]
        if status == "expired":
            break
        await asyncio.sleep(0.1)
    stop.set()
    await asyncio.wait_for(task, timeout=5)
    assert status == "expired"


async def test_worker_survives_a_failed_run(prepared: Settings) -> None:
    broken = prepared.model_copy(
        update={"database_url": "postgresql+asyncpg://x:y@127.0.0.1:1/none", "worker_interval_seconds": 1}
    )
    stop = asyncio.Event()
    task = asyncio.create_task(run_forever(broken, stop))
    await asyncio.sleep(0.3)
    assert not task.done()  # the error was logged, the loop goes on
    stop.set()
    await asyncio.wait_for(task, timeout=5)


@pytest.mark.parametrize(
    ("check_out", "deadline_utc"),
    [
        # Amsterdam leaves summer time on 2026-10-25: 11:00 local is 10:00 UTC (CET, UTC+1).
        (date(2026, 10, 25), datetime(2026, 10, 25, 10, 0, tzinfo=UTC)),
        # It starts summer time on 2027-03-28: 11:00 local is 09:00 UTC (CEST, UTC+2).
        (date(2027, 3, 28), datetime(2027, 3, 28, 9, 0, tzinfo=UTC)),
    ],
)
async def test_completion_on_daylight_saving_days(
    client: AsyncClient, app: Any, db: AsyncEngine, check_out: date, deadline_utc: datetime, factory: Factory
) -> None:
    host = await register(client, "host")
    guest = await register(client, "guest")
    listing = await create_listing(client, host)  # Amsterdam, check-out 11:00
    booking = (
        await factory.booking(
            listing=listing["id"],
            guest=guest.id,
            check_in=check_out - timedelta(days=2),
            check_out=check_out,
            status="confirmed",
        )
    ).id

    async with app.state.sessionmaker() as session:
        assert await bookings_repo.complete_finished_stays(session, deadline_utc - timedelta(minutes=1)) == 0
        assert await bookings_repo.complete_finished_stays(session, deadline_utc) == 1
        await session.commit()
    assert (await sql(db, "SELECT status::text FROM bookings WHERE id = :id", id=booking))[0][0] == "completed"
