# Caravansara backend

FastAPI backend for Caravansara, an Airbnb-like place reservation site. The design and the reasons behind it are in [docs/backend-design.md](../docs/backend-design.md).

## Run everything

```bash
docker compose up --build                              # from the repository root
docker compose run --rm migrate caravansara seed-demo  # optional demo data (empty database only)
```

| URL | What |
| --- | --- |
| http://localhost:8000/docs | Swagger UI: try every endpoint, **Authorize** with an access token |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/api/v1/openapi.json | OpenAPI schema |
| http://localhost:9001 | MinIO console (`caravansara` / `caravansara-secret`) |

Demo accounts after `seed-demo`: `guest@example.com` and `host@example.com`, password `caravansara-demo`.

Compose starts PostgreSQL 16 with PostGIS, MinIO, a one-off `migrate` job (migrations, catalog seed, bucket), the API and the worker.

MinIO stopped publishing Docker images in 2025, so compose and the tests use the last pinned Bitnami build, `bitnamilegacy/minio:2025.4.22`. The code speaks only the S3 API, so moving to S3, R2 or another S3-compatible server only changes settings.

## Develop

Needs [uv](https://docs.astral.sh/uv/) and Docker.

```bash
cd backend
uv sync
docker compose up -d db minio migrate    # services only
uv run caravansara serve --reload        # API on :8000
uv run caravansara worker                # booking jobs every minute
```

Settings come from `CARAVANSARA_*` environment variables; see `src/caravansara/core/config.py` and `.env.example`. Never commit real secrets.

| Command | What it does |
| --- | --- |
| `caravansara migrate` | `alembic upgrade head` |
| `caravansara seed` | countries, cities and amenities; skipped if present |
| `caravansara seed-demo` | demo data from `db/seed_demo.sql` |
| `caravansara init-storage [--public-read]` | create the photo bucket |
| `caravansara worker` / `run-jobs` | expire holds and complete stays, in a loop / once |

## Checks

```bash
uv run pytest --cov          # real PostgreSQL + PostGIS and MinIO via testcontainers; needs Docker
uv run ruff check src tests migrations && uv run ruff format --check src tests migrations
uv run mypy                  # strict
uv run lint-imports          # module boundaries
```

CI (`.github/workflows/ci.yml`) runs all of them and builds the image. Coverage must stay at 90% or above.

## Layout

```
src/caravansara/
  core/       settings, database, errors, security, storage
  identity/   users, JWT access + rotating refresh tokens, rate limit
  catalog/    countries, cities, amenities (read-only)
  listings/   listings, public pin, photos, amenities
  bookings/   hold, payment, cancellation, worker queries
  reviews/    reviews and the rating cache
  search/     city or radial search and filter counts
  jobs/       the worker loop
migrations/   Alembic; 0001 is db/schema.sql
tests/
```

Each module has `router`, `service`, `repository`, `models` and `schemas`. A module uses another module only through its `service`, and import-linter enforces that rule.
