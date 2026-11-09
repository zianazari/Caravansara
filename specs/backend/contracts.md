# Contracts: بکند، کارهای ۰۰۱ تا ۰۰۴

این فایل `contracts.md` چهار کار بکند را، که با Spec Kit ساخته و merge شده‌اند، کنار هم دارد: هر کار یک بخش، به ترتیب شماره. متن هر بخش همان متن پوشه‌ی اصلی آن کار (`specs/NNN-name/`) است، که در 2026-11-09 در این پوشه ادغام شد. شناسه‌ها (`FR-001`، `SC-001`، `T001`، `R1`، `US1`) همان‌اند که در قالب‌های Spec Kit، و درون بخش هر کار معنی دارند. پس ارجاع از بیرون به این شکل است: «`specs/backend`، کار ۰۰۴، research R5».

## 001. داده‌ی تست و ماک بیشتر و متنوع‌تر

### `contracts/cli.md`


این قابلیت **API HTTP را تغییر نمی‌دهد**: `backend/openapi.json` همان می‌ماند و تست قرارداد باید بدون `export-openapi` پاس شود. رابط بیرونی این قابلیت، فرمان‌های `caravansara` و اسکریپت‌های `db/` هستند.

قاعده‌ی خروجی برای همه‌ی فرمان‌ها:

| خروجی | کاربرد |
| --- | --- |
| `stdout` | خلاصه‌ی خوانا |
| لاگ JSON (`configure_logging`) | پیشرفت کار |
| کد خروج `0` | موفق |
| کد خروج `1` | خطا، با پیام روشن و بدون traceback، برای خطاهای شناخته‌شده |

#### `caravansara seed` (رفتار تغییرکرده)

```text
caravansara seed
```

| حالت | رفتار | خروجی |
| --- | --- | --- |
| catalog خالی | همه‌ی کشورها، شهرها و امکانات را درج می‌کند | `catalog loaded: 7 countries, 9 cities, 31 amenities` |
| catalog قدیمی (۴ شهر) | فقط ردیف‌های تازه را درج می‌کند | `catalog up to date: 3 new countries, 5 new cities, 0 new amenities` |
| catalog کامل | هیچ کاری نمی‌کند | `catalog up to date: nothing new` |

هیچ ردیفی به‌روز یا پاک نمی‌شود.

#### `caravansara seed-demo` (گسترش‌یافته)

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

#### `caravansara seed-bulk` (تازه)

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

#### اسکریپت‌های توسعه در `db/` (برای بازسازی، نه برای استفاده‌ی روزانه)

| فرمان | وابستگی | خروجی (در git) |
| --- | --- | --- |
| `python3 db/demo/build_demo_seed.py --download` | کتابخانه‌ی استاندارد، اینترنت | `.cache/insideairbnb/` (نادیده در git، حدود ۱٫۵ گیگابایت) |
| `python3 db/demo/build_demo_seed.py [--seed 42]` | cache، `fa_listings.json`، `photos/manifest.json` | `db/seed_demo.sql`، جدول حالت‌های مرزی در `db/demo/README.md` |
| `uv run --no-project --with pillow python db/demo/build_demo_photos.py` | Pillow | `db/demo/photos/*.jpg`، `manifest.json` |
| `python3 db/bulk/build_city_profiles.py` | cache | `db/bulk/city_profiles.json` |

هر سه اسکریپت با همان ورودی خروجی بایت‌به‌بایت یکسان می‌دهند.

### `contracts/test-factory.md`


ماژول: `backend/tests/factories.py`. fixture: `factory` در `backend/tests/conftest.py`.

این ابزار فقط داخل تست‌ها به کار می‌رود و بخشی از بسته‌ی `caravansara` نیست.

```python
class Factory:
    def __init__(self, client: AsyncClient, engine: AsyncEngine) -> None: ...

    async def user(self, name: str = "user") -> User: ...
    async def listing(self, host: User | None = None, **overrides: Any) -> dict[str, Any]: ...
    async def booking(
        self,
        *,
        status: str = "confirmed",            # pending | confirmed | cancelled | expired | completed
        check_in: date | int = 10,            # date، یا تعداد روز از امروز (منفی = گذشته)
        check_out: date | int | None = None,  # پیش‌فرض: check_in + 3 شب
        listing: dict[str, Any] | int | None = None,   # پاسخ API، یا فقط شناسه
        guest: User | int | None = None,               # User، یا فقط شناسه
        hold_expires_at: datetime | None = None,
        adults: int = 1,
    ) -> Booking: ...
    async def stay(self, *, ended_days_ago: int = 1, nights: int = 2) -> Stay: ...
    async def expire_hold(self, booking_id: int, ago: timedelta = timedelta(minutes=1)) -> None: ...


@dataclass(frozen=True)
class Booking:
    id: int
    listing_id: int
    guest_id: int
    host: User | None   # وقتی factory آگهی را ساخته باشد


@dataclass(frozen=True)
class Stay:
    host: User
    guest: User
    listing: dict[str, Any]
    booking_id: int
```

قول‌ها:

1. هر فراخوانی چیزهایی را که نگرفته، خودش می‌سازد. `booking()` بدون آرگومان، میزبان، آگهی، مهمان و رزرو می‌سازد.
2. هیچ قید یا triggerی دور زده نمی‌شود. رزرو هم‌پوشان همان `IntegrityError` با SQLSTATE `23P01` را می‌دهد که API می‌گیرد.
3. به داده‌ی دمو وابسته نیست، و روی پایگاه داده‌ای که فقط catalog دارد کار می‌کند.
4. پاک‌سازی همان `TRUNCATE` خودکار `conftest._clean` بعد از هر تست است.
5. `listing` و `guest` شناسه هم می‌پذیرند، چون تست‌های موجود شناسه نگه می‌دارند. این تغییر هنگام پیاده‌سازی برای کوچک ماندن انتقال اضافه شد.
6. `helpers.insert_booking` حذف می‌شود، و تست‌هایی که آن را صدا می‌زنند به `factory.booking` منتقل می‌شوند. `helpers.register`، `create_listing` و `reserve` می‌مانند، چون رفتار API را می‌آزمایند، نه ساخت داده را.

---

## 002. قیمت ریالی بدون سرریز

### `contracts/api.md`


endpoint تازه‌ای نیست. دو تغییر در قرارداد:

#### ۱. سقف قیمت در `openapi.json`

در `ListingCreate` و `ListingUpdate`، شاخه‌ی `number` در `price_per_night` و `cleaning_fee` مقدار `"maximum": 1000000000.0` می‌گیرد. فایل با `caravansara export-openapi` بازنویسی می‌شود، و `tests/test_openapi_contract.py` آن را با کد یکی نگه می‌دارد.

```json
"price_per_night": {
  "anyOf": [{"exclusiveMinimum": 0.0, "maximum": 1000000000.0, "type": "number"}, {"type": "string"}],
  "title": "Price Per Night"
}
```

| درخواست | پاسخ |
| --- | --- |
| `POST /listings` با `price_per_night: "1000000000.00"` | ۲۰۱ |
| `POST /listings` با `price_per_night: "1000000000.01"` | ۴۲۲، `{"error": {"code": "validation_error", "details": [{"loc": ["body", "price_per_night"], …}]}}` |
| `PATCH /listings/{id}` با `cleaning_fee: "1000000000.01"` | ۴۲۲، همان شکل؛ قیمت قبلی می‌ماند |

#### ۲. کد خطای تازه: `amount_too_large`

| وضعیت | کد | زمان برگشت |
| --- | --- | --- |
| 422 | `amount_too_large` | جمع رزرو (شب‌ها × قیمت شب + هزینه‌ی نظافت) از ظرفیت ذخیره (۹۹۹٬۹۹۹٬۹۹۹٬۹۹۹٫۹۹) بیشتر است |

```json
{"error": {"code": "amount_too_large", "message": "The total for this stay is too large to store."}}
```

با تنظیم پیش‌فرض (`max_nights = 365`) این کد برنمی‌گردد. فقط اگر `max_nights` به ۹۹۹ یا بیشتر برسد ممکن است (۹۹۹ × سقف + سقف = ۱۰^۱۲). کدهای خطا در `openapi.json` فهرست نمی‌شوند، پس این کد در جدول خطای `docs/backend-design.md` ثبت می‌شود.

#### بدون تغییر

شکل پاسخ‌ها (`ListingOut`، `BookingOut`، نتیجه‌ی جستجو) همان است. مبلغ‌ها همچنان `Decimal` با دو رقم اعشار، به شکل رشته‌ی JSON، برمی‌گردند.

---

## 003. بررسی ایندکس‌ها با اندازه‌گیری

### `contracts/cli.md`


API HTTP عوض نمی‌شود: `backend/openapi.json` همان می‌ماند (FR-009). رابط تازه‌ی این کار یک فرمان CLI است.

```text
caravansara measure-queries [--database NAME] [--catalog DIR] [--runs N] [--only NAME ...] [--out FILE]
```

| گزینه | پیش‌فرض | معنا |
| --- | --- | --- |
| `--database` | `caravansara_bulk` | پایگاه داده‌ی هدف روی همان سرور `database_url` |
| `--catalog` | `db/bulk/queries` (از `CARAVANSARA_SEED_DIR`) | پوشه‌ی فهرست |
| `--runs` | `5` | تعداد اجرای اندازه‌گیری، بعد از ۱ اجرای گرم‌کننده |
| `--only` | همه | فقط این کوئری‌ها |
| `--out` | هیچ | نوشتن نتیجه در JSON (data-model §۲) |

| حالت | خروجی | کد |
| --- | --- | --- |
| موفق | جدول Markdown: نام، میانه، هدف، ✓/✗، دسترسی، ایندکس‌ها | 0 |
| `environment = production` | `measure-queries is for development and measurement only` | 1 |
| پایگاه داده‌ی هدف خالی است (آگهی ندارد) | `caravansara_bulk has no listings; run: caravansara seed-bulk` | 1 |
| فهرست نامعتبر (نام تکراری، فایل SQL گم، `source` ناموجود) | `invalid query catalog: <name>: <rule>` | 1 |
| خطای SQL یک کوئری | نام کوئری و خطای پایگاه داده؛ بقیه اجرا می‌شوند | 1 در پایان |

هر کوئری اتصال تازه‌ی خودش را می‌گیرد. دلیل: وقتی یک backend یک بار JIT کند، همه‌ی کوئری‌های بعدی‌اش کند می‌شوند (۵۵ ms به ۱۵۵ ms، measurements.md)، پس اتصال مشترک عدد کوئری‌های بعدی را خراب می‌کرد. `params.sql` هم روی اتصال جدا خوانده می‌شود.

دستورهای `kind = write` همیشه در `BEGIN … ROLLBACK` اجرا می‌شوند. فرمان هیچ ردیفی را عوض نمی‌کند، و این با تست ثابت می‌شود.

---

## 004. تأیید آگهی توسط مدیر سیستم (admin)

### `contracts/api.md`


قرارداد اصلی `backend/openapi.json` است (constitution اصل III). این فایل تغییرهایی را می‌گوید که پس از پیاده‌سازی با `caravansara export-openapi` در آن می‌آیند. همه‌ی تغییرها افزودنی‌اند (FR-017)، و هیچ کد خطای موجودی عوض یا حذف نمی‌شود. همه‌ی خطاها شکل `{"error": {"code", "message", "details"?}}` دارند.

#### تغییر در endpointهای موجود

| Endpoint | تغییر |
|---|---|
| `GET /api/v1/me/listings` | هر `ListingSummary` فیلد `review` می‌گیرد (`ListingReview`، پایین را ببینید). |
| `GET /api/v1/listings/{listing_id}` | آگهی غیرعمومی فقط برای میزبان و مهمانِ دارای رزرو زنده دیده می‌شود (FR-019). برای بقیه `404 not_found`. `ListingOut.review` فقط برای میزبان پر است، و برای بقیه `null` (مثل `private_location`). |
| `GET /api/v1/listings/{listing_id}/reviews` | بیننده‌ی اختیاری (Bearer)؛ همان قاعده‌ی دیدن صفحه‌ی آگهی (R8). |
| `POST /api/v1/bookings` | آگهی غیرعمومی همان `404 not_found` امروزِ آگهی غیرفعال را می‌گیرد. |
| `GET /api/v1/search/listings`، `GET /api/v1/search/filters` (شمارش‌ها) | فقط آگهی عمومی. شکل پاسخ تغییری نمی‌کند. |
| `POST/PATCH /listings…`، `PUT …/amenities`، `POST/PATCH …/photos…` | پاسخ همان است و `review` را دارد. ویرایش توصیفی آگهی تأییدشده آن را `pending` می‌کند (FR-009). |

##### `ListingReview`

```json
{
  "status": "pending | approved | rejected",
  "rejection_reason": "string | null",
  "submitted_at": "date-time | null"
}
```

`rejection_reason` فقط برای `rejected` پر است (FR-003).

#### Endpointهای تازه‌ی میزبان

##### `POST /api/v1/listings/{listing_id}/resubmit`

ارسال دوباره‌ی آگهی ردشده (FR-008). بدنه ندارد.

| پاسخ | وقتی |
|---|---|
| `200 ListingOut` | آگهی `pending` شد و به انتهای صف رفت. |
| `401 unauthorized \| invalid_token \| token_expired` | بدون ورود عضو. |
| `403 not_listing_host` | آگهی مال این کاربر نیست. |
| `404 not_found` | آگهی نیست. |
| `409 listing_not_rejected` | آگهی `rejected` نیست (US2/AC5). |

#### Endpointهای admin (`tags: ["Admin"]`)

همه زیر `/api/v1/admin`. وقتی `CARAVANSARA_ADMIN_HOST` پر است، برای `Host` دیگر `404 not_found` می‌دهند (R12). همه جز ورود Bearer با توکن admin می‌خواهند. بدون آن `401` می‌دهند، پیش از هر جست‌وجوی آگهی (FR-020، R13).

- **در OpenAPI:** این endpointها طرح امنیتی جدای `AdminBearer` دارند، تا Swagger توکن admin را جدا از توکن عضو (`HTTPBearer`) نگه دارد. هر دو `Authorization: Bearer` هستند، و نوع توکن (`type`) تصمیم می‌گیرد.
- **توکن admin روی مسیرهای عضو:** هر endpoint با `CurrentUserId` یا بیننده‌ی اختیاری (`GET /listings/{id}`، `GET /listings/{id}/reviews`) با توکن admin `401 invalid_token` می‌دهد، نه نمایش عمومی. admin صفحه‌ی عمومی را بدون توکن، یا جزئیات را از `GET /admin/listings/{id}` می‌بیند.

##### `POST /api/v1/admin/auth/login`

```json
{ "email": "admin@example.com", "password": "..." }
```

| پاسخ | وقتی |
|---|---|
| `200 {"access_token", "token_type": "bearer", "expires_in"}` | حساب admin فعال. بدون refresh token (R2). |
| `401 invalid_credentials` | رمز یا ایمیل اشتباه، حساب عضو، یا حساب از کار افتاده: همه یک پیام دارند. |
| `422 validation_error` | |
| `429 too_many_attempts` | سقف تلاش (R3). |

##### `GET /api/v1/admin/listings/pending?limit&offset`

صف از قدیمی‌ترین `submitted_at` (FR-004). پاسخ: `{"items": [AdminQueueItem], "total"}`.

`AdminQueueItem`: `id`، `title`، `city` (`CityOut`)، `host` (`HostOut`)، `submitted_at`، `cover_url`، `review_version`.

##### `GET /api/v1/admin/listings/{listing_id}`

هر آگهی، با هر وضعیتی. هر پاسخ یک ردیف `admin_address_views` می‌نویسد (FR-018).

پاسخ `AdminListingOut` همه‌ی `ListingOut` است به‌علاوه‌ی:

- `private_location` همیشه پر است.
- `review` (`ListingReview`).
- `review_version`.

| پاسخ | وقتی |
|---|---|
| `200 AdminListingOut` | |
| `401` | admin نیست. |
| `404 not_found` | آگهی نیست. |

##### `POST /api/v1/admin/listings/{listing_id}/approve`

```json
{ "review_version": 3 }
```

##### `POST /api/v1/admin/listings/{listing_id}/reject`

```json
{ "review_version": 3, "reason": "عکس‌ها مال این خانه نیستند." }
```

`reason`: پس از `strip` ۱ تا ۱۰۰۰ نویسه (FR-005).

پاسخ هر دو:

| پاسخ | وقتی |
|---|---|
| `200 AdminListingOut` | تصمیم ثبت شد. |
| `401` | admin نیست. |
| `404 not_found` | آگهی نیست. |
| `409 listing_not_pending` | آگهی دیگر در انتظار نیست، مثلاً تصمیم admin دیگر زودتر رسید (FR-006). |
| `409 listing_changed` | میزبان پس از دیدن admin توصیف را عوض کرد؛ جزئیات را دوباره بگیرید (R6). |
| `422 validation_error` | دلیل خالی، فقط فاصله یا بلندتر از ۱۰۰۰ نویسه. |

SC-006: صف، جزئیات و تصمیم سه درخواست‌اند.

#### کدهای خطای تازه

| کد | HTTP | معنی |
|---|---|---|
| `listing_not_rejected` | 409 | ارسال دوباره فقط برای آگهی ردشده. |
| `listing_not_pending` | 409 | تصمیم فقط برای آگهی در انتظار. |
| `listing_changed` | 409 | نسخه‌ای که admin دید دیگر نسخه‌ی فعلی نیست. |

### `contracts/cli.md`


هر دو فرمان در image API هستند (`caravansara …`)، و فقط کسی که به سرور دسترسی دارد اجرایشان می‌کند (FR-012، constitution اصل V).

#### `caravansara create-admin --email EMAIL --name NAME`

- **رمز:** از `CARAVANSARA_ADMIN_PASSWORD` خوانده می‌شود، یا اگر خالی باشد دو بار با `getpass` پرسیده می‌شود. ۸ تا ۱۲۸ نویسه است، و هرگز آرگومان فرمان نیست (R14).
- **موفق:** یک حساب تازه با `kind = 'admin'` ساخته می‌شود. فرمان `admin created: <id>` را چاپ می‌کند و با کد 0 خارج می‌شود. ایمیل در خروجی نیست (اصل V، log).
- **ایمیلی که هر حسابی دارد** (عضو یا admin): `refused: an account with this email already exists; admin accounts are always new`. کد 1؛ هیچ ردیفی ساخته یا عوض نمی‌شود (US4/AC2).
- **رمز نامعتبر یا دو بار نابرابر:** پیام روشن، کد 1.

#### `caravansara disable-admin --email EMAIL`

- **موفق:** `disabled_at = now()` برای آن admin نوشته می‌شود. چاپ `admin disabled: <id>`، کد 0. از درخواست بعدی هیچ اقدام admin کار نمی‌کند (R2)، و سابقه‌ی تصمیم‌ها می‌ماند.
- **ایمیلی که admin نیست** (نیست، یا حساب عضو است): `refused: no admin account with this email`، کد 1.
- **از قبل از کار افتاده:** `refused: this admin account is already disabled`، کد 1.

#### `caravansara seed-demo` (تغییر)

- در `CARAVANSARA_ENVIRONMENT=production`، فرمان `refused: demo data is for development only` چاپ می‌کند و با کد 1 خارج می‌شود (R15).
- داده‌ی دمو یک حساب `admin@example.com` دارد، با همان رمز همه‌ی حساب‌های دمو (`caravansara-demo`).
