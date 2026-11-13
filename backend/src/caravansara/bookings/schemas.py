from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from caravansara.bookings.models import BookingStatus
from caravansara.listings.schemas import NightlyPrice


class BookingCreate(BaseModel):
    expected_currency: str | None = Field(
        default=None, pattern=r"^[A-Z]{3}$", description="Currency of the displayed quote."
    )
    expected_total: Decimal | None = Field(
        default=None, ge=0, description="Quote total; a changed price returns 409 price_changed."
    )
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
    nightly_prices: list[NightlyPrice] = Field(
        default_factory=list, description="Saved at booking time; never recalculated."
    )
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
    paid_at: datetime | None = Field(description="When the guest paid; null before payment (feature 047).")
    address: BookingAddress | None
    has_review: bool = Field(
        default=False,
        description="The guest has reviewed this stay, so the site no longer offers the review form (feature 015).",
    )


class BookingPage(BaseModel):
    items: list[BookingOut]
    total: int


class ListingAvailability(BaseModel):
    """The nights of a listing that are taken (feature 019), for the calendar on its page. Only the nights,
    never who booked them."""

    start: date = Field(description="First night asked about (the listing city's today by default).")
    end: date = Field(description="The day after the last night asked about.")
    booked_nights: list[date] = Field(
        description="Each night taken by a confirmed or completed stay, or by an unpaid hold still running. "
        "A guest can check out on such a date but not stay that night."
    )
