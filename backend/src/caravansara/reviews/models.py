from datetime import datetime

from sqlalchemy import BigInteger, Identity, SmallInteger, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from caravansara.core.db import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    # (booking_id, listing_id, guest_id) has a composite FK to bookings in the database.
    booking_id: Mapped[int] = mapped_column(BigInteger)
    listing_id: Mapped[int] = mapped_column(BigInteger)
    guest_id: Mapped[int] = mapped_column(BigInteger)
    rating: Mapped[int] = mapped_column(SmallInteger)
    cleanliness_rating: Mapped[int | None] = mapped_column(SmallInteger)
    accuracy_rating: Mapped[int | None] = mapped_column(SmallInteger)
    check_in_rating: Mapped[int | None] = mapped_column(SmallInteger)
    communication_rating: Mapped[int | None] = mapped_column(SmallInteger)
    location_rating: Mapped[int | None] = mapped_column(SmallInteger)
    value_rating: Mapped[int | None] = mapped_column(SmallInteger)
    comment: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
