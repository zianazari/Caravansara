"""Test data in any state with one call, independent of the demo data (contracts/test-factory.md).

What the API can make (users, listings) goes through the API, so tests get tokens and real
public locations. States the API refuses on purpose (past stays, expired holds, completed stays)
are inserted directly; every constraint and trigger still runs, so no rule is bypassed.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from caravansara.identity import service as identity
from tests.helpers import PASSWORD, User, create_listing, register, sql

STATUSES = ("pending", "confirmed", "cancelled", "expired", "completed")


@dataclass(frozen=True)
class Booking:
    id: int
    listing_id: int
    guest_id: int
    host: User | None  # set when the factory made the listing


@dataclass(frozen=True)
class Stay:
    host: User
    guest: User
    listing: dict[str, Any]
    booking_id: int


def _day(value: date | int) -> date:
    """A date, or a number of days from today (UTC); negative is the past."""
    return value if isinstance(value, date) else datetime.now(UTC).date() + timedelta(days=value)


class Factory:
    def __init__(self, client: AsyncClient, engine: AsyncEngine) -> None:
        self.client = client
        self.engine = engine

    async def user(self, name: str = "user") -> User:
        return await register(self.client, name)

    async def listing(self, host: User | None = None, **overrides: Any) -> dict[str, Any]:
        """Approved by default: most tests need a public listing (tests/helpers.py, create_listing)."""
        return await create_listing(self.client, host or await self.user("host"), **overrides)

    async def admin(self, name: str = "admin") -> User:
        """An admin made the only way there is, the create-admin service, then logged in."""
        email = f"{name}-{uuid.uuid4().hex[:8]}@example.com"
        async with AsyncSession(self.engine, expire_on_commit=False) as session:
            admin_id = await identity.create_admin(session, email=email, password=PASSWORD, full_name=name.title())
        r = await self.client.post("/admin/auth/login", json={"email": email, "password": PASSWORD})
        assert r.status_code == 200, r.text
        return User(admin_id, email, r.json()["access_token"], "")

    async def booking(
        self,
        *,
        status: str = "confirmed",
        check_in: date | int = 10,
        check_out: date | int | None = None,
        listing: dict[str, Any] | int | None = None,
        guest: User | int | None = None,
        hold_expires_at: datetime | None = None,
        adults: int = 1,
    ) -> Booking:
        if status not in STATUSES:
            raise ValueError(f"unknown booking status {status!r}")
        host = None
        if listing is None:
            host = await self.user("host")
            listing = await self.listing(host)
        listing_id = listing if isinstance(listing, int) else int(listing["id"])
        guest_id = (guest if isinstance(guest, int) else guest.id) if guest else (await self.user("guest")).id
        start = _day(check_in)
        end = _day(check_out) if check_out is not None else start + timedelta(days=3)
        if hold_expires_at is None and status in ("pending", "expired"):
            now = datetime.now(UTC)
            hold_expires_at = now + timedelta(minutes=15) if status == "pending" else now - timedelta(minutes=1)
        nightly, cleaning, currency = (
            await sql(
                self.engine,
                "SELECT price_per_night, cleaning_fee, currency FROM listings WHERE id = :id",
                id=listing_id,
            )
        )[0]
        total = (Decimal(nightly) * (end - start).days + Decimal(cleaning)).quantize(Decimal("0.01"))
        rows = await sql(
            self.engine,
            """INSERT INTO bookings (listing_id, guest_id, check_in, check_out, adults, nightly_price, cleaning_fee,
                                     total_price, currency, status, hold_expires_at, idempotency_key)
               VALUES (:l, :g, :ci, :co, :a, :n, :c, :t, :cur, CAST(:s AS booking_status), :h, :k)
               RETURNING id""",
            l=listing_id, g=guest_id, ci=start, co=end, a=adults, n=nightly, c=cleaning, t=total, cur=currency,
            s=status, h=hold_expires_at, k=uuid.uuid4(),
        )  # fmt: skip
        return Booking(int(rows[0][0]), listing_id, guest_id, host)

    async def stay(self, *, ended_days_ago: int = 1, nights: int = 2) -> Stay:
        """A completed stay that its guest can still review."""
        host, guest = await self.user("host"), await self.user("guest")
        listing = await self.listing(host)
        check_out = -ended_days_ago
        booking = await self.booking(
            status="completed", check_in=check_out - nights, check_out=check_out, listing=listing, guest=guest
        )
        return Stay(host, guest, listing, booking.id)

    async def expire_hold(self, booking_id: int, ago: timedelta = timedelta(minutes=1)) -> None:
        """Move a hold's deadline into the past (a negative ``ago`` moves it into the near future)."""
        await sql(
            self.engine,
            "UPDATE bookings SET hold_expires_at = :at WHERE id = :id",
            at=datetime.now(UTC) - ago,
            id=booking_id,
        )
