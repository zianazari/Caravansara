from datetime import datetime

from sqlalchemy import BigInteger, func
from sqlalchemy.orm import Mapped, mapped_column

from caravansara.core.db import Base


class WishlistItem(Base):
    """One saved listing. The foreign keys to users and listings are in the migration (0007)."""

    __tablename__ = "wishlist_items"

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    listing_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    saved_at: Mapped[datetime] = mapped_column(server_default=func.now())
