from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from caravansara.bookings.models import BookingStatus


class BookingCreate(BaseModel):
    listing_id: int
    check_in: date
    check_out: date
    adults: int = Field(default=1, ge=1, le=50)
    children: int = Field(default=0, ge=0, le=50)
    infants: int = Field(default=0, ge=0, le=10, description="Don't count toward max_guests.")
    pets: int = Field(default=0, ge=0, le=10)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "listing_id": 1,
                "check_in": "2026-12-10",
                "check_out": "2026-12-13",
                "adults": 2,
                "children": 0,
                "infants": 0,
                "pets": 0,
            }
        }
    )


class BookingListing(BaseModel):
    id: int
    title: str
    city: str
    country_code: str
    timezone: str
    cover_url: str | None


class BookingAddress(BaseModel):
    """Only on a confirmed or completed booking."""

    address: str
    latitude: float
    longitude: float
    check_in_time: str
    check_out_time: str


class BookingOut(BaseModel):
    id: int
    status: BookingStatus
    listing: BookingListing
    guest_id: int
    host_id: int
    check_in: date
    check_out: date
    nights: int
    adults: int
    children: int
    infants: int
    pets: int
    nightly_price: Decimal
    cleaning_fee: Decimal
    total_price: Decimal
    currency: str
    hold_expires_at: datetime | None = Field(description="Pay before this time, or the hold expires.")
    created_at: datetime
    address: BookingAddress | None


class BookingPage(BaseModel):
    items: list[BookingOut]
    total: int
