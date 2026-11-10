"""Booking confirmation emails (feature 016).

The outbox's ``kind`` check also allows ``booking_confirmed_guest`` (to the guest, after payment) and
``booking_confirmed_host`` (to the host, a new confirmed booking). Nothing else changes; the constraint is
replaced in one statement each way, so the table is never without it.
"""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

OLD = "('listing_approved', 'listing_rejected')"
NEW = "('listing_approved', 'listing_rejected', 'booking_confirmed_guest', 'booking_confirmed_host')"


def upgrade() -> None:
    op.execute(
        "ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_kind_check, "
        f"ADD CONSTRAINT email_outbox_kind_check CHECK (kind IN {NEW})"
    )


def downgrade() -> None:
    op.execute("DELETE FROM email_outbox WHERE kind LIKE 'booking_confirmed_%'")
    op.execute(
        "ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_kind_check, "
        f"ADD CONSTRAINT email_outbox_kind_check CHECK (kind IN {OLD})"
    )
