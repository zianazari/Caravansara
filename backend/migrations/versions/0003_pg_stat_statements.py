"""pg_stat_statements: query statistics for the Grafana "costly queries" panel (specs/backend (003), FR-003).

The extension only answers when the server preloads it (``shared_preload_libraries``, set on the
``db`` service in docker-compose.yml). Creating it works without that, so this migration also runs
on the test database, which never reads the statistics.

Downgrade leaves the extension in place on purpose: it holds statistics, not application schema, and
the postgres-exporter reads it. Dropping it would lose the statistics without undoing anything the
application depends on.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-06
"""

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements")


def downgrade() -> None:
    pass  # see the docstring: the extension stays
