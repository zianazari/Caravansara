# API tests with Playwright

End-to-end tests for all 36 endpoints of the Caravansara API, run with Playwright's
`request` fixture against the real `docker compose` stack: API, worker, PostgreSQL + PostGIS and MinIO.

The backend's own pytest suite tests each module against containers it starts itself.
These tests check the system as it is deployed: the built image, the real config, the
presigned photo upload to MinIO, and HTTP from outside.

## Run

```bash
# from the repo root: start the stack with higher per-IP limits (each test registers its own users)
docker compose -f docker-compose.yml -f e2e/compose.e2e.yml up -d --build

cd e2e
npm ci
npx playwright test          # 51 tests, a few seconds
npx playwright show-report   # HTML report; failed tests keep a trace
```

`API_URL` (default `http://localhost:8000`) and `DATABASE_URL` (default the compose database)
point the tests elsewhere.

## What is covered

| File | Endpoints |
|---|---|
| `system-catalog.spec.ts` | `/health`, Swagger and OpenAPI, countries, cities, amenities |
| `auth.spec.ts` | register, login, refresh (rotation and reuse detection), logout, `GET/PATCH /me` |
| `listings.spec.ts` | create, details, my listings, edit and deactivate, amenities, the whole photo flow (upload URL → MinIO → register, edit, reorder, delete) |
| `search.spec.ts` | radial and city search, dates, guests, pets, amenity AND filter, paging, filter counts, invalid input |
| `bookings.spec.ts` | reserve, idempotent replay, overlap and a 6-way race (exactly one wins), booking rules, pay, expired hold, view, my trips, cancel, host's bookings |
| `reviews.spec.ts` | review a completed stay, rating update, one review per stay, 14-day window, listing reviews |
| `moderation.spec.ts` | admin login, review queue, listing details for review, approve, reject with a reason, resubmit; an admin token on member endpoints and a member on admin ones |
| `scenario.spec.ts` | the whole story: host lists, guest searches, books, pays, both see it |

## Test data

Every test registers its own users (`e2e.<role>.<id>@caravansara.example.com`, password
`E2e-Pass-2026!`) and creates its own listings, so tests run in parallel and never depend on
each other. Nothing is deleted afterwards, so the data stays in the database for inspection.

Two things the API cannot do on demand are done with SQL (`helpers.ts → sql`):
moving a paid stay into the past so it can be reviewed, and letting a hold run out.

A new listing, and a new photo, wait for an admin's review (specs/004-listing-approval). Admins
exist only through `caravansara create-admin`, so `helpers.ts → createAdmin` runs that command in
the API container (`docker compose exec`, from the repo root), which also checks the command is
in the image. `createListing` and `addPhoto` then approve as that admin, because the other files
search and book public listings; pass `{ approved: false }` to keep a listing pending. The tests
therefore need the `docker` CLI and the compose stack on the same machine.
