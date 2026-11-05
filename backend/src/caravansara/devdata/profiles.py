"""City profiles: statistical summaries of real Inside Airbnb listings (db/bulk/city_profiles.json).

Built by db/bulk/build_city_profiles.py. The bulk generator draws every listing from them.
"""

import itertools
import json
from collections.abc import Collection, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOM_TYPES = ("entire_place", "private_room", "shared_room")
_TOLERANCE = 1e-6


class ProfileError(ValueError):
    """The profile file breaks a rule, so bulk data drawn from it would be wrong."""


@dataclass(frozen=True)
class CityProfile:
    name: str
    currency: str
    listing_count: int
    room_type_share: dict[str, float]
    price_percentiles: dict[str, list[float]]  # 101 values per room type
    accommodates: dict[int, float]
    size_by_accommodates: dict[int, dict[str, list[tuple[float, float]]]]  # bedrooms/beds/bathrooms
    amenity_probability: dict[str, float]
    rating_mean: float
    rating_sd: float
    occupancy_l365d: list[float]  # 101 percentiles of booked nights in the last year
    listings_per_host: float
    review_share: float
    points: list[tuple[float, float]]


@dataclass(frozen=True)
class Profiles:
    cities: dict[str, CityProfile]


def _fail(city: str, rule: str) -> ProfileError:
    return ProfileError(f"invalid city profile: {city}: {rule}")


def _check_sum(city: str, name: str, values: Collection[float]) -> None:
    if abs(sum(values) - 1) > _TOLERANCE:
        raise _fail(city, f"{name} must sum to 1")


def _check_rising(city: str, name: str, values: list[float]) -> None:
    if len(values) != 101 or any(b < a for a, b in itertools.pairwise(values)):
        raise _fail(city, f"{name} must rise")


def _city(name: str, raw: Mapping[str, Any], amenity_names: Collection[str] | None) -> CityProfile:
    _check_sum(name, "room_type_share", raw["room_type_share"].values())
    _check_sum(name, "accommodates", raw["accommodates"].values())
    for rt in ROOM_TYPES:
        _check_rising(name, f"price_percentiles.{rt}", raw["price_percentiles"][rt])
    _check_rising(name, "occupancy_l365d", raw["occupancy_l365d"])
    size: dict[int, dict[str, list[tuple[float, float]]]] = {}
    for acc, parts in raw["size_by_accommodates"].items():
        size[int(acc)] = {}
        for part, pairs in parts.items():
            _check_sum(name, f"size_by_accommodates.{acc}.{part}", [p for _, p in pairs])
            size[int(acc)][part] = [(float(v), float(p)) for v, p in pairs]
    if amenity_names is not None:
        for amenity in raw["amenity_probability"]:
            if amenity not in amenity_names:
                raise _fail(name, f"unknown amenity {amenity}")
    return CityProfile(
        name=name,
        currency=raw["currency"],
        listing_count=int(raw["listing_count"]),
        room_type_share={k: float(v) for k, v in raw["room_type_share"].items()},
        price_percentiles={k: [float(x) for x in v] for k, v in raw["price_percentiles"].items()},
        accommodates={int(k): float(v) for k, v in raw["accommodates"].items()},
        size_by_accommodates=size,
        amenity_probability={k: float(v) for k, v in raw["amenity_probability"].items()},
        rating_mean=float(raw["rating"]["mean"]),
        rating_sd=float(raw["rating"]["sd"]),
        occupancy_l365d=[float(x) for x in raw["occupancy_l365d"]],
        listings_per_host=float(raw["listings_per_host"]["mean"]),
        review_share=float(raw["review_share"]),
        points=[(float(lat), float(lng)) for lat, lng in raw["points"]],
    )


def load(path: Path, *, amenity_names: Collection[str] | None = None) -> Profiles:
    """Read and check the profile file. ``amenity_names`` is the catalog to check amenities against."""
    doc = json.loads(path.read_text(encoding="utf-8"))
    return Profiles(cities={name: _city(name, raw, amenity_names) for name, raw in sorted(doc["cities"].items())})
