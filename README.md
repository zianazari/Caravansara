<p align="center">
  <img src="docs/images/readme/hero.svg" alt="Caravansara: a lit caravansara courtyard at dusk, seen through a pointed arch" width="100%">
</p>

<p align="center">
  <a href="https://github.com/zianazari/Caravansara/actions/workflows/ci.yml"><img src="https://github.com/zianazari/Caravansara/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/tests-124%20%C2%B7%2097.8%25%20coverage-b5651d" alt="124 tests, 97.8% coverage">
</p>

A *caravansara* (کاروانسرا) was a roadside inn on the Silk Road: travellers arrived at dusk, took a room for the night and moved on at dawn. **Caravansara** is the same idea for today: an Airbnb-like site where guests find a place, hold it, pay and leave a review, and hosts list their homes.

This repository holds the **backend and the database design**. There is no frontend yet; everything below is reachable through the API and tried out in **Swagger UI**.

## Technology

<p align="left">
  <img src="https://skillicons.dev/icons?i=python,fastapi,postgres,docker,githubactions&theme=dark" alt="Python, FastAPI, PostgreSQL, Docker and GitHub Actions" />
  <img src="https://img.shields.io/badge/PostGIS-336791?style=for-the-badge" alt="PostGIS" />
  <img src="https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white" alt="SQLAlchemy" />
  <img src="https://img.shields.io/badge/Pydantic-E92063?style=for-the-badge&logo=pydantic&logoColor=white" alt="Pydantic" />
  <img src="https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=minio&logoColor=white" alt="MinIO" />
  <img src="https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black" alt="Swagger" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JSON Web Tokens" />
  <img src="https://img.shields.io/badge/pytest-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white" alt="pytest" />
  <img src="https://img.shields.io/badge/uv-DE5FE9?style=for-the-badge&logo=uv&logoColor=white" alt="uv" />
  <img src="https://img.shields.io/badge/Ruff-D7FF64?style=for-the-badge&logo=ruff&logoColor=black" alt="Ruff" />
  <img src="https://img.shields.io/badge/mypy-2A6DB2?style=for-the-badge" alt="mypy" />
</p>

| Layer | Tools |
| --- | --- |
| API | Python 3.13, FastAPI, Pydantic v2, Swagger UI and ReDoc |
| Data | PostgreSQL 16 with PostGIS, SQLAlchemy 2 (async) with asyncpg, Alembic |
| Security | argon2 password hashing, JWT access tokens with rotating refresh tokens |
| Files | S3 API with presigned uploads; MinIO in development and tests |
| Quality | pytest with testcontainers, Ruff, mypy (strict), import-linter |
| Delivery | uv, Docker and Docker Compose, GitHub Actions |

## What it does

| | |
| --- | --- |
| 🧭 **Search** | By city, or by centre and radius (1–100 km) on a map. Filters for dates, adults, children, infants, pets and amenities (all must match). |
| ⏳ **Reserve** | A 15-minute hold on the dates, then a simulated payment. Retrying with the same `Idempotency-Key` never books twice. |
| 🛡️ **No double booking** | Two guests can never hold the same night. PostgreSQL enforces it with an `EXCLUDE` constraint, so no race in app code can break it. |
| 📍 **Privacy** | Search and the map use a pin moved 100–500 m from the real address. The exact address appears only after payment. |
| 🏠 **Hosts** | Create and edit listings, upload photos straight to object storage, pick amenities, see bookings. |
| ⭐ **Reviews** | One per completed stay, within 14 days, never edited. The listing's rating updates itself. |
| 🕰️ **City time** | "Today", cancellation and the end of a stay follow the listing's time zone, not the server's. |

<p align="center">
  <img src="docs/images/readme/booking-journey.svg" alt="Booking journey: search, reserve, pay, stay, review" width="100%">
</p>

## How it fits together

One codebase and one database, split into modules with clear borders. The API and the worker run as two processes; photos go from the browser straight to storage.

<p align="center">
  <img src="docs/images/readme/architecture.svg" alt="Architecture: client, API modules, worker, PostgreSQL + PostGIS and MinIO" width="100%">
</p>

Modules talk to each other only through their `service`; [import-linter](https://import-linter.readthedocs.io/) breaks the build if one reaches into another's tables or repository.

### A booking's life

<p align="center">
  <img src="docs/images/readme/booking-states.svg" alt="Booking states: pending, confirmed, expired, cancelled, completed" width="100%">
</p>

`expired` and `cancelled` free the dates; `pending`, `confirmed` and `completed` hold them.

### Two guests, one night

<p align="center">
  <img src="docs/images/readme/double-booking-race.svg" alt="Two guests reserve the same nights at once; one gets 201, the other 409" width="100%">
</p>

A test fires 20 such requests at once and checks that exactly one wins.

### Data model

<p align="center">
  <img src="docs/images/readme/data-model.svg" alt="Data model: 11 tables and their relations" width="100%">
</p>

12 tables. The full schema with every rule is in [`db/schema.sql`](db/schema.sql); the design and its reasons are in [`docs/backend-design.md`](docs/backend-design.md) (Persian).

## Try it

Needs Docker.

```bash
docker compose up --build                               # db, MinIO, migrations, API, worker
docker compose run --rm migrate caravansara seed-demo   # optional: 200 real listings in 4 cities
```

Open **http://localhost:8000/docs**, log in with `POST /auth/login` as `guest@example.com` / `caravansara-demo`, press **Authorize**, paste the `access_token`, and every endpoint is ready to try.

The demo data comes from [Inside Airbnb](https://insideairbnb.com/) (CC BY 4.0): real titles, prices, amenities and review text from Amsterdam, Lisbon, Copenhagen and Stockholm; people, addresses and bookings are synthetic. See [`db/demo/README.md`](db/demo/README.md).

## API at a glance

All paths start with `/api/v1`. Every error has the same shape, with a stable code a client can translate:

```json
{"error": {"code": "dates_unavailable", "message": "These dates were just booked."}}
```

| Area | Method | Endpoint | What it does | Access |
| --- | --- | --- | --- | --- |
| **Auth** | `POST` | `/auth/register` | Create an account and log in | Public |
|  | `POST` | `/auth/login` | Get access and refresh tokens | Public |
|  | `POST` | `/auth/refresh` | Swap a refresh token for a new pair | Refresh token |
|  | `POST` | `/auth/logout` | Revoke a refresh token | Refresh token |
|  | `GET` | `/me` | My profile | User |
|  | `PATCH` | `/me` | Update my profile | User |
| **Catalog** | `GET` | `/countries` | Countries | Public |
|  | `GET` | `/cities?q=` | City autocomplete | Public |
|  | `GET` | `/amenities` | Amenities by category | Public |
| **Search** | `GET` | `/search/listings` | City or radius, dates, guests, amenities | Public |
|  | `GET` | `/search/filters` | Amenity counts for the filter panel | Public |
| **Listings** | `POST` | `/listings` | Create a listing | User |
|  | `GET` | `/me/listings` | My listings | User |
|  | `GET` | `/listings/{id}` | Listing details | Public |
|  | `PATCH` | `/listings/{id}` | Edit or deactivate | Host |
|  | `PUT` | `/listings/{id}/amenities` | Set amenities | Host |
|  | `GET` | `/listings/{id}/bookings` | Bookings of my listing | Host |
| **Photos** | `POST` | `/listings/{id}/photos/upload-url` | Get a presigned upload | Host |
|  | `POST` | `/listings/{id}/photos` | Register an uploaded photo | Host |
|  | `PATCH` | `/listings/{id}/photos/{photo_id}` | Edit caption or room tag | Host |
|  | `DELETE` | `/listings/{id}/photos/{photo_id}` | Delete a photo | Host |
|  | `PUT` | `/listings/{id}/photos/order` | Reorder, pick the cover | Host |
| **Bookings** | `POST` | `/bookings` | Reserve: 15-minute hold (`Idempotency-Key`) | User |
|  | `GET` | `/me/bookings` | My trips | User |
|  | `GET` | `/bookings/{id}` | Booking details | Guest or host |
|  | `POST` | `/bookings/{id}/pay` | Pay (simulated) | Guest |
|  | `POST` | `/bookings/{id}/cancel` | Cancel before the check-in day | Guest or host |
| **Reviews** | `POST` | `/bookings/{id}/review` | Review a completed stay | Guest |
|  | `GET` | `/listings/{id}/reviews` | Reviews of a listing | Public |

## Repository

```
backend/     FastAPI app, Alembic migrations, tests  → backend/README.md
db/          schema, search query, seeds, ERD, demo-data builder
docs/        backend design (fa), database overview, ERD demo deck, future work
             README graphics: docs/images/readme (diagram sources in diagrams/*.mmd, rebuilt by build_diagrams.py)
.github/     CI: ruff, mypy --strict, import-linter, tests, Docker build
```

Tests run against real PostgreSQL + PostGIS and MinIO in containers, because the most important rules live in the database and can't be mocked. Details in [`backend/README.md`](backend/README.md).

## What's next

More and bulkier test data, monitoring (logs, metrics, traces with Prometheus and Grafana), an index review on real load, a web UI with right-to-left Persian, browser tests with Playwright, and splitting out services only if the numbers ask for it. The plan and its order are in [`docs/future-work.md`](docs/future-work.md).
