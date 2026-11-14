"""Short-lived, single-use email login challenges; no plaintext codes are retained."""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

STATEMENTS = [
    "ALTER TABLE auth_attempts DROP CONSTRAINT auth_attempts_action_check",
    """ALTER TABLE auth_attempts ADD CONSTRAINT auth_attempts_action_check
       CHECK (action IN ('login', 'register', 'admin_login', 'email_code_request', 'email_code_verify'))""",
    """CREATE TABLE email_login_codes (
        id UUID PRIMARY KEY,
        email_digest TEXT NOT NULL CHECK (length(email_digest) = 64),
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at),
        attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
        consumed_at TIMESTAMPTZ
    )""",
    "CREATE INDEX email_login_codes_email_idx ON email_login_codes (email_digest, created_at DESC)",
    "CREATE INDEX email_login_codes_expires_idx ON email_login_codes (expires_at)",
]


def upgrade() -> None:
    for statement in STATEMENTS:
        op.execute(statement)


def downgrade() -> None:
    op.execute("DROP TABLE email_login_codes")
    op.execute("DELETE FROM auth_attempts WHERE action IN ('email_code_request', 'email_code_verify')")
    op.execute("ALTER TABLE auth_attempts DROP CONSTRAINT auth_attempts_action_check")
    op.execute("""ALTER TABLE auth_attempts ADD CONSTRAINT auth_attempts_action_check
                  CHECK (action IN ('login', 'register', 'admin_login'))""")
