import enum
from datetime import datetime

from sqlalchemy import BigInteger, Enum, ForeignKey, Identity, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from caravansara.core.db import Base


class AccountKind(enum.StrEnum):
    member = "member"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    email: Mapped[str] = mapped_column(Text)
    password_hash: Mapped[str] = mapped_column(Text)
    full_name: Mapped[str] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    # Admins share this table so the unique index on lower(email) keeps one email to one account of
    # either kind (specs/backend (004) research R1). Only the create-admin command writes "admin"; no API
    # schema has this field, so registration and profile edits cannot change it (FR-012).
    kind: Mapped[AccountKind] = mapped_column(
        Enum(AccountKind, name="account_kind", create_type=False, values_callable=lambda e: [m.value for m in e]),
        server_default="member",
    )
    # Set by disable-admin. A disabled admin can neither log in nor act, even with a live token (R2).
    disabled_at: Mapped[datetime | None]


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
