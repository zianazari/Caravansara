# Measurements: تأیید آگهی

روش همان specs/003-index-review است: `caravansara measure-queries`، یک اجرای گرم‌کننده و میانه‌ی ۵ اجرای `EXPLAIN (ANALYZE, BUFFERS)`، هر اجرا در تراکنشی که rollback می‌شود. داده `caravansara_bulk` است (۱۰۰ هزار آگهی، ۳ میلیون رزرو)، روی همان لپ‌تاپ توسعه. عددهای کامل در [before.json](before.json) (revision `0005`، 2026-11-07T20:00:11+00:00) و [after.json](after.json) (revision `0006`، 2026-11-07T20:33:13+00:00) هستند.

## نتیجه (SC-008)

- **نقشه‌ها:** هر ۱۹ کوئری جستجو و شمارش، پس از migration، همان نقشه و همان ایندکس‌های پیش از آن را دارند.
- **زمان:** ۱۶ کوئری در مرز ۱۰٪ هستند. سه کوئری در اجرای کامل از مرز گذشتند، و بررسی‌شان نشان داد نوسان اندازه‌گیری است، نه کندی:
  - **`search_radius_1km_london`** (۱.۵ ← ۱.۸) و **`search_radius_1km_london_14_nights`** (۸.۶ ← ۱۰.۱): در دو اجرای دوباره ۱.۶ و ۱.۶، و ۸.۶ و ۸.۰ شدند، یعنی در مرز.
  - **`filters_total_london_dates`** (۱۷.۴ ← ۱۹.۴): SQL آن دقیقاً همان `search_count_london_dates` است، که در همین اجرا ۹٪ تندتر شد (۲۱.۰ ← ۱۹.۲). در خط پایه همین SQL یک بار ۱۷.۴ و یک بار ۲۱.۰ اندازه گرفته شد، یعنی ۲۱٪ فاصله برای یک کوئری. در سه اجرای دوباره، هر دو بین ۱۹.۲ و ۲۱.۴ بودند. پس فاصله‌ی ۱۰٪ برای این کوئری از نوسان خود اندازه‌گیری کوچک‌تر است.
- **جمع‌بندی:** شرط تازه‌ی `review_status = 'approved'` فقط یک Filter روی ردیف‌هایی است که همان ایندکس‌ها برمی‌گردانند (research R9). هیچ کوئری‌ای نقشه‌ی تازه یا کندی پایدار ندارد.

## یافته: آمار ستون تازه

اولین اندازه‌گیری پس از migration، پیش از رفع، جستجوی شهری با تاریخ را ۳۶ ← ۱۷۰ میلی‌ثانیه نشان داد (`search_count_london_dates` ۲۱ ← ۱۶۹، `filters_total_london_dates` ۱۷ ← ۱۶۵)، با نقشه‌ی تازه (Seq Scan و `no_double_booking` به‌جای `listings_city_idx` و `bookings_active_stay_idx`).

- **علت:** `ADD COLUMN` برای ستون تازه آماری نمی‌سازد، و autoanalyze هم شروع نمی‌شود، چون هیچ ردیفی عوض نشده است. planner برای `review_status = 'approved'` گزینش‌پذیری پیش‌فرض ۰.۵٪ را فرض می‌کند، تعداد آگهی‌های شهر را خیلی کم تخمین می‌زند، و نقشه را عوض می‌کند.
- **رفع:** migration `0006` حالا با `ANALYZE listings` تمام می‌شود. روی bulk ۰.۴ ثانیه طول می‌کشد. پس از آن نقشه‌ها همان نقشه‌های پیش از migration بودند. `tests/test_migrations.py` بودن آمار `review_status` را پس از upgrade می‌سنجد.
- **سنجش همان migration که تحویل می‌شود:** bulk به `0005` برگردانده شد و دوباره با migration نهایی بالا آمد، و عددهای after.json مال همین اجراست. bulk هیچ آگهی تأییدنشده یا admin نداشت، پس downgrade چیزی را عوض یا حذف نکرد.

| کوئری | پیش (ms) | پس (ms) | تغییر | نقشه | ≤ ۱۰٪ |
| --- | --- | --- | --- | --- | --- |
| `search_city_london` | 21.2 | 22.0 | +4٪ | یکسان | ✓ |
| `search_city_london_dates` | 36.4 | 33.4 | -8٪ | یکسان | ✓ |
| `search_city_london_dates_page_21` | 33.0 | 34.6 | +5٪ | یکسان | ✓ |
| `search_city_stockholm_dates` | 31.8 | 30.3 | -4٪ | یکسان | ✓ |
| `search_radius_1km_london` | 1.5 | 1.8 | +16٪ | یکسان | ✗ (نوسان، پایین را ببینید) |
| `search_radius_1km_london_dates` | 6.6 | 6.6 | +1٪ | یکسان | ✓ |
| `search_radius_5km_london` | 20.0 | 20.5 | +2٪ | یکسان | ✓ |
| `search_radius_5km_london_dates` | 26.9 | 25.2 | -6٪ | یکسان | ✓ |
| `search_radius_20km_london` | 82.6 | 83.2 | +1٪ | یکسان | ✓ |
| `search_radius_20km_london_dates` | 102.7 | 100.5 | -2٪ | یکسان | ✓ |
| `search_radius_5km_london_dates_by_distance` | 39.4 | 39.3 | -0٪ | یکسان | ✓ |
| `search_radius_5km_london_dates_pets_amenities` | 16.2 | 16.5 | +2٪ | یکسان | ✓ |
| `search_radius_5km_stockholm_dates` | 6.9 | 6.6 | -4٪ | یکسان | ✓ |
| `search_radius_1km_london_14_nights` | 8.6 | 10.1 | +17٪ | یکسان | ✗ (نوسان، پایین را ببینید) |
| `search_radius_5km_london_14_nights` | 146.9 | 146.6 | -0٪ | یکسان | ✓ |
| `search_count_london_dates` | 21.0 | 19.2 | -9٪ | یکسان | ✓ |
| `filters_total_london_dates` | 17.4 | 19.4 | +12٪ | یکسان | ✗ (نوسان، پایین را ببینید) |
| `filters_amenities_london_dates` | 137.7 | 124.8 | -9٪ | یکسان | ✓ |
| `filters_amenities_radius_5km_london_dates` | 92.0 | 95.7 | +4٪ | یکسان | ✓ |

## کوئری‌های تازه

| کوئری | میانه (ms) | ایندکس |
| --- | --- | --- |
| `listing_live_booking` | 0.030 | bookings_guest_idx, bookings_listing_check_in_idx |
| `review_queue_page` | 0.010 | listings_review_queue_idx |
| `review_queue_count` | 0.006 | listings_review_queue_idx |
| `review_queue_stats` | 0.006 | listings_review_queue_idx |

## migration روی bulk

- **زمان:** `caravansara migrate` از `0005` به `0006` در ۰.۸ ثانیه، با راه‌اندازی خود فرمان. سهم `ANALYZE listings` از این زمان ۰.۴ ثانیه است.
- **بدون بازنویسی:** `pg_relation_filenode('listings')` پیش و پس از migration ۵۵۰۰۰ ماند، و اندازه‌ی جدول ۳۰ MB. پیش‌فرض دو مرحله‌ای (research R5) فقط metadata بود.

## شمار آگهی‌های عمومی (SC-002)

| پایگاه داده | پیش از 0006 (`is_active`) | پس از 0006 (`is_active AND review_status = 'approved'`) |
| --- | --- | --- |
| `caravansara_bulk` | 96961 | 96961 |
| دمو (`seed_demo.sql`) | 789 | 787 |

- **bulk:** migration روی داده‌ی موجود هیچ آگهی عمومی‌ای را پنهان نمی‌کند.
- **دمو:** دمو از نو ساخته می‌شود، و دو آگهی را عمداً پنهان دارد: `pending_listing` و `rejected_listing` (FR-014). اختلاف همین دو است. `tests/test_demo_data.py` هر دو عدد را می‌سنجد.
