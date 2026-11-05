#!/usr/bin/env python3
"""Build db/bulk/city_profiles.json from the cached Inside Airbnb files (CC BY 4.0).

A profile is a statistical summary of one city's real listings. `caravansara seed-bulk`
draws bulk data from it, so the bulk data needs neither the 1.5 GB cache nor the internet.
It holds distributions only: no listing, host or review text. The 500 sample points are
real listing coordinates (Inside Airbnb already moves them ~150 m) rounded to 3 decimals.

Usage (standard library only, Python 3.9+), after `build_demo_seed.py --download`:
    python3 db/bulk/build_city_profiles.py

Same cache => byte-identical output.
"""
import json
import random
import statistics
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "demo"))
from build_demo_seed import CITIES, ROOM_TYPES, cache_file, map_amenity, parse_bathrooms, read_csv  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "db" / "bulk" / "city_profiles.json"
POINTS = 500
# Inside Airbnb's occupancy model assumes half of all stays leave a review.
REVIEW_SHARE = 0.5


def percentiles(values):
    """101 values: min, the 99 inclusive cut points, max."""
    values = sorted(values)
    if len(values) == 1:
        return [round(values[0], 2)] * 101
    cuts = statistics.quantiles(values, n=100, method="inclusive")
    return [round(v, 2) for v in [values[0], *cuts, values[-1]]]


def shares(counter, ndigits=4):
    """Counter -> {key: share}, shares summing to exactly 1 after rounding."""
    total = sum(counter.values())
    items = sorted(counter.items(), key=lambda kv: str(kv[0]))
    out = {str(k): round(v / total, ndigits) for k, v in items}
    largest = max(out, key=out.get)          # rounding drift goes to the largest share
    out[largest] = round(out[largest] + 1 - sum(out.values()), ndigits)
    return out


def pairs(counter, ndigits=4):
    """Counter -> [[value, p], ...] sorted by value, p summing to 1."""
    s = shares(counter, ndigits)
    return sorted(([float(k) if "." in k else int(k), p] for k, p in s.items()), key=lambda kv: kv[0])


def price(x):
    return float(x["price"].strip("$").replace(",", ""))


def profile(city, snapshot, currency):
    rows = [x for x in read_csv(cache_file(city, "listings")) if x["room_type"] in ROOM_TYPES and x["accommodates"]]
    rows.sort(key=lambda x: int(x["id"]))

    room = Counter(ROOM_TYPES[x["room_type"]] for x in rows)
    priced = [x for x in rows if x["price"] and price(x) > 0]
    cap = sorted(price(x) for x in priced)[int(len(priced) * 0.995)]          # drop the top 0.5 % (typos)
    price_percentiles = {}
    for rt in ("entire_place", "private_room", "shared_room"):
        vals = [price(x) for x in priced if ROOM_TYPES[x["room_type"]] == rt and price(x) <= cap]
        if len(vals) >= 5:
            price_percentiles[rt] = percentiles(vals)
    # a room type with too little price data borrows the nearest one
    for rt in ("entire_place", "private_room", "shared_room"):
        if rt not in price_percentiles:
            price_percentiles[rt] = price_percentiles["private_room" if rt == "shared_room" else "entire_place"]

    acc = Counter(max(1, min(int(x["accommodates"]), 16)) for x in rows)
    size = {}
    for a in sorted(acc):
        group = [x for x in rows if max(1, min(int(x["accommodates"]), 16)) == a]
        if len(group) < 20:
            continue
        size[str(a)] = {
            "bedrooms": pairs(Counter(int(float(x["bedrooms"])) if x["bedrooms"] else 0 for x in group)),
            "beds": pairs(Counter(int(float(x["beds"])) if x["beds"] else 1 for x in group)),
            "bathrooms": pairs(Counter(parse_bathrooms(x) for x in group)),
        }

    amenity = Counter()
    for x in rows:
        amenity.update({m for m in map(map_amenity, json.loads(x["amenities"] or "[]")) if m})
    amenity_probability = {k: round(v / len(rows), 4) for k, v in sorted(amenity.items())}

    ratings = [float(x["review_scores_rating"]) for x in rows if x["review_scores_rating"]]
    occupancy = [int(x["estimated_occupancy_l365d"] or 0) for x in rows]
    per_host = Counter(x["host_id"] for x in rows)

    rng = random.Random(42)
    sample = rng.sample(rows, min(POINTS, len(rows)))
    points = sorted([round(float(x["latitude"]), 3), round(float(x["longitude"]), 3)] for x in sample)

    return {
        "snapshot": snapshot,
        "currency": currency,
        "listing_count": len(rows),
        "room_type_share": shares(room),
        "price_percentiles": price_percentiles,
        "accommodates": shares(acc),
        "size_by_accommodates": size,
        "amenity_probability": amenity_probability,
        "rating": {"mean": round(statistics.mean(ratings), 3), "sd": round(statistics.pstdev(ratings), 3)},
        "occupancy_l365d": percentiles(occupancy),
        "listings_per_host": {"mean": round(len(rows) / len(per_host), 3), "max": max(per_host.values())},
        "review_share": REVIEW_SHARE,
        "points": points,
    }


def main():
    cities = {}
    for city, _, path, currency in CITIES:
        print("profiling", city)
        cities[city] = profile(city, path.rsplit("/", 1)[1], currency)
    doc = {"version": 1, "source": "Inside Airbnb (https://insideairbnb.com), CC BY 4.0", "cities": cities}
    OUT.write_text(json.dumps(doc, indent=1, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
