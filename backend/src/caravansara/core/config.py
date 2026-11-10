"""Settings from environment variables (prefix ``CARAVANSARA_``); secrets never live in the repo."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/src/caravansara/core/config.py -> repo root is four levels up
_REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CARAVANSARA_", env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+asyncpg://caravansara:caravansara@localhost:5432/caravansara"
    db_pool_size: int = 10

    # Auth
    jwt_secret: str = Field(default="dev-only-change-me-dev-only-change-me", min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    # Admin tokens are short: a lost one is useless after 15 minutes, and every admin request also
    # checks the account in the database (specs/backend (004) research R2). Since feature 011 an admin
    # also gets a rotating refresh token, but its session ends a fixed time after log-in, however often
    # it is refreshed: a working day, so a forgotten panel does not stay signed in for weeks.
    admin_token_minutes: int = 15
    admin_session_hours: int = 8
    # Empty: the admin endpoints answer on any Host. Set (e.g. "admin.example.com"): they answer
    # only on that subdomain and look absent (404) everywhere else, so a deployment can keep them
    # off the public site (constitution 1.3.0 principle V, research R12).
    admin_host: str = ""

    # Rate limit for login and registration (PostgreSQL counter, no Redis)
    login_max_failures: int = 5
    login_window_minutes: int = 15
    login_max_per_ip: int = 30
    register_max_per_ip: int = 10
    register_window_minutes: int = 60

    # Booking rules
    hold_minutes: int = 15
    max_nights: int = 365
    max_days_ahead: int = 365
    review_window_days: int = 14

    # Search
    min_radius_km: float = 1
    max_radius_km: float = 100

    # Object storage (S3 API; MinIO in development and tests)
    s3_endpoint_url: str | None = "http://localhost:9000"
    # Host the browser uses for presigned uploads; it is part of the signature.
    s3_public_endpoint_url: str | None = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_access_key: str = "caravansara"
    s3_secret_key: str = "caravansara-secret"
    s3_bucket: str = "caravansara-media"
    media_base_url: str = "http://localhost:9000/caravansara-media"
    upload_url_seconds: int = 600
    max_photo_bytes: int = 10 * 1024 * 1024
    # Profile pictures: the limit of the upload policy and of the check in PUT /me/avatar. Owner decision,
    # 2026-11-08 (specs/005-frontend-guest, FR-038): PNG or JPEG up to 5 MB.
    max_avatar_bytes: int = 5 * 1024 * 1024

    # Worker
    worker_interval_seconds: int = 60
    # Email (feature 013). Empty host: emails wait in the outbox and nothing is sent. In compose: Mailpit.
    smtp_host: str = ""
    smtp_port: int = 25
    smtp_from: str = "Caravansara <no-reply@caravansara.example.com>"
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = False
    smtp_timeout_seconds: float = 10
    email_max_attempts: int = 8
    email_batch: int = 20
    # The site's address, for links in emails.
    site_url: str = "http://localhost:3001"

    # Observability
    log_level: str = "INFO"
    log_format: Literal["json", "text"] = "json"  # json for Loki; text is easier to read in a terminal
    metrics_enabled: bool = True  # GET /metrics for Prometheus; keep it off the public internet
    otel_endpoint: str | None = None  # OTLP/HTTP collector, e.g. http://alloy:4318; None turns tracing off
    otel_sample_ratio: float = Field(default=1.0, ge=0, le=1)
    worker_metrics_port: int = 9100  # the worker has no HTTP API, so it serves /metrics on its own port

    # Seeds
    seed_dir: Path = _REPO_ROOT / "db"

    cors_origins: list[str] = []


@lru_cache
def get_settings() -> Settings:
    return Settings()
