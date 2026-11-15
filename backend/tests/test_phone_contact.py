"""Profile phone normalization and private two-way booking contact."""

import pytest
from httpx import AsyncClient
from pydantic import ValidationError

from caravansara.identity.schemas import ProfileUpdate
from tests.factories import Factory


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("۰۹۱۲۱۲۳۴۵۶۷", "+989121234567"),
        ("٠٩١٢١٢٣٤٥٦٧", "+989121234567"),
        ("0098 912-123-4567", "+989121234567"),
        ("+44 (7700) 900123", "+447700900123"),
        ("", None),
        (None, None),
    ],
)
def test_phone_normalization(value: str | None, expected: str | None) -> None:
    assert ProfileUpdate(phone_number=value).phone_number == expected


@pytest.mark.parametrize(
    "value",
    ["abc", "0912", "+9802121234567", "12345", "+0123456789", "+1234567890123456", "tel:+989121234567", 12345678],
)
def test_bad_phone_rejected(value: object) -> None:
    with pytest.raises(ValidationError):
        ProfileUpdate.model_validate({"phone_number": value})


async def test_contacts_are_mutual_private_and_clearable(client: AsyncClient, factory: Factory) -> None:
    host, guest, stranger = await factory.user(), await factory.user(), await factory.user()
    for user, phone in ((host, "۰۹۱۲۱۲۳۴۵۶۷"), (guest, "+447700900123")):
        profile = await client.patch("/me", headers=user.auth, json={"phone_number": phone})
        assert profile.status_code == 200
    listing = await factory.listing(host)
    assert "phone_number" not in (await client.get(f"/listings/{listing['id']}")).json()["host"]
    booking = await factory.booking(listing=listing, guest=guest)
    path = f"/bookings/{booking.id}"
    host_view = (await client.get(path, headers=host.auth)).json()
    guest_view = (await client.get(path, headers=guest.auth)).json()
    assert host_view["guest_contact"]["phone_number"] == "+447700900123"
    assert host_view["host_contact"] is None
    assert guest_view["host_contact"]["phone_number"] == "+989121234567"
    assert "email" not in guest_view["host_contact"]
    assert guest_view["guest_contact"] is None
    assert (await client.get(path, headers=stranger.auth)).status_code == 404
    host_list = (await client.get(f"/listings/{listing['id']}/bookings", headers=host.auth)).json()
    trips = (await client.get("/me/bookings", headers=guest.auth)).json()
    assert host_list["items"][0]["guest_contact"] == host_view["guest_contact"]
    assert trips["items"][0]["host_contact"] == guest_view["host_contact"]
    assert (await client.patch("/me", headers=host.auth, json={"phone_number": None})).status_code == 200
    assert (await client.get(path, headers=guest.auth)).json()["host_contact"]["phone_number"] is None


async def test_signup_phone_is_optional_and_normalized(client: AsyncClient) -> None:
    result = await client.post(
        "/auth/register",
        json={
            "email": "phone@example.com",
            "password": "strong-password-123",
            "full_name": "Contact",
            "phone_number": "۰۹۱۲۱۲۳۴۵۶۷",
        },
    )
    assert result.status_code == 201
    assert result.json()["user"]["phone_number"] == "+989121234567"


def test_phone_redacted_from_messages_and_log_fields() -> None:
    import json
    import logging

    from caravansara.core.logs import JsonFormatter, redact

    assert redact("Call +989121234567 or 09121234567") == "Call [phone] or [phone]"
    record = logging.makeLogRecord({"msg": "profile", "phone_number": "+989121234567"})
    assert json.loads(JsonFormatter().format(record))["phone_number"] == "[redacted]"
