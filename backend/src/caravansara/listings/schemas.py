from datetime import time
from decimal import Decimal
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from caravansara.catalog.schemas import AmenityCategoryOut, CityOut
from caravansara.listings.models import PropertyType

Money = Annotated[Decimal, Field(max_digits=10, decimal_places=2)]
Currency = Annotated[str, Field(pattern=r"^[A-Z]{3}$", description="ISO 4217 code, e.g. EUR.")]


class _ListingFields(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    property_type: PropertyType
    city_id: int
    neighborhood: str | None = Field(default=None, max_length=100)
    address: str = Field(
        min_length=1, max_length=300, description="Private: only the host and confirmed guests see it."
    )
    latitude: float = Field(ge=-90, le=90, description="Real point. Private.")
    longitude: float = Field(ge=-180, le=180, description="Real point. Private.")
    max_guests: int = Field(ge=1, le=50, description="Adults and children; infants don't count.")
    pets_allowed: bool = False
    max_pets: int = Field(default=0, ge=0, le=10)
    bedrooms: int = Field(default=0, ge=0, le=50)
    beds: int = Field(default=1, ge=0, le=100)
    bathrooms: Decimal = Field(default=Decimal(1), ge=0, le=50, max_digits=3, decimal_places=1)
    price_per_night: Money = Field(gt=0)
    cleaning_fee: Money = Field(default=Decimal(0), ge=0)
    currency: Currency = "EUR"
    check_in_time: time = time(15, 0)
    check_out_time: time = time(11, 0)


class ListingCreate(_ListingFields):
    amenity_ids: list[int] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def _pets(self) -> Self:
        if not self.pets_allowed and self.max_pets:
            raise ValueError("max_pets must be 0 when pets are not allowed")
        return self

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Canal-side loft",
                "description": "Bright loft by the Prinsengracht.",
                "property_type": "entire_place",
                "city_id": 1,
                "neighborhood": "Jordaan",
                "address": "12 Demo Street, Amsterdam",
                "latitude": 52.3731,
                "longitude": 4.8838,
                "max_guests": 3,
                "pets_allowed": True,
                "max_pets": 1,
                "bedrooms": 1,
                "beds": 2,
                "bathrooms": 1,
                "price_per_night": "145.00",
                "cleaning_fee": "30.00",
                "currency": "EUR",
                "amenity_ids": [17, 19],
            }
        }
    )


class ListingUpdate(BaseModel):
    """Only the fields sent change. ``is_active: false`` hides the listing; it is never deleted."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    property_type: PropertyType | None = None
    city_id: int | None = None
    neighborhood: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, min_length=1, max_length=300)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    max_guests: int | None = Field(default=None, ge=1, le=50)
    pets_allowed: bool | None = None
    max_pets: int | None = Field(default=None, ge=0, le=10)
    bedrooms: int | None = Field(default=None, ge=0, le=50)
    beds: int | None = Field(default=None, ge=0, le=100)
    bathrooms: Decimal | None = Field(default=None, ge=0, le=50, max_digits=3, decimal_places=1)
    price_per_night: Money | None = Field(default=None, gt=0)
    cleaning_fee: Money | None = Field(default=None, ge=0)
    currency: Currency | None = None
    check_in_time: time | None = None
    check_out_time: time | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _pairs(self) -> Self:
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("latitude and longitude must be sent together")
        return self


class AmenitiesIn(BaseModel):
    amenity_ids: list[int] = Field(max_length=100)


class Pin(BaseModel):
    """Approximate public point (moved 100–500 m from the real one)."""

    lat: float
    lng: float


class PrivateLocation(BaseModel):
    address: str
    latitude: float
    longitude: float


class HostOut(BaseModel):
    id: int
    full_name: str
    avatar_url: str | None


class PhotoOut(BaseModel):
    id: int
    url: str
    storage_key: str
    width: int
    height: int
    caption: str | None
    room_tag: str | None
    sort_order: int = Field(description="0 is the cover photo.")


class ListingOut(BaseModel):
    id: int
    title: str
    description: str | None
    property_type: PropertyType
    city: CityOut
    neighborhood: str | None
    pin: Pin
    max_guests: int
    pets_allowed: bool
    max_pets: int
    bedrooms: int
    beds: int
    bathrooms: Decimal
    price_per_night: Decimal
    cleaning_fee: Decimal
    currency: str
    check_in_time: time
    check_out_time: time
    avg_rating: Decimal | None
    review_count: int
    is_active: bool
    host: HostOut
    photos: list[PhotoOut]
    amenities: list[AmenityCategoryOut]
    private_location: PrivateLocation | None = Field(
        description="Only for the host. Guests see the address on a confirmed booking."
    )


class ListingSummary(BaseModel):
    id: int
    title: str
    city: CityOut
    price_per_night: Decimal
    currency: str
    avg_rating: Decimal | None
    review_count: int
    is_active: bool
    cover_url: str | None


class ListingPage(BaseModel):
    items: list[ListingSummary]
    total: int


ImageType = Literal["image/jpeg", "image/png", "image/webp"]


class UploadUrlIn(BaseModel):
    content_type: ImageType


class UploadUrlOut(BaseModel):
    storage_key: str = Field(description="Send this to `POST /listings/{id}/photos` after the upload.")
    url: str = Field(description="POST the file here as multipart/form-data.")
    fields: dict[str, str] = Field(description="Form fields to send before the `file` field.")
    expires_in: int


class PhotoCreate(BaseModel):
    storage_key: str = Field(max_length=300)
    width: int = Field(gt=0, le=20000)
    height: int = Field(gt=0, le=20000)
    caption: str | None = Field(default=None, max_length=300)
    room_tag: str | None = Field(default=None, max_length=50, examples=["Kitchen"])


class PhotoUpdate(BaseModel):
    caption: str | None = Field(default=None, max_length=300)
    room_tag: str | None = Field(default=None, max_length=50)


class PhotoOrderIn(BaseModel):
    photo_ids: list[int] = Field(min_length=1, description="Every photo of the listing, cover first.")
