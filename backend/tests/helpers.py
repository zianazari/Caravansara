"""Small API helpers so tests read like user stories."""

import uuid
from datetime import date, timedelta
from typing import Any

from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

PASSWORD = "correct-horse-battery"
AMSTERDAM = (52.3731, 4.8838)

# The test database, set by the ``client`` fixture so create_listing can approve what it creates.
_engine: AsyncEngine | None = None


def use_engine(engine: AsyncEngine) -> None:
    global _engine
    _engine = engine


class User:
    def __init__(self, user_id: int, email: str, token: str, refresh: str) -> None:
        self.id = user_id
        self.email = email
        self.token = token
        self.refresh = refresh

    @property
    def auth(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


async def register(client: AsyncClient, name: str = "user") -> User:
    email = f"{name}-{uuid.uuid4().hex[:8]}@example.com"
    r = await client.post("/auth/register", json={"email": email, "password": PASSWORD, "full_name": name.title()})
    assert r.status_code == 201, r.text
    body = r.json()
    return User(body["user"]["id"], email, body["tokens"]["access_token"], body["tokens"]["refresh_token"])


async def city_id(client: AsyncClient, name: str = "Amsterdam") -> int:
    r = await client.get("/cities", params={"q": name})
    return int(r.json()[0]["id"])


async def amenity_ids(client: AsyncClient, *names: str) -> list[int]:
    by_name = {a["name"]: a["id"] for c in (await client.get("/amenities")).json() for a in c["amenities"]}
    return [by_name[n] for n in names]


def listing_body(city: int, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "title": "Canal-side loft",
        "property_type": "entire_place",
        "city_id": city,
        "address": "12 Test Street, Amsterdam",
        "latitude": AMSTERDAM[0],
        "longitude": AMSTERDAM[1],
        "max_guests": 3,
        "pets_allowed": True,
        "max_pets": 1,
        "price_per_night": "100.00",
        "cleaning_fee": "25.00",
        "currency": "EUR",
    }
    body.update(overrides)
    return body


async def create_listing(client: AsyncClient, host: User, **overrides: Any) -> dict[str, Any]:
    """A new listing waits for an admin (specs/004-listing-approval). ``approved=True`` (the default)
    approves it straight in the database, as an admin would, because the tests written before the
    review existed search, open and book public listings, and must pass unchanged (SC-007).
    Pass ``approved=False`` to get the listing as the host just made it."""
    approved = bool(overrides.pop("approved", True))
    city = overrides.pop("city", None) or await city_id(client)
    r = await client.post("/listings", json=listing_body(city, **overrides), headers=host.auth)
    assert r.status_code == 201, r.text
    result: dict[str, Any] = r.json()
    if approved:
        assert _engine is not None, "the client fixture sets the engine"
        await approve(_engine, int(result["id"]))
    return result


async def approve(engine: AsyncEngine, listing_id: int) -> None:
    """What an admin's approval leaves behind, without the admin (no history row)."""
    await sql(engine, "UPDATE listings SET review_status = 'approved' WHERE id = :id", id=listing_id)


def days(n: int) -> str:
    """A date ``n`` days from today (UTC), as ISO text."""
    return (date.today() + timedelta(days=n)).isoformat()


async def reserve(
    client: AsyncClient,
    guest: User,
    listing_id: int,
    check_in: int = 10,
    check_out: int = 13,
    key: uuid.UUID | None = None,
    **extra: Any,
) -> Any:
    body = {"listing_id": listing_id, "check_in": days(check_in), "check_out": days(check_out), "adults": 2, **extra}
    headers = guest.auth | {"Idempotency-Key": str(key or uuid.uuid4())}
    return await client.post("/bookings", json=body, headers=headers)


async def sql(engine: AsyncEngine, statement: str, **params: Any) -> Any:
    async with engine.begin() as conn:
        result = await conn.execute(text(statement), params)
        return result.all() if result.returns_rows else []
