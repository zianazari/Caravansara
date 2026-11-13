# Caravansara: project context

Last updated: 2026-11-13 (Europe/Helsinki).

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

## Local frontends

- Default boutique site (ivory/olive): `http://localhost:3001/fa`; admin: `http://admin.localhost:3001`.
- Cinematic site (dark/orange): `http://localhost:3011/fa`; admin: `http://admin.localhost:3011`.
- The admin host always uses the cinematic palette. The public default site retains the boutique palette.
- `docker-compose.cinematic.yml` creates a separate frontend image/container. Both variants share API, database,
  accounts, photos, reservations and pricing rules. `CARAVANSARA_DESIGN=cinematic` selects the alternative home.
- User menus show full names. Default avatars use a user icon; house markers are shared across listing, host
  and admin maps. Map price hover preserves marker positioning. Search segments respond across their area,
  and category navigation preserves scroll position. Generated home/destination images are decorative.

```bash
docker compose -f docker-compose.yml -f docker-compose.cinematic.yml up -d --build --wait
```

For an existing stack after API/schema changes, build the API image, apply migrations with
`docker compose run --rm --no-deps api caravansara migrate`, then recreate API/frontends. Never reset the database.

## Dynamic pricing (migration 0012)

See `docs/dynamic-pricing.md` for the full contract and endpoint list.

- Each listing owns a JSONB `pricing_policy`; enabled weekend/holiday rules and up to 100 named date ranges.
- Percentages apply to base price, -99% through +1000%, at most two decimal places. Weekend days are selectable
  with Monday=0 through Sunday=6. Defaults are disabled, with +30% weekend and +100% holiday values ready to enable.
- Per-night priority is **custom date range → shared holiday → selected weekend → base**. Rules do not stack.
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

- Current schema is Alembic head `0012`: **17 application tables**, excluding PostGIS/Alembic system tables.
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

## Working conventions

- Never add a Codex attribution/signature to git commits, PRs, issues or comments.
- Preserve existing local work. Use the current feature branch; do not merge or rewrite remote history without
  authorization. This session uses `052-map-pin-font` on `github.com/zianazari/Caravansara`.
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
  to rules/API, not every component. The current frontend suite has 463 tests; the backend suite has 415.
- E2E: 138 tests collected. Start base + cinematic + `e2e/compose.e2e.yml` so both sites exist and fixture account
  creation uses test rate limits. See `e2e/README.md`. Restore normal API settings after verification.
- Latest application verification: backend suite and migration/query catalog corrections, all 463 frontend tests
  with coverage, lint/types/builds, 19 admin/host/pricing browser checks on port 3001 and both pricing/layout
  checks on port 3011. Persian/English mobile widths and axe passed. This does not claim the entire E2E suite
  was rerun in that verification.
- Test accounts are `e2e.*@caravansara.example.com`; retained fixtures are the E2E convention. Holiday fixtures
  restore previous values in `finally`. Use unique temporary report directories when running Playwright.

## Next work

`docs/future-work.md` tracks remaining work: server-side listing drafts, optional property categories,
additional error/race browser coverage, account email verification/password reset, measured caching and only
then any evidence-based service split. Real payments/refunds, host blackout dates and reservation date edits
remain outside the implemented flow. Current pricing and modern workspaces are complete, not future work.
