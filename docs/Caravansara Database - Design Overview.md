# Caravansara Database: Design Overview

Nov 2, 2026 · Zia · Online version: https://claude.ai/artifact/Sodin9aFXeXpNtwByq9Eaj

Final database design as of November 2, 2026: 12 tables in four modules on PostgreSQL 16 with PostGIS, matching `db/schema.sql`. The backend design (`Caravansara/docs/backend-design.md`) is the source of truth for APIs and service rules; this page summarises the database.

## Domain map

| Module | Tables | Role |
| --- | --- | --- |
| Identity | `users`, `refresh_tokens` (new), `auth_attempts` (new) | Accounts, sign-in, rate limiting |
| Catalog | `countries`, `cities`, `amenity_categories`, `amenities` | Destinations and the amenity list |
| Listings | `listings`, `listing_photos`, `listing_amenities` | The place, its photos and features |
| Bookings & reviews | `bookings`, `reviews` | The no-overlap rule, stars and comments |

The modules match the backend: identity, catalog, listings, and bookings with reviews. `refresh_tokens` and `auth_attempts` were added on November 2 for sign-in and rate limiting.

## From the screenshots to the schema

### Search: Where / When / Who

- **Where** is either a city (`countries` → `cities`, for autocomplete) or a centre point plus a radius of 1–100 km.
- **When** is a check-in/check-out pair. The "±1/2/3/7/14 days" flexible option only widens the query, so it needs no table. "Today" is computed in the city's own time zone (`cities.timezone`).
- **Who** has four counters: adults, children, infants, pets. The booking stores all four.
  - Adults + children must fit within `max_guests`; infants don't count.
  - Pets need `pets_allowed` and must stay within `max_pets`.

### Map and privacy

Each listing keeps two points:

- the real `latitude` / `longitude`, shown only to the host and to guests with a confirmed or completed booking;
- `public_location`, a PostGIS `geography(Point, 4326)` moved about 100–500 m at random when the listing is created and stored once.

Search (`ST_DWithin` with a GiST index), `distance_km` and the map pin use only the public point, so shrinking the radius or averaging many requests can't reveal the address. Airbnb does the same: it shows an approximate area until a booking is confirmed.

### Listing

- Type: entire place, private room, or shared room.
- Size: bedrooms, beds, baths; check-in and check-out times; price per night and cleaning fee.
- A listing is never deleted, only deactivated with `is_active`, so past bookings stay intact.

### Photos

The files live in object storage (MinIO in development, S3 or R2 in production) behind a CDN. `listing_photos` keeps only the `storage_key`, `width`, `height`, an optional `room_tag` and `sort_order` (0 = cover). Reordering or swapping the cover works in one transaction, because the order constraint is checked at commit.

### Amenities

A catalog instead of yes/no columns: 12 categories and 31 amenities, linked to listings through `listing_amenities`. Adding "microwave" is a new row, not a migration. `amenities.icon` holds a key like `wifi` that the frontend maps to an icon. Pets are a listing column, not an amenity.

## No double booking

The database itself is the guarantee, because two requests can pass a "still free" check at the same moment and application code on several servers can't see each other.

- **`EXCLUDE USING gist (listing_id WITH =, stay WITH &&)`** on bookings that are `pending`, `confirmed` or `completed`. Two overlapping active rows cannot exist; the second insert fails with `23P01`, which the API returns as 409 `dates_unavailable`.
- **Half-open ranges** `[check_in, check_out)`: a guest can arrive the day the previous one leaves. `cancelled` and `expired` bookings free the dates.
- **15-minute hold:** a booking starts as `pending` with `hold_expires_at`. Simulated payment confirms it with a conditional `UPDATE`, so a payment and an expiry arriving together can't both win. A worker expires overdue holds every minute (using a partial index on pending holds), and the booking transaction also expires stale holds on the same listing.
- **Idempotency:** each booking request carries an `Idempotency-Key`, stored as a UNIQUE `idempotency_key`. A retried request returns the same booking instead of creating a second one.

A real example: Airbnb's engineering team wrote in 2019 about building an idempotency library called *Orpheus* after network retries caused double payments.

Tested on PostgreSQL 16: 20 simultaneous requests for the same nights produced exactly one booking.

## Reviews and rank

- "Rank" is the star rating: an overall 1–5 score plus six sub-ratings (cleanliness, accuracy, check-in, communication, location, value).
- A review needs a **completed** booking (trigger), and each booking gets at most one review (`UNIQUE (booking_id)`).
- A composite foreign key makes the review's listing and guest match its booking, which blocks most fake reviews.
- Only the guest reviews the place; there are no host replies and no host-reviews-guest.
- A review must be written within 14 days of check-out and can't be edited or deleted (service rules).
- `avg_rating` and `review_count` are cached on the listing (the "4.76 (279)" on the card) and kept current by a trigger.

## Decisions

| Topic | Decision |
| --- | --- |
| Rank | Star rating 1–5 plus six sub-ratings, cached on the listing |
| Comments | Review text only; no host replies, no guest–host messaging |
| Scope | Simple: no wishlists, messages, host date blocking or per-night prices; payment is simulated |
| Database | PostgreSQL 16 with PostGIS |
| Table name | `listings` (the offer, Airbnb's own term), not `places` |
| Map | Radial search on a fuzzed `public_location`; real coordinates stay private |
| Photos | Object storage behind a CDN; the row keeps `storage_key`, `width`, `height` |
| Amenity icons | A key in `amenities.icon` mapped by the frontend; left nullable by choice |
| Pets | `pets_allowed` / `max_pets` on the listing, not an amenity |
| Sign-in | JWT with refresh-token rotation (`refresh_tokens`); login and registration rate-limited (`auth_attempts`) |
| Email | Unique regardless of letter case |
| Time | `cities.timezone` decides "today" and when a stay ends |
| Double booking | `EXCLUDE` on active bookings, a 15-minute hold, and an idempotency key |

## ERD

Twelve tables. `listings` is the hub with five relationships; `bookings` carries the no-overlap constraint and `reviews` hangs off a completed booking.

```mermaid
erDiagram
    USERS ||--o{ LISTINGS : "hosts"
    USERS ||--o{ BOOKINGS : "books"
    USERS ||--o{ REFRESH_TOKENS : "signs in with"
    COUNTRIES ||--o{ CITIES : "has"
    CITIES ||--o{ LISTINGS : "located in"
    LISTINGS ||--o{ LISTING_PHOTOS : "has"
    LISTINGS ||--o{ LISTING_AMENITIES : "offers"
    AMENITIES ||--o{ LISTING_AMENITIES : "offered by"
    AMENITY_CATEGORIES ||--o{ AMENITIES : "groups"
    LISTINGS ||--o{ BOOKINGS : "reserved by"
    BOOKINGS ||--o| REVIEWS : "reviewed in"
    USERS { bigint id PK
        text email UK
        text full_name }
    REFRESH_TOKENS { bigint id PK
        bigint user_id FK
        text token_hash UK
        timestamptz expires_at
        timestamptz revoked_at }
    AUTH_ATTEMPTS { bigint id PK
        text action
        text identifier
        timestamptz attempted_at }
    COUNTRIES { smallint id PK
        char code UK }
    CITIES { int id PK
        smallint country_id FK
        text name
        text timezone }
    LISTINGS { bigint id PK
        bigint host_id FK
        int city_id FK
        numeric latitude
        numeric longitude
        geography public_location
        smallint max_guests
        boolean pets_allowed
        numeric price_per_night
        numeric avg_rating }
    LISTING_PHOTOS { bigint id PK
        bigint listing_id FK
        text storage_key UK
        int width
        int height
        smallint sort_order }
    AMENITY_CATEGORIES { smallint id PK
        text name UK }
    AMENITIES { smallint id PK
        smallint category_id FK
        text name UK }
    LISTING_AMENITIES { bigint listing_id PK
        smallint amenity_id PK }
    BOOKINGS { bigint id PK
        bigint listing_id FK
        bigint guest_id FK
        daterange stay
        booking_status status
        timestamptz hold_expires_at
        uuid idempotency_key UK }
    REVIEWS { bigint id PK
        bigint booking_id FK
        smallint rating
        text comment }
```

The full column list is in `db/erd.mmd`, `db/schema.sql` and `db/schema.dbml` in `Caravansara`.

## What the database guarantees

All tested on PostgreSQL 16 with PostGIS 3.4.

| Rule | How |
| --- | --- |
| Two guests can't book the same nights | `EXCLUDE USING gist (listing_id WITH =, stay WITH &&)`; 20 simultaneous requests gave exactly 1 booking |
| Same-day turnover allowed | `stay` is half-open `[check_in, check_out)` |
| Cancelled or expired bookings free the dates | Constraint only covers pending, confirmed, completed |
| Retried "Reserve" can't double-book | `UNIQUE (idempotency_key)` |
| Only a completed stay is reviewed, once | Trigger + `UNIQUE (booking_id)` |
| Review matches its booking's guest and listing | Composite FK `(booking_id, listing_id, guest_id)` |
| Rank stays current | Trigger refreshes `avg_rating` and `review_count` |
| One account per email, any letter case | Unique index on `lower(email)` |
| Photo order can be rearranged safely | `(listing_id, sort_order)` unique, checked at commit |
| Radial search is fast and works across the 180° meridian | GiST index on `public_location`, `ST_DWithin` |

**Left to the service layer:** guest count and pets within capacity, a host can't book their own listing, radius 1–100 km, the booking state machine, payment and expiry as conditional updates, cancellation only before the check-in day, the 14-day review window, and showing the exact address only after a confirmed booking.

## Out of scope

- Real payments and refunds (payment is simulated)
- Wishlists, guest–host messages and host replies to reviews
- Host date blocking and different prices per night
- Changing booking dates (cancel and rebook instead), currency conversion, and an admin panel (catalogs change only through seed data)

## Files

- `Caravansara/db/`: `schema.sql`, `seed_amenities.sql`, `search_query.sql`, `schema.dbml` (for dbdiagram.io), `erd.mmd` and `erd.png`, and a README
- `Caravansara/docs/backend-design.md`: backend requirements, API and service rules (source of truth)
- `Caravansara/docs/future-work.md`: backend implementation, index review, UI, Playwright tests, microservices
