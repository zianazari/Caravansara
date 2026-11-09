"""Indexes for the host's booking list and for search with dates (specs/backend (003), US2).

Numbers are medians on the bulk data (100,000 listings, 3 million bookings), from
specs/backend/measurements.md (003):

- ``bookings_listing_check_in_idx`` (listing_id, check_in, id): a host's "bookings of my listing",
  count and page, read the whole bookings table (Seq Scan, about 200 ms). Now an index scan in the
  page's own order: 0.1 ms. 117 MB.
- ``bookings_active_stay_idx``, GiST on stay for the statuses that block dates: search with dates
  can find the bookings that overlap the dates at once and hash them against the listings, instead
  of looking them up per listing in ``no_double_booking`` (listing_id first, so no use without a
  listing). London count with dates: 344 ms to 37 ms. 163 MB, built in 21 s.

Both are built CONCURRENTLY, so bookings stay writable while they build. If a build fails, PostgreSQL
leaves an INVALID index: drop it (DROP INDEX CONCURRENTLY <name>) and run the migration again.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-06
"""

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

INDEXES = {
    "bookings_listing_check_in_idx": "ON bookings (listing_id, check_in, id)",
    "bookings_active_stay_idx": "ON bookings USING gist (stay) WHERE status IN ('pending', 'confirmed', 'completed')",
}


def upgrade() -> None:
    with op.get_context().autocommit_block():  # CONCURRENTLY cannot run inside a transaction
        for name, definition in INDEXES.items():
            op.execute(f"CREATE INDEX CONCURRENTLY {name} {definition}")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name in INDEXES:
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {name}")
