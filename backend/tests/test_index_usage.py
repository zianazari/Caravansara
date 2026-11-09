"""Each new index serves the query it was made for (specs/backend (003), T014 and T021).

The test database is tiny, so the planner would read a table instead; ``enable_seqscan = off`` makes it
show which index it can use. The SQL is the catalog's, which test_query_catalog keeps equal to the
app's, and the plan only is asked for: nothing runs.
"""

import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import asyncpg
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine

from caravansara.core.config import Settings
from caravansara.devdata import measure
from caravansara.devdata.load import _plain
from tests.factories import Factory
from tests.helpers import sql
from tests.test_query_catalog import CATALOG_DIR


def index_names(plan: dict[str, Any]) -> Iterator[str]:
    """Every index a plan tree reads, sub-plans included."""
    if "Index Name" in plan:
        yield plan["Index Name"]
    for child in plan.get("Plans", []):
        yield from index_names(child)


@pytest.mark.parametrize(
    ("query", "index"),
    [
        ("listing_bookings_count", "bookings_listing_check_in_idx"),
        ("listing_bookings_page", "bookings_listing_check_in_idx"),
        ("search_radius_5km_london_dates", "bookings_active_stay_idx"),  # the hashed NOT IN list
        ("job_complete_finished_stays", "bookings_confirmed_check_out_idx"),
    ],
)
async def test_query_uses_its_index(
    prepared: Settings, engine: AsyncEngine, factory: Factory, query: str, index: str
) -> None:
    listing = await factory.listing()
    for start in (-20, -10, 5):
        await factory.booking(listing=listing, check_in=start, check_out=start + 3)
    # Like real data, most confirmed stays are still ahead: 300 more, one after another.
    await sql(
        engine,
        """INSERT INTO bookings (listing_id, guest_id, check_in, check_out, adults, nightly_price, cleaning_fee,
                                 total_price, currency, status, idempotency_key)
           SELECT l.id, l.host_id, CURRENT_DATE + 30 + 4 * i, CURRENT_DATE + 33 + 4 * i, 1, l.price_per_night,
                  l.cleaning_fee, 3 * l.price_per_night + l.cleaning_fee, l.currency, 'confirmed', gen_random_uuid()
           FROM listings l, generate_series(0, 299) i WHERE l.id = :id""",
        id=listing["id"],
    )
    today = datetime.now(UTC).date()
    chosen = {
        "busy_listing": listing["id"], "london_lat": 52.37, "london_lng": 4.88,
        "check_in": today + timedelta(days=5), "check_out": today + timedelta(days=8), "now": datetime.now(UTC),
    }  # fmt: skip
    q = next(q for q in measure.load_catalog(CATALOG_DIR)[0] if q.name == query)
    conn = await asyncpg.connect(_plain(prepared.database_url))
    try:
        await conn.execute("ANALYZE bookings")
        await conn.execute("SET enable_seqscan = off")
        raw = await conn.fetchval("EXPLAIN (FORMAT JSON) " + measure.bind(q, chosen))
    finally:
        await conn.close()
    plan = json.loads(raw)[0]["Plan"]
    assert index in set(index_names(plan)), f"{query} plan: {json.dumps(plan)[:2000]}"
