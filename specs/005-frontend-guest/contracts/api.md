# Contract: تغییر API برای آواتار

این سند تنها تغییر API در این کار است (research R1 و R20). سه endpoint تازه افزودنی‌اند. یک تغییر محدودکننده هم هست: `PATCH /me` دیگر نشانی عکس بیرونی را نمی‌پذیرد (بخش ۴، FR-041). هیچ مسیر، فیلد یا کد خطایی حذف نمی‌شود. `backend/openapi.json` با `caravansara export-openapi` به‌روز می‌شود، و `tests/test_openapi_contract.py` آن را با کد می‌سنجد (اصل III). شمار عملیات‌ها از ۳۶ به ۳۹ می‌رسد.

همه‌ی مسیرها زیر `/api/v1`، در ماژول `identity`، با امنیت `HTTPBearer` (کاربر) و برچسب `Account` هستند.

## 1. `POST /me/avatar/upload-url`

**بدنه (`AvatarUploadUrlIn`):**

```json
{ "content_type": "image/png" }
```

| فیلد | نوع | قاعده |
| --- | --- | --- |
| `content_type` | `AvatarType` = `"image/png"` \| `"image/jpeg"` | هر مقدار دیگر: `422 validation_error` |

**پاسخ `200` (`AvatarUploadUrlOut`، هم‌شکل `UploadUrlOut` عکس آگهی ولی تعریف‌شده در `identity`، چون import میان ماژول‌ها ممنوع است):**

```json
{
  "storage_key": "avatars/42/9b1d…e3.png",
  "url": "http://localhost:9000/caravansara-media",
  "fields": { "key": "avatars/42/9b1d…e3.png", "Content-Type": "image/png", "policy": "…", "x-amz-signature": "…" },
  "expires_in": 600
}
```

**policy:** `Content-Type` همان مقدار اعلام‌شده، و `content-length-range` از `1` تا `max_avatar_bytes` (۵٬۲۴۲٬۸۸۰). MinIO فایل بزرگ‌تر را با `400 EntityTooLarge` رد می‌کند، و آن فایل اصلاً ذخیره نمی‌شود.

**خطاها:** `401 invalid_token` | `token_expired`، و `422 validation_error`.

## 2. `PUT /me/avatar`

**بدنه (`AvatarSetIn`):**

```json
{ "storage_key": "avatars/42/9b1d…e3.png" }
```

**بررسی‌ها، به ترتیب:**

| # | شرط | خطا |
| --- | --- | --- |
| 1 | `storage_key` با `avatars/{user_id}/` شروع شود، و طولش ≤ ۳۰۰ باشد | `422 invalid_storage_key` |
| 2 | فایل در storage باشد | `422 upload_missing` |
| 3 | اندازه‌ی فایل ≤ `max_avatar_bytes` باشد | `422 image_too_large`، با `details: {"max_bytes": 5242880}`؛ فایل پاک می‌شود |
| 4 | بایت‌های اول فایل PNG (`89 50 4E 47 0D 0A 1A 0A`) یا JPEG (`FF D8 FF`) باشند | `422 invalid_image`؛ فایل پاک می‌شود |

**در صورت موفقیت:**
- `users.avatar_url` = نشانی عمومی فایل (`media_base_url/storage_key`).
- پس از commit، فایل قبلی کاربر پاک می‌شود، اگر زیر `avatars/{user_id}/` بوده و با فایل تازه فرق داشته باشد. اگر پاک کردن در storage شکست بخورد، فقط در لاگ ثبت می‌شود و پاسخ را خراب نمی‌کند.

**پاسخ `200`:** `UserOut` با `avatar_url` تازه.

**خطاهای دیگر:** `401 invalid_token` | `token_expired`.

## 3. `DELETE /me/avatar`

- **کار:** `avatar_url` را `null` می‌کند. پس از commit، اگر نشانی قبلی فایلی زیر `avatars/{user_id}/` بود، آن فایل پاک می‌شود.
- **پاسخ `200`:** `UserOut` با `avatar_url: null`. اگر کاربر از قبل عکسی نداشت، همین پاسخ تکرار می‌شود (idempotent).
- **خطاها:** `401 invalid_token` | `token_expired`.

## 4. `PATCH /me` (رفتار محدودتر، FR-041)

- **`full_name`:** بی‌تغییر.
- **`avatar_url`:** schema آن همان `AnyHttpUrl | null` می‌ماند. رفتارش این است:
  - `null` دقیقاً همان کار `DELETE /me/avatar` را می‌کند: فایل قبلی پاک می‌شود.
  - هر نشانی دیگر MUST با `{media_base_url}/avatars/{user_id}/` شروع شود. کلید از نشانی جدا می‌شود و همان بررسی‌های `PUT /me/avatar` (ردیف‌های ۲ تا ۴: وجود فایل، اندازه، امضا) روی آن اجرا می‌شود. سپس همان جایگزینی و پاک شدن فایل قبلی انجام می‌شود.
  - نشانی بیرون از این پیشوند: `422 invalid_avatar_url`، و پروفایل عوض نمی‌شود. اگر `full_name` هم در همان درخواست باشد، آن هم ذخیره نمی‌شود، چون درخواست یکجا پذیرفته یا رد می‌شود.
- **پیاده‌سازی:** `PATCH /me` و `PUT /me/avatar` یک تابع service مشترک دارند، تا دو مسیر هرگز از هم جدا نشوند.
- **توضیح فیلد در Swagger:** به این قاعده و به `PUT /me/avatar` اشاره می‌کند.

**اثر روی کلاینت‌ها:** فقط دو تست امروز نشانی بیرونی می‌فرستند: `backend/tests/test_identity.py:108` و `e2e/tests/auth.spec.ts:91`. هر دو به جریان تازه (آپلود و سپس `PATCH` با نشانی storage، یا `null`) تغییر می‌کنند. در پایگاه داده‌ها، ۱۱ ردیف `caravansara` با `https://example.com/avatar.png` همه داده‌ی باقی‌مانده از e2e‌اند، و `caravansara_demo` و `caravansara_bulk` هیچ `avatar_url` ندارند. migration لازم نیست. سایت نشانی‌های بیرونی قدیمی را نادیده می‌گیرد و آواتار پیش‌فرض را نشان می‌دهد.

## کدهای خطای تازه

| وضعیت | کد | زمان برگشت |
| --- | --- | --- |
| 422 | `image_too_large` | فایل ثبت‌شده برای آواتار بزرگ‌تر از `max_avatar_bytes` است |
| 422 | `invalid_image` | محتوای فایل PNG یا JPEG نیست، هر چه نام یا نوع اعلام‌شده‌اش باشد |
| 422 | `invalid_avatar_url` | `PATCH /me` با `avatar_url` بیرون از storage سیستم، یا بیرون از پیشوند همان کاربر |

## تنظیم تازه

| متغیر | پیش‌فرض | کاربرد |
| --- | --- | --- |
| `CARAVANSARA_MAX_AVATAR_BYTES` | `5242880` | سقف آواتار در policy آپلود و در بررسی `PUT /me/avatar` |

## بدون تغییر

- **`UserOut.avatar_url`، `HostOut.avatar_url` و `ReviewAuthor.avatar_url`:** مثل امروز هستند. هر جا `null` باشد، سایت آواتار پیش‌فرض را نشان می‌دهد.

## مشاهده‌پذیری (اصل VI)

سه endpoint تازه، و `PATCH /me`، از همان middleware می‌گذرند: لاگ درخواست، متریک با route template و trace. رویداد کسب‌وکاری که ارزش شمارنده‌ی جدا داشته باشد ندارند.
