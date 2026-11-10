from datetime import datetime

from sqlalchemy import BigInteger, Identity, SmallInteger, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from caravansara.core.db import Base


class OutboxEmail(Base):
    """One email to send; the constraints are in migration 0008."""

    __tablename__ = "email_outbox"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    kind: Mapped[str] = mapped_column(Text)
    user_id: Mapped[int] = mapped_column(BigInteger)
    subject: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    next_attempt_at: Mapped[datetime] = mapped_column(server_default=func.now())
    attempts: Mapped[int] = mapped_column(SmallInteger, default=0)
    sent_at: Mapped[datetime | None]
    failed_at: Mapped[datetime | None]
    last_error: Mapped[str | None] = mapped_column(Text)
