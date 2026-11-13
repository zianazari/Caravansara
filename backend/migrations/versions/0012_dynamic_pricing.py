"""Per-listing price rules, shared holiday calendar and immutable nightly booking prices."""

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE listings ADD COLUMN pricing_policy jsonb NOT NULL DEFAULT '{}'::jsonb")
    op.execute("ALTER TABLE bookings ADD COLUMN nightly_prices jsonb NOT NULL DEFAULT '[]'::jsonb")
    op.execute("""
        CREATE TABLE holidays (
            country_code char(2) NOT NULL REFERENCES countries(code),
            day date NOT NULL,
            name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
            PRIMARY KEY (country_code, day)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE holidays")
    op.execute("ALTER TABLE bookings DROP COLUMN nightly_prices")
    op.execute("ALTER TABLE listings DROP COLUMN pricing_policy")
