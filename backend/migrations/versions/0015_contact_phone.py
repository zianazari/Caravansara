"""Optional private contact numbers on member profiles."""

from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN phone_number TEXT CONSTRAINT users_phone_number_check CHECK (phone_number IS NULL OR phone_number ~ '^\\+[1-9][0-9]{6,14}$')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN phone_number")
