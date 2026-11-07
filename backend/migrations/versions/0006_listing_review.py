"""Listing review by an admin (specs/004-listing-approval).

What this adds and why:

- ``users.kind`` (member | admin) and ``users.disabled_at``. Admins live in the same table, so the
  unique index on ``lower(email)`` keeps one email to one account of either kind (research R1).
  Only the ``create-admin`` command writes ``admin``; ``disable-admin`` sets ``disabled_at``.
- ``listings.review_status``, ``submitted_at``, ``rejection_reason`` and ``review_version``. A
  listing is public only when it is active *and* approved. ``review_version`` goes up on every
  descriptive edit, so an admin's decision applies only to the version they saw (R6).
- ``listing_review_events``: append-only history of every submission and decision, with who did it
  (FR-015). A trigger refuses UPDATE and DELETE (R11).
- ``admin_address_views``: one row each time an admin opens a listing with its exact address
  (FR-018, constitution V).
- ``auth_attempts.action`` also allows ``admin_login``: admin logins have the same rate limit as
  member logins, counted apart, so neither side can lock the other out (R3).

Two-step defaults (R5). ``review_status`` is added with DEFAULT 'approved' and then switched to
'pending'; ``submitted_at`` is added without a default and then gets DEFAULT now(). A constant
default is metadata only in PostgreSQL 16, so every existing listing becomes approved at once
without rewriting the table (100,000 rows in caravansara_bulk), and every new row is pending even
if some code forgets to say so. A volatile default such as now() during ADD COLUMN would rewrite
the table, hence the second step.

Statistics. ADD COLUMN gives the new column no statistics, and autoanalyze does not start for it
(no row changed). The planner then guesses that ``review_status = 'approved'`` keeps 0.5% of the
rows, and on caravansara_bulk the city searches with dates switched plans and went from 36 ms to
170 ms (specs/004-listing-approval/measurements.md). So the upgrade ends with ANALYZE listings:
0.4 s on 100,000 listings, and the plans are the ones before the migration again.

Downgrade (R16) never makes anything public that is not approved today: unapproved listings are set
inactive first. Admin accounts are deleted, because without ``kind`` they would turn into ordinary
members with a password who could book. No listing, booking or review is deleted.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-07
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

# One statement per op.execute: asyncpg runs a single command per call.
STATEMENTS = [
    "CREATE TYPE account_kind AS ENUM ('member', 'admin')",
    "CREATE TYPE listing_review_status AS ENUM ('pending', 'approved', 'rejected')",
    "CREATE TYPE review_action AS ENUM ('submitted', 'edited', 'resubmitted', 'approved', 'rejected')",
    "ALTER TABLE users ADD COLUMN kind account_kind NOT NULL DEFAULT 'member'",
    "ALTER TABLE users ADD COLUMN disabled_at TIMESTAMPTZ",
    "ALTER TABLE auth_attempts DROP CONSTRAINT auth_attempts_action_check",
    "ALTER TABLE auth_attempts ADD CONSTRAINT auth_attempts_action_check "
    "CHECK (action IN ('login', 'register', 'admin_login'))",
    # Existing listings: approved, with no rewrite. New listings: pending.
    "ALTER TABLE listings ADD COLUMN review_status listing_review_status NOT NULL DEFAULT 'approved'",
    "ALTER TABLE listings ALTER COLUMN review_status SET DEFAULT 'pending'",
    "ALTER TABLE listings ADD COLUMN submitted_at TIMESTAMPTZ",
    "ALTER TABLE listings ALTER COLUMN submitted_at SET DEFAULT now()",
    "ALTER TABLE listings ADD COLUMN rejection_reason TEXT",
    "ALTER TABLE listings ADD COLUMN review_version INTEGER NOT NULL DEFAULT 0",
    """
ALTER TABLE listings ADD CONSTRAINT listings_pending_submitted_check
    CHECK (review_status <> 'pending' OR submitted_at IS NOT NULL)
""",
    """
ALTER TABLE listings ADD CONSTRAINT listings_rejection_reason_check
    CHECK ((review_status = 'rejected') = (rejection_reason IS NOT NULL)
           AND (rejection_reason IS NULL
                OR (char_length(rejection_reason) <= 1000 AND btrim(rejection_reason) <> '')))
""",
    # The queue, its size and its oldest wait read only this index (R10). Empty today.
    "CREATE INDEX listings_review_queue_idx ON listings (submitted_at, id) WHERE review_status = 'pending'",
    """
CREATE TABLE listing_review_events (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    listing_id     BIGINT        NOT NULL REFERENCES listings (id),
    action         review_action NOT NULL,
    actor_id       BIGINT        NOT NULL REFERENCES users (id),
    review_version INTEGER       NOT NULL,
    reason         TEXT,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT listing_review_events_reason_check CHECK ((action = 'rejected') = (reason IS NOT NULL))
)
""",
    "CREATE INDEX listing_review_events_listing_idx ON listing_review_events (listing_id, created_at)",
    """
CREATE FUNCTION listing_review_events_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'listing_review_events is append-only';
END $$
""",
    """
CREATE TRIGGER listing_review_events_append_only
BEFORE UPDATE OR DELETE ON listing_review_events
FOR EACH ROW EXECUTE FUNCTION listing_review_events_refuse_change()
""",
    """
CREATE TABLE admin_address_views (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id   BIGINT      NOT NULL REFERENCES users (id),
    listing_id BIGINT      NOT NULL REFERENCES listings (id),
    viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
""",
]


def upgrade() -> None:
    for statement in STATEMENTS:
        op.execute(statement)
    op.execute("ANALYZE listings")  # statistics for review_status; see the docstring


def downgrade() -> None:
    # Nothing unapproved may become public when the column goes away (R16).
    op.execute("UPDATE listings SET is_active = false WHERE review_status <> 'approved' AND is_active")
    # The history tables point at admin accounts, so they go first.
    op.execute("DROP TABLE IF EXISTS admin_address_views")
    op.execute("DROP TABLE IF EXISTS listing_review_events")
    op.execute("DROP FUNCTION IF EXISTS listing_review_events_refuse_change()")
    # Without `kind` an admin would be an ordinary member who can book (R16).
    op.execute("DELETE FROM auth_attempts WHERE action = 'admin_login'")
    op.execute("ALTER TABLE auth_attempts DROP CONSTRAINT auth_attempts_action_check")
    op.execute(
        "ALTER TABLE auth_attempts ADD CONSTRAINT auth_attempts_action_check CHECK (action IN ('login', 'register'))"
    )
    op.execute("DELETE FROM users WHERE kind = 'admin'")
    op.execute("DROP INDEX IF EXISTS listings_review_queue_idx")
    op.execute("ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_rejection_reason_check")
    op.execute("ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_pending_submitted_check")
    for column in ("review_version", "rejection_reason", "submitted_at", "review_status"):
        op.execute(f"ALTER TABLE listings DROP COLUMN IF EXISTS {column}")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS disabled_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS kind")
    op.execute("DROP TYPE IF EXISTS review_action")
    op.execute("DROP TYPE IF EXISTS listing_review_status")
    op.execute("DROP TYPE IF EXISTS account_kind")
