# Contract: تغییر API

endpoint تازه‌ای نیست. دو تغییر در قرارداد:

## ۱. سقف قیمت در `openapi.json`

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

## ۲. کد خطای تازه: `amount_too_large`

| وضعیت | کد | زمان برگشت |
| --- | --- | --- |
| 422 | `amount_too_large` | جمع رزرو (شب‌ها × قیمت شب + هزینه‌ی نظافت) از ظرفیت ذخیره (۹۹۹٬۹۹۹٬۹۹۹٬۹۹۹٫۹۹) بیشتر است |

```json
{"error": {"code": "amount_too_large", "message": "The total for this stay is too large to store."}}
```

با تنظیم پیش‌فرض (`max_nights = 365`) این کد برنمی‌گردد. فقط اگر `max_nights` به ۹۹۹ یا بیشتر برسد ممکن است (۹۹۹ × سقف + سقف = ۱۰^۱۲). کدهای خطا در `openapi.json` فهرست نمی‌شوند، پس این کد در جدول خطای `docs/backend-design.md` ثبت می‌شود.

## بدون تغییر

شکل پاسخ‌ها (`ListingOut`، `BookingOut`، نتیجه‌ی جستجو) همان است. مبلغ‌ها همچنان `Decimal` با دو رقم اعشار، به شکل رشته‌ی JSON، برمی‌گردند.
