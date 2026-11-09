#!/usr/bin/env python3
"""Build db/seed_demo.sql from Inside Airbnb data (CC BY 4.0, https://insideairbnb.com).

Real fields: title, description, neighbourhood, coordinates, room type, capacity,
bedrooms/beds/bathrooms, nightly price, amenities, review dates and review text.
Synthetic fields: every person (names, emails), addresses, cleaning fees, per-review
star ratings (sampled around the listing's real average), booking dates and guests.
Real host and reviewer names are dropped; host names inside review text and descriptions
are replaced by the fake host's name, a review that still names a real person is skipped,
and the build stops before writing if any real name is left in a review.
Also added: hand-written Persian listings (fa_listings.json), synthetic photos
(photos/manifest.json) and seven edge cases (README.md, edge_cases.json).

Usage (standard library only, Python 3.9+):
    python3 db/demo/build_demo_seed.py --download   # fetch the pinned snapshots once
    python3 db/demo/build_demo_seed.py              # write db/seed_demo.sql, edge_cases.json, README table

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

LISTINGS_PER_CITY = 125
REVIEWS_PER_LISTING = 15         # most recent English reviews kept per listing
GUEST_POOL = 1200
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


TZ = {
    "Amsterdam": "Europe/Amsterdam", "Lisbon": "Europe/Lisbon", "Copenhagen": "Europe/Copenhagen",
    "Stockholm": "Europe/Stockholm", "London": "Europe/London", "New York City": "America/New_York",
    "Tehran": "Asia/Tehran", "Isfahan": "Asia/Tehran", "Shiraz": "Asia/Tehran",
}
CITY_FA = {"Tehran": "تهران", "Isfahan": "اصفهان", "Shiraz": "شیراز"}
FA_FIRST = """آرش بهاره پرستو تینا جواد حمید داریوش رضا ژاله سارا سهراب شیرین فرهاد کاوه گلناز لیلا مریم
نسرین نیما هومن یاسمن بیژن پریسا رویا سیاوش فرناز کیان مهسا نوید یگانه""".split()
FA_LAST = """احمدی اکبری امینی بهرامی پارسا تهرانی جعفری حسینی خسروی رحیمی رستمی زمانی سلیمانی شریفی صادقی
طاهری عزیزی فرهادی قاسمی کریمی محمدی مرادی نوری هاشمی یزدانی""".split()
FA_GUEST_POOL = 80
MAX_STORED_AMOUNT = 999_999_999_999.99   # NUMERIC(14,2): the widest amount a price column holds (specs/backend (002))
MAX_PRICE = 1_000_000_000               # the API's limit for a nightly price or cleaning fee (specs/backend (002))
PHOTO_MANIFEST = ROOT / "db" / "demo" / "photos" / "manifest.json"
FA_LISTINGS = ROOT / "db" / "demo" / "fa_listings.json"
OUT_EDGE = ROOT / "db" / "demo" / "edge_cases.json"
README = ROOT / "db" / "demo" / "README.md"
# Capitalised words that are names in some places and plain English in reviews ("May", "Grace").
NOT_NAMES = set("""May June April August Joy Rose Grace Hope Sky Sunny Bay Star Home Love City Guest Host Max
Will Mark Bill Art Great Nice Amazing Perfect Thanks Thank Super Best Lovely Very The And Clean Good Hotel
Apartment Studio Room House Place Team Family Friends Ben Don Van Sun Summer Winter""".split())


def city_day(city, offset):
    """SQL for 'today in the listing's city + offset days': bookings stay relative to the load day."""
    return Raw(f"(now() AT TIME ZONE '{TZ[city]}')::date + {offset}")


def load_manifest():
    manifest = json.loads(PHOTO_MANIFEST.read_text(encoding="utf-8"))
    return {v["room_tag"]: (slug, v["width"], v["height"]) for slug, v in manifest.items()}


def photos_for(lid, room_type, bedrooms, amenities, rng, manifest):
    """3–8 photo rows: cover first, then bedrooms, kitchen, bathroom and extras the amenities justify."""
    tags = ["Living room" if room_type == "entire_place" else "Bedroom"]
    if room_type == "entire_place" and bedrooms:
        tags += ["Bedroom"] if bedrooms == 1 else [f"Bedroom {i}" for i in range(1, min(bedrooms, 3) + 1)]
    tags += ["Kitchen", "Bathroom"]
    if rng.random() < 0.6:
        tags.append("Exterior")
    if room_type == "entire_place" and rng.random() < 0.5:
        tags.append("Dining area")
    if "Dedicated workspace" in amenities:
        tags.append("Workspace")
    if "Balcony" in amenities:
        tags.append("Balcony")
    rows = []
    for order, tag in enumerate(tags[:8]):
        slug, width, height = manifest[tag.split(" ")[0] if tag.startswith("Bedroom") else tag]
        rows.append((lid, f"demo/listings/{lid}/{order}-{slug}.jpg", width, height, None, tag, order))
    return rows


def name_tokens(text):
    return set(re.findall(r"\b[A-Z][a-z]{2,}\b", text))


def real_names(*names):
    """Name tokens to keep out of review text: full names and each word, minus plain English words."""
    out = set()
    for name in names:
        for token in re.findall(r"[A-Za-z]{3,}", name or ""):
            token = token.capitalize()
            if token not in NOT_NAMES and token not in FIRST:
                out.add(token)
    return out


def build(seed):
    rng = random.Random(seed)
    manifest = load_manifest()
    names_used = {("Sara", "Lindqvist"), ("Omar", "Haddad")}   # the two demo accounts

    def fake_person(first_names=FIRST, last_names=LAST):
        while True:
            f, l = rng.choice(first_names), rng.choice(last_names)
            if (f, l) not in names_used:
                names_used.add((f, l))
                return f, l

    users = []          # (id, email, full_name, created_at)
    def add_user(first, last, email=None, created=None, prefix=None):
        uid = len(users) + 1
        email = email or (f"{prefix}.{uid}@example.com" if prefix else f"{first}.{last}.{uid}@example.com".lower())
        created = created or dt.datetime(2011, 1, 1) + dt.timedelta(days=rng.randint(0, 1500))
        users.append((uid, email, f"{first} {last}", created.strftime("%Y-%m-%d %H:%M:%S+00")))
        return uid

    demo_host = add_user("Sara", "Lindqvist", "host@example.com", dt.datetime(2015, 6, 1))
    demo_guest = add_user("Omar", "Haddad", "guest@example.com", dt.datetime(2016, 3, 1))

    hosts = {}          # airbnb host_id -> (user id, fake first name)
    listings, photos, amen_rows = [], [], []
    picked = []         # (listing_id, x, currency, price, cleaning, host_id, host_first, city)

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
                f, l = fake_person()
                since = dt.datetime.strptime(x["host_since"], "%Y-%m-%d") if x["host_since"] else None
                hosts[x["host_id"]] = (add_user(f, l, created=since), f)
            host_id, host_first = hosts[x["host_id"]]
            if city == "Amsterdam" and lid <= 3:        # the demo host owns three Amsterdam listings
                host_id, host_first = demo_host, "Sara"
            price = round(float(x["price"].strip("$").replace(",", "")), 2)
            cleaning = 0 if rng.random() < 0.25 else round(price * rng.uniform(0.1, 0.35))
            amen_raw = json.loads(x["amenities"] or "[]")
            amenities = sorted({m for m in map(map_amenity, amen_raw) if m})
            pets = "Pets allowed" in amen_raw
            lat, lon = float(x["latitude"]), float(x["longitude"])
            plat, plon = fuzz(lat, lon, rng)
            hood = clean_text(x["neighbourhood_cleansed"]) or None
            description = clean_text(x["description"], 1500) or None
            for token in real_names(x["host_name"]):      # hosts often sign their own description
                if description:
                    description = re.sub(rf"\b{re.escape(token)}\b", host_first, description)
            room_type = ROOM_TYPES[x["room_type"]]
            bedrooms = int(float(x["bedrooms"])) if x["bedrooms"] else 0
            listings.append((
                lid, host_id, clean_text(x["name"], 100), description,
                Raw(f"'{room_type}'::property_type"), city, hood,
                f"{rng.randint(1, 180)} Demo Street, {hood + ', ' if hood else ''}{city}",
                lat, lon, Raw(f"ST_SetSRID(ST_MakePoint({plon}, {plat}), 4326)::geography"),
                max(1, min(int(x["accommodates"]), 16)), pets, 2 if pets else 0, bedrooms,
                int(float(x["beds"])) if x["beds"] else 1, parse_bathrooms(x),
                price, float(cleaning), currency, x["host_since"] or "2018-01-01",
            ))
            photos.extend(photos_for(lid, room_type, bedrooms, amenities, rng, manifest))
            amen_rows.extend((lid, name) for name in amenities)
            picked.append((lid, x, currency, price, float(cleaning), host_id, host_first, city))

    guests = [add_user(*fake_person()) for _ in range(GUEST_POOL)]

    # ---- edge cases (FR-014): one known record per rule, picked by city
    by_city = {}
    demo_targets = [p for p in picked if p[5] != demo_host][:3]
    taken = {p[0] for p in demo_targets}
    for p in picked:
        if p[5] != demo_host and p[0] not in taken:
            by_city.setdefault(p[7], []).append(p)
    edge = {
        "hold_about_to_expire": by_city["Amsterdam"][0],
        "expired_hold": by_city["Amsterdam"][1],
        "year_long_stay": by_city["Lisbon"][0],
        "last_bookable_day": by_city["Stockholm"][0],
        "same_day_turnover": by_city["Copenhagen"][0],
        "inactive_listing": by_city["London"][0],
        "listing_without_reviews": by_city["New York City"][0],
    }
    edge_listing_ids = {p[0] for p in edge.values()}
    no_reviews = edge["listing_without_reviews"][0]

    # ---- reviews -> completed bookings (historical, absolute dates)
    by_airbnb_id = {p[1]["id"]: p for p in picked}
    wanted = {}
    for city, _, _, _ in CITIES:
        for r in read_csv(cache_file(city, "reviews")):
            if r["listing_id"] in by_airbnb_id and is_english(r["comments"]):
                wanted.setdefault(r["listing_id"], []).append(r)

    bookings, reviews = [], []
    leftover_names = []
    names_by_listing = {}       # listing id -> real host and reviewer name tokens
    for aid, revs in sorted(wanted.items(), key=lambda kv: by_airbnb_id[kv[0]][0]):
        lid, x, currency, price, cleaning, host_id, host_first, city = by_airbnb_id[aid]
        if lid == no_reviews:
            continue
        revs.sort(key=lambda r: (r["date"], int(r["id"])), reverse=True)
        avg = float(x["review_scores_rating"])
        sub = {k: float(x[f"review_scores_{k}"] or avg)
               for k in ("cleanliness", "accuracy", "checkin", "communication", "location", "value")}
        max_guests = max(1, min(int(x["accommodates"]), 16))
        hosts_real = real_names(x["host_name"])
        reviewers_real = real_names(*(r["reviewer_name"] for r in revs))
        names_by_listing[lid] = hosts_real | reviewers_real
        bound, kept = None, 0
        for r in revs:
            if kept == REVIEWS_PER_LISTING:
                break
            comment = clean_text(r["comments"], 900)
            for token in hosts_real:
                comment = re.sub(rf"\b{re.escape(token)}\b", host_first, comment)
            if name_tokens(comment) & (hosts_real | reviewers_real):
                continue          # names another real person (a co-host, the reviewer): drop it (FR-016)
            rdate = dt.date.fromisoformat(r["date"])
            check_out = rdate - dt.timedelta(days=rng.randint(0, 10))     # inside the 14-day window
            if bound and check_out > bound:
                check_out = bound
            nights = rng.randint(1, 6)
            check_in = check_out - dt.timedelta(days=nights)
            if (rdate - check_out).days > 14 or check_out <= check_in:
                continue
            bound, kept = check_in, kept + 1
            guest = guests[int(r["reviewer_id"]) % GUEST_POOL]
            bid = len(bookings) + 1
            booking = make_booking(bid, lid, guest, check_in, check_out, max_guests, x, price,
                                   cleaning, currency, "completed", rng)
            booking[-1] = (dt.datetime.combine(check_in, dt.time(12)) - dt.timedelta(days=rng.randint(3, 60))
                           ).strftime("%Y-%m-%d %H:%M:%S+00")
            bookings.append(booking)
            leftover_names.append((lid, name_tokens(comment) & (hosts_real | reviewers_real)))
            reviews.append([bid, lid, guest, score_to_star(avg, rng, 0.45)]
                           + [score_to_star(sub[k], rng, 0.5) for k in
                              ("cleanliness", "accuracy", "checkin", "communication", "location", "value")]
                           + [comment, f"{r['date']} {rng.randint(8, 22):02d}:{rng.randint(0, 59):02d}:00+00"])
    # A description that still names a real person (a co-host, a reviewer) loses its text (FR-016).
    for i, row in enumerate(listings):
        names = names_by_listing.get(row[0], set())
        if row[3] and name_tokens(row[3]) & names:
            listings[i] = (*row[:3], None, *row[4:])
    # Final check before writing: no kept review may name a real host or reviewer (FR-016).
    bad = [(lid, names) for lid, names in leftover_names if names]
    if bad:
        raise SystemExit(f"real names left in reviews, not writing seed_demo.sql: {bad[:5]}")

    # ---- upcoming / recent bookings, relative to the day the seed is loaded (city time)
    rel = []   # (listing, guest, from, to, status, hold, edge key)
    for p in picked:
        if p[0] in edge_listing_ids:
            continue      # edge-case listings get only their own bookings
        offset = rng.randint(4, 20)
        for _ in range(rng.randint(0, 3)):
            nights = rng.randint(2, 7)
            status = "cancelled" if rng.random() < 0.15 else "confirmed"
            rel.append((p, rng.choice(guests), offset, offset + nights, status, None, None))
            offset += nights + rng.randint(0, 25)
    # demo guest: two upcoming stays and one just-finished stay that can still be reviewed
    for p, (a, b, st) in zip(demo_targets, [(-6, -3, "completed"), (40, 44, "confirmed"), (90, 93, "confirmed")]):
        rel = [r for r in rel if not (r[0][0] == p[0] and r[2] < b and a < r[3])]   # keep dates free
        rel.append((p, demo_guest, a, b, st, None, None))
    rel += [
        (edge["hold_about_to_expire"], demo_guest, 20, 22, "pending", "now() + interval '4 minutes'",
         "hold_about_to_expire"),
        (edge["expired_hold"], demo_guest, 30, 32, "expired", "now() - interval '2 days'", "expired_hold"),
        (edge["year_long_stay"], rng.choice(guests), 30, 395, "confirmed", None, "year_long_stay"),
        (edge["last_bookable_day"], rng.choice(guests), 365, 367, "confirmed", None, "last_bookable_day"),
        (edge["same_day_turnover"], rng.choice(guests), 50, 53, "confirmed", None, "same_day_turnover"),
        (edge["same_day_turnover"], rng.choice(guests), 53, 56, "confirmed", None, "same_day_turnover"),
        (edge["inactive_listing"], rng.choice(guests), -12, -10, "completed", None, "inactive_listing"),
        (edge["inactive_listing"], rng.choice(guests), 60, 63, "confirmed", None, "inactive_listing"),
    ]
    edge_cases = {key: {"listing_id": p[0], "city": p[7], "booking_ids": []} for key, p in edge.items()}
    for p, guest, a, b, status, hold, key in rel:
        lid, x, currency, price, cleaning, _, _, city = p
        bid = len(bookings) + 1
        bk = make_booking(bid, lid, guest, a, b, max(1, min(int(x["accommodates"]), 16)), x, price,
                          cleaning, currency, status, rng)
        bk[3], bk[4] = city_day(city, a), city_day(city, b)
        bk[-2] = Raw(hold) if hold else None
        bk[-1] = Raw(f"now() - interval '{rng.randint(1, 30)} days'")
        bookings.append(bk)
        if key:
            edge_cases[key]["booking_ids"].append(bid)

    persian = add_persian_listings(rng, add_user, fake_person, listings, photos, amen_rows, bookings,
                                   reviews, manifest)

    # ---- listing review (specs/backend (004)): one admin and two listings an admin has not
    # approved. Picked after everything else, outside `edge`, so no random draw and no id above moves.
    # Neither is another edge case or one of the demo guest's stays.
    admin = add_user("Ava", "Moradi", "admin@example.com", dt.datetime(2020, 1, 1))
    for key, p in (("pending_listing", by_city["Copenhagen"][1]), ("rejected_listing", by_city["London"][1])):
        edge_cases[key] = {"listing_id": p[0], "city": p[7], "booking_ids": [], "host_id": p[5]}
    return (users, listings, photos, amen_rows, bookings, reviews,
            edge_cases["inactive_listing"]["listing_id"], edge_cases, persian, admin)


def add_persian_listings(rng, add_user, fake_person, listings, photos, amen_rows, bookings, reviews, manifest):
    """Hand-written Persian listings in Iranian cities (db/demo/fa_listings.json), priced in IRR."""
    items = json.loads(FA_LISTINGS.read_text(encoding="utf-8"))
    problems = []
    for i, it in enumerate(items):
        where = f"fa_listings.json item {i} ({it.get('title', '?')})"
        if it["city"] not in CITY_FA:
            problems.append(f"{where}: unknown city {it['city']}")
        if not 1 <= len(it["title"]) <= 100:
            problems.append(f"{where}: title must be 1–100 characters")
        if len(it["description"]) > 1500:
            problems.append(f"{where}: description over 1500 characters")
        # Market prices (specs/backend (002) research R7, Jabama, 2026-11-05): whole places 10–100 million IRR
        # a night, rooms 2.5–10 million.
        low, high = (10_000_000, 100_000_000) if it["property_type"] == "entire_place" else (2_500_000, 10_000_000)
        if not low <= it["price_per_night"] <= high:
            problems.append(f"{where}: price_per_night outside {low:,}–{high:,} IRR for {it['property_type']}")
        if not 0 <= it["cleaning_fee"] <= MAX_PRICE:
            problems.append(f"{where}: cleaning_fee outside 0–{MAX_PRICE:,} IRR")
        if not 2 <= len(it["reviews"]) <= 4:
            problems.append(f"{where}: needs 2–4 reviews")
        if it["property_type"] not in ("entire_place", "private_room", "shared_room"):
            problems.append(f"{where}: bad property_type")
    texts = [it["description"] for it in items] + [r["comment"] for it in items for r in it["reviews"]]
    if not any(len(t) > 1000 for t in texts):
        problems.append("fa_listings.json: needs one text over 1000 characters")
    if not any(len(r["comment"]) < 20 for it in items for r in it["reviews"]):
        problems.append("fa_listings.json: needs one review under 20 characters")
    if problems:
        raise SystemExit("\n".join(problems))

    fa_guests = [add_user(*fake_person(FA_FIRST, FA_LAST), prefix="fa.guest") for _ in range(FA_GUEST_POOL)]
    first_id = len(listings) + 1
    for it in items:
        lid = len(listings) + 1
        f, l = fake_person(FA_FIRST, FA_LAST)
        host = add_user(f, l, prefix="fa.host", created=dt.datetime(2017, 1, 1) + dt.timedelta(days=rng.randint(0, 2400)))
        plat, plon = fuzz(it["latitude"], it["longitude"], rng)
        price, cleaning = float(it["price_per_night"]), float(it["cleaning_fee"])
        city = it["city"]
        listings.append((
            lid, host, it["title"], it["description"], Raw(f"'{it['property_type']}'::property_type"), city,
            it["neighborhood"], f"پلاک {rng.randint(1, 90)}، کوچه‌ی نمونه، {it['neighborhood']}، {CITY_FA[city]}",
            it["latitude"], it["longitude"], Raw(f"ST_SetSRID(ST_MakePoint({plon}, {plat}), 4326)::geography"),
            it["max_guests"], it["pets_allowed"], 1 if it["pets_allowed"] else 0, it["bedrooms"], it["beds"],
            float(it["bathrooms"]), price, cleaning, "IRR",
            (dt.date(2019, 1, 1) + dt.timedelta(days=rng.randint(0, 1800))).isoformat(),
        ))
        photos.extend(photos_for(lid, it["property_type"], it["bedrooms"], it["amenities"], rng, manifest))
        amen_rows.extend((lid, name) for name in sorted(it["amenities"]))
        x = {"amenities": json.dumps(["Pets allowed"] if it["pets_allowed"] else []), "accommodates": it["max_guests"]}
        # past stays, newest first, one behind each review
        check_out = dt.date(2026, 10, 1) - dt.timedelta(days=rng.randint(5, 40))
        for r in it["reviews"]:
            nights = rng.randint(1, 14)  # as in the rest of the demo; the columns now hold IRR totals
            check_in = check_out - dt.timedelta(days=nights)
            guest = rng.choice(fa_guests)
            bid = len(bookings) + 1
            bk = make_booking(bid, lid, guest, check_in, check_out, it["max_guests"], x, price, cleaning, "IRR",
                              "completed", rng)
            bk[-1] = (dt.datetime.combine(check_in, dt.time(12)) - dt.timedelta(days=rng.randint(3, 40))
                      ).strftime("%Y-%m-%d %H:%M:%S+00")
            bookings.append(bk)
            written = check_out + dt.timedelta(days=rng.randint(0, 10))
            stars = [max(1, min(5, r["rating"] + rng.choice((-1, 0, 0, 0)))) for _ in range(6)]
            reviews.append([bid, lid, guest, r["rating"], *stars, r["comment"],
                            f"{written.isoformat()} {rng.randint(8, 22):02d}:{rng.randint(0, 59):02d}:00+00"])
            check_out = check_in - dt.timedelta(days=rng.randint(3, 60))
        offset = rng.randint(5, 30)
        for _ in range(rng.randint(0, 2)):
            nights = rng.randint(1, 14)  # as in the rest of the demo; the columns now hold IRR totals
            bid = len(bookings) + 1
            bk = make_booking(bid, lid, rng.choice(fa_guests), offset, offset + nights, it["max_guests"], x, price,
                              cleaning, "IRR", "confirmed", rng)
            bk[3], bk[4] = city_day(city, offset), city_day(city, offset + nights)
            bk[-1] = Raw(f"now() - interval '{rng.randint(1, 30)} days'")
            bookings.append(bk)
            offset += nights + rng.randint(2, 20)
    too_big = [b[0] for b in bookings if b[12] == "IRR" and float(b[11]) > MAX_STORED_AMOUNT]
    if too_big:
        raise SystemExit(f"IRR total_price over NUMERIC(14,2) for bookings {too_big[:5]} (specs/backend (002))")
    return {"first_listing_id": first_id, "listings": len(items)}


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
            str(uuid.uuid5(NAMESPACE, f"booking-{bid}")), None, None]


EDGE_ROWS = [
    ("hold_about_to_expire", "Pending hold of the demo guest, 4 minutes left at load time", "`GET /me/bookings` as `guest@example.com`"),
    ("expired_hold", "Expired hold of the demo guest", "`GET /me/bookings` as `guest@example.com`"),
    ("year_long_stay", "Confirmed stay of exactly 365 nights", "`GET /listings/{id}/bookings` as its host"),
    ("last_bookable_day", "Check-in on the last bookable day (city today + 365)", "`GET /listings/{id}/bookings` as its host"),
    ("same_day_turnover", "Two confirmed stays: one checks out the day the next checks in", "`GET /listings/{id}/bookings` as its host"),
    ("inactive_listing", "Inactive listing with a finished and an upcoming booking", "missing from `GET /search/listings`, shown in the host's `GET /me/listings`"),
    ("listing_without_reviews", "Active listing with no reviews (`review_count = 0`)", "`GET /listings/{id}` and its `/reviews`"),
    ("pending_listing", "Listing waiting for an admin's review, with its finished stays", "first in `GET /admin/listings/pending`; missing from search"),
    ("rejected_listing", "Listing an admin rejected, with the reason", "the host's `GET /me/listings`; missing from search"),
]


def write_edge_cases(edge_cases):
    public = {k: {f: v for f, v in e.items() if f != "host_id"} for k, e in edge_cases.items()}
    OUT_EDGE.write_text(json.dumps(public, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    lines = ["| Case | What | Listing | Bookings | Where to see it |", "| --- | --- | --- | --- | --- |"]
    for key, what, where in EDGE_ROWS:
        e = edge_cases[key]
        ids = ", ".join(str(b) for b in e["booking_ids"]) or "–"
        lines.append(f"| `{key}` | {what} | {e['listing_id']} ({e['city']}) | {ids} | {where} |")
    start, end = "<!-- edge-cases:start -->", "<!-- edge-cases:end -->"
    text = README.read_text(encoding="utf-8")
    if start not in text or end not in text:
        raise SystemExit(f"{README.relative_to(ROOT)} needs the {start} and {end} markers")
    head, rest = text.split(start, 1)
    _, tail = rest.split(end, 1)
    README.write_text(f"{head}{start}\n" + "\n".join(lines) + f"\n{end}{tail}", encoding="utf-8")


REJECTION_REASON = "عکس‌ها مال این خانه نیستند. لطفاً عکس‌های خود خانه را بگذارید."


def review_sql(admin, edge_cases):
    """New listings are pending by default (migration 0006), so the demo says what it means: every
    listing is approved, except the two review edge cases (research R5, R15)."""
    pending, rejected = edge_cases["pending_listing"], edge_cases["rejected_listing"]
    return f"""-- listing review (specs/backend (004)): the column default is 'pending', so approve
-- every listing explicitly, then make the two review edge cases.
UPDATE listings SET review_status = 'approved', submitted_at = NULL;
UPDATE listings SET review_status = 'pending', submitted_at = now() - interval '2 days'
WHERE id = {pending["listing_id"]};
UPDATE listings SET review_status = 'rejected', submitted_at = now() - interval '3 days',
       rejection_reason = {sql(REJECTION_REASON)}
WHERE id = {rejected["listing_id"]};
INSERT INTO listing_review_events (listing_id, action, actor_id, review_version, reason, created_at) VALUES
  ({pending["listing_id"]}, 'submitted', {pending["host_id"]}, 0, NULL, now() - interval '2 days'),
  ({rejected["listing_id"]}, 'submitted', {rejected["host_id"]}, 0, NULL, now() - interval '3 days'),
  ({rejected["listing_id"]}, 'rejected', {admin}, 0, {sql(REJECTION_REASON)}, now() - interval '1 day');
"""


def write(users, listings, photos, amen_rows, bookings, reviews, inactive_listing, edge_cases, persian, admin):
    cities = ", ".join(c[0] for c in CITIES)
    parts = [f"""-- =====================================================================
-- Caravansara demo data. GENERATED by db/demo/build_demo_seed.py: do not edit by hand.
-- Source: Inside Airbnb (https://insideairbnb.com), CC BY 4.0; cities: {cities}.
-- Persian listings in Tehran, Isfahan and Shiraz are hand-written (db/demo/fa_listings.json).
-- People, addresses, cleaning fees, per-review stars, bookings and photos are synthetic.
-- Requires: schema.sql, seed_amenities.sql, seed_locations.sql, and an empty database.
-- Every demo account's password: {DEMO_PASSWORD}
--   host@example.com  (Sara Lindqvist, hosts 3 Amsterdam listings)
--   guest@example.com (Omar Haddad: upcoming stays, a finished stay open for review,
--                      a hold that expires 4 minutes after loading, and an expired hold)
--   admin@example.com (Ava Moradi, admin: POST /api/v1/admin/auth/login; never loaded in production)
-- Edge cases with their ids: db/demo/README.md (and db/demo/edge_cases.json).
-- {len(users)} users, {len(listings)} listings, {len(photos)} photos, {len(bookings)} bookings, {len(reviews)} reviews.
-- =====================================================================
BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users) OR EXISTS (SELECT 1 FROM listings) THEN
    RAISE EXCEPTION 'seed_demo.sql expects empty users and listings tables';
  END IF;
END $$;
""",
        values_insert("users", ["id", "email", "password_hash", "full_name", "created_at"],
                      [(u[0], u[1], PASSWORD_HASH, u[2], u[3]) for u in users if u[0] != admin],
                      "OVERRIDING SYSTEM VALUE "),
        "-- the demo admin: the only account of kind 'admin' (made by create-admin outside the demo)\n"
        + values_insert("users", ["id", "email", "password_hash", "full_name", "created_at", "kind"],
                        [(u[0], u[1], PASSWORD_HASH, u[2], u[3], Raw("'admin'::account_kind"))
                         for u in users if u[0] == admin], "OVERRIDING SYSTEM VALUE "),
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
                                   "total_price", "currency", "status", "idempotency_key", "hold_expires_at",
                                   "created_at"],
                      bookings, "OVERRIDING SYSTEM VALUE "),
        "-- the reviews_rating_sync trigger fills listings.avg_rating / review_count\n"
        + values_insert("reviews", ["booking_id", "listing_id", "guest_id", "rating", "cleanliness_rating",
                                    "accuracy_rating", "check_in_rating", "communication_rating",
                                    "location_rating", "value_rating", "comment", "created_at"], reviews),
        review_sql(admin, edge_cases),
        f"""-- edge case: an inactive listing that still has bookings
UPDATE listings SET is_active = false WHERE id = {inactive_listing};

-- move identity sequences past the explicit ids
SELECT setval(pg_get_serial_sequence('users', 'id'),    (SELECT max(id) FROM users));
SELECT setval(pg_get_serial_sequence('listings', 'id'), (SELECT max(id) FROM listings));
SELECT setval(pg_get_serial_sequence('bookings', 'id'), (SELECT max(id) FROM bookings));

COMMIT;
"""]
    OUT_SQL.write_text("\n".join(parts), encoding="utf-8")
    write_edge_cases(edge_cases)
    print(f"wrote {OUT_SQL.relative_to(ROOT)}: {len(users)} users, {len(listings)} listings "
          f"({persian['listings']} Persian from id {persian['first_listing_id']}), {len(photos)} photos, "
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
