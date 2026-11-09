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


class ReviewStatus(enum.StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ReviewAction(enum.StrEnum):
    submitted = "submitted"  # a new listing entered the queue
    edited = "edited"  # a descriptive edit sent an approved listing back to the queue
    resubmitted = "resubmitted"  # the host sent a rejected listing again
    approved = "approved"
    rejected = "rejected"


def _enum(cls: type[enum.StrEnum], name: str) -> Enum:
    return Enum(cls, name=name, create_type=False, values_callable=lambda e: [m.value for m in e])


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    host_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    property_type: Mapped[PropertyType] = mapped_column(_enum(PropertyType, "property_type"))
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
    price_per_night: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    cleaning_fee: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(CHAR(3))
    check_in_time: Mapped[time]
    check_out_time: Mapped[time]
    avg_rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    review_count: Mapped[int] = mapped_column(Integer, server_default="0")
    is_active: Mapped[bool] = mapped_column(server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    # Review by an admin (specs/backend (004)). Public = is_active AND approved (FR-002).
    # The database default is pending, so a listing never skips the queue (migration 0006).
    review_status: Mapped[ReviewStatus] = mapped_column(
        _enum(ReviewStatus, "listing_review_status"), server_default="pending"
    )
    # When it entered the queue; the queue is oldest first. A new value on every new entry.
    submitted_at: Mapped[datetime | None] = mapped_column(server_default=func.now())
    # The last rejection reason, only while rejected; the host reads it (FR-003).
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    # Goes up by one on every descriptive edit (FR-009), whatever the status. An admin's decision
    # names the version they saw, and the UPDATE applies only if it is still current, so an edit
    # made after the admin opened the listing is never approved unseen (research R6).
    review_version: Mapped[int] = mapped_column(Integer, server_default="0")


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


class ListingReviewEvent(Base):
    """Append-only history of submissions and decisions, with who did it (FR-015).
    A trigger refuses UPDATE and DELETE (migration 0006)."""

    __tablename__ = "listing_review_events"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    listing_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("listings.id"))
    action: Mapped[ReviewAction] = mapped_column(_enum(ReviewAction, "review_action"))
    actor_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    review_version: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
