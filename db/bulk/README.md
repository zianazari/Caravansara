# Bulk data

Large, realistic data for measuring performance: index review, query plans, cache decisions. One command generates it and loads it into **its own database**, `caravansara_bulk`, on the same PostgreSQL server. Your everyday development database is never touched.

The data is not in git. Only its recipe is: the generator (`backend/src/caravansara/devdata/`) and `city_profiles.json`. The same inputs always give the same rows.

## Load

```bash
docker compose run --rm migrate caravansara seed-bulk --listings 10000   # laptop size, a few minutes
docker compose run --rm migrate caravansara seed-bulk                    # default: 100,000 listings
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--listings` | `100000` | Number of listings, at least 100. Every other table scales with it. |
| `--seed` | `42` | Random seed. |
| `--today` | today (UTC) | Reference date. Same seed and same `--today` give the same data. |
| `--database` | `caravansara_bulk` | Target database on the same server. |
| `--replace` | off | Drop and rebuild the target, for a second run. |

To point the app at the bulk data, change one setting:

```bash
CARAVANSARA_DATABASE_URL=postgresql+asyncpg://caravansara:caravansara@db:5432/caravansara_bulk
```

## Measure

```bash
docker compose run --rm migrate caravansara measure-queries                 # every query in db/bulk/queries/
docker compose run --rm migrate caravansara measure-queries --only search_city_london_dates --runs 9 --out after.json
```

`db/bulk/queries/` holds the important queries the app sends: `catalog.json` (name, code source, endpoint, parameters, target), one `<name>.sql` each, and `params.sql`, which picks representative values from the data (the busiest listing, the London centre, ...). Each query gets 1 warm-up run and the median of 5 `EXPLAIN (ANALYZE, BUFFERS)` runs, each in its own connection and in a transaction that is rolled back, so nothing changes. A test keeps the catalog equal to the code. Results of the index review: [specs/003-index-review/measurements.md](../../specs/003-index-review/measurements.md).

## Safety locks

The command refuses, and changes nothing, when:

- `CARAVANSARA_ENVIRONMENT=production`;
- `--database` is the database the app is configured to use, because that holds your development data;
- the target already has users or listings and `--replace` is not given;
- `--replace` names a database that does not end with `_bulk`.

The load is one transaction: if it stops halfway, no data rows are left. The schema and catalog stay, and a rerun with `--replace` starts clean. All constraints and triggers stay on while loading (`no_double_booking`, "review only after a completed stay", the rating trigger), so PostgreSQL checks the generator too.

## What it contains (per 100,000 listings)

| Table | Rows | How |
| --- | --- | --- |
| `users` | about 360,000 | Hosts (`ceil(listings / listings per host)`) plus 3 guests per listing. Email `bulk.<id>@example.com`. Every password is `caravansara-demo`. |
| `listings` | 100,000 | Split across the six cities in proportion to their real size (London about half). Type, capacity, size, price, amenities and location are drawn from that city's profile. 3 % are inactive. |
| `listing_photos` | 300,000 | 3 rows per listing (`bulk/listings/<id>/<n>.jpg`). There are no image files: photos are not needed for measuring. |
| `listing_amenities` | about 1.5 million | Each amenity with the city's real probability. |
| `bookings` | about 3 million | Two years back at the listing's real occupancy, and one year ahead at 40 % of it. Stays of 1–14 nights (about 4 on average). Past stays are completed, 6 % cancelled. Future stays are confirmed, 8 % cancelled, 0.1 % pending. 2 % of stays have an abandoned, expired hold on the same dates first. |
| `reviews` | about 1.2 million | Half of the completed stays, the share Inside Airbnb's occupancy model assumes. Written 0–13 days after check-out, with stars around the city's real average, and short synthetic text. |

## City profiles

`city_profiles.json` summarises each city's real listings. It holds distributions only: no listing text, no host and no review.

| Field | From Inside Airbnb |
| --- | --- |
| `room_type_share` | `room_type` |
| `price_percentiles` | `price` per room type, 101 percentiles, top 0.5 % dropped |
| `accommodates`, `size_by_accommodates` | `accommodates`, `bedrooms`, `beds`, `bathrooms` |
| `amenity_probability` | `amenities`, mapped to our 31-item catalog |
| `rating` | `review_scores_rating` (mean and standard deviation) |
| `occupancy_l365d` | `estimated_occupancy_l365d`, booked nights in the last year |
| `listings_per_host` | `host_id` |
| `points` | 500 listing coordinates, rounded to 3 decimals (about 100 m) |

Inside Airbnb already moves every point by about 150 m. The generator moves it again by 0–300 m, and the public pin by 100–500 m more, so no real listing can be found from the data.

Rebuild the profiles after changing cities or snapshots (standard library only):

```bash
python3 db/demo/build_demo_seed.py --download   # once: Inside Airbnb files into .cache/ (git-ignored)
python3 db/bulk/build_city_profiles.py          # writes db/bulk/city_profiles.json
```

## Source and license

[Inside Airbnb](https://insideairbnb.com/get-the-data/), **CC BY 4.0**. Any public use must credit Inside Airbnb. The snapshots are pinned in `CITIES` in `db/demo/build_demo_seed.py`.
