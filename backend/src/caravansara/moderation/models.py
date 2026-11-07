from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Identity, func
from sqlalchemy.orm import Mapped, mapped_column

from caravansara.core.db import Base


class AdminAddressView(Base):
    """One row each time an admin opens a listing with its exact address (FR-018, constitution V).

    Written in the same transaction as the answer, so no address is ever shown unrecorded. Nothing
    reads it yet; it is the record to look at when someone asks who saw an address (research R11).
    """

    __tablename__ = "admin_address_views"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    admin_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    listing_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("listings.id"))
    viewed_at: Mapped[datetime] = mapped_column(server_default=func.now())
