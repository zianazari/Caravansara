"""Archive host listings while retaining booking and review history."""

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE listings ADD COLUMN deleted_at TIMESTAMPTZ")
    op.execute(
        "ALTER TABLE listings ADD CONSTRAINT listings_deleted_inactive CHECK (deleted_at IS NULL OR NOT is_active)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE listings DROP CONSTRAINT listings_deleted_inactive")
    op.execute("ALTER TABLE listings DROP COLUMN deleted_at")
