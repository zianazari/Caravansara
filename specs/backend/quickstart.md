# Quickstart: بکند، کارهای ۰۰۱ تا ۰۰۴

این فایل `quickstart.md` چهار کار بکند را، که با Spec Kit ساخته و merge شده‌اند، کنار هم دارد: هر کار یک بخش، به ترتیب شماره. متن هر بخش همان متن پوشه‌ی اصلی آن کار (`specs/NNN-name/`) است، که در 2026-11-09 در این پوشه ادغام شد. شناسه‌ها (`FR-001`، `SC-001`، `T001`، `R1`، `US1`) همان‌اند که در قالب‌های Spec Kit، و درون بخش هر کار معنی دارند. پس ارجاع از بیرون به این شکل است: «`specs/backend`، کار ۰۰۴، research R5».

## 001. داده‌ی تست و ماک بیشتر و متنوع‌تر

راهنمای اجرای دستی برای اینکه نشان دهیم قابلیت سرتاسر کار می‌کند. جزئیات فرمان‌ها در [contracts/cli.md](contracts.md)، و شکل داده در [data-model.md](data-model.md) است.

### پیش‌نیاز

- Docker، و پشته‌ی پروژه با `docker compose up -d --build`
- `uv` برای تست‌های بکند
- برای بازسازی داده (اختیاری): اینترنت و حدود ۲ گیگابایت فضای خالی

**پایگاه داده‌ی توسعه‌ی شما (`caravansara`) در هیچ مرحله‌ای دست نمی‌خورد.** دمو در یک پایگاه داده‌ی موقت جدا بارگذاری می‌شود، و داده‌ی حجیم در `caravansara_bulk`.

### ۱. تست‌های خودکار (همه‌ی معیارهای پذیرش)

```bash
cd backend
uv run pytest tests/test_demo_data.py tests/test_devdata_bulk.py tests/test_factories.py -q
uv run pytest -q                                    # کل مجموعه، بدون داده‌ی دمو (SC-007)
uv run ruff check . && uv run mypy && uv run lint-imports
```

نتیجه‌ی مورد انتظار:

- همه پاس می‌شوند، و پوشش ≥ ۹۰٪ است.
- `test_openapi_contract` بدون تغییر `openapi.json` پاس می‌شود.
- `grep -rn "UPDATE bookings\|insert_booking" backend/tests` هیچ نتیجه‌ای ندارد، جز در `factories.py`.

### ۲. catalog افزایشی روی پایگاه داده‌ی موجود

```bash
docker compose run --rm migrate caravansara seed
docker compose exec db psql -U caravansara -c "SELECT name, timezone FROM cities ORDER BY id"
docker compose exec db psql -U caravansara -c "SELECT count(*) FROM bookings"
```

نتیجه‌ی مورد انتظار:

- اجرای اول: `catalog up to date: 3 new countries, 5 new cities, 0 new amenities`
- ۹ شهر در فهرست
- تعداد رزروهای شما قبل و بعد یکی است.
- اجرای دوم: `nothing new`

### ۳. دمو روی پایگاه داده‌ی خالی (SC-001)

```bash
docker compose exec db psql -U caravansara -c "CREATE DATABASE caravansara_demo"
DEMO=postgresql+asyncpg://caravansara:caravansara@db:5432/caravansara_demo
docker compose run --rm -e CARAVANSARA_DATABASE_URL=$DEMO migrate \
  sh -c "caravansara migrate && caravansara seed && time caravansara seed-demo"
```

نتیجه‌ی مورد انتظار:

- `demo data loaded: 790 listings, … photos uploaded`
- زمان کمتر از ۲ دقیقه
- اجرای دوباره‌ی `seed-demo` با `expects empty` و کد ۱ متوقف می‌شود، و هیچ ردیفی اضافه نمی‌شود.

برای دیدن دمو در API، `api` را با همان `CARAVANSARA_DATABASE_URL` بالا بیاورید:

```bash
docker compose run --rm -p 8001:8000 -e CARAVANSARA_DATABASE_URL=$DEMO api
```

بعد این‌ها را بررسی کنید:

| بررسی | انتظار |
| --- | --- |
| `GET http://localhost:8001/api/v1/cities` | ۹ شهر، ۷ کشور |
| ورود با `guest@example.com` / `caravansara-demo` و `GET /me/bookings` | یک `pending` با کمتر از ۵ دقیقه مهلت، و یک `expired` |
| صفحه‌ی یک آگهی (`GET /listings/{id}`) | ۳ تا ۸ عکس با `room_tag` و ترتیب ۰، ۱، ۲…؛ نشانی عکس کاور در مرورگر باز می‌شود |
| جستجو در تهران (`GET /search/listings?lat=35.70&lng=51.40&radius_km=20`) | آگهی‌های فارسی با قیمت `IRR` |
| هر ۷ حالت مرزی، با شناسه‌های جدول `db/demo/README.md` | هر کدام در کمتر از ۱ دقیقه پیدا می‌شود (SC-005) |
| بعد از ۵ دقیقه (worker روی همان پایگاه داده) | نگه‌داشت `expired` می‌شود |

پاک کردن: `docker compose exec db psql -U caravansara -c "DROP DATABASE caravansara_demo WITH (FORCE)"`

### ۴. داده‌ی حجیم (SC-002، SC-003، SC-004)

نسخه‌ی کوچک، برای لپ‌تاپ (کمتر از ۳ دقیقه):

```bash
docker compose run --rm migrate sh -c "time caravansara seed-bulk --listings 10000 --today 2026-11-05"
```

اندازه‌ی پیش‌فرض (کمتر از ۳۰ دقیقه، اندازه‌گیری‌شده: حدود ۳٫۵ دقیقه؛ حدود ۲ گیگابایت فضای دیسک):

```bash
docker compose run --rm migrate sh -c "time caravansara seed-bulk --replace --today 2026-11-05"
```

بررسی‌ها:

```bash
docker compose exec db psql -U caravansara -d caravansara_bulk -c \
  "SELECT (SELECT count(*) FROM listings), (SELECT count(*) FROM bookings), (SELECT count(*) FROM reviews)"
## انتظار: 100000، حدود 3000000، حدود 1150000

docker compose exec db psql -U caravansara -d caravansara_bulk -c \
  "SELECT count(*) FROM listings l WHERE l.review_count <> (SELECT count(*) FROM reviews r WHERE r.listing_id = l.id)"
## انتظار: 0
```

اجرای دوباره بدون `--replace` با پیام `use --replace` متوقف می‌شود. `seed-bulk --database caravansara` با `refusing` متوقف می‌شود.

**SC-004 (خروجی یکسان)**: دو بار با همان `--seed` و `--today` بسازید، و بعد از هر بار checksum را بگیرید:

```bash
docker compose exec db psql -U caravansara -d caravansara_bulk -Atc \
  "SELECT md5(string_agg(b::text, ',' ORDER BY id)) FROM bookings b"
```

دو عدد باید یکی باشند. تست خودکار همین را با اندازه‌ی کوچک بررسی می‌کند.

**وصل کردن برنامه به داده‌ی حجیم**: `CARAVANSARA_DATABASE_URL=…/caravansara_bulk` برای `api`، و بعد جستجو در Amsterdam.

زمان‌های اندازه‌گیری‌شده (۱۰ هزار و ۱۰۰ هزار آگهی) را در بخش داده‌ی آزمون `docs/backend-design.md` بنویسید.

### ۵. بازسازی از منبع (اختیاری)

```bash
python3 db/demo/build_demo_seed.py --download         # یک بار، حدود ۱٫۵ گیگابایت در .cache/
uv run --no-project --with pillow python db/demo/build_demo_photos.py
python3 db/bulk/build_city_profiles.py
python3 db/demo/build_demo_seed.py
git status --short db/                                # بدون تغییر، اگر ورودی‌ها عوض نشده باشند
```

---

## 002. قیمت ریالی بدون سرریز

### پیش‌نیاز

- `docker compose up -d` (پایگاه داده، MinIO و API).
- `cd backend && uv sync`.

### ۱. تست‌ها

```bash
cd backend
uv run pytest tests/test_migrations.py tests/test_bookings.py tests/test_listings.py tests/test_search.py tests/test_unit.py -q
uv run pytest -q   # همه، با پوشش ≥ ۹۰٪
```

انتظار: همه پاس. تست‌های تازه:

| تست | چه چیزی را ثابت می‌کند |
| --- | --- |
| رزرو ۳۶۵ شبه با ۱۰۰ میلیون ریال | US1، SC-001: جمع ۳۶٬۵۰۵٬۰۰۰٬۰۰۰٫۰۰ |
| سقف قیمت با بیشترین طول اقامت | US2-3، SC-003 |
| قیمت ۱۰۰۰۰۰۰۰۰۰٫۰۱ در ساخت و ویرایش | US2-1، US2-2، SC-002 |
| `amount_too_large` با `max_nights` بزرگ | FR-004 |
| جمع جستجو برابر جمع رزرو | US1-3، FR-009 |
| upgrade، downgrade با مقدار بزرگ (متوقف)، downgrade بدون مقدار بزرگ | FR-005، SC-004 |
| دمو: آگهی و رزرو ریالی بیش از سقف قدیم | US3، SC-005 |

### ۲. ارتقای پایگاه داده‌ی توسعه

```bash
docker compose run --rm migrate          # 0001 → 0002
docker compose exec db psql -U caravansara -c "\d listings" | grep -E "price_per_night|cleaning_fee"
```

انتظار: `numeric(14,2)`، و همه‌ی آگهی‌ها و رزروهای قبلی همان مبلغ‌ها را دارند.

### ۳. داده‌ی دمو

```bash
python3 db/demo/build_demo_seed.py       # seed_demo.sql تازه، با قیمت‌های تازه‌ی ایران
```

داده‌ی دمو در پایگاه داده‌ی جدای `caravansara_demo` بارگذاری و با API بررسی می‌شود. انتظار: بدون خطا، گران‌ترین آگهی تهران ۱۰۰٬۰۰۰٬۰۰۰ ریال برای هر شب، و دست‌کم یک رزرو ریالی با جمع بیش از ۹۹٬۹۹۹٬۹۹۹٫۹۹.

### ۴. دستی با API

1. با یک حساب میزبان، آگهی تهران با `price_per_night: "100000000.00"`، `cleaning_fee: "5000000.00"` و `currency: "IRR"` بسازید.
2. با حساب مهمان، `POST /bookings` برای ۳۶۵ شب. انتظار: ۲۰۱ و `total_price: "36505000000.00"`.
3. `PATCH` همان آگهی با `price_per_night: "1000000000.01"`. انتظار: ۴۲۲ `validation_error`.

---

## 003. بررسی ایندکس‌ها با اندازه‌گیری

### پیش‌نیاز

- `docker compose up -d` (با `pg_stat_statements` در `shared_preload_libraries`، بعد از این کار).
- داده‌ی حجیم: `docker compose run --rm migrate caravansara seed-bulk` (اگر نیست)، یا برای `caravansara_bulk` موجود: `migrate` روی آن.

### ۱. اندازه‌گیری پیش از تغییر (خط پایه)

«پیش» روی همان پایگاه داده‌ای گرفته می‌شود که «پس» روی آن گرفته می‌شود، و پشت‌سرهم. دلیلش این است که روی لپ‌تاپ عدد با وضعیت برق تا دو برابر عوض می‌شود. SQL قبلی برنامه از `data/003-captured-sql.json` در یک پوشه‌ی جدا بازسازی می‌شود.

```bash
cd backend
CARAVANSARA_DATABASE_URL=…/caravansara_bulk uv run alembic downgrade 0003      # بدون ایندکس‌های این کار
uv run caravansara measure-queries --database caravansara_bulk --catalog <فهرست قدیمی> --out ../specs/backend/data/003-before.json
```

انتظار: جستجو با تاریخ، رزروهای آگهی و job پایان اقامت ✗ هستند.

### ۲. اعمال migration و اندازه‌گیری دوباره

```bash
CARAVANSARA_DATABASE_URL=…/caravansara_bulk uv run caravansara migrate      # 0003 → 0005، با CONCURRENTLY
uv run caravansara measure-queries --database caravansara_bulk --out ../specs/backend/data/003-after.json
```

انتظار: هیچ کوئری‌ای، بعد از تکرار با `--runs 9`، بیش از ۱۰٪ کندتر نیست، جز موردی که دلیلش ثبت شده (SC-004). کوئری‌هایی که هنوز ✗ هستند، در `measurements.md` و `docs/backend-design.md` دلیل دارند.

### ۳. نوشتن

`write_1000_bookings` در همان فهرست است. نتیجه: ۶۶ → ۱۱۳ ms، یعنی نگه‌داری سه ایندکس تازه، زیر هدف ۳۰۰ ms و با دلیل ثبت‌شده.

### ۴. آمار کوئری‌ها در Grafana

```bash
docker compose --profile observability up -d
```

Grafana (http://localhost:3000) → داشبورد Caravansara → پنل «Costly queries (pg_stat_statements)»: زمان کل، تعداد اجرا و میانگین برای ده کوئری پرهزینه.

### ۵. تست‌ها

```bash
uv run pytest -q
```

تست‌های تازه:

| تست | چه چیزی را ثابت می‌کند |
| --- | --- |
| پوشش فهرست | هر تابع repository و job در فهرست هست یا دلیل کنار گذاشتن دارد (SC-001) |
| اعتبار فهرست | هر SQL فهرست روی پایگاه داده‌ی تست با `EXPLAIN` اجرا می‌شود |
| `measure-queries` | خروجی درست روی داده‌ی کوچک؛ هیچ ردیفی عوض نمی‌شود؛ قفل production |
| migration `0003` | ایندکس‌ها ساخته و با downgrade حذف می‌شوند، و داده عوض نمی‌شود |
| استفاده از ایندکس | با `enable_seqscan = off`، نقشه‌ی هر کوئری هدف از ایندکس تازه استفاده می‌کند |
| همه‌ی تست‌های فعلی | بدون تغییر پاس (SC-006)، از جمله مسابقه‌ها و job پایان اقامت در تغییر ساعت تابستانی |

---

## 004. تأیید آگهی توسط مدیر سیستم (admin)

راهنمای سنجیدن قابلیت از ابتدا تا انتها. قرارداد endpointها در [contracts/api.md](contracts.md)، فرمان‌ها در [contracts/cli.md](contracts.md)، و جدول‌ها در [data-model.md](data-model.md) آمده‌اند.

### پیش‌نیاز

```bash
docker compose up -d --build          # API، worker، PostgreSQL + PostGIS، MinIO
docker compose run --rm migrate       # تا 0006
```

### ۱. تست‌های خودکار

```bash
cd backend
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run lint-imports
uv run pytest                         # همه، با پوشش ≥ 90٪
```

تست‌های تازه هر سناریوی پذیرش را پوشش می‌دهند:

- **`tests/test_listing_review.py`:** US1، US2 و US3. یک تست برای هر فیلد FR-009 و FR-010 (SC-003) و یک تست برای هر مسیر عمومی (SC-001). دیدن صفحه توسط مهمانِ دارای رزرو (FR-019).
- **`tests/test_admin.py`:** US4، فرمان‌ها و ورود admin. توکن admin روی endpointهای عضو، و ثبت‌نام یا PATCH `/me` با `kind` (SC-005). ثبت دیدن نشانی (SC-009).
- **`tests/test_concurrency.py`:** دو تصمیم هم‌زمان، و ویرایش هم‌زمان با تأیید. مسیر بازنده ساخته می‌شود (constitution اصل IV).
- **`tests/test_migrations.py`:** upgrade آگهی‌های موجود را تأییدشده می‌کند. downgrade چیزی را عمومی نمی‌کند و هیچ آگهی، رزرو یا نظری را حذف نمی‌کند (FR-013، US5).
- **`tests/test_demo_data.py`، `tests/test_devdata_bulk.py`:** FR-014 و SC-002.
- **`tests/test_monitoring_config.py`، `tests/test_jobs.py`:** شمارنده‌ها و gaugeهای صف (FR-016).

### ۲. سنجش دستی با Swagger (`http://localhost:8000/docs`)

1. **حساب admin:**

   ```bash
   docker compose exec -e CARAVANSARA_ADMIN_PASSWORD=admin-pass-123 api \
     caravansara create-admin --email reviewer@example.com --name "Reviewer"
   ```

   انتظار: `admin created: <id>`. اجرای دوباره با همان ایمیل، یا با `host@example.com`، کد 1 و `refused: …` می‌دهد.

2. **آگهی تازه:** با `host@example.com` وارد شوید و `POST /listings` بزنید.
   - انتظار: `review.status = "pending"`.
   - `GET /search/listings` در همان شهر آن را ندارد.
   - `GET /listings/{id}` بدون توکن `404` است.
   - `POST /bookings` با `guest@example.com` هم `404` است.

3. **صف:**
   - `POST /admin/auth/login` با `reviewer@example.com`، سپس **Authorize** با این توکن.
   - `GET /admin/listings/pending`: آگهی آخر صف است.
   - `GET /admin/listings/{id}`: `private_location` پر است.
   - در Swagger توکن admin زیر **AdminBearer** گذاشته می‌شود، جدا از توکن عضو (**HTTPBearer**).

4. **تأیید:** `POST /admin/listings/{id}/approve` با `review_version` از قدم ۳.
   - انتظار: آگهی حالا در `GET /search/listings` است و رزرو می‌شود.
   - تأیید دوم `409 listing_not_pending` می‌گیرد.

5. **ویرایش:**
   - **قیمت:** `PATCH /listings/{id}` فقط با `price_per_night`. آگهی `approved` می‌ماند.
   - **عنوان:** `PATCH` با `title` تازه. آگهی `pending` می‌شود و از جستجو بیرون می‌رود، و مهمانی که رزرو دارد هنوز صفحه را می‌بیند.

6. **رد و ارسال دوباره:**
   - `POST /admin/listings/{id}/reject` با `reason` خالی `422` می‌گیرد، و با دلیل `200`.
   - میزبان در `GET /me/listings` وضعیت `rejected` و دلیل را می‌بیند.
   - `POST /listings/{id}/resubmit`: آگهی `pending` است و آخر صف.

7. **ورود admin در endpointهای عضو:** توکن admin روی `POST /listings` یا `GET /me` خطای `401 invalid_token` می‌گیرد.

8. **از کار انداختن:**
   - `docker compose exec api caravansara disable-admin --email reviewer@example.com`.
   - درخواست بعدی admin با همان توکن `401` می‌گیرد.

9. **ثبت دیدن نشانی:**

   ```bash
   docker compose exec -T db psql -U caravansara -d caravansara -c \
     "SELECT admin_id, listing_id, viewed_at FROM admin_address_views ORDER BY id DESC LIMIT 5"
   ```

   انتظار: یک ردیف برای هر `GET /admin/listings/{id}` در قدم ۳.

### ۳. مانیتورینگ (`docker compose --profile observability up -d`)

- Grafana، داشبورد Caravansara، ردیف «Listing review»: تعداد صف، قدیمی‌ترین انتظار، و نرخ submitted، approved و rejected.
- `curl -s localhost:8000/metrics | grep listing_review`، و همین روی worker.

### ۴. داده‌ی دمو و حجیم (SC-002)

```bash
## پیش از migration 0006 (روی main)، تعداد آگهی‌های عمومی:
docker compose exec -T db psql -U caravansara -d caravansara_bulk -Atc "SELECT count(*) FROM listings WHERE is_active"
## پس از migration: همان عدد
docker compose exec -T db psql -U caravansara -d caravansara_bulk -Atc \
  "SELECT count(*) FROM listings WHERE is_active AND review_status = 'approved'"
```

روی bulk امروز این عدد 96961 است (research R5). دمو: `edge_cases.json` آگهی‌های `pending_listing` و `rejected_listing` را نام می‌برد. بقیه‌ی آگهی‌ها تأییدشده‌اند.

### ۵. سرعت جستجو (SC-008)

همان روش specs/backend (003) (`specs/backend/measurements.md` (003)):

```bash
cd backend
## پیش از 0006، با کاتالوگ کوئری‌های امروز (روی main):
uv run caravansara measure-queries --database caravansara_bulk --catalog <کاتالوگ main> --out ../specs/backend/data/004-before.json
CARAVANSARA_DATABASE_URL=…/caravansara_bulk uv run caravansara migrate       # 0005 → 0006
uv run caravansara measure-queries --database caravansara_bulk --out ../specs/backend/data/004-after.json
```

- **کاتالوگ:** فایل‌های جستجو در `db/bulk/queries/` (`search_*`, `filters_*`) شرط `review_status` را می‌گیرند، چون رونوشت دستی SQL واقعی‌اند. `tests/test_query_catalog.py` فقط پوشش هر تابع repository و اجرا شدن هر فایل را می‌سنجد، نه برابری متن SQL با کد، پس این رونوشت باید با دست هم‌خوان بماند.
- **قبول:** میانه‌ی هر کوئری جستجو بیش از ۱۰٪ کندتر نیست.
- **ثبت:** نتیجه در `specs/backend/measurements.md` (004) و `docs/backend-design.md` نوشته می‌شود.

### ۶. e2e

```bash
docker compose -f docker-compose.yml -f e2e/compose.e2e.yml up -d --build
cd e2e && npx playwright test
```

`moderation.spec.ts` با `docker compose exec api caravansara create-admin` admin می‌سازد و جریان ساختن، صف، تأیید، جستجو و رزرو را روی stack واقعی می‌سنجد.
