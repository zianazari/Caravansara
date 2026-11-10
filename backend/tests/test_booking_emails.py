"""Booking confirmation emails (feature 016): written with the payment, one to each side, in one language."""

from datetime import date
from decimal import Decimal
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.config import Settings
from caravansara.core.email import MemorySender
from caravansara.jobs.runner import run_once
from caravansara.notifications.formats import format_day, format_money, to_jalali
from tests.factories import Factory
from tests.helpers import reserve, sql


async def _paid(client: AsyncClient, factory: Factory, **listing: Any) -> tuple[Any, Any, dict[str, Any], int]:
    host = await factory.user("host")
    guest = await factory.user("guest")
    made = await factory.listing(host, title="Garden house", **listing)
    booking = (await reserve(client, guest, made["id"], 30, 33)).json()
    r = await client.post(f"/bookings/{booking['id']}/pay", headers=guest.auth)
    assert r.status_code == 200, r.text
    return host, guest, made, int(booking["id"])


async def test_payment_writes_one_email_to_the_guest_and_one_to_the_host(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    host, guest, listing, booking_id = await _paid(client, factory)
    rows = await sql(db, "SELECT kind, user_id, subject, body FROM email_outbox ORDER BY kind")
    assert [(r[0], r[1]) for r in rows] == [("booking_confirmed_guest", guest.id), ("booking_confirmed_host", host.id)]
    guest_subject, guest_body = rows[0][2], rows[0][3]
    assert guest_subject == "Your booking is confirmed"  # a euro listing: English
    assert "Garden house" in guest_body
    assert f"/en/trips/{booking_id}" in guest_body
    total = (await client.get(f"/bookings/{booking_id}", headers=guest.auth)).json()["total_price"]
    assert f"EUR {Decimal(total):,.2f}" in guest_body  # the booking's own total
    assert "Herengracht" not in guest_body  # the exact address stays on the trip page
    assert f"/en/host/listings/{listing['id']}?tab=bookings" in rows[1][3]


async def test_a_rial_booking_gets_persian_with_toman_and_the_solar_calendar(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    await _paid(client, factory, currency="IRR", price_per_night="12000000", cleaning_fee="0")
    subject, body = (await sql(db, "SELECT subject, body FROM email_outbox WHERE kind = 'booking_confirmed_guest'"))[0]
    assert subject == "رزرو شما قطعی شد"
    assert "۳٬۶۰۰٬۰۰۰ تومان" in body  # 36,000,000 rial
    assert "/fa/trips/" in body
    assert "Your" not in body


async def test_a_failed_payment_writes_no_email(client: AsyncClient, db: AsyncEngine, factory: Factory) -> None:
    guest = await factory.user("guest")
    listing = await factory.listing()
    booking = (await reserve(client, guest, listing["id"], 30, 33)).json()
    await factory.expire_hold(booking["id"])
    r = await client.post(f"/bookings/{booking['id']}/pay", headers=guest.auth)
    assert r.status_code == 409
    assert (await sql(db, "SELECT count(*) FROM email_outbox"))[0][0] == 0


async def test_the_worker_sends_both(app: Any, client: AsyncClient, factory: Factory, prepared: Settings) -> None:
    host, guest, _, _ = await _paid(client, factory)
    sender = MemorySender()
    result = await run_once(app.state.sessionmaker, sender, prepared)
    assert result.emails_sent == 2
    assert {e.to for e in sender.sent} == {host.email, guest.email}


def test_dates_and_money_read_as_on_the_site() -> None:
    assert to_jalali(date(2026, 3, 21)) == (1405, 1, 1)  # Nowruz
    assert to_jalali(date(2025, 3, 20)) == (1403, 12, 30)  # the last day of a leap year
    assert format_day(date(2026, 11, 10), "fa") == "۱۹ آبان ۱۴۰۵"
    assert format_day(date(2026, 11, 10), "en") == "10 Nov 2026"
    assert format_money(Decimal("24000000.00"), "IRR", "fa") == "۲٬۴۰۰٬۰۰۰ تومان"
    assert format_money(Decimal("1234.5"), "GBP", "en") == "GBP 1,234.50"
