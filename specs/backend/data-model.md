# Data Model: بکند، کارهای ۰۰۱ تا ۰۰۴

این فایل `data-model.md` چهار کار بکند را، که با Spec Kit ساخته و merge شده‌اند، کنار هم دارد: هر کار یک بخش، به ترتیب شماره. متن هر بخش همان متن پوشه‌ی اصلی آن کار (`specs/NNN-name/`) است، که در 2026-11-09 در این پوشه ادغام شد. شناسه‌ها (`FR-001`، `SC-001`، `T001`، `R1`، `US1`) همان‌اند که در قالب‌های Spec Kit، و درون بخش هر کار معنی دارند. پس ارجاع از بیرون به این شکل است: «`specs/backend`، کار ۰۰۴، research R5».

## 001. داده‌ی تست و ماک بیشتر و متنوع‌تر

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

این قابلیت **شمای پایگاه داده را تغییر نمی‌دهد**: هیچ migration، جدول یا ستون تازه‌ای ندارد. آنچه اینجا می‌آید، داده‌ای است که در جدول‌های موجود (`db/schema.sql`) می‌نشیند، و فایل‌هایی که آن را می‌سازند.

### ۱. Catalog (داده، نه شما)

| جدول | تغییر |
| --- | --- |
| `countries` | + `GB` (United Kingdom)، `US` (United States)، `IR` (Iran) |
| `cities` | + London (`Europe/London`)، New York City (`America/New_York`)، Tehran، Isfahan، Shiraz (`Asia/Tehran`) |
| `amenities` | بدون تغییر (۳۱ مورد) |

قاعده: `seed_locations.sql` و `seed_amenities.sql` با `ON CONFLICT DO NOTHING` نوشته می‌شوند. اجرای دوباره فقط ردیف تازه اضافه می‌کند، و ردیف موجود را تغییر نمی‌دهد یا پاک نمی‌کند (R7).

### ۲. مجموعه‌ی داده‌ی دمو

منبع: `db/demo/build_demo_seed.py` → `db/seed_demo.sql` (در git، ساخته‌شده، ویرایش دستی ممنوع).

| موجودیت | تعداد (برآورد) | منبع |
| --- | --- | --- |
| `users` | حدود ۱٬۸۰۰ | ۲ حساب دمو + میزبان‌ها و مهمان‌های ساختگی (بخشی با نام فارسی) |
| `listings` | ۷۹۰ | ۶ × ۱۲۵ از Inside Airbnb + ۴۰ فارسی از `fa_listings.json` |
| `listing_photos` | حدود ۳٬۹۰۰ | ۳ تا ۸ برای هر آگهی (R4) |
| `listing_amenities` | حدود ۱۵٬۰۰۰ | امکانات واقعی نگاشته‌شده به catalog |
| `bookings` | حدود ۱۲٬۰۰۰ | یک اقامت پایان‌یافته پشت هر نظر + رزروهای آینده + حالت‌های مرزی |
| `reviews` | حدود ۱۰٬۰۰۰ | تا ۱۵ نظر انگلیسی واقعی + ۸۰ تا ۱۶۰ نظر فارسی |

قاعده‌ها:

- **خالی بودن**: فایل در ابتدا بررسی می‌کند که `users` و `listings` خالی باشند، وگرنه با `RAISE EXCEPTION` متوقف می‌شود (FR-009).
- **شناسه‌های صریح**: شناسه‌ها با `OVERRIDING SYSTEM VALUE` داده می‌شوند، و در پایان `setval` آن‌ها را جلو می‌برد.
- **حساب‌های دمو**: `users.id = 1` همان `host@example.com` (Sara Lindqvist، میزبان آگهی‌های ۱ تا ۳ در Amsterdam) است. `users.id = 2` همان `guest@example.com` (Omar Haddad) است. رمز هر دو `caravansara-demo` است (FR-015).
- **حریم خصوصی**: همه‌ی ایمیل‌ها `@example.com` هستند، نشانی‌ها ساختگی‌اند، و نام میزبان واقعی در متن نظر با نام ساختگی جایگزین می‌شود (FR-016).
- **ترتیب آگهی‌ها**: ترتیب شناسه‌ها ثابت است: اول شهرهای Inside Airbnb به ترتیب جدول R1، بعد آگهی‌های فارسی. پس شناسه‌ی حالت‌های مرزی در README ثابت می‌ماند.

#### حالت‌های مرزی (Edge case catalog)

هر حالت یک رکورد مشخص است. شناسه‌ها هنگام ساخت معلوم می‌شوند، و `build_demo_seed.py` آن‌ها را در جدول `db/demo/README.md` می‌نویسد، تا هر حالت در کمتر از ۱ دقیقه پیدا شود (SC-005).

| کلید | جدول | شرط (درستی‌سنجی در تست) |
| --- | --- | --- |
| `hold_about_to_expire` | `bookings` | `status = 'pending'`، `guest_id = 2`، `hold_expires_at` بین `now()` و `now() + 5 min` در لحظه‌ی بارگذاری |
| `expired_hold` | `bookings` | `status = 'expired'`، `guest_id = 2` |
| `year_long_stay` | `bookings` | `check_out - check_in = 365`، `status = 'confirmed'` |
| `last_bookable_day` | `bookings` | `check_in = امروزِ شهر + 365`، `status = 'confirmed'` |
| `same_day_turnover` | `bookings` (دو ردیف) | یک `listing_id`، `a.check_out = b.check_in`، هر دو `confirmed` |
| `inactive_listing` | `listings` | `is_active = false`، دست‌کم یک رزرو (پایان‌یافته و آینده) |
| `listing_without_reviews` | `listings` | `is_active = true`، `review_count = 0`، `avg_rating IS NULL` |

#### عکس‌ها

- **کلید**: `demo/listings/<listing_id>/<sort_order>-<slug>.jpg`، مثلاً `demo/listings/7/0-living-room.jpg`.
- **ابعاد**: `width` و `height` از `db/demo/photos/manifest.json` خوانده می‌شوند.
- **فایل‌ها**: `db/demo/photos/<slug>.jpg`، ۸ فایل، یکی برای هر برچسب (R3).
- **ترتیب**: `sort_order` از ۰ پیوسته جلو می‌رود، و ۰ کاور است.

`manifest.json`:

```json
{ "living-room": {"file": "living-room.jpg", "room_tag": "Living room", "width": 1200, "height": 800}, "...": {} }
```

### ۳. آگهی فارسی (`db/demo/fa_listings.json`)

ورودی دست‌نوشته. هر عنصر:

| فیلد | نوع | قاعده |
| --- | --- | --- |
| `city` | متن | `Tehran`، `Isfahan` یا `Shiraz`؛ باید در catalog باشد |
| `neighborhood` | متن فارسی | مثلاً «جلفا»، «تجریش» |
| `title` | متن فارسی | ۱ تا ۱۰۰ نویسه |
| `description` | متن فارسی | تا ۱۵۰۰ نویسه؛ دست‌کم یکی بیش از ۱۰۰۰ |
| `property_type` | enum | `entire_place`، `private_room`، `shared_room` |
| `latitude`، `longitude` | عدد | داخل محدوده‌ی شهر؛ `public_location` با همان جابه‌جایی ۱۰۰ تا ۵۰۰ متری ساخته می‌شود |
| `max_guests`، `bedrooms`، `beds`، `bathrooms` | عدد | همان قیدهای جدول `listings` |
| `price_per_night`، `cleaning_fee` | عدد صحیح ریال | ۲٬۵۰۰٬۰۰۰ تا ۲۰٬۰۰۰٬۰۰۰ برای هر شب؛ `total_price` هر رزرو < ۱۰^۸ (R6) |
| `amenities` | فهرست نام | نام‌های catalog (انگلیسی) |
| `pets_allowed` | بولی | |
| `reviews` | فهرست | ۲ تا ۴ عنصر `{ "rating": 1..5, "comment": "…" }`؛ دست‌کم یک comment کمتر از ۲۰ نویسه در کل فایل |

`currency` همیشه `IRR` است و از فایل خوانده نمی‌شود. اگر فایل این قاعده‌ها را رعایت نکند، `build_demo_seed.py` با خطا متوقف می‌شود.

### ۴. پروفایل شهر (`db/bulk/city_profiles.json`)

خروجی `db/bulk/build_city_profiles.py` از cache، در git.

```json
{
  "version": 1,
  "source": "Inside Airbnb, CC BY 4.0",
  "cities": {
    "Amsterdam": {
      "snapshot": "2026-09-16",
      "currency": "EUR",
      "listing_count": 9000,
      "room_type_share": {"entire_place": 0.78, "private_room": 0.21, "shared_room": 0.01},
      "price_percentiles": {"entire_place": [/* 101 عدد */], "private_room": [], "shared_room": []},
      "accommodates": {"1": 0.05, "2": 0.45, "...": 0},
      "size_by_accommodates": {"2": {"bedrooms": [[1, 0.8], [0, 0.2]], "beds": [], "bathrooms": []}},
      "amenity_probability": {"Wifi": 0.98, "...": 0},
      "rating": {"mean": 4.75, "sd": 0.3},
      "occupancy_l365d": [/* 101 صدک شب‌های رزروشده در سال */],
      "listings_per_host": {"mean": 1.4, "max": 50},
      "review_share": 0.5,
      "points": [[52.372, 4.889], "... 500 نقطه"]
    }
  }
}
```

قاعده‌ها:

- همه‌ی احتمال‌های یک توزیع با هم ۱ می‌شوند (با دقت ۱۰^-۶).
- صدک‌ها صعودی‌اند.
- نام امکانات باید در catalog باشد.
- `seed-bulk` در شروع این قاعده‌ها را بررسی می‌کند.

### ۵. مجموعه‌ی داده‌ی حجیم (در پایگاه داده‌ی `caravansara_bulk`)

ورودی: `(profiles, listings, seed, today)`. خروجی برای یک ورودی همیشه یکسان است (R10).

| جدول | تعداد برای `--listings 100000` | قاعده |
| --- | --- | --- |
| `users` | حدود ۳۶۰ هزار | شناسه ۱ تا H میزبان، بقیه مهمان؛ ایمیل `bulk.<id>@example.com`؛ یک hash رمز مشترک |
| `listings` | ۱۰۰٬۰۰۰ | سهم هر شهر برابر نسبت `listing_count` در پروفایل؛ همه‌ی ستون‌ها از توزیع شهر |
| `listing_photos` | ۳۰۰٬۰۰۰ | ۳ ردیف برای هر آگهی، کلید `bulk/listings/<id>/<n>.jpg`، بدون فایل |
| `listing_amenities` | حدود ۱٫۵ میلیون | نمونه‌گیری مستقل با احتمال پروفایل |
| `bookings` | حدود ۳ میلیون (≥ ۲٬۰۰۰٬۰۰۰) | بازه‌ی `[today − 730 روز، today + 365 روز]`؛ رزروهای فعال یک آگهی هم‌پوشانی ندارند؛ آینده حداکثر تا `today + 365` |
| `reviews` | حدود ۱٫۲ میلیون | فقط برای `completed`؛ `created_at` تا ۱۴ روز بعد از `check_out`؛ ستاره‌ها حول میانگین پروفایل |

وضعیت رزروها (R12):

| وضعیت | کجا |
| --- | --- |
| `completed` | `check_out ≤ today` |
| `cancelled` | گذشته یا آینده؛ بازه‌اش می‌تواند با رزرو دیگری هم‌پوشان باشد |
| `confirmed` | `check_out > today` |
| `pending` | آینده، `hold_expires_at > now()` |
| `expired` | گذشته‌ی نزدیک، `hold_expires_at < now()`؛ بازه‌اش می‌تواند هم‌پوشان باشد |

قانون‌هایی که پایگاه داده تضمین می‌کند و تولیدکننده باید رعایت کند: `no_double_booking`، نظر فقط برای `completed` (trigger)، FK ترکیبی نظر، و `avg_rating` و `review_count` (trigger). همه در زمان بارگذاری روشن‌اند (R9).

### ۶. ابزار ساخت داده‌ی تست (`backend/tests/factories.py`)

| فراخوانی | می‌سازد | راه |
| --- | --- | --- |
| `user(name)` | `User` با توکن | API: `POST /auth/register` |
| `listing(host=None, **overrides)` | آگهی (dict پاسخ API) | API: `POST /listings` |
| `booking(status, check_in, check_out, listing=None, guest=None, hold_expires_at=None)` | شناسه‌ی رزرو | `INSERT` مستقیم؛ قیدها و triggerها فعال |
| `stay(ended_days_ago=1)` | `(host, guest, listing, booking_id)` | ترکیب سه فراخوانی بالا با `status='completed'` |
| `expire_hold(booking_id, ago)` | — | `UPDATE hold_expires_at` |

پیش‌فرض‌های `booking`:

| وضعیت | پیش‌فرض |
| --- | --- |
| `pending` | `hold_expires_at = now() + 15 min` |
| `expired` | `hold_expires_at = now() - 1 min` |
| بقیه | `hold_expires_at = NULL` |

قیمت‌ها از آگهی کپی می‌شوند، و `total_price = nightly × nights + cleaning`، مثل `rules.total_price`.

---

## 002. قیمت ریالی بدون سرریز

جدول یا رابطه‌ی تازه‌ای نیست. فقط ظرفیت پنج ستون مبلغ عوض می‌شود.

### ستون‌ها

| جدول | ستون | قبل | بعد | قیدها (بدون تغییر) |
| --- | --- | --- | --- | --- |
| `listings` | `price_per_night` | `NUMERIC(10,2)` | `NUMERIC(14,2)` | `NOT NULL`، `CHECK (price_per_night > 0)` |
| `listings` | `cleaning_fee` | `NUMERIC(10,2)` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0`، `CHECK (cleaning_fee >= 0)` |
| `bookings` | `nightly_price` | `NUMERIC(10,2)` | `NUMERIC(14,2)` | `NOT NULL` |
| `bookings` | `cleaning_fee` | `NUMERIC(10,2)` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` |
| `bookings` | `total_price` | `NUMERIC(10,2)` | `NUMERIC(14,2)` | `NOT NULL` |

### مقدارهای مرزی

| نام | مقدار | کجا | دلیل |
| --- | --- | --- | --- |
| `MAX_PRICE` | `1000000000.00` | `listings/schemas.py` | سقف قیمت شب و هزینه‌ی نظافت در همه‌ی ارزها (Clarification 2026-11-05) |
| `MAX_STORED_AMOUNT` | `999999999999.99` | `bookings/rules.py` | ظرفیت `NUMERIC(14,2)`؛ نگهبان جمع رزرو (R5) |
| بدترین جمع مجاز | `366000000000.00` | — | `MAX_PRICE × 365 + MAX_PRICE`؛ کمتر از `MAX_STORED_AMOUNT` |

### قاعده‌های اعتبارسنجی

| ورودی | قاعده | خطا |
| --- | --- | --- |
| `price_per_night` | `0 < x ≤ 1000000000.00`، حداکثر ۲ رقم اعشار | ۴۲۲ `validation_error`، `loc` فیلد |
| `cleaning_fee` | `0 ≤ x ≤ 1000000000.00`، حداکثر ۲ رقم اعشار | ۴۲۲ `validation_error`، `loc` فیلد |
| جمع رزرو (حساب‌شده) | `≤ 999999999999.99` | ۴۲۲ `amount_too_large`؛ هیچ رزروی ساخته نمی‌شود |

### migration

`0002_wider_price_columns`، بعد از `0001`:

- **upgrade:** پنج ستون → `NUMERIC(14,2)`. بدون بازنویسی جدول (research R3).
- **downgrade:** پنج ستون → `NUMERIC(10,2)`. اگر مقداری جا نشود، PostgreSQL با `22003` متوقف می‌شود، تراکنش برمی‌گردد و داده همان می‌ماند.

---

## 003. بررسی ایندکس‌ها با اندازه‌گیری

جدول کسب‌وکار تازه‌ای نیست، و هیچ ستونی عوض نمی‌شود. تغییرها ایندکس‌ها، یک extension، و فایل‌های فهرست کوئری‌اند.

### ۱. فهرست کوئری‌ها (`db/bulk/queries/`)

| فایل | محتوا |
| --- | --- |
| `catalog.json` | آرایه‌ای از کوئری‌ها |
| `<name>.sql` | SQL همان‌طور که برنامه می‌فرستد، با پارامترهای نام‌دار `:name` |
| `params.sql` | یک `SELECT` که پارامترهای نماینده را از داده‌ی حجیم انتخاب می‌کند (پررزروترین آگهی، پرسفرترین مهمان، مرکز لندن و استکهلم و …) |

هر عضو `catalog.json`:

| فیلد | نوع | قاعده |
| --- | --- | --- |
| `name` | متن | یکتا، `snake_case`، همان نام فایل SQL |
| `source` | متن | `caravansara.<module>.repository:<function>` یا `caravansara.jobs…`؛ باید در کد وجود داشته باشد |
| `endpoint` | متن یا `null` | مثل `GET /search/listings`؛ برای job، نام job |
| `kind` | `read` \| `write` | `write` در `BEGIN … ROLLBACK` اجرا می‌شود |
| `params` | شیء | نام پارامتر → مقدار ثابت یا نام ستون خروجی `params.sql` |
| `target_ms` | عدد | پیش‌فرض ۵۰ (FR-005)؛ برای نوشتن دسته‌ای، عدد خودش |

`excluded` در همان فایل: فهرست `{source, reason}` برای توابعی که اندازه گرفته نمی‌شوند (مثلاً کوئری روی جدول ۹ ردیفی). هر تابع repository یا job باید یا در `queries` باشد یا در `excluded` (SC-001).

### ۲. اندازه‌گیری (خروجی `measure-queries`)

| فیلد | معنا |
| --- | --- |
| `name` | نام کوئری |
| `median_ms` | میانه‌ی `Execution Time` در ۵ اجرا، بعد از ۱ اجرای گرم‌کننده |
| `runs_ms` | هر ۵ عدد |
| `shared_hit`, `shared_read` | buffers در آخرین اجرا |
| `access` | نوع‌های دسترسی نقشه (مثل `Index Scan`، `Seq Scan`) |
| `indexes` | نام ایندکس‌های به‌کاررفته |
| `target_ms`, `meets_target` | هدف و رسیدن به آن |
| `jit` | آیا خود کوئری JIT شد (در جدول Markdown به‌صورت `JIT` در ستون دسترسی) |
| `database`, `revision`, `measured_at` | پایگاه داده، نسخه‌ی Alembic و زمان |

خروجی: `--out <path>.json`، و همان به شکل جدول Markdown در stdout.

### ۳. تغییرهای ایندکس (migrationهای `0003` تا `0005`)

نامزدها از research (R3–R9). هر کدام فقط اگر اندازه‌گیری سودش را نشان دهد ساخته می‌شود. نامزدهای جستجو و رزرو آگهی در `0004` می‌آیند، و نامزدهای job و حذف ایندکس در `0005`:

| نامزد | کوئری‌هایی که اثر می‌گیرند | قاعده |
| --- | --- | --- |
| `bookings (listing_id, check_in, id)` B-tree | رزروهای آگهی (شمارش و صفحه) | — |
| `bookings (check_out) WHERE status = 'confirmed'` | job پایان اقامت، همراه با کران امن در کوئری | تست‌های فعلی job بدون تغییر پاس شوند |
| `bookings USING gist (stay) WHERE status IN ('pending','confirmed','completed')` | جستجو با تاریخ | همراه با شکلی از کوئری که برنامه‌ریز hash anti-join را انتخاب کند، با همان نتیجه |
| ایندکس covering روی `listings` برای ستون‌های جستجو | جستجوی شهری و شعاعی | حجم و زمان نوشتن آگهی سنجیده شود |
| SP-GiST روی `listings.public_location` | جستجوی شعاعی | فقط اگر از GiST فعلی سریع‌تر باشد، جایگزین آن |
| حذف `listing_amenities_amenity_idx` | فیلتر امکانات، حذف یک امکان | فقط اگر هیچ کوئری فهرست آن را به کار نبرد |
| `CREATE EXTENSION IF NOT EXISTS pg_stat_statements` (migration `0003`) | — | — |

- **migration:** همه با `CREATE INDEX` عادی، در تراکنش migration. دلیل: `CONCURRENTLY` داخل تراکنش اجرا نمی‌شود، و روی داده‌ی واقعی امروز (حداکثر چند هزار ردیف) ساخت ایندکس لحظه‌ای است. زمان ساخت هر ایندکس روی داده‌ی حجیم ثبت می‌شود، تا برای production روش جدا تصمیم گرفته شود.
- **downgrade:** ایندکس‌های تازه حذف می‌شوند، و ایندکس حذف‌شده با همان تعریف قبلی برمی‌گردد. extension حذف نمی‌شود، چون ممکن است چیز دیگری به آن وابسته باشد.

---

## 004. تأیید آگهی توسط مدیر سیستم (admin)

همه با migration `0006_listing_review` (R5، R16). `db/schema.sql`، `db/schema.dbml` و ERD از آن پیروی می‌کنند.

### Typeهای تازه

| Type | مقدارها |
|---|---|
| `account_kind` | `member`, `admin` |
| `listing_review_status` | `pending`, `approved`, `rejected` |
| `review_action` | `submitted`, `edited`, `resubmitted`, `approved`, `rejected` |

### `users` (تغییر)

| ستون | نوع | قاعده |
|---|---|---|
| `kind` | `account_kind NOT NULL DEFAULT 'member'` | فقط `create-admin` مقدار `admin` می‌نویسد (FR-012). هیچ schema ورودی عمومی این فیلد را ندارد. |
| `disabled_at` | `timestamptz NULL` | فقط `disable-admin` پرش می‌کند. admin با `disabled_at` پر نه وارد می‌شود و نه هیچ اقدام admin انجام می‌دهد (R2). |

- یکتایی ایمیل همان ایندکس امروز روی `lower(email)` است و هر دو نوع حساب را می‌پوشاند (R1).
- **`auth_attempts.action`:** CHECK آن از `('login', 'register')` به `('login', 'register', 'admin_login')` گسترش می‌یابد، تا ورود admin با همان جدول و جدا شمرده شود (R3). این را plan ندیده بود؛ اولین تست ورود admin در پیاده‌سازی آن را پیدا کرد. downgrade ردیف‌های `admin_login` را حذف و CHECK قبلی را برمی‌گرداند.
- ورود عادی فقط `kind = 'member'` را می‌پذیرد، و ورود admin فقط `kind = 'admin' AND disabled_at IS NULL` را.

### `listings` (تغییر)

| ستون | نوع | قاعده |
|---|---|---|
| `review_status` | `listing_review_status NOT NULL`؛ پیش‌فرض ردیف‌های موجود `approved`، پیش‌فرض ردیف تازه `pending` | FR-001، FR-013 |
| `submitted_at` | `timestamptz NULL DEFAULT now()` (پیش‌فرض پس از ADD) | زمان ورود به صف؛ ترتیب صف `(submitted_at, id)`. |
| `rejection_reason` | `text NULL` | آخرین دلیل رد، فقط وقتی `rejected`. |
| `review_version` | `integer NOT NULL DEFAULT 0` | با هر ویرایش توصیفی یکی بالا می‌رود (R6). |

**CHECK**:

- `listings_pending_submitted_check`: `review_status <> 'pending' OR submitted_at IS NOT NULL`.
- `listings_rejection_reason_check`: `(review_status = 'rejected') = (rejection_reason IS NOT NULL)` و `rejection_reason IS NULL OR (char_length(rejection_reason) <= 1000 AND btrim(rejection_reason) <> '')` (FR-005).

**ایندکس**: `listings_review_queue_idx ON listings (submitted_at, id) WHERE review_status = 'pending'`. صف، شمارش و قدیمی‌ترین انتظار (R10) از آن می‌خوانند.

**آمار**: upgrade با `ANALYZE listings` تمام می‌شود. `ADD COLUMN` برای `review_status` آماری نمی‌سازد، و بدون آن planner جستجوی شهری با تاریخ را به نقشه‌ی کندتر برد ([measurements.md](measurements.md)، «یافته: آمار ستون تازه»).

**عمومی** (FR-002): `is_active AND review_status = 'approved'`. ستون ذخیره‌شده نیست (R8).

#### انتقال وضعیت

| از | رویداد | به | انجام‌دهنده | شرط UPDATE | سابقه |
|---|---|---|---|---|---|
| (هیچ) | ساختن آگهی | `pending` | میزبان | INSERT | `submitted` |
| `pending` | تأیید | `approved` | admin | `review_status = 'pending' AND review_version = :v` | `approved` |
| `pending` | رد با دلیل | `rejected` | admin | همان | `rejected` + دلیل |
| `rejected` | ارسال دوباره | `pending`، `submitted_at = now()`، `rejection_reason = NULL` | میزبان | `review_status = 'rejected' AND host_id = :me` | `resubmitted` |
| `approved` | ویرایش توصیفی | `pending`، `submitted_at = now()`، `review_version + 1` | میزبان | زیر قفل ردیف (`FOR UPDATE`) | `edited` |
| `pending` یا `rejected` | ویرایش توصیفی | بدون تغییر وضعیت، `review_version + 1` | میزبان | زیر قفل ردیف | — |
| هر وضعیت | ویرایش غیرتوصیفی (FR-010) | بدون تغییر | میزبان | — | — |

- تأیید و رد `rejection_reason` را مقدار می‌دهند (رد) یا خالی می‌کنند (تأیید)، و `submitted_at` را نگه می‌دارند.
- اگر UPDATE تصمیم هیچ ردیفی را عوض نکند: وضعیت دیگر `pending` نیست ← `409 listing_not_pending`؛ نسخه عوض شده ← `409 listing_changed` (R6).

**فیلدهای توصیفی** (FR-009، R7): `title`، `description`، `property_type`، `city_id`، `neighborhood`، `address`، `latitude`، `longitude`، مجموعه‌ی امکانات، افزودن عکس، `caption` و `room_tag` عکس. تغییر فقط وقتی حساب است که مقدار عوض شود.

### `listing_review_events` (تازه، ماژول `listings`)

| ستون | نوع | قاعده |
|---|---|---|
| `id` | `bigint identity` | |
| `listing_id` | `bigint NOT NULL REFERENCES listings` | |
| `action` | `review_action NOT NULL` | |
| `actor_id` | `bigint NOT NULL REFERENCES users` | میزبان برای `submitted`، `edited`، `resubmitted`؛ admin برای `approved`، `rejected`. |
| `review_version` | `integer NOT NULL` | نسخه‌ای که تصمیم یا ارسال درباره‌اش بود. |
| `reason` | `text NULL` | `CHECK ((action = 'rejected') = (reason IS NOT NULL))`. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

- ایندکس: `(listing_id, created_at)`.
- trigger `listing_review_events_append_only`: هر UPDATE و DELETE را با خطا رد می‌کند (R11).

### `admin_address_views` (تازه، ماژول `moderation`)

| ستون | نوع |
|---|---|
| `id` | `bigint identity` |
| `admin_id` | `bigint NOT NULL REFERENCES users` |
| `listing_id` | `bigint NOT NULL REFERENCES listings` |
| `viewed_at` | `timestamptz NOT NULL DEFAULT now()` |

یک ردیف برای هر پاسخ `GET /api/v1/admin/listings/{id}`، در همان تراکنش (FR-018، SC-009). این کار هیچ رابطی برای خواندن سابقه نمی‌سازد (Assumptions)، پس ایندکس دیگری ندارد.

### ساختارهای میان ماژول‌ها

- `listings.service.ListingInfo` می‌گیرد: `review_status` و `is_public`. `bookings` به‌جای `is_active` شرط `is_public` را بررسی می‌کند.
- `listings.service` برای `moderation` این‌ها را دارد: `review_queue(limit, offset)`، `review_detail(listing_id)` (با نشانی دقیق)، `decide(listing_id, admin_id, version, approve | reject(reason))`، و `review_queue_stats()` برای worker.
- `identity.service` برای `moderation` و `cli` این‌ها را دارد: `admin_login`، `require_active_admin`، `create_admin` و `disable_admin`.
