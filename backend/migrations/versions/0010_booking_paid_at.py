"""When a booking was paid (feature 047).

The guest's receipt shows the payment time, which was not stored: paying only changed the status. A nullable
``paid_at`` is set by the payment's conditional update and never changed after. Bookings paid before this
migration keep NULL (the receipt then shows no time); nothing is filled in or deleted.
"""

from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE bookings ADD COLUMN paid_at TIMESTAMPTZ")
    op.execute(
        "COMMENT ON COLUMN bookings.paid_at IS "
        "'When the guest paid (feature 047); NULL before payment, and for bookings paid before 0010'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE bookings DROP COLUMN paid_at")
