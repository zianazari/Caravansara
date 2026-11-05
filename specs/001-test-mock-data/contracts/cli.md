# Contract: فرمان‌های خط فرمان

این قابلیت **API HTTP را تغییر نمی‌دهد**: `backend/openapi.json` همان می‌ماند و تست قرارداد باید بدون `export-openapi` پاس شود. رابط بیرونی این قابلیت، فرمان‌های `caravansara` و اسکریپت‌های `db/` هستند.

قاعده‌ی خروجی برای همه‌ی فرمان‌ها:

| خروجی | کاربرد |
| --- | --- |
| `stdout` | خلاصه‌ی خوانا |
| لاگ JSON (`configure_logging`) | پیشرفت کار |
| کد خروج `0` | موفق |
| کد خروج `1` | خطا، با پیام روشن و بدون traceback، برای خطاهای شناخته‌شده |

## `caravansara seed` (رفتار تغییرکرده)

```text
caravansara seed
```

| حالت | رفتار | خروجی |
| --- | --- | --- |
| catalog خالی | همه‌ی کشورها، شهرها و امکانات را درج می‌کند | `catalog loaded: 7 countries, 9 cities, 31 amenities` |
| catalog قدیمی (۴ شهر) | فقط ردیف‌های تازه را درج می‌کند | `catalog up to date: 3 new countries, 5 new cities, 0 new amenities` |
| catalog کامل | هیچ کاری نمی‌کند | `catalog up to date: nothing new` |

هیچ ردیفی به‌روز یا پاک نمی‌شود.

## `caravansara seed-demo` (گسترش‌یافته)

```text
caravansara seed-demo [--skip-photos | --photos-only]
```

| گزینه | رفتار |
| --- | --- |
| (هیچ) | ۱. `seed_demo.sql` را در یک تراکنش اجرا می‌کند. ۲. فایل‌های `db/demo/photos/` را زیر کلید هر ردیف `listing_photos` با پیشوند `demo/` در bucket می‌گذارد. |
| `--skip-photos` | فقط مرحله‌ی ۱ |
| `--photos-only` | فقط مرحله‌ی ۲؛ برای وقتی که MinIO در بارگذاری قبلی در دسترس نبود. اجرای دوباره بی‌خطر است (put همان بایت‌ها). |

| حالت | خروجی | کد |
| --- | --- | --- |
| موفق | `demo data loaded: 790 listings, 10123 reviews; 3912 photos uploaded` | 0 |
| پایگاه داده غیرخالی | `seed_demo.sql expects empty users and listings tables`؛ هیچ ردیفی تغییر نمی‌کند | 1 |
| MinIO در دسترس نیست | داده بارگذاری می‌ماند؛ هشدار `photos not uploaded: <reason>; run: caravansara seed-demo --photos-only` | 0 |

کد خروج در حالت آخر ۰ است، چون Edge Cases در spec می‌گوید نبودن عکس نباید بارگذاری دمو را متوقف کند.

## `caravansara seed-bulk` (تازه)

```text
caravansara seed-bulk [--listings N] [--seed S] [--today YYYY-MM-DD]
                      [--database NAME] [--replace]
```

| گزینه | پیش‌فرض | معنا |
| --- | --- | --- |
| `--listings` | `100000` | تعداد آگهی؛ بقیه‌ی جدول‌ها به همان نسبت (data-model §۵). حداقل ۱۰۰. |
| `--seed` | `42` | seed تولید |
| `--today` | امروز (UTC) | تاریخ مرجع؛ با همان seed و همان today، خروجی یکسان است |
| `--database` | `caravansara_bulk` | پایگاه داده‌ی هدف روی همان سرور `database_url` |
| `--replace` | خاموش | پایگاه داده‌ی هدف را drop و دوباره می‌سازد؛ فقط اگر نامش با `_bulk` تمام شود |

مراحل:

1. پروفایل را می‌خواند و درستی‌سنجی می‌کند.
2. در صورت نیاز پایگاه داده را می‌سازد.
3. `migrate` و `seed` را روی آن اجرا می‌کند.
4. خالی بودن را بررسی می‌کند.
5. در یک تراکنش `COPY` می‌کند.
6. `setval` را اجرا می‌کند.
7. `ANALYZE` را اجرا می‌کند.

| حالت | پیام | کد | اثر |
| --- | --- | --- | --- |
| موفق | `bulk data loaded into caravansara_bulk: 100000 listings, 2104332 bookings, 912554 reviews in 14m02s` | 0 | |
| `--database` برابر پایگاه داده‌ی تنظیمات | `refusing to load bulk data into the configured database 'caravansara'` | 1 | هیچ |
| هدف داده دارد، بدون `--replace` | `caravansara_bulk already has users or listings; use --replace to rebuild it` | 1 | هیچ |
| `--replace` روی نامی که با `_bulk` تمام نمی‌شود | `--replace only drops databases whose name ends with _bulk` | 1 | هیچ |
| `environment = production` | `seed-bulk is for development and measurement only` | 1 | هیچ |
| پروفایل نامعتبر | `invalid city profile: <city>: <rule>` | 1 | هیچ |
| خطا وسط `COPY` (قطع، نقض قید) | خطای پایگاه داده | 1 | rollback؛ جدول‌های داده خالی می‌مانند (catalog و schema می‌مانند) |

برای وصل شدن برنامه به داده‌ی حجیم:

```text
CARAVANSARA_DATABASE_URL=postgresql+asyncpg://caravansara:caravansara@db:5432/caravansara_bulk
```

## اسکریپت‌های توسعه در `db/` (برای بازسازی، نه برای استفاده‌ی روزانه)

| فرمان | وابستگی | خروجی (در git) |
| --- | --- | --- |
| `python3 db/demo/build_demo_seed.py --download` | کتابخانه‌ی استاندارد، اینترنت | `.cache/insideairbnb/` (نادیده در git، حدود ۱٫۵ گیگابایت) |
| `python3 db/demo/build_demo_seed.py [--seed 42]` | cache، `fa_listings.json`، `photos/manifest.json` | `db/seed_demo.sql`، جدول حالت‌های مرزی در `db/demo/README.md` |
| `uv run --no-project --with pillow python db/demo/build_demo_photos.py` | Pillow | `db/demo/photos/*.jpg`، `manifest.json` |
| `python3 db/bulk/build_city_profiles.py` | cache | `db/bulk/city_profiles.json` |

هر سه اسکریپت با همان ورودی خروجی بایت‌به‌بایت یکسان می‌دهند.
