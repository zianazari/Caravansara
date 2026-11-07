# Data Model: تأیید آگهی توسط مدیر سیستم (admin)

همه با migration `0006_listing_review` (R5، R16). `db/schema.sql`، `db/schema.dbml` و ERD از آن پیروی می‌کنند.

## Typeهای تازه

| Type | مقدارها |
|---|---|
| `account_kind` | `member`, `admin` |
| `listing_review_status` | `pending`, `approved`, `rejected` |
| `review_action` | `submitted`, `edited`, `resubmitted`, `approved`, `rejected` |

## `users` (تغییر)

| ستون | نوع | قاعده |
|---|---|---|
| `kind` | `account_kind NOT NULL DEFAULT 'member'` | فقط `create-admin` مقدار `admin` می‌نویسد (FR-012). هیچ schema ورودی عمومی این فیلد را ندارد. |
| `disabled_at` | `timestamptz NULL` | فقط `disable-admin` پرش می‌کند. admin با `disabled_at` پر نه وارد می‌شود و نه هیچ اقدام admin انجام می‌دهد (R2). |

- یکتایی ایمیل همان ایندکس امروز روی `lower(email)` است و هر دو نوع حساب را می‌پوشاند (R1).
- **`auth_attempts.action`:** CHECK آن از `('login', 'register')` به `('login', 'register', 'admin_login')` گسترش می‌یابد، تا ورود admin با همان جدول و جدا شمرده شود (R3). این را plan ندیده بود؛ اولین تست ورود admin در پیاده‌سازی آن را پیدا کرد. downgrade ردیف‌های `admin_login` را حذف و CHECK قبلی را برمی‌گرداند.
- ورود عادی فقط `kind = 'member'` را می‌پذیرد، و ورود admin فقط `kind = 'admin' AND disabled_at IS NULL` را.

## `listings` (تغییر)

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

### انتقال وضعیت

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

## `listing_review_events` (تازه، ماژول `listings`)

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

## `admin_address_views` (تازه، ماژول `moderation`)

| ستون | نوع |
|---|---|
| `id` | `bigint identity` |
| `admin_id` | `bigint NOT NULL REFERENCES users` |
| `listing_id` | `bigint NOT NULL REFERENCES listings` |
| `viewed_at` | `timestamptz NOT NULL DEFAULT now()` |

یک ردیف برای هر پاسخ `GET /api/v1/admin/listings/{id}`، در همان تراکنش (FR-018، SC-009). این کار هیچ رابطی برای خواندن سابقه نمی‌سازد (Assumptions)، پس ایندکس دیگری ندارد.

## ساختارهای میان ماژول‌ها

- `listings.service.ListingInfo` می‌گیرد: `review_status` و `is_public`. `bookings` به‌جای `is_active` شرط `is_public` را بررسی می‌کند.
- `listings.service` برای `moderation` این‌ها را دارد: `review_queue(limit, offset)`، `review_detail(listing_id)` (با نشانی دقیق)، `decide(listing_id, admin_id, version, approve | reject(reason))`، و `review_queue_stats()` برای worker.
- `identity.service` برای `moderation` و `cli` این‌ها را دارد: `admin_login`، `require_active_admin`، `create_admin` و `disable_admin`.
