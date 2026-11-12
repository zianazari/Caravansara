"""The admin panel's users and bookings lists and its numbers (feature 051)."""

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
