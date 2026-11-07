# API Contract changes: تأیید آگهی

قرارداد اصلی `backend/openapi.json` است (constitution اصل III). این فایل تغییرهایی را می‌گوید که پس از پیاده‌سازی با `caravansara export-openapi` در آن می‌آیند. همه‌ی تغییرها افزودنی‌اند (FR-017)، و هیچ کد خطای موجودی عوض یا حذف نمی‌شود. همه‌ی خطاها شکل `{"error": {"code", "message", "details"?}}` دارند.

## تغییر در endpointهای موجود

| Endpoint | تغییر |
|---|---|
| `GET /api/v1/me/listings` | هر `ListingSummary` فیلد `review` می‌گیرد (`ListingReview`، پایین را ببینید). |
| `GET /api/v1/listings/{listing_id}` | آگهی غیرعمومی فقط برای میزبان و مهمانِ دارای رزرو زنده دیده می‌شود (FR-019). برای بقیه `404 not_found`. `ListingOut.review` فقط برای میزبان پر است، و برای بقیه `null` (مثل `private_location`). |
| `GET /api/v1/listings/{listing_id}/reviews` | بیننده‌ی اختیاری (Bearer)؛ همان قاعده‌ی دیدن صفحه‌ی آگهی (R8). |
| `POST /api/v1/bookings` | آگهی غیرعمومی همان `404 not_found` امروزِ آگهی غیرفعال را می‌گیرد. |
| `GET /api/v1/search/listings`، `GET /api/v1/search/filters` (شمارش‌ها) | فقط آگهی عمومی. شکل پاسخ تغییری نمی‌کند. |
| `POST/PATCH /listings…`، `PUT …/amenities`، `POST/PATCH …/photos…` | پاسخ همان است و `review` را دارد. ویرایش توصیفی آگهی تأییدشده آن را `pending` می‌کند (FR-009). |

### `ListingReview`

```json
{
  "status": "pending | approved | rejected",
  "rejection_reason": "string | null",
  "submitted_at": "date-time | null"
}
```

`rejection_reason` فقط برای `rejected` پر است (FR-003).

## Endpointهای تازه‌ی میزبان

### `POST /api/v1/listings/{listing_id}/resubmit`

ارسال دوباره‌ی آگهی ردشده (FR-008). بدنه ندارد.

| پاسخ | وقتی |
|---|---|
| `200 ListingOut` | آگهی `pending` شد و به انتهای صف رفت. |
| `401 unauthorized \| invalid_token \| token_expired` | بدون ورود عضو. |
| `403 not_listing_host` | آگهی مال این کاربر نیست. |
| `404 not_found` | آگهی نیست. |
| `409 listing_not_rejected` | آگهی `rejected` نیست (US2/AC5). |

## Endpointهای admin (`tags: ["Admin"]`)

همه زیر `/api/v1/admin`. وقتی `CARAVANSARA_ADMIN_HOST` پر است، برای `Host` دیگر `404 not_found` می‌دهند (R12). همه جز ورود Bearer با توکن admin می‌خواهند. بدون آن `401` می‌دهند، پیش از هر جست‌وجوی آگهی (FR-020، R13).

### `POST /api/v1/admin/auth/login`

```json
{ "email": "admin@example.com", "password": "..." }
```

| پاسخ | وقتی |
|---|---|
| `200 {"access_token", "token_type": "bearer", "expires_in"}` | حساب admin فعال. بدون refresh token (R2). |
| `401 invalid_credentials` | رمز یا ایمیل اشتباه، حساب عضو، یا حساب از کار افتاده: همه یک پیام دارند. |
| `422 validation_error` | |
| `429 too_many_attempts` | سقف تلاش (R3). |

### `GET /api/v1/admin/listings/pending?limit&offset`

صف از قدیمی‌ترین `submitted_at` (FR-004). پاسخ: `{"items": [AdminQueueItem], "total"}`.

`AdminQueueItem`: `id`، `title`، `city` (`CityOut`)، `host` (`HostOut`)، `submitted_at`، `cover_url`، `review_version`.

### `GET /api/v1/admin/listings/{listing_id}`

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

### `POST /api/v1/admin/listings/{listing_id}/approve`

```json
{ "review_version": 3 }
```

### `POST /api/v1/admin/listings/{listing_id}/reject`

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

## کدهای خطای تازه

| کد | HTTP | معنی |
|---|---|---|
| `listing_not_rejected` | 409 | ارسال دوباره فقط برای آگهی ردشده. |
| `listing_not_pending` | 409 | تصمیم فقط برای آگهی در انتظار. |
| `listing_changed` | 409 | نسخه‌ای که admin دید دیگر نسخه‌ی فعلی نیست. |
