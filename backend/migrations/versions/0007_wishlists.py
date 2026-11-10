"""Wishlists (feature 012).

What this adds and why:

- ``wishlist_items``: the listings a member saved, one row per (user, listing). The primary key keeps a
  listing in a user's wishlist at most once, so saving twice is harmless; ``saved_at`` orders the list,
  newest first. Both foreign keys cascade: a deleted account or listing takes its saves with it.
- ``wishlist_items_user_saved_idx`` on (user_id, saved_at DESC, listing_id): the wishlist page reads one
  user's rows newest first, so it never sorts.

A new, empty table: no existing row changes, and the upgrade is instant on any database.
"""

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

STATEMENTS = [
    """
CREATE TABLE wishlist_items (
    user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    listing_id BIGINT      NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
    saved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, listing_id)
)
""",
    "CREATE INDEX wishlist_items_user_saved_idx ON wishlist_items (user_id, saved_at DESC, listing_id)",
]


def upgrade() -> None:
    for statement in STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS wishlist_items")
