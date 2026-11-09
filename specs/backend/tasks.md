# Tasks: بکند، کارهای ۰۰۱ تا ۰۰۴

این فایل `tasks.md` چهار کار بکند را، که با Spec Kit ساخته و merge شده‌اند، کنار هم دارد: هر کار یک بخش، به ترتیب شماره. متن هر بخش همان متن پوشه‌ی اصلی آن کار (`specs/NNN-name/`) است، که در 2026-11-09 در این پوشه ادغام شد. شناسه‌ها (`FR-001`، `SC-001`، `T001`، `R1`، `US1`) همان‌اند که در قالب‌های Spec Kit، و درون بخش هر کار معنی دارند. پس ارجاع از بیرون به این شکل است: «`specs/backend`، کار ۰۰۴، research R5».

## 001. داده‌ی تست و ماک بیشتر و متنوع‌تر

---

description: "Task list for 001-test-mock-data"
---

## Tasks: داده‌ی تست و ماک بیشتر و متنوع‌تر

**Input**: Design documents from `/specs/backend` (001)

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md, contracts/test-factory.md, quickstart.md

**Tests**: اصل IV قانون اساسی می‌خواهد هر معیار پذیرش یک تست خودکار روی PostgreSQL و MinIO واقعی داشته باشد. پس هر داستان تست‌های خودش را دارد. تست‌ها اول نوشته می‌شوند، و باید پیش از پیاده‌سازی شکست بخورند.

**Organization**: کارها بر اساس داستان کاربر گروه‌بندی شده‌اند، تا هر داستان جدا پیاده‌سازی و آزموده شود.

### Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

### Path Conventions

- بکند: `backend/src/caravansara/`، `backend/tests/` (فرمان‌ها از `backend/` با `uv run`)
- داده و اسکریپت‌های بازسازی: `db/`
- اسناد: `docs/`، `README.md`، `CONTEXT.md`

**قاعده‌ی مشترک**: `db/demo/build_demo_seed.py` در US2، US3 و US4 ویرایش می‌شود. پس کارهای این فایل در داستان‌های مختلف [P] نیستند و به ترتیب انجام می‌شوند. بعد از هر تغییر، `python3 db/demo/build_demo_seed.py` اجرا می‌شود، تا `db/seed_demo.sql` بازسازی شود. این فایل هرگز با دست ویرایش نمی‌شود.

---

### Phase 1: Setup (Shared Infrastructure)

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

### Phase 2: Foundational (Blocking Prerequisites)

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

### Phase 3: User Story 1 - داده‌ی حجیم با یک فرمان (Priority: P1) 🎯 MVP

**Goal**: `caravansara seed-bulk` در پایگاه داده‌ی جدای `caravansara_bulk` بیش از ۱۰۰ هزار آگهی و ۲ میلیون رزرو با توزیع واقعی می‌سازد، در یک تراکنش و با همه‌ی قیدها روشن.

**Independent Test**: روی container تست، `seed-bulk --listings 200` بارگذاری می‌کند، قانون‌ها برقرارند، جستجو و رزرو کار می‌کنند، و دو تولید با یک ورودی یکسان‌اند. طبق quickstart §۴ با دست زمان‌سنجی می‌شود.

#### Tests for User Story 1 ⚠️

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

#### Implementation for User Story 1

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

### Phase 4: User Story 2 - حالت‌های مرزی در داده‌ی دمو (Priority: P2)

**Goal**: هر ۷ حالت مرزی FR-014 در داده‌ی دمو هست، با تاریخ نسبی در منطقه‌ی زمانی شهر، و در README با شناسه فهرست شده.

**Independent Test**: داده‌ی دمو روی پایگاه داده‌ی خالی تست بارگذاری می‌شود، و هر حالت از راه API پیدا و بررسی می‌شود.

#### Tests for User Story 2 ⚠️

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

#### Implementation for User Story 2

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

### Phase 5: User Story 3 - دمو واقعی‌تر و گسترده‌تر (Priority: P3)

**Goal**: ۶ شهر Inside Airbnb با ۱۲۵ آگهی و تا ۱۵ نظر، و ۳ تا ۸ عکس ساختگی برای هر آگهی که در MinIO قرار می‌گیرند.

**Independent Test**: دمو بارگذاری می‌شود، تعداد شهرها، ارزها و عکس‌ها درست است، و هر عکس در MinIO با ابعاد درست هست.

#### Tests for User Story 3 ⚠️

- [X] T023 [P] [US3] در `backend/tests/test_demo_data.py`، این تست‌ها را اضافه کن:
  - `test_catalog_variety`: دست‌کم ۸ شهر، ۶ کشور، ۴ ارز در `listings.currency`، و ۳ اختلاف ساعت با UTC (با `pg_timezone_names.utc_offset` روی `cities.timezone`) (US3-1، FR-010).
  - `test_listing_counts_per_city`: هر شهر Inside Airbnb دست‌کم ۱۲۵ آگهی دارد، و هیچ آگهی بیش از ۱۵ نظر انگلیسی ندارد (FR-011).
  - `test_photos_per_listing`: هر آگهی ۳ تا ۸ عکس دارد، `sort_order` دقیقاً `0..n-1` است، `room_tag`ها در هر آگهی یکتا و غیرخالی‌اند، و عکس ۰ برچسب `Living room` یا `Bedroom` دارد (US3-2، FR-012).
  - `test_reviews_have_no_real_host_names`: برای ۲۰۰ نظر نمونه، هیچ نام واقعی میزبان در متن نیست، و همه‌ی ایمیل‌ها به `@example.com` ختم می‌شوند (US3-4، FR-016). نام‌های واقعی را `build_demo_seed.py` در زمان ساخت بررسی می‌کند. تست فقط ایمیل‌ها و نبود `host_name` ستون‌ها را بررسی می‌کند.
- [X] T024 [P] [US3] در `backend/tests/test_demo_data.py`، تست `test_demo_photos_are_in_storage` را بنویس: `cli.seed_demo(prepared, photos_only=True)` را اجرا کن. برای همه‌ی ردیف‌های `listing_photos`، `Storage.exists(key)` درست است، و `width` و `height` با `db/demo/photos/manifest.json` یکی است (US3-3، FR-013، SC-006). یک تست دیگر هم بنویس: اگر `s3_endpoint_url` به پورتی بسته اشاره کند، `seed_demo` داده را بارگذاری می‌کند و فقط هشدار `photos not uploaded` و `--photos-only` می‌دهد.
- [X] T025 [P] [US3] در `backend/tests/test_unit.py`، تست `test_photo_manifest_matches_jpeg_headers` را بنویس: برای هر فایل در `db/demo/photos/`، عرض و ارتفاع را از نشانگر SOF0/SOF2 فایل JPEG (`0xFFC0`/`0xFFC2`، بایت‌های height و width) بخوان، و با `manifest.json` مقایسه کن. برای این کار Pillow لازم نیست.

#### Implementation for User Story 3

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

### Phase 6: User Story 4 - محتوای فارسی و شهرهای ایران (Priority: P4)

**Goal**: ۴۰ آگهی فارسی در تهران، اصفهان و شیراز، با قیمت ریالی و نظرهای فارسی.

**Independent Test**: جستجو در تهران آگهی فارسی با قیمت `IRR` و نظر فارسی برمی‌گرداند. متن بلند، کوتاه و ترکیبی وجود دارد.

#### Tests for User Story 4 ⚠️

- [X] T032 [P] [US4] در `backend/tests/test_demo_data.py`، این تست‌ها را اضافه کن:
  - `test_persian_listings_in_iranian_cities`: دست‌کم ۴۰ آگهی با `currency = 'IRR'` در دست‌کم ۳ شهر کشور `IR`. `GET /search/listings?lat=35.70&lng=51.40&radius_km=25` آگهی با عنوان شامل حروف فارسی (`[؀-ۿ]`) برمی‌گرداند (US4-1، FR-017).
  - `test_persian_listing_detail_and_reviews`: یک آگهی فارسی، قیمت `IRR` و دست‌کم ۲ نظر با حروف فارسی دارد (US4-2، FR-018).
  - `test_persian_text_variety`: دست‌کم یک `description` با `char_length > 1000` در آگهی‌های IRR. دست‌کم یک `comment` با `char_length < 20`. دست‌کم یک متن که هم حروف فارسی و هم رقم یا حرف لاتین دارد. دست‌کم یک متن با نیم‌فاصله (`‌`) (US4-3).
  - `test_rial_totals_fit_price_columns`: بیشترین `total_price` رزروهای IRR کمتر از `99999999.99` است (R6).

#### Implementation for User Story 4

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

### Phase 7: User Story 5 - ساخت داده برای تست‌های بکند (Priority: P5)

**Goal**: `Factory` هر وضعیتی را با یک فراخوانی می‌سازد، و هیچ تستی برای وضعیت رزرو SQL مستقیم نمی‌نویسد.

**Independent Test**: یک تست تازه فقط با factory یک اقامت پایان‌یافته‌ی دیروز می‌سازد و برایش نظر ثبت می‌کند. کل مجموعه بدون داده‌ی دمو پاس می‌شود.

#### Tests for User Story 5 ⚠️

- [X] T036 [P] [US5] در `backend/tests/test_factories.py`، این تست‌ها را بنویس:
  - `test_stay_can_be_reviewed`: `stay = await factory.stay(ended_days_ago=1)`، سپس `POST /bookings/{stay.booking_id}/review` با توکن `stay.guest` کد ۲۰۱ برمی‌گرداند (US5-1).
  - `test_booking_in_every_status`: برای هر یک از `pending`، `confirmed`، `cancelled`، `expired` و `completed`، `factory.booking(status=…)` یک رزرو با همان وضعیت می‌سازد، و `hold_expires_at` طبق data-model §۶ است (US5-2).
  - `test_factory_respects_database_rules`: دو `factory.booking` فعال هم‌پوشان روی یک آگهی `IntegrityError` با SQLSTATE `23P01` می‌دهند. `cancelled` هم‌پوشان قبول می‌شود (FR-020).
  - `test_expire_hold`: بعد از `factory.expire_hold(id)`، `run_once` رزرو را `expired` می‌کند.

#### Implementation for User Story 5

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

### Phase 8: Polish & Cross-Cutting Concerns

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

### Dependencies & Execution Order

#### Phase Dependencies

- **Setup (Phase 1)**: بدون وابستگی. T003 به اینترنت نیاز دارد.
- **Foundational (Phase 2)**: به T001 وابسته نیست، ولی پیش از همه‌ی داستان‌ها لازم است. US1 به شهرهای London و New York City در catalog نیاز دارد، و US3/US4 هم همین‌طور.
- **US1 (Phase 3)**: به Phase 1 (T001 تا T003) و Phase 2 وابسته است.
- **US2 (Phase 4)**: به Phase 2 وابسته است.
- **US3 (Phase 5)**: به Phase 2 و T003 وابسته است. اگر بعد از US2 انجام شود، دو حالت مرزی (`inactive_listing` و `listing_without_reviews`) به London و New York City منتقل می‌شوند.
- **US4 (Phase 6)**: به Phase 2 و `photos_for` از T028 وابسته است. اگر پیش از US3 انجام شود، آگهی‌های فارسی فعلاً یک عکس کاور می‌گیرند.
- **US5 (Phase 7)**: فقط به Phase 2 وابسته است، و کاملاً جداست.
- **Polish (Phase 8)**: بعد از همه‌ی داستان‌ها.

#### User Story Dependencies

- **US1** و **US5** از بقیه مستقل‌اند: فایل‌های جدا، `devdata/` و `tests/factories.py`.
- **US2 → US3 → US4** فایل `db/demo/build_demo_seed.py` را به ترتیب ویرایش می‌کنند. پس با هم موازی نیستند، ولی هر کدام بعد از تمام شدن جدا آزموده می‌شود.
- `backend/tests/test_demo_data.py` در US2، US3 و US4 بزرگ می‌شود. تست‌های هر داستان تابع‌های جدا هستند.

#### Within Each User Story

- تست‌ها اول نوشته می‌شوند و باید شکست بخورند.
- داده و اسکریپت ساخت پیش از کد بارگذاری می‌آیند.
- بازسازی `seed_demo.sql` پیش از اجرای تست‌های دمو انجام می‌شود.

#### Parallel Opportunities

- **Phase 1**: T002 و T003.
- **Phase 2**: T005، T006 و T008.
- **US1**: T009، T010 و T013 با هم. T017 هر زمان.
- **US3**: T023، T024، T025 و T026 با هم.
- **US5**: کل فاز، به‌موازات US1 تا US4.
- **Polish**: T040 تا T043 با هم.

---

### Parallel Example: User Story 1

```bash
## تست‌ها و بارگذار پروفایل با هم:
Task: "T009 تست‌های بدون پایگاه داده در backend/tests/test_devdata_bulk.py"
Task: "T010 تست‌های روی container در backend/tests/test_devdata_bulk.py"   # همان فایل: یک نفر، دو بخش جدا
Task: "T013 backend/src/caravansara/devdata/profiles.py"

## هم‌زمان با کل US1، در یک شاخه‌ی دیگر:
Task: "T036–T038 Factory و انتقال تست‌ها (US5)"
```

### Parallel Example: User Story 3

```bash
Task: "T023 تست‌های تنوع و عکس در backend/tests/test_demo_data.py"
Task: "T025 تست manifest در backend/tests/test_unit.py"
Task: "T026 db/demo/build_demo_photos.py"
```

---

### Implementation Strategy

#### MVP First (User Story 1 Only)

1. Phase 1 و Phase 2: catalog با ۹ شهر، و cache شهرهای تازه
2. Phase 3 (US1): `seed-bulk`
3. **STOP and VALIDATE**: تست‌های T009 و T010 پاس شوند، و زمان‌سنجی T018 زیر ۳۰ دقیقه باشد.
4. بخش ۳ کارهای آینده (بررسی ایندکس) می‌تواند روی همین داده شروع شود.

#### Incremental Delivery

1. Setup + Foundational: شهرهای تازه در پایگاه داده‌ی توسعه، بدون از دست رفتن داده
2. US1: داده‌ی حجیم (MVP)
3. US5: factory. کوچک و مستقل است، و تست‌های بعدی را ساده‌تر می‌کند.
4. US2: حالت‌های مرزی
5. US3: ۶ شهر و عکس‌ها
6. US4: محتوای فارسی
7. Polish: اسناد، اندازه‌گیری و PR

هر مرحله بعد از تمام شدن، با تست‌های خودش جدا آزموده می‌شود. همه در یک PR روی `001-test-mock-data` می‌روند، چون قانون اساسی spec و کد را در یک PR می‌خواهد.

---

### Notes

- [P] یعنی فایل جدا و بدون وابستگی به کار ناتمام.
- `db/seed_demo.sql`، `db/demo/edge_cases.json` و جدول حالت‌های مرزی در README خروجی ساخته‌شده‌اند، و هرگز با دست ویرایش نمی‌شوند.
- پایگاه داده‌ی توسعه‌ی `caravansara` در هیچ کاری پاک یا جایگزین نمی‌شود. فقط ردیف catalog به آن اضافه می‌شود (T007).
- هیچ قید یا trigger یا ایندکسی برای سرعت خاموش نمی‌شود (FR-006). اگر عدد T018 بد بود، تصمیم با مالک است.
- commit و PR بدون `Co-Authored-By` و «Generated with Claude Code».

---

### Phase 9: Convergence

- [X] T047 [US3] در `backend/tests/test_demo_data.py`، تست `test_demo_photos_are_in_storage` وجود فایل را برای همه‌ی کلیدها بررسی کند، نه یک نمونه، per SC-006 (partial)
- [X] T048 [US2] در `test_overdue_hold_frees_dates` در `backend/tests/test_demo_data.py`، بعد از انقضا، با `GET /search/listings` و همان `check_in`/`check_out` بررسی شود که آگهی در نتایج دیده می‌شود، per US2/AC2 (partial)
- [X] T049 [US3] در `db/demo/build_demo_seed.py`، همان بررسی نام واقعی (نام میزبان و نظردهنده‌ها) روی توضیح آگهی هم اجرا شود: اگر بعد از جایگزینی نام میزبان، نامی ماند، توضیح حذف شود (`NULL`). سپس `db/seed_demo.sql` بازسازی شود، per FR-016 (partial)

---

## 002. قیمت ریالی بدون سرریز

---

description: "Task list template for feature implementation"
---

## Tasks: قیمت ریالی بدون سرریز

**Input**: Design documents from `/specs/backend` (002)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: لازم‌اند. اصل IV قانون اساسی برای هر قاعده‌ی کسب‌وکار و هر سناریوی پذیرش تست خودکار می‌خواهد، و برای migration تست downgrade.

**Organization**: کارها بر اساس user story دسته‌بندی شده‌اند. در هر فاز، کارهایی که یک فایل را تغییر می‌دهند کنار هم آمده‌اند، تا هر فایل یک بار باز و بررسی شود.

### Format: `[ID] [P?] [Story] Description`

- **[P]**: می‌تواند هم‌زمان اجرا شود (فایل جدا، بدون وابستگی به کار ناتمام)
- **[Story]**: user story مربوط (US1، US2، US3)

### Path Conventions

- بکند: `backend/src/caravansara/`، تست‌ها: `backend/tests/`، migrationها: `backend/migrations/versions/`
- داده و schema: `db/`
- اسناد: `docs/`، `README.md`، `CONTEXT.md`

---

### Phase 1: Setup (Shared Infrastructure)

**Purpose**: نقطه‌ی شروع روشن، تا هر شکست بعدی به همین کار نسبت داده شود.

- [X] T001 در `backend/` اجرای `uv run pytest -q` روی همین branch (پیش از هر تغییر) پاس شود و تعداد تست و پوشش یادداشت شود (امروز ۲۰۲ تست، ۹۸٫۰٪)؛ `uv run alembic heads` فقط `0001` را نشان دهد.

---

### Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: ستون‌های پهن‌تر. همه‌ی storyها به آن وابسته‌اند، چون بدون آن هیچ مبلغ بزرگ‌تری ذخیره نمی‌شود.

**⚠️ CRITICAL**: هیچ کار user storyای پیش از پایان این فاز شروع نمی‌شود.

- [X] T002 [P] نوشتن تست‌های migration در `backend/tests/test_migrations.py`، در همان پایگاه داده‌ی جدای `migration_check` که تست فعلی می‌سازد (FR-005، SC-004):
  - بعد از `migrate`، هر پنج ستون (`listings.price_per_night`، `listings.cleaning_fee`، `bookings.nightly_price`، `bookings.cleaning_fee`، `bookings.total_price`) در `information_schema.columns` دارای `numeric_precision = 14` و `numeric_scale = 2` باشند.
  - مقدارهای موجود حفظ شوند: پیش از `0002` (با `command.upgrade(config, "0001")`) یک آگهی و یک رزرو با مبلغ‌های `99999999.99` و `12.34` درج شود، بعد از `upgrade head` همان مقدارها خوانده شوند.
  - downgrade به `0001` وقتی همه‌ی مقدارها جا می‌شوند انجام شود و نوع به `numeric(10,2)` برگردد.
  - downgrade وقتی یک `total_price = 36505000000.00` ذخیره است با خطای `22003` (`numeric field overflow`) شکست بخورد، هر پنج ستون همچنان `numeric(14,2)` بمانند، `alembic_version` همچنان `0002` باشد و مقدار ردیف عوض نشده باشد.
  - تست فعلی `test_downgrade_and_upgrade_again` (`base` و برگشت) همچنان پاس شود.
- [X] T003 ساختن `backend/migrations/versions/0002_wider_price_columns.py` (`revision = "0002"`، `down_revision = "0001"`): upgrade با دو دستور `op.execute`، یکی برای هر جدول: `ALTER TABLE listings ALTER COLUMN price_per_night TYPE NUMERIC(14,2), ALTER COLUMN cleaning_fee TYPE NUMERIC(14,2)` و `ALTER TABLE bookings ALTER COLUMN nightly_price TYPE NUMERIC(14,2), ALTER COLUMN cleaning_fee TYPE NUMERIC(14,2), ALTER COLUMN total_price TYPE NUMERIC(14,2)`. downgrade همان‌ها با `NUMERIC(10,2)`. docstring دلیل (research R1–R3) و رفتار downgrade را بگوید: «اگر مقداری جا نشود، PostgreSQL با 22003 متوقف می‌شود و تراکنش برمی‌گردد؛ چیزی گرد یا کوتاه نمی‌شود». قیدهای `CHECK (price_per_night > 0)` و `CHECK (cleaning_fee >= 0)` و `DEFAULT 0` دست نمی‌خورند.
- [X] T004 [P] در `backend/src/caravansara/listings/models.py` ستون‌های `price_per_night` و `cleaning_fee` را `Numeric(14, 2)` کن.
- [X] T005 [P] در `backend/src/caravansara/bookings/models.py` ستون‌های `nightly_price`، `cleaning_fee` و `total_price` را `Numeric(14, 2)` کن.
- [X] T006 [P] در `db/schema.sql` پنج ستون را `NUMERIC(14,2)` کن، با یک خط توضیح کنار `-- price + times` و `-- price snapshot…`: «14,2: ریال؛ بیشترین جمع = 1e9 × 365 + 1e9 (specs/backend)». در ` (002)db/schema.dbml` همان پنج ستون را `"numeric(14,2)"` کن. `db/erd.mmd` و `db/erd.png` عوض نمی‌شوند (research R8).

**Checkpoint**: `uv run pytest tests/test_migrations.py -q` پاس شود.

---

### Phase 3: User Story 1 - رزرو طولانی با قیمت ریالی (Priority: P1) 🎯 MVP

**Goal**: آگهی با ۱۰۰ میلیون ریال برای هر شب ساخته شود و رزرو ۳۶۵ شبه‌ی آن با جمع درست ثبت شود.

**Independent Test**: آگهی با قیمت ۱۰۰٬۰۰۰٬۰۰۰ ریال ساخته، رزرو ۳۶۵ شبه ثبت، پرداخت و دوباره خوانده شود.

#### Tests for User Story 1 ⚠️

> **NOTE: این تست‌ها اول نوشته می‌شوند و باید پیش از پیاده‌سازی شکست بخورند.**

- [X] T007 [P] [US1] در `backend/tests/test_bookings.py` تست `test_rial_stay_of_365_nights` (US1-1، US1-2، SC-001): با `factory.listing(price_per_night="100000000.00", cleaning_fee="5000000.00", currency="IRR")` (از راه API، تا سقف ورودی هم آزموده شود) رزرو `check_in = امروزِ شهر + 1`، `check_out = check_in + 365` با `POST /bookings`. انتظار: ۲۰۱، `nightly_price == "100000000.00"`، `cleaning_fee == "5000000.00"`، `total_price == "36505000000.00"`. سپس `POST /bookings/{id}/pay` موفق، `GET /bookings/{id}` همان سه مبلغ را برگرداند، و رزرو در فهرست رزروهای مهمان و رزروهای آگهیِ میزبان با همان `total_price` دیده شود.
- [X] T008 [P] [US1] در `backend/tests/test_search.py` تست `test_search_total_matches_booking_total_for_long_rial_stay` (US1-3، FR-009): همان آگهی ریالی، جستجو با همان `check_in` و `check_out` (۳۶۵ شب) و شهر آگهی؛ `total_price` نتیجه `"36505000000.00"` باشد و برابر `total_price` رزروی که بعد با همان تاریخ‌ها ساخته می‌شود.

#### Implementation for User Story 1

- [X] T009 [US1] در `backend/src/caravansara/listings/schemas.py`: `MAX_PRICE = Decimal("1000000000.00")` با توضیح «سقف قیمت شب و هزینه‌ی نظافت در همه‌ی ارزها (specs/backend، Clarification 2026-11-05)»، و ` (002)Money = Annotated[Decimal, Field(max_digits=12, decimal_places=2, le=MAX_PRICE)]`. قیدهای فعلی فیلدها (`price_per_night: gt=0`، `cleaning_fee: ge=0`، در `ListingCreate` و `ListingUpdate`) همان بمانند.

**Checkpoint**: T007 و T008 پاس شوند. US1 به‌تنهایی قابل ارائه است: خطای ۵۰۰ رزرو ریالی رفع شده است.

---

### Phase 4: User Story 2 - پیام روشن برای قیمت بیش از سقف (Priority: P2)

**Goal**: قیمت بیش از سقف ۴۲۲ با کد ثابت بگیرد، و هیچ مبلغی ۵۰۰ ندهد.

**Independent Test**: قیمت `1000000000.01` در ساخت و ویرایش آگهی ۴۲۲ بگیرد؛ سقف قیمت با بیشترین طول اقامت ثبت شود؛ جمع بیش از ظرفیت ۴۲۲ `amount_too_large` بگیرد.

#### Tests for User Story 2 ⚠️

- [X] T010 [P] [US2] در `backend/tests/test_listings.py` (US2-1، US2-2، SC-002، FR-003):
  - `POST /listings` با `price_per_night: "1000000000.00"` → ۲۰۱.
  - `POST /listings` با `price_per_night: "1000000000.01"` → ۴۲۲، `error.code == "validation_error"`، و `details` شامل `loc` برابر `["body", "price_per_night"]`؛ هیچ آگهی‌ای ساخته نشود.
  - همان برای `cleaning_fee: "1000000000.01"` با `loc` `["body", "cleaning_fee"]`.
  - `PATCH /listings/{id}` با `price_per_night: "1000000000.01"` → ۴۲۲ با همان شکل، و `GET` بعدی قیمت قبلی را نشان دهد.
- [X] T011 [P] [US2] در `backend/tests/test_unit.py`، کلاس تست قواعد رزرو (US2، FR-004): تابع بررسی جمع در `rules` با `Decimal("999999999999.99")` خطا ندهد، و با `Decimal("1000000000000.00")` خطای `Unprocessable` با `code == "amount_too_large"` بدهد. همچنین `rules.total_price` با `MAX_PRICE` و ۳۶۵ شب `Decimal("366000000000.00")` بدهد.
- [X] T012 [US2] در `backend/tests/test_bookings.py` (بعد از T007، همان فایل):
  - `test_max_price_with_longest_stay` (US2-3، SC-003): آگهی با `price_per_night = cleaning_fee = "1000000000.00"`، رزرو ۳۶۵ شبه → ۲۰۱ و `total_price == "366000000000.00"`.
  - `test_total_over_storage_is_422_not_500` (FR-004، edge case تنظیم `max_nights`): یک app جدا با `create_app(prepared.model_copy(update={"max_nights": 1000, "max_days_ahead": 1500}))` و `AsyncClient(transport=ASGITransport(app))` در lifespan آن؛ آگهی با سقف قیمت و رزرو ۹۹۹ شبه → ۴۲۲، `error.code == "amount_too_large"`، و `SELECT count(*) FROM bookings` صفر باشد.

#### Implementation for User Story 2

- [X] T013 [US2] در `backend/src/caravansara/bookings/rules.py`: `MAX_STORED_AMOUNT = Decimal("999999999999.99")` با توضیح «ظرفیت NUMERIC(14,2)؛ با MAX_PRICE و max_nights=365 دیده نمی‌شود (specs/backend research R5)»، و ` (002)def check_total(total: Decimal) -> None` که اگر `total > MAX_STORED_AMOUNT` باشد `Unprocessable("amount_too_large", "The total for this stay is too large to store.")` بیندازد.
- [X] T014 [US2] در `backend/src/caravansara/bookings/service.py`، در `create_booking`: جمع را یک بار در متغیر حساب کن، `rules.check_total(total)` را پیش از `expire_listing_holds` و ساختن `Booking` صدا بزن، و همان متغیر را به `total_price=` بده.
- [X] T015 [US2] در `backend/`: `uv run caravansara export-openapi` تا `openapi.json` در `ListingCreate` و `ListingUpdate` برای `price_per_night` و `cleaning_fee` مقدار `"maximum": 1000000000.0` بگیرد ([contracts/api.md](contracts.md)). diff فقط همین چهار تغییر را داشته باشد، و `tests/test_openapi_contract.py` پاس شود.

**Checkpoint**: T010–T012 پاس شوند، و US1 همچنان پاس باشد.

---

### Phase 5: User Story 3 - داده‌ی دمو با قیمت واقعی بازار ایران (Priority: P3)

**Goal**: آگهی‌های ایران در دمو قیمت واقعی بازار و رزرو طولانی‌تر داشته باشند.

**Independent Test**: دمو روی پایگاه داده‌ی خالی بارگذاری شود؛ بازه‌ی قیمت‌ها و دست‌کم یک قیمت شب و یک جمع ریالی بیش از ۹۹٬۹۹۹٬۹۹۹٫۹۹ بررسی شود.

#### Tests for User Story 3 ⚠️

- [X] T016 [P] [US3] در `backend/tests/test_demo_data.py`، تست `test_rial_totals_fit_price_columns` را با `test_rial_prices_are_market_prices` جایگزین کن (US3-1، US3-2، SC-005):
  - قیمت شب خانه‌های کامل (`entire_place`) تهران در `[10000000, 100000000]`، و اتاق‌های (`private_room`، `shared_room`) هر سه شهر ایران در `[2500000, 10000000]`.
  - `max(price_per_night)` ریالی برابر `100000000.00` (بیش از سقف قدیم).
  - `max(total_price)` ریالی بیش از `99999999.99`، و دست‌کم یک رزرو ریالی بیش از ۴ شب.
  - همه‌ی مبلغ‌ها کمتر یا برابر `999999999999.99`.

#### Implementation for User Story 3

- [X] T017 [US3] در `db/demo/fa_listings.json`، قیمت‌ها را با قاعده‌ی research R7 عوض کن (با یک اسکریپت یک‌باره، نه دستی، و ترتیب و قالب فایل همان بماند): تهران خانه‌ی کامل × ۵ و گران‌ترین آن دقیقاً `100000000`؛ اصفهان و شیراز خانه‌ی کامل × ۴؛ اتاق‌ها × ۲ با سقف `10000000`؛ `cleaning_fee` با همان ضریب آگهی خودش.
- [X] T018 [US3] در `db/demo/build_demo_seed.py`:
  - بررسی `2_500_000 <= price <= 20_000_000` → «خانه‌ی کامل `10_000_000`–`100_000_000`، اتاق `2_500_000`–`10_000_000`»، با پیام خطای همان شکل.
  - `rng.randint(1, 4)` در هر دو حلقه‌ی رزرو آگهی‌های فارسی → `rng.randint(1, 14)`.
  - `MAX_PRICE_COLUMN = 99_999_999.99` و بررسی `too_big` → `MAX_STORED_AMOUNT = 999_999_999_999.99` (`NUMERIC(14,2)`، specs/backend) با همان بررسی برای هر رزرو ریالی، و بررسی تازه‌ی ` (002)price_per_night <= 1_000_000_000`.
- [X] T019 [US3] `python3 db/demo/build_demo_seed.py` را دو بار اجرا کن: `db/seed_demo.sql` بازسازی شود و md5 دو اجرا یکی باشد. جدول حالت‌های مرزی در `db/demo/README.md` و `db/demo/edge_cases.json` همان بماند، یا اگر شناسه‌ای عوض شد با خروجی سازنده به‌روز شود. اگر تعداد کاربر، آگهی یا نظر عوض شد، `backend/tests/test_cli.py` (`(2043, 790, 9523)`) با عدد تازه و دلیل آن به‌روز شود.
- [X] T020 [US3] در `db/demo/README.md` بازه‌ی قیمت آگهی‌های ایران (۲٫۵ تا ۲۰ میلیون، حداکثر ۴ شب) را با بازه‌ی تازه و منبع آن (جاباما، 2026-11-05) جایگزین کن، و جمله‌ی دلیل قدیمی (سرریز `NUMERIC(10,2)`) را حذف کن.

**Checkpoint**: `uv run pytest tests/test_demo_data.py tests/test_cli.py -q` پاس شود.

---

### Phase 6: Polish & Cross-Cutting Concerns

- [X] T021 در `docs/backend-design.md`: ردیف `| 422 | amount_too_large | جمع رزرو از ظرفیت ذخیره (999,999,999,999.99) بیشتر است |` به جدول «قرارداد خطا»؛ پهنای `NUMERIC(14,2)` و سقف یک میلیاردی با دلیل در بخش طرح داده؛ و تعداد تست و پوشش تازه. بعد PDF آن (`docs/backend-design.pdf`) با همان روش قبلی (HTML، سپس Chrome `--print-to-pdf`) دوباره ساخته شود.
- [X] T022 در `docs/future-work.md` بخش ۲ (پهن کردن ستون‌های قیمت برای ریال) را حذف کن، بخش‌های بعدی و جدول «ترتیب پیشنهادی» را دوباره شماره بزن، و کار انجام‌شده را به پاراگراف اول اضافه کن.
- [X] T023 [P] در `README.md` جدول «What's next» و شمار تست و پوشش در badge؛ در `CONTEXT.md` خط «Next» و وضعیت کار.
- [X] T024 کنترل کیفیت در `backend/`: `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run lint-imports && uv run pytest -q` همه پاس، و پوشش ≥ ۹۰٪.
- [X] T025 اجرای [quickstart.md](quickstart.md) بخش ۲ تا ۴ روی stack محلی: `docker compose run --rm migrate` پایگاه داده‌ی توسعه را به `0002` ببرد، بدون پاک شدن داده (شمار آگهی و رزرو پیش و پس یکی)؛ دمو در `caravansara_demo` بارگذاری شود؛ و سه گام دستی API نتیجه‌ی گفته‌شده را بدهند.
- [X] T026 اجرای `/speckit-converge` پیش از pull request، و انجام کارهایی که اضافه می‌کند.

---

### Dependencies & Execution Order

#### Phase Dependencies

- **Setup (Phase 1)**: بدون وابستگی.
- **Foundational (Phase 2)**: بعد از Setup؛ همه‌ی storyها را مسدود می‌کند.
- **US1 (Phase 3)**: بعد از Phase 2.
- **US2 (Phase 4)**: بعد از Phase 2. T012 بعد از T007 (همان فایل). T009 (سقف ورودی) برای T010 لازم است.
- **US3 (Phase 5)**: بعد از Phase 2 (ستون پهن برای بارگذاری دمو).
- **Polish (Phase 6)**: بعد از همه‌ی storyها.

#### User Story Dependencies

- **US1 (P1)**: فقط Phase 2.
- **US2 (P2)**: Phase 2 و T009 از US1 (همان `Money`).
- **US3 (P3)**: فقط Phase 2.

#### Within Each User Story

- تست‌ها اول نوشته می‌شوند و شکست می‌خورند، بعد پیاده‌سازی.
- T013 (rules) پیش از T014 (service).

#### Parallel Opportunities

- T002، T004، T005 و T006 فایل‌های جدا دارند.
- T007 و T008 هم‌زمان.
- T010 و T011 هم‌زمان.
- US3 (T016–T020) می‌تواند هم‌زمان با US1 و US2 جلو برود، چون فایل مشترکی ندارد.

---

### Parallel Example: User Story 1

```text
Task: "T007 [US1] test_rial_stay_of_365_nights in backend/tests/test_bookings.py"
Task: "T008 [US1] test_search_total_matches_booking_total_for_long_rial_stay in backend/tests/test_search.py"
```

### Parallel Example: User Story 2

```text
Task: "T010 [US2] price limit tests in backend/tests/test_listings.py"
Task: "T011 [US2] check_total unit tests in backend/tests/test_unit.py"
```

---

### Implementation Strategy

#### MVP First (User Story 1 Only)

1. Phase 1 و Phase 2 (migration و مدل‌ها).
2. Phase 3 (US1): خطای ۵۰۰ رزرو ریالی رفع می‌شود.
3. **توقف و بررسی**: T007 و T008 پاس.

#### Incremental Delivery

1. Setup + Foundational → ستون‌ها پهن.
2. US1 → رزرو ریالی طولانی کار می‌کند (MVP).
3. US2 → پیام روشن برای قیمت بیش از سقف، و هیچ ۵۰۰ای برای مبلغ.
4. US3 → دمو با قیمت واقعی.
5. Polish → اسناد، کنترل کیفیت، quickstart، converge، و pull request.

---

## 003. بررسی ایندکس‌ها با اندازه‌گیری

---

description: "Task list template for feature implementation"
---

## Tasks: بررسی ایندکس‌ها با اندازه‌گیری

**Input**: Design documents from `/specs/backend` (003)

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: لازم‌اند. اصل IV برای بخش‌های غیرزمانی تست خودکار می‌خواهد: پوشش و اعتبار فهرست، ابزار، migrationها، استفاده از ایندکس. زمان‌ها با دست و طبق quickstart اندازه گرفته می‌شوند.

**Organization**: کارها بر اساس user story دسته‌بندی شده‌اند. کارهایی که یک فایل را تغییر می‌دهند در هر فاز کنار هم آمده‌اند (constitution 1.2.0). هر story migration خودش را دارد، تا هیچ فایل migrationای در دو فاز باز نشود.

**قاعده‌ی آزمایش (از research)**: هر آزمایش ایندکس فقط روی کپی `caravansara_bulk_lab` انجام می‌شود، با `psql -v ON_ERROR_STOP=1`، و خروجی پیش از فیلتر شدن در فایل نوشته می‌شود. دلیل: در research یک ایندکس آزمایشی در `caravansara_bulk` باقی ماند. `caravansara_bulk` فقط با migration و `measure-queries` لمس می‌شود.

### Format: `[ID] [P?] [Story] Description`

- **[P]**: می‌تواند هم‌زمان اجرا شود (فایل جدا، بدون وابستگی به کار ناتمام)
- **[Story]**: US1، US2، US3

### Path Conventions

- بکند: `backend/src/caravansara/`، تست‌ها: `backend/tests/`، migrationها: `backend/migrations/versions/`
- فهرست کوئری‌ها: `db/bulk/queries/`
- SQL ضبط‌شده در research: `specs/backend/data/003-captured-sql.json` (003) (۱۷۲ دستور، با پارامترها؛ داده‌ی حجیم ساختگی است و رمز یا توکن در آن نیست)

---

### Phase 1: Setup (Shared Infrastructure)

- [X] T001 در `backend/`، روی همین branch و پیش از هر تغییر، `uv run pytest -q` پاس شود (۲۱۶ تست)، و `uv run alembic heads` فقط `0002` را نشان دهد.
- [X] T002 ساختن کپی آزمایشی: `CREATE DATABASE caravansara_bulk_lab TEMPLATE caravansara_bulk` (هیچ اتصالی به `caravansara_bulk` نباید باز باشد)، و بعد `ANALYZE`. در research این کار ۱۶ ثانیه طول کشید. T030 آن را پاک می‌کند.

---

### Phase 2: Foundational (Blocking Prerequisites)

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
- [X] T005 در `backend/src/caravansara/cli.py`: زیرفرمان `measure-queries` با گزینه‌های [contracts/cli.md](contracts.md) (`--database caravansara_bulk`، `--catalog`، `--runs 5`، `--only`، `--out`)، جدول Markdown در stdout، JSON با `--out`، و کد خروج ۱ با پیام روشن برای `MeasureRefused` و خطای هر کوئری. docstring بالای فایل فهرست فرمان‌ها را به‌روز کند.

**Checkpoint**: `uv run pytest tests/test_measure_queries.py -q` پاس شود، و `uv run lint-imports` همچنان ۱۰ قرارداد را نگه دارد.

---

### Phase 3: User Story 1 - فهرست کوئری‌های مهم با عدد واقعی (Priority: P1) 🎯 MVP

**Goal**: فهرست تکرارپذیر همه‌ی کوئری‌های مهم، خط پایه‌ی ثبت‌شده، و آمار کوئری‌ها در Grafana.

**Independent Test**: `measure-queries` روی `caravansara_bulk` برای هر کوئری فهرست عدد می‌دهد. تست پوشش ثابت می‌کند هیچ تابع repository یا jobای جا نمانده است. پنل Grafana کوئری‌های پرهزینه را نشان می‌دهد.

#### Tests for User Story 1 ⚠️

- [X] T006 [P] [US1] نوشتن `backend/tests/test_query_catalog.py`:
  - **پوشش (SC-001):** با `ast`، هر تابع `async def` سطح بالا در `src/caravansara/*/repository.py`، به‌اضافه‌ی `_COMPLETE_FINISHED` و توابع `jobs`، باید در `catalog.json` به‌عنوان `source` یا در `excluded` با `reason` غیرخالی آمده باشد.
  - **اعتبار:** هر `source` به تابعی اشاره کند که واقعاً وجود دارد.
  - **اجرا:** روی پایگاه داده‌ی تست با چند ردیف factory، `params.sql` اجرا شود، و هر SQL فهرست با پارامترهای آن `EXPLAIN` (بدون `ANALYZE`) شود و خطا ندهد.
- [X] T007 [P] [US1] در `backend/tests/test_migrations.py`: بعد از `upgrade head`، extension `pg_stat_statements` در `pg_extension` باشد. `downgrade` به `0002` جدول‌ها و داده را عوض نکند. extension عمداً می‌ماند (data-model §۳)، و این در تست با یک خط توضیح آمده است.
- [X] T008 [P] [US1] در `backend/tests/test_monitoring_config.py`: هر متریک `pg_stat_statements_*` در داشبوردها باید در `observability/postgres-exporter/metrics.txt` باشد، که فهرست نام‌های واقعی `/metrics` خود exporter است (T012).

#### Implementation for User Story 1

- [X] T009 [US1] ساختن `db/bulk/queries/` از SQL ضبط‌شده در `specs/backend/data/003-captured-sql.json` (003)، و نه از حافظه. پارامترها `:name` هستند. `params.sql` یک ردیف می‌دهد با این ستون‌ها:
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
- [X] T013 [US1] خط پایه: migration روی `caravansara_bulk` (به `0003`)، `ANALYZE`، بعد `uv run caravansara measure-queries --database caravansara_bulk --out specs/backend/data/003-before.json` (003)، و جدول Markdown آن در `specs/backend/measurements.md` (003) زیر عنوان «پیش از تغییر»، با تاریخ، revision و روش (research R2).

**Checkpoint**: T006–T008 پاس شوند. `data/003-before.json` برای هر کوئری فهرست عدد داشته باشد. پنل در Grafana داده نشان دهد.

---

### Phase 4: User Story 2 - جستجو و صفحه‌های اصلی سریع می‌مانند (Priority: P2)

**Goal**: جستجو و رزروهای آگهی به هدف ۵۰ ms برسند، یا با دلیل ثبت شوند، بدون اینکه کوئری دیگری بیش از ۱۰٪ کند شود.

**Independent Test**: `measure-queries --only <کوئری‌های جستجو و رزرو آگهی>` پیش و پس. همه‌ی تست‌های جستجو بدون تغییر پاس شوند.

#### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] نوشتن `backend/tests/test_index_usage.py`:
  - با `SET enable_seqscan = off` و داده‌ی factory، نقشه‌ی `EXPLAIN` رزروهای آگهی (شمارش و صفحه، از فهرست) باید ایندکس تازه‌ی `bookings_listing_check_in_idx` را به کار ببرد.
  - نقشه‌ی جستجو با تاریخ باید ایندکس تازه‌ی `stay` را به کار ببرد، اگر T016 آن را پذیرفت.
  - یک helper `index_names(plan_json)` برای پیمایش درخت نقشه.
  - تست فقط برای نامزدهایی می‌ماند که T016 پذیرفت. اگر نامزدی رد شد، تست آن در همان کار حذف می‌شود، و دلیل رد در `measurements.md` می‌آید.
- [X] T015 [P] [US2] در `backend/tests/test_search.py`: تست برابری نتیجه برای بازنویسی anti-join (اگر T016 آن را پذیرفت). روی داده‌ای با هر چهار وضعیت مسدودکننده و غیرمسدودکننده، که شامل نگه‌داشت `pending` منقضی، `cancelled`، `expired` و `completed` در همان تاریخ‌هاست، فهرست آگهی‌ها و `total` جستجوی شهری و شعاعی با تاریخ همان مقداری باشد که تست‌های فعلی انتظار دارند.

#### Implementation for User Story 2

- [X] T016 [US2] آزمایش‌ها روی `caravansara_bulk_lab` (قاعده‌ی آزمایش بالا). برای هر نامزد، `measure-queries --database caravansara_bulk_lab --only …` پیش و پس، به‌اضافه‌ی `write_1000_bookings`، حجم ایندکس (`pg_relation_size`) و زمان ساخت:
  - (a) `CREATE INDEX bookings_listing_check_in_idx ON bookings (listing_id, check_in, id)`.
  - (b) `CREATE INDEX bookings_active_stay_idx ON bookings USING gist (stay) WHERE status IN ('pending','confirmed','completed')`، همراه با بازنویسی anti-join در `search/repository.py` به شکلی که برنامه‌ریز hash anti-join را انتخاب کند. شکل‌های امتحانی: `l.id NOT IN (SELECT b.listing_id … )`، یا CTE `MATERIALIZED` از رزروهای منطبق با `LEFT JOIN … IS NULL`. هر شکل باید همان نتیجه را بدهد.
  - (c) ایندکس covering روی `listings (city_id) INCLUDE (is_active, max_guests, avg_rating, review_count, price_per_night, cleaning_fee)` یا شکل مرتب‌شده‌ی آن، بعد از `VACUUM listings` برای visibility map.
  - (d) `USING spgist (public_location)` در مقابل GiST فعلی، برای جستجوی شعاعی ۱، ۵ و ۲۰ کیلومتر (FR-011).

  نتیجه‌ی هر نامزد (پذیرفته یا رد، با عدد) در `specs/backend/measurements.md` (003) زیر «آزمایش‌ها» ثبت شود.
- [X] T017 [US2] در `backend/src/caravansara/search/repository.py`: اگر (b) در T016 پذیرفته شد، بازنویسی anti-join در `_where` با همان شرط‌ها: وضعیت‌های `pending`/`confirmed`/`completed`، نگه‌داشت منقضی که مسدود نمی‌کند، و `daterange(:check_in, :check_out, '[)')`. یک خط توضیح دلیل را بگوید (عدد T016). SQL همان کوئری در `db/bulk/queries/` هم به‌روز شود.
  - **اجرا:** سه تغییر به‌جای یکی، هر سه با عدد در `measurements.md` («آزمایش‌ها»، b): CTE `MATERIALIZED` برای آگهی‌های منطبق در `search`؛ `NOT IN` فقط برای جستجوی شعاعی تا ۷ شب (`_HASHED_MAX_NIGHTS`)؛ و شمارش امکانات پنل فیلترها بر اساس `amenity_id`. SQL فهرست با اسکریپتی از خود کد دوباره ساخته شد، و دو کوئری ۱۴ شبه برای سنجیدن سقف ۷ شب به فهرست اضافه شد.
- [X] T018 [US2] ساختن `backend/migrations/versions/0004_read_indexes.py` (`down_revision = "0003"`) فقط با نامزدهای پذیرفته‌ی T016. upgrade با `CREATE INDEX`، و downgrade با `DROP INDEX` و برگرداندن هر ایندکسی که حذف یا جایگزین شده (مثلاً GiST `listings_public_location_idx` اگر SP-GiST جایش را گرفت)، با تعریف دقیق قبلی. docstring عدد هر تصمیم را بگوید.
  - **اجرا:** ایندکس‌ها با `CREATE INDEX CONCURRENTLY` در `autocommit_block` ساخته می‌شوند، چون ساخت GiST روی ۳ میلیون رزرو ۲۱ ثانیه طول کشید و نوشتن رزرو نباید در این مدت قفل شود.
- [X] T019 [US2] در `backend/tests/test_migrations.py`: `0004` up و down. ایندکس‌های پذیرفته بعد از upgrade در `pg_indexes` باشند و بعد از downgrade نباشند، ایندکس جایگزین‌شده برگردد، و مقدار ردیف‌ها عوض نشود.

**Checkpoint**: T014، T015 و T019 پاس شوند، همه‌ی تست‌های جستجو بدون تغییر پاس شوند، و `openapi.json` همان بماند.

---

### Phase 5: User Story 3 - نوشتن و کارهای پس‌زمینه کند نمی‌شوند (Priority: P3)

**Goal**: job پایان اقامت سریع شود، هزینه‌ی نوشتن هر ایندکس سنجیده شود، و ایندکس بی‌استفاده حذف شود.

**Independent Test**: `measure-queries --only job_complete job_expire write_1000_bookings …` پیش و پس. تست‌های فعلی job (تغییر ساعت تابستانی، وقت شهر) بدون تغییر پاس شوند.

#### Tests for User Story 3 ⚠️

- [X] T020 [P] [US3] در `backend/tests/test_jobs.py`: تست کران امن، تا نشان دهد هیچ اقامتی جا نمی‌ماند. یک شهر آزمایشی با منطقه‌ی زمانی `Pacific/Kiritimati` (+14) و یک شهر با `Pacific/Pago_Pago` (−11) با SQL درج شود، و رزرو `confirmed` در هر دو با `check_out` امروز و فردا به وقت UTC. بعد از گذشتن ساعت check-out به وقت هر شهر، job همه را `completed` کند، و پیش از آن هیچ‌کدام را.
- [X] T021 [P] [US3] در `backend/tests/test_index_usage.py` (بعد از T014، همان فایل): با `enable_seqscan = off`، نقشه‌ی job پایان اقامت ایندکس `bookings_confirmed_check_out_idx` را به کار ببرد. این تست فقط اگر T023(e) آن را پذیرفت می‌ماند.

#### Implementation for User Story 3

- [X] T022 [US3] در `backend/src/caravansara/bookings/repository.py`: افزودن کران `AND b.check_out <= ((:now AT TIME ZONE 'UTC') + interval '14 hours')::date` به `_COMPLETE_FINISHED`، با توضیح «هیچ منطقه‌ی زمانی‌ای بیش از ۱۴+ ساعت از UTC جلوتر نیست، پس اقامتی که پایانش به وقت شهر گذشته، check_out آن حداکثر همین تاریخ است (specs/backend research R5)». اگر T023 نشان داد که join با ` (003)listings` هنوز پرهزینه است، شکل join هم تنظیم شود، با همان نتیجه. SQL همان کوئری در `db/bulk/queries/` هم به‌روز شود.
- [X] T023 [US3] آزمایش‌ها روی `caravansara_bulk_lab`:
  - (h) پیش از (e) تا (g)، بررسی همه‌ی ایندکس‌ها (FR-007): `SELECT pg_stat_reset()`، اجرای کامل `measure-queries --database caravansara_bulk_lab`، و خواندن `pg_stat_user_indexes`. هر ایندکس با `idx_scan = 0` که پشت هیچ قیدی نیست (`pg_constraint.conindid`)، با تصمیم «حذف» یا «نگه داشتن با دلیل» در `measurements.md` ثبت شود. نامزدهای حذف در (f) اندازه گرفته می‌شوند.
  - (e) `CREATE INDEX bookings_confirmed_check_out_idx ON bookings (check_out) WHERE status = 'confirmed'`، با کران T022. زمان job، و تعداد ردیف وقتی `now` ۳۰ روز جلوتر است، که باید برابر ۴۳٬۷۴۲ و یکسان با کوئری قبلی باشد.
  - (f) حذف `listing_amenities_amenity_idx` و هر نامزد حذف دیگری از (h): زمان جستجوی شعاعی با امکانات، شمارش امکانات، و حذف یک امکان (`DELETE FROM amenities WHERE id = …` در تراکنش rollback، که کلید خارجی را بررسی می‌کند).
  - (g) `write_1000_bookings` با همه‌ی ایندکس‌های پذیرفته‌ی US2 و US3 روی هم، در مقابل خط پایه (حدود ۲۴۰ ms، research R6).

  نتیجه‌ها در `specs/backend/measurements.md` (003) زیر «آزمایش‌ها» ثبت شوند.
  - **اجرا:** پیش از (e)، job یک بار واقعاً روی کپی اجرا شد، چون ۲٬۶۶۴ اقامت گذشته منتظر `completed` شدن بودند و عدد حالت عادی را پنهان می‌کردند. آمار چندستونی `(status, check_out)` هم امتحان و رد شد.
- [X] T024 [US3] ساختن `backend/migrations/versions/0005_job_indexes.py` (`down_revision = "0004"`) با نامزدهای پذیرفته‌ی T023. downgrade هر ایندکس حذف‌شده را با تعریف دقیق قبلی برگرداند، و docstring عددها را بگوید.
- [X] T025 [US3] در `backend/tests/test_migrations.py` (بعد از T019، همان فایل): `0005` up و down، همان شکل T019.

**Checkpoint**: T020، T021 و T025 پاس شوند، و همه‌ی تست‌های job بدون تغییر پاس شوند.

---

### Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 اندازه‌گیری نهایی: `caravansara_bulk` با migration به head برود، بعد `ANALYZE`، بعد `measure-queries --out specs/backend/data/003-after.json` (003). در `specs/backend/measurements.md` (003) زیر «پس از تغییر» جدول مقایسه بیاید: نام، پیش، پس، تغییر٪، هدف ✓/✗. همچنین حجم کل ایندکس‌ها پیش و پس (SC-005). هر کوئری بیش از ۱۰٪ کندتر (SC-004) یا هنوز ✗ (SC-003) دلیل بگیرد. قاعده‌ی نوسان: اگر کوئری‌ای بیش از ۱۰٪ کندتر به نظر رسید، پیش (روی کپی آزمایشی با migration `0003`) و پس هر دو با `--runs 9` دوباره اندازه گرفته شوند، و فقط اگر دوباره کندتر بود کندی ثبت شود. هر دو عدد در جدول می‌آیند.
  - **اجرا:** خط پایه‌ی اول با یک اتصال مشترک گرفته شده بود، که JIT آن را کند می‌کرد. پس «پیش» دوباره گرفته شد: روی همان `caravansara_bulk` در `0003` با SQL قبلی (فهرست قدیمی از `data/003-captured-sql.json` بازسازی شد)، و پشت‌سرهم با «پس». پیش از هر دو، `listings` با `VACUUM FULL` فشرده شد. `seed-bulk` هم حالا خودش این کار را می‌کند، با تست در `test_devdata_bulk.py`.
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

### Dependencies & Execution Order

#### Phase Dependencies

- **Setup (Phase 1)**: بدون وابستگی.
- **Foundational (Phase 2)**: بعد از Setup؛ ابزار اندازه‌گیری برای همه‌ی storyها لازم است.
- **US1 (Phase 3)**: بعد از Phase 2. خط پایه‌ی T013 پیش از هر آزمایش US2 و US3.
- **US2 (Phase 4)**: بعد از US1 (فهرست و خط پایه).
- **US3 (Phase 5)**: بعد از US1. آزمایش (g) در T023 به نتیجه‌ی T016 وابسته است. migration `0005` بعد از `0004`.
- **Polish (Phase 6)**: بعد از همه.

#### User Story Dependencies

- **US1 (P1)**: فقط Phase 2.
- **US2 (P2)**: US1.
- **US3 (P3)**: US1؛ و T023(g) و T024 بعد از US2.

#### Within Each User Story

- تست‌ها اول، شکست‌خورده؛ بعد آزمایش؛ بعد کد و migration فقط برای نامزدهای پذیرفته.
- کارهای یک فایل به ترتیب: `test_migrations.py` (T007 → T019 → T025)، `test_index_usage.py` (T014 → T021).

#### Parallel Opportunities

- T003 با T002.
- T006، T007 و T008 فایل جدا دارند.
- T014 و T015 فایل جدا دارند.
- T020 و T021 فایل جدا دارند.
- T028 و T029 فایل جدا دارند.

---

### Parallel Example: User Story 1

```text
Task: "T006 [US1] catalog coverage and validity in backend/tests/test_query_catalog.py"
Task: "T007 [US1] 0003 migration test in backend/tests/test_migrations.py"
Task: "T008 [US1] exporter metric names in backend/tests/test_monitoring_config.py"
```

### Parallel Example: User Story 2

```text
Task: "T014 [US2] index usage in backend/tests/test_index_usage.py"
Task: "T015 [US2] anti-join result equality in backend/tests/test_search.py"
```

---

### Implementation Strategy

#### MVP First (User Story 1 Only)

1. Phase 1 و Phase 2: ابزار اندازه‌گیری.
2. Phase 3 (US1): فهرست، `pg_stat_statements`، پنل Grafana، خط پایه.
3. **توقف و بررسی**: عددهای `data/003-before.json`. ممکن است عددها نشان دهند که بخشی از US2 یا US3 لازم نیست.

#### Incremental Delivery

1. US1: هر کوئری مهم عدد دارد (MVP).
2. US2: جستجو و رزروهای آگهی.
3. US3: job پایان اقامت، هزینه‌ی نوشتن، ایندکس بی‌استفاده.
4. Polish: اندازه‌گیری نهایی، اسناد، کنترل کیفیت، converge، و pull request.

---

## 004. تأیید آگهی توسط مدیر سیستم (admin)

---

description: "Task list for feature implementation"
---

## Tasks: تأیید آگهی توسط مدیر سیستم (admin)

**Input**: Design documents from `/specs/backend` (004)

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/cli.md, quickstart.md

**Tests**: لازم‌اند. constitution اصل IV برای هر قاعده و هر سناریوی پذیرش تست خودکار می‌خواهد، و برای مسیری که فقط بازنده‌ی مسابقه اجرا می‌کند، تستی که همان مسابقه را بسازد. SC-008 زمان روی سخت‌افزار است و با دست، طبق quickstart §۵، اندازه گرفته می‌شود.

**Organization**:
- کارها بر اساس user story دسته‌بندی شده‌اند.
- کارهایی که یک فایل را تغییر می‌دهند، در هر فاز کنار هم آمده‌اند (constitution 1.2.0).
- migration `0006` کامل در Phase 2 است، تا هیچ فایل migration در دو فاز باز نشود.

**قاعده‌ی مستندسازی (مالک پروژه، 2026-11-07)**: هر ساختار تازه (ستون، جدول، تنظیم، سازوکار، تغییر رفتار) دلیل وجود و اثرش را در دو جا می‌گیرد: یک توضیح کوتاه در کد، کنار تعریفش، و بخش مربوط در `docs/backend-design.md` (T058). متن پایه‌ی هر دو جدول «ساختارهای تازه‌ی طراحی» در `docs/future-work.md` بخش ۱ است.

### Format: `[ID] [P?] [Story] Description`

- **[P]**: می‌تواند هم‌زمان اجرا شود (فایل جدا، بدون وابستگی به کار ناتمام)
- **[Story]**: US1 تا US5

### Path Conventions

- **بکند:** `backend/src/caravansara/`
- **تست‌ها:** `backend/tests/`
- **migrationها:** `backend/migrations/versions/`
- **داده:** `db/`
- **e2e:** `e2e/tests/`

---

### Phase 1: Setup (Shared Infrastructure)

- [X] T001 خط پایه‌ی کار، روی همین branch و پیش از هر تغییر، در `backend/`:
  - `uv run pytest -q` پاس شود (241 تست).
  - `uv run alembic heads` فقط `0005` را نشان دهد.
- [X] T002 خط پایه‌ی سرعت (SC-008)، پیش از migration تازه:
  - فرمان: `uv run caravansara measure-queries --database caravansara_bulk --out ../specs/backend/data/004-before.json` (004) روی `caravansara_bulk` (هنوز در `0005`).
  - ثبت در خروجی: تعداد آگهی‌های عمومی bulk با `SELECT count(*) FROM listings WHERE is_active` (research R5: 96961).
  - ثبت در خروجی: همان شمارش روی پایگاه داده‌ی دمو، برای SC-002.

---

### Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema، نوع حساب، توکن admin و قاعده‌ی «عمومی». هر story به این‌ها تکیه دارد.

**⚠️ CRITICAL**: هیچ کار storyای پیش از پایان این فاز شروع نمی‌شود.

#### Migration و تست آن

- [X] T003 نوشتن تست‌های migration در `backend/tests/test_migrations.py` (اول، شکست‌خورده):
  - **upgrade از `0005`** با آگهی‌های فعال و غیرفعال: همه `approved` شوند، و `submitted_at`، `rejection_reason` همه NULL و `review_version = 0` باشند (FR-013، US5/AC1).
  - **پیش‌فرض‌ها:** آگهی تازه بدون مقدار صریح `pending` با `submitted_at` پر ساخته شود. کاربر تازه `kind = 'member'` بگیرد.
  - **CHECKها:** `pending` بدون `submitted_at` رد شود. `rejected` بدون دلیل رد شود. دلیل برای غیر `rejected` رد شود. دلیل فقط فاصله یا بلندتر از 1000 نویسه رد شود.
  - **trigger:** UPDATE یا DELETE روی `listing_review_events` خطا بدهد.
  - **downgrade به `0005`:**
    - آگهی `pending` یا `rejected` با `is_active = false` بماند.
    - ردیف `kind = 'admin'` حذف شود.
    - شمار آگهی‌ها، رزروها و نظرها عوض نشود (R16).
- [X] T004 ساختن `backend/migrations/versions/0006_listing_review.py` طبق data-model.md:
  - **typeها:** `account_kind`، `listing_review_status` و `review_action`.
  - **`users`:** `kind account_kind NOT NULL DEFAULT 'member'` و `disabled_at timestamptz`.
  - **`listings`:**
    - `review_status ... NOT NULL DEFAULT 'approved'`، سپس `SET DEFAULT 'pending'`.
    - `submitted_at timestamptz`، سپس `SET DEFAULT now()`.
    - `rejection_reason text` و `review_version integer NOT NULL DEFAULT 0`.
    - CHECKهای `listings_pending_submitted_check` و `listings_rejection_reason_check`، و ایندکس `listings_review_queue_idx ON listings (submitted_at, id) WHERE review_status = 'pending'`.
  - **`listing_review_events`:** با CHECK `(action = 'rejected') = (reason IS NOT NULL)`، ایندکس `(listing_id, created_at)` و trigger `listing_review_events_append_only`.
  - **`admin_address_views`.**
  - **downgrade:** طبق R16. اول `UPDATE listings SET is_active = false WHERE review_status <> 'approved'`، سپس `DELETE FROM users WHERE kind = 'admin'`، سپس حذف جدول‌ها، ستون‌ها و typeها.
  - **docstring بالای فایل:** چرا پیش‌فرض دو مرحله‌ای است (بدون بازنویسی جدول؛ اندازه‌ی R5)، و چرا downgrade چیزی را عمومی نمی‌کند.
  - **اجرا:** CHECK جدول `auth_attempts` هم گسترش یافت (`admin_login`)، که plan ندیده بود؛ upgrade با `ANALYZE listings` تمام می‌شود (measurements.md)؛ downgrade جدول‌های سابقه را پیش از حذف admin برمی‌دارد، چون به او ارجاع دارند.

#### هسته (core)

- [X] T005 [P] در `backend/src/caravansara/core/config.py`:
  - `admin_token_minutes: int = 15`.
  - `admin_host: str = ""`، با توضیح: خالی یعنی endpointهای admin روی هر Host کار می‌کنند؛ پر یعنی فقط روی همان زیردامنه (constitution 1.3.0، R12).
- [X] T006 [P] در `backend/src/caravansara/core/security.py`:
  - `create_access_token` پارامتر `token_type` با مقدار `"access"` یا `"admin"` بگیرد، و عمر توکن admin از `admin_token_minutes` بیاید.
  - `decode_access_token` نوع مورد انتظار را بگیرد. مقدار پیش‌فرض `"access"` است، پس رفتار امروز عوض نمی‌شود.
  - dependencyهای `current_admin_id` و `CurrentAdminId` اضافه شوند. فقط decode می‌کنند، و `core` همچنان هیچ ماژولی را import نمی‌کند.
  - توضیح در کد: توکن admin به `CurrentUserId` نمی‌رسد، و همین است که admin را از ثبت آگهی و رزرو بازمی‌دارد (R1).
- [X] T007 [P] در `backend/src/caravansara/core/metrics.py`:
  - `LISTING_REVIEW_EVENTS = Counter("caravansara_listing_review_events_total", ..., ["event"])` با `submitted`، `approved` و `rejected`، که از ابتدا با 0 ساخته می‌شوند.
  - `LISTING_REVIEW_QUEUE = Gauge("caravansara_listing_review_queue", ...)`.
  - `LISTING_REVIEW_OLDEST_WAIT = Gauge("caravansara_listing_review_oldest_wait_seconds", ...)`.
  - برچسب `admin_login` در `RATE_LIMITED`.
  - توضیح در کد: gaugeها را فقط worker می‌نویسد (R10).

#### identity

- [X] T008 در `backend/src/caravansara/identity/models.py`:
  - enum `AccountKind` (`member`، `admin`) و ستون‌های `kind` و `disabled_at` روی `User`.
  - توضیح در کد: چرا همان جدول، با استناد به یکتایی ایمیل (R1).
- [X] T009 در `backend/src/caravansara/identity/repository.py`: `get_user_by_email` پارامتر اختیاری `kind` بگیرد.
- [X] T010 در `backend/src/caravansara/identity/service.py`:
  - `login` فقط حساب `member` را بپذیرد. حساب admin همان `invalid_credentials` را بگیرد.
  - `admin_login(session, settings, email, password, ip)`: همان `auth_attempts` با `action = 'admin_login'`، همان سقف‌ها، و `TooManyAttempts("admin_login")`. حساب `member` یا از کار افتاده `invalid_credentials` بگیرد. خروجی `AdminTokenOut` است، بدون refresh token (R2، R3).
  - `require_active_admin(session, admin_id)`: اگر ردیف نیست، `kind <> 'admin'` است یا `disabled_at` پر است، `Unauthorized(code="invalid_token")`.
  - `create_admin(session, email, password, full_name)`: اگر هر حسابی با آن ایمیل هست، `AdminRefused("an account with this email already exists; admin accounts are always new")`. `IntegrityError` ایمیل یکتا هم همان خطا را بدهد.
  - `disable_admin(session, email)`: `AdminRefused` برای «no admin account with this email» و «this admin account is already disabled».
  - توضیح در کد کنار `require_active_admin`: چرا در هر درخواست، یعنی از کار انداختن بی‌درنگ اثر کند (R2).
- [X] T011 در `backend/src/caravansara/identity/schemas.py`: `AdminTokenOut` با `access_token`، `token_type = "bearer"` و `expires_in`، با مثال.

#### listings: مدل و قاعده‌ی «عمومی»

- [X] T012 در `backend/src/caravansara/listings/models.py`:
  - enumهای `ReviewStatus` و `ReviewAction`.
  - ستون‌های `review_status`، `submitted_at`، `rejection_reason` و `review_version` روی `Listing`.
  - مدل `ListingReviewEvent`.
  - توضیح کنار `review_version`: چرا وجود دارد و چه چیزی آن را بالا می‌برد. متن پایه در future-work بخش ۱.
- [X] T013 در `backend/src/caravansara/listings/repository.py`:
  - `has_live_booking(session, listing_id, guest_id)`: یک `EXISTS` با `text()` روی `bookings`، با `status IN ('pending','confirmed','completed') AND (status <> 'pending' OR hold_expires_at > now())`.
  - توضیح در کد: چرا SQL ساده و نه `bookings.service`، یعنی import دوری (R8).
  - `add_review_event(...)`.
  - `decide(session, listing_id, version, status, reason)`: UPDATE شرطی `WHERE id = :id AND review_status = 'pending' AND review_version = :v RETURNING id` (R6).
  - `resubmit(session, listing_id, host_id)`: UPDATE شرطی `WHERE review_status = 'rejected'`.
  - `review_queue(limit, offset)`، مرتب بر `(submitted_at, id)`.
  - `review_queue_stats()`: `count(*)` و `min(submitted_at)` روی ایندکس صف.
  - **اجرا (یافته‌ی C1 analyze):** چهار کوئری اندازه‌گیری‌شده (`listing_live_booking`، `review_queue_page`، `review_queue_count`، `review_queue_stats`) و چهار تابع کنارگذاشته با دلیل به `db/bulk/queries/catalog.json` اضافه شدند، و رونوشت‌های `SELECT listings…` و `SELECT users…` ستون‌های تازه را گرفتند.
- [X] T014 در `backend/src/caravansara/listings/schemas.py`:
  - `ListingReview` (`status`، `rejection_reason`، `submitted_at`).
  - فیلد `review: ListingReview | None` در `ListingOut` و `ListingSummary`.
  - `AdminQueueItem`، `AdminQueuePage` و `AdminListingOut` طبق contracts/api.md، با مثال.
- [X] T015 در `backend/src/caravansara/listings/service.py`:
  - `ListingInfo` فیلدهای `review_status` و `is_public` (`is_active and review_status == approved`) بگیرد.
  - تابع کمکی `_visible_to(session, listing, viewer_id)`: میزبان، یا آگهی عمومی، یا `has_live_booking` (FR-002، FR-019).
  - `require_visible_listing(session, listing_id, viewer_id)` برای ماژول‌های دیگر. آگهی نادیدنی `NotFound` بگیرد.
  - `_detail` فیلد `review` را فقط برای میزبان پر کند.

#### factory تست‌ها

- [X] T016 در `backend/tests/factories.py`:
  - `listing(..., approved: bool = True)`: پس از ساختن از راه API، اگر `approved` است، آگهی را با SQL مستقیم `approved` کند. تست‌های امروز جستجو، آگهی و رزرو آگهی عمومی می‌خواهند، و باید بدون تغییر پاس شوند (SC-007).
  - `admin(name)`: حساب admin را با `identity.service.create_admin` بسازد و توکن admin را با `admin_login` بگیرد.
  - توضیح کنار `approved=True`: همین دلیل.
  - **اجرا:** پیش‌فرض `approved=True` در خود `tests/helpers.py::create_listing` است، نه فقط factory، چون بیشتر تست‌ها آگهی را مستقیم با آن helper می‌سازند. پاک‌سازی دو تست (`test_search.py`، `test_jobs.py`) که آگهی را `DELETE` می‌کردند به `TRUNCATE` تبدیل شد، چون سابقه‌ی فقط افزودنی حذف آگهی را رد می‌کند.

**Checkpoint**:
- `uv run pytest -q` همه‌ی تست‌های امروز را پاس کند (SC-007).
- `uv run pytest tests/test_migrations.py -q` پاس شود.
- `uv run mypy` پاس شود.

---

### Phase 3: User Story 4 - حساب مدیر سیستم فقط با فرمان ساخته می‌شود (Priority: P1)

**Goal**: فرمان‌های `create-admin` و `disable-admin`، ورود admin، و هیچ راه عمومی به حساب admin.

**Independent Test**: فرمان admin می‌سازد. با آن وارد می‌شوند. ساختن آگهی و رزرو با آن رد می‌شود. از کار انداختن دسترسی را قطع می‌کند. ثبت‌نام یا ویرایش پروفایل با هر داده‌ای admin نمی‌سازد.

#### Tests for User Story 4 ⚠️

- [X] T017 [P] [US4] نوشتن `backend/tests/test_admin.py` (اول، شکست‌خورده):
  - **US4/AC1:** `create_admin` حساب `admin` می‌سازد، و `POST /api/v1/admin/auth/login` توکن `type: admin` و `expires_in = 900` می‌دهد.
  - **US4/AC2:** ایمیل عضو موجود و ایمیل admin موجود هر دو رد شوند، و هیچ ردیفی عوض نشود. ایمیل با حروف بزرگ دیگر هم رد شود.
  - **US4/AC3:** پس از `disable_admin`، درخواست بعدی admin با همان توکن `401 invalid_token` بگیرد، ورود دوباره `401 invalid_credentials` بگیرد، و ردیف‌های سابقه‌اش بمانند.
  - **US4/AC4 و SC-005:**
    - `POST /auth/register` با `"kind": "admin"` حساب `member` بسازد.
    - `PATCH /me` با `"kind": "admin"` آن را عوض نکند.
    - هیچ مسیری در `openapi.json` جز `/admin/auth/login` با حساب admin کار نکند.
  - **US4/AC5:** توکن admin روی `POST /listings`، `POST /bookings` و `GET /me` `401 invalid_token` بگیرد.
  - **ورود عادی:** `POST /auth/login` با ایمیل و رمز درست admin `401 invalid_credentials` بگیرد.
  - **محدودیت تلاش:** پس از `login_max_failures` تلاش ناموفق، `429 too_many_attempts` و شمارنده‌ی `admin_login`. تلاش‌های ناموفق ورود عادی سقف admin را پر نکنند.
- [X] T018 [P] [US4] در `backend/tests/test_cli.py`:
  - **`create-admin`:** با `CARAVANSARA_ADMIN_PASSWORD` کد 0 و `admin created: <id>` بدهد، و ایمیل در خروجی نباشد. ایمیل موجود کد 1 و پیام contracts/cli.md را بدهد. رمز کوتاه‌تر از 8 کد 1 بدهد. بدون متغیر، `getpass` دو بار پرسیده شود (monkeypatch)، و دو رمز نابرابر کد 1 بدهد.
  - **`disable-admin`:** کد 0. ایمیل عضو، ایمیل ناموجود و حساب از کار افتاده هر کدام کد 1 بدهند.
  - **`seed-demo`:** با `environment = production`، `refused: demo data is for development only` و کد 1.

#### Implementation for User Story 4

- [X] T019 [US4] در `backend/src/caravansara/cli.py`:
  - زیرفرمان‌های `create-admin --email --name` و `disable-admin --email`، طبق contracts/cli.md (R14).
  - رمز از `CARAVANSARA_ADMIN_PASSWORD`، یا `getpass` دو بار، با قاعده‌ی 8 تا 128 نویسه.
  - کد خروج 1 برای `AdminRefused` و خطای رمز.
  - قفل production برای `seed-demo`، با توضیح در کد: دمو رمزهای شناخته‌شده و یک admin دارد (R15).
  - به‌روز کردن docstring بالای فایل.
- [X] T020 [US4] ساختن ماژول `backend/src/caravansara/moderation/`:
  - **`models.py`:** `AdminAddressView`.
  - **`repository.py`:** `record_address_view`.
  - **`schemas.py`:** `AdminLoginIn`، `DecisionIn` (`review_version`) و `RejectIn` (`review_version`، `reason` با `strip` و طول 1 تا 1000).
  - **`service.py`:** فقط از راه `identity.service` و `listings.service`.
  - **`router.py`:**
    - `APIRouter(prefix="/admin", tags=["Admin"])`، با dependency `AdminId` که `CurrentAdminId` و `identity.service.require_active_admin` را پشت سر هم اجرا می‌کند.
    - dependency `admin_host_guard`: اگر `settings.admin_host` پر است و `request.url.hostname` با آن برابر نیست، `NotFound` بدهد (R12).
    - endpoint `POST /admin/auth/login`. فقط guard را دارد و `AdminId` را ندارد.
  - توضیح در router: ترتیب dependencyها یعنی پیش از ورود admin هیچ داده‌ای از آگهی برنمی‌گردد (R13).
- [X] T021 [US4] در `backend/src/caravansara/main.py`: افزودن router `moderation` به `api`.
- [X] T022 [US4] در `backend/pyproject.toml`:
  - قرارداد تازه‌ی «moderation uses other modules only through their service».
  - `caravansara.moderation` در فهرست ممنوعه‌ی `core`، قرارداد `devdata` و قرارداد «feature modules do not use devdata».
  - `moderation.models`، `.repository` و `.router` در فهرست ممنوعه‌ی قرارداد هر ماژول دیگر.

**Checkpoint**:
- `uv run pytest tests/test_admin.py tests/test_cli.py -q` پاس شود.
- `uv run lint-imports` یازده قرارداد را نگه دارد.

---

### Phase 4: User Story 1 - آگهی تازه فقط پس از تأیید عمومی می‌شود (Priority: P1) 🎯 MVP

**Goal**: آگهی در انتظار از هر مسیر عمومی پنهان است. admin صف را می‌بیند، جزئیات را با نشانی دقیق می‌بیند (و ثبت می‌شود)، و تأیید می‌کند.

**Independent Test**: میزبان آگهی می‌سازد. جستجو و صفحه آن را نشان نمی‌دهند، و رزرو رد می‌شود. admin تأیید می‌کند. حالا جستجو و رزرو کار می‌کنند.

#### Tests for User Story 1 ⚠️

- [X] T023 [P] [US1] نوشتن `backend/tests/test_listing_review.py`، بخش US1 (اول، شکست‌خورده). هر مسیر عمومی یک تست دارد (SC-001):
  - **مسیرهای عمومی برای آگهی `pending`:**
    - نبودن در `GET /search/listings`، شهری و شعاعی.
    - نبودن در شمارش‌های `GET /search/filters`.
    - `404` در `GET /listings/{id}` بدون توکن، و با توکن کاربر دیگر.
    - `404` در `GET /listings/{id}/reviews`.
    - `404 not_found` در `POST /bookings`، بی‌آنکه هیچ رزروی ساخته شود (US1/AC1، AC3).
  - **دید میزبان (US1/AC2):** `GET /me/listings` و `GET /listings/{id}` برای میزبان `review.status = "pending"` نشان می‌دهند. برای بیننده‌ی دیگرِ آگهی عمومی، `review` برابر `null` است.
  - **صف (US1/AC4):** چند آگهی در انتظار با `submitted_at` متفاوت به ترتیب قدیمی‌ترین برگردند، با `total` درست. آگهی `approved` در صف نباشد.
  - **جزئیات admin:** `private_location`، `review` و `review_version` را داشته باشد. هر فراخوانی دقیقاً یک ردیف `admin_address_views` با admin، آگهی و زمان بنویسد (FR-018، SC-009).
  - **تأیید (US1/AC5):** آگهی از صف بیرون برود و در جستجو باشد. رزرو کار کند. یک ردیف سابقه‌ی `approved` با `actor_id` admin و `review_version` نوشته شود. شمارنده‌ی `approved` یکی بالا برود.
  - **آگهی تأییدشده‌ی غیرفعال (US1/AC6):** پنهان است، و پس از فعال شدن دوباره بدون بازبینی دیده می‌شود.
  - **غیر admin (US1/AC7، FR-020):** بدون توکن، با توکن عضو و با توکن admin از کار افتاده، هر چهار endpoint admin `401` بدهند. برای آگهی ناموجود هم `401` باشد، نه `404`.
  - **تأیید دوباره:** `409 listing_not_pending`.
  - **`admin_host`:** با `admin_host = "admin.example.com"`، درخواست با Host دیگر `404` بگیرد، و با همان Host کار کند.
  - **FR-019:** مهمانی با رزرو `confirmed`، `completed` یا نگه‌داشتِ نگذشته در آگهی پنهان صفحه را می‌بیند (`private_location` فقط پس از پرداخت). مهمانی با رزرو `cancelled`، `expired` یا نگه‌داشتِ گذشته `404` می‌گیرد.
  - **اجرا (یافته‌ی U1 analyze):** `private_location` در صفحه‌ی آگهی مثل قبل فقط برای میزبان است؛ مهمانِ دارای رزرو صفحه را بدون نشانی دقیق می‌بیند، و نشانی را در صفحه‌ی رزرو.
- [X] T024 [P] [US1] در `backend/tests/test_concurrency.py`: دو تأیید هم‌زمان از دو admin روی یک آگهی. دقیقاً یکی `200` بگیرد و دیگری `409 listing_not_pending`، و فقط یک ردیف سابقه نوشته شود (FR-006). این مسیر بازنده است (constitution اصل IV).
- [X] T025 [P] [US1] در `backend/tests/test_search.py`: آگهی `rejected` و `pending` در هیچ‌کدام از جستجوی شهری، شعاعی با تاریخ (هر دو راه `_HASHED_MAX_NIGHTS`) و شمارش‌ها نیامده باشد.
- [X] T026 [P] [US1] در `backend/tests/test_reviews.py`: نظرهای آگهی غیرفعال یا در انتظار برای بیننده‌ی بی‌رزرو `404` بدهد، و برای میزبان و مهمانِ دارای رزرو دیده شود. این رفتار امروز آگهی غیرفعال را عوض می‌کند (future-work بخش ۱، جدول ساختارها).

#### Implementation for User Story 1

- [X] T027 [US1] در `backend/src/caravansara/listings/service.py`:
  - `create_listing` پس از flush یک ردیف سابقه‌ی `submitted` با `actor_id = host_id` بنویسد، و `LISTING_REVIEW_EVENTS.labels("submitted")` را پس از commit بالا ببرد.
  - `get_listing` به‌جای `is_active` قاعده‌ی `_visible_to` را به کار ببرد.
  - `my_listings` فیلد `review` بدهد.
  - سرویس‌های admin:
    - `review_queue(session, storage, limit, offset)`.
    - `review_detail(session, storage, listing_id)`: `AdminListingOut`، همیشه با `private_location`.
    - `approve(session, listing_id, admin_id, version)` و `reject(session, listing_id, admin_id, version, reason)`. هر دو از `repo.decide` استفاده می‌کنند. اگر هیچ ردیفی عوض نشود، وضعیت دوباره خوانده می‌شود: دیگر `pending` نیست ← `Conflict("listing_not_pending", ...)`؛ نسخه عوض شده ← `Conflict("listing_changed", ...)`. سابقه در همان تراکنش نوشته می‌شود، و شمارنده پس از commit بالا می‌رود.
  - `review_queue_stats(session)` برای worker.
  - توضیح در کد کنار `approve` و `reject`: چرا UPDATE شرطی و `review_version` (R6).
- [X] T028 [US1] در `backend/src/caravansara/moderation/service.py` و `backend/src/caravansara/moderation/router.py`:
  - `GET /admin/listings/pending` (`PageDep`)، `GET /admin/listings/{listing_id}`، `POST /admin/listings/{listing_id}/approve`، `POST /admin/listings/{listing_id}/reject`. هر کدام با `summary`، `description`، `error_responses(...)` و مثال، طبق contracts/api.md.
  - `review_detail` و `record_address_view` در یک تراکنش.
  - `reject` در این فاز فقط مسیر router است. رفتار و تستش در US2 می‌آیند.
- [X] T029 [US1] در `backend/src/caravansara/search/repository.py`:
  - `_where` شرط `l.review_status = 'approved'` را کنار `l.is_active` بگیرد.
  - به‌روز کردن docstring بالای فایل: «فقط آگهی عمومی: فعال و تأییدشده».
  - توضیح در کد: ایندکس‌های جزئی `WHERE is_active` همچنان به کار می‌روند، و شرط تازه فقط یک Filter است (اندازه‌ی R9).
- [X] T030 [US1] در `backend/src/caravansara/bookings/service.py`: `create_booking` به‌جای `info.is_active` شرط `info.is_public` را بررسی کند، با همان `NotFound("Listing not found.")` (FR-011).
- [X] T031 [US1] در `backend/src/caravansara/reviews/router.py` و `backend/src/caravansara/reviews/service.py`:
  - `GET /listings/{listing_id}/reviews` بیننده‌ی `OptionalUserId` بگیرد.
  - `listing_reviews` به‌جای `get_listing_info`، `listings.require_visible_listing(session, listing_id, viewer_id)` را صدا بزند.
  - به‌روز کردن `description` endpoint.
- [X] T032 [US1] در `backend/src/caravansara/listings/router.py`: به‌روز کردن `description` مسیرهای `GET /listings/{listing_id}`، `GET /me/listings` و `POST /listings`، طبق contracts/api.md («آگهی تازه در انتظار تأیید است…»).
- [X] T033 [P] [US1] در `db/search_query.sql` و `db/bulk/queries/search_*.sql` و `db/bulk/queries/filters_*.sql`: افزودن شرط `l.review_status = 'approved'`، تا رونوشت‌ها با SQL واقعی برابر بمانند (`tests/test_query_catalog.py`).
  - **اجرا (یافته‌ی I1 analyze):** `test_query_catalog.py` برابری متن را نمی‌سنجد، فقط پوشش و اجرا؛ رونوشت‌ها با دست هم‌خوان شدند و quickstart درست شد.

**Checkpoint**:
- `uv run pytest tests/test_listing_review.py tests/test_search.py tests/test_reviews.py tests/test_concurrency.py -q` پاس شود.
- این‌جا MVP کامل است: آگهی تازه فقط پس از تأیید admin عمومی می‌شود.

---

### Phase 5: User Story 5 - آگهی‌های موجود همچنان دیده می‌شوند (Priority: P1)

**Goal**: داده‌ی دمو و حجیم پس از نصب همان آگهی‌های عمومی را دارند. دمو یک آگهی در انتظار، یک آگهی ردشده و یک admin دارد.

**Independent Test**: شمار آگهی‌های عمومی پیش و پس از نصب، روی دمو و حجیم، یکی است.

#### Tests for User Story 5 ⚠️

- [X] T034 [P] [US5] در `backend/tests/test_demo_data.py`:
  - پس از `seed-demo`، همه‌ی آگهی‌ها `approved` باشند، جز `pending_listing` و `rejected_listing` در `edge_cases.json` (US5/AC2، FR-014).
  - `rejected_listing` دلیل داشته باشد، با یک ردیف سابقه‌ی `rejected` از `admin@example.com`.
  - `admin@example.com` با `kind = 'admin'` و رمز `caravansara-demo` از `/admin/auth/login` وارد شود.
  - شمار آگهی‌های عمومی برابر شمار پیش از این کار، منهای دو حالت مرزی تازه، باشد (SC-002؛ عدد از T002).
- [X] T035 [P] [US5] در `backend/tests/test_devdata_bulk.py`: پس از `seed-bulk` کوچک، همه‌ی آگهی‌ها `approved` باشند، و شمار آگهی‌های عمومی برابر شمار `is_active` باشد.

#### Implementation for User Story 5

- [X] T036 [US5] در `db/demo/build_demo_seed.py`:
  - **حساب admin:** `admin@example.com` با `kind = 'admin'` (ستون `kind` در INSERT `users`).
  - **پس از INSERT آگهی‌ها:** `UPDATE listings SET review_status = 'approved'`.
  - **دو حالت مرزی در `edge_cases`:**
    - `pending_listing`: `review_status = 'pending'`، `submitted_at`، و سابقه‌ی `submitted` از میزبانش.
    - `rejected_listing`: `rejected`، با دلیل فارسی کوتاه، و سابقه‌ی `submitted` و `rejected` از admin.
  - هیچ‌کدام از این دو، آگهی‌ای نیست که حالت مرزی دیگری یا رزرو آینده‌ی `guest@example.com` دارد.
  - به‌روز کردن سربرگ SQL، با admin در فهرست حساب‌ها.
  - setval sequence رویدادها.
  - توضیح در کد: چرا UPDATE صریح لازم است، یعنی پیش‌فرض تازه `pending` است (R5، R15).
- [X] T037 [US5] اجرای `python3 db/demo/build_demo_seed.py` (کش `.cache/insideairbnb/` موجود است). خروجی‌ها: `db/seed_demo.sql`، `db/demo/edge_cases.json` و جدول README. بررسی با `git diff --stat` که تغییر فقط در جاهای انتظار است.
- [X] T038 [US5] در `db/demo/README.md`: حساب admin، دو حالت مرزی تازه، و اینکه `seed-demo` در production اجرا نمی‌شود، با دلیل.
- [X] T039 [US5] در `backend/src/caravansara/devdata/bulk.py`: ستون `review_status` در `COLUMNS["listings"]` و مقدار `approved` در هر ردیف. توضیح در کد: همان دلیل T036.

**Checkpoint**: `uv run pytest tests/test_demo_data.py tests/test_devdata_bulk.py -q` پاس شود.

---

### Phase 6: User Story 2 - رد با دلیل، اصلاح و ارسال دوباره (Priority: P2)

**Goal**: رد با دلیل نوشته‌شده، دیدن دلیل توسط میزبان، و ارسال دوباره به انتهای صف.

**Independent Test**: admin با دلیل رد می‌کند. میزبان دلیل را می‌بیند، ویرایش می‌کند و دوباره می‌فرستد. آگهی در صف است و پس از تأیید عمومی می‌شود.

#### Tests for User Story 2 ⚠️

- [X] T040 [P] [US2] در `backend/tests/test_listing_review.py`، بخش US2:
  - **US2/AC1:** رد بدون دلیل، با دلیل فقط فاصله، و با دلیل بلندتر از 1000 نویسه `422` بگیرد، و آگهی در صف بماند.
  - **US2/AC2:**
    - رد با دلیل آگهی را از صف بیرون می‌برد و عمومی نمی‌کند.
    - `GET /me/listings` وضعیت `rejected` و همان دلیل را نشان می‌دهد (FR-003).
    - یک ردیف سابقه‌ی `rejected` با دلیل نوشته می‌شود، و شمارنده‌ی `rejected` یکی بالا می‌رود.
  - **US2/AC3:** ویرایش آگهی ردشده ذخیره می‌شود و `rejected` می‌ماند.
  - **US2/AC4:**
    - `POST /listings/{id}/resubmit` آگهی را `pending` می‌کند و `submitted_at` تازه می‌دهد، پس آگهی آخر صف است.
    - `review.rejection_reason` برابر `null` می‌شود.
    - یک ردیف سابقه‌ی `resubmitted` و شمارنده‌ی `submitted`.
  - **US2/AC5:** ارسال دوباره‌ی آگهی `pending` یا `approved` `409 listing_not_rejected` بگیرد. ارسال توسط غیر میزبان `403 not_listing_host` بگیرد.
  - **آگهی ردشده‌ی غیرفعال:** دوباره فرستاده می‌شود، و پس از تأیید تا فعال نشود عمومی نیست (Edge Cases).

#### Implementation for User Story 2

- [X] T041 [US2] در `backend/src/caravansara/listings/service.py`:
  - `resubmit_listing(session, storage, listing_id, user_id)` از `repo.resubmit`. اگر هیچ ردیفی عوض نشد: میزبان نیست ← `Forbidden(not_listing_host)`؛ وگرنه ← `Conflict("listing_not_rejected", ...)`.
  - سابقه‌ی `resubmitted` در همان تراکنش، و شمارنده‌ی `submitted`.
  - رفتار `reject` در T027 با تست‌های T040 کامل شود.
- [X] T042 [US2] در `backend/src/caravansara/listings/router.py`: `POST /listings/{listing_id}/resubmit` با `summary`، `description` و `error_responses(401, 403, 404, 409)`، طبق contracts/api.md.

**Checkpoint**: بخش US2 در `tests/test_listing_review.py` پاس شود.

---

### Phase 7: User Story 3 - ویرایش توصیف آگهی تأییدشده، بازبینی دوباره می‌خواهد (Priority: P2)

**Goal**: ویرایش توصیفی آگهی تأییدشده آن را به صف برمی‌گرداند، و ویرایش عملیاتی نه. تأیید نسخه‌ای را که admin ندیده عمومی نمی‌کند.

**Independent Test**: تغییر قیمت آگهی را عمومی نگه می‌دارد. تغییر عنوان آن را پنهان می‌کند و به صف می‌برد. رزرو موجود برقرار می‌ماند. پس از تأیید دوباره، آگهی عمومی است.

#### Tests for User Story 3 ⚠️

- [X] T043 [P] [US3] در `backend/tests/test_listing_review.py`، بخش US3. هر فیلد یک تست پارامتری دارد (SC-003):
  - **US3/AC1، FR-009، روی آگهی تأییدشده و فعال:** هر یک از این‌ها آگهی را `pending` می‌کند، با `submitted_at` تازه، `review_version + 1`، سابقه‌ی `edited`، و پنهان از جستجو:
    - `title`، `description`، `city_id`، `neighborhood`، `address`، `latitude` و `longitude`، `property_type`.
    - `PUT /amenities` با مجموعه‌ی دیگر.
    - `POST /photos` (عکس تازه).
    - `PATCH /photos/{id}` با `caption` یا `room_tag` تازه.
  - **US3/AC2، FR-010:** هیچ‌کدام از این‌ها وضعیت یا `review_version` را عوض نمی‌کند:
    - `price_per_night`، `cleaning_fee`، `currency`، `is_active`.
    - `check_in_time`، `check_out_time`.
    - `max_guests`، `bedrooms`، `beds`، `bathrooms`.
    - `pets_allowed` و `max_pets`.
    - `PUT /photos/order` (ترتیب و کاور)، `DELETE /photos/{id}`.
  - **US3/AC3، SC-004:** رزرو آینده پس از برگشت به صف همان وضعیت و مبلغ را دارد. مهمانش صفحه‌ی آگهی را می‌بیند، و پرداخت و لغو مثل امروز کار می‌کنند (FR-011).
  - **US3/AC4:** یک PATCH با قیمت و عنوان هر دو را ذخیره می‌کند و آگهی را به صف می‌برد.
  - **US3/AC5:** PATCH با همان عنوان، همان مختصات تا 6 رقم، همان مجموعه‌ی امکانات، یا همان `caption`، آگهی را `approved` نگه می‌دارد.
  - **US3/AC6:** ویرایش توصیفی آگهی `pending`، `submitted_at` را نگه می‌دارد (جای صف عوض نمی‌شود) و `review_version` را بالا می‌برد.
  - **`listing_changed`:** admin جزئیات را با نسخه‌ی `v` می‌گیرد، میزبان عنوان را عوض می‌کند، و تأیید با `v` `409 listing_changed` می‌گیرد. تأیید با نسخه‌ی تازه کار می‌کند.
  - **ویرایش توصیفی آگهی تأییدشده‌ی غیرفعال:** آگهی `pending` می‌شود، و فعال کردن بعدی آن را عمومی نمی‌کند (Edge Cases).
  - **نظرها:** نظرهای آگهی برگشته به صف پس از تأیید دوباره همراهش دیده می‌شوند.
  - **اجرا (یافته‌ی G1 analyze):** پرداخت نگه‌داشتِ باز روی آگهی پنهان، پایان اقامت با worker و ثبت نظر هم تست شدند.
- [X] T044 [P] [US3] در `backend/tests/test_concurrency.py`: ویرایش عنوان و تأیید هم‌زمان. یا ویرایش پیش از تأیید قفل می‌گیرد و تأیید `409 listing_changed` می‌گیرد، یا تأیید پیش از ویرایش انجام می‌شود و ویرایش آگهی را دوباره `pending` می‌کند. در هیچ ترتیبی آگهی با عنوان تازه `approved` نیست، مگر با تأییدی که همان نسخه را دیده است (Edge Cases).

#### Implementation for User Story 3

- [X] T045 [US3] در `backend/src/caravansara/listings/service.py`:
  - ثابت `_DESCRIPTIVE = {"title", "description", "property_type", "city_id", "neighborhood", "address", "latitude", "longitude"}`، با توضیح: فهرست تصمیم مالک پروژه (future-work بخش ۱).
  - تابع کمکی `_descriptive_changed(listing, changes)`: مقایسه‌ی مقدار. مختصات با گرد کردن `f"{x:.6f}"` مقایسه می‌شوند (R7).
  - تابع کمکی `_after_descriptive_edit(session, listing, user_id)`:
    - `review_version += 1`.
    - اگر `approved` است: `pending`، `submitted_at = now()`، سابقه‌ی `edited` و شمارنده‌ی `submitted`.
  - فراخوانی آن در `update_listing`، `set_amenities` (مجموعه‌ی تازه با `repo.amenity_ids` فعلی مقایسه می‌شود)، `add_photo`، و `update_photo` (فقط اگر `caption` یا `room_tag` واقعاً عوض شده باشد).
  - `reorder_photos` و `delete_photo` آن را صدا نمی‌زنند، با یک خط توضیح (FR-010).
  - همه زیر همان قفل `_get_owned` (`FOR UPDATE`) که امروز هست.

**Checkpoint**: بخش US3 در `tests/test_listing_review.py`، و `tests/test_concurrency.py`، پاس شوند.

---

### Phase 8: Polish & Cross-Cutting Concerns

#### مانیتورینگ (FR-016)

- [X] T046 [P] در `backend/tests/test_jobs.py`: پس از `run_once`، دو gauge برابر شمار آگهی‌های `pending` و عمر قدیمی‌ترین `submitted_at` باشند، و با صف خالی هر دو 0.
- [X] T047 در `backend/src/caravansara/jobs/runner.py`:
  - `run_once` در session سوم `listings.service.review_queue_stats` را بخواند و دو gauge را بنویسد.
  - `JobResult` فیلد `review_queue` بگیرد.
  - span فیلد `caravansara.review_queue` بگیرد.
  - به‌روز کردن docstring بالای فایل («دو کار رزرو و عدد صف بازبینی»)، با دلیل R10.
- [X] T048 در `observability/grafana/dashboards/caravansara.json`: ردیف «Listing review» با سه پنل: تعداد صف، قدیمی‌ترین انتظار (ثانیه) و نرخ `caravansara_listing_review_events_total` بر حسب `event`.
- [X] T049 [P] در `backend/tests/test_monitoring_config.py`: اگر تست موجود هر متریک داشبورد را با متریک‌های export‌شده نمی‌سنجد، سه متریک تازه به آن اضافه شود.
  - **اجرا (یافته‌ی A2 analyze):** تست‌های موجود همین را می‌سنجند و با سه متریک تازه پاس شدند؛ تغییری لازم نبود.

#### قرارداد API و e2e

- [X] T050 اجرای `uv run caravansara export-openapi`. بررسی `git diff backend/openapi.json`: فقط افزودنی باشد (FR-017)، یعنی هیچ کد خطا، فیلد یا مسیر موجودی حذف یا عوض نشده باشد. سپس `uv run pytest tests/test_openapi_contract.py -q`.
- [X] T051 [P] نوشتن `e2e/tests/moderation.spec.ts`:
  - admin را با `docker compose exec -T -e CARAVANSARA_ADMIN_PASSWORD=… api caravansara create-admin` بسازد (helper در `e2e/tests/helpers.ts`)، تا وجود فرمان در image واقعی سنجیده شود.
  - جریان کامل: میزبان می‌سازد، جستجو آن را ندارد، admin وارد می‌شود، صف و جزئیات را می‌بیند و تأیید می‌کند، جستجو آن را دارد، و مهمان رزرو می‌کند.
  - رد با دلیل و ارسال دوباره.
- [X] T052 [P] در `e2e/tests/listings.spec.ts`، `search.spec.ts`، `bookings.spec.ts` و `reviews.spec.ts`: آگهی‌هایی که این تست‌ها می‌سازند پیش از جستجو و رزرو تأیید شوند (helper تأیید در `e2e/tests/helpers.ts`، با همان admin). این‌جا فقط آماده‌سازی تست عوض می‌شود، نه انتظارها (SC-007).
  - **اجرا:** تأیید در `e2e/tests/helpers.ts` است (`createListing` و `addPhoto`، با `{ approved: false }` برای استثنا)، پس فایل‌های spec دیگر بدون تغییر ماندند.
- [X] T053 در `e2e/README.md`: افزودن `moderation.spec.ts` به جدول، و به‌روز کردن تعداد endpointها و تست‌ها.

#### اندازه‌گیری (SC-008)

- [X] T054 مهاجرت `caravansara_bulk` با `CARAVANSARA_DATABASE_URL=…/caravansara_bulk uv run caravansara migrate`، سپس `measure-queries --out ../specs/backend/data/004-after.json` (004).
- [X] T055 نوشتن `specs/backend/measurements.md` (004):
  - میانه‌ی پیش و پس هر کوئری جستجو و شمارش.
  - قبول اگر هیچ‌کدام بیش از 10٪ کندتر نشده باشد.
  - زمان migration روی bulk.
  - شمار آگهی‌های عمومی پیش و پس (SC-002، عدد T002).

#### مستندها (قاعده‌ی مستندسازی بالا، و constitution: Development Workflow)

- [X] T056 [P] در `db/schema.sql` و `db/schema.dbml`، سپس `db/erd.mmd` و `db/erd.png`: ستون‌ها، جدول‌ها، typeها، CHECKها، trigger و ایندکس 0006، هر کدام با توضیح کوتاه چرایی (`review_version`، `kind`، `admin_address_views`).
  - **اجرا:** `schema.sql`، `schema.dbml`، `erd.mmd` و رونوشتش در `db/README.md` به‌روزند (و schema.sql با migration مقایسه شد). `erd.png` با T065 از `erd.mmd` تازه ساخته شد.
- [X] T057 [P] در `db/README.md`: جدول‌های تازه و ستون‌های تازه با دلیل و اثرشان.
- [X] T058 در `docs/backend-design.md`:
  - **جدول «تصمیم‌های کلیدی» و قاعده‌ی «آگهی» در «قواعد کسب‌وکار»:** «هنوز پیاده نشده» به محل اجرای واقعی تبدیل شود.
  - **بخش‌های «میزبان» و «سیستم»:** وضعیت بازبینی، ارسال دوباره، و admin.
  - **«پایگاه داده / جدول‌ها»:** هر ردیف جدول «ساختارهای تازه‌ی طراحی» در future-work بخش ۱، با دلیل وجود و اثرش، از جمله `review_version`، `kind`، `disabled_at`، سابقه‌ی فقط افزودنی، ثبت دیدن نشانی و پیش‌فرض دو مرحله‌ای.
  - **«طراحی API» و «قرارداد خطا»:** endpointهای admin، `resubmit` و سه کد خطای تازه.
  - **«مانیتورینگ»:** gaugeها از worker، با دلیل.
  - **«ایندکس‌ها و کارایی»:** نتیجه‌ی T055.
  - **«داده‌ی آزمون و دمو»:** admin دمو و قفل production.
- [X] T059 در `docs/future-work.md`:
  - برداشتن بخش ۱ (constitution: future-work فقط کار شروع‌نشده را دارد)، پس از اینکه T058 محتوایش را منتقل کرد.
  - شماره‌گذاری بخش‌های بعدی، و ارجاع‌ها به «بخش ۴» (ایمیل) و دیگر بخش‌ها در همین فایل، `backend-design.md`، `README.md` و `CONTEXT.md` به‌روز شوند.
- [X] T060 [P] در `README.md` و `CONTEXT.md`: خلاصه‌ی قابلیت، فرمان `create-admin`، و خط «Next».
- [X] T061 ساختن دوباره‌ی `docs/backend-design.pdf` از `docs/backend-design.md`، با همان روش PR #15 (CONTEXT.md: «regenerate after changes»).

#### بررسی نهایی

- [X] T062 در `backend/`: `uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run lint-imports && uv run pytest`، با پوشش ≥ 90٪.
- [X] T063 اجرای quickstart §۲ روی `docker compose up -d --build`، و e2e کامل (quickstart §۶).
  - **اجرا:** ۵۱ تست e2e روی stack ساخته‌شده پاس شدند. فرمان‌های `create-admin` و `disable-admin`، ورود admin، توکن admin روی `/me`، و gaugeهای worker و شمارنده‌ها روی `/metrics` دستی سنجیده شدند.
- [X] T064 اجرای `/speckit-converge` تا Converged، پیش از pull request (constitution 1.2.0).

---

### Dependencies & Execution Order

#### Phase Dependencies

- **Setup (Phase 1)**: بدون وابستگی. T002 باید پیش از T004 روی bulk اجرا شود، چون پس از migration دیگر خط پایه‌ای نیست.
- **Foundational (Phase 2)**: بعد از Setup؛ همه‌ی storyها را مسدود می‌کند.
- **US4 (Phase 3)**: بعد از Phase 2. ورود admin برای US1 لازم است.
- **US1 (Phase 4)**: بعد از US4 (router `moderation` و factory `admin`).
- **US5 (Phase 5)**: بعد از Phase 2. با US4 و US1 مستقل است، اما تست دمو ورود admin را می‌خواهد، پس بعد از US4.
- **US2 (Phase 6)**: بعد از US1 (`decide` و endpoint رد).
- **US3 (Phase 7)**: بعد از US1. با US2 مستقل است، جز اینکه هر دو `listings/service.py` و `tests/test_listing_review.py` را عوض می‌کنند، پس پشت سر هم اجرا می‌شوند.
- **Polish (Phase 8)**: بعد از همه.

#### User Story Dependencies

- **US4 (P1)**: فقط Phase 2.
- **US1 (P1)**: US4.
- **US5 (P1)**: Phase 2، و برای تست ورود admin، US4.
- **US2 (P2)**: US1.
- **US3 (P2)**: US1.

#### Within Each User Story

- تست‌ها اول و شکست‌خورده، بعد کد.
- کارهای یک فایل به ترتیب:
  - `listings/service.py`: T015 → T027 → T041 → T045.
  - `tests/test_listing_review.py`: T023 → T040 → T043.
  - `tests/test_concurrency.py`: T024 → T044.
  - `moderation/router.py`: T020 → T028.
  - `cli.py`: فقط T019.

#### Parallel Opportunities

- **Phase 2:** T005، T006 و T007 فایل جدا دارند.
- **US4:** T017 و T018.
- **US1:** T023، T024، T025 و T026 تست‌اند و هر کدام فایل جدا دارد. T033 هم فایل جدا دارد.
- **US5:** T034 و T035.
- **Polish:** T046، T049، T051، T052، T056، T057 و T060.

---

### Parallel Example: User Story 1

```text
Task: "T023 [US1] public paths, queue, approve in backend/tests/test_listing_review.py"
Task: "T024 [US1] two concurrent approvals in backend/tests/test_concurrency.py"
Task: "T025 [US1] hidden listings out of search in backend/tests/test_search.py"
Task: "T026 [US1] reviews of a hidden listing in backend/tests/test_reviews.py"
```

### Parallel Example: Polish

```text
Task: "T051 moderation flow in e2e/tests/moderation.spec.ts"
Task: "T056 schema docs in db/schema.sql, db/schema.dbml"
Task: "T060 README.md and CONTEXT.md"
```

---

### Implementation Strategy

#### MVP First (US4 + US1 + US5)

1. Phase 1 و 2: schema، توکن admin، و قاعده‌ی «عمومی». همه‌ی تست‌های امروز سبز می‌مانند.
2. US4: admin ساخته می‌شود و وارد می‌شود.
3. US1: آگهی تازه پنهان است تا admin تأیید کند.
4. US5: دمو و حجیم چیزی از دست نمی‌دهند.
5. **توقف و بررسی:** quickstart §۲ قدم‌های ۱ تا ۴. این MVP قاعده‌ی اصلی مالک پروژه را اجرا می‌کند.

#### Incremental Delivery

1. MVP بالا.
2. US2: رد با دلیل و ارسال دوباره. بدون آن، رد کردن بن‌بست است.
3. US3: برگشت به صف پس از ویرایش توصیفی. بدون آن، بازبینی پس از تأیید اول دور زده می‌شود.
4. Polish: مانیتورینگ، e2e، اندازه‌گیری و مستندها. همه در همین pull request.

#### Notes

- **رد در US1:** در US1، endpoint رد در router هست اما رفتارش در US2 تست می‌شود. اگر MVP جدا تحویل شود، رد باید تا US2 کامل شود.
- **بدون commit:** هیچ commit یا push بدون درخواست مالک پروژه انجام نمی‌شود.

---

### Phase 9: Convergence

- [X] T065 Regenerate `db/erd.png` from the updated `db/erd.mmd` (e.g. `npx -y @mermaid-js/mermaid-cli -i db/erd.mmd -o db/erd.png -b white -s 2`), so the image shows `users.kind`, `users.disabled_at`, the four review columns of `listings`, `listing_review_events` and `admin_address_views` per T056 and Constitution Development Workflow (docs in sync) (partial)
