# Airbnb-style Database: Design Overview

Oct 30, 2026 · Zia · Online version: https://claude.ai/artifact/Sodin9aFXeXpNtwByq9Eaj

## Domain map

| Group | Domain | What it holds |
| --- | --- | --- |
| Core (asked for) | Users and hosts | Guests, hosts, profiles |
| Core (asked for) | Location | Country, city, lat/lng point |
| Core (asked for) | Listings | The core entity |
| Core (asked for) | Photos | Ordered, tagged by room |
| Core (asked for) | Amenities | Kitchen, wifi, microwave |
| Core (asked for) | Reviews and ratings | Scores, comments, replies |
| Concurrency-critical | Calendar and pricing | Per-night availability |
| Concurrency-critical | Bookings | No-overlap guarantee |
| Extra (proposed) | Destinations | Featured cities, taglines |
| Extra (proposed) | Wishlists | The heart icon |
| Extra (proposed) | Messages | Guest and host chat |
| Extra (proposed) | Payments | Charges, refunds, payouts |

The schema splits into 12 domains: six core areas you asked for, two concurrency-critical ones (calendar and bookings), and four extras I'm proposing.

## What the screenshots imply

### Search: Where / When / Who

- **Where** needs a location hierarchy (country → city → neighborhood, e.g. Finland → Helsinki → Pasila) for autocomplete, plus a lat/lng point per listing for the map view.
- **When** is a check-in/check-out pair. The "±1/2/3/7/14 days" flexible option is a query-time widening of the range, so it needs no table.
- **Who** has four separate counters: adults, children, infants, pets. These rules go in the schema:
  - Adults + children must fit within `max_guests`. Infants don't count toward that limit.
  - Pets require `pets_allowed` to be true and the count to stay within `max_pets`.
  - The booking stores all four counts.

### Map

Store each listing's location as a PostGIS `geography(Point)` with a GiST index, so a query like "listings inside this map rectangle" is fast. Keep two coordinates:

- the exact address, revealed only after booking
- a fuzzed point for the public map

Airbnb does the same thing: it shows an approximate circle until a booking is confirmed.

### Listing

- Type: entire place, private room, or shared room.
- Size: bedrooms, beds, baths.
- Check-in and check-out times, house rules, cancellation policy.
- "Superhost" and "Guest favorite" badges. These are derived from data, not typed in by hand.

### Photos

One listing has many ordered photos. Each photo can carry an optional room tag ("Kitchen", "Bedroom 1"), which is how Airbnb builds its photo tour.

### Amenities

Use a catalog table, not boolean columns. Airbnb has roughly 15 categories (Kitchen & dining, Internet & office, Bathroom, Safety, Parking, and so on) with well over 100 items. A many-to-many link from listing to amenity lets you add "microwave" later without a migration. Keep a "Not included" flag on the link: Airbnb explicitly shows missing items such as "No smoke alarm".

## The critical part: no double booking

This is the requirement where the database itself must be the guarantee. Application code alone isn't enough, because two requests can pass a "not taken" check at the same moment.

- **Option A (recommended, PostgreSQL):** an `EXCLUDE USING gist (listing_id WITH =, stay WITH &&)` constraint on a `daterange` column. It only applies to active bookings (pending or confirmed). Two overlapping rows physically cannot exist; the second insert fails.
- **Option B (works on any database):** a `booked_nights` table with `UNIQUE(listing_id, night)`, holding one row per night.
- Use half-open ranges `[check_in, check_out)`, so a guest can check in on the same day the previous guest checks out.
- Add a **pending hold with an expiry** (about 15 minutes) while the guest pays, so the dates are reserved during checkout.

A real example: Airbnb's engineering team wrote in 2019 about building an idempotency layer called *Orpheus* after network retries caused double payments. The lesson carries over here: give each booking request an `idempotency_key` so a retried "Reserve" click can't create two bookings or two charges.

## Reviews, rank and comments

- A review must link to a **completed booking**, one per direction: guest reviews the place, host reviews the guest. That rule alone blocks most fake reviews.
- Store an overall star rating plus Airbnb's six sub-ratings: cleanliness, accuracy, check-in, communication, location, value.
- Reviews are **double-blind**. Since 2014, Airbnb has hidden both reviews until both sides submit or 14 days pass. This needs a `published_at` column.
- The host can post one public response per review.
- Keep `avg_rating` and `review_count` cached on the listing (the "4.76 (279)" in the screenshot), refreshed by a trigger or a background job.

## Extras to add

- **Calendar:** per-night price overrides and host-blocked dates. This also covers the discount in the screenshot (€84 crossed out, €69 shown).
- **Price snapshot on the booking:** the nightly rate, fees, and total at the moment of booking, because listing prices change later.
- **Wishlists:** for the heart icon.
- **Messages:** guest-to-host chat.
- **Payments:** basic charges, refunds, and payouts.

## Decisions

| Question | Answer |
| --- | --- |
| "Rank" | Star rating (1–5 plus six sub-ratings), cached on the listing |
| "Users' comments" | Review text only; no host replies, no messaging |
| Scope | Simple: no payments, wishlists, messages or destinations |

The ERD, PostgreSQL schema and dbdiagram.io code are in `../db/` (start with `db/README.md`).
