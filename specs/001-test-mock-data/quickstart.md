# Quickstart: درستی‌سنجی داده‌ی تست و ماک

راهنمای اجرای دستی برای اینکه نشان دهیم قابلیت سرتاسر کار می‌کند. جزئیات فرمان‌ها در [contracts/cli.md](contracts/cli.md)، و شکل داده در [data-model.md](data-model.md) است.

## پیش‌نیاز

- Docker، و پشته‌ی پروژه با `docker compose up -d --build`
- `uv` برای تست‌های بکند
- برای بازسازی داده (اختیاری): اینترنت و حدود ۲ گیگابایت فضای خالی

**پایگاه داده‌ی توسعه‌ی شما (`caravansara`) در هیچ مرحله‌ای دست نمی‌خورد.** دمو در یک پایگاه داده‌ی موقت جدا بارگذاری می‌شود، و داده‌ی حجیم در `caravansara_bulk`.

## ۱. تست‌های خودکار (همه‌ی معیارهای پذیرش)

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

## ۲. catalog افزایشی روی پایگاه داده‌ی موجود

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

## ۳. دمو روی پایگاه داده‌ی خالی (SC-001)

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

## ۴. داده‌ی حجیم (SC-002، SC-003، SC-004)

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
# انتظار: 100000، حدود 3000000، حدود 1150000

docker compose exec db psql -U caravansara -d caravansara_bulk -c \
  "SELECT count(*) FROM listings l WHERE l.review_count <> (SELECT count(*) FROM reviews r WHERE r.listing_id = l.id)"
# انتظار: 0
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

## ۵. بازسازی از منبع (اختیاری)

```bash
python3 db/demo/build_demo_seed.py --download         # یک بار، حدود ۱٫۵ گیگابایت در .cache/
uv run --no-project --with pillow python db/demo/build_demo_photos.py
python3 db/bulk/build_city_profiles.py
python3 db/demo/build_demo_seed.py
git status --short db/                                # بدون تغییر، اگر ورودی‌ها عوض نشده باشند
```
