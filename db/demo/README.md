# Demo data

`db/seed_demo.sql` is demo data for development, demos and manual testing. Search, the map, prices, amenities, photos and reviews look real, and every edge case of the booking rules is there once, with its id.

It is generated: do not edit it by hand. Bulk data for measuring performance is separate, see [`../bulk/README.md`](../bulk/README.md).

## Source and license

[Inside Airbnb](https://insideairbnb.com/get-the-data/) publishes snapshots of public Airbnb listings under **CC BY 4.0**. Any public use must credit Inside Airbnb. We use it instead of scraping airbnb.com, because Airbnb's terms forbid scraping and its site blocks bots.

| City | Country | Currency | Time zone | Source | Listings |
| --- | --- | --- | --- | --- | --- |
| Amsterdam | NL | EUR | Europe/Amsterdam | Inside Airbnb, 2026-09-16 | 125 |
| Lisbon | PT | EUR | Europe/Lisbon | Inside Airbnb, 2026-09-19 | 125 |
| Copenhagen | DK | DKK | Europe/Copenhagen | Inside Airbnb, 2026-09-25 | 125 |
| Stockholm | SE | SEK | Europe/Stockholm | Inside Airbnb, 2026-09-25 | 125 |
| London | GB | GBP | Europe/London | Inside Airbnb, 2026-09-17 | 125 |
| New York City | US | USD | America/New_York | Inside Airbnb, 2026-09-14 | 125 |
| Tehran | IR | IRR | Asia/Tehran | hand-written (`fa_listings.json`) | 20 |
| Isfahan | IR | IRR | Asia/Tehran | hand-written | 14 |
| Shiraz | IR | IRR | Asia/Tehran | hand-written | 16 |

New York is the only city behind UTC, and Tehran is UTC+3:30. Together they catch mistakes with "today in the listing's city".

## What is real and what is synthetic

| Real (from the snapshot) | Synthetic (generated) |
| --- | --- |
| Title, description, neighbourhood | All people: names, emails (`@example.com`) |
| Coordinates (Airbnb already blurs them by about 150 m) | Address (`12 Demo Street, …`) |
| Room type, max guests, bedrooms, beds, bathrooms | `public_location`: the real point moved 100–500 m |
| Nightly price in local currency | Cleaning fee (0, or 10–35 % of the nightly price) |
| Amenities, mapped to our 31-item catalog | Each review's stars, sampled around the listing's real averages |
| Pets allowed (from the "Pets allowed" amenity) | Bookings: dates, guests, party size |
| Review date and text (English only, up to 15 latest per listing) | Photos: drawn images, one per room type |

The Persian listings in Iran are written for this project in `fa_listings.json`: titles, descriptions, neighbourhoods and reviews. Inside Airbnb has no Persian text, and the right-to-left UI needs real Persian. Their texts mix Persian with digits and Latin words, use the zero-width non-joiner, and include one description over 1,000 characters and reviews under 20 characters. Prices are in rials (IRR), at today's market level: whole places 18 to 100 million a night (Tehran from 22.5 million), rooms 5 to 10 million. They follow Jabama's Tehran listings on 2026-11-05 (one toman is ten rials).

**Privacy.** Real host and reviewer names are dropped. A host's name in a review or description is replaced by the fake host's first name. A review that still names a real host or reviewer is skipped. The build stops before writing the file if any real name is left in a review. The real names are not in the repo, so CI cannot check them; this build step does instead.

**Rial amounts.** The price columns are `NUMERIC(14,2)` (migration `0002`, [specs/backend (002)](../../specs/backend/)), and the API accepts at most 1,000,000,000 a night. Persian stays are 1–14 nights like the rest of the demo, so the largest rial total (1,407,500,000) is far above the old limit of 99,999,999.99. The build stops if a price or a total would not fit.

## Contents

- 800 listings: 569 entire places, 220 private rooms, 11 shared rooms
- 2,054 users: 769 hosts, the guests, the two demo accounts and the demo admin
- 797 public listings: all 800 are approved except the two review edge cases below, and one more is inactive
- 10,783 bookings: 9,548 completed (one behind each review, plus a few edge cases), 1,062 confirmed, 171 cancelled, 1 pending and 1 expired
- 9,546 reviews; the trigger fills `avg_rating` and `review_count` (city averages 4.40–4.73)
- 4,608 photos, 3–8 per listing

Upcoming bookings are relative to the day you load the file, in the listing city's time zone (`(now() AT TIME ZONE 'Europe/Amsterdam')::date + 20`), so they stay in the future. Past bookings behind reviews use fixed dates.

## Demo accounts

Every account's password is `caravansara-demo`. The hash is argon2id.

| Email | Role |
| --- | --- |
| `host@example.com` | Sara Lindqvist, host of listings 1–3 (Amsterdam) |
| `guest@example.com` | Omar Haddad: a finished stay (ended 3 days before load, can still be reviewed), 2 upcoming stays, a hold that expires 4 minutes after loading, and an expired hold |
| `admin@example.com` | Ava Moradi, admin: log in with `POST /api/v1/admin/auth/login` (not `/auth/login`), then review `pending_listing` |

**Development only.** `caravansara seed-demo` refuses to run when `CARAVANSARA_ENVIRONMENT=production` (`refused: demo data is for development only`). Every demo password is written above, and one of the accounts is an admin who can approve listings; on a real server, admins are made one by one with `caravansara create-admin` (specs/backend (004), research R15).

**Listing review.** A new listing waits for an admin (specs/backend (004)). The column default is therefore `pending`, so `seed_demo.sql` approves every listing explicitly and then makes the two review edge cases: `pending_listing` (in the queue) and `rejected_listing` (with a Persian reason the host sees in `GET /me/listings`, and a history row by the demo admin).

Any other host can log in too: find their email with `SELECT email FROM users u JOIN listings l ON l.host_id = u.id WHERE l.id = …`.

## Edge cases

Each rule from the design document has one known record. The ids below are written by `build_demo_seed.py` (also in `edge_cases.json`); do not edit the table by hand.

<!-- edge-cases:start -->
| Case | What | Listing | Bookings | Where to see it |
| --- | --- | --- | --- | --- |
| `hold_about_to_expire` | Pending hold of the demo guest, 4 minutes left at load time | 7 (Amsterdam) | 10607 | `GET /me/bookings` as `guest@example.com` |
| `expired_hold` | Expired hold of the demo guest | 8 (Amsterdam) | 10608 | `GET /me/bookings` as `guest@example.com` |
| `year_long_stay` | Confirmed stay of exactly 365 nights | 126 (Lisbon) | 10609 | `GET /listings/{id}/bookings` as its host |
| `last_bookable_day` | Check-in on the last bookable day (city today + 365) | 376 (Stockholm) | 10610 | `GET /listings/{id}/bookings` as its host |
| `same_day_turnover` | Two confirmed stays: one checks out the day the next checks in | 251 (Copenhagen) | 10611, 10612 | `GET /listings/{id}/bookings` as its host |
| `inactive_listing` | Inactive listing with a finished and an upcoming booking | 501 (London) | 10613, 10614 | missing from `GET /search/listings`, shown in the host's `GET /me/listings` |
| `listing_without_reviews` | Active listing with no reviews (`review_count = 0`) | 626 (New York City) | – | `GET /listings/{id}` and its `/reviews` |
| `pending_listing` | Listing waiting for an admin's review, with its finished stays | 252 (Copenhagen) | – | first in `GET /admin/listings/pending`; missing from search |
| `rejected_listing` | Listing an admin rejected, with the reason | 502 (London) | – | the host's `GET /me/listings`; missing from search |
<!-- edge-cases:end -->

The hold expires 4 minutes after loading, and the worker then marks it `expired` within a minute, so its dates become free in search.

## Photos

`photos/` holds 8 synthetic JPEGs, one per room tag (Living room, Bedroom, Kitchen, Bathroom, Exterior, Dining area, Workspace, Balcony), with sizes in `photos/manifest.json`. Some are portrait, some wide, to test the gallery layout.

Each listing gets 3–8 photos with key `demo/listings/<id>/<order>-<slug>.jpg`:

- The cover (`sort_order` 0) is the Living room, or the Bedroom for a private or shared room.
- Then come the bedrooms (up to 3), the kitchen and the bathroom.
- The extras follow the amenities: Workspace only with "Dedicated workspace", Balcony only with "Balcony".

`seed-demo` uploads the matching file under every key (about 10 s). It retries each upload up to 3 times, because MinIO now and then drops a parallel upload. If storage is down, the data still loads; run `seed-demo --photos-only` later.

We draw the images instead of downloading the hosts' photos, because those photos belong to the hosts, and Inside Airbnb gives only the cover URL.

## Load

The data needs an empty database: it stops if `users` or `listings` already has rows, because it inserts explicit ids.

```bash
docker compose run --rm migrate caravansara seed-demo                # data and photos
docker compose run --rm migrate caravansara seed-demo --skip-photos  # data only
docker compose run --rm migrate caravansara seed-demo --photos-only  # photos again, after a storage error
```

To keep your development database, load the demo into a second one:

```bash
docker compose exec db psql -U caravansara -c "CREATE DATABASE caravansara_demo"
docker compose run --rm -e CARAVANSARA_DATABASE_URL=postgresql+asyncpg://caravansara:caravansara@db:5432/caravansara_demo \
  migrate sh -c "caravansara migrate && caravansara seed && caravansara seed-demo"
```

Measured on 2026-11-05: 10 loads in a row into a fresh database, each 9–10 s, including migrations and the catalog, with no error.

## Rebuild

With the same input and the same `--seed`, every output is byte-identical.

```bash
python3 db/demo/build_demo_seed.py --download                          # once: about 900 MB into .cache/insideairbnb/ (git-ignored)
uv run --no-project --with pillow python db/demo/build_demo_photos.py  # only when room tags or sizes change
python3 db/demo/build_demo_seed.py                                     # writes seed_demo.sql, edge_cases.json and the table above
```

`build_demo_seed.py` needs only the Python 3.9+ standard library. To change the cities, snapshots or counts, edit `CITIES`, `LISTINGS_PER_CITY` or `REVIEWS_PER_LISTING` at the top of the script; for the Persian listings, edit `fa_listings.json`.

## Real photos for the popular listings (feature 043)

`commons/` holds 24 freely licensed photos from Wikimedia Commons (CC0, public domain, CC BY, CC BY-SA), chosen by hand for rooms a rental would show, with `manifest.json` (room, size, author, licence, source) and `CREDITS.md`. After the demo is loaded, this gives the top 12 public listings of every city, the ones the home page's rows show, a real photo for each of their photos whose room has one:

```bash
docker compose run --rm migrate caravansara demo-commons-photos
```

It uploads the photo under each listing photo's own key and sets its caption to the author and licence (the gallery shows the caption beside the room tag, which is how the licences' credit is given), and its size. Nothing is added or deleted, and a rerun gives the same result. `seed-demo --photos-only` puts the drawn images back, so run this again after it. It refuses to run in production.
