from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from caravansara.listings.service import PropertyType

SortBy = Literal["rating", "distance"]


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


class AmenityCount(BaseModel):
    id: int
    name: str
    category: str
    listings: int


class FilterCounts(BaseModel):
    total: int = Field(description="Listings that match without amenity filters.")
    amenities: list[AmenityCount]
