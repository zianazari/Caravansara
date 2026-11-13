# Dynamic pricing and host workspace

Each listing has its own base nightly price, cleaning fee and optional percentage rules. A new policy is
disabled until its host enables it. Weekend days are selectable (Monday=0 through Sunday=6). Percentages
range from -99 to +1000, with up to two decimal places; every adjustment applies to the base price.

For each night the server chooses one rule, in this order:

1. An enabled custom date range, with both start and end nights included.
2. An enabled holiday rule if that date is in the shared calendar for the listing's country.
3. An enabled weekend rule if the weekday is selected.
4. The base nightly price.

Active custom ranges cannot overlap. A zero-percent custom rule still overrides holiday/weekend rates.
Rules can be edited or removed; disabled rules remain available to enable again. The cleaning fee is charged once.
Each night is rounded with decimal half-up rounding to two places, with a minimum positive price of 0.01.
Totals exceeding the database money limit are refused with `amount_too_large`.

## Host and admin controls

The host's listing editor has a **Pricing & calendar** tab with rule settings, custom ranges, and a monthly
Jalali/Gregorian price preview. The preview explicitly shows saved rules; unsaved edits are marked. The
new-listing wizard can set weekend and holiday rules before submission; custom ranges are available in the
listing editor afterward. Prices may change without a new moderation review. Other hosts cannot read or
write this configuration. The host dashboard links directly to each property's price manager.

The admin's **Holidays & pricing** tab maintains holidays by country/date. Saving the same date renames it.
Holidays are maintained manually, not inferred from weekends or imported from an external calendar. Country
and month selectors, localized dates, and deletion controls are provided. Public calendar reads contain only
holiday country, date and name. Administrative writes require an active admin session and same-origin requests
through the admin frontend.

## API and reservation amounts

- `GET/PUT /listings/{id}/pricing`: host-only pricing policy.
- `GET /listings/{id}/pricing/quote?check_in=...&check_out=...`: authoritative daily quote; checkout excluded,
  maximum 365 nights, public listings or their host's own draft. A quote does not reserve availability.
- `GET /holidays?country=IR&start=...&end=...`: shared calendar, end excluded, up to 732 days.
- `GET /admin/countries`, `GET /admin/holidays`, `PUT/DELETE /admin/holidays/{country}/{day}`: admin calendar.
- `POST /bookings`: recalculates the same quote in the server. Optional `expected_total` and `expected_currency`
  are checked; a mismatch returns `409 price_changed`, requiring a fresh confirmation in the web UI. Existing
  callers without these fields still receive the server's authoritative amount.

Booking creation serializes against listing edits with the listing's row lock. It saves the per-night amounts,
applied percentages, source and label in `bookings.nightly_prices`, alongside the booking's base price, currency,
cleaning fee and total. Replay with the same idempotency key returns that saved reservation even after rules
change. Trips and receipts use these snapshots; search cards, listing quotes and booking confirmation share
the same calculation. Existing bookings have an empty nightly snapshot and retain their original totals.

Migration `0012` adds JSONB policy/snapshot columns with empty defaults and the shared `holidays` table; it
does not reprice existing reservations or enable rules for existing listings. OpenAPI and the generated
frontend types document all request/response fields; saved Postman requests cover the new operations.
