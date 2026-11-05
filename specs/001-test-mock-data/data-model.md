# Data Model: داده‌ی تست و ماک بیشتر و متنوع‌تر

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

این قابلیت **شمای پایگاه داده را تغییر نمی‌دهد**: هیچ migration، جدول یا ستون تازه‌ای ندارد. آنچه اینجا می‌آید، داده‌ای است که در جدول‌های موجود (`db/schema.sql`) می‌نشیند، و فایل‌هایی که آن را می‌سازند.

## ۱. Catalog (داده، نه شما)

| جدول | تغییر |
| --- | --- |
| `countries` | + `GB` (United Kingdom)، `US` (United States)، `IR` (Iran) |
| `cities` | + London (`Europe/London`)، New York City (`America/New_York`)، Tehran، Isfahan، Shiraz (`Asia/Tehran`) |
| `amenities` | بدون تغییر (۳۱ مورد) |

قاعده: `seed_locations.sql` و `seed_amenities.sql` با `ON CONFLICT DO NOTHING` نوشته می‌شوند. اجرای دوباره فقط ردیف تازه اضافه می‌کند، و ردیف موجود را تغییر نمی‌دهد یا پاک نمی‌کند (R7).

## ۲. مجموعه‌ی داده‌ی دمو

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

### حالت‌های مرزی (Edge case catalog)

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

### عکس‌ها

- **کلید**: `demo/listings/<listing_id>/<sort_order>-<slug>.jpg`، مثلاً `demo/listings/7/0-living-room.jpg`.
- **ابعاد**: `width` و `height` از `db/demo/photos/manifest.json` خوانده می‌شوند.
- **فایل‌ها**: `db/demo/photos/<slug>.jpg`، ۸ فایل، یکی برای هر برچسب (R3).
- **ترتیب**: `sort_order` از ۰ پیوسته جلو می‌رود، و ۰ کاور است.

`manifest.json`:

```json
{ "living-room": {"file": "living-room.jpg", "room_tag": "Living room", "width": 1200, "height": 800}, "...": {} }
```

## ۳. آگهی فارسی (`db/demo/fa_listings.json`)

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

## ۴. پروفایل شهر (`db/bulk/city_profiles.json`)

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

## ۵. مجموعه‌ی داده‌ی حجیم (در پایگاه داده‌ی `caravansara_bulk`)

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

## ۶. ابزار ساخت داده‌ی تست (`backend/tests/factories.py`)

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
