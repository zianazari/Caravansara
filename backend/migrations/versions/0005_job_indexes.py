"""Index for the worker job that completes finished stays (specs/backend (003), US3).

The job runs every minute. It read every confirmed booking and joined it to its listing and city to
compare the check-out in city time with now: 779 ms on the bulk data. The job now also bounds
check_out by now + 14 hours (no time zone is further ahead of UTC), and this partial index finds
just those stays: 40 ms, 3.3 MB (specs/backend/measurements.md (003)).

Built CONCURRENTLY like 0004, for the same reason.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-06
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "CREATE INDEX CONCURRENTLY bookings_confirmed_check_out_idx ON bookings (check_out) "
            "WHERE status = 'confirmed'"
        )


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("DROP INDEX CONCURRENTLY IF EXISTS bookings_confirmed_check_out_idx")
