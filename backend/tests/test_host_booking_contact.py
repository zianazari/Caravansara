"""Host contact details are scoped to the booking's owner; cancellation preserves contact."""

import pytest
from httpx import AsyncClient

from tests.factories import Factory


async def test_only_booking_host_receives_guest_contact(client: AsyncClient, factory: Factory) -> None:
    host, guest, outsider = await factory.user(), await factory.user(), await factory.user()
    listing = await factory.listing(host)
    booking = await factory.booking(listing=listing, guest=guest)
    path = f"/bookings/{booking.id}"
    response = await client.get(path, headers=host.auth)
    assert response.headers["cache-control"] == "no-store"
    own = response.json()
    assert own["guest_contact"]["email"] == guest.email
    assert own["guest_contact"]["full_name"]
    assert own["can_cancel"] is True
    trips = (await client.get("/me/bookings", headers=guest.auth)).json()
    assert trips["items"][0]["guest_contact"] is None
    assert (await client.get(path, headers=guest.auth)).json()["guest_contact"] is None
    assert (await client.get(path, headers=outsider.auth)).status_code == 404
    assert (await client.get(f"/listings/{listing['id']}/bookings", headers=outsider.auth)).status_code == 403
    host_list = (await client.get(f"/listings/{listing['id']}/bookings", headers=host.auth)).json()
    assert host_list["items"][0]["guest_contact"] == own["guest_contact"]
    cancelled = await client.post(f"{path}/cancel", headers=host.auth)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["can_cancel"] is False
    assert cancelled.json()["guest_contact"] == own["guest_contact"]
    assert (await client.get(path, headers=guest.auth)).json()["status"] == "cancelled"
    assert (await client.post(f"{path}/cancel", headers=host.auth)).status_code == 409


@pytest.mark.parametrize("status", ["completed", "cancelled", "expired"])
async def test_terminal_stays_have_contact_but_no_cancel(client: AsyncClient, factory: Factory, status: str) -> None:
    host, guest = await factory.user(), await factory.user()
    listing = await factory.listing(host)
    booking = await factory.booking(listing=listing, guest=guest, status=status, check_in=-5, check_out=-2)
    data = (await client.get(f"/bookings/{booking.id}", headers=host.auth)).json()
    assert data["guest_contact"]["email"] == guest.email
    assert data["can_cancel"] is False


async def test_checkin_day_cannot_cancel_even_for_host(client: AsyncClient, factory: Factory) -> None:
    host, guest = await factory.user(), await factory.user()
    listing = await factory.listing(host)
    booking = await factory.booking(listing=listing, guest=guest, check_in=-1, check_out=2)
    data = (await client.get(f"/bookings/{booking.id}", headers=host.auth)).json()
    assert data["can_cancel"] is False
    response = await client.post(f"/bookings/{booking.id}/cancel", headers=host.auth)
    assert response.status_code == 409
