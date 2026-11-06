---

description: "Task list template for feature implementation"
---

# Tasks: بررسی ایندکس‌ها با اندازه‌گیری

**Input**: Design documents from `/specs/003-index-review/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: لازم‌اند. اصل IV برای بخش‌های غیرزمانی تست خودکار می‌خواهد: پوشش و اعتبار فهرست، ابزار، migrationها، استفاده از ایندکس. زمان‌ها با دست و طبق quickstart اندازه گرفته می‌شوند.

**Organization**: کارها بر اساس user story دسته‌بندی شده‌اند. کارهایی که یک فایل را تغییر می‌دهند در هر فاز کنار هم آمده‌اند (constitution 1.2.0). هر story migration خودش را دارد، تا هیچ فایل migrationای در دو فاز باز نشود.

**قاعده‌ی آزمایش (از research)**: هر آزمایش ایندکس فقط روی کپی `caravansara_bulk_lab` انجام می‌شود، با `psql -v ON_ERROR_STOP=1`، و خروجی پیش از فیلتر شدن در فایل نوشته می‌شود. دلیل: در research یک ایندکس آزمایشی در `caravansara_bulk` باقی ماند. `caravansara_bulk` فقط با migration و `measure-queries` لمس می‌شود.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: می‌تواند هم‌زمان اجرا شود (فایل جدا، بدون وابستگی به کار ناتمام)
- **[Story]**: US1، US2، US3

## Path Conventions

- بکند: `backend/src/caravansara/`، تست‌ها: `backend/tests/`، migrationها: `backend/migrations/versions/`
- فهرست کوئری‌ها: `db/bulk/queries/`
- SQL ضبط‌شده در research: `specs/003-index-review/captured-sql.json` (۱۷۲ دستور، با پارامترها؛ داده‌ی حجیم ساختگی است و رمز یا توکن در آن نیست)

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 در `backend/`، روی همین branch و پیش از هر تغییر، `uv run pytest -q` پاس شود (۲۱۶ تست)، و `uv run alembic heads` فقط `0002` را نشان دهد.
- [X] T002 ساختن کپی آزمایشی: `CREATE DATABASE caravansara_bulk_lab TEMPLATE caravansara_bulk` (هیچ اتصالی به `caravansara_bulk` نباید باز باشد)، و بعد `ANALYZE`. در research این کار ۱۶ ثانیه طول کشید. T030 آن را پاک می‌کند.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: ابزار `measure-queries`. هر سه story عدد پیش و پس را با آن می‌گیرند.

**⚠️ CRITICAL**: هیچ اندازه‌گیری‌ای پیش از پایان این فاز ثبت نمی‌شود، تا همه‌ی عددها با یک روش باشند (research R2).

- [X] T003 [P] نوشتن `backend/tests/test_measure_queries.py` (اول، شکست‌خورده)، روی پایگاه داده‌ی تست با فهرست کوچکی در `tmp_path` و داده‌ی factory:
  - فهرست نامعتبر خطای `invalid query catalog: <name>: <rule>` بدهد، برای نام تکراری، فایل SQL گم و `source` ناموجود.
  - `environment = production` خطای `measure-queries is for development and measurement only` بدهد.
  - پایگاه داده‌ی بدون آگهی خطای `<db> has no listings; run: caravansara seed-bulk` بدهد.
  - اجرای موفق برای هر کوئری همه‌ی فیلدهای data-model §۲ را برگرداند (`name`, `median_ms`, `runs_ms` به طول `--runs`، `shared_hit`, `shared_read`, `access`, `indexes`, `target_ms`, `meets_target`, `database`, `revision`, `measured_at`).
  - یک کوئری `kind = write` (یک `INSERT` رزرو) تعداد ردیف‌های `bookings` را عوض نکند.
  - خطای SQL یک کوئری بقیه را متوقف نکند و کد خروج ۱ بدهد.
- [X] T004 ساختن `backend/src/caravansara/devdata/measure.py`، که فقط `caravansara.core` و asyncpg را import می‌کند (قرارداد «devdata uses only core»):
  - `MeasureRefused`، `QueryResult`، `load_catalog(dir)` با اعتبارسنجی data-model §۱، و `resolve_params(conn, params_sql)`.
  - `measure(settings, *, database, catalog_dir, runs=5, only=None)`.
  - برای هر کوئری: یک اجرای گرم‌کننده، بعد `runs` بار `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`. هر اجرا در تراکنش خودش با `ROLLBACK` است، چه read و چه write.
  - میانه‌ی `Execution Time`، buffers آخرین اجرا، و پیمایش درخت نقشه برای `Node Type` و `Index Name`.
  - قفل‌ها: production، و پایگاه داده‌ی بدون آگهی.
- [X] T005 در `backend/src/caravansara/cli.py`: زیرفرمان `measure-queries` با گزینه‌های [contracts/cli.md](contracts/cli.md) (`--database caravansara_bulk`، `--catalog`، `--runs 5`، `--only`، `--out`)، جدول Markdown در stdout، JSON با `--out`، و کد خروج ۱ با پیام روشن برای `MeasureRefused` و خطای هر کوئری. docstring بالای فایل فهرست فرمان‌ها را به‌روز کند.

**Checkpoint**: `uv run pytest tests/test_measure_queries.py -q` پاس شود، و `uv run lint-imports` همچنان ۱۰ قرارداد را نگه دارد.

---

## Phase 3: User Story 1 - فهرست کوئری‌های مهم با عدد واقعی (Priority: P1) 🎯 MVP

**Goal**: فهرست تکرارپذیر همه‌ی کوئری‌های مهم، خط پایه‌ی ثبت‌شده، و آمار کوئری‌ها در Grafana.

**Independent Test**: `measure-queries` روی `caravansara_bulk` برای هر کوئری فهرست عدد می‌دهد. تست پوشش ثابت می‌کند هیچ تابع repository یا jobای جا نمانده است. پنل Grafana کوئری‌های پرهزینه را نشان می‌دهد.

### Tests for User Story 1 ⚠️

- [X] T006 [P] [US1] نوشتن `backend/tests/test_query_catalog.py`:
  - **پوشش (SC-001):** با `ast`، هر تابع `async def` سطح بالا در `src/caravansara/*/repository.py`، به‌اضافه‌ی `_COMPLETE_FINISHED` و توابع `jobs`، باید در `catalog.json` به‌عنوان `source` یا در `excluded` با `reason` غیرخالی آمده باشد.
  - **اعتبار:** هر `source` به تابعی اشاره کند که واقعاً وجود دارد.
  - **اجرا:** روی پایگاه داده‌ی تست با چند ردیف factory، `params.sql` اجرا شود، و هر SQL فهرست با پارامترهای آن `EXPLAIN` (بدون `ANALYZE`) شود و خطا ندهد.
- [X] T007 [P] [US1] در `backend/tests/test_migrations.py`: بعد از `upgrade head`، extension `pg_stat_statements` در `pg_extension` باشد. `downgrade` به `0002` جدول‌ها و داده را عوض نکند. extension عمداً می‌ماند (data-model §۳)، و این در تست با یک خط توضیح آمده است.
- [X] T008 [P] [US1] در `backend/tests/test_monitoring_config.py`: هر متریک `pg_stat_statements_*` در داشبوردها باید در `observability/postgres-exporter/metrics.txt` باشد، که فهرست نام‌های واقعی `/metrics` خود exporter است (T012).

### Implementation for User Story 1

- [X] T009 [US1] ساختن `db/bulk/queries/` از SQL ضبط‌شده در `specs/003-index-review/captured-sql.json`، و نه از حافظه. پارامترها `:name` هستند. `params.sql` یک ردیف می‌دهد با این ستون‌ها:
  - `london_id`, `stockholm_id`
  - `london_lat`, `london_lng`, `stockholm_lat`, `stockholm_lng` (میانگین مختصات آگهی‌ها)
  - `busy_listing` (پررزروترین آگهی) و `busy_listing_host`
  - `reviewed_listing` (پرنظرترین آگهی)
  - `busy_guest` و `busy_guest_email`
  - `big_host` (میزبان با بیشترین آگهی)
  - `check_in`, `check_out` (سه شب، ۳۵ روز بعد از امروز)

  کوئری‌های `catalog.json`، هر کدام با `source`، `endpoint`، `kind` و `target_ms: 50`:
  - جستجوی شهری: لندن بدون تاریخ، با تاریخ، و با تاریخ و `offset 400`؛ استکهلم با تاریخ.
  - جستجوی شعاعی لندن با شعاع ۱، ۵ و ۲۰، هر کدام با و بدون تاریخ؛ ۵ کیلومتر با `sort=distance`؛ ۵ کیلومتر با امکانات و حیوان خانگی؛ استکهلم ۵ کیلومتر با تاریخ.
  - شمارش امکانات (`GET /search/filters`، `search.repository:amenity_counts`) برای لندن با تاریخ. این در ضبط research جا مانده بود، و SQL آن یک بار با همان روش ضبط می‌شود.
  - صفحه‌ی آگهی، عکس‌ها، کاور، نظرها (صفحه‌ی اول و `offset 60`)، سفرهای من (همه و `completed`)، آگهی‌های من، رزروهای آگهی (شمارش و صفحه)، کاربر با ایمیل، شمارش تلاش ورود، refresh token.
  - `expire_listing_holds`، job انقضا، job پایان اقامت، و `write_1000_bookings` (`kind: write`، `target_ms: 300`).

  `excluded` با دلیل: کوئری‌های جدول‌های کاتالوگ (۹ شهر، ۳۱ امکان)، و نوشتن‌های تک‌ردیفی که فقط کلید اصلی را لمس می‌کنند.
- [X] T010 [US1] ساختن `backend/migrations/versions/0003_pg_stat_statements.py` (`down_revision = "0002"`): upgrade برابر `CREATE EXTENSION IF NOT EXISTS pg_stat_statements`. downgrade کاری نمی‌کند، با docstring که دلیل را می‌گوید: extension آمار را نگه می‌دارد و ممکن است exporter به آن وابسته باشد. حذفش آمار را پاک می‌کند، بدون اینکه schema برنامه را برگرداند.
- [X] T011 [US1] در `docker-compose.yml`:
  - سرویس `db` می‌گیرد `command: ["postgres", "-c", "shared_preload_libraries=pg_stat_statements"]`. بقیه‌ی تنظیم‌های extension پیش‌فرض می‌مانند (`track = top`)، چون فقط کوئری‌های خود برنامه لازم‌اند.
  - سرویس `postgres-exporter` می‌گیرد `command: ["--collector.stat_statements"]`.
  - توضیح بالای فایل به‌روز شود. بررسی شود که `e2e/compose.e2e.yml` سرویس `db` را بازتعریف نمی‌کند.
- [X] T012 [US1] restart پایگاه داده‌ی stack: API و worker چند ثانیه قطع می‌شوند، پس وقتی کسی با stack کار نمی‌کند انجام شود. بعد از `docker compose up -d db` و بعد `docker compose up -d` (تا api و worker دوباره وصل شوند) و `docker compose --profile observability up -d postgres-exporter`: `SHOW shared_preload_libraries` برابر `pg_stat_statements` باشد. نام متریک‌های `pg_stat_statements_*` از `curl` روی `/metrics` exporter خوانده و در `observability/postgres-exporter/metrics.txt` نوشته شوند (یک نام در هر خط، با یک خط توضیح). پنل «کوئری‌های پرهزینه» (جدول، ۱۰ کوئری با بیشترین زمان کل در بازه، با تعداد اجرا و میانگین) فقط با همین نام‌ها به `observability/grafana/dashboards/caravansara.json` اضافه شود.
- [X] T013 [US1] خط پایه: migration روی `caravansara_bulk` (به `0003`)، `ANALYZE`، بعد `uv run caravansara measure-queries --database caravansara_bulk --out specs/003-index-review/before.json`، و جدول Markdown آن در `specs/003-index-review/measurements.md` زیر عنوان «پیش از تغییر»، با تاریخ، revision و روش (research R2).

**Checkpoint**: T006–T008 پاس شوند. `before.json` برای هر کوئری فهرست عدد داشته باشد. پنل در Grafana داده نشان دهد.

---

## Phase 4: User Story 2 - جستجو و صفحه‌های اصلی سریع می‌مانند (Priority: P2)

**Goal**: جستجو و رزروهای آگهی به هدف ۵۰ ms برسند، یا با دلیل ثبت شوند، بدون اینکه کوئری دیگری بیش از ۱۰٪ کند شود.

**Independent Test**: `measure-queries --only <کوئری‌های جستجو و رزرو آگهی>` پیش و پس. همه‌ی تست‌های جستجو بدون تغییر پاس شوند.

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] نوشتن `backend/tests/test_index_usage.py`:
  - با `SET enable_seqscan = off` و داده‌ی factory، نقشه‌ی `EXPLAIN` رزروهای آگهی (شمارش و صفحه، از فهرست) باید ایندکس تازه‌ی `bookings_listing_check_in_idx` را به کار ببرد.
  - نقشه‌ی جستجو با تاریخ باید ایندکس تازه‌ی `stay` را به کار ببرد، اگر T016 آن را پذیرفت.
  - یک helper `index_names(plan_json)` برای پیمایش درخت نقشه.
  - تست فقط برای نامزدهایی می‌ماند که T016 پذیرفت. اگر نامزدی رد شد، تست آن در همان کار حذف می‌شود، و دلیل رد در `measurements.md` می‌آید.
- [X] T015 [P] [US2] در `backend/tests/test_search.py`: تست برابری نتیجه برای بازنویسی anti-join (اگر T016 آن را پذیرفت). روی داده‌ای با هر چهار وضعیت مسدودکننده و غیرمسدودکننده، که شامل نگه‌داشت `pending` منقضی، `cancelled`، `expired` و `completed` در همان تاریخ‌هاست، فهرست آگهی‌ها و `total` جستجوی شهری و شعاعی با تاریخ همان مقداری باشد که تست‌های فعلی انتظار دارند.

### Implementation for User Story 2

- [X] T016 [US2] آزمایش‌ها روی `caravansara_bulk_lab` (قاعده‌ی آزمایش بالا). برای هر نامزد، `measure-queries --database caravansara_bulk_lab --only …` پیش و پس، به‌اضافه‌ی `write_1000_bookings`، حجم ایندکس (`pg_relation_size`) و زمان ساخت:
  - (a) `CREATE INDEX bookings_listing_check_in_idx ON bookings (listing_id, check_in, id)`.
  - (b) `CREATE INDEX bookings_active_stay_idx ON bookings USING gist (stay) WHERE status IN ('pending','confirmed','completed')`، همراه با بازنویسی anti-join در `search/repository.py` به شکلی که برنامه‌ریز hash anti-join را انتخاب کند. شکل‌های امتحانی: `l.id NOT IN (SELECT b.listing_id … )`، یا CTE `MATERIALIZED` از رزروهای منطبق با `LEFT JOIN … IS NULL`. هر شکل باید همان نتیجه را بدهد.
  - (c) ایندکس covering روی `listings (city_id) INCLUDE (is_active, max_guests, avg_rating, review_count, price_per_night, cleaning_fee)` یا شکل مرتب‌شده‌ی آن، بعد از `VACUUM listings` برای visibility map.
  - (d) `USING spgist (public_location)` در مقابل GiST فعلی، برای جستجوی شعاعی ۱، ۵ و ۲۰ کیلومتر (FR-011).

  نتیجه‌ی هر نامزد (پذیرفته یا رد، با عدد) در `specs/003-index-review/measurements.md` زیر «آزمایش‌ها» ثبت شود.
- [X] T017 [US2] در `backend/src/caravansara/search/repository.py`: اگر (b) در T016 پذیرفته شد، بازنویسی anti-join در `_where` با همان شرط‌ها: وضعیت‌های `pending`/`confirmed`/`completed`، نگه‌داشت منقضی که مسدود نمی‌کند، و `daterange(:check_in, :check_out, '[)')`. یک خط توضیح دلیل را بگوید (عدد T016). SQL همان کوئری در `db/bulk/queries/` هم به‌روز شود.
  - **اجرا:** سه تغییر به‌جای یکی، هر سه با عدد در `measurements.md` («آزمایش‌ها»، b): CTE `MATERIALIZED` برای آگهی‌های منطبق در `search`؛ `NOT IN` فقط برای جستجوی شعاعی تا ۷ شب (`_HASHED_MAX_NIGHTS`)؛ و شمارش امکانات پنل فیلترها بر اساس `amenity_id`. SQL فهرست با اسکریپتی از خود کد دوباره ساخته شد، و دو کوئری ۱۴ شبه برای سنجیدن سقف ۷ شب به فهرست اضافه شد.
- [X] T018 [US2] ساختن `backend/migrations/versions/0004_read_indexes.py` (`down_revision = "0003"`) فقط با نامزدهای پذیرفته‌ی T016. upgrade با `CREATE INDEX`، و downgrade با `DROP INDEX` و برگرداندن هر ایندکسی که حذف یا جایگزین شده (مثلاً GiST `listings_public_location_idx` اگر SP-GiST جایش را گرفت)، با تعریف دقیق قبلی. docstring عدد هر تصمیم را بگوید.
  - **اجرا:** ایندکس‌ها با `CREATE INDEX CONCURRENTLY` در `autocommit_block` ساخته می‌شوند، چون ساخت GiST روی ۳ میلیون رزرو ۲۱ ثانیه طول کشید و نوشتن رزرو نباید در این مدت قفل شود.
- [X] T019 [US2] در `backend/tests/test_migrations.py`: `0004` up و down. ایندکس‌های پذیرفته بعد از upgrade در `pg_indexes` باشند و بعد از downgrade نباشند، ایندکس جایگزین‌شده برگردد، و مقدار ردیف‌ها عوض نشود.

**Checkpoint**: T014، T015 و T019 پاس شوند، همه‌ی تست‌های جستجو بدون تغییر پاس شوند، و `openapi.json` همان بماند.

---

## Phase 5: User Story 3 - نوشتن و کارهای پس‌زمینه کند نمی‌شوند (Priority: P3)

**Goal**: job پایان اقامت سریع شود، هزینه‌ی نوشتن هر ایندکس سنجیده شود، و ایندکس بی‌استفاده حذف شود.

**Independent Test**: `measure-queries --only job_complete job_expire write_1000_bookings …` پیش و پس. تست‌های فعلی job (تغییر ساعت تابستانی، وقت شهر) بدون تغییر پاس شوند.

### Tests for User Story 3 ⚠️

- [X] T020 [P] [US3] در `backend/tests/test_jobs.py`: تست کران امن، تا نشان دهد هیچ اقامتی جا نمی‌ماند. یک شهر آزمایشی با منطقه‌ی زمانی `Pacific/Kiritimati` (+14) و یک شهر با `Pacific/Pago_Pago` (−11) با SQL درج شود، و رزرو `confirmed` در هر دو با `check_out` امروز و فردا به وقت UTC. بعد از گذشتن ساعت check-out به وقت هر شهر، job همه را `completed` کند، و پیش از آن هیچ‌کدام را.
- [X] T021 [P] [US3] در `backend/tests/test_index_usage.py` (بعد از T014، همان فایل): با `enable_seqscan = off`، نقشه‌ی job پایان اقامت ایندکس `bookings_confirmed_check_out_idx` را به کار ببرد. این تست فقط اگر T023(e) آن را پذیرفت می‌ماند.

### Implementation for User Story 3

- [X] T022 [US3] در `backend/src/caravansara/bookings/repository.py`: افزودن کران `AND b.check_out <= ((:now AT TIME ZONE 'UTC') + interval '14 hours')::date` به `_COMPLETE_FINISHED`، با توضیح «هیچ منطقه‌ی زمانی‌ای بیش از ۱۴+ ساعت از UTC جلوتر نیست، پس اقامتی که پایانش به وقت شهر گذشته، check_out آن حداکثر همین تاریخ است (specs/003 research R5)». اگر T023 نشان داد که join با `listings` هنوز پرهزینه است، شکل join هم تنظیم شود، با همان نتیجه. SQL همان کوئری در `db/bulk/queries/` هم به‌روز شود.
- [X] T023 [US3] آزمایش‌ها روی `caravansara_bulk_lab`:
  - (h) پیش از (e) تا (g)، بررسی همه‌ی ایندکس‌ها (FR-007): `SELECT pg_stat_reset()`، اجرای کامل `measure-queries --database caravansara_bulk_lab`، و خواندن `pg_stat_user_indexes`. هر ایندکس با `idx_scan = 0` که پشت هیچ قیدی نیست (`pg_constraint.conindid`)، با تصمیم «حذف» یا «نگه داشتن با دلیل» در `measurements.md` ثبت شود. نامزدهای حذف در (f) اندازه گرفته می‌شوند.
  - (e) `CREATE INDEX bookings_confirmed_check_out_idx ON bookings (check_out) WHERE status = 'confirmed'`، با کران T022. زمان job، و تعداد ردیف وقتی `now` ۳۰ روز جلوتر است، که باید برابر ۴۳٬۷۴۲ و یکسان با کوئری قبلی باشد.
  - (f) حذف `listing_amenities_amenity_idx` و هر نامزد حذف دیگری از (h): زمان جستجوی شعاعی با امکانات، شمارش امکانات، و حذف یک امکان (`DELETE FROM amenities WHERE id = …` در تراکنش rollback، که کلید خارجی را بررسی می‌کند).
  - (g) `write_1000_bookings` با همه‌ی ایندکس‌های پذیرفته‌ی US2 و US3 روی هم، در مقابل خط پایه (حدود ۲۴۰ ms، research R6).

  نتیجه‌ها در `specs/003-index-review/measurements.md` زیر «آزمایش‌ها» ثبت شوند.
  - **اجرا:** پیش از (e)، job یک بار واقعاً روی کپی اجرا شد، چون ۲٬۶۶۴ اقامت گذشته منتظر `completed` شدن بودند و عدد حالت عادی را پنهان می‌کردند. آمار چندستونی `(status, check_out)` هم امتحان و رد شد.
- [X] T024 [US3] ساختن `backend/migrations/versions/0005_job_indexes.py` (`down_revision = "0004"`) با نامزدهای پذیرفته‌ی T023. downgrade هر ایندکس حذف‌شده را با تعریف دقیق قبلی برگرداند، و docstring عددها را بگوید.
- [X] T025 [US3] در `backend/tests/test_migrations.py` (بعد از T019، همان فایل): `0005` up و down، همان شکل T019.

**Checkpoint**: T020، T021 و T025 پاس شوند، و همه‌ی تست‌های job بدون تغییر پاس شوند.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 اندازه‌گیری نهایی: `caravansara_bulk` با migration به head برود، بعد `ANALYZE`، بعد `measure-queries --out specs/003-index-review/after.json`. در `specs/003-index-review/measurements.md` زیر «پس از تغییر» جدول مقایسه بیاید: نام، پیش، پس، تغییر٪، هدف ✓/✗. همچنین حجم کل ایندکس‌ها پیش و پس (SC-005). هر کوئری بیش از ۱۰٪ کندتر (SC-004) یا هنوز ✗ (SC-003) دلیل بگیرد. قاعده‌ی نوسان: اگر کوئری‌ای بیش از ۱۰٪ کندتر به نظر رسید، پیش (روی کپی آزمایشی با migration `0003`) و پس هر دو با `--runs 9` دوباره اندازه گرفته شوند، و فقط اگر دوباره کندتر بود کندی ثبت شود. هر دو عدد در جدول می‌آیند.
  - **اجرا:** خط پایه‌ی اول با یک اتصال مشترک گرفته شده بود، که JIT آن را کند می‌کرد. پس «پیش» دوباره گرفته شد: روی همان `caravansara_bulk` در `0003` با SQL قبلی (فهرست قدیمی از `captured-sql.json` بازسازی شد)، و پشت‌سرهم با «پس». پیش از هر دو، `listings` با `VACUUM FULL` فشرده شد. `seed-bulk` هم حالا خودش این کار را می‌کند، با تست در `test_devdata_bulk.py`.
- [X] T027 در `docs/backend-design.md`: بخش تازه‌ی «ایندکس‌ها و کارایی». شامل:
  - روش اندازه‌گیری
  - جدول خلاصه‌ی پیش و پس
  - هر تصمیم ایندکس با عدد و دلیل، از جمله نامزدهای ردشده و نوع‌هایی که ساخته نشدند (Hash، GIN، BRIN، research R8)
  - نتیجه‌ی جستجوی شعاعی با شعاع‌ها و تاریخ (FR-011)
  - استثناها، مثل جستجوی شهری لندن با `total`
  - پنل Grafana

  یک ردیف در جدول راهبرد تست، و ریسک جستجوی شعاعی در بخش ریسک‌ها به‌روز شود. PDF دوباره ساخته شود (HTML، سپس Chrome `--print-to-pdf`).
- [X] T028 [P] در `db/schema.sql` و `db/schema.dbml`: ایندکس‌های تازه یا حذف‌شده با یک خط دلیل. در `db/README.md`: جدول ایندکس‌ها. در `db/bulk/README.md`: بخش «اندازه‌گیری» با `measure-queries`. `db/erd.mmd` و `db/erd.png` ایندکس نشان نمی‌دهند و عوض نمی‌شوند.
- [X] T029 [P] در `docs/future-work.md`: بخش ۱ حذف شود و بقیه دوباره شماره بخورند. در بخش Redis، عدد اندازه‌گیری‌شده‌ای که تصمیم کش را تغذیه می‌کند آورده شود. `README.md` («What's next»، شمار تست در badge و جدول Size)، `CONTEXT.md`، و `backend/README.md` (فهرست migrationها، فرمان تازه) به‌روز شوند.
- [X] T030 پاک‌سازی: `DROP DATABASE caravansara_bulk_lab`. بررسی شود که فقط `caravansara`، `caravansara_bulk` و `caravansara_demo` مانده‌اند، و هیچ ایندکسی با نام `exp_` در `caravansara_bulk` نیست.
- [X] T031 کنترل کیفیت در `backend/`: `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run lint-imports && uv run pytest -q` همه پاس، پوشش ≥ ۹۰٪، و `git diff main -- backend/openapi.json` خالی (FR-009).
- [X] T032 اجرای [quickstart.md](quickstart.md) بخش‌های ۱ تا ۴ روی stack محلی. پایگاه داده‌ی توسعه (`caravansara`) به head برود، و شمار آگهی و رزرو پیش و پس یکی باشد.
- [X] T033 اجرای `/speckit-converge` پیش از pull request (constitution 1.2.0)، و انجام کارهایی که اضافه می‌کند.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: بدون وابستگی.
- **Foundational (Phase 2)**: بعد از Setup؛ ابزار اندازه‌گیری برای همه‌ی storyها لازم است.
- **US1 (Phase 3)**: بعد از Phase 2. خط پایه‌ی T013 پیش از هر آزمایش US2 و US3.
- **US2 (Phase 4)**: بعد از US1 (فهرست و خط پایه).
- **US3 (Phase 5)**: بعد از US1. آزمایش (g) در T023 به نتیجه‌ی T016 وابسته است. migration `0005` بعد از `0004`.
- **Polish (Phase 6)**: بعد از همه.

### User Story Dependencies

- **US1 (P1)**: فقط Phase 2.
- **US2 (P2)**: US1.
- **US3 (P3)**: US1؛ و T023(g) و T024 بعد از US2.

### Within Each User Story

- تست‌ها اول، شکست‌خورده؛ بعد آزمایش؛ بعد کد و migration فقط برای نامزدهای پذیرفته.
- کارهای یک فایل به ترتیب: `test_migrations.py` (T007 → T019 → T025)، `test_index_usage.py` (T014 → T021).

### Parallel Opportunities

- T003 با T002.
- T006، T007 و T008 فایل جدا دارند.
- T014 و T015 فایل جدا دارند.
- T020 و T021 فایل جدا دارند.
- T028 و T029 فایل جدا دارند.

---

## Parallel Example: User Story 1

```text
Task: "T006 [US1] catalog coverage and validity in backend/tests/test_query_catalog.py"
Task: "T007 [US1] 0003 migration test in backend/tests/test_migrations.py"
Task: "T008 [US1] exporter metric names in backend/tests/test_monitoring_config.py"
```

## Parallel Example: User Story 2

```text
Task: "T014 [US2] index usage in backend/tests/test_index_usage.py"
Task: "T015 [US2] anti-join result equality in backend/tests/test_search.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 و Phase 2: ابزار اندازه‌گیری.
2. Phase 3 (US1): فهرست، `pg_stat_statements`، پنل Grafana، خط پایه.
3. **توقف و بررسی**: عددهای `before.json`. ممکن است عددها نشان دهند که بخشی از US2 یا US3 لازم نیست.

### Incremental Delivery

1. US1: هر کوئری مهم عدد دارد (MVP).
2. US2: جستجو و رزروهای آگهی.
3. US3: job پایان اقامت، هزینه‌ی نوشتن، ایندکس بی‌استفاده.
4. Polish: اندازه‌گیری نهایی، اسناد، کنترل کیفیت، converge، و pull request.
