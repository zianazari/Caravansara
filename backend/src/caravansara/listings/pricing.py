"""Daily pricing, shared by quotes, search and bookings. All percentages apply to the base price."""

import uuid
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from itertools import pairwise
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from caravansara.core.errors import Unprocessable

Percent = Annotated[Decimal, Field(ge=-99, le=1000, max_digits=6, decimal_places=2)]


class PriceRange(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=100)
    start: date
    end: date = Field(description="Last night included in this rule (inclusive).")
    percent: Percent
    enabled: bool = True

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def valid_dates(self) -> Self:
        if self.end < self.start:
            raise ValueError("The range end must be on or after its start.")
        return self


class PricingPolicy(BaseModel):
    weekend_enabled: bool = False
    weekend_days: list[Annotated[int, Field(ge=0, le=6)]] = Field(
        default_factory=lambda: [3, 4], max_length=7, description="Monday=0 through Sunday=6; host-selectable."
    )
    weekend_percent: Percent = Decimal(30)
    holiday_enabled: bool = False
    holiday_percent: Percent = Decimal(100)
    ranges: list[PriceRange] = Field(default_factory=list, max_length=100)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def no_ambiguity(self) -> Self:
        if len(set(self.weekend_days)) != len(self.weekend_days):
            raise ValueError("Weekend days must be unique.")
        if self.weekend_enabled and not self.weekend_days:
            raise ValueError("Select at least one weekend day.")
        if len({r.id for r in self.ranges}) != len(self.ranges):
            raise ValueError("Rule IDs must be unique.")
        active = sorted((r for r in self.ranges if r.enabled), key=lambda r: r.start)
        if any(a.end >= b.start for a, b in pairwise(active)):
            raise ValueError("Active custom date ranges must not overlap.")
        return self


class NightlyPrice(BaseModel):
    date: date
    amount: Decimal
    percent: Decimal
    source: Literal["base", "weekend", "holiday", "custom"]
    label: str | None = None


class PriceQuote(BaseModel):
    listing_id: int
    check_in: date
    check_out: date
    currency: str
    base_price: Decimal
    cleaning_fee: Decimal
    stay_total: Decimal
    total_price: Decimal
    nights: list[NightlyPrice]


def calculate_quote(
    listing_id: int,
    base: Decimal,
    cleaning: Decimal,
    currency: str,
    policy: PricingPolicy,
    check_in: date,
    check_out: date,
    holidays: dict[date, str],
    *,
    max_nights: int = 365,
) -> PriceQuote:
    count = (check_out - check_in).days
    if count < 1 or count > max_nights:
        raise Unprocessable("invalid_dates", f"Choose between 1 and {max_nights} nights.")
    nights = []
    for offset in range(count):
        day = check_in + timedelta(days=offset)
        percent = Decimal(0)
        source: Literal["base", "weekend", "holiday", "custom"] = "base"
        label: str | None = None
        custom = next((r for r in policy.ranges if r.enabled and r.start <= day <= r.end), None)
        if custom:
            percent, source, label = custom.percent, "custom", custom.name
        elif policy.holiday_enabled and day in holidays:
            percent, source, label = policy.holiday_percent, "holiday", holidays[day]
        elif policy.weekend_enabled and day.weekday() in policy.weekend_days:
            percent, source = policy.weekend_percent, "weekend"
        amount = max(Decimal("0.01"), (base * (1 + percent / 100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
        nights.append(NightlyPrice(date=day, amount=amount, percent=percent, source=source, label=label))
    stay = sum((n.amount for n in nights), Decimal(0))
    total = stay + cleaning
    if total > Decimal("999999999999.99"):
        raise Unprocessable("amount_too_large", "The total for this stay is too large to store.")
    return PriceQuote(
        listing_id=listing_id,
        check_in=check_in,
        check_out=check_out,
        currency=currency,
        base_price=base,
        cleaning_fee=cleaning,
        stay_total=stay,
        total_price=total,
        nights=nights,
    )
