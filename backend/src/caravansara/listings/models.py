import enum
from datetime import datetime, time
from decimal import Decimal
from typing import Any

from geoalchemy2 import Geography
from sqlalchemy import (
    CHAR,
    BigInteger,
    Enum,
    ForeignKey,
    Identity,
    Integer,
    Numeric,
    SmallInteger,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from caravansara.core.db import Base


class PropertyType(enum.StrEnum):
    entire_place = "entire_place"
    private_room = "private_room"
    shared_room = "shared_room"


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    host_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    property_type: Mapped[PropertyType] = mapped_column(
        Enum(PropertyType, name="property_type", create_type=False, values_callable=lambda e: [m.value for m in e])
    )
    city_id: Mapped[int] = mapped_column(Integer, ForeignKey("cities.id"))
    neighborhood: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str] = mapped_column(Text)
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    # Fuzzed public point; the only location used outside the host's own views.
    public_location: Mapped[Any] = mapped_column(Geography(geometry_type="POINT", srid=4326, spatial_index=False))
    max_guests: Mapped[int] = mapped_column(SmallInteger)
    pets_allowed: Mapped[bool]
    max_pets: Mapped[int] = mapped_column(SmallInteger)
    bedrooms: Mapped[int] = mapped_column(SmallInteger)
    beds: Mapped[int] = mapped_column(SmallInteger)
    bathrooms: Mapped[Decimal] = mapped_column(Numeric(3, 1))
    price_per_night: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    cleaning_fee: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(CHAR(3))
    check_in_time: Mapped[time]
    check_out_time: Mapped[time]
    avg_rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    review_count: Mapped[int] = mapped_column(Integer, server_default="0")
    is_active: Mapped[bool] = mapped_column(server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ListingPhoto(Base):
    __tablename__ = "listing_photos"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    listing_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("listings.id", ondelete="CASCADE"))
    storage_key: Mapped[str] = mapped_column(Text)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    caption: Mapped[str | None] = mapped_column(Text)
    room_tag: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(SmallInteger)


class ListingAmenity(Base):
    __tablename__ = "listing_amenities"

    listing_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True)
    amenity_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey("amenities.id"), primary_key=True)
