# Data Model: صفحه‌های میزبان در سایت

**بی migration و بی تغییر API.** موجودیت‌های این کار فقط در سایت‌اند. داده‌ی آگهی همان `ListingCreate`، `ListingUpdate` و `ListingOut` API است.

## Listing draft (`lib/listingDraft.ts`، `sessionStorage` با کلید `cv-listing-draft`)

| گام | فیلدها | قاعده (همان API) |
| --- | --- | --- |
| ۱. نوع | `property_type` | `entire_place`، `private_room` یا `shared_room` |
| ۲. مکان | `city_id`، `neighborhood`، `address`، `latitude`، `longitude` | شهر از `GET /cities`؛ محله تا ۱۰۰ نویسه؛ نشانی ۱ تا ۳۰۰ نویسه؛ عرض −۹۰ تا ۹۰؛ طول −۱۸۰ تا ۱۸۰ |
| ۳. ظرفیت | `max_guests`، `bedrooms`، `beds`، `bathrooms`، `pets_allowed`، `max_pets` | مهمان ۱ تا ۵۰؛ اتاق خواب ۰ تا ۵۰؛ تخت ۰ تا ۱۰۰؛ حمام ۰ تا ۵۰ (نیم مجاز)؛ حیوان ۰ تا ۱۰، و ۰ اگر حیوان مجاز نیست |
| ۴. امکانات | `amenity_ids` | از `GET /amenities` |
| ۵. توصیف | `title`، `description` | عنوان ۱ تا ۲۰۰؛ توضیح تا ۵۰۰۰ |
| ۶. قیمت | `currency`، `price_per_night`، `cleaning_fee` | ISO 4217؛ شبانه بیش از ۰ و تا سقف؛ نظافت ۰ تا سقف؛ سقف ۱٬۰۰۰٬۰۰۰٬۰۰۰ در هر واحد. برای ریال، ورودی تومان و ×۱۰ پیش از ارسال (R7) |
| ۷. ساعت‌ها | `check_in_time`، `check_out_time` | `HH:MM` |
| ۸. عکس‌ها | فقط در صفحه، نه در پیش‌نویس | دست‌کم ۳ عکس (Q1)؛ هر کدام تا ۱۰ مگابایت، JPEG، PNG یا WebP |

**پاک شدن:** پس از ارسال موفق، یا با «شروع از نو».

**نگاشت خطای فیلد به گام (FR-015):** پاسخ `422 validation_error` در `details.fields` نام فیلدها را دارد. هر نام به گام همان فیلد در جدول بالا می‌رود، پیام کنار فیلد می‌آید، و ساخت به نخستین گام نادرست برمی‌گردد. نام ناشناخته پیام را بالای گام فعلی می‌گذارد.

## Photo upload item (فقط در حافظه‌ی صفحه)

| فیلد | معنی |
| --- | --- |
| `file` | فایل انتخاب‌شده |
| `preview` | `blob:` URL برای پیش‌نمایش |
| `status` | `queued`، سپس `uploading`، سپس `registered`؛ یا `failed` |
| `progress` | ۰ تا ۱، از `XMLHttpRequest.upload.onprogress` |
| `width`، `height` | از `createImageBitmap`، پیش از ثبت |
| `room_tag`، `caption` | اختیاری |
| `photo_id` | پس از ثبت (`POST …/photos`) |

## Listing status (`lib/listingStatus.ts`، محاسبه، بی ذخیره)

| شرط | وضعیت | نشان |
| --- | --- | --- |
| `review.status == "pending"` | `pending` | «در انتظار تأیید» |
| `review.status == "rejected"` | `rejected` | «رد شده»، و `review.rejection_reason` |
| `approved` و `is_active` | `active` | «فعال» |
| `approved` و نه `is_active` | `inactive` | «غیرفعال» |
| هر وضعیت، با کمتر از ۳ عکس | به‌علاوه‌ی `fewPhotos` | «عکس‌ها کامل نیست» |

## Review fields (`lib/reviewFields.ts`، فهرست قاعده‌ی ۰۰۴)

| بازبینی می‌خواهد (هشدار برای آگهی تأییدشده) | بازبینی نمی‌خواهد (بی هشدار) |
| --- | --- |
| `title`، `description`، `city_id`، `neighborhood`، `address`، `latitude`، `longitude`، `property_type`، امکانات، عکس تازه، برچسب و توضیح عکس | `price_per_night`، `cleaning_fee`، `currency`، `is_active`، ترتیب و کاور عکس‌ها، حذف عکس، `check_in_time`، `check_out_time`، ظرفیت (`max_guests`، `bedrooms`، `beds`، `bathrooms`)، `pets_allowed`، `max_pets` |
