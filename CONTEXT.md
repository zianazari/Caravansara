# Caravansara: project context

Last updated: 2026-11-14 (Europe/Helsinki).

Caravansara (کاروانسرا) is a Persian/English place reservation site. This is the handoff for continuing work
in `/Users/zia/Caravansara`. Read `README.md`, `docs/backend-design.md` and `docs/dynamic-pricing.md` for current
behavior. `specs/` records historical features 001–008; its old scope/defaults are not the current specification.

## Current application

- Next.js 16 / React 19 / TypeScript / Tailwind / next-intl. Persian RTL with local Vazirmatn; English at `/en`.
- FastAPI / Python 3.13 / SQLAlchemy async / PostgreSQL 16 + PostGIS. API contract: `backend/openapi.json`.
- Object storage through S3 APIs (MinIO locally). Listing photos upload directly; profile pictures go through
  the API for validation. Mailpit receives development email; the outbox commits with its business event.
- A member can host and travel. Admins are separate account kinds created only by `caravansara create-admin`.
- Guests search by city or public map area, choose dates/guests, reserve a 15-minute hold, pay through the
  simulated flow, view receipts and trips, save favourites and review completed stays.
- Hosts create a listing through eight steps, upload at least five photos, manage its status/photos/bookings,
  and set prices independently for each listing. Descriptive edits need review; price changes do not.
- Admins review listings (exact address access is recorded), manage users/bookings lists and the shared holiday
  calendar. Every table column sorts across all matching records before pagination. Review queue sorting
  supports submission time, title, city and host; newest submissions are the default.

## Local frontend (055: unified)

- One dark/orange site: `http://localhost:3001/fa` (or `/en`). Admin: `http://admin.localhost:3001`.
- The cinematic version is moved unchanged to port 3001, with compact search, popular destinations,
  city rows and opportunity discovery. Public, host and admin use one palette and build.
- The separate cinematic compose service and runtime design switch are removed. `npm run dev`
  renders the same home as compose. No frontend is served on port 3011.
- Existing API, database, accounts, photos, bookings, pricing and email settings are preserved.

```bash
docker compose up -d --build --wait
```

For API/schema changes, build the API image, apply migrations with
`docker compose run --rm --no-deps api caravansara migrate`, then recreate services. Never reset the database.

## Dynamic pricing (migration 0012)

See `docs/dynamic-pricing.md` for the full contract and endpoint list.

- Each listing owns a JSONB `pricing_policy`; enabled weekend/holiday rules and up to 100 named date ranges.
- Percentages apply to base price, -99% through +1000%, at most two decimal places. Weekend days are selectable
  with Monday=0 through Sunday=6. Defaults are disabled, with +30% weekend and +100% holiday values ready to enable.
- Per-night priority is **custom date range → shared holiday → selected weekend → base**. Rules do not stack.
  On 2026-11-13, all 56 Iranian listings in the local database were set to Thursday/Friday (`[3, 4]`), preserving
  enabled flags, percentages and other rules. Iranian new-listing defaults already use those days.
  Later that day, at the owner's request, weekend pricing was enabled for all 57 existing Iranian listings
  (all currently +30%). Other policies/countries and 11,688 saved booking price snapshots were verified unchanged.
  Custom range endpoints are inclusive; active custom ranges cannot overlap. Disabled rules are retained.
- `holidays` is a shared country/date calendar maintained manually in the admin's Holidays & pricing tab.
  The host chooses the holiday percentage; holiday data is not imported automatically.
- Quotes exclude checkout, round each night with decimal half-up rounding, and charge cleaning once. Search
  totals, listing/checkout quotes and reservations use the same calculation.
- Reservation creation locks the listing against concurrent edits and checks optional `expected_total` and
  `expected_currency`; mismatches are `409 price_changed`. Browser checkout refreshes and requires confirmation.
- `bookings.nightly_prices` saves each night's price, source, percentage and label. Trips and receipts use this
  snapshot. Old bookings keep their totals and have an empty snapshot. Idempotent replay returns the saved booking.
- Host editor has a Pricing & calendar tab with localized monthly prices and marked unsaved edits. The wizard
  can set recurring rules; custom date ranges are managed after creating the listing.

## Data and invariants

Guest calendars now show nightly guide prices from the existing quote endpoint. `NightlyPriceCalendar`
is shared by inline availability and `BookingDatePicker`. The dialog stages dates until confirmation,
shows an exact range quote, and preserves checkout on the first booked date without charging that night.
IRR calendar cells use one captioned toman unit; exact money remains in summaries and accessible descriptions.
Iranian Thursday/Friday price text is accented even with weekend adjustments disabled, based on the
listing's country code rather than page language or currency. Calendar identification does not reprice stays.

- Current schema is Alembic head `0013`: **18 application tables**, excluding PostGIS/Alembic system tables.
- `db/schema.sql`, `db/schema.dbml`, `db/erd.mmd` and `db/erd.png` are maintained reference snapshots; migrations
  are authoritative. Migration 0001 is an embedded historical copy, not a live read of `db/schema.sql`.
- PostgreSQL excludes overlapping active booking ranges `[check_in, check_out)` and uniquely stores idempotency
  keys. City time zones govern booking dates, cancellation and completion.
- Search uses stored fuzzed public locations. Exact addresses are only for hosts, confirmed/completed guests
  and authenticated admins reviewing a listing; admin views are recorded.
- Reviews require completed bookings and one review per booking; triggers keep rating aggregates in sync.
- `db/seed_locations.sql` has seven countries and nine cities. Demo/bulk recipes and counts live in their own
  READMEs; never infer the current developer database size from a seed recipe.
- Bulk performance data lives in its separate `_bulk` database. Do not run replacement/reset commands against
  the application's configured database. Query coverage is tracked in `db/bulk/queries/catalog.json`.

Email login (054): members can request a five-digit code alongside password login.
`/auth/email-code/request` returns a generic challenge; `/auth/email-code/verify`
redeems it once into the normal member tokens. API background tasks use the existing
SMTP sender, shared with the worker in compose. Codes last five minutes; resend
cooldown is sixty seconds, with per-address/IP limits and five failed checks across
resends. Only keyed HMACs are stored; expired challenges are purged after one day.
Admin email login uses `/admin/auth/email-code/{request,verify}` with purpose-bound
codes/address digests and active-admin checks at redemption. It keeps the 15-minute
admin token and eight-hour rotating session; `/admin-api/email-code/*` stores both
tokens in HttpOnly panel cookies and exposes only the session lifetime. The panel
defaults to email and retains a password option. No further migration is needed.
Admin/member login share `AuthPanel` and `AuthMethods`: the same logo, centered
heading, card dimensions, spacing and method selector. The admin password submit
and error state also match the member form. Verified in both languages at 320/1440 px
with equal computed card styles; 29 related component tests and both real-browser
admin email sign-in tests passed after the style update. The local web image is current.
The durable business-email outbox remains separate. The web's
same-origin `/session/email-code/*` handlers protect refresh tokens as before.
See `docs/email-login.md`.

Email-code input: five visual cells with one labelled native control. Supports Persian/Arabic
digits, leading zeroes, full/partial paste, click-to-replace, arrow keys, Backspace and browser
autofill. Verified in the real mobile login flow on port 3001; API remains five digits.

## Working conventions

Feature 053 adds an optional `/{locale}/opportunities` page and public
`GET /search/opportunities`. It scans available public listings in one country and
currency, compares exact nightly pricing plus cleaning against a total budget,
and returns up to three distinct suggestions. Savings require an available
same-property reference stay. Dates and all guest counts transfer to the existing
booking flow. Country/currency/city are optional UI refinements; classic search is
unchanged. See `docs/travel-opportunities.md`. No schema migration or new service.

- Never add a Codex attribution/signature to git commits, PRs, issues or comments.
- Preserve existing local work. Use the current feature branch; do not merge or rewrite remote history without
  authorization. This session uses `053-travel-opportunities` on `github.com/zianazari/Caravansara`.
- No Spec Kit workflow from feature 009 onward. Record current constructs, reasons and effects in design docs;
  preserve historical specs as history. Maintain Markdown/PDF and database diagrams together.
- Modules reach other modules through services/schema contracts, not their ORM models/repositories; import-linter
  enforces this. Admin/search cross-module reads use fixed SQL with bound values and allowlisted ordering.
- Read `frontend/AGENTS.md` and relevant locally installed Next.js docs before frontend changes.
- Edit `frontend/scripts/messages_source.py`, then run it to regenerate messages; do not edit translations alone.
- Regenerate `backend/openapi.json` after API changes, then run `npm run gen:api` in `frontend/`.
- Access tokens are in browser memory; refresh tokens are HttpOnly cookies. Admin tokens stay entirely in
  HttpOnly cookies under `/admin-api`; non-GET admin forwarding checks same origin, including PUT/DELETE.
- Keep monetary arithmetic exact (Decimal on the server, BigInt hundredths in frontend calculations). Rial is
  stored in the API/database and displayed/entered as toman where appropriate.
- Run checks appropriate to the change; avoid repeating broad suites after they pass unless new edits justify it.

## Validation and tools

- Backend: `uv run pytest --cov`, `uv run ruff check src tests migrations`, `uv run ruff format --check src tests migrations`,
  `uv run mypy`, `uv run lint-imports`. Tests start isolated PostgreSQL/PostGIS and MinIO containers.
- Frontend: `npm run gen:api`, lint, format check, typecheck, `npm test -- --coverage`, build. Coverage gates apply
  to rules/API, not every component. The current frontend suite has 524 tests; the backend suite has 461.
- E2E: 142 tests collected. Start base + `e2e/compose.e2e.yml` for the single site and fixture account
  creation uses test rate limits. See `e2e/README.md`. Restore normal API settings after verification.
- Latest local frontend verification (055): the original 3011 and new 3001 matched in hero image,
  heading, sections and computed palette in both languages. Port 3011 is closed and its container/
  compose service removed. 516 frontend tests with coverage, lint, types and production build pass.
  Backend code is unchanged by this port move. Browser suites target 3001 only (140 collected):
  full run 135 passed, one skipped, followed by 19 passing parallel admin/auth/email tests after
  fixing the sorting check to compare the rendered table with its actual response (including cached
  default sorts), rather than another live snapshot during parallel registrations. No API sort change.
  Backend preflight: 449 passed, one bulk table-compaction assertion failed; the isolated bulk test
  passed on rerun. Coverage was 96.85%. Ruff, format, mypy and all 13 import contracts passed.
- Test accounts are `e2e.*@caravansara.example.com`; retained fixtures are the E2E convention. Holiday fixtures
  restore previous values in `finally`. Use unique temporary report directories when running Playwright.
- Admin email-login verification: 65 backend auth/admin/opportunity/contract tests passed;
  Ruff, formatting, mypy and all 13 import contracts passed. All 524 frontend tests passed with
  coverage gates; lint, format, types and production images passed. The final response-consumption
  refinement also passed 35 focused component/handler tests. Fourteen real-browser admin/member
  tests passed, including SMTP delivery, Persian/English mobile entry, axe, cookie privacy and
  renewal. The Postman collection was updated and parsed; `postman status` failed locally with
  `SecItemCopyMatching failed -50`, so no Postman CLI execution is claimed for this extension.

## Next work

`docs/future-work.md` tracks remaining work: server-side listing drafts, optional property categories,
additional error/race browser coverage, account email verification/password reset, measured caching and only
then any evidence-based service split. Real payments/refunds, host blackout dates and reservation date edits
remain outside the implemented flow. Current pricing and modern workspaces are complete, not future work.
