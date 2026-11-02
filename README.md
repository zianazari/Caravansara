<p align="center">
  <img src="docs/images/readme/hero.svg" alt="Caravansara: a lit caravansara courtyard at dusk, seen through a pointed arch" width="100%">
</p>

<p align="center">
  <a href="https://github.com/zianazari/Caravansara/actions/workflows/ci.yml"><img src="https://github.com/zianazari/Caravansara/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/python-3.13-b5651d" alt="Python 3.13">
  <img src="https://img.shields.io/badge/FastAPI-modular%20monolith-b5651d" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-16%20%2B%20PostGIS-b5651d" alt="PostgreSQL 16 + PostGIS">
  <img src="https://img.shields.io/badge/tests-124%20%C2%B7%2097.8%25%20coverage-b5651d" alt="124 tests, 97.8% coverage">
</p>

A *caravansara* (کاروانسرا) was a roadside inn on the Silk Road: travellers arrived at dusk, took a room for the night and moved on at dawn. **Caravansara** is the same idea for today: an Airbnb-like site where guests find a place, hold it, pay and leave a review, and hosts list their homes.

This repository holds the **backend and the database design**. There is no frontend yet; everything below is reachable through the API and tried out in **Swagger UI**.

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

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `GET/PATCH /me` |
| Catalog | `GET /countries` · `/cities?q=` · `/amenities` |
| Search | `GET /search/listings` · `/search/filters` |
| Listings | `POST /listings` · `GET/PATCH /listings/{id}` · `GET /me/listings` · `PUT /listings/{id}/amenities` |
| Photos | `POST /listings/{id}/photos/upload-url` · `POST /listings/{id}/photos` · `PATCH/DELETE …/photos/{photo_id}` · `PUT …/photos/order` |
| Bookings | `POST /bookings` · `GET /me/bookings` · `GET /bookings/{id}` · `POST /bookings/{id}/pay` · `/cancel` · `GET /listings/{id}/bookings` |
| Reviews | `POST /bookings/{id}/review` · `GET /listings/{id}/reviews` |

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
