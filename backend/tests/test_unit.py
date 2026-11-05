"""Pure logic: state machine, pricing, date and capacity rules, pin fuzzing, time zones, tokens."""

import json
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import jwt
import pytest

from caravansara.bookings import rules
from caravansara.bookings.models import BookingStatus as S
from caravansara.core.config import Settings
from caravansara.core.errors import AppError, Unauthorized
from caravansara.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from caravansara.core.timeutil import today_in
from caravansara.listings import geo

SETTINGS = Settings(jwt_secret="unit-secret-unit-secret-unit-secret-xx")


class TestStateMachine:
    @pytest.mark.parametrize(
        ("current", "target"),
        [(S.pending, S.confirmed), (S.pending, S.expired), (S.pending, S.cancelled), (S.confirmed, S.completed)],
    )
    def test_allowed(self, current: S, target: S) -> None:
        assert rules.can_transition(current, target)

    @pytest.mark.parametrize(
        ("current", "target"),
        [
            (S.completed, S.pending),
            (S.cancelled, S.confirmed),
            (S.expired, S.confirmed),
            (S.confirmed, S.pending),
            (S.completed, S.cancelled),
        ],
    )
    def test_refused(self, current: S, target: S) -> None:
        assert not rules.can_transition(current, target)


def test_total_price_is_nights_times_price_plus_cleaning() -> None:
    assert rules.total_price(date(2027, 1, 1), date(2027, 1, 4), Decimal("99.99"), Decimal("20")) == Decimal("319.97")


class TestDates:
    today = date(2027, 1, 1)

    def check(self, check_in: date, check_out: date) -> None:
        rules.check_dates(check_in, check_out, self.today, max_nights=365, max_days_ahead=365)

    def test_today_is_allowed(self) -> None:
        self.check(self.today, self.today + timedelta(days=1))

    @pytest.mark.parametrize(
        ("check_in", "check_out"),
        [
            (date(2027, 1, 5), date(2027, 1, 5)),  # zero nights
            (date(2026, 12, 31), date(2027, 1, 2)),  # past
            (date(2027, 1, 1), date(2028, 1, 2)),  # 366 nights
            (date(2028, 1, 2), date(2028, 1, 3)),  # more than a year ahead
        ],
    )
    def test_refused(self, check_in: date, check_out: date) -> None:
        with pytest.raises(AppError) as err:
            self.check(check_in, check_out)
        assert err.value.code == "invalid_dates"

    def test_365_nights_is_the_limit(self) -> None:
        self.check(self.today, self.today + timedelta(days=365))


class TestCapacity:
    def check(self, adults: int, children: int, pets: int, pets_allowed: bool = True) -> None:
        rules.check_capacity(
            adults=adults, children=children, pets=pets, max_guests=3, pets_allowed=pets_allowed, max_pets=1
        )

    def test_fits(self) -> None:
        self.check(2, 1, 1)

    @pytest.mark.parametrize(
        ("adults", "children", "pets", "pets_allowed"), [(2, 2, 0, True), (1, 0, 2, True), (1, 0, 1, False)]
    )
    def test_refused(self, adults: int, children: int, pets: int, pets_allowed: bool) -> None:
        with pytest.raises(AppError) as err:
            self.check(adults, children, pets, pets_allowed)
        assert err.value.code == "capacity_exceeded"


class TestGeo:
    def test_fuzz_moves_the_point_100_to_500_m(self) -> None:
        for _ in range(200):
            lat, lng = geo.fuzz(52.37, 4.88)
            assert 99 <= geo.haversine_m(52.37, 4.88, lat, lng) <= 501

    def test_destination_wraps_across_180(self) -> None:
        lat, lng = geo.destination(0, 179.999, 90, 1000)
        assert -180 <= lng < -179.99
        assert abs(lat) < 0.001

    def test_wkt_is_longitude_first(self) -> None:
        assert geo.point_wkt(52.5, 4.25) == "SRID=4326;POINT(4.2500000 52.5000000)"


def test_today_depends_on_the_city() -> None:
    now = datetime(2027, 1, 1, 23, 30, tzinfo=UTC)
    assert today_in("Europe/Amsterdam", now) == date(2027, 1, 2)
    assert today_in("America/New_York", now) == date(2027, 1, 1)


class TestSecurity:
    def test_password_round_trip(self) -> None:
        hashed = hash_password("s3cret-pass")
        assert verify_password(hashed, "s3cret-pass")
        assert not verify_password(hashed, "wrong")
        assert not verify_password(None, "anything")
        assert not verify_password("not-a-hash", "anything")

    def test_demo_hash_verifies(self) -> None:
        demo = "$argon2id$v=19$m=65536,t=3,p=4$7fwaM/cgT6atxiCcygeWyA$fGFSl+AoIk1b3QdhUfZS30ldTMa9147QwAIgijXzhqA"
        assert verify_password(demo, "caravansara-demo")

    def test_access_token_round_trip(self) -> None:
        token, lifetime = create_access_token(SETTINGS, 42)
        assert lifetime == 15 * 60
        assert decode_access_token(SETTINGS, token) == 42

    def _encode(self, payload: dict[str, object]) -> str:
        return jwt.encode(payload, SETTINGS.jwt_secret, algorithm="HS256")

    @pytest.mark.parametrize(
        ("claims", "minutes_left", "code"),
        [
            ({"sub": "1", "type": "access"}, -1, "token_expired"),
            ({"sub": "1", "type": "refresh"}, 1, "invalid_token"),
            ({"sub": "abc", "type": "access"}, 1, "invalid_token"),
        ],
    )
    def test_bad_tokens(self, claims: dict[str, object], minutes_left: int, code: str) -> None:
        # exp is computed here, not at collection time: a slow suite must not expire the token first.
        payload = {**claims, "exp": datetime.now(UTC) + timedelta(minutes=minutes_left)}
        with pytest.raises(Unauthorized) as err:
            decode_access_token(SETTINGS, self._encode(payload))
        assert err.value.code == code

    def test_foreign_signature(self) -> None:
        token = jwt.encode({"sub": "1", "type": "access"}, "another-secret-another-secret-12345", algorithm="HS256")
        with pytest.raises(Unauthorized):
            decode_access_token(SETTINGS, token)

    def test_refresh_hash_is_stable_sha256(self) -> None:
        assert hash_refresh_token("abc") == hash_refresh_token("abc")
        assert len(hash_refresh_token("abc")) == 64


def _jpeg_size(data: bytes) -> tuple[int, int]:
    """Width and height from a JPEG's SOF0/SOF2 marker, without an image library."""
    i = 2
    while i < len(data):
        marker, length = data[i + 1], int.from_bytes(data[i + 2 : i + 4], "big")
        if marker in (0xC0, 0xC2):
            height, width = int.from_bytes(data[i + 5 : i + 7], "big"), int.from_bytes(data[i + 7 : i + 9], "big")
            return width, height
        i += 2 + length
    raise ValueError("no SOF marker")


def test_photo_manifest_matches_jpeg_headers() -> None:
    folder = Path(__file__).resolve().parents[2] / "db" / "demo" / "photos"
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    assert len(manifest) == 8
    for entry in manifest.values():
        assert _jpeg_size((folder / entry["file"]).read_bytes()) == (entry["width"], entry["height"])
