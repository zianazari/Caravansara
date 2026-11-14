from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from caravansara.listings.service import PropertyType

SortBy = Literal["rating", "distance"]


class OpportunityQuery(BaseModel):
    budget: Decimal = Field(gt=0, le=Decimal("999999999999.99"), decimal_places=2)
    currency: str = Field(pattern=r"^[A-Z]{3}$")
    country: str = Field(default="IR", pattern=r"^[A-Z]{2}$")
    city_id: int | None = Field(default=None, gt=0)
    preferred_check_in: date
    nights: int = Field(default=3, ge=1, le=30)
    flex_days: int = Field(default=3, ge=0, le=7)
    adults: int = Field(default=2, ge=1, le=50)
    children: int = Field(default=0, ge=0, le=50)
    infants: int = Field(default=0, ge=0, le=10, description="Accepted for the UI; infants don't count.")
    pets: int = Field(default=0, ge=0, le=10)


class SearchPin(BaseModel):
    """Approximate public point; the real address is never used in search."""

    lat: float
    lng: float


class SearchResult(BaseModel):
    id: int
    title: str
    property_type: PropertyType
    city: str
    country_code: str
    pin: SearchPin
    distance_km: float | None = Field(description="From the search centre to the public pin, radial search only.")
    avg_rating: Decimal | None
    review_count: int
    max_guests: int
    price_per_night: Decimal
    cleaning_fee: Decimal
    currency: str
    total_price: Decimal | None = Field(description="nights × price + cleaning fee, when dates are given.")
    cover_url: str | None


class SearchPage(BaseModel):
    items: list[SearchResult]
    total: int
    limit: int
    offset: int


class TravelOpportunity(BaseModel):
    kind: Literal["economical", "experience", "flexible", "alternative"]
    listing: SearchResult
    check_in: date
    check_out: date
    nights: int
    stay_total: Decimal
    cleaning_fee: Decimal
    total_price: Decimal
    shift_days: int
    reference_total: Decimal | None = None
    savings: Decimal | None = None


class OpportunityPage(BaseModel):
    items: list[TravelOpportunity]
    matched_listings: int


class AmenityCount(BaseModel):
    id: int
    name: str
    category: str
    listings: int


class FilterCounts(BaseModel):
    total: int = Field(description="Listings that match without amenity filters.")
    amenities: list[AmenityCount]
