#!/usr/bin/env python3
"""Build db/seed_demo.sql from Inside Airbnb data (CC BY 4.0, https://insideairbnb.com).

Real fields: title, description, neighbourhood, coordinates, room type, capacity,
bedrooms/beds/bathrooms, nightly price, amenities, review dates and review text.
Synthetic fields: every person (names, emails), addresses, cleaning fees, per-review
star ratings (sampled around the listing's real average), booking dates and guests.
Real host and reviewer names are dropped; host first names inside review text are
replaced by the fake host's name.

Usage (standard library only, Python 3.9+):
    python3 db/demo/build_demo_seed.py --download   # fetch the pinned snapshots once
    python3 db/demo/build_demo_seed.py              # write db/seed_demo.sql + photo_sources.csv

Same input + same --seed => byte-identical output.
"""
import argparse
import csv
import datetime as dt
import gzip
import html
import json
import math
import random
import re
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "insideairbnb"
OUT_SQL = ROOT / "db" / "seed_demo.sql"
OUT_PHOTOS = ROOT / "db" / "demo" / "photo_sources.csv"

# Pinned Inside Airbnb snapshots: (city, country code, snapshot path, currency)
CITIES = [
    ("Amsterdam",  "NL", "the-netherlands/north-holland/amsterdam/2026-09-16", "EUR"),
    ("Lisbon",     "PT", "portugal/lisbon/lisbon/2026-09-19",                  "EUR"),
    ("Copenhagen", "DK", "denmark/hovedstaden/copenhagen/2026-09-25",          "DKK"),
    ("Stockholm",  "SE", "sweden/stockholms-län/stockholm/2026-09-25",         "SEK"),
    ("London",     "GB", "united-kingdom/england/london/2026-09-17",           "GBP"),
    ("New York City", "US", "united-states/ny/new-york-city/2026-09-14",       "USD"),
]
BASE_URL = "https://data.insideairbnb.com"

LISTINGS_PER_CITY = 50
REVIEWS_PER_LISTING = 8          # most recent English reviews kept per listing
GUEST_POOL = 400
DEMO_PASSWORD = "caravansara-demo"
# argon2id hash of DEMO_PASSWORD (argon2-cffi defaults), shared by every demo account
PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=4$7fwaM/cgT6atxiCcygeWyA$fGFSl+AoIk1b3QdhUfZS30ldTMa9147QwAIgijXzhqA"
NAMESPACE = uuid.UUID("6f1c2a0e-6b1d-4c55-9a43-0c4e9d1a7c11")   # for deterministic idempotency keys

ROOM_TYPES = {
    "Entire home/apt": "entire_place",
    "Private room": "private_room",
    "Hotel room": "private_room",
    "Shared room": "shared_room",
}

# Inside Airbnb amenity strings -> our catalog names (db/seed_amenities.sql)
def map_amenity(a):
    s = a.lower()
    exact = {
        "hair dryer": "Hair dryer", "shampoo": "Shampoo", "hot water": "Hot water",
        "bed linens": "Bed linens", "iron": "Iron", "high chair": "High chair",
        "smoke alarm": "Smoke alarm", "carbon monoxide alarm": "Carbon monoxide alarm",
        "fire extinguisher": "Fire extinguisher", "first aid kit": "First aid kit",
        "microwave": "Microwave", "dishwasher": "Dishwasher", "cooking basics": "Cooking basics",
        "lake access": "Lake access", "elevator": "Elevator", "self check-in": "Self check-in",
        "crib": "Crib", "pack ’n play/travel crib": "Crib", "kitchen": "Kitchen",
        "free street parking": "Free parking",
    }
    if s in exact:
        return exact[s]
    rules = [
        (lambda: s.startswith(("washer", "free washer", "paid washer")), "Washer"),
        (lambda: s.startswith(("dryer", "free dryer", "paid dryer")), "Dryer"),
        (lambda: re.search(r"\b(hd)?tv\b", s) is not None, "TV"),
        (lambda: "heating" in s, "Heating"),
        (lambda: "air conditioning" in s or s.startswith("ac "), "Air conditioning"),
        (lambda: s.startswith("wifi"), "Wifi"),
        (lambda: s.startswith("dedicated workspace"), "Dedicated workspace"),
        (lambda: s.startswith(("refrigerator", "fridge")), "Refrigerator"),
        (lambda: s.startswith("coffee maker"), "Coffee maker"),
        (lambda: "balcony" in s, "Balcony"),
        (lambda: "sauna" in s, "Sauna"),
        (lambda: s.startswith("free parking"), "Free parking"),
        (lambda: "hot tub" in s, "Hot tub"),
    ]
    for test, name in rules:
        if test():
            return name
    return None


FIRST = """Aino Elias Sara Omar Lena Mateo Yara Noah Ines Kai Mina Leo Dara Arash Nora Tariq Freja Lucas
Amira Jonas Sofia Ravi Hana Felix Leila Hugo Maja Daniel Zara Emil Laila Tomas Nadia Oskar Mei Samir
Clara Anders Rosa Kenji Ida Babak Eva Malik Liv Pedro Shirin Viktor Ana Yusuf Elin David Maryam Nils
Chloe Reza Julia Theo Parisa Erik""".split()
LAST = """Virtanen Jansen Silva Nielsen Andersson Rahimi Costa Larsen Berg Haddad Moreau Novak Tanaka
Karimi Ferreira Lindqvist Okafor Rossi Schmidt Hansen Bakker Santos Johansson Ahmadi Weber Kowalski
Dubois Petrov Kim Nazari Jensen Pereira Eriksson Mendes Visser Holm Sato Fischer Yilmaz Ruiz""".split()


def sql(v):
    """Render a Python value as a SQL literal."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, Raw):
        return v.text
    return "'" + str(v).replace("'", "''") + "'"


class Raw:
    def __init__(self, text):
        self.text = text


def values_insert(table, cols, rows, prefix="", chunk=200):
    out = []
    for i in range(0, len(rows), chunk):
        part = rows[i:i + chunk]
        body = ",\n".join("  (" + ", ".join(sql(v) for v in r) + ")" for r in part)
        out.append(f"INSERT INTO {table} ({', '.join(cols)}) {prefix}VALUES\n{body};\n")
    return "\n".join(out)


def clean_text(s, limit=None):
    s = html.unescape(re.sub(r"<br\s*/?>", "\n", s or ""))
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s).strip()
    if limit and len(s) > limit:
        s = s[:limit].rsplit(" ", 1)[0].rstrip(" ,.;:") + "…"
    return s


EN_WORDS = set("the and was very great place we is to it for with in of location clean stay host nice "
               "would recommend lovely everything apartment room".split())


def is_english(text):
    letters = [c for c in text if c.isalpha()]
    if len(text) < 40 or len(text) > 900 or not letters:
        return False
    if sum(c.isascii() for c in letters) / len(letters) < 0.97:
        return False
    return len(EN_WORDS & set(re.findall(r"[a-z]+", text.lower()))) >= 4


def parse_bathrooms(x):
    if x["bathrooms"]:
        return float(x["bathrooms"])
    t = (x["bathrooms_text"] or "").lower()
    if "half" in t:
        return 0.5
    m = re.match(r"([\d.]+)", t)
    return float(m.group(1)) if m else 1.0


def fuzz(lat, lon, rng):
    """Move the point 100–500 m in a random direction (the public map pin)."""
    d = rng.uniform(100, 500)
    b = rng.uniform(0, 2 * math.pi)
    dlat = d * math.cos(b) / 111_320
    dlon = d * math.sin(b) / (111_320 * math.cos(math.radians(lat)))
    return round(lat + dlat, 6), round(lon + dlon, 6)


def score_to_star(avg, rng, spread=0.6):
    return max(1, min(5, round(rng.gauss(avg, spread))))


def read_csv(path):
    csv.field_size_limit(10 ** 9)
    with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
        yield from csv.DictReader(f)


def cache_file(city, kind):
    """Cache file for a city: 'New York City' -> new-york-city_listings.csv.gz."""
    return CACHE / f"{city.lower().replace(' ', '-')}_{kind}.csv.gz"


def download():
    CACHE.mkdir(parents=True, exist_ok=True)
    for city, _, path, _ in CITIES:
        for kind in ("listings", "reviews"):
            dest = cache_file(city, kind)
            if dest.exists():
                continue
            url = f"{BASE_URL}/{urllib.parse.quote(path)}/data/{kind}.csv.gz"
            print("downloading", url)
            urllib.request.urlretrieve(url, dest)


def build(seed):
    rng = random.Random(seed)
    names_used = {("Sara", "Lindqvist"), ("Omar", "Haddad")}   # the two demo accounts

    def fake_person(role):
        while True:
            f, l = rng.choice(FIRST), rng.choice(LAST)
            if (f, l) not in names_used:
                names_used.add((f, l))
                return f, l

    users = []          # (id, email, full_name, created_at)
    def add_user(first, last, email=None, created=None):
        uid = len(users) + 1
        email = email or f"{first}.{last}.{uid}@example.com".lower()
        created = created or dt.datetime(2011, 1, 1) + dt.timedelta(days=rng.randint(0, 1500))
        users.append((uid, email, f"{first} {last}", created.strftime("%Y-%m-%d %H:%M:%S+00")))
        return uid

    demo_host = add_user("Sara", "Lindqvist", "host@example.com", dt.datetime(2015, 6, 1))
    demo_guest = add_user("Omar", "Haddad", "guest@example.com", dt.datetime(2016, 3, 1))

    hosts = {}          # airbnb host_id -> (user id, fake first name)
    listings, photos, amen_rows, photo_src = [], [], [], []
    picked = []         # (listing_id, x, currency, price, cleaning)

    for city, _, _, currency in CITIES:
        rows = [x for x in read_csv(cache_file(city, "listings"))
                if x["price"] and x["review_scores_rating"] and int(x["number_of_reviews"] or 0) >= 10
                and x["room_type"] in ROOM_TYPES and x["accommodates"] and x["picture_url"]
                and x["name"].strip()]
        rows.sort(key=lambda x: int(x["id"]))
        rng.shuffle(rows)
        for x in rows[:LISTINGS_PER_CITY]:
            lid = len(listings) + 1
            if x["host_id"] not in hosts:
                f, l = fake_person("host")
                since = dt.datetime.strptime(x["host_since"], "%Y-%m-%d") if x["host_since"] else None
                hosts[x["host_id"]] = (add_user(f, l, created=since), f)
            host_id, host_first = hosts[x["host_id"]]
            if city == "Amsterdam" and lid <= 3:        # the demo host owns three Amsterdam listings
                host_id, host_first = demo_host, "Sara"
            price = round(float(x["price"].strip("$").replace(",", "")), 2)
            cleaning = 0 if rng.random() < 0.25 else round(price * rng.uniform(0.1, 0.35))
            amen_raw = json.loads(x["amenities"] or "[]")
            pets = "Pets allowed" in amen_raw
            lat, lon = float(x["latitude"]), float(x["longitude"])
            plat, plon = fuzz(lat, lon, rng)
            hood = clean_text(x["neighbourhood_cleansed"]) or None
            listings.append((
                lid, host_id, clean_text(x["name"], 100), clean_text(x["description"], 1500) or None,
                Raw(f"'{ROOM_TYPES[x['room_type']]}'::property_type"), city, hood,
                f"{rng.randint(1, 180)} Demo Street, {hood + ', ' if hood else ''}{city}",
                lat, lon, Raw(f"ST_SetSRID(ST_MakePoint({plon}, {plat}), 4326)::geography"),
                max(1, min(int(x["accommodates"]), 16)), pets, 2 if pets else 0,
                int(float(x["bedrooms"])) if x["bedrooms"] else 0,
                int(float(x["beds"])) if x["beds"] else 1, parse_bathrooms(x),
                price, float(cleaning), currency, x["host_since"] or "2018-01-01",
            ))
            key = f"demo/listings/{lid}/cover.jpg"
            photos.append((lid, key, 1200, 800, None, None, 0))
            photo_src.append((key, x["picture_url"], x["listing_url"]))
            for name in sorted({m for m in map(map_amenity, amen_raw) if m}):
                amen_rows.append((lid, name))
            picked.append((lid, x, currency, price, float(cleaning), host_id, host_first))

    guests = [add_user(*fake_person("guest")) for _ in range(GUEST_POOL)]

    # ---- reviews -> completed bookings (historical, absolute dates)
    by_airbnb_id = {p[1]["id"]: p for p in picked}
    wanted = {}
    for city, _, _, _ in CITIES:
        for r in read_csv(cache_file(city, "reviews")):
            if r["listing_id"] in by_airbnb_id and is_english(r["comments"]):
                wanted.setdefault(r["listing_id"], []).append(r)

    bookings, reviews = [], []
    earliest_booked = {}            # listing id -> earliest check_in already used
    for aid, revs in sorted(wanted.items(), key=lambda kv: by_airbnb_id[kv[0]][0]):
        lid, x, currency, price, cleaning, host_id, host_first = by_airbnb_id[aid]
        revs.sort(key=lambda r: (r["date"], int(r["id"])), reverse=True)
        avg = float(x["review_scores_rating"])
        sub = {k: float(x[f"review_scores_{k}"] or avg)
               for k in ("cleanliness", "accuracy", "checkin", "communication", "location", "value")}
        max_guests = max(1, min(int(x["accommodates"]), 16))
        bound = None
        for r in revs[:REVIEWS_PER_LISTING]:
            rdate = dt.date.fromisoformat(r["date"])
            check_out = rdate - dt.timedelta(days=rng.randint(0, 10))     # inside the 14-day window
            if bound and check_out > bound:
                check_out = bound
            nights = rng.randint(1, 6)
            check_in = check_out - dt.timedelta(days=nights)
            if (rdate - check_out).days > 14 or check_out <= check_in:
                continue
            bound = check_in
            guest = guests[int(r["reviewer_id"]) % GUEST_POOL]
            bid = len(bookings) + 1
            booking = make_booking(bid, lid, guest, check_in, check_out, max_guests, x, price,
                                   cleaning, currency, "completed", rng)
            booking[-1] = (dt.datetime.combine(check_in, dt.time(12)) - dt.timedelta(days=rng.randint(3, 60))
                           ).strftime("%Y-%m-%d %H:%M:%S+00")
            bookings.append(booking)
            comment = clean_text(r["comments"], 900)
            orig_host = x["host_name"].strip()
            if orig_host and len(orig_host) > 1:
                comment = re.sub(rf"\b{re.escape(orig_host)}\b", host_first, comment)
            reviews.append([bid, lid, guest, score_to_star(avg, rng, 0.45)]
                           + [score_to_star(sub[k], rng, 0.5) for k in
                              ("cleanliness", "accuracy", "checkin", "communication", "location", "value")]
                           + [comment, f"{r['date']} {rng.randint(8, 22):02d}:{rng.randint(0, 59):02d}:00+00"])
        earliest_booked[lid] = bound

    # ---- upcoming / recent bookings, relative to the day the seed is loaded
    rel = []   # same shape as bookings but with day offsets from CURRENT_DATE
    for lid, x, currency, price, cleaning, host_id, _ in picked:
        offset = rng.randint(4, 20)
        for _ in range(rng.randint(0, 3)):
            nights = rng.randint(2, 7)
            guest = rng.choice(guests)
            status = "cancelled" if rng.random() < 0.15 else "confirmed"
            rel.append((lid, guest, offset, offset + nights, x, price, cleaning, currency, status))
            offset += nights + rng.randint(0, 25)
    # demo guest: two upcoming stays and one just-finished stay that can still be reviewed
    demo_targets = [p for p in picked if p[5] != demo_host][:3]
    for (lid, x, currency, price, cleaning, _, _), (a, b, st) in zip(
            demo_targets, [(-6, -3, "completed"), (40, 44, "confirmed"), (90, 93, "confirmed")]):
        rel = [r for r in rel if not (r[0] == lid and r[2] < b and a < r[3])]   # keep dates free
        rel.append((lid, demo_guest, a, b, x, price, cleaning, currency, st))

    for lid, guest, a, b, x, price, cleaning, currency, status in rel:
        bid = len(bookings) + 1
        bk = make_booking(bid, lid, guest, a, b, max(1, min(int(x["accommodates"]), 16)), x, price,
                          cleaning, currency, status, rng)
        bk[3] = Raw(f"CURRENT_DATE + {a}")
        bk[4] = Raw(f"CURRENT_DATE + {b}")
        bk[-1] = Raw(f"now() - interval '{rng.randint(1, 30)} days'")
        bookings.append(bk)

    return users, listings, photos, amen_rows, bookings, reviews, photo_src


def make_booking(bid, lid, guest, ci, co, max_guests, x, price, cleaning, currency, status, rng):
    nights = (co - ci).days if isinstance(ci, dt.date) else co - ci
    party = rng.randint(1, max_guests)
    adults = max(1, party - (rng.randint(0, party - 1) if party > 2 and rng.random() < 0.3 else 0))
    children = party - adults
    infants = 1 if rng.random() < 0.05 else 0
    pets = 1 if "Pets allowed" in x["amenities"] and rng.random() < 0.2 else 0
    total = round(price * nights + cleaning, 2)
    return [bid, lid, guest, ci.isoformat() if isinstance(ci, dt.date) else ci,
            co.isoformat() if isinstance(co, dt.date) else co, adults, children, infants, pets,
            price, cleaning, total, currency, Raw(f"'{status}'::booking_status"),
            str(uuid.uuid5(NAMESPACE, f"booking-{bid}")), None]


def write(users, listings, photos, amen_rows, bookings, reviews, photo_src):
    cities = ", ".join(c[0] for c in CITIES)
    parts = [f"""-- =====================================================================
-- Caravansara demo data. GENERATED by db/demo/build_demo_seed.py: do not edit by hand.
-- Source: Inside Airbnb (https://insideairbnb.com), CC BY 4.0; cities: {cities}.
-- People, addresses, cleaning fees, per-review stars and bookings are synthetic.
-- Requires: schema.sql, seed_amenities.sql, seed_locations.sql, and an empty database.
-- Every demo account's password: {DEMO_PASSWORD}
--   host@example.com  (Sara Lindqvist, hosts 3 Amsterdam listings)
--   guest@example.com (Omar Haddad, 2 upcoming stays, 1 finished stay still open for review)
-- {len(users)} users, {len(listings)} listings, {len(bookings)} bookings, {len(reviews)} reviews.
-- =====================================================================
BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM listings) THEN
    RAISE EXCEPTION 'seed_demo.sql expects empty users and listings tables';
  END IF;
END $$;
""",
        values_insert("users", ["id", "email", "password_hash", "full_name", "created_at"],
                      [(u[0], u[1], PASSWORD_HASH, u[2], u[3]) for u in users], "OVERRIDING SYSTEM VALUE "),
        "-- listings: city_id is looked up by city name\n"
        + "\n".join(
            "INSERT INTO listings (id, host_id, title, description, property_type, city_id, neighborhood, address,\n"
            "  latitude, longitude, public_location, max_guests, pets_allowed, max_pets, bedrooms, beds,\n"
            "  bathrooms, price_per_night, cleaning_fee, currency, created_at)\nOVERRIDING SYSTEM VALUE\n"
            "SELECT v.id, v.host_id, v.title, v.description, v.property_type, c.id, v.neighborhood, v.address,\n"
            "  v.latitude, v.longitude, v.public_location, v.max_guests, v.pets_allowed, v.max_pets, v.bedrooms,\n"
            "  v.beds, v.bathrooms, v.price_per_night, v.cleaning_fee, v.currency, v.created_at::timestamptz\n"
            "FROM (VALUES\n" + ",\n".join("  (" + ", ".join(sql(f) for f in l) + ")" for l in listings[i:i + 50])
            + "\n) AS v(id, host_id, title, description, property_type, city, neighborhood, address, latitude,\n"
            "  longitude, public_location, max_guests, pets_allowed, max_pets, bedrooms, beds, bathrooms,\n"
            "  price_per_night, cleaning_fee, currency, created_at)\nJOIN cities c ON c.name = v.city;\n"
            for i in range(0, len(listings), 50)),
        values_insert("listing_photos", ["listing_id", "storage_key", "width", "height", "caption",
                                         "room_tag", "sort_order"], photos),
        "INSERT INTO listing_amenities (listing_id, amenity_id)\nSELECT v.listing_id, a.id FROM (VALUES\n"
        + ",\n".join(f"  ({l}, {sql(n)})" for l, n in amen_rows)
        + "\n) AS v(listing_id, name)\nJOIN amenities a ON a.name = v.name;\n",
        values_insert("bookings", ["id", "listing_id", "guest_id", "check_in", "check_out", "adults",
                                   "children", "infants", "pets", "nightly_price", "cleaning_fee",
                                   "total_price", "currency", "status", "idempotency_key", "created_at"],
                      bookings, "OVERRIDING SYSTEM VALUE "),
        "-- the reviews_rating_sync trigger fills listings.avg_rating / review_count\n"
        + values_insert("reviews", ["booking_id", "listing_id", "guest_id", "rating", "cleanliness_rating",
                                    "accuracy_rating", "check_in_rating", "communication_rating",
                                    "location_rating", "value_rating", "comment", "created_at"], reviews),
        """-- move identity sequences past the explicit ids
SELECT setval(pg_get_serial_sequence('users', 'id'),    (SELECT max(id) FROM users));
SELECT setval(pg_get_serial_sequence('listings', 'id'), (SELECT max(id) FROM listings));
SELECT setval(pg_get_serial_sequence('bookings', 'id'), (SELECT max(id) FROM bookings));

COMMIT;
"""]
    OUT_SQL.write_text("\n".join(parts), encoding="utf-8")
    with OUT_PHOTOS.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["storage_key", "source_url", "airbnb_listing_url"])
        w.writerows(photo_src)
    print(f"wrote {OUT_SQL.relative_to(ROOT)}: {len(users)} users, {len(listings)} listings, "
          f"{len(amen_rows)} listing amenities, {len(bookings)} bookings, {len(reviews)} reviews")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--download", action="store_true", help="fetch the pinned Inside Airbnb files into .cache/")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    if args.download:
        download()
    else:
        write(*build(args.seed))
