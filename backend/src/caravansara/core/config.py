"""Settings from environment variables (prefix ``CARAVANSARA_``); secrets never live in the repo."""

from functools import lru_cache
from pathlib import Path

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

    # Worker
    worker_interval_seconds: int = 60

    # Seeds
    seed_dir: Path = _REPO_ROOT / "db"

    cors_origins: list[str] = []


@lru_cache
def get_settings() -> Settings:
    return Settings()
