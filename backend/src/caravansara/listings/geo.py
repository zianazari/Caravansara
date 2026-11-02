"""The public map pin: the real point moved 100–500 m in a random direction.

It is computed once and stored. Computing a fresh offset per request would let anyone
average many responses back to the real address.
"""

import math
import secrets

EARTH_RADIUS_M = 6_371_008.8
MIN_OFFSET_M = 100
MAX_OFFSET_M = 500

_rng = secrets.SystemRandom()


def destination(lat: float, lng: float, bearing_deg: float, distance_m: float) -> tuple[float, float]:
    """Point reached from (lat, lng) going ``distance_m`` along ``bearing_deg`` on a sphere."""
    phi1 = math.radians(lat)
    lam1 = math.radians(lng)
    theta = math.radians(bearing_deg)
    delta = distance_m / EARTH_RADIUS_M
    phi2 = math.asin(math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(theta))
    lam2 = lam1 + math.atan2(
        math.sin(theta) * math.sin(delta) * math.cos(phi1),
        math.cos(delta) - math.sin(phi1) * math.sin(phi2),
    )
    lng2 = (math.degrees(lam2) + 540) % 360 - 180  # wrap across the 180° meridian
    return math.degrees(phi2), lng2


def fuzz(lat: float, lng: float) -> tuple[float, float]:
    return destination(lat, lng, _rng.uniform(0, 360), _rng.uniform(MIN_OFFSET_M, MAX_OFFSET_M))


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def point_wkt(lat: float, lng: float) -> str:
    """WKT takes longitude first, like ``ST_MakePoint``."""
    return f"SRID=4326;POINT({lng:.7f} {lat:.7f})"
