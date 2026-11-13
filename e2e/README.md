# API tests with Playwright

End-to-end tests for the versioned endpoints of the Caravansara API and for the web site's wiring, run with
Playwright's `request` fixture against the real `docker compose` stack: web site, API, worker,
PostgreSQL + PostGIS and MinIO.

The backend's own pytest suite tests each module against containers it starts itself.
These tests check the system as it is deployed: the built image, the real config, the
presigned photo upload to MinIO, and HTTP from outside.

## Run

```bash
# from the repo root: start the stack with higher per-IP limits (each test registers its own users)
docker compose -f docker-compose.yml -f docker-compose.cinematic.yml -f e2e/compose.e2e.yml up -d --build --wait

cd e2e
npm ci
npx playwright install chromium   # once: theme, host and admin specs open the pages in a real Chrome
npx playwright test          # API tests take a few seconds; the theme pages take longer
npx playwright show-report   # HTML report; failed tests keep a trace
```

`API_URL` (default `http://localhost:8000`), `WEB_URL` (default `http://localhost:3001`) and
`DATABASE_URL` (default the compose database) point the tests elsewhere.

## What is covered

| File                     | Endpoints                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `system-catalog.spec.ts` | `/health`, Swagger and OpenAPI, countries, cities, amenities                                                                                                                                                                                                                                                                                                                 |
| `auth.spec.ts`           | register, login, refresh (rotation and reuse detection), logout, `GET/PATCH /me` (an outside picture address is refused)                                                                                                                                                                                                                                                     |
| `listings.spec.ts`       | create, details, my listings, edit and deactivate, amenities, the whole photo flow (upload URL → MinIO → register, edit, reorder, delete)                                                                                                                                                                                                                                    |
| `search.spec.ts`         | radial and city search, dates, guests, pets, amenity AND filter, paging, filter counts, invalid input                                                                                                                                                                                                                                                                        |
| `bookings.spec.ts`       | reserve, idempotent replay, overlap and a 6-way race (exactly one wins), booking rules, pay, expired hold, view, my trips, cancel, host's bookings                                                                                                                                                                                                                           |
| `reviews.spec.ts`        | review a completed stay, rating update, one review per stay, 14-day window, listing reviews                                                                                                                                                                                                                                                                                  |
| `moderation.spec.ts`     | admin login, review queue, listing details for review, approve, reject with a reason, resubmit; an admin token on member endpoints and a member on admin ones                                                                                                                                                                                                                |
| `scenario.spec.ts`       | the whole story: host lists, guest searches, books, pays, both see it                                                                                                                                                                                                                                                                                                        |
| `web.spec.ts`            | the web site (specs/005-frontend-guest): `/api/v1` forwarded and nothing else, the API's `auth/*` closed through the site, the refresh token in an HttpOnly `cv_refresh` cookie, `Origin` checked, login attempts counted by the visitor's address (and a forged address on port 8000 ignored), a fresh CSP nonce per page, and a profile picture uploaded straight to MinIO |

## Test data

Every test registers its own users (`e2e.<role>.<id>@caravansara.example.com`, password
`E2e-Pass-2026!`) and creates its own listings, so tests run in parallel and never depend on
each other. Nothing is deleted afterwards, so the data stays in the database for inspection.

Two things the API cannot do on demand are done with SQL (`helpers.ts → sql`):
moving a paid stay into the past so it can be reviewed, and letting a hold run out.

A new listing, and a new photo, wait for an admin's review (specs/backend (004)). Admins
exist only through `caravansara create-admin`, so `helpers.ts → createAdmin` runs that command in
the API container (`docker compose exec`, from the repo root), which also checks the command is
in the image. `createListing` and `addPhoto` then approve as that admin, because the other files
search and book public listings; pass `{ approved: false }` to keep a listing pending. The tests
therefore need the `docker` CLI and the compose stack on the same machine.

`tests/admin.spec.ts` opens the admin panel at `http://admin.localhost:3001` (the `ADMIN_HOST` of the `web` service; set `ADMIN_WEB_URL` for another address). Browsers send `*.localhost` to this machine, so no DNS entry is needed.

## Pricing and frontend variants

The suite currently collects 139 tests. `cinematic-home.spec.ts` targets port 3011 by default, so start the
cinematic compose service when running the entire suite, including in CI. Both frontends share the API/database.

`dynamic-pricing.spec.ts` exercises host rule editing, shared holiday add/remove, exact daily guest quotes,
reservation and receipt snapshots, and Persian/English responsive accessibility. Holiday fixtures restore any
previous entry in a `finally` block. Test accounts/listings follow the existing retained-fixture convention.

`priced-calendar.spec.ts` checks guest nightly prices, staged date confirmation, exact IRR totals, checkout
on a booked night, responsive layouts and accessibility in Persian/English on both ports 3001 and 3011.
Set `PRICED_CALENDAR_SHOTS=1` to capture the calendar in `/private/tmp` and update its README image.

```bash
npx playwright test tests/admin.spec.ts tests/host.spec.ts tests/dynamic-pricing.spec.ts --workers=1
WEB_URL=http://localhost:3011 ADMIN_WEB_URL=http://admin.localhost:3011 npx playwright test tests/dynamic-pricing.spec.ts
```

`CINEMATIC_WEB` overrides the cinematic home origin; `WEB_URL` and `ADMIN_WEB_URL` choose the origins for host/admin
flows. `PRICING_SHOTS=1` saves pricing/workspace screenshots under `/private/tmp` during a local run. After testing,
restore normal API rate limits with `docker compose -f docker-compose.yml -f docker-compose.cinematic.yml up -d --no-deps --wait api`.
