"""Bulk data generator: rows drawn from the city profiles, with no database I/O.

Each listing has its own RNG, ``Random(f"{seed}:{listing_id}")``. Its bookings and reviews come
from the same RNG, so every table can be streamed on its own without holding millions of rows,
and the same (profiles, listings, seed, today) always gives the same rows.
"""

import bisect
import math
import random
import uuid
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta

from caravansara.devdata.profiles import CityProfile, Profiles

Row = tuple[object, ...]

TABLES = ("users", "listings", "listing_photos", "listing_amenities", "bookings", "reviews")
COLUMNS: dict[str, tuple[str, ...]] = {
    "users": ("id", "email", "password_hash", "full_name", "created_at"),
    "listings": (
        "id", "host_id", "title", "description", "property_type", "city_id", "neighborhood", "address",
        "latitude", "longitude", "public_location", "max_guests", "pets_allowed", "max_pets", "bedrooms",
        "beds", "bathrooms", "price_per_night", "cleaning_fee", "currency", "is_active", "created_at",
        "review_status",
    ),
    "listing_photos": ("listing_id", "storage_key", "width", "height", "room_tag", "sort_order"),
    "listing_amenities": ("listing_id", "amenity_id"),
    "bookings": (
        "id", "listing_id", "guest_id", "check_in", "check_out", "adults", "children", "infants", "pets",
        "nightly_price", "cleaning_fee", "total_price", "currency", "status", "hold_expires_at",
        "idempotency_key", "created_at",
    ),
    "reviews": (
        "booking_id", "listing_id", "guest_id", "rating", "cleanliness_rating", "accuracy_rating",
        "check_in_rating", "communication_rating", "location_rating", "value_rating", "comment", "created_at",
    ),
}  # fmt: skip

# argon2id hash of "caravansara-demo", the same as the demo accounts (db/demo/README.md)
SHARED_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$7fwaM/cgT6atxiCcygeWyA$fGFSl+AoIk1b3QdhUfZS30ldTMa9147QwAIgijXzhqA"  # noqa: S105
)
NAMESPACE = uuid.UUID("2b7f6c1e-0d5a-4f8e-9c3b-5a1d7e9f0b42")

PAST_DAYS = 730  # two years of history at the profile's occupancy
FUTURE_DAYS = 365  # bookings open one year ahead (max_days_ahead)
FUTURE_SHARE = 0.4  # fewer nights are booked far ahead than were stayed
GUESTS_PER_LISTING = 3
PHOTOS = (("Living room", 1200, 800), ("Bedroom", 1200, 800), ("Kitchen", 1200, 800))
# stay length in nights -> weight (mean about 4 nights, like Inside Airbnb's occupancy model)
STAY_LENGTHS = (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14)
STAY_WEIGHTS = (12, 20, 20, 14, 10, 6, 8, 2, 2, 2, 1, 1, 1, 1)

FIRST = [
    "Aino",
    "Elias",
    "Sara",
    "Omar",
    "Lena",
    "Mateo",
    "Yara",
    "Noah",
    "Ines",
    "Kai",
    "Mina",
    "Leo",
    "Dara",
    "Arash",
    "Nora",
    "Tariq",
    "Freja",
    "Lucas",
    "Amira",
    "Jonas",
    "Sofia",
    "Ravi",
    "Hana",
    "Felix",
    "Leila",
    "Hugo",
    "Maja",
    "Daniel",
    "Zara",
    "Emil",
    "Laila",
    "Tomas",
    "Nadia",
    "Oskar",
    "Mei",
    "Samir",
    "Clara",
    "Anders",
    "Rosa",
]
LAST = [
    "Virtanen",
    "Jansen",
    "Silva",
    "Nielsen",
    "Andersson",
    "Rahimi",
    "Costa",
    "Larsen",
    "Berg",
    "Haddad",
    "Moreau",
    "Novak",
    "Tanaka",
    "Karimi",
    "Ferreira",
    "Lindqvist",
    "Okafor",
    "Rossi",
    "Schmidt",
    "Hansen",
    "Bakker",
    "Santos",
    "Johansson",
    "Ahmadi",
    "Weber",
    "Kowalski",
    "Dubois",
    "Petrov",
    "Kim",
    "Nazari",
]
ADJECTIVES = ["Bright", "Cosy", "Quiet", "Modern", "Spacious", "Charming", "Sunny", "Stylish", "Calm", "Classic"]
KINDS = {"entire_place": "apartment", "private_room": "private room", "shared_room": "shared room"}
PHRASES = (
    "Great location.", "Very clean and comfortable.", "The host was quick to answer.", "Would stay again.",
    "Exactly as described.", "Check-in was easy.", "Quiet at night.", "Close to the metro.", "Lovely place.",
    "The bed was very comfortable.", "Good value for money.", "Nice neighbourhood with cafes nearby.",
    "A bit small but well equipped.", "The kitchen had everything we needed.", "Fast wifi.", "Bright and airy.",
    "Perfect for a short city trip.", "Walking distance to the centre.", "Some street noise in the morning.",
    "Friendly and helpful host.", "Spotless bathroom.", "The photos match the place.", "Highly recommended.",
    "Stairs are steep, no elevator.", "Comfortable for a family.", "Easy to find.", "Great view.",
    "Towels and linens were fresh.", "Heating worked well.", "We felt at home.",
)  # fmt: skip


@dataclass
class _Listing:
    id: int
    city: CityProfile
    rng: random.Random  # continues into the listing's bookings
    row: Row
    price: float
    cleaning: float
    max_guests: int
    pets_allowed: bool
    max_pets: int
    amenity_ids: list[int] = field(default_factory=list)


def _weighted[K](rng: random.Random, options: Mapping[K, float]) -> K:
    keys = list(options)
    return rng.choices(keys, weights=[options[k] for k in keys])[0]


def _percentile(values: Sequence[float], u: float) -> float:
    """Inverse CDF from 101 percentiles, interpolating linearly."""
    pos = u * 100
    i = min(int(pos), 99)
    return values[i] + (values[i + 1] - values[i]) * (pos - i)


def _move(lat: float, lng: float, rng: random.Random, low_m: float, high_m: float) -> tuple[float, float]:
    d = rng.uniform(low_m, high_m)
    bearing = rng.uniform(0, 2 * math.pi)
    dlat = d * math.cos(bearing) / 111_320
    dlng = d * math.sin(bearing) / (111_320 * math.cos(math.radians(lat)))
    return round(lat + dlat, 6), round(lng + dlng, 6)


def _money(value: float) -> str:
    return f"{value:.2f}"


def _ts(day: date, minutes: int = 600) -> str:
    """A timestamp on ``day``, ``minutes`` after midnight UTC, as text PostgreSQL and Python both read."""
    return (datetime.combine(day, time(0), tzinfo=UTC) + timedelta(minutes=minutes)).isoformat(sep=" ")


def _star(rng: random.Random, mean: float, sd: float) -> int:
    return max(1, min(5, round(rng.gauss(mean, max(sd, 0.3)))))


@dataclass
class BulkData:
    profiles: Profiles
    listing_count: int
    seed: int
    today: date
    city_ids: Mapping[str, int]
    amenity_ids: Mapping[str, int]
    hosts: int = 0
    guests: int = 0
    _bounds: list[int] = field(default_factory=list)  # last listing id of each city, in _cities order
    _cities: list[CityProfile] = field(default_factory=list)

    def __post_init__(self) -> None:
        self._cities = [self.profiles.cities[name] for name in sorted(self.profiles.cities)]
        total = sum(c.listing_count for c in self._cities)
        counts = [self.listing_count * c.listing_count // total for c in self._cities]
        counts[0] += self.listing_count - sum(counts)
        self._bounds = [sum(counts[: i + 1]) for i in range(len(counts))]
        # hosts: listings divided by the listings-per-host mean, weighted by city size
        per_host = sum(n / c.listings_per_host for n, c in zip(counts, self._cities, strict=True))
        self.hosts = max(1, math.ceil(per_host))
        self.guests = GUESTS_PER_LISTING * self.listing_count

    # ---- users ---------------------------------------------------------
    def users(self) -> Iterator[Row]:
        oldest = self.today - timedelta(days=3650)
        for uid in range(1, self.hosts + self.guests + 1):
            name = f"{FIRST[uid % len(FIRST)]} {LAST[(uid // len(FIRST)) % len(LAST)]}"
            created = oldest + timedelta(days=(uid * 7919) % 3600)
            yield (uid, f"bulk.{uid}@example.com", SHARED_PASSWORD_HASH, name, _ts(created))

    # ---- listings ------------------------------------------------------
    def _listing(self, lid: int) -> _Listing:
        city = self._cities[bisect.bisect_left(self._bounds, lid)]
        rng = random.Random(f"{self.seed}:{lid}")
        host = 1 + min(self.hosts - 1, int(self.hosts * rng.random() ** 2))  # a few hosts own many listings
        kind = _weighted(rng, city.room_type_share)
        guests = _weighted(rng, city.accommodates)
        size = city.size_by_accommodates[min(city.size_by_accommodates, key=lambda a: (abs(a - guests), a))]
        bedrooms, beds, baths = (
            rng.choices([v for v, _ in size[p]], weights=[w for _, w in size[p]])[0]
            for p in ("bedrooms", "beds", "bathrooms")
        )
        price = max(1.0, round(_percentile(city.price_percentiles[kind], rng.random()), 2))
        cleaning = 0.0 if rng.random() < 0.25 else float(round(price * rng.uniform(0.1, 0.35)))
        pets = rng.random() < 0.15
        max_pets = rng.randint(1, 2) if pets else 0
        lat, lng = rng.choice(city.points)
        lat, lng = _move(lat, lng, rng, 0, 300)
        plat, plng = _move(lat, lng, rng, 100, 500)  # the public map pin, as the app does it
        active = rng.random() >= 0.03
        created = self.today - timedelta(days=rng.randint(30, 3650))
        amenities = [
            self.amenity_ids[name]
            for name, p in sorted(city.amenity_probability.items())
            if rng.random() < p and name in self.amenity_ids
        ]
        title = f"{rng.choice(ADJECTIVES)} {KINDS[kind]} in {city.name}"
        row: Row = (
            lid, host, title, f"{title}. Sleeps {guests}. Generated bulk data for measurement.", kind,
            self.city_ids[city.name], None, f"{rng.randint(1, 400)} Bulk Street, {city.name}", lat, lng,
            f"SRID=4326;POINT({plng} {plat})", guests, pets, max_pets, int(bedrooms), int(beds),
            round(float(baths), 1), _money(price), _money(cleaning), city.currency, active, _ts(created),
            # Said explicitly: the column default is 'pending' (migration 0006), and bulk data stands
            # for listings that are already public (specs/backend (004), research R5).
            "approved",
        )  # fmt: skip
        return _Listing(lid, city, rng, row, price, cleaning, guests, pets, max_pets, amenities)

    def listings(self) -> Iterator[Row]:
        for lid in range(1, self.listing_count + 1):
            yield self._listing(lid).row

    def listing_photos(self) -> Iterator[Row]:
        for lid in range(1, self.listing_count + 1):
            for order, (tag, width, height) in enumerate(PHOTOS):
                yield (lid, f"bulk/listings/{lid}/{order}.jpg", width, height, tag, order)

    def listing_amenities(self) -> Iterator[Row]:
        for lid in range(1, self.listing_count + 1):
            for amenity in self._listing(lid).amenity_ids:
                yield (lid, amenity)

    # ---- bookings and reviews ------------------------------------------
    def _stays(self, listing: _Listing) -> Iterator[tuple[date, date]]:
        rng = listing.rng
        nights_a_year = _percentile(listing.city.occupancy_l365d, rng.random())
        past = min(0.95, nights_a_year / 365)
        windows = (
            (self.today - timedelta(days=PAST_DAYS), self.today - timedelta(days=1), past),
            (self.today, self.today + timedelta(days=FUTURE_DAYS), past * FUTURE_SHARE),
        )
        cursor = windows[0][0]
        for start, last_check_in, share in windows:
            cursor = max(cursor, start)
            if share <= 0:
                continue
            while True:
                length = rng.choices(STAY_LENGTHS, weights=STAY_WEIGHTS)[0]
                gap = rng.randint(0, round(2 * length * (1 / share - 1)))
                # compare as days first: at near-zero occupancy the gap can exceed the date range
                if gap > (last_check_in - cursor).days:
                    break
                check_in = cursor + timedelta(days=gap)
                cursor = check_in + timedelta(days=length)
                yield check_in, cursor

    def _row(self, bid: int, lid: int, guest: int, stay: Row, status: str, hold: str | None, created: str) -> Row:
        key = str(uuid.uuid5(NAMESPACE, f"bulk-{self.seed}-{bid}"))
        return (bid, lid, guest, *stay, status, hold, key, created)

    def _bookings(self) -> Iterator[tuple[Row, Row | None]]:
        """(booking row, review row or None), with booking ids in listing order."""
        booking_id = 0
        today = self.today
        hold_until = _ts(today + timedelta(days=1), 0)  # pending holds stay open until the day after `today`
        for lid in range(1, self.listing_count + 1):
            listing = self._listing(lid)
            rng = listing.rng
            for check_in, check_out in list(self._stays(listing)):
                lead = rng.randint(1, 90)
                created_day = check_in - timedelta(days=lead)
                if created_day > today:
                    created_day = today - timedelta(days=rng.randint(0, 30))
                created = rng.randint(420, 1380)
                adults = rng.randint(1, min(listing.max_guests, 4))
                children = rng.randint(0, listing.max_guests - adults) if rng.random() < 0.2 else 0
                infants = 1 if rng.random() < 0.05 else 0
                pets = 1 if listing.pets_allowed and rng.random() < 0.1 else 0
                nights = (check_out - check_in).days
                total = _money(listing.price * nights + listing.cleaning)
                r = rng.random()
                hold: str | None = None
                if check_out <= today:
                    status = "cancelled" if r < 0.06 else "completed"
                elif check_in < today:
                    status = "confirmed"  # the guest is staying now
                elif r < 0.001:
                    status, hold = "pending", hold_until
                else:
                    status = "cancelled" if r < 0.081 else "confirmed"

                stay = (
                    check_in, check_out, adults, children, infants, pets, _money(listing.price),
                    _money(listing.cleaning), total, listing.city.currency,
                )  # fmt: skip
                if rng.random() < 0.02:  # an abandoned hold on the same dates before the real booking
                    booking_id += 1
                    guest = self.hosts + rng.randint(1, self.guests)
                    expired_at = _ts(created_day, max(0, created - 45))
                    created_at = _ts(created_day, max(0, created - 60))
                    yield self._row(booking_id, lid, guest, stay, "expired", expired_at, created_at), None
                booking_id += 1
                guest = self.hosts + rng.randint(1, self.guests)
                row = self._row(booking_id, lid, guest, stay, status, hold, _ts(created_day, created))
                review = None
                if status == "completed" and rng.random() < listing.city.review_share:
                    city = listing.city
                    written = check_out + timedelta(days=rng.randint(0, min(13, (today - check_out).days)))
                    stars = [_star(rng, city.rating_mean, city.rating_sd) for _ in range(7)]
                    comment = " ".join(rng.sample(PHRASES, rng.randint(2, 3)))
                    review = (row[0], lid, row[2], *stars, comment, _ts(written, rng.randint(480, 1320)))
                yield row, review

    def bookings(self) -> Iterator[Row]:
        for row, _ in self._bookings():
            yield row

    def reviews(self) -> Iterator[Row]:
        for _, review in self._bookings():
            if review is not None:
                yield review


def generate(
    profiles: Profiles,
    *,
    listings: int,
    seed: int,
    today: date,
    city_ids: Mapping[str, int],
    amenity_ids: Mapping[str, int],
) -> BulkData:
    """Describe the bulk data; rows are produced lazily, one table at a time."""
    if listings < 1:
        raise ValueError("listings must be at least 1")
    return BulkData(profiles, listings, seed, today, city_ids, amenity_ids)
