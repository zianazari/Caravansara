"""Indexes for the admin panel's users and bookings lists (feature 051).

Users: the admin searches by any part of an email or a name ("ali" finds "Alireza" and "kalim@…"). A plain
substring search reads every user: about 500 ms on the bulk data (360k users). A trigram GIN index on
``lower(email) || ' ' || lower(full_name)`` answers the same LIKE '%…%' in 0.5 to 25 ms, for 23 MB. It needs
the ``pg_trgm`` extension, which ships with Postgres. Searches of fewer than 3 letters have no trigram, so the
API asks for at least 3.

Bookings: the list is newest first, one status at a time (unpaid, confirmed, ...). Reading the primary key
backwards and skipping other statuses is slow for a rare status; ``(status, id)`` gives the page directly:
about 1 ms instead of 20 ms and more on 3 million bookings.

Built CONCURRENTLY like 0004, so a live database keeps taking bookings while they are built.
"""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS users_search_trgm_idx ON users "
            "USING gin ((lower(email) || ' ' || lower(full_name)) gin_trgm_ops)"
        )
        op.execute("CREATE INDEX CONCURRENTLY IF NOT EXISTS bookings_status_id_idx ON bookings (status, id)")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS bookings_status_id_idx")
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS users_search_trgm_idx")
    # pg_trgm stays: dropping an extension could break anything else that came to use it.
