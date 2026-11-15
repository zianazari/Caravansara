"""Admin-only account drill-down, including private mobile numbers and retained history."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine

from tests.factories import Factory
from tests.helpers import sql


async def test_mobile_numbers_for_every_kind_and_disabled_accounts_sort_with_nulls_last(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    admin = await factory.admin()
    disabled = await factory.admin("disabled")
    member = await factory.user()
    await sql(db, "UPDATE users SET phone_number = '+989123456789' WHERE id = :id", id=admin.id)
    await sql(db, "UPDATE users SET phone_number = '+358401234567', disabled_at = now() WHERE id = :id", id=disabled.id)
    for order, expected in (("asc", [disabled.id, admin.id, member.id]), ("desc", [admin.id, disabled.id, member.id])):
        ids = []
        for offset in range(3):
            response = await client.get(
                "/admin/users",
                headers=admin.auth,
                params={"sort_by": "phone_number", "order": order, "limit": 1, "offset": offset},
            )
            assert response.status_code == 200
            assert response.headers["cache-control"] == "no-store"
            ids.extend(u["id"] for u in response.json()["items"])
        assert ids == expected
    detail = await client.get(f"/admin/users/{disabled.id}", headers=admin.auth)
    assert detail.json()["phone_number"] == "+358401234567"
    assert detail.json()["disabled_at"] is not None
    assert "password_hash" not in detail.json()


async def test_account_drill_down_requires_active_admin_before_lookup(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    admin = await factory.admin()
    member = await factory.user()
    disabled = await factory.admin("disabled")
    await sql(db, "UPDATE users SET disabled_at = now() WHERE id = :id", id=disabled.id)
    for path in (
        f"/admin/users/{member.id}",
        f"/admin/users/{member.id}/listings",
        f"/admin/bookings?user_id={member.id}",
    ):
        for headers in ({}, member.auth, disabled.auth):
            assert (await client.get(path, headers=headers)).status_code == 401
        response = await client.get(path, headers=admin.auth)
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-store"
    for path in ("/admin/users/99999999", "/admin/users/99999999/listings", "/admin/bookings?user_id=99999999"):
        assert (await client.get(path, headers=admin.auth)).status_code == 404
        assert (await client.get(path)).status_code == 401


async def test_user_bookings_include_both_roles_without_other_users_history(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    admin = await factory.admin()
    user = await factory.user("participant")
    owned = await factory.listing(user)
    received = await factory.booking(listing=owned, status="completed", check_in=-20, check_out=-18)
    sent = await factory.booking(guest=user, status="cancelled")
    await factory.booking(status="expired")
    # Retained bookings survive deletion of the listing from host/public views.
    await sql(db, "UPDATE listings SET is_active = false, deleted_at = now() WHERE id = :id", id=owned["id"])
    for order, expected in (("asc", [received.id, sent.id]), ("desc", [sent.id, received.id])):
        rows = []
        for offset in range(2):
            response = await client.get(
                "/admin/bookings",
                headers=admin.auth,
                params={"user_id": user.id, "limit": 1, "offset": offset, "order": order},
            )
            assert response.status_code == 200, response.text
            body = response.json()
            assert body["has_more"] is (offset == 0)
            rows.extend(body["items"])
        assert [b["id"] for b in rows] == expected
        assert all(b["address"] is None and b["guest_contact"] is None and b["host_contact"] is None for b in rows)
    filtered = await client.get(
        "/admin/bookings", headers=admin.auth, params={"user_id": user.id, "status": "cancelled"}
    )
    assert [b["id"] for b in filtered.json()["items"]] == [sent.id]


async def test_user_listings_keep_all_states_and_sort_before_pagination(
    client: AsyncClient, db: AsyncEngine, factory: Factory
) -> None:
    admin = await factory.admin()
    user = await factory.user()
    active = await factory.listing(user, title="Zebra")
    pending = await factory.listing(user, title="Alpha", approved=False)
    archived = await factory.listing(user, title="Middle")
    await sql(db, "UPDATE listings SET is_active = false, deleted_at = now() WHERE id = :id", id=archived["id"])
    await factory.listing(title="Unrelated")
    for order, expected in (("asc", [pending, archived, active]), ("desc", [active, archived, pending])):
        ids = []
        for offset in range(3):
            response = await client.get(
                f"/admin/users/{user.id}/listings",
                headers=admin.auth,
                params={"sort_by": "title", "order": order, "limit": 1, "offset": offset},
            )
            assert response.status_code == 200, response.text
            assert response.json()["total"] == 3
            ids.extend(row["id"] for row in response.json()["items"])
            assert "address" not in response.json()["items"][0]
        assert ids == [row["id"] for row in expected]
    for column in ("id", "city", "price_per_night", "review_status", "created_at"):
        response = await client.get(f"/admin/users/{user.id}/listings", headers=admin.auth, params={"sort_by": column})
        assert response.status_code == 200, response.text
    assert (
        await client.get(f"/admin/users/{user.id}/listings", headers=admin.auth, params={"sort_by": "password"})
    ).status_code == 422
