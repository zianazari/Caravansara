"""Time helpers. "Today" for a booking is the date in the listing's city, not the server's."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo


def utcnow() -> datetime:
    return datetime.now(UTC)


def today_in(timezone: str, now: datetime | None = None) -> date:
    return (now or utcnow()).astimezone(ZoneInfo(timezone)).date()
