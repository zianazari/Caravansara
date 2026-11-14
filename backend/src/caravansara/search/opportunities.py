"""Explainable travel suggestions. Shared quotes, exact amounts and bounded leaderboards."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from caravansara.catalog import service as catalog
from caravansara.core.config import Settings
from caravansara.core.errors import Unprocessable
from caravansara.core.storage import Storage
from caravansara.core.timeutil import today_in, utcnow
from caravansara.listings import service as listings
from caravansara.listings.schemas import PricingPolicy
from caravansara.search import repository as repo
from caravansara.search.schemas import OpportunityPage, OpportunityQuery, SearchPin, SearchResult, TravelOpportunity


def _cheapest(item: TravelOpportunity) -> tuple[Decimal, int, date, int]:
    return item.total_price, abs(item.shift_days), item.check_in, item.listing.id


def _experience(item: TravelOpportunity) -> tuple[Decimal, int, Decimal, int, date, int]:
    rating = item.listing.avg_rating if item.listing.review_count else None
    return (-(rating or Decimal(0)), -item.listing.review_count, *_cheapest(item))


def _savings(item: TravelOpportunity) -> tuple[Decimal, Decimal, int, date, int]:
    return (-(item.savings or Decimal(0)), *_cheapest(item))


def _candidate(
    row: dict[str, Any],
    query: OpportunityQuery,
    start: date,
    end: date,
    holidays: dict[date, str],
    today: date,
    settings: Settings,
    storage: Storage,
) -> TravelOpportunity | None:
    first = max(start, today)
    last = min(end - timedelta(days=query.nights), today + timedelta(days=settings.max_days_ahead))
    if first > last:
        return None
    stop = last + timedelta(days=query.nights)
    quote = listings.calculate_quote(
        row["id"],
        row["price_per_night"],
        row["cleaning_fee"],
        row["currency"],
        PricingPolicy.model_validate(row["pricing_policy"]),
        first,
        stop,
        holidays,
    )
    # Prefix sums make every candidate arrival O(1), including stays crossing a taken night.
    prices = [Decimal(0)]
    blocked = [0]
    ranges = [(date.fromisoformat(b["start"]), date.fromisoformat(b["end"])) for b in row["blocked"]]
    for night in quote.nights:
        prices.append(prices[-1] + night.amount)
        blocked.append(blocked[-1] + int(any(a <= night.date < b for a, b in ranges)))

    def total(arrival: date) -> Decimal | None:
        if not first <= arrival <= last:
            return None
        index = (arrival - first).days
        out = index + query.nights
        if blocked[out] != blocked[index]:
            return None
        fee: Decimal = row["cleaning_fee"]
        return prices[out] - prices[index] + fee

    available = [
        (amount, first + timedelta(days=i))
        for i in range((last - first).days + 1)
        if (amount := total(first + timedelta(days=i))) is not None and amount <= query.budget
    ]
    if not available:
        return None
    amount, arrival = min(
        available, key=lambda pair: (pair[0], abs((pair[1] - query.preferred_check_in).days), pair[1])
    )
    reference = total(query.preferred_check_in)
    saving = reference - amount if reference is not None and reference > amount else None
    listing = SearchResult(
        **{
            key: row[key]
            for key in (
                "id",
                "title",
                "property_type",
                "city",
                "country_code",
                "avg_rating",
                "review_count",
                "max_guests",
                "price_per_night",
                "cleaning_fee",
                "currency",
            )
        },
        pin=SearchPin(lat=row["pin_lat"], lng=row["pin_lng"]),
        distance_km=None,
        total_price=amount,
        cover_url=storage.public_url(row["cover_key"]) if row["cover_key"] else None,
    )
    return TravelOpportunity(
        kind="alternative",
        listing=listing,
        check_in=arrival,
        check_out=arrival + timedelta(days=query.nights),
        nights=query.nights,
        total_price=amount,
        cleaning_fee=row["cleaning_fee"],
        stay_total=amount - row["cleaning_fee"],
        shift_days=(arrival - query.preferred_check_in).days,
        reference_total=reference if saving else None,
        savings=saving,
    )


async def find_opportunities(
    session: AsyncSession, storage: Storage, settings: Settings, query: OpportunityQuery
) -> OpportunityPage:
    now = utcnow()
    # Reject far-out dates before doing arithmetic, while allowing the world's local-date difference.
    utc_today = now.date()
    if (
        not utc_today - timedelta(days=1)
        <= query.preferred_check_in
        <= utc_today + timedelta(days=settings.max_days_ahead + 1)
    ):
        raise Unprocessable("invalid_dates", "Choose an arrival within the booking horizon.")
    if query.nights > settings.max_nights:
        raise Unprocessable("invalid_dates", "Too many nights for one booking.")
    start = query.preferred_check_in - timedelta(days=query.flex_days)
    end = query.preferred_check_in + timedelta(days=query.flex_days + query.nights)
    holidays = {h.day: h.name for h in await catalog.holidays(session, query.country, start, end)}
    cheap: list[TravelOpportunity] = []
    rated: list[TravelOpportunity] = []
    saving: list[TravelOpportunity] = []
    matched = 0
    async for row in repo.opportunity_candidates(session, query, start, end):
        item = _candidate(row, query, start, end, holidays, today_in(row["timezone"], now), settings, storage)
        if item is None:
            continue
        matched += 1
        cheap = sorted([*cheap, item], key=_cheapest)[:3]
        rated = sorted([*rated, item], key=_experience)[:3]
        if item.savings:
            saving = sorted([*saving, item], key=_savings)[:3]
    selected: list[TravelOpportunity] = []
    for choices, kind in (
        (cheap, "economical"),
        (rated, "experience"),
        (saving or cheap, "flexible" if saving else "alternative"),
    ):
        used = {item.listing.id for item in selected}
        chosen = next((item for item in choices if item.listing.id not in used), None)
        if chosen:
            actual_kind = "alternative" if kind == "experience" and not chosen.listing.review_count else kind
            selected.append(chosen.model_copy(update={"kind": actual_kind}))
    # A saving pool may contain only the already chosen properties; still offer a third distinct match.
    if len(selected) < min(3, matched):
        used = {item.listing.id for item in selected}
        selected.extend(item for item in cheap if item.listing.id not in used)
    return OpportunityPage(items=selected[:3], matched_listings=matched)
