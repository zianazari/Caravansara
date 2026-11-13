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
| http://localhost:8000/metrics | Prometheus metrics of the API (the worker serves its own on port 9100) |
| http://localhost:3000 | Grafana (`admin` / `caravansara`), with `--profile observability` |

Demo accounts after `seed-demo`: `guest@example.com` and `host@example.com`, password `caravansara-demo`, and the demo admin `admin@example.com` (same password), who logs in with `POST /api/v1/admin/auth/login`.

Compose starts PostgreSQL 16 with PostGIS, MinIO, a one-off `migrate` job (migrations, catalog seed, bucket), the API and the worker.

MinIO stopped publishing Docker images in 2025, so compose and the tests use the last pinned Bitnami build, `bitnamilegacy/minio:2025.4.22`. The code speaks only the S3 API, so moving to S3, R2 or another S3-compatible server only changes settings. The image runs MinIO once in the background for its own setup and then restarts it, and its health check already answers during setup, so the test fixture waits for the `MinIO setup finished` log line before any test runs.

## Develop

Needs [uv](https://docs.astral.sh/uv/) and Docker.

```bash
cd backend
uv sync
docker compose up -d db minio migrate    # services only
uv run caravansara serve --reload        # API on :8000
uv run caravansara worker                # booking jobs every minute
```

Settings come from `CARAVANSARA_*` environment variables; see `src/caravansara/core/config.py` and `.env.example`. Never commit real secrets. Email (feature 013): `CARAVANSARA_SMTP_HOST`, `_SMTP_PORT`, `_SMTP_FROM`, `_SMTP_USERNAME`, `_SMTP_PASSWORD`, `_SMTP_STARTTLS` and `CARAVANSARA_SITE_URL` for the links; without a host, emails wait in the outbox.

| Command | What it does |
| --- | --- |
| `caravansara migrate` | `alembic upgrade head` |
| `caravansara seed` | countries, cities and amenities; skipped if present |
| `caravansara seed-demo` | demo data from `db/seed_demo.sql`; refused when `CARAVANSARA_ENVIRONMENT=production` (its passwords are public) |
| `caravansara init-storage [--public-read]` | create the photo bucket |
| `caravansara worker` / `run-jobs` | expire holds, complete stays and report the listing review queue, in a loop / once |
| `caravansara create-admin --email E --name N` | the only way to make an admin account; password from `CARAVANSARA_ADMIN_PASSWORD` or asked twice, never an argument. Refuses any email that already has an account |
| `caravansara disable-admin --email E` | stop an admin at once (the next request fails); the account and its decisions stay |
| `caravansara export-openapi` | rewrite `openapi.json` after an intended API change |
| `caravansara seed-bulk` | 100,000 listings in their own database `caravansara_bulk`, for measuring (`db/bulk/README.md`) |
| `caravansara measure-queries [--only NAME ...] [--runs N] [--out FILE]` | median plan time of every query in `db/bulk/queries/` on the bulk data; development only, changes nothing |

### Monitoring

| What | Where in the code | Notes |
| --- | --- | --- |
| JSON logs, one line per request | `core/logs.py`, `core/observability.py` | Each line has `request_id`, `trace_id`, route, status and duration. Emails, tokens and secret fields are masked. `CARAVANSARA_LOG_FORMAT=text` for a terminal |
| `X-Request-ID` | `core/observability.py` | Returned on every response; a safe incoming id (from a proxy) is kept |
| Metrics | `core/metrics.py` | Requests, errors and duration per route template; booking events, double bookings stopped (`23P01`), rate limits, reviews; worker runs and last success; emails sent, retried and given up, and the outbox's size and oldest wait |
| Traces | `core/telemetry.py` | OpenTelemetry for FastAPI, SQLAlchemy and S3, sent over OTLP/HTTP when `CARAVANSARA_OTEL_ENDPOINT` is set |

The collector, dashboards and alerts live in [`observability/`](../observability/README.md).

### API contract

Dynamic pricing, the shared holiday calendar, reservation snapshots and their API guarantees are described
in [dynamic-pricing.md](../docs/dynamic-pricing.md). Migration `0012` introduces the supporting data.

[`openapi.json`](openapi.json) is the API contract, committed next to the code. The web site (`frontend/`) builds its typed client from this file with `npm run gen:api`, and its CI job fails when the generated file and this one disagree. `tests/test_openapi_contract.py` fails when the code and the file disagree, so no endpoint, field or error changes by accident. After an intended change, run `uv run caravansara export-openapi` and commit the new file. The contract diff then shows up in the pull request, where it can be reviewed.

Admin lists accept `sort_by` and `order=asc|desc` before `limit`/`offset`, across all matching records.
`GET /admin/users` supports `full_name`, `email`, `kind`, and `created_at` (default descending), alongside `q`.
Names/emails ignore case; roles order member then admin. `GET /admin/bookings` supports `id` (default descending),
`listing`, `guest`, `dates`, `total_price`, `status`, and `created_at`, alongside `status`.
Dates compare check-in then check-out; guests compare name then email; totals compare currency then numeric amount
without currency conversion. Status follows pending, confirmed, completed, cancelled, expired.
ID breaks ties in the chosen direction. Invalid columns/orders return 422. Sorted bookings still omit exact addresses.
The saved Postman admin requests include these parameters.

`GET /admin/listings/pending` defaults to newest submissions (`sort_by=submitted_at`, `order=desc`).
It also supports `title`, `city` (catalog name), and `host` (full name), in either direction before pagination,
with case-insensitive text ordering and ID breaking ties. Legacy `sort=oldest|newest` is still accepted;
an explicit `order` takes precedence. Approved/rejected listings and private addresses are excluded.

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
  identity/   users, JWT access + rotating refresh tokens, rate limit, profile pictures (PNG or JPEG up to 5 MB,
              checked again by size and first bytes; specs/005-frontend-guest)
  catalog/    countries, cities, amenities; shared holiday calendar
  listings/   listings, public pin, photos, amenities, per-listing pricing policies
  bookings/   hold, payment, cancellation, saved daily prices, worker queries
  reviews/    reviews and the rating cache
  search/     city or radial search and filter counts
  jobs/       the worker loop
migrations/   Alembic; 0001 is db/schema.sql, 0002 widens the price columns for rials, 0003 adds pg_stat_statements,
              0004/0005 and 0011 add measured indexes; 0012 adds dynamic prices and holidays
tests/
```

Each module has `router`, `service`, `repository`, `models` and `schemas`. A module uses another module only through its `service`, and import-linter enforces that rule.
