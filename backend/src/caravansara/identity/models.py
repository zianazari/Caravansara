from datetime import datetime

from sqlalchemy import BigInteger, ForeignKey, Identity, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from caravansara.core.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    email: Mapped[str] = mapped_column(Text)
    password_hash: Mapped[str] = mapped_column(Text)
    full_name: Mapped[str] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(Text, unique=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    expires_at: Mapped[datetime]
    revoked_at: Mapped[datetime | None]


class AuthAttempt(Base):
    __tablename__ = "auth_attempts"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    action: Mapped[str] = mapped_column(Text)
    identifier: Mapped[str] = mapped_column(Text)
    succeeded: Mapped[bool]
    attempted_at: Mapped[datetime] = mapped_column(server_default=func.now())
