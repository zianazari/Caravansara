# Data Model: قیمت ریالی بدون سرریز

جدول یا رابطه‌ی تازه‌ای نیست. فقط ظرفیت پنج ستون مبلغ عوض می‌شود.

## ستون‌ها

| جدول | ستون | قبل | بعد | قیدها (بدون تغییر) |
| --- | --- | --- | --- | --- |
| `listings` | `price_per_night` | `NUMERIC(10,2)` | `NUMERIC(14,2)` | `NOT NULL`، `CHECK (price_per_night > 0)` |
| `listings` | `cleaning_fee` | `NUMERIC(10,2)` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0`، `CHECK (cleaning_fee >= 0)` |
| `bookings` | `nightly_price` | `NUMERIC(10,2)` | `NUMERIC(14,2)` | `NOT NULL` |
| `bookings` | `cleaning_fee` | `NUMERIC(10,2)` | `NUMERIC(14,2)` | `NOT NULL DEFAULT 0` |
| `bookings` | `total_price` | `NUMERIC(10,2)` | `NUMERIC(14,2)` | `NOT NULL` |

## مقدارهای مرزی

| نام | مقدار | کجا | دلیل |
| --- | --- | --- | --- |
| `MAX_PRICE` | `1000000000.00` | `listings/schemas.py` | سقف قیمت شب و هزینه‌ی نظافت در همه‌ی ارزها (Clarification 2026-11-05) |
| `MAX_STORED_AMOUNT` | `999999999999.99` | `bookings/rules.py` | ظرفیت `NUMERIC(14,2)`؛ نگهبان جمع رزرو (R5) |
| بدترین جمع مجاز | `366000000000.00` | — | `MAX_PRICE × 365 + MAX_PRICE`؛ کمتر از `MAX_STORED_AMOUNT` |

## قاعده‌های اعتبارسنجی

| ورودی | قاعده | خطا |
| --- | --- | --- |
| `price_per_night` | `0 < x ≤ 1000000000.00`، حداکثر ۲ رقم اعشار | ۴۲۲ `validation_error`، `loc` فیلد |
| `cleaning_fee` | `0 ≤ x ≤ 1000000000.00`، حداکثر ۲ رقم اعشار | ۴۲۲ `validation_error`، `loc` فیلد |
| جمع رزرو (حساب‌شده) | `≤ 999999999999.99` | ۴۲۲ `amount_too_large`؛ هیچ رزروی ساخته نمی‌شود |

## migration

`0002_wider_price_columns`، بعد از `0001`:

- **upgrade:** پنج ستون → `NUMERIC(14,2)`. بدون بازنویسی جدول (research R3).
- **downgrade:** پنج ستون → `NUMERIC(10,2)`. اگر مقداری جا نشود، PostgreSQL با `22003` متوقف می‌شود، تراکنش برمی‌گردد و داده همان می‌ماند.
