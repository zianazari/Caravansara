---

description: "Task list for 001-test-mock-data"
---

# Tasks: داده‌ی تست و ماک بیشتر و متنوع‌تر

**Input**: Design documents from `/specs/001-test-mock-data/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md, contracts/test-factory.md, quickstart.md

**Tests**: اصل IV قانون اساسی می‌خواهد هر معیار پذیرش یک تست خودکار روی PostgreSQL و MinIO واقعی داشته باشد. پس هر داستان تست‌های خودش را دارد. تست‌ها اول نوشته می‌شوند، و باید پیش از پیاده‌سازی شکست بخورند.

**Organization**: کارها بر اساس داستان کاربر گروه‌بندی شده‌اند، تا هر داستان جدا پیاده‌سازی و آزموده شود.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- بکند: `backend/src/caravansara/`، `backend/tests/` (فرمان‌ها از `backend/` با `uv run`)
- داده و اسکریپت‌های بازسازی: `db/`
- اسناد: `docs/`، `README.md`، `CONTEXT.md`

**قاعده‌ی مشترک**: `db/demo/build_demo_seed.py` در US2، US3 و US4 ویرایش می‌شود. پس کارهای این فایل در داستان‌های مختلف [P] نیستند و به ترتیب انجام می‌شوند. بعد از هر تغییر، `python3 db/demo/build_demo_seed.py` اجرا می‌شود، تا `db/seed_demo.sql` بازسازی شود. این فایل هرگز با دست ویرایش نمی‌شود.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: ساختار بسته‌ی تازه، مرز import، و داده‌ی خام شهرهای تازه

- [X] T001 بسته‌ی `backend/src/caravansara/devdata/__init__.py` را با docstring بساز: «Development data tools: bulk data and demo photos. Not a business module; imports only caravansara.core.»
- [X] T002 [P] در `backend/pyproject.toml` یک قرارداد import-linter تازه از نوع `forbidden` اضافه کن، با نام "devdata uses only core":
  - `source_modules = ["caravansara.devdata"]`
  - `forbidden_modules` = همه‌ی ماژول‌های کسب‌وکار (`identity`، `catalog`، `listings`، `bookings`، `reviews`، `search`، `jobs`)
  
  و `caravansara.devdata` را به `forbidden_modules` قرارداد "core does not depend on feature modules" هم اضافه کن. با `uv run lint-imports` بررسی کن.
- [X] T003 [P] در `db/demo/build_demo_seed.py`، دو شهر به `CITIES` اضافه کن (R1)، سپس `python3 db/demo/build_demo_seed.py --download` را اجرا کن، تا فایل‌های London و New York City در `.cache/insideairbnb/` بیایند:
  - `("London", "GB", "united-kingdom/england/london/2026-09-17", "GBP")`
  - `("New York City", "US", "united-states/ny/new-york-city/2026-09-14", "USD")`
  
  نام فایل cache از `city.lower()` ساخته می‌شود، پس فاصله را به `-` تبدیل کن (`new-york-city_listings.csv.gz`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: catalog افزایشی با ۹ شهر. داده‌ی حجیم (US1) و دمو (US2 تا US4) هر دو به شهرهای تازه نیاز دارند.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 تست `test_seed_skips_an_existing_catalog` را در `backend/tests/test_cli.py` با دو تست تازه جایگزین کن:
  - `test_seed_adds_only_missing_rows`: روی catalog آماده‌ی تست، `seed` خروجی `catalog up to date: nothing new` می‌دهد. سپس شهر London را حذف کن، دوباره `seed` را اجرا کن، و بررسی کن که خروجی `1 new cities` است، تعداد کل ۹ شهر است، و `id` شهرهای موجود عوض نشده.
  - `test_seed_keeps_existing_data`: یک کاربر و یک آگهی بساز، `seed` را اجرا کن، و بررسی کن که هر دو هنوز هستند.
  
  هر دو باید اول شکست بخورند.
- [X] T005 [P] در `db/seed_locations.sql`:
  - کشورهای `('GB', 'United Kingdom')`، `('US', 'United States')` و `('IR', 'Iran')` را اضافه کن.
  - شهرهای `London`/`Europe/London`، `New York City`/`America/New_York`، `Tehran`، `Isfahan` و `Shiraz`/`Asia/Tehran` را اضافه کن.
  - هر دو `INSERT` را با `ON CONFLICT DO NOTHING` بنویس (کشور روی `code`، شهر روی `(country_id, name)`).
  - توضیح سرآیند فایل را به «۹ شهر» تغییر بده.
- [X] T006 [P] در `db/seed_amenities.sql`، هر دو `INSERT` (دسته‌ها روی `name`، امکانات روی `name`) را با `ON CONFLICT DO NOTHING` بنویس.
- [X] T007 در `backend/src/caravansara/cli.py`، `seed_catalog` را افزایشی کن:
  - `skip_if` را حذف کن.
  - تعداد `countries`، `cities` و `amenities` را قبل و بعد از اجرا بشمار.
  - یک dataclass با سه عدد تازه برگردان.
  - در `main`، خروجی را طبق `contracts/cli.md` چاپ کن: `catalog loaded: …` وقتی قبلاً خالی بود، `catalog up to date: N new countries, M new cities, K new amenities`، یا `catalog up to date: nothing new`.
  
  `conftest.prepared` و `assert await seed_catalog(settings)` را با نوع بازگشتی تازه هماهنگ کن. تست‌های T004 باید پاس شوند.
- [X] T008 [P] به‌روز کردن `db/schema.dbml` و `db/README.md` لازم نیست، چون schema تغییر نکرده. فقط در `db/README.md` جمله‌ی «seed is skipped when present» را به «seed adds only missing rows» تغییر بده.

**Checkpoint**: `uv run pytest tests/test_cli.py -q` پاس می‌شود، و `docker compose run --rm migrate caravansara seed` روی پایگاه داده‌ی توسعه ۵ شهر تازه اضافه می‌کند، بی‌آنکه رزروها کم یا زیاد شوند.

---

## Phase 3: User Story 1 - داده‌ی حجیم با یک فرمان (Priority: P1) 🎯 MVP

**Goal**: `caravansara seed-bulk` در پایگاه داده‌ی جدای `caravansara_bulk` بیش از ۱۰۰ هزار آگهی و ۲ میلیون رزرو با توزیع واقعی می‌سازد، در یک تراکنش و با همه‌ی قیدها روشن.

**Independent Test**: روی container تست، `seed-bulk --listings 200` بارگذاری می‌کند، قانون‌ها برقرارند، جستجو و رزرو کار می‌کنند، و دو تولید با یک ورودی یکسان‌اند. طبق quickstart §۴ با دست زمان‌سنجی می‌شود.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T009 [P] [US1] در `backend/tests/test_devdata_bulk.py`، تست‌های بدون پایگاه داده را بنویس:
  - `test_profiles_file_is_valid`: `profiles.load()` روی `db/bulk/city_profiles.json` خطا نمی‌دهد، و ۶ شهر دارد.
  - `test_invalid_profile_is_rejected`: احتمال‌هایی که جمعشان ۱ نیست، یا صدک نزولی، `ProfileError` با پیام `invalid city profile: <city>: <rule>` می‌دهند.
  - `test_generation_is_deterministic`: دو بار `bulk.generate(profiles, listings=500, seed=7, today=date(2026, 11, 5))` را صدا بزن، و sha256 همه‌ی ردیف‌های همه‌ی جدول‌ها را مقایسه کن (FR-004).
  - `test_distribution_matches_profile`: با `listings=20000`، برای هر شهر بررسی کن که میانه‌ی قیمت کمتر از ۱۰٪ با صدک ۵۰ پروفایل فاصله دارد، و سهم هر نوع ملک کمتر از ۰٫۰۵ با پروفایل (SC-003).
  - `test_default_size_reaches_targets`: پیش‌فرض گزینه‌ی `--listings` در parser فرمان `seed-bulk` برابر `100000` است. روی همان نمونه‌ی ۲۰٬۰۰۰ آگهی، میانگین رزرو هر آگهی ≥ ۲۰ است، پس اندازه‌ی پیش‌فرض ≥ ۲٬۰۰۰٬۰۰۰ رزرو می‌دهد (US1-1، FR-002). تعداد کاربران، عکس‌ها و نظرها با نسبت‌های data-model §۵ می‌خوانند، پس اندازه‌ی کوچک همان نسبت‌ها را دارد (بخش غیرزمانی US1-5).
  - `test_active_bookings_never_overlap_in_memory`: برای هر آگهی، بازه‌های `pending`/`confirmed`/`completed` هم‌پوشانی ندارند. نظرها فقط برای `completed` هستند، و `created_at` نظر حداکثر ۱۴ روز بعد از `check_out` است. رزرو آینده `check_in ≤ today + 365` دارد.
- [X] T010 [P] [US1] در `backend/tests/test_devdata_bulk.py`، تست‌های روی container را بنویس. هر تست پایگاه داده‌ی `test_bulk` روی همان container را در پایان drop می‌کند:
  - `test_seed_bulk_loads_and_keeps_rules`: `cli.main(["seed-bulk", "--listings", "200", "--database", "test_bulk", "--today", "2026-11-05"])` را اجرا کن، سپس بررسی کن:
    - تعدادها با نسبت‌های data-model §۵ می‌خوانند.
    - `review_count` و `avg_rating` هر آگهی با نظرهایش برابر است.
    - sequenceها از بیشترین `id` جلوترند.
    - برنامه‌ای که با `database_url` همین پایگاه داده ساخته شده، جستجو در Amsterdam را پاسخ می‌دهد، و یک مهمان تازه می‌تواند رزرو و پرداخت کند (FR-001، FR-006).
  - `test_seed_bulk_refuses_configured_database`: `--database` برابر نام پایگاه داده‌ی تنظیمات، کد خروج ۱ و پیام `refusing to load bulk data into the configured database` می‌دهد، و هیچ جدولی تغییر نمی‌کند (FR-008).
  - `test_seed_bulk_refuses_non_empty_target`: اجرای دوم بدون `--replace`، پیام `use --replace` می‌دهد. با `--replace` دوباره بارگذاری می‌شود، و با همان seed همان checksum را دارد.
  - `test_replace_only_drops_bulk_databases`: `--replace --database other` پیام `only drops databases whose name ends with _bulk` می‌دهد.
  - `test_seed_bulk_is_atomic`: با monkeypatch، جریان ردیف‌های `reviews` را وسط کار با خطا قطع کن. بعد از آن `users`، `listings` و `bookings` در `test_bulk` خالی‌اند (FR-007).
  - `test_seed_bulk_refuses_production`: با `environment="production"`، پیام `seed-bulk is for development and measurement only` می‌دهد.

### Implementation for User Story 1

- [X] T011 [US1] اسکریپت `db/bulk/build_city_profiles.py` را بنویس (فقط کتابخانه‌ی استاندارد، Python 3.9 به بالا). این اسکریپت فهرست شهرها و `map_amenity` را از `db/demo/build_demo_seed.py` import می‌کند، و `CITIES` را تکرار نمی‌کند. برای هر ۶ شهر Inside Airbnb، از `listings.csv.gz` این‌ها را بساز (data-model §۴):
  - `room_type_share`
  - `price_percentiles` (۱۰۱ صدک برای هر نوع ملک؛ قیمت‌های بیش از صدک ۹۹٫۵ کنار گذاشته می‌شوند)
  - `accommodates` (۱ تا ۱۶)
  - `size_by_accommodates` (bedrooms، beds و bathrooms، به‌صورت فهرست `[value, p]`)
  - `amenity_probability` (فقط نام‌های catalog)
  - `rating` (`mean`، `sd`)
  - `occupancy_l365d` (۱۰۱ صدک `estimated_occupancy_l365d`؛ تغییر از `availability_365`، دلیل در research R11)
  - `listings_per_host` (`mean`، `max`)
  - `review_share` (سهم آگهی‌هایی که `number_of_reviews_ltm` ضرب در میانگین طول اقامت، تقسیم بر شب‌های پرشده می‌دهد؛ بین ۰٫۲ و ۰٫۹ محدود شود)
  - `points` (۵۰۰ نقطه با `random.Random(42)`، گرد شده به ۳ رقم)
  - `listing_count`، `snapshot`، `currency`
  
  خروجی را با `json.dumps(..., indent=1, sort_keys=True, ensure_ascii=False)` در `db/bulk/city_profiles.json` بنویس. اجرای دوباره باید بایت‌به‌بایت یکسان باشد.
- [X] T012 [US1] `python3 db/bulk/build_city_profiles.py` را اجرا کن، `db/bulk/city_profiles.json` را بساز، و بررسی کن که کمتر از ۳۰۰ کیلوبایت است.
- [X] T013 [P] [US1] `backend/src/caravansara/devdata/profiles.py` را بنویس:
  - dataclassهای `CityProfile` و `Profiles`
  - `load(path: Path) -> Profiles`
  - `ProfileError(ValueError)`
  
  قاعده‌ها (data-model §۴): «همه‌ی احتمال‌های یک توزیع با هم ۱ می‌شوند (با دقت ۱۰^-۶)»، «صدک‌ها صعودی‌اند»، «نام امکانات باید در catalog باشد». سومی با فهرستی که به `load` داده می‌شود بررسی می‌شود.
- [X] T014 [US1] `backend/src/caravansara/devdata/bulk.py` را بنویس، بدون I/O پایگاه داده (R10، R12):
  - `generate(profiles, *, listings, seed, today) -> BulkData`، با یک iterator جدا برای هر جدول: `users()`، `listings()`، `listing_photos()`، `listing_amenities()`، `bookings()`، `reviews()`. هر ردیف یک tuple به ترتیب ستون‌های `COPY` است.
  - **RNG**: `random.Random(f"{seed}:{listing_id}")` برای هر آگهی، و `random.Random(f"{seed}:users")` برای کاربران.
  - **سهم شهرها**: سهم هر شهر برابر `listing_count` است، با گرد کردن و باقی‌مانده برای شهر اول.
  - **میزبان‌ها**: `ceil(listings / mean listings_per_host)`. شناسه‌ی میزبان‌ها `1..H` و مهمان‌ها `H+1..H+3×listings` است. ایمیل `bulk.<id>@example.com` است، و یک hash argon2 مشترک (همان `PASSWORD_HASH` دمو) دارند.
  - **آگهی**: نوع از `room_type_share`. قیمت با درون‌یابی خطی بین دو صدک. نقطه‌ی نمونه با جابه‌جایی ۰ تا ۳۰۰ متر. `public_location` با جابه‌جایی ۱۰۰ تا ۵۰۰ متر، به شکل EWKT `SRID=4326;POINT(lon lat)`. نشانی `"<n> Bulk Street, <city>"`. `cleaning_fee` مثل دمو.
  - **رزروها**:
    - بازه `[today − 1095 روز، today + 365 روز]` است. شب‌های هدف = `(1 − availability/365) × 1460`.
    - اقامت‌ها ۱ تا ۱۴ شب‌اند، با فاصله‌ی ۰ تا ۶ روز، پشت‌سرهم و بدون هم‌پوشانی.
    - وضعیت: گذشته `completed`، یا `cancelled` با احتمال ۶٪. آینده `confirmed`، یا `cancelled` با احتمال ۸٪. ۰٫۱٪ `pending` با `hold_expires_at = now + 10 min`. ۲٪ `expired`، که در بازه‌ی خودشان قرار نمی‌گیرند.
    - اگر میانگین رزرو هر آگهی زیر ۲۰ باشد، طول اقامت کوتاه‌تر انتخاب می‌شود، تا FR-002 برآورده شود.
    - `idempotency_key = uuid5(NAMESPACE, f"bulk-{seed}-{booking_id}")`. شناسه‌ها به ترتیب آگهی پیوسته‌اند.
  - **نظرها**: برای `completed` با احتمال `review_share`. ستاره‌ها حول `rating.mean`، و `created_at` ۰ تا ۱۴ روز بعد از `check_out`. متن از ترکیب ۲ تا ۳ عبارت از فهرست ثابت حدود ۶۰ عبارت انگلیسی ساختگی ساخته می‌شود.
  - **عکس‌ها**: ۳ ردیف `bulk/listings/<id>/<n>.jpg` (۱۲۰۰×۸۰۰؛ برچسب‌های Living room، Bedroom و Kitchen؛ `sort_order` ۰ تا ۲).
  - **حافظه**: رزروهای یک آگهی فقط موقع تولید همان آگهی در حافظه‌اند.
  
  تست‌های T009 باید پاس شوند.
- [X] T015 [US1] `backend/src/caravansara/devdata/load.py` را بنویس (R8، contracts/cli.md):
  - `async def seed_bulk(settings, *, listings, seed, today, database="caravansara_bulk", replace=False) -> BulkResult`
  - **ترتیب بررسی‌ها**:
    1. production → `BulkRefused`
    2. `database` برابر نام پایگاه داده‌ی `settings.database_url` → `BulkRefused`
    3. `replace` و نامی که با `_bulk` تمام نمی‌شود → `BulkRefused`
  - **ساخت پایگاه داده**: به پایگاه داده‌ی `postgres` همان سرور وصل شو. با `--replace`، `DROP DATABASE IF EXISTS … WITH (FORCE)`، و `CREATE DATABASE` اگر وجود نداشت. سپس `migrate` و `seed_catalog` را با `settings.model_copy(update={"database_url": …})` اجرا کن.
  - **بررسی خالی بودن**: اگر `users` یا `listings` ردیف دارند → `BulkRefused("… already has users or listings; use --replace to rebuild it")`.
  - **بارگذاری**: در یک `conn.transaction()`، برای هر جدول به ترتیب users، listings، listing_photos، listing_amenities، bookings و reviews، `conn.copy_to_table(table, source=<async iterator of bytes>, columns=[…], format="text")` را صدا بزن. ستون `stay` در فهرست نمی‌آید. رشته‌ها برای قالب متنی escape می‌شوند (`\\`، `\t`، `\n`، `\N` برای NULL). سپس `setval` سه sequence را اجرا کن. بعد از commit، `ANALYZE` را اجرا کن.
  - **شناسه‌ها**: اگر `COPY` مقدار ستون identity صریح را نپذیرفت، برای آن جدول به جدول موقت و `INSERT … OVERRIDING SYSTEM VALUE SELECT` برگرد. نتیجه را در research.md R8 ثبت کن.
  - **لاگ**: پیشرفت را با `logging.getLogger("caravansara.devdata")` و یک خط برای هر جدول (تعداد و زمان) لاگ کن.
- [X] T016 [US1] زیرفرمان `seed-bulk` را در `backend/src/caravansara/cli.py` اضافه کن، با گزینه‌های `--listings` (پیش‌فرض ۱۰۰۰۰۰، حداقل ۱۰۰)، `--seed` (۴۲)، `--today` (تاریخ ISO، پیش‌فرض امروز UTC)، `--database` (`caravansara_bulk`) و `--replace`.
  - **در صورت `BulkRefused` یا `ProfileError`**: پیام را در stderr چاپ کن، و با `SystemExit(1)` خارج شو.
  - **در صورت موفقیت**: `bulk data loaded into <db>: N listings, M bookings, K reviews in XmYYs` را چاپ کن.
  
  پروفایل از `settings.seed_dir / "bulk" / "city_profiles.json"` خوانده می‌شود. تست‌های T010 باید پاس شوند.
- [X] T017 [P] [US1] `db/bulk/README.md` را بنویس: منبع (Inside Airbnb، CC BY 4.0)، آنچه پروفایل دارد و ندارد، فرمان‌ها (`seed-bulk` با همه‌ی گزینه‌ها، و `build_city_profiles.py`)، قفل‌های ایمنی، نحوه‌ی وصل شدن برنامه با `CARAVANSARA_DATABASE_URL`، و اینکه داده و فایل میانی در git نیستند.
- [X] T018 [US1] quickstart §۴ را اجرا کن: `seed-bulk --listings 10000` (کمتر از ۳ دقیقه) و اندازه‌ی پیش‌فرض (کمتر از ۳۰ دقیقه)، و دو بار با یک seed برای checksum. زمان‌ها، تعدادها و حجم دیسک را یادداشت کن، برای T040. اگر بارگذاری پیش‌فرض بیش از ۳۰ دقیقه طول کشید، کار را متوقف کن، عددها را گزارش کن، و طبق R9 تصمیم بگیر. triggerها را بدون تصمیم مالک خاموش نکن.

**اندازه‌گیری T018 (2026-11-05، لپ‌تاپ توسعه، macOS + Docker، `--today 2026-11-05`)**:

| اندازه | آگهی | کاربر | رزرو | نظر | زمان | حجم پایگاه داده |
| --- | --- | --- | --- | --- | --- | --- |
| `--listings 10000` | 10٬000 | 35٬986 | 304٬847 | 116٬410 | 19 ثانیه | — |
| پیش‌فرض | 100٬000 | 359٬849 | 3٬031٬518 | 1٬159٬646 | 3 دقیقه 27 ثانیه (اجرای دوم: 3:16) | 1٫9 گیگابایت |

بیشترین زمان: `bookings` حدود 97 ثانیه، و `reviews` حدود 88 ثانیه (trigger امتیاز برای هر ردیف). همه‌ی قیدها و triggerها روشن بودند. checksum رزروها در دو اجرا یکسان بود (`a4d8b16c…`)، و پایگاه داده‌ی توسعه بدون تغییر ماند (1٬924 رزرو).

یافته‌ی اجرا: اجرای اول با `OverflowError` در `_stays` شکست خورد (فاصله‌ی چندمیلیون‌روزه در اشغال نزدیک صفر). اصلاح شد، و تست `test_near_zero_occupancy_gives_few_bookings_and_no_overflow` اضافه شد. تراکنش rollback شد، و هیچ ردیف ناقصی نماند (FR-007 در عمل).

**Checkpoint**: US1 کامل و جدا قابل آزمودن است. MVP همین‌جاست: بخش ۳ کارهای آینده (بررسی ایندکس) می‌تواند شروع شود.

---

## Phase 4: User Story 2 - حالت‌های مرزی در داده‌ی دمو (Priority: P2)

**Goal**: هر ۷ حالت مرزی FR-014 در داده‌ی دمو هست، با تاریخ نسبی در منطقه‌ی زمانی شهر، و در README با شناسه فهرست شده.

**Independent Test**: داده‌ی دمو روی پایگاه داده‌ی خالی تست بارگذاری می‌شود، و هر حالت از راه API پیدا و بررسی می‌شود.

### Tests for User Story 2 ⚠️

- [X] T019 [US2] در `backend/tests/test_demo_data.py`، داده‌ی دمو را یک بار برای کل ماژول بارگذاری کن. `conftest._clean` امروز بعد از **هر** تستی که `engine` را می‌گیرد همه‌ی جدول‌ها را خالی می‌کند، پس fixture ماژولی به‌تنهایی کافی نیست. این کارها را بکن:
  - در `backend/tests/conftest.py`، marker به نام `keep_data` را در `pytest_configure` ثبت کن. `_clean` را طوری تغییر بده که برای تست‌های دارای این marker، `TRUNCATE` را انجام ندهد.
  - در `test_demo_data.py`، `pytestmark = pytest.mark.keep_data` را بنویس، و fixture به نام `demo` با scope ماژول بساز. این fixture `cli.seed_demo(prepared, photos=False)` را اجرا می‌کند، و در teardown خودش همان `TRUNCATE {DATA_TABLES} RESTART IDENTITY CASCADE` را اجرا می‌کند.
  - تست‌هایی که داده را تغییر می‌دهند (مثل US2-2)، فقط ردیف‌های تازه‌ی خودشان را اضافه کنند، و رزرو دمو را به حالت قبل برنگردانند، مگر اینکه ترتیب تست‌ها مهم باشد. تست US2-2 را آخر ماژول بگذار.
  
  سپس این تست‌ها را بنویس:
  - `test_hold_about_to_expire_and_expired_hold`: `guest@example.com` وارد می‌شود. `GET /me/bookings` یک `pending` با `0 < hold_expires_at − now < 5 min` و یک `expired` دارد (US2-1).
  - `test_overdue_hold_frees_dates`: `hold_expires_at` همان رزرو را با `helpers.sql` به گذشته ببر (در T038 به `factory.expire_hold` منتقل می‌شود). `run-jobs` آن را `expired` می‌کند، و همان بازه برای مهمان دیگری قابل رزرو است (US2-2).
  - `test_same_day_turnover`: `GET /listings/{id}/bookings` با توکن میزبان، دو رزرو `confirmed` با `a.check_out == b.check_in` دارد (US2-3).
  - `test_year_long_stay_and_last_bookable_day`: یک رزرو با ۳۶۵ شب، و یکی با `check_in == امروزِ شهر + 365` (US2-4).
  - `test_inactive_listing_hidden_from_search_but_visible_to_host`: آگهی غیرفعال در `GET /search/listings` نیست، ولی در `GET /me/listings` میزبانش هست. آگهی بدون نظر در جستجو هست، با `review_count == 0` (US2-5).
  
  شناسه‌ها از یک ثابت `EDGE_CASES` در `db/demo/edge_cases.json` خوانده می‌شوند (T021)، و در تست ثابت نوشته نمی‌شوند.

### Implementation for User Story 2

- [X] T020 [US2] در `db/demo/build_demo_seed.py`، تابع `add_edge_cases(...)` را اضافه کن (R5، data-model «حالت‌های مرزی»):
  - **`hold_about_to_expire`**: رزرو `pending` مهمان دمو روی یک آگهی Amsterdam (نه آگهی‌های ۱ تا ۳)، ورود ۲۰ روز بعد، ۲ شب، `hold_expires_at = now() + interval '4 minutes'`.
  - **`expired_hold`**: رزرو `expired` مهمان دمو، ورود ۳۰ روز بعد، `hold_expires_at = now() - interval '2 days'`.
  - **`year_long_stay`**: رزرو `confirmed` روی یک آگهی Lisbon، ورود ۳۰ روز بعد، و `check_out = check_in + 365`.
  - **`last_bookable_day`**: رزرو `confirmed` روی یک آگهی Stockholm، `check_in = امروزِ شهر + 365`، ۲ شب.
  - **`same_day_turnover`**: دو رزرو `confirmed` روی یک آگهی Copenhagen: `+50..+53` و `+53..+56`.
  - **`inactive_listing`**: یک آگهی (London، وقتی US3 انجام شده؛ تا آن موقع Amsterdam) با `is_active = false`، یک اقامت پایان‌یافته‌ی ۱۰ روز پیش، و یک رزرو `confirmed` ۶۰ روز بعد.
  - **`listing_without_reviews`**: یک آگهی فعال (New York City، وقتی US3 انجام شده؛ تا آن موقع Stockholm) که نظرهایش حذف شده‌اند و رزروهای `completed` پشت آن نظرها هم حذف شده‌اند.
  
  قواعد مشترک:
  - همه‌ی تاریخ‌های نسبی را با `Raw(f"(now() AT TIME ZONE '{tz}')::date + {n}")` بنویس، نه `CURRENT_DATE`. این را برای رزروهای آینده‌ی موجود هم انجام بده.
  - رزروهای تصادفی دیگری که با این بازه‌ها هم‌پوشانی دارند، کنار گذاشته می‌شوند.
- [X] T021 [US2] در `db/demo/build_demo_seed.py`، شناسه‌ی هر حالت را در `db/demo/edge_cases.json` بنویس (`{"hold_about_to_expire": {"booking_id": …, "listing_id": …}, …}`، با `sort_keys`). جدول حالت‌های مرزی بین دو نشانگر `<!-- edge-cases:start -->` و `<!-- edge-cases:end -->` در `db/demo/README.md` بازنویسی می‌شود: حالت، شناسه، و مسیر API برای دیدنش.
- [X] T022 [US2] `python3 db/demo/build_demo_seed.py` را اجرا کن، تا `db/seed_demo.sql`، `db/demo/edge_cases.json` و README بازسازی شوند. سپس `uv run pytest tests/test_demo_data.py tests/test_cli.py -q` را اجرا کن. تعداد ردیف‌ها در `test_demo_data_loads_and_logs_in` در `backend/tests/test_cli.py` را با خروجی تازه هماهنگ کن.

**Checkpoint**: US2 کامل است. حالت‌ها در دمو فعلی (۴ شهر) هم کار می‌کنند.

---

## Phase 5: User Story 3 - دمو واقعی‌تر و گسترده‌تر (Priority: P3)

**Goal**: ۶ شهر Inside Airbnb با ۱۲۵ آگهی و تا ۱۵ نظر، و ۳ تا ۸ عکس ساختگی برای هر آگهی که در MinIO قرار می‌گیرند.

**Independent Test**: دمو بارگذاری می‌شود، تعداد شهرها، ارزها و عکس‌ها درست است، و هر عکس در MinIO با ابعاد درست هست.

### Tests for User Story 3 ⚠️

- [X] T023 [P] [US3] در `backend/tests/test_demo_data.py`، این تست‌ها را اضافه کن:
  - `test_catalog_variety`: دست‌کم ۸ شهر، ۶ کشور، ۴ ارز در `listings.currency`، و ۳ اختلاف ساعت با UTC (با `pg_timezone_names.utc_offset` روی `cities.timezone`) (US3-1، FR-010).
  - `test_listing_counts_per_city`: هر شهر Inside Airbnb دست‌کم ۱۲۵ آگهی دارد، و هیچ آگهی بیش از ۱۵ نظر انگلیسی ندارد (FR-011).
  - `test_photos_per_listing`: هر آگهی ۳ تا ۸ عکس دارد، `sort_order` دقیقاً `0..n-1` است، `room_tag`ها در هر آگهی یکتا و غیرخالی‌اند، و عکس ۰ برچسب `Living room` یا `Bedroom` دارد (US3-2، FR-012).
  - `test_reviews_have_no_real_host_names`: برای ۲۰۰ نظر نمونه، هیچ نام واقعی میزبان در متن نیست، و همه‌ی ایمیل‌ها به `@example.com` ختم می‌شوند (US3-4، FR-016). نام‌های واقعی را `build_demo_seed.py` در زمان ساخت بررسی می‌کند. تست فقط ایمیل‌ها و نبود `host_name` ستون‌ها را بررسی می‌کند.
- [X] T024 [P] [US3] در `backend/tests/test_demo_data.py`، تست `test_demo_photos_are_in_storage` را بنویس: `cli.seed_demo(prepared, photos_only=True)` را اجرا کن. برای همه‌ی ردیف‌های `listing_photos`، `Storage.exists(key)` درست است، و `width` و `height` با `db/demo/photos/manifest.json` یکی است (US3-3، FR-013، SC-006). یک تست دیگر هم بنویس: اگر `s3_endpoint_url` به پورتی بسته اشاره کند، `seed_demo` داده را بارگذاری می‌کند و فقط هشدار `photos not uploaded` و `--photos-only` می‌دهد.
- [X] T025 [P] [US3] در `backend/tests/test_unit.py`، تست `test_photo_manifest_matches_jpeg_headers` را بنویس: برای هر فایل در `db/demo/photos/`، عرض و ارتفاع را از نشانگر SOF0/SOF2 فایل JPEG (`0xFFC0`/`0xFFC2`، بایت‌های height و width) بخوان، و با `manifest.json` مقایسه کن. برای این کار Pillow لازم نیست.

### Implementation for User Story 3

- [X] T026 [P] [US3] اسکریپت `db/demo/build_demo_photos.py` را بنویس (اجرا با `uv run --no-project --with pillow python db/demo/build_demo_photos.py`):
  - برای ۸ برچسب R3، یک JPEG با ابعاد جدول R3 بساز: پس‌زمینه‌ی گرادیان از یک رنگ ثابت برای هر برچسب، یک شکل ساده (مستطیل‌ها و دایره)، نام برچسب با `ImageFont.load_default(size=…)`، و متن کوچک «Caravansara demo».
  - فایل را با `quality=82, optimize=True` در `db/demo/photos/<slug>.jpg` ذخیره کن.
  - `manifest.json` را با `sort_keys` بنویس: `{slug: {file, room_tag, width, height}}`.
- [X] T027 [US3] اسکریپت T026 را اجرا کن، و بررسی کن که ۸ فایل در مجموع کمتر از ۴۰۰ کیلوبایت‌اند.
- [X] T028 [US3] در `db/demo/build_demo_seed.py` (R2، R4):
  - `LISTINGS_PER_CITY = 125` و `REVIEWS_PER_LISTING = 15`. به `GUEST_POOL` به تناسب اضافه کن (۱٬۲۰۰).
  - `photo_sources` و نوشتن `photo_sources.csv` را حذف کن.
  - تابع `photos_for(listing_id, room_type, bedrooms, amenities, rng)` را اضافه کن، که ۳ تا ۸ ردیف `(listing_id, key, width, height, None, room_tag, sort_order)` می‌سازد:
    - کلید: `demo/listings/<id>/<sort_order>-<slug>.jpg`
    - ابعاد: از `manifest.json`
    - ترتیب: کاور Living room است، یا Bedroom برای `private_room`/`shared_room`. بعد `Bedroom 1..min(bedrooms, 3)`، Kitchen و Bathroom همیشه. Exterior و Dining area با RNG. Workspace فقط با «Dedicated workspace»، و Balcony فقط با «Balcony».
    - تعداد: اگر از ۸ بیشتر شد، کوتاه کن. اگر کمتر از ۳ شد، Exterior اضافه کن.
  - **فیلتر نام‌ها**: نام میزبان واقعی (`host_name`) و نام نظردهنده (`reviewer_name`) را در یک مجموعه نگه دار. اگر هیچ‌کدام بعد از جایگزینی در متن نظر ماند (`\b<name>\b`، فقط نام‌های بیش از ۲ حرف)، آن نظر را کنار بگذار (FR-016).
  - **بررسی پایانی**: پیش از نوشتن `seed_demo.sql`، کل متن نظرها، عنوان‌ها و توضیح‌ها را دوباره با همان مجموعه‌ی نام‌ها بررسی کن. اگر حتی یک نام ماند، با خطا و کد ۱ متوقف شو، و فایل را ننویس. پس فایل نگه‌داشته‌شده در git هرگز نام واقعی ندارد. نام‌های واقعی در مخزن نیستند، پس تست CI نمی‌تواند آن‌ها را بشناسد، و این بررسی جای آن را می‌گیرد. در `db/demo/README.md` بنویس که این بررسی هست و چرا.
  - **نام فایل cache**: از اصلاح T003 استفاده کن.
- [X] T029 [US3] `backend/src/caravansara/devdata/photos.py` را بنویس:
  - `async def upload_demo_photos(settings, keys_with_slugs) -> int`
  - فایل‌ها را یک بار از `settings.seed_dir / "demo" / "photos"` بخوان.
  - با `asyncio.to_thread` و `ThreadPoolExecutor(16)`، `put_object` را با `ContentType="image/jpeg"` روی کلاینت `Storage(settings)` اجرا کن.
  - یک متد عمومی کوچک در `backend/src/caravansara/core/storage.py` اضافه کن: `async def put_bytes(key, data, content_type) -> None`، تا `devdata` به `_client` خصوصی دست نزند. در `backend/tests/test_listings.py` یا یک تست storage، تستی بنویس که `put_bytes` یک فایل می‌گذارد و `exists` درست برمی‌گرداند.
  - تعداد عکس‌های بارگذاری‌شده را برگردان.
- [X] T030 [US3] در `backend/src/caravansara/cli.py`، `seed_demo` را به `async def seed_demo(settings, *, photos=True, photos_only=False) -> DemoResult` تغییر بده (contracts/cli.md):
  - SQL را اجرا کن (مگر `photos_only`).
  - کلیدها را با `SELECT storage_key FROM listing_photos WHERE storage_key LIKE 'demo/%'` بخوان، و slug را از نام فایل بگیر.
  - `upload_demo_photos` را صدا بزن.
  - خطای `botocore`/`OSError` را بگیر و `DemoResult.photo_error` را پر کن.
  
  در `main`، گزینه‌های `--skip-photos` و `--photos-only` را اضافه کن (با هم ناسازگارند) و خروجی را طبق قرارداد چاپ کن. کد خروج در خطای عکس ۰ است.
- [X] T031 [US3] `db/demo/photo_sources.csv` را با `git rm` حذف کن. `python3 db/demo/build_demo_seed.py` را اجرا کن، و بررسی کن که `db/seed_demo.sql` کمتر از ۱۰ مگابایت است. تعدادها را در `backend/tests/test_cli.py` (`test_demo_data_loads_and_logs_in`، و id کاربر تازه) با خروجی تازه هماهنگ کن. سپس `uv run pytest tests/test_demo_data.py tests/test_cli.py tests/test_unit.py -q` را اجرا کن.

**Checkpoint**: US3 کامل است. ۶ شهر Inside Airbnb و عکس‌ها در MinIO هستند.

---

## Phase 6: User Story 4 - محتوای فارسی و شهرهای ایران (Priority: P4)

**Goal**: ۴۰ آگهی فارسی در تهران، اصفهان و شیراز، با قیمت ریالی و نظرهای فارسی.

**Independent Test**: جستجو در تهران آگهی فارسی با قیمت `IRR` و نظر فارسی برمی‌گرداند. متن بلند، کوتاه و ترکیبی وجود دارد.

### Tests for User Story 4 ⚠️

- [X] T032 [P] [US4] در `backend/tests/test_demo_data.py`، این تست‌ها را اضافه کن:
  - `test_persian_listings_in_iranian_cities`: دست‌کم ۴۰ آگهی با `currency = 'IRR'` در دست‌کم ۳ شهر کشور `IR`. `GET /search/listings?lat=35.70&lng=51.40&radius_km=25` آگهی با عنوان شامل حروف فارسی (`[؀-ۿ]`) برمی‌گرداند (US4-1، FR-017).
  - `test_persian_listing_detail_and_reviews`: یک آگهی فارسی، قیمت `IRR` و دست‌کم ۲ نظر با حروف فارسی دارد (US4-2، FR-018).
  - `test_persian_text_variety`: دست‌کم یک `description` با `char_length > 1000` در آگهی‌های IRR. دست‌کم یک `comment` با `char_length < 20`. دست‌کم یک متن که هم حروف فارسی و هم رقم یا حرف لاتین دارد. دست‌کم یک متن با نیم‌فاصله (`‌`) (US4-3).
  - `test_rial_totals_fit_price_columns`: بیشترین `total_price` رزروهای IRR کمتر از `99999999.99` است (R6).

### Implementation for User Story 4

- [X] T033 [US4] `db/demo/fa_listings.json` را بنویس: ۴۰ آگهی (Tehran ۱۶، Isfahan ۱۲، Shiraz ۱۲)، با فیلدها و قاعده‌های data-model §۳:
  - **محتوا**: عنوان «۱ تا ۱۰۰ نویسه». توضیح «تا ۱۵۰۰ نویسه؛ دست‌کم یکی بیش از ۱۰۰۰». محله‌های واقعی (مثل تجریش، یوسف‌آباد و زعفرانیه؛ جلفا، چهارباغ و نقش جهان؛ ارم، زند و قصردشت). مختصات داخل همان محله.
  - **قیمت**: «۲٬۵۰۰٬۰۰۰ تا ۲۰٬۰۰۰٬۰۰۰ ریال برای هر شب».
  - **امکانات**: از نام‌های catalog.
  - **نظرها**: ۲ تا ۴ نظر با ستاره. «دست‌کم یک comment کمتر از ۲۰ نویسه».
  - **سبک متن**: ترکیب فارسی و عدد و لاتین (مثل «Wi-Fi 100Mbps»، «۲ اتاق خواب»، «ساعت 14:00»)، نیم‌فاصله، نقل‌قول و پرانتز.
  - **حریم خصوصی**: هیچ نام یا شماره‌ی واقعی.
  - **نوع ملک**: ترکیبی از `entire_place`، `private_room` و دست‌کم یک `shared_room` (خوابگاه سنتی).
- [X] T034 [US4] در `db/demo/build_demo_seed.py`، تابع `add_persian_listings(...)` را اضافه کن:
  - `fa_listings.json` را بخوان، و با قاعده‌های data-model §۳ درستی‌سنجی کن. در خطا با پیام روشن متوقف شو.
  - برای هر آگهی، یک میزبان ساختگی با نام فارسی بساز (فهرست `FA_FIRST`/`FA_LAST` در همان فایل؛ ایمیل‌ها لاتین، مثل `fa.host.<id>@example.com`).
  - `currency = "IRR"`. `public_location` با `fuzz`. نشانی ساختگی «پلاک <n>، کوچه‌ی نمونه، <محله>، <شهر فارسی>». عکس‌ها با `photos_for`.
  - برای هر نظر، یک اقامت `completed` ۱ تا ۴ شبه در گذشته، با مهمان فارسی‌نام از یک pool ۸۰ نفره.
  - برای هر آگهی، ۰ تا ۲ رزرو آینده (حداکثر ۴ شب)، با تاریخ نسبی به `Asia/Tehran`.
  - اگر `total_price` هر رزرو ≥ `99_999_999.99` باشد، با خطا متوقف شو (R6).
  - آگهی‌های فارسی بعد از همه‌ی آگهی‌های Inside Airbnb شناسه می‌گیرند.
- [X] T035 [US4] `python3 db/demo/build_demo_seed.py` را اجرا کن، تعدادها را در `backend/tests/test_cli.py` هماهنگ کن، و `uv run pytest tests/test_demo_data.py tests/test_cli.py -q` را اجرا کن.

**نتیجه‌ی US2 تا US4 (2026-11-05)**: `seed_demo.sql` حدود 6٫6 مگابایت، با 2٬043 کاربر، 790 آگهی (40 آگهی فارسی از شناسه‌ی 751: تهران 16، اصفهان 11، شیراز 13؛ طرح 16/12/12 بود و حداقل FR-017 برقرار است)، 4٬548 عکس، 10٬742 رزرو و 9٬523 نظر. دو ساخت پیاپی بایت‌به‌بایت یکسان بودند.

یافته‌ی اجرا: MinIO در بارگذاری موازی حدود 1 در 1٬500 درخواست PUT را با `ClientDisconnected` رد می‌کند. `devdata/photos.py` هر بارگذاری را تا 3 بار تکرار می‌کند، و بارگذاری idempotent است.

**Checkpoint**: US4 کامل است. دمو ۹ شهر، ۷ کشور و ۶ ارز دارد.

---

## Phase 7: User Story 5 - ساخت داده برای تست‌های بکند (Priority: P5)

**Goal**: `Factory` هر وضعیتی را با یک فراخوانی می‌سازد، و هیچ تستی برای وضعیت رزرو SQL مستقیم نمی‌نویسد.

**Independent Test**: یک تست تازه فقط با factory یک اقامت پایان‌یافته‌ی دیروز می‌سازد و برایش نظر ثبت می‌کند. کل مجموعه بدون داده‌ی دمو پاس می‌شود.

### Tests for User Story 5 ⚠️

- [X] T036 [P] [US5] در `backend/tests/test_factories.py`، این تست‌ها را بنویس:
  - `test_stay_can_be_reviewed`: `stay = await factory.stay(ended_days_ago=1)`، سپس `POST /bookings/{stay.booking_id}/review` با توکن `stay.guest` کد ۲۰۱ برمی‌گرداند (US5-1).
  - `test_booking_in_every_status`: برای هر یک از `pending`، `confirmed`، `cancelled`، `expired` و `completed`، `factory.booking(status=…)` یک رزرو با همان وضعیت می‌سازد، و `hold_expires_at` طبق data-model §۶ است (US5-2).
  - `test_factory_respects_database_rules`: دو `factory.booking` فعال هم‌پوشان روی یک آگهی `IntegrityError` با SQLSTATE `23P01` می‌دهند. `cancelled` هم‌پوشان قبول می‌شود (FR-020).
  - `test_expire_hold`: بعد از `factory.expire_hold(id)`، `run_once` رزرو را `expired` می‌کند.

### Implementation for User Story 5

- [X] T037 [US5] `backend/tests/factories.py` را طبق `contracts/test-factory.md` بنویس:
  - کلاس `Factory(client, engine)` و dataclassهای `Booking` و `Stay`.
  - `user()` از `helpers.register` استفاده می‌کند، و `listing()` از `helpers.create_listing`.
  - `booking()`: اگر `check_in`/`check_out` عدد باشند، روز از امروز UTC‌اند. اگر `check_out` نباشد، `check_in + 3`. `nightly_price` و `cleaning_fee` از آگهی می‌آیند، و `total_price = nightly × nights + cleaning`. `idempotency_key = uuid4()`.
  - پیش‌فرض‌های `hold_expires_at`: «`pending` → `now() + 15 min`، `expired` → `now() - 1 min`، بقیه → `NULL`».
  - `stay()`: میزبان، مهمان، آگهی و رزرو `completed` با `check_out = today − ended_days_ago`.
  - `expire_hold()`: `UPDATE bookings SET hold_expires_at = now() - :ago`.
  
  fixture به نام `factory` را در `backend/tests/conftest.py` اضافه کن، که به `client` و `engine` وابسته است. تست‌های T036 باید پاس شوند.
- [X] T038 [US5] تست‌ها را به factory منتقل کن (FR-021):
  - در `backend/tests/test_bookings.py`، `test_jobs.py`، `test_database_rules.py` و `test_concurrency.py`، همه‌ی `insert_booking(...)` را با `factory.booking(...)` جایگزین کن، و همه‌ی `UPDATE bookings SET hold_expires_at …` را با `factory.expire_hold(...)`.
  - استثنا: در `test_concurrency.py`، مهلت `+50ms` با `factory.booking(..., hold_expires_at=…)` یا یک پارامتر `ago` منفی ساخته می‌شود.
  - `insert_booking` را از `backend/tests/helpers.py` حذف کن.
  - SQL مستقیم `INSERT INTO reviews` و `UPDATE listings`/`listing_photos` در `test_database_rules.py` می‌ماند، چون قانون پایگاه داده را می‌آزماید (R13).
  - `grep -rn "insert_booking\|UPDATE bookings\|INSERT INTO bookings" backend/tests` فقط باید `factories.py` و تست یکتایی کلید idempotency در `test_database_rules.py` را نشان دهد (استثنای SC-007). نتیجه‌ی اجرا: یک مورد دیگر هم ماند، `test_cancel_losing_to_a_concurrent_change` در `test_concurrency.py`. آن `UPDATE` نقش تراکنش دیگری (worker) را بازی می‌کند که وسط درخواست ردیف را تغییر می‌دهد، پس بخشی از همان مسابقه است، نه ساخت داده، و می‌ماند.
  - در پایان، `uv run pytest -q` را بدون داده‌ی دمو اجرا کن (US5-3، SC-007).

**Checkpoint**: همه‌ی داستان‌ها کامل‌اند.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: اسناد، بازسازی نهایی، بررسی‌های CI و اندازه‌گیری

**نتیجه‌ی اجرا (2026-11-05)**:
- T039: دو ساخت پیاپی یکسان؛ داده‌ها روی هم حدود 7٫1 مگابایت (کمتر از 20 مگابایت).
- T044: ruff، format، mypy، import-linter (10 قرارداد) و 202 تست با پوشش 98٫0٪ پاس شدند؛ `openapi.json` بدون تغییر ماند.
- T045: catalog افزایشی روی پایگاه داده‌ی توسعه (بدون تغییر رزروها)؛ 10 بارگذاری پیاپی دمو در `caravansara_demo`، هر کدام 9 تا 10 ثانیه، بدون خطا؛ حالت‌های مرزی و عکس‌ها از راه API دیده شدند؛ 48 تست Playwright سبز. `caravansara_demo` برای دیدن مالک نگه داشته شد و پاک نشد.

- [X] T039 بازسازی نهایی: `python3 db/demo/build_demo_seed.py` را دو بار اجرا کن. `git diff --stat db/` بعد از اجرای دوم خالی است (SC-004). حجم مخزن را با `git diff --stat main` بررسی کن: کمتر از ۲۰ مگابایت اضافه (SC-008).
- [X] T040 [P] `docs/backend-design.md` را به‌روز کن، و سپس PDF آن را دوباره بساز (HTML با `build.py` در scratchpad، سپس Chrome `--print-to-pdf`). بخش داده‌ی آزمون را بازنویسی کن:
  - سه نوع داده و دلیل هر کدام
  - `caravansara_bulk` و قفل‌های ایمنی
  - عکس‌های ساختگی و دلیل آن
  - catalog افزایشی
  - factory
  - زمان‌ها و تعدادهای T018 و quickstart §۳
  - ردیف‌های جدول استراتژی تست
- [X] T041 [P] `docs/future-work.md` را به‌روز کن:
  - بخش ۲ (داده‌ی تست و ماک) را حذف کن، و شماره‌ها و ارجاع‌ها را جابه‌جا کن.
  - یک بخش تازه اضافه کن: «پهن کردن ستون‌های قیمت برای ریال»، با یافته‌ی R6 (`NUMERIC(10,2)`، خطای `numeric field overflow` در API به‌جای ۴۲۲، پیشنهاد `NUMERIC(14,2)` با migration و downgrade).
  - در بخش «بررسی ایندکس» بنویس که داده‌ی حجیم آماده است (`seed-bulk`).
- [X] T042 [P] `db/demo/README.md` را بازنویسی کن:
  - جدول ۹ شهر
  - real و synthetic: عکس‌ها ساختگی‌اند، و متن فارسی دست‌نوشته است.
  - Contents با تعدادهای تازه
  - حساب‌های دمو و آنچه مهمان دمو می‌بیند
  - فرمان‌های Load (`seed-demo`، `--skip-photos`، `--photos-only`)
  - بخش Photos تازه
  - Rebuild با سه اسکریپت
  - جدول حالت‌های مرزی (بین نشانگرها)
- [X] T043 [P] این فایل‌ها را به‌روز کن:
  - `README.md`: بخش داده‌ی دمو، ردیف «What's next»، شمار تست‌ها و badge پوشش
  - `CONTEXT.md`: فایل‌ها و وضعیت
  - سرآیند `docker-compose.yml`: فرمان‌های `seed-demo` و `seed-bulk`
  - `postman/Caravansara.postman_collection.json`: فقط اگر توضیحش به تعداد شهرها اشاره دارد
- [X] T044 همه‌ی بررسی‌های CI را از `backend/` اجرا کن، و همه باید پاس شوند:
  - `uv run ruff check . && uv run ruff format --check .`
  - `uv run mypy`
  - `uv run lint-imports`
  - `uv run pytest --cov` (پوشش ≥ ۹۰٪؛ `test_openapi_contract` بدون تغییر `openapi.json`)
  - تست‌های پیکربندی مانیتورینگ
- [X] T045 quickstart §۲ و §۳ را روی پشته‌ی compose اجرا کن:
  - catalog افزایشی روی پایگاه داده‌ی توسعه، بدون تغییر رزروهای موجود
  - دمو در `caravansara_demo`، ۱۰ بار پیاپی در یک حلقه (هر بار `DROP` و `CREATE DATABASE`، `migrate`، `seed` و `seed-demo`). هر ۱۰ اجرا بدون خطا، و هر کدام کمتر از ۲ دقیقه (SC-001). زمان هر اجرا را برای T040 یادداشت کن.
  - هر ۷ حالت از جدول README در کمتر از ۱ دقیقه (SC-005)
  
  سپس `caravansara_demo` را drop کن. `cd e2e && npx playwright test` باید همچنان ۴۸ تست سبز داشته باشد.
- [X] T046 `/speckit-analyze` و بعد از پیاده‌سازی `/speckit-converge` را اجرا کن. سپس commit و PR را بساز، بدون هیچ خط امضای AI (قانون اساسی، CLAUDE.md).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: بدون وابستگی. T003 به اینترنت نیاز دارد.
- **Foundational (Phase 2)**: به T001 وابسته نیست، ولی پیش از همه‌ی داستان‌ها لازم است. US1 به شهرهای London و New York City در catalog نیاز دارد، و US3/US4 هم همین‌طور.
- **US1 (Phase 3)**: به Phase 1 (T001 تا T003) و Phase 2 وابسته است.
- **US2 (Phase 4)**: به Phase 2 وابسته است.
- **US3 (Phase 5)**: به Phase 2 و T003 وابسته است. اگر بعد از US2 انجام شود، دو حالت مرزی (`inactive_listing` و `listing_without_reviews`) به London و New York City منتقل می‌شوند.
- **US4 (Phase 6)**: به Phase 2 و `photos_for` از T028 وابسته است. اگر پیش از US3 انجام شود، آگهی‌های فارسی فعلاً یک عکس کاور می‌گیرند.
- **US5 (Phase 7)**: فقط به Phase 2 وابسته است، و کاملاً جداست.
- **Polish (Phase 8)**: بعد از همه‌ی داستان‌ها.

### User Story Dependencies

- **US1** و **US5** از بقیه مستقل‌اند: فایل‌های جدا، `devdata/` و `tests/factories.py`.
- **US2 → US3 → US4** فایل `db/demo/build_demo_seed.py` را به ترتیب ویرایش می‌کنند. پس با هم موازی نیستند، ولی هر کدام بعد از تمام شدن جدا آزموده می‌شود.
- `backend/tests/test_demo_data.py` در US2، US3 و US4 بزرگ می‌شود. تست‌های هر داستان تابع‌های جدا هستند.

### Within Each User Story

- تست‌ها اول نوشته می‌شوند و باید شکست بخورند.
- داده و اسکریپت ساخت پیش از کد بارگذاری می‌آیند.
- بازسازی `seed_demo.sql` پیش از اجرای تست‌های دمو انجام می‌شود.

### Parallel Opportunities

- **Phase 1**: T002 و T003.
- **Phase 2**: T005، T006 و T008.
- **US1**: T009، T010 و T013 با هم. T017 هر زمان.
- **US3**: T023، T024، T025 و T026 با هم.
- **US5**: کل فاز، به‌موازات US1 تا US4.
- **Polish**: T040 تا T043 با هم.

---

## Parallel Example: User Story 1

```bash
# تست‌ها و بارگذار پروفایل با هم:
Task: "T009 تست‌های بدون پایگاه داده در backend/tests/test_devdata_bulk.py"
Task: "T010 تست‌های روی container در backend/tests/test_devdata_bulk.py"   # همان فایل: یک نفر، دو بخش جدا
Task: "T013 backend/src/caravansara/devdata/profiles.py"

# هم‌زمان با کل US1، در یک شاخه‌ی دیگر:
Task: "T036–T038 Factory و انتقال تست‌ها (US5)"
```

## Parallel Example: User Story 3

```bash
Task: "T023 تست‌های تنوع و عکس در backend/tests/test_demo_data.py"
Task: "T025 تست manifest در backend/tests/test_unit.py"
Task: "T026 db/demo/build_demo_photos.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 و Phase 2: catalog با ۹ شهر، و cache شهرهای تازه
2. Phase 3 (US1): `seed-bulk`
3. **STOP and VALIDATE**: تست‌های T009 و T010 پاس شوند، و زمان‌سنجی T018 زیر ۳۰ دقیقه باشد.
4. بخش ۳ کارهای آینده (بررسی ایندکس) می‌تواند روی همین داده شروع شود.

### Incremental Delivery

1. Setup + Foundational: شهرهای تازه در پایگاه داده‌ی توسعه، بدون از دست رفتن داده
2. US1: داده‌ی حجیم (MVP)
3. US5: factory. کوچک و مستقل است، و تست‌های بعدی را ساده‌تر می‌کند.
4. US2: حالت‌های مرزی
5. US3: ۶ شهر و عکس‌ها
6. US4: محتوای فارسی
7. Polish: اسناد، اندازه‌گیری و PR

هر مرحله بعد از تمام شدن، با تست‌های خودش جدا آزموده می‌شود. همه در یک PR روی `001-test-mock-data` می‌روند، چون قانون اساسی spec و کد را در یک PR می‌خواهد.

---

## Notes

- [P] یعنی فایل جدا و بدون وابستگی به کار ناتمام.
- `db/seed_demo.sql`، `db/demo/edge_cases.json` و جدول حالت‌های مرزی در README خروجی ساخته‌شده‌اند، و هرگز با دست ویرایش نمی‌شوند.
- پایگاه داده‌ی توسعه‌ی `caravansara` در هیچ کاری پاک یا جایگزین نمی‌شود. فقط ردیف catalog به آن اضافه می‌شود (T007).
- هیچ قید یا trigger یا ایندکسی برای سرعت خاموش نمی‌شود (FR-006). اگر عدد T018 بد بود، تصمیم با مالک است.
- commit و PR بدون `Co-Authored-By` و «Generated with Claude Code».

---

## Phase 9: Convergence

- [X] T047 [US3] در `backend/tests/test_demo_data.py`، تست `test_demo_photos_are_in_storage` وجود فایل را برای همه‌ی کلیدها بررسی کند، نه یک نمونه، per SC-006 (partial)
- [X] T048 [US2] در `test_overdue_hold_frees_dates` در `backend/tests/test_demo_data.py`، بعد از انقضا، با `GET /search/listings` و همان `check_in`/`check_out` بررسی شود که آگهی در نتایج دیده می‌شود، per US2/AC2 (partial)
- [X] T049 [US3] در `db/demo/build_demo_seed.py`، همان بررسی نام واقعی (نام میزبان و نظردهنده‌ها) روی توضیح آگهی هم اجرا شود: اگر بعد از جایگزینی نام میزبان، نامی ماند، توضیح حذف شود (`NULL`). سپس `db/seed_demo.sql` بازسازی شود، per FR-016 (partial)
