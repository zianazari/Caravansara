# Demo data

`db/seed_demo.sql` is mock data built from real Airbnb listings, so search, the map, prices, amenities and reviews look real in development, demos and tests.

## Source and license

[Inside Airbnb](https://insideairbnb.com/get-the-data/) publishes snapshots of public Airbnb listings under **CC BY 4.0**. Any public use must credit Inside Airbnb.

We use Inside Airbnb instead of scraping airbnb.com because Airbnb's terms forbid scraping and its site blocks bots.

| City | Country | Currency | Snapshot |
| --- | --- | --- | --- |
| Amsterdam | NL | EUR | 2026-09-16 |
| Lisbon | PT | EUR | 2026-09-19 |
| Copenhagen | DK | DKK | 2026-09-25 |
| Stockholm | SE | SEK | 2026-09-25 |

Inside Airbnb has no Helsinki data, so the demo uses these four cities.

## What is real and what is synthetic

| Real (from the snapshot) | Synthetic (generated) |
| --- | --- |
| Title, description, neighbourhood | All people: names, emails (`@example.com`) |
| Coordinates (Airbnb already blurs them by about 150 m) | Address (`12 Demo Street, …`) |
| Room type, max guests, bedrooms, beds, bathrooms | `public_location`: the real point moved 100–500 m |
| Nightly price in local currency | Cleaning fee (0, or 10–35 % of the nightly price) |
| Amenities, mapped to our 31-item catalog | Each review's stars, sampled around the listing's real averages |
| Pets allowed (from the "Pets allowed" amenity) | Bookings: dates, guests, party size |
| Review date and text (English only, up to 8 latest per listing) | |

Privacy: real host and reviewer names are dropped. If a review names the host, the generator swaps in the fake host's first name.

## Contents

- 200 listings (50 per city): 161 entire places, 39 private rooms
- 598 users: 196 hosts, 400 guests, and the two demo accounts
- 1,793 bookings:
  - 1,492 completed, one behind each review
  - 261 confirmed and 40 cancelled upcoming stays
- 1,491 reviews; the trigger fills `avg_rating` and `review_count` (city averages are 4.66–4.76)
- One cover photo per listing

Upcoming bookings use `CURRENT_DATE + n`, so they stay in the future whenever you load the file. Past bookings use fixed dates.

## Demo accounts

Every account's password is `caravansara-demo`. The hash is argon2id.

| Email | Role |
| --- | --- |
| `host@example.com` | Sara Lindqvist, host of listings 1–3 (Amsterdam) |
| `guest@example.com` | Omar Haddad: a finished stay (ended 3 days before load, can still be reviewed) and 2 upcoming stays |

## Load

The file needs an empty database. It aborts if `users` or `listings` already has rows, because it inserts explicit ids.

```bash
psql -d caravansara -f db/schema.sql -f db/seed_amenities.sql -f db/seed_locations.sql
psql -d caravansara -f db/seed_demo.sql
```

Tested on `postgis/postgis:16-3.4`: everything loads, and `search_query.sql` returns results.

## Photos

Each listing gets a `listing_photos` row with key `demo/listings/<id>/cover.jpg`. The image files are not in git: they are hosts' photos, and Inside Airbnb gives only the cover URL.

`photo_sources.csv` maps each key to its source URL. The planned demo-data command can download from those URLs into MinIO for local use.

`width` and `height` are a 1200×800 placeholder (3:2, which is typical for Airbnb). The command should set the real size when it uploads each image.

## Rebuild

Needs only the Python 3.9+ standard library. With the same input and the same `--seed`, the output is byte-identical.

```bash
python3 db/demo/build_demo_seed.py --download   # once: ~450 MB into .cache/insideairbnb/ (git-ignored)
python3 db/demo/build_demo_seed.py              # writes db/seed_demo.sql and db/demo/photo_sources.csv
```

To change the cities, snapshots or counts, edit `CITIES`, `LISTINGS_PER_CITY` or `REVIEWS_PER_LISTING` at the top of the script. Do not edit `seed_demo.sql` by hand.
