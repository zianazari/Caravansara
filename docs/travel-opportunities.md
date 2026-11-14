# Travel opportunities (053)

An optional discovery page at `/{locale}/opportunities`, separate from the existing
Where / When / Who search. A total budget, currency, country, optional city, guest
counts, preferred arrival, nights (1–30), and flexibility (0–7 days either side)
produce up to three distinct public listings. Persian uses Jalali dates and toman;
the API continues to receive Gregorian dates and rial. No currency conversion.

## Contract

`GET /api/v1/search/opportunities` is public and read-only. Required parameters:
`budget`, `currency`, `preferred_check_in`. Optional: `country=IR`, `city_id`,
`nights=3`, `flex_days=3`, `adults=2`, `children=0`, `infants=0`, `pets=0`.
The budget includes every night's dynamic price and the cleaning fee. Infants do
not count against capacity. Pets must fit the listing's allowance.

Every candidate date must be bookable in the listing city's timezone and have no
overlap with a confirmed/completed booking or an unexpired unpaid hold. Expired
holds do not block. Pricing reuses the same Decimal calculation and shared holiday
calendar as checkout, including custom > holiday > weekend > base precedence.

Selections are deterministic: cheapest total, highest reviewed rating within
budget, then the largest saving by moving the dates. Each property appears once;
an unrated or non-saving alternative has an honest alternative label. Savings
compare the same property and same number of nights with the preferred dates,
and are only claimed when those reference dates are available. Fewer than three
matches returns fewer cards; no matches returns an empty result, never a suggestion
above budget. The response includes exact dates, stay/cleaning/total amounts,
optional reference total and savings, and only the approximate public location.

The scan is country/currency scoped and streamed in batches, with bookings fetched
in the same query. Nightly amounts and blocked-night prefix sums are computed once
per property for at most 44 nights; only the top three per ranking are retained.
No arbitrary candidate cap silently changes the cheapest result. This first
version has no distance or travel-cost estimate: the budget covers accommodation.

Opening a result transfers dates and all guest counts into the existing booking
flow. Discovery does not reserve inventory; checkout rechecks availability and
requires acknowledgement if the quote changes. Existing search, filters, maps,
and booking behavior retain their current routes.
