# Caravansara: project context

Caravansara (کاروانسرا) is an Airbnb-like place reservation site. It was called "Airbnb-style" until 2026-11-02.

Handoff file for continuing this project in a new session.
To resume: read this file first, then `/Users/zia/Caravansara/db/README.md`.
Last updated: 2026-11-02.

## Goal

An Airbnb-like place reservation site. The database design and the FastAPI
backend v1 (`backend/`) are done. Requirements came from Airbnb screenshots:

- Search by **Where** (country → city), **When** (check-in/out), **Who**
  (adults, children, infants, pets). Infants don't count toward max guests.
- Listings shown on a **map**.
- Each listing has **photos**, **amenities** (Wifi, Kitchen, Microwave …),
  a **star rating** and **reviews**.
- **Two users must never be able to book the same place for overlapping nights.**

## Decisions made

| Topic | Decision |
| --- | --- |
| "Rank" | Star rating 1–5 plus six sub-ratings, cached on the listing (`avg_rating`, `review_count`) |
| "Comments" | Review text only: no host replies, no guest-host messaging |
| Scope | Simple: no payments, wishlists, messages, destinations, calendar table |
| Database | PostgreSQL 13+ (tested on 16) |
| Table name | Keep `listings` (it's the offer/ad, Airbnb's own term), not `places` |
| Map | Radial search with PostGIS. Real `latitude` / `longitude` stay private; a stored, fuzzed `public_location geography(Point, 4326)` with a GiST index serves search, distance and the pin, so shrinking the radius can't reveal the address. See `docs/backend-design.md` |
| Photos | Files in object storage (S3/R2/GCS) behind a CDN; DB stores `storage_key`, `width`, `height`, `sort_order` (0 = cover), `room_tag` |
| Amenity icons | `amenities.icon` holds a key like `wifi`; the frontend maps it to an icon. Making it NOT NULL was offered and **declined: leave as is** |
| Pets | Not an amenity: `listings.pets_allowed` / `max_pets` |
| Double booking | `EXCLUDE USING gist (listing_id WITH =, stay WITH &&)` on active bookings; half-open `[check_in, check_out)` |
| Left to the app | Guest count ≤ `max_guests`; a job expiring unpaid `pending` holds; fuzzing the map pin |

## Schema (12 tables, 4 modules; updated 2026-11-02)

- **Identity:** `users`, `refresh_tokens` (new), `auth_attempts` (new)
- **Catalog:** `countries`, `cities` (+ `timezone`), `amenity_categories`, `amenities`
- **Listings:** `listings` (+ `public_location` PostGIS), `listing_photos`, `listing_amenities`
- **Bookings & reviews:** `bookings`, `reviews`

Also in the schema: unique `lower(email)`, `DEFERRABLE` photo order, partial index on pending `hold_expires_at`.
`search_query.sql` does city or radial search and returns only the public pin. All tested on PostgreSQL 16 + PostGIS 3.4.

Rules enforced by the database (tested):

- No overlapping active bookings per listing: 20 concurrent requests gave exactly 1 booking.
- Same-day turnover is allowed, and cancelling a booking frees its dates.
- `bookings.idempotency_key` is UNIQUE, so a retried "Reserve" can't double-book.
- A review needs a `completed` booking (trigger), at most one review per booking.
- A composite FK makes the review's listing and guest match its booking.
- A trigger keeps `avg_rating` and `review_count` in sync.
- `CHECK (pets_allowed OR max_pets = 0)`.

Amenity seed: 12 categories, 31 amenities. Search uses AND logic for amenity filters.

## Files (on Zia's Mac)

`/Users/zia/Caravansara/` (a **git repo**; commit changes there)
- `db/README.md`: overview, rules table, how to run
- `db/schema.sql`: PostgreSQL schema (source of truth)
- `db/seed_amenities.sql`: amenity catalog
- `db/seed_locations.sql`: countries and cities (NL, PT, DK, SE; with timezones)
- `db/seed_demo.sql`: demo data generated on 2026-11-02 from Inside Airbnb (CC BY 4.0) by `db/demo/build_demo_seed.py`; see `db/demo/README.md`. Raw downloads live in the git-ignored `.cache/insideairbnb/`
- `db/search_query.sql`: Where/When/Who + map + multi-amenity search, plus filter counts
- `db/schema.dbml`: paste into dbdiagram.io
- `db/erd.mmd`, `db/erd.png`: Mermaid ERD (full columns)
- `docs/Caravansara Database - Design Overview.md`: overview of the final DB design (matches the online doc)
- `docs/ERD-demo-fa.html`: the Persian ERD demo deck as one self-contained HTML file (17 slides; keys: arrows/space to move, `n` speaker notes, `f` fullscreen). Use it instead of a PowerPoint export, which loses RTL
- `screenshots/`: the three Airbnb screenshots the requirements came from
- `CONTEXT.md`: this file
- `docs/backend-design.md`: **source of truth** for the backend requirements and design (decided 2026-11-01); diagrams in `docs/images/`
- `docs/backend-design.pdf`: PDF export of that file; regenerate after changes
- `docs/future-work.md`: planned work: more test and mock data, monitoring (logs, metrics, traces; Prometheus, Grafana), then database index review, UI, Playwright tests, microservices. It lists only unstarted work; finished work goes into the design docs
- `backend/`: FastAPI app, Alembic migrations, tests; how to run in `backend/README.md`. Swagger UI at `/docs` (a requirement); the API contract is `backend/openapi.json`, checked by a test, rewritten with `caravansara export-openapi`
- `docker-compose.yml`: db, MinIO (`bitnamilegacy/minio:2025.4.22`, since MinIO stopped publishing images), migrate, API, worker
- `.github/workflows/ci.yml`: ruff, mypy, import-linter, tests (coverage ≥ 90%), Docker build

## Online artifacts (claude.ai)

- Design overview doc: https://claude.ai/artifact/Sodin9aFXeXpNtwByq9Eaj
- Persian ERD demo deck (17 slides, Vazirmatn): https://claude.ai/artifact/9aT5rXEGMY6FqEj4XNGukS
  - Persian text is wrapped in U+202B…U+202C (RLE…PDF) because the slide format has no RTL support. It shows the older 10-table design; `docs/ERD-demo-fa.html` is the maintained copy.

## Status and next step

- Done: database design, backend design, demo data, backend v1 (all 8 steps of `docs/backend-design.md`; 124 tests, 97.8% coverage) and the backend test gaps (recorded in the test strategy of `docs/backend-design.md`; now 142 tests, 98.3% coverage).
- Next: section 1 of `docs/future-work.md` (more test and mock data). Finished work is recorded in `docs/backend-design.md` (test strategy, implementation steps), not in future work.

## Working conventions

- Save every project file into `/Users/zia/Caravansara` on Zia's Mac (DB design, backend docs and code all live there).
- Test SQL on a real PostgreSQL before saving; re-render Mermaid and re-parse DBML after schema changes.
- Keep `schema.sql`, `schema.dbml`, `erd.mmd`/`erd.png`, `db/README.md` and the docs in sync.
- Save files only after edits finish, and re-read files before editing: other sessions may work on the repo at the same time.
- Zia prefers concise answers with real company examples. Conversation may be in Persian or English.
