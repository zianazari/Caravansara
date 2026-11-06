# Measurements: بررسی ایندکس‌ها

همه‌ی عددها با `caravansara measure-queries` گرفته شده‌اند (research R2): ۱ اجرای گرم‌کننده، بعد میانه‌ی ۵ اجرای `EXPLAIN (ANALYZE, BUFFERS)`، هر اجرا در تراکنشی که rollback می‌شود. داده `caravansara_bulk` است (۱۰۰ هزار آگهی، ۳ میلیون رزرو)، روی لپ‌تاپ توسعه (research، «محیط اندازه‌گیری»). عدد کامل هر اجرا، buffers و نوع دسترسی در [before.json](before.json) و [after.json](after.json) است.

## پیش از تغییر

caravansara_bulk در revision `0003`، 2026-11-06T11:08:16+00:00، روی برق شهر. **25 از 40 کوئری به هدف می‌رسند؛ 15 کوئری نه.**

این اولین خط پایه بود و تصمیم US2 و US3 بر اساس آن گرفته شد. هنوز ابزار همه‌ی کوئری‌ها را روی یک اتصال اجرا می‌کرد (بخش «آزمایش‌ها»، یافته‌ی ۱). مقایسه‌ی نهایی با خط پایه‌ای است که دوباره گرفته شد (بخش «پیش و پس»). این جدول فقط برای سابقه می‌ماند، و فایل JSON آن جایگزین شده است.

| کوئری | میانه (ms) | هدف | | ایندکس‌های به‌کاررفته |
| --- | --- | --- | --- | --- |
| `search_city_london` | 125.8 | 50 | ✗ | listing_photos_order_key |
| `search_city_london_dates` | 486.9 | 50 | ✗ | no_double_booking, listing_photos_order_key |
| `search_city_london_dates_page_21` | 484.5 | 50 | ✗ | no_double_booking, listing_photos_order_key |
| `search_city_stockholm_dates` | 90.0 | 50 | ✗ | listings_city_idx, no_double_booking, countries_pkey, listing_photos_order_key |
| `search_radius_1km_london` | 2.11 | 50 | ✓ | listings_public_location_idx, listing_photos_order_key |
| `search_radius_1km_london_dates` | 8.41 | 50 | ✓ | listings_public_location_idx, no_double_booking, listing_photos_order_key |
| `search_radius_5km_london` | 45.0 | 50 | ✓ | listings_public_location_idx, listing_photos_order_key |
| `search_radius_5km_london_dates` | 189.3 | 50 | ✗ | listings_public_location_idx, no_double_booking, listing_photos_order_key |
| `search_radius_20km_london` | 151.5 | 50 | ✗ | listings_public_location_idx, listing_photos_order_key |
| `search_radius_20km_london_dates` | 329.3 | 50 | ✗ | listings_public_location_idx, no_double_booking, listing_photos_order_key |
| `search_radius_5km_london_dates_by_distance` | 201.3 | 50 | ✗ | listings_public_location_idx, no_double_booking, listing_photos_order_key |
| `search_radius_5km_london_dates_pets_amenities` | 24.5 | 50 | ✓ | listings_public_location_idx, listing_amenities_pkey, no_double_booking, listing_photos_order_key |
| `search_radius_5km_stockholm_dates` | 16.9 | 50 | ✓ | listings_public_location_idx, no_double_booking, listing_photos_order_key |
| `search_count_london_dates` | 213.9 | 50 | ✗ | no_double_booking |
| `filters_total_london_dates` | 210.7 | 50 | ✗ | no_double_booking |
| `filters_amenities_london_dates` | 378.3 | 50 | ✗ | no_double_booking |
| `filters_amenities_radius_5km_london_dates` | 297.7 | 50 | ✗ | listings_public_location_idx, no_double_booking, listing_amenities_pkey |
| `listing_by_id` | 0.01 | 50 | ✓ | listings_pkey |
| `listing_photos` | 0.01 | 50 | ✓ | listing_photos_order_key |
| `listing_amenity_ids` | 0.01 | 50 | ✓ | listing_amenities_pkey |
| `listing_pins` | 0.01 | 50 | ✓ | listings_pkey |
| `cover_keys` | 0.01 | 50 | ✓ | listing_photos_order_key |
| `host_listings_count` | 0.04 | 50 | ✓ | listings_host_idx |
| `host_listings_page` | 0.28 | 50 | ✓ | listings_host_idx |
| `reviews_count` | 0.02 | 50 | ✓ | reviews_listing_idx |
| `reviews_page_1` | 0.01 | 50 | ✓ | reviews_listing_idx |
| `reviews_page_4` | 0.03 | 50 | ✓ | reviews_listing_idx |
| `review_authors` | 0.01 | 50 | ✓ | users_pkey |
| `guest_bookings_count` | 0.01 | 50 | ✓ | bookings_guest_idx |
| `guest_bookings_page` | 0.03 | 50 | ✓ | bookings_guest_idx |
| `guest_bookings_completed_page` | 0.03 | 50 | ✓ | bookings_guest_idx |
| `listing_bookings_count` | 103.5 | 50 | ✗ | — (Seq Scan) |
| `listing_bookings_page` | 102.2 | 50 | ✗ | — (Seq Scan) |
| `booking_by_idempotency_key` | 0.01 | 50 | ✓ | bookings_idempotency_key_key |
| `expire_listing_holds` | 0.11 | 50 | ✓ | bookings_pending_hold_idx |
| `user_by_email` | 0.01 | 50 | ✓ | users_email_lower_key |
| `login_attempts` | 0.01 | 50 | ✓ | — (Seq Scan) |
| `job_expire_overdue_holds` | 4.63 | 50 | ✓ | bookings_pending_hold_idx |
| `job_complete_finished_stays` | 689.9 | 50 | ✗ | listings_pkey |
| `write_1000_bookings` | 90.2 | 300 | ✓ | listings_pkey |

### آنچه خط پایه نشان می‌دهد

| گروه | کوئری‌ها (میانه) | علت در نقشه | نامزد (data-model §۳) |
| --- | --- | --- | --- |
| جستجوی شهری لندن | ۱۲۶ بدون تاریخ، ۴۸۷ با تاریخ، ۴۸۵ صفحه‌ی ۲۱ | خواندن کامل `listings`، و برای هر آگهی یک پرس‌وجو در `no_double_booking` | GiST روی `stay` با بازنویسی anti-join (b)، covering روی listings (c) |
| شمارش جستجو و پنل فیلترها | ۲۱۱–۳۷۸ | همان anti-join، این بار برای همه‌ی آگهی‌ها | همان (b)، (c) |
| جستجوی شعاعی ۵ و ۲۰ کیلومتر | ۴۵ بدون تاریخ؛ ۱۸۹–۳۲۹ با تاریخ؛ ۱۵۲ برای ۲۰ km بدون تاریخ | anti-join؛ برای ۲۰ km، bitmap روی ۲۰ هزار آگهی | (b)؛ SP-GiST در مقابل GiST (d) |
| جستجوی شهری استکهلم | ۹۰ | همان، در مقیاس کوچک‌تر | (b) |
| رزروهای آگهی (شمارش و صفحه) | ۱۰۳ و ۱۰۲ | `Seq Scan` روی ۳ میلیون رزرو؛ ایندکسی روی `listing_id` نیست | B-tree `(listing_id, check_in, id)` (a) |
| job پایان اقامت | ۶۹۰ | `Seq Scan` روی همه‌ی رزروها و محاسبه‌ی منطقه‌ی زمانی برای ۴۶۶ هزار رزرو `confirmed` | کران امن و ایندکس partial (e) |

۲۵ کوئری دیگر، شامل صفحه‌ی آگهی، نظرها، سفرهای من، آگهی‌های من، ورود، idempotency، نگه‌داشت‌ها، job انقضا و نوشتن ۱۰۰۰ رزرو، زیر ۵ ms یا در هدف خودشان هستند و ایندکس تازه لازم ندارند.

**عدد گرم در برابر عدد API.** میانه‌ی گرم کمتر از زمان یک‌باره‌ی research R1 است. مثلاً جستجوی شهری لندن با تاریخ ۴۸۷ ms است، در برابر ۲٬۴۳۳ ms در اولین درخواست سرد. مقایسه‌ی پیش و پس همیشه با همین روش گرم انجام می‌شود (R2).

## آزمایش‌ها

همه روی کپی `caravansara_bulk_lab` (T016 و T023). عددها میانه‌اند، و هر مقایسه پشت‌سرهم در یک وضعیت برق گرفته شده است. لپ‌تاپ در این مرحله روی باتری بود و همه‌چیز حدود دو برابر خط پایه کندتر بود. برای همین عدد هر آزمایش فقط با عدد پیش از همان آزمایش مقایسه می‌شود، نه با جدول بالا.

### سه یافته درباره‌ی خود اندازه‌گیری

1. **JIT اتصال را کند می‌کند.** وقتی یک backend یک بار کوئری‌ای را JIT کند، و `params.sql` همین کار را می‌کرد، همه‌ی کوئری‌های بعدی همان اتصال حدود ۳ برابر کند می‌شوند: استکهلم با تاریخ از ۵۵ به ۱۵۵ ms رسید. با `SET jit = off` پیش از `params.sql`، عدد همان ۵۵ ماند. ابزار حالا برای هر کوئری اتصال تازه می‌گیرد و ستون `jit` را ثبت می‌کند. پس خط پایه‌ی اول، که با یک اتصال مشترک گرفته شده بود، دوباره گرفته شد (بخش «پس از تغییر»). در خود برنامه هم همین خطر هست: با SQL قدیمی، جستجوی لندن (هزینه‌ی ۴۶۲ هزار، بالاتر از `jit_above_cost` ۱۰۰ هزار) JIT می‌شد و اتصال pool را برای کوئری‌های بعدی کند می‌کرد. با SQL تازه، روی این داده هیچ کوئری API از آن آستانه بالاتر نیست (`docs/future-work.md`).
2. **bloat در `listings`.** `seed-bulk` نظرها را در یک تراکنش وارد می‌کند، و trigger `reviews_rating_sync` به ازای هر نظر یک بار آگهی را UPDATE می‌کند. نتیجه ۱٫۱۶ میلیون نسخه‌ی مرده بود، و جدول ۳۸۶ MB شد در حالی که داده‌اش ۳۰ MB است. `VACUUM FULL listings` روی کپی، زمان جستجو را عوض نکرد، پس روی نتیجه‌ها اثری ندارد. در محیط واقعی نظرها یکی‌یکی می‌رسند، پس این bloat فقط مال داده‌ی حجیم است (`docs/future-work.md`).
3. **`/dev/shm` در Docker ۶۴ MB است.** `VACUUM bookings` با worker موازی، با خطای `could not resize shared memory segment … No space left on device` شکست خورد. hash joinهای موازی بزرگ هم ممکن است همین خطا را بگیرند (`docs/future-work.md`).

### (a) رزروهای آگهی: `bookings (listing_id, check_in, id)` — پذیرفته

| کوئری | پیش | پس |
| --- | --- | --- |
| `listing_bookings_count` | 189.6 | 0.1 (Index Only Scan) |
| `listing_bookings_page` | 183.2 | 0.0 (Index Scan، به همان ترتیب صفحه) |

۱۱۷ MB، ساخت ۲٫۵ ثانیه.

### (b) جستجو با تاریخ: GiST روی `stay` و دو بازنویسی SQL — پذیرفته

GiST partial `bookings_active_stay_idx` روی `stay`، با وضعیت‌های مسدودکننده: ۱۶۳ MB، ساخت ۲۱ ثانیه. خودِ ایندکس، شمارش را با همان `NOT EXISTS` فعلی سریع کرد، چون برنامه‌ریز Hash Anti Join را انتخاب کرد: شمارش لندن ۳۴۴ → ۳۷ ms. اما کوئری صفحه همان نقشه‌ی قبلی ماند. علت این بود که با `LIMIT 20` بیرونی، برنامه‌ریز گمان می‌کرد چند ردیف کافی است، و برای هر ۴۸ هزار آگهی جدا `no_double_booking` را می‌گشت، در حالی که `count(*) OVER ()` همه را لازم داشت. سه تغییر SQL در `search/repository.py`:

1. **CTE `MATERIALIZED` برای آگهی‌های منطبق.** فقط ستون‌های شمارش و مرتب‌سازی در آن است، و `total` از همان CTE می‌آید. ستون‌های کارت (pin، عکس، …) فقط برای ۲۰ ردیف صفحه ساخته می‌شوند.
2. **جستجوی شعاعی تا ۷ شب: `l.id NOT IN (رزروهای مسدودکننده)`.** تخمین `ST_DWithin` بسیار پایین است (لندن ۵ km: ۱۰ تخمین، ۱۶٬۱۵۵ واقعی)، پس برنامه‌ریز برای هر آگهی جدا می‌گشت. `NOT IN` به hashed subplan تبدیل می‌شود، و این تصمیم به اندازه‌ی خود فهرست بستگی دارد، نه به تخمین آگهی‌ها. بالا بردن statistics روی `public_location` (۱۰۰۰ و ۱۰۰۰۰) تخمین را بدتر کرد. join به CTE رزروها هم خطرناک بود: با ۱ ردیف تخمینی، `pets_amenities` از ۴۳ به ۱۰۱۰ ms رسید، چون nested loop روی CTE شد. `listing_id` برابر NOT NULL است، پس `NOT IN` همان معنای `NOT EXISTS` را دارد.
3. **پنل فیلترها: اول شمارش بر اساس `amenity_id`**، بعد join به ۳۱ امکان: ۲۲۴ → ۱۵۲ ms، با نتیجه‌ی یکسان (EXCEPT ALL در هر دو جهت خالی بود).

سقف ۷ شب از اندازه‌گیری آمد. هزینه‌ی hash با طول بازه رشد می‌کند، و هزینه‌ی گشتن برای هر آگهی با تعداد آگهی‌های منطقه:

| شعاع لندن | ۳ شب: هر آگهی / hash | ۷ شب | ۱۴ شب | ۳۶۵ شب |
| --- | --- | --- | --- | --- |
| ۱ km | 21 / 27 | 20 / 24 | 16 / 64 | 25 / 368 |
| ۵ km | 325 / 52 | 294 / 86 | 283 / 119 | — |
| ۲۰ km | — | 376 / 159 | 379 / 160 | — |

جستجوی شهری به هیچ‌کدام نیاز ندارد، چون تخمینش درست است و Hash Anti Join خودش انتخاب می‌شود. نتیجه‌ی هر شکل با SQL قبلی مقایسه شد (EXCEPT ALL خالی)، و تست `test_each_booking_status_blocks_the_same_on_every_search_path` هر دو مسیر را با هر پنج وضعیت می‌پوشاند.

### (c) covering روی `listings (city_id) INCLUDE (…)` — رد

۳٫۹ MB. برنامه‌ریز هیچ‌وقت آن را انتخاب نکرد، و عددهای جستجوی شهری تغییری نکردند (لندن ۴۵٫۵ → ۴۴٫۲، با تاریخ ۶۹٫۱ → ۶۹٫۱).

### (d) SP-GiST در مقابل GiST روی `public_location` (FR-011) — رد

| کوئری | GiST | SP-GiST |
| --- | --- | --- |
| شعاع ۱ km | 3.4 | 10.7 |
| ۱ km با تاریخ | 12.7 | 26.4 |
| ۵ km | 39.9 | 46.1 |
| ۵ km با تاریخ | 51.9 | 55.8 |
| ۲۰ km | 154.4 | 155.0 |
| ۵ km استکهلم با تاریخ | 13.5 | 21.8 |

SP-GiST کوچک‌تر است (۶٫۸ در مقابل ۱۲ MB)، اما هیچ‌جا سریع‌تر نیست. ۲۰ km با هر دو ۱۵۴ ms است. پیدا کردن ۴۷ هزار آگهی با ایندکس ۸ ms طول می‌کشد. بقیه‌ی زمان صرف محاسبه‌ی فاصله‌ی دقیق روی بیضی‌گون می‌شود، حدود ۲٫۵ µs برای هر آگهی، که هیچ ایندکسی آن را حذف نمی‌کند.

### (e) job پایان اقامت: کران +۱۴ ساعت و `bookings (check_out) WHERE status = 'confirmed'` — پذیرفته

کران همان ردیف‌ها را پیدا می‌کند: ۲٬۶۶۴ برای امروز و ۴۴٬۷۸۸ برای ۳۰ روز بعد، با و بی کران. تست `test_completion_bound_misses_no_stay_in_the_farthest_time_zones` آن را برای Kiritimati (+۱۴، check-out نیمه‌شب، تنگ‌ترین حالت) و Pago Pago (−۱۱) ثابت می‌کند. با کران ۱۳ ساعت، این تست شکست می‌خورد.

`caravansara_bulk` هرگز worker نداشته، پس ۲٬۶۶۴ اقامت گذشته منتظر `completed` شدن‌اند، و UPDATE آن‌ها بیشتر زمان را می‌گیرد. در کار واقعی، job هر دقیقه فقط چند ردیف دارد. برای عدد حالت عادی، روی کپی، job یک بار واقعاً اجرا شد. سپس با ۹ اجرا:

| حالت | میانه |
| --- | --- |
| SQL قبلی، بدون ایندکس | 778.6 |
| با کران، بدون ایندکس | 432.0 |
| با کران و ایندکس | 40.4 |

۳٫۳ MB، ساخت ۰٫۶ ثانیه. آمار چندستونی (`CREATE STATISTICS … (mcv) ON status, check_out`) تخمین را از ۳۸۹٬۷۰۸ به ۶٬۰۷۷ ردیف درست کرد، اما نقشه را عوض نکرد. پس رد شد.

### (h) ایندکس‌های بی‌استفاده (FR-007)

بعد از `pg_stat_reset()` و اجرای کامل فهرست، ۱۷ ایندکس `idx_scan = 0` داشتند. ۱۴ تای آن‌ها پشت قید هستند (کلید اصلی، unique، یا هدف کلید خارجی، مثل `bookings_id_listing_id_guest_id_key` برای نظرها)، پس می‌مانند. سه تای دیگر:

| ایندکس | حجم | تصمیم |
| --- | --- | --- |
| `listing_amenities_amenity_idx` | 9.4 MB | نگه داشتن: بررسی کلید خارجی هنگام حذف یک امکان بدون آن ۱۲۰ ms است و با آن ۴ ms (f) |
| `refresh_tokens_user_idx` | 16 kB | نگه داشتن: جدول در داده‌ی حجیم تقریباً خالی است، پس Seq Scan ارزان‌تر بود. این ایندکس باطل کردن همه‌ی توکن‌های یک کاربر را پوشش می‌دهد |
| `auth_attempts_lookup_idx` | 16 kB | نگه داشتن: همان دلیل. این ایندکس شمارش تلاش‌های ورود را پوشش می‌دهد |

### (f) حذف `listing_amenities_amenity_idx` — رد

| | با ایندکس | بی ایندکس |
| --- | --- | --- |
| حذف یک امکان بی‌استفاده (بررسی کلید خارجی) | 4.0 | 120.6 |
| `search_radius_5km_london_dates_pets_amenities` | 37.8 | 42.1 |
| `filters_amenities_london_dates` | 235.5 | 229.7 |

خواندن سودی نمی‌برد، و حذف هر امکان کل `listing_amenities` (۱٫۴۷ میلیون ردیف) را می‌خواند.

### (g) هزینه‌ی نوشتن با هر سه ایندکس

`write_1000_bookings`، با ۹ اجرا، دو بار متناوب:

| | دور ۱ | دور ۲ |
| --- | --- | --- |
| با (a)، (b) و (e) | 81.1 | 88.8 |
| بدون آن‌ها | 58.9 | 52.7 |

حدود ۳۰ ms برای هر ۱۰۰۰ رزرو، یعنی ۰٫۰۳ ms برای هر رزرو، و همچنان خیلی زیر هدف ۳۰۰ ms.

## پیش و پس از تغییر (T026)

هر دو طرف روی همان `caravansara_bulk` و پشت‌سرهم گرفته شده‌اند:
- «پیش»: revision `0003` و SQL قبلی برنامه، در 2026-11-06T14:03:42+00:00.
- «پس»: revision `0005` و SQL تازه، در 2026-11-06T14:04:35+00:00.

شرایط مشترک دو طرف:
- لپ‌تاپ روی باتری بود.
- `listings` پیش از هر دو با `VACUUM FULL` فشرده شد. بدون آن، bloat بارگذاری حجیم (بخش «آزمایش‌ها») پس از رفع anti-join گلوگاه می‌شد: شمارش لندن ۱۵۰ ms روی جدول ۳۸۶ MB، در برابر ۴۳ ms روی ۳۰ MB. `seed-bulk` حالا خودش جدول را فشرده می‌کند.
- ابزار برای هر کوئری اتصال تازه می‌گیرد.

فایل‌ها: [before.json](before.json) و [after.json](after.json).

**25 از 42 کوئری پیش از تغییر به هدف می‌رسیدند؛ پس از تغییر 30.** 42 کوئری یعنی ۴۰ کوئری خط پایه و دو کوئری ۱۴ شبه که برای سنجیدن سقف ۷ شب اضافه شدند.

| کوئری | پیش | پس | تغییر | هدف | | ایندکس‌های «پس» |
| --- | --- | --- | --- | --- | --- | --- |
| `search_city_london` | 132.1 | 43.5 | -67% | 50 | ✓ | listings_city_idx, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_city_london_dates` | 913.4 | 64.9 | -93% | 50 | ✗ | bookings_active_stay_idx, listings_city_idx, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_city_london_dates_page_21` | 922.9 | 66.5 | -93% | 50 | ✗ | bookings_active_stay_idx, listings_city_idx, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_city_stockholm_dates` | 88.4 | 54.1 | -39% | 50 | ✗ | listings_city_idx, no_double_booking, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_radius_1km_london` | 3.96 | 3.06 | -23% | 50 | ✓ | listings_public_location_idx, listings_pkey, listing_photos_order_key |
| `search_radius_1km_london_dates` | 17.5 | 14.3 | -18% | 50 | ✓ | listings_public_location_idx, bookings_active_stay_idx, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_radius_5km_london` | 83.1 | 39.5 | -52% | 50 | ✓ | listings_public_location_idx, listings_pkey, listing_photos_order_key |
| `search_radius_5km_london_dates` | 326.6 | 51.6 | -84% | 50 | ✗ | listings_public_location_idx, bookings_active_stay_idx, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_radius_20km_london` | 275.5 | 157.0 | -43% | 50 | ✗ | listings_public_location_idx, listings_pkey, listing_photos_order_key |
| `search_radius_20km_london_dates` | 545.6 | 178.7 | -67% | 50 | ✗ | listings_public_location_idx, bookings_active_stay_idx, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_radius_5km_london_dates_by_distance` | 353.0 | 78.6 | -78% | 50 | ✗ | listings_public_location_idx, bookings_active_stay_idx, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_radius_5km_london_dates_pets_amenities` | 38.5 | 31.9 | -17% | 50 | ✓ | listings_public_location_idx, bookings_active_stay_idx, listing_amenities_pkey, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_radius_5km_stockholm_dates` | 35.2 | 13.7 | -61% | 50 | ✓ | listings_public_location_idx, bookings_active_stay_idx, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_radius_1km_london_14_nights` | 17.7 | 15.5 | -12% | 50 | ✓ | listings_public_location_idx, no_double_booking, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_radius_5km_london_14_nights` | 324.5 | 277.0 | -15% | 50 | ✗ | listings_public_location_idx, no_double_booking, listings_pkey, cities_pkey, listing_photos_order_key |
| `search_count_london_dates` | 374.2 | 43.1 | -88% | 50 | ✓ | bookings_active_stay_idx, listings_city_idx |
| `filters_total_london_dates` | 358.9 | 54.4 | -85% | 50 | ✗ | bookings_active_stay_idx, listings_city_idx |
| `filters_amenities_london_dates` | 645.0 | 233.4 | -64% | 50 | ✗ | bookings_active_stay_idx |
| `filters_amenities_radius_5km_london_dates` | 553.7 | 182.9 | -67% | 50 | ✗ | listings_public_location_idx, bookings_active_stay_idx, listing_amenities_pkey |
| `listing_by_id` | 0.02 | 0.03 | +37% | 50 | ✓ | listings_pkey |
| `listing_photos` | 0.02 | 0.02 | -6% | 50 | ✓ | listing_photos_order_key |
| `listing_amenity_ids` | 0.03 | 0.01 | -55% | 50 | ✓ | listing_amenities_pkey |
| `listing_pins` | 0.05 | 0.02 | -52% | 50 | ✓ | listings_pkey |
| `cover_keys` | 0.03 | 0.02 | -8% | 50 | ✓ | listing_photos_order_key |
| `host_listings_count` | 0.36 | 0.33 | -7% | 50 | ✓ | listings_host_idx |
| `host_listings_page` | 1.14 | 1.27 | +12% | 50 | ✓ | listings_pkey |
| `reviews_count` | 0.04 | 0.04 | -14% | 50 | ✓ | reviews_listing_idx |
| `reviews_page_1` | 0.03 | 0.04 | +32% | 50 | ✓ | reviews_listing_idx |
| `reviews_page_4` | 0.06 | 0.05 | -13% | 50 | ✓ | reviews_listing_idx |
| `review_authors` | 0.02 | 0.01 | -29% | 50 | ✓ | users_pkey |
| `guest_bookings_count` | 0.05 | 0.06 | +33% | 50 | ✓ | bookings_guest_idx |
| `guest_bookings_page` | 0.07 | 0.08 | +11% | 50 | ✓ | bookings_guest_idx |
| `guest_bookings_completed_page` | 0.09 | 0.09 | +2% | 50 | ✓ | bookings_guest_idx |
| `listing_bookings_count` | 124.6 | 0.06 | -100% | 50 | ✓ | bookings_listing_check_in_idx |
| `listing_bookings_page` | 119.5 | 0.03 | -100% | 50 | ✓ | bookings_listing_check_in_idx |
| `booking_by_idempotency_key` | 0.03 | 0.02 | -12% | 50 | ✓ | bookings_idempotency_key_key |
| `expire_listing_holds` | 0.21 | 0.08 | -62% | 50 | ✓ | bookings_pending_hold_idx, bookings_listing_check_in_idx |
| `user_by_email` | 0.01 | 0.02 | +29% | 50 | ✓ | users_email_lower_key |
| `login_attempts` | 0.03 | 0.02 | -15% | 50 | ✓ | — |
| `job_expire_overdue_holds` | 10.5 | 12.6 | +20% | 50 | ✓ | bookings_pending_hold_idx |
| `job_complete_finished_stays` | 1071.1 | 379.4 | -65% | 50 | ✗ | bookings_confirmed_check_out_idx |
| `write_1000_bookings` | 92.3 | 112.2 | +22% | 300 | ✓ | listings_pkey |

**حجم ایندکس‌ها (SC-005):** ۷۷۱ MB پیش، ۱٬۰۵۵ MB پس، یعنی ۲۸۴ MB یا ۳۷٪ بیشتر. سهم هر ایندکس:
- `bookings_listing_check_in_idx`: ۱۱۷ MB
- `bookings_active_stay_idx`: ۱۶۳ MB
- `bookings_confirmed_check_out_idx`: ۳٫۳ MB

migration `0004` و `0005` روی ۳ میلیون رزرو با `CONCURRENTLY` در ۲۶ ثانیه ساخته شدند.

### کندتر از پیش (SC-004)

در اجرای ۵ تایی، هشت کوئری بیش از ۱۰٪ کندتر بودند. طبق قاعده‌ی نوسان، پیش و پس هر هشت کوئری با `--runs 9` دوباره گرفته شد. برای «پیش»، `caravansara_bulk` به `0003` برگشت و بعد دوباره به head رفت:

| کوئری | پیش (۹ اجرا) | پس (۹ اجرا) | | دلیل |
| --- | --- | --- | --- | --- |
| `write_1000_bookings` | 65.8 | 113.2 | +72% | واقعی است: نگه‌داری سه ایندکس تازه، یعنی حدود ۰٫۰۵ ms برای هر رزرو، و همچنان زیر هدف ۳۰۰ ms. بیشترین سهم مال GiST است: بی آن ۷۰ ms بود، در برابر ۸۶ تا ۱۳۴ ms با هر سه، که خودش نوسان زیادی دارد (آزمایش g) |
| `reviews_page_1` | 0.028 | 0.031 | +11% | همان نقشه و همان ایندکس، و فاصله ۳ میکروثانیه است. هیچ تغییری به نظرها دست نزده، پس کندی نیست |
| بقیه (`listing_by_id`، `host_listings_page`، `guest_bookings_count`، `guest_bookings_page`، `user_by_email`، `job_expire_overdue_holds`) | — | — | −۱ تا +۷٪ | نوسان بود: با ۹ اجرا زیر ۱۰٪ ماندند |

### هنوز بالاتر از هدف (SC-003، FR-005)

لپ‌تاپ روی باتری بود، و در این حالت همه‌ی عددها حدود دو برابر حالت برق شهر است. مثلاً خط پایه‌ی اول، روی برق، برای شعاع ۵ km بدون تاریخ ۴۵ ms بود و اینجا ۸۳ ms. پس بعضی از این‌ها روی برق شهر احتمالاً به هدف می‌رسند، اما فقط عدد اندازه‌گیری‌شده ثبت می‌شود.

| کوئری | پس | دلیل |
| --- | --- | --- |
| جستجوی شهری لندن با تاریخ (صفحه‌ی ۱ و ۲۱) | 65–66 | ۴۴٬۸۷۳ آگهی منطبق: شمارش `total` و مرتب کردن همه، که API برمی‌گرداند. پیش ۹۱۳ ms بود |
| استکهلم با تاریخ | 54 | برای هر یک از ۲٬۳۸۹ آگهی یک بار در `no_double_booking` می‌گردد. برنامه‌ریز این را با تخمین درست انتخاب کرده، و شکل hash روی کپی برابر بود |
| شعاع ۵ km با تاریخ | 52 | همان شکل hash؛ پیش ۳۲۷ ms بود |
| شعاع ۲۰ km، با و بی تاریخ | 157–179 | ۴۷ هزار آگهی؛ پیدا کردنشان ۸ ms است و بقیه‌ی زمان صرف محاسبه‌ی فاصله‌ی دقیق روی بیضی‌گون می‌شود، که ایندکس آن را حذف نمی‌کند (آزمایش d) |
| ۵ km به ترتیب فاصله | 79 | همان محاسبه‌ی فاصله، برای ۱۵ هزار آگهی، و مرتب کردن |
| ۵ km با ۱۴ شب | 277 | بالاتر از سقف ۷ شب، پس برای هر آگهی جدا می‌گردد. شکل hash اینجا ۱۱۹ ms می‌شد، اما روی ۱ km پس‌رفت داشت (۱۶ → ۶۴، آزمایش b). اقامت‌های بیش از یک هفته در منطقه‌ی پرتراکم مصالحه‌ی پذیرفته‌شده‌اند |
| پنل فیلترها: `total` لندن | 54 | مثل شمارش جستجو (۴۳ ms)، به‌اضافه‌ی نوسان |
| پنل فیلترها: شمارش امکانات | 183–233 | ۶۵۷ هزار ردیف (آگهی، امکان) برای ۴۵ هزار آگهی جمع زده می‌شود. این کار واقعی است، نه نبودِ ایندکس. نامزد کش (`docs/future-work.md`، Redis) |
| job پایان اقامت | 379 | ۲٬۶۶۴ اقامت گذشته در `caravansara_bulk` منتظر `completed` شدن‌اند، چون worker هرگز روی آن اجرا نشده، و UPDATE آن‌ها بیشتر زمان را می‌گیرد. در حالت عادی (کپی، پس از یک اجرای واقعی job): ۷۷۹ → ۴۰ ms (آزمایش e) |

### جستجوی شعاعی (FR-011)

| شعاع لندن | بدون تاریخ | ۳ شب | ۱۴ شب |
| --- | --- | --- | --- |
| ۱ km | 3.96 → 3.06 | 17.5 → 14.3 | 17.7 → 15.5 |
| ۵ km | 83.1 → 39.5 | 326.6 → 51.6 | 324.5 → 277.0 |
| ۲۰ km | 275.5 → 157.0 | 545.6 → 178.7 | — |

GiST فعلی روی `public_location` می‌ماند، چون SP-GiST در هیچ شعاعی سریع‌تر نبود.
