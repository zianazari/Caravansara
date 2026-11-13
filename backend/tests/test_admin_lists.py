"""The admin panel's users and bookings lists and its numbers (feature 051)."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from tests.factories import Factory
from tests.helpers import sql

PATHS = ("/admin/summary", "/admin/users", "/admin/bookings")


async def test_only_an_active_admin_sees_the_lists(client: AsyncClient, db: AsyncEngine, factory: Factory) -> None:
    member = await factory.user("guest")
    disabled = await factory.admin("old")
    await sql(db, "UPDATE users SET disabled_at = now() WHERE id = :id", id=disabled.id)
    for path in PATHS:
        for headers in ({}, member.auth, disabled.auth):
            r = await client.get(path, headers=headers)
            assert r.status_code == 401, (path, r.text)


async def test_users_newest_first_with_paging_and_no_password(client: AsyncClient, factory: Factory) -> None:
    admin = await factory.admin()
    made = [await factory.user(f"member{i}") for i in range(3)]
    r = await client.get("/admin/users", params={"limit": 2}, headers=admin.auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 4  # three members and the admin
    assert [u["id"] for u in body["items"]] == [made[2].id, made[1].id]
    assert set(body["items"][0]) == {"id", "email", "full_name", "kind", "created_at", "disabled_at"}
    rest = (await client.get("/admin/users", params={"limit": 2, "offset": 2}, headers=admin.auth)).json()
    assert [u["id"] for u in rest["items"]] == [made[0].id, admin.id]
    assert rest["items"][1]["kind"] == "admin"


async def test_user_search_finds_any_part_of_an_email_or_a_name(client: AsyncClient, factory: Factory) -> None:
    admin = await factory.admin()
    target = await factory.user("Kalimeh")  # name "Kalimeh", email kalimeh-…@example.com
    await factory.user("other")

    async def found(q: str) -> list[int]:
        r = await client.get("/admin/users", params={"q": q}, headers=admin.auth)
        assert r.status_code == 200, r.text
        return [u["id"] for u in r.json()["items"]]

    assert await found("LIME") == [target.id]  # the middle of the name, any case
    assert await found(target.email.split("@")[0][-6:]) == [target.id]  # the end of the email's local part
    assert await found("nobody-here") == []
    assert await found("%%%") == []  # % is a plain character, not "anything"
    short = await client.get("/admin/users", params={"q": "ka"}, headers=admin.auth)
    assert short.status_code == 422


async def test_bookings_newest_first_by_status_with_the_guest(client: AsyncClient, factory: Factory) -> None:
    admin = await factory.admin()
    guest = await factory.user("traveller")
    old = await factory.booking(status="completed", check_in=-10, check_out=-7, guest=guest)
    unpaid = await factory.booking(status="pending", guest=guest)
    new = await factory.booking(status="confirmed", check_in=20)

    every = (await client.get("/admin/bookings", headers=admin.auth)).json()
    assert [b["id"] for b in every["items"]] == [new.id, unpaid.id, old.id]
    assert every["has_more"] is False
    first = every["items"][1]
    assert (first["guest_name"], first["guest_email"]) == ("Traveller", guest.email)
    assert first["address"] is None  # the admin is neither the guest nor the host
    assert every["items"][0]["address"] is None  # not even for a confirmed stay

    pending = (await client.get("/admin/bookings", params={"status": "pending"}, headers=admin.auth)).json()
    assert [b["id"] for b in pending["items"]] == [unpaid.id]

    page = (await client.get("/admin/bookings", params={"limit": 2}, headers=admin.auth)).json()
    assert ([b["id"] for b in page["items"]], page["has_more"]) == ([new.id, unpaid.id], True)
    last = (await client.get("/admin/bookings", params={"limit": 2, "offset": 2}, headers=admin.auth)).json()
    assert ([b["id"] for b in last["items"]], last["has_more"]) == ([old.id], False)

    bad = await client.get("/admin/bookings", params={"status": "lost"}, headers=admin.auth)
    assert bad.status_code == 422


async def test_summary_counts_the_queue_the_accounts_and_each_status(client: AsyncClient, factory: Factory) -> None:
    admin = await factory.admin()
    await factory.listing(approved=False)  # one host, one listing waiting
    await factory.booking(status="cancelled")  # a host and a guest
    await factory.booking(status="cancelled")
    await factory.booking(status="expired")
    r = await client.get("/admin/summary", headers=admin.auth)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "pending_listings": 1,
        "users": 1 + 1 + 3 * 2,
        "bookings": {"pending": 0, "confirmed": 0, "completed": 0, "cancelled": 2, "expired": 1},
    }


async def test_every_user_column_sorts_globally_with_search_and_stable_pages(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    admin = await factory.admin("sort-admin")
    members = [await factory.user(f"sort-{name}") for name in ("zebra", "alice", "bob")]
    for index, user in enumerate([admin, *members]):
        await sql(
            db,
            "UPDATE users SET full_name = :name, created_at = :at WHERE id = :id",
            name=["Sort Zoe", "Sort Amy", "Sort Amy", "Sort Bill"][index],
            at=datetime(2026, 1, [4, 1, 1, 2][index], tzinfo=UTC),
            id=user.id,
        )
    original = (await client.get("/admin/users", headers=admin.auth)).json()["items"]
    for column in ("full_name", "email", "kind", "created_at"):

        def key(row: dict[str, Any], column: str = column) -> tuple[Any, int]:
            value = row[column].lower()
            if column == "kind":
                value = {"member": 0, "admin": 1}[value]
            return value, row["id"]

        for order in ("asc", "desc"):
            expected = sorted(original, key=key, reverse=order == "desc")
            received: list[int] = []
            for offset in (0, 2):
                response = await client.get(
                    "/admin/users",
                    params={"q": "sort", "sort_by": column, "order": order, "limit": 2, "offset": offset},
                    headers=admin.auth,
                )
                assert response.status_code == 200, response.text
                assert response.json()["total"] == 4
                received.extend(row["id"] for row in response.json()["items"])
            assert received == [row["id"] for row in expected], (column, order)


async def test_every_booking_column_sorts_before_paging_and_keeps_addresses_private(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    admin = await factory.admin()
    host = await factory.user("host")
    guests = [await factory.user(name) for name in ("zoe", "amy", "amy")]
    listings = [await factory.listing(host, title=title) for title in ("Zebra House", "Alpha House", "Alpha House")]
    for index, status in enumerate(("confirmed", "expired", "pending", "cancelled", "completed")):
        booking = await factory.booking(
            status=status, listing=listings[index % 3], guest=guests[index % 3], check_in=10 + 5 * index
        )
        await sql(
            db,
            "UPDATE bookings SET total_price = :total, currency = :currency, created_at = :at WHERE id = :id",
            total=Decimal(["9.50", "10.00", "9.50", "100.00", "10.00"][index]),
            currency="EUR" if index < 3 else "IRR",
            at=datetime(2026, 1, [4, 1, 1, 3, 2][index], tzinfo=UTC),
            id=booking.id,
        )
    original = (await client.get("/admin/bookings", headers=admin.auth)).json()["items"]
    for column in ("id", "listing", "guest", "dates", "total_price", "status", "created_at"):

        def key(row: dict[str, Any], column: str = column) -> tuple[Any, ...]:
            return {
                "id": (row["id"],),
                "listing": (row["listing"]["title"].lower(), row["id"]),
                "guest": (row["guest_name"].lower(), row["guest_email"].lower(), row["id"]),
                "dates": (row["check_in"], row["check_out"], row["id"]),
                "total_price": (row["currency"], Decimal(row["total_price"]), row["id"]),
                "status": (
                    ("pending", "confirmed", "completed", "cancelled", "expired").index(row["status"]),
                    row["id"],
                ),
                "created_at": (row["created_at"], row["id"]),
            }[column]

        for order in ("asc", "desc"):
            expected = sorted(original, key=key, reverse=order == "desc")
            received: list[int] = []
            for offset in (0, 2, 4):
                response = await client.get(
                    "/admin/bookings",
                    params={"sort_by": column, "order": order, "limit": 2, "offset": offset},
                    headers=admin.auth,
                )
                assert response.status_code == 200, response.text
                page = response.json()
                assert page["has_more"] is (offset < 4)
                assert all(row["address"] is None for row in page["items"])
                received.extend(row["id"] for row in page["items"])
            assert received == [row["id"] for row in expected], (column, order)
            filtered = await client.get(
                "/admin/bookings", params={"sort_by": column, "order": order, "status": "confirmed"}, headers=admin.auth
            )
            assert filtered.status_code == 200, filtered.text
            assert [row["id"] for row in filtered.json()["items"]] == [
                row["id"] for row in expected if row["status"] == "confirmed"
            ]


async def test_sort_parameters_are_allowlisted(client: AsyncClient, factory: Factory) -> None:
    admin = await factory.admin()
    for path in ("/admin/users", "/admin/bookings", "/admin/listings/pending"):
        for params in ({"sort_by": "email; DROP TABLE users"}, {"order": "sideways"}):
            response = await client.get(path, params=params, headers=admin.auth)
            assert response.status_code == 422, response.text


async def test_queue_sorts_every_field_before_paging_with_stable_ties(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    admin = await factory.admin()
    hosts = [await factory.user(name) for name in ("zebra", "amy")]
    cities = await sql(db, "SELECT id FROM cities ORDER BY name LIMIT 2")
    for index, title in enumerate(("Zebra", "Alpha", "Alpha", "Middle")):
        listing = await factory.listing(
            hosts[index % 2], title=title, city_id=cities[index % 2][0], approved=False, photos=0
        )
        await sql(
            db,
            "UPDATE listings SET submitted_at = :at WHERE id = :id",
            at=datetime(2026, 1, [4, 1, 1, 3][index], tzinfo=UTC),
            id=listing["id"],
        )
    await factory.listing(hosts[0], title="Approved and excluded")
    original = (await client.get("/admin/listings/pending", headers=admin.auth)).json()["items"]
    assert len(original) == 4
    assert original[0]["title"] == "Zebra"  # default is newest submission, not highest ID
    for column in ("submitted_at", "title", "city", "host"):

        def key(row: dict[str, Any], column: str = column) -> tuple[str, int]:
            value = (
                row["city"]["name"]
                if column == "city"
                else (row["host"]["full_name"] if column == "host" else row[column])
            )
            return str(value).lower(), row["id"]

        for order in ("asc", "desc"):
            expected = sorted(original, key=key, reverse=order == "desc")
            received: list[int] = []
            for offset in (0, 2):
                response = await client.get(
                    "/admin/listings/pending",
                    params={"sort_by": column, "order": order, "limit": 2, "offset": offset},
                    headers=admin.auth,
                )
                assert response.status_code == 200, response.text
                assert response.json()["total"] == 4
                for row in response.json()["items"]:
                    assert "address" not in row
                    received.append(row["id"])
            assert received == [row["id"] for row in expected], (column, order)
