"""Database engine, sessions and the shared ORM base."""

from collections.abc import AsyncIterator
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import DateTime, MetaData
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from caravansara.core.config import Settings


class Base(DeclarativeBase):
    """One metadata for all modules, so string foreign keys like ``"users.id"`` resolve.

    Tables are created by Alembic migrations, never by ``metadata.create_all``.
    """

    metadata = MetaData()
    # Every timestamp column is TIMESTAMPTZ.
    type_annotation_map = {datetime: DateTime(timezone=True)}  # noqa: RUF012
    # Fetch server defaults (ids, created_at) with RETURNING on insert, so reading them
    # later never triggers a lazy load, which async sessions don't allow.
    __mapper_args__ = {"eager_defaults": True}  # noqa: RUF012


def create_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(
        settings.database_url,
        pool_size=settings.db_pool_size,
        pool_pre_ping=True,
    )


def create_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    sessionmaker: async_sessionmaker[AsyncSession] = request.app.state.sessionmaker
    async with sessionmaker() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def sqlstate(exc: DBAPIError) -> str | None:
    """PostgreSQL error code (e.g. ``23P01``) of a driver error, if any."""
    orig = exc.orig
    for candidate in (orig, getattr(orig, "__cause__", None)):
        code = getattr(candidate, "sqlstate", None) or getattr(candidate, "pgcode", None)
        if isinstance(code, str):
            return code
    return None


def constraint_name(exc: DBAPIError) -> str | None:
    """Name of the violated constraint, if the driver reports it."""
    orig = exc.orig
    for candidate in (orig, getattr(orig, "__cause__", None)):
        name = getattr(candidate, "constraint_name", None)
        if isinstance(name, str):
            return name
    return None
