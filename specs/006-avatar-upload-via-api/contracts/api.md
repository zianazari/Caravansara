# Contract: endpointهای عکس پروفایل

قرارداد اصلی `backend/openapi.json` است (اصل III). این سند تغییر آن را پیش از ساخت می‌گوید. عمل‌ها از ۳۹ به ۳۸ می‌رسند.

## برداشته می‌شود (breaking)

- `POST /api/v1/me/avatar/upload-url`: پس از این کار 404 (`not_found`) می‌دهد.
- schemaهای `AvatarUploadUrlIn`، `AvatarUploadUrlOut` و `AvatarSetIn`.

## `PUT /api/v1/me/avatar` (بدنه‌اش عوض می‌شود: breaking)

**گذاشتن یا عوض کردن عکس پروفایل.** خود فایل در بدنه است.

- **Auth:** `Authorization: Bearer <access token>`
- **Request headers:**
  - `Content-Type`: `image/png` یا `image/jpeg` (اجباری)
  - `Content-Length`: پیشنهادی. بی آن، سرور هنگام خواندن می‌شمارد.
- **Request body:** بایت‌های فایل. در OpenAPI به شکل `{"type": "string", "format": "binary"}` برای هر دو media type آمده است.

| پاسخ | وقتی | بدنه |
| --- | --- | --- |
| 200 | فایل بررسی، ذخیره و ثبت شد. فایل قبلی پاک شد. | `UserOut` با `avatar_url` تازه |
| 401 | بی ورود | `{"error": {"code": "unauthorized", …}}` |
| 413 | بیش از ۵٬۲۴۲٬۸۸۰ بایت (از `Content-Length` یا هنگام خواندن) | `{"error": {"code": "image_too_large", "message", "details": {"max_bytes": 5242880}}}` |
| 415 | `Content-Type` نیست، یا جز دو قالب مجاز است | `{"error": {"code": "unsupported_image_type", "message", "details": {"allowed": ["image/png", "image/jpeg"]}}}` |
| 422 | بدنه‌ی خالی، یا محتوا نه PNG و نه JPEG | `{"error": {"code": "invalid_image", …}}` |
| 503 | storage در دسترس نیست | `{"error": {"code": "service_unavailable", …}}` (کد تازه در بکند) |

در هر پاسخ جز 200، هیچ فایلی در storage نوشته نشده است، و `avatar_url` کاربر همان قبلی است.

## بی‌تغییر

- `DELETE /api/v1/me/avatar`: همان 005. فقط اکنون زیر قفل ردیف کاربر کار می‌کند.
- `PATCH /api/v1/me`:
  - `avatar_url` فقط نشانی‌ای زیر `{media_base_url}/avatars/{user_id}/` را می‌پذیرد، که فایلش موجود است و بررسی را گذرانده است (`invalid_avatar_url`، `upload_missing`، `image_too_large`، `invalid_image`).
  - فقط توضیح فیلد عوض می‌شود: به‌جای `POST /me/avatar/upload-url`، `PUT /me/avatar` را نام می‌برد.
  - **وضعیت‌ها همان ۰۰۵ می‌مانند:** همه‌ی خطاهای این مسیر 422 هستند، از جمله `image_too_large` برای فایلی که در storage هست. پس یک کد در `PUT` با 413 و در `PATCH` با 422 می‌آید. 413 فقط برای بدنه‌ی درخواستِ بزرگ است، و در `PATCH` بدنه کوچک است و فایل از پیش ذخیره شده (analyze I2).

## سایت: `/{api}/v1/*` (route handler)

- **بدنه‌ی بزرگ:** بدنه‌ی بیش از `MAX_FORWARD_BYTES` (۵٬۲۴۲٬۸۸۰ + ۶۵٬۵۳۶ بایت) با 413 و `image_too_large` رد می‌شود و به API نمی‌رسد.
- **فرستادن به API:** بدنه stream می‌شود، نه آن‌که کل آن در حافظه خوانده شود.

## کدهای خطای تازه

| کد | HTTP | معنی | فارسی (سایت) |
| --- | --- | --- | --- |
| `unsupported_image_type` | 415 | قالب اعلام‌شده PNG یا JPEG نیست | «فقط عکس PNG یا JPEG پذیرفته می‌شود.» |
| `service_unavailable` | 503 | storage در دسترس نیست (در بکند تازه است؛ سایت آن را از ۰۰۵ برای قطع اتصال به API دارد) | ترجمه‌ی موجود |
