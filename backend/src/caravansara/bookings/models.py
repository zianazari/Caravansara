import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import CHAR, BigInteger, Enum, ForeignKey, Identity, Numeric, SmallInteger, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from caravansara.core.db import Base


class BookingStatus(enum.StrEnum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"
    expired = "expired"
    completed = "completed"


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    listing_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("listings.id"))
    guest_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    check_in: Mapped[date]
    check_out: Mapped[date]
    # ``stay`` is a generated column in the database; the ORM never writes it.
    adults: Mapped[int] = mapped_column(SmallInteger)
    children: Mapped[int] = mapped_column(SmallInteger)
    infants: Mapped[int] = mapped_column(SmallInteger)
    pets: Mapped[int] = mapped_column(SmallInteger)
    nightly_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    cleaning_fee: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    total_price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    nightly_prices: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default="[]")
    currency: Mapped[str] = mapped_column(CHAR(3))
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status", create_type=False, values_callable=lambda e: [m.value for m in e])
    )
    hold_expires_at: Mapped[datetime | None]
    # When the guest paid (feature 047, migration 0010); NULL before payment and for older bookings.
    paid_at: Mapped[datetime | None]
    idempotency_key: Mapped[uuid.UUID] = mapped_column(Uuid)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
