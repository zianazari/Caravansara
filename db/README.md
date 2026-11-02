# Place Reservation Site: ERD

Decisions (Oct 30, 2026): **rank** = star rating · **comments** = review text only · **scope** = simple (no payments, wishlists, messages).

![ERD](erd.png)

## Files

| File | What it is |
| --- | --- |
| `schema.sql` | PostgreSQL 13+ schema: 10 tables, the no-double-booking constraint, review triggers |
| `seed_amenities.sql` | 12 amenity categories and 31 amenities (Wifi, Kitchen, Microwave …) |
| `search_query.sql` | Where + When + Who search with map bounds and multi-amenity filter (must have ALL), plus filter-panel counts |
| `schema.dbml` | Paste into [dbdiagram.io](https://dbdiagram.io) |
| `erd.mmd` | Mermaid source (also below; GitHub and VS Code render it) |

## Rules the database enforces (all tested on PostgreSQL 16)

| Rule | How |
| --- | --- |
| Two guests can't book the same nights | `EXCLUDE USING gist (listing_id WITH =, stay WITH &&)` on active bookings; 20 simultaneous requests → exactly 1 booking |
| Same-day turnover is allowed | `stay` is half-open `[check_in, check_out)` |
| Cancelled bookings free the dates | constraint only covers `pending`, `confirmed`, `completed` |
| A retried "Reserve" click can't double-book | `UNIQUE (idempotency_key)` |
| Only a completed stay can be reviewed, once | trigger + `UNIQUE (booking_id)` |
| A review's listing and guest match its booking | composite FK `(booking_id, listing_id, guest_id)` |
| No pets on a no-pets listing | `CHECK (pets_allowed OR max_pets = 0)` |
| Rank stays current | trigger refreshes `listings.avg_rating` and `review_count` |

Left to the app: guest count ≤ `max_guests`, expiring unpaid `pending` holds (a job sets them to `expired`), fuzzing the map pin.

## Photos

Image files live in object storage (S3, R2 or GCS) and are served through a CDN. `listing_photos` stores only the `storage_key` (e.g. `listings/42/7f3a.jpg`) plus `width` and `height`. The app builds the URL, e.g. `https://cdn.example.com/listings/42/7f3a.jpg?w=720`, so a CDN or domain change needs no database update. Uploads go browser → presigned URL → storage, then the API inserts the row.

## Run it

```bash
createdb airbnb
psql -d airbnb -f schema.sql -f seed_amenities.sql
psql -d airbnb -f search_query.sql
```

## Mermaid source

```mermaid
erDiagram
    USERS ||--o{ LISTINGS : "hosts"
    USERS ||--o{ BOOKINGS : "books"
    COUNTRIES ||--o{ CITIES : "has"
    CITIES ||--o{ LISTINGS : "located in"
    LISTINGS ||--o{ LISTING_PHOTOS : "has"
    LISTINGS ||--o{ LISTING_AMENITIES : "offers"
    AMENITIES ||--o{ LISTING_AMENITIES : "offered by"
    AMENITY_CATEGORIES ||--o{ AMENITIES : "groups"
    LISTINGS ||--o{ BOOKINGS : "reserved by"
    BOOKINGS ||--o| REVIEWS : "reviewed in"

    USERS {
        bigint id PK
        text email UK
        text password_hash
        text full_name
        text avatar_url
        timestamptz created_at
    }
    COUNTRIES {
        smallint id PK
        char code UK "ISO, e.g. FI"
        text name UK
    }
    CITIES {
        int id PK
        smallint country_id FK
        text name "unique per country"
    }
    LISTINGS {
        bigint id PK
        bigint host_id FK
        text title
        text description
        property_type property_type "entire_place | private_room | shared_room"
        int city_id FK
        text neighborhood "e.g. Pasila"
        text address "shown after booking"
        numeric latitude "map"
        numeric longitude "map"
        smallint max_guests "adults + children"
        boolean pets_allowed
        smallint max_pets
        smallint bedrooms
        smallint beds
        numeric bathrooms
        numeric price_per_night
        numeric cleaning_fee
        char currency
        time check_in_time
        time check_out_time
        numeric avg_rating "rank, cached"
        int review_count
        boolean is_active
        timestamptz created_at
    }
    LISTING_PHOTOS {
        bigint id PK
        bigint listing_id FK
        text storage_key UK "listings/42/7f3a.jpg"
        int width
        int height
        text caption
        text room_tag "Kitchen, Bedroom 1"
        smallint sort_order "0 = cover"
    }
    AMENITY_CATEGORIES {
        smallint id PK
        text name UK "Kitchen and dining"
        smallint sort_order
    }
    AMENITIES {
        smallint id PK
        smallint category_id FK
        text name UK "Wifi, Microwave"
        text icon
    }
    LISTING_AMENITIES {
        bigint listing_id PK, FK
        smallint amenity_id PK, FK
    }
    BOOKINGS {
        bigint id PK
        bigint listing_id FK
        bigint guest_id FK
        date check_in
        date check_out
        daterange stay "no overlap per listing"
        smallint adults
        smallint children
        smallint infants
        smallint pets
        numeric nightly_price "snapshot"
        numeric cleaning_fee
        numeric total_price
        char currency
        booking_status status "pending | confirmed | cancelled | expired | completed"
        timestamptz hold_expires_at
        uuid idempotency_key UK
        timestamptz created_at
    }
    REVIEWS {
        bigint id PK
        bigint booking_id FK, UK "one per completed booking"
        bigint listing_id FK
        bigint guest_id FK
        smallint rating "1-5 stars"
        smallint cleanliness_rating
        smallint accuracy_rating
        smallint check_in_rating
        smallint communication_rating
        smallint location_rating
        smallint value_rating
        text comment
        timestamptz created_at
    }
```
