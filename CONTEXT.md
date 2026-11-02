# Caravansara: project context

Caravansara (کاروانسرا) is an Airbnb-like place reservation site. It was called "Airbnb-style" until 2026-11-02.

Handoff file for continuing this project in a new session.
To resume: read this file first, then `/Users/zia/Caravansara/db/README.md`.
Last updated: 2026-11-02.

## Goal

Design the **database and ERD only** (no app code yet) for an Airbnb-like place
reservation site. Requirements came from Airbnb screenshots:

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
| Map | **Changed 2026-11-01:** radial search with PostGIS. Real `latitude` / `longitude` stay private; a stored, fuzzed `public_location geography(Point, 4326)` with a GiST index serves search, distance and the pin, so shrinking the radius can't reveal the address. Replaces the earlier "no PostGIS" bounding-box plan. `schema.sql` updated 2026-11-02. See `docs/backend-design.md` |
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

Also applied 2026-11-02: unique `lower(email)`, `DEFERRABLE` photo order, partial index on pending `hold_expires_at`.
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

`/Users/zia/Caravansara/` (a **git repo** since 2026-11-02; commit changes there; `place_reservation_site` was merged into it on 2026-11-02 and deleted)
- `db/README.md`: overview, rules table, how to run
- `db/schema.sql`: PostgreSQL schema (source of truth)
- `db/seed_amenities.sql`: amenity catalog
- `db/search_query.sql`: Where/When/Who + map + multi-amenity search, plus filter counts
- `db/schema.dbml`: paste into dbdiagram.io
- `db/erd.mmd`, `db/erd.png`: Mermaid ERD (full columns)
- `docs/Caravansara Database - Design Overview.md`: overview of the final DB design (updated 2026-11-02, matches the online doc)
- `docs/ERD-demo-fa.html`: the Persian ERD demo deck as one self-contained HTML file (17 slides, Vazirmatn and ERD image embedded; keys: arrows/space to move, `n` speaker notes, `f` fullscreen). Built 2026-11-02 from the online deck's slides; the old `presentation/` folder (.pptx, slide sources, fonts) was removed and is still in git history
- `screenshots/`: the three Airbnb screenshots the requirements came from
- `CONTEXT.md`: this file
- `docs/backend-design.md`: **source of truth** for the backend requirements and design (decided 2026-11-01); diagrams in `docs/images/`
- `docs/backend-design.pdf`: PDF export of that file; regenerate after changes
- `docs/future-work.md`: planned work after the backend: database index review, UI, Playwright tests, microservices

## Online artifacts (claude.ai)

- Design overview doc: https://claude.ai/artifact/Sodin9aFXeXpNtwByq9Eaj
- Persian ERD demo deck (17 slides, Vazirmatn): https://claude.ai/artifact/9aT5rXEGMY6FqEj4XNGukS
  - Persian text is wrapped in U+202B…U+202C (RLE…PDF) because the slide format has no RTL support.
  - Its own PowerPoint export does not keep RTL (the exporter never sets rtlMode). Use `docs/ERD-demo-fa.html` instead; the RTL `.pptx` was removed on 2026-11-02 (recoverable from git history). The deck shows the 10-table design.

## Known gaps / open items

- Done 2026-11-02: schema updated to the backend design, overview doc updated (online + `.md`), PowerPoint deck with RTL.
- Next per `docs/backend-design.md`: implementation step 1 (project skeleton in `Caravansara`, Docker, CI, first Alembic migration from `schema.sql`, seed).

## Working conventions

- Save every project file into `/Users/zia/Caravansara` on Zia's Mac (DB design, backend docs and code all live there).
- Test SQL on a real PostgreSQL before saving; re-render Mermaid and re-parse DBML after schema changes.
- Keep `schema.sql`, `schema.dbml`, `erd.mmd`/`erd.png`, `db/README.md` and the docs in sync.
- Save files only after edits finish (a parallel save once wrote a stale README).
- Zia prefers concise answers with real company examples. Conversation may be in Persian or English.
