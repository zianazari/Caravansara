# Caravansara Constitution

Caravansara is a place reservation platform: guests search, hold, pay, stay and review; hosts
list their places. Every Spec Kit plan is checked against these principles in its
Constitution Check, before research and again after design.

## Core Principles

### I. The Database Guards the Critical Rules (NON-NEGOTIABLE)

- Two active bookings of one listing MUST NOT overlap. PostgreSQL enforces it with the
  `no_double_booking` `EXCLUDE` constraint; SQLSTATE `23P01` maps to `409 dates_unavailable`.
- Rules that two concurrent requests could break (overlaps, one review per stay, unique email,
  idempotency keys, review only after a completed stay) MUST be enforced by a database
  constraint or trigger. Checks in application code are only for clear error messages.
- Every state change that can race (pay, cancel, expire, complete) MUST be a conditional
  `UPDATE` whose row count decides the outcome.

Rationale: any number of API copies and workers run at once; only the database sees all of them.

### II. Modular Monolith with Enforced Borders

- One codebase and one PostgreSQL database, split into modules (`identity`, `catalog`,
  `listings`, `bookings`, `reviews`, `search`, `jobs`) on a shared `core`.
- Every module has `router`, `service`, `repository`, `models` and `schemas`. Modules MUST call
  each other only through the other module's `service`; `core` MUST NOT import feature modules.
  import-linter enforces this in CI, and a new module MUST get its own contract.
- Splitting out a service, or adding infrastructure (Redis, a queue), MUST be justified with
  numbers from monitoring, recorded in the plan.
- A tooling package (development or measurement tools, such as `caravansara.devdata`) is not
  a feature module and needs no `router`, `service`, `repository`, `models` or `schemas`. It
  MUST have an import-linter contract that lets it import only `core` and forbids every
  feature module and `core` from importing it, and it MUST refuse to run in production.

Rationale: a booking and its rules stay in one transaction, and deployment stays simple until
measurements prove otherwise.

### III. Contract-First API

- `backend/openapi.json` is the API contract. Any API change MUST start in the spec and appear
  as a change to this file; `tests/test_openapi_contract.py` keeps code and contract equal, and
  `caravansara export-openapi` rewrites the file after an intended change.
- Swagger UI at `/docs` MUST stay available and describe every endpoint, with examples and errors.
- Every error MUST use the shape `{"error": {"code", "message", "details"?}}`. `code` is stable
  and machine-readable; clients translate it. Changing or removing a code is a breaking change.

Rationale: the front-end builds its client from the contract, so an accidental change must fail
a test, not a user.

### IV. Tested Against Real Infrastructure

- Every business rule and every acceptance criterion MUST have an automated test.
- A success criterion that is a wall-clock time on given hardware (for example, a load
  finishing within N minutes) may be measured by hand, following the feature's `quickstart.md`,
  with the result recorded in `docs/backend-design.md`. Every other part of that criterion
  (counts, ratios, outcomes) still MUST have an automated test.
- Backend tests run against real PostgreSQL + PostGIS and MinIO (testcontainers); database rules
  are never mocked. Code that only the loser of a race runs MUST have a test that builds that
  exact race.
- Coverage MUST stay at or above 90%. ruff, ruff format, mypy (strict), import-linter, the
  contract test and the monitoring config checks MUST pass in CI before merge.
- Behaviour the deployed system shows (image, settings, wiring) is covered by the Playwright
  tests in `e2e/` against the running `docker compose` stack.

Rationale: the most important rules live in the database, so only real infrastructure proves them.

### V. Privacy and Security by Default

- A listing's exact address and point MUST be shown only to its host, to guests with a paid
  booking, and to the system admin while reviewing that listing; search and maps use the
  fuzzed `public_location` pin (100 to 500 m away). Every time the admin sees an exact address
  MUST be recorded: which admin, which listing, when.
- Secrets come from `CARAVANSARA_*` environment variables and MUST NOT be committed.
- Logs MUST NOT contain passwords, tokens, email addresses or exact addresses; the log
  formatter masks them as a safety net, not as permission.
- Passwords use argon2; access tokens are short-lived JWTs; refresh tokens rotate, and a reused
  refresh token revokes every session of that user. Login and registration are rate limited.
- Internal endpoints (`/metrics`) MUST NOT be exposed to the public internet.
- Admin tools MAY be reachable from the internet only on their own subdomain, with no link from
  the public site. Every admin action MUST require an admin account, and an admin account MUST
  be created only by a command run on the server, never through a public endpoint. The unlinked
  address reduces exposure; it is not the protection.

Rationale: guests and hosts trust the platform with where they live and when they are away.
The admin checks that a listing is real before guests see it, which needs the exact address;
recording each view keeps that access accountable.

### VI. Observable by Design

- A new endpoint or job MUST produce request logs, metrics and traces through the existing
  `core` observability code, with route templates (never raw paths) as metric labels.
- A new business event worth watching MUST get a counter in `core/metrics.py` and a panel on
  the Grafana dashboard; the dashboard and alerts MUST only use metrics the code exports
  (`tests/test_monitoring_config.py`).

Rationale: problems are found from numbers, not guesses, and the index, cache and service
decisions depend on them.

### VII. Simple, and Measured Before Optimized

- Choose the simplest design that meets the spec. Extra components, abstractions or services
  MUST be justified in the plan's Complexity Tracking table.
- Performance work (indexes, caching) MUST start from a measurement (`EXPLAIN ANALYZE`,
  metrics) and end with a measurement that shows the gain.
- A cache MUST NOT serve booking or availability decisions.

Rationale: every component adds setup, monitoring and tests; it must pay for itself.

## Technology and Domain Constraints

- Backend: Python 3.13 with uv, FastAPI, Pydantic v2, SQLAlchemy 2 async with asyncpg,
  PostgreSQL 16 with PostGIS, object storage through the S3 API (MinIO in development).
- Alembic migrations are the source of truth for the schema; `db/schema.sql`, DBML and the ERD
  follow them. Every migration MUST also downgrade (tested).
- Listing photos upload directly from the browser with presigned POST and never pass through
  the API. Profile pictures go through the API, which checks size, type and content before
  anything is written to storage, so a file that breaks the rules is never stored, whatever
  client sends it (specs/006-avatar-upload-via-api).
- Dates that decide cancellation and the end of a stay are evaluated in the listing city's time
  zone, never the server's or the browser's.
- Front-end: Next.js (App Router), TypeScript (strict), shadcn/ui, Tailwind CSS with logical
  properties, Vitest for component tests. Persian is the default language, right-to-left, with
  the Vazirmatn font; English is the second language. The API client is generated from
  `backend/openapi.json`.
- The whole system MUST start with one `docker compose` command; monitoring runs as the
  `observability` profile.

## Development Workflow and Quality Gates

- Every feature follows Spec Kit: `/speckit-specify` → `/speckit-clarify` (when the spec has open
  questions) → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement` →
  `/speckit-converge`. Small fixes that change no behaviour (typos, docs wording) may skip it.
- `research.md` MUST check every assumption about data, tools and current behaviour against the
  real source (the code, a real database or service, the real data file or site) and say how it
  was checked. Rationale: in features 001 and 002, assumptions taken from memory or from
  `docs/future-work.md` were wrong (a column name, where an error really happened, a price
  range), and only checking the source caught them.
- In `tasks.md`, tasks that edit the same file are grouped together within a phase, so each file
  is opened and reviewed once and the order of its edits stays visible.
- `/speckit-converge` MUST report Converged before the pull request is opened; tasks it appends
  are done first.
- Acceptance criteria are written as Given/When/Then so each one maps to a test.
- `spec.md`, `plan.md`, `tasks.md` and checklists are written in Persian, as plain Markdown
  without direction marks. Template section headings and identifiers (`FR-001`, `SC-001`,
  `T001`, `[P]`, `[US1]`) stay exactly as in the templates, because `/speckit-analyze` and
  `/speckit-converge` find requirements and tasks by them. Code, commands, paths, API fields
  and error codes stay in English. This constitution stays in English, the language of the
  templates and commands that read it.
- Each feature is done on its own branch and merged through a pull request with green CI. Its
  spec folder (`specs/NNN-name/`) is committed in the same pull request. The branch is made by
  hand and named like the spec folder (`NNN-short-name`); the Spec Kit `git` extension is not
  installed, because a hand-made branch was enough in features 001 and 002 and the extension
  adds hooks and a naming scheme to maintain.
- When a feature is done, its decisions move into `docs/backend-design.md` (Persian, the single
  source of truth for architecture) and the matching section leaves `docs/future-work.md`, which
  lists only unstarted work. README and CONTEXT summaries are updated in the same pull request.
- Every important decision and proposal states its reason.
- Commits, pull requests and comments carry no AI attribution lines.

## Governance

- This constitution supersedes other practices. Where a plan cannot meet a principle, the plan
  MUST say so in Complexity Tracking with the reason and the simpler alternative rejected; the
  owner decides.
- Amendments are made with `/speckit-constitution` in a pull request, approved by the project
  owner, and version this file with semantic versioning: MAJOR for removed or redefined
  principles, MINOR for added or materially expanded ones, PATCH for wording.
- Reviews of every pull request check compliance; `/speckit-analyze` checks spec, plan and tasks
  against it before implementation.
- Day-to-day guidance for agents lives in `CONTEXT.md`.

**Version**: 1.4.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-10
