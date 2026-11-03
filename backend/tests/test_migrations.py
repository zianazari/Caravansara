"""Migrations go down and up cleanly, on a database of their own."""

import asyncio

import asyncpg
from alembic import command
from alembic.config import Config

from caravansara.cli import ALEMBIC_INI, migrate
from caravansara.core.config import Settings

# Our tables only: PostGIS owns spatial_ref_sys, Alembic owns alembic_version.
TABLES = (
    "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' "
    "AND tablename NOT IN ('alembic_version', 'spatial_ref_sys')"
)


async def test_downgrade_and_upgrade_again(prepared: Settings) -> None:
    admin = prepared.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    conn = await asyncpg.connect(admin)
    await conn.execute("DROP DATABASE IF EXISTS migration_check")
    await conn.execute("CREATE DATABASE migration_check")
    await conn.close()
    url = prepared.database_url.rsplit("/", 1)[0] + "/migration_check"
    plain = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    settings = prepared.model_copy(update={"database_url": url})

    def downgrade() -> None:
        config = Config(str(ALEMBIC_INI))
        config.attributes["database_url"] = url
        command.downgrade(config, "base")

    async def table_count() -> int:
        c = await asyncpg.connect(plain)
        try:
            return int(await c.fetchval(TABLES))
        finally:
            await c.close()

    try:
        await asyncio.to_thread(migrate, settings)
        assert await table_count() == 12
        await asyncio.to_thread(downgrade)
        assert await table_count() == 0
        await asyncio.to_thread(migrate, settings)  # and back up, as on a fresh deploy
        assert await table_count() == 12
    finally:
        conn = await asyncpg.connect(admin)
        await conn.execute("DROP DATABASE IF EXISTS migration_check WITH (FORCE)")
        await conn.close()
