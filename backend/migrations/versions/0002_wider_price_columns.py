"""Wider price columns for rials: NUMERIC(10,2) -> NUMERIC(14,2) (specs/002-rial-price-columns).

A Tehran stay costs 10-100 million rials a night, so a multi-night total did not fit
NUMERIC(10,2) (at most 99,999,999.99) and POST /bookings failed with 500. The input limit is
1,000,000,000 a night, so the largest total is 1e9 x 365 + 1e9 = 366,000,000,000.00, which
NUMERIC(14,2) holds. Widening numeric with the same scale changes only metadata: PostgreSQL does
not rewrite the tables (research R3).

Downgrade narrows the columns again. If a stored amount no longer fits, PostgreSQL stops with
22003 (numeric field overflow) and the migration's transaction rolls back: nothing is rounded,
cut or deleted.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-05
"""

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _set_width(width: str) -> None:
    # One statement per op.execute: asyncpg runs a single command per call.
    op.execute(
        f"ALTER TABLE listings ALTER COLUMN price_per_night TYPE {width}, ALTER COLUMN cleaning_fee TYPE {width}"
    )
    op.execute(
        f"ALTER TABLE bookings ALTER COLUMN nightly_price TYPE {width}, "
        f"ALTER COLUMN cleaning_fee TYPE {width}, ALTER COLUMN total_price TYPE {width}"
    )


def upgrade() -> None:
    _set_width("NUMERIC(14,2)")


def downgrade() -> None:
    _set_width("NUMERIC(10,2)")
