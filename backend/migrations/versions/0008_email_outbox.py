"""Emails through an outbox (feature 013).

What this adds and why:

- ``email_outbox``: one row per email to send. The row is written in the same transaction as the event it
  tells about (an admin's decision on a listing), so an email is never lost and never sent for a decision
  that was rolled back. The worker sends it later: a slow or stopped mail server never slows or breaks the
  decision itself. ``attempts`` and ``next_attempt_at`` let the worker try again with a growing wait;
  ``failed_at`` marks an email given up after the last attempt, ``last_error`` says why (never the address).
- The recipient is ``user_id``, not a copied address: the address is read when the email is sent, so a
  second copy of personal data is not kept, and a deleted account takes its unsent emails with it.
- ``email_outbox_due_idx``, partial on unsent rows: the worker reads only what is due, and the index stays
  as small as the queue, however many emails were sent before.
"""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

STATEMENTS = [
    """
CREATE TABLE email_outbox (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind            TEXT        NOT NULL CHECK (kind IN ('listing_approved', 'listing_rejected')),
    user_id         BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    subject         TEXT        NOT NULL CHECK (length(subject) BETWEEN 1 AND 300),
    body            TEXT        NOT NULL CHECK (length(body) >= 1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts        SMALLINT    NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    sent_at         TIMESTAMPTZ,
    failed_at       TIMESTAMPTZ,
    last_error      TEXT,
    CHECK (sent_at IS NULL OR failed_at IS NULL)
)
""",
    "CREATE INDEX email_outbox_due_idx ON email_outbox (next_attempt_at) WHERE sent_at IS NULL AND failed_at IS NULL",
]


def upgrade() -> None:
    for statement in STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS email_outbox")
