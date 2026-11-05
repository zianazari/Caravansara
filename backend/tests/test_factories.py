"""The test-data factory makes every booking state with one call and keeps every database rule."""

from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy.exc import IntegrityError

from caravansara.core.db import sqlstate
from caravansara.jobs.runner import run_once
from tests.factories import STATUSES, Factory
from tests.helpers import sql


async def test_stay_can_be_reviewed(client: AsyncClient, factory: Factory) -> None:
    stay = await factory.stay(ended_days_ago=1)
    r = await client.post(
        f"/bookings/{stay.booking_id}/review", json={"rating": 5, "comment": "Lovely."}, headers=stay.guest.auth
    )
    assert r.status_code == 201, r.text


@pytest.mark.parametrize("status", STATUSES)
async def test_booking_in_every_status(factory: Factory, status: str) -> None:
    booking = await factory.booking(status=status)
    ((got, hold, future),) = await sql(
        factory.engine,
        "SELECT status::text, hold_expires_at IS NOT NULL, hold_expires_at > now() FROM bookings WHERE id = :id",
        id=booking.id,
    )
    assert got == status
    assert hold == (status in ("pending", "expired"))
    if hold:
        assert future == (status == "pending")


async def test_factory_respects_database_rules(factory: Factory) -> None:
    first = await factory.booking(status="confirmed", check_in=20, check_out=23)
    await factory.booking(status="cancelled", check_in=21, check_out=22, listing=first.listing_id)  # frees nothing
    with pytest.raises(IntegrityError) as overlap:
        await factory.booking(status="pending", check_in=22, check_out=24, listing=first.listing_id)
    assert sqlstate(overlap.value) == "23P01"


async def test_expire_hold(factory: Factory, app: Any) -> None:
    hold = await factory.booking(status="pending")
    await factory.expire_hold(hold.id)
    result = await run_once(app.state.sessionmaker)
    assert result.expired == 1
    ((status,),) = await sql(factory.engine, "SELECT status::text FROM bookings WHERE id = :id", id=hold.id)
    assert status == "expired"
